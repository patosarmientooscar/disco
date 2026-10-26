// "¿Qué hacemos?" dentro del estudio 360° (js/studio.js le pasa el progreso p del pin y dónde está cada
// objeto en pantalla): el título en cinta americana, el recuadro de enfoque (AF) que se fija en quien hace
// cada servicio y la ficha de cámara (cristal) que lo cuenta: cambia de servicio con un CAMBIO DE FOCO.
// Todo se dispara al cruzar cada umbral de p (no scrub); hacia arriba, al revés. Los servicios salen de la
// lista [data-scenes] del HTML. (LEGACY: la claqueta, en legacy/js/studio-ui-claqueta.js)
export const STOPS = [[0.32, 0.46], [0.54, 0.68], [0.74, 0.88]]; // paradas: FOTO, VÍDEO, EDICIÓN
const TITLE = [0.08, 0.88];  // el título se pega aquí y se va aquí
const CARD = [0.30, 0.88];   // la ficha aparece enfocándose y se va
const CORNER = 8;            // px: las escuadras, por fuera del panel
const SEGMENT = 22;          // px: segmento de progreso (18) + separación (4)
const FPS_TC = 25;           // el timecode de Edición corre a 25 fps
const TC_START = ((12 * 25) + 4);   // 00:00:12:04 en frames
// datos de cámara de cada servicio (por nombre, en minúsculas y sin tildes)
const DATA = {
  foto: () => 'ISO 400   ·   f/2.8   ·   1/200',
  video: () => '<span class="ficha__rec">●</span> REC   ·   4K   ·   25p',
  edicion: () => '<span class="ficha__tc" data-tc>00:00:12:04</span><span class="ficha__wave" aria-hidden="true">' + '<i></i>'.repeat(7) + '</span>',
};

