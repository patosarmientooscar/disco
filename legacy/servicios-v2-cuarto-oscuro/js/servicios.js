import { config } from './config.js';
import { photos, formats, steps, tramos, sectors } from './servicios-data.js';

// Servicios: "cuarto oscuro" (css/servicios.css). Un laboratorio de revelado: luz roja de seguridad y grano;
// las fotos se revelan en la cubeta (WebGL, js/darkroom.js); en vídeo se apaga el rojo y entra el proyector;
// las copias del proceso cuelgan de un cordel y se balancean con el scroll; al final se enciende la luz.
// Todo en el loop único (gsap.ticker) y solo con su sección cerca. Movimiento reducido: todo visible y quieto.
const GRAIN = { w: 200, fps: 12 };
// cubeta: tramos de cada copia (t = progreso × nº de copias − índice): entra (−ENTER → 0), se revela
// (DEVELOP) y sale hacia arriba "con las pinzas" (EXIT → 1); la última se queda
const TRAY = { enter: 0.14, develop: [0.04, 0.72], exit: 0.82, lerp: 0.1, fill: 0.86 };
const RED_DIP = 0.35;            // la luz roja baja un 35 % al terminar de revelarse cada copia
const SWING = { max: 6, k: 0.05, damp: 0.08, push: 0.028, hover: 0.08 };  // péndulos (grados)
const CARD = { gap: 0.45, width: 300, cordTop: 34, sag: 26, posts: 2 };   // cordel: copias cada 45vw
const FOLLOW = { lerp: 0.12, tilt: 0.06, max: 8 };
const EDL_SWEEP = 0.6;

export function init({ gsap, ScrollTrigger, lenis, loop, reduced, arrived = Promise.resolve() }) {
  const still = reduced.matches;
  const desktop = matchMedia('(min-width: 900px)');
  initGrain(loop, still);
  initHead(gsap, still, arrived);
  initManifest(gsap, still);
  const lights = initLights({ gsap, ScrollTrigger, loop, still });
  initTray({ gsap, ScrollTrigger, loop, still, desktop, lights });
  initEdl({ gsap, ScrollTrigger, still, desktop });
  initProcess({ gsap, ScrollTrigger, lenis, loop, still, desktop });
  initSectors({ gsap, loop, still, desktop });
  initClose({ gsap, ScrollTrigger, still });
  // los titulares son enormes: al cargar la fuente la página cambia de alto (las posiciones de los pines y de la
  // tinta del menú se recalculan)
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
}

