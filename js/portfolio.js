import { showreel, works } from './portfolio-data.js';
import { initPlaceholders } from './placeholder.js';

// Portfolio: contador, showreel, filtros con Flip y la rejilla "hoja de contactos". Cada trabajo abre su
// ficha en un <dialog> (foco dentro, Esc cierra, URL con #slug para compartir). Sin trabajos: 6 huecos al
// .55 y el aviso "Estamos rodando...". Con UN solo trabajo, en vez de la rejilla, el proyecto destacado: portada
// grande, sus reels verticales, la galería de fotos (con visor a pantalla completa) y "Próximo proyecto".
// Los datos, en js/portfolio-data.js.
const LABEL = { restaurantes: 'Restaurante', noche: 'Noche', eventos: 'Evento', marcas: 'Marca' };
const RATIOS = ['4/5', '1/1', '9/16'];
const EMPTY = 6;
const FPS = 25;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const setCount = (n) => { document.querySelector('[data-count]').textContent = `${pad(n)} PROYECTO${n === 1 ? '' : 'S'}`; };

export function init({ gsap, ScrollTrigger, lenis, reduced }) {
  setCount(works.length);
  initReel({ gsap, reduced });

  const grid = document.querySelector('[data-grid]');
  if (!works.length) {
    // estado "rodando": huecos con los mismos ratios que tendrá la rejilla
    grid.classList.add('is-empty');
    grid.setAttribute('aria-hidden', 'true');
    grid.innerHTML = Array.from({ length: EMPTY }, (_, i) => `<li class="pf__item"><figure class="ph" data-ratio="${RATIOS[i % 3]}" data-ph="assets/portfolio/proyecto-${pad(i + 1)}/cover.webp"></figure></li>`).join('');
    initPlaceholders(grid);
    document.querySelector('[data-empty]').hidden = false;
    document.querySelector('[data-filters]').hidden = true;
    return;
  }

  if (works.length === 1) {
    initFeatured({ gsap, ScrollTrigger, lenis, reduced, work: works[0] });
    initModal({ lenis });
    return;
  }

  grid.innerHTML = works.map((w, i) => {
    const ratio = w.ratio || RATIOS[i % 3];
    const cover = w.cover
      ? `<img src="${esc(w.cover)}" alt="" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async">`
      : '';
    const preview = w.kind === 'video' && w.preview ? `<video src="${esc(w.preview)}" muted loop playsinline preload="none" aria-hidden="true"></video>` : '';
    return `<li class="pf__item" data-cat="${esc(w.category)}">
      <a class="work" href="#${esc(w.slug)}" data-slug="${esc(w.slug)}">
        <figure class="ph work__media" data-ratio="${ratio}" data-ph="${esc(w.cover || `assets/portfolio/${w.slug}/cover.webp`)}">${cover}${preview}</figure>
        <p class="work__meta">${pad(i + 1)} · ${esc(LABEL[w.category] || w.category)} · ${esc(w.year)}</p>
        <h3 class="work__title">${esc(w.title)}</h3>
      </a>
    </li>`;
  }).join('');
  initPlaceholders(grid);

  // vídeo mudo en bucle al pasar el ratón (solo si hay preview)
  if (!reduced.matches) {
    grid.querySelectorAll('.work').forEach((a) => {
      const v = a.querySelector('video');
      if (!v) return;
      a.addEventListener('pointerenter', () => { v.play().then(() => v.classList.add('is-playing')).catch(() => {}); });
      a.addEventListener('pointerleave', () => { v.pause(); v.classList.remove('is-playing'); });
    });
  }

  initFilters({ gsap, grid, reduced });
  initModal({ lenis });
}

// --- filtros: Flip de gsap (el plugin se carga en portfolio.html) ---
function initFilters({ gsap, grid, reduced }) {
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const items = [...grid.children];
  const Flip = window.Flip;
  if (Flip) gsap.registerPlugin(Flip);
  buttons.forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.filter;
    buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const state = Flip && !reduced.matches ? Flip.getState(items) : null;
    items.forEach((li) => li.classList.toggle('is-out', f !== 'all' && li.dataset.cat !== f));
    if (state) {
      Flip.from(state, {
        duration: 0.6,
        ease: 'power3.inOut',
        absolute: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.5 }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.94, duration: 0.35 }),
      });
    }
    setCount(items.filter((li) => !li.classList.contains('is-out')).length);
  }));
}

