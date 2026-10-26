import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { finStop } from './fin.js';

// Destello 3D de plata (la estrella de 4 puntas del logo): canvas fijo que recorre la home por un
// camino curvo según el scroll y gira sobre sus ejes. Va por encima de las fotos y fondos y por
// debajo del texto y del menú (z-index, ver css/star.css). Render dentro del loop único (gsap.ticker).
// Render y entorno: copia del visor aprobado por Oscar.
const MODEL = 'assets/3d/disco-star.glb';
const MODEL_HEIGHT = 2.84;          // unidades del modelo (ancho 2.0, grosor 0.50); v1–v3 en legacy/assets/3d/
const MAX_DPR = 2;
const ENV_INTENSITY = 1.15;         // brillo de los reflejos (el visor usaba 1.4; Oscar lo quiere un poco menos brillante)
const FOV = 28;
const CAMERA_Z = 7.6;               // en vertical: max(7.6, 5.2 / aspect)
const HERO_SIZE = 0.45;             // alto del destello en el hero (fracción de la pantalla): el protagonista
const HERO_SIZE_MOBILE = 0.34;
const MOBILE = '(max-width: 639px)';
const TURNS = 2.5;                  // vueltas en Y a lo largo de todo el scroll (gira despacio)
const SCRUB = 2.6;                  // inercia del recorrido: muy smooth, flota con peso
// un solo filtro para posición y tamaño: lerp según el tiempo (a = 1 − e^(−k·dt)), igual a cualquier fps.
// k (por segundo) nunca cambia de golpe: persigue su objetivo con K_EASE (vuelo más lento, scroll rápido…)
const POS_K = 2.14;                 // = lerp 0.035 por frame a 60 fps
const K_EASE = 3;                   // 1/s: lo que tarda k en pasar de un valor a otro (~0.3 s)
const LERP = 0.04;                  // la rotación persigue su objetivo
const SPIN_GAIN = 0.0004;           // velocidad de Lenis → velocidad angular extra
const SPIN_FRICTION = 0.97;         // al parar frena muy suave (~1.5 s)
const SPIN_MAX = 0.035;             // rad/frame: gira más si scrolleas rápido, pero siempre con calma
// entrada en el hero: aparece ya en su sitio y entra fluida, sin vueltas completas: opacidad 0 → 1,
// escala 0.82 → 1, giro en Y de -35° → 0° (acaba exactamente de frente) y una ligera subida (y -0.06 → 0)
const ENTER = { duration: 1.4, scale: 0.82, turn: -35 * (Math.PI / 180), rise: -0.06 };
// en el hero, centrado en el hueco ENTRE el menú y el titular, sin tocar ninguno (se mide con el DOM en cada
// resize: measureHero). Su alto es el del hueco entero menos lo que sube y baja al flotar: el máximo que cabe.
const HERO_POINT = { x: 0, y: 0.5, s: 0.5 };  // si no se puede medir
const HERO_GAP = 20;                          // px libres por arriba (menú) y por abajo (1.ª línea del titular)
const HERO_BOB = 0.04;                        // amplitud de la flotación en el hero (mundo)
// fuera del hero, un 15 % más grande en todos los puntos de paso (equipo, estudio, "por qué", frases y final)
const GROW = 1.15;
// recorrido "libre": deriva orgánica (3 senos lentos de ~7, 11 y 17 s; ±0.035 de pantalla y ±0.06 rad de
// balanceo), inclinación al moverse en horizontal (banking) y algo más de retraso con el scroll rápido.
// La deriva se suma DESPUÉS del filtro (no es parte del objetivo: no se pelea con el lerp).
// Nada de esto en el hero ni en el estudio (ahí va quieto / de frente)
const DRIFT = { amp: 0.035, rot: 0.06, periods: [7, 11, 17] };
const BANK = { gain: 0.35, max: 0.25, lerp: 0.08 };
const LAG = 0.015;                 // k / (1 + |velocidad de Lenis| × LAG)
// vuelo del estudio al anillo de "¿Por qué nosotros?": bezier cúbica que sube (+0.12) y se abre en arco, y
// entra en el anillo desde arriba a la izquierda; sine.inOut, k más lento (= lerp 0.028) y un "aterrizaje" de escala
const FLIGHT = { rise: 0.12, open: 0.15, approach: 0.3, k: 1.70, land: 1.06 };
// llegada al estudio: en las últimas STUDIO_BLEND pantallas antes del pin el punto de la curva se mezcla
// (smoothstep) con el del recorrido del estudio: un solo movimiento, sin cambio de sistema de golpe
const STUDIO_BLEND = 0.5;
// reflejos: del estudio de softboxes a los del estudio 360° con un fundido de los dos mapas (sin bajar el brillo)
const ENV_MIX_K = 4;               // 1/s: lo que tarda el fundido en seguir a su objetivo
// (sin repulsión: el destello puede pasar por detrás de fotos y textos; nunca se frena ni rebota contra ellos)
const VELOCITY_MUTE = 600;                    // ms tras cargar en los que se ignora la velocidad de Lenis
const FRONT_ZONE = 0.35;           // modo frontal: pesa 1 arriba del todo y 0 a 0.35 × alto del hero
const FRONT_LERP = 0.06;           // al volver al hero se recoloca de frente con suavidad (~0.8 s)
const FRONT_BRAKE = 0.85;          // con el modo frontal dominando, frena el giro extra
// prueba: el lateral con la misma textura que las caras (false = lateral liso, como viene en el GLB)
const SIDE_TEXTURE = true;
const HERO_SPIN = 0.3;             // rad/s: en el hero gira muy despacio sobre su eje Y, sin parar (~21 s por vuelta)
const TAU = Math.PI * 2;
// estudio 360° (js/studio.js): quieto en el centro todo el pin, como la modelo de la sesión
// estudio 360° (js/studio.js): su recorrido va con el progreso p del pin, no con el scroll de la página.
// [p, x, y, s]: en el centro mientras se pega el título; en las paradas se aparta abajo a la izquierda (en
// móvil, arriba y más pequeño, entre el título y la claqueta); al final vuelve al centro, de frente
const STUDIO_PATH = [[0, 0, 0.06, 0.55], [0.18, 0, 0.06, 0.55], [0.32, -0.55, -0.3, 0.38], [0.88, -0.55, -0.3, 0.38], [1, 0, 0.06, 0.55]];
const STUDIO_PATH_MOBILE = [[0, 0, 0.04, 0.55], [0.18, 0, 0.04, 0.55], [0.32, 0, 0.42, 0.3], [0.88, 0, 0.42, 0.3], [1, 0, 0.04, 0.55]];
// "¿Por qué nosotros?" (js/why.js): en el hueco del anillo de diafragma (a la derecha, centrado en vertical),
// como lo que el objetivo está enfocando; x se calcula con el ancho (whyPoint). En móvil (sin anillo), arriba a la derecha
const WHY = { x: 0.84, y: 0, s: 0.32 };
const WHY_RING_INSET = 120; // px desde el borde derecho: el centro del hueco visible del anillo
const WHY_MOBILE = { x: 0.6, y: 0.72, s: 0.25 };
// footer (js/fin.js): el último punto de paso es encima del hueco de la estrella del logo, de frente y girando
// despacio. Al entrar el footer del todo "se muere": se apaga parpadeando y lo mueve la física (fin.held)
const FOOTER_FRONT = 0.5;          // × alto de pantalla antes del final: pasa al giro lento de frente, como en el hero
// se funde como un foco: [intensidad (× la normal), s], irregular (~0.7 s); queda al 25 %
const FLICKER = [[0.15, 0.08], [0.9, 0.1], [0.1, 0.14], [0.6, 0.12], [0.25, 0.26]];
const RETURN_LERP = 0.08;          // al revivir vuelve a su recorrido con este lerp (giro)…
const RETURN_K = 5;                // …y este k (posición y tamaño; = lerp 0.08 por frame)
const STUDIO_TURNS = 2;            // vueltas en Y a lo largo del pin (de frente al principio y al final)
const STUDIO_RAMP = 0.6;           // × alto de pantalla: antes y después del pin pasa de su giro normal al del estudio

