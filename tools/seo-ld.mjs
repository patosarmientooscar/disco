// Datos estructurados (JSON-LD) de cada página (AS-G). Los llama tools/site.mjs, con la URL base de SITE_URL (o el
// marcador https://[DOMINIO]). Todo sale de datos que ya están en la web: js/config.js (email, Instagram), el HTML de
// cada página (la FAQ visible, tal cual: así FAQPage coincide siempre con lo que se lee), js/portfolio-data.js
// (proyectos, fotos, reels) y los propios vídeos (duración con ffprobe; fecha = la del archivo en git).
// Al final, validate() comprueba los campos obligatorios de cada tipo y avisa por consola.
import { statSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { config } = await import(pathToFileURL(join(ROOT, 'js/config.js')).href);
const { works, showreel } = await import(pathToFileURL(join(ROOT, 'js/portfolio-data.js')).href);

const text = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
// duración de un vídeo en ISO 8601 (PT19S), leída del archivo
const duration = (src) => {
  try { return `PT${Math.round(+execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(ROOT, src)]).toString())}S`; } catch { return undefined; }
};
// fecha del archivo: cuando entró en el repositorio (si no, la de modificación)
const fileDate = (src) => {
  try { const d = execSync(`git log --diff-filter=A -1 --format=%cI -- "${src}"`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); if (d) return d; } catch { /* sin git */ }
  return statSync(join(ROOT, src)).mtime.toISOString();
};

export async function ldFor(page, { html, abs, BASE, projects }) {
  const ORG = `${BASE}/#disco`;
  const crumbs = (...items) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [['Inicio', 'index.html'], ...items].map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(p) })),
  });
  // la FAQ visible de la página (<details class="faq__item"><summary>…</summary><div class="faq__a"><p>…</p>)
  const faq = () => {
    const qs = [...html.matchAll(/<details class="faq__item"[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>\s*<div class="faq__a"[^>]*>([\s\S]*?)<\/div>/g)]
      .map(([, q, a]) => ({ '@type': 'Question', name: text(q), acceptedAnswer: { '@type': 'Answer', text: text(a) } }));
    return qs.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qs }] : [];
  };
  const person = (name, jobTitle, img) => ({ '@type': 'Person', name, jobTitle, image: abs(img), worksFor: { '@id': ORG } });
  const LUNA = person('Luna López', 'Cofundadora · dirección y edición de vídeo', 'assets/team/nosotros/luna-lopez-retrato-1280.webp');
  const BRUNO = person('Bruno Marín', 'Cofundador · foto, vídeo y edición de foto', 'assets/team/nosotros/bruno-marin-retrato-1280.webp');
  const service = (name, description) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name, description, provider: { '@id': ORG }, areaServed: 'Madrid' } });
  const org = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': ORG,
    name: 'disco.',
    url: abs('index.html'),
    logo: abs('assets/brand/icon-512.png'),
    image: abs('assets/brand/og.jpg'),
    description: 'Productora audiovisual en Madrid: foto, vídeo y edición para restaurantes, bares, discotecas, eventos y marcas.',
    email: config.email,
    // teléfono y horario: cuando estén en js/config.js (phone + ready.phone; el horario, añadirlo aquí):
    //   telephone: '+34 600 000 000',
    //   openingHours: 'Mo-Fr 10:00-19:00',
    ...(config.ready?.phone && config.phone ? { telephone: config.phone } : {}),
    areaServed: [{ '@type': 'City', name: 'Madrid' }, { '@type': 'AdministrativeArea', name: 'Comunidad de Madrid' }],
    address: { '@type': 'PostalAddress', addressLocality: 'Madrid', addressCountry: 'ES' },
    knowsAbout: ['Fotografía', 'Vídeo', 'Edición de vídeo', 'Postproducción', 'Contenido para redes sociales', 'Cobertura de eventos', 'Dirección de arte'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Servicios de disco.',
      itemListElement: [
        service('Fotografía', 'Producto, espacios y personas, con dirección de arte, luz y retoque.'),
        service('Vídeo', 'Reels, vídeo de marca y eventos rodados con ritmo y calidad de cine.'),
        service('Edición y postproducción', 'Montaje, color y sonido.'),
        service('Contenido para redes sociales', 'Piezas listas para cada red: reels, fotos y formatos verticales.'),
        service('Cobertura de eventos', 'Fiestas, noches y eventos: foto de ambiente, aftermovies y reels.'),
      ],
    },
    founder: [{ '@type': 'Person', name: 'Luna López' }, { '@type': 'Person', name: 'Bruno Marín' }],
    sameAs: [config.instagram?.url, ...(config.socials || []).map((s) => s.url)].filter((u, i, a) => u && a.indexOf(u) === i),
  };
  const video = (v, name, description) => ({
    '@type': 'VideoObject',
    name,
    description,
    thumbnailUrl: abs(v.poster),
    contentUrl: abs(v.src),
    uploadDate: fileDate(v.src),
    duration: duration(v.src),
  });

  switch (page) {
    case 'index.html':
      return [org, { '@context': 'https://schema.org', '@type': 'WebSite', name: 'disco.', url: abs('index.html'), inLanguage: 'es-ES', publisher: { '@id': ORG } }];
    case 'servicios.html':
      return [
        { '@context': 'https://schema.org', '@type': 'Service', name: 'Foto, vídeo y edición para negocios en Madrid', serviceType: 'Producción audiovisual', provider: { '@id': ORG, '@type': 'ProfessionalService', name: 'disco.' }, areaServed: { '@type': 'City', name: 'Madrid' }, hasOfferCatalog: org.hasOfferCatalog },
        crumbs(['Servicios', 'servicios.html']),
        ...faq(),
      ];
    case 'portfolio.html':
      return [
        { '@context': 'https://schema.org', ...video({ src: showreel.src, poster: showreel.poster }, 'Manifiesto de disco.', 'El manifiesto de disco., productora de foto y vídeo en Madrid: lo que hacemos y cómo lo contamos.') },
        { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Proyectos de disco.', itemListElement: projects.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.work.title, url: abs(p.file) })) },
        crumbs(['Portfolio', 'portfolio.html']),
      ];
    case 'nosotros.html':
      return [
        { '@context': 'https://schema.org', '@type': 'AboutPage', name: 'Quiénes somos — disco.', url: abs('nosotros.html'), about: { '@id': ORG }, mainEntity: [LUNA, BRUNO] },
        crumbs(['Nosotros', 'nosotros.html']),
      ];
    case 'contacto.html':
      return [
        { '@context': 'https://schema.org', '@type': 'ContactPage', name: 'Contacto — disco.', url: abs('contacto.html'), about: { '@id': ORG } },
        crumbs(['Contacto', 'contacto.html']),
        ...faq(),
      ];
    default: {
      const pr = projects.find((p) => p.file === page);
      if (!pr) return [];
      const w = pr.work;
      const photos = (w.media || []).filter((m) => m.type === 'img').slice(0, 6);
      return [
        {
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: w.title,
          headline: pr.meta.title,
          description: w.project.tagline,
          url: abs(page),
          inLanguage: 'es-ES',
          dateCreated: String(w.year),
          locationCreated: { '@type': 'Place', name: 'Madrid' },
          creator: { '@id': ORG },
          image: photos.map((m) => ({ '@type': 'ImageObject', contentUrl: abs(m.src), width: m.w, height: m.h, caption: m.alt })),
          ...(w.project.reels?.length ? { video: w.project.reels.map((r) => video(r, `${w.title}: ${r.title}`, r.alt)) } : {}),
        },
        crumbs(['Portfolio', 'portfolio.html'], [w.title, page]),
      ];
    }
  }
}

