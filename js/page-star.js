import * as THREE from 'three';
import { finStop } from './fin.js';
import { MODEL_HEIGHT, ENV_INTENSITY, sharedGL, sharedModel, softboxScene, studio, drift, mixEnv } from './star-core.js';

// Recorrido del destello 3D por las páginas interiores (después del hero, que tiene el suyo: js/hero-star.js).
// Pinta en el canvas fijo compartido con el hero (sharedGL: un solo renderer por página; css/page-hero.css), con
// su escena; z-index 1: por encima del fondo de las secciones y por debajo de su contenido. Un solo loop.
// Servicios, el destello como GUÍA del proceso:
//   · espera escondido detrás de "Tres oficios" (z-index 2, fondo opaco: le hace de tapa). Cuando su borde inferior
//     pasa del 70 % de la pantalla, una luz naranja se filtra por debajo del borde (0.3 s, luz detrás de una
//     puerta) y salta con rebote dando una vuelta entera, hasta quedar junto a "En cada producción.";
//   · BENTO: va de tarjeta en tarjeta en el orden del proceso, con un salto en arco entre ellas (como una moneda,
//     se inclina 90° en X en lo alto), y aterriza en su esquina superior derecha: esa tarjeta se enciende (borde
//     naranja, halo desde el destello y su animación: js/bento.js, evento "disco:light") y la anterior se apaga. En
//     cada aterrizaje se intensifica un plano naranja en sus reflejos. Las paradas salen de getBoundingClientRect de
//     cada tarjeta y el progreso del scroll por la sección decide la parada (suavizado, nunca a saltos);
//   · PARA QUIÉN (escritorio): compañero del cursor, a la derecha de la fila que tienes encima, reflejando la foto de
//     ese sector (fundido de mapas de reflejos); sin cursor, a la derecha de la lista;
//   · CIERRE: al entrar gira rápido 2 vueltas y lo "sella" con una onda de luz;
//   · footer: se apaga y cae (js/fin.js). Al subir, todo al revés.
//   Móvil: 4 paradas en el bento y sin compañero del cursor.
// Resto de páginas: solo el footer. Movimiento reducido: no hay recorrido (el footer ya está encajado).
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
// el salto desde detrás de "Tres oficios": borde inferior por encima del 70 % de la pantalla; antes, 0.3 s de luz
const JUMP = { at: 0.7, light: 0.3, duration: 0.9, ease: 'back.out(1.6)', back: 0.55, wait: 0.4, edgeTurn: -Math.PI * 2, gap: 14 };
// el bento: tarjetas en el orden del proceso; escala al aterrizar; reposo / salto dentro de cada tramo; arco
const TOUR = {
  desk: ['marca', 'idea', 'plan', 'prod', 'rodaje', 'post', 'entrega', 'sost'],
  mob: ['marca', 'rodaje', 'plan', 'post'], // en una columna, en el orden en que aparecen
  s: 0.22,
  rest: 0.3,       // de cada tramo: 30 % quieto en la tarjeta, 40 % saltando, 30 % quieto en la siguiente
  gap: 0.16,       // × alto de pantalla entre paradas (como mínimo)
  arc: 0.11,       // alto del arco (× alto de pantalla)
  tilt: Math.PI / 2,
  smooth: 7,       // suavizado del progreso (1/s)
  k: 14,           // filtro de posición mientras salta (rápido: el arco se ve)
  land: 0.12,      // a menos de esto de una parada, ha aterrizado
  desk_off: [2, -2], mob_off: [-4, -10], // px desde la esquina superior derecha
};
const ORANGE = { base: 0.14, lit: 0.42, peak: 0.85, decay: 0.9 }; // el plano naranja de los reflejos
const MATE = { s: 0.24, lerp: 0.1, gap: 12, fade: 0.4 };        // "Para quién": el compañero del cursor
const SEAL = { turns: 2, dur: 0.9, ring: 0.6 };
const CLOSE_DIM = 0.62;            // brillo de los reflejos sobre el naranja del cierre (que no se queme)
const LOW_FPS = 50;                // móvil por debajo: el recorrido intermedio se simplifica
const FLICKER = [[0.15, 0.08], [0.9, 0.1], [0.1, 0.14], [0.6, 0.12], [0.25, 0.26]];
const RETURN_K = 5;
const RETURN_LERP = 0.08;
const VELOCITY_MUTE = 600;
const TAU = Math.PI * 2;

