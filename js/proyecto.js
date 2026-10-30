import { works } from './portfolio-data.js';

// Página de proyecto (proyecto.html#slug; css/proyecto.css). UNA plantilla: lee el slug de la URL y pinta el
// proyecto con sus datos (js/portfolio-data.js → works[].project). De arriba abajo:
//   A) portada (100svh, sin pin): la foto de portada a pantalla completa (zoom leve con el scroll), un móvil con el
//      reel en silencio y su botón de sonido, y abajo la etiqueta, el título y la frase;
//   B) ficha (cliente, tipo, lugar, año, entregables, equipo) y C) el encargo, la idea y el resultado;
//   D) los dos reels en sus móviles: en silencio al entrar en pantalla, dándose el relevo (uno y, al acabar, el
//      otro: dos vídeos a la vez no llegan a 60 fps); al tocar uno, suena en bucle (y el otro se calla y se para);
//   E) la noche en secuencia: una tira de 6 fotos que avanza en horizontal con el scroll (sin pin);
//   F) hoja de contactos: las fotos en masonry con filtros Todas / Color / B/N y el visor a pantalla completa
//      (flechas, Esc, swipe, contador, miniaturas y la siguiente precargada);
//   G) cierre: "¿El siguiente es el tuyo?".
// Índice lateral fijo en escritorio (la sección activa en naranja; clic = scroll suave, sin tocar el #slug).
// ?ver=galeria baja directamente a la galería. Movimiento reducido: sin zoom, la tira se desliza a mano y los
// vídeos no arrancan solos.
const STAR = '<svg viewBox="1194 585 84 119" aria-hidden="true" focusable="false"><path d="M1235 585Q1242.7 632.6 1278 643Q1242.7 654 1235 704Q1227.6 654 1194 643Q1227.6 632.6 1235 585Z" fill="currentColor"/></svg>';
const SOUND = '<svg class="pj-i-on" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><svg class="pj-i-off" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const ARROW = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
const INDEX = [['portada', 'Portada'], ['ficha', 'Ficha'], ['reels', 'Reels'], ['la-noche', 'La noche'], ['galeria', 'Galería']];
const ZOOM = 1.1;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const mmss = (t) => `${Math.floor(t / 60)}:${pad(Math.round(t % 60))}`;
const photoN = (m) => (m.src.match(/-(\d+)\.webp$/) || [])[1];

