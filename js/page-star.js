import * as THREE from 'three';
import { finStop } from './fin.js';
import { dlog } from './gpu.js';
import { createTrail } from './star-trail.js';
import { createDodge } from './star-dodge.js';
import { MODEL_HEIGHT, ENV_INTENSITY, sharedGL, sharedModel, softboxScene, studio, drift, mixEnv, compileScene } from './star-core.js';

// Recorrido del destello 3D por las páginas interiores (después del hero, que tiene el suyo: js/hero-star.js).
// Pinta en el canvas fijo compartido con el hero (sharedGL: un solo renderer por página; css/page-hero.css), con
// su escena; z-index 1: por encima del fondo de las secciones y por debajo de su contenido. Un solo loop.
// Servicios, el destello como GUÍA del proceso:
//   · MANIFIESTO: el destello del hero VIAJA hasta aquí (js/hero-star.js, handoff) y hace el RELEVO (relay, arriba):
//     en el mismo fotograma deja de pintar aquel y pinta este, en la misma pose (maniPose, la misma función para los
//     dos), con los reflejos fundiéndose del vídeo al estudio (0.6 s). Se queda GRANDE en el hueco a la DERECHA del
//     texto, centrado con él (maniPose), y al seguir bajando encoge hasta su escala .26, girando despacio en Y y respondiendo al ratón. Cuando se iluminan las palabras clave ("idea",
//     "imágenes"; evento "disco:manifest-hot" de js/servicios.js) da un giro extra y su reflejo se tiñe un instante
//     de naranja. Al bajar se queda a media pantalla y, cuando el borde superior de "Tres oficios" lo alcanza, SE
//     METE detrás (baja y da media vuelta, 0.45 s) con una luz naranja en ese borde, en su X; al subir, sale igual.
//     (Sin el destello del hero, como antes: entra por arriba a la derecha);
//   · espera escondido detrás de "Tres oficios" (z-index 2, fondo opaco: le hace de tapa). Cuando su borde inferior
//     pasa del 70 % de la pantalla, una luz naranja se filtra por debajo del borde (0.3 s, luz detrás de una
//     puerta; en la X por la que entró) y salta con rebote dando una vuelta entera, hasta quedar junto a "En cada
//     producción.";
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
// ARRASTRE: en las paradas donde está quieto (manifiesto, "En cada producción.", "Para quién", cierre) se coge con
// el ratón y se gira con inercia (como en el hero, js/hero-star.js); mientras se arrastra, el recorrido por scroll se
// pausa (se queda donde está) y al soltar vuelve con suavidad y se recoloca de frente.
// Nosotros, el destello RECORRE TODA LA PÁGINA (como en la home): empieza en el hero, grande a la derecha del logo
// (el hueco .nh__star; gira lento de frente, se inclina con el ratón y se arrastra; sus reflejos llevan los planos
// naranja y blanco de la aurora); al bajar se suelta, gira 1,25 vueltas y baja en curva hacia la izquierda encogiendo;
// acompaña el manifiesto, grande a su derecha; se coloca en el hueco ENTRE Luna y Bruno (en vivo, inclinándose hacia la foto que
// tiene el ratón encima); recorre los pasos de "Cómo trabajamos" (sobre la regla, de paso en paso, y el paso se
// ilumina: .is-lit); en el estudio, a la derecha girando más rápido; en el cierre, centrado arriba con la onda; y
// cae en el footer. Arrastrable en las paradas quietas.
// Resto de páginas: solo el footer. Movimiento reducido: no hay recorrido (el footer ya está encajado).
// LA FUGAZ (js/star-trail.js, AR-A): la estela naranja le sigue en todo el recorrido, con su tamaño en cada momento;
// en el footer, al apagarse, se apaga con él.
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
// la hoja de producción (AR-F; antes el bento grande): tarjetas en el orden del proceso; escala al aterrizar (en
// proporción a las tarjetas compactas: ~⅓ de su alto); reposo / salto dentro de cada tramo; arco
const TOUR = {
  desk: ['marca', 'idea', 'plan', 'prod', 'rodaje', 'sost', 'post', 'entrega'],
  mob: ['marca', 'plan', 'rodaje', 'post'], // (en filas de 2: la primera de cada fila, en el orden en que aparecen)
  s: 0.13,
  rest: 0.3,       // de cada tramo: 30 % quieto en la tarjeta, 40 % saltando, 30 % quieto en la siguiente
  gap: 0.16,       // × alto de pantalla entre paradas (como mínimo; nosotros)
  row: 0.11,       // servicios: × alto de pantalla entre paradas de una misma fila (repartidas alrededor de su centro)
  arc: 0.07,       // alto del arco (× alto de pantalla)
  tilt: Math.PI / 2,
  smooth: 7,       // suavizado del progreso (1/s)
  k: 14,           // filtro de posición mientras salta (rápido: el arco se ve)
  land: 0.12,      // a menos de esto de una parada, ha aterrizado
  desk_off: [2, -2], mob_off: [-4, -10], // px desde la esquina superior derecha
};
const ORANGE = { base: 0.14, lit: 0.42, peak: 0.85, decay: 0.9 }; // el plano naranja de los reflejos
const MATE = { s: 0.15, lerp: 0.25, gap: 12, fade: 0.4, hop: 0.6 }; // "Para quién": en la tarjeta plana del carrusel
const SEAL = { turns: 2, dur: 0.9, ring: 0.6 };
const CLOSE_DIM = 0.62;            // brillo de los reflejos sobre el naranja del cierre (que no se queme)
const FLICKER = [[0.15, 0.08], [0.9, 0.1], [0.1, 0.14], [0.6, 0.12], [0.25, 0.26]];
const RETURN_K = 5;
const RETURN_LERP = 0.08;
const VELOCITY_MUTE = 600;
const TRAIL = { n: 8, low: 3 };    // la fugaz: copias (con la calidad baja, 3)
const TAU = Math.PI * 2;
// el manifiesto: escala, hueco con el texto, altura a la que se queda (× pantalla), giro lento (rad/s), entrada y
// salida (s), el giro extra y el reflejo naranja de las palabras clave; el hero lo suelta con su bottom en el 15 %
// (big: en el propio manifiesto, grande: × alto del texto, máximo × pantalla, × hueco; encoge en shrink pantallas
// desde que el texto se le va hacia arriba: con "Tres oficios" tan cerca, si esperase a que el texto saliera por arriba
// ya estaría tapado; mob: sin hueco, × la escala de siempre)
const MANI = { s: 0.26, gap: 48, stick: 0.42, spin: 0.5, enter: 1.1, leave: 0.45, hotTurn: Math.PI, hotDur: 0.9, glow: 0.7, glowDur: 0.9, heroOff: 0.15, follow: 10, big: { k: 1.1, max: 0.55, room: 0.8, shrink: 0.2, mob: 1.3 } };
// con relevo: la zambullida detrás de "Tres oficios" (s; baja 0.35 de su alto; histéresis en px), su luz (entra,
// se apaga) y el fundido de reflejos del vídeo del hero al estudio
const DIVE = { dur: 0.45, drop: 0.35, hyst: 24, light: 0.3, fade: 0.6, env: 0.6 };
const TILT = { x: 0.22, y: 0.35, z: 0.06, lerp: 0.06 };
const DRAG = { gain: 0.011, friction: 0.94, stop: 0.0015, settle: 0.07 };
// nosotros: paradas quietas (× alto de pantalla), escalas, el pin de "Cómo trabajamos" (js/about.js), el giro rápido
// del estudio (rad/s), el vaivén de frente en reposo, la inclinación hacia la foto con el ratón y la entrada
const ABOUT = {
  heroHold: 0.04, mani: 0.3, maniHold: 0.2, team: 0.22, teamHold: 0.25, step: 0.16, stepArc: 0.07, studio: 0.3,
  studioHold: 0.15, studioSpin: 2.4, close: 0.36, pin: 2, hold: 0.12,
  idle: { amp: 0.32, speed: 0.45 }, lean: { y: 0.5, z: 0.18, lerp: 0.08 },
  enter: { duration: 1.4, scale: 0.82, turn: -35 * (Math.PI / 180), fade: 0.6 },
};

