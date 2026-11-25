// El HTML de la página de un proyecto (AS-C), sin DOM: lo usan js/proyecto.js (si la página llega vacía) y
// tools/proyectos.mjs, que genera proyecto-<slug>.html con este contenido YA en el HTML (para que Google lo lea).
// js/proyecto.js hace después las animaciones encima. Datos: js/portfolio-data.js → works[].project.
const STAR = '<svg viewBox="1194 585 84 119" aria-hidden="true" focusable="false"><path d="M1235 585Q1242.7 632.6 1278 643Q1242.7 654 1235 704Q1227.6 654 1194 643Q1227.6 632.6 1235 585Z" fill="currentColor"/></svg>';
const SOUND = '<svg class="pj-i-on" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><svg class="pj-i-off" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const ARROW = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
const PLAY = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
const INDEX = [['portada', 'Portada'], ['ficha', 'Ficha'], ['video', 'Vídeo'], ['reels', 'Reels'], ['la-noche', 'La noche'], ['galeria', 'Galería']];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const photoN = (m) => (m.src.match(/-(\d+)\.webp$/) || [])[1];
// el vídeo horizontal del proyecto (un media de vídeo con w > h), para el bloque "El vídeo"; si no hay, null
export const filmOf = (w) => (w.media || []).find((m) => m.type === 'video' && m.w > m.h) || null;
// ancho y alto de la portada a partir de su ratio ('16/9' → 1920 × 1080), para los proyectos sin fotos
export const ratioSize = (r = '16/9') => { const [a, b] = String(r).split('/').map(Number); return { w: 1920, h: Math.round((1920 * (b || 9)) / (a || 16)) }; };

// la URL de la página de un proyecto (con ?ver=galeria, etc. en extra)
export const projectUrl = (slug, extra = '') => `proyecto-${encodeURIComponent(slug)}.html${extra}`;

