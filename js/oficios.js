// Tres oficios (servicios.html, css/servicios.css): UNA sola foto partida en tres paneles que se abren. La foto está
// anclada al escenario (cada panel la pinta del tamaño del escenario entero, desplazada lo que el panel está
// desplazado): al cambiar los anchos, la foto no se mueve; solo cambian las "ventanas".
// Pin corto (150vh; móvil 120vh): el scroll abre Foto → Vídeo → Edición. Ratón o Tab encima abre ese panel; al salir
// del escenario vuelve el que marca el scroll; clic / Enter / toque lo fija hasta el siguiente scroll.
// Foto: flash y AF sobre la cara. Vídeo: cobra vida (oficios.mp4 si existe; si no, Ken Burns y parpadeo de las luces),
// bandas de cine, REC y timecode. Edición: cortinilla LOG / GRADE y una mini línea de tiempo.
// Todo en el loop único (gsap.ticker) y solo con la sección en pantalla. Movimiento reducido: los tres abiertos.
const IMG = { w: 2560, h: 1434, fx: 0.52, fy: 0.23 }; // la cara de la bailarina: encuadre del recorte y centro del AF
const GROW = { open: 5, openM: 4, closed: 1 };
const OPEN = { dur: 0.9, ease: 'expo.inOut' };
const PIN = { len: 1.5, lenM: 1.2, scrub: 0.8 };
const SHADE = { closed: 0.55, open: 0.15 };
const FLASH = { peak: 0.85, dur: 0.25, perSec: 3 };
const SCOPE = { ratio: 2.39, max: 0.25 }; // bandas de cine (en paneles estrechos, cada banda como mucho 1/4 del alto)
const KB = { scale: 1.08, x: 1.5, dur: 6, flicker: 0.06 };
const WIPE = { lerp: 0.15, sweep: 1.6 };
const TL = { loop: 4, bars: 74 };
const VIDEO_SRC = 'assets/servicios/oficios.mp4'; // opcional: si existe, el panel Vídeo (y Edición) lo usan solos
const UNLOCK_PX = 40; // scroll que suelta un panel fijado con clic
const MOBILE = '(max-width: 767px)';

