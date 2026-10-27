import { config } from './config.js';
import { sectors } from './servicios-data.js';
import { initOficios } from './oficios.js';
import { initBento } from './bento.js';

// Servicios v2 (css/servicios.css): fondo negro y la luz roja de seguridad del cuarto oscuro como ambiente (sigue
// al cursor en la cabecera y se apaga al llegar a los tres oficios); los tres oficios en paneles (js/oficios.js); el proceso en bento (js/bento.js); para quién; y el cierre naranja, que entra con un degradado.
// Todo en el loop único (gsap.ticker) y solo con su sección cerca. Movimiento reducido: todo visible y quieto.
// (LEGACY: "Dispara" y la hoja de montaje, en legacy/servicios-v2/; la cubeta, el cordel y el grano, en
// legacy/servicios-v2-cuarto-oscuro/)
const RED = { lerp: 0.04, rest: [0.82, 0.12] }; // la luz roja persigue al cursor con mucha inercia; sin ratón, arriba a la derecha
const HEAD_PARALLAX = { travel: 0.22, faster: 1.08 }; // las líneas del titular suben al hacer scroll; la 2.ª, un 8 % más rápida
const FOLLOW = { lerp: 0.12, tilt: 0.06, max: 8 };

export function init({ gsap, ScrollTrigger, lenis, loop, reduced, arrived = Promise.resolve() }) {
  const still = reduced.matches;
  const desktop = matchMedia('(min-width: 900px)');
  initHead({ gsap, ScrollTrigger, lenis, still, arrived });
  initManifest(gsap, still);
  initLights({ ScrollTrigger, loop, still });
  initOficios({ gsap, ScrollTrigger, loop, still });
  initBento({ gsap, ScrollTrigger, loop, still });
  initSectors({ gsap, loop, still, desktop });
  initClose({ gsap, ScrollTrigger, still });
  // los titulares son enormes: al cargar la fuente la página cambia de alto (las posiciones de los pines y de la
  // tinta del menú se recalculan)
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
}

// ---------- A) cabecera: líneas subiendo con máscara; parallax entre las dos líneas; "Ver cómo trabajamos" ----------
function initHead({ gsap, ScrollTrigger, lenis, still, arrived }) {
  const lines = document.querySelectorAll('[data-head-line]');
  const masks = [...document.querySelectorAll('[data-head-mask]')];
  const after = document.querySelectorAll('[data-head-after]');
  // baja con Lenis al proceso (sin JS, el ancla normal)
  document.querySelector('[data-to-proc]')?.addEventListener('click', (e) => {
    e.preventDefault();
    lenis.scrollTo('#proceso', { duration: still ? 0 : 1.8, easing: (t) => 1 - Math.pow(1 - t, 4), immediate: still });
  });
  if (still) return;
  gsap.set(lines, { yPercent: 105 });
  gsap.set(after, { opacity: 0, y: 14 });
  arrived.then(() => {
    gsap.timeline({ delay: 0.1 })
      .to(lines, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12 })
      .to(after, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.1 }, 0.45);
  });
  // parallax: las dos líneas suben con el scroll, la segunda un 8 % más rápida (se separan un poco)
  masks.forEach((m, i) => {
    gsap.to(m, {
      y: () => -innerHeight * HEAD_PARALLAX.travel * (i ? HEAD_PARALLAX.faster : 1),
      ease: 'none',
      scrollTrigger: { trigger: '[data-head]', start: 'top top', end: 'bottom top', scrub: 0.4, invalidateOnRefresh: true },
    });
  });
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

// ---------- luz roja de seguridad: sigue al cursor con mucha inercia y se apaga al llegar a los tres oficios ----------
function initLights({ ScrollTrigger, loop, still }) {
  const red = document.querySelector('[data-light-red]');
  if (!red) return;
  const s = { x: innerWidth * RED.rest[0], y: innerHeight * RED.rest[1], tx: innerWidth * RED.rest[0], ty: innerHeight * RED.rest[1], k: 1, key: '' };
  // 1 en la cabecera → 0 cuando los tres oficios ocupan la pantalla (degradado de luz, sin corte)
  ScrollTrigger.create({
    trigger: '[data-oficios]',
    start: 'top 90%',
    end: 'top 10%',
    scrub: true,
    onUpdate: (self) => { s.k = 1 - self.progress; },
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    s.tx = e.clientX;
    s.ty = e.clientY;
  }, { passive: true });
  window.addEventListener('resize', () => { if (still) { s.x = s.tx = innerWidth * RED.rest[0]; s.y = s.ty = innerHeight * RED.rest[1]; } });
  loop.add((time, ratio) => {
    const a = still ? 1 : 1 - Math.pow(1 - RED.lerp, ratio);
    if (!still) {
      s.x += (s.tx - s.x) * a;
      s.y += (s.ty - s.y) * a;
    }
    const key = `${s.x.toFixed(1)}|${s.y.toFixed(1)}|${s.k.toFixed(3)}`;
    if (key === s.key) return;
    s.key = key;
    red.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)`;
    red.style.opacity = s.k.toFixed(3);
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

