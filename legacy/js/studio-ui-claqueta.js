// LEGACY: claqueta del estudio (sustituida por la ficha de cámara en cristal, js/studio-ui.js). CSS: legacy/css/studio-claqueta.css
// "¿Qué hacemos?" dentro del estudio 360° (js/studio.js le pasa el progreso p del pin y dónde está cada
// objeto en pantalla): el título en cinta americana, el recuadro de enfoque (AF) que se fija en quien hace
// cada servicio y la claqueta que "claquea" al cambiar. Todo se dispara al cruzar cada umbral de p (no
// scrub); hacia arriba, al revés. Los servicios salen de la lista [data-scenes] del HTML.
export const STOPS = [[0.32, 0.46], [0.54, 0.68], [0.74, 0.88]]; // paradas: FOTO, VÍDEO, EDICIÓN
const TITLE = [0.08, 0.88];  // el título se pega aquí y se va aquí
const CLAP = [0.30, 0.88];   // la claqueta sube desde fuera de pantalla y se va
const OPEN = -24;            // grados: barra abierta

export function createStudioUI({ gsap, section, still }) {
  const pin = section.querySelector('[data-studio-pin]');
  const flash = section.querySelector('.studio__flash');
  const scenes = [...section.querySelectorAll('[data-scenes] li')].map((li) => ({
    name: li.dataset.scene,
    text: li.textContent.trim(),
  }));
  if (!pin || !scenes.length) return { update() {} };

  // --- sin movimiento: las tres claquetas a la vez, cerradas ---
  if (still) {
    const claps = document.createElement('div');
    claps.className = 'studio__claps';
    scenes.forEach((_, i) => {
      const c = buildClap();
      fill(c, scenes, i);
      claps.append(c);
    });
    pin.insertBefore(claps, flash);
    return { update() {} };
  }

  const clap = buildClap();
  pin.insertBefore(clap, flash);
  const bar = clap.querySelector('.clap__bar');
  const barFlash = clap.querySelector('.clap__flash');
  const content = clap.querySelector('.clap__content');
  const tapes = [...section.querySelectorAll('[data-tape]')];
  const af = section.querySelector('[data-af]');
  const label = section.querySelector('[data-af-label]');
  const line = section.querySelector('[data-af-line]');
  let shown = 0;
  fill(clap, scenes, 0);

  // --- título: cada tira se pega de izquierda a derecha con un pequeño aplaste; clip-path con margen
  //   negativo para no cortar la sombra ---
  const titleTl = gsap.timeline({ paused: true })
    .fromTo(tapes, { clipPath: 'inset(-30% 100% -30% -5%)', scaleY: 1.06 }, {
      clipPath: 'inset(-30% -5% -30% -5%)', scaleY: 1, duration: 0.55, ease: 'power3.out', stagger: 0.18,
    });

  // --- claqueta: sube desde fuera de pantalla con la barra abierta ---
  const clapTl = gsap.timeline({ paused: true })
    .set(clap, { visibility: 'visible' })
    .fromTo(clap, { yPercent: 140 }, { yPercent: 0, duration: 0.8, ease: 'expo.out' });
  gsap.set(bar, { rotate: OPEN });
  let barOpen = true;
  let slateTl = null;

  // claqueo: abre (si estaba cerrada) y se cierra de golpe; en el impacto la tarjeta tiembla y la barra
  // destella. A la vez el contenido viejo se va hacia arriba y entra el nuevo desde abajo (al revés si dir < 0)
  const slate = (i, dir) => {
    slateTl?.progress(1).kill();
    slateTl = gsap.timeline();
    const close = barOpen ? 0 : 0.18;
    if (!barOpen) slateTl.to(bar, { rotate: OPEN, duration: 0.18, ease: 'power2.out' }, 0);
    slateTl
      .to(bar, { rotate: 0, duration: 0.16, ease: 'power4.in' }, close)
      .fromTo(clap, { x: 0 }, { keyframes: { x: [2, -2, 1, 0] }, duration: 0.15, ease: 'none' }, close + 0.16)
      .fromTo(barFlash, { opacity: 0.4 }, { opacity: 0, duration: 0.1, ease: 'none' }, close + 0.16);
    if (i !== shown) {
      shown = i;
      slateTl
        .to(content, { y: -16 * dir, opacity: 0, duration: 0.3, ease: 'power2.in' }, Math.max(0, close + 0.16 - 0.3))
        .call(() => fill(clap, scenes, i), null, close + 0.16)
        .fromTo(content, { y: 16 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out' }, close + 0.16);
    }
    barOpen = false;
  };

  // --- recuadro de enfoque: aparece grande, "busca" (140 → 92 → 104 → 96) y se fija ---
  const box = { s: 140 };
  let lockTl = null;
  const lock = (k, dir) => {
    lockTl?.kill();
    label.innerHTML = `AF <b>●</b> ${scenes[k].name.toUpperCase()}`;
    af.classList.remove('is-locked');
    lockTl = gsap.timeline()
      .set(af, { opacity: 1 })
      .set(label, { opacity: 0 })
      .set(line, { strokeDashoffset: 1 })
      .fromTo(box, { s: 140 }, { s: 92, duration: 0.16, ease: 'power2.out' })
      .to(box, { s: 104, duration: 0.14, ease: 'power1.inOut' })
      .to(box, { s: 96, duration: 0.2, ease: 'power2.out' })
      .call(() => { af.classList.add('is-locked'); slate(k, dir); })
      .to(label, { opacity: 1, duration: 0.2 })
      .to(line, { strokeDashoffset: 0, duration: 0.4, ease: 'power2.out' }, '<');
  };
  const unlock = () => {
    lockTl?.kill();
    lockTl = gsap.timeline()
      .to(af, { opacity: 0, duration: 0.25, ease: 'power1.out' })
      .to(line, { strokeDashoffset: 1, duration: 0.2, ease: 'power1.in' }, 0)
      .call(() => af.classList.remove('is-locked'));
  };

  // la esquina de arriba a la izquierda de la claqueta (destino de la línea); fija mientras está en su sitio
  let clapCorner = null;
  const measure = () => {
    const r = clap.getBoundingClientRect();
    const y = gsap.getProperty(clap, 'yPercent') / 100 * r.height; // sin la entrada
    clapCorner = { x: r.left + 6, y: r.top - y };
  };
  window.addEventListener('resize', () => { clapCorner = null; });

  let titleOn = false;
  let clapOn = false;
  let stop = -1;
  let applied = '';
  return {
    // p: progreso real del pin (sin suavizar); points[k]: { x, y } en px del objeto de cada parada, o null
    update(p, points) {
      const t = p >= TITLE[0] && p < TITLE[1];
      if (t !== titleOn) { titleOn = t; if (t) titleTl.play(); else titleTl.reverse(); }

      const c = p >= CLAP[0] && p < CLAP[1];
      if (c !== clapOn) {
        clapOn = c;
        if (c) {
          if (stop < 0 && p < 0.4 && shown !== 0) { shown = 0; fill(clap, scenes, 0); }
          if (stop < 0) { gsap.set(bar, { rotate: OPEN }); barOpen = true; }
          clapTl.play();
        } else {
          clapTl.reverse();
        }
      }

      const k = STOPS.findIndex(([a, b]) => p >= a && p < b);
      if (k !== stop) {
        const dir = k > stop ? 1 : -1;
        if (stop >= 0) unlock();
        if (k >= 0) lock(k, k > shown ? 1 : k < shown ? -1 : dir);
        stop = k;
      }

      // el recuadro sigue a su objeto (y la línea va de su esquina a la claqueta)
      const pt = stop >= 0 ? points[stop] : null;
      if (!pt) return;
      if (!clapCorner) measure();
      const s = box.s;
      const key = `${pt.x.toFixed(1)}|${pt.y.toFixed(1)}|${s.toFixed(1)}`;
      if (key === applied) return;
      applied = key;
      af.style.setProperty('--af', `${s}px`);
      af.style.transform = `translate3d(${pt.x - s / 2}px, ${pt.y - s / 2}px, 0)`;
      line.setAttribute('x1', pt.x + s / 2);
      line.setAttribute('y1', pt.y + s / 2);
      line.setAttribute('x2', clapCorner.x);
      line.setAttribute('y2', clapCorner.y);
    },
  };
}

function buildClap() {
  const clap = document.createElement('div');
  clap.className = 'clap';
  clap.setAttribute('aria-hidden', 'true'); // los servicios ya están en la lista [data-scenes]
  clap.innerHTML = `
    <div class="clap__bar"><i class="clap__flash"></i></div>
    <div class="clap__body">
      <div class="clap__content">
        <p class="clap__meta"><span data-clap-n></span><span>TOMA 1</span><span>DISCO.</span></p>
        <p class="clap__service" data-clap-service></p>
        <p class="clap__text" data-clap-text></p>
      </div>
    </div>`;
  return clap;
}

function fill(clap, scenes, i) {
  clap.querySelector('[data-clap-n]').textContent = `ESCENA ${String(i + 1).padStart(2, '0')}`;
  clap.querySelector('[data-clap-service]').textContent = scenes[i].name;
  clap.querySelector('[data-clap-text]').textContent = scenes[i].text;
}
