import { config, whatsappUrl } from './config.js';
import { runIntroLoader } from './intro-loader.js';
import { initHeroContent } from './hero-content.js';
import { heroPhotos } from './photos.js';
import { initServices } from './services.js';

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

// CTAs de WhatsApp (hero principal, cierre de servicios y el fijo)
document.querySelectorAll('[data-cta]').forEach((a) => { a.href = whatsappUrl(); });

// Hero principal: fila curvada (parada hasta que termine la intro) y titular listo para entrar
const heroContent = initHeroContent({ gsap, ScrollTrigger, reduced, photos: heroPhotos });

// Loading (logo + progreso real) → luz roja → flash → lentes → blanco → hero
runIntroLoader({ gsap, lenis, reduced, loop, intro: config.intro }).then(() => {
  document.body.classList.remove('is-loading');
  heroContent.show();
  heroContent.watchCta();
  window.disco.services = initServices({ gsap, ScrollTrigger, reduced, loop });
  ScrollTrigger.refresh();
});

window.disco = { gsap, lenis, loop };
