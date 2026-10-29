// Proceso: rejilla bento (servicios.html, css/servicios.css). Cada tarjeta ilustra su paso con una animación
// propia (solo se anima en pantalla). Toda la rejilla:
//   · ENTRADA: clip-path (inset desde abajo) + y 60 → 0 + rotateX 8° → 0, en diagonal desde arriba a la izquierda
//   · PARALLAX: tres velocidades según la columna (−6 %, 0, +6 %), sin romper la rejilla (alineada en el centro)
//   · HOVER: inclinación 3D hacia el cursor (máx. 4°), reflejo blanco al 7 % y borde naranja al 40 % junto al
//     cursor; las demás tarjetas, al 70 %
// "Viva" = con el ratón encima (escritorio), centrada en pantalla (móvil, sin hover ni inclinación) o encendida por
// el destello cuando aterriza en ella (evento "disco:light" desde js/page-star.js; el borde y el halo, en CSS).
// Movimiento reducido: rejilla quieta con las ilustraciones en su estado final.
const TILT = { max: 4, lerp: 0.12 };
const SPEED = 0.06;
const ENTER = { y: 60, rx: 8, dur: 1, step: 0.09 };

export function initBento({ gsap, ScrollTrigger, loop, still }) {
  const grid = document.querySelector('[data-bento]');
  if (!grid) return;
  const cells = [...grid.querySelectorAll('[data-cell]')];
  const cards = cells.map((c) => c.querySelector('[data-card]'));
  const desktop = matchMedia('(min-width: 900px)');
  const mods = { marca: words, idea, plan: board, rodaje: focus, post: grade, entrega: formats };
  const api = cards.map((card) => (mods[card.dataset.card] || (() => ({})))({ gsap, ScrollTrigger, card, desktop }));
  // el halo del destello (debajo de todo lo de la tarjeta)
  cards.forEach((card) => {
    const halo = document.createElement('i');
    halo.className = 'bento__halo';
    halo.setAttribute('aria-hidden', 'true');
    card.prepend(halo);
  });

  if (still) {
    cards.forEach((c, i) => { c.classList.add('is-final', 'is-in'); api[i].final?.(); });
    return;
  }

  // --- en pantalla: solo entonces se anima cada tarjeta ---
  const visible = new Set();
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const i = cards.indexOf(e.target);
    e.target.classList.toggle('is-in', e.isIntersecting);
    if (e.isIntersecting) visible.add(i); else visible.delete(i);
    api[i].visible?.(e.isIntersecting);
  }), { rootMargin: '10% 0px' });
  cards.forEach((c) => io.observe(c));

  // viva por el ratón, por estar centrada (móvil) o por el destello
  const why = cards.map(() => ({ hover: false, scroll: false, star: false }));
  const live = (i, on, from = 'hover') => {
    why[i][from] = on;
    const v = why[i].hover || why[i].scroll || why[i].star;
    if (cards[i].classList.contains('is-live') === v) return;
    cards[i].classList.toggle('is-live', v);
    api[i].live?.(v, why[i]);
  };
  cards.forEach((card, i) => card.addEventListener('disco:light', (e) => live(i, !!e.detail, 'star')));

  // --- inclinación, reflejo y borde (escritorio con ratón) ---
  const tilt = cards.map(() => ({ x: 0, y: 0, tx: 0, ty: 0, on: false }));
  cards.forEach((card, i) => {
    const box = card.parentElement; // [data-enter]: sin la inclinación
    card.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !desktop.matches) return;
      grid.classList.add('has-hover');
      tilt[i].on = true;
      live(i, true);
    });
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !desktop.matches) return;
      const r = box.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      card.style.setProperty('--mx', `${x.toFixed(0)}px`);
      card.style.setProperty('--my', `${y.toFixed(0)}px`);
      tilt[i].tx = x / r.width - 0.5;
      tilt[i].ty = y / r.height - 0.5;
      api[i].move?.(x / r.width, y / r.height, e);
    });
    card.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      grid.classList.remove('has-hover');
      tilt[i].tx = 0;
      tilt[i].ty = 0;
      tilt[i].on = false;
      live(i, false);
    });
  });

  loop.add((time, ratio) => {
    const a = 1 - Math.pow(1 - TILT.lerp, ratio);
    visible.forEach((i) => {
      const t = tilt[i];
      if (t.on || Math.abs(t.x) > 0.001 || Math.abs(t.y) > 0.001) {
        t.x += (t.tx - t.x) * a;
        t.y += (t.ty - t.y) * a;
        if (!t.on && Math.abs(t.x) < 0.001 && Math.abs(t.y) < 0.001) { t.x = 0; t.y = 0; }
        cards[i].style.transform = t.x || t.y
          ? `perspective(1200px) rotateX(${(-t.y * 2 * TILT.max).toFixed(3)}deg) rotateY(${(t.x * 2 * TILT.max).toFixed(3)}deg)`
          : '';
      }
      api[i].tick?.(time, ratio);
    });
  });

  // --- entrada y parallax (escritorio: rejilla; móvil: una columna, cada tarjeta al entrar y "viva" al centro) ---
  const enters = cells.map((c) => c.querySelector('[data-enter]'));
  const from = { clipPath: 'inset(100% 0% 0% 0% round 24px)', y: ENTER.y, rotateX: ENTER.rx, transformPerspective: 1200, transformOrigin: '50% 100%' };
  const to = { clipPath: 'inset(0% 0% 0% 0% round 24px)', y: 0, rotateX: 0, duration: ENTER.dur, ease: 'expo.out', clearProps: 'clipPath,transform' };
  gsap.matchMedia()
    .add('(min-width: 900px)', () => {
      // diagonal desde arriba a la izquierda: fila + columna de cada celda
      const W = grid.clientWidth;
      const rowH = cells[0].offsetHeight ? Math.min(...cells.map((c) => c.offsetHeight)) : 280;
      const order = cells.map((c) => Math.round(c.offsetTop / (rowH + 16)) + Math.round(c.offsetLeft / (W / 4)));
      gsap.set(enters, from);
      const st = ScrollTrigger.create({
        trigger: grid,
        start: 'top 78%',
        once: true,
        onEnter: () => gsap.to(enters, { ...to, stagger: (i) => order[i] * ENTER.step }),
      });
      // columnas a tres velocidades (por el centro de cada celda)
      const tweens = cells.map((c) => {
        const mid = (c.offsetLeft + c.offsetWidth / 2) / W;
        const s = mid < 0.34 ? -SPEED : mid > 0.66 ? SPEED : 0;
        if (!s) return null;
        return gsap.fromTo(c, { y: () => -s * innerHeight * 0.5 }, {
          y: () => s * innerHeight * 0.5,
          ease: 'none',
          scrollTrigger: { trigger: grid, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
        });
      });
      return () => { st.kill(); tweens.forEach((t) => { t?.scrollTrigger?.kill(); t?.kill(); }); gsap.set(cells, { clearProps: 'transform' }); gsap.set(enters, { clearProps: 'all' }); };
    })
    .add('(max-width: 899px)', () => {
      const ts = enters.map((el, i) => {
        const tw = gsap.fromTo(el, from, { ...to, scrollTrigger: { trigger: cells[i], start: 'top 90%', once: true } });
        const c = ScrollTrigger.create({ trigger: cards[i], start: 'top 62%', end: 'bottom 38%', onToggle: (self) => live(i, self.isActive, 'scroll') });
        return () => { tw.scrollTrigger?.kill(); tw.kill(); c.kill(); live(i, false, 'scroll'); };
      });
      return () => ts.forEach((f) => f());
    });
}