// ---------- grano de película: ruido a baja resolución, 12 fps ----------
function initGrain(loop, still) {
  const canvas = document.querySelector('[data-grain]');
  if (!canvas || still) return;
  const ctx = canvas.getContext('2d');
  const size = () => {
    canvas.width = GRAIN.w;
    canvas.height = Math.round((GRAIN.w * innerHeight) / innerWidth);
  };
  size();
  window.addEventListener('resize', size);
  let last = 0;
  loop.add((time) => {
    if (document.hidden || time - last < 1 / GRAIN.fps) return;
    last = time;
    const img = ctx.createImageData(canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
}

// ---------- A) cabecera: líneas subiendo con máscara ----------
function initHead(gsap, still, arrived) {
  const lines = document.querySelectorAll('[data-head-line]');
  const after = document.querySelectorAll('[data-head-after]');
  if (still) return;
  gsap.set(lines, { yPercent: 105 });
  gsap.set(after, { opacity: 0, y: 14 });
  arrived.then(() => {
    gsap.timeline({ delay: 0.1 })
      .to(lines, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12 })
      .to(after, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.1 }, 0.45);
  });
}

// ---------- B) manifiesto: palabra a palabra (.15 → 1); "idea" e "imágenes" en naranja ----------
function initManifest(gsap, still) {
  const el = document.querySelector('[data-manifest]');
  if (!el) return;
  const hot = new Set([...el.querySelectorAll('em')].map((e) => e.textContent.trim()));
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  el.innerHTML = `<span class="sr-only">${text}</span>${text.split(' ').map((w) => {
    const bare = w.replace(/[.,]/g, '');
    return `<span class="mw${hot.has(bare) ? ' mw--hot' : ''}" aria-hidden="true">${w}</span>`;
  }).join(' ')}`;
  if (still) return;
  gsap.to(el.querySelectorAll('.mw'), {
    opacity: 1,
    ease: 'none',
    stagger: 0.1,
    scrollTrigger: { trigger: el, start: 'top 75%', end: 'bottom 40%', scrub: 0.6 },
  });
}

// ---------- luces: el rojo de seguridad se apaga y entra el proyector al llegar a vídeo ----------
function initLights({ ScrollTrigger, loop, still }) {
  const red = document.querySelector('[data-light-red]');
  const proj = document.querySelector('[data-light-proj]');
  const state = { video: 0, dip: 0, applied: '' };
  ScrollTrigger.create({
    trigger: '[data-video]',
    start: 'top 75%',
    end: 'top 20%',
    scrub: true,
    onUpdate: (self) => { state.video = self.progress; },
  });
  loop.add(() => {
    const r = (1 - state.video) * (1 - (still ? 0 : RED_DIP * state.dip));
    const key = `${r.toFixed(3)}|${state.video.toFixed(3)}`;
    if (key === state.applied) return;
    state.applied = key;
    red.style.opacity = r.toFixed(3);
    proj.style.opacity = state.video.toFixed(3);
  });
  return state;
}

// ---------- C) la cubeta de revelado ----------
function initTray({ gsap, ScrollTrigger, loop, still, desktop, lights }) {
  const section = document.querySelector('[data-foto]');
  const tray = section.querySelector('[data-tray]');
  const n = photos.length;
  const prints = photos.map((p, i) => {
    const fig = document.createElement('figure');
    fig.className = 'sv-print is-neg';
    fig.style.setProperty('--tilt', `${[-1.5, 1.2, -0.8, 1.5, -1.2, 0.9][i % 6]}deg`);
    fig.innerHTML = `<div class="sv-print__paper"><div class="sv-print__img"><img src="${p.src}" width="${p.w}" height="${p.h}" alt="${p.alt}" loading="lazy" decoding="async"></div></div>
      <figcaption>Nº ${String(i + 1).padStart(2, '0')} · ${p.categoria.toUpperCase()} · ${p.año}</figcaption>`;
    tray.append(fig);
    return { fig, box: fig.querySelector('.sv-print__img'), img: fig.querySelector('img'), w: p.w, h: p.h, dev: 0 };
  });
  // al cargar cada copia (apiladas: móvil / movimiento reducido) cambia el alto de la página
  let refresh = 0;
  prints.forEach((pr) => pr.img.addEventListener('load', () => { clearTimeout(refresh); refresh = setTimeout(() => ScrollTrigger.refresh(), 120); }));

  // el WebGL se crea al acercarse (y se pausa lejos); sin WebGL o con movimiento reducido, filtro CSS
  let dark = null;
  let near = false;
  if (!still) {
    new IntersectionObserver(([e]) => {
      near = e.isIntersecting;
      if (near) prints.forEach((p) => { p.img.loading = 'eager'; });
      if (near && dark === null) {
        dark = undefined;
        import('./darkroom.js').then((m) => { dark = m.createDarkroom({ loop }) || false; if (dark) dark.canvas.className = 'sv-print__gl'; }).catch(() => { dark = false; });
      }
      if (dark) dark.pause(!near);
    }, { rootMargin: '100% 0px' }).observe(section);
  }
  let active = -1;
  const show = (k, d) => {
    prints[k].dev = d;
    if (dark) {
      if (active !== k) { active = k; dark.attach(prints[k].box, prints[k].img); }
      dark.set(d);
      prints[k].fig.classList.remove('is-neg');
    } else {
      prints[k].fig.classList.toggle('is-neg', d < 0.5);
    }
  };

  // movimiento reducido: todas a la vista; se revelan (filtro CSS) al entrar en pantalla
  if (still) {
    prints.forEach((p) => new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      p.fig.classList.remove('is-neg');
    }, { threshold: 0.4 }).observe(p.fig));
    return;
  }

  const mm = gsap.matchMedia();
  // --- escritorio: pin de ~300vh; las copias se revelan una tras otra en el mismo sitio ---
  mm.add('(min-width: 900px)', () => {
    // cada copia, con su proporción, lo más grande que quepa en la cubeta (con el pie de foto debajo)
    const fit = () => {
      const W = tray.clientWidth * TRAY.fill;
      const H = tray.clientHeight - 60;
      prints.forEach((p) => {
        const k = Math.min(W / p.w, H / p.h);
        p.box.style.width = `${Math.round(p.w * k)}px`;
        p.box.style.height = `${Math.round(p.h * k)}px`;
      });
    };
    fit();
    window.addEventListener('resize', fit);
    const prog = { p: 0 };
    const st = gsap.to(prog, { p: 1, ease: 'none', scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: true } });
    let p = -1;
    const remove = loop.add((time, ratio) => {
      if (!near) return;
      const target = prog.p;
      const next = p < 0 ? target : p + (target - p) * (1 - Math.pow(1 - TRAY.lerp, ratio));
      if (Math.abs(next - p) < 1e-5 && p >= 0) return;
      p = Math.abs(next - target) < 1e-5 ? target : next;
      let current = 0;
      prints.forEach((pr, k) => {
        const t = p * n - k;
        const last = k === n - 1;
        const s = pr.fig.style;
        if (t < -TRAY.enter || (!last && t >= 1)) { s.visibility = 'hidden'; return; }
        s.visibility = 'visible';
        if (t < 0) {
          const e = -t / TRAY.enter;
          s.transform = `translate3d(0, ${(e * 24).toFixed(2)}%, 0)`;
          s.opacity = (1 - e).toFixed(3);
          show(k, 0);
          current = k;
        } else if (last || t < TRAY.exit) {
          s.transform = '';
          s.opacity = '';
          const d = Math.min(1, Math.max(0, (t - TRAY.develop[0]) / (TRAY.develop[1] - TRAY.develop[0])));
          show(k, d);
          current = k;
        } else {
          // sale hacia arriba, como sacada con las pinzas
          const e = (t - TRAY.exit) / (1 - TRAY.exit);
          const ease = e * e * (3 - 2 * e);
          s.transform = `translate3d(0, ${(-ease * 115).toFixed(2)}%, 0) rotate(${(-ease * 4).toFixed(2)}deg)`;
          s.opacity = (1 - Math.max(0, (e - 0.6) / 0.4)).toFixed(3);
          if (pr.dev < 1) { pr.dev = 1; pr.fig.classList.remove('is-neg'); }
        }
      });
      lights.dip = smooth(0.8, 1, prints[current].dev);
    });
    return () => { remove(); st.scrollTrigger.kill(); st.kill(); window.removeEventListener('resize', fit); prints.forEach((pr) => { ['transform', 'opacity', 'visibility'].forEach((k) => pr.fig.style.removeProperty(k)); pr.box.style.width = ''; pr.box.style.height = ''; }); };
  });
  // --- móvil: una debajo de otra; cada una se revela al pasar por la pantalla ---
  mm.add('(max-width: 899px)', () => {
    const triggers = prints.map((pr, k) => ScrollTrigger.create({
      trigger: pr.fig,
      start: 'top 80%',
      end: 'center 45%',
      scrub: true,
      onUpdate: (self) => { show(k, self.progress); lights.dip = smooth(0.8, 1, self.progress); },
    }));
    return () => triggers.forEach((t) => t.kill());
  });
}

