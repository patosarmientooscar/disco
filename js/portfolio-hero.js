// Hero de portfolio: la bola de espejos real, etalonada en naranja (el vídeo de js/config.js → pageHeroes.portfolio,
// en dos versiones: horizontal 2560 y vertical, VERSIONS; el hero común, en js/page-hero.js, que elige la versión,
// sin el destello 3D). La bola SIEMPRE gira: el vídeo no se para mientras el hero se ve (js/page-hero.js → always) y
// nunca va por debajo de su velocidad. Sin velos ni fluido: el vídeo, directo (el fluido de antes, en
// legacy/portfolio-fluido.js). Inspirado en el hero de la home:
//   · LOS REFLEJOS SE ESCAPAN (sin pin; la página baja normal): ~140 puntos de luz en un canvas fijo, al principio
//     encima de los puntos del techo del vídeo (sacados de su póster) y, hasta completar, al azar en la mitad de
//     arriba, más densos cerca de la bola. En reposo, tenues (el vídeo se mueve y ellos no); al bajar se encienden, se
//     sueltan y se dispersan hacia los lados y hacia abajo girando alrededor de la bola (los grandes, más rápido:
//     parallax por capas); flotan sobre la sección siguiente y se apagan al 1,4 de pantalla. Con el ratón, parallax
//     (±12 px) y los cercanos al cursor brillan más.
//   · La bola se acerca (escala 1 → 1.18, centrada en ella) y gira más rápido (playbackRate 1 → 1.8 con la velocidad
//     del scroll, siempre con lerp y nunca por debajo de 1); el titular se desliza a la izquierda y se desvanece; el
//     fondo acaba en #0b0909.
// Todo en el loop único (gsap.ticker). Movimiento reducido: la bola gira igual (es el vídeo, no una animación de la
// interfaz) a 0.8, sin acelerar con el scroll; los puntos, quietos sobre ella y sin salida.
// las dos versiones del vídeo (js/config.js; elige js/page-hero.js → root.dataset.heroVersion): tamaño, centro de la
// bola (fracción de la imagen) y radio (del ancho), medidos sobre su póster
const VERSIONS = {
  land: { img: { w: 2560, h: 1440 }, ball: { x: 0.64, y: 0.53, r: 0.156 }, vMax: 0.9 },
  portrait: { img: { w: 1080, h: 1920 }, ball: { x: 0.47, y: 0.42, r: 0.316 }, vMax: 0.72 },
};
const ZOOM = 1.18;
const RATE = { max: 1.8, speed: 30, lerp: 0.06, still: 0.8 }; // playbackRate: 1 + |velocidad de Lenis| / speed (hasta 1.8); reducido: 0.8 fijo
const TITLE = { x: 160, fade: 1.6 };              // px a la izquierda al final de la salida; se va antes de acabar
const DOTS = { n: 140, min: 3, max: 14, aMin: 0.15, aMax: 0.7, parallax: 12, glow: 150, glowGain: 1.4, dpr: 2, dprMob: 1.25 };
// los reflejos, del color del vídeo: núcleo cálido y halo naranja (uno de cada cinco, todo naranja)
const DOT_CORE = '255 214 187';                   // #ffd6bb
const DOT_HALO = '243 84 17';                     // #F35411
// la dispersión, en pantallas de scroll (s): se sueltan, se encienden, giran, se abren, caen y se apagan
const MOVE = { detach: 0.25, wake: 0.12, rest: 0.35, spin: 1.5, spread: 0.3, spreadZ: 0.75, lag: 0.95, fall: 0.5, fallZ: 0.9, fadeFrom: 1, fadeTo: 1.4 };
// los puntos de luz de cada póster (u, v en fracción de la imagen; brillo 0–0.75): máximos locales del brillo fuera
// de la bola × 1.1, a 0.012 como mínimo entre sí, los 110 más brillantes (sacados decodificando el póster en Chromium;
// en el v3 el techo es más oscuro: umbral de brillo 13 en vez de 18, y en horizontal solo salen 96)
VERSIONS.land.spots = [[0.588,0.219,0.75],[0.575,0.144,0.75],[0.566,0.172,0.69],[0.588,0.169,0.61],[0.57,0.231,0.46],[0.578,0.2,0.45],[0.559,0.106,0.41],[0.6,0.194,0.36],[0.716,0.117,0.35],[0.588,0.108,0.35],[0.545,0.133,0.34],[0.55,0.239,0.34],[0.595,0.147,0.34],[0.667,0.206,0.28],[0.531,0.242,0.28],[0.534,0.172,0.27],[0.688,0.075,0.27],[0.556,0.206,0.26],[0.673,0.067,0.25],[0.694,0.044,0.25],[0.698,0.089,0.24],[0.531,0.197,0.23],[0.73,0.158,0.23],[0.673,0.031,0.23],[0.698,0.142,0.22],[0.548,0.261,0.22],[0.731,0.175,0.21],[0.539,0.278,0.21],[0.575,0.069,0.21],[0.653,0.056,0.21],[0.728,0.067,0.2],[0.709,0.056,0.19],[0.741,0.103,0.19],[0.508,0.242,0.19],[0.706,0.178,0.18],[0.652,0.019,0.18],[0.686,0.122,0.18],[0.58,0.186,0.18],[0.533,0.094,0.17],[0.608,0.183,0.17],[0.516,0.172,0.17],[0.519,0.139,0.17],[0.53,0.269,0.16],[0.511,0.206,0.15],[0.611,0.064,0.15],[0.714,0.192,0.15],[0.736,0.194,0.14],[0.67,0.114,0.14],[0.544,0.203,0.13],[0.506,0.317,0.13],[0.614,0.222,0.13],[0.65,0.094,0.12],[0.611,0.117,0.12],[0.692,0.208,0.12],[0.62,0.189,0.12],[0.755,0.158,0.12],[0.506,0.275,0.12],[0.688,0.197,0.12],[0.544,0.044,0.12],[0.683,0.178,0.11],[0.719,0.217,0.11],[0.752,0.144,0.11],[0.717,0.147,0.11],[0.666,0.15,0.11],[0.759,0.186,0.11],[0.6,0.036,0.11],[0.477,0.425,0.1],[0.583,0.236,0.1],[0.486,0.269,0.1],[0.634,0.175,0.1],[0.738,0.236,0.1],[0.762,0.292,0.1],[0.62,0.208,0.1],[0.723,0.247,0.1],[0.647,0.219,0.1],[0.623,0.147,0.1],[0.469,0.386,0.1],[0.681,0.161,0.1],[0.741,0.261,0.1],[0.483,0.311,0.1],[0.541,0.153,0.1],[0.764,0.094,0.09],[0.481,0.344,0.09],[0.664,0.189,0.09],[0.681,0.047,0.09],[0.662,0.169,0.09],[0.741,0.014,0.09],[0.483,0.147,0.09],[0.706,0.206,0.09],[0.625,0.086,0.09],[0.645,0.153,0.09],[0.478,0.233,0.09],[0.764,0.253,0.09],[0.487,0.386,0.09],[0.738,0.139,0.09],[0.456,0.231,0.09]];
VERSIONS.portrait.spots = [[0.341,0.173,0.75],[0.364,0.221,0.65],[0.322,0.192,0.63],[0.364,0.19,0.54],[0.308,0.149,0.48],[0.341,0.211,0.39],[0.367,0.151,0.36],[0.623,0.156,0.36],[0.331,0.23,0.36],[0.389,0.207,0.35],[0.527,0.214,0.35],[0.38,0.175,0.35],[0.28,0.167,0.34],[0.539,0.101,0.32],[0.287,0.231,0.3],[0.537,0.124,0.3],[0.566,0.129,0.3],[0.578,0.11,0.3],[0.497,0.117,0.27],[0.338,0.125,0.26],[0.586,0.139,0.26],[0.302,0.213,0.25],[0.494,0.094,0.25],[0.256,0.191,0.24],[0.613,0.118,0.24],[0.647,0.125,0.24],[0.563,0.069,0.23],[0.598,0.136,0.23],[0.252,0.207,0.22],[0.594,0.078,0.22],[0.252,0.235,0.21],[0.648,0.183,0.21],[0.672,0.146,0.21],[0.255,0.141,0.21],[0.35,0.2,0.21],[0.589,0.175,0.2],[0.416,0.125,0.17],[0.563,0.162,0.17],[0.406,0.198,0.17],[0.22,0.192,0.17],[0.419,0.224,0.17],[0.316,0.208,0.17],[0.286,0.248,0.16],[0.431,0.201,0.16],[0.223,0.169,0.16],[0.603,0.195,0.15],[0.277,0.11,0.15],[0.266,0.258,0.15],[0.211,0.214,0.14],[0.205,0.235,0.14],[0.547,0.16,0.14],[0.491,0.141,0.13],[0.53,0.154,0.13],[0.395,0.104,0.13],[0.495,0.054,0.13],[0.633,0.078,0.12],[0.619,0.204,0.12],[0.275,0.211,0.12],[0.311,0.178,0.11],[0.248,0.253,0.11],[0.327,0.083,0.11],[0.412,0.156,0.11],[0.395,0.225,0.1],[0.358,0.083,0.1],[0.692,0.173,0.1],[0.611,0.043,0.1],[0.673,0.09,0.1],[0.545,0.033,0.09],[0.441,0.084,0.09],[0.662,0.206,0.09],[0.556,0.197,0.09],[0.702,0.183,0.09],[0.563,0.207,0.09],[0.27,0.181,0.08],[0.522,0.178,0.08],[0.2,0.257,0.08],[0.556,0.183,0.08],[0.692,0.117,0.08],[0.237,0.21,0.08],[0.631,0.22,0.08],[0.591,0.102,0.08],[0.536,0.173,0.08],[0.219,0.258,0.08],[0.5,0.178,0.08],[0.58,0.214,0.08],[0.203,0.283,0.08],[0.637,0.05,0.08],[0.719,0.141,0.08],[0.438,0.175,0.08],[0.552,0.116,0.08],[0.434,0.114,0.08],[0.369,0.076,0.08],[0.709,0.199,0.07],[0.166,0.157,0.07],[0.438,0.135,0.07],[0.459,0.192,0.07],[0.192,0.133,0.07],[0.397,0.135,0.07],[0.559,0.149,0.07],[0.433,0.214,0.07],[0.62,0.176,0.07],[0.489,0.223,0.07],[0.666,0.17,0.07],[0.514,0.191,0.07],[0.523,0.14,0.07],[0.375,0.208,0.07],[0.452,0.139,0.07],[0.156,0.177,0.07],[0.67,0.231,0.07],[0.5,0.195,0.07]];

