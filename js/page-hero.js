import { config } from './config.js';

// Hero de las páginas interiores (Servicios, Portfolio, Nosotros, Contacto; css/page-hero.css). Cada página solo
// declara su contenido en <section class="pgh" data-page-hero="clave"> (título, texto, botones y una línea de meta);
// el vídeo de cada una está en js/config.js → pageHeroes. Aquí: el vídeo (1280 en < 900 px o con ahorro de datos)
// con su timecode real, el grano, el parallax con el ratón, la entrada (flash, destello, letras, texto) y la salida
// con el scroll del sticky. El destello 3D (js/hero-star.js) se carga aparte: sin WebGL el hero funciona igual.
// Todo en el loop único (gsap.ticker) y solo con el hero en pantalla.
const FPS = 24;                                  // timecode del vídeo
const PARALLAX = { x: 18, y: 12, lerp: 0.06 };   // px: el vídeo, al revés que el cursor
const ENTER = { flash: 0.56, y: 60, edge: 0.8, duration: 1.1, stagger: 0.035, after: 0.75 };
// salida (progreso del sticky, amortiguado): primero texto y botones; el título se abre desde el centro (hasta
// ±45 % del ancho) y se desvanece; el vídeo se acerca, se desenfoca y se oscurece
const EXIT = { lerp: 7, ui: [0, 0.2], open: [0.06, 0.75], spread: 0.45, fade: [0.35, 0.85], zoom: [1.06, 1.24], blur: 6, bright: [0.58, 0.04] };
const GRAIN = { w: 240, h: 140, fps: 12 };
const HINT = 3000;                               // ms sin tocar el destello: aparece "Arrastra el destello"
const NARROW = '(max-width: 899px)';

