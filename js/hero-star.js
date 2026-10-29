import * as THREE from 'three';
import { MODEL_HEIGHT, FOV, CAMERA_Z, sharedModel, softboxScene, studio } from './star-core.js';

// El destello 3D en el hero de las páginas interiores (js/page-hero.js): el mismo de la home (GLB, materiales,
// softboxes, ACES; js/star-core.js) en un canvas del escenario, encima del título. Reflejos vivos: el entorno es el
// estudio de softboxes con una esfera por dentro que lleva el VÍDEO del hero (cuando pasa una luz naranja, la plata
// se tiñe), regenerado cada 5 fotogramas solo con el hero en pantalla y el vídeo en marcha. Para que no cueste
// fotogramas, la escena se pinta con una CubeCamera en un cubemap que se reutiliza y el PMREM sale de él a un
// render target que también se reutiliza (sin crear ni borrar texturas en cada regeneración).
// En reposo oscila de frente; se inclina hacia el cursor; se puede coger y girar con inercia (al soltar, se
// recoloca de frente). El canvas va dentro del hero: al hacer scroll se va con él (el scroll no le cambia nada).
// Movimiento reducido: quieto de frente.
const DPR = { desk: 1.75, mob: 1.25 };
const MOBILE = '(max-width: 767px)';
const SIZE = { desk: 0.56, mob: 0.38 };          // alto en el hero (fracción de la pantalla)
const LIFT = 0.04;                               // centrado, un 4 % de pantalla más arriba
const ENTER = { duration: 1.4, scale: 0.82, turn: -35 * (Math.PI / 180) };
const IDLE = { amp: 0.32, speed: 0.45 };         // oscila ±0.32 rad en Y (fase a 0.45 rad/s), sin vueltas completas
const TILT = { x: 0.22, y: 0.35, z: 0.06, lerp: 0.06 };
const DRAG = { gain: 0.011, friction: 0.94, stop: 0.0015, settle: 0.07, idleBack: 1.2 };
const REFLECT = { every: 5, size: 256, gain: 1.9, radius: 15 };

