import * as THREE from 'three';
import { MODEL_HEIGHT, sharedGL, sharedModel, softboxScene, studio } from './star-core.js';

// El destello 3D en el hero de las páginas interiores (js/page-hero.js): el mismo de la home (GLB, materiales,
// softboxes, ACES; js/star-core.js), protagonista en el centro del hero. Pinta en el canvas fijo compartido con el
// recorrido (sharedGL: un solo renderer por página), con su propia escena.
// Reflejos vivos: el entorno es el estudio de softboxes con una esfera por dentro que lleva el VÍDEO del hero,
// regenerado cada 5 fotogramas con una CubeCamera en un cubemap que se reutiliza y el PMREM a un render target que
// también se reutiliza.
// En reposo oscila de frente; se inclina hacia el cursor; se puede coger y girar con inercia (al soltar, se
// recoloca de frente). SALIDA (sin pin; progreso 0 con el top del hero en 0 → 1 con su bottom en el 15 % superior):
// se suelta de la sección con inercia, gira 1,25 vueltas acelerando, se inclina a la derecha y sale en diagonal
// hacia arriba a la derecha encogiéndose, con una estela de 6 copias naranjas (más larga cuanto más rápido es el
// scroll); al salir de pantalla, un destello breve en el borde. Al volver, entra por donde salió y vuelve con un
// pequeño rebote. Movimiento reducido: quieto de frente, sube con la sección, sin estela.
const MOBILE = '(max-width: 767px)';
const SIZE = { desk: 0.62, mob: 0.42 };          // alto en el hero (fracción del alto del hero)
const LIFT = 0.04;                               // centrado, un 4 % más arriba
const ROOM = { top: 84, gap: 18 };               // px: deja libre la nav y no baja hasta el texto del pie
const ENTER = { duration: 1.4, scale: 0.82, turn: -35 * (Math.PI / 180) };
const IDLE = { amp: 0.32, speed: 0.45 };         // oscila ±0.32 rad en Y (fase a 0.45 rad/s), sin vueltas completas
const TILT = { x: 0.22, y: 0.35, z: 0.06, lerp: 0.06 };
const DRAG = { gain: 0.011, friction: 0.94, stop: 0.0015, settle: 0.07, idleBack: 1.2 };
const REFLECT = { every: 5, size: 256, gain: 1.9, radius: 15 };
// salida: hasta dónde va (pantallas: x hacia la derecha, y hacia arriba), vueltas, inclinación y tamaño final
const EXIT = { end: 0.15, lerp: 0.08, x: 1.55, y: 1.9, turns: 1.25, roll: -0.35, shrink: 0.6, back: 'back.out(1.4)', backDur: 0.9 };
const TRAIL = { n: 6, gap: 2, more: 5, speed: 12, alpha: 0.35, color: 0xF35411, still: 0.012 };
const TAU = Math.PI * 2;

