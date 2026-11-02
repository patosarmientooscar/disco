import { splitLetters, initExposure } from './hero-exposure.js';
import { gpuOK, gpuLevel, dlog } from './gpu.js';
import { Renderer, Program, Mesh, Triangle, Texture, RenderTarget, Vec2 } from 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm';

// Hero v2: foto roja a pantalla completa. Con ratón, el cursor remueve un fluido (stable fluids,
// Navier-Stokes 2D en GPU) y la foto se pliega dentro de los remolinos, como mármol o tinta removida.
// Los shaders de la simulación están adaptados de WebGL-Fluid-Simulation de Pavel Dobryakov
// (https://github.com/PavelDoGreat/WebGL-Fluid-Simulation, licencia MIT).
//
// La simulación solo guarda VELOCIDAD. Lo que se pliega es un mapa de desplazamiento de la foto
// (offset de coordenadas) que el propio fluido arrastra frame a frame: así la imagen se dobla
// sobre sí misma en filamentos finos (un desplazamiento proporcional a la velocidad solo la
// ondularía). El mapa vuelve a cero solo y la foto queda perfecta.
//
// Un único renderer (OGL) dentro del loop único (gsap.ticker). Se simula solo mientras hay
// movimiento y el hero está en pantalla. En táctil, quieta (no hay cursor). Sin WebGL, con render por
// software puro (js/gpu.js) o con movimiento reducido: el <img>.
// El fluido NUNCA se apaga por rendimiento ni por formato: sirve cualquier formato de textura (pickFormat) y, si
// va lento, baja de escalón (QUALITY: resolución, iteraciones y DPR), vuelve a medir cada 2 s y sube si va sobrado.
// Si se pierde el contexto WebGL, se monta otro solo. Con ?debug, la consola dice qué ha hecho y por qué.
// (LEGACY: la estela con el Flowmap de OGL está en legacy/js/hero-flowmap.js)
const MAX_DPR = matchMedia('(max-width: 767px)').matches ? 1.25 : 2; // móvil: como mucho 1.25
// escalones de calidad: lado corto de la simulación y del mapa de pliegues (más resolución = filamentos más finos),
// iteraciones de presión y DPR. El 0 es el aprobado; empieza según el nivel de la GPU y se mueve midiendo
const QUALITY = [
  { sim: 128, map: 512, iter: 20, dpr: MAX_DPR },
  { sim: 128, map: 256, iter: 10, dpr: 1.5 },
  { sim: 96, map: 128, iter: 6, dpr: 1 },
  { sim: 64, map: 96, iter: 6, dpr: 1 },
];
const START = { high: 0, mid: 1, low: 2 };
// s por medida; fps para bajar y para subir; medidas buenas; fotogramas que no cuentan al empezar o cambiar de escalón
// (los primeros compilan shaders y crean texturas: un tirón así no dice nada del equipo)
const TUNE = { window: 2, min: 50, ok: 56, upAfter: 2, warm: 30 };
const REF_RES = 128;              // la velocidad va en celdas de esta rejilla: el aspecto no cambia con la resolución
const VEL_RANGE = 1024;           // RGBA8: alcance de velocidad, presión y demás
const MAP_RANGE = 2;              // RGBA8: alcance del mapa de pliegues
const RELOST = { wait: 400, tries: 6 }; // contexto perdido: espera (ms, se dobla) e intentos
const FLUID = {
  VELOCITY_DISSIPATION: 0.975,    // por frame a 60 fps (se escala con dt)
  PRESSURE: 0.8,
  CURL: 15,                       // vorticidad: con 35 salían rizos diminutos (ruido de rejilla); 15 da remolinos grandes
  SPLAT_RADIUS: 0.003,
  SPLAT_FORCE: 4000,              // con 6000 un gesto rápido arrastraba media pantalla
};
const MAP_RELAX = 0.97;           // por frame a 60 fps: el mapa de pliegues vuelve a cero (6% a los 1.5 s)
const DISPLACE = 0;               // uDisplace del brief (uv -= vel·k); 0: el pliegue ya lo da el mapa
const FOLD = 0.1;                 // brillo en los pliegues
const FOLD_RANGE = [4, 14];       // estiramiento del mapa (1 = el doble) en el que empieza / satura el brillo:
                                  // solo los pliegues más cerrados (con 0.5–3 toda la zona quedaba agrisada)