export async function createHeroStar({ gsap, stage, video, state, loop, reduced, onInteract }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null; // sin WebGL: el hero sigue igual (vídeo + título)
  }
  const mobile = () => matchMedia(MOBILE).matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile() ? DPR.mob : DPR.desk));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = 'pgh__gl';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.opacity = '0';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  scene.environment = studio(renderer);
  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.position.set(3, 4, 5);
  const back = new THREE.DirectionalLight(0xffe2dc, 0.6);
  back.position.set(-4, -1, -3);
  scene.add(key, back);
  const star = new THREE.Group();
  scene.add(star);

  let model;
  try {
    model = await sharedModel(renderer);
  } catch {
    renderer.dispose();
    return null;
  }
  star.add(model);
  stage.querySelector('.pgh__grain').before(canvas);

  // ---------- reflejos vivos: softboxes + esfera interior con el vídeo ----------
  const live = { env: null, pmrem: null, tex: null, frame: 0, rt: null, cube: null, cam: null };
  if (video && !reduced.matches) {
    live.env = softboxScene();
    live.tex = new THREE.VideoTexture(video);
    live.tex.colorSpace = THREE.SRGBColorSpace;
    live.tex.wrapS = THREE.RepeatWrapping;
    live.tex.repeat.x = 2; // el vídeo dos veces alrededor (no se estira a 360°)
    const sphere = live.env.add(
      new THREE.SphereGeometry(REFLECT.radius, 48, 24),
      new THREE.MeshBasicMaterial({ map: live.tex, side: THREE.BackSide, color: new THREE.Color(REFLECT.gain, REFLECT.gain, REFLECT.gain) }),
    );
    sphere.rotation.y = -Math.PI / 2; // el centro del vídeo, detrás de la cámara: lo que reflejan las caras de frente
    live.pmrem = new THREE.PMREMGenerator(renderer);
    live.cube = new THREE.WebGLCubeRenderTarget(REFLECT.size, { type: THREE.HalfFloatType });
    live.cam = new THREE.CubeCamera(0.1, 100, live.cube);
  }
  const reflect = () => {
    live.cam.update(renderer, live.env.scene);
    live.rt = live.pmrem.fromCubemap(live.cube.texture, live.rt);
    scene.environment = live.rt.texture;
  };

  // ---------- tamaño ----------
  const view = { halfW: 1, halfH: 1, w: 1, h: 1 };
  const resize = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    const aspect = w / h;
    camera.aspect = aspect;
    camera.position.set(0, 0, aspect >= 1 ? CAMERA_Z : Math.max(CAMERA_Z, 5.2 / aspect));
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile() ? DPR.mob : DPR.desk));
    renderer.setSize(w, h);
    view.halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    view.halfW = view.halfH * aspect;
    view.w = w;
    view.h = h;
    // la pista, justo encima del destello
    stage.style.setProperty('--ph-hint-y', `calc(${((0.5 - LIFT - (mobile() ? SIZE.mob : SIZE.desk) / 2) * 100).toFixed(2)}% - 26px)`);
  };
  resize();
  const baseScale = () => ((mobile() ? SIZE.mob : SIZE.desk) * 2 * view.halfH) / MODEL_HEIGHT;
  renderer.compile(scene, camera);

  const draw = () => renderer.render(scene, camera);

  // ---------- movimiento reducido: quieto, de frente ----------
  if (reduced.matches) {
    const still = () => {
      star.position.set(0, LIFT * 2 * view.halfH, 0);
      star.scale.setScalar(baseScale());
      star.rotation.set(0, 0, 0);
      draw();
    };
    window.addEventListener('resize', () => { resize(); still(); });
    return { enter() { canvas.style.opacity = ''; still(); } };
  }

  // ---------- coger y girar (solo sobre la estrella; la velocidad horizontal pasa a giro) ----------
  const drag = { on: false, id: 0, x: 0, t: 0, vel: 0, spin: 0, idle: 1, free: true };
  const onStar = (e) => {
    const r = canvas.getBoundingClientRect();
    const cx = r.left + ((star.position.x / view.halfW + 1) / 2) * r.width;
    const cy = r.top + ((1 - star.position.y / view.halfH) / 2) * r.height;
    const h = ((star.scale.y * MODEL_HEIGHT) / (2 * view.halfH)) * r.height;
    return Math.abs(e.clientX - cx) < h * 0.36 && Math.abs(e.clientY - cy) < h * 0.5;
  };
  canvas.addEventListener('pointermove', (e) => { if (!drag.on) canvas.classList.toggle('is-grab', onStar(e)); });
  canvas.addEventListener('pointerdown', (e) => {
    if (!onStar(e)) return;
    drag.on = true;
    drag.id = e.pointerId;
    drag.x = e.clientX;
    drag.t = performance.now();
    drag.vel = 0;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('is-dragging');
    onInteract?.();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag.on || e.pointerId !== drag.id) return;
    const now = performance.now();
    const dx = e.clientX - drag.x;
    drag.spin += dx * DRAG.gain;
    drag.vel = (dx * DRAG.gain) / Math.max(1, (now - drag.t) / (1000 / 60)); // rad por frame a 60 fps
    drag.x = e.clientX;
    drag.t = now;
  });
  const drop = () => {
    if (!drag.on) return;
    drag.on = false;
    canvas.classList.remove('is-dragging');
    if (performance.now() - drag.t > 80) drag.vel = 0; // se paró antes de soltar
  };
  canvas.addEventListener('pointerup', drop);
  canvas.addEventListener('pointercancel', drop);
  canvas.addEventListener('lostpointercapture', drop);

  // ---------- entrada ----------
  const entry = { p: 0 };
  let entered = false;
  const cur = { rx: 0, ry: 0, rz: 0 };
  let osc = 0;

  loop.add((time, ratio) => {
    if (!entered || document.hidden || !state.inView) return;
    const dt = ratio / 60;
    // giro de la mano: inercia al soltar y, quieta, se recoloca de frente en el múltiplo de π más cercano
    if (!drag.on) {
      drag.spin += drag.vel * ratio;
      drag.vel *= Math.pow(DRAG.friction, ratio);
      if (Math.abs(drag.vel) < DRAG.stop) {
        drag.vel = 0;
        drag.spin += (Math.round(drag.spin / Math.PI) * Math.PI - drag.spin) * (1 - Math.pow(1 - DRAG.settle, ratio));
      }
    }
    const handled = drag.on || drag.vel !== 0 || Math.abs(drag.spin - Math.round(drag.spin / Math.PI) * Math.PI) > 0.01;
    drag.idle += ((handled ? 0 : 1) - drag.idle) * (1 - Math.exp(-DRAG.idleBack * dt));
    osc += IDLE.speed * dt * drag.idle;
    // inclinación hacia el cursor, amortiguada
    const a = 1 - Math.pow(1 - TILT.lerp, ratio);
    cur.rx += (state.my * TILT.x - cur.rx) * a;
    cur.ry += (state.mx * TILT.y - cur.ry) * a;
    cur.rz += (-state.mx * TILT.z - cur.rz) * a;
    const e = entry.p;
    star.position.set(0, LIFT * 2 * view.halfH, 0);
    star.scale.setScalar(baseScale() * (ENTER.scale + (1 - ENTER.scale) * e));
    star.rotation.set(cur.rx, (1 - e) * ENTER.turn + Math.sin(osc) * IDLE.amp * drag.idle + drag.spin + cur.ry, cur.rz);
    // reflejos vivos: cada 5 fotogramas con el vídeo en marcha
    if (live.pmrem && video && !video.paused && video.readyState >= 2 && ++live.frame % REFLECT.every === 0) reflect();
    draw();
  });

  window.addEventListener('resize', () => { resize(); if (entered) draw(); });
  // al salir de la página se liberan el vídeo de los reflejos y WebGL
  window.addEventListener('pagehide', () => {
    live.rt?.dispose();
    live.cube?.dispose();
    live.tex?.dispose();
    live.pmrem?.dispose();
    live.env?.dispose();
    renderer.dispose();
  });

  return {
    canvas,
    // entrada (como en la home): escala .82 → 1 y giro en Y de −35° → 0, 1.4 s expo.out, por tiempo real
    enter() {
      if (entered) return;
      entered = true;
      gsap.fromTo(entry, { p: 0 }, {
        p: 1,
        duration: ENTER.duration,
        ease: 'expo.out',
        onUpdate: () => { canvas.style.opacity = entry.p.toFixed(3); },
        onComplete: () => { canvas.style.opacity = ''; },
      });
    },
  };
}
