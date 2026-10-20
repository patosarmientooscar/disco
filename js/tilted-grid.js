/*
 * tilted-grid.js — disco.es
 * Port a JavaScript puro (sin React, sin TypeScript, sin npm) del componente
 * TiltedGridHero de 21st.dev: una fila de imágenes que fluye de derecha a
 * izquierda por el interior de un cilindro. El centro mira de frente, los
 * extremos se curvan hacia ti y se desvanecen.
 *
 * Todo el movimiento es CSS (transform en el compositor). Este archivo NO
 * usa requestAnimationFrame: solo un ResizeObserver y el evento
 * animationiteration para cambiar la imagen de cada tile cuando sale de vista.
 *
 * Uso:
 *   import { createTiltedGrid } from './tilted-grid.js';
 *   const grid = createTiltedGrid(document.querySelector('#hero-main'), {
 *     images: [{ src: 'assets/hero/01.webp', alt: '...' }, ...],
 *   });
 *   // grid.pause() / grid.play() / grid.destroy()
 *
 * El host debe tener alto definido (p. ej. 100vh). El contenido del host
 * (título, CTA...) queda por encima de la banda: dale position:relative y
 * z-index:1.
 */

const SLICES = 16;
const CAMERA = 1.6;
const MAX_WIDTH = 55;
// Solape entre tiras (px). El original usaba 1px y en GPUs reales deja
// líneas verticales finas entre tiras. Cada tira se extiende OVERLAP px a
// cada lado: en un cilindro visto por dentro esa extensión queda detrás de
// la tira vecina, así que tapa la rendija sin verse.
const OVERLAP = 2;

const DEFAULTS = {
  images: [],
  speed: 4, // segundos para avanzar un tile
  tileHeight: 26, // % del alto del host
  aspectRatio: 16 / 9,
  gap: 6, // % del alto de un tile
  axis: 56, // centro vertical de la fila, % del alto
  curve: 80, // grados de curvatura en el borde (5–85)
  fade: 12, // % del ancho para el desvanecido de cada extremo
  radius: 8, // px de redondeo de los extremos del tile
  tileBackground: 'rgba(7,7,10,0.08)', // color del tile mientras carga la imagen
};

let instanceCount = 0;

function arc(bend) {
  return (CAMERA - 1 + Math.cos(bend)) / (2 * CAMERA * Math.sin(bend));
}

function measure(width, height, tile, aspect, gap, bend) {
  const h = Math.min((tile / 100) * height, ((MAX_WIDTH / 100) * width) / aspect);
  const radius = width * arc(bend);
  if (!(h > 0) || !(radius > 0)) return { columns: 2, sweep: 0, unit: 0, limit: 0 };
  const deg = (rad) => (rad * 180) / Math.PI;
  const unit = deg(h / radius);
  const pitch = (aspect + gap / 100) * unit;
  const limit = deg(bend) + (aspect * unit) / 2;
  const columns = Math.min(60, Math.max(2, Math.ceil((2 * limit) / pitch)));
  const round = (n) => +n.toFixed(4);
  const sweep = round((columns * pitch) / 2);
  return { columns, sweep, unit: round(unit), limit: round(Math.min(sweep, limit)) };
}

