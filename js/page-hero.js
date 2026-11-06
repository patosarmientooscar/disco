import { config } from './config.js';
import { gpuOK, afterLoad } from './gpu.js';

// Hero de las páginas interiores (Servicios, Portfolio, Nosotros, Contacto; css/page-hero.css). Cada página solo
// declara su contenido en <section class="pgh" data-page-hero="clave"> (la etiqueta de la página, que es su h1; el
// titular; botones y una línea de meta); el vídeo de cada una está en js/config.js → pageHeroes. Una sección normal,
// sin pin. Aquí: el vídeo (1280 en < 900 px, con ahorro de datos o en 2g/3g) limpio, con su timecode real, el parallax con
// el ratón y la entrada (flash, destello, la estrellita de la etiqueta girando y el titular línea a línea). El
// destello 3D (js/hero-star.js, protagonista en el centro; al bajar, sale en diagonal) se carga aparte: sin WebGL
// el hero funciona igual. Todo en el loop único (gsap.ticker) y solo con el hero en pantalla (fuera de ella,
// el vídeo se pausa). Otro módulo puede parar el vídeo con el evento "disco:hero-hold" (detail: true / false).
const PARALLAX = { x: 18, y: 12, lerp: 0.06 };   // px: el vídeo, al revés que el cursor
const ENTER = { flash: 0.56, tag: 0.15, head: 0.3, duration: 1.1, stagger: 0.08, after: 0.35 }; // after: subtítulo, botones y meta (antes .75)
const READY_MS = 3000;                           // el vídeo arranca con canplaythrough o a los 3 s (lo primero)
const HINT = 3000;                               // ms sin tocar el destello: aparece "Arrastra el destello"
const NARROW = '(max-width: 899px)';
// pantalla en vertical (la versión vertical del vídeo del hero, si la hay)
export const portraitView = () => matchMedia('(orientation: portrait)').matches || innerHeight / innerWidth > 1.1;

