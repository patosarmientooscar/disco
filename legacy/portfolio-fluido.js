// LEGACY (AL): el fluido que deformaba el vídeo del hero de Portfolio al pasar el ratón (antes en js/portfolio-hero.js;
// se quitó a petición de Oscar). Para recuperarlo: import { setupFluid } y, en initBallHero, con ratón y gpuOK():
//   fluid = setupFluid({ look, video, loop, img: ver.img });  (y en "disco:hero-version": fluid?.image(ver.img))
// más las reglas .pgh__fluid y .pgh__look.is-gl video { visibility: hidden } de css/portfolio.css. Rutas relativas a js/.
import { gpuLevel, levelDpr } from '../js/gpu.js';
import { Renderer, Program, Mesh, Triangle, Texture, RenderTarget, Vec2 } from 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm';
// el fluido: los parámetros de la home, un 30 % más suaves (fuerza, vorticidad y brillo de los pliegues)
const MAX_DPR = matchMedia('(max-width: 767px)').matches ? 1.25 : 2; // móvil: como mucho 1.25
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
uniform vec2 uPos;        // su object-position (0–1, y desde abajo): el encuadre del vídeo, igual que en CSS
uniform vec2 uMapTexel;
uniform float uDisplace;
uniform float uFold;
uniform vec2 uFoldRange; // umbrales del brillo: solo los pliegues más cerrados
void main() {
  vec2 o = texture2D(tOffset, vUv).xy;
  vec2 m = vUv + o - texture2D(tVelocity, vUv).xy * uDisplace;

  // "cover" en cualquier proporción, encuadrado en uPos; clamp para que no haya costuras en los bordes
  float rs = uRes.x / uRes.y;
  float ri = uImage.x / uImage.y;
  vec2 scale = vec2(min(1.0, rs / ri), min(1.0, ri / rs));
  vec2 coverUv = clamp(m * scale + (1.0 - scale) * uPos, 0.0, 1.0);
  vec3 col = texture2D(tMap, coverUv).rgb;

  // pliegues: donde el mapa se estira o se dobla de golpe, la foto brilla un poco
  vec2 dx = texture2D(tOffset, vUv + vec2(uMapTexel.x, 0.0)).xy - texture2D(tOffset, vUv - vec2(uMapTexel.x, 0.0)).xy;
  vec2 dy = texture2D(tOffset, vUv + vec2(0.0, uMapTexel.y)).xy - texture2D(tOffset, vUv - vec2(0.0, uMapTexel.y)).xy;
  float fold = length(dx) / (2.0 * uMapTexel.x) + length(dy) / (2.0 * uMapTexel.y);
  col += smoothstep(uFoldRange.x, uFoldRange.y, fold) * uFold;
  gl_FragColor = vec4(col, 1.0);
}`;

const TEX_MAX = { high: Infinity, mid: 1920, low: 1280 };

// ============ el fluido (como en la home, js/hero.js → setupFluid), con el vídeo de textura ============
export function setupFluid({ look, video, loop, img }) {
  const renderer = new Renderer({ dpr: Math.min(devicePixelRatio, levelDpr(MAX_DPR)), antialias: false, depth: false });
  const { gl } = renderer;
  const isWebgl2 = renderer.isWebgl2;
  const halfExt = !isWebgl2 && renderer.extensions.OES_texture_half_float;
  const halfFloat = isWebgl2 ? gl.HALF_FLOAT : halfExt && halfExt.HALF_FLOAT_OES;
  const linear = isWebgl2 || !!renderer.extensions.OES_texture_half_float_linear;
  // el mejor formato renderizable: half-float o float, lineal si se puede (sin lineal, algo más basto, pero se ve)
  if (isWebgl2) gl.getExtension('EXT_color_buffer_half_float');
  const float = isWebgl2 || gl.getExtension('OES_texture_float') ? gl.FLOAT : null;
  const floatLin = !!gl.getExtension('OES_texture_float_linear');
  let rtOptions = null;
  const createTarget = (width, height) => new RenderTarget(gl, { width, height, ...rtOptions });
  const works = () => {
    const probe = createTarget(4, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, probe.buffer);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    renderer.bindFramebuffer();
    destroyTarget(gl, probe);
    return ok;
  };
  for (const [type, lin] of [[halfFloat, linear], [float, floatLin], [halfFloat, false], [float, false]]) {
    if (!type) continue;
    const big = type === gl.FLOAT ? gl.RGBA32F : gl.RGBA16F;
    const filter = lin ? gl.LINEAR : gl.NEAREST;
    rtOptions = { type, format: gl.RGBA, internalFormat: isWebgl2 ? big : gl.RGBA, minFilter: filter, magFilter: filter, depth: false };
    if (works()) break;
    rtOptions = null;
  }
  if (!rtOptions) return null;

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
    uImage: { value: new Vec2(img.w, img.h) },
    uPos: { value: new Vec2(0.5, 0.5) },
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
    // el encuadre del vídeo (su object-position), para que la bola caiga en el mismo sitio que en CSS
    const [px, py] = getComputedStyle(video).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
    display.program.uniforms.uPos.value.set(Number.isFinite(px) ? px : 0.5, 1 - (Number.isFinite(py) ? py : 0.5));
    buildTargets(aspect);
  };
  new ResizeObserver(resize).observe(look);
  resize();

  // la textura: el vídeo tal cual o, si es más ancho que lo que admite el nivel de la GPU (js/gpu.js: 1920 en
  // "mid", 1280 en "low"), reducido en un canvas (menos calidad, nunca sin fluido)
  const cap = TEX_MAX[gpuLevel()] || Infinity;
  let small = null;
  const source = () => {
    const vw = video.videoWidth;
    if (!vw || vw <= cap) { small = null; frame.image = video; return; }
    small ||= document.createElement('canvas');
    small.width = cap;
    small.height = Math.round((cap * video.videoHeight) / vw);
    small.getContext('2d').drawImage(video, 0, 0, small.width, small.height);
    frame.image = small;
  };
  const upload = () => {
    if (small) small.getContext('2d').drawImage(video, 0, 0, small.width, small.height);
    frame.needsUpdate = true;
  };
  video.addEventListener('loadeddata', () => { if (ready) { source(); resize(); } }); // otra versión (al girar)

  // el vídeo, fotograma a fotograma (cuando tiene uno nuevo)
  let ready = false;
  let fresh = false;
  const onFrame = () => { fresh = true; if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(onFrame); };
  const start = () => {
    if (ready) return;
    source();
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
    if (fresh || !video.requestVideoFrameCallback) { upload(); fresh = false; }
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
  return {
    canvas: gl.canvas,
    image(img) { display.program.uniforms.uImage.value.set(img.w, img.h); resize(); },
  };
}

function destroyTarget(gl, target) {
  gl.deleteFramebuffer(target.buffer);
  target.textures.forEach((t) => gl.deleteTexture(t.texture));
}
