import { gpuOK, levelDpr, dlog } from './gpu.js';

// La bola del hero de portfolio cambia de color al hacer clic (o tap, o Enter/Espacio) sobre ella: Naranja → Oscura →
// Blanca → Gris → Naranja… Al cargar, siempre Naranja (no se recuerda). Sin vídeos nuevos: el vídeo ya viene en
// naranja y los otros colores salen en tiempo real con un "gradient map" en WebGL (un canvas encima del vídeo, dentro
// de .pgh__look: mismo recorte "cover", mismo zoom de la salida y mismo parallax). Naranja = el vídeo tal cual: con la
// transición terminada, el canvas se oculta y se ve el <video> directo (máxima calidad).
//   · El momento de autor: la paleta nueva se extiende como una onda desde el punto exacto del clic (0,7 s,
//     cubic-bezier(.32,.72,0,1)), con el frente un poco más brillante, y la bola hace un pulso (1 → 1.02 → 1, 0,5 s).
//     Los reflejos que se escapan (js/portfolio-hero.js) cambian a la paleta a la vez.
//   · Clics seguidos: el estado de cada píxel es un peso por paleta (RGBA = naranja, oscura, blanca, gris) en una
//     textura pequeña; la onda nueva sale de los pesos de ese momento: sin saltos ni parpadeos, y la bola sigue girando.
//   · Movimiento reducido: sin onda ni pulso, fundido de 0,3 s.
//   · Sin WebGL (gpu.js → 'none'): filtros CSS sobre el vídeo (css/portfolio.css → .is-tint-css).
// El botón (.pgh__ball-btn, portfolio.html) es un círculo invisible encima de la bola (place, desde el loop del hero).
export const COLORS = [
  { key: 'naranja', say: 'Bola naranja', core: [255, 214, 187], halo: [243, 84, 17] },
  { key: 'oscura', say: 'Bola oscura', core: [192, 97, 42], halo: [74, 22, 6], stops: [[0, '0b0909'], [0.25, '160806'], [0.55, '4a1606'], [0.8, '8a3410'], [1, 'c0612a']] },
  { key: 'blanca', say: 'Bola blanca', core: [255, 255, 255], halo: [189, 184, 179], stops: [[0, '0b0909'], [0.22, '2a2826'], [0.5, '8f8a85'], [0.78, 'e6e2dd'], [1, 'ffffff']] },
  { key: 'gris', say: 'Bola gris', core: [201, 197, 192], halo: [74, 70, 68], stops: [[0, '0b0909'], [0.25, '1e1c1b'], [0.55, '4a4644'], [0.8, '8f8a86'], [1, 'c9c5c0']] },
];
const DUR = { wave: 0.7, still: 0.3, pulse: 0.5 };   // s
const PULSE = { to: 0.02, peak: 0.35 };              // escala +2 %, arriba al 35 % del tiempo
const WAVE = { grow: 1.6, edge: 0.14, edgeMin: 60, front: 0.12 }; // radio ∝ e^grow; borde suave (del radio final); +12 % en el frente
const W_DIV = 4;                                     // la textura de pesos, a 1/4 (las máscaras son suaves)

// cubic-bezier(x1, y1, x2, y2) como en CSS (Newton; la curva de la web es monótona)
const bezier = (x1, y1, x2, y2) => {
  const ax = 3 * x1 - 3 * x2 + 1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = ((ax * t + bx) * t + cx) * t - x;
      if (Math.abs(d) < 1e-5) break;
      t -= d / ((3 * ax * t + 2 * bx) * t + cx);
    }
    t = Math.min(1, Math.max(0, t));
    return ((ay * t + by) * t + cy) * t;
  };
};
export const EASE = bezier(0.32, 0.72, 0, 1);

