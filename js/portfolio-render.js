// El bloque de cada proyecto en la lista del portfolio (AS-D), sin DOM: lo usan js/portfolio.js y
// tools/proyectos.mjs, que lo deja ya en el HTML de portfolio.html (para que Google lea título, línea, frase y enlace
// sin ejecutar JS; al cargar, js/portfolio.js lo vuelve a pintar igual).
import { projectUrl as page } from './proyecto-render.js';

export const FEATURED_MAX = 6; // hasta aquí, cada trabajo a todo el ancho, uno debajo de otro; con más, la rejilla
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// todos los proyectos y, al final, UNA vez, la tarjeta del próximo proyecto
export function renderFeaturedList(list) {
  return `${list.map(renderFeatured).join('')}
    <a class="pf-next" href="contacto.html">
      <span class="pf-next__kicker">Próximo proyecto: en rodaje</span>
      <span class="pf-next__title">¿El siguiente es el tuyo? <b aria-hidden="true">→</b></span>
    </a>`;
}

// un proyecto (el bloque): portada con título (h3), línea y "Ver proyecto"; debajo, la frase de lo que se hizo
// (project.tagline) y el adelanto. Adelanto: las verticales primero y, si no llegan a 3, se completa con horizontales
// (la fila las recorta a 4:5: sin huecos)
export function renderFeatured(w, i) {
  const photos = (w.media || []).filter((m) => m.type === 'img');
  const first = photos[0];
  const peek = [...photos.filter((m) => m.h > m.w), ...photos.slice(1).filter((m) => m.h <= m.w)].slice(0, 3);
  const line = [w.client, ...(w.deliverables || [])].filter(Boolean).map(esc).join(' · ');
  const all = page(w.slug, '?ver=galeria');
  const tagline = w.project?.tagline ? `
    <p class="pf-proj__tagline" data-draft>${esc(w.project.tagline)}</p>` : '';
  return `<div class="pf-proj">
    <article class="pf-feat">
      <a class="pf-feat__cover" href="${page(w.slug)}">
        <img src="${esc(w.coverLarge || w.cover)}" srcset="${esc(w.cover)} 1000w, ${esc(w.coverLarge || w.cover)} 2000w" sizes="100vw"${first ? ` width="${first.w}" height="${first.h}"` : ''} alt="${esc(first?.alt || '')}" loading="lazy" decoding="async">
        <span class="pf-feat__text">
          <h3 class="pf-feat__title">${esc(w.title)}</h3>
          <span class="pf-feat__line">${line}</span>
          <span class="pf-feat__btn">Ver proyecto <b aria-hidden="true">→</b></span>
        </span>
      </a>
    </article>${tagline}
    ${peek.length ? `<div class="pf-peek">
      <ul class="pf-peek__row">${peek.map((m) => `
        <li><a href="${all}" aria-label="Ver la galería: ${esc(m.alt)}"><img src="${esc(m.thumb || m.src)}" width="${m.w}" height="${m.h}" alt="" loading="lazy" decoding="async"></a></li>`).join('')}</ul>
      <a class="pf-peek__more" href="${all}">Ver las ${photos.length} fotos <b aria-hidden="true">→</b></a>
    </div>` : ''}
  </div>`;
}
