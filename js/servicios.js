import { config } from './config.js';
import { sectors } from './servicios-data.js';
import { initOficios } from './oficios.js';
import { initBento } from './bento.js';
import { initManifesto } from './manifesto.js';
import { initArcCarousel } from './arc-carousel.js';
import { initProcSay } from './proc-say.js';

// Servicios v2 (css/servicios.css): fondo negro; el hero común de las páginas (js/page-hero.js, lo monta js/page.js);
// los tres oficios en paneles (js/oficios.js); el proceso en bento (js/bento.js); para quién; y el cierre naranja,
// que entra con un degradado. El destello vuelve por detrás de los tres oficios y recorre la página (js/page-star.js).
// Todo en el loop único (gsap.ticker) y solo con su sección cerca. Movimiento reducido: todo visible y quieto.
// (LEGACY: el hero en capas y en vídeo, en legacy/servicios-hero-capas/; la cabecera anterior y la luz roja, en legacy/servicios-v2-hero/; "Dispara" y la hoja de montaje, en
// legacy/servicios-v2/; la cubeta, el cordel y el grano, en legacy/servicios-v2-cuarto-oscuro/)

export function init({ gsap, ScrollTrigger, lenis, loop, reduced, arrived = Promise.resolve() }) {
  const still = reduced.matches;
  const desktop = matchMedia('(min-width: 900px)');
  initManifest(gsap, still);
  initManifesto({ gsap, lenis, reduced }); // el vídeo completo con sonido, desde el botón del hero
  initOficios({ gsap, ScrollTrigger, loop, still });
  initBento({ gsap, ScrollTrigger, loop, still });
  // "En cada producción.": un texto por fase, que cambia con el scroll (js/proc-say.js; AU)
  initProcSay({ ScrollTrigger, lenis, still });
  initSectors({ gsap, ScrollTrigger, lenis, loop, still });
  initClose({ gsap, ScrollTrigger, still });
  // los titulares son enormes: al cargar la fuente la página cambia de alto (las posiciones de los pines y de la
  // tinta del menú se recalculan)
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
}

// ---------- B) manifiesto: palabra a palabra (.15 → 1); las palabras clave (<em>: "idea", "fotos y vídeos") en
// naranja (y el destello, a su derecha, lo celebra una vez por cada una: js/page-star.js) ----------
// (las palabras, una a una en spans .mw; las de dentro de un <em>, .mw--hot con data-g = su grupo: una palabra clave
// puede ser de varias palabras (BC-C). LEGACY: el texto de "En cada producción." que también las usaba, en
// legacy/servicios-proceso-dos-textos/)
function splitWords(el) {
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  const words = [];
  let g = 0;
  el.childNodes.forEach((n) => {
    const hot = n.nodeName === 'EM' ? ++g : 0;
    n.textContent.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).forEach((w) => {
      // (puntuación justo después de un <em>: con la palabra de antes)
      if (/^[.,;:]+$/.test(w) && words.length) words[words.length - 1].w += w;
      else words.push({ w, hot });
    });
  });
  el.innerHTML = `<span class="sr-only">${text}</span>${words.map(({ w, hot }) => {
    // (la puntuación del final, aparte: en una palabra clave no se tiñe de naranja)
    const [, word, punct] = w.match(/^(.*?)([.,;:]*)$/);
    return `<span class="mw${hot ? ' mw--hot' : ''}"${hot ? ` data-g="${hot}"` : ''} aria-hidden="true">${word}${punct ? `<span class="mw-p">${punct}</span>` : ''}</span>`;
  }).join(' ')}`;
}
function initManifest(gsap, still) {
  const el = document.querySelector('[data-manifest]');
  if (!el) return;
  splitWords(el);
  if (still) return;
  // cuando se ilumina una palabra clave (su última palabra), aviso al destello (js/page-star.js: giro extra y reflejo
  // naranja): una vez por palabra clave, aunque sea de varias palabras
  const last = new Map();
  el.querySelectorAll('.mw--hot').forEach((w) => last.set(w.dataset.g, w));
  const hotWords = [...last.values()].map((w) => ({ w, lit: false }));
  gsap.to(el.querySelectorAll('.mw'), {
    opacity: 1,
    ease: 'none',
    stagger: 0.1,
    scrollTrigger: { trigger: el, start: 'top 75%', end: 'bottom 40%', scrub: 0.6 },
    onUpdate: () => hotWords.forEach((h) => {
      const o = +gsap.getProperty(h.w, 'opacity');
      if (!h.lit && o > 0.85) { h.lit = true; document.dispatchEvent(new CustomEvent('disco:manifest-hot')); } else if (h.lit && o < 0.5) h.lit = false;
    }),
  });
}

// ---------- F) para quién: el carrusel en arco (js/arc-carousel.js; AT-C). LEGACY: la lista, en
// legacy/servicios-para-quien-lista/ ----------
function initSectors({ gsap, ScrollTrigger, lenis, loop, still }) {
  const root = document.querySelector('[data-arc]');
  if (!root) return;
  initArcCarousel({ root, items: sectors, gsap, ScrollTrigger, lenis, loop, still });
}

// ---------- G) cierre: la luz naranja entra con el scroll (degradado de ~40vh, sin corte) y se queda ----------
function initClose({ gsap, ScrollTrigger, still }) {
  const light = document.querySelector('[data-close-light]');
  if (!still) {
    gsap.fromTo(light, { opacity: 0 }, {
      opacity: 1,
      ease: 'none',
      scrollTrigger: { trigger: '[data-close]', start: 'top bottom', end: 'top 30%', scrub: true },
    });
  }
  const email = config.email;
  document.querySelectorAll('.sv-close [data-email]').forEach((a) => { a.href = `mailto:${email}`; a.textContent = email; });
  const ok = document.querySelector('.sv-close [data-copied]');
  let timer = 0;
  document.querySelector('.sv-close [data-copy-email]')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(email);
      ok.textContent = 'Copiado';
    } catch {
      ok.textContent = 'No se pudo copiar';
    }
    clearTimeout(timer);
    timer = setTimeout(() => { ok.textContent = ''; }, 1500);
  });
}

