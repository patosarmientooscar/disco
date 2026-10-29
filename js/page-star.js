import * as THREE from 'three';
import { finStop } from './fin.js';
import { MODEL_HEIGHT, ENV_INTENSITY, FOV, CAMERA_Z, sharedModel, studio, drift } from './star-core.js';

// Recorrido del destello 3D por las páginas interiores (después del hero, que tiene el suyo: js/hero-star.js).
// Canvas fijo a pantalla completa, z-index 1 (css/page-hero.css): por encima del fondo de las secciones y por
// debajo de su contenido. Mismo GLB y three que el hero (js/star-core.js), un solo loop (gsap.ticker).
// Servicios: espera escondido detrás de "Tres oficios" (z-index 2, fondo opaco: le hace de tapa) y, cuando su
// borde inferior pasa del 70 % de la pantalla, salta de detrás con un rebote junto a "En cada producción.";
// después, recorrido por la página como en la home (Catmull-Rom entre puntos de paso, deriva, banking, giro con la
// velocidad del scroll, suavizado según dt) hasta el footer, donde se apaga y cae (js/fin.js). Al subir, al revés.
// Resto de páginas: solo el footer. Movimiento reducido: no hay recorrido (el footer ya está encajado).
const DPR = { desk: 1.75, mob: 1.25 };
const MOBILE = '(max-width: 767px)';
const UNIT = 0.45;                 // "escala 1" = 45 % del alto de pantalla (como en la home)
const MOBILE_K = 0.75;             // en móvil, escalas un 25 % menores
const WIDTH = 0.704;               // ancho / alto del modelo
const POS_K = 2.14;                // filtro de posición y tamaño: a = 1 − e^(−k·dt) (= lerp 0.035 a 60 fps)
const K_EASE = 3;
const LAG = 0.015;                 // k / (1 + |velocidad| × LAG): con el scroll rápido pesa más
const ROT_LERP = 0.04;
const SPIN = { gain: 0.0004, friction: 0.97, max: 0.035 };
const BANK = { gain: 0.35, max: 0.25, lerp: 0.08 };
const TURNS = 2;                   // vueltas en Y a lo largo del recorrido
const FRONT = 0.6;                 // × alto de pantalla: tras el salto sigue de frente y se suelta poco a poco
const FOOTER_FRONT = 0.5;          // × alto de pantalla antes del final: de frente
// el salto desde detrás de "Tres oficios": borde inferior por encima del 70 % de la pantalla
const JUMP = { at: 0.7, duration: 0.9, ease: 'back.out(1.6)', back: 0.55, wait: 0.4, edgeTurn: -1.5 * Math.PI, gap: 14 };
const CLOSE_DIM = 0.62;            // brillo de los reflejos sobre el naranja del cierre (que no se queme)
const LOW_FPS = 50;                // móvil por debajo: el recorrido intermedio se simplifica
const FLICKER = [[0.15, 0.08], [0.9, 0.1], [0.1, 0.14], [0.6, 0.12], [0.25, 0.26]];
const RETURN_K = 5;
const RETURN_LERP = 0.08;
const VELOCITY_MUTE = 600;
const TAU = Math.PI * 2;

