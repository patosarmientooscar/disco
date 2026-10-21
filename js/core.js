import { whatsappUrl } from './config.js';

// Base común de todas las páginas: Lenis + ScrollTrigger + un único loop.
// Un único loop: gsap.ticker (un rAF) mueve Lenis, ScrollTrigger y todas las tareas.
export function initCore() {
  const { gsap, ScrollTrigger, Lenis } = window;
  gsap.registerPlugin(ScrollTrigger);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

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

  // CTAs de WhatsApp (cierre de servicios y el fijo)
  document.querySelectorAll('[data-cta]').forEach((a) => { a.href = whatsappUrl(); });

  return { gsap, ScrollTrigger, lenis, loop, reduced };
}
