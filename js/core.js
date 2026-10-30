import { initTransitions } from './transition.js';
import { initWaFloat } from './wa-float.js';

// Base común de todas las páginas: Lenis + ScrollTrigger + un único loop + transiciones entre páginas.
// Un único loop: gsap.ticker (un rAF) mueve Lenis, ScrollTrigger y todas las tareas.
export function initCore() {
  const { gsap, ScrollTrigger, Lenis } = window;
  gsap.registerPlugin(ScrollTrigger);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const tasks = new Set();
  const loop = {
    add(fn) { tasks.add(fn); return () => tasks.delete(fn); },
  };

  // scroll pausado y con inercia (antes lerp 0.1); con movimiento reducido, nativo
  const lenis = new Lenis({
    autoRaf: false,
    lerp: reduced.matches ? 1 : 0.055,
    wheelMultiplier: reduced.matches ? 1 : 0.7,
    touchMultiplier: reduced.matches ? 1 : 1.1,
    smoothWheel: !reduced.matches,
  });
  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
    const ratio = gsap.ticker.deltaRatio(60);
    tasks.forEach((fn) => fn(time, ratio));
  });

  // CTAs: a contacto.html por defecto (ninguno en "#"), en la misma pestaña
  document.querySelectorAll('[data-cta]').forEach((a) => {
    if (!a.getAttribute('href') || a.getAttribute('href') === '#') a.href = 'contacto.html';
    a.removeAttribute('target');
  });
  initCtaPills({ loop, reduced });

  // transición entre páginas (velo + logo que se llena de agua)
  const transitions = initTransitions({ gsap, reduced, loop });

  // WhatsApp flotante en móvil (solo si el número es real: config.ready.whatsapp)
  initWaFloat();

  return { gsap, ScrollTrigger, lenis, loop, reduced, transitions };
}

// CTA principal (.cta-pill, css/base.css): con ratón, el botón se acerca al cursor hasta 6 px (lerp .15, con
// `translate`, que no pisa los transform de GSAP); solo calcula mientras se mueve. En táctil, sin imán: al tocar se
// ve el rodillo una vez (.is-roll) antes de que la transición se lleve la página.
const MAGNET = { max: 6, reach: 0.35, lerp: 0.15 };
function initCtaPills({ loop, reduced }) {
  const pills = [...document.querySelectorAll('a.cta-pill')];
  if (!pills.length) return;
  pills.forEach((a) => a.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    a.classList.add('is-roll');
    setTimeout(() => a.classList.remove('is-roll'), 900);
  }));
  if (reduced.matches || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  pills.forEach((a) => {
    const m = { x: 0, y: 0, tx: 0, ty: 0, off: null, rect: null };
    const step = (time, ratio) => {
      const k = 1 - Math.pow(1 - MAGNET.lerp, ratio);
      m.x += (m.tx - m.x) * k;
      m.y += (m.ty - m.y) * k;
      if (!m.tx && !m.ty && Math.abs(m.x) < 0.05 && Math.abs(m.y) < 0.05) { m.x = 0; m.y = 0; a.style.translate = ''; m.off(); m.off = null; return; }
      a.style.translate = `${m.x.toFixed(2)}px ${m.y.toFixed(2)}px`;
    };
    a.addEventListener('pointerenter', () => { m.rect = a.getBoundingClientRect(); if (!m.off) m.off = loop.add(step); });
    a.addEventListener('pointermove', (e) => {
      const r = m.rect || a.getBoundingClientRect();
      const clamp = (v) => Math.max(-MAGNET.max, Math.min(MAGNET.max, v));
      m.tx = clamp((e.clientX - (r.left + r.width / 2)) * MAGNET.reach);
      m.ty = clamp((e.clientY - (r.top + r.height / 2)) * MAGNET.reach);
    });
    a.addEventListener('pointerleave', () => { m.tx = 0; m.ty = 0; m.rect = null; });
  });
}
