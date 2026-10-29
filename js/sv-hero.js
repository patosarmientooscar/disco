// Hero de servicios en capas (servicios.html, css/servicios.css): el fondo en vídeo · el título · delante, el chico
// con su cámara y sus estelas (el mismo vídeo, recortado con su máscara: js/sv-video.js). Fondo y figura están desde
// el primer pintado (los pósters son el fotograma 0); entran el título, el subtítulo y los botones (si se llega con la
// transición, cuando se abre el velo). Profundidad con el ratón (o la inclinación del móvil, o una deriva lenta) y, al
// hacer scroll, un travelling hacia la escena en el que el paso se acelera con la velocidad del scroll. Todo en el
// loop único (gsap.ticker) y solo con el hero en pantalla.
// Movimiento reducido: solo los pósters (sin vídeo), sin entrada, parallax ni salida.
import { initHeroVideo } from './sv-video.js';

const DEPTH = { bg: 8, title: 22, persona: 36 }; // px como mucho, según el cursor respecto al centro
const TILT = 1.2; // giro de toda la escena (grados)
const LERP = 0.06;
const DRIFT = { px: 10, periods: [9.5, 11.7] }; // móvil sin giroscopio: senos lentos de ±10px
const ORIGIN = { persona: [0.66, 0.82] }; // transform-origin de la figura (css/servicios.css)
const SPLIT = 1.2; // s: lo que tarda la figura en separarse del fondo cuando el vídeo está en marcha
const RATE = { max: 0.35, v: 24, up: 0.25, down: 0.15 }; // velocidad del vídeo con el scroll: 1 → 1.35 (vuelve en ~0,6 s)
const EXIT = {
  bg: 0.06,
  persona: { scale: 0.18, x: 0.04 },
  title: { from: 0.15, to: 0.6, y: 0.1 },
  ui: { from: 0.05, to: 0.25 },
  out: { from: 0.7, to: 1 },
};
export function initHero({ gsap, ScrollTrigger, lenis, loop, still, arrived }) {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;
  const scene = hero.querySelector('[data-hero-scene]');
  const L = {};
  ['bg', 'title', 'persona'].forEach((k) => { L[k] = hero.querySelector(`[data-hero-layer="${k}"]`); });
  const lines = hero.querySelectorAll('[data-hero-line]');
  const after = hero.querySelectorAll('[data-hero-after]');
  const ui = hero.querySelector('.sv-hero__ui');
  const out = hero.querySelector('[data-hero-out]');

  // "Ver cómo trabajamos": baja con Lenis al proceso (sin JS, el ancla normal)
  hero.querySelector('[data-to-proc]')?.addEventListener('click', (e) => {
    e.preventDefault();
    lenis.scrollTo('#proceso', { duration: still ? 0 : 1.8, easing: (t) => 1 - Math.pow(1 - t, 4), immediate: still });
  });
  if (still) return;

  // el vídeo en las dos capas. Mientras se ven los pósters (o si el vídeo no llega), la figura va pegada al fondo:
  // el póster del fondo lleva al chico dentro y, separados, asomaría un segundo chico. Con el vídeo en marcha la
  // figura se separa poco a poco (el shader del fondo tapa ese segundo chico).
  const s = { tx: 0, ty: 0, x: 0, y: 0, mode: matchMedia('(hover: hover) and (pointer: fine)').matches ? 'mouse' : 'drift', p: 0, parked: false, split: 0, rate: 1 };
  const video = initHeroVideo({ hero, bg: L.bg, fg: L.persona, onLive: () => gsap.to(s, { split: 1, duration: SPLIT, ease: 'power2.inOut' }) });

  // ---------- entrada: el título sube con máscara y luego el subtítulo y los botones ----------
  // (el estado inicial ya está en el CSS, para que no se vea el título puesto mientras cargan los scripts)
  gsap.set(lines, { y: 0, yPercent: 105 }); // y: 0 limpia el translateY(105%) del CSS (si no, GSAP lo lee como px)
  gsap.set(after, { opacity: 0, y: 14 });
  // espera también a la fuente (como mucho 1,5 s): si no, el título sube con la de reserva y cambia a mitad
  const fonts = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
  Promise.all([arrived, fonts]).then(() => {
    gsap.timeline()
      .to(lines, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.1 }, 0.1)
      .to(after, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0.6);
  });

  // ---------- de dónde sale la profundidad: ratón, inclinación del móvil o deriva lenta ----------
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    s.mode = 'mouse';
    s.tx = clamp((e.clientX / innerWidth) * 2 - 1);
    s.ty = clamp((e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });
  // sin pedir permiso: si el navegador da la orientación (Android), se usa; si no (iOS), sigue la deriva
  window.addEventListener('deviceorientation', (e) => {
    if (s.mode === 'mouse' || e.gamma == null || e.beta == null) return;
    s.mode = 'tilt';
    s.tx = clamp(e.gamma / 25);
    s.ty = clamp((e.beta - 50) / 25);
  }, { passive: true });

  // ---------- salida: de 0 a 1 mientras el hero sale de pantalla (sin pin) ----------
  ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => { s.p = self.progress; },
  });

  // tamaño del wrapper de la figura (para compensar su origen), medido fuera del loop
  const size = { w: 0, h: 0 };
  const measure = () => { size.w = L.persona.offsetWidth; size.h = L.persona.offsetHeight; };
  measure();
  window.addEventListener('resize', measure);

  const TAU = Math.PI * 2;
  const seg = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
  loop.add((time, ratio) => {
    // fuera de pantalla no se calcula nada (se deja en su estado final una vez)
    if (s.p >= 1) {
      if (!s.parked) { s.parked = true; out.style.opacity = '1'; s.rate = 1; video.rate(1); }
      return;
    }
    s.parked = false;
    const a = 1 - Math.pow(1 - LERP, ratio);
    let tx = s.tx;
    let ty = s.ty;
    if (s.mode === 'drift') {
      const k = DRIFT.px / DEPTH.persona;
      tx = Math.sin((time * TAU) / DRIFT.periods[0]) * k;
      ty = Math.sin((time * TAU) / DRIFT.periods[1] + 1) * k;
    }
    s.x += (tx - s.x) * a;
    s.y += (ty - s.y) * a;
    const p = s.p;
    // las capas cercanas se mueven más, al revés que el cursor; la escena gira un poco hacia él
    const off = (k) => [(-s.x * DEPTH[k]).toFixed(2), (-s.y * DEPTH[k]).toFixed(2)];
    scene.style.transform = `rotateY(${(s.x * TILT).toFixed(3)}deg) rotateX(${(-s.y * TILT).toFixed(3)}deg)`;
    let [x, y] = off('bg');
    const bs = 1 + EXIT.bg * p;
    L.bg.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${bs.toFixed(4)})`;
    // la figura: su propio parallax y su salida (escala y avanza), mezclados con "pegada al fondo" según s.split
    // (pegada = la misma transformación que el fondo, compensando que gira sobre otro origen)
    const { w, h } = size;
    const own = [-s.x * DEPTH.persona + p * EXIT.persona.x * innerWidth, -s.y * DEPTH.persona, 1 + EXIT.persona.scale * p];
    const glued = [+x + (0.5 - ORIGIN.persona[0]) * w * (1 - bs), +y + (0.5 - ORIGIN.persona[1]) * h * (1 - bs), bs];
    const [fx, fy, fs] = own.map((v, i) => glued[i] + (v - glued[i]) * s.split);
    L.persona.style.transform = `translate3d(${fx.toFixed(2)}px, ${fy.toFixed(2)}px, 0) scale(${fs.toFixed(4)})`;
    video.frame({ bx: +x, by: +y, bs, fx, fy, fs, fox: ORIGIN.persona[0], foy: ORIGIN.persona[1] });
    // el paso se acelera con la velocidad del scroll (1 → 1.35) y vuelve a 1 al parar
    const want = 1 + RATE.max * Math.min(1, Math.abs(lenis.velocity || 0) / RATE.v);
    s.rate += (want - s.rate) * (1 - Math.exp(-ratio / 60 / (want > s.rate ? RATE.up : RATE.down)));
    video.rate(s.rate);
    [x, y] = off('title');
    const tp = seg(p, EXIT.title.from, EXIT.title.to);
    L.title.style.transform = `translate3d(${x}px, ${(+y - tp * EXIT.title.y * innerHeight).toFixed(2)}px, 0)`;
    L.title.style.opacity = (1 - tp).toFixed(3);
    // el subtítulo y los botones van con el título (si no, al moverse el título los pisaría)
    [x, y] = off('title');
    ui.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ui.style.opacity = (1 - seg(p, EXIT.ui.from, EXIT.ui.to)).toFixed(3);
    out.style.opacity = seg(p, EXIT.out.from, EXIT.out.to).toFixed(3);
  });
}