export function initStar({ gsap, ScrollTrigger, lenis, reduced, loop }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null; // sin WebGL: no se muestra nada
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_DPR));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false; // se limpia a mano: antes del destello puede ir el fondo del estudio (setBackdrop)

  const canvas = renderer.domElement;
  canvas.className = reduced.matches ? 'star-canvas star-canvas--static' : 'star-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  const softbox = studio(renderer);
  scene.environment = softbox; // siempre: el del estudio 360° entra encima con su fundido (envU, mixEnv)
  const envU = { envMap2: { value: softbox }, envMix: { value: 0 }, envRot2: { value: new THREE.Matrix3() } };
  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.position.set(3, 4, 5);
  const back = new THREE.DirectionalLight(0xffe2dc, 0.6);
  back.position.set(-4, -1, -3);
  scene.add(key, back);

  const star = new THREE.Group();   // posición, escala y giro; dentro, el modelo centrado
  star.visible = false;
  scene.add(star);

  // --- modelo: los materiales vienen configurados en el GLB (color, rugosidad y texturas); se
  //   convierten a MeshPhysicalMaterial para añadir el clearcoat del visor aprobado:
  //   face (pulido circular + destellos), side (lisa), engrave (oscura y mate: el grabado) y mark (la estrellita)
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const loaded = loader.loadAsync(MODEL).then((gltf) => {
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const old = o.material;
      const { normalMap, roughnessMap } = old;
      [normalMap, roughnessMap].forEach((t) => { if (t) { t.anisotropy = maxAniso; t.needsUpdate = true; } });
      if (normalMap) normalMap.colorSpace = THREE.NoColorSpace;
      const engrave = old.name === 'disco-star-engrave';
      o.material = new THREE.MeshPhysicalMaterial({
        name: old.name,
        color: old.color.clone(),
        roughness: old.roughness,
        roughnessMap,
        normalMap,
        normalScale: old.normalScale.clone(),
        metalness: 1,
        envMapIntensity: ENV_INTENSITY,
        clearcoat: engrave ? 0 : 1,
        clearcoatRoughness: 0.03,
      });
      old.dispose();
    });
    if (SIDE_TEXTURE) texturizeSide(gltf.scene);
    gltf.scene.traverse((o) => { if (o.isMesh) { materials.push(o.material); mixEnv(o.material, envU); } });
    star.add(gltf.scene);
    renderer.compile(scene, camera); // shaders listos antes de la entrada (sin tirón)
  }).catch(() => {
    failed = true; // sin modelo: sin destello
    canvas.remove();
    renderer.dispose();
  });
  let failed = false;
  const materials = [];

  // --- tamaño y cámara ---
  const view = { halfW: 1, halfH: 1, mobile: false };
  const resize = () => {
    const w = innerWidth;
    const h = innerHeight;
    const aspect = w / h;
    camera.aspect = aspect;
    camera.position.set(0, 0, aspect >= 1 ? CAMERA_Z : Math.max(CAMERA_Z, 5.2 / aspect));
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    view.halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    view.halfW = view.halfH * aspect;
    view.mobile = matchMedia(MOBILE).matches;
    dirty = true;
  };
  let dirty = true;
  window.addEventListener('resize', resize);

  // punto del hero: el hueco entre el bajo de la barra del menú (.nav__float) y el alto de la 1.ª línea del
  // titular, con HERO_GAP de margen a cada lado. Con offsetTop (sin transformaciones: parallax, telón, letras)
  let heroPt = { ...HERO_POINT };
  const measureHero = () => {
    const hero = document.getElementById('hero-main');
    const line = hero?.querySelector('.hero__line');
    const nav = document.querySelector('[data-nav] .nav__float');
    if (!line) return;
    const H = innerHeight;
    const pad = parseFloat(getComputedStyle(line).paddingTop) || 0; // la máscara deja sitio a las tildes
    const from = (nav ? offsetTo(nav, null) + nav.offsetHeight : 70) + HERO_GAP;
    const to = offsetTo(line, hero) + pad - HERO_GAP;
    const bob = (HERO_BOB / (2 * view.halfH)) * H; // px que sube y baja al flotar
    const size = Math.max(0, to - from - 2 * bob);
    heroPt = { x: 0, y: 1 - (from + to) / H, s: size / ((view.mobile ? HERO_SIZE_MOBILE : HERO_SIZE) * H) };
    dirty = true;
  };
  resize();
  measureHero();
  window.addEventListener('resize', () => requestAnimationFrame(() => requestAnimationFrame(measureHero)));
  if (document.fonts) document.fonts.ready.then(() => requestAnimationFrame(measureHero));

  // de pantalla normalizada (x, y de -1 a 1, z = 0) a mundo, y "escala 1" = alto del hero
  const place = (target, p) => {
    target.position.set(p.x * view.halfW, p.y * view.halfH, 0);
    target.scale = (p.s * (view.mobile ? HERO_SIZE_MOBILE : HERO_SIZE) * 2 * view.halfH) / MODEL_HEIGHT;
    return target;
  };

  // --- movimiento reducido: quieto en el hero, de frente, sin recorrido ni giro ---
  if (reduced.matches) {
    const pose = place({ position: new THREE.Vector3() }, heroPt);
    star.position.copy(pose.position);
    star.scale.setScalar(pose.scale);
    star.rotation.set(0, 0, 0);
    const draw = () => {
      const p = place({ position: new THREE.Vector3() }, heroPt);
      star.position.copy(p.position);
      star.scale.setScalar(p.scale);
      renderer.clear();
      renderer.render(scene, camera);
    };
    window.addEventListener('resize', draw);
    return {
      loaded,
      enter() { loaded.then(() => { if (failed) return; star.visible = true; draw(); }); },
      watchScroll() {},
    };
  }

  // --- recorrido: puntos de paso por sección, en píxeles de scroll (se recalculan en cada refresh) ---
  let stops = [];
  let curve = null;
  let hold = null; // tramo del estudio en px de scroll: { start, end }
  let finale = 0;  // px de scroll del final si acaba en el visor del footer (0 = no)
  const studioVec = new THREE.Vector3();
  const buildPath = () => {
    if (!scrollY) measureHero();
    stops = waypoints(view.mobile, ScrollTrigger, heroPt);
    curve = new THREE.CatmullRomCurve3(stops.map((p) => new THREE.Vector3(p.x, p.y, p.s)), false, 'centripetal');
    whyAt = stops.find((p) => p.hold === 'still')?.at || 0;
    const held = stops.filter((p) => p.hold === 'studio');
    hold = held.length === 2 ? { start: held[0].at, end: held[1].at } : null;
    const last = stops[stops.length - 1];
    finale = last.footer ? last.at : 0;
    dirty = true;
  };
  let flying = false; // en el tramo del vuelo al anillo
  const flightVec = new THREE.Vector3();
  const blendVec = new THREE.Vector3();
  // progreso del estudio para el destello: del MISMO scroll suavizado que el resto del recorrido (antes usaba
  // el progreso del panorama, otro reloj con otra inercia: al cruzar el inicio del pin podía saltar)
  const studioAt = (px) => (hold ? THREE.MathUtils.clamp((px - hold.start) / Math.max(1, hold.end - hold.start), 0, 1) : 0);
  // scroll (px) → parámetro de la curva: cada tramo entre dos puntos de paso ocupa lo mismo en la curva
  const curveAt = (px) => {
    const n = stops.length;
    let i = 0;
    while (i < n - 2 && px > stops[i + 1].at) i++;
    // entre los dos puntos de un pin no pasa por la curva (con dos puntos iguales haría un bucle): en el
    // estudio sigue su propio recorrido (según su progreso); en los demás, quieto
    if (stops[i].hold && stops[i].hold === stops[i + 1].hold && px >= stops[i].at) {
      flying = false;
      return stops[i].hold === 'studio' ? studioPoint(studioAt(px), view.mobile, studioVec) : curve.points[i];
    }
    const span = stops[i + 1].at - stops[i].at || 1;
    const f = THREE.MathUtils.clamp((px - stops[i].at) / span, 0, 1);
    flying = stops[i].hold === 'studio' && stops[i + 1].hold === 'still';
    if (flying) return flight(stops[i], stops[i + 1], f, flightVec);
    const pt = curve.getPoint((i + f) / (n - 1));
    // llegada al estudio: en las últimas STUDIO_BLEND pantallas se mezcla con el primer punto de su recorrido
    if (hold && px < hold.start) {
      const b = THREE.MathUtils.smoothstep(px, hold.start - STUDIO_BLEND * innerHeight, hold.start);
      if (b > 0) pt.lerp(studioPoint(0, view.mobile, blendVec), b);
    }
    return pt;
  };

  // progreso con inercia (scrub 1.2) en px de scroll
  const scroll = { px: 0 };
  let watching = false;

  // --- entrada ---
  // p: progreso de la entrada (0 → 1, expo.out). Mientras dura, el destello está "congelado" en el hero:
  // sin scroll, sin velocidad de Lenis, sin lerp ni ajuste de frente. Sigue congelado hasta que hay
  // recorrido (watchScroll); entonces se activa todo partiendo de la pose actual (sin saltos).
  const entry = { p: 0, done: false, instant: false };
  let entered = false;
  let entering = null;
  let live = false;

  // --- estado suavizado ---
  const target = { position: new THREE.Vector3(), scale: 0 };
  const current = { position: new THREE.Vector3(), scale: 0, rx: 0, ry: 0, rz: 0, init: false };
  let angularVel = 0;
  let rotYExtra = 0;
  let prevX = 0;
  let bank = 0;
  const land = { k: 1 };
  let whyAt = 0; // px de scroll en el que llega al anillo (aterrizaje)
  let posK = POS_K; // k actual del filtro de posición y tamaño (persigue su objetivo, ver K_EASE)
  let offW = 1;     // peso de la deriva y la flotación (se suman después del filtro); tras la física del footer vuelve suave
  let hidden = document.hidden;
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; });
  let frame = 0;
  let lastPx = 0;
  const heroEl = document.getElementById('hero-main');
  const lastTarget = { ry: 0, position: new THREE.Vector3(), scale: 0 };
  let heroSpin = 0;
  // estudio 360° (js/studio.js): dibuja su panorama antes que el destello
  let backdrop = null;
  // k: brillo (el footer lo apaga y lo enciende); mix: fundido hacia los reflejos del estudio (to = objetivo),
  // con su propio brillo (studioK) a mix 1
  const env = { k: ENV_INTENSITY, tl: null, mix: 0, to: 0, studioK: ENV_INTENSITY };
  const applyEnv = () => {
    const k = env.k * (1 + (env.studioK / ENV_INTENSITY - 1) * env.mix);
    materials.forEach((m) => { m.envMapIntensity = k; });
    envU.envMix.value = env.mix;
    dirty = true;
  };
  const rot4 = new THREE.Matrix4();
  // footer (js/fin.js): held = lo mueve la física (pose en px de pantalla); returning = volviendo al recorrido
  const fin = { held: false, pose: null, key: '', returning: false, rewrap: false };
  const KEY = key.intensity;
  const BACK = back.intensity;
  const dim = () => { const f = env.k / ENV_INTENSITY; key.intensity = KEY * f; back.intensity = BACK * f; applyEnv(); };

  // pose del hero, colocada directamente (sin lerp); la entrada va encima
  const heroPose = (time) => {
    place(target, heroPt);
    target.position.y += (1 - entry.p) * ENTER.rise * view.halfH;
    current.position.copy(target.position);
    current.scale = target.scale;
    current.rx = 0;
    current.ry = 0;
    current.rz = 0;
    current.init = true;
    lastTarget.ry = 0;
    lastTarget.position.copy(target.position);
    lastTarget.scale = target.scale;
    star.position.copy(target.position);
    star.position.y += Math.sin(time * 0.9) * HERO_BOB;
    star.scale.setScalar(target.scale * (ENTER.scale + (1 - ENTER.scale) * entry.p));
    star.rotation.set(0, (1 - entry.p) * ENTER.turn, 0);
    canvas.style.opacity = entry.p < 1 ? entry.p.toFixed(3) : '';
  };
  // fin de la congelación: velocidad, giro extra y giro lento a cero, la pose actual como punto de partida
  const activate = () => {
    live = true;
    angularVel = 0;
    rotYExtra = 0;
    heroSpin = 0;
    dirty = true;
  };

  loop.add((time, ratio) => {
    if (!entered || hidden) return;
    frame++;
    if (!live) {
      if (entry.done && (curve || entry.instant)) {
        if (!curve) return;
        activate();
      } else {
        if (entry.done && frame % 2) return; // ya quieto, esperando al recorrido: solo flota (30 fps)
        heroPose(time);
        renderer.clear();
        renderer.render(scene, camera);
        return;
      }
    }
    // en el footer, "muerto": lo mueve la física (js/fin.js); aquí solo se pinta (pose en px de pantalla)
    if (fin.held) {
      const p = fin.pose;
      const key = `${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.angle.toFixed(3)}|${p.spinY.toFixed(3)}|${p.h.toFixed(1)}`;
      if (key === fin.key && !dirty) return;
      fin.key = key;
      dirty = false;
      star.position.set(((p.x / innerWidth) * 2 - 1) * view.halfW, (1 - (p.y / innerHeight) * 2) * view.halfH, 0);
      const sc = Math.max(0.0001, ((p.h / innerHeight) * 2 * view.halfH) / MODEL_HEIGHT);
      star.scale.setScalar(sc);
      star.rotation.set(0, p.spinY, -p.angle);
      current.position.copy(star.position);
      current.scale = sc;
      current.rx = 0;
      current.ry = p.spinY;
      current.rz = -p.angle;
      offW = 0;
      renderer.clear();
      renderer.render(scene, camera);
      return;
    }
    const velocity = performance.now() < VELOCITY_MUTE ? 0 : lenis.velocity || 0;
    const backdropMoved = backdrop ? backdrop.update(ratio) : false;
    const dt = ratio / 60;
    // fundido de reflejos (softboxes ↔ estudio 360°): sigue a su objetivo sin saltos ni bajada de brillo
    if (env.mix !== env.to) {
      env.mix += (env.to - env.mix) * (1 - Math.exp(-ENV_MIX_K * dt));
      if (Math.abs(env.to - env.mix) < 0.002) env.mix = env.to;
      applyEnv();
    }

    // peso del estudio: 0 fuera, 1 durante el pin (rampa de STUDIO_RAMP pantallas antes y después)
    // al llegar al visor del footer: giro lento de frente (0 → 1 en la última media pantalla)
    const we = finale ? THREE.MathUtils.smoothstep(scroll.px, finale - FOOTER_FRONT * innerHeight, finale) : 0;
    let ws = 0;
    if (hold) {
      const ramp = STUDIO_RAMP * innerHeight;
      ws = THREE.MathUtils.smoothstep(scroll.px, hold.start - ramp, hold.start)
        * (1 - THREE.MathUtils.smoothstep(scroll.px, hold.end, hold.end + ramp));
    }

    // modo frontal: en el centro del hero el destello mira a cámara con "disco" legible (w = 1);
    // al bajar se libera poco a poco la rotación del scroll (w → 0)
    const heroH = heroEl ? heroEl.offsetHeight : innerHeight;
    const w = 1 - THREE.MathUtils.smoothstep(lenis.scroll, 0, FRONT_ZONE * heroH);

    // giro extra por la velocidad del scroll: más rápido, más gira; al parar frena suave
    angularVel = (angularVel + velocity * SPIN_GAIN * ratio) * Math.pow(SPIN_FRICTION, ratio);
    angularVel = THREE.MathUtils.clamp(angularVel, -SPIN_MAX, SPIN_MAX);
    if (w > 0.5) angularVel *= Math.pow(FRONT_BRAKE, ratio); // en el hero no sigue girando
    rotYExtra += angularVel * ratio;
    heroSpin += HERO_SPIN * (ratio / 60); // empieza cuando la entrada ya ha acabado de frente

    // aún llegando a su sitio (los lerps son lentos): a 60 fps hasta que se asiente
    const settling = Math.abs(current.ry - lastTarget.ry) > 0.001 || current.position.distanceToSquared(lastTarget.position) > 1e-3 // > ~0.03 u: no cuenta el retraso de la flotación
      || Math.abs(current.scale - lastTarget.scale) > 1e-4;
    const moving = Math.abs(velocity) > 0.01 || Math.abs(angularVel) > 0.0005
      || Math.abs(scroll.px - lastPx) > 0.1 || dirty || settling || backdropMoved;
    lastPx = scroll.px;
    if (fin.returning && !settling && !dirty) fin.returning = false; // ya de vuelta en su recorrido
    // en reposo solo queda la flotación, que es lenta: a 30 fps basta
    if (!moving && frame % 2) return;
    dirty = false;

    const p = curveAt(scroll.px);
    place(target, { x: p.x, y: p.y, s: p.z });
    // libre (fuera del hero y del estudio): deriva orgánica; en el hero, solo la flotación vertical.
    // Las dos se suman después del filtro (abajo), no al objetivo
    const free = (1 - w) * (1 - ws) * (1 - we);
    const d = drift(time);
    // aterrizaje en el anillo de "¿Por qué nosotros?"
    if (whyAt && lastPx < whyAt && scroll.px >= whyAt) gsap.fromTo(land, { k: FLIGHT.land }, { k: 1, duration: 0.7, ease: 'back.out(1.4)', overwrite: true });

    // rotación libre (scroll + velocidad + balanceo) y pose frontal: la vuelta completa más cercana,
    // sin balanceo en X/Z (en el hero solo flota en vertical, para que el grabado se lea quieto)
    const progress = scroll.px / Math.max(1, ScrollTrigger.maxScroll(window));
    const freeY = progress * TURNS * TAU + rotYExtra;
    const freeX = Math.sin(time * 0.5) * 0.06 + THREE.MathUtils.clamp(velocity * 0.001, -0.22, 0.22);
    const freeZ = Math.sin(time * 0.35) * 0.05;
    // en el hero: el ángulo del giro lento más cercano a la rotación libre (nunca más de media vuelta)
    const toHero = THREE.MathUtils.euclideanModulo(heroSpin - freeY + Math.PI, TAU) - Math.PI;
    // en el estudio: STUDIO_TURNS vueltas con el progreso del pin, de frente al principio y al final
    // (el ángulo equivalente más cercano a la rotación libre, como en el hero); casi sin balanceo
    const studioY = STUDIO_TURNS * TAU * THREE.MathUtils.smoothstep(studioAt(scroll.px), 0.05, 0.95);
    const toStudio = THREE.MathUtils.euclideanModulo(studioY - freeY + Math.PI, TAU) - Math.PI;
    const toEnd = THREE.MathUtils.euclideanModulo(heroSpin - freeY + Math.PI, TAU) - Math.PI;
    const ry = freeY + toHero * w + toStudio * ws + toEnd * we;
    const rx = freeX * (1 - w) * (1 - 0.7 * ws) * (1 - we);
    // inclinación al moverse en horizontal (banking) + balanceo de la deriva
    const vx = ((current.position.x - prevX) / view.halfW) / Math.max(1e-3, ratio / 60);
    prevX = current.position.x;
    const bankTo = THREE.MathUtils.clamp(-vx * BANK.gain, -BANK.max, BANK.max) * free;
    bank += (bankTo - bank) * (1 - Math.pow(1 - BANK.lerp, ratio));
    const rz = freeZ * (1 - w) * (1 - 0.7 * ws) * (1 - we) + bank + d.r * free;

    const lerp = fin.returning ? RETURN_LERP : LERP + (FRONT_LERP - LERP) * w;
    // al revivir: la vuelta equivalente más cercana (no deshace las vueltas que dio en el suelo)
    if (fin.rewrap) {
      current.ry += Math.round((ry - current.ry) / TAU) * TAU;
      current.rz = THREE.MathUtils.euclideanModulo(current.rz + Math.PI, TAU) - Math.PI;
      fin.rewrap = false;
    }
    // si el objetivo salta una vuelta entera (se ve igual), la rotación actual salta con él: sin vueltas de más
    if (current.init && Math.abs(ry - lastTarget.ry) > Math.PI) current.ry += Math.round((ry - lastTarget.ry) / TAU) * TAU;
    const a = current.init ? 1 - Math.pow(1 - lerp, ratio) : 1;
    // posición y tamaño: un solo filtro, a = 1 − e^(−k·dt). Con el scroll rápido se queda algo atrás y alcanza
    // después (pesa); en el vuelo, más lento. k nunca salta: persigue su objetivo
    const kTo = fin.returning ? RETURN_K : (flying ? FLIGHT.k : POS_K) / (1 + Math.abs(velocity) * LAG);
    posK += (kTo - posK) * (1 - Math.exp(-K_EASE * dt));
    const ap = current.init ? 1 - Math.exp(-posK * dt) : 1;
    current.init = true;
    current.position.lerp(target.position, ap);
    current.scale += (target.scale - current.scale) * ap;
    current.rx += (rx - current.rx) * a;
    current.ry += (ry - current.ry) * a;
    current.rz += (rz - current.rz) * a;
    lastTarget.ry = ry;
    lastTarget.position.copy(target.position);
    lastTarget.scale = target.scale;

    // deriva (libre) y flotación (hero, estudio y final), encima de la posición filtrada
    offW += (1 - offW) * (1 - Math.exp(-3 * dt));
    star.position.copy(current.position);
    star.position.x += d.x * view.halfW * free * offW;
    star.position.y += (d.y * view.halfH * free + Math.sin(time * 0.9) * HERO_BOB * (1 - free)) * offW;
    star.scale.setScalar(Math.max(0.0001, current.scale * land.k));
    star.rotation.set(current.rx, current.ry, current.rz);

    renderer.clear();
    if (backdrop) backdrop.draw(renderer);
    renderer.render(scene, camera);
  });

  return {
    loaded,
    // entrada en el hero (cuando se va el flash o se abre el velo de la transición). Resuelve al acabar.
    // instant: la URL trae un #ancla → sin entrada, directamente en su punto del recorrido
    enter({ instant = false } = {}) {
      if (entering) return entering;
      entering = loaded.then(() => new Promise((resolve) => {
        if (failed) { resolve(); return; }
        entered = true;
        star.visible = true;
        if (instant) {
          entry.instant = true;
          entry.p = 1;
          entry.done = true;
          current.init = false; // primer frame: directamente en su sitio
          resolve();
          return;
        }
        // primer render (compila los shaders y sube las texturas) con el lienzo invisible, y la entrada
        // en el frame siguiente: así ese tirón no cae dentro de la animación
        heroPose(gsap.ticker.time);
        canvas.style.opacity = '0';
        renderer.render(scene, camera);
        requestAnimationFrame(() => requestAnimationFrame(() => gsap.fromTo(entry, { p: 0 }, {
          p: 1,
          duration: ENTER.duration,
          ease: 'expo.out',
          onComplete: () => { entry.done = true; resolve(); },
        })));
      }));
      return entering;
    },
    // después de crear los pines del estudio y de "por qué" (sus posiciones cuentan en los puntos de paso)
    watchScroll() {
      if (watching) return;
      watching = true;
      buildPath();
      ScrollTrigger.addEventListener('refresh', buildPath);
      gsap.to(scroll, {
        px: () => ScrollTrigger.maxScroll(window),
        ease: 'none',
        scrollTrigger: { start: 0, end: 'max', scrub: SCRUB, invalidateOnRefresh: true },
      });
    },

    // --- para el estudio 360° (js/studio.js): mismo renderer, mismo loop ---
    renderer,
    get ok() { return !failed; },
    // { update(ratio) → true si ha cambiado algo, draw(renderer) }: se dibuja antes que el destello
    setBackdrop(b) { backdrop = b; dirty = true; },
    // reflejos del estudio 360°: texture (PMREM del mismo tamaño que el de softboxes, 256), mix 0–1 (el destello
    // lo sigue con un fundido de los dos mapas: el brillo nunca baja) e intensity (su brillo con mix 1).
    // texture = null → fuera ya, sin fundido (antes de liberar la textura)
    setEnvMix(texture, mix, intensity) {
      if (!texture) {
        env.to = 0;
        env.mix = 0;
        envU.envMap2.value = softbox;
        applyEnv();
        return;
      }
      envU.envMap2.value = texture;
      env.studioK = intensity;
      env.to = THREE.MathUtils.clamp(mix, 0, 1);
    },
    // el entorno de reflejos del estudio gira igual que el panorama
    setEnvRotation(y) {
      envU.envRot2.value.setFromMatrix4(rot4.makeRotationY(-y));
    },
    // dispositivo justo: baja la resolución del canvas
    setDpr(dpr) { renderer.setPixelRatio(dpr); resize(); },

    // --- para el footer (js/fin.js): se muere, lo mueve la física, se encaja o revive ---
    footer: {
      get ready() { return live && !!curve && !failed; },
      get failed() { return failed; },
      // dónde está ahora (px de pantalla), su alto en px y su giro en Y
      screen() {
        return {
          x: ((star.position.x / view.halfW + 1) / 2) * innerWidth,
          y: ((1 - star.position.y / view.halfH) / 2) * innerHeight,
          h: ((star.scale.x * MODEL_HEIGHT) / (2 * view.halfH)) * innerHeight,
          ry: current.ry,
        };
      },
      // pose = { x, y, angle, spinY, h } en px de pantalla: fin.js la actualiza cada frame
      hold(pose) { fin.held = true; fin.pose = pose; fin.key = ''; dirty = true; },
      release() { fin.held = false; fin.returning = true; fin.rewrap = true; dirty = true; },
      // se funde como un foco (irregular) y se queda casi apagado
      flicker() {
        env.tl?.kill();
        env.tl = gsap.timeline();
        FLICKER.forEach(([k, d]) => env.tl.to(env, { k: k * ENV_INTENSITY, duration: d, ease: 'none', onUpdate: dim }));
      },
      relight() {
        env.tl?.kill();
        env.tl = gsap.to(env, { k: ENV_INTENSITY, duration: 0.4, ease: 'sine.out', onUpdate: dim });
      },
      fade(opacity, duration) {
        gsap.to(canvas, {
          opacity,
          duration,
          ease: 'power1.out',
          overwrite: true,
          onComplete: () => { if (opacity === 1) canvas.style.opacity = ''; },
        });
      },
    },
  };
}

