import { config } from './config.js';

// 1 disparo cada 0.8s como máximo → nunca más de 3 flashes por segundo.
const MIN_GAP_MS = 800;

export function initFlash({ gsap, reduced, el }) {
  let last = -Infinity;

  const burst = () =>
    gsap.timeline()
      .set(el, { opacity: 0 })
      .to(el, { opacity: 1, duration: 0.04, ease: 'none' })
      .to(el, { opacity: 0, duration: 0.5, ease: 'expo.out' });

  // Devuelve true si el disparo se acepta (respeta el límite aunque no haya flash).
  function shoot() {
    const now = performance.now();
    if (now - last < MIN_GAP_MS) return false;
    last = now;
    if (!reduced.matches) {
      gsap.killTweensOf(el);
      burst();
    }
    return true;
  }

  function intro(onReveal) {
    if (reduced.matches) {
      onReveal();
      return;
    }
    last = performance.now() + 600;
    gsap.timeline({ delay: 0.6 })
      .to(el, { opacity: 1, duration: 0.04, ease: 'none' })
      .add(onReveal)
      .to(el, { opacity: 0, duration: 0.5, ease: 'expo.out' });
  }

  return { shoot, intro };
}

// Obturador: mp3 si hay ruta en config, si no un clic sintetizado (espejo arriba + abajo).
export function createShutter() {
  let enabled = false;
  let ctx = null;
  let audio = null;

  if (config.sound.shutterSrc) {
    audio = new Audio(config.sound.shutterSrc);
    audio.preload = 'auto';
    audio.addEventListener('error', () => { audio = null; }, { once: true });
  }

  function click(at, gain, freq) {
    const len = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);

    const src = ctx.createBufferSource();
    const band = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    src.buffer = buffer;
    band.type = 'bandpass';
    band.frequency.value = freq;
    band.Q.value = 0.9;
    amp.gain.value = gain;
    src.connect(band).connect(amp).connect(ctx.destination);
    src.start(at);
  }

  return {
    get enabled() { return enabled; },
    setEnabled(value) {
      enabled = value;
      if (enabled && !audio && !ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx?.state === 'suspended') ctx.resume();
    },
    play() {
      if (!enabled) return;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      const t = ctx.currentTime;
      click(t, 0.9, 2600);
      click(t + 0.075, 0.6, 1700);
    },
  };
}
