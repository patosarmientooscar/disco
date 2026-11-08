// AR-B: el destello pasa POR ENCIMA de fotos y vídeos, pero con calma: cuando su objetivo cae encima de una imagen
// grande en pantalla, se desvía un poco (como mucho DODGE.max del ancho de pantalla, alejándose del centro de la
// imagen) con un lerp lento por tiempo (DODGE.k por segundo). El desvío se SUMA AL OBJETIVO (nunca a la posición
// final): el filtro de cada destello lo suaviza otra vez; nada de saltos. Rectángulos cacheados en coordenadas de la
// página al cargar, en resize y en cada refresh de ScrollTrigger (sin leer el layout en cada fotograma).
// Los heros (donde vive el destello encima de su vídeo) no cuentan.
import { vp } from './viewport.js';
const DODGE = { max: 0.03, k: 1.2, minArea: 0.12, depth: 0.18 };
const SKIP = '.hero, .pgh, [data-nh], [data-page-hero], [data-star-hero], .fin, nav, dialog';

export function createDodge({ ScrollTrigger } = {}) {
  let rects = [];
  const measure = () => {
    const W = vp.w;
    const H = vp.h;
    const sy = scrollY;
    rects = [...document.querySelectorAll('main img, main video')]
      .filter((el) => !el.closest(SKIP))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { l: r.left, t: r.top + sy, w: r.width, h: r.height };
      })
      .filter((r) => r.w * r.h >= DODGE.minArea * W * H * 0.5 && r.w > 0.2 * W);
  };
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  ScrollTrigger?.addEventListener('refresh', measure);
  const off = { x: 0, y: 0 };
  return {
    // px: el objetivo en pantalla (px); scroll: el de la página (px); dt: s; weight: 0–1 (0 = no desviarse: paradas
    // fijas, arrastre, footer). Devuelve el desvío suavizado (px)
    step(px, py, scroll, dt, weight = 1) {
      const W = vp.w;
      const H = vp.h;
      let wx = 0;
      let wy = 0;
      let best = 0;
      if (weight > 0.001) {
        for (const r of rects) {
          const top = r.t - scroll;
          if (top > H || top + r.h < 0 || r.w * Math.min(r.h, H) < DODGE.minArea * W * H) continue;
          if (px < r.l || px > r.l + r.w || py < top || py > top + r.h) continue;
          // cuánto está dentro (0 en el borde → 1 a DODGE.depth del lado más corto)
          const edge = Math.min(px - r.l, r.l + r.w - px, py - top, top + r.h - py);
          const depth = Math.min(1, edge / (DODGE.depth * Math.min(r.w, r.h)));
          const cx = r.l + r.w / 2;
          const cy = top + r.h / 2;
          let dx = px - cx;
          let dy = (py - cy) * 0.5; // sobre todo en horizontal
          const d = Math.hypot(dx, dy);
          if (d < 1) { dx = px < W / 2 ? -1 : 1; dy = 0; } else { dx /= d; dy /= d; }
          const m = depth * depth * (3 - 2 * depth);
          if (m > best) { best = m; wx = dx * m; wy = dy * m; }
        }
      }
      const a = 1 - Math.exp(-DODGE.k * dt);
      off.x += (wx * DODGE.max * W * weight - off.x) * a;
      off.y += (wy * DODGE.max * W * weight - off.y) * a;
      return off;
    },
    measure,
  };
}
