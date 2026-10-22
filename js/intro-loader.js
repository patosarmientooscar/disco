import { playIntroShot } from './intro-shot.js';
import { createWater, outline } from './water.js';

// Loading: el contorno de "disco" y del subtítulo aparece despacio y dentro de las letras sube agua; el nivel
// del agua ES el progreso real de la carga (sin número ni barra). Lleno: la estrella se llena de plata y
// dispara "disco:loaded"; después luz roja + flash (intro-shot.js) y, con el blanco del flash puesto,
// "disco:intro-done": el blanco se disuelve directamente en el hero. Resuelve entonces.
// (El trazado a lápiz con barra y porcentaje anterior está en legacy/js/intro-loader-lentes.js.)
const SVGNS = 'http://www.w3.org/2000/svg';
const LETTERS = ['d', 'i', 's', 'c', 'o'];
const OUTLINE = 1.4;       // el contorno se dibuja en 1.4 s, todas las letras a la vez
const LERP = 0.05;         // nivel mostrado → min(real, mínimo temporal), por frame a 60 fps
const STAR_FILL = 0.6;

// assets: promesas de otras cargas que cuentan en el progreso (p. ej. el GLB del destello 3D);
// cuentan como hechas tanto si cargan como si fallan.
export function runIntroLoader({ gsap, lenis, reduced, loop, intro, assets = [] }) {
  const el = document.getElementById('intro-loader');
  if (!el) return Promise.resolve();

  const svg = el.querySelector('[data-intro-logo]');
  const defs = svg.querySelector('defs');
  const star = svg.querySelector('#logo-star');
  const subtitle = svg.querySelector('#logo-subtitle');
  const progress = el.querySelector('[data-intro-progress]');
  const letters = LETTERS.map((k) => svg.querySelector(`#letter-${k}`));

  lenis.stop();
  document.documentElement.classList.add('is-locked');

  // --- agua (letras + subtítulo, un solo clip) y contorno de todo, estrella incluida ---
  const water = createWater(svg, [...letters, subtitle]);
  const lines = outline(svg, [...letters, subtitle, star]);
  [...letters, subtitle, star].forEach((p) => p.setAttribute('fill', 'none'));

  // estrella: plata que sube de abajo arriba (copia recortada por un rect)
  const box = star.getBBox();
  const grad = document.createElementNS(SVGNS, 'linearGradient');
  grad.id = 'intro-silver';
  grad.setAttribute('x1', '0'); grad.setAttribute('y1', '1');
  grad.setAttribute('x2', '0'); grad.setAttribute('y2', '0');
  grad.innerHTML = '<stop offset="0" stop-color="#7d7d7d"/><stop offset="0.55" stop-color="#bdbdbd"/><stop offset="1" stop-color="#ececec"/>';
  const clip = document.createElementNS(SVGNS, 'clipPath');
  clip.id = 'intro-star-fill';
  const rise = document.createElementNS(SVGNS, 'rect');
  rise.setAttribute('x', box.x - 2);
  rise.setAttribute('width', box.width + 4);
  rise.setAttribute('y', box.y + box.height + 2);
  rise.setAttribute('height', 0);
  clip.append(rise);
  defs.append(grad, clip);
  const silver = star.cloneNode();
  silver.removeAttribute('id');
  silver.setAttribute('fill', 'url(#intro-silver)');
  silver.setAttribute('clip-path', 'url(#intro-star-fill)');
  silver.setAttribute('aria-hidden', 'true');
  star.after(silver);
  const starFull = { attr: { y: box.y - 2, height: box.height + 4 } };

  const onResize = () => { water.resize(); lines.width(); };
  window.addEventListener('resize', onResize);

  if (reduced.matches) {
    // logo relleno directamente, sin ola
    water.fill();
    gsap.set(lines.g, { opacity: 0 });
    gsap.set(rise, starFull);
  } else {
    lines.hide();
    gsap.to(lines.strokes, { strokeDashoffset: 0, duration: OUTLINE, ease: 'sine.inOut' });
  }

  // --- progreso real: imágenes + fuentes + modelo 3D ---
  const sources = [];
  const track = () => { const s = { value: 0 }; sources.push(s); return s; };

  intro.images.forEach((src) => {
    const s = track();
    const img = new Image();
    img.onload = img.onerror = () => { s.value = 1; };
    img.src = src;
  });

  assets.forEach((p) => {
    const s = track();
    const done = () => { s.value = 1; };
    Promise.resolve(p).then(done, done);
  });

  const fonts = track();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fonts.value = 1; });

  const real = () => sources.reduce((sum, s) => sum + s.value, 0) / sources.length;

  // --- nivel del agua: lerp hacia min(real, mínimo temporal) ---
  return new Promise((resolve) => {
    const start = performance.now();
    let shown = 0;
    let done = false;

    const stopTick = loop.add((time, ratio) => {
      if (done) return;
      const minimum = Math.min(1, (performance.now() - start) / (intro.minSeconds * 1000));
      const target = Math.min(real(), minimum);
      shown = reduced.matches ? target : shown + (target - shown) * (1 - Math.pow(1 - LERP, ratio));
      if (target >= 1 && shown > 0.995) shown = 1;
      if (!reduced.matches) water.render(shown, time);
      progress.setAttribute('aria-valuenow', Math.round(shown * 100));
      if (shown < 1) return;

      done = true;
      stopTick();
      water.fill();
      window.dispatchEvent(new CustomEvent('disco:loaded'));

      // estrella de plata → luz roja → flash; con el blanco puesto, el hero queda detrás y el blanco se disuelve en él
      const silverIn = reduced.matches ? Promise.resolve() : gsap.to(rise, { ...starFull, duration: STAR_FILL, ease: 'power2.inOut' });
      Promise.resolve(silverIn).then(() => playIntroShot({
        gsap, reduced, root: el,
        reveal() {
          try { sessionStorage.setItem('disco_intro_done', '1'); } catch { /* sin storage: la intro se verá otra vez */ }
          window.removeEventListener('resize', onResize);
          document.documentElement.classList.remove('is-locked');
          lenis.start();
          window.dispatchEvent(new CustomEvent('disco:intro-done'));
          resolve();
        },
      })).then(() => el.remove());
    });
  });
}