// ---------- D) hoja de montaje: filas como clips; al pasar, cabezal y timecode que cuenta ----------
function initEdl({ gsap, ScrollTrigger, still, desktop }) {
  const list = document.querySelector('[data-formats]');
  list.innerHTML = formats.map((f) => `<li class="sv-edl__row" data-tc="${f.tc}">
      <span class="sv-edl__name">${f.name}</span><span class="sv-edl__dots" aria-hidden="true"></span>
      <span class="sv-edl__spec">${f.spec}</span><span class="sv-edl__tc" aria-hidden="true">00:00:00:00</span>
      <i class="sv-edl__head" aria-hidden="true"></i></li>`).join('');
  const rows = [...list.children];
  if (still) return;
  const tc = (s) => {
    const f = Math.floor((s % 1) * 25);
    const sec = Math.floor(s);
    const p = (v) => String(v).padStart(2, '0');
    return `00:${p(Math.floor(sec / 60))}:${p(sec % 60)}:${p(f)}`;
  };
  const on = (row, yes) => {
    row.classList.toggle('is-on', yes);
    if (!yes) return;
    const head = row.querySelector('.sv-edl__head');
    const out = row.querySelector('.sv-edl__tc');
    const clock = { s: 0 };
    gsap.timeline()
      .fromTo(head, { left: '0%', opacity: 1 }, { left: '100%', duration: EDL_SWEEP, ease: 'power1.inOut' })
      .to(head, { opacity: 0, duration: 0.15 });
    gsap.fromTo(clock, { s: 0 }, { s: Number(row.dataset.tc), duration: EDL_SWEEP, ease: 'power1.inOut', onUpdate: () => { out.textContent = tc(clock.s); } });
  };
  rows.forEach((row) => {
    row.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') on(row, true); });
    row.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') on(row, false); });
  });
  // entrada: como clips que se colocan en la línea de tiempo
  gsap.from(rows, { x: -40, opacity: 0, duration: 0.7, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: list, start: 'top 82%', once: true } });
  // móvil / táctil: se enciende la que pasa por el centro
  gsap.matchMedia().add('(hover: none), (max-width: 899px)', () => {
    const ts = rows.map((row) => ScrollTrigger.create({ trigger: row, start: 'top 55%', end: 'bottom 45%', onToggle: (self) => on(row, self.isActive) }));
    return () => ts.forEach((t) => t.kill());
  });
}

