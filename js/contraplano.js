import * as THREE from 'three';
import { config } from './config.js';
import { MODEL_HEIGHT, sharedGL, sharedModel, studio } from './star-core.js';

// Hero de Nosotros, "Contraplano" (nosotros.html, css/about.css). En cine, el contraplano es mirar a la otra persona:
// Luna y Bruno, uno frente al otro, y entre ellos el destello 3D (el canvas fijo compartido de la página,
// js/star-core.js → sharedGL: un solo renderer, con el del footer).
//   · RACK FOCUS con el ratón (lerp .07): el retrato del lado del cursor se enfoca (nítido, en color si la foto lo es,
//     escala 1.03) y el otro se desenfoca (10 px, B/N, brillo .55); las escuadras del AF se cierran sobre la cara
//     enfocada y aparece su ficha; el destello se inclina hacia ella. Sin ratón (táctil, o 4 s quieto) el foco
//     alterna solo cada 3,5 s, como un corte de plano. En táctil, tocar un retrato lo enfoca.
//   · SALIDA (sin pin): al bajar, los dos retratos se deslizan hacia el centro hasta tocarse, con el destello en la
//     unión, y un flash; la sección siguiente aparece detrás. Al volver, se separan.
// Todo en el loop único (gsap.ticker). Movimiento reducido: los dos nítidos, sin desenfoques ni flash.
const FOCUS = { lerp: 0.07, cut: 0.22, idle: 4000, every: 3500 };
const FACE = [{ x: 0.47, y: 0.5, w: 0.26 }, { x: 0.41, y: 0.47, w: 0.22 }]; // cara de Luna y de Bruno (fracción de la foto)
const STAR = { s: 0.3 * 0.45, tilt: 0.75, roll: 0.12 };  // alto: 0.3 de la "escala 1" del recorrido (45 % de pantalla)
const EXIT = { end: 0.55, flashAt: 0.97 };                // salida: se tocan con el top del hero a −55 % de su alto
const MOBILE = '(max-width: 767px)';

export function initContraplano({ gsap, loop, reduced }) {
  const root = document.querySelector('[data-cp]');
  if (!root) return;
  const still = reduced.matches;
  const stage = root.querySelector('[data-cp-stage]');
  const people = [...root.querySelectorAll('[data-cp-person]')].map((el, i) => ({
    el,
    i,
    frame: el.querySelector('[data-cp-frame]'),
    sharp: el.querySelector('.cp__img--sharp'),
    af: el.querySelector('[data-cp-af]'),
    card: el.querySelector('[data-cp-card]'),
    hit: el.querySelector('[data-cp-hit]'),
    f: 0.5,
    locked: false,
  }));
  const mobile = () => matchMedia(MOBILE).matches;

  // el vídeo de la fiesta, de atmósfera (el pequeño; solo con el hero en pantalla)
  const video = root.querySelector('[data-cp-video]');
  const hv = config.pageHeroes?.nosotros || {};
  let inView = true;
  if (!still && hv.videoSm) {
    video.src = hv.videoSm;
    new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      if (inView && !document.hidden) video.play().catch(() => {}); else video.pause();
    }).observe(root);
  }

  // la cara de cada uno: las escuadras, en px de su marco (la foto cubre el marco: object-fit cover)
  const placeAF = () => people.forEach((p, i) => {
    const W = p.frame.clientWidth;
    const H = p.frame.clientHeight;
    const s = Math.max(W / 1280, H / 1600);
    const cw = 1280 * s;
    const ch = 1600 * s;
    const pos = getComputedStyle(p.sharp).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
    const ox = (W - cw) * (pos[0] || 0.5);
    const oy = (H - ch) * (pos[1] || 0.5);
    const fw = FACE[i].w * cw;
    p.af.style.width = `${fw.toFixed(1)}px`;
    p.afX = ox + FACE[i].x * cw - fw / 2;
    p.afY = oy + FACE[i].y * ch - (fw * 1.25) / 2;
  });
  placeAF();
  window.addEventListener('resize', placeAF);

  // movimiento reducido: los dos nítidos y con su ficha; el destello quieto entre los dos
  if (still) {
    people.forEach((p) => { p.f = 1; });
    makeStar({ gsap, loop, root, people, still: true, exit: () => 0 });
    return;
  }

  // ---------- el foco: el cursor (lerp) o el corte automático ----------
  const focus = { v: 0.5, to: 0, auto: true, last: -1e9, timer: 0, rate: FOCUS.lerp };
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const cut = (to) => { focus.to = to; focus.rate = FOCUS.cut; };
  const autoCut = () => {
    clearInterval(focus.timer);
    focus.timer = setInterval(() => {
      if (performance.now() - focus.last < FOCUS.idle) return;
      cut(focus.to > 0.5 ? 0 : 1);
    }, FOCUS.every);
  };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !fine.matches) return;
    focus.last = performance.now();
    focus.rate = FOCUS.lerp;
    focus.to = Math.min(1, Math.max(0, (e.clientX / innerWidth - 0.35) / 0.3)); // 0: Luna · 1: Bruno
  }, { passive: true });
  people.forEach((p) => {
    p.hit.addEventListener('click', () => { focus.last = performance.now(); cut(p.i); });
    p.hit.addEventListener('focus', () => { if (p.hit.matches(':focus-visible')) { focus.last = performance.now(); cut(p.i); } });
  });
  cut(0);
  autoCut();

  // ---------- salida con el scroll ----------
  const flash = document.createElement('i');
  flash.className = 'cp-flash';
  flash.setAttribute('aria-hidden', 'true');
  document.body.append(flash);
  let gap = 0;
  const measure = () => {
    const a = people[0].el.getBoundingClientRect();
    const b = people[1].el.getBoundingClientRect();
    gap = mobile() ? { x: (b.left - a.left) / 2, y: (b.top - a.top) / 2 } : { x: (b.left - a.right) / 2, y: 0 };
  };
  measure();
  window.addEventListener('resize', measure);
  let exitP = 0;
  let flashed = false;
  const exit = () => exitP;

  // entrada: los retratos aparecen desde su lado y el titular sube
  gsap.from(people.map((p) => p.el), { opacity: 0, x: (i) => (i ? 60 : -60), duration: 1.4, ease: 'expo.out', stagger: 0.08 });
  gsap.from(root.querySelectorAll('[data-cp-rise], .cp__tag'), { opacity: 0, y: 24, duration: 1, ease: 'expo.out', stagger: 0.08, delay: 0.3 });

  const tilt = { deg: 8 };
  loop.add((time, ratio) => {
    if (!inView || document.hidden) return;
    // el foco
    const a = 1 - Math.pow(1 - focus.rate, ratio);
    focus.v += (focus.to - focus.v) * a;
    const fb = focus.v;
    people[0].f = 1 - fb;
    people[1].f = fb;
    // la salida: 0 → 1 hasta que se tocan
    const r = root.getBoundingClientRect();
    exitP = Math.min(1, Math.max(0, -r.top / (r.height * EXIT.end)));
    const e = exitP * exitP * (3 - 2 * exitP);
    if (!flashed && exitP >= EXIT.flashAt) {
      flashed = true;
      gsap.fromTo(flash, { opacity: 0 }, { keyframes: { opacity: [0, 0.95, 0] }, duration: 0.55, ease: 'none' });
    } else if (flashed && exitP < 0.8) flashed = false;
    people.forEach((p, i) => {
      const dir = i ? -1 : 1;
      const dx = (mobile() ? gap.x : gap.x) * e * dir;
      const dy = (mobile() ? gap.y : 0) * e * dir;
      const rot = mobile() ? 0 : tilt.deg * (1 - e) * dir;
      const sc = 1 + 0.03 * p.f;
      p.el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
      p.frame.style.transform = `perspective(1400px) rotateY(${rot.toFixed(2)}deg) scale(${sc.toFixed(4)})`;
      p.sharp.style.opacity = p.f.toFixed(3);
      // la ficha del enfocado
      const c = Math.min(1, Math.max(0, (p.f - 0.6) / 0.35));
      p.card.style.opacity = c.toFixed(3);
      p.card.style.transform = `translate3d(0, ${((1 - c) * 14).toFixed(1)}px, 0)`;
      // las escuadras: entran grandes y se cierran sobre la cara cuando el foco llega
      const k = Math.min(1, Math.max(0, (p.f - 0.7) / 0.3));
      p.af.style.opacity = k.toFixed(3);
      p.af.style.transform = `translate3d(${p.afX.toFixed(1)}px, ${p.afY.toFixed(1)}px, 0) scale(${(1.5 - 0.5 * k).toFixed(3)})`;
      const lock = k > 0.98;
      if (lock !== p.locked) { p.locked = lock; p.af.classList.toggle('is-locked', lock); }
    });
  });

  makeStar({ gsap, loop, root, people, still: false, exit, focus });
}

