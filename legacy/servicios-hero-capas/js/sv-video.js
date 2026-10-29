// Vídeo del hero de servicios (js/sv-hero.js). Un único MP4 "stacked alpha": arriba el fotograma a color, abajo su
// máscara (blanco = el chico y sus estelas). Dos canvas WebGL (OGL) leen la misma textura en el mismo frame:
//   FONDO (debajo del título): el fotograma completo.
//   FIGURA (encima del título): el color con alpha = la máscara (premultiplicado, smoothstep para limpiar ruido).
// Los dos se pintan en el mismo requestVideoFrameCallback (sin él, en el ticker): siempre el mismo fotograma.
// Mismo "cover + object-position" que los pósters (<img>), que son el fotograma 0 exacto: se ven hasta que el vídeo
// pinta su primer fotograma y se ocultan en ese mismo frame (el cambio no se ve). Sin WebGL, sin vídeo o con el
// autoplay bloqueado se quedan los pósters, que ya forman la composición.
// El fondo lleva al chico dentro: cuando el parallax separa las capas, la parte del chico del fondo que la figura
// deja de tapar se oscurece (se lee como su sombra, no como un segundo chico). Con las capas juntas no cambia nada.
const OGL_URL = 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/index.js';
const SRC = { desk: 'assets/servicios/hero/hero-stack.mp4', small: 'assets/servicios/hero/hero-stack-1280.mp4' };
const MASK = [0.04, 0.96]; // smoothstep de la máscara
const GHOST = 0.7; // cuánto se oscurece el chico del fondo que queda al descubierto
const DPR = { desk: 1.5, mob: 1 };

const vertex = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