// Fundido de dos mapas de reflejos (PMREM, mismo tamaño): el de la escena (envMap) y el del estudio (envMap2,
// con su giro envRot2), mezclados con envMix en la irradiancia y en la radiancia (también la del clearcoat)
function mixEnv(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const chunk = THREE.ShaderChunk.envmap_physical_pars_fragment
      .replace('#ifdef USE_ENVMAP', `#ifdef USE_ENVMAP
	uniform sampler2D envMap2;
	uniform float envMix;
	uniform mat3 envRot2;
	vec4 mixEnv( const in vec3 dir, const in float roughness ) {
		vec4 a = textureCubeUV( envMap, envMapRotation * dir, roughness );
		return envMix > 0.0 ? mix( a, textureCubeUV( envMap2, envRot2 * dir, roughness ), envMix ) : a;
	}`)
      .replace('textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 )', 'mixEnv( worldNormal, 1.0 )')
      .replace('textureCubeUV( envMap, envMapRotation * reflectVec, roughness )', 'mixEnv( reflectVec, roughness )');
    shader.fragmentShader = shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>', chunk);
  };
  material.customProgramCacheKey = () => 'disco-star-envmix';
}

// top de el respecto a stop (o a la página si stop es null), sin transformaciones
function offsetTo(el, stop) {
  let y = 0;
  for (let n = el; n && n !== stop; n = n.offsetParent) y += n.offsetTop;
  return y;
}