// → { html, index }: el contenido del <main> y las secciones del índice lateral
export function renderProject(w, { works = [] } = {}) {
  const p = w.project;
  const photos = (w.media || []).filter((m) => m.type === 'img');
  const byN = Object.fromEntries(photos.map((m) => [photoN(m), m]));
  // sin fotos (solo vídeo), la portada es la de la tarjeta (cover / coverLarge), decorativa: el h1 ya dice el nombre
  const cover = photos[0] || { src: w.coverLarge || w.cover, thumb: w.cover, ...ratioSize(w.ratio), alt: '' };
  const reels = p.reels || [];
  const film = filmOf(w);
  const seq = (p.sequence || []).filter(([n]) => byN[n]);
  // el siguiente proyecto (en bucle), para el cierre
  const at = works.findIndex((x) => x.slug === w.slug);
  const next = works.length > 1 ? works[(at + 1) % works.length] : null;
  // con reels, en la portada el móvil con el primero; solo fotos, la portada como foto grande enmarcada (sin marco de
  // teléfono) y, para no repetirla detrás, de fondo la primera foto de la secuencia que no es la portada
  const bgN = reels.length ? null : (p.sequence || []).map(([n]) => n).find((n) => byN[n] && byN[n] !== cover);
  const bg = (bgN && byN[bgN]) || cover;
  const bgSrc = bg === cover ? w.coverLarge || cover.src : bg.src;
  const bgSet = bg === cover ? `${esc(w.cover)} 1000w, ${esc(bgSrc)} 2000w` : `${esc(bg.thumb)} 1000w, ${esc(bg.src)} ${bg.w}w`;
  const front = reels.length ? `
      <div class="pj-cover__phone" data-pj-slide>
        <div class="pj-phone"><video src="${esc(reels[0].src)}" poster="${esc(reels[0].poster)}" muted loop playsinline preload="metadata" aria-label="${esc(reels[0].alt)}" data-pj-cover-video></video></div>
        <button class="pj-sound" type="button" aria-pressed="false" aria-label="Sonido del reel" data-pj-cover-sound>${SOUND}</button>
      </div>` : `
      <figure class="pj-cover__photo" data-pj-slide style="--r: ${(cover.h / cover.w).toFixed(4)}">
        <img src="${esc(w.coverLarge || cover.src)}" srcset="${esc(w.cover)} 1000w, ${esc(w.coverLarge || cover.src)} 2000w" sizes="(min-width: 768px) 46vw, 92vw" width="${cover.w}" height="${cover.h}" alt="${esc(cover.alt)}" fetchpriority="high" decoding="async" data-pj-parallax>
      </figure>`;

  // el índice, con las secciones que tiene este proyecto (sin reels, sin su entrada)
  // (y sin vídeo, secuencia o fotos, igual)
  const has = { video: !!film, reels: reels.length > 0, 'la-noche': seq.length > 0, galeria: photos.length > 0 };
  const index = INDEX.filter(([id]) => has[id] !== false);

  const html = `
    <section class="pj-cover${reels.length ? '' : ' pj-cover--photo'}" id="portada" aria-labelledby="pj-title">
      <div class="pj-cover__bg" data-pj-zoom${reels.length ? '' : ' aria-hidden="true"'}><img src="${esc(bgSrc)}" srcset="${bgSet}" sizes="100vw" width="${bg.w}" height="${bg.h}" alt="${reels.length ? esc(cover.alt) : ''}" fetchpriority="high" decoding="async"></div>
      <i class="pj-cover__shade" aria-hidden="true"></i>${front}
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

    ${film ? `<section class="pj-film ip-wrap" id="video" aria-labelledby="pj-film-title">
      <h2 class="pj-h2" id="pj-film-title">El vídeo<b class="pj-dot">.</b></h2>
      <div class="pj-film__viewer" data-pj-film>
        <video poster="${esc(film.poster)}" width="${film.w}" height="${film.h}" preload="none" playsinline controls aria-label="${esc(film.alt)}">${film.srcSm ? `
          <source src="${esc(film.srcSm)}" type="video/mp4" media="(max-width: 767px)">` : ''}
          <source src="${esc(film.src)}" type="video/mp4">
        </video>
        <button class="pj-film__play" type="button" aria-label="Reproducir el vídeo con sonido" data-pj-film-play>${PLAY}</button>
        <div class="pj-film__bar">
          <button class="pj-film__pill" type="button" data-pj-film-pause hidden>Pausa</button>
          <button class="pj-film__pill" type="button" aria-pressed="true" data-pj-film-mute hidden>Sonido: sí</button>
        </div>
      </div>
    </section>

    ` : ''}${reels.length ? `<section class="pj-reels" id="reels" aria-labelledby="pj-reels-title">
      <div class="ip-wrap">
        <h2 class="pj-h2" id="pj-reels-title">${reels.length === 1 ? 'El reel' : 'Los reels'}<b class="pj-dot">.</b></h2>
        <div class="pj-reels__row">${reels.map((r, i) => `
          <figure class="pj-reel" data-pj-reel>
            <div class="pj-phone pj-phone--reel">
              <video src="${esc(r.src)}" poster="${esc(r.poster)}" muted playsinline preload="none" aria-label="${esc(r.alt)}"></video>
              <button class="pj-reel__hit" type="button" aria-pressed="false" aria-label="Sonido: ${esc(r.title)}"><span class="pj-sound pj-sound--in">${SOUND}</span></button>
            </div>
            <figcaption class="pj-reel__cap"><span class="pj-reel__title">${esc(r.title)}</span><span class="pj-reel__time" data-pj-dur="${i}">${esc(r.duration)}</span></figcaption>
          </figure>`).join('')}</div>
      </div>
    </section>` : ''}
${seq.length ? `
    <section class="pj-seq" id="la-noche" aria-labelledby="pj-seq-title">
      <div class="ip-wrap"><h2 class="pj-h2" id="pj-seq-title">La noche, en secuencia<b class="pj-dot">.</b></h2></div>
      <div class="pj-seq__view" data-pj-seq-view>
        <ol class="pj-seq__strip" data-pj-strip>${seq.map(([n, cap]) => { const m = byN[n]; return `
          <li class="pj-seq__item"><figure><img src="${esc(m.thumb || m.src)}" srcset="${esc(m.thumb)} 1000w, ${esc(m.src)} ${m.w}w" sizes="(min-width: 900px) 46vw, 80vw" width="${m.w}" height="${m.h}" alt="${esc(m.alt)}" loading="lazy" decoding="async"><figcaption>${esc(cap)}</figcaption></figure></li>`; }).join('')}</ol>
      </div>
    </section>
` : ''}${photos.length ? `
    <section class="pj-gal ip-wrap" id="galeria" aria-labelledby="pj-gal-title">
      <div class="pj-gal__head">
        <h2 class="pj-h2" id="pj-gal-title">Hoja de contactos<b class="pj-dot">.</b></h2>${photos.some((m) => m.bw) && photos.some((m) => !m.bw) ? `
        <div class="pj-filters" role="group" aria-label="Filtrar las fotos">
          <button class="pj-filter" type="button" data-pj-filter="all" aria-pressed="true">Todas</button>
          <button class="pj-filter" type="button" data-pj-filter="color" aria-pressed="false">Color</button>
          <button class="pj-filter" type="button" data-pj-filter="bw" aria-pressed="false">B/N</button>
        </div>` : ''}
      </div>
      <ul class="pj-grid" data-pj-grid>${photos.map((m, i) => `
        <li class="pj-grid__item" data-bw="${m.bw ? '1' : '0'}"><button class="pj-shot" type="button" data-pj-shot="${i}" aria-label="Ampliar: ${esc(m.alt)}">
          <img src="${esc(m.thumb || m.src)}" width="${m.w}" height="${m.h}" alt="" loading="lazy" decoding="async"><span class="pj-shot__star" aria-hidden="true">${STAR}</span>
        </button></li>`).join('')}</ul>
    </section>
` : ''}
    <section class="pj-end ip-wrap" aria-labelledby="pj-end-title">
      <h2 class="pj-end__title" id="pj-end-title">¿El siguiente es el tuyo?</h2>
      <div class="pj-end__actions">
        <a class="pj-btn" href="contacto.html?ref=${encodeURIComponent(w.slug)}" data-draft>Cuéntanos tu proyecto <b aria-hidden="true">→</b></a>
        <a class="pj-link" href="servicios.html" data-draft>Qué hacemos: foto, vídeo y edición</a>${next ? `
        <a class="pj-link" href="${projectUrl(next.slug)}" data-draft>Siguiente proyecto: ${esc(next.title)}</a>` : ''}
        <a class="pj-link" href="portfolio.html">Volver al portfolio</a>
      </div>
    </section>

    <nav class="pj-index" aria-label="Secciones del proyecto">
      <ul>${index.map(([id, t]) => `<li><button type="button" data-pj-to="${id}">${t}</button></li>`).join('')}</ul>
    </nav>`;
  return { html, index };
}
export { INDEX, photoN };