export function createStudioUI({ gsap, section, still }) {
  const pin = section.querySelector('[data-studio-pin]');
  const flash = section.querySelector('.studio__flash');
  const scenes = [...section.querySelectorAll('[data-scenes] li')].map((li) => ({
    name: li.dataset.scene,
    text: li.textContent.trim(),
  }));
  if (!pin || !scenes.length) return { update() {} };

  // --- sin movimiento: las tres fichas a la vez, en rejilla ---
  if (still) {
    const grid = document.createElement('div');
    grid.className = 'studio__fichas';
    scenes.forEach((_, i) => {
      const c = buildCard();
      fill(c, scenes, i);
      gsap.set(c.querySelector('.ficha__prog b'), { x: i * SEGMENT });
      grid.append(c);
      const tc = timecode(gsap, c);
      if (tc) new IntersectionObserver(([e]) => (e.isIntersecting ? tc.start() : tc.stop())).observe(c);
    });
    pin.insertBefore(grid, flash);
    return { update() {} };
  }

  const card = buildCard();
  pin.insertBefore(card, flash);
  const panel = card.querySelector('.ficha__panel');
  const corners = card.querySelectorAll('.ficha__c');
  const blocks = card.querySelectorAll('[data-f-block]');
  const bar = card.querySelector('.ficha__prog b');
  const tapes = [...section.querySelectorAll('[data-tape]')];
  const af = section.querySelector('[data-af]');
  const label = section.querySelector('[data-af-label]');
  const line = section.querySelector('[data-af-line]');
  const dot = section.querySelector('[data-af-dot]');
  let shown = 0;
  let tc = null;
  let cardOn = false;
  const show = (i) => {
    tc?.stop();
    fill(card, scenes, i);
    tc = timecode(gsap, card);
    if (cardOn) tc?.start();
  };
  show(0);

  // --- título: cada tira se pega de izquierda a derecha con un pequeño aplaste; clip-path con margen
  //   negativo para no cortar la sombra ---
  const titleTl = gsap.timeline({ paused: true })
    .fromTo(tapes, { clipPath: 'inset(-30% 100% -30% -5%)', scaleY: 1.06 }, {
      clipPath: 'inset(-30% -5% -30% -5%)', scaleY: 1, duration: 0.55, ease: 'power3.out', stagger: 0.18,
    });

  // --- ficha: aparece desenfocada y se enfoca; las escuadras llegan de 18px más afuera y se cierran
  //   sobre el panel 0.15 s después (el autofoco ajustando). La salida, al revés ---
  const cardTl = gsap.timeline({ paused: true })
    .set(card, { visibility: 'visible' })
    .fromTo(panel, { opacity: 0, filter: 'blur(14px)', scale: 1.03 }, { opacity: 1, filter: 'blur(0px)', scale: 1, duration: 0.9, ease: 'expo.out' })
    .fromTo(corners, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out' }, 0.15)
    .fromTo(card, { '--spread': 18 }, { '--spread': 0, duration: 0.9, ease: 'expo.out' }, 0.15);

  // --- cambio de foco: lo de ahora se desenfoca y se va; las escuadras se abren 6px y vuelven; entra lo
  //   nuevo desenfocado y se enfoca con el rebote del autofoco (10 → 0 → 1.5 → 0); el nombre, letra a letra ---
  let focusTl = null;
  const focus = (i) => {
    if (i === shown) return;
    focusTl?.progress(1).kill();
    shown = i;
    focusTl = gsap.timeline()
      .to(blocks, { filter: 'blur(10px)', opacity: 0, y: -6, duration: 0.28, ease: 'power2.in' }, 0)
      .to(card, { '--spread': 6, duration: 0.12, ease: 'power2.out' }, 0)
      .to(card, { '--spread': 0, duration: 0.35, ease: 'back.out(2)' }, 0.12)
      .to(bar, { x: i * SEGMENT, duration: 0.6, ease: 'expo.inOut' }, 0)
      .call(() => {
        show(i);
        gsap.fromTo(card.querySelectorAll('.ficha__ch'), { yPercent: 40 }, { yPercent: 0, duration: 0.5, ease: 'expo.out', stagger: 0.025 });
      }, null, 0.28)
      .set(blocks, { y: 0 }, 0.28)
      .to(blocks, { opacity: 1, duration: 0.2, ease: 'power1.out' }, 0.28)
      .fromTo(blocks, { filter: 'blur(10px)' }, {
        keyframes: { filter: ['blur(10px)', 'blur(0px)', 'blur(1.5px)', 'blur(0px)'], easeEach: 'power1.out' },
        duration: 0.45,
        ease: 'none',
      }, 0.28)
      .set(blocks, { clearProps: 'filter' });
  };
  // se rehace sin animar (al volver a entrar por arriba, de nuevo en Foto)
  const reset = (i) => {
    focusTl?.progress(1).kill();
    shown = i;
    gsap.set(bar, { x: i * SEGMENT });
    show(i);
  };

  // --- recuadro de enfoque: aparece grande, "busca" (140 → 92 → 104 → 96) y se fija ---
  const box = { s: 140 };
  let lockTl = null;
  const lock = (k) => {
    lockTl?.kill();
    label.innerHTML = `AF <b>●</b> ${scenes[k].name.toUpperCase()}`;
    af.classList.remove('is-locked');
    lockTl = gsap.timeline()
      .set(af, { opacity: 1 })
      .set(label, { opacity: 0 })
      .set(line, { strokeDashoffset: 1 })
      .set(dot, { opacity: 0 })
      .fromTo(box, { s: 140 }, { s: 92, duration: 0.16, ease: 'power2.out' })
      .to(box, { s: 104, duration: 0.14, ease: 'power1.inOut' })
      .to(box, { s: 96, duration: 0.2, ease: 'power2.out' })
      .call(() => { af.classList.add('is-locked'); focus(k); })
      .to(label, { opacity: 1, duration: 0.2 })
      .to(line, { strokeDashoffset: 0, duration: 0.4, ease: 'power2.out' }, '<')
      .to(dot, { opacity: 1, duration: 0.15 }, '>-0.05');
  };
  const unlock = () => {
    lockTl?.kill();
    lockTl = gsap.timeline()
      .to(af, { opacity: 0, duration: 0.25, ease: 'power1.out' })
      .to(dot, { opacity: 0, duration: 0.1 }, 0)
      .to(line, { strokeDashoffset: 1, duration: 0.2, ease: 'power1.in' }, 0)
      .call(() => af.classList.remove('is-locked'));
  };

  // la punta de la escuadra de arriba a la izquierda de la ficha (destino de la línea): con offset, sin
  // las transformaciones de la entrada
  let corner = null;
  const measure = () => { corner = { x: card.offsetLeft - CORNER, y: card.offsetTop - CORNER }; };
  window.addEventListener('resize', () => { corner = null; });

  let titleOn = false;
  let stop = -1;
  let applied = '';
  return {
    // p: progreso real del pin (sin suavizar); points[k]: { x, y } en px del objeto de cada parada, o null
    update(p, points) {
      const t = p >= TITLE[0] && p < TITLE[1];
      if (t !== titleOn) { titleOn = t; if (t) titleTl.play(); else titleTl.reverse(); }

      const c = p >= CARD[0] && p < CARD[1];
      if (c !== cardOn) {
        cardOn = c;
        if (c) {
          if (stop < 0 && p < 0.4 && shown !== 0) reset(0);
          cardTl.play();
          tc?.start();
        } else {
          cardTl.reverse();
          tc?.stop();
        }
      }

      const k = STOPS.findIndex(([a, b]) => p >= a && p < b);
      if (k !== stop) {
        if (stop >= 0) unlock();
        if (k >= 0) lock(k);
        stop = k;
      }

      // el recuadro sigue a su objeto (y la línea va de su esquina a la ficha)
      const pt = stop >= 0 ? points[stop] : null;
      if (!pt) return;
      if (!corner) measure();
      const s = box.s;
      const key = `${pt.x.toFixed(1)}|${pt.y.toFixed(1)}|${s.toFixed(1)}|${corner.x}|${corner.y}`;
      if (key === applied) return;
      applied = key;
      af.style.setProperty('--af', `${s}px`);
      af.style.transform = `translate3d(${pt.x - s / 2}px, ${pt.y - s / 2}px, 0)`;
      line.setAttribute('x1', pt.x + s / 2);
      line.setAttribute('y1', pt.y + s / 2);
      line.setAttribute('x2', corner.x);
      line.setAttribute('y2', corner.y);
      dot.setAttribute('cx', corner.x);
      dot.setAttribute('cy', corner.y);
    },
  };
}

function buildCard() {
  const card = document.createElement('div');
  card.className = 'ficha';
  card.setAttribute('aria-hidden', 'true'); // los servicios ya están en la lista [data-scenes]
  card.innerHTML = `
    <i class="ficha__c ficha__c--tl"></i><i class="ficha__c ficha__c--tr"></i><i class="ficha__c ficha__c--bl"></i><i class="ficha__c ficha__c--br"></i>
    <div class="ficha__panel">
      <p class="ficha__top"><span data-f-n></span><span class="ficha__prog"><i></i><i></i><i></i><b></b></span></p>
      <div data-f-block>
        <p class="ficha__name" data-f-name></p>
        <p class="ficha__text" data-f-text></p>
      </div>
      <hr class="ficha__rule">
      <p class="ficha__data" data-f-block data-f-data></p>
    </div>`;
  return card;
}

function fill(card, scenes, i) {
  const pad = (n) => String(n).padStart(2, '0');
  card.querySelector('[data-f-n]').textContent = `${pad(i + 1)} / ${pad(scenes.length)}`;
  card.querySelector('[data-f-name]').innerHTML = [...scenes[i].name].map((ch) => `<span class="ficha__ch">${ch}</span>`).join('')
    + '<span class="ficha__ch ficha__dot">.</span>';
  card.querySelector('[data-f-text]').textContent = scenes[i].text;
  const key = scenes[i].name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  card.dataset.scene = key; // el cristal se oscurece más donde el estudio es claro detrás (css/studio.css)
  card.querySelector('[data-f-data]').innerHTML = DATA[key] ? DATA[key]() : '';
}

// timecode de Edición corriendo a 25 fps mientras la ficha está a la vista (null si la ficha no lo lleva)
function timecode(gsap, card) {
  const el = card.querySelector('[data-tc]');
  if (!el) return null;
  let t0 = 0;
  let last = -1;
  const pad = (n) => String(n).padStart(2, '0');
  const tick = () => {
    const f = TC_START + Math.floor((performance.now() - t0) / (1000 / FPS_TC));
    if (f === last) return;
    last = f;
    const s = Math.floor(f / FPS_TC);
    el.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f % FPS_TC)}`;
  };
  let on = false;
  return {
    start() { if (on) return; on = true; t0 = performance.now(); gsap.ticker.add(tick); },
    stop() { on = false; gsap.ticker.remove(tick); },
  };
}