// Deriva orgánica: 3 senos lentos en x e y (periodos ~7, 11 y 17 s) y balanceo; amplitud total ±DRIFT
function drift(t) {
  const [a, b, c] = DRIFT.periods.map((T) => (t * Math.PI * 2) / T);
  return {
    x: (Math.sin(a) * 0.5 + Math.sin(b + 1.3) * 0.3 + Math.sin(c + 2.1) * 0.2) * DRIFT.amp,
    y: (Math.sin(b + 0.7) * 0.5 + Math.sin(a + 2.4) * 0.3 + Math.sin(c + 4.0) * 0.2) * DRIFT.amp,
    r: (Math.sin(c + 0.5) * 0.6 + Math.sin(a * 0.9 + 1.1) * 0.4) * DRIFT.rot,
  };
}

// Vuelo del estudio al anillo: bezier cúbica (sube y se abre en arco; entra desde arriba a la izquierda), sine.inOut
function flight(a, b, f, out) {
  const e = -(Math.cos(Math.PI * f) - 1) / 2;
  const p1 = [a.x + (b.x - a.x) * FLIGHT.open, a.y + FLIGHT.rise];
  const p2 = [b.x - FLIGHT.approach, b.y + FLIGHT.approach];
  const u = 1 - e;
  const bz = (p0, q1, q2, p3) => u * u * u * p0 + 3 * u * u * e * q1 + 3 * u * e * e * q2 + e * e * e * p3;
  return out.set(bz(a.x, p1[0], p2[0], b.x), bz(a.y, p1[1], p2[1], b.y), a.s + (b.s - a.s) * e);
}

