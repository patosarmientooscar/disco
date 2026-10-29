// Estelas vivas del hero de servicios (js/sv-hero.js): luces.webp pintada con un shader (OGL) en la misma capa que la
// <img> (mismo wrapper de parallax, mix-blend-mode: screen). La luz corre por las estelas sin moverlas de sitio
// (pulsos que viajan, un arrastre corto de larga exposición y una ondulación mínima) y, con el ratón (o el dedo), un
// fluido ligero las dobla como luz en el agua y se calma solo. Mismo ADN que el fluido del hero de la home
// (js/hero.js), en versión ligera: advección + difusión simple, sin presión. Al salir, el arrastre crece con el
// progreso y con la velocidad del scroll (se estiran de verdad, no se escalan).
// Hasta que el shader está listo (o sin WebGL) se ve la <img>; luego un fundido corto de una a otro.
const OGL_URL = 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/index.js';
const FLOW = { pulses: 7, speed: 0.35, lo: 0.78, amp: 0.32, wave: 0.0012, waveFreq: 9, waveSpeed: 0.6, drag: [0.004, 0.008], dragPeriod: 7, taps: 6, tapsLow: 4 };
const FLUID = { decay: 0.955, radius: 0.06, maxForce: 2.5, displace: 0.06, diffuse: 0.2, idle: 2.5 };
const GLOW = { radius: 0.12, gain: 0.18, tint: 0.35, idle: 1.2, lerp: 0.08 };
const EXIT = { drag: 0.06, speed: 0.00045, maxSpeed: 0.05, lerp: 0.1 };
const FADE = 0.8;
const DPR = { desk: 1.5, mob: 1 };
const SIM_DIV = 4; // el fluido, a 1/4 de la resolución del canvas
const LOW_FPS = 50; // por debajo, el arrastre baja a 4 muestras

const vertex = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

// fluido: advección por sí mismo + un poco de difusión + decaimiento
const advectFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tVel;
uniform vec2 uTexel;
uniform float uDt, uDecay, uDiffuse;
void main() {
  vec2 c = vUv - uDt * texture2D(tVel, vUv).xy;
  vec2 a = texture2D(tVel, c).xy;
  vec2 n = 0.25 * (texture2D(tVel, c + vec2(uTexel.x, 0.0)).xy + texture2D(tVel, c - vec2(uTexel.x, 0.0)).xy
    + texture2D(tVel, c + vec2(0.0, uTexel.y)).xy + texture2D(tVel, c - vec2(0.0, uTexel.y)).xy);
  gl_FragColor = vec4(mix(a, n, uDiffuse) * uDecay, 0.0, 1.0);
}`;

// splat gaussiano con la velocidad del cursor
const splatFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tVel;
uniform vec2 uPoint, uForce;
uniform float uRadius, uAspect;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec2 v = texture2D(tVel, vUv).xy + uForce * exp(-dot(p, p) / (uRadius * uRadius));
  gl_FragColor = vec4(v, 0.0, 1.0);
}`;

