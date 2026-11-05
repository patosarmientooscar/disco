import { showreel, works } from './portfolio-data.js';
import { initPlaceholders } from './placeholder.js';
import { initManifesto } from './manifesto.js';
import { litWords } from './interior.js';

// Portfolio: el hero de la bola (js/portfolio-hero.js), contador, showreel y la rejilla "hoja de
// contactos". Cada trabajo lleva a SU página (proyecto.html#slug, js/proyecto.js), con la transición entre páginas;
// los enlaces viejos (portfolio.html#slug) también. Sin trabajos: 6 huecos al .55 y el aviso "Estamos rodando...".
// Con UN solo trabajo, en vez de la rejilla, el proyecto destacado: portada grande (toda ella, el enlace), 3 fotos de
// adelanto y "Ver las 20 fotos", y "Próximo proyecto". Los datos, en js/portfolio-data.js.
// (LEGACY: la ficha en <dialog>, los reels y la galería con visor del destacado, en legacy/portfolio-ficha-modal/)
const LABEL = { restaurantes: 'Restaurante', noche: 'Noche', eventos: 'Evento', marcas: 'Marca' };
const RATIOS = ['4/5', '1/1', '9/16'];
const EMPTY = 6;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const page = (slug, extra = '') => `proyecto.html${extra}#${encodeURIComponent(slug)}`;
const setCount = (n) => { document.querySelector('[data-count]').textContent = `${pad(n)} PROYECTO${n === 1 ? '' : 'S'}`; };

export function init({ gsap, ScrollTrigger, lenis, loop, reduced }) {
  // los enlaces de antes (portfolio.html#slug) llevan a la página del proyecto
  const old = decodeURIComponent(location.hash.slice(1));
  if (old && works.some((w) => w.slug === old)) { location.replace(page(old)); return; }
  setCount(works.length);
  initReel({ gsap, reduced });
  // junto al showreel, la primera frase se ilumina palabra a palabra (como los manifiestos)
  litWords(document.querySelector('[data-reel-lead]'), { gsap, reduced, start: 'top 85%', end: 'bottom 55%' });
  initManifesto({ gsap, lenis, reduced });
  import('./portfolio-hero.js').then((m) => m.initBallHero({ gsap, lenis, loop, reduced })).catch(() => {});

  const grid = document.querySelector('[data-grid]');
  if (!works.length) {
    // estado "rodando": huecos con los mismos ratios que tendrá la rejilla
    grid.classList.add('is-empty');
    grid.setAttribute('aria-hidden', 'true');
    grid.innerHTML = Array.from({ length: EMPTY }, (_, i) => `<li class="pf__item"><figure class="ph" data-ratio="${RATIOS[i % 3]}" data-ph="assets/portfolio/proyecto-${pad(i + 1)}/cover.webp"></figure></li>`).join('');
    initPlaceholders(grid);
    document.querySelector('[data-empty]').hidden = false;
    return;
  }

  if (works.length === 1) {
    initFeatured({ work: works[0] });
    return;
  }

  grid.innerHTML = works.map((w, i) => {
    const ratio = w.ratio || RATIOS[i % 3];
    const cover = w.cover
      ? `<img src="${esc(w.cover)}" alt="" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async">`
      : '';
    const preview = w.kind === 'video' && w.preview ? `<video src="${esc(w.preview)}" muted loop playsinline preload="none" aria-hidden="true"></video>` : '';
    return `<li class="pf__item" data-cat="${esc(w.category)}">
      <a class="work" href="${page(w.slug)}">
        <figure class="ph work__media" data-ratio="${ratio}" data-ph="${esc(w.cover || `assets/portfolio/${w.slug}/cover.webp`)}">${cover}${preview}</figure>
        <p class="work__meta">${pad(i + 1)} · ${esc(LABEL[w.category] || w.category)} · ${esc(w.year)}</p>
        <h3 class="work__title">${esc(w.title)}</h3>
      </a>
    </li>`;
  }).join('');
  // con menos trabajos que columnas (2), tantas columnas como trabajos: sin una columna vacía
  if (works.length < 3) grid.style.columns = String(works.length);
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

}


// --- showreel: hueco si no hay vídeo; con vídeo: póster, play, sonido opcional y timecode ---
// el visor limpio: el vídeo (o el hueco) con un solo play redondo en el centro; el sonido, pequeño abajo a la derecha
// y solo mientras se reproduce. Clic en el vídeo: pausa (vuelve el play)
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
  play.hidden = false;
  play.addEventListener('click', () => {
    video.play();
    video.controls = reduced.matches;
  });
  video.addEventListener('play', () => { play.hidden = true; mute.hidden = false; });
  const stop = () => { play.hidden = false; mute.hidden = true; };
  video.addEventListener('pause', stop);
  video.addEventListener('ended', stop);
  video.addEventListener('click', () => { if (!video.paused) video.pause(); });
  mute.addEventListener('click', () => {
    video.muted = !video.muted;
    mute.setAttribute('aria-pressed', String(video.muted));
    mute.textContent = video.muted ? 'Sonido: no' : 'Sonido: sí';
  });
}

// --- un solo trabajo: proyecto destacado ---
// Portada grande con el título encima (toda ella, el enlace a la página del proyecto); debajo, 3 fotos de adelanto en
// fila y "Ver las 20 fotos" (a la galería del proyecto); al final, la tarjeta del próximo proyecto.
function initFeatured({ work: w }) {
  const stage = document.querySelector('[data-stage]');
  stage.classList.add('is-featured');
  const photos = (w.media || []).filter((m) => m.type === 'img');
  const first = photos[0];
  const peek = photos.filter((m) => m.h > m.w).slice(0, 3);
  const line = [w.client, ...(w.deliverables || [])].filter(Boolean).map(esc).join(' · ');
  const all = page(w.slug, '?ver=galeria');
  stage.innerHTML = `
    <article class="pf-feat">
      <a class="pf-feat__cover" href="${page(w.slug)}">
        <img src="${esc(w.coverLarge || w.cover)}" srcset="${esc(w.cover)} 1000w, ${esc(w.coverLarge || w.cover)} 2000w" sizes="100vw"${first ? ` width="${first.w}" height="${first.h}"` : ''} alt="${esc(first?.alt || '')}" decoding="async">
        <span class="pf-feat__text">
          <span class="pf-feat__title">${esc(w.title)}</span>
          <span class="pf-feat__line">${line}</span>
          <span class="pf-feat__btn">Ver proyecto <b aria-hidden="true">→</b></span>
        </span>
      </a>
    </article>
    ${peek.length ? `<div class="pf-peek">
      <ul class="pf-peek__row">${peek.map((m) => `
        <li><a href="${all}" aria-label="Ver la galería: ${esc(m.alt)}"><img src="${esc(m.thumb || m.src)}" width="${m.w}" height="${m.h}" alt="" loading="lazy" decoding="async"></a></li>`).join('')}</ul>
      <a class="pf-peek__more" href="${all}">Ver las ${photos.length} fotos <b aria-hidden="true">→</b></a>
    </div>` : ''}
    <a class="pf-next" href="contacto.html">
      <span class="pf-next__kicker">Próximo proyecto: en rodaje</span>
      <span class="pf-next__title">¿El siguiente es el tuyo? <b aria-hidden="true">→</b></span>
    </a>`;
}
