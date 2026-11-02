// Fondo vivo "malla de color" (mesh gradient, port vanilla del de Paper Shaders; css/malla.css). Un solo <canvas
// id="malla"> fijo debajo de todo, en el ticker único de la web: empieza donde acaba el hero y llega al footer. Manda el
// negro; el naranja y un blanco cálido son luz que deriva muy despacio. Secciones (data-malla): "open" (o nada), color
// completo; "quiet", color a la mitad (o data-malla-calm, si el texto lo pide); "light", la malla se funde a papel.
// No pinta mientras el hero (o algo opaco: estudio, REC, "Tres oficios") cubre la pantalla, ni con la pestaña oculta.
// La luz nunca choca con un borde opaco (el hero, "Tres oficios", el footer): se apaga a negro al llegar (u_edge,
// u_floor). Los fondos de las secciones solo pasan a
// transparente cuando ya hay malla (html.malla-on): si tarda o no llega, la web sigue como antes.
// Nosotros: está debajo de todo desde arriba (la aurora va encima, js/aurora.js), con la luz abajo a la izquierda, y
// al salir del hero vuelve a su sitio.
// Calidad: media resolución; en nivel 'low' (js/gpu.js) o gama baja, menos resolución y 30 fps. Nivel 'none': fondo
// estático (css). Movimiento reducido: un fotograma fijo, que se redibuja al cambiar de sección clara a oscura.
import { gpuLevel, lowEnd, dlog, isDebug } from './gpu.js';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
// Mezcla "Destello" (aprobada). 6 huecos: el negro ocupa varios para que domine; en claro, papel ocupa esos mismos
const N = '#0b0909'; const BR = '#3a1005'; const OR = '#F35411'; const CR = '#ffd6bb';
const PA = '#f4f2ef'; const ME = '#f7d9c4'; const SO = '#f6a77c';
const DARK = [N, N, BR, OR, N, CR].map(hex);
const LIGHT = [PA, PA, ME, SO, PA, '#ffffff'].map(hex);
const SPREAD = 0.5;
const SIZE = 0.3;
const CALM_QUIET = 0.5;
const OFF = [-0.18, -0.12];       // luz arriba a la derecha, lejos de los titulares
const OFF_ABOUT = [0.2, 0.18];    // nosotros: abajo a la izquierda (arriba está la aurora)
const SCALE = { normal: 0.55, low: 0.4 };
const MAX_DPR = 2;
const COVERED = 0.98;             // de pantalla: tapada del todo
const HERO = '#hero-main, .pgh, .pj-cover';
const OPAQUE = '#estudio.is-lit, .rec, .oficios';
const BOUNDS = '.pgh, .pj-cover, .oficios, .pj-seq, .fin'; // opacos sobre negro: la luz se apaga antes de tocarlos
const REST = 0.15;                // s sin scroll: la transición a papel se resuelve (nunca se queda en gris)
// proyecto.html se pinta desde js/proyecto.js: sus secciones densas se marcan aquí
const QUIET = '.pj-sheet, .pj-reels, #galeria';

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG = `precision highp float;
uniform vec3 u_c[6]; uniform vec2 u_res; uniform float u_t,u_spread,u_size,u_calm,u_light,u_edge,u_floor; uniform vec3 u_m; uniform vec2 u_off;
float h12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
void main(){
  vec2 uv=gl_FragCoord.xy/u_res;
  vec2 p=(gl_FragCoord.xy-.5*u_res)/min(u_res.x,u_res.y);
  vec2 cur=.5*u_m.xy*u_res/min(u_res.x,u_res.y); vec2 d=p-cur; float cm=u_m.z*(1.-smoothstep(0.,.55,length(d)));
  float a=cm*.9; p=cur+mat2(cos(a),-sin(a),sin(a),cos(a))*d;
  p*=1.15; p+=u_off;
  vec3 col=u_c[0]*.2; float w=.2; float fall=mix(12.,2.4,u_size);
  for(int i=0;i<6;i++){ float fi=float(i);
    vec2 c=vec2(sin(fi*2.17+u_t*.13+1.),cos(fi*1.63-u_t*.11))*(.22+u_spread*.62);
    float inf=exp(-dot(p-c,p-c)*fall); col+=u_c[i]*inf; w+=inf; }
  col/=w;
  vec3 base=mix(vec3(.043,.035,.035),vec3(.957,.949,.937),u_light);
  col=mix(base,col,u_calm);
  float vd=length(uv-vec2(.25,.3));
  col=mix(col,base,(1.-u_light)*smoothstep(.15,.75,1.-vd)*.35);
  col=mix(base,col,smoothstep(0.,.18,1.-uv.y-u_edge)*smoothstep(0.,.18,u_floor-(1.-uv.y)));
  col+=(h12(gl_FragCoord.xy+fract(u_t)*97.)-.5)*.045;
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const cover = (r, H) => Math.max(0, (Math.min(r.bottom, H) - Math.max(r.top, 0)) / H);

function start() {
  const cv = document.getElementById('malla');
  if (!cv) return;
  const root = document.documentElement;
  const level = gpuLevel();
  if (level === 'none') {
    cv.classList.add('malla--static');
    root.classList.add('malla-static');
    dlog('malla: fondo estático (sin WebGL)');
    return;
  }
  const opts = { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' };
  const gl = cv.getContext('webgl', opts);
  if (!gl) {
    cv.classList.add('malla--static');
    root.classList.add('malla-static');
    return;
  }
  const { gsap } = window;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const low = level === 'low' || lowEnd();
  const fine = matchMedia('(any-pointer: fine)').matches;
  const about = document.querySelector('[data-nh]');
  const scale = low ? SCALE.low : SCALE.normal;
  dlog(`malla: nivel ${level}, escala ${scale}${low ? ', 30 fps' : ''}`);

  // ---------- programa (compilación en paralelo: preguntar antes de tiempo congela la página) ----------
  const par = gl.getExtension('KHR_parallel_shader_compile');
  let prog = null;
  let U = null;
  let linked = false;
  let lost = false;
  const compile = () => {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    linked = false;
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
  };
  const size = { w: 0, h: 0 };
  const fit = () => {
    const dpr = Math.min(devicePixelRatio || 1, MAX_DPR) * scale;
    const w = Math.max(1, Math.round(innerWidth * dpr));
    const h = Math.max(1, Math.round(innerHeight * dpr));
    if (w === size.w && h === size.h) return;
    size.w = w;
    size.h = h;
    cv.width = w;
    cv.height = h;
    gl.viewport(0, 0, w, h);
    if (linked) gl.uniform2f(U.u_res, w, h);
    state.dirty = true;
  };
  const link = () => {
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(prog));
    linked = true;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    U = {};
    ['u_c', 'u_res', 'u_t', 'u_spread', 'u_size', 'u_calm', 'u_light', 'u_edge', 'u_floor', 'u_m', 'u_off'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1f(U.u_spread, SPREAD);
    gl.uniform1f(U.u_size, SIZE);
    size.w = 0;
    fit();
  };

  // ---------- secciones (la lista se rehace si cambia la altura de la página: proyecto.html se pinta después) ----------
  let lights = [];
  let quiets = [];
  let opaques = [];
  let bounds = [];
  const hero = document.querySelector(HERO);
  const collect = () => {
    document.querySelectorAll(QUIET).forEach((el) => { if (!el.dataset.malla) el.dataset.malla = 'quiet'; });
    lights = [...document.querySelectorAll('[data-malla="light"]')];
    quiets = [...document.querySelectorAll('[data-malla="quiet"]')];
    opaques = [...document.querySelectorAll(OPAQUE)];
    bounds = about ? [...document.querySelectorAll('.fin')] : [...document.querySelectorAll(BOUNDS)];
  };
  collect();
  new ResizeObserver(collect).observe(document.body);

  // ---------- estado ----------
  const state = { light: 0, calm: 1, mx: 0, my: 0, tx: 0, ty: 0, on: 0, ton: 0, dirty: true, first: true, key: '' };
  const colors = new Float32Array(18);
  let last = -1;
  let lastY = -1;
  let still = 0;
  const stats = { drawn: 0 };
  if (isDebug()) window.__malla = stats;
  if (fine && !reduced) {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      state.tx = (e.clientX / innerWidth) * 2 - 1;
      state.ty = 1 - (e.clientY / innerHeight) * 2;
      state.ton = 1;
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { state.ton = 0; });
  }

  const tick = (time, deltaMs) => {
    if (document.hidden || lost) return;
    if (!linked) {
      if (par && !gl.getProgramParameter(prog, par.COMPLETION_STATUS_KHR)) return;
      try { link(); } catch (e) { dlog('malla: error de shader', e); cv.classList.add('malla--static'); root.classList.add('malla-static'); gsap.ticker.remove(tick); return; }
    }
    const H = innerHeight;
    const dt = Math.min(deltaMs / 1000, 0.1);
    // ¿tapada? (en nosotros no: forma parte del hero)
    const heroR = hero ? hero.getBoundingClientRect() : null;
    const homeCovering = hero && hero.id === 'hero-main' && !hero.classList.contains('is-covered') && !reduced;
    let hidden = !about && !!heroR && (homeCovering || cover(heroR, H) >= COVERED);
    if (!hidden) hidden = opaques.some((el) => cover(el.getBoundingClientRect(), H) >= COVERED);

    // papel y calma, según cuánto cubren sus secciones
    const lt = lights.reduce((m, el) => Math.max(m, cover(el.getBoundingClientRect(), H)), 0);
    let toLight = clamp((lt - 0.36) / 0.22);
    // con el scroll sigue el gesto; parado, se resuelve hacia claro u oscuro
    const y = window.scrollY;
    still = y === lastY ? still + dt : 0;
    lastY = y;
    if (still > REST) toLight = Math.round(toLight);
    const toCalm = quiets.reduce((m, el) => Math.min(m, 1 - (1 - (+el.dataset.mallaCalm || CALM_QUIET)) * clamp(cover(el.getBoundingClientRect(), H) / 0.6)), 1);
    if (state.first) {
      state.light = toLight;
      state.calm = toCalm;
    } else {
      state.light += (toLight - state.light) * (1 - Math.exp(-dt * 6));
      state.calm += (toCalm - state.calm) * (1 - Math.exp(-dt * 2.2));
    }
    if (hidden) return;

    // movimiento reducido: solo se redibuja al cambiar de clara a oscura
    if (reduced) {
      const key = `${toLight.toFixed(1)}|${toCalm.toFixed(1)}`;
      if (key === state.key && !state.dirty && Math.abs(toLight - state.light) < 0.01) return;
      state.key = key;
    }
    if (low) {
      if (time - last < 1 / 30 - 0.002) return;
      last = time;
    }
    state.mx += (state.tx - state.mx) * (1 - Math.exp(-dt * 4));
    state.my += (state.ty - state.my) * (1 - Math.exp(-dt * 4));
    state.on += (state.ton - state.on) * (1 - Math.exp(-dt * 4));

    const L = state.light;
    for (let i = 0; i < 6; i++) for (let k = 0; k < 3; k++) colors[i * 3 + k] = DARK[i][k] + (LIGHT[i][k] - DARK[i][k]) * L;
    // nosotros: la luz vuelve a su sitio con el progreso del scroll por el hero
    const pa = about ? clamp(-about.getBoundingClientRect().top / Math.max(1, about.offsetHeight)) : 1;
    gl.uniform3fv(U.u_c, colors);
    gl.uniform1f(U.u_t, reduced ? 4 : time * 0.58);
    gl.uniform1f(U.u_calm, state.calm);
    gl.uniform1f(U.u_light, L);
    let edge = -1;
    let floor = 2;
    for (const el of bounds) {
      const r = el.getBoundingClientRect();
      if (r.top + r.height / 2 < H / 2) edge = Math.max(edge, r.bottom / H);
      else floor = Math.min(floor, r.top / H);
    }
    gl.uniform1f(U.u_edge, edge);
    gl.uniform1f(U.u_floor, floor);
    gl.uniform3f(U.u_m, state.mx, state.my, fine ? state.on * 0.8 : 0);
    gl.uniform2f(U.u_off, OFF_ABOUT[0] + (OFF[0] - OFF_ABOUT[0]) * pa, OFF_ABOUT[1] + (OFF[1] - OFF_ABOUT[1]) * pa);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    stats.drawn++;
    state.dirty = false;
    if (state.first) {
      state.first = false;
      root.classList.add('malla-on');
      cv.classList.add('is-on');
    }
  };

  window.addEventListener('resize', () => { if (linked) fit(); });
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; dlog('malla: contexto perdido'); });
  cv.addEventListener('webglcontextrestored', () => { size.w = 0; compile(); lost = false; state.dirty = true; });
  window.addEventListener('pagehide', (e) => { if (!e.persisted) gsap.ticker.remove(tick); });
  compile();
  gsap.ticker.add(tick);
}

const later = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 200));
if (document.readyState === 'complete') later();
else window.addEventListener('load', later, { once: true });
