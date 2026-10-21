import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Destello 3D de plata (la estrella de 4 puntas del logo): canvas fijo que recorre la home por un
// camino curvo según el scroll y gira sobre sus ejes. Va por encima de las fotos y fondos y por
// debajo del texto y del menú (z-index, ver css/star.css). Render dentro del loop único (gsap.ticker).
// Render y entorno: copia del visor aprobado por Oscar.
const MODEL = 'assets/3d/disco-star.glb';
const MODEL_HEIGHT = 2.84;          // unidades del modelo (ancho 2.0, grosor 0.68)
const MAX_DPR = 2;
const FOV = 28;
const CAMERA_Z = 7.6;               // en vertical: max(7.6, 5.2 / aspect)
const HERO_SIZE = 0.3;              // alto del destello en el hero (fracción de la pantalla)
const HERO_SIZE_MOBILE = 0.22;
const MOBILE = '(max-width: 639px)';
const TURNS = 4;                    // vueltas en Y a lo largo de todo el scroll
const SCRUB = 1.2;                  // inercia del recorrido: le da peso, gravedad cero
const LERP = 0.08;
const SPIN_GAIN = 0.0009;           // velocidad de Lenis → velocidad angular extra
const SPIN_FRICTION = 0.94;
const ENTER = { duration: 1.4, turns: 1.5 };
const STATIC_POSE = { y: 0.6, x: 0.1 }; // movimiento reducido: 3/4, que se vea el volumen

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

  // --- modelo: el material del GLB se sustituye por plata pulida reutilizando sus texturas ---
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const loaded = loader.loadAsync(MODEL).then((gltf) => {
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const { normalMap, roughnessMap } = o.material;
      [normalMap, roughnessMap].forEach((t) => {
        if (!t) return;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = maxAniso;
        t.needsUpdate = true;
      });
      if (normalMap) normalMap.colorSpace = THREE.NoColorSpace;
      o.material.dispose();
      o.material = new THREE.MeshPhysicalMaterial({
        color: 0xe4e6ea,
        metalness: 1,
        roughness: 1,
        roughnessMap,
        normalMap,
        normalScale: new THREE.Vector2(0.4, 0.4),
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 1.4,
      });
    });
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

  // --- movimiento reducido: quieto en el hero, de 3/4, sin recorrido ni giro ---
  if (reduced.matches) {
    const pose = place({ position: new THREE.Vector3() }, { x: 0, y: 0.12, s: 1 });
    star.position.copy(pose.position);
    star.scale.setScalar(pose.scale);
    star.rotation.set(STATIC_POSE.x, STATIC_POSE.y, 0);
    const draw = () => {
      const p = place({ position: new THREE.Vector3() }, { x: 0, y: 0.12, s: 1 });
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

  loop.add((time, ratio) => {
    if (!entered || hidden || !curve) return;
    frame++;
    const velocity = lenis.velocity || 0;

    // giro extra por la velocidad del scroll: más rápido, más gira; al parar frena suave
    angularVel = (angularVel + velocity * SPIN_GAIN * ratio) * Math.pow(SPIN_FRICTION, ratio);
    rotYExtra += angularVel * ratio;

    const moving = Math.abs(velocity) > 0.01 || Math.abs(angularVel) > 0.0005
      || Math.abs(scroll.px - lastPx) > 0.1 || entry.k < 1 || dirty;
    lastPx = scroll.px;
    // en reposo solo queda la flotación, que es lenta: a 30 fps basta
    if (!moving && frame % 2) return;
    dirty = false;

    const p = curveAt(scroll.px);
    place(target, { x: p.x, y: p.y, s: p.z });
    target.position.y += Math.sin(time * 0.9) * 0.04;

    const progress = scroll.px / Math.max(1, ScrollTrigger.maxScroll(window));
    const ry = progress * TURNS * Math.PI * 2 + rotYExtra;
    const rx = Math.sin(time * 0.7) * 0.08 + THREE.MathUtils.clamp(velocity * 0.002, -0.35, 0.35);
    const rz = Math.sin(time * 0.5) * 0.06;

    const a = current.init ? 1 - Math.pow(1 - LERP, ratio) : 1;
    current.init = true;
    current.position.lerp(target.position, a);
    current.scale += (target.scale - current.scale) * a;
    current.rx += (rx - current.rx) * a;
    current.ry += (ry - current.ry) * a;
    current.rz += (rz - current.rz) * a;

    // la entrada (escala y vueltas) va encima, sin suavizar: es su propia curva expo
    star.position.copy(current.position);
    star.scale.setScalar(Math.max(0.0001, current.scale * entry.k));
    star.rotation.set(current.rx, current.ry + entry.spin, current.rz);
    renderer.render(scene, camera);
  });

  return {
    loaded,
    // con "disco:intro-done", a la vez que la frase del hero: escala 0 → 1 y 1.5 vueltas
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
  const hero = { at: 0, x: 0, y: 0.12, s: 1 };
  const end = { at: max, x: 0, y: 0.3, s: 0.7 };

  if (mobile || !pin) {
    // apilado: alterna a los lados, por detrás del contenido
    const side = mobile ? 0.45 : 0.62;
    const h = services ? services.offsetHeight : max;
    return [
      hero,
      { at: top, x: side, y: 0.2, s: 0.55 },
      { at: Math.min(max - 1, top + h * 0.5), x: -side, y: -0.1, s: 0.5 },
      end,
    ].sort((a, b) => a.at - b.at);
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
    { at: pin.start, x: gapX, y: 0.08, s: 0.55 },
    { at: pin.end, x: gapX, y: -0.12, s: 0.5 },
    end,
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

  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  disposables.forEach((d) => d.dispose());
  return texture;
}
