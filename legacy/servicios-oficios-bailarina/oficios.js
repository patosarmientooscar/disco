// Tres oficios (servicios.html, css/servicios.css): UNA sola foto partida en tres paneles que se abren. La foto está
// anclada al escenario (cada panel la pinta del tamaño del escenario entero, desplazada lo que el panel está
// desplazado): al cambiar los anchos, la foto no se mueve; solo cambian las "ventanas".
// Sin pin: el scroll pasa de largo. Foto abierto por defecto (con su flash la primera vez que la sección entra en
// pantalla); el ratón abre el panel que mira (con 80 ms de intención) y al salir se queda el último; Tab / Enter /
// flechas; en móvil, tocar.
// Foto: flash y AF sobre la cara. Vídeo: la foto cobra vida (el vídeo arranca en su fotograma 0, que es la misma
// imagen, a cámara lenta y se acelera), bandas de cine, REC y timecode; al salir se frena y se congela. Edición:
// cortinilla LOG / GRADE y una mini línea de tiempo.
// Todo en el loop único (gsap.ticker) y solo con la sección en pantalla. Movimiento reducido: los tres abiertos y el
// vídeo con un botón para reproducirlo.
const IMG = { w: 1920, h: 1074, fx: 0.52, fy: 0.23 }; // oficios-first.webp (= fotograma 0 del vídeo); la cara: encuadre y AF
const GROW = { open: 5, openM: 4, closed: 1 };
const OPEN = { dur: 0.9, ease: 'expo.inOut' };
const SHADE = { closed: 0.55, open: 0.15 };
const FLASH = { peak: 0.85, dur: 0.25, perSec: 3 };
const SCOPE = { ratio: 2.39, max: 0.25 }; // bandas de cine (en paneles estrechos, cada banda como mucho 1/4 del alto)
const KB = { scale: 1.08, x: 1.5, dur: 6, flicker: 0.06 }; // si el vídeo no está listo o falla: Ken Burns + parpadeo
const WIPE = { lerp: 0.15, sweep: 1.6 };
const TL = { loop: 4, bars: 74 };
const INTENT = 80; // ms con el ratón encima antes de abrir (cruzar la sección de camino a otro sitio no abre nada)
const VIDEO = {
  fps: 24,
  rate0: 0.15, // arranca casi parado…
  ramp: 0.9, // …y se acelera hasta 1 ("power2.in"): la foto se descongela
  resume: 0.5, // si se vuelve antes de terminar de salir, se retoma desde donde estaba
  outRate: 0.2, // al salir: se frena…
  outDur: 0.35, // …se pausa y se congela ese fotograma
  focus: { px: 2, in: 0.15, out: 0.35 }, // micro rack focus al arrancar (0 → 2px → 0: sin salto al cambiar foto por vídeo)
  near: '100% 0px', // se precarga con la sección a una pantalla
  src: {
    desk: [['assets/servicios/oficios.webm', 'video/webm'], ['assets/servicios/oficios.mp4', 'video/mp4']],
    narrow: [['assets/servicios/oficios-720.mp4', 'video/mp4']],
  },
};
const MOBILE = '(max-width: 767px)';
const NARROW = '(max-width: 899px)';

