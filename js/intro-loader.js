// Loading: el logo de disco se dibuja a lápiz y se rellena, con una barra que refleja la carga real.
// Al llegar a 100% dispara "disco:loaded". Resuelve cuando el loading ha desaparecido.
const SVGNS = 'http://www.w3.org/2000/svg';
const LETTERS = ['d', 'i', 's', 'c', 'o'];
const STROKE = 2;          // unidades del viewBox (≈1.2px con el logo a 560px)
const DRAW = 1.1;          // trazo de cada letra
const STAGGER = 0.14;
const FILL = 0.5;          // barrido de relleno de cada letra
const STAR_DRAW = 0.6;
const STAR_FILL = 0.35;
const BAR_GAP = 18;        // px entre "AGENCIA DE PRODUCCIÓN" y la barra
const LERP = 0.12;

export function runIntroLoader({ gsap, lenis, reduced, loop, intro }) {
  const el = document.getElementById('intro-loader');
  if (!el) return Promise.resolve();

  const svg = el.querySelector('[data-intro-logo]');
  const defs = svg.querySelector('defs');
  const turb = svg.querySelector('[data-intro-turb]');
  const disp = svg.querySelector('[data-intro-disp]');
  const star = svg.querySelector('#logo-star');
  const subtitle = svg.querySelector('#logo-subtitle');
  const bar = el.querySelector('[data-intro-bar]');
  const fill = el.querySelector('[data-intro-fill]');
  const pct = el.querySelector('[data-intro-pct]');

  lenis.stop();
  document.documentElement.classList.add('is-locked');

  // --- barra: mismo ancho que el subtítulo, 18px por debajo (sin contar su animación) ---
  const placeBar = () => {
    const box = subtitle.getBBox();
    const m = svg.getScreenCTM();
    const host = el.getBoundingClientRect();
    const a = new DOMPoint(box.x, box.y + box.height).matrixTransform(m);
    const b = new DOMPoint(box.x + box.width, box.y + box.height).matrixTransform(m);
    bar.style.left = `${a.x - host.left}px`;
    bar.style.top = `${a.y - host.top + BAR_GAP}px`;
    bar.style.width = `${b.x - a.x}px`;
  };
  placeBar();
  window.addEventListener('resize', placeBar);

  // --- logo: cada pieza = trazo (el original) + relleno (copia recortada que sube) ---
  const parts = [...LETTERS.map((k) => svg.querySelector(`#letter-${k}`)), star].map((path, i) => {
    const box = path.getBBox();
    const clip = document.createElementNS(SVGNS, 'clipPath');
    const rect = document.createElementNS(SVGNS, 'rect');
    clip.id = `intro-fill-${i}`;
    rect.setAttribute('x', box.x - 4);
    rect.setAttribute('width', box.width + 8);
    rect.setAttribute('y', box.y + box.height + 4);
    rect.setAttribute('height', 0);
    clip.append(rect);
    defs.append(clip);

    const filled = path.cloneNode();
    filled.removeAttribute('id');
    filled.setAttribute('clip-path', `url(#${clip.id})`);
    filled.setAttribute('aria-hidden', 'true');
    path.before(filled);

    const len = path.getTotalLength();
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#fff');
    path.setAttribute('stroke-width', STROKE);
    path.setAttribute('stroke-dasharray', len);
    path.setAttribute('stroke-dashoffset', len);
    path.setAttribute('filter', 'url(#intro-pencil)');
    return { path, rect, box };
  });
  const fillTo = (p) => ({ attr: { y: p.box.y - 4, height: p.box.height + 8 } });

  const lettersEnd = (LETTERS.length - 1) * STAGGER + DRAW; // la "o" termina su trazo
  const drawing = gsap.timeline({ paused: true });

  if (reduced.matches) {
    // logo relleno directamente, sin temblor
    parts.forEach((p) => { gsap.set(p.rect, fillTo(p)); gsap.set(p.path, { opacity: 0 }); });
    gsap.set(disp, { attr: { scale: 0 } });
  } else {
    gsap.set(subtitle, { opacity: 0, scaleX: 1.12, transformOrigin: '50% 50%' });
    parts.slice(0, LETTERS.length).forEach((p, i) => {
      const at = i * STAGGER;
      drawing
        .to(p.path, { attr: { 'stroke-dashoffset': 0 }, duration: DRAW, ease: 'power2.inOut' }, at)
        .to(p.rect, { ...fillTo(p), duration: FILL, ease: 'power2.out' }, at + DRAW)
        .to(p.path, { opacity: 0, duration: FILL, ease: 'power1.out' }, at + DRAW);
    });
    const s = parts[LETTERS.length];
    drawing
      .to(s.path, { attr: { 'stroke-dashoffset': 0 }, duration: STAR_DRAW, ease: 'power2.inOut' }, lettersEnd)
      .to(s.rect, { ...fillTo(s), duration: STAR_FILL, ease: 'power2.out' }, lettersEnd + STAR_DRAW)
      .to(s.path, { opacity: 0, duration: STAR_FILL }, lettersEnd + STAR_DRAW)
      // "AGENCIA DE PRODUCCIÓN": aparece y se cierra (es un path: el tracking se simula con scaleX)
      .to(subtitle, { opacity: 1, scaleX: 1, duration: 0.8, ease: 'power2.out' }, lettersEnd)
      // temblor de lápiz solo mientras se traza
      .to(turb, { attr: { seed: 40 }, duration: lettersEnd + STAR_DRAW, ease: 'steps(40)' }, 0)
      .to(disp, { attr: { scale: 0 }, duration: 0.25 }, lettersEnd + STAR_DRAW)
      .add(() => parts.forEach((p) => p.path.removeAttribute('filter')));
  }
  drawing.play();

  // --- progreso real: vídeo + imágenes + fuentes ---
  const sources = [];
  const track = () => { const s = { value: 0 }; sources.push(s); return s; };

  intro.images.forEach((src) => {
    const s = track();
    const img = new Image();
    img.onload = img.onerror = () => { s.value = 1; };
    img.src = src;
  });

  const videoSrc = track();
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.playsInline = true;
  const buffered = () => {
    if (videoSrc.value === 1 || !video.duration || !video.buffered.length) return;
    videoSrc.value = Math.min(0.99, video.buffered.end(video.buffered.length - 1) / video.duration);
  };
  video.addEventListener('progress', buffered);
  video.addEventListener('canplaythrough', () => { videoSrc.value = 1; }, { once: true });
  video.addEventListener('error', () => { videoSrc.value = 1; }, { once: true });
  video.src = intro.video;
  video.load();

  const fonts = track();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fonts.value = 1; });

  const real = () => sources.reduce((sum, s) => sum + s.value, 0) / sources.length;

  // --- número y barra: min(real, mínimo en 2.8s), interpolado ---
  return new Promise((resolve) => {
    const start = performance.now();
    let shown = 0;
    let done = false;

    const render = () => {
      const n = Math.round(shown);
      fill.style.transform = `scaleX(${(shown / 100).toFixed(4)})`;
      pct.textContent = `${String(n).padStart(3, '0')}%`;
      bar.setAttribute('aria-valuenow', n);
    };

    const stopTick = loop.add((time, ratio) => {
      if (done) return;
      const minimum = Math.min(1, (performance.now() - start) / (intro.minSeconds * 1000));
      const target = Math.min(real(), minimum) * 100;
      shown = reduced.matches ? target : shown + (target - shown) * (1 - Math.pow(1 - LERP, ratio));
      if (target >= 100 && shown > 99.5) shown = 100;
      render();
      if (shown < 100) return;

      done = true;
      stopTick();
      window.removeEventListener('resize', placeBar);
      window.dispatchEvent(new CustomEvent('disco:loaded'));

      // provisional hasta el prompt 3 (luz roja + flash + lentes): el loading se funde y sigue la web
      gsap.to(el, {
        opacity: 0,
        duration: 0.4,
        ease: 'power1.inOut',
        onComplete: () => {
          el.remove();
          document.documentElement.classList.remove('is-locked');
          lenis.start();
          resolve();
        },
      });
    });
  });
}
