import { createWater, outline } from './water.js';

// Transición entre páginas: al pulsar un enlace interno sube un velo #0b0909 desde abajo, en el centro el logo
// pequeño se llena de agua (0.8 s, la misma ola del loading) mientras la página destino se precarga, y al
// llenarse se navega. La página nueva arranca con el mismo velo (html.is-arriving, desde el <head>, pinta el
// logo lleno con CSS) y, con el DOM y las fuentes listos, el velo se abre hacia arriba.
// Es una mejora: si este JS falla, los enlaces funcionan normal. Sin flash (el flash es solo de la intro).
const LOGO = 'assets/intro/disco-logo.svg';
const KEY = 'disco_pt';
const RISE = 0.4;      // el velo sube
const FILL = 0.8;      // el agua se llena
const OPEN = 0.6;      // en la página nueva, el velo se abre
const FONTS_WAIT = 1500;

const store = {
  set() { try { sessionStorage.setItem(KEY, '1'); } catch { /* sin storage: la página nueva entra sin velo */ } },
};

export function initTransitions({ gsap, reduced, loop }) {
  const root = document.documentElement;
  let leaving = false;
  const veil = document.createElement('div');
  veil.className = 'pt';
  veil.setAttribute('aria-hidden', 'true');
  veil.innerHTML = `<img class="pt__img" src="${LOGO}" alt="">`;
  document.body.append(veil);

  // logo en línea (para el agua): se pide al arrancar, ya está en caché si se ha visto el velo de llegada
  let logo = null;
  const ready = fetch(LOGO)
    .then((r) => (r.ok ? r.text() : Promise.reject()))
    .then((text) => {
      const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
      svg.removeAttribute('style');
      svg.classList.add('pt__logo');
      svg.setAttribute('aria-hidden', 'true');
      veil.append(svg);
      const letters = [...svg.querySelectorAll('.logo-letter')];
      const subtitle = svg.querySelector('#logo-subtitle');
      const star = svg.querySelector('#logo-star');
      const water = createWater(svg, [...letters, subtitle]);
      const lines = outline(svg, [...letters, subtitle, star]);
      [...letters, subtitle].forEach((p) => p.setAttribute('fill', 'none'));
      logo = { svg, water, lines };
    })
    .catch(() => {});

  // --- llegada: el velo puesto (CSS) se abre hacia arriba en cuanto la página está lista ---
  const arriving = root.classList.contains('is-arriving');
  const arrived = new Promise((resolve) => {
    if (!arriving) { resolve(); return; }
    const fonts = document.fonts ? Promise.race([document.fonts.ready, wait(FONTS_WAIT)]) : Promise.resolve();
    fonts.then(() => {
      gsap.set(veil, { visibility: 'visible', clipPath: 'inset(0% 0% 0% 0%)' });
      veil.classList.add('is-full');
      root.classList.remove('is-arriving');
      resolve();
      gsap.to(veil, {
        clipPath: 'inset(0% 0% 100% 0%)',
        duration: reduced.matches ? 0.3 : OPEN,
        ease: reduced.matches ? 'power1.out' : 'expo.inOut',
        onComplete: reset,
      });
    });
  });

  function reset() {
    gsap.killTweensOf(veil);
    gsap.set(veil, { visibility: 'hidden', clearProps: 'clipPath' });
    veil.classList.remove('is-full', 'is-leaving');
    root.classList.remove('is-arriving');
    leaving = false;
  }

  // atrás / adelante del navegador (bfcache): sin velo
  window.addEventListener('pageshow', (e) => { if (e.persisted) reset(); });

  // --- precarga: <link rel="prefetch"> al pasar el ratón por un enlace interno ---
  const prefetched = new Set();
  const prefetch = (url) => {
    if (prefetched.has(url)) return;
    prefetched.add(url);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.append(link);
  };
  document.addEventListener('pointerover', (e) => {
    const a = internal(e.target);
    if (a) prefetch(a.href);
  });

  // --- salida ---
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = internal(e.target);
    if (!a || leaving) return;
    e.preventDefault();
    leave(a.href);
  });

  function leave(url) {
    leaving = true;
    fetch(url, { credentials: 'same-origin' }).catch(() => {}); // calienta la caché mientras sube el agua
    const go = () => { store.set(); location.href = url; };

    gsap.killTweensOf(veil); // por si aún se estaba abriendo el velo de llegada
    veil.classList.add('is-leaving');
    if (logo) veil.classList.remove('is-full');
    gsap.set(veil, { visibility: 'visible' });
    if (reduced.matches) {
      veil.classList.add('is-full');
      gsap.fromTo(veil, { clipPath: 'inset(0% 0% 0% 0%)', opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out', onComplete: go });
      return;
    }

    gsap.fromTo(veil, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: RISE, ease: 'power3.inOut' });
    // sin el logo en línea (no ha cargado): el velo y la imagen llena
    ready.then(() => {
      if (!logo) {
        veil.classList.add('is-full');
        gsap.delayedCall(FILL, go);
        return;
      }
      logo.water.resize();
      logo.lines.width();
      logo.water.render(0, 0);
      const state = { level: 0 };
      const stop = loop.add((time) => logo.water.render(state.level, time));
      gsap.to(state, {
        level: 1,
        duration: FILL,
        ease: 'sine.inOut',
        onComplete: () => { stop(); logo.water.fill(); go(); },
      });
    });
  }

  return { arrived };
}

// enlace interno que se puede interceptar (mismo origen, sin target, ni descarga, ni ancla de la misma página)
function internal(node) {
  const a = node instanceof Element ? node.closest('a[href]') : null;
  if (!a || a.target && a.target !== '_self' || a.hasAttribute('download')) return null;
  if (a.origin !== location.origin || !/^https?:$/.test(a.protocol)) return null;
  if (a.pathname === location.pathname && a.search === location.search && a.hash) return null;
  if (!/(\.html|\/)$/.test(a.pathname)) return null; // solo páginas, no archivos
  return a;
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