export function init({ gsap, ScrollTrigger, lenis, reduced, arrived = Promise.resolve() }) {
  const main = document.querySelector('[data-project]');
  const slug = decodeURIComponent(location.hash.slice(1)) || works[0]?.slug;
  const w = works.find((x) => x.slug === slug);
  if (!w || !w.project) {
    main.innerHTML = `<section class="pj-missing ip-wrap"><h1 class="pj-missing__title">Este proyecto no está.</h1><a class="pj-btn" href="portfolio.html">Volver al portfolio <b aria-hidden="true">→</b></a></section>`;
    return;
  }
  const still = reduced.matches;
  const p = w.project;
  const photos = (w.media || []).filter((m) => m.type === 'img');
  const byN = Object.fromEntries(photos.map((m) => [photoN(m), m]));
  const cover = photos[0];
  document.title = `${w.title} — Proyecto de disco.`;

  main.innerHTML = `
    <section class="pj-cover" id="portada" aria-labelledby="pj-title">
      <div class="pj-cover__bg" data-pj-zoom><img src="${esc(w.coverLarge || cover.src)}" srcset="${esc(w.cover)} 1000w, ${esc(w.coverLarge || cover.src)} 2000w" sizes="100vw" width="${cover.w}" height="${cover.h}" alt="${esc(cover.alt)}" fetchpriority="high" decoding="async"></div>
      <i class="pj-cover__shade" aria-hidden="true"></i>
      <div class="pj-cover__phone" data-pj-enter>
        <div class="pj-phone"><video src="${esc(p.reels[0].src)}" poster="${esc(p.reels[0].poster)}" muted loop playsinline preload="metadata" aria-label="${esc(p.reels[0].alt)}" data-pj-cover-video></video></div>
        <button class="pj-sound" type="button" aria-pressed="false" aria-label="Sonido del reel" data-pj-cover-sound>${SOUND}</button>
      </div>
      <div class="pj-cover__text">
        <p class="pj-tag" data-pj-enter><span class="pj-tag__star">${STAR}</span>Proyecto</p>
        <h1 class="pj-title" id="pj-title"><span class="pj-mask"><span data-pj-rise>${esc(w.title)}</span></span></h1>
        <p class="pj-lede" data-pj-enter>${esc(p.tagline)}</p>
      </div>
    </section>

    <section class="pj-sheet ip-wrap" id="ficha" aria-label="Ficha del proyecto">
      <dl class="pj-facts">${p.facts.map(([k, v]) => `<div class="pj-fact"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <div class="pj-story">${p.story.map(([k, v]) => `<div class="pj-story__col" data-pj-reveal><h2 class="pj-story__title">${esc(k)}</h2><p class="pj-story__text">${esc(v)}</p></div>`).join('')}</div>
    </section>

    <section class="pj-reels" id="reels" aria-labelledby="pj-reels-title">
      <div class="ip-wrap">
        <h2 class="pj-h2" id="pj-reels-title">Los reels<b class="pj-dot">.</b></h2>
        <div class="pj-reels__row">${p.reels.map((r, i) => `
          <figure class="pj-reel" data-pj-reel>
            <div class="pj-phone pj-phone--reel">
              <video src="${esc(r.src)}" poster="${esc(r.poster)}" muted playsinline preload="none" aria-label="${esc(r.alt)}"></video>
              <button class="pj-reel__hit" type="button" aria-pressed="false" aria-label="Sonido: ${esc(r.title)}"><span class="pj-sound pj-sound--in">${SOUND}</span></button>
            </div>
            <figcaption class="pj-reel__cap"><span class="pj-reel__title">${esc(r.title)}</span><span class="pj-reel__time" data-pj-dur="${i}">${esc(r.duration)}</span></figcaption>
          </figure>`).join('')}</div>
      </div>
    </section>

    <section class="pj-seq" id="la-noche" aria-labelledby="pj-seq-title">
      <div class="ip-wrap"><h2 class="pj-h2" id="pj-seq-title">La noche, en secuencia<b class="pj-dot">.</b></h2></div>
      <div class="pj-seq__view" data-pj-seq-view>
        <ol class="pj-seq__strip" data-pj-strip>${p.sequence.map(([n, cap]) => { const m = byN[n]; return m ? `
          <li class="pj-seq__item"><figure><img src="${esc(m.thumb || m.src)}" srcset="${esc(m.thumb)} 1000w, ${esc(m.src)} ${m.w}w" sizes="(min-width: 900px) 46vw, 80vw" width="${m.w}" height="${m.h}" alt="${esc(m.alt)}" loading="lazy" decoding="async"><figcaption>${esc(cap)}</figcaption></figure></li>` : ''; }).join('')}</ol>
      </div>
    </section>

    <section class="pj-gal ip-wrap" id="galeria" aria-labelledby="pj-gal-title">
      <div class="pj-gal__head">
        <h2 class="pj-h2" id="pj-gal-title">Hoja de contactos<b class="pj-dot">.</b></h2>
        <div class="pj-filters" role="group" aria-label="Filtrar las fotos">
          <button class="pj-filter" type="button" data-pj-filter="all" aria-pressed="true">Todas</button>
          <button class="pj-filter" type="button" data-pj-filter="color" aria-pressed="false">Color</button>
          <button class="pj-filter" type="button" data-pj-filter="bw" aria-pressed="false">B/N</button>
        </div>
      </div>
      <ul class="pj-grid" data-pj-grid>${photos.map((m, i) => `
        <li class="pj-grid__item" data-bw="${m.bw ? '1' : '0'}"><button class="pj-shot" type="button" data-pj-shot="${i}" aria-label="Ampliar: ${esc(m.alt)}">
          <img src="${esc(m.thumb || m.src)}" width="${m.w}" height="${m.h}" alt="" loading="lazy" decoding="async"><span class="pj-shot__star" aria-hidden="true">${STAR}</span>
        </button></li>`).join('')}</ul>
    </section>

    <section class="pj-end ip-wrap" aria-labelledby="pj-end-title">
      <h2 class="pj-end__title" id="pj-end-title">¿El siguiente es el tuyo?</h2>
      <div class="pj-end__actions">
        <a class="pj-btn" href="contacto.html?ref=${encodeURIComponent(w.slug)}">Hablemos <b aria-hidden="true">→</b></a>
        <a class="pj-link" href="portfolio.html">Volver al portfolio</a>
      </div>
    </section>

    <nav class="pj-index" aria-label="Secciones del proyecto">
      <ul>${INDEX.map(([id, t]) => `<li><button type="button" data-pj-to="${id}">${t}</button></li>`).join('')}</ul>
    </nav>`;

  initCover({ gsap, ScrollTrigger, main, still, arrived });
  const sound = initSound({ main, still });
  initSequence({ gsap, ScrollTrigger, main, still });
  const viewer = initViewer({ lenis, photos, main });
  initGallery({ gsap, ScrollTrigger, main, still, viewer });
  initIndex({ lenis, main, still, ScrollTrigger });
  if (!still) {
    gsap.utils.toArray('[data-pj-reveal]', main).forEach((el, i) => {
      gsap.from(el, { y: 40, opacity: 0, duration: 1, ease: 'expo.out', delay: (i % 3) * 0.08, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
  }
  // ?ver=galeria: directamente a la galería
  if (new URLSearchParams(location.search).get('ver') === 'galeria') {
    const go = () => { lenis.resize?.(); lenis.scrollTo('#galeria', { immediate: true, force: true, offset: -80 }); };
    gsap.delayedCall(0, go);
    Promise.all([arrived, document.fonts?.ready]).then(() => { ScrollTrigger.refresh(); go(); });
    window.addEventListener('load', () => setTimeout(go, 60), { once: true });
  }
  window.addEventListener('pagehide', () => sound.stop());
}

// ---------- A) portada: el zoom con el scroll y la entrada ----------
function initCover({ gsap, ScrollTrigger, main, still, arrived }) {
  const rise = main.querySelectorAll('[data-pj-rise]');
  const enter = main.querySelectorAll('[data-pj-enter]');
  if (still) return;
  gsap.fromTo(main.querySelector('[data-pj-zoom]'), { scale: 1 }, {
    scale: ZOOM,
    ease: 'none',
    scrollTrigger: { trigger: '#portada', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.set(rise, { yPercent: 105 });
  gsap.set(enter, { opacity: 0, y: 24 });
  arrived.then(() => {
    gsap.to(rise, { yPercent: 0, duration: 1.2, ease: 'expo.out', delay: 0.1 });
    gsap.to(enter, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.1, delay: 0.25 });
  });
}

// ---------- el sonido: solo suena uno a la vez (el reel de la portada o uno de los dos de abajo) ----------
function initSound({ main, still }) {
  const coverV = main.querySelector('[data-pj-cover-video]');
  const coverB = main.querySelector('[data-pj-cover-sound]');
  const section = main.querySelector('#reels');
  const reels = [...main.querySelectorAll('[data-pj-reel]')].map((fig) => ({ fig, v: fig.querySelector('video'), b: fig.querySelector('.pj-reel__hit') }));
  const cover = { v: coverV, b: coverB };
  const all = [cover, ...reels];
  let inView = false;
  let turn = 0;           // el reel que toca (en silencio, uno detrás de otro)
  // los reels: el que toca corre; el otro, quieto en su fotograma. Con sonido, ese en bucle y el otro parado
  const runReels = () => {
    const loud = reels.find((r) => !r.v.muted);
    reels.forEach((r, i) => {
      const go = inView && (loud ? r === loud : !still && i === turn);
      r.v.loop = !!loud && r === loud;
      if (go) r.v.play().catch(() => {}); else r.v.pause();
    });
  };
  reels.forEach((r, i) => r.v.addEventListener('ended', () => { if (r.v.muted) { turn = (i + 1) % reels.length; reels[turn].v.currentTime = 0; runReels(); } }));
  const set = (item, on) => {
    item.v.muted = !on;
    item.b.setAttribute('aria-pressed', String(on));
    item.fig?.classList.toggle('is-loud', on);
  };
  const toggle = (item) => {
    const on = item.v.muted;
    all.forEach((o) => { if (o !== item && !o.v.muted) set(o, false); });
    set(item, on);
    if (item === cover) { if (on) coverV.play().catch(() => {}); } else if (!on) turn = reels.indexOf(item);
    runReels();
  };
  all.forEach((item) => item.b.addEventListener('click', () => toggle(item)));
  // la duración real de cada reel
  reels.forEach((r, i) => r.v.addEventListener('loadedmetadata', () => { main.querySelector(`[data-pj-dur="${i}"]`).textContent = mmss(r.v.duration); }, { once: true }));
  // solo en pantalla (movimiento reducido: no arrancan solos)
  new IntersectionObserver(([e]) => { if (e.isIntersecting) { if (!still || !coverV.muted) coverV.play().catch(() => {}); } else coverV.pause(); }, { threshold: 0.35 }).observe(coverV);
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; runReels(); }, { threshold: 0.3 }).observe(section.querySelector('.pj-reels__row'));
  return { stop: () => all.forEach((o) => o.v.pause()) };
}

// ---------- E) la noche en secuencia: la tira avanza con el scroll mientras la sección cruza la pantalla ----------
function initSequence({ gsap, ScrollTrigger, main, still }) {
  const view = main.querySelector('[data-pj-seq-view]');
  const strip = main.querySelector('[data-pj-strip]');
  if (still) { view.classList.add('is-manual'); return; }
  gsap.fromTo(strip, { x: () => Math.min(0, view.clientWidth * 0.08) }, {
    x: () => -Math.max(0, strip.scrollWidth - view.clientWidth),
    ease: 'none',
    scrollTrigger: { trigger: view, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true },
  });
}

// ---------- F) hoja de contactos: filtros, aparición escalonada y el visor ----------
function initGallery({ gsap, ScrollTrigger, main, still, viewer }) {
  const items = [...main.querySelectorAll('.pj-grid__item')];
  const buttons = [...main.querySelectorAll('[data-pj-filter]')];
  let shown = items;
  buttons.forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.pjFilter;
    buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    shown = items.filter((li) => f === 'all' || (f === 'bw') === (li.dataset.bw === '1'));
    items.forEach((li) => { li.hidden = !shown.includes(li); });
    if (!still) gsap.fromTo(shown, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: 0.03, overwrite: true });
    ScrollTrigger.refresh();
  }));
  items.forEach((li) => li.querySelector('button').addEventListener('click', (e) => {
    const list = shown.map((x) => Number(x.querySelector('button').dataset.pjShot));
    viewer.open(list, list.indexOf(Number(e.currentTarget.dataset.pjShot)), e.currentTarget);
  }));
  if (!still) {
    gsap.set(items, { opacity: 0, y: 28 });
    ScrollTrigger.batch(items, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.06 }),
    });
  }
}

// visor a pantalla completa: flechas (botones y teclado), Esc, swipe, contador, miniaturas y la siguiente precargada
function initViewer({ lenis, photos, main }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'pjv';
  dlg.setAttribute('aria-label', 'Fotos del proyecto');
  dlg.setAttribute('data-lenis-prevent', '');
  dlg.innerHTML = `
    <p class="pjv__count" aria-live="polite"></p>
    <figure class="pjv__fig"><img class="pjv__img" alt=""><figcaption class="pjv__cap"></figcaption></figure>
    <button class="pjv__nav pjv__nav--prev" type="button" aria-label="Foto anterior">${ARROW('M15 5l-7 7 7 7')}</button>
    <button class="pjv__nav pjv__nav--next" type="button" aria-label="Foto siguiente">${ARROW('M9 5l7 7-7 7')}</button>
    <button class="pjv__close" type="button" aria-label="Cerrar el visor"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></button>
    <ol class="pjv__thumbs"></ol>`;
  main.append(dlg);
  const img = dlg.querySelector('.pjv__img');
  const cap = dlg.querySelector('.pjv__cap');
  const count = dlg.querySelector('.pjv__count');
  const thumbs = dlg.querySelector('.pjv__thumbs');
  let list = [];
  let k = 0;
  let opener = null;
  const show = (n) => {
    k = (n + list.length) % list.length;
    const m = photos[list[k]];
    img.src = m.src;
    img.alt = m.alt || '';
    img.width = m.w;
    img.height = m.h;
    cap.textContent = m.alt || '';
    count.textContent = `${pad(k + 1)} / ${pad(list.length)}`;
    thumbs.querySelectorAll('button').forEach((b, i) => {
      const on = i === k;
      b.classList.toggle('is-on', on);
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      if (on) b.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    [k + 1, k - 1].forEach((j) => { new Image().src = photos[list[(j + list.length) % list.length]].src; }); // las vecinas, ya listas
  };
  dlg.querySelector('.pjv__nav--prev').addEventListener('click', () => show(k - 1));
  dlg.querySelector('.pjv__nav--next').addEventListener('click', () => show(k + 1));
  dlg.querySelector('.pjv__close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(k + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(k - 1); }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  let sx = null;
  dlg.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') sx = e.clientX; });
  dlg.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 50) show(k + (dx < 0 ? 1 : -1));
  });
  dlg.addEventListener('pointercancel', () => { sx = null; });
  dlg.addEventListener('close', () => { lenis.start(); opener?.focus(); });
  return {
    open(l, i, from) {
      list = l;
      opener = from;
      thumbs.innerHTML = list.map((n, j) => `<li><button type="button" aria-label="Foto ${j + 1}"><img src="${esc(photos[n].thumb || photos[n].src)}" alt="" loading="lazy" decoding="async"></button></li>`).join('');
      thumbs.querySelectorAll('button').forEach((b, j) => b.addEventListener('click', () => show(j)));
      lenis.stop();
      dlg.showModal();
      show(Math.max(0, i));
    },
  };
}

// ---------- índice lateral (escritorio): la sección activa en naranja; clic = scroll suave ----------
function initIndex({ lenis, main, still, ScrollTrigger }) {
  const btns = [...main.querySelectorAll('[data-pj-to]')];
  btns.forEach((b) => b.addEventListener('click', () => {
    lenis.scrollTo(`#${b.dataset.pjTo}`, { offset: b.dataset.pjTo === 'portada' ? 0 : -72, duration: still ? 0 : 1.4, immediate: still });
  }));
  const on = (id) => btns.forEach((b) => { const a = b.dataset.pjTo === id; b.classList.toggle('is-on', a); if (a) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
  on('portada');
  INDEX.forEach(([id]) => {
    ScrollTrigger.create({ trigger: `#${id}`, start: 'top 50%', end: 'bottom 50%', onToggle: (s) => { if (s.isActive) on(id); } });
  });
}
