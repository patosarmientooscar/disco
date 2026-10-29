import * as THREE from 'three';
import { MODEL_HEIGHT, sharedGL, sharedModel, studio } from './star-core.js';

// Hero de Nosotros, "Somos disco." (nosotros.html, css/about.css). Pequeño y sin foto ni vídeo: la frase enorme en
// una línea y, en vez del punto final, el destello 3D girando a tamaño de letra (el canvas fijo compartido de la
// página: js/star-core.js → sharedGL, un solo renderer con el del footer).
//   · ENTRADA: la frase sube y el destello cae en su sitio dando dos vueltas, como un punto que se estampa.
//   · En reposo oscila de frente; con el CURSOR se inclina hacia él (y, cerca, le da la cara).
//   · SALIDA (sin pin): al bajar, sale disparado hacia arriba a la derecha girando y deja en su sitio un punto naranja;
//     al volver, regresa a su hueco.
// Sin WebGL o con movimiento reducido: el punto es la estrellita naranja en 2D, quieta.
const SIZE = 1.18;                         // alto del destello / alto del hueco del punto
const SWAY = { amp: 0.75, speed: 0.9 };    // oscila en Y (±0.75 rad), casi siempre de cara: de canto no se ve
const TILT = { x: 0.35, y: 0.55, lerp: 0.07 };
const ENTER = { delay: 0.55, duration: 1.3, turns: 2 };
const EXIT = { end: 0.75, x: 0.5, y: 1.05, turns: 2.5, shrink: 0.55 };
const TAU = Math.PI * 2;

export function initNosotrosHero({ gsap, loop, reduced }) {
  const root = document.querySelector('[data-nh]');
  if (!root) return;
  const slot = root.querySelector('[data-nh-dot]');
  const rise = root.querySelector('[data-nh-rise]');
  const parts = root.querySelectorAll('[data-nh-in]');
  if (reduced.matches) return; // la frase y la estrellita 2D, quietas

  gsap.from(rise, { yPercent: 105, duration: 1.2, ease: 'expo.out', delay: 0.1 });
  gsap.from(parts, { opacity: 0, y: 18, duration: 1, ease: 'expo.out', stagger: 0.1, delay: 0.35 });
  makeStar({ gsap, loop, root, slot });
}

async function makeStar({ gsap, loop, root, slot }) {
  const gl = sharedGL();
  if (!gl) return;
  const { renderer, view } = gl;
  const scene = new THREE.Scene();
  scene.environment = studio(renderer);
  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.position.set(3, 4, 5);
  const back = new THREE.DirectionalLight(0xffe2dc, 0.6);
  back.position.set(-4, -1, -3);
  scene.add(key, back);
  const star = new THREE.Group();
  scene.add(star);
  try {
    star.add(await sharedModel(renderer));
  } catch {
    return;
  }
  renderer.compile(scene, gl.camera);
  root.classList.add('is-3d');

  const st = { enter: 0, spin: 0, rx: 0, ry: 0, mx: 0, my: 0, tx: 0, ty: 0, period: -1 };
  gsap.to(st, { enter: 1, duration: ENTER.duration, ease: 'back.out(1.7)', delay: ENTER.delay });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = slot.getBoundingClientRect();
    st.tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth * 0.5)));
    st.ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (innerHeight * 0.5)));
  }, { passive: true });

  loop.add((time, ratio) => {
    if (document.hidden) return;
    const r = root.getBoundingClientRect();
    if (r.bottom <= 0) { gl.blank('nh'); return; }
    const p = Math.min(1, Math.max(0, -r.top / (r.height * EXIT.end)));
    const e = p * p;
    // el punto naranja que queda en el hueco cuando el destello se va
    const k = Math.min(1, Math.max(0, (p - 0.04) / 0.22));
    if (Math.abs(k - st.period) > 0.002) { st.period = k; root.style.setProperty('--nh-period', k.toFixed(3)); }

    const a = 1 - Math.pow(1 - TILT.lerp, ratio);
    st.mx += (st.tx - st.mx) * a;
    st.my += (st.ty - st.my) * a;
    // cerca del cursor oscila menos (le da la cara)
    const near = 1 - Math.min(1, Math.hypot(st.mx, st.my) * 1.6);
    st.spin += SWAY.speed * (ratio / 60) * (1 - 0.8 * near);

    const s = slot.getBoundingClientRect();
    const h = s.height * SIZE * (1 - (1 - EXIT.shrink) * e) * st.enter;
    let cx = s.left + s.width / 2 + e * EXIT.x * view.w;
    let cy = s.top + s.height / 2 - e * EXIT.y * view.h;
    const hw = h * 0.36;
    if (st.enter <= 0.001 || cx - hw > view.w || cy + h / 2 < 0) { gl.blank('nh'); return; }
    star.position.set((cx / view.w * 2 - 1) * view.halfW, (1 - cy / view.h * 2) * view.halfH, 0);
    star.scale.setScalar(Math.max(0.0001, ((h / view.h) * 2 * view.halfH) / MODEL_HEIGHT));
    const ry = Math.sin(st.spin) * SWAY.amp * (1 - 0.6 * near) + st.mx * TILT.y + (1 - st.enter) * ENTER.turns * TAU + e * EXIT.turns * TAU;
    star.rotation.set(st.my * TILT.x, ry, -st.mx * 0.08 - e * 0.4);
    gl.draw(scene, 'nh');
  });
}