// las estelas: el mismo "cover + object-position" que las <img> (uScale / uOffset, en uv del canvas con y hacia abajo)
const lucesFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tMap, tVel;
uniform vec2 uScale, uOffset, uMouse;
uniform float uTime, uDrag, uTaps, uPulse, uWave, uDisplace, uGlow, uAspect;
float hash(float n) { return fract(sin(n) * 43758.5453); }
float noise(float x) { float i = floor(x), f = fract(x); return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f)); }
vec3 photo(vec2 st) {
  vec2 q = (vec2(st.x, 1.0 - st.y) - uOffset) / uScale;
  return texture2D(tMap, vec2(q.x, 1.0 - q.y)).rgb;
}
void main() {
  vec2 st = vUv - texture2D(tVel, vUv).xy * uDisplace;           // el fluido dobla las estelas
  st.y += sin(st.x * ${FLOW.waveFreq.toFixed(1)} + uTime * ${FLOW.waveSpeed.toFixed(2)}) * uWave; // ondulación mínima
  // arrastre horizontal (larga exposición): muestras hacia la izquierda, con jitter para que no se vean copias
  float j = hash(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)));
  vec3 base = photo(st);
  vec3 sum = base, hi = base;
  float wsum = 1.0;
  for (int i = 1; i < ${FLOW.taps}; i++) {
    if (float(i) >= uTaps) break;
    float k = (float(i) - 0.5 + j) / (uTaps - 1.0);
    vec3 c = photo(st - vec2(uDrag * k, 0.0));
    float w = 1.0 - 0.6 * k;
    sum += c * w; wsum += w; hi = max(hi, c * w);
  }
  vec3 col = mix(sum / wsum, hi, 0.5);
  // pulsos de luz que corren por cada estela, de izquierda a derecha, cada altura a su ritmo (solo brillo)
  float f = fract(st.x * ${FLOW.pulses.toFixed(1)} - uTime * ${FLOW.speed.toFixed(2)} + noise(st.y * 40.0));
  float pulse = smoothstep(0.0, 0.3, f) * (1.0 - smoothstep(0.45, 1.0, f));
  col *= mix(1.0, ${FLOW.lo.toFixed(2)} + ${FLOW.amp.toFixed(2)} * pulse, uPulse);
  // junto al cursor, un poco más de brillo y más cálidas
  vec2 d = vUv - uMouse; d.x *= uAspect;
  float g = exp(-dot(d, d) / ${(GLOW.radius * GLOW.radius).toFixed(4)}) * uGlow;
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col *= 1.0 + ${GLOW.gain.toFixed(2)} * g;
  col = mix(col, max(col, vec3(0.953, 0.329, 0.067) * l * 1.8), ${GLOW.tint.toFixed(2)} * g);
  gl_FragColor = vec4(col, 1.0);
}`;

export function initLuces({ gsap, hero, layer }) {
  const picture = layer.querySelector('picture');
  const img = layer.querySelector('img');
  const api = { live: false, frame() {} };
  if (!hasWebGL()) return api;
  import(OGL_URL).then((ogl) => setup(ogl)).catch(() => {});
  return api;

  function setup({ Renderer, Program, Mesh, Triangle, Texture, RenderTarget, Vec2 }) {
    const mobile = matchMedia('(max-width: 767px), (hover: none)').matches;
    const renderer = new Renderer({ dpr: Math.min(devicePixelRatio, mobile ? DPR.mob : DPR.desk), alpha: false, antialias: false, depth: false });
    const { gl } = renderer;
    gl.clearColor(0, 0, 0, 1);
    const canvas = gl.canvas;
    canvas.className = 'sv-hero__luces-gl';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.opacity = '0';

    // fluido en media precisión con filtrado lineal; si el equipo no lo da, solo el flujo constante
    const isWebgl2 = renderer.isWebgl2;
    const halfExt = !isWebgl2 && renderer.extensions.OES_texture_half_float;
    const halfFloat = isWebgl2 ? gl.HALF_FLOAT : halfExt && halfExt.HALF_FLOAT_OES;
    const linear = isWebgl2 || !!renderer.extensions.OES_texture_half_float_linear;
    const rtOptions = { type: halfFloat, format: gl.RGBA, internalFormat: isWebgl2 ? gl.RGBA16F : gl.RGBA, minFilter: gl.LINEAR, depth: false };
    const makeTarget = (width, height) => new RenderTarget(gl, { width, height, ...rtOptions });
    const fluidOk = (() => {
      if (!halfFloat || !linear) return false;
      const probe = makeTarget(4, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, probe.buffer);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      renderer.bindFramebuffer();
      killTarget(gl, probe);
      return ok;
    })();
    const still = new Texture(gl, { image: new Uint8Array([0, 0, 0, 255]), width: 1, height: 1, generateMipmaps: false });

    const geometry = new Triangle(gl);
    const pass = (fragment, uniforms) => new Mesh(gl, { geometry, program: new Program(gl, { vertex, fragment, uniforms, depthTest: false, depthWrite: false, cullFace: false }) });
    const advect = pass(advectFrag, { tVel: { value: null }, uTexel: { value: new Vec2() }, uDt: { value: 0 }, uDecay: { value: 1 }, uDiffuse: { value: FLUID.diffuse } });
    const splat = pass(splatFrag, { tVel: { value: null }, uPoint: { value: new Vec2() }, uForce: { value: new Vec2() }, uRadius: { value: FLUID.radius }, uAspect: { value: 1 } });
    const photo = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR });
    const luces = pass(lucesFrag, {
      tMap: { value: photo },
      tVel: { value: still },
      uScale: { value: new Vec2(1, 1) },
      uOffset: { value: new Vec2() },
      uMouse: { value: new Vec2(-9, -9) },
      uTime: { value: 0 },
      uDrag: { value: FLOW.drag[0] },
      uTaps: { value: FLOW.taps },
      uPulse: { value: 1 },
      uWave: { value: FLOW.wave },
      uDisplace: { value: FLUID.displace },
      uGlow: { value: 0 },
      uAspect: { value: 1 },
    });
    const U = luces.program.uniforms;

    // ---------- tamaños: el canvas ocupa el wrapper, igual que la <img>; el fluido a 1/4 ----------
    const st = { w: 0, h: 0, vel: null, texel: new Vec2(), src: '', ready: false, dead: false };
    const imgSize = { w: img.naturalWidth || 2560, h: img.naturalHeight || 1434 };
    function cover() {
      // el mismo cálculo que object-fit: cover + object-position (en uv del canvas, y hacia abajo)
      const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
      const s = Math.max(st.w / imgSize.w, st.h / imgSize.h);
      const dw = (imgSize.w * s) / st.w;
      const dh = (imgSize.h * s) / st.h;
      U.uScale.value.set(dw, dh);
      U.uOffset.value.set((1 - dw) * (isNaN(px) ? 0.5 : px), (1 - dh) * (isNaN(py) ? 0.5 : py));
      U.uAspect.value = st.w / st.h;
      splat.program.uniforms.uAspect.value = st.w / st.h;
    }
    function resize() {
      const w = layer.clientWidth;
      const h = layer.clientHeight;
      if (!w || !h) return;
      st.w = w;
      st.h = h;
      renderer.setSize(w, h);
      cover();
      if (!fluidOk) return;
      const fw = Math.max(16, Math.round(w / SIM_DIV));
      const fh = Math.max(16, Math.round(h / SIM_DIV));
      if (st.vel && st.vel.w === fw && st.vel.h === fh) return;
      if (st.vel) { killTarget(gl, st.vel.read); killTarget(gl, st.vel.write); }
      st.vel = { w: fw, h: fh, read: makeTarget(fw, fh), write: makeTarget(fw, fh) };
      st.texel.set(1 / fw, 1 / fh);
      [st.vel.read, st.vel.write].forEach((t) => { renderer.bindFramebuffer(t); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); });
      renderer.bindFramebuffer();
    }
    // la textura: la misma imagen que ha elegido el <picture> (1280 por debajo de 900px)
    function loadPhoto() {
      const src = img.currentSrc || img.src;
      if (!src || src === st.src) return;
      st.src = src;
      const im = new Image();
      im.decoding = 'async';
      im.src = src;
      im.decode().then(() => {
        if (st.src !== src || st.dead) return;
        imgSize.w = im.naturalWidth;
        imgSize.h = im.naturalHeight;
        photo.image = im;
        cover();
        if (st.ready) return;
        // primer frame listo: fundido corto de la <img> al shader (en t = 0 son iguales: no hay salto)
        st.ready = true;
        api.live = true;
        draw(0, 1, 0, 0);
        gsap.to(canvas, { opacity: 1, duration: FADE, ease: 'power1.inOut' });
        gsap.to(picture, { opacity: 0, duration: FADE, ease: 'power1.inOut' });
      }).catch(() => {});
    }
    layer.appendChild(canvas);
    resize();
    if (img.complete) loadPhoto(); else img.addEventListener('load', loadPhoto, { once: true });
    img.addEventListener('load', loadPhoto);
    let raf = 0;
    window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { resize(); loadPhoto(); }); });

    // ---------- el cursor (o el dedo): en toda la sección, también encima del título y de la persona ----------
    const ptr = { x: 0, y: 0, px: 0, py: 0, moved: false, last: -9, inside: false, fresh: true };
    const toUv = (cx, cy) => {
      const r = canvas.getBoundingClientRect();
      ptr.x = (cx - r.left) / r.width;
      ptr.y = 1 - (cy - r.top) / r.height; // GL: y hacia arriba
      if (ptr.fresh) { ptr.px = ptr.x; ptr.py = ptr.y; ptr.fresh = false; }
      ptr.moved = true;
      ptr.inside = true;
    };
    hero.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') toUv(e.clientX, e.clientY); }, { passive: true });
    hero.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') { ptr.inside = false; ptr.fresh = true; } });
    hero.addEventListener('touchstart', (e) => { ptr.fresh = true; toUv(e.touches[0].clientX, e.touches[0].clientY); ptr.moved = false; }, { passive: true });
    hero.addEventListener('touchmove', (e) => toUv(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    hero.addEventListener('touchend', () => { ptr.inside = false; ptr.fresh = true; }, { passive: true });

    // ---------- un frame (lo llama el ticker del hero, solo con el hero en pantalla) ----------
    const perf = { acc: 0, n: 0, low: false };
    let glow = 0;
    let drag = 0;
    let lastSplat = -99;
    function draw(time, ratio, p, v) {
      const dt = Math.min(1 / 30, (ratio || 1) / 60);
      const quiet = hero.hasAttribute('data-luces-quieto'); // comprobación: el shader quieto debe ser igual a la <img>
      // fluido
      if (fluidOk && st.vel) {
        const splatNow = ptr.moved && !quiet;
        if (splatNow || time - lastSplat < FLUID.idle) {
          const a = advect.program.uniforms;
          a.tVel.value = st.vel.read.texture;
          a.uTexel.value.copy(st.texel);
          a.uDt.value = dt;
          a.uDecay.value = Math.pow(FLUID.decay, ratio || 1);
          renderer.render({ scene: advect, target: st.vel.write, clear: false });
          [st.vel.read, st.vel.write] = [st.vel.write, st.vel.read];
        }
        if (splatNow) {
          let fx = (ptr.x - ptr.px) / dt;
          let fy = (ptr.y - ptr.py) / dt;
          const len = Math.hypot(fx, fy);
          if (len > FLUID.maxForce) { fx *= FLUID.maxForce / len; fy *= FLUID.maxForce / len; }
          const sp = splat.program.uniforms;
          sp.tVel.value = st.vel.read.texture;
          sp.uPoint.value.set(ptr.x, ptr.y);
          sp.uForce.value.set(fx, fy);
          renderer.render({ scene: splat, target: st.vel.write, clear: false });
          [st.vel.read, st.vel.write] = [st.vel.write, st.vel.read];
          lastSplat = time;
        }
        U.tVel.value = quiet ? still : st.vel.read.texture;
      }
      if (ptr.moved) ptr.last = time;
      ptr.px = ptr.x;
      ptr.py = ptr.y;
      ptr.moved = false;
      // brillo junto al cursor mientras se mueve (y se apaga solo al pararse)
      const want = ptr.inside && time - ptr.last < GLOW.idle ? 1 : 0;
      glow += (want - glow) * (1 - Math.pow(1 - GLOW.lerp, ratio || 1));
      U.uMouse.value.set(ptr.x, ptr.y);
      U.uGlow.value = quiet ? 0 : glow;
      // flujo constante + salida (el arrastre crece con el progreso y con la velocidad del scroll, suavizada)
      const base = FLOW.drag[0] + (FLOW.drag[1] - FLOW.drag[0]) * (0.5 + 0.5 * Math.sin((time * Math.PI * 2) / FLOW.dragPeriod));
      const want2 = base + EXIT.drag * p + Math.min(EXIT.maxSpeed, v * EXIT.speed);
      drag += (want2 - drag) * (1 - Math.pow(1 - EXIT.lerp, ratio || 1));
      U.uTime.value = quiet ? 0 : time;
      U.uDrag.value = quiet ? 0 : drag;
      U.uTaps.value = quiet ? 1 : perf.low ? FLOW.tapsLow : FLOW.taps;
      U.uPulse.value = quiet ? 0 : 1;
      U.uWave.value = quiet ? 0 : FLOW.wave;
      U.uDisplace.value = quiet ? 0 : FLUID.displace;
      renderer.render({ scene: luces });
    }
    api.frame = (time, ratio, p, v) => {
      if (!st.ready || st.dead || document.hidden) return;
      // si el equipo no llega a 50 fps (medido en tandas de 2 s), el arrastre baja a 4 muestras
      if (!perf.low) {
        perf.acc += ratio / 60;
        perf.n++;
        if (perf.acc >= 2) { if (perf.n / perf.acc < LOW_FPS) perf.low = true; perf.acc = 0; perf.n = 0; }
      }
      draw(time, ratio, p, v);
    };

    // al salir de la página (o si el navegador pierde el contexto) se libera WebGL y vuelve la <img>
    const release = () => {
      if (st.dead) return;
      st.dead = true;
      api.live = false;
      picture.style.opacity = '';
      canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
    window.addEventListener('pagehide', release);
    canvas.addEventListener('webglcontextlost', release);
  }
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function killTarget(gl, target) {
  gl.deleteFramebuffer(target.buffer);
  target.textures.forEach((t) => gl.deleteTexture(t.texture));
}
