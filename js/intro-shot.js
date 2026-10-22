// La estrella hace de piloto de cámara → FLASH REAL (foto de un flash disparando, con destello de lente) →
// la quemadura blanca se disuelve directamente en el hero. reveal() se llama con el blanco puesto (el loading
// ya no se ve): ahí entran el hero y el destello. Resuelve cuando el flash se ha apagado del todo.
// El burst, el blanco y la mancha fantasma van fuera del loading, directamente en <body>: con
// mix-blend-mode: screen el negro de la foto desaparece sobre el loading y, después, sobre el hero.
// (El flash dibujado con el logo en negativo y el zoom por las lentes: legacy/js/intro-shot-lentes.js.)
const STAR_CENTER = { x: 1235, y: 643 }; // centro de #logo-star en el viewBox del SVG
const PILOT_RATIO = 0.38;                 // diámetro del piloto / ancho de la estrella
const BURST = 'assets/intro/flash-burst.webp';
const BURST_CORE = { x: 0.489, y: 0.481 }; // dónde está el núcleo del flash en la foto (fracción)
const BURST_ASPECT = 1520 / 2688;
const BURST_WIDTH = 0.7;                   // × lado mayor de la pantalla, a escala 1

export function playIntroShot({ gsap, reduced, root, reveal }) {
  const svg = root.querySelector('[data-intro-logo]');
  const star = svg.querySelector('#logo-star');
  const pilot = root.querySelector('[data-intro-pilot]');

  const layer = (cls) => {
    const n = document.createElement(cls === 'flash-burst' ? 'img' : 'i');
    n.className = cls;
    n.setAttribute('aria-hidden', 'true');
    document.body.append(n);
    return n;
  };
  const white = layer('flash-white');
  const clear = () => {
    root.style.visibility = 'hidden';
    reveal();
  };

  // sin burst: fundido a blanco 0.4 s y al hero
  if (reduced.matches) {
    return gsap.timeline()
      .to(white, { opacity: 1, duration: 0.4, ease: 'power1.inOut' })
      .add(clear)
      .to(white, { opacity: 0, duration: 0.4, ease: 'power1.inOut' })
      .then(() => white.remove());
  }

  const burst = layer('flash-burst');
  const ghost = layer('flash-ghost');
  burst.alt = '';
  burst.src = BURST; // ya precargada (cuenta en el progreso del loading, js/config.js)

  // centro de la estrella en píxeles de pantalla
  const m = svg.getScreenCTM();
  const c = new DOMPoint(STAR_CENTER.x, STAR_CENTER.y).matrixTransform(m);
  const starWidth = star.getBBox().width * m.a;
  const host = root.getBoundingClientRect();
  const d = starWidth * PILOT_RATIO;
  gsap.set(pilot, { left: c.x - host.left, top: c.y - host.top, width: d, height: d });

  // el núcleo del flash, EXACTAMENTE sobre la estrella (escala desde el núcleo)
  const w = Math.max(innerWidth, innerHeight) * BURST_WIDTH;
  const h = w * BURST_ASPECT;
  gsap.set(burst, {
    width: w, height: h,
    left: c.x - w * BURST_CORE.x, top: c.y - h * BURST_CORE.y,
    transformOrigin: `${BURST_CORE.x * 100}% ${BURST_CORE.y * 100}%`,
    opacity: 0,
  });
  const g = starWidth * 3;
  gsap.set(ghost, { width: g, height: g, left: c.x - g / 2, top: c.y - g / 2, opacity: 0 });

  const tl = gsap.timeline();

  // 1) piloto: aparece, 2 parpadeos rápidos, fijo 0.25 s y crece un pelín antes del disparo
  tl.set(pilot, { opacity: 1 })
    .fromTo(pilot, { scale: 0 }, { scale: 1, duration: 0.18, ease: 'back.out(2)' })
    .to(pilot, { keyframes: { opacity: [1, 0.25, 1], easeEach: 'none' }, duration: 0.12 })
    .to(pilot, { keyframes: { opacity: [1, 0.25, 1], easeEach: 'none' }, duration: 0.12 })
    .to(pilot, { scale: 1.15, duration: 0.1, ease: 'power2.out' }, '+=0.25');

  // 2) pre-flash: el burst al 25 %, pequeño, 60 ms; 3) 90 ms de oscuridad
  tl.set(burst, { opacity: 0.25, scale: 0.35 })
    .set(burst, { opacity: 0 }, '+=0.06')
    .addLabel('shot', '+=0.09');

  // 4) disparo: el burst crece desde la estrella y el sensor se sobreexpone (blanco frío a pantalla completa)
  tl.fromTo(burst, { scale: 0.5, opacity: 0 }, { scale: 2.6, opacity: 1, duration: 0.07, ease: 'expo.out', immediateRender: false }, 'shot')
    .to(white, { opacity: 1, duration: 0.09, ease: 'none' }, 'shot')
    // 5) quemado: blanco total 120 ms; debajo ya no está el loading, está el hero
    .add(clear, 'shot+=0.09')
    .addLabel('decay', 'shot+=0.21');

  // 6) decaimiento exponencial: el blanco se va en 0.9 s; el burst, debajo, más lento (1.3 s) y su destello
  //    horizontal se estira un 15 % (persistencia en la retina). Detrás va apareciendo el hero.
  tl.to(white, { opacity: 0, duration: 0.9, ease: 'expo.out' }, 'decay')
    .to(burst, { opacity: 0, duration: 1.3, ease: 'expo.out' }, 'decay')
    .to(burst, { scaleX: 2.6 * 1.15, duration: 1.3, ease: 'power2.out' }, 'decay');

  // 7) mancha fantasma en el sitio de la estrella, se desvanece en 1.5 s
  tl.fromTo(ghost, { opacity: 0.12 }, { opacity: 0, duration: 1.5, ease: 'power1.out', immediateRender: false }, 'decay');

  return tl.then(() => [white, burst, ghost].forEach((n) => n.remove()));
}