// Puntos de paso de la home: x, y de pantalla normalizados (-1..1), s = escala (1 = alto del hero),
// at = posición de scroll (px) en la que el destello está ahí. Nunca encima de un bloque de texto.
// hold: los dos extremos de un pin ('studio': el estudio 360°, con su propio recorrido; 'still': quieto).
function waypoints(mobile, ScrollTrigger, heroPt = HERO_POINT) {
  const max = Math.max(1, ScrollTrigger.maxScroll(window));
  const hero = { at: 0, ...heroPt };
  const team = teamPoints(mobile);                       // cofundadores: a la derecha de la frase y luego entre las fotos
  const pt = ([, x, y, s]) => ({ x, y, s });
  const path = mobile ? STUDIO_PATH_MOBILE : STUDIO_PATH;
  const studioSt = ScrollTrigger.getById('studio');
  const studio = studioSt ? [
    { ...pt(path[0]), at: studioSt.start, hold: 'studio' },
    { ...pt(path[path.length - 1]), at: studioSt.end, hold: 'studio' },
  ] : [];
  const whySt = ScrollTrigger.getById('why');
  const at = mobile ? WHY_MOBILE : { ...WHY, x: ((innerWidth - WHY_RING_INSET) / innerWidth) * 2 - 1 };
  const why = whySt ? [
    { ...at, at: whySt.start, hold: 'still' },
    { ...at, at: Math.min(max, Math.max(whySt.start + 1, whySt.end)), hold: 'still' },
  ] : [];
  // frase puente y cierre de la home: en el hueco libre de cada bloque cuando está centrado en pantalla
  // (data-star-stop="x,y,s" en escritorio y data-star-stop-m en móvil, en el HTML). Nunca dentro de un pin.
  const pins = [studio, why].filter((p) => p.length === 2).map(([a, b]) => [a.at, b.at]);
  const stops = [...document.querySelectorAll('[data-star-stop]')].map((el) => {
    const [x, y, s] = (mobile && el.dataset.starStopM ? el.dataset.starStopM : el.dataset.starStop).split(',').map(Number);
    const r = el.getBoundingClientRect();
    const at = Math.round(r.top + scrollY + r.height / 2 - innerHeight / 2);
    return { x, y, s, at: Math.min(max - 2, at) };
  }).filter((p) => p.at > 1 && !pins.some(([a, b]) => p.at >= a - 1 && p.at <= b + 1));
  const last = Math.max(why.length ? why[why.length - 1].at : 0, ...stops.map((p) => p.at));
  const end = last < max - 1 ? [{ ...footerPoint(mobile, max, at), at: max }] : [];
  const grown = [...team, ...studio, ...why, ...stops].map((p) => ({ ...p, s: p.s * GROW }));
  return [hero, ...grown, ...end].sort((p, q) => p.at - q.at);
}

