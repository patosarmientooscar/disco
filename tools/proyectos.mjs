// Las páginas de proyecto (AS-C): una por trabajo de js/portfolio-data.js con `project`, en la raíz:
// proyecto-<slug>.html. Plantilla: proyecto.html (su cabecera, estilos y scripts); en su <main data-project>, el
// contenido del proyecto YA EN EL HTML (js/proyecto-render.js: título, frase, ficha, encargo / idea / resultado, reels,
// la secuencia y todas las fotos con su alt), para que Google lo lea sin ejecutar JS. js/proyecto.js anima encima.
// Lo llama tools/site.mjs (y este, tools/version.mjs): un proyecto nuevo es añadirlo a portfolio-data.js y ejecutar
// `node tools/version.mjs`. Las páginas de proyectos que ya no existan, se borran.
import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = (p) => import(pathToFileURL(join(ROOT, p)).href);

export async function buildProjects() {
  const { works } = await mod('js/portfolio-data.js');
  const { renderProject, projectUrl } = await mod('js/proyecto-render.js');
  const tpl = readFileSync(join(ROOT, 'proyecto.html'), 'utf8');
  const EMPTY = /<main id="contenido" class="ip pj" data-project[^>]*>[\s\S]*?<\/main>/;
  if (!EMPTY.test(tpl)) throw new Error('proyecto.html: no encuentro <main data-project>');
  const list = works.filter((w) => w.project);
  const out = [];
  for (const w of list) {
    const file = projectUrl(w.slug);
    const { html } = renderProject(w, { works: list });
    const page = tpl.replace(EMPTY, `<main id="contenido" class="ip pj" data-project data-slug="${w.slug}">${html}\n  </main>`);
    writeFileSync(join(ROOT, file), page);
    const type = w.seo?.type || (w.project.facts.find(([k]) => k === 'Tipo')?.[1] || 'proyecto').toLowerCase();
    const photos = (w.media || []).filter((m) => m.type === 'img');
    // la imagen para compartir (1200×630, de la portada), si aún no está: con ffmpeg (si no hay, se avisa)
    const og = `assets/og/proyecto-${w.slug}.jpg`;
    if (!existsSync(join(ROOT, og)) && photos[0]) {
      try { execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(ROOT, w.coverLarge || photos[0].src), '-vf', 'scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630', '-q:v', '3', join(ROOT, og)]); }
      catch { console.warn(`${og}: no se ha podido crear (¿ffmpeg?); hazla de 1200×630 a mano`); }
    }
    out.push({
      file,
      work: w,
      meta: {
        title: `${w.title}: ${type} en Madrid — disco.`,
        description: w.seo?.description || w.project.tagline,
        ogType: 'article',
        image: { src: og, w: 1200, h: 630, alt: photos[0]?.alt || w.title },
      },
    });
  }
  // las de proyectos que ya no están en los datos
  const keep = new Set(out.map((p) => p.file));
  for (const f of readdirSync(ROOT)) if (/^proyecto-.+\.html$/.test(f) && !keep.has(f)) unlinkSync(join(ROOT, f));
  return out;
}