export function initPageHero({ gsap, ScrollTrigger, lenis, loop, reduced, arrived }) {
  const root = document.querySelector('[data-page-hero]');
  if (!root) return null;
  const still = reduced.matches;
  const cfg = config.pageHeroes?.[root.dataset.pageHero] || {};
  const fps = cfg.fps || 25;
  const stage = root.querySelector('.pgh__stage');
  const look = root.querySelector('.pgh__look');
  const media = root.querySelector('.pgh__media');
  const tag = root.querySelector('.pgh__tag');
  const tagStar = tag.querySelector('.pgh__tag-star');
  const head = root.querySelector('[data-ph-head]');
  const after = [...root.querySelectorAll('[data-ph-after]')];
  const tc = root.querySelector('[data-ph-tc]');
  if (cfg.pos) root.style.setProperty('--ph-pos', cfg.pos);

  // estado que lee el destello: cursor (-1..1), en pantalla, entrada hecha
  const state = { mx: 0, my: 0, tx: 0, ty: 0, inView: true, entered: false, held: false };

  // ---------- titular: en líneas (cada una en su máscara, para subir línea a línea) ----------
  const headText = head.textContent.replace(/\s+/g, ' ').trim();
  let lines = [];
  let headW = 0;
  const split = () => {
    headW = head.clientWidth;
    head.innerHTML = headText.split(' ').map((w) => `<span class="pgh__w">${w}</span>`).join(' ');
    const rows = [];
    head.querySelectorAll('.pgh__w').forEach((w) => {
      const last = rows[rows.length - 1];
      if (last && Math.abs(last.top - w.offsetTop) < 4) last.words.push(w.textContent);
      else rows.push({ top: w.offsetTop, words: [w.textContent] });
    });
    head.innerHTML = rows.map((r) => `<span class="pgh__line"><span class="pgh__line-in">${r.words.join(' ')}</span></span>`).join('');
    head.classList.add('is-split');
    lines = [...head.querySelectorAll('.pgh__line-in')];
  };
  split();
  let entering = !still;
  const resplit = () => { if (!entering && head.clientWidth !== headW) split(); };
  if (document.fonts) document.fonts.ready.then(() => { if (!entering) split(); });
  window.addEventListener('resize', resplit);

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

  // flash de la entrada y pista del destello
  const flash = document.createElement('i');
  flash.className = 'pgh__flash';
  flash.setAttribute('aria-hidden', 'true');
  stage.append(flash);
  const hint = document.createElement('p');
  hint.className = 'pgh__hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.textContent = 'Arrastra el destello';
  if (cfg.star !== false) stage.append(hint);

  // ---------- vídeo (con movimiento reducido, solo el póster; salvo con always, abajo). El póster se ve al instante; el vídeo pide solo los
  // metadatos y, ya cargada la página, se pone a cargar; arranca cuando puede reproducir sin cortes
  // (canplaythrough o 3 s) con un fundido de 0.4 s desde el póster (css). La fuente, por ancho y por conexión ----------
  // (con versión vertical, portfolio: en pantallas en vertical, la vertical; en horizontal, la grande siempre y la
  // pequeña solo con ahorro de datos o conexión lenta, no por ancho. Al girar, cambia sin recargar, desde el mismo
  // punto. root.dataset.heroVersion = land | portrait, y el evento "disco:hero-version" en el hero)
  const conn = navigator.connection || {};
  const slow = conn.saveData || /2g|3g/.test(conn.effectiveType || '');
  const pick = () => {
    if (cfg.videoPortrait && portraitView()) return { v: 'portrait', src: cfg.videoPortrait, poster: cfg.posterPortrait || cfg.poster, pos: cfg.posPortrait || cfg.pos };
    const small = cfg.videoPortrait ? slow : matchMedia(NARROW).matches || slow;
    return { v: 'land', src: small ? cfg.videoSm || cfg.video : cfg.video, poster: cfg.poster, pos: cfg.pos };
  };
  let version = pick();
  root.dataset.heroVersion = version.v;
  if (version.pos) root.style.setProperty('--ph-pos', version.pos);
  // (always, portfolio: el vídeo ES el hero; se pide ya y se reproduce desde el principio, sin esperar a la carga ni
  // a canplaythrough, también con movimiento reducido y durante la intro; solo se pausa fuera de pantalla o con la
  // pestaña oculta)
  let video = null;
  let canPlay = false;
  if ((!still || cfg.always) && cfg.video) {
    const small = matchMedia(NARROW).matches || slow;
    video = document.createElement('video');
    Object.assign(video, { muted: true, loop: true, playsInline: true, preload: cfg.always || (cfg.videoPortrait && !slow) ? 'auto' : 'metadata' });
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    if (cfg.videoPortrait) {
      video.poster = version.poster;
      video.src = version.src;
    } else {
      if (cfg.poster) video.poster = cfg.poster;
      video.src = small ? cfg.videoSm || cfg.video : cfg.video;
    }
    const start = cfg.start || 0;
    if (start) video.addEventListener('loadedmetadata', () => { video.currentTime = start % (video.duration || 5); }, { once: true });
    video.addEventListener('playing', () => video.classList.add('is-on'), { once: true });
    look.append(video);
    const go = () => { if (canPlay) return; canPlay = true; play(); };
    video.addEventListener('canplaythrough', go, { once: true });
    // a cargar de verdad después del load, a la primera interacción o a los 2 s (js/gpu.js): no compite con la carga
    const buffer = () => {
      if (!video.isConnected) return;
      if (!(cfg.videoPortrait && slow)) video.preload = 'auto';
      setTimeout(go, READY_MS);
    };
    afterLoad().then(buffer);
  }
  if (cfg.videoPortrait) {
    window.addEventListener('resize', () => {
      const next = pick();
      if (next.v === version.v) return;
      version = next;
      root.dataset.heroVersion = next.v;
      if (next.pos) root.style.setProperty('--ph-pos', next.pos);
      if (video) {
        const t = video.currentTime;
        video.poster = next.poster;
        video.src = next.src;
        video.addEventListener('loadedmetadata', () => { video.currentTime = t % (video.duration || 1); }, { once: true });
        play();
      }
      root.dispatchEvent(new CustomEvent('disco:hero-version', { detail: next.v }));
    });
  }
  // en bucle mientras el hero se ve (y nadie lo ha parado); fuera de pantalla o con la pestaña oculta, en pausa
  // (si el navegador no deja reproducir solo, otra vez con el primer gesto)
  const GESTURES = ['pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'];
  const retry = () => { GESTURES.forEach((g) => window.removeEventListener(g, retry)); play(); };
  const play = () => {
    if (!video || !canPlay) return;
    if (state.inView && !document.hidden && !state.held) {
      if (video.paused) video.play().catch(() => { if (cfg.always) GESTURES.forEach((g) => window.addEventListener(g, retry, { passive: true })); });
    } else if (!video.paused) video.pause();
  };
  if (video && cfg.always) { canPlay = true; play(); }
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
  // (portfolio: sin destello, la bola del vídeo es la protagonista: js/portfolio-hero.js)
  // (three y el GLB, EN PARALELO con el resto desde el principio (AR-D: antes, después del load; el GLB va con
  // <link rel="preload"> en el <head>): el destello aparece casi a la vez que la página. Sin GPU de verdad, ni se descargan)
  // (servicios, con "Tres oficios" [data-star-gate]: el del hero viaja hasta el manifiesto y hace el relevo con el del
  // recorrido; su sitio, de js/page-star.js: la misma función para los dos)
  const gate = document.querySelector('[data-star-gate]');
  const handoff = () => (gate ? import('./page-star.js').then((ps) => {
    ScrollTrigger?.addEventListener('refresh', ps.maniMeasure);
    window.addEventListener('resize', ps.maniMeasure);
    return { target: () => ps.maniPose(lenis.scroll), relay: ps.relay, gate };
  }) : Promise.resolve(null));
  const star = cfg.star === false || !gpuOK() ? Promise.resolve(null) : Promise.all([import('./hero-star.js'), handoff()])
    .then(([m, h]) => m.createHeroStar({ gsap, lenis, stage, video, state, loop, reduced, handoff: h, onInteract: () => { interacted = true; hideHint(); } }))
    .catch(() => null);

  if (still) {
    // movimiento reducido: todo puesto, el destello quieto de frente
    star.then((s) => s?.enter());
    return { state, star };
  }

  // ---------- entrada: flash, destello girando hasta quedar de frente, la estrellita de la etiqueta gira 180° y el
  // titular sube línea a línea; después, texto y botones ----------
  gsap.set(tag, { opacity: 0 });
  gsap.set(tagStar, { rotation: -180, scale: 0.6, transformOrigin: '50% 50%' });
  gsap.set(lines, { yPercent: 105 });
  gsap.set(after, { opacity: 0, y: 14 });
  const fonts = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
  Promise.all([arrived, fonts]).then(() => {
    split();
    gsap.set(lines, { yPercent: 105 });
    gsap.fromTo(flash, { opacity: 0 }, { keyframes: { opacity: [0, 0.85, 0] }, duration: ENTER.flash, ease: 'none' });
    star.then((s) => s?.enter());
    gsap.timeline({ onComplete: () => { state.entered = true; entering = false; resplit(); } })
      .to(tag, { opacity: 1, duration: 0.6, ease: 'power2.out' }, ENTER.tag)
      .to(tagStar, { rotation: 0, scale: 1, duration: 1.1, ease: 'expo.out' }, ENTER.tag)
      .to(lines, { yPercent: 0, duration: ENTER.duration, ease: 'expo.out', stagger: ENTER.stagger }, ENTER.head)
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

  loop.add((time, ratio) => {
    if (!state.inView || document.hidden) return;
    const a = 1 - Math.pow(1 - PARALLAX.lerp, ratio);
    state.mx += (state.tx - state.mx) * a;
    state.my += (state.ty - state.my) * a;
    media.style.transform = `translate3d(${(-state.mx * PARALLAX.x).toFixed(2)}px, ${(-state.my * PARALLAX.y).toFixed(2)}px, 0)`;
    timecode();
  });
  return { state, star, video };
}