export async function initPageStar({ gsap, ScrollTrigger, lenis, loop, reduced }) {
  if (reduced.matches) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const isMobile = () => matchMedia(MOBILE).matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile() ? DPR.mob : DPR.desk));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = 'ps-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  scene.environment = studio(renderer);
  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.position.set(3, 4, 5);
  const back = new THREE.DirectionalLight(0xffe2dc, 0.6);
  back.position.set(-4, -1, -3);
  scene.add(key, back);
  const star = new THREE.Group();
  star.visible = false;
  scene.add(star);

  let model;
  try {
    model = await sharedModel(renderer);
  } catch {
    renderer.dispose();
    return null;
  }
  star.add(model);
  const materials = [];
  model.traverse((o) => { if (o.isMesh) materials.push(o.material); });
  // el resplandor naranja del salto (solo en servicios), detrás del destello
  const glow = document.createElement('i');
  glow.className = 'ps-glow';
  glow.setAttribute('aria-hidden', 'true');
  if (document.querySelector('[data-star-gate]')) document.body.append(glow);
  document.body.append(canvas);

  // ---------- tamaño y cámara ----------
  const view = { halfW: 1, halfH: 1, mobile: false };
  const resize = () => {
    const w = innerWidth;
    const h = innerHeight;
    const aspect = w / h;
    camera.aspect = aspect;
    camera.position.set(0, 0, aspect >= 1 ? CAMERA_Z : Math.max(CAMERA_Z, 5.2 / aspect));
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile() ? DPR.mob : DPR.desk));
    renderer.setSize(w, h);
    view.halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    view.halfW = view.halfH * aspect;
    view.mobile = isMobile();
    dirty = true;
  };
  let dirty = true;
  resize();
  window.addEventListener('resize', resize);
  renderer.compile(scene, camera);
  const unit = () => UNIT * (view.mobile ? MOBILE_K : 1);
  const worldScale = (s) => (s * unit() * 2 * view.halfH) / MODEL_HEIGHT;

  // ---------- puntos de paso ----------
  const gate = document.querySelector('[data-star-gate]'); // servicios: "Tres oficios"
  const hero = document.querySelector('[data-page-hero]');
  let stops = [];
  let simple = false;
  const build = () => {
    const max = Math.max(1, ScrollTrigger.maxScroll(window));
    const end = footerStop(max);
    stops = gate ? servicesStops(max, end) : [{ x: 0, y: -1.8, s: end.s, at: Math.max(1, end.at - innerHeight), off: true }, end];
    stops.sort((a, b) => a.at - b.at);
    dirty = true;
  };
  const footerStop = (max) => {
    const stop = finStop(max, 1);
    if (!stop) return { x: 0, y: 1.6, s: 0.3, at: max };
    return { x: 0, y: 1 - (2 * stop.cy) / innerHeight, s: stop.h / (unit() * innerHeight), at: max, footer: true };
  };
  // x de pantalla (−1..1) de un punto en px; y de pantalla del centro de un elemento cuando el scroll vale `at`
  const nx = (px) => (px / innerWidth) * 2 - 1;
  const ny = (el, at) => 1 - (2 * (docTop(el) + el.offsetHeight / 2 - at)) / innerHeight;
  const servicesStops = (max, end) => {
    const H = innerHeight;
    const hx = (s) => (WIDTH * s * unit() * H) / 2; // medio ancho del destello en px
    const title = document.getElementById('proc-title');
    const bento = document.querySelector('[data-bento]');
    const forTitle = document.getElementById('for-title');
    const close = document.querySelector('.sv-close__in');
    // a la derecha de un título (sin taparlo); si no cabe (móvil), encima de él, a la derecha
    const beside = (el, at, s, y = ny(el, at)) => {
      const x = nx(docLeft(el) + textWidth(el) + 40 + hx(s));
      if (x + (2 * hx(s)) / innerWidth <= 0.98) return { x, y, s };
      const up = (el.offsetHeight / 2 + (s * unit() * H) / 2 + 16) / (H / 2);
      return { x: 0.5, y: ny(el, at) + up, s };
    };
    const out = [];
    // A: tras el salto, de frente a la derecha de "En cada producción."
    const aAt = docTop(gate) + gate.offsetHeight - JUMP.at * H;
    out.push({ ...beside(title, aAt, 0.32), at: Math.max(1, aAt), jump: true });
    if (simple) {
      // móvil justo: solo la reaparición y el footer (sube, desaparece y vuelve en el footer)
      out.push({ ...out[0], y: 1.8, at: aAt + 0.9 * H, off: true }, { x: 0, y: -1.8, s: end.s, at: Math.max(aAt + H, end.at - H), off: true }, end);
      return out;
    }
    // B: por detrás de la rejilla del proceso, en el hueco central entre columnas, mientras pasa
    if (bento) {
      const top = docTop(bento);
      const bx = nx(docLeft(bento) + bento.offsetWidth / 2);
      const b1 = Math.max(aAt + 0.4 * H, top - 0.2 * H);
      const b2 = Math.max(b1 + 1, top + bento.offsetHeight - 0.8 * H);
      out.push({ x: bx, y: 0.05, s: 0.3, at: b1 }, { x: bx, y: -0.05, s: 0.3, at: b2 });
    }
    // C: "Para quién": a la derecha del título, en su altura (las frases de los sectores quedan libres)
    if (forTitle) {
      const at = docTop(forTitle) + forTitle.offsetHeight / 2 - 0.3 * H;
      out.push({ ...beside(forTitle, at, 0.3), at });
    }
    // D: el cierre naranja, centrado arriba
    if (close) out.push({ x: 0, y: 0.56, s: 0.36, at: Math.min(max - 2, docTop(close) - 0.3 * H), close: true });
    out.push(end);
    // en orden y sin puntos que se pisen
    return out.filter((p, i) => i === 0 || p.at > out[i - 1].at + 2 || p.footer);
  };
  build();
  ScrollTrigger.addEventListener('refresh', build);
  if (document.fonts) document.fonts.ready.then(build);

  // punto de la curva para un scroll (Catmull-Rom uniforme por tramos; tramo entre dos "off": escondido)
  const tmp = { x: 0, y: 0, s: 0, off: false };
  const curveAt = (px) => {
    const n = stops.length;
    if (px <= stops[0].at) return Object.assign(tmp, stops[0], { off: !!stops[0].off && n > 1 && !!stops[1].off });
    let i = 0;
    while (i < n - 2 && px > stops[i + 1].at) i++;
    const a = stops[i];
    const b = stops[i + 1];
    const f = THREE.MathUtils.clamp((px - a.at) / Math.max(1, b.at - a.at), 0, 1);
    const p0 = stops[Math.max(0, i - 1)];
    const p3 = stops[Math.min(n - 1, i + 2)];
    const cr = (k) => {
      const t = f;
      const t2 = t * t;
      const t3 = t2 * t;
      return 0.5 * ((2 * a[k]) + (-p0[k] + b[k]) * t + (2 * p0[k] - 5 * a[k] + 4 * b[k] - p3[k]) * t2 + (-p0[k] + 3 * a[k] - 3 * b[k] + p3[k]) * t3);
    };
    tmp.x = cr('x');
    tmp.y = cr('y');
    tmp.s = Math.max(0.01, cr('s'));
    tmp.off = !!a.off && !!b.off;
    return tmp;
  };

  // ---------- estado ----------
  const cur = { x: 0, y: 0, s: 0, rx: 0, ry: 0, rz: 0, init: false };
  const jump = { j: gate ? 0 : 1, open: !gate, tl: null };
  let posK = POS_K;
  let angularVel = 0;
  let rotYExtra = 0;
  let bank = 0;
  let prevX = 0;
  let drawn = false;
  // si se ve o no, también en el canvas (data-on): las pruebas comprueban que nunca hay dos destellos a la vez
  const show = (on) => { if (drawn === on) return; drawn = on; canvas.dataset.on = on ? '1' : '0'; };
  const env = { k: ENV_INTENSITY, tl: null, dim: 1 };
  const applyEnv = () => { const k = env.k * env.dim; materials.forEach((m) => { m.envMapIntensity = k; }); };
  const KEY = key.intensity;
  const BACK = back.intensity;
  const dimLights = () => { const f = env.k / ENV_INTENSITY; key.intensity = KEY * f; back.intensity = BACK * f; applyEnv(); };
  const fin = { held: false, pose: null, key: '', returning: false, rewrap: false };
  const perf = { acc: 0, n: 0, checked: false };

  // el salto: el resplandor naranja en el borde y el destello sale con rebote; al volver, se esconde
  const openGate = (edge) => {
    jump.open = true;
    jump.tl?.kill();
    cur.init = false; // empieza en su punto del recorrido, sin arrastrar una pose vieja
    jump.tl = gsap.to(jump, { j: 1, duration: JUMP.duration, ease: JUMP.ease });
    gsap.set(glow, { x: innerWidth / 2, y: edge });
    gsap.fromTo(glow, { opacity: 0, scale: 0.6 }, { keyframes: { opacity: [0, 0.9, 0], scale: [0.6, 1.1, 1.4] }, duration: 0.3, ease: 'none' });
  };
  const closeGate = () => {
    jump.open = false;
    jump.tl?.kill();
    jump.tl = gsap.to(jump, { j: 0, duration: JUMP.back, ease: 'power2.in' });
  };

  loop.add((time, ratio) => {
    if (document.hidden || !stops.length) return;
    // en el footer, "muerto": lo mueve la física (js/fin.js); aquí solo se pinta (pose en px de pantalla)
    if (fin.held) {
      const p = fin.pose;
      const k = `${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.angle.toFixed(3)}|${p.spinY.toFixed(3)}|${p.h.toFixed(1)}`;
      if (k === fin.key && !dirty) return;
      fin.key = k;
      dirty = false;
      star.visible = true;
      star.position.set(((p.x / innerWidth) * 2 - 1) * view.halfW, (1 - (p.y / innerHeight) * 2) * view.halfH, 0);
      const sc = Math.max(0.0001, ((p.h / innerHeight) * 2 * view.halfH) / MODEL_HEIGHT);
      star.scale.setScalar(sc);
      star.rotation.set(0, p.spinY, -p.angle);
      cur.x = p.x / innerWidth * 2 - 1;
      cur.y = 1 - (p.y / innerHeight) * 2;
      cur.s = p.h / (unit() * innerHeight);
      cur.rx = 0;
      cur.ry = p.spinY;
      cur.rz = -p.angle;
      renderer.render(scene, camera);
      show(true);
      return;
    }
    const px = lenis.scroll;
    const H = innerHeight;
    // servicios: la puerta (borde inferior de "Tres oficios")
    let edge = H;
    if (gate) {
      edge = gate.getBoundingClientRect().bottom;
      if (!jump.open && edge < JUMP.at * H) openGate(edge);
      else if (jump.open && edge > JUMP.at * H + 2) closeGate();
    }
    // con el hero en pantalla (su destello está ahí) este no se ve nunca, aunque se suba muy rápido
    if (hero && hero.getBoundingClientRect().bottom > 0) {
      if (gate && (jump.open || jump.j > 0)) { jump.tl?.kill(); jump.j = 0; jump.open = false; }
      if (drawn) { renderer.clear(); show(false); star.visible = false; }
      cur.init = false;
      return;
    }
    const j = jump.j;
    if (j <= 0.0005) {
      if (drawn) { renderer.clear(); show(false); star.visible = false; }
      cur.init = false;
      return;
    }

    const dt = ratio / 60;
    const velocity = performance.now() < VELOCITY_MUTE ? 0 : lenis.velocity || 0;
    const t = curveAt(px);
    // posición y tamaño: un solo filtro según dt (con el scroll rápido se queda algo atrás)
    const kTo = fin.returning ? RETURN_K : POS_K / (1 + Math.abs(velocity) * LAG);
    posK += (kTo - posK) * (1 - Math.exp(-K_EASE * dt));
    const ap = cur.init ? 1 - Math.exp(-posK * dt) : 1;
    cur.x += (t.x - cur.x) * ap;
    cur.y += (t.y - cur.y) * ap;
    cur.s += (t.s - cur.s) * ap;
    // rotación: vueltas con el recorrido + giro por la velocidad del scroll; de frente tras el salto y en el final
    const first = stops[0].at;
    const last = stops[stops.length - 1].at;
    const progress = THREE.MathUtils.clamp((px - first) / Math.max(1, last - first), 0, 1);
    angularVel = THREE.MathUtils.clamp((angularVel + velocity * SPIN.gain * ratio) * Math.pow(SPIN.friction, ratio), -SPIN.max, SPIN.max);
    rotYExtra += angularVel * ratio;
    const freeY = progress * TURNS * TAU + rotYExtra;
    const wf = Math.max(gate ? 1 - THREE.MathUtils.smoothstep(px, first, first + FRONT * H) : 0, THREE.MathUtils.smoothstep(px, last - FOOTER_FRONT * H, last));
    const frontY = freeY + (THREE.MathUtils.euclideanModulo(-freeY + Math.PI, TAU) - Math.PI); // la vuelta de frente más cercana
    const ry = freeY + (frontY - freeY) * wf;
    const free = 1 - wf;
    const vx = (cur.x - prevX) / Math.max(1e-3, dt);
    prevX = cur.x;
    bank += (THREE.MathUtils.clamp(-vx * BANK.gain, -BANK.max, BANK.max) * free - bank) * (1 - Math.pow(1 - BANK.lerp, ratio));
    const d = drift(time);
    const rx = (Math.sin(time * 0.5) * 0.06 + THREE.MathUtils.clamp(velocity * 0.001, -0.22, 0.22)) * free;
    const rz = Math.sin(time * 0.35) * 0.05 * free + bank + d.r * free;
    if (fin.rewrap) {
      cur.ry += Math.round((ry - cur.ry) / TAU) * TAU;
      cur.rz = THREE.MathUtils.euclideanModulo(cur.rz + Math.PI, TAU) - Math.PI;
      fin.rewrap = false;
    }
    const a = cur.init ? 1 - Math.pow(1 - (fin.returning ? RETURN_LERP : ROT_LERP), ratio) : 1;
    cur.rx += (rx - cur.rx) * a;
    cur.ry += (ry - cur.ry) * a;
    cur.rz += (rz - cur.rz) * a;
    cur.init = true;
    if (fin.returning && Math.abs(t.y - cur.y) < 0.01) fin.returning = false;

    // pose final: entre la espera (detrás del borde de "Tres oficios", de canto) y el recorrido (j, con rebote)
    let x = cur.x + d.x * free;
    let y = cur.y + d.y * free;
    let s = cur.s;
    let ryAll = cur.ry;
    if (j < 1 || gate) {
      const ws = JUMP.wait;
      const hPx = ws * unit() * H;
      const wy = 1 - (2 * (edge - hPx / 2 - JUMP.gap)) / H; // centro: justo por encima del borde (tapado)
      x = 0 + (x - 0) * j;
      y = wy + (y - wy) * j;
      s = ws + (s - ws) * j;
      ryAll = JUMP.edgeTurn + (cur.ry - JUMP.edgeTurn) * j;
    }
    // escondido (tramo entre dos puntos fuera de pantalla) o fuera de la pantalla: no se pinta
    const hh = (s * unit()) + 0.05;
    const onScreen = !t.off && y - hh < 1.05 && y + hh > -1.05;
    if (!onScreen) {
      if (drawn) { renderer.clear(); show(false); }
      return;
    }
    // sobre el naranja del cierre, reflejos algo más bajos (que la plata no se queme)
    const closeStop = stops.find((p) => p.close);
    const wd = closeStop ? 1 - THREE.MathUtils.smoothstep(Math.abs(px - closeStop.at), 0.2 * H, 0.9 * H) : 0;
    const dimTo = 1 - (1 - CLOSE_DIM) * wd;
    if (Math.abs(dimTo - env.dim) > 0.002) { env.dim = dimTo; applyEnv(); }

    star.visible = true;
    star.position.set(x * view.halfW, y * view.halfH, 0);
    star.scale.setScalar(Math.max(0.0001, worldScale(s)));
    star.rotation.set(cur.rx * Math.min(1, j), ryAll, cur.rz * Math.min(1, j));
    renderer.render(scene, camera);
    show(true);
    dirty = false;

    // móvil: si no llega a 50 fps (2 s midiendo), el recorrido intermedio se simplifica
    if (view.mobile && !perf.checked && gate) {
      perf.acc += dt;
      perf.n++;
      if (perf.acc >= 2) {
        perf.checked = true;
        if (perf.n / perf.acc < LOW_FPS) { simple = true; build(); }
      }
    }
  });

  window.addEventListener('pagehide', () => renderer.dispose());

  return {
    // para el footer (js/fin.js): se muere, lo mueve la física, se encaja o revive (como en la home)
    footer: {
      get ready() { return jump.open && jump.j >= 0.999 && drawn; },
      get failed() { return false; },
      screen() {
        return {
          x: ((star.position.x / view.halfW + 1) / 2) * innerWidth,
          y: ((1 - star.position.y / view.halfH) / 2) * innerHeight,
          h: ((star.scale.x * MODEL_HEIGHT) / (2 * view.halfH)) * innerHeight,
          ry: cur.ry,
        };
      },
      hold(pose) { fin.held = true; fin.pose = pose; fin.key = ''; dirty = true; },
      release() { fin.held = false; fin.returning = true; fin.rewrap = true; dirty = true; },
      flicker() {
        env.tl?.kill();
        env.tl = gsap.timeline();
        FLICKER.forEach(([k, d]) => env.tl.to(env, { k: k * ENV_INTENSITY, duration: d, ease: 'none', onUpdate: dimLights }));
      },
      relight() {
        env.tl?.kill();
        env.tl = gsap.to(env, { k: ENV_INTENSITY, duration: 0.4, ease: 'sine.out', onUpdate: dimLights });
      },
      fade(opacity, duration) {
        gsap.to(canvas, { opacity, duration, ease: 'power1.out', overwrite: true, onComplete: () => { if (opacity === 1) canvas.style.opacity = ''; } });
      },
    },
  };
}

// top / left en la página, sin transformaciones (entradas, parallax)
function docTop(el) {
  let y = 0;
  for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
  return y;
}
function docLeft(el) {
  let x = 0;
  for (let n = el; n; n = n.offsetParent) x += n.offsetLeft;
  return x;
}
// ancho real del texto de un título (el bloque ocupa toda la fila)
function textWidth(el) {
  const r = document.createRange();
  r.selectNodeContents(el);
  const rects = [...r.getClientRects()];
  if (!rects.length) return el.offsetWidth;
  const left = el.getBoundingClientRect().left;
  return Math.max(...rects.map((b) => b.right)) - left;
}