const MAX_SPLATS = 4;             // splats intermedios entre dos eventos de ratón muy separados
const SETTLE_MS = 3000;           // sin ratón: a los 3 s velocidad y mapa ya son ~0 → se para

// Cabecera de los shaders de la simulación: lectura (rd), lectura filtrada (rdl) y escritura (wr) según el formato.
// ENCODED (RGBA8): cada componente en dos canales (x en rg, y en ba: v·0.5 + 0.5 en 16 bits). Sin filtrado lineal, el
// bilineal se hace a mano (4 lecturas + mix). Sustituye a "precision highp float;" en cada fragment (fluidShader).
const fluidHeader = (fmt) => `precision highp float;
#define ENCODED ${fmt.encoded ? 1 : 0}
#define LINEAR ${fmt.linear ? 1 : 0}
const float VEL = ${VEL_RANGE.toFixed(1)};
const float MAP = ${MAP_RANGE.toFixed(1)};
vec2 rd(sampler2D t, vec2 uv, float range) {
  vec4 c = texture2D(t, uv);
#if ENCODED
  return (vec2(c.r + c.g / 255.0, c.b + c.a / 255.0) * 2.0 - 1.0) * range;
#else
  return c.xy;
#endif
}
vec2 pack16(float v) {
  v = clamp(v, 0.0, 0.99998);
  return vec2(floor(v * 255.0) / 255.0, fract(v * 255.0));
}
vec4 wr(vec2 v, float range) {
#if ENCODED
  vec2 n = v / range * 0.5 + 0.5;
  return vec4(pack16(n.x), pack16(n.y));
#else
  return vec4(v, 0.0, 1.0);
#endif
}
vec2 rdl(sampler2D t, vec2 uv, vec2 texel, float range) {
#if LINEAR
  return rd(t, uv, range);
#else
  vec2 st = uv / texel - 0.5;
  vec2 i = floor(st);
  vec2 f = st - i;
  vec2 a = rd(t, (i + vec2(0.5, 0.5)) * texel, range);
  vec2 b = rd(t, (i + vec2(1.5, 0.5)) * texel, range);
  vec2 c = rd(t, (i + vec2(0.5, 1.5)) * texel, range);
  vec2 d = rd(t, (i + vec2(1.5, 1.5)) * texel, range);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
#endif
}`;
const fluidShader = (src, fmt) => src.replace('precision highp float;', fluidHeader(fmt));

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
uniform float range;
void main() { gl_FragColor = wr(vec2(0.0), range); }`;

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
  gl_FragColor = wr(rd(uTarget, vUv, VEL) + splat.xy, VEL);
}`;

const curlShader = /* glsl */ `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity;
void main() {
  float L = rd(uVelocity, vL, VEL).y;
  float R = rd(uVelocity, vR, VEL).y;
  float T = rd(uVelocity, vT, VEL).x;
  float B = rd(uVelocity, vB, VEL).x;
  gl_FragColor = wr(vec2(0.5 * (R - L - T + B), 0.0), VEL);
}`;

const vorticityShader = /* glsl */ `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curl;
uniform float dt;
void main() {
  float L = rd(uCurl, vL, VEL).x;
  float R = rd(uCurl, vR, VEL).x;
  float T = rd(uCurl, vT, VEL).x;
  float B = rd(uCurl, vB, VEL).x;
  float C = rd(uCurl, vUv, VEL).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C;
  force.y *= -1.0;
  vec2 velocity = rd(uVelocity, vUv, VEL) + force * dt;
  velocity = min(max(velocity, -1000.0), 1000.0);
  gl_FragColor = wr(velocity, VEL);
}`;

const divergenceShader = /* glsl */ `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity;
void main() {
  float L = rd(uVelocity, vL, VEL).x;
  float R = rd(uVelocity, vR, VEL).x;
  float T = rd(uVelocity, vT, VEL).y;
  float B = rd(uVelocity, vB, VEL).y;
  vec2 C = rd(uVelocity, vUv, VEL);
  if (vL.x < 0.0) { L = -C.x; }
  if (vR.x > 1.0) { R = -C.x; }
  if (vT.y > 1.0) { T = -C.y; }
  if (vB.y < 0.0) { B = -C.y; }
  gl_FragColor = wr(vec2(0.5 * (R - L + T - B), 0.0), VEL);
}`;

const scaleShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform vec2 srcTexel;
uniform float value;
uniform float range;
void main() { gl_FragColor = wr(value * rdl(uTexture, vUv, srcTexel, range), range); }`;

const pressureShader = /* glsl */ `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float L = rd(uPressure, vL, VEL).x;
  float R = rd(uPressure, vR, VEL).x;
  float T = rd(uPressure, vT, VEL).x;
  float B = rd(uPressure, vB, VEL).x;
  float divergence = rd(uDivergence, vUv, VEL).x;
  gl_FragColor = wr(vec2((L + R + B + T - divergence) * 0.25, 0.0), VEL);
}`;

const gradientShader = /* glsl */ `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  float L = rd(uPressure, vL, VEL).x;
  float R = rd(uPressure, vR, VEL).x;
  float T = rd(uPressure, vT, VEL).x;
  float B = rd(uPressure, vB, VEL).x;
  vec2 velocity = rd(uVelocity, vUv, VEL) - vec2(R - L, T - B);
  gl_FragColor = wr(velocity, VEL);
}`;

// advección de la velocidad por sí misma (velTexel: la celda de referencia, REF_RES; texelSize: la de verdad)
const advectShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform vec2 velTexel;
uniform float dt;
uniform float dissipation;
void main() {
  vec2 coord = vUv - dt * rd(uVelocity, vUv, VEL) * velTexel;
  gl_FragColor = wr(dissipation * rdl(uSource, coord, texelSize, VEL), VEL);
}`;