// ---------- E) proceso: copias colgadas de un cordel; péndulos que responden a la velocidad ----------
function initProcess({ gsap, ScrollTrigger, loop, still }) {
  const section = document.querySelector('[data-proc]');
  const list = section.querySelector('[data-steps]');
  const bar = section.querySelector('[data-proc-bar]');
  list.innerHTML = steps.map((s) => `<li class="sv-copy">
      <i class="sv-copy__pin" aria-hidden="true"></i>
      <div class="sv-copy__paper">
        <span class="sv-copy__n" aria-hidden="true">${s.n}</span>
        <h3 class="sv-copy__title"><span class="sr-only">${s.n}. </span>${s.title}</h3>
        <p class="sv-copy__text">${s.text}</p>
        <p class="sv-copy__tag">${s.tag}</p>
      </div></li>`).join('');
  bar.innerHTML = tramos.map((t) => `<span class="sv-proc__seg">${t}</span>`).join('');
  const cards = [...list.children];
  const segs = [...bar.children];
  if (still) { segs.forEach((s) => s.classList.add('is-on')); return; }
  // cada copia con su masa: no se mueven igual
  const swing = cards.map((_, i) => ({ a: 0, v: 0, m: 0.75 + ((i * 37) % 10) / 16 }));

  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px)', () => {
    const track = section.querySelector('[data-proc-track]');
    const path = section.querySelector('[data-cord-path]');
    const svg = section.querySelector('[data-cord]');
    let travel = 0;
    let cordY = () => CARD.cordTop;
    const layout = () => {
      const gap = innerWidth * CARD.gap;
      const start = Math.max(innerWidth * 0.18, 160);
      const xs = cards.map((_, i) => start + i * gap);
      const width = xs[xs.length - 1] + innerWidth * 0.35;
      // el cordel: tramos con una leve catenaria entre postes (cada CARD.posts copias)
      const span = gap * CARD.posts;
      const posts = [];
      for (let x = start - gap / 2; x < width + span; x += span) posts.push(x);
      cordY = (x) => {
        const i = Math.max(0, Math.min(posts.length - 2, Math.floor((x - posts[0]) / span)));
        const u = (x - posts[i]) / span;
        return CARD.cordTop + CARD.sag * 4 * u * (1 - u);
      };
      let d = `M0 ${CARD.cordTop + CARD.sag * 0.6} L${posts[0]} ${CARD.cordTop}`;
      for (let i = 0; i < posts.length - 1; i++) d += ` Q${(posts[i] + posts[i + 1]) / 2} ${CARD.cordTop + CARD.sag * 2} ${posts[i + 1]} ${CARD.cordTop}`;
      path.setAttribute('d', d);
      svg.setAttribute('width', posts[posts.length - 1]);
      svg.setAttribute('height', CARD.cordTop + CARD.sag * 3);
      track.style.width = `${width}px`;
      cards.forEach((c, i) => { c.style.left = `${xs[i] - CARD.width / 2}px`; c.style.top = `${cordY(xs[i]) + 10}px`; });
      travel = Math.max(0, width - innerWidth);
      section.style.setProperty('--travel', `${travel}px`);
    };
    layout();
    const onResize = () => { layout(); ScrollTrigger.refresh(); };
    window.addEventListener('resize', onResize);
    const prog = { p: 0 };
    const st = gsap.to(prog, { p: 1, ease: 'none', scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true } });
    ScrollTrigger.refresh();
    let x = 0;
    let near = false;
    const io = new IntersectionObserver(([e]) => { near = e.isIntersecting; }, { rootMargin: '20% 0px' });
    io.observe(section);
    // pasar el ratón empuja la copia
    const push = cards.map((c, i) => {
      const fn = (e) => { if (e.pointerType === 'mouse') swing[i].v += (e.movementX || 0) * SWING.hover / swing[i].m; };
      c.addEventListener('pointermove', fn);
      return () => c.removeEventListener('pointermove', fn);
    });
    let lit = -1;
    const remove = loop.add((time, ratio) => {
      if (!near) return;
      const target = -travel * prog.p;
      const nx = x + (target - x) * (1 - Math.pow(1 - 0.14, ratio));
      const v = (nx - x) / Math.max(ratio, 0.001);
      x = Math.abs(nx - target) < 0.05 ? target : nx;
      track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
      cards.forEach((c, i) => {
        const s = swing[i];
        const acc = -SWING.k * s.a - SWING.damp * s.v + (v * SWING.push) / s.m;
        s.v += acc * ratio;
        s.a = Math.max(-SWING.max, Math.min(SWING.max, s.a + s.v * ratio));
        if (Math.abs(s.a) < 0.005 && Math.abs(s.v) < 0.005) { s.a = 0; s.v = 0; }
        c.style.transform = s.a ? `rotate(${s.a.toFixed(3)}deg)` : '';
      });
      const k = Math.round(prog.p * (cards.length - 1));
      if (k !== lit) {
        lit = k;
        segs.forEach((sg, j) => sg.classList.toggle('is-on', j <= steps[k].tramo));
      }
    });
    return () => {
      remove(); io.disconnect(); push.forEach((f) => f()); st.scrollTrigger.kill(); st.kill();
      window.removeEventListener('resize', onResize);
      track.style.cssText = '';
      cards.forEach((c) => { c.style.cssText = ''; });
      section.style.removeProperty('--travel');
    };
  });
  // móvil: en columna, cada una con su trozo de cordel; se balancea al entrar
  mm.add('(max-width: 899px)', () => {
    const ts = cards.map((c, i) => gsap.fromTo(c, { rotate: i % 2 ? -5 : 5 }, {
      rotate: 0, duration: 1.8, ease: 'elastic.out(1, 0.3)',
      scrollTrigger: { trigger: c, start: 'top 85%', toggleActions: 'play none none reset' },
    }));
    segs.forEach((s) => s.classList.add('is-on'));
    return () => ts.forEach((t) => { t.scrollTrigger?.kill(); t.kill(); });
  });
}