// --- ficha: <dialog> + #slug ---
function initModal({ lenis }) {
  const modal = document.querySelector('[data-modal]');
  const $ = (s) => modal.querySelector(s);
  let opener = null;

  const open = (slug, from) => {
    const i = works.findIndex((w) => w.slug === slug);
    if (i < 0) return;
    const w = works[i];
    opener = from || document.querySelector(`[data-slug="${CSS.escape(slug)}"]`);
    $('[data-wm-meta]').textContent = `${pad(i + 1)} · ${LABEL[w.category] || w.category} · ${w.year}`;
    $('[data-wm-title]').textContent = w.title;
    $('[data-wm-client]').textContent = w.client || '';
    $('[data-wm-media]').innerHTML = (w.media || []).map((m) => (m.type === 'video'
      ? `<video src="${esc(m.src)}" poster="${esc(m.poster || '')}" controls playsinline preload="none"${m.alt ? ` aria-label="${esc(m.alt)}"` : ''}></video>`
      : `<img src="${esc(m.thumb || m.src)}"${m.thumb ? ` srcset="${esc(m.thumb)} 1000w, ${esc(m.src)} ${m.w || 2000}w" sizes="(min-width: 900px) 60vw, 100vw"` : ''}${m.w ? ` width="${m.w}" height="${m.h}"` : ''} alt="${esc(m.alt || '')}" loading="lazy" decoding="async">`)).join('');
    $('[data-wm-deliv]').textContent = w.deliverables?.length ? `Entregamos: ${w.deliverables.join(' · ')}` : '';
    $('[data-wm-cta]').href = `contacto.html?ref=${encodeURIComponent(w.slug)}`;
    if (location.hash !== `#${slug}`) history.replaceState(null, '', `#${slug}`);
    lenis.stop();
    if (!modal.open) modal.showModal();
  };
  const close = () => { if (modal.open) modal.close(); };

  modal.addEventListener('close', () => {
    modal.querySelectorAll('video').forEach((v) => v.pause());
    history.replaceState(null, '', location.pathname + location.search);
    lenis.start();
    opener?.focus();
  });
  $('[data-modal-close]').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); }); // clic en el fondo
  document.querySelectorAll('[data-slug]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    open(a.dataset.slug, a);
  }));
  const fromHash = () => { const s = decodeURIComponent(location.hash.slice(1)); if (s) open(s); };
  window.addEventListener('hashchange', fromHash);
  fromHash();
}

// --- showreel: hueco si no hay vídeo; con vídeo: póster, play, sonido opcional y timecode ---
function initReel({ reduced }) {
  const viewer = document.querySelector('[data-reel]');
  if (!showreel.src) return;
  const video = document.createElement('video');
  video.src = showreel.src;
  if (showreel.poster) video.poster = showreel.poster;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.setAttribute('aria-label', 'Showreel de disco');
  viewer.querySelector('.ph').replaceWith(video);

  const play = viewer.querySelector('[data-reel-play]');
  const mute = viewer.querySelector('[data-reel-mute]');
  const tc = viewer.querySelector('[data-reel-tc]');
  play.hidden = false;
  play.addEventListener('click', () => {
    video.play();
    play.hidden = true;
    mute.hidden = false;
    video.controls = reduced.matches;
  });
  video.addEventListener('click', () => { if (!video.paused) { video.pause(); play.hidden = false; } });
  mute.addEventListener('click', () => {
    video.muted = !video.muted;
    mute.setAttribute('aria-pressed', String(video.muted));
    mute.textContent = video.muted ? 'Sonido: no' : 'Sonido: sí';
  });
  video.addEventListener('timeupdate', () => {
    const t = video.currentTime;
    tc.textContent = `00:${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}:${pad(Math.floor((t % 1) * FPS))}`;
  });
}

