import { config } from './config.js';

// Hero de las páginas interiores (Servicios, Portfolio, Nosotros, Contacto; css/page-hero.css). Cada página solo
// declara su contenido en <section class="pgh" data-page-hero="clave"> (título, texto, botones y una línea de meta);
// el vídeo de cada una está en js/config.js → pageHeroes. Una sección normal: el scroll no la cambia (sube con la
// página). Aquí: el vídeo (1280 en < 900 px o con ahorro de datos) con su timecode real, el grano, el parallax con
// el ratón y la entrada (flash, destello, letras, texto). El destello 3D (js/hero-star.js) se carga aparte: sin
// WebGL el hero funciona igual. Todo en el loop único (gsap.ticker) y solo con el hero en pantalla (fuera de ella,
// el vídeo se pausa). Otro módulo puede parar el vídeo con el evento "disco:hero-hold" (detail: true / false).
const PARALLAX = { x: 18, y: 12, lerp: 0.06 };   // px: el vídeo, al revés que el cursor
const ENTER = { flash: 0.56, y: 60, edge: 0.8, duration: 1.1, stagger: 0.035, after: 0.75 };
const GRAIN = { w: 240, h: 140, fps: 12 };
const HINT = 3000;                               // ms sin tocar el destello: aparece "Arrastra el destello"
const NARROW = '(max-width: 899px)';

export function initPageHero({ gsap, lenis, loop, reduced, arrived }) {
  const root = document.querySelector('[data-page-hero]');
  if (!root) return null;
  const still = reduced.matches;
  const cfg = config.pageHeroes?.[root.dataset.pageHero] || {};
  const fps = cfg.fps || 25;
  const stage = root.querySelector('.pgh__stage');
  const look = root.querySelector('.pgh__look');
  const media = root.querySelector('.pgh__media');
  const title = root.querySelector('.pgh__title');
  const foot = root.querySelector('.pgh__foot');
  const after = [...root.querySelectorAll('[data-ph-after]')];
  const tc = root.querySelector('[data-ph-tc]');
  if (cfg.pos) root.style.setProperty('--ph-pos', cfg.pos);

  // estado que lee el destello: cursor (-1..1), en pantalla, entrada hecha
  const state = { mx: 0, my: 0, tx: 0, ty: 0, inView: true, entered: false, held: false };

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
    const room = stage.clientWidth - 2 * (parseFloat(getComputedStyle(foot).left) || 20);
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
  foot.before(grain);
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

  // ---------- vídeo (con movimiento reducido, solo el póster). Solo los metadatos hasta que hace falta ----------
  let video = null;
  if (!still && cfg.video) {
    const conn = navigator.connection || {};
    const small = matchMedia(NARROW).matches || conn.saveData || /2g|3g/.test(conn.effectiveType || '');
    video = document.createElement('video');
    Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'metadata' });
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
  // en bucle mientras el hero se ve (y nadie lo ha parado); fuera de pantalla o con la pestaña oculta, en pausa
  const play = () => {
    if (!video) return;
    if (state.inView && !document.hidden && !state.held) { if (video.paused) video.play().catch(() => {}); } else if (!video.paused) video.pause();
  };
  new IntersectionObserver(([e]) => { state.inView = e.isIntersecting; play(); }).observe(root);
  document.addEventListener('visibilitychange', play);
  document.addEventListener('disco:hero-hold', (e) => { state.held = !!e.detail; play(); });
  let lastTc = '';
  const timecode = () => {
    const t = video ? video.currentTime : 0;
    const f = Math.floor(t * fps);
    const s = Math.floor(f / fps);
    const two = (n) => String(n).padStart(2, '0');
    const out = `TC ${two(Math.floor(s / 3600))}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}:${two(f % fps)}`;
    if (out !== lastTc) { lastTc = out; tc.textContent = out; }
  };
  timecode();

  // ---------- el destello 3D (three + el GLB, compartidos con el recorrido: js/star-core.js) ----------
  let interacted = false;
  const hideHint = () => gsap.to(hint, { opacity: 0, duration: 0.3, overwrite: true });
  const star = import('./hero-star.js')
    .then((m) => m.createHeroStar({ gsap, stage, video, state, loop, reduced, onInteract: () => { interacted = true; hideHint(); } }))
    .catch(() => null);

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
      setTimeout(() => star.then((s) => { if (s && !interacted && state.inView) gsap.to(hint, { opacity: 0.7, duration: 0.6 }); }), HINT);
    }
  });

  // ---------- parallax suave del vídeo con el ratón ----------
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    state.tx = clamp((e.clientX / innerWidth) * 2 - 1);
    state.ty = clamp((e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });

  let grainT = 0;
  loop.add((time, ratio) => {
    if (!state.inView || document.hidden) return;
    const a = 1 - Math.pow(1 - PARALLAX.lerp, ratio);
    state.mx += (state.tx - state.mx) * a;
    state.my += (state.ty - state.my) * a;
    media.style.transform = `translate3d(${(-state.mx * PARALLAX.x).toFixed(2)}px, ${(-state.my * PARALLAX.y).toFixed(2)}px, 0)`;
    timecode();
    if (time - grainT >= 1 / GRAIN.fps) { grainT = time; paintGrain(); }
  });
  return { state, star, video };
}
