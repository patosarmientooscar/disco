import { Renderer, Program, Mesh, Triangle, Texture, RenderTarget, Vec2 } from 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/index.js';

// Hero de portfolio: la bola de espejos (el vídeo de js/config.js → pageHeroes.portfolio; el hero común, en
// js/page-hero.js, sin el destello 3D). Inspirado en el hero de la home:
//   · EL FLUIDO: la misma simulación de la home (stable fluids en OGL; js/hero.js, adaptada de WebGL-Fluid-Simulation
//     de Pavel Dobryakov, licencia MIT), con el VÍDEO de textura en vez de la foto roja: al mover el ratón, la imagen
//     se ondula. Los mismos parámetros, un 30 % más suaves. Solo con ratón; en táctil, el vídeo tal cual.
//     (La home no se toca: los shaders están copiados aquí.)
//   · LOS REFLEJOS SE ESCAPAN (sin pin; la página baja normal): ~140 puntos de luz en un canvas fijo, al principio
//     encima de los puntos del techo del vídeo (sacados de su póster) y, hasta completar, al azar en la mitad de
//     arriba, más densos cerca de la bola. En reposo, tenues (el vídeo se mueve y ellos no); al bajar se encienden, se
//     sueltan y se dispersan hacia los lados y hacia abajo girando alrededor de la bola (los grandes, más rápido:
//     parallax por capas); flotan sobre la sección siguiente y se apagan al 1,4 de pantalla. Con el ratón, parallax
//     (±12 px) y los cercanos al cursor brillan más.
//   · La bola se acerca (escala 1 → 1.18, centrada en ella) y gira más rápido (playbackRate 1 → 1.8 con la velocidad
//     del scroll); el titular se desliza a la izquierda y se desvanece; el fondo acaba en #0b0909.
// Todo en el loop único (gsap.ticker). Movimiento reducido: los puntos quietos sobre la bola, sin fluido ni salida.
const IMG = { w: 1920, h: 1074 };                 // el vídeo de la bola
const BALL = { x: 0.677, y: 0.507, r: 0.142 };   // centro de la bola (fracción de la imagen) y radio (del ancho)
const ZOOM = 1.18;
const RATE = { max: 1.8, speed: 30, lerp: 0.06 }; // playbackRate: 1 + |velocidad de Lenis| / speed (hasta 1.8)
const TITLE = { x: 160, fade: 1.6 };              // px a la izquierda al final de la salida; se va antes de acabar
const DOTS = { n: 140, min: 3, max: 14, aMin: 0.15, aMax: 0.7, parallax: 12, glow: 150, glowGain: 1.4, dpr: 2, dprMob: 1.25 };
// la dispersión, en pantallas de scroll (s): se sueltan, se encienden, giran, se abren, caen y se apagan
const MOVE = { detach: 0.25, wake: 0.12, rest: 0.35, spin: 1.5, spread: 0.3, spreadZ: 0.75, lag: 0.95, fall: 0.5, fallZ: 0.9, fadeFrom: 1, fadeTo: 1.4 };
// los puntos de luz del techo en el póster (u, v en fracción de la imagen; brillo 0–1), sacados con sharp
const SPOTS = [[0.429,0.086,0.73],[0.446,0.134,0.73],[0.502,0.123,0.71],[0.479,0.022,0.68],[0.485,0.052,0.67],[0.54,0.067,0.67],[0.477,0.086,0.62],[0.469,0.164,0.58],[0.585,0.026,0.56],[0.577,0.082,0.56],[0.598,0.119,0.55],[0.358,0.123,0.55],[0.633,0.022,0.54],[0.535,0.138,0.54],[0.767,0.052,0.52],[0.346,0.019,0.5],[0.635,0.116,0.5],[0.725,0.112,0.49],[0.85,0.082,0.48],[0.39,0.201,0.48],[0.721,0.06,0.47],[0.825,0.06,0.47],[0.427,0.261,0.47],[0.821,0.325,0.45],[0.319,0.216,0.45],[0.781,0.157,0.44],[0.512,0.213,0.44],[0.631,0.075,0.43],[0.833,0.168,0.43],[0.39,0.056,0.42],[0.385,0.299,0.41],[0.5,0.187,0.4],[0.415,0.052,0.4],[0.885,0.198,0.39],[0.808,0.119,0.38],[0.731,0.157,0.38],[0.338,0.261,0.38],[0.319,0.183,0.38],[0.279,0.108,0.38],[0.867,0.127,0.37],[0.633,0.16,0.37],[0.423,0.183,0.37],[0.206,0.153,0.36],[0.373,0.164,0.36],[0.542,0.224,0.35],[0.846,0.257,0.35],[0.581,0.168,0.34],[0.269,0.201,0.34],[0.81,0.209,0.34],[0.917,0.075,0.33],[0.735,0.086,0.33],[0.879,0.019,0.32],[0.531,0.101,0.31],[0.756,0.112,0.31],[0.912,0.287,0.31],[0.379,0.228,0.31],[0.415,0.418,0.31],[0.465,0.362,0.3],[0.554,0.108,0.29],[0.965,0.116,0.29],[0.542,0.198,0.29],[0.244,0.045,0.29],[0.502,0.28,0.29],[0.585,0.216,0.28],[0.456,0.459,0.28],[0.388,0.362,0.27],[0.725,0.205,0.27],[0.194,0.06,0.26],[0.458,0.239,0.26],[0.5,0.246,0.25],[0.633,0.205,0.25],[0.773,0.224,0.25],[0.3,0.317,0.25],[0.496,0.321,0.25],[0.304,0.381,0.25],[0.121,0.075,0.24],[0.319,0.086,0.24],[0.858,0.478,0.24],[0.95,0.201,0.23],[0.683,0.205,0.23],[0.554,0.164,0.23],[0.765,0.198,0.23],[0.958,0.015,0.22],[0.369,0.485,0.22],[0.471,0.299,0.22],[0.542,0.265,0.22],[0.683,0.153,0.21],[0.921,0.373,0.21],[0.442,0.354,0.21],[0.433,0.332,0.2],[0.415,0.534,0.2],[0.431,0.295,0.2],[0.871,0.541,0.2],[0.608,0.172,0.19],[0.938,0.522,0.19],[0.217,0.295,0.18],[0.863,0.451,0.18],[0.481,0.522,0.18],[0.735,0.19,0.18],[0.146,0.209,0.18],[0.885,0.444,0.17],[0.919,0.552,0.16],[0.567,0.037,0.15],[0.483,0.597,0.15],[0.517,0.067,0.15],[0.556,0.25,0.15],[0.881,0.634,0.15],[0.99,0.354,0.14],[0.504,0.052,0.14]];

