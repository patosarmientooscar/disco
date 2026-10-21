import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

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
const POS_LERP = 0.035;             // la posición (y el tamaño) persigue al punto de la curva
const LERP = 0.04;                  // la rotación persigue su objetivo
const SPIN_GAIN = 0.0004;           // velocidad de Lenis → velocidad angular extra
const SPIN_FRICTION = 0.97;         // al parar frena muy suave (~1.5 s)
const SPIN_MAX = 0.035;             // rad/frame: gira más si scrolleas rápido, pero siempre con calma
const ENTER = { duration: 1.4, turns: 2 };   // vueltas completas: acaba de frente
const FRONT_ZONE = 0.35;           // modo frontal: pesa 1 arriba del todo y 0 a 0.35 × alto del hero
const FRONT_LERP = 0.06;           // al volver al hero se recoloca de frente con suavidad (~0.8 s)
const FRONT_BRAKE = 0.85;          // con el modo frontal dominando, frena el giro extra
// prueba: el lateral con la misma textura que las caras (false = lateral liso, como viene en el GLB)
const SIDE_TEXTURE = true;
const HERO_SPIN = 0.3;             // rad/s: en el hero gira muy despacio sobre su eje Y, sin parar (~21 s por vuelta)
const TAU = Math.PI * 2;

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

  const canvas = renderer.domElement;
  canvas.className = reduced.matches ? 'star-canvas star-canvas--static' : 'star-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  scene.environment = studio(renderer);
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
    star.add(gltf.scene);
    renderer.compile(scene, camera); // shaders listos antes de la entrada (sin tirón)
  }).catch(() => {
    failed = true; // sin modelo: sin destello
    canvas.remove();
    renderer.dispose();
  });
  let failed = false;

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
  resize();

  // de pantalla normalizada (x, y de -1 a 1, z = 0) a mundo, y "escala 1" = alto del hero
  const place = (target, p) => {
    target.position.set(p.x * view.halfW, p.y * view.halfH, 0);
    target.scale = (p.s * (view.mobile ? HERO_SIZE_MOBILE : HERO_SIZE) * 2 * view.halfH) / MODEL_HEIGHT;
    return target;
  };

  // --- movimiento reducido: quieto en el hero, de frente, sin recorrido ni giro ---
  if (reduced.matches) {
    const pose = place({ position: new THREE.Vector3() }, { x: 0, y: 0.08, s: 1 });
    star.position.copy(pose.position);
    star.scale.setScalar(pose.scale);
    star.rotation.set(0, 0, 0);
    const draw = () => {
      const p = place({ position: new THREE.Vector3() }, { x: 0, y: 0.08, s: 1 });
      star.position.copy(p.position);
      star.scale.setScalar(p.scale);
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
  const buildPath = () => {
    stops = waypoints(view.mobile, ScrollTrigger);
    curve = new THREE.CatmullRomCurve3(stops.map((p) => new THREE.Vector3(p.x, p.y, p.s)), false, 'centripetal');
    dirty = true;
  };
  // scroll (px) → parámetro de la curva: cada tramo entre dos puntos de paso ocupa lo mismo en la curva
  const curveAt = (px) => {
    const n = stops.length;
    let i = 0;
    while (i < n - 2 && px > stops[i + 1].at) i++;
    const span = stops[i + 1].at - stops[i].at || 1;
    const f = THREE.MathUtils.clamp((px - stops[i].at) / span, 0, 1);
    return curve.getPoint((i + f) / (n - 1));
  };

  // progreso con inercia (scrub 1.2) en px de scroll
  const scroll = { px: 0 };
  let watching = false;

  // --- entrada ---
  const entry = { k: 0, spin: 0 };
  let entered = false;

  // --- estado suavizado ---
  const target = { position: new THREE.Vector3(), scale: 0 };
  const current = { position: new THREE.Vector3(), scale: 0, rx: 0, ry: 0, rz: 0, init: false };
  let angularVel = 0;
  let rotYExtra = 0;
  let hidden = document.hidden;
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; });
  let frame = 0;
  let lastPx = 0;
  const heroEl = document.getElementById('hero-main');
  const lastTarget = { ry: 0, position: new THREE.Vector3(), scale: 0 };
  let heroSpin = 0;

  loop.add((time, ratio) => {
    if (!entered || hidden || !curve) return;
    frame++;
    const velocity = lenis.velocity || 0;

    // modo frontal: en el centro del hero el destello mira a cámara con "disco" legible (w = 1);
    // al bajar se libera poco a poco la rotación del scroll (w → 0)
    const heroH = heroEl ? heroEl.offsetHeight : innerHeight;
    const w = 1 - THREE.MathUtils.smoothstep(lenis.scroll, 0, FRONT_ZONE * heroH);

    // giro extra por la velocidad del scroll: más rápido, más gira; al parar frena suave
    angularVel = (angularVel + velocity * SPIN_GAIN * ratio) * Math.pow(SPIN_FRICTION, ratio);
    angularVel = THREE.MathUtils.clamp(angularVel, -SPIN_MAX, SPIN_MAX);
    if (w > 0.5) angularVel *= Math.pow(FRONT_BRAKE, ratio); // en el hero no sigue girando
    rotYExtra += angularVel * ratio;
    if (entry.k >= 1) heroSpin += HERO_SPIN * (ratio / 60); // empieza cuando la entrada ya ha acabado de frente

    // aún llegando a su sitio (los lerps son lentos): a 60 fps hasta que se asiente
    const settling = Math.abs(current.ry - lastTarget.ry) > 0.001 || current.position.distanceToSquared(lastTarget.position) > 1e-3 // > ~0.03 u: no cuenta el retraso de la flotación
      || Math.abs(current.scale - lastTarget.scale) > 1e-4;
    const moving = Math.abs(velocity) > 0.01 || Math.abs(angularVel) > 0.0005
      || Math.abs(scroll.px - lastPx) > 0.1 || entry.k < 1 || dirty || settling;
    lastPx = scroll.px;
    // en reposo solo queda la flotación, que es lenta: a 30 fps basta
    if (!moving && frame % 2) return;
    dirty = false;

    const p = curveAt(scroll.px);
    place(target, { x: p.x, y: p.y, s: p.z });
    target.position.y += Math.sin(time * 0.9) * 0.04;

    // rotación libre (scroll + velocidad + balanceo) y pose frontal: la vuelta completa más cercana,
    // sin balanceo en X/Z (en el hero solo flota en vertical, para que el grabado se lea quieto)
    const progress = scroll.px / Math.max(1, ScrollTrigger.maxScroll(window));
    const freeY = progress * TURNS * TAU + rotYExtra;
    const freeX = Math.sin(time * 0.5) * 0.06 + THREE.MathUtils.clamp(velocity * 0.001, -0.22, 0.22);
    const freeZ = Math.sin(time * 0.35) * 0.05;
    // en el hero: el ángulo del giro lento más cercano a la rotación libre (nunca más de media vuelta)
    const toHero = THREE.MathUtils.euclideanModulo(heroSpin - freeY + Math.PI, TAU) - Math.PI;
    const ry = freeY + toHero * w;
    const rx = freeX * (1 - w);
    const rz = freeZ * (1 - w);

    const lerp = LERP + (FRONT_LERP - LERP) * w;
    // si el objetivo salta una vuelta entera (se ve igual), la rotación actual salta con él: sin vueltas de más
    if (current.init && Math.abs(ry - lastTarget.ry) > Math.PI) current.ry += Math.round((ry - lastTarget.ry) / TAU) * TAU;
    const a = current.init ? 1 - Math.pow(1 - lerp, ratio) : 1;
    const ap = current.init ? 1 - Math.pow(1 - POS_LERP, ratio) : 1;
    current.init = true;
    current.position.lerp(target.position, ap);
    current.scale += (target.scale - current.scale) * ap;
    current.rx += (rx - current.rx) * a;
    current.ry += (ry - current.ry) * a;
    current.rz += (rz - current.rz) * a;
    lastTarget.ry = ry;
    lastTarget.position.copy(target.position);
    lastTarget.scale = target.scale;

    // la entrada (escala y vueltas) va encima, sin suavizar: es su propia curva expo
    star.position.copy(current.position);
    star.scale.setScalar(Math.max(0.0001, current.scale * entry.k));
    star.rotation.set(current.rx, current.ry + entry.spin, current.rz);
    renderer.render(scene, camera);
  });

  return {
    loaded,
    // con "disco:intro-done", a la vez que la frase del hero: escala 0 → 1 y 2 vueltas (acaba de frente)
    enter() {
      if (entered) return;
      loaded.then(() => {
        if (failed) return;
        entered = true;
        star.visible = true;
        if (!curve) buildPath();
        gsap.fromTo(entry, { k: 0, spin: -ENTER.turns * Math.PI * 2 }, { k: 1, spin: 0, duration: ENTER.duration, ease: 'expo.out' });
      });
    },
    // después del pin de servicios (sus posiciones cuentan en los puntos de paso)
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
  };
}

