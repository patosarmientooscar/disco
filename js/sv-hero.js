// Hero de servicios en capas (servicios.html, css/servicios.css): fondo · título · el chico con la cámara · sus
// estelas de luz por encima de las letras. Entrada animada (~2 s, una vez; si se llega con la transición, cuando se
// abre el velo), profundidad con el ratón (o la inclinación del móvil, o una deriva lenta) y, al hacer scroll, un
// travelling hacia la escena. Todo en el loop único (gsap.ticker) y solo con el hero en pantalla.
// Movimiento reducido: la composición fija, sin entrada, parallax ni salida.
const DEPTH = { bg: 8, luces: 16, title: 22, persona: 36 }; // px como mucho, según el cursor respecto al centro
const TILT = 1.2; // giro de toda la escena (grados)
const LERP = 0.06;
const DRIFT = { px: 10, periods: [9.5, 11.7] }; // móvil sin giroscopio: senos lentos de ±10px
const BREATH = { base: 0.8, amp: 0.08, periods: [2.7, 3.9] }; // las estelas respiran (.72 ↔ .88)
const SWAY = { px: 10, period: 14 }; // y se desplazan en x muy despacio
const EXIT = {
  bg: 0.06,
  persona: { scale: 0.18, x: 0.04 },
  luces: { stretch: 0.3, speed: 0.012, max: 0.35 }, // + lo que estira la velocidad del scroll (suavizada)
  title: { from: 0.15, to: 0.6, y: 0.1 },
  ui: { from: 0.05, to: 0.25 },
  out: { from: 0.7, to: 1 },
};

export function initHero({ gsap, ScrollTrigger, lenis, loop, still, arrived }) {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;
  const scene = hero.querySelector('[data-hero-scene]');
  const L = {};
  ['bg', 'title', 'persona', 'luces'].forEach((k) => { L[k] = hero.querySelector(`[data-hero-layer="${k}"]`); });
  const inner = (k) => L[k].querySelector('[data-hero-in]');
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

  // ---------- entrada: sale de negro, la luz se dibuja, el título sube y el chico cruza por delante ----------
  // (el estado inicial ya está en el CSS, para que no se vea el hero compuesto mientras cargan los scripts)
  gsap.set(inner('bg'), { opacity: 0, scale: 1.06 });
  gsap.set(inner('luces'), { clipPath: 'inset(0% 100% 0% 0%)' });
  gsap.set(lines, { y: 0, yPercent: 105 }); // y: 0 limpia el translateY(105%) del CSS (si no, GSAP lo lee como px)
  gsap.set(inner('persona'), { opacity: 0, x: () => innerWidth * 0.06, filter: 'blur(10px)' });
  gsap.set(after, { opacity: 0, y: 14 });
  // espera también a la fuente (como mucho 1,5 s): si no, el título sube con la de reserva y cambia a mitad
  const fonts = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
  Promise.all([arrived, fonts]).then(() => {
    gsap.timeline()
      .to(inner('bg'), { opacity: 1, scale: 1, duration: 1.6, ease: 'power2.out' }, 0)
      .to(inner('luces'), { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.out', clearProps: 'clipPath' }, 0.3)
      .to(lines, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.1 }, 0.45)
      .to(inner('persona'), { opacity: 1, x: 0, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out', clearProps: 'filter' }, 0.8)
      .to(after, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 1.3);
  });

  // ---------- de dónde sale la profundidad: ratón, inclinación del móvil o deriva lenta ----------
  const s = { tx: 0, ty: 0, x: 0, y: 0, mode: matchMedia('(hover: hover) and (pointer: fine)').matches ? 'mouse' : 'drift', p: 0, v: 0, parked: false };
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

  const TAU = Math.PI * 2;
  const seg = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
  loop.add((time, ratio) => {
    // fuera de pantalla no se calcula nada (se deja en su estado final una vez)
    if (s.p >= 1) {
      if (!s.parked) { s.parked = true; out.style.opacity = '1'; }
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
    s.v += (Math.abs(lenis.velocity || 0) - s.v) * Math.min(1, 0.08 * ratio);
    const p = s.p;
    // las capas cercanas se mueven más, al revés que el cursor; la escena gira un poco hacia él
    const off = (k) => [(-s.x * DEPTH[k]).toFixed(2), (-s.y * DEPTH[k]).toFixed(2)];
    scene.style.transform = `rotateY(${(s.x * TILT).toFixed(3)}deg) rotateX(${(-s.y * TILT).toFixed(3)}deg)`;
    let [x, y] = off('bg');
    L.bg.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${(1 + EXIT.bg * p).toFixed(4)})`;
    [x, y] = off('luces');
    const sway = Math.sin((time * TAU) / SWAY.period) * SWAY.px;
    const stretch = 1 + EXIT.luces.stretch * p + Math.min(EXIT.luces.max, s.v * EXIT.luces.speed);
    L.luces.style.transform = `translate3d(${(+x + sway).toFixed(2)}px, ${y}px, 0) scaleX(${stretch.toFixed(4)})`;
    const breath = BREATH.base + BREATH.amp * (0.6 * Math.sin((time * TAU) / BREATH.periods[0]) + 0.4 * Math.sin((time * TAU) / BREATH.periods[1] + 1.7));
    L.luces.style.opacity = breath.toFixed(3);
    [x, y] = off('title');
    const tp = seg(p, EXIT.title.from, EXIT.title.to);
    L.title.style.transform = `translate3d(${x}px, ${(+y - tp * EXIT.title.y * innerHeight).toFixed(2)}px, 0)`;
    L.title.style.opacity = (1 - tp).toFixed(3);
    [x, y] = off('persona');
    L.persona.style.transform = `translate3d(${(+x + p * EXIT.persona.x * innerWidth).toFixed(2)}px, ${y}px, 0) scale(${(1 + EXIT.persona.scale * p).toFixed(4)})`;
    // el subtítulo y los botones van con el título (si no, al moverse el título los pisaría)
    [x, y] = off('title');
    ui.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ui.style.opacity = (1 - seg(p, EXIT.ui.from, EXIT.ui.to)).toFixed(3);
    out.style.opacity = seg(p, EXIT.out.from, EXIT.out.to).toFixed(3);
  });
}