// el fluido: los parámetros de la home, un 30 % más suaves (fuerza, vorticidad y brillo de los pliegues)
const MAX_DPR = 2;
const SIM_RES = 128;
const MAP_RES = 512;
const FLUID = {
  VELOCITY_DISSIPATION: 0.975,
  PRESSURE: 0.8,
  PRESSURE_ITERATIONS: 20,
  CURL: 10.5,                     // home: 15
  SPLAT_RADIUS: 0.003,
  SPLAT_FORCE: 2800,              // home: 4000
};
const MAP_RELAX = 0.97;
const DISPLACE = 0;
const FOLD = 0.07;                // home: 0.1
const FOLD_RANGE = [4, 14];
const MAX_SPLATS = 4;
const SETTLE_MS = 3000;

const baseVertex = /* glsl */ `
precision highp float;
attribute vec2 position;
attribute vec2 uv;
uniform vec2 texelSize;
varying vec2 vUv, vL, vR, vT, vB;
void main() {
  vUv = uv;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const clearShader = /* glsl */ `
precision highp float;
void main() { gl_FragColor = vec4(0.0); }`;

const splatShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
void main() {
  vec2 p = vUv - point;
  p.x *= aspectRatio;
  vec3 splat = exp(-dot(p, p) / radius) * color;
  gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + splat, 1.0);
}`;