// Puntos de paso de la home: x, y de pantalla normalizados (-1..1), s = escala (1 = alto del hero),
// at = posición de scroll (px) en la que el destello está ahí. Nunca encima de un bloque de texto:
// en servicios (escritorio) va al hueco entre la lista y el visor.
function waypoints(mobile, ScrollTrigger) {
  const max = Math.max(1, ScrollTrigger.maxScroll(window));
  const services = document.getElementById('servicios');
  const top = services ? services.getBoundingClientRect().top + scrollY : max / 2;
  const pin = ScrollTrigger.getAll().find((st) => st.pin && services?.contains(st.pin));
  const hero = { at: 0, x: 0, y: 0.08, s: 1 };          // encima de la frase, sin tocarla ni al menú
  const team = teamPoints(mobile);                       // cofundadores: a la derecha de la frase y luego entre las fotos
  // móvil: en el hueco entre el último servicio y "¿Hablamos de tu local?" (medido al final del scroll)
  const endY = (() => {
    const last = services && [...services.querySelectorAll('.service')].pop();
    const outro = services && services.querySelector('.services__outro-title');
    if (!mobile || !last || !outro) return 0.3;
    const docTop = (el) => el.getBoundingClientRect().top + scrollY;
    const mid = (docTop(last) + last.offsetHeight + docTop(outro)) / 2 - max; // px en pantalla al final
    return 1 - (mid / innerHeight) * 2;
  })();
  const end = { at: max, x: 0, y: endY, s: mobile ? 0.4 : 0.5 };

  if (mobile || !pin) {
    // apilado: alterna a los lados, por detrás del contenido
    const side = mobile ? 0.45 : 0.62;
    const h = services ? services.offsetHeight : max;
    return [
      hero,
      ...team,
      { at: top, x: side, y: 0.2, s: 0.4 },
      { at: Math.min(max - 1, top + h * 0.5), x: -side, y: -0.1, s: 0.36 },
      end,
    ].filter(Boolean).sort((a, b) => a.at - b.at);
  }

  // escritorio: el hueco entre el texto de la lista y el encuadre del visor
  const gapX = (() => {
    const list = services.querySelector('.services__list');
    const viewer = services.querySelector('[data-viewer-frame]');
    if (!list || !viewer) return 0.1;
    const right = Math.max(...[...list.querySelectorAll('.service__name, .service__desc, .service__deliverables')]
      .map((e) => e.getBoundingClientRect().right));
    const left = viewer.getBoundingClientRect().left;
    return ((right + left) / 2 / innerWidth) * 2 - 1;
  })();
  return [
    hero,
    ...team,
    { at: pin.start, x: gapX, y: 0.05, s: 0.4 },     // s 0.4 ≈ 18% del alto de pantalla
    { at: pin.end, x: gapX, y: -0.1, s: 0.36 },
    end,
  ].filter(Boolean);
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
  const p = box(phrase);
  const right = Math.min(0.62, ((p.x + p.w) / innerWidth) * 2 - 1 + 0.45); // a la derecha del texto
  return [
    { at: Math.max(1, p.y + p.h / 2 - innerHeight / 2), x: mobile ? 0.55 : right, y: mobile ? 0.55 : 0.1, s: 0.35 },
    { at, x: (gap / innerWidth) * 2 - 1, y: 0, s: 0.3 },
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
