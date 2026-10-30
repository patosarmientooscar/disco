// Cache-busting: node tools/version.mjs  (antes de publicar; ver PENDIENTES.md → Hosting)
// GitHub Pages sirve css/ y js/ con 10 min de caché y sin versión en el nombre: tras publicar, un navegador podía
// juntar el HTML nuevo con un CSS o un JS viejo (la página se ve rota). Este script pone ?v=<versión> en todo lo que
// enlazan las páginas (*.html de la raíz):
//   · <link href="css/….css">, <script src="js/….js">, <link rel="modulepreload" href="js/….js">;
//   · los import entre módulos (import './core.js', import('./star.js')…), con el import map de cada página: cada
//     "./js/x.js" apunta a "./js/x.js?v=…". El import map va en el <head>, antes de cualquier módulo.
// La versión es el hash corto del último commit (git rev-parse --short HEAD) más, si css/ o js/ tienen cambios sin
// commit, un hash de su contenido: así nunca se repite con archivos distintos. Se puede ejecutar las veces que haga
// falta (sustituye la versión anterior).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const list = (dir, ext) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(ext)).sort();
const css = list('css', '.css');
const js = list('js', '.js');

const git = (cmd) => { try { return execSync(`git ${cmd}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
let version = git('rev-parse --short HEAD') || 'dev';
if (git('status --porcelain -- css js')) {
  const h = createHash('sha1');
  for (const f of css) h.update(readFileSync(join(ROOT, 'css', f)));
  for (const f of js) h.update(readFileSync(join(ROOT, 'js', f)));
  version += `-${h.digest('hex').slice(0, 6)}`;
}

const THREE = {
  three: 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js',
  'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/',
};

for (const page of list('.', '.html')) {
  const file = join(ROOT, page);
  let html = readFileSync(file, 'utf8');
  // 1) ?v= en los enlaces a css/ y js/
  html = html.replace(/((?:href|src)=")((?:css|js)\/[^"?#]+\.(?:css|js))(?:\?v=[^"]*)?"/g, `$1$2?v=${version}"`);
  // 2) el import map: se quita donde esté y se pone en el <head> (antes del primer módulo), con three y los módulos
  const old = html.match(/(?:[ \t]*<!-- versiones \(tools\/version\.mjs\)[^\n]*\n)?[ \t]*<script type="importmap">([\s\S]*?)<\/script>\n?/);
  let imports = { ...THREE };
  if (old) {
    try { imports = { ...JSON.parse(old[1]).imports, ...imports }; } catch { /* se rehace */ }
    html = html.replace(old[0], '');
  }
  for (const k of Object.keys(imports)) if (k.startsWith('./js/')) delete imports[k];
  for (const f of js) imports[`./js/${f}`] = `./js/${f}?v=${version}`;
  const body = Object.entries(imports).map(([k, v]) => `      ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
  const map = `  <!-- versiones (tools/version.mjs): three y cada módulo de js/ con ?v=, también en sus import entre ellos -->\n  <script type="importmap">\n    { "imports": {\n${body}\n    } }\n  </script>\n`;
  const at = html.search(/[ \t]*<link rel="modulepreload"|[ \t]*<script type="module"/);
  const head = html.indexOf('</head>');
  const pos = at >= 0 && at < head ? at : head;
  html = html.slice(0, pos) + map + html.slice(pos);
  writeFileSync(file, html);
  console.log(`${page}: v=${version}`);
}
