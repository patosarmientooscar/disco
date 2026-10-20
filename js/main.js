import { config, whatsappUrl } from './config.js';
import { initFlash } from './flash.js';
import { initHud } from './hud.js';
import { runLoader } from './loader.js';
import { loadFrames } from './frames.js';
import { createPixelField } from './pixel-field.js';
import { createCameraSequence } from './camera-seq.js';

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
const flash = initFlash({ gsap, reduced });
const hud = initHud({ loop });

// Pre-hero: píxeles "disco.es" detrás, cámara del vídeo delante
const prehero = document.getElementById('prehero');
const field = createPixelField(prehero, { text: 'disco.es' });
const camera = createCameraSequence(prehero, frames, config.sequence);
loop.add(() => {
  field.draw();
  camera.draw();
});

// Loading → flash de transición → pre-hero
runLoader({ gsap, lenis, reduced, frames }).then(() => {
  flash.transition(() => {
    document.body.classList.remove('is-loading');
    hud.start();
    field.setRunning(true);
    // movimiento reducido: un único dibujado quieto y se para
    if (reduced.matches) requestAnimationFrame(() => field.setRunning(false));
  });
});

// Para las fases siguientes
window.disco = { gsap, lenis, loop, hud, flash, frames, field, camera };