export function initOficios({ gsap, ScrollTrigger, loop, still }) {
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
  const st = { cur: -1, scroll: -1, hover: -1, focus: -1, lock: -1, lockY: 0, vis: false, col: false, W: 0, H: 0, gap: 10, cw: 0, ch: 0, ox: 0, oy: 0, open: 0 };
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
  // los mismos tamaños que reparte flex (flex-basis 0, sin mínimos): cada panel desplaza su foto lo que él está desplazado
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

  // ---------- qué panel está abierto: clic > ratón > teclado > scroll ----------
  const want = () => [st.lock, st.hover, st.focus, st.scroll].find((i) => i >= 0) ?? -1;
  let grow;
  function update() {
    const i = want();
    if (i === st.cur) return;
    const prev = st.cur;
    st.cur = i;
    const big = st.col ? GROW.openM : GROW.open;
    const to = {};
    panels.forEach((_, k) => { to[k] = i < 0 ? GROW.closed : k === i ? big : GROW.closed; });
    grow?.kill();
    grow = gsap.to(w, { ...to, duration: OPEN.dur, ease: OPEN.ease, onUpdate: layout });
    if (prev >= 0) close(panels[prev]);
    if (i >= 0) open(panels[i]);
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

  // ---------- VÍDEO: la foto cobra vida (vídeo o Ken Burns), bandas de cine, REC y timecode ----------
  function videoFx() {
    const s = { on: false, t0: 0, kb: null, video: null, ok: false, tc: '', lit: 1 };
    const bars = (p) => p.el.querySelectorAll('[data-of-bar]');
    const tcEl = () => panels.find((p) => p.key === 'video').el.querySelector('[data-of-tc]');
    const size = (p) => {
      const pw = st.col ? st.W : st.open;
      const ph = st.col ? st.open : st.H;
      const bh = Math.min(ph * SCOPE.max, Math.max(0, (ph - pw / SCOPE.ratio) / 2));
      bars(p).forEach((b) => { b.style.height = `${bh.toFixed(1)}px`; });
    };
    const play = () => {
      if (!s.video || !s.on || !st.vis) return;
      const v = s.video;
      v.play().then(() => gsap.to(v, { opacity: 1, duration: 0.3, overwrite: true })).catch(() => {});
    };
    return {
      s,
      play,
      resize: size,
      open(p) {
        s.on = true;
        s.t0 = performance.now();
        size(p);
        gsap.fromTo(bars(p), { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: 'expo.out', delay: 0.15, overwrite: true });
        if (s.video) {
          s.video.currentTime = 0;
          play();
        } else {
          s.kb?.kill();
          s.kb = gsap.timeline({ repeat: -1, yoyo: true })
            .fromTo(p.inner, { scale: 1, xPercent: -KB.x }, { scale: KB.scale, xPercent: KB.x, duration: KB.dur, ease: 'sine.inOut' });
        }
      },
      close(p) {
        s.on = false;
        gsap.to(bars(p), { scaleY: 0, duration: 0.3, ease: 'power2.in', overwrite: true });
        if (s.kb) { s.kb.kill(); s.kb = null; gsap.to(p.inner, { scale: 1, xPercent: 0, duration: 0.6, ease: 'power2.out', overwrite: true }); }
        if (s.video) { gsap.to(s.video, { opacity: 0, duration: 0.3, overwrite: true, onComplete: () => s.video.pause() }); }
        p.inner.style.filter = '';
        s.lit = 1;
      },
      still(p) { size(p); gsap.set(bars(p), { scaleY: 1 }); },
      // timecode a 25 fps y el parpadeo irregular de las luces (sin vídeo)
      tick(now, p) {
        if (!s.on) return;
        const f = Math.floor(((now - s.t0) / 1000) * 25);
        const pad = (v) => String(v).padStart(2, '0');
        const sec = Math.floor(f / 25);
        const tc = `00:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}:${pad(f % 25)}`;
        if (tc !== s.tc) { s.tc = tc; tcEl().textContent = tc; }
        if (s.video) return;
        const t = now / 1000;
        const n = Math.sin(t * 2.3) * 0.5 + Math.sin(t * 5.7 + 1.3) * 0.3 + Math.sin(t * 13.1 + 0.7) * 0.2;
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
  measure();
  panels.forEach((p) => {
    gsap.set(p.shade, { opacity: still ? SHADE.open : SHADE.closed });
    gsap.set(p.rise, { yPercent: still ? 0 : 100 });
  });
  if (document.fonts) document.fonts.ready.then(measure);
  let raf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); });
  // al cruzar el corte de móvil, el panel abierto se cierra y se vuelve a abrir con las medidas nuevas
  mq.addEventListener('change', () => {
    const c = st.cur;
    if (!still && c >= 0) { close(panels[c]); st.cur = -1; }
    measure();
    if (!still) update();
  });

  // movimiento reducido: sin pin, flash ni Ken Burns; los tres abiertos a la vez, cada uno con su texto
  if (still) {
    sec.classList.add('is-still');
    panels.forEach((p) => {
      p.el.classList.add('is-open');
      p.btn.setAttribute('aria-expanded', 'true');
      gsap.set(p.vert, { opacity: 0 });
      fx[p.key].still(p);
    });
    return;
  }

  // el vídeo (opcional): se busca al acercarse a la sección; si no está, la vida se simula y no pasa nada más
  const vfx = fx.video;
  const probe = () => fetch(VIDEO_SRC, { method: 'HEAD' }).then((r) => {
    if (!r.ok || !/video/.test(r.headers.get('content-type') || 'video')) return;
    const vp = panels.find((p) => p.key === 'video');
    const v = vp.el.querySelector('[data-of-video]');
    v.src = VIDEO_SRC;
    v.preload = 'auto';
    vfx.s.video = v;
    // Edición corrige el mismo plano en movimiento
    const ep = panels.find((p) => p.key === 'edit');
    const v2 = v.cloneNode();
    v2.removeAttribute('data-of-video');
    v2.style.opacity = 1;
    ep.inner.appendChild(v2);
    v2.play().catch(() => {});
    if (vfx.s.on) { vfx.s.kb?.kill(); vfx.s.kb = null; gsap.set(vp.inner, { scale: 1, xPercent: 0, filter: '' }); v.currentTime = 0; vfx.play(); }
  }).catch(() => {});
  // al acercarse: se busca el vídeo y la foto se decodifica antes de llegar (sin tirones en la primera apertura)
  const early = () => {
    probe();
    const img = stage.querySelector('.of-img');
    img.loading = 'eager';
    img.decode?.().catch(() => {});
  };
  ScrollTrigger.create({ trigger: sec, start: 'top 250%', once: true, onEnter: early });
  // pin corto: 0–.33 Foto, .33–.66 Vídeo, .66–1 Edición (al entrar, los tres cerrados)
  const prog = { p: 0 };
  const pinLen = () => innerHeight * (mq.matches ? PIN.lenM : PIN.len);
  const pick = (v) => (v < 0.02 ? -1 : v < 1 / 3 ? 0 : v < 2 / 3 ? 1 : 2);
  gsap.to(prog, {
    p: 1,
    ease: 'none',
    onUpdate: () => {
      const i = pick(prog.p);
      if (i !== st.scroll) { st.scroll = i; update(); }
    },
    scrollTrigger: {
      trigger: sec,
      start: 'top top',
      end: () => `+=${pinLen()}`,
      pin: true,
      scrub: PIN.scrub,
      invalidateOnRefresh: true,
      // un panel fijado con clic se suelta con el siguiente scroll
      onUpdate: (self) => {
        if (st.lock >= 0 && Math.abs(self.scroll() - st.lockY) > UNLOCK_PX) { st.lock = -1; update(); }
      },
    },
  });

  // en pantalla: desde que asoma hasta que se va, contando el pin
  ScrollTrigger.create({
    trigger: sec,
    start: 'top bottom',
    end: () => `+=${innerHeight + sec.offsetHeight + pinLen()}`,
    invalidateOnRefresh: true,
    onToggle: (self) => {
      st.vis = self.isActive;
      const v = vfx.s.video;
      if (!v) return;
      if (st.vis) vfx.play(); else v.pause();
      const v2 = panels.find((p) => p.key === 'edit').inner.querySelector('video');
      if (v2) { if (st.vis) v2.play().catch(() => {}); else v2.pause(); }
    },
  });

  // ratón / teclado / clic / toque
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const scrollY0 = () => (window.disco?.lenis ? window.disco.lenis.scroll : scrollY);
  panels.forEach((p, i) => {
    p.el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !fine.matches || mq.matches) return;
      st.hover = i;
      update();
    });
    p.btn.addEventListener('focus', () => {
      if (!p.btn.matches(':focus-visible')) return;
      st.focus = i;
      update();
    });
    p.btn.addEventListener('blur', () => {
      if (st.focus !== i) return;
      st.focus = -1;
      requestAnimationFrame(update);
    });
    p.btn.addEventListener('click', () => {
      st.lock = i;
      st.lockY = scrollY0();
      update();
    });
  });
  stage.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    st.hover = -1;
    update();
  });

  // la cortinilla: sigue al ratón dentro del panel; en táctil se arrastra con el dedo (el scroll vertical sigue libre)
  const ep = panels.find((p) => p.key === 'edit');
  const efx = fx.edit;
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

  const vp = panels.find((p) => p.key === 'video');
  loop.add((time, ratio) => {
    if (!st.vis) return;
    const now = performance.now();
    vfx.tick(now, vp);
    efx.tick(now, ep, ratio);
  });
}