// Cofundadores: 1) mientras la frase cruza el centro de la pantalla, a su derecha (la frase ocupa las
// columnas 1–7 y el hueco de las fotos cae en ese mismo rango: sin este punto el destello la cruzaría);
// 2) en el hueco entre las dos fotos (columnas 6–7), a la altura del centro de la
// foto de Luna, escala 0.30. Se mide sin transformaciones (parallax / entradas): offsetTop / offsetLeft.
// at = el scroll en el que el centro de la foto de Luna está en el centro de la pantalla (ahí su parallax
// es 0). En móvil (una columna) va en el margen libre a la derecha de Luna.
function teamPoints(mobile) {
  const luna = document.querySelector('.team__person--luna .team__frame');
  const bruno = document.querySelector('.team__person--bruno .team__frame');
  const phrase = document.querySelector('.team__phrase');
  if (!luna || !bruno || !phrase) return [];
  const box = (el) => {
    let x = 0;
    let y = 0;
    for (let e = el; e; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  };
  const l = box(luna);
  const b = box(bruno);
  const at = Math.max(1, l.y + l.h / 2 - innerHeight / 2);
  const gap = mobile ? (l.x + l.w + document.documentElement.clientWidth) / 2 : (l.x + l.w + b.x) / 2;
  // el hueco entre las dos fotos (en móvil, el margen a la derecha de Luna): cabe entero, nunca encima de una foto
  const room = mobile ? document.documentElement.clientWidth - (l.x + l.w) : b.x - (l.x + l.w);
  const fits = (room * 0.8) / (0.704 * (mobile ? HERO_SIZE_MOBILE : HERO_SIZE) * innerHeight) / GROW;
  const p = box(phrase);
  const right = Math.min(0.62, ((p.x + p.w) / innerWidth) * 2 - 1 + 0.45); // a la derecha del texto
  return [
    { at: Math.max(1, p.y + p.h / 2 - innerHeight / 2), x: mobile ? 0.55 : right, y: mobile ? 0.55 : 0.1, s: 0.35 },
    { at, x: (gap / innerWidth) * 2 - 1, y: 0, s: Math.min(0.3, fits) },
  ];
}

// Estudio oscuro con softboxes → mapa de entorno (lo que hace que parezca plata pulida)
function studio(renderer) {
  const env = new THREE.Scene();
  const disposables = [];
  const add = (geometry, material) => {
    disposables.push(geometry, material);
    const mesh = new THREE.Mesh(geometry, material);
    env.add(mesh);
    return mesh;
  };
  add(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0b0b0d, side: THREE.BackSide }));
  const panel = (w, h, [x, y, z], color, intensity) => {
    const m = add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
  };
  panel(10, 3, [0, 9, 2], 0xffffff, 6);      // softbox superior
  panel(2, 12, [-9, 0, 3], 0xffffff, 4);     // tira izquierda
  panel(2, 12, [9, 1, -2], 0xf2f4ff, 3.5);   // tira derecha fría
  panel(8, 2, [0, -8, 4], 0xffffff, 1.2);    // rebote del suelo
  panel(6, 6, [0, 2, -10], 0xff3a1a, 1.6);   // rebote rojo por detrás (casa con la foto del hero)
  panel(3, 3, [6, -3, 8], 0xffffff, 2.5);    // kicker para los brillos
  panel(16, 7, [-3, 4, 13], 0xffffff, 1.1);  // panel frontal grande (detrás de la cámara): sin él las caras planas se ven negras de frente

  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  disposables.forEach((d) => d.dispose());
  return texture;
}