const curlShader = /* glsl */ `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity;
void main() {
  float L = texture2D(uVelocity, vL).y;
  float R = texture2D(uVelocity, vR).y;
  float T = texture2D(uVelocity, vT).x;
  float B = texture2D(uVelocity, vB).x;
  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

const vorticityShader = /* glsl */ `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curl;
uniform float dt;
void main() {
  float L = texture2D(uCurl, vL).x;
  float R = texture2D(uCurl, vR).x;
  float T = texture2D(uCurl, vT).x;
  float B = texture2D(uCurl, vB).x;
  float C = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C;
  force.y *= -1.0;
  vec2 velocity = texture2D(uVelocity, vUv).xy + force * dt;
  velocity = min(max(velocity, -1000.0), 1000.0);
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}`;

const divergenceShader = /* glsl */ `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity;
void main() {
  float L = texture2D(uVelocity, vL).x;
  float R = texture2D(uVelocity, vR).x;
  float T = texture2D(uVelocity, vT).y;
  float B = texture2D(uVelocity, vB).y;
  vec2 C = texture2D(uVelocity, vUv).xy;
  if (vL.x < 0.0) { L = -C.x; }
  if (vR.x > 1.0) { R = -C.x; }
  if (vT.y > 1.0) { T = -C.y; }
  if (vB.y < 0.0) { B = -C.y; }
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const scaleShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform float value;
void main() { gl_FragColor = value * texture2D(uTexture, vUv); }`;

const pressureShader = /* glsl */ `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  float divergence = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}`;

const gradientShader = /* glsl */ `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  vec2 velocity = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}`;

// advección de la velocidad por sí misma (texelSize = el de la simulación)
const advectShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform float dissipation;
void main() {
  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
  gl_FragColor = vec4(dissipation * texture2D(uSource, coord).xy, 0.0, 1.0);
}`;

// el fluido arrastra el mapa de la foto: m(x) = x + o(x) → m'(x) = m(x - v·dt), guardado como offset
// (cerca de 0 la media precisión es mucho mejor que con coordenadas absolutas); relax lo devuelve a 0
const mapShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 velTexel;
uniform float dt;
uniform float relax;
void main() {
  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * velTexel;
  vec2 o = coord - vUv + texture2D(uSource, coord).xy;
  gl_FragColor = vec4(relax * o, 0.0, 1.0);
}`;

const displayShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tMap;
uniform sampler2D tOffset;
uniform sampler2D tVelocity;
uniform vec2 uRes;        // tamaño del hero (px)
uniform vec2 uImage;      // tamaño de la foto (px)
uniform vec2 uMapTexel;
uniform float uDisplace;
uniform float uFold;
uniform vec2 uFoldRange; // umbrales del brillo: solo los pliegues más cerrados
void main() {
  vec2 o = texture2D(tOffset, vUv).xy;
  vec2 m = vUv + o - texture2D(tVelocity, vUv).xy * uDisplace;

  // "cover" centrado en cualquier proporción; clamp para que no haya costuras en los bordes
  float rs = uRes.x / uRes.y;
  float ri = uImage.x / uImage.y;
  vec2 scale = vec2(min(1.0, rs / ri), min(1.0, ri / rs));
  vec2 coverUv = clamp((m - 0.5) * scale + 0.5, 0.0, 1.0);
  vec3 col = texture2D(tMap, coverUv).rgb;

  // pliegues: donde el mapa se estira o se dobla de golpe, la foto brilla un poco
  vec2 dx = texture2D(tOffset, vUv + vec2(uMapTexel.x, 0.0)).xy - texture2D(tOffset, vUv - vec2(uMapTexel.x, 0.0)).xy;
  vec2 dy = texture2D(tOffset, vUv + vec2(0.0, uMapTexel.y)).xy - texture2D(tOffset, vUv - vec2(0.0, uMapTexel.y)).xy;
  float fold = length(dx) / (2.0 * uMapTexel.x) + length(dy) / (2.0 * uMapTexel.y);
  col += smoothstep(uFoldRange.x, uFoldRange.y, fold) * uFold;
  gl_FragColor = vec4(col, 1.0);
}`;