// ---------- F) para quién: al pasar, la frase y una foto que sigue al cursor revelándose; móvil, acordeón ----------
function initSectors({ gsap, loop, still, desktop }) {
  const list = document.querySelector('[data-sectors]');
  list.innerHTML = sectors.map((s, i) => `<li class="sv-for__item">
      <button class="sv-for__row" type="button" aria-expanded="false" aria-controls="sector-${i}">
        <span class="sv-for__name">${s.name}</span><span class="sv-for__text">${s.text}</span>
      </button>
      <div class="sv-for__panel" id="sector-${i}" hidden>
        <p>${s.text}</p>
        ${s.photo ? `<div class="sv-for__photo"><img src="${s.photo.src}" width="${s.photo.w}" height="${s.photo.h}" alt="" loading="lazy" decoding="async"></div>` : ''}
      </div></li>`).join('');
  const items = [...list.children];
  // acordeón (móvil); en escritorio el botón no abre nada (la frase ya está en la fila)
  items.forEach((item) => {
    const btn = item.querySelector('.sv-for__row');
    const panel = item.querySelector('.sv-for__panel');
    btn.addEventListener('click', () => {
      if (desktop.matches) return;
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      item.classList.toggle('is-on', open);
    });
    btn.addEventListener('focus', () => { if (desktop.matches) item.classList.add('is-on'); });
    btn.addEventListener('blur', () => { if (desktop.matches) item.classList.remove('is-on'); });
  });

  // la foto que sigue al cursor (solo ratón, escritorio)
  const follow = document.querySelector('[data-follow]');
  const img = follow.querySelector('img');
  const pos = { x: 0, y: 0, tx: 0, ty: 0, r: 0, on: false, shown: false };
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  items.forEach((item, i) => {
    item.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !desktop.matches) return;
      items.forEach((it) => it.classList.toggle('is-on', it === item));
      const ph = sectors[i].photo;
      if (!ph || still || !fine.matches) { pos.on = false; gsap.to(follow, { opacity: 0, duration: 0.2, overwrite: true }); return; }
      if (!img.src.endsWith(ph.src)) img.src = ph.src;
      // se revela desde el negativo en 0.4 s
      follow.classList.add('is-neg');
      requestAnimationFrame(() => requestAnimationFrame(() => follow.classList.remove('is-neg')));
      if (!pos.on) { pos.x = e.clientX; pos.y = e.clientY; }
      pos.on = true;
      gsap.to(follow, { opacity: 1, duration: 0.25, overwrite: true });
    });
  });
  list.addEventListener('pointerleave', () => {
    items.forEach((it) => { if (!it.contains(document.activeElement)) it.classList.remove('is-on'); });
    pos.on = false;
    gsap.to(follow, { opacity: 0, duration: 0.25, overwrite: true });
  });
  list.addEventListener('pointermove', (e) => { pos.tx = e.clientX; pos.ty = e.clientY; });
  loop.add((time, ratio) => {
    if (!pos.on && follow.style.opacity === '0') return;
    const a = 1 - Math.pow(1 - FOLLOW.lerp, ratio);
    const dx = (pos.tx - pos.x) * a;
    pos.x += dx;
    pos.y += (pos.ty - pos.y) * a;
    pos.r += (Math.max(-FOLLOW.max, Math.min(FOLLOW.max, dx * FOLLOW.tilt * 10)) - pos.r) * a;
    follow.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0) rotate(${pos.r.toFixed(2)}deg)`;
  });
}

// ---------- G) cierre: se enciende la luz (parpadeo de fluorescente) ----------
function initClose({ gsap, ScrollTrigger, still }) {
  const light = document.querySelector('[data-close-light]');
  if (!still) {
    ScrollTrigger.create({
      trigger: '[data-close]',
      start: 'top 70%',
      once: true,
      onEnter: () => gsap.fromTo(light, { opacity: 0 }, { keyframes: { opacity: [0, 0.6, 0.2, 1] }, duration: 0.5, ease: 'none' }),
    });
  }
  const email = config.email;
  document.querySelectorAll('.sv-close [data-email]').forEach((a) => { a.href = `mailto:${email}`; a.textContent = email; });
  const ok = document.querySelector('.sv-close [data-copied]');
  let timer = 0;
  document.querySelector('.sv-close [data-copy-email]')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(email);
      ok.textContent = 'Copiado';
    } catch {
      ok.textContent = 'No se pudo copiar';
    }
    clearTimeout(timer);
    timer = setTimeout(() => { ok.textContent = ''; }, 1500);
  });
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