// El lateral no trae coordenadas de textura: se le generan con una proyección plana según hacia
// dónde mira cada vértice (lateral "en X" → (z, y); "en Y" → (x, z)), con la misma densidad que la
// cara, y recibe el material de la cara (normalMap + roughnessMap) con el color del lateral.
function texturizeSide(root) {
  let face = null;
  let side = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.name === 'disco-star-face') face = o;
    if (o.material.name === 'disco-star-side') side = o;
  });
  if (!face || !side || !face.geometry.attributes.uv) return;

  // densidad de la cara: unidades de uv por unidad de modelo (en x)
  const fp = face.geometry.attributes.position;
  const fuv = face.geometry.attributes.uv;
  let minX = Infinity, maxX = -Infinity, minU = Infinity, maxU = -Infinity;
  for (let i = 0; i < fp.count; i++) {
    minX = Math.min(minX, fp.getX(i)); maxX = Math.max(maxX, fp.getX(i));
    minU = Math.min(minU, fuv.getX(i)); maxU = Math.max(maxU, fuv.getX(i));
  }
  const density = (maxU - minU) / (maxX - minX || 1);

  const pos = side.geometry.attributes.position;
  const nrm = side.geometry.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const alongX = Math.abs(nrm.getX(i)) > Math.abs(nrm.getY(i));
    uv[i * 2] = 0.5 + (alongX ? z + y * 0.37 : x) * density;     // 0.37: desfase para que las dos proyecciones no repitan el mismo trozo
    uv[i * 2 + 1] = 0.5 + (alongX ? y : z + x * 0.37) * density;
  }
  side.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  const m = face.material.clone();
  m.name = 'disco-star-side';
  m.color.copy(side.material.color);
  side.material.dispose();
  side.material = m;
}

// Punto del recorrido del estudio para su progreso p (entre claves, suave)
function studioPoint(p, mobile, out) {
  const path = mobile ? STUDIO_PATH_MOBILE : STUDIO_PATH;
  let i = 1;
  while (i < path.length - 1 && p > path[i][0]) i++;
  const [p0, x0, y0, s0] = path[i - 1];
  const [p1, x1, y1, s1] = path[i];
  const t = THREE.MathUtils.smoothstep(p, p0, p1);
  return out.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, (s0 + (s1 - s0) * t) * GROW);
}

// Final en el footer (js/fin.js): centrado, 30 vh por encima del hueco de la estrella del logo, con un alto de
// 1.6 × el hueco (siempre entero entre el email y el logo), medido con el scroll al final. Sin footer: por arriba.
function footerPoint(mobile, max, fallback) {
  const stop = finStop(max, GROW);
  if (!stop) return { ...fallback, y: 1.6 };
  const size = mobile ? HERO_SIZE_MOBILE : HERO_SIZE;
  return { x: 0, y: 1 - (2 * stop.cy) / innerHeight, s: stop.h / (size * innerHeight), footer: true };
}