// ============ el hero ============
export function initBallHero({ gsap, lenis, loop, reduced }) {
  const root = document.querySelector('[data-page-hero="portfolio"]');
  if (!root) return;
  const stage = root.querySelector('.pgh__stage');
  const look = root.querySelector('.pgh__look');
  const dark = root.querySelector('[data-ball-dark]');
  const block = root.querySelector('.pgh__foot > div');
  const video = look.querySelector('video');
  const still = reduced.matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');

  // el fluido: solo con ratón (en táctil, el vídeo tal cual), con WebGL y sin movimiento reducido
  let fluid = null;
  if (!still && video && fine.matches && hasWebGL()) {
    try { fluid = setupFluid({ look, video, loop }); } catch { fluid = null; }
  }

  // ---------- los reflejos ----------
  const canvas = document.createElement('canvas');
  canvas.className = 'ball-dots';
  canvas.setAttribute('aria-hidden', 'true');
  if (still) { canvas.style.position = 'absolute'; stage.querySelector('.pgh__foot').before(canvas); } else document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const sprite = (rgb) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, `rgb(${rgb} / 1)`);
    r.addColorStop(0.45, `rgb(${rgb} / 0.95)`);
    r.addColorStop(0.7, `rgb(${rgb} / 0.35)`);
    r.addColorStop(1, `rgb(${rgb} / 0)`);
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    return c;
  };
  const white = sprite('255 255 255');
  const orange = sprite('243 84 17');
  const dots = makeDots();
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
    const s = Math.max(r.width / IMG.w, r.height / IMG.h);
    cover.w = IMG.w * s;
    cover.h = IMG.h * s;
    // con su object-position (en móvil, la bola encuadrada a la izquierda: css/portfolio.css)
    const [px, py] = getComputedStyle(look.querySelector('video, img')).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
    cover.x = r.left + (r.width - cover.w) * (Number.isFinite(px) ? px : 0.5);
    cover.y = r.top + (r.height - cover.h) * (Number.isFinite(py) ? py : 0.5);
    if (still) { const sr = stage.getBoundingClientRect(); cover.x -= sr.left; cover.y -= sr.top; }
    return r;
  };
  // el centro de la bola, para el zoom (en % de la caja del vídeo)
  const origin = () => {
    const r = measure();
    look.style.setProperty('--ball-x', `${(((cover.x + BALL.x * cover.w - r.left) / r.width) * 100).toFixed(2)}%`);
    look.style.setProperty('--ball-y', `${(((cover.y + BALL.y * cover.h - r.top) / r.height) * 100).toFixed(2)}%`);
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
    const cx0 = cover.x + BALL.x * cover.w;
    const cy0 = cover.y + BALL.y * cover.h;
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
      ctx.drawImage(d.o ? orange : white, x - size, y - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;
  };

  // ---------- movimiento reducido: puntos quietos sobre la bola, sin fluido ----------
  if (still) {
    const once = () => { measure(); draw(0, 0); };
    window.addEventListener('resize', once);
    if (document.fonts) document.fonts.ready.then(once);
    once();
    return;
  }
  origin();
  window.addEventListener('resize', origin);

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
        look.style.transform = `scale(${(1.06 * (1 + (ZOOM - 1) * e)).toFixed(4)})`;
        dark.style.opacity = smooth(0.35, 1, p).toFixed(3);
        block.style.transform = `translate3d(${(-p * TITLE.x).toFixed(1)}px, 0, 0)`;
        block.style.opacity = Math.max(0, 1 - p * TITLE.fade).toFixed(3);
      }
      // gira más rápido con la velocidad del scroll
      if (video) {
        const to = 1 + Math.min(RATE.max - 1, Math.abs(lenis.velocity || 0) / RATE.speed);
        rate += (to - rate) * (1 - Math.pow(1 - RATE.lerp, ratio));
        if (Math.abs(video.playbackRate - rate) > 0.02) video.playbackRate = rate;
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
  return { fluid };
}

