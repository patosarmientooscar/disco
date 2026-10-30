// Aurora (nosotros.html, el hero; css/about.css): un velo de luz de escenario con los colores de disco que entra
// por arriba. Traducción a vanilla de shader-aurora-veil (React) con su misma técnica: WebGL1 sin three, un solo
// triángulo a pantalla completa, un draw por fotograma (en el gsap.ticker de la web, no un rAF propio), solo con el
// hero en pantalla, DPR y píxeles limitados, y pérdida de contexto gestionada. Sin WebGL: el degradado CSS de su
// contenedor (.nh__aurora). Movimiento reducido: un solo fotograma (t = 18). Gama baja (deviceMemory ≤ 4): 0.75 de
// resolución y 30 fps.
const MAX_DPR = 1.35;
const MAX_PIXELS = 620000;
const POINTER_LERP = 0.05;
const STILL_T = 18;

const VERT = 'attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.0,1.0);}';
const FRAG = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_pointer;
uniform float u_intensity;
uniform float u_scroll;

vec3 saturate(vec3 c, float s) { float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); return mix(vec3(l), c, s); }
mat2 rotate2d(float a) { float s = sin(a); float c = cos(a); return mat2(c, -s, s, c); }
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash21(i); float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)); float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5; mat2 r = rotate2d(0.5);
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = r * p * 2.0 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

vec3 shaderColor(vec2 uv, vec2 p, float t, vec2 pointer, float intensity) {
  vec2 q = p;
  q += pointer * 0.06;                                   // inclinación sutil hacia el ratón
  q.x += sin(q.y * 2.0 + t * 0.18) * 0.22;
  q.y += cos(q.x * 1.7 - t * 0.14) * 0.16;
  float veilA = smoothstep(0.78, 0.04, abs(q.y - 0.74 + sin(q.x * 1.8 + t * 0.24) * 0.24)); // velo naranja (arriba)
  float veilB = smoothstep(0.42, 0.02, abs(q.y - 1.0 - cos(q.x * 2.4 - t * 0.20) * 0.14));  // velo blanco (más arriba, más fino)
  float veilC = smoothstep(0.9, 0.1, abs(q.y - 0.5 + sin(q.x * 1.2 - t * 0.11) * 0.3));     // brasa rojiza profunda
  float grain = fbm(q * 2.5 + t * 0.04);
  vec3 base   = vec3(0.043, 0.035, 0.035);              // #0b0909
  vec3 orange = vec3(0.953, 0.329, 0.067);              // #F35411
  vec3 ember  = vec3(0.55, 0.12, 0.03);
  vec3 white  = vec3(0.957, 0.949, 0.937);              // #f4f2ef
  vec3 color = base + ember * veilC * 0.35 + orange * veilA * 0.62 + white * veilB * 0.22;
  color = mix(color, color + white * 0.08, veilA * veilB);   // donde se cruzan, brillo cálido
  color += (grain - 0.5) * 0.03;
  color *= mix(1.0, 0.35, u_scroll);                     // se apaga al hacer scroll
  return saturate(color, 1.05) * (0.86 + intensity * 0.2);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = vec2((uv.x - 0.5) * (u_resolution.x / u_resolution.y), uv.y); // y: 0 abajo, 1 arriba
  vec3 color = shaderColor(uv, p, u_time, u_pointer, u_intensity);
  gl_FragColor = vec4(pow(max(color, 0.0), vec3(0.92)), 1.0);
}`;

export function initAurora({ canvas, stage, loop, reduced }) {
  if (!canvas) return null;
  const low = (navigator.deviceMemory || 8) <= 4;
  const still = reduced.matches;
  const opts = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false };
  let gl = null;
  try { gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts); } catch { gl = null; }
  if (!gl) return null; // el degradado CSS de .nh__aurora se queda

  let prog = null;
  let U = null;
  let lost = false;
  let linked = false;
  // compilación en paralelo (sin preguntar el estado hasta que está lista: preguntarlo antes congela la página)
  const par = gl.getExtension('KHR_parallel_shader_compile');
  const compile = () => {
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    linked = false;
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
  };
  const setup = () => {
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(prog));
    linked = true;
    gl.useProgram(prog);
    // un solo triángulo que cubre la pantalla
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    U = ['u_resolution', 'u_time', 'u_pointer', 'u_intensity', 'u_scroll'].reduce((o, n) => { o[n] = gl.getUniformLocation(prog, n); return o; }, {});
    gl.uniform1f(U.u_intensity, 1);
    size.w = 0; // fuerza el tamaño
  };

  // tamaño: DPR ≤ 1.35 y ≤ 620 000 píxeles (gama baja: × 0.75)
  const size = { w: 0, h: 0 };
  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    let dpr = Math.min(devicePixelRatio || 1, MAX_DPR) * (low ? 0.75 : 1);
    if (w * h * dpr * dpr > MAX_PIXELS) dpr = Math.sqrt(MAX_PIXELS / (w * h));
    const W = Math.max(1, Math.round(w * dpr));
    const H = Math.max(1, Math.round(h * dpr));
    if (W === size.w && H === size.h) return;
    size.w = W;
    size.h = H;
    canvas.width = W;
    canvas.height = H;
    gl.viewport(0, 0, W, H);
    gl.uniform2f(U.u_resolution, W, H);
    dirty = true;
  };

  const ptr = { tx: 0, ty: 0, x: 0, y: 0 };
  let inView = true;
  let dirty = true;
  let t0 = performance.now();
  let last = -1;
  let shown = false;

  compile();
  const ro = new ResizeObserver(() => { if (linked) resize(); });
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { rootMargin: '40px' });
  io.observe(stage);
  if (!still) {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      ptr.tx = (e.clientX / innerWidth) * 2 - 1;
      ptr.ty = 1 - (e.clientY / innerHeight) * 2;
    }, { passive: true });
  }

  const frame = (time, ratio) => {
    if (lost || !inView || document.hidden) return;
    if (!linked) {
      if (par && !gl.getProgramParameter(prog, par.COMPLETION_STATUS_KHR)) return; // aún compilando
      try { setup(); resize(); } catch { off(); return; } // el degradado CSS se queda
    }
    if (still && !dirty) return;
    const now = performance.now();
    if (low && !still && now - last < 1000 / 30 - 2) return; // 30 fps
    last = now;
    const a = 1 - Math.pow(1 - POINTER_LERP, ratio || 1);
    ptr.x += (ptr.tx - ptr.x) * a;
    ptr.y += (ptr.ty - ptr.y) * a;
    const r = stage.getBoundingClientRect();
    const scroll = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
    gl.uniform1f(U.u_time, still ? STILL_T : (now - t0) / 1000);
    gl.uniform2f(U.u_pointer, ptr.x, ptr.y);
    gl.uniform1f(U.u_scroll, scroll);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    dirty = false;
    if (!shown) { shown = true; canvas.classList.add('is-on'); } // fundido de 0.6 s (css/about.css)
  };
  const off = loop.add(frame);

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => {
    compile();
    lost = false;
    dirty = true;
  });
  // al salir de la página se libera la GPU (en la caché de atrás/adelante, no: al volver sigue)
  window.addEventListener('pagehide', (e) => {
    if (e.persisted) return;
    off();
    ro.disconnect();
    io.disconnect();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  });
  return { canvas };
}