// ---------- shaders (GLSL ES 1.0: WebGL 1 y 2) ----------
const VERT = `attribute vec2 aPos; varying vec2 vUv; varying vec2 vGl;
void main() { vGl = aPos * 0.5 + 0.5; vUv = vec2(vGl.x, 1.0 - vGl.y); gl_Position = vec4(aPos, 0.0, 1.0); }`;
// la onda: 1 dentro del círculo que crece desde el clic (borde suave); con uFlat, uMix en toda la imagen
const WAVE_GLSL = `uniform vec2 uC; uniform vec2 uRes; uniform float uR; uniform float uEdge; uniform float uFlat; uniform float uMix;
float wave() { float d = length((vUv - uC) * uRes); return mix(1.0 - smoothstep(uR - uEdge, uR, d), uMix, uFlat); }`;
const HEAD = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv; varying vec2 vGl;
`;
// pesos: los de antes → la paleta nueva, dentro de la onda
const FRAG_W = `${HEAD}${WAVE_GLSL}
uniform sampler2D uFrom; uniform vec4 uTo;
void main() { gl_FragColor = mix(texture2D(uFrom, vGl), uTo, wave()); }`;
// color: el brillo del vídeo naranja → cada paleta (tramos suaves entre sus 5 paradas); naranja = el vídeo tal cual
const hex = (h) => [0, 2, 4].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(4));
const ramp = (name, stops) => `vec3 ${name}(float v) { vec3 c = vec3(${hex(stops[0][1])});
${stops.slice(1).map(([s, h], i) => `  c = mix(c, vec3(${hex(h)}), smoothstep(${stops[i][0].toFixed(3)}, ${s.toFixed(3)}, v));`).join('\n')}
  return c; }`;
const FRAG_C = `${HEAD}${WAVE_GLSL}
uniform sampler2D uVideo; uniform sampler2D uW; uniform vec2 uScale; uniform vec2 uOffset; uniform float uFront;
${ramp('rDark', COLORS[1].stops)}
${ramp('rWhite', COLORS[2].stops)}
${ramp('rGray', COLORS[3].stops)}
void main() {
  vec3 src = texture2D(uVideo, vUv * uScale + uOffset).rgb;
  float v = clamp((dot(src, vec3(0.55, 0.40, 0.05)) - 0.035) / (0.92 - 0.035), 0.0, 1.0);
  vec4 w = texture2D(uW, vGl);
  vec3 col = (src * w.r + rDark(v) * w.g + rWhite(v) * w.b + rGray(v) * w.a) / max(w.r + w.g + w.b + w.a, 0.001);
  float m = wave();
  col *= 1.0 + uFront * 4.0 * m * (1.0 - m);
  gl_FragColor = vec4(col, 1.0);
}`;

export function initBallColor({ root, look, video, loop, reduced, onTint }) {
  const btn = root.querySelector('[data-ball-btn]');
  const say = root.querySelector('[data-ball-say]');
  if (!btn || !video) return null;
  const still = reduced.matches;
  let cur = 0;                                        // el color elegido (al que va o en el que está)
  const tr = { t0: -1, dur: still ? DUR.still : DUR.wave, c: [0.5, 0.5], from: 0, written: false };
  const pulse = { t0: -1 };
  // los reflejos: del color de antes al nuevo con la misma curva (si llega otro clic, desde donde iban)
  const dot = { core: COLORS[0].core.slice(), halo: COLORS[0].halo.slice(), fc: null, fh: null };
  const ball = { x: 0, y: 0, r: 0 };

  // ---------- el botón: un círculo encima de la bola; fuera de pantalla, no se puede tabular ----------
  let inView = true;
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    btn.tabIndex = inView ? 0 : -1;
  }).observe(btn);
  const place = (x, y, r) => {
    if (Math.abs(x - ball.x) < 0.25 && Math.abs(y - ball.y) < 0.25 && Math.abs(r - ball.r) < 0.25) return;
    if (Math.abs(r - ball.r) >= 0.25) btn.style.width = btn.style.height = `${(r * 2).toFixed(1)}px`;
    Object.assign(ball, { x, y, r });
    btn.style.transform = `translate3d(${(x - r).toFixed(1)}px, ${(y - r).toFixed(1)}px, 0)`;
  };

  // ---------- WebGL (o, sin él, filtros CSS) ----------
  const gl = gpuOK() ? makeGL(look, video) : null;
  if (!gl) look.classList.add('is-tint-css');
  dlog(`bola: color ${gl ? 'WebGL (gradient map)' : 'CSS (filtros de reserva)'}`);

  btn.addEventListener('click', (e) => {
    const now = performance.now() / 1000;
    const r = look.getBoundingClientRect();
    // el punto del clic, en la imagen (con teclado, el centro de la bola)
    const b = btn.getBoundingClientRect();
    const kb = e.detail === 0;
    const px = kb ? b.left + b.width / 2 : e.clientX;
    const py = kb ? b.top + b.height / 2 : e.clientY;
    tr.c = [(px - r.left) / r.width, (py - r.top) / r.height];
    cur = (cur + 1) % COLORS.length;
    dot.fc = dot.core.slice();
    dot.fh = dot.halo.slice();
    if (gl) gl.start(cur, tr);
    else look.dataset.ballColor = COLORS[cur].key;
    tr.t0 = now;
    if (!still) pulse.t0 = now;
    say.textContent = COLORS[cur].say;
  });

  // ---------- cada fotograma (el loop único): la transición, el pulso, los reflejos y el canvas ----------
  loop.add(() => {
    const now = performance.now() / 1000;
    let e = 1;
    if (tr.t0 >= 0) {
      e = EASE(Math.min(1, (now - tr.t0) / tr.dur));
      const to = COLORS[cur];
      for (let i = 0; i < 3; i++) {
        dot.core[i] = dot.fc[i] + (to.core[i] - dot.fc[i]) * e;
        dot.halo[i] = dot.fh[i] + (to.halo[i] - dot.fh[i]) * e;
      }
      onTint?.(dot.core, dot.halo);
    }
    if (gl) gl.frame(cur, tr, e, still, inView && !document.hidden);
    if (tr.t0 >= 0 && e >= 1) tr.t0 = -1;
    if (pulse.t0 >= 0 && now - pulse.t0 >= DUR.pulse) pulse.t0 = -1;
  });

  return {
    place,
    // el pulso (escala de la bola, para js/portfolio-hero.js: se multiplica por el zoom de la salida)
    scale() {
      if (pulse.t0 < 0) return 1;
      const t = Math.min(1, (performance.now() / 1000 - pulse.t0) / DUR.pulse);
      return 1 + PULSE.to * (t < PULSE.peak ? EASE(t / PULSE.peak) : 1 - EASE((t - PULSE.peak) / (1 - PULSE.peak)));
    },
    busy: () => pulse.t0 >= 0,
  };
}

// el canvas del gradient map: un triángulo a pantalla completa, el vídeo como textura (solo cuando hay un fotograma
// nuevo) y los pesos de cada paleta en dos texturas pequeñas que se van turnando (de / a)
function makeGL(look, video) {
  const canvas = document.createElement('canvas');
  canvas.className = 'pgh__tint';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  const opts = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
  const g = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts);
  if (!g) return null;
  const compile = (fs) => {
    const p = g.createProgram();
    for (const [type, src] of [[g.VERTEX_SHADER, VERT], [g.FRAGMENT_SHADER, fs]]) {
      const s = g.createShader(type);
      g.shaderSource(s, src);
      g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s));
      g.attachShader(p, s);
    }
    g.bindAttribLocation(p, 0, 'aPos');
    g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p));
    const u = {};
    const n = g.getProgramParameter(p, g.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = g.getActiveUniform(p, i).name; u[name] = g.getUniformLocation(p, name); }
    return { p, u };
  };
  let pw, pc;
  try { pw = compile(FRAG_W); pc = compile(FRAG_C); } catch (err) { dlog('bola: shader', err.message); return null; }
  g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer());
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
  g.enableVertexAttribArray(0);
  g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
  const tex = () => {
    const t = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, t);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    return t;
  };
  const vtex = tex();
  const W = [0, 1].map(() => ({ t: tex(), fb: g.createFramebuffer() }));
  let wFrom = 0;                                      // el que tiene los pesos de ahora; el otro, el de la onda

  const size = { w: 1, h: 1, cw: 1, ch: 1, dpr: 1, ww: 1, wh: 1 };
  const cover = { sx: 1, sy: 1, ox: 0, oy: 0 };
  const fill = (i, color) => {                        // pesos: toda la imagen de una paleta
    g.bindFramebuffer(g.FRAMEBUFFER, W[i].fb);
    g.viewport(0, 0, size.ww, size.wh);
    g.clearColor(...[0, 1, 2, 3].map((k) => (k === color ? 1 : 0)));
    g.clear(g.COLOR_BUFFER_BIT);
  };
  let shownColor = 0;
  const resize = () => {
    size.cw = look.clientWidth || 1;
    size.ch = look.clientHeight || 1;
    size.dpr = Math.min(devicePixelRatio || 1, levelDpr(2));
    size.w = Math.max(1, Math.round(size.cw * size.dpr));
    size.h = Math.max(1, Math.round(size.ch * size.dpr));
    canvas.width = size.w;
    canvas.height = size.h;
    const ww = Math.max(2, Math.ceil(size.cw / W_DIV)), wh = Math.max(2, Math.ceil(size.ch / W_DIV));
    if (ww !== size.ww || wh !== size.wh) {
      size.ww = ww; size.wh = wh;
      // (al cambiar de tamaño, los pesos de ahora se pierden: la imagen, del color elegido)
      W.forEach((w) => {
        g.bindTexture(g.TEXTURE_2D, w.t);
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, ww, wh, 0, g.RGBA, g.UNSIGNED_BYTE, null);
        g.bindFramebuffer(g.FRAMEBUFFER, w.fb);
        g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, w.t, 0);
      });
      fill(0, shownColor); fill(1, shownColor);
    }
    measureCover();
    dirty = true;
  };
  // el recorte "cover" del vídeo con su object-position (el de js/config.js → pos), como lo pinta el <video>
  const measureCover = () => {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return;
    const [px, py] = getComputedStyle(video).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
    const s = Math.max(size.cw / vw, size.ch / vh);
    const w = vw * s, h = vh * s;
    cover.sx = size.cw / w;
    cover.sy = size.ch / h;
    cover.ox = -((size.cw - w) * (Number.isFinite(px) ? px : 0.5)) / w;
    cover.oy = -((size.ch - h) * (Number.isFinite(py) ? py : 0.5)) / h;
  };
  look.append(canvas);
  let dirty = true;
  // un fotograma nuevo del vídeo por subir: requestVideoFrameCallback; sin él, si ha cambiado su tiempo
  const rvfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  let fresh = true;
  let lastT = -1;
  let hasFrame = false;
  if (rvfc) {
    const onFrame = () => { fresh = true; video.requestVideoFrameCallback(onFrame); };
    video.requestVideoFrameCallback(onFrame);
  }
  new ResizeObserver(resize).observe(look);
  video.addEventListener('resize', resize);           // otra versión del vídeo (al girar la pantalla): otro tamaño
  video.addEventListener('loadedmetadata', resize);
  resize();
  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    canvas.hidden = true;
    look.classList.add('is-tint-css');               // sin contexto: los filtros de reserva, con el color de ahora
    look.dataset.ballColor = COLORS[shownColor].key;
  });

  const waveUniforms = (u, tr, e, still) => {
    const [cx, cy] = tr.c;
    const dx = Math.max(cx, 1 - cx) * size.cw, dy = Math.max(cy, 1 - cy) * size.ch;
    const rMax = Math.hypot(dx, dy);
    const edge = Math.max(WAVE.edgeMin, rMax * WAVE.edge);
    g.uniform2f(u.uC, cx, cy);
    g.uniform2f(u.uRes, size.cw, size.ch);
    g.uniform1f(u.uR, Math.pow(e, WAVE.grow) * (rMax + edge));
    g.uniform1f(u.uEdge, edge);
    g.uniform1f(u.uFlat, still ? 1 : 0);
    g.uniform1f(u.uMix, e);
  };

  return {
    // un clic: la onda sale de los pesos de ahora (si la anterior no llegó a pintar ni un fotograma, de los de antes)
    start(color, tr) {
      if (lost) { look.dataset.ballColor = COLORS[color].key; return; }
      if (tr.t0 >= 0 && tr.written) wFrom = 1 - wFrom;
      tr.written = false;
      shownColor = color;
    },
    frame(color, tr, e, still, visible) {
      if (lost) return;
      const moving = tr.t0 >= 0;
      const show = moving || color !== 0;
      if (!show) {
        if (!canvas.hidden) canvas.hidden = true;     // naranja y quieta: el vídeo directo
        return;
      }
      if (!visible) {                                 // fuera de pantalla: ni sube el vídeo ni pinta
        if (moving && e >= 1) { fill(wFrom, color); dirty = true; }
        return;
      }
      if (video.readyState >= 2 && (!hasFrame || (rvfc ? fresh : video.currentTime !== lastT))) {
        g.bindTexture(g.TEXTURE_2D, vtex);
        g.texImage2D(g.TEXTURE_2D, 0, g.RGB, g.RGB, g.UNSIGNED_BYTE, video);
        if (!hasFrame) measureCover();
        hasFrame = true;
        fresh = false;
        lastT = video.currentTime;
        dirty = true;
      }
      if (!hasFrame || !(dirty || moving)) return;
      const wTo = 1 - wFrom;
      if (moving) {
        // 1) pesos: los de ahora → la paleta nueva, dentro de la onda
        g.bindFramebuffer(g.FRAMEBUFFER, W[wTo].fb);
        g.viewport(0, 0, size.ww, size.wh);
        g.useProgram(pw.p);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, W[wFrom].t);
        g.uniform1i(pw.u.uFrom, 0);
        g.uniform4f(pw.u.uTo, ...[0, 1, 2, 3].map((k) => (k === color ? 1 : 0)));
        waveUniforms(pw.u, tr, e, still);
        g.drawArrays(g.TRIANGLES, 0, 3);
        tr.written = true;
      }
      // 2) color
      g.bindFramebuffer(g.FRAMEBUFFER, null);
      g.viewport(0, 0, size.w, size.h);
      g.useProgram(pc.p);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, vtex);
      g.uniform1i(pc.u.uVideo, 0);
      g.activeTexture(g.TEXTURE1);
      g.bindTexture(g.TEXTURE_2D, W[moving ? wTo : wFrom].t);
      g.uniform1i(pc.u.uW, 1);
      g.uniform2f(pc.u.uScale, cover.sx, cover.sy);
      g.uniform2f(pc.u.uOffset, cover.ox, cover.oy);
      waveUniforms(pc.u, tr, moving ? e : 1, still);
      g.uniform1f(pc.u.uFront, moving && !still ? WAVE.front : 0);
      g.drawArrays(g.TRIANGLES, 0, 3);
      dirty = false;
      if (canvas.hidden) canvas.hidden = false;
      // al terminar: los pesos, de la paleta nueva en toda la imagen (el siguiente clic sale de ahí)
      if (moving && e >= 1) { wFrom = wTo; fill(wFrom, color); }
    },
  };
}