// st: uv del canvas con y hacia abajo. q: posición en el fotograma (0–1, y hacia abajo). En la textura (flipY) la
// mitad de color es v 0.5–1 y la máscara v 0–0.5; se recorta medio texel para no leer la otra mitad.
const common = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tMap;
uniform vec2 uScale, uOffset;
uniform float uHalf;
vec2 frame(vec2 st) { return (st - uOffset) / uScale; }
vec3 color(vec2 q) { return texture2D(tMap, vec2(q.x, clamp(1.0 - 0.5 * q.y, 0.5 + uHalf, 1.0))).rgb; }
float alpha(vec2 q) {
  float m = texture2D(tMap, vec2(q.x, clamp(0.5 - 0.5 * q.y, 0.0, 0.5 - uHalf))).g;
  return smoothstep(${MASK[0].toFixed(2)}, ${MASK[1].toFixed(2)}, m);
}`;

// uRel: dónde cae este punto del fondo en el canvas de la figura (escala, desplazamiento en uv)
const bgFrag = /* glsl */ `${common}
uniform vec3 uRel;
void main() {
  vec2 st = vec2(vUv.x, 1.0 - vUv.y);
  vec2 q = frame(st);
  vec3 c = color(q);
  vec2 f = st * uRel.x + uRel.yz;
  float covered = (f.x < 0.0 || f.y < 0.0 || f.x > 1.0 || f.y > 1.0) ? 0.0 : alpha(frame(f));
  c *= 1.0 - ${GHOST.toFixed(2)} * max(0.0, alpha(q) - covered);
  gl_FragColor = vec4(c, 1.0);
}`;

const fgFrag = /* glsl */ `${common}
void main() {
  vec2 q = frame(vec2(vUv.x, 1.0 - vUv.y));
  float a = alpha(q);
  gl_FragColor = vec4(color(q) * a, a);
}`;

export function initHeroVideo({ hero, bg, fg, onLive }) {
  const video = hero.querySelector('[data-hero-video]');
  const api = { live: false, frame() {}, rate() {} };
  if (!video || !hasWebGL()) return api;
  // 1280 en pantallas estrechas o con conexión lenta / ahorro de datos
  const conn = navigator.connection || {};
  const small = matchMedia('(max-width: 899px)').matches || conn.saveData || /2g|3g/.test(conn.effectiveType || '');
  video.src = small ? SRC.small : SRC.desk;
  import(OGL_URL).then((ogl) => setup(ogl)).catch(() => {});
  return api;

  function setup({ Renderer, Program, Mesh, Triangle, Texture }) {
    const mobile = matchMedia('(max-width: 767px), (hover: none)').matches;
    const dpr = Math.min(devicePixelRatio, mobile ? DPR.mob : DPR.desk);
    const st = { w: 0, h: 0, dead: false, first: true, handle: 0, lastT: -1, rel: '', onScreen: true };
    const posters = [bg, fg].map((l) => l.querySelector('[data-hero-poster]'));
    const img = posters[0].querySelector('img');

    const make = (layer, fragment, extra) => {
      const renderer = new Renderer({ dpr, alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
      const { gl } = renderer;
      gl.clearColor(0, 0, 0, 0);
      const canvas = gl.canvas;
      canvas.className = 'sv-hero__gl';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.opacity = '0';
      const tex = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR });
      const program = new Program(gl, {
        vertex,
        fragment,
        uniforms: { tMap: { value: tex }, uScale: { value: [1, 1] }, uOffset: { value: [0, 0] }, uHalf: { value: 0.001 }, ...extra },
        depthTest: false,
        depthWrite: false,
        cullFace: false,
      });
      const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
      layer.appendChild(canvas);
      return { renderer, gl, canvas, tex, mesh, U: program.uniforms };
    };
    const B = make(bg, bgFrag, { uRel: { value: [1, 0, 0] } });
    const F = make(fg, fgFrag, {});
    const both = [B, F];

    // ---------- encaje: el mismo cálculo que object-fit: cover + object-position de los pósters ----------
    function cover() {
      const vw = video.videoWidth || 1920;
      const vh = (video.videoHeight || 2144) / 2;
      const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
      const s = Math.max(st.w / vw, st.h / vh);
      const dw = (vw * s) / st.w;
      const dh = (vh * s) / st.h;
      both.forEach(({ U }) => {
        U.uScale.value = [dw, dh];
        U.uOffset.value = [(1 - dw) * (isNaN(px) ? 0.5 : px), (1 - dh) * (isNaN(py) ? 0.5 : py)];
        U.uHalf.value = 0.5 / (vh * 2);
      });
    }
    function resize() {
      const w = bg.clientWidth;
      const h = bg.clientHeight;
      if (!w || !h) return;
      st.w = w;
      st.h = h;
      both.forEach(({ renderer }) => renderer.setSize(w, h));
      cover();
      if (!st.first) both.forEach(render); // setSize borra el canvas
    }
    resize();
    let raf = 0;
    window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(resize); });

    const render = (L) => L.renderer.render({ scene: L.mesh });
    // un fotograma nuevo: se sube a las dos texturas y se pintan los dos canvas, en el mismo callback
    function paint() {
      if (st.dead || video.readyState < 2) return;
      both.forEach((L) => { L.tex.image = video; L.tex.needsUpdate = true; render(L); });
      if (st.first) {
        // primer fotograma pintado: fuera los pósters en este mismo frame (son el fotograma 0: no hay salto)
        st.first = false;
        both.forEach((L) => { L.canvas.style.opacity = '1'; });
        posters.forEach((p) => { p.style.opacity = '0'; });
        api.live = true;
        onLive?.();
      }
    }
    const rvfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
    const onFrame = () => { paint(); if (!st.dead) st.handle = video.requestVideoFrameCallback(onFrame); };
    if (rvfc) st.handle = video.requestVideoFrameCallback(onFrame);

    // ---------- lo llama el loop del hero en cada tick ----------
    // t: transformaciones de las capas (px y escala; el fondo con origen en el centro, la figura en su origen)
    api.frame = (t) => {
      if (st.dead) return;
      if (!rvfc && video.currentTime !== st.lastT) { st.lastT = video.currentTime; paint(); }
      if (st.first || !st.w) return;
      // punto del fondo → pantalla → punto de la figura (en px del wrapper, que es el mismo para las dos)
      const k = t.bs / t.fs;
      const ox = st.w * 0.5;
      const oy = st.h * 0.5;
      const fx = st.w * t.fox;
      const fy = st.h * t.foy;
      const bx = (ox * (1 - t.bs) + t.bx - fx - t.fx) / t.fs + fx;
      const by = (oy * (1 - t.bs) + t.by - fy - t.fy) / t.fs + fy;
      const rel = [k, bx / st.w, by / st.h];
      const key = rel.map((v) => v.toFixed(4)).join();
      if (key === st.rel) return;
      st.rel = key;
      B.U.uRel.value = rel;
      render(B); // solo cambia el fondo (la figura la mueve el CSS); la textura es la del último fotograma
    };
    let rate = 1;
    api.rate = (r) => {
      if (!api.live || Math.abs(r - rate) < 0.01) return;
      rate = r;
      video.playbackRate = r;
    };

    // ---------- reproducir solo con el hero en pantalla y la pestaña visible ----------
    const sync = () => {
      if (st.dead) return;
      const want = st.onScreen && !document.hidden;
      if (want && video.paused) video.play().catch(() => {}); // autoplay bloqueado: se quedan los pósters
      else if (!want && !video.paused) video.pause();
    };
    new IntersectionObserver(([e]) => { st.onScreen = e.isIntersecting; sync(); }).observe(hero);
    document.addEventListener('visibilitychange', sync);
    video.addEventListener('error', () => { if (st.first) release(); });
    sync();

    // al salir de la página (o si se pierde el contexto) se liberan las texturas y el vídeo; vuelven los pósters
    function release() {
      if (st.dead) return;
      st.dead = true;
      api.live = false;
      if (rvfc && st.handle) video.cancelVideoFrameCallback(st.handle);
      posters.forEach((p) => { p.style.opacity = ''; });
      both.forEach(({ gl, canvas, tex }) => {
        gl.deleteTexture(tex.texture);
        canvas.remove();
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      });
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    window.addEventListener('pagehide', release);
    both.forEach(({ canvas }) => canvas.addEventListener('webglcontextlost', release));
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