export function createTiltedGrid(host, userOptions = {}) {
  const o = { ...DEFAULTS, ...userOptions };
  const id = `dg${++instanceCount}`;
  const orbit = `tgh-o-${id}`;
  const tileClass = `tgh-t-${id}`;
  const bend = (Math.min(85, Math.max(5, o.curve)) * Math.PI) / 180;
  const images = o.images.slice();

  // El host necesita container-type:size para las unidades cqw/cqh.
  const cs = getComputedStyle(host);
  if (cs.position === 'static') host.style.position = 'relative';
  host.style.overflow = 'hidden';
  host.style.containerType = 'size';

  const style = document.createElement('style');
  const band = document.createElement('div');
  band.setAttribute('aria-hidden', 'true');
  band.className = 'tilted-grid';
  band.style.cssText =
    'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .5s;z-index:0;';
  host.prepend(band);
  host.prepend(style);

  // Precarga todas las imágenes: un tile coge la siguiente justo antes de volver a verse.
  for (const { src } of images) new Image().src = src;

  const u = (n) =>
    `calc(${+n.toFixed(4)} * min(${o.tileHeight}cqh, ${+(MAX_WIDTH / o.aspectRatio).toFixed(4)}cqw))`;
  const r = 100 * arc(bend);
  const radius = `${+r.toFixed(3)}cqw`;
  const turn = (deg) =>
    `translateZ(${radius}) rotateY(${+deg.toFixed(4)}deg) translateZ(-${radius})`;

  const mask = `linear-gradient(90deg,transparent,#000 ${o.fade}%,#000 ${100 - o.fade}%,transparent)`;
  band.style.perspective = `${+(r * CAMERA).toFixed(3)}cqw`;
  band.style.perspectiveOrigin = `50% ${o.axis}%`;
  band.style.maskImage = mask;
  band.style.webkitMaskImage = mask;

  let layout = null;
  let tiles = []; // [{ el, strips: HTMLElement[], index }]

  const imageFor = (n) => images[((n % images.length) + images.length) % images.length];

  // Cada tira pinta su trozo de foto como background-image (sin <img> ni
  // overflow:hidden): una sola capa por tira, sin bordes recortados que el
  // navegador tenga que suavizar.
  const setTileImage = (tile, n) => {
    if (!images.length || tile.index === n) return;
    tile.index = n;
    const url = `url("${imageFor(n).src.replace(/"/g, '\\"')}")`;
    tile.strips.forEach((el) => (el.style.backgroundImage = url));
  };

  const build = () => {
    const { columns, sweep, unit, limit } = layout;
    const hide = +(((sweep - limit) / (2 * sweep || 1)) * 100).toFixed(4);
    style.textContent =
      `@keyframes ${orbit}{` +
      `from{transform:${turn(-sweep)}}to{transform:${turn(sweep)}}` +
      `0%,${hide}%,${100 - hide}%,100%{visibility:hidden}` +
      `${hide + 0.001}%,${100 - hide - 0.001}%{visibility:visible}}` +
      `@media(prefers-reduced-motion:reduce){.${tileClass}{animation-play-state:paused!important}}`;

    band.textContent = '';
    tiles = [];
    const share = o.aspectRatio / SLICES;
    const duration = columns * o.speed;

    for (let t = 0; t < columns; t++) {
      const first = columns - 1 - t;
      const el = document.createElement('div');
      el.className = tileClass;
      el.style.cssText =
        `position:absolute;left:calc(50% - ${u(o.aspectRatio / 2)});` +
        `top:calc(${o.axis}% - ${u(0.5)});width:${u(o.aspectRatio)};height:${u(1)};` +
        `transform-style:preserve-3d;animation:${orbit} ${duration}s linear ${-t * o.speed}s infinite;`;

      const tile = { el, strips: [], index: -1 };
      for (let k = 0; k < SLICES; k++) {
        const strip = document.createElement('div');
        const first = k === 0;
        const last = k === SLICES - 1;
        // La primera tira no se extiende a la izquierda ni la última a la
        // derecha (son el borde real de la foto).
        const padL = first ? 0 : OVERLAP;
        const padR = last ? 0 : OVERLAP;
        const radiusCss = first
          ? `border-radius:${o.radius}px 0 0 ${o.radius}px;`
          : last
            ? `border-radius:0 ${o.radius}px ${o.radius}px 0;`
            : '';
        strip.style.cssText =
          `position:absolute;top:0;${radiusCss}` +
          `background-color:${o.tileBackground};background-repeat:no-repeat;` +
          `background-size:${u(o.aspectRatio)} ${u(1)};` +
          `background-position:calc(${u(-k * share)} + ${padL}px) 0;` +
          `left:calc(${u((o.aspectRatio - share) / 2)} - ${padL}px);` +
          `width:calc(${u(share)} + ${padL + padR}px);height:${u(1)};` +
          `backface-visibility:hidden;-webkit-backface-visibility:hidden;` +
          `transform-origin:calc(50% + ${(padL - padR) / 2}px) 50%;` +
          `transform:${turn((o.aspectRatio / 2 - (k + 0.5) * share) * unit)};`;
        el.append(strip);
        tile.strips.push(strip);
      }

      // Cuando el tile da la vuelta (fuera de vista) recibe su siguiente imagen.
      el.addEventListener('animationiteration', (e) => {
        if (e.target !== el) return;
        const lap = Math.round(e.elapsedTime / duration);
        setTileImage(tile, lap * columns + first);
      });

      setTileImage(tile, first);
      band.append(el);
      tiles.push(tile);
    }
    band.style.opacity = '1';
  };

  const ro = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    const next = measure(width, height, o.tileHeight, o.aspectRatio, o.gap, bend);
    if (layout && layout.columns === next.columns && layout.sweep === next.sweep && layout.unit === next.unit) return;
    layout = next;
    build();
  });
  ro.observe(host);

  const setPlayState = (state) => {
    tiles.forEach((t) => (t.el.style.animationPlayState = state));
  };

  return {
    element: band,
    pause: () => setPlayState('paused'),
    play: () => setPlayState('running'),
    destroy: () => {
      ro.disconnect();
      band.remove();
      style.remove();
    },
  };
}
