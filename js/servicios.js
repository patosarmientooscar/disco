import { config } from './config.js';
import { sectors } from './servicios-data.js';
import { initOficios } from './oficios.js';
import { initBento } from './bento.js';

// Servicios v2 (css/servicios.css): fondo negro; el hero común de las páginas (js/page-hero.js, lo monta js/page.js);
// los tres oficios en paneles (js/oficios.js); el proceso en bento (js/bento.js); para quién; y el cierre naranja,
// que entra con un degradado. El destello vuelve por detrás de los tres oficios y recorre la página (js/page-star.js).
// Todo en el loop único (gsap.ticker) y solo con su sección cerca. Movimiento reducido: todo visible y quieto.
// (LEGACY: el hero en capas y en vídeo, en legacy/servicios-hero-capas/; la cabecera anterior y la luz roja, en legacy/servicios-v2-hero/; "Dispara" y la hoja de montaje, en
// legacy/servicios-v2/; la cubeta, el cordel y el grano, en legacy/servicios-v2-cuarto-oscuro/)
const FOLLOW = { lerp: 0.12, tilt: 0.06, max: 8 };

export function init({ gsap, ScrollTrigger, lenis, loop, reduced, arrived = Promise.resolve() }) {
  const still = reduced.matches;
  const desktop = matchMedia('(min-width: 900px)');
  initManifest(gsap, still);
  initOficios({ gsap, ScrollTrigger, loop, still });
  initBento({ gsap, ScrollTrigger, loop, still });
  initSectors({ gsap, loop, still, desktop });
  initClose({ gsap, ScrollTrigger, still });
  // los titulares son enormes: al cargar la fuente la página cambia de alto (las posiciones de los pines y de la
  // tinta del menú se recalculan)
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
}

// ---------- B) manifiesto: palabra a palabra (.15 → 1); "idea" e "imágenes" en naranja ----------
function initManifest(gsap, still) {
  const el = document.querySelector('[data-manifest]');
  if (!el) return;
  const hot = new Set([...el.querySelectorAll('em')].map((e) => e.textContent.trim()));
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  el.innerHTML = `<span class="sr-only">${text}</span>${text.split(' ').map((w) => {
    const bare = w.replace(/[.,]/g, '');
    return `<span class="mw${hot.has(bare) ? ' mw--hot' : ''}" aria-hidden="true">${w}</span>`;
  }).join(' ')}`;
  if (still) return;
  gsap.to(el.querySelectorAll('.mw'), {
    opacity: 1,
    ease: 'none',
    stagger: 0.1,
    scrollTrigger: { trigger: el, start: 'top 75%', end: 'bottom 40%', scrub: 0.6 },
  });
}

// ---------- F) para quién: al pasar, la frase y una foto que sigue al cursor revelándose; móvil, acordeón ----------
function initSectors({ gsap, loop, still, desktop }) {
  const list = document.querySelector('[data-sectors]');
  list.innerHTML = sectors.map((s, i) => `<li class="sv-for__item">
      <button class="sv-for__row" type="button" aria-expanded="false" aria-controls="sector-${i}">
        <span class="sv-for__name">${s.name}</span><span class="sv-for__text">${s.text}</span>
      </button>
      <div class="sv-for__panel" id="sector-${i}" hidden>
        <p>${s.text}</p>
        ${s.photo ? `<div class="sv-for__photo"><img src="${s.photo.src}" width="${s.photo.w}" height="${s.photo.h}" alt="" loading="lazy" decoding="async"></div>` : ''}
      </div></li>`).join('');
  const items = [...list.children];
  // acordeón (móvil); en escritorio el botón no abre nada (la frase ya está en la fila)
  items.forEach((item) => {
    const btn = item.querySelector('.sv-for__row');
    const panel = item.querySelector('.sv-for__panel');
    btn.addEventListener('click', () => {
      if (desktop.matches) return;
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      item.classList.toggle('is-on', open);
    });
    btn.addEventListener('focus', () => { if (desktop.matches) item.classList.add('is-on'); });
    btn.addEventListener('blur', () => { if (desktop.matches) item.classList.remove('is-on'); });
  });

  // la foto que sigue al cursor (solo ratón, escritorio)
  const follow = document.querySelector('[data-follow]');
  const img = follow.querySelector('img');
  const pos = { x: 0, y: 0, tx: 0, ty: 0, r: 0, on: false, shown: false };
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  items.forEach((item, i) => {
    item.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !desktop.matches) return;
      items.forEach((it) => it.classList.toggle('is-on', it === item));
      const ph = sectors[i].photo;
      if (!ph || still || !fine.matches) { pos.on = false; gsap.to(follow, { opacity: 0, duration: 0.2, overwrite: true }); return; }
      if (!img.src.endsWith(ph.src)) img.src = ph.src;
      // se revela desde el negativo en 0.4 s
      follow.classList.add('is-neg');
      requestAnimationFrame(() => requestAnimationFrame(() => follow.classList.remove('is-neg')));
      if (!pos.on) { pos.x = e.clientX; pos.y = e.clientY; }
      pos.on = true;
      gsap.to(follow, { opacity: 1, duration: 0.25, overwrite: true });
    });
  });
  list.addEventListener('pointerleave', () => {
    items.forEach((it) => { if (!it.contains(document.activeElement)) it.classList.remove('is-on'); });
    pos.on = false;
    gsap.to(follow, { opacity: 0, duration: 0.25, overwrite: true });
  });
  list.addEventListener('pointermove', (e) => { pos.tx = e.clientX; pos.ty = e.clientY; });
  loop.add((time, ratio) => {
    if (!pos.on && follow.style.opacity === '0') return;
    const a = 1 - Math.pow(1 - FOLLOW.lerp, ratio);
    const dx = (pos.tx - pos.x) * a;
    pos.x += dx;
    pos.y += (pos.ty - pos.y) * a;
    pos.r += (Math.max(-FOLLOW.max, Math.min(FOLLOW.max, dx * FOLLOW.tilt * 10)) - pos.r) * a;
    follow.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0) rotate(${pos.r.toFixed(2)}deg)`;
  });
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