export async function createHeroStar({ gsap, lenis, stage, video, state, loop, reduced, onInteract }) {
  const gl = sharedGL();
  if (!gl) return null; // sin WebGL: el hero sigue igual (vídeo + texto)
  const { renderer, canvas, camera, view } = gl;
  const mobile = () => matchMedia(MOBILE).matches;

  const scene = new THREE.Scene();
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
    return null;
  }
  star.add(model);

  // la estela: 6 copias del destello (misma geometría) con un naranja emisivo aditivo, cada una con su opacidad
  const ghosts = [];
  if (!reduced.matches) {
    for (let i = 0; i < TRAIL.n; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: TRAIL.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const g = model.clone(true);
      g.traverse((o) => { if (o.isMesh) o.material = mat; });
      const holder = new THREE.Group();
      holder.add(g);
      holder.visible = false;
      scene.add(holder);
      ghosts.push({ holder, mat });
    }
  }

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

  // ---------- sitio en el hero (px desde su top): centrado; sin tapar la nav ni el texto del pie ----------
  const home = { cy: 0, h: 0 };
  const foot = stage.querySelector('.pgh__foot > div');
  const place = () => {
    const H = stage.clientHeight;
    const W = stage.clientWidth;
    let h = (mobile() ? SIZE.mob : SIZE.desk) * H;
    let cy = H * (0.5 - LIFT);
    // si el texto del pie (lo que ocupa de verdad: etiqueta, titular, botones) queda debajo del destello, este no
    // baja hasta él
    const half = (h * 0.704) / 2;
    const sr = stage.getBoundingClientRect();
    const range = document.createRange();
    if (foot) range.selectNodeContents(foot);
    const fr = foot ? range.getBoundingClientRect() : null;
    const ft = fr ? fr.top - sr.top : H;
    if (fr && fr.right - sr.left > W / 2 - half) {
      const room = ft - ROOM.gap - ROOM.top;
      h = Math.min(h, room);
      cy = Math.min(cy, ft - ROOM.gap - h / 2);
      cy = Math.max(cy, ROOM.top + h / 2);
    }
    home.cy = cy;
    home.h = h;
    // la pista, justo encima del destello
    stage.style.setProperty('--ph-hint-y', `${Math.max(ROOM.top - 20, cy - h / 2 - 26).toFixed(1)}px`);
  };
  place();
  gl.onResize(place);
  window.addEventListener('resize', place);
  if (document.fonts) document.fonts.ready.then(place);

  // pose en pantalla (x, y de −1 a 1, y hacia arriba; s = alto en fracción de pantalla) → mundo
  const toWorld = (obj, x, y, s) => {
    obj.position.set(x * view.halfW, y * view.halfH, 0);
    obj.scale.setScalar(Math.max(0.0001, (s * 2 * view.halfH) / MODEL_HEIGHT));
  };
  const homePose = (r) => ({
    x: ((r.left + r.width / 2) / view.w) * 2 - 1,
    y: 1 - ((r.top + home.cy) / view.h) * 2,
    s: home.h / view.h,
  });
  renderer.compile(scene, camera);

  // ---------- movimiento reducido: quieto, de frente, sube con la sección ----------
  if (reduced.matches) {
    let lastTop = NaN;
    let shown = false;
    const still = (force) => {
      const r = stage.getBoundingClientRect();
      if (!force && r.top === lastTop) return;
      lastTop = r.top;
      if (r.bottom <= 0 || r.top >= view.h) { gl.blank('hero'); return; }
      const p = homePose(r);
      toWorld(star, p.x, p.y, p.s);
      star.rotation.set(0, 0, 0);
      gl.draw(scene, 'hero');
    };
    gl.onResize(() => { if (shown) still(true); });
    return {
      enter() {
        shown = true;
        still(true);
        loop.add(() => { if (!document.hidden) still(false); });
      },
    };
  }

  // ---------- coger y girar (solo sobre la estrella; la velocidad horizontal pasa a giro) ----------
  const drag = { on: false, id: 0, x: 0, t: 0, vel: 0, spin: 0, idle: 1, free: true };
  const now = { x: 0, y: 0, s: 0 };     // pose actual en pantalla
  let exitP = 0;
  const onStar = (e) => {
    if (exitP > 0.02) return false;
    const cx = ((now.x + 1) / 2) * view.w;
    const cy = ((1 - now.y) / 2) * view.h;
    const h = now.s * view.h;
    return Math.abs(e.clientX - cx) < h * 0.36 && Math.abs(e.clientY - cy) < h * 0.5;
  };
  stage.addEventListener('pointermove', (e) => { if (!drag.on) stage.classList.toggle('is-grab', onStar(e)); });
  stage.addEventListener('pointerdown', (e) => {
    if (!onStar(e) || e.target.closest('a, button, input')) return;
    drag.on = true;
    drag.id = e.pointerId;
    drag.x = e.clientX;
    drag.t = performance.now();
    drag.vel = 0;
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('is-dragging');
    onInteract?.();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag.on || e.pointerId !== drag.id) return;
    const t = performance.now();
    const dx = e.clientX - drag.x;
    drag.spin += dx * DRAG.gain;
    drag.vel = (dx * DRAG.gain) / Math.max(1, (t - drag.t) / (1000 / 60)); // rad por frame a 60 fps
    drag.x = e.clientX;
    drag.t = t;
  });
  const drop = () => {
    if (!drag.on) return;
    drag.on = false;
    stage.classList.remove('is-dragging');
    if (performance.now() - drag.t > 80) drag.vel = 0; // se paró antes de soltar
  };
  stage.addEventListener('pointerup', drop);
  stage.addEventListener('pointercancel', drop);
  stage.addEventListener('lostpointercapture', drop);

  // el destello breve al salir de pantalla (radial naranja, .25 s), en el borde por donde sale
  const burst = document.createElement('i');
  burst.className = 'pgh-burst';
  burst.setAttribute('aria-hidden', 'true');
  document.body.append(burst);

  // ---------- estado ----------
  const entry = { p: 0 };
  let entered = false;
  const cur = { rx: 0, ry: 0, rz: 0 };
  let osc = 0;
  const hist = [];                     // poses de los últimos fotogramas (para la estela)
  const HIST = TRAIL.n * (TRAIL.gap + TRAIL.more) + 1;
  const ret = { m: 1, tw: null, from: null };
  let out = false;                     // fuera de pantalla (ya salió)
  let primed = false;
  let lifted = false;

  loop.add((time, ratio) => {
    if (!entered || document.hidden || !state.inView) {
      if (!state.inView) {
        gl.blank('hero');
        if (lifted) { lifted = false; canvas.style.zIndex = ''; }
      }
      return;
    }
    const dt = ratio / 60;
    const H = view.h;
    const r = stage.getBoundingClientRect();
    exitP = THREE.MathUtils.clamp(-r.top / Math.max(1, r.height - EXIT.end * H), 0, 1);
    const p = exitP;
    const E = p * p; // acelerando

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
    osc += IDLE.speed * dt * drag.idle * (1 - p);
    // inclinación hacia el cursor, amortiguada
    const a = 1 - Math.pow(1 - TILT.lerp, ratio);
    cur.rx += (state.my * TILT.x - cur.rx) * a;
    cur.ry += (state.mx * TILT.y - cur.ry) * a;
    cur.rz += (-state.mx * TILT.z - cur.rz) * a;

    // objetivo: en el hero (va con la sección) hasta que empieza la salida; después, suelto y en diagonal
    const hp = homePose(r);
    const h0 = homePose({ left: r.left, width: r.width, top: 0 });
    const k = THREE.MathUtils.smoothstep(p, 0, 0.12); // 0: pegado a la sección · 1: suelto
    const tx = hp.x + (h0.x + EXIT.x * E - hp.x) * k;
    const ty = hp.y + (h0.y + EXIT.y * E - hp.y) * k;
    const ts = hp.s * (1 - (1 - EXIT.shrink) * p);
    if (!primed) { now.x = tx; now.y = ty; now.s = ts; primed = true; }
    if (ret.m < 1) {
      // de vuelta: del sitio por donde entró al objetivo, con el rebote
      now.x = ret.from.x + (tx - ret.from.x) * ret.m;
      now.y = ret.from.y + (ty - ret.from.y) * ret.m;
      now.s = ret.from.s + (ts - ret.from.s) * Math.min(1, ret.m);
    } else if (p > 0 || Math.abs(now.y - ty) > 0.002) {
      const l = 1 - Math.pow(1 - EXIT.lerp, ratio);
      now.x += (tx - now.x) * l;
      now.y += (ty - now.y) * l;
      now.s += (ts - now.s) * l;
    } else {
      now.x = tx; now.y = ty; now.s = ts;
    }

    const e = entry.p;
    const s = now.s * (ENTER.scale + (1 - ENTER.scale) * e);
    toWorld(star, now.x, now.y, s);
    const rx = cur.rx * (1 - p);
    const ry = (1 - e) * ENTER.turn + Math.sin(osc) * IDLE.amp * drag.idle + drag.spin + cur.ry + EXIT.turns * TAU * E;
    const rz = cur.rz + EXIT.roll * THREE.MathUtils.smoothstep(p, 0.05, 0.8);
    star.rotation.set(rx, ry, rz);

    // ¿se ve? (caja del destello contra la pantalla)
    const hw = (s * view.h * 0.704) / view.w; // medio ancho en unidades x (−1..1)
    const visible = now.x - hw < 1 && now.x + hw > -1 && now.y - s < 1 && now.y + s > -1;
    if (!visible && !out && p > 0.2) {
      out = true;
      const bx = Math.min(view.w - 24, ((now.x + 1) / 2) * view.w);
      const by = Math.max(24, ((1 - now.y) / 2) * view.h);
      gsap.set(burst, { x: bx, y: by });
      gsap.fromTo(burst, { opacity: 0, scale: 0.6 }, { keyframes: { opacity: [0, 0.9, 0], scale: [0.6, 1.15, 1.4] }, duration: 0.25, ease: 'none' });
    } else if (visible && out) {
      // vuelve: entra por donde salió y llega con un pequeño rebote
      out = false;
      ret.from = { x: now.x, y: now.y, s: now.s };
      ret.tw?.kill();
      ret.m = 0;
      ret.tw = gsap.to(ret, { m: 1, duration: EXIT.backDur, ease: EXIT.back });
    }

    // la estela: cada copia, la pose de hace 2 fotogramas más que la anterior (más con el scroll rápido)
    hist.unshift({ x: now.x, y: now.y, s, rx, ry, rz });
    if (hist.length > HIST) hist.pop();
    const v = Math.abs(lenis?.velocity || 0);
    const gap = TRAIL.gap + Math.min(TRAIL.more, Math.round(v / TRAIL.speed));
    ghosts.forEach((g, i) => {
      const h = hist[Math.min(hist.length - 1, (i + 1) * gap)];
      const d = Math.hypot(h.x - now.x, h.y - now.y);
      const o = p > 0 ? TRAIL.alpha * (1 - i / TRAIL.n) * THREE.MathUtils.smoothstep(d, 0, TRAIL.still * 4) : 0;
      g.holder.visible = o > 0.004;
      if (!g.holder.visible) return;
      g.mat.opacity = o;
      toWorld(g.holder, h.x, h.y, h.s);
      g.holder.rotation.set(h.rx, h.ry, h.rz);
    });

    // al salir, por encima del contenido que sube (debajo de la nav); en el hero, debajo del texto del pie
    const lift = p > 0.02 && visible;
    if (lift !== lifted) { lifted = lift; canvas.style.zIndex = lift ? '3' : ''; }

    if (!visible && !ghosts.some((g) => g.holder.visible)) { gl.blank('hero'); return; }
    // reflejos vivos: cada 5 fotogramas con el vídeo en marcha
    if (live.pmrem && video && !video.paused && video.readyState >= 2 && ++live.frame % REFLECT.every === 0) reflect();
    gl.draw(scene, 'hero');
  });

  // al salir de la página se liberan el vídeo de los reflejos y lo suyo (el renderer, en js/star-core.js)
  window.addEventListener('pagehide', () => {
    live.rt?.dispose();
    live.cube?.dispose();
    live.tex?.dispose();
    live.pmrem?.dispose();
    live.env?.dispose();
    ghosts.forEach((g) => g.mat.dispose());
  });

  return {
    canvas,
    // entrada (como en la home): escala .82 → 1 y giro en Y de −35° → 0, 1.4 s expo.out, por tiempo real
    enter() {
      if (entered) return;
      entered = true;
      canvas.style.opacity = '0';
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
