import { showreel, works } from './portfolio-data.js';
import { initPlaceholders } from './placeholder.js';

// Portfolio: contador, showreel, filtros con Flip y la rejilla "hoja de contactos". Cada trabajo abre su
// ficha en un <dialog> (foco dentro, Esc cierra, URL con #slug para compartir). Sin trabajos: 6 huecos al
// .55 y el aviso "Estamos rodando...". Los datos, en js/portfolio-data.js.
const LABEL = { restaurantes: 'Restaurante', noche: 'Noche', eventos: 'Evento', marcas: 'Marca' };
const RATIOS = ['4/5', '1/1', '9/16'];
const EMPTY = 6;
const FPS = 25;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const setCount = (n) => { document.querySelector('[data-count]').textContent = `${pad(n)} PROYECTO${n === 1 ? '' : 'S'}`; };

export function init({ gsap, lenis, reduced }) {
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
      ? `<video src="${esc(m.src)}" poster="${esc(m.poster || '')}" controls playsinline preload="metadata"></video>`
      : `<img src="${esc(m.src)}" alt="${esc(m.alt || '')}" loading="lazy" decoding="async">`)).join('');
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