// ============ el hero ============
export function initBallHero({ lenis, loop, reduced }) {
  const root = document.querySelector('[data-page-hero="portfolio"]');
  if (!root) return;
  const stage = root.querySelector('.pgh__stage');
  const look = root.querySelector('.pgh__look');
  const dark = root.querySelector('[data-ball-dark]');
  const block = root.querySelector('.pgh__foot > div');
  const video = look.querySelector('video');
  const still = reduced.matches;
  let ver = VERSIONS[root.dataset.heroVersion] || VERSIONS.land; // horizontal o vertical (js/page-hero.js)

  // ---------- los reflejos ----------
  const canvas = document.createElement('canvas');
  canvas.className = 'ball-dots';
  canvas.setAttribute('aria-hidden', 'true');
  if (still) { canvas.style.position = 'absolute'; stage.querySelector('.pgh__foot').before(canvas); } else document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const sprite = (core, halo) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, `rgb(${core} / 1)`);
    r.addColorStop(0.45, `rgb(${core} / 0.95)`);
    r.addColorStop(0.7, `rgb(${halo} / 0.35)`);
    r.addColorStop(1, `rgb(${halo} / 0)`);
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    return c;
  };
  const warm = sprite(DOT_CORE, DOT_HALO);
  const orange = sprite(DOT_HALO, DOT_HALO);
  let dots = makeDots(ver);
  const view = { w: 1, h: 1, dpr: 1, k: 1 };
  const resize = () => {
    const mob = matchMedia('(max-width: 767px)').matches;
    view.dpr = Math.min(devicePixelRatio || 1, mob ? DOTS.dprMob : DOTS.dpr);
    view.w = still ? stage.clientWidth : innerWidth;
    view.h = still ? stage.clientHeight : innerHeight;
    view.k = Math.min(1.3, Math.max(0.7, innerWidth / 1440));
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
    if (still) { canvas.style.width = `${view.w}px`; canvas.style.height = `${view.h}px`; }
    dirty = true;
  };
  let dirty = true;
  resize();
  window.addEventListener('resize', resize);

  // dónde cae un punto de la imagen (0–1) en pantalla: el vídeo cubre su caja (object-fit: cover)
  const cover = { x: 0, y: 0, w: 1, h: 1 };
  const measure = () => {
    const r = look.getBoundingClientRect();
    const s = Math.max(r.width / ver.img.w, r.height / ver.img.h);
    cover.w = ver.img.w * s;
    cover.h = ver.img.h * s;
    // con su object-position (el centro de la bola: js/config.js → pos)
    const [px, py] = getComputedStyle(look.querySelector('video, img')).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
    cover.x = r.left + (r.width - cover.w) * (Number.isFinite(px) ? px : 0.5);
    cover.y = r.top + (r.height - cover.h) * (Number.isFinite(py) ? py : 0.5);
    if (still) { const sr = stage.getBoundingClientRect(); cover.x -= sr.left; cover.y -= sr.top; }
    return r;
  };
  // el centro de la bola, para el zoom (en % de la caja del vídeo)
  const origin = () => {
    const r = measure();
    look.style.setProperty('--ball-x', `${(((cover.x + ver.ball.x * cover.w - r.left) / r.width) * 100).toFixed(2)}%`);
    look.style.setProperty('--ball-y', `${(((cover.y + ver.ball.y * cover.h - r.top) / r.height) * 100).toFixed(2)}%`);
  };

  // ratón: parallax de los puntos y los cercanos brillan más
  const mouse = { x: -9999, y: -9999, mx: 0, my: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  const draw = (s, time) => {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    ctx.globalCompositeOperation = 'lighter';
    const H = view.h;
    const cx0 = cover.x + ver.ball.x * cover.w;
    const cy0 = cover.y + ver.ball.y * cover.h;
    const k = smooth(0, MOVE.detach, s);                 // 0: pegados a la imagen · 1: sueltos
    const cy = cy0 + s * H * MOVE.lag * k;              // sueltos, ya no suben con la sección (casi quietos en pantalla)
    const fade = (MOVE.rest + (1 - MOVE.rest) * smooth(0, MOVE.wake, s)) * (1 - smooth(MOVE.fadeFrom, MOVE.fadeTo, s));
    if (fade <= 0.002) return;
    for (const d of dots) {
      const bx = cover.x + d.u * cover.w - cx0;
      const by = cover.y + d.v * cover.h - cy0;
      const ang = Math.atan2(by, bx) + MOVE.spin * s * (0.6 + d.z) * k;
      const rad = Math.hypot(bx, by) * (1 + s * (MOVE.spread + MOVE.spreadZ * d.z) * k);
      let x = cx0 + Math.cos(ang) * rad;
      let y = cy + Math.sin(ang) * rad + Math.pow(s, 1.4) * H * (MOVE.fall + MOVE.fallZ * d.z) * k;
      x += mouse.mx * DOTS.parallax * (0.3 + d.z);
      y += mouse.my * DOTS.parallax * (0.3 + d.z);
      const size = d.size * view.k * (1 + 0.35 * s * d.z);
      if (x < -size || x > view.w + size || y < -size || y > H + size) continue;
      let a = d.a * fade * (0.85 + 0.15 * Math.sin(time * d.tw + d.ph));
      const near = Math.hypot(x - mouse.x, y - mouse.y);
      if (near < DOTS.glow) a = Math.min(1, a * (1 + DOTS.glowGain * (1 - near / DOTS.glow)));
      ctx.globalAlpha = a;
      ctx.drawImage(d.o ? orange : warm, x - size, y - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;
  };

  // ---------- movimiento reducido: la bola gira a 0.8 (también tras cambiar de versión: defaultPlaybackRate), los
  // puntos quietos sobre ella, sin salida ----------
  if (still) {
    if (video) video.defaultPlaybackRate = video.playbackRate = RATE.still;
    const once = () => { measure(); draw(0, 0); };
    window.addEventListener('resize', once);
    root.addEventListener('disco:hero-version', (e) => { ver = VERSIONS[e.detail] || VERSIONS.land; dots = makeDots(ver); once(); });
    if (document.fonts) document.fonts.ready.then(once);
    once();
    return;
  }
  origin();
  window.addEventListener('resize', origin);
  // al girar la pantalla, la otra versión del vídeo (js/page-hero.js): su bola y sus puntos
  root.addEventListener('disco:hero-version', (e) => {
    ver = VERSIONS[e.detail] || VERSIONS.land;
    dots = makeDots(ver);
    origin();
    lastP = -1;
  });

  // ---------- el loop: salida (sin pin), la bola se acerca y gira más rápido, el titular se va ----------
  let rate = 1;
  let lastP = -1;
  loop.add((time, ratio) => {
    if (document.hidden) return;
    const H = innerHeight;
    const sr = stage.getBoundingClientRect();
    const s = Math.max(0, -sr.top) / H;                  // pantallas bajadas desde el principio del hero
    const p = Math.min(1, Math.max(0, -sr.top / sr.height)); // salida del hero (0 → 1)
    const a = 1 - Math.pow(1 - 0.08, ratio);
    mouse.mx += (mouse.tx - mouse.mx) * a;
    mouse.my += (mouse.ty - mouse.my) * a;
    if (sr.bottom > 0) {
      if (Math.abs(p - lastP) > 0.0005) {
        lastP = p;
        const e = p * p * (3 - 2 * p);
        look.style.transform = `scale(${(1 + (ZOOM - 1) * e).toFixed(4)})`;
        dark.style.opacity = smooth(0.35, 1, p).toFixed(3);
        block.style.transform = `translate3d(${(-p * TITLE.x).toFixed(1)}px, 0, 0)`;
        block.style.opacity = Math.max(0, 1 - p * TITLE.fade).toFixed(3);
      }
      // gira más rápido con la velocidad del scroll (con lerp, entre 1 y 1.8; al parar, vuelve justo a 1)
      if (video) {
        const to = 1 + Math.min(RATE.max - 1, Math.abs(lenis.velocity || 0) / RATE.speed);
        rate += (to - rate) * (1 - Math.pow(1 - RATE.lerp, ratio));
        const want = rate - 1 < 0.005 ? 1 : Math.min(RATE.max, +rate.toFixed(3));
        if (video.playbackRate !== want) video.playbackRate = want;
      }
    }
    if (s > MOVE.fadeTo + 0.05) {
      if (dirty !== 'off') { ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = 'off'; }
      return;
    }
    measure();
    draw(s, time);
    dirty = false;
  });
}

// los ~140 puntos: los del techo del vídeo (sacados de su póster) y, hasta completar, unos al azar alrededor de la
// bola (sin bajar al texto del pie), más densos cerca de ella
function makeDots({ spots, ball, img, vMax }) {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const list = spots.map(([u, v, b]) => ({ u, v, b }));
  while (list.length < DOTS.n) {
    const ang = rnd() * Math.PI * 2;
    const r = ball.r * (1.12 + Math.pow(rnd(), 1.8) * 2.2); // (bola v3, casi el doble: el anillo, más estrecho)
    const u = ball.x + Math.cos(ang) * r;
    const v = ball.y + Math.sin(ang) * r * (img.w / img.h);
    if (u < 0.02 || u > 0.98 || v < 0.02 || v > vMax) continue;
    list.push({ u, v, b: 0.15 + rnd() * 0.35 });
  }
  return list.map((d, i) => {
    const t = Math.min(1, Math.max(0, (d.b - 0.12) / 0.62));
    const size = DOTS.min + (DOTS.max - DOTS.min) * Math.pow(t * 0.75 + rnd() * 0.25, 1.3);
    return {
      u: d.u,
      v: d.v,
      size,                                                  // radio del sprite: el núcleo del punto mide ~size
      z: (size - DOTS.min) / (DOTS.max - DOTS.min),          // profundidad: los grandes, más cerca y más rápidos
      a: DOTS.aMin + (DOTS.aMax - DOTS.aMin) * t,
      o: i % 5 === 3,                                        // uno de cada cinco, naranja
      tw: 0.6 + rnd() * 1.6,
      ph: rnd() * 6.28,
    };
  });
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