// --- Conocemos tu marca: palabras sueltas a distintas profundidades (parallax del ratón); viva → se ordenan
//     solas en "tu marca, entendida." en naranja ---
function words({ gsap, card }) {
  const box = card.querySelector('[data-words]');
  const free = ['energía', 'público', 'tono', 'historia', 'ritmo', 'valores', 'voz', 'esencia'];
  const phrase = ['tu', 'marca,', 'entendida.'];
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const list = [...free.map((w) => ({ w, p: false })), ...phrase.map((w) => ({ w, p: true }))];
  // orden de las casillas (determinista): las de la frase no quedan juntas
  const slots = [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2];
  box.innerHTML = list.map((it) => `<span class="b-word${it.p ? ' b-word--p' : ''}"><span class="b-word__in">${it.w}</span></span>`).join('');
  const els = [...box.children].map((el, i) => ({ el, in: el.firstElementChild, p: list[i].p, z: 0.35 + rnd() * 0.65, ph: rnd() * 6.28, jx: rnd() - 0.5, jy: rnd() - 0.5, bx: 0, by: 0, s: 1 }));
  let on = false;
  let S = 1.25; // escala de la frase ordenada
  let mx = 0;
  let my = 0;
  let tmx = 0;
  let tmy = 0;
  const layout = () => {
    const W = box.clientWidth;
    const H = box.clientHeight;
    els.forEach((e, i) => {
      const k = slots[i];
      const col = k % 4;
      const row = Math.floor(k / 4);
      const w = e.el.offsetWidth;
      const h = e.el.offsetHeight;
      e.s = 0.55 + 0.45 * e.z;
      e.bx = ((col + 0.5) / 4) * W + e.jx * W * 0.08 - w / 2;
      e.by = ((row + 0.5) / 3) * H + e.jy * H * 0.12 - h / 2;
    });
    // la frase, centrada en una línea (con su escala de "ordenada")
    const gap = 12;
    const ps = els.filter((e) => e.p);
    const raw = ps.reduce((a, e) => a + e.el.offsetWidth, 0);
    S = Math.min(1.25, (W * 0.92 - gap * (ps.length - 1)) / raw); // cabe siempre en la tarjeta
    const total = raw * S + gap * (ps.length - 1);
    let x = (W - total) / 2;
    ps.forEach((e) => {
      const w = e.el.offsetWidth;
      e.ax = x + (w * S - w) / 2;
      e.ay = H / 2 - e.el.offsetHeight / 2;
      x += w * S + gap;
    });
    apply(true);
  };
  const apply = (instant) => {
    els.forEach((e) => {
      const vars = on
        ? (e.p ? { x: e.ax, y: e.ay, scale: S, opacity: 1, color: '#F35411' } : { x: e.bx, y: e.by, scale: e.s * 0.9, opacity: 0.08, color: '#f4f2ef' })
        : { x: e.bx, y: e.by, scale: e.s, opacity: 0.28 + 0.5 * e.z, color: '#f4f2ef' };
      if (instant) gsap.set(e.el, vars);
      else gsap.to(e.el, { ...vars, duration: on ? 0.9 : 0.7, ease: on ? 'expo.out' : 'power3.inOut', delay: on && e.p ? 0.05 * phrase.indexOf(e.in.textContent) : 0, overwrite: true });
    });
  };
  if (document.fonts) document.fonts.ready.then(layout);
  window.addEventListener('resize', () => requestAnimationFrame(layout));
  requestAnimationFrame(layout);
  return {
    live(v) { on = v; apply(false); if (!v) { tmx = 0; tmy = 0; } },
    move(nx, ny) { tmx = nx - 0.5; tmy = ny - 0.5; },
    final() { on = true; layout(); },
    tick(time, ratio) {
      const a = 1 - Math.pow(1 - 0.08, ratio);
      mx += (tmx - mx) * a;
      my += (tmy - my) * a;
      els.forEach((e) => {
        const k = on && e.p ? 0.15 : e.z;
        const dx = -mx * 36 * k + Math.sin(time * 0.6 + e.ph) * 4 * k;
        const dy = -my * 28 * k + Math.cos(time * 0.5 + e.ph) * 3 * k;
        e.in.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
      });
    },
  };
}

