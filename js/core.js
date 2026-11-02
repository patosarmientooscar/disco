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

  // "sigue bajando": aviso discreto abajo si el visitante se para
  initScrollHint({ lenis });

  return { gsap, ScrollTrigger, lenis, loop, reduced, transitions };
}

// "Sigue bajando" (.scroll-hint, css/base.css): si el visitante se queda quieto HINT.idle s sin haber llegado al
// final, aparece abajo en el centro, muy discreto (mono pequeño y una línea fina por la que baja un punto); al mover
// el scroll se va. Nunca durante el loading, con el menú abierto, con el aviso propio del hero de la home en pantalla, encima de un botón o de texto, ni cerca del final de la página. Cuando ya ha
// recorrido más de HINT.learned de la página, no vuelve a salir (ya lo sabe). Decorativo: aria-hidden.
const HINT = { idle: 3.5, end: 1.2, learned: 0.6 };
function initScrollHint({ lenis }) {
  const el = document.createElement('div');
  el.className = 'scroll-hint';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<span>Sigue bajando</span><i></i>';
  document.body.append(el);
  const nav = document.querySelector('[data-nav]');
  let timer = 0;
  let done = false;
  const show = (on) => el.classList.toggle('is-on', on);
  const check = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const y = lenis.scroll;
    const busy = document.body.classList.contains('is-loading') || nav?.classList.contains('is-open') || document.documentElement.classList.contains('is-arriving');
    // la página ya tiene su propio aviso en pantalla (el "Scroll to explore" del hero de la home): no se repite
    const own = document.querySelector('[data-hero-scroll]')?.getBoundingClientRect();
    const ownOn = own && y < innerHeight * 0.5 && own.top < innerHeight && own.bottom > 0; // (el hero se queda fijo debajo: solo arriba)
    if (done || ownOn || max < innerHeight * 0.5 || y > max - HINT.end * innerHeight || busy) return;
    // nunca encima de un botón, un enlace o texto (mira 5 puntos de su sitio)
    const r = el.getBoundingClientRect();
    const pts = [[0.5, 0.5], [0.05, 0.2], [0.95, 0.2], [0.05, 0.8], [0.95, 0.8]];
    const hit = pts.some(([fx, fy]) => document.elementsFromPoint(r.left + r.width * fx, r.top + r.height * fy)
      .some((n) => n !== el && !el.contains(n) && n.closest('a, button, input, textarea, select, label, p, h1, h2, h3, h4, li, figcaption')));
    if (hit) return;
    show(true);
  };
  const arm = () => { clearTimeout(timer); if (!done) timer = setTimeout(check, HINT.idle * 1000); };
  lenis.on('scroll', () => {
    show(false);
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max > 0 && lenis.scroll / max > HINT.learned) { done = true; clearTimeout(timer); return; }
    arm();
  });
  window.addEventListener('pageshow', arm);
  arm();
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
