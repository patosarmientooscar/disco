// La estrella hace de piloto de cámara → flash → la quemadura blanca se disuelve directamente en el hero.
// Todo dentro del loading. reveal() se llama con el blanco puesto (el fondo del loading ya no está):
// ahí entran el hero y el destello. Resuelve cuando el blanco se ha ido.
// (El zoom por las lentes que venía después del flash está en legacy/js/intro-shot-lentes.js.)
const STAR_CENTER = { x: 1235, y: 643 }; // centro de #logo-star en el viewBox del SVG
const PILOT_RATIO = 0.38;                 // diámetro del piloto / ancho de la estrella
const BURN = 0.12;                        // blanco total antes de disolverse
const DISSOLVE = 0.9;

export function playIntroShot({ gsap, reduced, root, reveal }) {
  const svg = root.querySelector('[data-intro-logo]');
  const star = svg.querySelector('#logo-star');
  const pilot = root.querySelector('[data-intro-pilot]');
  const ghost = root.querySelector('[data-intro-ghost]');
  const preflash = root.querySelector('[data-intro-preflash]');
  const burst = root.querySelector('[data-intro-burst]');
  const white = root.querySelector('[data-intro-white]');
  const clear = () => {
    gsap.set([svg, pilot, burst], { opacity: 0 });
    root.style.background = 'transparent';
    reveal();
  };

  // sin flash: fundido a blanco y al hero
  if (reduced.matches) {
    return gsap.timeline()
      .to(white, { opacity: 1, duration: 0.4, ease: 'power1.inOut' })
      .add(clear)
      .to(white, { opacity: 0, duration: 0.4, ease: 'power1.inOut' })
      .then(() => {});
  }

  // centro de la estrella en píxeles de pantalla (relativos al loading)
  const m = svg.getScreenCTM();
  const host = root.getBoundingClientRect();
  const c = new DOMPoint(STAR_CENTER.x, STAR_CENTER.y).matrixTransform(m);
  const starWidth = star.getBBox().width * m.a;
  const d = starWidth * PILOT_RATIO;
  gsap.set(pilot, { left: c.x - host.left, top: c.y - host.top, width: d, height: d });
  gsap.set(burst, { left: c.x - host.left, top: c.y - host.top });

  // imagen fantasma: copia del logo relleno (sin agua, contornos, ids ni recortes)
  const copy = svg.cloneNode(true);
  copy.querySelectorAll('[aria-hidden], defs').forEach((n) => n.remove());
  copy.querySelectorAll('path').forEach((n) => n.removeAttribute('fill'));
  copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  copy.removeAttribute('role');
  copy.removeAttribute('aria-label');
  copy.setAttribute('aria-hidden', 'true');
  ghost.append(copy);

  const tl = gsap.timeline();

  // 1) piloto: aparece, 2 parpadeos rápidos, fijo 0.25s y crece un pelín antes del disparo
  tl.set(pilot, { opacity: 1 })
    .fromTo(pilot, { scale: 0 }, { scale: 1, duration: 0.18, ease: 'back.out(2)' })
    .to(pilot, { keyframes: { opacity: [1, 0.25, 1], easeEach: 'none' }, duration: 0.12 })
    .to(pilot, { keyframes: { opacity: [1, 0.25, 1], easeEach: 'none' }, duration: 0.12 })
    .to(pilot, { scale: 1.15, duration: 0.1, ease: 'power2.out' }, '+=0.25');

  // 2) pre-destello (70ms) y 60ms de pausa
  tl.to(preflash, { keyframes: { opacity: [0, 0.35, 0], easeEach: 'none' }, duration: 0.07 })
    .addLabel('shot', '+=0.06');

  // 3) disparo: radial desde la estrella + sobreexposición del logo → blanco sólido
  tl.fromTo(burst, { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 4, duration: 0.045, ease: 'expo.out' }, 'shot')
    .to(svg, { filter: 'brightness(4) blur(1.5px)', duration: 0.04, ease: 'none' }, 'shot')
    .set(white, { opacity: 1 }, 'shot+=0.045')
    .add(clear, 'shot+=0.05')
    .addLabel('release', `shot+=${0.045 + BURN}`);

  // 4) afterimage: el logo en negativo, apenas visible, se desvanece con blur creciente
  tl.fromTo(ghost, { opacity: 0.18, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(8px)', duration: 0.5, ease: 'power1.out', immediateRender: false }, 'release');

  // 5) del blanco directamente al hero
  tl.to(white, { opacity: 0, duration: DISSOLVE, ease: 'expo.out' }, 'release');

  return tl.then(() => {});
}
