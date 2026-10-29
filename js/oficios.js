// Tres oficios (servicios.html, css/servicios.css): tres paneles que se abren, cada uno con su material REAL de disco
// y su escena. Cada panel pinta su material del tamaño del panel abierto, centrado en el panel (al cambiar los
// anchos no se estira: cerrado, se ve su centro). Sin pin: el scroll pasa de largo. Foto abierto por defecto (su
// disparo, la primera vez que la sección entra en pantalla); el ratón abre el panel que mira (con 80 ms de intención)
// y al salir se queda el último; Tab / Enter / flechas; en móvil, tocar. Al cambiar, el que se cierra se congela
// (último fotograma) y el que se abre arranca (anchos: 0.9 s expo.inOut).
//   FOTO, el disparo: obturador (dos láminas que se cierran hasta el centro y se abren en 0.18 s), flash, la foto
//     "congelada" (zoom 1.04 → 1) y el AF que se cierra con rebote sobre una cara (con el ratón: parallax ±10 px y el
//     AF salta a la cara que tengas debajo).
//   VÍDEO, el directo: corte (un fotograma en negro), el baile en el bus (oficios-real/bus.mp4), bandas de cine hasta
//     2.39:1, REC y el timecode real del vídeo. El botón de sonido le quita el silencio al propio vídeo (su audio, a
//     la vez que la imagen); al cerrar el panel, se vuelve a silenciar.
//   EDICIÓN, la sala de montaje: el visor ocupa todo el panel, con el reel de la fiesta y la cortinilla LOG / GRADE que sigue al ratón
//     (con el dedo, se arrastra); debajo, la línea de tiempo: V1 con los 8 clips del reel (al pasar por uno, el visor
//     salta a ese tramo), A1 con la forma de onda real del audio y el cabezal sincronizado con el visor.
// Los vídeos solo corren con su panel abierto y la sección en pantalla. Todo en el loop único (gsap.ticker).
// Movimiento reducido: los tres abiertos, quietos; el vídeo, con un botón para reproducirlo.
// (LEGACY: la bailarina, en legacy/servicios-oficios-bailarina/)
const MEDIA = {
  foto: { w: 2000, h: 1333, fx: 0.42, fy: 0.4 },   // oficios-real/foto.webp: encuadre entre las dos caras de delante
  video: { w: 1280, h: 720, fx: 0.5, fy: 0.45 },   // oficios-real/bus.mp4 (el baile en el bus)
};
// caras de la foto (fracción de la imagen: centro y ancho); la primera, la de la izquierda (donde se cierra el AF)
const FACES = [
  { x: 0.296, y: 0.36, w: 0.11 },
  { x: 0.82, y: 0.31, w: 0.125 },
  { x: 0.125, y: 0.29, w: 0.085 },
  { x: 0.35, y: 0.175, w: 0.07 },
  { x: 0.512, y: 0.3, w: 0.08 },
];
const GROW = { open: 5, openM: 4, closed: 1 };
const OPEN = { dur: 0.9, ease: 'expo.inOut' };
const SHADE = { closed: 0.55, open: 0.15 };
const SHUTTER = { half: 0.09, flash: 0.85, flashDur: 0.22, zoom: 1.04, perSec: 3 };
const PARALLAX = 10;               // px
const SCOPE = { ratio: 2.39, max: 0.25 }; // bandas de cine (en paneles estrechos, cada banda como mucho 1/4 del alto)
const CUT = 1 / 24;                // s: el corte en negro (un fotograma)
const WIPE = { lerp: 0.15, sweep: 1.6 };
const INTENT = 80; // ms con el ratón encima antes de abrir (cruzar la sección de camino a otro sitio no abre nada)
const SRC = {
  video: { desk: 'assets/servicios/oficios-real/bus.mp4', narrow: 'assets/servicios/oficios-real/bus-720.mp4', fps: 25 },
  edit: 'assets/portfolio/cachondeo/reel-fiesta.mp4',
  near: '100% 0px', // los metadatos, con la sección a una pantalla
};
// forma de onda real del audio de reel-fiesta.mp4 (RMS en 120 tramos, 0–100; sacada con ffmpeg)
const WAVE = [0, 0, 0, 23, 0, 24, 0, 22, 10, 0, 26, 7, 24, 0, 21, 14, 0, 25, 8, 26, 7, 19, 18, 0, 26, 5, 24, 12, 22, 17, 10, 27, 8, 25, 14, 20, 19, 2, 28, 12, 24, 14, 16, 75, 27, 74, 27, 64, 42, 19, 74, 21, 68, 25, 62, 47, 20, 73, 21, 70, 28, 50, 62, 27, 70, 25, 69, 27, 22, 72, 21, 73, 24, 67, 30, 22, 71, 21, 71, 23, 69, 39, 30, 72, 51, 50, 40, 44, 44, 37, 52, 40, 47, 40, 40, 42, 32, 48, 100, 63, 58, 47, 44, 38, 52, 39, 45, 42, 39, 45, 39, 49, 37, 42, 38, 34, 44, 95, 38, 16];
const CLIPS = 8;
const MOBILE = '(max-width: 767px)';
const NARROW = '(max-width: 899px)';

