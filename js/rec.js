import { CROSS, crossAt } from './studio-cross.js';
import { gpuOK } from './gpu.js';

// "Dale al REC." → estudio (home, css/rec.css). La frase se queda fija en el centro durante el tramo (130vh; 100vh
// en móvil) y el piloto REC se convierte en la luz que descubre el estudio:
//   u_p 0 → .35   un halo naranja alrededor del punto REC que respira; el resto, negro
//   u_p .35 → .75 el halo se abre como una fuga de luz de película: bandas cálidas que entran desde la derecha
//                 y se doblan, con aberración cromática suave en los bordes (no en móvil) y grano
//   u_p .75 → 1   todo el plano llega al naranja del papel del set (el estudio, js/studio.js)
// La frase pasa de papel a negro cuando el fondo se aclara y al final se desenfoca y sube. Después, mientras el
// estudio sube desde abajo, el panorama aparece encima con un fundido (canvas del destello, js/studio.js) y este
// plano baja su opacidad: los colores casan, se ve como una sola luz que se convierte en el estudio
// (js/studio-cross.js; LEGACY: el iris de seis palas, en legacy/js/iris.js). El cursor mueve un poco las manchas;
// la velocidad del scroll aviva la fuga.
// El plano OGL solo existe cerca del tramo (se crea al acercarse y se destruye al salir). Movimiento reducido:
// sin plano ni pin, un degradado fijo (CSS).
const OGL = 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm';
// paleta: negro → brasa → rojo → naranja de marca → casi luz (el final cae entre el naranja y la luz: el set)
const PALETTE = ['#0b0909', '#3a0f06', '#a3300c', '#F35411', '#ffb27f'];
const P_EASE = 8;          // 1/s: suavizado del progreso (Lenis ya suaviza el scroll; esto quita el último escalón)
const MOUSE_EASE = 2.5;    // 1/s: los blobs siguen al cursor con mucha inercia
const BOOST = { gain: 1 / 45, attack: 6, release: 1.4 }; // |velocidad de Lenis| → intensidad extra de la fuga
const GRAIN = 0.06;

const vertex = /* glsl */ `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const fragment = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uP;
uniform float uTime;
uniform vec2 uRec;       // centro del piloto REC (px del canvas, origen abajo)
uniform vec2 uMouse;     // -0.5..0.5, suavizado
uniform float uBoost;    // 0..1: velocidad del scroll
uniform float uCA;       // 1 = aberración cromática (escritorio)
${PALETTE.map((h, i) => `const vec3 PAL${i} = vec3(${[1, 3, 5].map((k) => (parseInt(h.slice(k, k + 2), 16) / 255).toFixed(4)).join(', ')});`).join('\n')}

// ruido simplex 2D (Ashima Arts / Stefan Gustavson, MIT)
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 pal(float t) {
  t = clamp(t, 0.0, 1.0) * 4.0;
  vec3 c = mix(PAL0, PAL1, clamp(t, 0.0, 1.0));
  c = mix(c, PAL2, clamp(t - 1.0, 0.0, 1.0));
  c = mix(c, PAL3, clamp(t - 2.0, 0.0, 1.0));
  return mix(c, PAL4, clamp(t - 3.0, 0.0, 1.0));
}

// luz en un punto (uv centrado, en unidades del lado corto): halo del REC + fuga de luz
float light(vec2 uv, vec2 rp, vec2 warp, float n1, float ax) {
  float p = uP;
  // halo que respira alrededor del piloto; crece un poco hasta .35
  float r = mix(0.03, 0.15, smoothstep(0.0, 0.35, p)) * (1.0 + 0.08 * sin(uTime * 2.2));
  float d = length(uv - rp);
  float halo = exp(-(d * d) / (r * r) * 1.4);
  // fuga de luz: un frente que entra desde la derecha y barre la pantalla, con bandas que se doblan
  float lp = smoothstep(0.3, 0.78, p);
  vec2 w = uv + warp;
  float bend = w.y * 0.3 + w.y * w.y * 0.55;
  float s = (0.5 * ax - w.x) + bend * 0.35;                     // 0 en el borde derecho, crece hacia la izquierda
  float front = lp * (ax + 0.9) + uBoost * 0.12;
  float leak = smoothstep(front, front - 0.5, s) * smoothstep(0.0, 0.08, lp + uBoost * 0.2);
  // las bandas pierden contraste a medida que la luz lo llena (al final, casi lisa: la frase en negro se lee)
  float depth = mix(0.4, 0.14, smoothstep(0.5, 0.85, p));
  float bands = 1.0 - depth + depth * sin(w.x * 3.0 + w.y * 4.6 + bend * 5.0 - uTime * 0.45 + n1 * 1.6);
  // el halo se funde en la fuga (sin disco suelto encima)
  halo *= 1.0 - smoothstep(0.45, 0.7, p);
  return max(halo * 0.82, leak * bands * (0.6 + 0.22 * lp + uBoost * 0.25));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float side = min(uRes.x, uRes.y);
  float ax = uRes.x / side;
  vec2 uv = (frag - 0.5 * uRes) / side;
  vec2 rp = (uRec - 0.5 * uRes) / side;
  vec2 m = uMouse * 0.08;
  float t = uTime;
  // manchas del mesh gradient (ruido lento); el cursor las desplaza un poco
  float n1 = snoise(uv * 1.2 + vec2(t * 0.05, -t * 0.04) + m);
  float n2 = snoise(uv * 2.1 - vec2(t * 0.03, t * 0.06) - m * 0.6 + 3.1);
  float blobs = 0.5 + 0.35 * n1 + 0.15 * n2;
  vec2 warp = 0.18 * vec2(snoise(uv * 1.4 + t * 0.07 + m), snoise(uv * 1.4 - t * 0.06 + 7.0 - m));
  float fin = smoothstep(0.66, 0.96, uP);
  // aberración cromática: R y B leen la luz un poco desplazados (hacia/desde el centro), solo en la fuga
  float ca = uCA * 0.007 * smoothstep(0.3, 0.6, uP) * (1.0 - fin);
  vec2 dir = normalize(uv - rp + 1e-4);
  vec3 f = vec3(light(uv + dir * ca, rp, warp, n1, ax), light(uv, rp, warp, n1, ax), light(uv - dir * ca, rp, warp, n1, ax));
  f *= 0.82 + 0.36 * blobs;
  // al final: todo el plano en el naranja del set, vivo (las manchas siguen moviéndose un poco)
  float target = 0.77 + 0.07 * (blobs - 0.5);
  f = mix(f, vec3(target), fin);
  vec3 col = vec3(pal(f.r).r, pal(f.g).g, pal(f.b).b);
  // grano de película
  col += (hash(frag + fract(t * 7.0) * 113.0) - 0.5) * ${GRAIN.toFixed(2)};
  gl_FragColor = vec4(col, 1.0);
}`;

