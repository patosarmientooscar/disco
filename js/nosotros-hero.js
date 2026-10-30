// Hero de Nosotros, "Somos disco." (nosotros.html, css/about.css). Fondo negro con la AURORA arriba (js/aurora.js);
// a la izquierda "Somos" y el logo de disco tal cual, con su estrella.
//   · ENTRADA: "Somos" sube con su máscara; el logo se DIBUJA (el contorno de cada letra, 0.9 s, stagger .07) y se
//     rellena; la estrella del logo aparece la última con un giro de 90° y un mini destello; después, texto y CTA.
//     Después, la estrella del logo brilla muy suave cada pocos segundos (css/about.css, .is-glint).
//   · EL DESTELLO 3D, a la derecha (.nh__star marca su sitio): lo pinta js/page-star.js, que lo lleva después por
//     toda la página (como en la home). Movimiento reducido: no hay recorrido; aquí, quieto de frente en su hueco
//     (js/hero-star.js), y en el footer, el de js/fin.js.
// Sin WebGL o sin GPU de verdad (js/gpu.js): la estrellita 2D en su hueco y el degradado CSS de la aurora.
import { gpuOK, afterLoad } from './gpu.js';
import { initAurora } from './aurora.js';

const DRAW = { duration: 0.9, stagger: 0.07, delay: 0.3, fill: 0.5 };

export function initNosotrosHero({ gsap, lenis, loop, reduced }) {
  const root = document.querySelector('[data-nh]');
  if (!root) return;
  const still = reduced.matches;
  const rise = root.querySelector('[data-nh-rise]');
  const parts = root.querySelectorAll('[data-nh-in]');
  const logo = root.querySelector('[data-nh-logo]');
  const letters = logo.querySelectorAll('.nh__letter');
  const lstar = logo.querySelector('[data-nh-lstar]');
  const lglow = logo.querySelector('.nh__lglow');
  const slot = root.querySelector('[data-nh-star]');

  // la aurora: con la página cargada y el navegador libre (el logo y el texto llegan antes, sobre su degradado CSS;
  // ella entra con su fundido)
  const aurora = () => initAurora({ canvas: root.querySelector('[data-aurora]'), stage: root, loop, reduced });
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(aurora, { timeout: 1200 }) : setTimeout(aurora, 200));
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });

  if (!still) {
    const tl = gsap.timeline({ delay: DRAW.delay, onComplete: () => logo.classList.add('is-glint') });
    gsap.from(rise, { yPercent: 105, duration: 1.2, ease: 'expo.out', delay: 0.1 });
    tl.fromTo(letters, { strokeDasharray: 1, strokeDashoffset: 1, strokeOpacity: 1, fillOpacity: 0 }, { strokeDashoffset: 0, duration: DRAW.duration, ease: 'power2.inOut', stagger: DRAW.stagger })
      .to(letters, { fillOpacity: 1, duration: DRAW.fill, ease: 'power1.out', stagger: DRAW.stagger * 0.5 }, '-=0.25')
      .to(letters, { strokeOpacity: 0, duration: 0.3 }, '-=0.2')
      // la estrella, la última: gira 90° y suelta un mini destello
      .fromTo(lstar, { rotation: -90, scale: 0.3, opacity: 0 }, { rotation: 0, scale: 1, opacity: 0.85, duration: 0.7, ease: 'back.out(1.8)' }, '-=0.35')
      .fromTo(lglow, { opacity: 0 }, { keyframes: { opacity: [0, 0.75, 0] }, duration: 0.8, ease: 'none', clearProps: 'opacity' }, '<0.25')
      // texto y CTA, mientras se dibuja (no al final: el texto es el LCP)
      .from(parts, { opacity: 0, y: 16, duration: 0.9, ease: 'expo.out', stagger: 0.09 }, 0.25);
  }

  if (!gpuOK()) return; // sin GPU de verdad (js/gpu.js): la estrellita 2D
  if (!still) return;   // con movimiento: el destello es el del recorrido (js/page-star.js)
  // movimiento reducido: quieto de frente en su hueco
  const state = { mx: 0, my: 0, inView: true };
  new IntersectionObserver(([e]) => { state.inView = e.isIntersecting; }).observe(root);
  afterLoad()
    .then(() => import('./hero-star.js'))
    .then((m) => m.createHeroStar({ gsap, lenis, stage: root, video: null, state, loop, reduced, slot }))
    .then((s) => {
      if (!s) return;
      root.classList.add('is-3d');
      s.enter();
    })
    .catch(() => {});
}