// --- Idea y concepto: un trazo a lápiz se dibuja al entrar y se transforma en la estrella de disco, que se
//     rellena de naranja (del boceto a la idea). Viva → se repite ---
const SKETCH = 'M96 30 Q158 22 164 96 Q170 168 102 170 Q30 176 34 102 Q28 40 96 30 Z';
const STAR = 'M98.7 25 Q108.4 85 152.9 98.1 Q108.4 112 98.7 175 Q89.4 112 47.1 98.1 Q89.4 85 98.7 25 Z';
function idea({ gsap, card }) {
  const path = card.querySelector('[data-idea]');
  const nums = (d) => d.match(/-?\d+(\.\d+)?/g).map(Number);
  const a = nums(SKETCH);
  const b = nums(STAR);
  const build = (t) => {
    let k = 0;
    return SKETCH.replace(/-?\d+(\.\d+)?/g, () => { const v = a[k] + (b[k] - a[k]) * t; k++; return v.toFixed(2); });
  };
  const m = { t: 0 };
  path.setAttribute('d', SKETCH);
  const tl = gsap.timeline({ paused: true })
    .call(() => card.classList.remove('is-star'))
    .set(m, { t: 0 })
    .set(path, { attr: { d: SKETCH }, strokeDashoffset: 1, fillOpacity: 0 })
    .to(path, { strokeDashoffset: 0, duration: 1.1, ease: 'power1.inOut' })
    .to(m, { t: 1, duration: 0.9, ease: 'expo.inOut', onUpdate: () => path.setAttribute('d', build(m.t)) }, '+=0.15')
    .call(() => card.classList.add('is-star'))
    .to(path, { fillOpacity: 1, duration: 0.45, ease: 'power2.out' });
  let played = false;
  return {
    visible(on) { if (on && !played) { played = true; tl.restart(); } },
    live(on) { if (on && played && !tl.isActive()) tl.restart(); },
    final() { path.setAttribute('d', STAR); card.classList.add('is-star'); gsap.set(path, { strokeDashoffset: 0, fillOpacity: 1 }); },
  };
}

