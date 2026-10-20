import { whatsappUrl } from './config.js';
import { initFlash, createShutter } from './flash.js';
import { initHud } from './hud.js';
import { initHero } from './hero.js';

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

// La cámara nunca se muestra por encima de su resolución real ÷ devicePixelRatio
const camBody = document.querySelector('[data-full-width]');
const capCamera = () => {
  const max = Math.floor(Number(camBody.dataset.fullWidth) / (window.devicePixelRatio || 1));
  document.documentElement.style.setProperty('--cam-max', `${max}px`);
};
capCamera();
window.addEventListener('resize', capCamera); // el DPR cambia con el zoom del navegador

// Módulos
const sound = createShutter();
const flash = initFlash({ gsap, loop, reduced, sound });
const hud = initHud({ loop, sound });
initHero({ gsap, loop, reduced, flash });

// Entrada: negro 0.6s → flash → aparece todo
flash.intro(() => {
  document.body.classList.remove('is-loading');
  hud.start();
});

// Para las fases 2 y 3
window.disco = { gsap, lenis, loop, hud, flash };
