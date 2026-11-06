// SEO de la web en UN sitio: node tools/site.mjs (lo llama tools/version.mjs antes de versionar; AS).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// EL DÍA QUE HAYA DOMINIO: cambia esta línea (sin barra final) y ejecuta `node tools/version.mjs`. Nada más.
export const SITE_URL = ''; // p. ej. 'https://disco.es'
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Mientras esté vacía, todo sigue con el marcador https://[DOMINIO]: canonical y og:url van comentados en cada página,
// la línea Sitemap de robots.txt también, y el sitemap y el JSON-LD llevan el marcador.
// Lo que hace, en cada página de la raíz (*.html):
//   · reescribe el bloque <!-- seo (tools/site.mjs) --> … <!-- /seo -->: <title>, description, robots, canonical,
//     og:* y twitter:* (los textos, en PAGES; las páginas de proyecto, de js/portfolio-data.js);
//   · reescribe el bloque <!-- seo:ld --> … <!-- /seo:ld -->: los datos estructurados (JSON-LD, tools/seo-ld.mjs);
//   · sitemap.xml (solo las páginas indexables, con <lastmod> = fecha del último commit de cada una) y robots.txt.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BASE = SITE_URL || 'https://[DOMINIO]';
export const abs = (path) => `${BASE}/${path.replace(/^\.?\//, '').replace(/^index\.html$/, '')}`;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const OG = { src: 'assets/brand/og.jpg', w: 1200, h: 630, alt: 'disco. — foto, vídeo y edición en Madrid' };

// title (≤ 60), description (≤ 155), la imagen para compartir (1200×630) y si se indexa
export const PAGES = {
  'index.html': { title: 'Productora audiovisual en Madrid · Foto y vídeo — disco.', description: 'Productora audiovisual en Madrid: foto, vídeo y edición para restaurantes, bares, discotecas, eventos y marcas. Contenido con ritmo para tus redes.' },
  'servicios.html': { title: 'Foto, vídeo y edición para negocios en Madrid — disco.', description: 'Fotografía, vídeo y edición en Madrid para restaurantes, locales, eventos y marcas: de la idea a la entrega con un solo equipo. Mira cómo trabajamos.', image: { src: 'assets/og/servicios.jpg', w: 1200, h: 630, alt: 'Chico sin camiseta jugando al pádel contra un cielo azul' } },
  'portfolio.html': { title: 'Portfolio de foto y vídeo en Madrid — disco.', description: 'Proyectos reales de foto y vídeo en Madrid: fiestas, noches y marcas contadas en reels y fotos editadas. Mira lo que hemos rodado y cómo lo contamos.', image: { src: 'assets/og/portfolio.jpg', w: 1200, h: 630, alt: 'Chico con la camiseta naranja de Cachondeo Group abrazado a dos amigas en la fiesta' } },
  'nosotros.html': { title: 'Productora de foto y vídeo en Madrid: quiénes somos — disco.', description: 'Somos disco., productora de foto y vídeo en Madrid. Luna López y Bruno Marín: dirección, rodaje y edición con el mismo equipo, de la idea a la entrega.', image: { src: 'assets/og/nosotros.jpg', w: 1200, h: 630, alt: 'Luna López, cofundadora de disco., sonriendo de perfil en blanco y negro' } },
  'contacto.html': { title: 'Pide presupuesto de foto y vídeo en Madrid — disco.', description: 'Cuéntanos qué necesita tu negocio y te mandamos una propuesta clara de foto, vídeo o edición en Madrid. Escríbenos: te respondemos muy pronto.', image: { src: 'assets/og/contacto.jpg', w: 1200, h: 630, alt: 'Dos chicas cantando con un micrófono en una fiesta de Cachondeo Group' } },
  'aviso-legal.html': { title: 'Aviso legal — disco.', description: 'Aviso legal de disco., productora de foto y vídeo en Madrid: titular, condiciones de uso y propiedad intelectual.', noindex: true },
  'privacidad.html': { title: 'Política de privacidad — disco.', description: 'Cómo trata disco. tus datos cuando nos escribes o usas el formulario de contacto, y cómo ejercer tus derechos.', noindex: true },
  'cookies.html': { title: 'Política de cookies — disco.', description: 'disco. no usa cookies de analítica ni de terceros. Te explicamos qué guarda la web en tu navegador y por qué.', noindex: true },
  '404.html': { title: 'Corte en negro — disco.', description: 'Esta toma no existe. Vuelve al inicio de disco.', noindex: true },
  // (la plantilla vieja: solo redirige a la página de cada proyecto)
  'proyecto.html': { title: 'Proyecto — disco.', description: 'Un proyecto de disco., productora de foto y vídeo en Madrid.', noindex: true },
};
// orden y prioridad del sitemap
const ORDER = ['index.html', 'servicios.html', 'portfolio.html', 'contacto.html', 'nosotros.html'];
const PRIORITY = { 'index.html': '1.0', 'servicios.html': '0.9', 'contacto.html': '0.9', 'portfolio.html': '0.8', 'nosotros.html': '0.7' };