// ---------- el destello, entre los dos (escala .3), de frente; se inclina hacia el enfocado ----------
async function makeStar({ gsap, loop, root, people, still, exit, focus }) {
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
  const cur = { ry: 0, rz: 0, o: still ? 1 : 0 };
  // el centro entre los dos retratos (en pantalla), donde se juntan
  const center = () => {
    const a = people[0].el.getBoundingClientRect();
    const b = people[1].el.getBoundingClientRect();
    const mob = matchMedia(MOBILE).matches;
    return mob
      ? { x: (a.left + a.width / 2 + b.left + b.width / 2) / 2, y: (a.bottom + b.top) / 2 }
      : { x: (a.right + b.left) / 2, y: (a.top + a.bottom) / 2 };
  };
  const place = (time, ratio) => {
    const c = center();
    const h = STAR.s * view.h;
    star.position.set((c.x / view.w * 2 - 1) * view.halfW, (1 - c.y / view.h * 2) * view.halfH, 0);
    star.scale.setScalar((((h / view.h) * 2 * view.halfH) / MODEL_HEIGHT) * (0.8 + 0.2 * cur.o));
    const f = focus ? focus.v : 0.5;
    const a = 1 - Math.pow(1 - 0.08, ratio || 1);
    cur.ry += (((f - 0.5) * 2) * STAR.tilt + Math.sin(time * 0.6) * 0.08 - cur.ry) * a;
    cur.rz += ((0.5 - f) * 2 * STAR.roll - cur.rz) * a;
    star.rotation.set(Math.sin(time * 0.5) * 0.05, cur.ry, cur.rz);
  };
  if (still) {
    const draw = () => { place(0, 1); gl.draw(scene, 'cp'); };
    draw();
    loop.add(() => {
      const r = root.getBoundingClientRect();
      if (r.bottom > 0) draw(); else gl.blank('cp');
    });
    return;
  }
  loop.add((time, ratio) => {
    if (document.hidden) return;
    const r = root.getBoundingClientRect();
    // se ve mientras el hero está en pantalla y hasta la unión (después del flash, se va)
    if (r.bottom <= 0 || exit() >= 1) { gl.blank('cp'); return; }
    place(time, ratio);
    gl.draw(scene, 'cp');
  });
  gsap.fromTo(cur, { o: 0 }, { o: 1, duration: 1.2, ease: 'expo.out', delay: 0.2 });
}
