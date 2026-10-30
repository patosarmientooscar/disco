// Hero de Nosotros, "Somos disco." (nosotros.html, css/about.css). Pequeño y sin foto ni vídeo: "Somos" y el
// logotipo "disco" de la nav (sin su estrella) con el punto naranja.
//   · ENTRADA: "Somos" sube con su máscara; el logo se DIBUJA (el contorno de cada letra, 0.9 s, stagger .08) y
//     después se rellena; el punto cae al final.
//   · LA ESTRELLA del logo se ha escapado: es el destello 3D, a la derecha del texto (en .nh__star). El mismo módulo
//     y los mismos parámetros que el hero de servicios (js/hero-star.js): gira despacio de frente, se inclina con el
//     ratón, se arrastra con inercia y, al bajar, se suelta, gira y sale en diagonal con su estela.
// Sin WebGL: la estrellita 2D en su hueco. Movimiento reducido: todo puesto y el destello quieto de frente.
const DRAW = { duration: 0.9, stagger: 0.08, delay: 0.35, fill: 0.5 };

export function initNosotrosHero({ gsap, lenis, loop, reduced }) {
  const root = document.querySelector('[data-nh]');
  if (!root) return;
  const still = reduced.matches;
  const rise = root.querySelector('[data-nh-rise]');
  const parts = root.querySelectorAll('[data-nh-in]');
  const letters = root.querySelectorAll('[data-nh-logo] path');
  const period = root.querySelector('[data-nh-period]');
  const slot = root.querySelector('[data-nh-star]');

  // estado que lee el destello: cursor (-1..1) y si el hero está en pantalla
  const state = { mx: 0, my: 0, tx: 0, ty: 0, inView: true };
  new IntersectionObserver(([e]) => { state.inView = e.isIntersecting; }).observe(root);

  if (!still) {
    gsap.from(rise, { yPercent: 105, duration: 1.2, ease: 'expo.out', delay: 0.1 });
    gsap.from(parts, { opacity: 0, y: 18, duration: 1, ease: 'expo.out', stagger: 0.1, delay: 0.5 });
    gsap.timeline({ delay: DRAW.delay })
      .fromTo(letters, { strokeDasharray: 1, strokeDashoffset: 1, strokeOpacity: 1, fillOpacity: 0 }, { strokeDashoffset: 0, duration: DRAW.duration, ease: 'power2.inOut', stagger: DRAW.stagger })
      .to(letters, { fillOpacity: 1, duration: DRAW.fill, ease: 'power1.out', stagger: DRAW.stagger * 0.5 }, '-=0.25')
      .to(letters, { strokeOpacity: 0, duration: 0.3 }, '-=0.2')
      .from(period, { opacity: 0, yPercent: -60, duration: 0.6, ease: 'back.out(2)' }, '-=0.45');
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      state.tx = clamp((e.clientX / innerWidth) * 2 - 1);
      state.ty = clamp((e.clientY / innerHeight) * 2 - 1);
    }, { passive: true });
    loop.add((time, ratio) => {
      if (!state.inView) return;
      const a = 1 - Math.pow(1 - 0.06, ratio);
      state.mx += (state.tx - state.mx) * a;
      state.my += (state.ty - state.my) * a;
    });
  }

  import('./hero-star.js')
    .then((m) => m.createHeroStar({ gsap, lenis, stage: root, video: null, state, loop, reduced, slot }))
    .then((s) => {
      if (!s) return;
      root.classList.add('is-3d');
      s.enter();
    })
    .catch(() => {});
}
