// Tres oficios (servicios.html, css/servicios.css): tres paneles que se abren, cada uno con su material REAL de disco
// y su escena. Cada panel pinta su material del tamaño del panel abierto, centrado en el panel (al cambiar los
// anchos no se estira: cerrado, se ve su centro). Sin pin: el scroll pasa de largo. Foto abierto por defecto (su
// disparo, la primera vez que la sección entra en pantalla); el ratón abre el panel que mira (con 80 ms de intención)
// y al salir se queda el último; Tab / Enter / flechas; en móvil, tocar. Al cambiar, el que se cierra se congela
// (último fotograma) y el que se abre arranca (anchos: 0.9 s expo.inOut).
//   FOTO, el disparo: obturador (dos láminas que se cierran hasta el centro y se abren en 0.18 s), flash, la foto
//     "congelada" (zoom 1.04 → 1) y el AF que se cierra con rebote sobre una cara (con el ratón: parallax ±10 px y el
//     AF salta a la cara que tengas debajo). BG: una serie de 4 fotos (SERIE): con el panel abierto y en pantalla, cada
//     3,5 s se dispara la siguiente y el corte cae con el obturador cerrado; el contador (01/04) y la exposición cambian
//     con ella. Cerrado, la primera, quieta. Solo se carga la foto siguiente.
//     (LEGACY: la foto sola de antes, en legacy/servicios-oficios-foto-antigua/)
//   VÍDEO, el directo: corte (un fotograma en negro), el baile en el bus (oficios-real/bus.mp4), bandas de cine hasta
//     2.39:1, REC y el timecode real del vídeo. El botón de sonido le quita el silencio al propio vídeo (su audio, a
//     la vez que la imagen); al cerrar el panel, se vuelve a silenciar.
//   EDICIÓN, antes / después (BG): la misma foto sin editar (izquierda) y editada (derecha), con una cortinilla que
//     se arrastra con el ratón o el dedo (sin bloquear el scroll vertical) y con el teclado (slider: ← → Inicio Fin).
//     La primera vez que se abre, la cortinilla barre del 85 % al 50 % para enseñar que se mueve. Las parejas están en
//     js/servicios-data.js (edicionPares); con más de una, abajo, una tira de miniaturas (hoja de contactos) para
//     cambiar de pareja. (LEGACY: la sala de montaje con el reel, en legacy/servicios-oficios-edicion-reel/)
// Los vídeos solo corren con su panel abierto y la sección en pantalla. Todo en el loop único (gsap.ticker).
// Movimiento reducido: los tres abiertos, quietos (la serie de Foto pasa con un corte cada 6 s); el vídeo, con un botón.
// (LEGACY: la bailarina, en legacy/servicios-oficios-bailarina/)
const MEDIA = {
  foto: { w: 2400, h: 1800, fx: 0.5, fy: 0.4 },    // oficios-real/foto-serie/ (todas 4:3): encuadre algo por encima del centro
  video: { w: 1280, h: 720, fx: 0.5, fy: 0.45 },   // oficios-real/bus.mp4 (el baile en el bus)
};
// BG: la serie del panel Foto, en el orden del HTML (img[data-of-shot]). Por foto: las caras (fracción de la imagen:
// centro y ancho; en la primera se cierra el AF, las demás se enfocan al pasar el ratón) y su exposición (creíble: de
// noche, ISO alto). Si se cambia una foto, se ajustan aquí sus caras mirando una captura.
const SERIE = [
  { exif: '1/125 · f/2.8 · ISO 3200', faces: [{ x: 0.37, y: 0.35, w: 0.17 }, { x: 0.525, y: 0.38, w: 0.12 }, { x: 0.755, y: 0.32, w: 0.09 }] }, // Cachondeo Group: el del micro
  { exif: '1/60 · f/1.8 · ISO 6400', faces: [{ x: 0.585, y: 0.4, w: 0.2 }] },                                    // E, S, B: la barra con neones
  { exif: '1/1000 · f/4 · ISO 100', faces: [{ x: 0.6, y: 0.43, w: 0.25 }] },                                      // retrato de día, el mar detrás
  { exif: '1/200 · f/8 · ISO 400', faces: [{ x: 0.33, y: 0.33, w: 0.16 }, { x: 0.545, y: 0.3, w: 0.14 }] },      // editorial con flash, B/N
];
const SHOT = { every: 3.5, still: 6 }; // s entre foto y foto (con movimiento reducido: un corte, cada 6 s)
const GROW = { open: 5, openM: 4, closed: 1 };
const OPEN = { dur: 0.9, ease: 'expo.inOut' };
const SHADE = { closed: 0.55, open: 0.15 };
const SHUTTER = { half: 0.09, flash: 0.85, flashDur: 0.22, zoom: 1.04, perSec: 3 };
const PARALLAX = 10;               // px
const SCOPE = { ratio: 2.39, max: 0.25 }; // bandas de cine (en paneles estrechos, cada banda como mucho 1/4 del alto)
const CUT = 1 / 24;                // s: el corte en negro (un fotograma)
// la cortinilla: de dónde sale el barrido de entrada (una vez), su duración, y el paso de las flechas (Mayús: x4)
const WIPE = { from: 0.85, sweep: 1.1, step: 0.05 };
const INTENT = 80; // ms con el ratón encima antes de abrir (cruzar la sección de camino a otro sitio no abre nada)
const SRC = {
  video: { desk: 'assets/servicios/oficios-real/bus.mp4', narrow: 'assets/servicios/oficios-real/bus-720.mp4', fps: 25 },
  near: '100% 0px', // los metadatos, con la sección a una pantalla
};
const MOBILE = '(max-width: 767px)';
const NARROW = '(max-width: 899px)';