// los ~140 puntos: los del techo del vídeo (sacados de su póster) y, hasta completar, unos al azar en la mitad
// de arriba, más densos cerca de la bola
function makeDots() {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const list = SPOTS.map(([u, v, b]) => ({ u, v, b }));
  while (list.length < DOTS.n) {
    const ang = rnd() * Math.PI * 2;
    const r = BALL.r * (1.15 + Math.pow(rnd(), 1.8) * 3.6);
    const u = BALL.x + Math.cos(ang) * r;
    const v = BALL.y + Math.sin(ang) * r * (IMG.w / IMG.h);
    if (u < 0.02 || u > 0.98 || v < 0.02 || v > 0.55) continue;
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

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// ============ el fluido (como en la home, js/hero.js → setupFluid), con el vídeo de textura ============
function setupFluid({ look, video, loop }) {
  const renderer = new Renderer({ dpr: Math.min(devicePixelRatio, MAX_DPR), antialias: false, depth: false });
  const { gl } = renderer;
  const isWebgl2 = renderer.isWebgl2;
  const halfExt = !isWebgl2 && renderer.extensions.OES_texture_half_float;
  const halfFloat = isWebgl2 ? gl.HALF_FLOAT : halfExt && halfExt.HALF_FLOAT_OES;
  const linear = isWebgl2 || !!renderer.extensions.OES_texture_half_float_linear;
  const rtOptions = { type: halfFloat, format: gl.RGBA, internalFormat: isWebgl2 ? gl.RGBA16F : gl.RGBA, minFilter: gl.LINEAR, depth: false };
  const createTarget = (width, height) => new RenderTarget(gl, { width, height, ...rtOptions });
  const supported = (() => {
    if (!halfFloat || !linear) return false;
    const probe = createTarget(4, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, probe.buffer);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    renderer.bindFramebuffer();
    destroyTarget(gl, probe);
    return ok;
  })();
  if (!supported) return null;

  gl.canvas.className = 'pgh__fluid';
  gl.canvas.setAttribute('aria-hidden', 'true');
  look.append(gl.canvas);

  const geometry = new Triangle(gl);
  const pass = (fragment, uniforms) => new Mesh(gl, {
    geometry,
    program: new Program(gl, { vertex: baseVertex, fragment, uniforms: { texelSize: { value: new Vec2() }, ...uniforms }, depthTest: false, depthWrite: false, cullFace: false }),
  });
  const tex = () => ({ value: null });
  const num = (v = 0) => ({ value: v });
  const clear = pass(clearShader, {});
  const splat = pass(splatShader, { uTarget: tex(), aspectRatio: num(1), color: { value: [0, 0, 0] }, point: { value: new Vec2() }, radius: num() });
  const curl = pass(curlShader, { uVelocity: tex() });
  const vorticity = pass(vorticityShader, { uVelocity: tex(), uCurl: tex(), curl: num(FLUID.CURL), dt: num() });
  const divergence = pass(divergenceShader, { uVelocity: tex() });
  const scale = pass(scaleShader, { uTexture: tex(), value: num(FLUID.PRESSURE) });
  const pressure = pass(pressureShader, { uPressure: tex(), uDivergence: tex() });
  const gradient = pass(gradientShader, { uPressure: tex(), uVelocity: tex() });
  const advect = pass(advectShader, { uVelocity: tex(), uSource: tex(), dt: num(), dissipation: num(1) });
  const advectMap = pass(mapShader, { uVelocity: tex(), uSource: tex(), velTexel: { value: new Vec2() }, dt: num(), relax: num(1) });

  const frame = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR });
  const display = pass(displayShader, {
    tMap: { value: frame },
    tOffset: tex(),
    tVelocity: tex(),
    uRes: { value: new Vec2(1, 1) },
    uImage: { value: new Vec2(IMG.w, IMG.h) },
    uMapTexel: { value: new Vec2() },
    uDisplace: num(DISPLACE),
    uFold: num(FOLD),
    uFoldRange: { value: new Vec2(...FOLD_RANGE) },
  });
  const run = (mesh, target, texel) => {
    if (texel) mesh.program.uniforms.texelSize.value.copy(texel);
    renderer.render({ scene: mesh, target, clear: false });
  };

  let fbo = null;
  const size = (res, a) => (a >= 1 ? [Math.round(res * a), res] : [res, Math.round(res / a)]);
  const double = (w, h) => {
    const d = { read: createTarget(w, h), write: createTarget(w, h) };
    d.swap = () => { [d.read, d.write] = [d.write, d.read]; };
    return d;
  };
  const reset = () => {
    [fbo.velocity.read, fbo.velocity.write, fbo.map.read, fbo.map.write, fbo.pressure.read, fbo.pressure.write].forEach((t) => run(clear, t));
  };
  const buildTargets = (a) => {
    const [sw, sh] = size(SIM_RES, a);
    const [mw, mh] = size(MAP_RES, a);
    if (fbo && fbo.sw === sw && fbo.sh === sh) return;
    if (fbo) [fbo.velocity.read, fbo.velocity.write, fbo.pressure.read, fbo.pressure.write, fbo.map.read, fbo.map.write, fbo.curl, fbo.divergence].forEach((t) => destroyTarget(gl, t));
    fbo = { sw, sh, simTexel: new Vec2(1 / sw, 1 / sh), mapTexel: new Vec2(1 / mw, 1 / mh), velocity: double(sw, sh), pressure: double(sw, sh), curl: createTarget(sw, sh), divergence: createTarget(sw, sh), map: double(mw, mh) };
    reset();
  };

  const step = (dt) => {
    const { velocity, pressure: p, simTexel } = fbo;
    const perFrame = dt * 60;
    curl.program.uniforms.uVelocity.value = velocity.read.texture;
    run(curl, fbo.curl, simTexel);
    vorticity.program.uniforms.uVelocity.value = velocity.read.texture;
    vorticity.program.uniforms.uCurl.value = fbo.curl.texture;
    vorticity.program.uniforms.dt.value = dt;
    run(vorticity, velocity.write, simTexel);
    velocity.swap();
    divergence.program.uniforms.uVelocity.value = velocity.read.texture;
    run(divergence, fbo.divergence, simTexel);
    scale.program.uniforms.uTexture.value = p.read.texture;
    run(scale, p.write, simTexel);
    p.swap();
    pressure.program.uniforms.uDivergence.value = fbo.divergence.texture;
    for (let i = 0; i < FLUID.PRESSURE_ITERATIONS; i++) {
      pressure.program.uniforms.uPressure.value = p.read.texture;
      run(pressure, p.write, simTexel);
      p.swap();
    }
    gradient.program.uniforms.uPressure.value = p.read.texture;
    gradient.program.uniforms.uVelocity.value = velocity.read.texture;
    run(gradient, velocity.write, simTexel);
    velocity.swap();
    advectMap.program.uniforms.uVelocity.value = velocity.read.texture;
    advectMap.program.uniforms.uSource.value = fbo.map.read.texture;
    advectMap.program.uniforms.velTexel.value.copy(simTexel);
    advectMap.program.uniforms.dt.value = dt;
    advectMap.program.uniforms.relax.value = Math.pow(MAP_RELAX, perFrame);
    run(advectMap, fbo.map.write, fbo.mapTexel);
    fbo.map.swap();
    advect.program.uniforms.uVelocity.value = velocity.read.texture;
    advect.program.uniforms.uSource.value = velocity.read.texture;
    advect.program.uniforms.dt.value = dt;
    advect.program.uniforms.dissipation.value = Math.pow(FLUID.VELOCITY_DISSIPATION, perFrame);
    run(advect, velocity.write, simTexel);
    velocity.swap();
  };
  let aspect = 1;
  const addSplat = (x, y, dx, dy) => {
    const u = splat.program.uniforms;
    u.uTarget.value = fbo.velocity.read.texture;
    u.aspectRatio.value = aspect;
    u.point.value.set(x, y);
    u.color.value = [dx * FLUID.SPLAT_FORCE, dy * FLUID.SPLAT_FORCE, 0];
    u.radius.value = aspect > 1 ? FLUID.SPLAT_RADIUS * aspect : FLUID.SPLAT_RADIUS;
    run(splat, fbo.velocity.write, fbo.simTexel);
    fbo.velocity.swap();
  };
  const draw = () => {
    const u = display.program.uniforms;
    u.tOffset.value = fbo.map.read.texture;
    u.tVelocity.value = fbo.velocity.read.texture;
    u.uMapTexel.value.copy(fbo.mapTexel);
    renderer.render({ scene: display });
  };

  const resize = () => {
    const width = look.offsetWidth;
    const height = look.offsetHeight;
    if (!width || !height) return;
    aspect = width / height;
    renderer.setSize(width, height);
    display.program.uniforms.uRes.value.set(width, height);
    buildTargets(aspect);
  };
  new ResizeObserver(resize).observe(look);
  resize();

  // el vídeo, fotograma a fotograma (cuando tiene uno nuevo)
  let ready = false;
  let fresh = false;
  const onFrame = () => { fresh = true; if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(onFrame); };
  const start = () => {
    if (ready) return;
    frame.image = video;
    ready = true;
    look.classList.add('is-gl');
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(onFrame);
  };
  if (video.readyState >= 2) start(); else video.addEventListener('loadeddata', start, { once: true });

  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(look);

  const queue = [];
  let last = null;
  let activeUntil = 0;
  look.parentElement.parentElement.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !ready) return;
    const r = gl.canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = 1 - (e.clientY - r.top) / r.height;
    if (last) {
      let dx = x - last.x;
      let dy = y - last.y;
      if (aspect < 1) dx *= aspect;
      if (aspect > 1) dy /= aspect;
      const px = Math.hypot((x - last.x) * r.width, (y - last.y) * r.height);
      const n = Math.min(MAX_SPLATS, Math.max(1, Math.ceil(px / 40)));
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        queue.push([last.x + (x - last.x) * t, last.y + (y - last.y) * t, dx / n, dy / n]);
      }
    }
    last = { x, y };
    activeUntil = performance.now() + SETTLE_MS;
  });
  look.parentElement.parentElement.addEventListener('pointerleave', () => { last = null; });

  let settled = true;
  loop.add((time, ratio) => {
    if (!ready || !onScreen || document.hidden) return;
    const moving = performance.now() < activeUntil;
    if (fresh || !video.requestVideoFrameCallback) { frame.needsUpdate = true; fresh = false; }
    if (moving) {
      settled = false;
      const dt = Math.min(ratio / 60, 1 / 30);
      while (queue.length) addSplat(...queue.shift());
      step(dt);
    } else if (!settled) {
      settled = true;
      queue.length = 0;
      reset();
    }
    draw();
  });
  return { canvas: gl.canvas };
}

function destroyTarget(gl, target) {
  gl.deleteFramebuffer(target.buffer);
  target.textures.forEach((t) => gl.deleteTexture(t.texture));
}
