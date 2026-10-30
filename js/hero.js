import { splitLetters, initExposure } from './hero-exposure.js';
import { gpuOK, lowEnd } from './gpu.js';
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
// movimiento y el hero está en pantalla. Sin ratón, quieta. Sin WebGL / HalfFloat o con
// movimiento reducido: el <img>.
// (LEGACY: la estela con el Flowmap de OGL está en legacy/js/hero-flowmap.js)
const MAX_DPR = matchMedia('(max-width: 767px)').matches ? 1.25 : 2; // móvil: como mucho 1.25
const SIM_RES = 128;              // lado corto de la simulación (independiente de la pantalla)
const MAP_RES = 512;              // lado corto del mapa de pliegues (más resolución = filamentos más finos)
const FLUID = {
  VELOCITY_DISSIPATION: 0.975,    // por frame a 60 fps (se escala con dt)
  PRESSURE: 0.8,
  PRESSURE_ITERATIONS: 20,
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

  // el fluido: con GPU de verdad (js/gpu.js) y con ratón (en táctil la foto se queda quieta: no se monta); en móvil,
  // nunca en los de gama baja
  const weak = matchMedia('(max-width: 767px)').matches && lowEnd();
  const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!reduced.matches && !weak && mouse && gpuOK()) setupFluid({ hero, img, loop });
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

function setupFluid({ hero, img, loop }) {
  const renderer = new Renderer({ dpr: Math.min(devicePixelRatio, MAX_DPR), antialias: false, depth: false });
  const { gl } = renderer;

  // --- HalfFloat con filtrado lineal y renderizable; si no, se queda el <img> ---
  const isWebgl2 = renderer.isWebgl2;
  const halfExt = !isWebgl2 && renderer.extensions.OES_texture_half_float;
  const halfFloat = isWebgl2 ? gl.HALF_FLOAT : halfExt && halfExt.HALF_FLOAT_OES;
  const linear = isWebgl2 || !!renderer.extensions.OES_texture_half_float_linear;
  const rtOptions = {
    type: halfFloat,
    format: gl.RGBA,
    internalFormat: isWebgl2 ? gl.RGBA16F : gl.RGBA,
    minFilter: gl.LINEAR,
    depth: false,
  };
  const createTarget = (width, height) => new RenderTarget(gl, { width, height, ...rtOptions });
  const supported = (() => {
    if (!halfFloat || !linear) return false;
    const probe = createTarget(4, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, probe.buffer);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    renderer.bindFramebuffer(); // devuelve a OGL al framebuffer por defecto
    destroyTarget(gl, probe);
    return ok;
  })();
  if (!supported) return;

  gl.canvas.className = 'hero__canvas';
  gl.canvas.setAttribute('aria-hidden', 'true');
  hero.querySelector('.hero__media').after(gl.canvas);

  // --- programas: un Mesh por pase, todos con el mismo triángulo a pantalla completa ---
  const geometry = new Triangle(gl);
  const pass = (fragment, uniforms) => new Mesh(gl, {
    geometry,
    program: new Program(gl, {
      vertex: baseVertex,
      fragment,
      uniforms: { texelSize: { value: new Vec2() }, ...uniforms },
      depthTest: false,
      depthWrite: false,
      cullFace: false,
    }),
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
  const buildTargets = (aspect) => {
    const [sw, sh] = size(SIM_RES, aspect);
    const [mw, mh] = size(MAP_RES, aspect);
    if (fbo && fbo.sw === sw && fbo.sh === sh) return;
    if (fbo) [fbo.velocity.read, fbo.velocity.write, fbo.pressure.read, fbo.pressure.write, fbo.map.read, fbo.map.write, fbo.curl, fbo.divergence]
      .forEach((t) => destroyTarget(gl, t));
    fbo = {
      sw, sh,
      simTexel: new Vec2(1 / sw, 1 / sh),
      mapTexel: new Vec2(1 / mw, 1 / mh),
      velocity: double(sw, sh),
      pressure: double(sw, sh),
      curl: createTarget(sw, sh),
      divergence: createTarget(sw, sh),
      map: double(mw, mh),
    };
    reset();
  };
  // velocidad y mapa a cero: la foto, intacta
  const reset = () => {
    [fbo.velocity.read, fbo.velocity.write, fbo.map.read, fbo.map.write, fbo.pressure.read, fbo.pressure.write]
      .forEach((t) => run(clear, t));
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

    // el mapa de la foto viaja con la velocidad ya sin divergencia
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
  new ResizeObserver(resize).observe(hero);
  resize();

  // la misma foto que ya descarga el <img> (webp o jpg)
  img.decode().then(() => {
    photo.image = img;
    display.program.uniforms.uImage.value.set(img.naturalWidth, img.naturalHeight);
    ready = true;
    draw();
    hero.classList.add('is-gl');
  }).catch(() => gl.canvas.remove()); // si la foto no carga, se queda el <img>

  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(hero);

  // --- ratón (solo ratón: en táctil la foto se queda quieta) ---
  // posición en uv del hero (y hacia arriba); los splats se aplican en el loop, no en el evento
  const queue = [];
  let last = null;
  let activeUntil = 0;
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !ready) return;
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
    }
    last = { x, y };
    activeUntil = performance.now() + SETTLE_MS;
  });
  hero.addEventListener('pointerleave', () => { last = null; });

  let settled = true;
  const perf = { t: 0, n: 0, done: false };
  loop.add((time, ratio) => {
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
    // calidad adaptativa: si en los primeros 2 s de simulación va por debajo de 50 fps, fuera el fluido (la foto)
    if (perf.done) return;
    perf.t += ratio / 60;
    perf.n++;
    if (perf.t < 2) return;
    perf.done = true;
    if (perf.n / perf.t < 50) { ready = false; hero.classList.remove('is-gl'); gl.canvas.remove(); }
  });
}

function destroyTarget(gl, target) {
  gl.deleteFramebuffer(target.buffer);
  target.textures.forEach((t) => gl.deleteTexture(t.texture));
}