export function initOficios({ gsap, loop, still }) {
  const sec = document.querySelector('[data-oficios]');
  if (!sec) return;
  const stage = sec.querySelector('[data-of-stage]');
  const mq = matchMedia(MOBILE);
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
  }));
  const w = { 0: 1, 1: 1, 2: 1 }; // flex-grow de cada panel (lo anima gsap)
  const st = { cur: -1, vis: false, seen: false, col: false, W: 0, H: 0, gap: 10, cw: 0, ch: 0, ox: 0, oy: 0, open: 0 };
  const fx = { foto: fotoFx(), video: videoFx(), edit: editFx() };

  // ---------- geometría: la foto cubre el escenario entero (encuadrada en la cara) ----------
  function measure() {
    const cs = getComputedStyle(stage);
    st.col = mq.matches;
    st.W = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    st.H = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    st.gap = parseFloat(st.col ? cs.rowGap : cs.columnGap) || 10;
    const s = Math.max(st.W / IMG.w, st.H / IMG.h);
    st.cw = IMG.w * s;
    st.ch = IMG.h * s;
    st.ox = Math.min(0, Math.max(st.W - st.cw, st.W / 2 - IMG.fx * st.cw));
    st.oy = Math.min(0, Math.max(st.H - st.ch, st.H / 2 - IMG.fy * st.ch));
    const big = still ? 1 : st.col ? GROW.openM : GROW.open;
    const L = (st.col ? st.H : st.W) - st.gap * 2;
    st.open = (L * big) / (big + 2);
    // el texto se compone al ancho del panel abierto: no se recoloca mientras el panel crece
    stage.style.setProperty('--of-open', `${(st.col ? st.W : st.open).toFixed(1)}px`);
    panels.forEach((p) => {
      p.pic.style.width = `${st.cw.toFixed(1)}px`;
      p.pic.style.height = `${st.ch.toFixed(1)}px`;
    });
    layout();
    if (st.cur >= 0) fx[panels[st.cur].key].resize?.(panels[st.cur]);
    if (still && sec.classList.contains('is-still')) panels.forEach((p) => fx[p.key].still(p));
  }
  // los mismos tamaños que reparte flex (flex-basis 0, sin mínimos): cada panel desplaza su foto (y el vídeo, que va
  // en la misma capa anclada) lo que él está desplazado
  function layout() {
    const L = (st.col ? st.H : st.W) - st.gap * 2;
    const sum = w[0] + w[1] + w[2];
    let at = 0;
    panels.forEach((p, i) => {
      p.el.style.flexGrow = w[i].toFixed(4);
      p.size = (L * w[i]) / sum;
      const x = st.col ? st.ox : st.ox - at;
      const y = st.col ? st.oy - at : st.oy;
      p.pic.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      at += p.size + st.gap;
    });
  }
  const weights = (i) => {
    const big = st.col ? GROW.openM : GROW.open;
    const to = {};
    panels.forEach((_, k) => { to[k] = k === i ? big : GROW.closed; });
    return to;
  };

  // ---------- abrir un panel (el anterior se cierra) ----------
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
    fx[p.key].open(p);
  }
  function close(p) {
    p.el.classList.remove('is-open');
    p.btn.setAttribute('aria-expanded', 'false');
    gsap.to(p.shade, { opacity: SHADE.closed, duration: 0.5, ease: 'power2.out', overwrite: true });
    gsap.to(p.vert, { opacity: 1, duration: 0.4, delay: 0.35, overwrite: true });
    gsap.to(p.rise, { yPercent: 100, duration: 0.2, ease: 'power2.in', overwrite: true });
    fx[p.key].close(p);
  }

  // ---------- FOTO: flash dentro del panel, la foto se congela y el AF se cierra sobre la cara ----------
  function fotoFx() {
    const flashes = [];
    return {
      open(p) {
        const flash = p.el.querySelector('[data-of-flash]');
        const af = p.el.querySelector('[data-of-af]');
        const now = performance.now();
        while (flashes.length && now - flashes[0] > 1000) flashes.shift();
        if (flashes.length < FLASH.perSec) {
          flashes.push(now);
          gsap.timeline({ overwrite: true })
            .set(flash, { opacity: 0 })
            .to(flash, { opacity: FLASH.peak, duration: 0.03, ease: 'none' })
            .to(flash, { opacity: 0, duration: FLASH.dur - 0.03, ease: 'expo.out' });
          gsap.fromTo(p.inner, { scale: 1.03 }, { scale: 1, duration: 0.9, ease: 'expo.out', overwrite: true });
        }
        // el AF "busca": entra grande, se pasa, rebota y se queda
        af.classList.remove('is-locked');
        gsap.timeline({ overwrite: true, delay: 0.18 })
          .fromTo(af, { opacity: 0, scale: 1.7 }, { opacity: 1, scale: 0.9, duration: 0.3, ease: 'power3.out' })
          .to(af, { scale: 1.05, duration: 0.12, ease: 'power1.inOut' })
          .to(af, { scale: 1, duration: 0.16, ease: 'power2.out' })
          .add(() => af.classList.add('is-locked'));
      },
      close(p) {
        const af = p.el.querySelector('[data-of-af]');
        gsap.to(af, { opacity: 0, duration: 0.2, overwrite: true });
        af.classList.remove('is-locked');
      },
      still(p) {
        const af = p.el.querySelector('[data-of-af]');
        gsap.set(af, { opacity: 1, scale: 1 });
        af.classList.add('is-locked');
      },
    };
  }

  // ---------- VÍDEO: la foto cobra vida, bandas de cine, REC y timecode (sincronizado con el vídeo) ----------
  function videoFx() {
    const el = panels.find((p) => p.key === 'video').el;
    const v = el.querySelector('[data-of-video]');
    const photo = el.querySelector('[data-of-still]');
    const freeze = el.querySelector('[data-of-freeze]');
    const tcEl = el.querySelector('[data-of-tc]');
    const s = { on: false, loaded: false, failed: false, sim: false, exiting: false, rate: { r: 1 }, rateTw: null, reset: null, kb: null, lit: 1, tc: '', t0: 0 };
    const bars = (p) => p.el.querySelectorAll('[data-of-bar]');
    const size = (p) => {
      const pw = st.col ? st.W : st.open;
      const ph = st.col ? st.open : st.H;
      const bh = Math.min(ph * SCOPE.max, Math.max(0, (ph - pw / SCOPE.ratio) / 2));
      bars(p).forEach((b) => { b.style.height = `${bh.toFixed(1)}px`; });
    };
    const setRate = () => { v.playbackRate = s.rate.r; };
    // la foto se quita en cuanto el vídeo tiene su primer fotograma pintado (son la misma imagen: no se nota)
    const onFrame = (cb) => {
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => cb());
      else v.addEventListener('playing', () => requestAnimationFrame(cb), { once: true });
    };
    const ready = () => s.loaded && !s.failed && v.readyState >= 2;

    // ---- precarga (con la sección a una pantalla): webm + mp4; por debajo de 900px, el de 720 ----
    function load() {
      if (s.loaded) return;
      s.loaded = true;
      const list = matchMedia(NARROW).matches ? VIDEO.src.narrow : VIDEO.src.desk;
      list.forEach(([src, type]) => {
        const so = document.createElement('source');
        so.src = src;
        so.type = type;
        v.appendChild(so);
      });
      // si fallan todas las fuentes: la simulación (nunca un hueco negro: la foto sigue encima)
      v.lastElementChild?.addEventListener('error', () => {
        s.failed = true;
        if (s.on && !s.sim) { s.sim = true; startSim(panels[1]); }
      });
      v.preload = 'auto';
      v.load();
    }

    // ---- simulación (vídeo no listo o fallido): Ken Burns lento + parpadeo de las luces ----
    function startSim(p) {
      s.sim = true;
      s.t0 = performance.now();
      s.kb?.kill();
      s.kb = gsap.timeline({ repeat: -1, yoyo: true })
        .fromTo(p.inner, { scale: 1, xPercent: -KB.x }, { scale: KB.scale, xPercent: KB.x, duration: KB.dur, ease: 'sine.inOut' });
    }
    function stopSim(p) {
      s.sim = false;
      if (s.kb) { s.kb.kill(); s.kb = null; gsap.to(p.inner, { scale: 1, xPercent: 0, duration: 0.6, ease: 'power2.out', overwrite: true }); }
      p.inner.style.filter = '';
      s.lit = 1;
    }

    // ---- la foto cobra vida (o se retoma, si se vuelve antes de terminar de salir) ----
    function startVideo(p) {
      const resume = s.exiting;
      s.exiting = false;
      s.reset?.kill();
      s.rateTw?.kill();
      if (!resume) {
        s.rate.r = VIDEO.rate0;
        // micro rack focus sobre la foto y el vídeo a la vez
        gsap.killTweensOf(p.inner, 'filter');
        gsap.timeline()
          .to(p.inner, { filter: `blur(${VIDEO.focus.px}px)`, duration: VIDEO.focus.in, ease: 'power1.out' })
          .to(p.inner, { filter: 'blur(0px)', duration: VIDEO.focus.out, ease: 'power2.out', clearProps: 'filter' });
      }
      setRate();
      const go = v.play();
      // congelado (vídeo pausado en ese mismo fotograma): se quita el lienzo y sigue
      freeze.classList.remove('is-on');
      Promise.resolve(go).then(() => {
        onFrame(() => { if (s.on && !s.sim) photo.style.opacity = '0'; });
        s.rateTw = gsap.to(s.rate, { r: 1, duration: resume ? VIDEO.resume : VIDEO.ramp, ease: 'power2.in', onUpdate: setRate });
      }).catch(() => { if (s.on) startSim(p); });
    }
    // ---- al salir: se frena, se pausa, se congela ese fotograma y, ya cerrado, vuelve al 0 por debajo ----
    function stopVideo() {
      s.exiting = true;
      s.rateTw?.kill();
      s.rateTw = gsap.to(s.rate, {
        r: VIDEO.outRate,
        duration: VIDEO.outDur,
        ease: 'power1.out',
        onUpdate: setRate,
        onComplete: () => {
          if (s.on) return;
          v.pause();
          if (v.videoWidth) {
            freeze.width = v.videoWidth;
            freeze.height = v.videoHeight;
            freeze.getContext('2d').drawImage(v, 0, 0, freeze.width, freeze.height);
            freeze.classList.add('is-on');
          }
          // cuando el panel ya está cerrado: la foto quieta vuelve debajo del lienzo, se quita el lienzo y el vídeo
          // vuelve al principio en segundo plano
          s.reset = gsap.delayedCall(Math.max(0.05, OPEN.dur - VIDEO.outDur), () => {
            if (s.on) return;
            photo.style.opacity = '1';
            freeze.classList.remove('is-on');
            v.currentTime = 0;
            s.rate.r = VIDEO.rate0;
            s.exiting = false;
          });
        },
      });
    }

    return {
      s,
      load,
      resize: size,
      open(p) {
        s.on = true;
        size(p);
        gsap.fromTo(bars(p), { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: 'expo.out', delay: 0.15, overwrite: true });
        if (s.sim) stopSim(p);
        if (ready() && st.vis) startVideo(p);
        else if (ready()) s.pending = true; // se arranca al entrar en pantalla
        else startSim(p);
      },
      close(p) {
        s.on = false;
        s.pending = false;
        gsap.to(bars(p), { scaleY: 0, duration: 0.25, ease: 'power2.in', overwrite: true });
        if (s.sim) stopSim(p);
        else stopVideo();
      },
      // la sección entra o sale de pantalla, o la pestaña se oculta
      visible(on) {
        if (!s.on || s.sim) return;
        if (on) { if (ready() && v.paused) startVideo(panels[1]); } else if (!v.paused) { v.pause(); s.rateTw?.kill(); s.exiting = true; }
      },
      still(p) { size(p); gsap.set(bars(p), { scaleY: 1 }); },
      // movimiento reducido: no se reproduce solo; un botón
      button() {
        const b = el.querySelector('[data-of-play]');
        b.hidden = false;
        b.addEventListener('click', () => {
          load();
          if (v.paused) {
            v.playbackRate = 1;
            v.play().then(() => onFrame(() => { photo.style.opacity = '0'; })).catch(() => {});
            b.textContent = '❚❚ Pausar';
          } else {
            v.pause();
            b.textContent = '▶ Reproducir';
          }
        });
      },
      // timecode a 24 fps: el del vídeo si corre; si no, el de la simulación (y el parpadeo de las luces)
      tick(now, p) {
        if (!s.on) return;
        const t = s.sim ? (now - s.t0) / 1000 : v.currentTime;
        const f = Math.floor(t * VIDEO.fps);
        const pad = (n) => String(n).padStart(2, '0');
        const sec = Math.floor(f / VIDEO.fps);
        const tc = `00:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}:${pad(f % VIDEO.fps)}`;
        if (tc !== s.tc) { s.tc = tc; tcEl.textContent = tc; }
        if (!s.sim) return;
        const u = now / 1000;
        const n = Math.sin(u * 2.3) * 0.5 + Math.sin(u * 5.7 + 1.3) * 0.3 + Math.sin(u * 13.1 + 0.7) * 0.2;
        const lit = 1 + KB.flicker * Math.max(0, n);
        if (Math.abs(lit - s.lit) > 0.002) { s.lit = lit; p.inner.style.filter = `brightness(${lit.toFixed(3)})`; }
      },
    };
  }

  // ---------- EDICIÓN: cortinilla LOG / GRADE (sigue al ratón; sola, barre una vez) y mini línea de tiempo ----------
  function editFx() {
    const s = { on: false, x: 0.5, tx: 0.5, user: false, sweep: null, t0: 0, drag: false, px: '', hx: '' };
    let parts;
    const get = (p) => parts || (parts = {
      wipe: p.el.querySelector('[data-of-wipe]'),
      layers: p.el.querySelectorAll('[data-of-log], [data-of-grade], [data-of-wipe]'),
      tl: p.el.querySelector('[data-of-tl]'),
      head: p.el.querySelector('[data-of-head]'),
      wave: p.el.querySelector('[data-of-wave]'),
    });
    const drawWave = (p) => {
      const { wave } = get(p);
      const dpr = Math.min(2, devicePixelRatio || 1);
      const cw = wave.clientWidth;
      const chh = wave.clientHeight;
      if (!cw) return;
      wave.width = Math.round(cw * dpr);
      wave.height = Math.round(chh * dpr);
      const c = wave.getContext('2d');
      c.scale(dpr, dpr);
      c.fillStyle = '#F35411';
      const step = cw / TL.bars;
      for (let i = 0; i < TL.bars; i++) {
        const a = Math.abs(Math.sin(i * 0.37) * 0.6 + Math.sin(i * 1.13 + 2) * 0.3 + Math.sin(i * 2.9) * 0.1);
        const h = Math.max(2, a * chh);
        c.fillRect(i * step, (chh - h) / 2, 2, h);
      }
    };
    return {
      s,
      resize: drawWave,
      open(p) {
        s.on = true;
        s.t0 = performance.now();
        const { layers, tl } = get(p);
        gsap.to(layers, { opacity: 1, duration: 0.4, delay: 0.3, overwrite: true });
        gsap.fromTo(tl, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', delay: 0.3, overwrite: true });
        drawWave(p);
        // sin ratón encima, barre sola de izquierda a derecha una vez y se queda a la mitad
        s.user = false;
        s.sweep?.kill();
        s.sweep = gsap.timeline({ delay: 0.35 })
          .fromTo(s, { tx: 0.04 }, { tx: 0.96, duration: WIPE.sweep * 0.65, ease: 'power2.inOut' })
          .to(s, { tx: 0.5, duration: WIPE.sweep * 0.35, ease: 'power2.inOut' });
        s.x = 0.04;
      },
      close(p) {
        s.on = false;
        s.sweep?.kill();
        const { layers, tl } = get(p);
        gsap.to(layers, { opacity: 0, duration: 0.2, overwrite: true });
        gsap.to(tl, { opacity: 0, duration: 0.2, overwrite: true });
      },
      still(p) {
        const { layers, tl } = get(p);
        gsap.set(layers, { opacity: 1 });
        gsap.set(tl, { opacity: 1 });
        s.x = s.tx = 0.5;
        drawWave(p);
        p.el.style.setProperty('--x', `${(p.size * 0.5).toFixed(1)}px`);
      },
      point(p, clientX) {
        const r = p.el.getBoundingClientRect();
        s.user = true;
        s.sweep?.kill();
        s.tx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      },
      tick(now, p, ratio) {
        if (!s.on) return;
        const a = 1 - Math.pow(1 - WIPE.lerp, ratio);
        s.x += (s.tx - s.x) * (s.user ? a : 1);
        const pw = st.col ? st.W : p.size;
        const px = `${(s.x * pw).toFixed(1)}px`;
        if (px !== s.px) { s.px = px; p.el.style.setProperty('--x', px); }
        const { head, tl } = get(p);
        const hx = `${((((now - s.t0) / 1000) % TL.loop) / TL.loop * tl.clientWidth).toFixed(1)}px`;
        if (hx !== s.hx) { s.hx = hx; head.style.transform = `translate3d(${hx}, 0, 0)`; }
      },
    };
  }

  // ---------- montaje ----------
  const vfx = fx.video;
  const efx = fx.edit;
  const vp = panels.find((p) => p.key === 'video');
  const ep = panels.find((p) => p.key === 'edit');
  measure();
  panels.forEach((p) => {
    gsap.set(p.shade, { opacity: still ? SHADE.open : SHADE.closed });
    gsap.set(p.rise, { yPercent: still ? 0 : 100 });
  });
  if (document.fonts) document.fonts.ready.then(measure);
  let raf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); });

  // se precarga con la sección a una pantalla (antes, preload="none")
  const near = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    near.disconnect();
    if (!still) vfx.load();
    const img = stage.querySelector('.of-img');
    img.loading = 'eager';
    img.decode?.().catch(() => {});
  }, { rootMargin: VIDEO.near });
  near.observe(sec);

  // movimiento reducido: los tres abiertos a la vez, cada uno con su texto; el vídeo, con su botón
  if (still) {
    sec.classList.add('is-still');
    panels.forEach((p) => {
      p.el.classList.add('is-open');
      p.btn.setAttribute('aria-expanded', 'true');
      gsap.set(p.vert, { opacity: 0 });
      fx[p.key].still(p);
    });
    vfx.button();
    return;
  }

  // Foto abierto por defecto (sus efectos y el flash, la primera vez que la sección entra en pantalla)
  st.cur = 0;
  Object.assign(w, weights(0));
  layout();
  const p0 = panels[0];
  p0.el.classList.add('is-open');
  p0.btn.setAttribute('aria-expanded', 'true');
  gsap.set(p0.shade, { opacity: SHADE.open });
  gsap.set(p0.vert, { opacity: 0 });

  // en pantalla: solo entonces se reproduce el vídeo y corre el loop; también se para con la pestaña oculta
  const onScreen = new IntersectionObserver((es) => {
    const e = es[es.length - 1];
    st.vis = e.isIntersecting;
    if (st.vis && !st.seen && e.intersectionRatio >= 0.35) {
      st.seen = true;
      if (st.cur === 0) {
        gsap.fromTo(p0.rise, { yPercent: 100 }, { yPercent: 0, duration: 0.7, ease: 'expo.out', delay: 0.15, stagger: 0.06, overwrite: true });
        fx.foto.open(p0);
      }
    }
    vfx.visible(st.vis && !document.hidden);
  }, { threshold: [0, 0.35] });
  onScreen.observe(sec);
  document.addEventListener('visibilitychange', () => vfx.visible(st.vis && !document.hidden));

  // al cruzar el corte de móvil, el panel abierto se cierra y se vuelve a abrir con las medidas nuevas
  mq.addEventListener('change', () => {
    const c = st.cur;
    if (c >= 0) { close(panels[c]); st.cur = -1; }
    measure();
    setActive(c >= 0 ? c : 0);
  });

  // ---------- ratón (con intención), teclado y toque ----------
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
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

  // la cortinilla: sigue al ratón dentro del panel; en táctil se arrastra con el dedo (el scroll vertical sigue libre)
  ep.el.addEventListener('pointermove', (e) => {
    if (!efx.s.on) return;
    if (e.pointerType === 'mouse' || efx.s.drag) efx.point(ep, e.clientX);
  });
  ep.el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !efx.s.on) return;
    efx.s.drag = true;
    efx.point(ep, e.clientX);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => ep.el.addEventListener(t, () => { efx.s.drag = false; }));

  loop.add((time, ratio) => {
    if (!st.vis) return;
    const now = performance.now();
    vfx.tick(now, vp);
    efx.tick(now, ep, ratio);
  });
}
