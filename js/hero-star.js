import * as THREE from 'three';
import { MODEL_HEIGHT, sharedGL, sharedModel, softboxScene, studio, mixEnv, compileScene } from './star-core.js';
import { dlog } from './gpu.js';
import { createTrail } from './star-trail.js';

// El destello 3D en el hero de las páginas interiores (js/page-hero.js): el mismo de la home (GLB, materiales,
// softboxes, ACES; js/star-core.js), protagonista en el centro del hero. Pinta en el canvas fijo compartido con el
// recorrido (sharedGL: un solo renderer por página), con su propia escena.
// Reflejos vivos: el entorno es el estudio de softboxes con una esfera por dentro que lleva el VÍDEO del hero,
// regenerado cada 8 fotogramas (solo con el hero y su vídeo en pantalla) con una CubeCamera en un cubemap que se reutiliza y el PMREM a un render target que
// también se reutiliza.
// En reposo oscila de frente; se inclina hacia el cursor; se puede coger y girar con inercia (al soltar, se
// recoloca de frente). SALIDA (sin pin; progreso 0 con el top del hero en 0 → 1 con su bottom en el 15 % superior):
// se suelta de la sección con inercia, gira 1,25 vueltas acelerando, se inclina a la derecha y sale en diagonal
// hacia arriba a la derecha encogiéndose; al salir de pantalla, un destello breve en el borde. Al volver, entra por donde salió y vuelve con un
// pequeño rebote. LA FUGAZ (js/star-trail.js, AR-A): la estela naranja le sigue SIEMPRE (corta y tenue en reposo,
// larga con la velocidad; antes, solo al salir: legacy/hero-star-estela-salida/). Movimiento reducido: quieto de
// frente, sube con la sección, sin estela.
// CON RELEVO (opción handoff; solo Servicios, js/page-hero.js): la misma salida (suelta, vueltas, inclinación, estela),
// pero en vez de salir de pantalla viaja en arco (Bézier: sube a la derecha y cae en curva) hasta el sitio del
// manifiesto (maniPose de js/page-star.js, la misma función que usa el recorrido) y encoge hasta su tamaño; las
// vueltas acaban en la orientación del destello del recorrido, la inclinación vuelve a 0 y la estela se recoge. Con
// exitP = 1 hace el RELEVO (relay): deja de pintar y en el mismo fotograma pinta el del recorrido, en la misma pose.
// Al subir, lo recoge donde está y deshace el arco. Movimiento reducido: el del manifiesto aparece en su sitio con un
// fundido de 0.3 s (aquí mismo, en la misma escena).
const MOBILE = '(max-width: 767px)';
const SIZE = { desk: 0.62, mob: 0.42 };          // alto en el hero (fracción del alto del hero)
const LIFT = 0.04;                               // centrado, un 4 % más arriba
const ROOM = { top: 84, gap: 18 };               // px: deja libre la nav y no baja hasta el texto del pie
const ENTER = { duration: 1.4, scale: 0.82, turn: -35 * (Math.PI / 180) };
const IDLE = { amp: 0.32, speed: 0.45 };         // oscila ±0.32 rad en Y (fase a 0.45 rad/s), sin vueltas completas
const TILT = { x: 0.22, y: 0.35, z: 0.06, lerp: 0.06 };
const DRAG = { gain: 0.011, friction: 0.94, stop: 0.0015, settle: 0.07, idleBack: 1.2 };
const REFLECT = { every: 8, size: 256, gain: 1.9, radius: 15 };
// salida: hasta dónde va (pantallas: x hacia la derecha, y hacia arriba), vueltas, inclinación y tamaño final
const EXIT = { end: 0.15, lerp: 0.08, x: 1.55, y: 1.9, turns: 1.25, roll: -0.35, shrink: 0.6, back: 'back.out(1.4)', backDur: 0.9 };
const TRAIL = { n: 8, low: 3, color: 0xF35411 }; // la fugaz: copias (con la calidad baja, 3)
const TAU = Math.PI * 2;
// con relevo: el punto de control del arco (× ancho a la derecha del sitio, × alto por encima del hero), desde dónde
// la orientación, la inclinación y la inercia van a la del recorrido, la estela se recoge, y los fundidos (s)
const HANDOFF = { cx: 0.08, cy: 0.25, settle: 0.8, gather: 0.85, env: 0.6, still: 0.3 };