// campos obligatorios (los que pide Google para cada tipo): avisa de lo que falte
const NEED = {
  BreadcrumbList: ['itemListElement'], ListItem: ['position', 'name'], FAQPage: ['mainEntity'], Question: ['name', 'acceptedAnswer'],
  Answer: ['text'], VideoObject: ['name', 'thumbnailUrl', 'uploadDate', 'description', 'contentUrl', 'duration'], ImageObject: ['contentUrl'],
  ProfessionalService: ['name', 'address'], Person: ['name'], CreativeWork: ['name'], ItemList: ['itemListElement'], AboutPage: ['name'], ContactPage: ['name'], WebSite: ['name', 'url'],
};
export function validate(page, items) {
  const warn = [];
  const walk = (o, path) => {
    if (Array.isArray(o)) return o.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (!o || typeof o !== 'object') return;
    const t = o['@type'];
    const ref = o['@id'] && Object.keys(o).length < 5; // (una referencia a la empresa, no la empresa)
    if (t && !ref) for (const k of NEED[t] || []) if (o[k] === undefined || o[k] === '' || (Array.isArray(o[k]) && !o[k].length)) warn.push(`${page} ${path} ${t}: falta ${k}`);
    if (t === 'ListItem' && !o.item && !o.url) warn.push(`${page} ${path} ListItem: falta item/url`);
    for (const [k, v] of Object.entries(o)) if (typeof v === 'object') walk(v, `${path}.${k}`);
    for (const [k, v] of Object.entries(o)) if (typeof v === 'string' && /\[(?!DOMINIO\])[^\]]*\]/.test(v)) warn.push(`${page} ${path}.${k}: texto por confirmar «${v.slice(0, 60)}»`);
  };
  items.forEach((o, i) => { JSON.parse(JSON.stringify(o)); walk(o, `#${i}`); });
  return warn;
}
