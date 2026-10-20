import { whatsappUrl } from './config.js';
import { initFlash, createShutter } from './flash.js';
import { initHud } from './hud.js';
import { runLoader } from './loader.js';
import { loadFrames } from './frames.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

// Un único loop: gsap.ticker (un rAF) mueve Lenis, ScrollTrigger y todas las tareas.
const tasks = new Set();
const loop = {
  add(fn) { tasks.add(fn); return () => tasks.delete(fn); },
};

const lenis = new Lenis({
  autoRaf: false,
  lerp: reduced.matches ? 1 : 0.1,
  smoothWheel: !reduced.matches,
});
lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.lagSmoothing(0);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
  const ratio = gsap.ticker.deltaRatio(60);
  tasks.forEach((fn) => fn(time, ratio));
});

// CTA
const cta = document.querySelector('[data-cta]');
cta.href = whatsappUrl();

// Módulos (la precarga de frames arranca ya, en paralelo al loading)
const frames = loadFrames();
const sound = createShutter();
const flash = initFlash({ gsap, reduced, sound });
const hud = initHud({ loop, sound });

// Loading → flash de transición → pre-hero
runLoader({ gsap, lenis, reduced, frames }).then(() => {
  flash.transition(() => {
    document.body.classList.remove('is-loading');
    hud.start();
  });
});

// Para las fases siguientes
window.disco = { gsap, lenis, loop, hud, flash, frames };