// --- Planificación: tira de storyboard que se desplaza en horizontal con el scroll; viva → flipbook (CSS) ---
function board({ gsap, card }) {
  const strip = card.querySelector('[data-board]');
  const art = strip.parentElement;
  gsap.fromTo(strip, { x: 0 }, {
    x: () => -Math.max(0, strip.scrollWidth - art.clientWidth),
    ease: 'none',
    scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
  });
  return {};
}

// --- Rodaje: las escuadras del autofoco siguen al cursor y "enfocan" el título (desenfocado si están lejos) ---
function focus({ card }) {
  const af = card.querySelector('[data-af]');
  const title = card.querySelector('[data-focus]');
  const s = { x: 0, y: 0, tx: 0, ty: 0, blur: -1, init: false, follow: false };
  // centro del título en coordenadas de la tarjeta (offsets sumados hasta ella, sin la inclinación)
  const home = () => {
    let x = title.offsetWidth / 2;
    let y = title.offsetHeight / 2;
    for (let e = title; e && e !== card; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
    return { x, y };
  };
  const toHome = () => { const h = home(); s.tx = h.x; s.ty = h.y; };
  return {
    live(on, why) {
      s.follow = on && !!why?.hover && matchMedia('(min-width: 900px)').matches;
      if (on && !s.follow) { s.x = card.clientWidth - 60; s.y = 40; } // sin ratón: desde la esquina hasta el título
      toHome();
    },
    move(nx, ny) { if (s.follow) { s.tx = nx * card.clientWidth; s.ty = ny * card.clientHeight; } },
    final() { const h = home(); af.style.transform = `translate3d(${h.x}px, ${h.y}px, 0)`; af.classList.add('is-locked'); },
    tick(time, ratio) {
      if (!s.init) { toHome(); s.x = s.tx; s.y = s.ty; s.init = true; }
      if (!s.follow && !card.classList.contains('is-live')) toHome();
      const a = 1 - Math.pow(1 - 0.14, ratio);
      s.x += (s.tx - s.x) * a;
      s.y += (s.ty - s.y) * a;
      af.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)`;
      const h = home();
      const d = Math.hypot(s.x - h.x, s.y - h.y);
      const blur = Math.min(1, Math.max(0, (d - 30) / 200)) * 3.5;
      if (Math.abs(blur - s.blur) > 0.02) {
        s.blur = blur;
        title.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
        af.classList.toggle('is-locked', blur < 0.15);
      }
    },
  };
}

// --- Postproducción: la misma foto antes (RAW, a la izquierda de la línea) y después (DISCO GRADE): la línea sigue
//     al ratón; con el dedo, se arrastra; sola (al entrar en móvil o al encenderla el destello), barre una vez y se
//     queda a la mitad. El cabezal de la línea de tiempo va con ella ---
function grade({ gsap, card, desktop }) {
  const box = card.querySelector('[data-grade]');
  const raw = box.querySelector('.b-grade__raw');
  const line = box.querySelector('.b-grade__line');
  const tl = card.querySelector('[data-tl]');
  const head = tl.querySelector('.b-tl__head');
  const s = { v: 0.5, t: 0.5, last: -1, drag: false, swept: false, sweep: null };
  const sweep = () => {
    s.sweep?.kill();
    s.sweep = gsap.timeline()
      .fromTo(s, { t: 0.06 }, { t: 0.94, duration: 1.1, ease: 'power2.inOut' })
      .to(s, { t: 0.5, duration: 0.6, ease: 'power2.inOut' });
  };
  const point = (e) => {
    const r = box.getBoundingClientRect();
    s.t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  box.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; s.drag = true; s.sweep?.kill(); point(e); });
  box.addEventListener('pointermove', (e) => { if (s.drag) point(e); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => box.addEventListener(t, () => { s.drag = false; }));
  return {
    visible(on) { if (on && !s.swept && !desktop.matches) { s.swept = true; sweep(); } },
    live(on, why) { if (on && !why?.hover) sweep(); },
    move(nx, ny, e) { s.sweep?.kill(); point(e); },
    final() { s.v = 0.5; s.last = -1; this.tick(0, 1); },
    tick(time, ratio) {
      s.v += (s.t - s.v) * (1 - Math.pow(1 - 0.12, ratio));
      if (Math.abs(s.v - s.last) < 0.0005) return;
      s.last = s.v;
      const x = s.v * box.clientWidth;
      raw.style.clipPath = `inset(0 ${(100 - s.v * 100).toFixed(2)}% 0 0)`;
      line.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
      box.style.setProperty('--x', `${x.toFixed(1)}px`);
      head.style.transform = `translate3d(${(s.v * tl.clientWidth).toFixed(1)}px, 0, 0)`;
    },
  };
}

// --- Entrega a medida: el mismo encuadre recortado 9:16 → 1:1 → 16:9 en bucle (clip-path), con su proporción ---
function formats({ gsap, card }) {
  const box = card.querySelector('[data-fmt]');
  const label = card.querySelector('[data-ratio]');
  const corners = [...box.querySelectorAll('.b-fmt__c')];
  // recorte en % del cuadrado: [arriba/abajo, izquierda/derecha]
  const R = [['9:16', 0, 21.875], ['1:1', 0, 0], ['16:9', 21.875, 0]];
  const c = { t: 0, l: 21.875 };
  const apply = () => {
    box.style.clipPath = `inset(${c.t}% ${c.l}% ${c.t}% ${c.l}% round 10px)`;
    const S = box.clientWidth;
    const dx = (c.l / 100) * S;
    const dy = (c.t / 100) * S;
    corners[0].style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    corners[1].style.transform = `translate3d(${-dx}px, ${dy}px, 0)`;
    corners[2].style.transform = `translate3d(${dx}px, ${-dy}px, 0)`;
    corners[3].style.transform = `translate3d(${-dx}px, ${-dy}px, 0)`;
  };
  apply();
  const tl = gsap.timeline({ paused: true, repeat: -1 });
  [1, 2, 0].forEach((k) => {
    tl.to(c, { t: R[k][1], l: R[k][2], duration: 0.9, ease: 'expo.inOut', onUpdate: apply, onStart: () => { label.textContent = R[k][0]; } }, '+=1.1');
  });
  return {
    visible(on) { if (on) tl.play(); else tl.pause(); },
    final() { c.t = 0; c.l = 0; apply(); label.textContent = '1:1'; },
  };
}