export function initOficios({ gsap, loop, still }) {
  const sec = document.querySelector('[data-oficios]');
  if (!sec) return;
  const stage = sec.querySelector('[data-of-stage]');
  const mq = matchMedia(MOBILE);
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const panels = [...stage.querySelectorAll('[data-of-panel]')].map((el) => ({
    el,
    key: el.dataset.ofPanel,
    pic: el.querySelector('[data-of-pic]'),
    inner: el.querySelector('[data-of-in]'),
    shade: el.querySelector('[data-of-shade]'),
    vert: el.querySelector('.of-vert'),
    btn: el.querySelector('[data-of-btn]'),
    rise: el.querySelectorAll('[data-of-rise]'),
    size: 0,
    box: { w: 0, h: 0, cw: 0, ch: 0, ox: 0, oy: 0 },
  }));
  const byKey = (k) => panels.find((p) => p.key === k);
  const w = { 0: 1, 1: 1, 2: 1 }; // flex-grow de cada panel (lo anima gsap)
  const st = { cur: -1, vis: false, seen: false, col: false, W: 0, H: 0, gap: 10, open: 0 };
  const fx = { foto: fotoFx(byKey('foto')), video: videoFx(byKey('video')), edit: editFx(byKey('edit')) };

  // ---------- geometría: cada material, del tamaño del panel abierto (cubriéndolo, encuadrado en su foco) ----------
  function measure() {
    const cs = getComputedStyle(stage);
    st.col = mq.matches;
    st.W = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    st.H = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    st.gap = parseFloat(st.col ? cs.rowGap : cs.columnGap) || 10;
    const big = still ? 1 : st.col ? GROW.openM : GROW.open;
    const L = (st.col ? st.H : st.W) - st.gap * 2;
    st.open = (L * big) / (big + 2);
    // el texto se compone al ancho del panel abierto: no se recoloca mientras el panel crece
    stage.style.setProperty('--of-open', `${(st.col ? st.W : st.open).toFixed(1)}px`);
    panels.forEach((p) => {
      const b = p.box;
      b.w = st.col ? st.W : st.open;
      b.h = st.col ? st.open : st.H;
      p.pic.style.width = `${b.w.toFixed(1)}px`;
      p.pic.style.height = `${b.h.toFixed(1)}px`;
      const m = MEDIA[p.key];
      if (!m || !p.inner) return;
      const s = Math.max(b.w / m.w, b.h / m.h);
      b.cw = m.w * s;
      b.ch = m.h * s;
      b.ox = Math.min(0, Math.max(b.w - b.cw, b.w / 2 - m.fx * b.cw));
      b.oy = Math.min(0, Math.max(b.h - b.ch, b.h / 2 - m.fy * b.ch));
      p.inner.style.width = `${b.cw.toFixed(1)}px`;
      p.inner.style.height = `${b.ch.toFixed(1)}px`;
      p.inner.style.left = `${b.ox.toFixed(1)}px`;
      p.inner.style.top = `${b.oy.toFixed(1)}px`;
    });
    layout();
    panels.forEach((p) => fx[p.key].resize?.(p));
  }
  // los mismos tamaños que reparte flex (flex-basis 0, sin mínimos): cada material, centrado en su panel
  function layout() {
    const L = (st.col ? st.H : st.W) - st.gap * 2;
    const sum = w[0] + w[1] + w[2];
    panels.forEach((p, i) => {
      p.el.style.flexGrow = w[i].toFixed(4);
      p.size = (L * w[i]) / sum;
      const shift = (p.size - (st.col ? p.box.h : p.box.w)) / 2;
      p.pic.style.transform = st.col ? `translate3d(0, ${shift.toFixed(2)}px, 0)` : `translate3d(${shift.toFixed(2)}px, 0, 0)`;
    });
  }
  const weights = (i) => {
    const big = st.col ? GROW.openM : GROW.open;
    const to = {};
    panels.forEach((_, k) => { to[k] = k === i ? big : GROW.closed; });
    return to;
  };

  // ---------- abrir un panel (el anterior se cierra y se congela) ----------
  let grow;
  function setActive(i) {
    if (i === st.cur || i < 0) return;
    const prev = st.cur;
    st.cur = i;
    grow?.kill();
    grow = gsap.to(w, { ...weights(i), duration: OPEN.dur, ease: OPEN.ease, onUpdate: layout });
    if (prev >= 0) close(panels[prev]);
    open(panels[i]);
  }
  function open(p) {
    p.el.classList.add('is-open');
    p.btn.setAttribute('aria-expanded', 'true');
    gsap.to(p.shade, { opacity: SHADE.open, duration: 0.6, ease: 'power2.out', overwrite: true });
    gsap.to(p.vert, { opacity: 0, duration: 0.2, overwrite: true });
    gsap.fromTo(p.rise, { yPercent: 100 }, { yPercent: 0, duration: 0.7, ease: 'expo.out', delay: 0.25, stagger: 0.06, overwrite: true });
    fx[p.key].open();
  }
  function close(p) {
    p.el.classList.remove('is-open');
    p.btn.setAttribute('aria-expanded', 'false');
    gsap.to(p.shade, { opacity: SHADE.closed, duration: 0.5, ease: 'power2.out', overwrite: true });
    gsap.to(p.vert, { opacity: 1, duration: 0.4, delay: 0.35, overwrite: true });
    gsap.to(p.rise, { yPercent: 100, duration: 0.2, ease: 'power2.in', overwrite: true });
    fx[p.key].close();
  }

  // ---------- FOTO: el disparo ----------
  function fotoFx(p) {
    const blades = p.el.querySelectorAll('[data-of-blade]');
    const flash = p.el.querySelector('[data-of-flash]');
    const af = p.el.querySelector('[data-of-af]');
    const shots = [];
    const s = { face: 0, on: false };
    // el parallax mueve la foto con sus escuadras (el zoom del disparo, en la misma capa, lo compone gsap)
    const px = gsap.quickTo(p.inner, 'x', { duration: 0.8, ease: 'power2.out' });
    const py = gsap.quickTo(p.inner, 'y', { duration: 0.8, ease: 'power2.out' });
    // las escuadras sobre una cara (con su rebote de enfoque: entra grande, se pasa, rebota y se queda)
    const focusOn = (i, bounce = true) => {
      s.face = i;
      const f = FACES[i];
      const fw = f.w * p.box.cw;
      af.style.setProperty('--af-w', `${fw.toFixed(1)}px`);
      af.classList.toggle('is-left', f.x > 0.6); // la exposición, al lado que tenga sitio
      const x = f.x * p.box.cw - fw / 2;
      const y = f.y * p.box.ch - (fw * 1.25) / 2;
      af.classList.remove('is-locked');
      const tl = gsap.timeline({ overwrite: true });
      if (bounce) {
        tl.set(af, { x, y })
          .fromTo(af, { opacity: 0, scale: 1.7 }, { opacity: 1, scale: 0.9, duration: 0.3, ease: 'power3.out' })
          .to(af, { scale: 1.05, duration: 0.12, ease: 'power1.inOut' })
          .to(af, { scale: 1, duration: 0.16, ease: 'power2.out' });
      } else {
        tl.to(af, { x, y, opacity: 1, scale: 1, duration: 0.45, ease: 'expo.out' })
          .to(af, { scale: 0.92, duration: 0.1, ease: 'power1.inOut' })
          .to(af, { scale: 1, duration: 0.16, ease: 'power2.out' });
      }
      tl.add(() => af.classList.add('is-locked'));
    };
    return {
      s,
      open() {
        s.on = true;
        const now = performance.now();
        while (shots.length && now - shots[0] > 1000) shots.shift();
        if (shots.length < SHUTTER.perSec) {
          shots.push(now);
          // las láminas se cierran hasta el centro y se abren; al abrir, flash y la foto congelada (zoom 1.04 → 1)
          gsap.timeline({ overwrite: true })
            .set(blades, { scaleY: 0 })
            .to(blades, { scaleY: 1, duration: SHUTTER.half, ease: 'power2.in' })
            .to(blades, { scaleY: 0, duration: SHUTTER.half, ease: 'power2.out' })
            .fromTo(flash, { opacity: SHUTTER.flash }, { opacity: 0, duration: SHUTTER.flashDur, ease: 'power2.out' }, SHUTTER.half)
            .fromTo(p.inner, { scale: SHUTTER.zoom }, { scale: 1, duration: 0.9, ease: 'expo.out' }, SHUTTER.half);
        }
        gsap.delayedCall(0.25, () => { if (s.on) focusOn(0); });
      },
      close() {
        s.on = false;
        gsap.to(af, { opacity: 0, duration: 0.2, overwrite: true });
        af.classList.remove('is-locked');
        px(0);
        py(0);
      },
      resize() { if (s.on && +getComputedStyle(af).opacity > 0) focusOn(s.face, false); },
      still() { focusOn(0); },
      // con el ratón encima: parallax y el AF a la cara que hay debajo
      point(e) {
        if (!s.on) return;
        const r = p.el.getBoundingClientRect();
        px(-((e.clientX - r.left) / r.width - 0.5) * 2 * PARALLAX);
        py(-((e.clientY - r.top) / r.height - 0.5) * 2 * PARALLAX);
        const ir = p.inner.getBoundingClientRect();
        const u = (e.clientX - ir.left) / ir.width;
        const v = (e.clientY - ir.top) / ir.height;
        const hit = FACES.findIndex((f) => Math.abs(u - f.x) < f.w * 0.65 && Math.abs(v - f.y) < f.w * 0.9 * (ir.width / ir.height));
        if (hit >= 0 && hit !== s.face) focusOn(hit, false);
      },
      leave() { px(0); py(0); if (s.on && s.face !== 0) focusOn(0, false); },
    };
  }

  // ---------- VÍDEO: el directo ----------
  function videoFx(p) {
    const v = p.el.querySelector('[data-of-video]');
    const cut = p.el.querySelector('[data-of-cut]');
    const tcEl = p.el.querySelector('[data-of-tc]');
    const btn = p.el.querySelector('[data-of-sound]');
    const bars = p.el.querySelectorAll('[data-of-bar]');
    const s = { on: false, loaded: false, tc: '', loud: false };
    const size = () => {
      const pw = st.col ? st.W : st.open;
      const ph = st.col ? st.open : st.H;
      const bh = Math.min(ph * SCOPE.max, Math.max(0, (ph - pw / SCOPE.ratio) / 2));
      bars.forEach((b) => { b.style.height = `${bh.toFixed(1)}px`; });
    };
    const load = () => {
      if (s.loaded) return;
      s.loaded = true;
      v.preload = 'metadata';
      v.src = matchMedia(NARROW).matches ? SRC.video.narrow : SRC.video.desk;
    };
    const run = () => { if (s.on && st.vis && !document.hidden) v.play().catch(() => {}); else v.pause(); };
    // el sonido: el del propio vídeo (solo con el panel abierto y en pantalla: el vídeo se para con ellos)
    const sound = (on) => {
      s.loud = on;
      btn.setAttribute('aria-pressed', String(on));
      v.muted = !on;
      if (on) { load(); v.play().catch(() => { v.muted = true; s.loud = false; btn.setAttribute('aria-pressed', 'false'); }); }
    };
    btn.addEventListener('click', () => sound(!s.loud));
    return {
      load,
      resize: size,
      open() {
        s.on = true;
        load();
        size();
        // el corte: un fotograma en negro y entra el vídeo
        gsap.timeline({ overwrite: true }).set(cut, { opacity: 1 }).set(cut, { opacity: 0 }, CUT);
        gsap.fromTo(bars, { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: 'expo.out', delay: 0.15, overwrite: true });
        run();
      },
      close() {
        s.on = false;
        gsap.to(bars, { scaleY: 0, duration: 0.25, ease: 'power2.in', overwrite: true });
        v.pause(); // se queda congelado en ese fotograma
        if (s.loud) sound(false);
      },
      visible: run,
      still() { size(); gsap.set(bars, { scaleY: 1 }); },
      // movimiento reducido: no se reproduce solo; un botón
      button() {
        const b = p.el.querySelector('[data-of-play]');
        b.hidden = false;
        b.addEventListener('click', () => {
          load();
          if (v.paused) { v.play().catch(() => {}); b.textContent = '❚❚ Pausar'; } else { v.pause(); b.textContent = '▶ Reproducir'; }
        });
      },
      // timecode real del vídeo (30 fps)
      tick() {
        if (!s.on) return;
        const fps = SRC.video.fps;
        const f = Math.floor(v.currentTime * fps);
        const pad = (n) => String(n).padStart(2, '0');
        const sec = Math.floor(f / fps);
        const tc = `00:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}:${pad(f % fps)}`;
        if (tc !== s.tc) { s.tc = tc; tcEl.textContent = tc; }
      },
    };
  }

  // ---------- EDICIÓN: la sala de montaje ----------
  function editFx(p) {
    const suite = p.el.querySelector('[data-of-suite]');
    const viewer = p.el.querySelector('[data-of-viewer]');
    const v = p.el.querySelector('[data-of-edit]');
    const clipsEl = p.el.querySelector('[data-of-clips]');
    const clips = [...clipsEl.children];
    const wave = p.el.querySelector('[data-of-wave]');
    const head = p.el.querySelector('[data-of-head]');
    const s = { on: false, loaded: false, x: 0.5, tx: 0.5, user: false, drag: false, sweep: null, px: '', hx: '', clip: -1, hover: -1 };
    const load = () => {
      if (s.loaded) return;
      s.loaded = true;
      v.preload = 'metadata';
      v.src = SRC.edit;
    };
    const run = () => { if (s.on && st.vis && !document.hidden) v.play().catch(() => {}); else v.pause(); };
    // el visor ocupa todo el panel; la línea de tiempo, abajo a lo ancho, y el texto encima de ella (--of-tlh)
    const size = () => {
      p.el.style.setProperty('--of-tlh', `${suite.querySelector('[data-of-tl]').offsetHeight.toFixed(0)}px`);
      // forma de onda: barras de 2 px (una cada 4 px) sacadas de WAVE
      const dpr = Math.min(2, devicePixelRatio || 1);
      const cw = wave.clientWidth;
      const ch = wave.clientHeight;
      if (!cw) return;
      wave.width = Math.round(cw * dpr);
      wave.height = Math.round(ch * dpr);
      const c = wave.getContext('2d');
      c.scale(dpr, dpr);
      c.fillStyle = '#F35411';
      const n = Math.floor(cw / 4);
      for (let i = 0; i < n; i++) {
        const a = WAVE[Math.min(WAVE.length - 1, Math.floor((i / n) * WAVE.length))] / 100;
        const h = Math.max(2, a * ch);
        c.fillRect(i * 4, (ch - h) / 2, 2, h);
      }
    };
    const seek = (i) => {
      if (!v.duration || i === s.hover) return;
      s.hover = i;
      v.currentTime = (i / CLIPS) * v.duration + 0.05;
    };
    const point = (clientX) => {
      const r = viewer.getBoundingClientRect();
      s.user = true;
      s.sweep?.kill();
      s.tx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    };
    // ratón: la cortinilla sigue al cursor sobre el visor; los clips, al pasar, llevan el visor a su tramo
    viewer.addEventListener('pointermove', (e) => { if (s.on && (e.pointerType === 'mouse' || s.drag)) point(e.clientX); });
    viewer.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' && s.on) { s.drag = true; point(e.clientX); } });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => viewer.addEventListener(t, () => { s.drag = false; }));
    clips.forEach((li, i) => {
      li.addEventListener('pointerenter', (e) => { if (s.on && e.pointerType === 'mouse') seek(i); });
      li.addEventListener('pointerdown', () => { if (s.on) { s.hover = -1; seek(i); } });
    });
    clipsEl.addEventListener('pointerleave', () => { s.hover = -1; });
    return {
      s,
      load,
      resize: size,
      open() {
        s.on = true;
        load();
        size();
        run();
        // sin ratón encima, la cortinilla barre sola una vez y se queda a la mitad
        s.user = false;
        s.sweep?.kill();
        s.x = 0.04;
        s.sweep = gsap.timeline({ delay: 0.35 })
          .fromTo(s, { tx: 0.04 }, { tx: 0.96, duration: WIPE.sweep * 0.65, ease: 'power2.inOut' })
          .to(s, { tx: 0.5, duration: WIPE.sweep * 0.35, ease: 'power2.inOut' });
      },
      close() {
        s.on = false;
        s.sweep?.kill();
        v.pause(); // congelado
      },
      visible: run,
      still() { size(); s.x = s.tx = 0.5; viewer.style.setProperty('--x', '50%'); },
      tick(ratio) {
        if (!s.on) return;
        const a = 1 - Math.pow(1 - WIPE.lerp, ratio);
        s.x += (s.tx - s.x) * (s.user ? a : 1);
        const px = `${(s.x * 100).toFixed(2)}%`;
        if (px !== s.px) { s.px = px; viewer.style.setProperty('--x', px); }
        // el cabezal, con el vídeo del visor; el clip que pasa, marcado
        const f = v.duration ? v.currentTime / v.duration : 0;
        const hx = `${(f * clipsEl.clientWidth).toFixed(1)}px`;
        if (hx !== s.hx) { s.hx = hx; head.style.transform = `translate3d(${hx}, 0, 0)`; }
        const c = Math.min(CLIPS - 1, Math.floor(f * CLIPS));
        if (c !== s.clip) { clips[s.clip]?.classList.remove('is-on'); clips[c].classList.add('is-on'); s.clip = c; }
      },
    };
  }

  // ---------- montaje ----------
  measure();
  panels.forEach((p) => {
    gsap.set(p.shade, { opacity: still ? SHADE.open : SHADE.closed });
    gsap.set(p.rise, { yPercent: still ? 0 : 100 });
  });
  if (document.fonts) document.fonts.ready.then(measure);
  let raf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); });

  // con la sección a una pantalla: la foto y los metadatos de los dos vídeos
  const near = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    near.disconnect();
    const img = stage.querySelector('.of-img');
    img.loading = 'eager';
    img.decode?.().catch(() => {});
    if (!still) { fx.video.load(); fx.edit.load(); }
  }, { rootMargin: SRC.near });
  near.observe(sec);

  // movimiento reducido: los tres abiertos a la vez, cada uno con su texto; el vídeo, con su botón
  if (still) {
    sec.classList.add('is-still');
    panels.forEach((p) => {
      p.el.classList.add('is-open');
      p.btn.setAttribute('aria-expanded', 'true');
      gsap.set(p.vert, { opacity: 0 });
      fx[p.key].still();
    });
    fx.edit.load();
    fx.video.button();
    return;
  }

  // Foto abierto por defecto (su disparo, la primera vez que la sección entra en pantalla)
  st.cur = 0;
  Object.assign(w, weights(0));
  layout();
  const p0 = panels[0];
  p0.el.classList.add('is-open');
  p0.btn.setAttribute('aria-expanded', 'true');
  gsap.set(p0.shade, { opacity: SHADE.open });
  gsap.set(p0.vert, { opacity: 0 });

  // en pantalla: solo entonces corren los vídeos y el loop; también se paran con la pestaña oculta
  const visible = () => { fx.video.visible(); fx.edit.visible(); };
  const onScreen = new IntersectionObserver((es) => {
    const e = es[es.length - 1];
    st.vis = e.isIntersecting;
    if (st.vis && !st.seen && e.intersectionRatio >= 0.35) {
      st.seen = true;
      if (st.cur === 0) {
        gsap.fromTo(p0.rise, { yPercent: 100 }, { yPercent: 0, duration: 0.7, ease: 'expo.out', delay: 0.15, stagger: 0.06, overwrite: true });
        fx.foto.open();
      }
    }
    visible();
  }, { threshold: [0, 0.35] });
  onScreen.observe(sec);
  document.addEventListener('visibilitychange', visible);

  // al cruzar el corte de móvil, el panel abierto se cierra y se vuelve a abrir con las medidas nuevas
  mq.addEventListener('change', () => {
    const c = st.cur;
    if (c >= 0) { close(panels[c]); st.cur = -1; }
    measure();
    setActive(c >= 0 ? c : 0);
  });

  // ---------- ratón (con intención), teclado y toque ----------
  let intent = 0;
  panels.forEach((p, i) => {
    p.el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !fine.matches || mq.matches) return;
      clearTimeout(intent);
      intent = setTimeout(() => setActive(i), INTENT);
    });
    p.el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') clearTimeout(intent); });
    p.btn.addEventListener('focus', () => { if (p.btn.matches(':focus-visible')) setActive(i); });
    p.btn.addEventListener('click', () => { clearTimeout(intent); setActive(i); });
  });
  // la foto: parallax y AF con el ratón
  const fp = byKey('foto');
  fp.el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') fx.foto.point(e); });
  fp.el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') fx.foto.leave(); });
  // flechas ← → (y ↑ ↓ en móvil, apilados) entre paneles
  stage.addEventListener('keydown', (e) => {
    const i = panels.findIndex((p) => p.btn === document.activeElement);
    if (i < 0) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const n = (i + step + panels.length) % panels.length;
    panels[n].btn.focus();
    setActive(n);
  });

  loop.add((time, ratio) => {
    if (!st.vis) return;
    fx.video.tick();
    fx.edit.tick(ratio);
  });
}
