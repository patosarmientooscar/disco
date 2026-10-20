import { config } from './config.js';

// Flash de transición loading → pre-hero: fogonazo blanco 0→1 en 0.04s y 1→0 en 0.5s (expo.out).
// Con movimiento reducido no hay fogonazo, solo un fundido suave.
export function initFlash({ gsap, reduced, sound }) {
  const screen = document.querySelector('[data-flash]');

  return {
    transition(onPeak) {
      const tl = gsap.timeline();
      if (reduced.matches) {
        tl.to(screen, { opacity: 0.12, duration: 0.25, ease: 'sine.inOut' })
          .add(onPeak)
          .to(screen, { opacity: 0, duration: 0.6, ease: 'sine.inOut' });
      } else {
        tl.to(screen, { opacity: 1, duration: 0.04, ease: 'none' })
          .add(() => { sound.play(); onPeak(); })
          .to(screen, { opacity: 0, duration: 0.5, ease: 'expo.out' });
      }
      return tl;
    },
  };
}

// Clic de obturador: mp3 si hay ruta en config, si no sintetizado (espejo arriba + abajo).
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
      if (enabled && !ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
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