// slot (opcional; nosotros, js/nosotros-hero.js): un elemento del hero que marca dónde va y su alto (centrado en él,
// a la derecha del texto) en vez del centro del escenario.
// handoff (opcional; servicios): { target: () => ({ cx, cy, hPx }) | null, relay, gate } (ver arriba)
export async function createHeroStar({ gsap, lenis, stage, video, state, loop, reduced, onInteract, slot = null, handoff = null }) {
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

  // la fugaz (js/star-trail.js): copias del destello con un naranja aditivo, en sus poses pasadas
  const trail = reduced.matches ? null : createTrail({ scene, model, n: TRAIL.n, color: TRAIL.color });

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
  const home = { cx: 0, cy: 0, h: 0 };
  const foot = stage.querySelector('.pgh__foot > div');
  const place = () => {
    const W = stage.clientWidth;
    if (slot) {
      const sr = stage.getBoundingClientRect();
      const r = slot.getBoundingClientRect();
      home.cx = r.left - sr.left + r.width / 2;
      home.cy = r.top - sr.top + r.height / 2;
      home.h = r.height;
      return;
    }
    const H = stage.clientHeight;
    home.cx = W / 2;
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
    x: ((r.left + home.cx) / view.w) * 2 - 1,
    y: 1 - ((r.top + home.cy) / view.h) * 2,
    s: home.h / view.h,
  });
  const exitOf = (r) => THREE.MathUtils.clamp(-r.top / Math.max(1, r.height - EXIT.end * view.h), 0, 1);

  // con relevo: al volver del manifiesto, los reflejos pasan del estudio al vídeo con un fundido (envMix)
  const studioTex = scene.environment;
  const HU = { envMap2: { value: studioTex }, envMix: { value: 0 }, envRot2: { value: new THREE.Matrix3() } };
  if (handoff && !reduced.matches) model.traverse((o) => { if (o.isMesh) { mixEnv(o.material, HU); o.material.needsUpdate = true; } });
  // movimiento reducido con relevo: el del manifiesto, una copia en esta misma escena (con su opacidad)
  let twin = null;
  const twinMats = [];
  if (handoff && reduced.matches) {
    twin = new THREE.Group();
    const c = model.clone(true);
    c.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0; twinMats.push(o.material); } });
    twin.add(c);
    twin.visible = false;
    scene.add(twin);
  }
  await compileScene(renderer, scene, camera); // en paralelo si se puede: sin congelar la página

  // ---------- movimiento reducido: quieto, de frente, sube con la sección ----------
  if (reduced.matches) {
    let lastTop = NaN;
    let shown = false;
    // con relevo: el del manifiesto aparece en su sitio (fundido de 0.3 s) cuando el hero lo ha soltado; "Tres
    // oficios" lo tapa como siempre y, una vez tapado, no vuelve a salir por debajo
    const tf = { o: 0, on: false, tw: null, at: null };
    const still = (force) => {
      const r = stage.getBoundingClientRect();
      if (!force && r.top === lastTop && !tf.tw?.isActive()) return;
      lastTop = r.top;
      const heroOn = r.bottom > 0 && r.top < view.h;
      if (twin) {
        const T = exitOf(r) >= 1 ? handoff.target() : null;
        const gateTop = handoff.gate ? handoff.gate.getBoundingClientRect().top : Infinity;
        const want = !!T && gateTop > T.cy - T.hPx / 2;
        if (T) tf.at = T;
        if (want !== tf.on) {
          tf.on = want;
          tf.tw?.kill();
          // detrás del borde de "Tres oficios", sin fundido: ya lo tapa la sección
          if (T && gateTop < T.cy + T.hPx / 2) tf.o = want ? 1 : 0;
          else tf.tw = gsap.to(tf, { o: want ? 1 : 0, duration: HANDOFF.still, ease: 'power1.out' });
        }
        twin.visible = tf.o > 0.001 && !!tf.at;
        if (twin.visible) {
          toWorld(twin, (tf.at.cx / view.w) * 2 - 1, 1 - (tf.at.cy / view.h) * 2, tf.at.hPx / view.h);
          twinMats.forEach((m) => { m.opacity = tf.o; });
        }
      }
      if (!heroOn && !twin?.visible) { gl.blank('hero'); return; }
      star.visible = heroOn;
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
  const ret = { m: 1, tw: null, from: null };
  let out = false;                     // fuera de pantalla (ya salió)
  let primed = false;
  let lifted = false;

  // ---------- el relevo (con handoff): se decide una vez por fotograma, lo pida este loop o el del recorrido ----------
  const relay = handoff?.relay || null;
  let relayAt = -1;
  let landed = false;                  // el último fotograma, ya en el sitio del manifiesto
  let fromMani = false;                // acaba de volver del manifiesto (este fotograma lo recoge)
  let last = null;                     // la última pose pintada (px), para el registro
  const envBack = { tw: null };
  if (relay) {
    relay.env = () => scene.environment;
    relay.step = (time) => {
      if (time === relayAt) return;
      relayAt = time;
      const p = exitOf(stage.getBoundingClientRect());
      if (relay.done) {
        // al subir, en cuanto deja de estar en 1 (si no lo tiene alguien cogido en el manifiesto)
        if (p < 1 && !relay.held) { relay.done = false; relay.fresh = false; fromMani = true; }
      } else if (p >= 1 && landed && relay.ready && !drag.on && entry.p >= 0.999) {
        relay.done = true;
        relay.fresh = true;
        const t = handoff.target();
        dlog('relevo hero → manifiesto (hero)', { ...last, ahora: t && { x: +t.cx.toFixed(1), y: +t.cy.toFixed(1), h: +t.hPx.toFixed(1) } });
      }
    };
  }

  loop.add((time, ratio) => {
    if (!entered || document.hidden || !state.inView) {
      if (!state.inView) {
        trail?.hide();
        gl.blank('hero');
        if (lifted) { lifted = false; canvas.style.zIndex = ''; }
      }
      return;
    }
    const dt = ratio / 60;
    const H = view.h;
    const r = stage.getBoundingClientRect();
    exitP = exitOf(r);
    const p = exitP;
    const E = p * p; // acelerando
    // con relevo: lo pinta el del recorrido
    if (relay) {
      relay.step(time);
      if (relay.done) {
        trail?.hide();
        if (lifted) { lifted = false; canvas.style.zIndex = ''; }
        gl.blank('hero');
        return;
      }
    }
    const T = handoff ? handoff.target() : null; // su sitio en el manifiesto (px)
    if (fromMani) {
      // vuelve del manifiesto: sale de donde estaba pintado, con la estela de cero, los reflejos del estudio al
      // vídeo y el rebote de vuelta
      fromMani = false;
      const d = relay.drawn || T;
      if (d) { now.x = (d.cx / view.w) * 2 - 1; now.y = 1 - (d.cy / H) * 2; now.s = d.hPx / H; }
      trail?.hide(); // la fugaz, de cero
      ret.from = { x: now.x, y: now.y, s: now.s };
      ret.tw?.kill();
      ret.m = 0;
      ret.tw = gsap.to(ret, { m: 1, duration: EXIT.backDur, ease: EXIT.back });
      envBack.tw?.kill();
      HU.envMap2.value = studioTex;
      HU.envMix.value = 1;
      envBack.tw = gsap.to(HU.envMix, { value: 0, duration: HANDOFF.env, ease: 'power1.inOut' });
      dlog('relevo manifiesto → hero', { manifiesto: d && { x: +d.cx.toFixed(1), y: +d.cy.toFixed(1), h: +d.hPx.toFixed(1) }, hero: { x: +(((now.x + 1) / 2) * view.w).toFixed(1), y: +(((1 - now.y) / 2) * H).toFixed(1), h: +(now.s * H).toFixed(1) } });
    }

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
    let fx = h0.x + EXIT.x * E;
    let fy = h0.y + EXIT.y * E;
    let ts = hp.s * (1 - (1 - EXIT.shrink) * p);
    // con relevo: en arco hasta su sitio (Bézier cuadrática en px; control arriba a la derecha, dentro de la pantalla),
    // con salida y llegada suaves; el tamaño, del del hero al del manifiesto
    const q = p * p * (3 - 2 * p);
    if (T) {
      const W = view.w;
      const x0 = ((h0.x + 1) / 2) * W;
      const y0 = ((1 - h0.y) / 2) * H;
      const x1 = THREE.MathUtils.clamp(T.cx + HANDOFF.cx * W, 16, W - 16);
      const y1 = THREE.MathUtils.clamp(y0 - HANDOFF.cy * H, 16, H - 16);
      const bx = (1 - q) * (1 - q) * x0 + 2 * (1 - q) * q * x1 + q * q * T.cx;
      const by = (1 - q) * (1 - q) * y0 + 2 * (1 - q) * q * y1 + q * q * T.cy;
      fx = (bx / W) * 2 - 1;
      fy = 1 - (by / H) * 2;
      ts = hp.s + (T.hPx / H - hp.s) * q;
    }
    const tx = hp.x + (fx - hp.x) * k;
    const ty = hp.y + (fy - hp.y) * k;
    if (!primed) { now.x = tx; now.y = ty; now.s = ts; primed = true; }
    if (ret.m < 1) {
      // de vuelta: del sitio por donde entró al objetivo, con el rebote
      now.x = ret.from.x + (tx - ret.from.x) * ret.m;
      now.y = ret.from.y + (ty - ret.from.y) * ret.m;
      now.s = ret.from.s + (ts - ret.from.s) * Math.min(1, ret.m);
    } else if (p > 0 || Math.abs(now.y - ty) > 0.002) {
      // (con relevo, la inercia se recoge al final: en exitP = 1 está justo en su sitio)
      const lk = T ? EXIT.lerp + (1 - EXIT.lerp) * THREE.MathUtils.smoothstep(p, HANDOFF.settle, 1) : EXIT.lerp;
      const l = 1 - Math.pow(1 - lk, ratio);
      now.x += (tx - now.x) * l;
      now.y += (ty - now.y) * l;
      now.s += (ts - now.s) * l;
    } else {
      now.x = tx; now.y = ty; now.s = ts;
    }

    const e = entry.p;
    const s = now.s * (ENTER.scale + (1 - ENTER.scale) * e);
    toWorld(star, now.x, now.y, s);
    let rx = cur.rx * (1 - p);
    const hand = (1 - e) * ENTER.turn + Math.sin(osc) * IDLE.amp * drag.idle + drag.spin + cur.ry;
    let ry = hand + EXIT.turns * TAU * (T ? q : E);
    let rz = cur.rz + EXIT.roll * THREE.MathUtils.smoothstep(p, 0.05, 0.8);
    if (T) {
      // en el último 20 %, a la orientación del destello del recorrido (la vuelta final acaba en su ángulo, módulo
      // 2π) y la inclinación vuelve a 0
      const w = THREE.MathUtils.smoothstep(p, HANDOFF.settle, 1);
      const L = relay?.look?.() || { rx: 0, ry: 0, rz: 0 };
      const delta = THREE.MathUtils.euclideanModulo(L.ry - (hand + EXIT.turns * TAU) + Math.PI, TAU) - Math.PI;
      ry += delta * w;
      rx += (L.rx - rx) * w;
      rz += (L.rz - rz) * w;
    }
    star.rotation.set(rx, ry, rz);
    landed = !!T && p >= 1 && ret.m >= 1 && entry.p >= 0.999;
    last = { x: +(((now.x + 1) / 2) * view.w).toFixed(1), y: +(((1 - now.y) / 2) * H).toFixed(1), h: +(s * H).toFixed(1), ry: +ry.toFixed(3) };

    // ¿se ve? (caja del destello contra la pantalla)
    const hw = (s * view.h * 0.704) / view.w; // medio ancho en unidades x (−1..1)
    const visible = now.x - hw < 1 && now.x + hw > -1 && now.y - s < 1 && now.y + s > -1;
    if (T) {
      // (con relevo no sale de pantalla: sin el destello del borde)
    } else if (!visible && !out && p > 0.2) {
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

    // la fugaz: siempre que se ve (con relevo, en el último 15 % las copias se juntan con el destello y se apagan;
    // con la calidad baja, 3 copias en vez de 8: js/star-core.js)
    const gather = T ? THREE.MathUtils.smoothstep(p, HANDOFF.gather, 1) : 0;
    if (trail) {
      trail.setMax(gl.quality.trail ? TRAIL.n : TRAIL.low);
      trail.update(time, star, view.halfH, { on: visible, gain: entry.p, gather });
    }

    // al salir, por encima del contenido que sube (debajo de la nav); en el hero, debajo del texto del pie (con
    // relevo, ya en su sitio, a la altura del recorrido: "Tres oficios" lo tapa)
    const lift = p > 0.02 && visible && !(T && p >= 1);
    if (lift !== lifted) { lifted = lift; canvas.style.zIndex = lift ? '3' : ''; }

    if (!visible && !trail?.visible) { gl.blank('hero'); return; }
    // reflejos vivos: cada 8 fotogramas con el vídeo en marcha (sin ellos si la calidad ha bajado: js/star-core.js)
    if (live.pmrem && gl.quality.live && video && !video.paused && video.readyState >= 2 && ++live.frame % REFLECT.every === 0) reflect();
    gl.draw(scene, 'hero');
    gl.measure(dt);
  });

  // al salir de la página se liberan el vídeo de los reflejos y lo suyo (el renderer, en js/star-core.js)
  window.addEventListener('pagehide', (e) => {
    if (e.persisted) return; // bfcache: al volver, todo sigue
    live.rt?.dispose();
    live.cube?.dispose();
    live.tex?.dispose();
    live.pmrem?.dispose();
    live.env?.dispose();
    trail?.dispose();
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
