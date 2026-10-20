import { config } from './config.js';

const CHARGE_S = 1.2;        // carga completa manteniendo pulsado
const INTRO_CHARGE_S = 1;    // carga automática al entrar
const MIN_FIRE = 0.3;        // por debajo no dispara, se descarga
const RECHARGE_S = 0.8;      // bloqueo tras el disparo (piloto en rojo)
const MIN_GAP_MS = 800;      // ≤ 1.25 disparos/s → nunca más de 3 flashes por segundo
const SHAKE_FROM = 0.8;      // la cámara vibra en el último 20% de la carga
const PILOT_MAX = 0.85;

// Estados: idle → charging → (releasing → idle) | (recharging → idle). intro = carga automática.
export function initFlash({ gsap, loop, reduced, sound }) {
  const screen = document.querySelector('[data-flash]');
  const unit = document.querySelector('[data-flash-unit]');
  const tint = { red: unit.querySelector('[data-tint-red]'), green: unit.querySelector('[data-tint-green]'), white: unit.querySelector('[data-tint-white]') };
  const glow = { red: unit.querySelector('[data-glow-red]'), green: unit.querySelector('[data-glow-green]'), white: unit.querySelector('[data-glow-white]') };
  const vignette = document.querySelector('[data-vignette]');
  const camera = document.querySelector('.camera');
  const meter = document.querySelector('[data-flash-meter]');
  const cells = [...meter.querySelectorAll('.hud__cells i')];
  const pct = meter.querySelector('[data-flash-pct]');

  const state = { charge: 0 };
  let mode = 'idle';
  let tween = null;
  let lastFire = -Infinity;
  let shaking = false;
  const fireHandlers = [];

  function render() {
    const c = state.charge;
    const recharging = mode === 'recharging';

    // piloto: rojo → verde con glow creciente; en recarga se queda rojo
    const red = recharging ? PILOT_MAX : Math.min(1, c / 0.08) * (1 - c) * PILOT_MAX;
    const green = recharging ? 0 : c * PILOT_MAX;
    tint.red.style.opacity = red;
    tint.green.style.opacity = green;
    glow.red.style.opacity = recharging ? 0.35 : red * 0.8;
    glow.green.style.opacity = green;
    const s = 0.6 + c * 0.9;
    glow.red.style.transform = glow.green.style.transform = `scale(${s.toFixed(3)})`;

    // medidor HUD
    const filled = recharging ? 0 : Math.floor(c * 5 + 1e-6);
    cells.forEach((cell, i) => { cell.style.opacity = i < filled ? 1 : 0.25; });
    pct.textContent = recharging ? 'RECARGA' : `${Math.round(c * 100)}%`;
    meter.classList.toggle('is-active', mode === 'charging' || mode === 'intro');

    // viñeta: oscurece y se cierra un 15%
    vignette.style.opacity = c;
    vignette.style.transform = reduced.matches ? 'scale(1.15)' : `scale(${(1.15 - 0.15 * c).toFixed(4)})`;

    sound.chargeUpdate(c);
  }

  // vibración de 1px a frecuencia de frame al final de la carga
  loop.add(() => {
    const k = (state.charge - SHAKE_FROM) / (1 - SHAKE_FROM);
    if ((mode === 'charging' || mode === 'intro') && k > 0 && !reduced.matches) {
      const a = Math.min(1, k);
      camera.style.transform = `translate3d(${((Math.random() * 2 - 1) * a).toFixed(2)}px, ${((Math.random() * 2 - 1) * a).toFixed(2)}px, 0)`;
      shaking = true;
    } else if (shaking) {
      camera.style.transform = '';
      shaking = false;
    }
  });

  function chargeTo(duration, nextMode) {
    tween?.kill();
    mode = nextMode;
    tween = gsap.to(state, { charge: 1, duration, ease: 'none', onUpdate: render });
  }

  function discharge() {
    tween?.kill();
    sound.chargeStop();
    mode = 'releasing';
    tween = gsap.to(state, {
      charge: 0, duration: 0.35, ease: 'power2.out', onUpdate: render,
      onComplete: () => { mode = 'idle'; render(); },
    });
  }

  function fire(intensity, onPeak) {
    tween?.kill();
    sound.chargeStop();
    lastFire = performance.now();
    mode = 'recharging';

    const tl = gsap.timeline();
    tween = tl;
    // la ventana del flash se enciende blanca al instante
    tl.set(tint.white, { opacity: 1 }, 0)
      .set(glow.white, { opacity: intensity, scale: 1 + intensity }, 0)
      .add(() => {
        sound.play();
        fireHandlers.forEach((fn) => fn(intensity));
        onPeak?.();
      }, 0.04);

    if (reduced.matches) {
      // sin fogonazo: solo un fundido suave
      tl.to(screen, { opacity: 0.12 * intensity, duration: 0.25, ease: 'sine.inOut' }, 0.04)
        .to(screen, { opacity: 0, duration: 0.6, ease: 'sine.inOut' });
    } else {
      tl.set(screen, { opacity: intensity }, 0.04)
        .to(screen, { opacity: 0, duration: 0.5, ease: 'expo.out' }, 0.041);
    }

    tl.to([tint.white, glow.white], { opacity: 0, duration: 0.6, ease: 'power2.out' }, 0.1)
      .to(state, { charge: 0, duration: 0.5, ease: 'expo.out', onUpdate: render }, 0.04)
      .add(() => {
        mode = 'idle';
        render();
        gsap.fromTo([tint.red, glow.red], { opacity: (i) => (i ? 0.35 : PILOT_MAX) }, { opacity: 0, duration: 0.3, ease: 'power1.out' });
      }, RECHARGE_S);
  }

  return {
    get charging() { return mode === 'charging'; },

    press() {
      if (mode === 'recharging' || mode === 'intro') return;
      sound.chargeStart();
      chargeTo(CHARGE_S * (1 - state.charge), 'charging');
    },

    release() {
      if (mode !== 'charging') return;
      if (state.charge < MIN_FIRE || performance.now() - lastFire < MIN_GAP_MS) discharge();
      else fire(state.charge);
    },

    cancel() {
      if (mode === 'charging') discharge();
    },

    onFire(fn) { fireHandlers.push(fn); },

    // Entrada: negro → carga automática al 100% en 1s → disparo, con el que aparece todo
    intro(onReveal) {
      if (reduced.matches) {
        onReveal();
        return;
      }
      render();
      tween = gsap.delayedCall(0.4, () => {
        chargeTo(INTRO_CHARGE_S, 'intro');
        tween.eventCallback('onComplete', () => fire(1, onReveal));
      });
    },
  };
}

// Sonido: clic de obturador (mp3 o sintetizado) y pitido de carga con un oscilador.
export function createShutter() {
  let enabled = false;
  let ctx = null;
  let audio = null;
  let whine = null;

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

  const pitch = (c) => 1200 + c * 3000;

  return {
    get enabled() { return enabled; },
    setEnabled(value) {
      enabled = value;
      if (enabled && !ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx?.state === 'suspended') ctx.resume();
      if (!enabled) this.chargeStop();
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
    chargeStart() {
      if (!enabled || whine) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch(0), t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.035, t + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      whine = { osc, gain };
    },
    chargeUpdate(c) {
      if (!whine) return;
      whine.osc.frequency.setTargetAtTime(pitch(c), ctx.currentTime, 0.02);
    },
    chargeStop() {
      if (!whine) return;
      const t = ctx.currentTime;
      whine.gain.gain.setTargetAtTime(0, t, 0.03);
      whine.osc.stop(t + 0.2);
      whine = null;
    },
  };
}
