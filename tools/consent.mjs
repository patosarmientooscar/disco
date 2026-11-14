// Consentimiento de cookies en el <head> (BE): node tools/consent.mjs
// Pone tools/consent-head.html (Consent Mode v2 + GTM + el aviso) como lo PRIMERO dentro del <head> de cada .html de la
// raíz que tenga <head> (también proyecto.html, la plantilla de tools/proyectos.mjs: así los proyecto-*.html lo
// heredan al regenerarse). Quita el bloque anterior (y el GTM suelto de antes de BE) y lo vuelve a poner entero: se
// puede ejecutar las veces que haga falta. Lo llama tools/site.mjs al empezar (y este, tools/version.mjs).
// El bloque: Consent Mode v2 con todo denegado por defecto ANTES de que cargue GTM; ads_* siempre denegado (la web no
// hace publicidad). Si ya aceptó la analítica (localStorage disco_consent con v 1 y de hace < 12 meses: la misma regla
// que js/consent.js), se concede ahí mismo, antes de gtm.js. Luego el evento 'gtm.js' del fragmento oficial de GTM (sin
// él no se dispara el activador "Todas las páginas": GA4 no enviaba nada) y el aviso: js/consent.js + css/consent.css.
// El <meta charset> va delante del bloque (tiene que quedar en los primeros 1024 bytes de la página).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHARSET = /[ \t]*<meta charset="utf-8">\r?\n/i;
const BLOCK = /[ \t]*<!-- consent:head[\s\S]*?<!-- \/consent:head -->\r?\n/;
// el GTM de antes (f7d8425): el <script async gtm.js> y el gtag('js') suelto de detrás
const OLD_GTM = /[ \t]*<script async src="https:\/\/www\.googletagmanager\.com\/gtm\.js\?id=[^"]+"><\/script>\r?\n(?:[ \t]*<script>\s*window\.dataLayer = window\.dataLayer \|\| \[\];\s*function gtag\(\)\{dataLayer\.push\(arguments\);\}\s*gtag\('js', new Date\(\)\);\s*<\/script>\r?\n)?/;

export function applyConsent({ quiet = false } = {}) {
  const snippet = readFileSync(join(ROOT, 'tools/consent-head.html'), 'utf8').replace(/\r\n/g, '\n');
  const done = [];
  for (const page of readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort()) {
    const file = join(ROOT, page);
    const html = readFileSync(file, 'utf8');
    const head = html.match(/<head>(\r?\n)/);
    if (!head) continue; // (el archivo de verificación de Google: sin <head>, no se toca)
    const eol = head[1];
    // (el <meta charset> va primero, en el propio bloque: se quita de donde estuviera)
    const clean = html.replace(CHARSET, '').replace(BLOCK, '').replace(OLD_GTM, '');
    const out = clean.replace(head[0], head[0] + snippet.replace(/\n/g, eol));
    if (out !== html) writeFileSync(file, out);
    done.push(page);
  }
  if (!quiet) console.log(`consent:head en ${done.length} páginas`);
  return done;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) applyConsent();