import { edicionPares } from './servicios-data.js';

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

  // ---------- FOTO: el disparo (BG: una serie de 4; cada ~3,5 s se dispara la siguiente, con el corte en el obturador) ----------
  function fotoFx(p) {
    const blades = p.el.querySelectorAll('[data-of-blade]');
    const flash = p.el.querySelector('[data-of-flash]');
    const af = p.el.querySelector('[data-of-af]');
    const exif = p.el.querySelector('[data-of-exif]');
    const count = p.el.querySelector('[data-of-count]');
    const shots = [...p.el.querySelectorAll('[data-of-shot]')];
    const n = Math.min(shots.length, SERIE.length);
    const shotTimes = [];
    const s = { face: 0, on: false, i: 0, t: 0 };
    const faces = () => SERIE[s.i].faces;
    // las fotos de la serie se cargan de una en una: la que toca y la siguiente (las demás, ni se piden)
    const load = (k) => {
      const img = shots[k % n];
      if (!img || !img.dataset.src) return;
      img.srcset = img.dataset.srcset;
      img.src = img.dataset.src;
      img.loading = 'eager';
      delete img.dataset.src;
      delete img.dataset.srcset;
      img.decode?.().catch(() => {});
    };
    const ready = (img) => img.complete && img.naturalWidth > 0;
    // el corte: la foto k pasa a ser la visible (con su exposición y su número)
    const show = (k) => {
      shots[s.i].classList.remove('is-on');
      shots[s.i].setAttribute('aria-hidden', 'true');
      s.i = k;
      shots[k].classList.add('is-on');
      shots[k].removeAttribute('aria-hidden');
      exif.textContent = SERIE[k].exif;
      count.textContent = String(k + 1).padStart(2, '0');
      load(k + 1);
    };
    // el parallax mueve la foto con sus escuadras (el zoom del disparo, en la misma capa, lo compone gsap)
    const px = gsap.quickTo(p.inner, 'x', { duration: 0.8, ease: 'power2.out' });
    const py = gsap.quickTo(p.inner, 'y', { duration: 0.8, ease: 'power2.out' });
    // las escuadras sobre una cara (con su rebote de enfoque: entra grande, se pasa, rebota y se queda)
    const focusOn = (i, bounce = true) => {
      s.face = i;
      const f = faces()[i];
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
    // el disparo: las láminas se cierran hasta el centro y, cerradas, el corte a la foto k (si hay); al abrir, flash y
    // la foto congelada (zoom 1.04 → 1); luego el AF se cierra sobre su primera cara
    const shoot = (k) => {
      const now = performance.now();
      while (shotTimes.length && now - shotTimes[0] > 1000) shotTimes.shift();
      const fire = shotTimes.length < SHUTTER.perSec; // (como mucho 3 disparos por segundo)
      gsap.to(af, { opacity: 0, duration: 0.08, overwrite: true });
      af.classList.remove('is-locked');
      if (!fire) { if (k !== s.i) show(k); } else shotTimes.push(now);
      if (fire) gsap.timeline({ overwrite: true })
        .set(blades, { scaleY: 0 })
        .to(blades, { scaleY: 1, duration: SHUTTER.half, ease: 'power2.in' })
        .add(() => { if (k !== s.i) show(k); })
        .to(blades, { scaleY: 0, duration: SHUTTER.half, ease: 'power2.out' })
        .fromTo(flash, { opacity: SHUTTER.flash }, { opacity: 0, duration: SHUTTER.flashDur, ease: 'power2.out' }, SHUTTER.half)
        .fromTo(p.inner, { scale: SHUTTER.zoom }, { scale: 1, duration: 0.9, ease: 'expo.out' }, SHUTTER.half);
      gsap.delayedCall(0.25, () => { if (s.on || still) focusOn(0); });
    };
    // la siguiente de la serie (si aún no ha llegado, se espera: el contador no se adelanta a una foto sin cargar)
    const next = () => {
      const k = (s.i + 1) % n;
      load(k);
      if (!ready(shots[k])) return false;
      if (still) {
        // movimiento reducido: un corte simple, sin obturador ni flash; el AF, quieto en su cara
        show(k);
        focusOn(0, false);
      } else shoot(k);
      return true;
    };
    return {
      s,
      load: () => load(1),
      open() {
        s.on = true;
        s.t = 0;
        // la sesión empieza siempre por la primera: el disparo de entrada la "hace"
        shoot(0);
      },
      close() {
        s.on = false;
        gsap.to(af, { opacity: 0, duration: 0.2, overwrite: true });
        af.classList.remove('is-locked');
        px(0);
        py(0);
        // cerrado se ve la primera, quieta (entra fundida mientras el panel se oscurece y se estrecha)
        if (s.i !== 0) {
          const from = shots[s.i];
          show(0);
          from.classList.add('is-leaving');
          gsap.fromTo(shots[0], { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out', clearProps: 'opacity', onComplete: () => from.classList.remove('is-leaving') });
        }
      },
      resize() { if ((s.on || still) && +getComputedStyle(af).opacity > 0) focusOn(s.face, false); },
      still() { focusOn(0); },
      // el reloj de la serie: solo corre con el panel abierto y la sección en pantalla (lo llama el loop)
      tick(ratio) {
        if (!(s.on || still) || n < 2) return;
        s.t += ratio / 60;
        if (s.t >= (still ? SHOT.still : SHOT.every) && next()) s.t = 0;
      },
      // con el ratón encima: parallax y el AF a la cara que hay debajo
      point(e) {
        if (!s.on) return;
        const r = p.el.getBoundingClientRect();
        px(-((e.clientX - r.left) / r.width - 0.5) * 2 * PARALLAX);
        py(-((e.clientY - r.top) / r.height - 0.5) * 2 * PARALLAX);
        const ir = p.inner.getBoundingClientRect();
        const u = (e.clientX - ir.left) / ir.width;
        const v = (e.clientY - ir.top) / ir.height;
        const hit = faces().findIndex((f) => Math.abs(u - f.x) < f.w * 0.65 && Math.abs(v - f.y) < f.w * 0.9 * (ir.width / ir.height));
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

  // ---------- EDICIÓN: antes / después (BG) ----------
  function editFx(p) {
    const ba = p.el.querySelector('[data-of-ba]');
    const after = p.el.querySelector('[data-of-after]');
    const beforeImg = p.el.querySelector('[data-of-before-img]');
    const knob = p.el.querySelector('[data-of-knob]');
    const note = p.el.querySelector('[data-of-note]');
    const sheet = p.el.querySelector('[data-of-sheet]');
    const list = p.el.querySelector('[data-of-sheet-list]');
    const pares = (edicionPares || []).filter((q) => q && q.antes && q.despues);
    const s = { on: false, x: WIPE.from, tx: WIPE.from, pair: 0, swept: false, big: false, drag: null, tw: null };
    const narrow = matchMedia(NARROW);
    // la cortinilla: --x en el comparador (lo leen el recorte de "sin editar", la línea, el tirador y las etiquetas)
    const apply = () => {
      ba.style.setProperty('--x', `${(s.x * 100).toFixed(2)}%`);
      const n = Math.round(s.x * 100);
      if (knob.getAttribute('aria-valuenow') !== String(n)) {
        knob.setAttribute('aria-valuenow', String(n));
        knob.setAttribute('aria-valuetext', `${n} % sin editar`);
      }
    };
    const to = (x, dur = 0) => {
      s.tw?.kill();
      x = Math.min(1, Math.max(0, x));
      s.tx = x; // (el teclado cuenta desde aquí, no desde donde va la animación)
      if (dur) s.tw = gsap.to(s, { x, duration: dur, ease: 'power3.out', onUpdate: apply });
      else { s.x = x; apply(); }
    };
    // las fotos de una pareja: la de 1000 px; la grande, solo con el panel abierto en pantallas anchas (cuando las dos
    // han cargado, se cambian a la vez: así nunca se ve una grande junto a una pequeña)
    const srcs = (q, big) => [big ? q.despues : q.despuesSm || q.despues, big ? q.antes : q.antesSm || q.antes];
    const put = ([d, a]) => {
      if (after.getAttribute('src') !== d) after.src = d;
      if (beforeImg.getAttribute('src') !== a) beforeImg.src = a;
    };
    const preload = (urls) => Promise.all(urls.map((u) => { const i = new Image(); i.decoding = 'async'; i.src = u; return i.decode().catch(() => {}); }));
    const show = (k) => {
      const q = pares[k];
      if (!q) return;
      s.pair = k;
      const big = s.big;
      after.alt = `${q.alt}, foto editada`;
      if (q.w && q.h) [after, beforeImg].forEach((i) => { i.width = q.w; i.height = q.h; });
      const pos = q.foco || '';
      after.style.objectPosition = pos;
      beforeImg.style.objectPosition = pos;
      note.textContent = q.nota || '';
      note.hidden = !q.nota;
      [...list.children].forEach((li, i) => li.firstElementChild.setAttribute('aria-pressed', String(i === k)));
      // el cambio, con las dos ya cargadas: un corte limpio
      const u = srcs(q, big);
      preload(u).then(() => { if (s.pair === k) put(u); });
    };
    const goBig = () => {
      if (s.big || narrow.matches || !pares.length) return;
      s.big = true;
      const k = s.pair;
      const u = srcs(pares[k], true);
      preload(u).then(() => { if (s.pair === k) put(u); });
    };
    // la hoja de contactos: solo con más de una pareja (hasta 8 caben en una fila)
    if (pares.length > 1) {
      pares.slice(0, 8).forEach((q, i) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'of-sheet__btn';
        b.setAttribute('aria-label', `Pareja ${i + 1} de ${Math.min(8, pares.length)}: ${q.alt}`);
        b.setAttribute('aria-pressed', String(i === 0));
        b.innerHTML = `<img src="${q.despuesSm || q.despues}" width="${q.w || 2000}" height="${q.h || 1500}" alt="" loading="lazy" decoding="async"><span>${String(i + 1).padStart(2, '0')}</span>`;
        b.addEventListener('click', () => { if (s.pair !== i) show(i); });
        li.append(b);
        list.append(li);
      });
      sheet.hidden = false;
      p.el.classList.add('has-sheet');
    }
    // arrastrar: con el ratón, al pulsar; con el dedo, solo si el gesto es horizontal (el vertical es del scroll:
    // touch-action pan-y, y el navegador manda pointercancel)
    const xAt = (e) => { const r = ba.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
    ba.addEventListener('pointerdown', (e) => {
      if (!s.on || e.button > 0) return;
      s.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, live: e.pointerType === 'mouse' };
      if (s.drag.live) { ba.setPointerCapture(e.pointerId); ba.classList.add('is-drag'); to(xAt(e)); e.preventDefault(); }
    });
    ba.addEventListener('pointermove', (e) => {
      const d = s.drag;
      if (!d || d.id !== e.pointerId) return;
      if (!d.live) {
        const dx = Math.abs(e.clientX - d.x0);
        const dy = Math.abs(e.clientY - d.y0);
        if (dy > 10 && dy > dx) { s.drag = null; return; }
        if (dx < 8 || dx < dy) return;
        d.live = true;
        ba.setPointerCapture(e.pointerId);
        ba.classList.add('is-drag');
      }
      to(xAt(e));
    });
    const end = (e) => {
      if (!s.drag || s.drag.id !== e.pointerId) return;
      s.drag = null;
      ba.classList.remove('is-drag');
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => ba.addEventListener(t, end));
    // teclado (slider): ← → (con Mayús, más), Re Pág / Av Pág, Inicio y Fin
    knob.addEventListener('keydown', (e) => {
      const big = e.shiftKey ? 4 : 1;
      const step = { ArrowLeft: -WIPE.step * big, ArrowDown: -WIPE.step * big, ArrowRight: WIPE.step * big, ArrowUp: WIPE.step * big, PageDown: -0.2, PageUp: 0.2 }[e.key];
      let x = null;
      if (step) x = s.tx + step;
      else if (e.key === 'Home') x = 0;
      else if (e.key === 'End') x = 1;
      if (x === null) return;
      e.preventDefault();
      e.stopPropagation(); // (las flechas del escenario cambian de panel: aquí mueven la cortinilla)
      to(x, still ? 0 : 0.25);
    });
    apply();
    return {
      s,
      load() { [after, beforeImg].forEach((i) => { i.loading = 'eager'; }); if (pares.length) show(0); },
      resize() {
        if (!sheet.hidden) p.el.style.setProperty('--of-tlh', `${sheet.offsetHeight.toFixed(0)}px`);
        if (s.on) goBig();
      },
      open() {
        s.on = true;
        knob.tabIndex = 0;
        goBig();
        this.resize();
        // la primera vez: la cortinilla barre del 85 % a la mitad (enseña que se puede mover)
        if (!s.swept) {
          s.swept = true;
          s.tw?.kill();
          s.x = s.tx = WIPE.from;
          apply();
          s.tx = 0.5;
          s.tw = gsap.to(s, { x: 0.5, duration: WIPE.sweep, ease: 'power3.inOut', delay: 0.45, onUpdate: apply });
        }
      },
      close() {
        s.on = false;
        knob.tabIndex = -1;
        s.drag = null;
        ba.classList.remove('is-drag');
      },
      visible() {},
      still() {
        s.on = true;
        s.swept = true;
        knob.tabIndex = 0;
        to(0.5);
        goBig();
        this.resize();
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
  let raf = null;
  window.addEventListener('resize', () => { raf?.kill(); raf = gsap.delayedCall(0, measure); });

  // con la sección a una pantalla: la primera foto de la serie (y la siguiente, nada más) y los metadatos de los vídeos
  const near = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    near.disconnect();
    const img = stage.querySelector('.of-img');
    img.loading = 'eager';
    img.decode?.().catch(() => {});
    fx.foto.load();
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
    // la serie también pasa sola (un corte cada 6 s), solo con la sección en pantalla
    new IntersectionObserver((es) => { st.vis = es[es.length - 1].isIntersecting; }).observe(sec);
    loop.add((time, ratio) => { if (st.vis && !document.hidden) fx.foto.tick(ratio); });
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
    fx.foto.tick(ratio);
    fx.video.tick();
  });
}