// --- un solo trabajo: proyecto destacado ---
// Portada grande con el título encima (abre la ficha); debajo, en la misma página: los reels verticales (mudos al
// entrar en pantalla; clic = con sonido y controles), la galería "hoja de contactos" (aparece escalonada; clic =
// visor a pantalla completa con flechas, Esc, swipe y contador) y la tarjeta del próximo proyecto.
function initFeatured({ gsap, ScrollTrigger, lenis, reduced, work: w }) {
  document.querySelector('[data-filters]').hidden = true;
  const stage = document.querySelector('[data-stage]');
  stage.classList.add('is-featured');
  const reels = (w.media || []).filter((m) => m.type === 'video');
  const photos = (w.media || []).filter((m) => m.type === 'img');
  const first = photos[0];
  const line = [w.client, ...(w.deliverables || [])].filter(Boolean).map(esc).join(' · ');
  stage.innerHTML = `
    <article class="pf-feat">
      <a class="pf-feat__cover" href="#${esc(w.slug)}" data-slug="${esc(w.slug)}">
        <img src="${esc(w.coverLarge || w.cover)}" srcset="${esc(w.cover)} 1000w, ${esc(w.coverLarge || w.cover)} 2000w" sizes="100vw"${first ? ` width="${first.w}" height="${first.h}"` : ''} alt="${esc(first?.alt || '')}" decoding="async">
        <span class="pf-feat__text">
          <span class="pf-feat__title">${esc(w.title)}</span>
          <span class="pf-feat__line">${line}</span>
          <span class="pf-feat__btn">Ver proyecto <b aria-hidden="true">→</b></span>
        </span>
      </a>
    </article>
    <div class="pf-body">
      ${reels.length ? `<div class="pf-reels">${reels.map((m) => `
        <figure class="pf-reel">
          <video src="${esc(m.src)}" poster="${esc(m.poster || '')}" muted loop playsinline preload="none"${m.alt ? ` aria-label="${esc(m.alt)}"` : ''}></video>
          <button class="pf-reel__sound" type="button">Ver con sonido</button>
        </figure>`).join('')}</div>` : ''}
      <ul class="pf-sheet">${photos.map((m, i) => `
        <li class="pf-sheet__item"><button class="pf-shot" type="button" data-shot="${i}" aria-label="Ampliar: ${esc(m.alt)}">
          <img src="${esc(m.thumb || m.src)}" width="${m.w || 1000}" height="${m.h || 1000}" alt="" loading="lazy" decoding="async">
        </button></li>`).join('')}</ul>
    </div>
    <a class="pf-next" href="contacto.html">
      <span class="pf-next__kicker">Próximo proyecto: en rodaje</span>
      <span class="pf-next__title">¿El siguiente es el tuyo? <b aria-hidden="true">→</b></span>
    </a>`;

  // reels: mudos al entrar en pantalla; clic = con sonido y controles (solo suena uno)
  stage.querySelectorAll('.pf-reel').forEach((fig) => {
    const v = fig.querySelector('video');
    const btn = fig.querySelector('.pf-reel__sound');
    btn.addEventListener('click', () => {
      fig.classList.add('is-loud');
      stage.querySelectorAll('.pf-reel video').forEach((o) => { if (o !== v) o.muted = true; });
      v.muted = false;
      v.controls = true;
      v.play().catch(() => {});
      v.focus();
    });
    if (reduced.matches) return; // movimiento reducido: no se reproducen solos
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { if (v.paused && v.muted) v.play().catch(() => {}); } else v.pause();
    }, { threshold: 0.4 }).observe(fig);
  });

  // galería: aparición escalonada al hacer scroll
  const items = [...stage.querySelectorAll('.pf-sheet__item')];
  if (!reduced.matches && ScrollTrigger) {
    gsap.set(items, { opacity: 0, y: 28 });
    ScrollTrigger.batch(items, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.06 }),
    });
  }
  initViewer({ lenis, photos, stage });
}

// visor de fotos a pantalla completa: flechas (botones y teclado), Esc, swipe en móvil y contador
function initViewer({ lenis, photos, stage }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'pv';
  dlg.setAttribute('aria-label', 'Fotos del proyecto');
  dlg.setAttribute('data-lenis-prevent', '');
  dlg.innerHTML = `
    <figure class="pv__fig"><img class="pv__img" alt=""><figcaption class="pv__cap"></figcaption></figure>
    <button class="pv__nav pv__nav--prev" type="button" aria-label="Foto anterior"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>
    <button class="pv__nav pv__nav--next" type="button" aria-label="Foto siguiente"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>
    <p class="pv__count" aria-live="polite"></p>
    <button class="pv__close" type="button" aria-label="Cerrar el visor"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></button>`;
  document.querySelector('main').append(dlg);
  const img = dlg.querySelector('.pv__img');
  const cap = dlg.querySelector('.pv__cap');
  const count = dlg.querySelector('.pv__count');
  let i = 0;
  let opener = null;
  const show = (n) => {
    i = (n + photos.length) % photos.length;
    const m = photos[i];
    img.src = m.src;
    img.alt = m.alt || '';
    if (m.w) { img.width = m.w; img.height = m.h; }
    cap.textContent = m.alt || '';
    count.textContent = `${pad(i + 1)} / ${pad(photos.length)}`;
    [i + 1, i - 1].forEach((k) => { new Image().src = photos[(k + photos.length) % photos.length].src; }); // las vecinas, ya listas
  };
  stage.querySelectorAll('[data-shot]').forEach((b) => b.addEventListener('click', () => {
    opener = b;
    show(Number(b.dataset.shot));
    lenis.stop();
    dlg.showModal();
  }));
  dlg.querySelector('.pv__nav--prev').addEventListener('click', () => show(i - 1));
  dlg.querySelector('.pv__nav--next').addEventListener('click', () => show(i + 1));
  dlg.querySelector('.pv__close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  // swipe (dedo): más de 50 px en horizontal pasa de foto
  let sx = null;
  dlg.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') sx = e.clientX; });
  dlg.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
  });
  dlg.addEventListener('pointercancel', () => { sx = null; });
  dlg.addEventListener('close', () => { lenis.start(); opener?.focus(); });
}