// ---------- servicios: el sitio del manifiesto y el RELEVO con el destello del hero ----------
// maniPose es la ÚNICA fuente de "dónde está su sitio": la usan este recorrido y el destello del hero, que viaja
// hasta ahí (js/hero-star.js, opción handoff; js/page-hero.js). A la derecha del texto, centrado con él; si no cabe
// (móvil), encima, a la derecha; nunca más abajo de la pantalla (si el texto aún no ha llegado, espera en el borde).
// relay: el estado compartido. step(time) lo pone el hero (decide una vez por fotograma, lo llame quien lo llame
// primero); done: el hero ha llegado y pinta este; look(): la orientación de este en su sitio (para que el hero
// acabe en ella); drawn: dónde pintó este lo último (el hero sale de ahí al subir); held: se está arrastrando aquí.
export const relay = { step: null, done: false, fresh: false, ready: false, look: null, env: null, drawn: null, held: false };
const maniSite = { geo: null };
export function maniMeasure() {
  const m = document.querySelector('[data-manifest]');
  maniSite.geo = m ? { top: docTop(m), h: m.offsetHeight, right: docLeft(m) + wordsWidth(m) } : null;
  return maniSite.geo;
}
// En el manifiesto, GRANDE (MANI.big): centrado en el hueco entre el final del texto y el borde derecho, y en vertical
// con el texto; alto 1,1 × el bloque (máximo 0,55 de pantalla y su ancho, el 80 % del hueco). Desde que el bloque
// se le va hacia arriba (deja de seguirlo), encoge ligado al scroll (en MANI.big.shrink pantallas) hasta la pose de siempre: escala
// .26 a la derecha del texto, quieto a media pantalla hasta que "Tres oficios" lo tapa. Sin hueco (móvil), encima
// del texto a la derecha, MANI.big.mob × el tamaño de siempre.
export function maniPose(px) {
  const geo = maniSite.geo || maniMeasure();
  if (!geo) return null;
  const H = innerHeight;
  const W = innerWidth;
  const small = MANI.s * UNIT * (matchMedia('(max-width: 767px)').matches ? MOBILE_K : 1) * H;
  const top = geo.top - px;
  if (geo.right + MANI.gap + WIDTH * small > W - 16) {
    const hPx = small * MANI.big.mob;
    return { cx: W - 20 - (WIDTH * hPx) / 2, cy: Math.min(top - 18 - hPx / 2, H - 16 - hPx / 2), hPx };
  }
  const room = W - geo.right;
  const big = Math.max(small, Math.min(MANI.big.k * geo.h, MANI.big.max * H, (MANI.big.room * room) / WIDTH));
  // (encoge desde que el texto se le va hacia arriba: su centro pasa la altura a la que él se queda)
  const k = THREE.MathUtils.smoothstep(MANI.stick * H - (top + geo.h / 2), 0, MANI.big.shrink * H);
  const hPx = big + (small - big) * k;
  const cx = geo.right + room / 2 + (MANI.gap + (WIDTH * small) / 2 - room / 2) * k;
  // se queda a media pantalla: "Tres oficios" sube y lo tapa
  const cy = Math.min(Math.max(top + geo.h / 2, MANI.stick * H), H - 16 - hPx / 2);
  return { cx, cy, hPx };
}

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
  // la fugaz: copias del destello en sus poses pasadas (en esta escena: se pintan con él)
  const trail = createTrail({ scene, model, n: TRAIL.n });
  // brillo de la fugaz: 1 encendido; con el parpadeo del footer baja con él hasta 0
  const trailGain = () => THREE.MathUtils.clamp((envK.k / ENV_INTENSITY - 0.3) / 0.7, 0, 1);
  let nowT = 0;
  // sobre una foto o un vídeo grande: un desvío mínimo y lento, sumado al objetivo (js/star-dodge.js)
  const dodge = createDodge({ ScrollTrigger });
  const trailStep = (gain = 1) => {
    trail.setMax(gl.quality.trail ? TRAIL.n : TRAIL.low);
    trail.update(nowT, star, view.halfH, { gain: gain * trailGain() });
  };

  const gate = document.querySelector('[data-star-gate]'); // servicios: "Tres oficios"
  const hero = document.querySelector('[data-page-hero], [data-star-hero]'); // (nosotros: el hero "Somos disco.", js/nosotros-hero.js)
  const bento = document.querySelector('[data-bento]');
  const list = document.querySelector('[data-arc]'); // servicios: el carrusel de "Para quién" (AT-C)
  const manifest = gate ? document.querySelector('[data-manifest]') : null;
  // nosotros: el hero (y el hueco del destello), las fotos del equipo y "Cómo trabajamos"
  const about = document.querySelector('[data-nh]');
  const slot = about?.querySelector('[data-nh-star]');
  const team = about ? document.querySelector('[data-team]') : null;
  const how = about ? document.querySelector('[data-how]') : null;

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
  // (nosotros: se hornea más tarde, cuando el navegador está libre: solo hace falta en "Cómo trabajamos")
  const bakeOrange = () => bake((env) => {
    const mat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0xF35411).multiplyScalar(2.2), side: THREE.DoubleSide });
    const a = env.add(new THREE.PlaneGeometry(18, 9), mat());
    a.position.set(0, 1, 12);
    a.lookAt(0, 0, 0);
    const b = env.add(new THREE.PlaneGeometry(14, 6), mat());
    b.position.set(0, -9, 4);
    b.lookAt(0, 0, 0);
  });
  let orangeTex = gate ? bakeOrange() : null;
  if (about) {
    const later = () => { if (!orangeTex) orangeTex = bakeOrange(); };
    setTimeout(() => ('requestIdleCallback' in window ? requestIdleCallback(later, { timeout: 4000 }) : later()), 5000);
  }
  // nosotros, en el hero: como la aurora, un plano naranja ancho arriba y otro blanco, más fino, por encima (la
  // plata brilla en naranja por arriba)
  const auroraTex = about ? bake((env) => {
    const o = env.add(new THREE.PlaneGeometry(24, 7), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xF35411).multiplyScalar(2.4), side: THREE.DoubleSide }));
    o.position.set(0, 7, 7);
    o.lookAt(0, 0, 0);
    const w = env.add(new THREE.PlaneGeometry(20, 2.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf4f2ef).multiplyScalar(2.6), side: THREE.DoubleSide }));
    w.position.set(0, 10.5, 3);
    w.lookAt(0, 0, 0);
  }) : null;
  if (auroraTex) scene.environment = auroraTex;
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
  // la luz del borde superior de "Tres oficios" cuando se mete (solo con relevo)
  const glowTop = document.createElement('i');
  glowTop.className = 'ps-glow ps-glow--top';
  glowTop.setAttribute('aria-hidden', 'true');
  if (gate) document.body.append(glow, glowTop, ring);
  else if (about) document.body.append(ring);

  // ---------- tamaño ----------
  let dirty = true;
  gl.onResize(() => { dirty = true; });
  await compileScene(renderer, scene, gl.camera); // en paralelo si se puede: sin congelar la página
  const unit = () => UNIT * (view.mobile ? MOBILE_K : 1);
  const worldScale = (s) => (s * unit() * 2 * view.halfH) / MODEL_HEIGHT;

  // ---------- puntos de paso ----------
  let stops = [];
  let tour = null;   // { cards, ats }
  let mate = null;   // { start, end }
  let maniGeo = null; // { top, h, right }
  let teamG = null;  // nosotros: { start, end } entre las fotos
  let pinned = false; // nosotros: "Cómo trabajamos" fijado (escritorio)
  let aboutH = 0;
  const build = () => {
    const max = Math.max(1, ScrollTrigger.maxScroll(window));
    const end = footerStop(max);
    stops = gate ? servicesStops(max, end) : about ? aboutStops(max, end) : [{ x: 0, y: -1.8, s: end.s, at: Math.max(1, end.at - innerHeight), off: true }, end];
    stops.sort((a, b) => a.at - b.at);
    // una parada quieta (until > at) son dos puntos iguales: entre ellos, la curva se queda en su sitio
    stops = stops.flatMap((p) => (p.until > p.at ? [p, { ...p, at: p.until, twin: true }] : [p]));
    // el manifiesto, en coordenadas de la página (sin lecturas en cada fotograma)
    maniGeo = manifest ? maniMeasure() : null;
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
    // B: el bento, tarjeta a tarjeta (cada parada, con su tarjeta en el centro de la pantalla si se puede)
    if (bento) {
      const cards = (view.mobile ? TOUR.mob : TOUR.desk).map((k) => bento.querySelector(`[data-card="${k}"]`)).filter(Boolean);
      if (cards.length > 1) {
        // (las tarjetas de una misma fila, con la fila en el centro de la pantalla: sus paradas, repartidas alrededor)
        const ats = [];
        const rowOf = cards.map((c) => Math.round(docTop(c)));
        cards.forEach((c, i) => {
          const mates = cards.filter((_, j) => Math.abs(rowOf[j] - rowOf[i]) < 8);
          const k = mates.indexOf(c);
          const ideal = docTop(c) + c.offsetHeight / 2 - 0.5 * H + (k - (mates.length - 1) / 2) * TOUR.row * H;
          ats.push(i ? Math.max(ats[i - 1] + 0.06 * H, ideal) : Math.max(aAt + 0.45 * H, ideal));
        });
        tour = { cards, ats, s: TOUR.s, arc: TOUR.arc, pos: (c) => cornerNow(c) };
        out.push({ ...cornerAt(cards[0], ats[0]), at: ats[0] }, { ...cornerAt(cards[cards.length - 1], ats[ats.length - 1]), at: ats[ats.length - 1] });
      }
    }
    // C: "Para quién": a la derecha del título; después, en la tarjeta plana del carrusel (todo su recorrido sticky)
    if (forTitle) {
      const at = docTop(forTitle) + forTitle.offsetHeight / 2 - 0.3 * H;
      out.push({ ...beside(forTitle, at, 0.3), at });
      if (list) mate = { start: docTop(list) - 0.35 * H, end: docTop(list) + list.offsetHeight - 0.75 * H };
    }
    // D: el cierre naranja, centrado arriba
    if (close) out.push({ x: 0, y: 0.56, s: 0.36, at: Math.min(max - 2, docTop(close) - 0.3 * H), close: true });
    out.push(end);
    // en orden y sin puntos que se pisen
    return out.filter((p, i) => i === 0 || p.at > out[i - 1].at + 2 || p.footer);
  };
  // ---------- nosotros ----------
  // rect de un elemento para un scroll `at` (sin transformaciones), o relativo a su pin (fijado arriba)
  const rectAt = (el, at) => {
    const top = docTop(el) - at;
    const left = docLeft(el);
    return { left, top, right: left + el.offsetWidth, bottom: top + el.offsetHeight, width: el.offsetWidth, height: el.offsetHeight };
  };
  const live = (el) => el.getBoundingClientRect();
  // en el hueco entre el bloque de Luna y el de Bruno (van en zigzag, uno debajo del otro), en el centro de la pantalla
  const teamPoint = (get) => {
    const [a, b] = [...team.querySelectorAll('[data-person]')].map(get);
    return { x: innerWidth / 2, y: (a.bottom + b.top) / 2 };
  };
  // un paso: escritorio (fijado), sobre la regla al principio de su columna; si no, a la derecha de su número
  const stepPoint = (card, get) => {
    const r = get(card);
    if (pinned) {
      const rr = get(how.querySelector('.ab-how__ruler'));
      return { x: r.left + 26, y: rr.top + rr.height / 2 };
    }
    return { x: r.right - (WIDTH * ABOUT.step * unit() * innerHeight) / 2 - 4, y: r.top + 34 };
  };
  const aboutStops = (max, end) => {
    const H = innerHeight;
    const W = innerWidth;
    const hx = (s) => (WIDTH * s * unit() * H) / 2;
    const ndc = (p) => ({ x: nx(p.x), y: 1 - (2 * p.y) / H });
    const out = [];
    tour = null;
    mate = null;
    teamG = null;
    pinned = matchMedia('(min-width: 900px)').matches;
    aboutH = about.offsetHeight;
    // A: el hero, en su hueco a la derecha del logo (en scroll 0)
    const r = slot.getBoundingClientRect();
    const sy = window.scrollY;
    out.push({ x: nx(r.left + r.width / 2), y: 1 - (2 * (r.top + sy + r.height / 2)) / H, s: r.height / (unit() * H), at: 0, until: ABOUT.heroHold * H, hold: true, turn: 0 });
    // B: se suelta y baja en curva hacia la izquierda encogiendo, sin tapar el logo (escritorio)
    if (!view.mobile) out.push({ x: 0.3, y: -0.34, s: 0.55, at: 0.38 * aboutH, turn: 1.25 });
    // C: acompaña la lectura del manifiesto: GRANDE, centrado en el hueco entre el final del texto y el borde derecho y
    // en vertical con el texto (como en servicios: MANI.big); al seguir, encoge hacia la parada siguiente. Si no cabe
    // (móvil), encima del texto, a la derecha, con la escala de siempre
    const m = document.querySelector('[data-manifesto]');
    if (m) {
      const at = Math.max(0.62 * aboutH, docTop(m) + m.offsetHeight / 2 - 0.5 * H);
      let s = ABOUT.mani;
      const right = docLeft(m) + wordsWidth(m);
      let x = nx(right + 48 + hx(s));
      let y = ny(m, at);
      if (x + (2 * hx(s)) / W > 0.98) {
        x = nx(W - 20 - hx(s));
        y += (m.offsetHeight / 2 + (s * unit() * H) / 2 + 18) / (H / 2);
      } else {
        const room = W - right;
        s = Math.max(s, Math.min(MANI.big.k * m.offsetHeight, MANI.big.max * H, (MANI.big.room * room) / WIDTH) / (unit() * H));
        x = nx(right + room / 2);
      }
      out.push({ x, y, s, at, until: at + ABOUT.maniHold * H, hold: true, turn: 2 });
    }
    // D: entre las fotos de Luna y Bruno (en vivo: teamPoint en cada fotograma)
    if (team) {
      // (con el hueco a media pantalla; mientras el hueco está en pantalla, lo sigue en vivo: teamG)
      const [pa, pb] = team.querySelectorAll('[data-person]');
      const at = (docTop(pa) + pa.offsetHeight + docTop(pb)) / 2 - 0.5 * H;
      out.push({ ...ndc(teamPoint((el) => rectAt(el, at))), s: ABOUT.team, at: at - ABOUT.teamHold * H, until: at + ABOUT.teamHold * H, hold: true, turn: 2 });
      teamG = { start: at - 0.5 * H, end: at + 0.5 * H };
    }
    // E: "Cómo trabajamos", de paso en paso (en el pin, repartidos por su recorrido; sin pin, cada uno al centro)
    if (how) {
      const cards = [...how.querySelectorAll('[data-how-step]')];
      const pin = how.querySelector('[data-how-pin]');
      const ats = [];
      if (pinned) {
        const start = docTop(how);
        cards.forEach((c, i) => ats.push(start + (ABOUT.pin * H * (i + 0.5)) / cards.length));
      } else {
        cards.forEach((c, i) => {
          const ideal = docTop(c) + c.offsetHeight / 2 - 0.5 * H;
          ats.push(i ? Math.max(ats[i - 1] + TOUR.gap * H, ideal) : ideal);
        });
      }
      // la pose de cada parada para su scroll: fijado, relativa al pin (arriba del todo); si no, en la página
      const at0 = (i) => (el) => {
        if (!pinned) return rectAt(el, ats[i]);
        const a = el.getBoundingClientRect();
        const p = pin.getBoundingClientRect();
        return { left: a.left, right: a.right, top: a.top - p.top, bottom: a.bottom - p.top, height: a.height };
      };
      const n = cards.length;
      tour = { cards, ats, s: ABOUT.step, arc: ABOUT.stepArc, pos: (c) => stepPoint(c, live) };
      out.push({ ...ndc(stepPoint(cards[0], at0(0))), s: ABOUT.step, at: ats[0], turn: 3 }, { ...ndc(stepPoint(cards[n - 1], at0(n - 1))), s: ABOUT.step, at: ats[n - 1], turn: 3 });
    }
    // F: el estudio, a la derecha (sobre la foto), girando más rápido
    const st = document.querySelector('.ab-studio__img');
    if (st) {
      const at = docTop(st) + st.offsetHeight / 2 - 0.5 * H;
      out.push({ x: nx(W - Math.max(0.12 * W, 24 + hx(ABOUT.studio))), y: ny(st, at), s: ABOUT.studio, at: at - ABOUT.studioHold * H, until: at + ABOUT.studioHold * H, hold: true, front: false, spin: true, turn: 3.5 });
    }
    // G: el cierre naranja, centrado arriba (con la onda de luz al entrar)
    const close = document.querySelector('.ip-close__inner');
    if (close) out.push({ x: 0, y: 0.56, s: ABOUT.close, at: Math.min(max - 2, docTop(close) - 0.3 * H), close: true, hold: true, turn: 4 });
    out.push({ ...end, turn: 5 });
    // en orden, sin pisarse: una parada quieta termina antes de la siguiente
    out.sort((a, b) => a.at - b.at);
    const ok = out.filter((p, i) => i === 0 || p.at > out[i - 1].at + 2 || p.footer);
    ok.forEach((p, i) => { if (p.until && ok[i + 1]) p.until = Math.min(p.until, ok[i + 1].at - 2); });
    return ok;
  };
  // vueltas a lo largo del recorrido (nosotros: las de cada parada, con suavidad entre ellas)
  const turnAt = (px) => {
    const n = stops.length;
    if (px <= stops[0].at) return stops[0].turn || 0;
    let i = 0;
    while (i < n - 2 && px > stops[i + 1].at) i++;
    const a = stops[i];
    const b = stops[i + 1];
    const f = THREE.MathUtils.smoothstep(px, a.at, Math.max(a.at + 1, b.at));
    return (a.turn || 0) + ((b.turn || 0) - (a.turn || 0)) * f;
  };
  // cuánto está en una parada quieta (1 dentro, baja a 0 en ABOUT.hold pantallas)
  const holdOf = (px, pick) => {
    let w = 0;
    for (const p of stops) {
      if (p.twin || !pick(p)) continue;
      const u = p.until || p.at;
      const d = px < p.at ? p.at - px : px > u ? px - u : 0;
      w = Math.max(w, 1 - THREE.MathUtils.smoothstep(d, 0, ABOUT.hold * innerHeight));
    }
    return w;
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
    if (b.twin) { tmp.x = a.x; tmp.y = a.y; tmp.s = a.s; tmp.off = false; return tmp; } // parada quieta
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
    const a = tour.pos(tour.cards[k]);
    const b = tour.pos(tour.cards[k + 1]);
    const arc = Math.sin(Math.PI * f) * tour.arc * innerHeight;
    tp.x = nx(a.x + (b.x - a.x) * e);
    tp.y = 1 - (2 * (a.y + (b.y - a.y) * e - arc)) / innerHeight;
    tp.s = tour.s;
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

  // ---------- "Para quién" (AT-C): en la esquina superior derecha de la tarjeta plana del carrusel en arco
  // (js/arc-carousel.js: .is-flat y data-active). Cuando cambia la plana, salta a la nueva en arco (con su fugaz) ----------
  const mp = { x: 0, y: 0, init: false, row: -1 };
  const hop = { f: 1, from: null, tw: null };
  const flatCorner = () => {
    const c = list.querySelector('.arc__card.is-flat');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.right + off()[0], y: r.top + off()[1] };
  };
  const matePose = (ratio) => {
    const H = innerHeight;
    const row = Number(list.dataset.active ?? -1);
    const t = flatCorner() || { x: mp.x, y: mp.y };
    if (!mp.init) { mp.x = t.x; mp.y = t.y; mp.init = true; mp.row = row; }
    if (row !== mp.row) {
      // la plana ha cambiado: salto en arco desde donde estaba
      hop.from = { x: mp.x, y: mp.y };
      hop.tw?.kill();
      hop.f = 0;
      hop.tw = gsap.to(hop, { f: 1, duration: MATE.hop, ease: 'power2.inOut' });
      mp.row = row;
    }
    if (hop.f < 1 && hop.from) {
      mp.x = hop.from.x + (t.x - hop.from.x) * hop.f;
      mp.y = hop.from.y + (t.y - hop.from.y) * hop.f - Math.sin(Math.PI * hop.f) * TOUR.arc * H;
    } else {
      const a = 1 - Math.pow(1 - MATE.lerp, ratio);
      mp.x += (t.x - mp.x) * a;
      mp.y += (t.y - mp.y) * a;
    }
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
  let tmw = 0;         // nosotros: peso de la parada entre las fotos
  let lean = 0;        // nosotros: hacia la foto con el ratón encima (−1 Luna, 1 Bruno)
  let side = 0;
  let osc = 0;         // nosotros: vaivén de frente en las paradas
  let spinAcc = 0;     // nosotros: el giro rápido del estudio
  const intro = { p: about ? 0 : 1 };
  let lifted = false;
  const seal = { spin: 0, armed: true };
  const show = (on) => {
    if (drawn === on) return;
    drawn = on;
    if (!on) { gl.blank('page'); trail.hide(); }
  };
  const envK = { k: ENV_INTENSITY, tl: null, dim: 1 };
  const applyEnv = () => { const k = envK.k * envK.dim; materials.forEach((m) => { m.envMapIntensity = k; }); };
  const KEY = key.intensity;
  const BACK = back.intensity;
  const dimLights = () => { const f = envK.k / ENV_INTENSITY; key.intensity = KEY * f; back.intensity = BACK * f; applyEnv(); };
  const fin = { held: false, pose: null, key: '', returning: false, rewrap: false };
  const lift = (on) => { if (on !== lifted) { lifted = on; canvas.style.zIndex = on ? '3' : ''; } };

  // ---------- el ratón (inclinación) y el ARRASTRE en las paradas (el canvas no recibe el ratón: se comprueba que
  // el puntero está sobre la estrella con su pose del último dibujo) ----------
  const mouse = { tx: 0, ty: 0, x: 0, y: 0 };
  const drag = { on: false, x: 0, t: 0, vel: 0, spin: 0, moved: 0, frozen: null, can: false };
  const scr = { x: 0, y: 0, h: 0 }; // el destello en pantalla (px)
  const html = document.documentElement;
  const onStar = (e) => drag.can && drawn && Math.abs(e.clientX - scr.x) < scr.h * 0.36 && Math.abs(e.clientY - scr.y) < scr.h * 0.5;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / innerHeight) * 2 - 1;
    if (!drag.on) { html.classList.toggle('ps-grab', onStar(e)); return; }
    const t = performance.now();
    const dx = e.clientX - drag.x;
    drag.spin += dx * DRAG.gain;
    drag.vel = (dx * DRAG.gain) / Math.max(1, (t - drag.t) / (1000 / 60)); // rad por frame a 60 fps
    drag.moved += Math.abs(dx);
    drag.x = e.clientX;
    drag.t = t;
  }, { passive: true });
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0 || !onStar(e) || e.target.closest('a, input, textarea, select')) return;
    e.preventDefault();
    Object.assign(drag, { on: true, x: e.clientX, t: performance.now(), vel: 0, moved: 0, frozen: null });
    html.classList.add('ps-dragging');
  });
  const drop = () => {
    if (!drag.on) return;
    drag.on = false;
    drag.frozen = null;
    html.classList.remove('ps-dragging');
    if (performance.now() - drag.t > 80) drag.vel = 0; // se paró antes de soltar
    setTimeout(() => { drag.moved = 0; }, 0);
  };
  window.addEventListener('pointerup', drop);
  window.addEventListener('pointercancel', drop);
  window.addEventListener('blur', drop);
  // un arrastre no es un clic (en "Para quién" hay botones debajo)
  window.addEventListener('click', (e) => { if (drag.moved > 4) { e.preventDefault(); e.stopPropagation(); } }, true);
  // al soltar: inercia y, quieto, de frente (el múltiplo de π más cercano)
  const dragStep = (ratio) => {
    if (drag.on) return;
    drag.spin += drag.vel * ratio;
    drag.vel *= Math.pow(DRAG.friction, ratio);
    if (Math.abs(drag.vel) < DRAG.stop) {
      drag.vel = 0;
      drag.spin += (Math.round(drag.spin / Math.PI) * Math.PI - drag.spin) * (1 - Math.pow(1 - DRAG.settle, ratio));
    }
  };
  const seen = () => {
    scr.x = ((star.position.x / view.halfW + 1) / 2) * innerWidth;
    scr.y = ((1 - star.position.y / view.halfH) / 2) * innerHeight;
    scr.h = ((star.scale.x * MODEL_HEIGHT) / (2 * view.halfH)) * innerHeight;
  };

  // nosotros: hacia qué foto se inclina (la que tiene el ratón encima)
  team?.querySelectorAll('[data-person-photo]').forEach((p, i) => {
    p.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') side = i ? 1 : -1; });
    p.addEventListener('pointerleave', () => { side = 0; });
  });

  // ---------- servicios: el manifiesto ----------
  const mani = { k: 0, on: false, tw: null, x: 0, y: 0, init: false, base: 0 };
  const hot = { spin: 0, glow: 0 };
  let handing = false; // con relevo: el del hero viaja hasta aquí (relay.step lo pone js/hero-star.js)
  if (gate) { relay.look = () => maniLook(1); relay.ready = true; }
  document.addEventListener('disco:manifest-hot', () => {
    if (!mani.on) return;
    gsap.to(hot, { spin: hot.spin + MANI.hotTurn, duration: MANI.hotDur, ease: 'power3.out' });
    gsap.fromTo(hot, { glow: MANI.glow }, { glow: 0, duration: MANI.glowDur, ease: 'power2.out' });
  });
  // con relevo (servicios, con el destello del hero: relay.step), la orientación en su sitio: la misma que pintará
  // maniFrame en el siguiente fotograma (el giro lento y el ratón avanzan después de pintar)
  const maniLook = (k = 1) => ({ rx: mouse.y * TILT.x, ry: mani.base + drag.spin + hot.spin + (1 - k) * TAU + mouse.x * TILT.y + dive.d * Math.PI, rz: -mouse.x * TILT.z });
  // "Tres oficios" llega por abajo: el destello se mete detrás de su borde (baja un poco y da media vuelta) y una
  // luz naranja sale del borde superior, en su X; al subir, al revés. Histéresis de 24 px en el umbral
  const dive = { d: 0, in: false, tw: null };
  const dip = (on, x, edge) => {
    dive.in = on;
    dive.tw?.kill();
    dive.tw = gsap.to(dive, { d: on ? 1 : 0, duration: DIVE.dur, ease: on ? 'power2.in' : 'power2.out' });
    if (edge < 0 || edge > innerHeight) return; // el borde, fuera de pantalla: sin luz
    gsap.set(glowTop, { x, y: edge });
    glowTop.tl?.kill();
    glowTop.tl = gsap.timeline()
      .fromTo(glowTop, { opacity: 0, scaleX: 0.5 }, { opacity: 1, scaleX: 1, duration: DIVE.light, ease: 'power2.out' })
      .to(glowTop, { opacity: 0, duration: DIVE.fade, ease: 'power2.inOut' });
    dlog(`destello: ${on ? 'entra en' : 'sale de'} "Tres oficios" (x ${x.toFixed(0)}, borde ${edge.toFixed(0)})`);
  };
  const maniFrame = (ratio, px, gateTop) => {
    const dt = ratio / 60;
    const H = innerHeight;
    const p = maniPose(px);
    const k = mani.k;
    // llega (y se va) por arriba a la derecha, por donde salió el del hero (con relevo, k = 1: ya está en su sitio)
    let tx = innerWidth * 1.15 + (p.cx - innerWidth * 1.15) * k;
    let ty = -0.25 * H + (p.cy + 0.25 * H) * k;
    if (drag.on) { drag.frozen ||= { x: mani.x, y: mani.y }; tx = drag.frozen.x; ty = drag.frozen.y; }
    if (!mani.init) { mani.x = tx; mani.y = ty; mani.init = true; }
    const a = 1 - Math.exp(-MANI.follow * dt);
    mani.x += (tx - mani.x) * a;
    mani.y += (ty - mani.y) * a;
    // el giro: lento en Y, el de la mano, el de las palabras clave y, al llegar, una vuelta; inclinado hacia el ratón
    dragStep(ratio);
    const look = maniLook(k);
    if (handing) {
      const bottom = mani.y + p.hPx / 2;
      if (!dive.in && gateTop <= bottom) dip(true, mani.x, gateTop);
      else if (dive.in && gateTop > bottom + DIVE.hyst) dip(false, mani.x, gateTop);
    }
    // (baja 0.35 de su alto o, si el borde se ha parado justo ahí, lo que haga falta para quedar detrás de él)
    const y = mani.y + dive.d * Math.max(DIVE.drop * p.hPx, gateTop - mani.y + p.hPx / 2 + 2);
    mani.base += MANI.spin * dt;
    const ta = 1 - Math.pow(1 - TILT.lerp, ratio);
    mouse.x += (mouse.tx - mouse.x) * ta;
    mouse.y += (mouse.ty - mouse.y) * ta;
    // el reflejo naranja de las palabras clave (encima del estudio)
    if (orangeTex && scene.environment === studioTex && !env.tw?.isActive()) { env.b = orangeTex; env.mix = hot.glow; applyMix(); }
    cur.init = false;
    lift(false);
    drag.can = mani.on && k > 0.99 && !dive.in;
    // tapado del todo por "Tres oficios" o fuera de pantalla: no se pinta
    if (gateTop <= y - p.hPx / 2 || y + p.hPx / 2 < 0 || y - p.hPx / 2 > H || mani.x - p.hPx > innerWidth) {
      drag.can = false;
      show(false);
      return;
    }
    star.visible = true;
    star.position.set(((mani.x / innerWidth) * 2 - 1) * view.halfW, (1 - (y / H) * 2) * view.halfH, 0);
    star.scale.setScalar(Math.max(0.0001, worldScale(p.hPx / (unit() * H)))); // (el tamaño de su pose: grande o encogiendo)
    star.rotation.set(look.rx, look.ry, look.rz);
    trailStep();
    gl.draw(scene, 'page');
    drawn = true;
    relay.drawn = { cx: mani.x, cy: y, hPx: p.hPx };
    seen();
  };

  // el salto: primero la luz se filtra por debajo del borde (0.3 s) y después sale con rebote y una vuelta entera
  // (con relevo, la luz y la espera en la X por la que entró: el mismo destello atravesando la sección)
  const waitX = (px) => (handing ? maniPose(px).cx : innerWidth / 2);
  const openGate = (edge, x = innerWidth / 2) => {
    jump.open = true;
    jump.tl?.kill();
    cur.init = false; // empieza en su punto del recorrido, sin arrastrar una pose vieja
    jump.tl = gsap.timeline()
      .fromTo(glow, { opacity: 0, scaleX: 0.5 }, { opacity: 1, scaleX: 1, duration: JUMP.light, ease: 'power1.in' }, 0)
      .to(jump, { j: 1, duration: JUMP.duration, ease: JUMP.ease }, JUMP.light)
      .to(glow, { opacity: 0, duration: 0.5, ease: 'power2.out' }, JUMP.light);
    gsap.set(glow, { x, y: edge });
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
    nowT = time;
    // en el footer, "muerto": lo mueve la física (js/fin.js); aquí solo se pinta (pose en px de pantalla)
    if (fin.held) {
      drag.can = false;
      const p = fin.pose;
      const k = `${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.angle.toFixed(3)}|${p.spinY.toFixed(3)}|${p.h.toFixed(1)}`;
      // (mientras la fugaz se apaga, se sigue pintando)
      if (k === fin.key && !dirty && gl.owner === 'page' && !trail.visible) return;
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
      trailStep();
      gl.draw(scene, 'page');
      drawn = true;
      return;
    }
    const px = lenis.scroll;
    const H = innerHeight;
    const dt = ratio / 60;
    // servicios: la puerta (borde inferior de "Tres oficios")
    let edge = H;
    let gateTop = H;
    if (gate) {
      const gr = gate.getBoundingClientRect();
      edge = gr.bottom;
      gateTop = gr.top;
      if (!jump.open && edge < JUMP.at * H) openGate(edge, waitX(px));
      else if (jump.open && edge > JUMP.at * H + 2) closeGate();
      if (+glow.style.opacity > 0) gsap.set(glow, { y: edge });
      if (+glowTop.style.opacity > 0) gsap.set(glowTop, { y: gateTop }); // la luz de arriba, pegada al borde
    }
    // servicios: el manifiesto, entre el hero (cuando ya ha soltado su destello) y "Tres oficios"
    const heroBottom = hero ? hero.getBoundingClientRect().bottom : -1;
    if (maniGeo) {
      // con relevo, el hero decide (una vez por fotograma, lo llame quien lo llame primero): ha llegado y este sigue
      handing = !!relay.step;
      if (handing) { relay.held = drag.on; relay.step(time); }
      // (con relevo, al subir desde "Tres oficios" no espera a que acabe el regreso del salto si su sitio ya se
      // destapa: sale de detrás del borde)
      const spot = handing ? maniPose(px) : null;
      const spotSeen = handing && spot.cy + spot.hPx / 2 > 0;
      const unjumped = jump.j <= 0.0005 || (spotSeen && gateTop > spot.cy - spot.hPx / 2);
      const armed = (handing ? relay.done : heroBottom <= MANI.heroOff * H) && !jump.open && unjumped;
      if (armed && !mani.on) {
        mani.on = true;
        mani.tw?.kill();
        const p = maniPose(px);
        if (handing) {
          // el relevo: en el mismo fotograma, en su sitio exacto (donde lo ha dejado el del hero); si vuelve de
          // "Tres oficios", detrás de su borde (y sale con la zambullida al revés)
          const fresh = relay.fresh;
          relay.fresh = false;
          if (jump.j > 0) { jump.tl?.kill(); jump.j = 0; }
          mani.k = 1;
          mani.x = p.cx;
          mani.y = p.cy;
          mani.init = true;
          dive.tw?.kill();
          dive.in = gateTop <= p.cy + p.hPx / 2 || (!fresh && spotSeen);
          dive.d = dive.in ? 1 : 0;
          // los reflejos: del vídeo del hero al estudio, con un fundido
          const from = relay.env?.();
          if (fresh && !dive.in && from && from !== studioTex) {
            env.tw?.kill();
            scene.environment = from;
            env.b = studioTex;
            env.mix = 0;
            applyMix();
            env.tw = gsap.to(env, { mix: 1, duration: DIVE.env, ease: 'power1.inOut', onUpdate: applyMix, onComplete: () => { scene.environment = studioTex; env.mix = 0; applyMix(); } });
          }
          if (fresh) dlog('relevo hero → manifiesto (recorrido)', { x: +p.cx.toFixed(1), y: +p.cy.toFixed(1), h: +p.hPx.toFixed(1), ry: +maniLook(1).ry.toFixed(3) });
        } else if (gateTop <= p.cy - p.hPx / 2) mani.k = 1; // vuelve desde "Tres oficios" (estaba tapado): ya está en su sitio
        else mani.tw = gsap.to(mani, { k: 1, duration: MANI.enter * (1 - mani.k), ease: 'expo.out' }); // entra desde arriba a la derecha
        if (mani.k === 0) mani.init = false;
      } else if (!armed && mani.on) {
        mani.on = false;
        mani.tw?.kill();
        drop();
        // vuelve al hero: sale por arriba a la derecha (con relevo, el del hero lo recoge aquí mismo); se abre la
        // puerta de "Tres oficios": ya estaba tapado
        if (!handing && heroBottom > MANI.heroOff * H) mani.tw = gsap.to(mani, { k: 0, duration: MANI.leave, ease: 'power2.in' });
        else mani.k = 0;
        if (handing && !relay.done) { show(false); star.visible = false; }
      }
      if (mani.on || mani.k > 0.001) { maniFrame(ratio, px, gateTop); return; }
      mani.init = false;
    }
    // con el hero en pantalla (su destello está ahí) este no se ve nunca, aunque se suba muy rápido
    if (heroBottom > 0 && !about) {
      drag.can = false;
      if (gate && (jump.open || jump.j > 0)) { jump.tl?.kill(); jump.j = 0; jump.open = false; gsap.set(glow, { opacity: 0 }); }
      if (drawn) { show(false); star.visible = false; }
      lift(false);
      cur.init = false;
      return;
    }
    const j = jump.j;
    if (j <= 0.0005) {
      drag.can = false;
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
    // nosotros: entre las dos fotos, en vivo (van con el scroll)
    if (teamG) {
      const inTeam = px > teamG.start && px < teamG.end;
      tmw += ((inTeam ? 1 : 0) - tmw) * (1 - Math.exp(-4 * dt));
      if (tmw > 0.001) {
        const q = teamPoint(live);
        const qx = nx(q.x);
        const qy = 1 - (2 * q.y) / H;
        t = { x: t.x + (qx - t.x) * tmw, y: t.y + (qy - t.y) * tmw, s: t.s + (ABOUT.team - t.s) * tmw, off: false };
      }
    }
    // reflejos: en "Para quién", la foto del sector de la fila (fundido; sin fila, el estudio); en el hero de
    // nosotros, la aurora; fuera, el estudio
    const want = auroraTex && px < 0.55 * aboutH ? auroraTex : studioTex;
    if (mw > 0.5) crossTo(mp.row >= 0 ? sectorEnv(mp.row) : studioTex);
    else if (scene.environment !== want && !env.tw?.isActive()) crossTo(want);
    // en el bento, encima del estudio, el plano naranja (se intensifica en cada aterrizaje)
    if (orangeTex && scene.environment === studioTex && !env.tw?.isActive() && (tw > 0.001 || env.mix > 0)) {
      env.b = orangeTex;
      env.mix = (ORANGE.base + orange.level) * tw;
      applyMix();
    }
    const guide = Math.max(tw, mw, tmw);
    // nosotros: en una parada quieta de frente (vaivén, ratón, arrastre)
    const hw = about ? holdOf(px, (p) => p.hold && p.front !== false) : 0;
    // arrastre: en las paradas (no en el bento); mientras se arrastra, la pose se queda donde está
    drag.can = about ? tw < 0.5 && Math.max(hw, tmw) > 0.85 && intro.p > 0.9 : tw < 0.5 && j >= 0.999;
    dragStep(ratio);
    if (drag.on) {
      drag.frozen ||= { x: cur.x, y: cur.y, s: cur.s };
      t = { x: drag.frozen.x, y: drag.frozen.y, s: drag.frozen.s, off: false };
    }
    // (no en las paradas fijas, de guía, arrastrado ni volviendo del footer)
    {
      const dw = drag.on || fin.returning ? 0 : (1 - guide) * (1 - hw);
      const dd = dodge.step(((t.x + 1) / 2) * innerWidth, ((1 - t.y) / 2) * H, px, dt, dw);
      if (dd.x || dd.y) t = { ...t, x: t.x + (2 * dd.x) / innerWidth, y: t.y - (2 * dd.y) / H };
    }
    // nosotros: en "Cómo trabajamos" salta por encima de los pasos. (Servicios, AR-F: las tarjetas de la hoja no crean
    // contexto, sus fondos ya quedan debajo del canvas; subirlo taparía "Tres oficios" mientras aún se ve)
    lift(tw > 0.5 && !gate);
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
    if (about) spinAcc += ABOUT.studioSpin * dt * holdOf(px, (p) => p.spin);
    const freeY = (about ? turnAt(px) * TAU + spinAcc : progress * TURNS * TAU) + rotYExtra;
    const wf = Math.max(gate ? 1 - THREE.MathUtils.smoothstep(px, first, first + FRONT * H) : 0, THREE.MathUtils.smoothstep(px, last - FOOTER_FRONT * H, last), guide, hw);
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
      const wx = nx(waitX(px));
      x = wx + (x - wx) * j;
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
    ryAll += seal.spin + drag.spin;
    let rxAdd = 0;
    let rzAdd = 0;
    if (about) {
      const ta = 1 - Math.pow(1 - TILT.lerp, ratio);
      mouse.x += (mouse.tx - mouse.x) * ta;
      mouse.y += (mouse.ty - mouse.y) * ta;
      lean += (side - lean) * (1 - Math.pow(1 - ABOUT.lean.lerp, ratio));
      const still = hw * (1 - tmw);
      osc += ABOUT.idle.speed * dt * still;
      ryAll += Math.sin(osc) * ABOUT.idle.amp * still + mouse.x * TILT.y * hw + lean * ABOUT.lean.y * tmw + (1 - intro.p) * ABOUT.enter.turn;
      rxAdd = mouse.y * TILT.x * hw;
      rzAdd = -mouse.x * TILT.z * hw - lean * ABOUT.lean.z * tmw;
      s *= ABOUT.enter.scale + (1 - ABOUT.enter.scale) * intro.p;
    }
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
    star.rotation.set(cur.rx * Math.min(1, j) + rxAdd, ryAll, cur.rz * Math.min(1, j) + rzAdd);
    trailStep(about ? intro.p : 1);
    gl.draw(scene, 'page');
    gl.measure(dt);
    drawn = true;
    dirty = false;
    seen();
    ringAt();

  });

  if (about) {
    about.classList.add('is-3d');
    if (lenis.scroll < innerHeight) {
      gsap.fromTo(canvas, { opacity: 0 }, { opacity: 1, duration: ABOUT.enter.fade, ease: 'power1.out', clearProps: 'opacity' });
      gsap.to(intro, { p: 1, duration: ABOUT.enter.duration, ease: 'expo.out' });
    } else intro.p = 1;
  }

  window.addEventListener('pagehide', (e) => {
    if (e.persisted) return; // bfcache: al volver, todo sigue
    pmrem.dispose();
    auroraTex?.dispose();
    studioTex.dispose();
    orangeTex?.dispose();
    sectorTex.forEach((t) => t?.dispose());
    trail.dispose();
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
// ancho de las palabras visibles (el manifiesto lleva además el texto entero oculto para el lector de pantalla)
function wordsWidth(el) {
  const words = el.querySelectorAll('.mw');
  if (!words.length) return textWidth(el);
  const left = el.getBoundingClientRect().left;
  return Math.max(...[...words].map((w) => w.getBoundingClientRect().right)) - left;
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