export function initRec({ gsap, ScrollTrigger, lenis, loop, reduced }) {
  const rec = document.querySelector('[data-rec]');
  const txt = rec?.querySelector('[data-bridge]');
  if (!rec || !txt) return;
  // el texto entero para lectores de pantalla; las letras animadas, ocultas para ellos
  const text = txt.textContent.trim();
  const words = text.replace(/\.$/, '').split(/\s+/);
  txt.innerHTML = `<span class="sr-only">${text}</span>${words.map((w) => `<span class="bw" aria-hidden="true">${[...w].map((ch) => `<span class="bl">${ch}</span>`).join('')}</span>`).join(' ')}<i class="rec__dot" aria-hidden="true"></i>`;
  const dot = txt.querySelector('.rec__dot');
  if (reduced.matches) return;

  // letra a letra (.18 → 1) mientras la frase sube hasta el centro
  gsap.to(txt.querySelectorAll('.bl'), {
    opacity: 1,
    ease: 'none',
    stagger: 0.08,
    scrollTrigger: { trigger: txt, start: 'top 85%', end: 'center 52%', scrub: 0.6 },
  });
  // el piloto: parpadea; fijo cuando se enciende el estudio
  window.addEventListener('disco:studio-shot', () => dot.classList.add('is-steady'));
  window.addEventListener('disco:studio-dark', () => dot.classList.remove('is-steady'));

  // reacción de la frase con el progreso del tramo (paused: su progreso = u_p)
  const react = gsap.timeline({ paused: true })
    .fromTo(dot, { scale: 1, opacity: 1 }, { scale: 2.2, opacity: 0, ease: 'power1.in', duration: 0.16 }, 0.3)
    .fromTo(txt, { color: '#f4f2ef' }, { color: '#0b0909', ease: 'sine.inOut', duration: 0.2 }, 0.58)
    .fromTo(txt, { filter: 'blur(0px)', y: 0, opacity: 1 }, { filter: 'blur(12px)', y: -40, opacity: 0, ease: 'power2.in', duration: 0.18 }, 0.82);
  react.set({}, {}, 1); // la línea de tiempo dura exactamente 1

  const state = { p: 0, to: 0, mx: 0, my: 0, tmx: 0, tmy: 0, boost: 0 };
  ScrollTrigger.create({
    trigger: rec,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => { state.to = self.progress; },
    onRefresh: (self) => { state.to = self.progress; state.p = self.progress; },
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    state.tmx = e.clientX / innerWidth - 0.5;
    state.tmy = 0.5 - e.clientY / innerHeight;
  }, { passive: true });

  const studio = document.getElementById('estudio');
  const mobile = matchMedia('(max-width: 767px)');
  let gl = null;      // { renderer, program, mesh, canvas }
  let making = false;
  let alive = false;

  const create = async () => {
    alive = true;
    if (gl || making || !gpuOK()) return; // sin GPU de verdad (js/gpu.js): el fondo, sin el plano
    making = true;
    let O;
    try { O = await import(OGL); } catch { making = false; return; }
    making = false;
    if (!alive || gl) return;
    const renderer = new O.Renderer({ dpr: Math.min(devicePixelRatio, 1), alpha: false, antialias: false, depth: false });
    const canvas = renderer.gl.canvas;
    canvas.className = 'rec-gl';
    canvas.setAttribute('aria-hidden', 'true');
    const program = new O.Program(renderer.gl, {
      vertex,
      fragment,
      uniforms: {
        uRes: { value: [1, 1] },
        uP: { value: 0 },
        uTime: { value: 0 },
        uRec: { value: [0, 0] },
        uMouse: { value: [0, 0] },
        uBoost: { value: 0 },
        uCA: { value: 1 },
      },
    });
    const mesh = new O.Mesh(renderer.gl, { geometry: new O.Triangle(renderer.gl), program });
    const size = () => {
      renderer.setSize(innerWidth, innerHeight);
      program.uniforms.uRes.value = [renderer.gl.drawingBufferWidth, renderer.gl.drawingBufferHeight];
    };
    size();
    window.addEventListener('resize', size);
    document.body.append(canvas);
    gl = { renderer, program, mesh, canvas, size };
  };
  const destroy = () => {
    alive = false;
    if (!gl) return;
    window.removeEventListener('resize', gl.size);
    gl.canvas.remove();
    gl.renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
    gl = null;
  };
  // existe desde que el tramo está a media pantalla hasta que el estudio ya lo tapa entero (fundido hecho)
  ScrollTrigger.create({
    trigger: rec,
    start: 'top 150%',
    endTrigger: studio || rec,
    end: studio ? 'top -10%' : 'bottom top',
    onToggle: (self) => (self.isActive ? create() : destroy()),
  });

  let lastKey = '';
  loop.add((time, ratio) => {
    const dt = ratio / 60;
    state.p += (state.to - state.p) * (1 - Math.exp(-P_EASE * dt));
    if (Math.abs(state.to - state.p) < 1e-4) state.p = state.to;
    // la frase reacciona aunque no haya plano (al volver a subir rápido, por ejemplo)
    const key = state.p.toFixed(4);
    if (key !== lastKey) { lastKey = key; react.progress(state.p); }
    if (!gl) return;

    state.mx += (state.tmx - state.mx) * (1 - Math.exp(-MOUSE_EASE * dt));
    state.my += (state.tmy - state.my) * (1 - Math.exp(-MOUSE_EASE * dt));
    const v = Math.min(1, Math.abs(lenis.velocity || 0) * BOOST.gain);
    state.boost += (v - state.boost) * (1 - Math.exp(-(v > state.boost ? BOOST.attack : BOOST.release) * dt));

    // solo dentro del tramo: antes de que llegue arriba, recortado a su parte visible
    const top = rec.getBoundingClientRect().top;
    gl.canvas.style.clipPath = top > 0 ? `inset(${top.toFixed(1)}px 0 0 0)` : '';
    if (top >= innerHeight) return;

    const { program, renderer } = gl;
    const u = program.uniforms;
    const dpr = renderer.dpr;
    const H = renderer.gl.drawingBufferHeight;
    const b = dot.getBoundingClientRect();
    u.uRec.value = [(b.left + b.width / 2) * dpr, H - (b.top + b.height / 2) * dpr];
    u.uP.value = state.p;
    u.uTime.value = time;
    u.uMouse.value = [state.mx, state.my];
    u.uBoost.value = state.boost;
    u.uCA.value = mobile.matches ? 0 : 1;
    // mientras el estudio aparece encima (mismo cálculo que js/studio.js), el degradado se apaga al final
    const sTop = studio ? studio.getBoundingClientRect().top : innerHeight;
    const e = sTop >= innerHeight ? 0 : crossAt(Math.max(0, sTop));
    const k = Math.min(1, Math.max(0, (e - CROSS.recFrom) / (1 - CROSS.recFrom)));
    const o = (1 - k * k * (3 - 2 * k)).toFixed(3);
    if (gl.canvas.style.opacity !== o) gl.canvas.style.opacity = o;
    if (o === '0.000') return;
    renderer.render({ scene: gl.mesh });
  });
}