// el fluido arrastra el mapa de la foto: m(x) = x + o(x) → m'(x) = m(x - v·dt), guardado como offset
// (cerca de 0 la media precisión es mucho mejor que con coordenadas absolutas); relax lo devuelve a 0
const mapShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 velTexel;
uniform vec2 simTexel;
uniform vec2 texelSize;
uniform float dt;
uniform float relax;
void main() {
  vec2 coord = vUv - dt * rdl(uVelocity, vUv, simTexel, VEL) * velTexel;
  vec2 o = coord - vUv + rdl(uSource, coord, texelSize, MAP);
  gl_FragColor = wr(relax * o, MAP);
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
  vec2 o = rdl(tOffset, vUv, uMapTexel, MAP);
  vec2 m = vUv + o - rd(tVelocity, vUv, VEL) * uDisplace;

  // "cover" centrado en cualquier proporción; clamp para que no haya costuras en los bordes
  float rs = uRes.x / uRes.y;
  float ri = uImage.x / uImage.y;
  vec2 scale = vec2(min(1.0, rs / ri), min(1.0, ri / rs));
  vec2 coverUv = clamp((m - 0.5) * scale + 0.5, 0.0, 1.0);
  vec3 col = texture2D(tMap, coverUv).rgb;

  // pliegues: donde el mapa se estira o se dobla de golpe, la foto brilla un poco
  vec2 dx = rd(tOffset, vUv + vec2(uMapTexel.x, 0.0), MAP) - rd(tOffset, vUv - vec2(uMapTexel.x, 0.0), MAP);
  vec2 dy = rd(tOffset, vUv + vec2(0.0, uMapTexel.y), MAP) - rd(tOffset, vUv - vec2(0.0, uMapTexel.y), MAP);
  float fold = length(dx) / (2.0 * uMapTexel.x) + length(dy) / (2.0 * uMapTexel.y);
  col += smoothstep(uFoldRange.x, uFoldRange.y, fold) * uFold;
  gl_FragColor = vec4(col, 1.0);
}`;

// Subtítulo: 0.3 s después de que la última línea ha llegado (expo.out de 1.3 s: al 95 % a los ~0.55 s);
// botones, 0.25 s después del subtítulo
const LINE_LANDED = 0.55;
const SUB_DELAY = 0.3;
const ACTIONS_DELAY = 0.25;

export function initHero({ gsap, ScrollTrigger, lenis, reduced, loop }) {
  const hero = document.getElementById('hero-main');
  const img = hero.querySelector('[data-hero-img]');
  const title = hero.querySelector('.hero__title');
  const copy = hero.querySelector('[data-hero-copy]');
  const sub = hero.querySelector('[data-hero-sub]');
  const actions = hero.querySelector('[data-hero-actions]');
  const lines = hero.querySelectorAll('[data-hero-line]');
  const scroll = hero.querySelector('[data-hero-scroll]');

  // el fluido: en cualquier equipo con ratón (también un portátil táctil) y WebGL que no sea por software (js/gpu.js).
  // Se monta en el primer rato libre, durante la intro; si el ratón se mueve antes, el gesto se guarda y arranca de ahí
  const mouse = matchMedia('(any-hover: hover) and (any-pointer: fine)').matches;
  if (reduced.matches) dlog('fluido: no (movimiento reducido)');
  else if (!mouse) dlog('fluido: no (sin ratón)');
  else if (!gpuOK()) dlog('fluido: no (sin WebGL o render por software)');
  else {
    const early = { last: null, seed: null };
    const hold = (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = 1 - (e.clientY - r.top) / r.height;
      if (early.last) early.seed = [x, y, x - early.last.x, y - early.last.y];
      early.last = { x, y };
    };
    hero.addEventListener('pointermove', hold);
    const start = () => { hero.removeEventListener('pointermove', hold); mountFluid({ hero, img, loop, early }); };
    if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 500 }); else setTimeout(start, 100);
  }
  splitLetters(lines); // una <span> por letra (aria-hidden ya en la línea); el h1 conserva su aria-label
  fitTitle(title, lines);
  if (!reduced.matches) initExposure({ gsap, lenis, loop, hero, title, tail: hero.querySelector('[data-hero-tail]') });

  // --- entrada de la frase y del "scroll to explore" (al terminar la intro) ---
  let shown = false;
  const show = () => {
    if (shown) return;
    shown = true;
    const tl = gsap.timeline({
      onComplete: () => window.dispatchEvent(new CustomEvent('disco:hero-ready')),
    });
    if (reduced.matches) {
      tl.to(lines, { y: 0, opacity: 1, duration: 0.5, ease: 'power1.out' })
        .to([sub, actions], { opacity: 1, duration: 0.5, ease: 'power1.out' }, 0.3)
        .to(scroll, { opacity: 1, duration: 0.5, ease: 'power1.out' }, 0.4);
    } else {
      const last = 0.1 * (lines.length - 1);
      const subAt = last + LINE_LANDED + SUB_DELAY;
      // y: 0 anula el translateY(105%) del CSS que GSAP leería en px (se sumaría al yPercent)
      // cada línea desde abajo con su máscara, a la vez que el destello entra girando
      tl.fromTo(lines, { y: 0, yPercent: 105, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.1 })
        // las líneas ya han llegado: las máscaras dejan salir a las letras (larga exposición al hacer scroll)
        .call(() => title.classList.add('is-in'), null, last + 1.3)
        .fromTo(sub, { opacity: 0, y: 10, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out', clearProps: 'filter' }, subAt)
        .fromTo(actions, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out' }, subAt + ACTIONS_DELAY)
        .to(scroll, { opacity: 1, duration: 0.8, ease: 'power2.out' }, last + 0.4);
    }
  };
  window.addEventListener('disco:intro-done', show, { once: true });

  // --- "scroll to explore": la flecha baja 6px y vuelve (1.8 s); cada 3 ciclos el palo se vuelve a dibujar ---
  const arrow = scroll.querySelector('.hero__scroll-arrow');
  const shaft = scroll.querySelector('[data-scroll-shaft]');
  if (!reduced.matches) {
    gsap.timeline({ repeat: -1 })
      .fromTo(shaft, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, 0)
      .fromTo(arrow, { y: 0 }, { y: 6, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: 5 }, 0);
  } else {
    gsap.set(shaft, { strokeDashoffset: 0 });
  }
  // se va en cuanto el usuario hace scroll (sus hijos: la opacidad del contenedor es la de la entrada)
  let away = false;
  const onScroll = () => {
    const v = scrollY > 40;
    if (v === away) return;
    away = v;
    gsap.to(scroll.children, { opacity: v ? 0 : 1, duration: 0.4, ease: 'power1.out', overwrite: true });
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  return {
    show,
    // parallax 0.85: mientras el hero está fijo (telón) y lo de abajo sube a velocidad 1, la frase sube a 0.85
    // (el destello va por su camino): se nota que están en capas distintas
    watchParallax() {
      if (reduced.matches) {
        // movimiento reducido: sin larga exposición ni parallax; el texto se va con un fundido simple
        gsap.to(copy, {
          opacity: 0,
          ease: 'none',
          scrollTrigger: { trigger: hero, start: 'top top', end: () => `+=${hero.offsetHeight * 0.6}`, scrub: true, invalidateOnRefresh: true },
        });
        return;
      }
      gsap.to(copy, {
        y: () => -0.85 * hero.offsetHeight,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: () => `+=${hero.offsetHeight}`, scrub: true, invalidateOnRefresh: true },
      });
    },
  };
}

// Escritorio: la línea más larga ocupa ~86 % del ancho (tamaño entre 38 y 128px) y las otras se igualan a ella
// con un poco de letter-spacing (como mucho +0.05em; nada de justificar con huecos). Móvil: el tamaño del CSS.
const TITLE_FILL = 0.86;
const TITLE_MIN = 38;
const TITLE_MAX = 128;
const TITLE_TRACK = -0.02;   // em, el del CSS
const TITLE_TRACK_MAX = 0.05;
function fitTitle(title, lines) {
  const desktop = matchMedia('(min-width: 768px)');
  const fit = () => {
    title.style.removeProperty('font-size');
    lines.forEach((l) => l.style.removeProperty('letter-spacing'));
    if (!desktop.matches) return;
    const base = parseFloat(getComputedStyle(title).fontSize);
    const longest = Math.max(...[...lines].map((l) => l.scrollWidth));
    const size = Math.min(TITLE_MAX, Math.max(TITLE_MIN, (base * innerWidth * TITLE_FILL) / longest));
    title.style.fontSize = `${size}px`;
    const widths = [...lines].map((l) => l.scrollWidth);
    const target = Math.max(...widths);
    lines.forEach((l, i) => {
      const chars = Math.max(1, l.textContent.length - 1);
      const extra = Math.min(TITLE_TRACK_MAX, (target - widths[i]) / chars / size);
      if (extra > 0.001) l.style.letterSpacing = `${(TITLE_TRACK + extra).toFixed(4)}em`;
    });
  };
  fit();
  if (document.fonts) document.fonts.ready.then(fit);
  let raf = null;
  window.addEventListener('resize', () => { raf?.kill(); raf = gsap.delayedCall(0, fit); });
}

// monta el fluido; si falla o se pierde el contexto, otro intento (con espera creciente)
function mountFluid({ hero, img, loop, early, tries = 0 }) {
  const retry = () => {
    if (tries >= RELOST.tries) { dlog('fluido: sin contexto WebGL tras varios intentos: la foto'); return; }
    setTimeout(() => mountFluid({ hero, img, loop, early: null, tries: tries + 1 }), RELOST.wait * 2 ** tries);
  };
  try { setupFluid({ hero, img, loop, early, retry }); } catch (e) { dlog('fluido: error al montar', e); retry(); }
}

// formato de las texturas de la simulación: el mejor que se pueda RENDERIZAR de verdad, y nunca "no hay"
function pickFormat(renderer) {
  const { gl } = renderer;
  const v2 = renderer.isWebgl2;
  const ext = (n) => gl.getExtension(n);
  const halfExt = !v2 && ext('OES_texture_half_float');
  const floatExt = !v2 && ext('OES_texture_float');
  const half = v2 ? gl.HALF_FLOAT : halfExt && halfExt.HALF_FLOAT_OES;
  if (v2) { ext('EXT_color_buffer_float'); ext('EXT_color_buffer_half_float'); } else { ext('WEBGL_color_buffer_float'); ext('EXT_color_buffer_half_float'); }
  const halfLin = v2 || !!ext('OES_texture_half_float_linear');
  const floatLin = !!ext('OES_texture_float_linear');
  const list = [
    half && halfLin && { name: 'half-float lineal', type: half, internalFormat: v2 ? gl.RGBA16F : gl.RGBA, linear: true },
    (v2 || floatExt) && floatLin && { name: 'float lineal', type: gl.FLOAT, internalFormat: v2 ? gl.RGBA32F : gl.RGBA, linear: true },
    half && { name: 'half-float, bilineal a mano', type: half, internalFormat: v2 ? gl.RGBA16F : gl.RGBA, linear: false },
  ].filter(Boolean);
  const works = (f) => {
    const t = new RenderTarget(gl, { width: 4, height: 4, type: f.type, format: gl.RGBA, internalFormat: f.internalFormat, depth: false });
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.buffer);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    renderer.bindFramebuffer(); // devuelve a OGL al framebuffer por defecto
    destroyTarget(gl, t);
    return ok;
  };
  return list.find(works) || { name: 'RGBA8 empaquetado', type: gl.UNSIGNED_BYTE, internalFormat: gl.RGBA, linear: false, encoded: true };
}

function setupFluid({ hero, img, loop, early, retry }) {
  let q = START[gpuLevel()] ?? 0;
  const renderer = new Renderer({ dpr: Math.min(devicePixelRatio, QUALITY[q].dpr), antialias: false, depth: false });
  const { gl } = renderer;
  if (!gl) throw new Error('sin contexto');

  // --- formato (de half-float lineal a RGBA8 empaquetado: siempre hay uno) ---
  const fmt = pickFormat(renderer);
  dlog(`fluido: montado · formato: ${fmt.name} · escalón ${q} · WebGL${renderer.isWebgl2 ? 2 : 1}`);
  const filter = fmt.linear ? gl.LINEAR : gl.NEAREST;
  const rtOptions = {
    type: fmt.type,
    format: gl.RGBA,
    internalFormat: fmt.internalFormat,
    minFilter: filter,
    magFilter: filter,
    depth: false,
  };
  const createTarget = (width, height) => new RenderTarget(gl, { width, height, ...rtOptions });

  gl.canvas.className = 'hero__canvas';
  gl.canvas.setAttribute('aria-hidden', 'true');
  hero.querySelector('.hero__media').after(gl.canvas);

  // --- programas: un Mesh por pase, todos con el mismo triángulo a pantalla completa ---
  const geometry = new Triangle(gl);
  const pass = (fragment, uniforms) => new Mesh(gl, {
    geometry,
    program: new Program(gl, {
      vertex: baseVertex,
      fragment: fluidShader(fragment, fmt),
      uniforms: { texelSize: { value: new Vec2() }, ...uniforms },
      depthTest: false,
      depthWrite: false,
      cullFace: false,
    }),
  });
  const tex = () => ({ value: null });
  const num = (v = 0) => ({ value: v });
  const clear = pass(clearShader, { range: num(VEL_RANGE) });
  const splat = pass(splatShader, { uTarget: tex(), aspectRatio: num(1), color: { value: [0, 0, 0] }, point: { value: new Vec2() }, radius: num() });
  const curl = pass(curlShader, { uVelocity: tex() });
  const vorticity = pass(vorticityShader, { uVelocity: tex(), uCurl: tex(), curl: num(FLUID.CURL), dt: num() });
  const divergence = pass(divergenceShader, { uVelocity: tex() });
  const scale = pass(scaleShader, { uTexture: tex(), srcTexel: { value: new Vec2() }, value: num(FLUID.PRESSURE), range: num(VEL_RANGE) });
  const pressure = pass(pressureShader, { uPressure: tex(), uDivergence: tex() });
  const gradient = pass(gradientShader, { uPressure: tex(), uVelocity: tex() });
  const advect = pass(advectShader, { uVelocity: tex(), uSource: tex(), velTexel: { value: new Vec2() }, dt: num(), dissipation: num(1) });
  const advectMap = pass(mapShader, { uVelocity: tex(), uSource: tex(), velTexel: { value: new Vec2() }, simTexel: { value: new Vec2() }, dt: num(), relax: num(1) });

  const photo = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR });
  const display = pass(displayShader, {
    tMap: { value: photo },
    tOffset: tex(),
    tVelocity: tex(),
    uRes: { value: new Vec2(1, 1) },
    uImage: { value: new Vec2(img.naturalWidth || 2560, img.naturalHeight || 1706) },
    uMapTexel: { value: new Vec2() },
    uDisplace: num(DISPLACE),
    uFold: num(FOLD),
    uFoldRange: { value: new Vec2(...FOLD_RANGE) },
  });

  const run = (mesh, target, texel) => {
    if (texel) mesh.program.uniforms.texelSize.value.copy(texel);
    renderer.render({ scene: mesh, target, clear: false });
  };

  // --- render targets (se rehacen si cambia la proporción del hero) ---
  let fbo = null;
  const size = (res, aspect) => (aspect >= 1
    ? [Math.round(res * aspect), res]
    : [res, Math.round(res / aspect)]);
  const double = (w, h) => {
    const d = { read: createTarget(w, h), write: createTarget(w, h) };
    d.swap = () => { [d.read, d.write] = [d.write, d.read]; };
    return d;
  };
  // copia una textura a otra de distinto tamaño (al cambiar de escalón no se pierde lo que se está moviendo)
  const copy = (from, to, range) => {
    const u = scale.program.uniforms;
    const keep = [u.value.value, u.range.value];
    u.uTexture.value = from.texture;
    u.srcTexel.value.set(1 / from.width, 1 / from.height);
    u.value.value = 1;
    u.range.value = range;
    run(scale, to, new Vec2(1 / to.width, 1 / to.height));
    [u.value.value, u.range.value] = keep;
  };
  const buildTargets = (aspect) => {
    const [sw, sh] = size(QUALITY[q].sim, aspect);
    const [mw, mh] = size(QUALITY[q].map, aspect);
    if (fbo && fbo.sw === sw && fbo.sh === sh && fbo.mw === mw) return;
    const old = fbo;
    const [rw, rh] = size(REF_RES, aspect);
    fbo = {
      sw, sh, mw,
      refTexel: new Vec2(1 / rw, 1 / rh),
      simTexel: new Vec2(1 / sw, 1 / sh),
      mapTexel: new Vec2(1 / mw, 1 / mh),
      velocity: double(sw, sh),
      pressure: double(sw, sh),
      curl: createTarget(sw, sh),
      divergence: createTarget(sw, sh),
      map: double(mw, mh),
    };
    reset();
    if (!old) return;
    copy(old.velocity.read, fbo.velocity.read, VEL_RANGE);
    copy(old.map.read, fbo.map.read, MAP_RANGE);
    [old.velocity.read, old.velocity.write, old.pressure.read, old.pressure.write, old.map.read, old.map.write, old.curl, old.divergence]
      .forEach((t) => destroyTarget(gl, t));
  };
  // velocidad y mapa a cero: la foto, intacta
  const reset = () => {
    clear.program.uniforms.range.value = VEL_RANGE;
    [fbo.velocity.read, fbo.velocity.write, fbo.pressure.read, fbo.pressure.write].forEach((t) => run(clear, t));
    clear.program.uniforms.range.value = MAP_RANGE;
    [fbo.map.read, fbo.map.write].forEach((t) => run(clear, t));
  };

  // --- un paso de la simulación (Pavel Dobryakov, adaptado) ---
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
    scale.program.uniforms.srcTexel.value.copy(simTexel);
    run(scale, p.write, simTexel);
    p.swap();

    pressure.program.uniforms.uDivergence.value = fbo.divergence.texture;
    for (let i = 0; i < QUALITY[q].iter; i++) {
      pressure.program.uniforms.uPressure.value = p.read.texture;
      run(pressure, p.write, simTexel);
      p.swap();
    }

    gradient.program.uniforms.uPressure.value = p.read.texture;
    gradient.program.uniforms.uVelocity.value = velocity.read.texture;
    run(gradient, velocity.write, simTexel);
    velocity.swap();

    // el mapa de la foto viaja con la velocidad ya sin divergencia
    advectMap.program.uniforms.uVelocity.value = velocity.read.texture;
    advectMap.program.uniforms.uSource.value = fbo.map.read.texture;
    advectMap.program.uniforms.velTexel.value.copy(fbo.refTexel);
    advectMap.program.uniforms.simTexel.value.copy(simTexel);
    advectMap.program.uniforms.dt.value = dt;
    advectMap.program.uniforms.relax.value = Math.pow(MAP_RELAX, perFrame);
    run(advectMap, fbo.map.write, fbo.mapTexel);
    fbo.map.swap();

    advect.program.uniforms.uVelocity.value = velocity.read.texture;
    advect.program.uniforms.uSource.value = velocity.read.texture;
    advect.program.uniforms.velTexel.value.copy(fbo.refTexel);
    advect.program.uniforms.dt.value = dt;
    advect.program.uniforms.dissipation.value = Math.pow(FLUID.VELOCITY_DISSIPATION, perFrame);
    run(advect, velocity.write, simTexel);
    velocity.swap();
  };

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

  // --- tamaño ---
  let ready = false;
  let aspect = 1;
  const resize = () => {
    const { width, height } = hero.getBoundingClientRect();
    if (!width || !height) return;
    aspect = width / height;
    renderer.setSize(width, height);
    display.program.uniforms.uRes.value.set(width, height);
    buildTargets(aspect);
    if (ready) draw();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(hero);
  resize();

  // la misma foto que ya descarga el <img> (webp o jpg)
  img.decode().then(() => {
    photo.image = img;
    display.program.uniforms.uImage.value.set(img.naturalWidth, img.naturalHeight);
    ready = true;
    draw();
    hero.classList.add('is-gl');
  }).catch(() => { dlog('fluido: la foto no ha cargado'); gl.canvas.remove(); }); // se queda el <img>

  let onScreen = true;
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; });
  io.observe(hero);

  // --- ratón (solo ratón: en táctil la foto se queda quieta) ---
  // posición en uv del hero (y hacia arriba); los splats se aplican en el loop, no en el evento
  // (también antes de que la foto esté lista: el gesto espera en la cola)
  const queue = [];
  let last = early?.last || null;
  let activeUntil = 0;
  if (early?.seed) { queue.push(early.seed); activeUntil = performance.now() + SETTLE_MS; }
  const onMove = (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = hero.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = 1 - (e.clientY - r.top) / r.height;
    if (last) {
      let dx = x - last.x;
      let dy = y - last.y;
      if (aspect < 1) dx *= aspect;
      if (aspect > 1) dy /= aspect;
      // eventos muy separados: 2-4 splats intermedios para que la estela sea continua
      const px = Math.hypot((x - last.x) * r.width, (y - last.y) * r.height);
      const n = Math.min(MAX_SPLATS, Math.max(1, Math.ceil(px / 40)));
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        queue.push([last.x + (x - last.x) * t, last.y + (y - last.y) * t, dx / n, dy / n]);
      }
      if (queue.length > 64) queue.splice(0, queue.length - 64);
    }
    last = { x, y };
    activeUntil = performance.now() + SETTLE_MS;
  };
  const onLeave = () => { last = null; };
  hero.addEventListener('pointermove', onMove);
  hero.addEventListener('pointerleave', onLeave);

  let settled = true;
  // calidad adaptativa: cada 2 s de simulación mide; por debajo de 50 fps baja un escalón (sin apagar nada: el último
  // se queda aunque siga lento); si va sobrado, sube; si tras subir vuelve a ir lento, baja y ese es su techo
  const perf = { t: 0, n: 0, good: 0, top: 0, rose: false, warm: TUNE.warm };
  const setQuality = (to, why) => {
    q = to;
    perf.warm = TUNE.warm;
    dlog(`fluido: escalón ${q} (${why}) · simulación ${QUALITY[q].sim}, mapa ${QUALITY[q].map}, ${QUALITY[q].iter} iteraciones`);
    const dpr = Math.min(devicePixelRatio, QUALITY[q].dpr);
    if (dpr !== renderer.dpr) { renderer.dpr = dpr; resize(); } else buildTargets(aspect);
    draw();
  };
  const tune = (dt) => {
    if (perf.warm > 0) { perf.warm--; return; }
    perf.t += dt;
    perf.n++;
    if (perf.t < TUNE.window) return;
    const fps = perf.n / perf.t;
    perf.t = 0;
    perf.n = 0;
    if (fps < TUNE.min) {
      perf.good = 0;
      if (q < QUALITY.length - 1) {
        if (perf.rose) perf.top = q + 1;
        setQuality(q + 1, `${fps.toFixed(0)} fps`);
      }
      perf.rose = false;
    } else if (fps >= TUNE.ok && q > perf.top && ++perf.good >= TUNE.upAfter) {
      perf.good = 0;
      perf.rose = true;
      setQuality(q - 1, `${fps.toFixed(0)} fps: va sobrado`);
    }
  };
  const offLoop = loop.add((time, ratio) => {
    // tapado del todo por la sección siguiente (telón, js/scroll-fx.js): no simula ni pinta
    if (!ready || !onScreen || hero.classList.contains('is-covered')) return;
    if (performance.now() > activeUntil) {
      // quieto 3 s: velocidad y mapa ~0 → a cero exacto, un último frame y deja de simular
      if (!settled) {
        settled = true;
        queue.length = 0;
        reset();
        draw();
      }
      return;
    }
    settled = false;
    const dt = Math.min(ratio / 60, 1 / 30);
    while (queue.length) addSplat(...queue.shift());
    step(dt);
    draw();
    tune(ratio / 60);
  });

  // contexto perdido (la gráfica se reinicia, el portátil vuelve de suspensión…): la foto, y otro fluido nuevo
  gl.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    dlog('fluido: contexto perdido, se vuelve a montar');
    ready = false;
    offLoop();
    ro.disconnect();
    io.disconnect();
    hero.removeEventListener('pointermove', onMove);
    hero.removeEventListener('pointerleave', onLeave);
    hero.classList.remove('is-gl');
    gl.canvas.remove();
    retry();
  });
}

function destroyTarget(gl, target) {
  gl.deleteFramebuffer(target.buffer);
  target.textures.forEach((t) => gl.deleteTexture(t.texture));
}