export async function initPageStar({ gsap, ScrollTrigger, lenis, loop, reduced }) {
  if (reduced.matches) return null;
  const gl = sharedGL();
  if (!gl) return null;
  const { renderer, canvas, view } = gl;

  const scene = new THREE.Scene();
  const studioTex = studio(renderer);
  scene.environment = studioTex;
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
    return null;
  }
  star.add(model);
  const materials = [];
  model.traverse((o) => { if (o.isMesh) materials.push(o.material); });

  const gate = document.querySelector('[data-star-gate]'); // servicios: "Tres oficios"
  const hero = document.querySelector('[data-page-hero], [data-star-hero]'); // (nosotros: el contraplano, js/contraplano.js)
  const bento = document.querySelector('[data-bento]');
  const list = document.querySelector('[data-sectors]');

  // ---------- reflejos: el estudio y, mezclado encima (envMix), el plano naranja o la foto de un sector ----------
  const U = { envMap2: { value: studioTex }, envMix: { value: 0 }, envRot2: { value: new THREE.Matrix3() } };
  materials.forEach((m) => { mixEnv(m, U); m.needsUpdate = true; });
  const pmrem = new THREE.PMREMGenerator(renderer);
  const bake = (fill) => {
    const env = softboxScene();
    fill(env);
    const tex = pmrem.fromScene(env.scene, 0.02).texture;
    env.dispose();
    return tex;
  };
  // un plano naranja grande delante (detrás de la cámara: lo reflejan las caras de frente) y otro abajo
  const orangeTex = gate ? bake((env) => {
    const mat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0xF35411).multiplyScalar(2.2), side: THREE.DoubleSide });
    const a = env.add(new THREE.PlaneGeometry(18, 9), mat());
    a.position.set(0, 1, 12);
    a.lookAt(0, 0, 0);
    const b = env.add(new THREE.PlaneGeometry(14, 6), mat());
    b.position.set(0, -9, 4);
    b.lookAt(0, 0, 0);
  }) : null;
  // las fotos de los sectores (se preparan la primera vez que hacen falta)
  const sectorTex = [];
  let sectorPhotos = [];
  if (list) import('./servicios-data.js').then((m) => { sectorPhotos = m.sectors.map((s) => s.photo?.src || null); }).catch(() => {});
  const loader = new THREE.TextureLoader();
  const sectorEnv = (i) => {
    if (sectorTex[i] !== undefined || !sectorPhotos[i]) return sectorTex[i] || null;
    sectorTex[i] = null;
    loader.load(sectorPhotos[i], (map) => {
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.repeat.x = 2;
      sectorTex[i] = bake((env) => {
        const sphere = env.add(new THREE.SphereGeometry(15, 48, 24), new THREE.MeshBasicMaterial({ map, side: THREE.BackSide, color: new THREE.Color(1.8, 1.8, 1.8) }));
        sphere.rotation.y = -Math.PI / 2;
      });
      map.dispose();
    });
    return null;
  };
  // fundido: lo de envMap2 sube con envMix; al terminar pasa a ser el entorno base
  const env = { mix: 0, b: studioTex, tw: null };
  const applyMix = () => { U.envMap2.value = env.b; U.envMix.value = env.mix; };
  const crossTo = (tex) => {
    if (!tex) return;
    if (env.tw?.isActive()) { if (env.b === tex) return; } else if (scene.environment === tex && env.mix < 0.01) return;
    if (env.mix > 0.5) scene.environment = env.b; // a medio fundido: se queda con el más visible
    env.tw?.kill();
    env.b = tex;
    env.mix = 0;
    env.tw = gsap.to(env, {
      mix: 1,
      duration: MATE.fade,
      ease: 'power1.inOut',
      onUpdate: applyMix,
      onComplete: () => { scene.environment = tex; env.mix = 0; applyMix(); },
    });
  };
  const orange = { level: 0 };

  // el resplandor naranja del salto (la luz por debajo de la puerta) y la onda del sello del cierre
  const glow = document.createElement('i');
  glow.className = 'ps-glow';
  glow.setAttribute('aria-hidden', 'true');
  const ring = document.createElement('i');
  ring.className = 'ps-ring';
  ring.setAttribute('aria-hidden', 'true');
  if (gate) document.body.append(glow, ring);

  // ---------- tamaño ----------
  let dirty = true;
  gl.onResize(() => { dirty = true; });
  renderer.compile(scene, gl.camera);
  const unit = () => UNIT * (view.mobile ? MOBILE_K : 1);
  const worldScale = (s) => (s * unit() * 2 * view.halfH) / MODEL_HEIGHT;

  // ---------- puntos de paso ----------
  let stops = [];
  let simple = false;
  let tour = null;   // { cards, ats }
  let mate = null;   // { start, end }
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
  const nx = (px) => (px / innerWidth) * 2 - 1;
  const ny = (el, at) => 1 - (2 * (docTop(el) + el.offsetHeight / 2 - at)) / innerHeight;
  const off = () => (view.mobile ? TOUR.mob_off : TOUR.desk_off);
  // esquina superior derecha de una tarjeta (para un scroll `at`, sin transformaciones)
  const cornerAt = (card, at) => ({
    x: nx(docLeft(card) + card.offsetWidth + off()[0]),
    y: 1 - (2 * (docTop(card) + off()[1] - at)) / innerHeight,
    s: TOUR.s,
  });
  const servicesStops = (max, end) => {
    const H = innerHeight;
    const hx = (s) => (WIDTH * s * unit() * H) / 2; // medio ancho del destello en px
    const title = document.getElementById('proc-title');
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
    tour = null;
    mate = null;
    // A: tras el salto, de frente a la derecha de "En cada producción."
    const aAt = docTop(gate) + gate.offsetHeight - JUMP.at * H;
    out.push({ ...beside(title, aAt, 0.32), at: Math.max(1, aAt), jump: true });
    if (simple) {
      // móvil justo: solo la reaparición y el footer (sube, desaparece y vuelve en el footer)
      out.push({ ...out[0], y: 1.8, at: aAt + 0.9 * H, off: true }, { x: 0, y: -1.8, s: end.s, at: Math.max(aAt + H, end.at - H), off: true }, end);
      return out;
    }
    // B: el bento, tarjeta a tarjeta (cada parada, con su tarjeta en el centro de la pantalla si se puede)
    if (bento) {
      const cards = (view.mobile ? TOUR.mob : TOUR.desk).map((k) => bento.querySelector(`[data-card="${k}"]`)).filter(Boolean);
      if (cards.length > 1) {
        const ats = [];
        cards.forEach((c, i) => {
          const ideal = docTop(c) + c.offsetHeight / 2 - 0.5 * H;
          ats.push(i ? Math.max(ats[i - 1] + TOUR.gap * H, ideal) : Math.max(aAt + 0.45 * H, ideal));
        });
        tour = { cards, ats };
        out.push({ ...cornerAt(cards[0], ats[0]), at: ats[0] }, { ...cornerAt(cards[cards.length - 1], ats[ats.length - 1]), at: ats[ats.length - 1] });
      }
    }
    // C: "Para quién": a la derecha del título; después (escritorio), a la derecha de la lista
    if (forTitle) {
      const at = docTop(forTitle) + forTitle.offsetHeight / 2 - 0.3 * H;
      out.push({ ...beside(forTitle, at, 0.3), at });
      if (list && !view.mobile && matchMedia('(hover: hover)').matches) {
        mate = { start: docTop(list) - 0.55 * H, end: docTop(list) + list.offsetHeight - 0.45 * H };
      }
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

  // ---------- bento: progreso (u: índice de parada continuo) y su pose con las tarjetas en vivo ----------
  const tourU = (px) => {
    const { ats } = tour;
    if (px <= ats[0]) return 0;
    const n = ats.length;
    if (px >= ats[n - 1]) return n - 1;
    let k = 0;
    while (k < n - 2 && px > ats[k + 1]) k++;
    const g = (px - ats[k]) / Math.max(1, ats[k + 1] - ats[k]);
    return k + THREE.MathUtils.clamp((g - TOUR.rest) / (1 - 2 * TOUR.rest), 0, 1);
  };
  const tp = { x: 0, y: 0, s: TOUR.s, rx: 0 };
  const cornerNow = (card) => {
    const r = card.getBoundingClientRect();
    return { x: r.right + off()[0], y: r.top + off()[1] };
  };
  const tourPose = (u) => {
    const n = tour.cards.length;
    const k = Math.min(n - 2, Math.floor(u));
    const f = THREE.MathUtils.clamp(u - k, 0, 1);
    const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; // power2.inOut
    const a = cornerNow(tour.cards[k]);
    const b = cornerNow(tour.cards[k + 1]);
    const arc = Math.sin(Math.PI * f) * TOUR.arc * innerHeight;
    tp.x = nx(a.x + (b.x - a.x) * e);
    tp.y = 1 - (2 * (a.y + (b.y - a.y) * e - arc)) / innerHeight;
    tp.s = TOUR.s;
    tp.rx = Math.sin(Math.PI * f) * TOUR.tilt; // como una moneda: de canto en lo alto, de frente al aterrizar
    return tp;
  };
  // tarjeta encendida (la del último aterrizaje)
  let lit = -1;
  let litCard = null;
  const light = (i) => {
    if (i === lit) return;
    if (lit >= 0) {
      const c = tour?.cards[lit] || litCard;
      c?.classList.remove('is-lit');
      c?.dispatchEvent(new CustomEvent('disco:light', { detail: false }));
    }
    lit = i;
    litCard = i >= 0 ? tour.cards[i] : null;
    if (!litCard) return;
    litCard.classList.add('is-lit');
    litCard.dispatchEvent(new CustomEvent('disco:light', { detail: true }));
    gsap.fromTo(orange, { level: ORANGE.peak }, { level: ORANGE.lit, duration: ORANGE.decay, ease: 'power2.out', overwrite: true });
  };

  // ---------- "Para quién": la fila que tienes encima (servicios.js le pone .is-on) ----------
  const mp = { x: 0, y: 0, init: false, row: -1 };
  const items = list ? [...list.children] : [];
  const matePose = (ratio) => {
    const lr = list.getBoundingClientRect();
    const row = items.findIndex((it) => it.classList.contains('is-on'));
    const H = innerHeight;
    const hPx = MATE.s * unit() * H;
    const tx = Math.min(innerWidth - (WIDTH * hPx) / 2 - 6, lr.right + MATE.gap + (WIDTH * hPx) / 2);
    let ty;
    if (row >= 0) {
      const rr = items[row].getBoundingClientRect();
      ty = rr.top + rr.height / 2;
    } else {
      ty = THREE.MathUtils.clamp(lr.top + lr.height / 2, Math.max(lr.top + hPx / 2, 0.3 * H), Math.min(lr.bottom - hPx / 2, 0.7 * H));
    }
    if (!mp.init) { mp.x = tx; mp.y = ty; mp.init = true; }
    const a = 1 - Math.pow(1 - MATE.lerp, ratio);
    mp.x += (tx - mp.x) * a;
    mp.y += (ty - mp.y) * a;
    mp.row = row;
    return { x: nx(mp.x), y: 1 - (2 * mp.y) / H, s: MATE.s };
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
  let tw = 0;          // peso del bento (0..1, suavizado)
  let mw = 0;          // peso del compañero de "Para quién"
  let uS = 0;          // progreso del bento, suavizado
  let lifted = false;
  const seal = { spin: 0, armed: true };
  const show = (on) => {
    if (drawn === on) return;
    drawn = on;
    if (!on) gl.blank('page');
  };
  const envK = { k: ENV_INTENSITY, tl: null, dim: 1 };
  const applyEnv = () => { const k = envK.k * envK.dim; materials.forEach((m) => { m.envMapIntensity = k; }); };
  const KEY = key.intensity;
  const BACK = back.intensity;
  const dimLights = () => { const f = envK.k / ENV_INTENSITY; key.intensity = KEY * f; back.intensity = BACK * f; applyEnv(); };
  const fin = { held: false, pose: null, key: '', returning: false, rewrap: false };
  const perf = { acc: 0, n: 0, checked: false };
  const lift = (on) => { if (on !== lifted) { lifted = on; canvas.style.zIndex = on ? '3' : ''; } };

  // el salto: primero la luz se filtra por debajo del borde (0.3 s) y después sale con rebote y una vuelta entera
  const openGate = (edge) => {
    jump.open = true;
    jump.tl?.kill();
    cur.init = false; // empieza en su punto del recorrido, sin arrastrar una pose vieja
    jump.tl = gsap.timeline()
      .fromTo(glow, { opacity: 0, scaleX: 0.5 }, { opacity: 1, scaleX: 1, duration: JUMP.light, ease: 'power1.in' }, 0)
      .to(jump, { j: 1, duration: JUMP.duration, ease: JUMP.ease }, JUMP.light)
      .to(glow, { opacity: 0, duration: 0.5, ease: 'power2.out' }, JUMP.light);
    gsap.set(glow, { x: innerWidth / 2, y: edge });
  };
  const closeGate = () => {
    jump.open = false;
    jump.tl?.kill();
    gsap.to(glow, { opacity: 0, duration: 0.2, overwrite: true });
    jump.tl = gsap.to(jump, { j: 0, duration: JUMP.back, ease: 'power2.in' });
  };
  // el sello del cierre: 2 vueltas rápidas y una onda de luz que sale del destello
  const sealIt = () => {
    gsap.to(seal, { spin: seal.spin + SEAL.turns * TAU, duration: SEAL.dur, ease: 'power2.inOut' });
    const d = ((star.scale.x * MODEL_HEIGHT) / (2 * view.halfH)) * innerHeight * 1.1;
    gsap.set(ring, { width: d, height: d, marginLeft: -d / 2, marginTop: -d / 2 });
    gsap.fromTo(ring, { opacity: 0.95, scale: 0.4 }, { opacity: 0, scale: 2.6, duration: SEAL.ring, ease: 'power2.out', delay: SEAL.dur * 0.45 });
  };
  // la onda sale del destello (y lo sigue mientras se expande)
  const ringAt = () => {
    if (!(+ring.style.opacity > 0)) return;
    gsap.set(ring, { x: ((star.position.x / view.halfW + 1) / 2) * innerWidth, y: ((1 - star.position.y / view.halfH) / 2) * innerHeight });
  };

  loop.add((time, ratio) => {
    if (document.hidden || !stops.length) return;
    // en el footer, "muerto": lo mueve la física (js/fin.js); aquí solo se pinta (pose en px de pantalla)
    if (fin.held) {
      const p = fin.pose;
      const k = `${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.angle.toFixed(3)}|${p.spinY.toFixed(3)}|${p.h.toFixed(1)}`;
      if (k === fin.key && !dirty && gl.owner === 'page') return;
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
      gl.draw(scene, 'page');
      drawn = true;
      return;
    }
    const px = lenis.scroll;
    const H = innerHeight;
    const dt = ratio / 60;
    // servicios: la puerta (borde inferior de "Tres oficios")
    let edge = H;
    if (gate) {
      edge = gate.getBoundingClientRect().bottom;
      if (!jump.open && edge < JUMP.at * H) openGate(edge);
      else if (jump.open && edge > JUMP.at * H + 2) closeGate();
      if (+glow.style.opacity > 0) gsap.set(glow, { y: edge });
    }
    // con el hero en pantalla (su destello está ahí) este no se ve nunca, aunque se suba muy rápido
    if (hero && hero.getBoundingClientRect().bottom > 0) {
      if (gate && (jump.open || jump.j > 0)) { jump.tl?.kill(); jump.j = 0; jump.open = false; gsap.set(glow, { opacity: 0 }); }
      if (drawn) { show(false); star.visible = false; }
      lift(false);
      cur.init = false;
      return;
    }
    const j = jump.j;
    if (j <= 0.0005) {
      if (drawn) { show(false); star.visible = false; }
      lift(false);
      cur.init = false;
      return;
    }

    const velocity = performance.now() < VELOCITY_MUTE ? 0 : lenis.velocity || 0;
    const base = curveAt(px);
    let t = { x: base.x, y: base.y, s: base.s, off: base.off };
    // bento: peso (dentro de su tramo) y pose de la parada en vivo
    let hopRx = 0;
    if (tour) {
      const { ats } = tour;
      const inTour = px > ats[0] - 0.35 * H && px < ats[ats.length - 1] + 0.3 * H;
      tw += ((inTour ? 1 : 0) - tw) * (1 - Math.exp(-5 * dt));
      const u = tourU(px);
      uS += (u - uS) * (1 - Math.exp(-TOUR.smooth * dt));
      if (tw > 0.001) {
        const q = tourPose(uS);
        t = { x: t.x + (q.x - t.x) * tw, y: t.y + (q.y - t.y) * tw, s: t.s + (q.s - t.s) * tw, off: false };
        hopRx = q.rx * tw;
        // aterriza: la tarjeta se enciende (y la anterior se apaga); el halo, desde el destello
        const near = Math.round(uS);
        if (tw > 0.6 && Math.abs(uS - near) < TOUR.land) light(near);
        else if (tw < 0.3) light(-1);
        if (litCard) {
          const r = litCard.getBoundingClientRect();
          const sx = ((cur.x + 1) / 2) * innerWidth - r.left;
          const sy = ((1 - cur.y) / 2) * H - r.top;
          litCard.style.setProperty('--sx', `${sx.toFixed(0)}px`);
          litCard.style.setProperty('--sy', `${sy.toFixed(0)}px`);
        }
      } else if (lit >= 0) light(-1);
    }
    // "Para quién": a la derecha de la fila que tienes encima (o de la lista)
    if (mate) {
      const inMate = px > mate.start && px < mate.end;
      mw += ((inMate ? 1 : 0) - mw) * (1 - Math.exp(-4 * dt));
      if (mw > 0.001) {
        const q = matePose(ratio);
        t = { x: t.x + (q.x - t.x) * mw, y: t.y + (q.y - t.y) * mw, s: t.s + (q.s - t.s) * mw, off: false };
      } else { mp.init = false; }
    }
    // reflejos: en "Para quién", la foto del sector de la fila (fundido; sin fila, el estudio); fuera, el estudio
    if (mw > 0.5) crossTo(mp.row >= 0 ? sectorEnv(mp.row) : studioTex);
    else if (scene.environment !== studioTex && !env.tw?.isActive()) crossTo(studioTex);
    // en el bento, encima del estudio, el plano naranja (se intensifica en cada aterrizaje)
    if (orangeTex && scene.environment === studioTex && !env.tw?.isActive() && (tw > 0.001 || env.mix > 0)) {
      env.b = orangeTex;
      env.mix = (ORANGE.base + orange.level) * tw;
      applyMix();
    }
    const guide = Math.max(tw, mw);
    lift(tw > 0.5); // en el bento salta por encima de las tarjetas
    // posición y tamaño: un solo filtro según dt (con el scroll rápido se queda algo atrás; en el bento, rápido)
    const kTo = fin.returning ? RETURN_K : guide > 0.5 ? TOUR.k : POS_K / (1 + Math.abs(velocity) * LAG);
    posK += (kTo - posK) * (1 - Math.exp(-K_EASE * dt));
    const ap = cur.init ? 1 - Math.exp(-posK * dt) : 1;
    cur.x += (t.x - cur.x) * ap;
    cur.y += (t.y - cur.y) * ap;
    cur.s += (t.s - cur.s) * ap;
    // rotación: vueltas con el recorrido + giro por la velocidad del scroll; de frente tras el salto, de guía y en
    // el final
    const first = stops[0].at;
    const last = stops[stops.length - 1].at;
    const progress = THREE.MathUtils.clamp((px - first) / Math.max(1, last - first), 0, 1);
    angularVel = THREE.MathUtils.clamp((angularVel + velocity * SPIN.gain * ratio) * Math.pow(SPIN.friction, ratio), -SPIN.max, SPIN.max);
    rotYExtra += angularVel * ratio;
    const freeY = progress * TURNS * TAU + rotYExtra;
    const wf = Math.max(gate ? 1 - THREE.MathUtils.smoothstep(px, first, first + FRONT * H) : 0, THREE.MathUtils.smoothstep(px, last - FOOTER_FRONT * H, last), guide);
    const frontY = freeY + (THREE.MathUtils.euclideanModulo(-freeY + Math.PI, TAU) - Math.PI); // la vuelta de frente más cercana
    const ry = freeY + (frontY - freeY) * wf;
    const free = 1 - wf;
    const vx = (cur.x - prevX) / Math.max(1e-3, dt);
    prevX = cur.x;
    bank += (THREE.MathUtils.clamp(-vx * BANK.gain, -BANK.max, BANK.max) * free - bank) * (1 - Math.pow(1 - BANK.lerp, ratio));
    const d = drift(time);
    const rx = (Math.sin(time * 0.5) * 0.06 + THREE.MathUtils.clamp(velocity * 0.001, -0.22, 0.22)) * free + hopRx;
    const rz = Math.sin(time * 0.35) * 0.05 * free + bank + d.r * free;
    if (fin.rewrap) {
      cur.ry += Math.round((ry - cur.ry) / TAU) * TAU;
      cur.rz = THREE.MathUtils.euclideanModulo(cur.rz + Math.PI, TAU) - Math.PI;
      fin.rewrap = false;
    }
    const a = cur.init ? 1 - Math.pow(1 - (fin.returning ? RETURN_LERP : guide > 0.5 ? 0.2 : ROT_LERP), ratio) : 1;
    cur.rx += (rx - cur.rx) * a;
    cur.ry += (ry - cur.ry) * a;
    cur.rz += (rz - cur.rz) * a;
    cur.init = true;
    if (fin.returning && Math.abs(t.y - cur.y) < 0.01) fin.returning = false;

    // pose final: entre la espera (detrás del borde de "Tres oficios") y el recorrido (j, con rebote y una vuelta)
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
    // el cierre: al entrar, gira 2 vueltas y sella (otra vez, si se sale por arriba y se vuelve)
    const closeStop = stops.find((p) => p.close);
    if (closeStop) {
      const there = Math.abs(cur.y - closeStop.y) < 0.12 && Math.abs(cur.x - closeStop.x) < 0.12;
      if (seal.armed && px > closeStop.at - 0.2 * H && px < closeStop.at + 0.4 * H && there) { seal.armed = false; sealIt(); }
      else if (!seal.armed && px < closeStop.at - 0.6 * H) seal.armed = true;
    }
    ryAll += seal.spin;
    // escondido (tramo entre dos puntos fuera de pantalla) o fuera de la pantalla: no se pinta
    const hh = (s * unit()) + 0.05;
    const onScreen = !t.off && y - hh < 1.05 && y + hh > -1.05;
    if (!onScreen) {
      if (drawn) show(false);
      return;
    }
    // sobre el naranja del cierre, reflejos algo más bajos (que la plata no se queme)
    const wd = closeStop ? 1 - THREE.MathUtils.smoothstep(Math.abs(px - closeStop.at), 0.2 * H, 0.9 * H) : 0;
    const dimTo = 1 - (1 - CLOSE_DIM) * wd;
    if (Math.abs(dimTo - envK.dim) > 0.002) { envK.dim = dimTo; applyEnv(); }

    star.visible = true;
    star.position.set(x * view.halfW, y * view.halfH, 0);
    star.scale.setScalar(Math.max(0.0001, worldScale(s)));
    star.rotation.set(cur.rx * Math.min(1, j), ryAll, cur.rz * Math.min(1, j));
    gl.draw(scene, 'page');
    drawn = true;
    dirty = false;
    ringAt();

    // móvil: si no llega a 50 fps (2 s midiendo), el recorrido intermedio se simplifica
    if (view.mobile && !perf.checked && gate) {
      perf.acc += dt;
      perf.n++;
      if (perf.acc >= 2) {
        perf.checked = true;
        if (perf.n / perf.acc < LOW_FPS) { simple = true; light(-1); build(); }
      }
    }
  });

  window.addEventListener('pagehide', () => {
    pmrem.dispose();
    studioTex.dispose();
    orangeTex?.dispose();
    sectorTex.forEach((t) => t?.dispose());
  });

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
        envK.tl?.kill();
        envK.tl = gsap.timeline();
        FLICKER.forEach(([k, d]) => envK.tl.to(envK, { k: k * ENV_INTENSITY, duration: d, ease: 'none', onUpdate: dimLights }));
      },
      relight() {
        envK.tl?.kill();
        envK.tl = gsap.to(envK, { k: ENV_INTENSITY, duration: 0.4, ease: 'sine.out', onUpdate: dimLights });
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