// el bloque de la cabecera
export function headBlock(page, m) {
  const img = m.image || OG;
  const imgUrl = SITE_URL ? abs(img.src) : img.src;
  const url = abs(page);
  const robots = m.noindex ? '\n  <meta name="robots" content="noindex, follow">' : '';
  const canon = SITE_URL
    ? `  <link rel="canonical" href="${url}">\n  <meta property="og:url" content="${url}">`
    : `  <!-- canonical y og:url: se activan solos al poner SITE_URL en tools/site.mjs
  <link rel="canonical" href="${url}">
  <meta property="og:url" content="${url}">
  -->`;
  return `<!-- seo (tools/site.mjs: no editar a mano) -->
  <title>${esc(m.title)}</title>
  <meta name="description" content="${esc(m.description)}">${robots}
${canon}
  <meta property="og:type" content="${m.ogType || 'website'}">
  <meta property="og:locale" content="es_ES">
  <meta property="og:site_name" content="disco.">
  <meta property="og:title" content="${esc(m.title)}">
  <meta property="og:description" content="${esc(m.description)}">
  <meta property="og:image" content="${esc(imgUrl)}">
  <meta property="og:image:width" content="${img.w}">
  <meta property="og:image:height" content="${img.h}">
  <meta property="og:image:alt" content="${esc(img.alt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(m.title)}">
  <meta name="twitter:description" content="${esc(m.description)}">
  <meta name="twitter:image" content="${esc(imgUrl)}">
  <meta name="twitter:image:alt" content="${esc(img.alt)}">
  <!-- /seo -->`;
}

// quita lo que había antes del bloque (la primera vez) y pone el bloque después del viewport
function putHead(html, block) {
  if (html.includes('<!-- seo (tools/site.mjs')) return html.replace(/<!-- seo \(tools\/site\.mjs[\s\S]*?<!-- \/seo -->/, block);
  html = html
    .replace(/[ \t]*<title>[\s\S]*?<\/title>\r?\n/, '')
    .replace(/[ \t]*<meta name="description"[^>]*>\r?\n/, '')
    .replace(/[ \t]*<meta name="robots"[^>]*>\r?\n/, '')
    .replace(/[ \t]*<!-- canonical y og:url:[\s\S]*?-->\r?\n/, '')
    .replace(/[ \t]*<link rel="canonical"[^>]*>\r?\n/g, '')
    .replace(/[ \t]*<meta (?:property="og:|name="twitter:)[^>]*>\r?\n/g, '');
  return html.replace(/(<meta name="viewport"[^>]*>\r?\n)/, `$1  ${block}\n`);
}
// el bloque de datos estructurados: antes de </head>
export function putLd(html, items) {
  const body = items.length
    ? items.map((o) => `  <script type="application/ld+json">\n${JSON.stringify(o, null, 2).replace(/^/gm, '  ')}\n  </script>`).join('\n')
    : '';
  const block = `<!-- seo:ld (tools/site.mjs: no editar a mano) -->\n${body}\n  <!-- /seo:ld -->`;
  if (html.includes('<!-- seo:ld')) return html.replace(/<!-- seo:ld[\s\S]*?<!-- \/seo:ld -->/, block);
  return html.replace(/([ \t]*)<\/head>/, `  ${block}\n$1</head>`);
}

const git = (cmd) => { try { return execSync(`git ${cmd}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
const lastmod = (file) => git(`log -1 --format=%cs -- "${file}"`) || statSync(join(ROOT, file)).mtime.toISOString().slice(0, 10);

export async function buildSite({ quiet = false } = {}) {
  // las páginas de proyecto (tools/proyectos.mjs) y los datos estructurados (tools/seo-ld.mjs), si existen
  const extra = existsSync(join(ROOT, 'tools/proyectos.mjs')) ? await import(pathToFileURL(join(ROOT, 'tools/proyectos.mjs')).href) : null;
  const projects = extra ? await extra.buildProjects({ headBlock, putLd, abs }) : [];
  const ld = existsSync(join(ROOT, 'tools/seo-ld.mjs')) ? await import(pathToFileURL(join(ROOT, 'tools/seo-ld.mjs')).href) : null;
  const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
  for (const page of pages) {
    const m = PAGES[page] || projects.find((p) => p.file === page)?.meta;
    if (!m) { if (!quiet) console.log(`${page}: sin datos SEO (se deja igual)`); continue; }
    const file = join(ROOT, page);
    let html = readFileSync(file, 'utf8');
    html = putHead(html, headBlock(page, m));
    if (ld) {
      // (cada vez: fuera el bloque anterior y cualquier JSON-LD suelto; el bloque se vuelve a poner entero)
      html = html
        .replace(/[ \t]*<!-- seo:ld[\s\S]*?<!-- \/seo:ld -->(?:\r?\n)?/, '')
        .replace(/[ \t]*<!-- datos de la empresa[^\n]*?-->\r?\n/, '')
        .replace(/[ \t]*<script type="application\/ld\+json">[\s\S]*?<\/script>\r?\n/g, '');
      const items = await ld.ldFor(page, { html, abs, BASE, projects });
      ld.validate(page, items).forEach((w) => console.warn(`  aviso JSON-LD: ${w}`));
      html = putLd(html, items);
    }
    writeFileSync(file, html);
  }
  // sitemap.xml: las indexables, en orden (y después los proyectos)
  const index = [...ORDER, ...projects.map((p) => p.file)].filter((p) => existsSync(join(ROOT, p)) && !(PAGES[p]?.noindex));
  const urls = index.map((p) => `  <url><loc>${abs(p)}</loc><lastmod>${lastmod(p)}</lastmod><priority>${PRIORITY[p] || '0.7'}</priority></url>`).join('\n');
  writeFileSync(join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<!-- generado por tools/site.mjs (no editar a mano): el dominio, en SITE_URL -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`);
  writeFileSync(join(ROOT, 'robots.txt'), `# disco. — generado por tools/site.mjs (no editar a mano): el dominio, en SITE_URL
User-agent: *
Allow: /
Disallow: /legacy/
Disallow: /docs/
Disallow: /tools/

${SITE_URL ? '' : '# (se activa al poner SITE_URL en tools/site.mjs)\n# '}Sitemap: ${abs('sitemap.xml')}
`);
  if (!quiet) console.log(`SEO: ${pages.length} páginas · sitemap con ${index.length} URL · dominio ${SITE_URL || '(marcador [DOMINIO])'}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await buildSite();