export function initPageHero({ gsap, ScrollTrigger, lenis, loop, reduced, arrived }) {
  const root = document.querySelector('[data-page-hero]');
  if (!root) return null;
  const still = reduced.matches;
  const cfg = config.pageHeroes?.[root.dataset.pageHero] || {};
  const stage = root.querySelector('.pgh__stage');
  const look = root.querySelector('.pgh__look');
  const media = root.querySelector('.pgh__media');
  const title = root.querySelector('.pgh__title');
  const after = [...root.querySelectorAll('[data-ph-after]')];
  const tc = root.querySelector('[data-ph-tc]');
  if (cfg.pos) root.style.setProperty('--ph-pos', cfg.pos);

  // estado que lee el destello: cursor (-1..1), progreso de la salida, en pantalla, entrada hecha
  const state = { mx: 0, my: 0, tx: 0, ty: 0, p: 0, pt: 0, inView: true, entered: false };

  // ---------- título: cada letra en su <span> (el h1 conserva el texto) y del tamaño que cabe en una línea ----------
  const text = title.textContent.replace(/\s+/g, ' ').trim();
  title.setAttribute('aria-label', text);
  const dot = title.querySelector('b');
  const word = (dot ? text.slice(0, -dot.textContent.length) : text).trim();
  title.innerHTML = [...word].map((c) => `<span class="pgh__l" aria-hidden="true">${c === ' ' ? '&nbsp;' : c}</span>`).join('')
    + (dot ? `<b class="pgh__l" aria-hidden="true">${dot.textContent}</b>` : '');
  title.classList.add('is-split');
  const letters = [...title.querySelectorAll('.pgh__l')];
  const mid = (letters.length - 1) / 2;
  const dir = letters.map((_, i) => (mid ? (i - mid) / mid : 0)); // -1 (izquierda) … 1 (derecha)
  const fit = () => {
    title.style.removeProperty('--ph-size');
    const room = stage.clientWidth - 2 * (parseFloat(getComputedStyle(root.querySelector('.pgh__foot')).left) || 20);
    const w = title.scrollWidth;
    if (w > room) title.style.setProperty('--ph-size', `${(parseFloat(getComputedStyle(title).fontSize) * room) / w}px`);
  };
  fit();
  if (document.fonts) document.fonts.ready.then(fit);
  window.addEventListener('resize', fit);

  // ---------- enlaces del hero: bajan con Lenis; copiar el email ----------
  root.querySelectorAll('[data-ph-to]').forEach((a) => a.addEventListener('click', (e) => {
    const to = a.getAttribute('href');
    if (!to?.startsWith('#') || !document.querySelector(to)) return;
    e.preventDefault();
    lenis.scrollTo(to, { duration: still ? 0 : 1.8, easing: (t) => 1 - Math.pow(1 - t, 4), immediate: still });
  }));
  const copy = root.querySelector('[data-ph-copy]');
  if (copy) {
    const ok = root.querySelector('[data-ph-copied]');
    let timer = 0;
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(config.email); ok.textContent = 'Copiado'; } catch { ok.textContent = 'No se pudo copiar'; }
      clearTimeout(timer);
      timer = setTimeout(() => { ok.textContent = ''; }, 1500);
    });
  }

  // ---------- grano de película: ruido 240×140 escalado, a 12 fps ----------
  const grain = document.createElement('canvas');
  grain.className = 'pgh__grain';
  grain.width = GRAIN.w;
  grain.height = GRAIN.h;
  grain.setAttribute('aria-hidden', 'true');
  root.querySelector('.pgh__foot').before(grain);
  const g = grain.getContext('2d');
  const noise = g.createImageData(GRAIN.w, GRAIN.h);
  const paintGrain = () => {
    const d = noise.data;
    for (let i = 0; i < d.length; i += 4) { const v = (Math.random() * 255) | 0; d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255; }
    g.putImageData(noise, 0, 0);
  };
  paintGrain();

  // flash de la entrada y pista del destello
  const flash = document.createElement('i');
  flash.className = 'pgh__flash';
  flash.setAttribute('aria-hidden', 'true');
  stage.append(flash);
  const hint = document.createElement('p');
  hint.className = 'pgh__hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.textContent = 'Arrastra el destello';
  stage.append(hint);

  // ---------- vídeo (con movimiento reducido, solo el póster) ----------
  let video = null;
  if (!still && cfg.video) {
    const conn = navigator.connection || {};
    const small = matchMedia(NARROW).matches || conn.saveData || /2g|3g/.test(conn.effectiveType || '');
    video = document.createElement('video');
    Object.assign(video, { muted: true, loop: true, playsInline: true, autoplay: true, preload: 'auto' });
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    if (cfg.poster) video.poster = cfg.poster;
    video.src = small ? cfg.videoSm || cfg.video : cfg.video;
    const start = cfg.start || 0;
    if (start) video.addEventListener('loadedmetadata', () => { video.currentTime = start % (video.duration || 5); }, { once: true });
    video.addEventListener('playing', () => video.classList.add('is-on'), { once: true });
    look.append(video);
  }
  const play = () => {
    if (!video) return;
    if (state.inView && !document.hidden && state.p < 1) { if (video.paused) video.play().catch(() => {}); } else if (!video.paused) video.pause();
  };
  new IntersectionObserver(([e]) => { state.inView = e.isIntersecting; play(); }).observe(root);
  document.addEventListener('visibilitychange', play);
  let lastTc = '';
  const timecode = () => {
    const t = video ? video.currentTime : 0;
    const f = Math.floor(t * FPS);
    const s = Math.floor(f / FPS);
    const two = (n) => String(n).padStart(2, '0');
    const out = `TC ${two(Math.floor(s / 3600))}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}:${two(f % FPS)}`;
    if (out !== lastTc) { lastTc = out; tc.textContent = out; }
  };
  timecode();

  // ---------- el destello 3D (three + el GLB, compartidos con el recorrido: js/star-core.js) ----------
  let interacted = false;
  const star = import('./hero-star.js')
    .then((m) => m.createHeroStar({ gsap, stage, video, state, loop, reduced, onInteract: () => { interacted = true; hideHint(); } }))
    .catch(() => null);
  const hideHint = () => gsap.to(hint, { opacity: 0, duration: 0.3, overwrite: true });

  if (still) {
    // movimiento reducido: todo puesto, el destello quieto de frente
    star.then((s) => s?.enter());
    return { state, star };
  }

  // ---------- entrada: flash, destello, letras (más desde los extremos) y después texto y botones ----------
  gsap.set(letters, { y: (i) => ENTER.y * (1 - ENTER.edge + ENTER.edge * Math.abs(dir[i])), opacity: 0 });
  gsap.set(after, { opacity: 0, y: 14 });
  const fonts = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
  Promise.all([arrived, fonts]).then(() => {
    fit();
    gsap.fromTo(flash, { opacity: 0 }, { keyframes: { opacity: [0, 0.85, 0] }, duration: ENTER.flash, ease: 'none' });
    star.then((s) => s?.enter());
    gsap.timeline({ onComplete: () => { state.entered = true; } })
      .to(letters, { y: 0, opacity: 1, duration: ENTER.duration, ease: 'expo.out', stagger: { each: ENTER.stagger, from: 'edges' } }, 0.08)
      .to(after, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, ENTER.after);
    // la pista, solo en escritorio y si no se ha tocado el destello
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      setTimeout(() => star.then((s) => { if (s && !interacted && state.p < 0.05) gsap.to(hint, { opacity: 0.7, duration: 0.6 }); }), HINT);
    }
  });

  // ---------- de dónde sale el parallax: el ratón ----------
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    state.tx = clamp((e.clientX / innerWidth) * 2 - 1);
    state.ty = clamp((e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });

  // ---------- salida: progreso del sticky (0 → 1) ----------
  ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: (self) => { state.pt = self.progress; } });

  const seg = (p, [a, b]) => Math.max(0, Math.min(1, (p - a) / (b - a)));
  const setX = letters.map((l) => gsap.quickSetter(l, 'x', 'px'));
  let lastP = -1;
  let grainT = 0;
  loop.add((time, ratio) => {
    if (!state.inView || document.hidden) return;
    const dt = ratio / 60;
    state.p += (state.pt - state.p) * (1 - Math.exp(-EXIT.lerp * dt));
    if (Math.abs(state.pt - state.p) < 1e-4) state.p = state.pt;
    const a = 1 - Math.pow(1 - PARALLAX.lerp, ratio);
    state.mx += (state.tx - state.mx) * a;
    state.my += (state.ty - state.my) * a;
    play();
    if (state.p >= 1) return; // el escenario ya se ha ido con el scroll
    media.style.transform = `translate3d(${(-state.mx * PARALLAX.x).toFixed(2)}px, ${(-state.my * PARALLAX.y).toFixed(2)}px, 0)`;
    timecode();
    if (time - grainT >= 1 / GRAIN.fps) { grainT = time; paintGrain(); }
    if (Math.abs(state.p - lastP) < 1e-4) return;
    lastP = state.p;
    const p = state.p;
    const ui = seg(p, EXIT.ui);
    after.forEach((el) => { el.style.opacity = state.entered ? (1 - ui).toFixed(3) : el.style.opacity; el.style.translate = `0 ${(-24 * ui).toFixed(1)}px`; });
    const open = seg(p, EXIT.open);
    const e = open * open * (3 - 2 * open);
    const w = stage.clientWidth;
    setX.forEach((set, i) => set(dir[i] * EXIT.spread * w * e));
    title.style.opacity = (1 - seg(p, EXIT.fade)).toFixed(3);
    look.style.setProperty('--ph-zoom', (EXIT.zoom[0] + (EXIT.zoom[1] - EXIT.zoom[0]) * p).toFixed(4));
    look.style.setProperty('--ph-blur', `${(EXIT.blur * p).toFixed(2)}px`);
    look.style.setProperty('--ph-bright', (EXIT.bright[0] + (EXIT.bright[1] - EXIT.bright[0]) * p).toFixed(3));
    if (p > 0.05 && hint.style.opacity !== '0') hideHint();
  });
  return { state, star };
}
