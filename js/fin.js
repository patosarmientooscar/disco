import { config } from './config.js';
import { loadMatter, sampleLetters, createWorld } from './fin-physics.js';

// Footer de todas las páginas: "fin de la sesión". Toda la web es una noche en la pista y esto es el final:
// se apagan las luces, el destello que ha viajado por la página "se muere" y cae con gravedad sobre un
// logo "disco" gigante; se puede coger y lanzar, y si se encaja en su sitio (la estrella encima de la O)
// vuelve la fiesta. En la home cae el destello 3D (js/star.js lo pinta, aquí se decide dónde está); en las
// páginas sin 3D (o sin WebGL) cae la estrella del propio logo, en SVG. La física, en js/fin-physics.js.
// Estados: idle (en su recorrido / en el logo) → dying (parpadea) → falling (física) → fitting → fit.
// Al volver a subir (top del footer por debajo del 25 % de la pantalla), de vuelta a idle.
// (LEGACY: el footer del editor de vídeo, en legacy/footer-editor/)
const PAGES = [
  { name: 'Inicio', href: 'index.html' },
  { name: 'Servicios', href: 'servicios.html' },
  { name: 'Portfolio', href: 'portfolio.html' },
  { name: 'Nosotros', href: 'nosotros.html' },
  { name: 'Contacto', href: 'contacto.html' },
];
const LEGAL = [
  { name: 'Aviso legal', href: 'aviso-legal.html' },
  { name: 'Privacidad', href: 'privacidad.html' },
  { name: 'Cookies', href: 'cookies.html' },
];
const LETTERS = ['d', 'i', 's', 'c', 'o'];
const DIE_AT = 0.02;          // muere cuando el top del footer llega al 2 % de la pantalla (o al final)
const REVIVE_AT = 0.25;       // revive cuando vuelve a bajar del 25 %
const GLOW = { on: 0.22, off: 0.08 };
const SPOT_LERP = 0.1;
const FALL_DELAY = 0.45;      // s: se apaga (deja de girar 0.3 s, parpadea 0.7 s) y empieza a caer
const FLICKER = [1, 0.15, 0.9, 0.1, 0.6, 0];   // la estrella del logo (SVG) al soltarse de la O
const WOBBLE = { speed: [3, 15], deg: [2, 6], gap: 180 };
// encaja a < 0.6 × su radio del centro del hueco y casi quieta; solo después de haber estado lejos (> 1.4 × radio):
// tras "Soltar ✦" el saltito no la vuelve a encajar sola
const FIT = { radius: 0.6, speed: 2, away: 1.4 };
const SPIN = { gain: 0.012, fast: 1.2, back: 0.08 };   // giro en Y del 3D (proporcional a la velocidad en x)
const HINT_AFTER = 6000;      // ms quieta en el suelo sin tocarla: el hueco parpadea (una vez)
const STEP_MS = 1000 / 60;
// último punto de paso del destello (js/star.js): 30 vh por encima del hueco, alto 1.6 × el hueco, pero
// siempre entero entre el email y el logo (STOP_GAP de margen)
const STOP = { rise: 0.3, size: 1.6, gap: 16, min: 40 };
const TAU = Math.PI * 2;

// Dónde acaba el destello (px de pantalla con el scroll al final): { cy, h } o null si no hay footer
export function finStop(max) {
  const footer = document.querySelector('.fin');
  const svg = footer?.querySelector('.fin__logo');
  const hole = footer?.querySelector('.fin__hole');
  const mail = footer?.querySelector('.fin__mail');
  if (!svg || !hole || !mail || !svg.getBoundingClientRect().width) return null;
  const shift = scrollY - max;
  const s = boxOf(svg, hole.getBBox());
  const logo = boxOf(svg, logoBBox(svg));
  const above = mail.getBoundingClientRect().bottom + shift + STOP.gap;
  const below = logo.top + shift - STOP.gap;
  const h = Math.max(STOP.min, Math.min(STOP.size * s.h, below - above));
  const cy = Math.min(below - h / 2, Math.max(above + h / 2, s.cy + shift - STOP.rise * innerHeight));
  return { cy, h };
}

export function initFin({ gsap, lenis, reduced, loop, star = null }) {
  const footer = document.querySelector('[data-footer]');
  const logoPaths = [...document.querySelectorAll('.nav__logo-svg path')].map((p) => p.getAttribute('d'));
  if (!footer || logoPaths.length < 6) return;
  const file = location.pathname.split('/').pop() || 'index.html';
  footer.className = 'fin';
  footer.innerHTML = markup(file, logoPaths);

  const $ = (s) => footer.querySelector(s);
  const svg = $('.fin__logo');
  const letters = LETTERS.map((l) => $(`.fin__l--${l}`));
  const hole = $('.fin__hole');
  const slot = $('.fin__slot');
  const drop = $('.fin__drop');
  const grab = $('.fin__grab');
  const glow = $('.fin__glow');
  const spot = $('.fin__spot');
  const flash = $('.fin__flash');
  const prize = $('.fin__prize');
  const row = $('.fin__row');
  const sb = slot.getBBox();
  drop.setAttribute('viewBox', `${sb.x} ${sb.y} ${sb.width} ${sb.height}`);

  initCopy(footer);
  initClock($('[data-fin-clock]'));
  $('.fin__up').addEventListener('click', () => {
    if (lenis) lenis.scrollTo(0, { duration: reduced.matches ? 0 : 2, immediate: reduced.matches });
    else scrollTo({ top: 0, behavior: reduced.matches ? 'auto' : 'smooth' });
  });

  // --- movimiento reducido: nada cae ni se mueve; la estrella ya está encajada ---
  if (reduced.matches) {
    footer.classList.add('is-fit');
    prize.hidden = false;
    $('.fin__again').hidden = true;
    return;
  }

  // --- quién cae: el destello 3D (home) o la estrella del logo (SVG) ---
  let adapter = null;
  let mode = star ? 'pending' : 'svg';
  const useSvg = () => { mode = 'svg'; adapter = null; if (state === 'idle') footer.classList.add('has-star'); };
  let state = 'idle';
  if (mode === 'svg') footer.classList.add('has-star');
  else Promise.resolve(star).then((s) => {
    if (s && s.footer) { adapter = s.footer; mode = '3d'; } else useSvg();
  }).catch(useSvg);
  const ready = () => {
    if (mode === '3d' && adapter.failed) useSvg();
    return mode === 'svg' || (mode === '3d' && adapter.ready);
  };

  // --- entrada (una vez por visita): palabras con máscara, letras desde abajo una a una, fila con fade ---
  const words = footer.querySelectorAll('.fin__w > span');
  const rise = [...letters, hole, slot];
  const enter = gsap.timeline({ paused: true })
    .from(words, { yPercent: 110, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0)
    .from([$('.fin__kicker'), $('.fin__mail')], { opacity: 0, duration: 0.8, ease: 'power1.out', stagger: 0.15 }, 0.1)
    .from(rise, { y: (i, el) => el.getBBox().height * 0.3, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06, clearProps: 'opacity' }, 0.2)
    .from(row, { opacity: 0, duration: 0.8, ease: 'power1.out' }, 0.6);
  let entered = false;
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    enter.play();
    entered = true;
  }, { threshold: 0.3 }).observe(footer);

  // --- medidas: en px del footer (origen arriba a la izquierda) ---
  const m = { top: 0, k: 1, ox: 0, oy: 0, w: 1, floor: 1, slot: { x: 0, y: 0, h: 1 } };
  let columns = null; // relleno de las letras en unidades del SVG (una vez)
  const measure = () => {
    const fr = footer.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const r = svg.getBoundingClientRect();
    m.top = fr.top + scrollY;
    m.k = r.width / vb.width;
    m.ox = r.left - fr.left - vb.x * m.k;
    m.oy = r.top - fr.top - vb.y * m.k;
    m.w = fr.width;
    m.floor = row.getBoundingClientRect().top - fr.top;
    m.slot = { x: m.ox + (sb.x + sb.width / 2) * m.k, y: m.oy + (sb.y + sb.height / 2) * m.k, h: sb.height * m.k };
    if (world) world.setScene({ w: m.w, floor: m.floor, rects: rects() });
  };
  // columnas de las letras → rectángulos en px; el último tramo de cada columna llega hasta el suelo
  const rects = () => {
    columns ||= sampleLetters(svg, letters, slot);
    const out = [];
    columns.forEach((cols, letter) => cols.forEach(({ x0, x1, runs }) => runs.forEach(([y0, y1], i) => {
      const left = m.ox + x0 * m.k;
      const right = m.ox + x1 * m.k;
      const top = m.oy + y0 * m.k;
      const bottom = i === runs.length - 1 ? m.floor : m.oy + y1 * m.k;
      out.push({ x: (left + right) / 2, y: (top + bottom) / 2, w: right - left + 1, h: Math.max(2, bottom - top), letter });
    })));
    return out;
  };

  // --- física (se carga a una pantalla de distancia) ---
  let world = null;
  let near = false;
  const lastHit = letters.map(() => 0);
  const hit = (i, speed) => {
    const now = performance.now();
    if (now - lastHit[i] < WOBBLE.gap) return;
    lastHit[i] = now;
    const t = Math.min(1, (speed - WOBBLE.speed[0]) / (WOBBLE.speed[1] - WOBBLE.speed[0]));
    const deg = (WOBBLE.deg[0] + (WOBBLE.deg[1] - WOBBLE.deg[0]) * t) * (Math.random() < 0.5 ? -1 : 1);
    gsap.timeline()
      .to(letters[i], { rotation: deg, duration: 0.07, ease: 'power2.out', transformOrigin: '50% 100%', overwrite: 'auto' })
      .to(letters[i], { rotation: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)', transformOrigin: '50% 100%' });
  };
  const physics = new Promise((resolve) => {
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      loadMatter().then((Matter) => {
        world = createWorld(Matter, { onHit: hit });
        measure();
        resolve(world);
      }).catch(() => resolve(null));
    }, { rootMargin: '100% 0px' }).observe(footer);
  });
  new IntersectionObserver(([e]) => { near = e.isIntersecting; if (near) measure(); }, { rootMargin: '25% 0px' }).observe(footer);
  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(measure, 150); });
  if (document.fonts) document.fonts.ready.then(measure);

  // --- la estrella: pose en px del footer; se pinta en el 3D (pantalla) o en el SVG que cae ---
  const pose = { x: 0, y: 0, angle: 0, spinY: 0, h: 1 };
  const screen = { x: 0, y: 0, angle: 0, spinY: 0, h: 1 };
  let fallH = 1;
  let tl = null;
  const slotPose = () => ({ x: m.slot.x, y: m.slot.y, angle: 0, spinY: 0, h: m.slot.h });
  const sync = () => {
    if (mode === '3d') {
      screen.x = pose.x;
      screen.y = pose.y + m.top - scrollY;
      screen.angle = pose.angle;
      screen.spinY = pose.spinY;
      screen.h = pose.h;
    } else {
      const w = (pose.h * sb.width) / sb.height;
      drop.style.width = `${w}px`;
      drop.style.height = `${pose.h}px`;
      drop.style.transform = `translate3d(${pose.x - w / 2}px, ${pose.y - pose.h / 2}px, 0) rotate(${pose.angle}rad)`;
    }
    const d = pose.h * 0.9;
    grab.style.width = `${d}px`;
    grab.style.height = `${d}px`;
    grab.style.transform = `translate3d(${pose.x - d / 2}px, ${pose.y - d / 2}px, 0)`;
  };
  const showDrop = (on) => { drop.style.visibility = on ? 'visible' : ''; };

  // 1) se apaga: deja de girar y parpadea; el resplandor baja. 2) cae
  const die = () => {
    state = 'dying';
    tl?.kill();
    gsap.to(glow, { opacity: GLOW.off, duration: 1.2, ease: 'power2.out', overwrite: true });
    if (mode === '3d') {
      const s = adapter.screen();
      Object.assign(pose, { x: s.x, y: s.y - (m.top - scrollY), angle: 0, spinY: wrap(s.ry), h: s.h });
      sync();
      adapter.hold(screen);
      adapter.flicker();
      tl = gsap.timeline().to(pose, { spinY: 0, duration: 0.3, ease: 'power2.out', onUpdate: sync });
    } else {
      Object.assign(pose, slotPose());
      tl = gsap.timeline()
        .to(slot, { keyframes: { opacity: FLICKER }, duration: 0.7, ease: 'none' })
        .call(() => {
          footer.classList.remove('has-star');
          gsap.set(slot, { clearProps: 'opacity' });
          sync();
          showDrop(true);
        });
    }
    fallH = pose.h;
    const token = tl;
    Promise.all([physics, new Promise((r) => setTimeout(r, (mode === '3d' ? FALL_DELAY : 0.7) * 1000))]).then(([w]) => {
      if (state !== 'dying' || tl !== token) return;
      if (!w) { fitNow(); return; } // sin física (CDN caído): directamente encajada
      fall({ spin: (Math.random() * 2 - 1) * 0.08 });
    });
  };

  let lastTouch = 0;
  let hinted = false;
  let armed = false;
  const fall = (v = {}) => {
    world.addStar({ x: pose.x, y: pose.y, h: pose.h, ...v });
    armed = false;
    state = 'falling';
    grab.classList.add('is-on');
    lastTouch = performance.now();
  };

  // PREMIO: al centro exacto del hueco, de frente y al tamaño de la estrella del logo; flash; vuelve la fiesta
  const fit = () => {
    state = 'fitting';
    world.removeStar();
    grab.classList.remove('is-dragging');
    const turn = mode === '3d' ? TAU : Math.PI; // la estrella es simétrica cada media vuelta (el 3D lleva "disco")
    tl = gsap.timeline()
      .to(pose, { ...slotPose(), angle: Math.round(pose.angle / turn) * turn, spinY: Math.round(pose.spinY / TAU) * TAU, duration: 0.45, ease: 'back.out(1.7)', onUpdate: sync })
      .fromTo(flash, { opacity: 0 }, { keyframes: { opacity: [0, 0.85, 0] }, duration: 0.35, ease: 'none' })
      .call(reward, null, '<0.1');
  };
  const reward = () => {
    footer.classList.add('is-fit');
    if (mode === '3d') adapter.fade(0, 0.25); else showDrop(false);
    gsap.to(glow, { opacity: GLOW.on, duration: 0.8, ease: 'power2.out', overwrite: true });
    prize.hidden = false;
    gsap.fromTo(prize, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' });
    state = 'fit';
  };
  const fitNow = () => { Object.assign(pose, slotPose()); sync(); reward(); };

  // "Soltar ✦" (o doble clic en la estrella encajada): otra vez al suelo, con un saltito
  const again = () => {
    if (state !== 'fit' || !world) return;
    footer.classList.remove('is-fit');
    prize.hidden = true;
    gsap.to(glow, { opacity: GLOW.off, duration: 0.6, ease: 'power2.out', overwrite: true });
    state = 'dying';
    if (mode === '3d') adapter.fade(1, 0.2); else showDrop(true);
    tl = gsap.timeline()
      .to(pose, { h: fallH, duration: 0.25, ease: 'power2.out', onUpdate: sync })
      .call(() => fall({ vx: (Math.random() * 2 - 1) * 3, vy: -7, spin: (Math.random() * 2 - 1) * 2 }));
  };
  $('.fin__again').addEventListener('click', again);
  grab.addEventListener('dblclick', again);

  // 3) al volver a subir: se suelta la física, se enciende y vuelve a su recorrido (o la estrella a la O)
  const revive = () => {
    tl?.kill();
    world?.removeStar();
    grab.classList.remove('is-on', 'is-dragging');
    footer.classList.remove('is-fit');
    prize.hidden = true;
    gsap.to(glow, { opacity: GLOW.on, duration: 0.8, ease: 'power2.out', overwrite: true });
    state = 'idle';
    if (mode === '3d') {
      adapter.fade(1, 0.3);
      adapter.relight();
      adapter.release();
      return;
    }
    tl = gsap.timeline()
      .to(pose, { ...slotPose(), angle: Math.round(pose.angle / Math.PI) * Math.PI, duration: 0.6, ease: 'expo.out', onUpdate: sync })
      .call(() => { showDrop(false); footer.classList.add('has-star'); });
  };

  // --- coger y lanzar (solo el asa sobre la estrella captura el puntero) ---
  const local = (e) => {
    const r = footer.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  grab.addEventListener('pointerdown', (e) => {
    if (state !== 'falling' || !world.grabAt(...local(e))) return;
    e.preventDefault();
    grab.setPointerCapture(e.pointerId);
    grab.classList.add('is-dragging');
    lastTouch = performance.now();
  });
  grab.addEventListener('pointermove', (e) => { if (world?.dragging) { world.drag(...local(e)); lastTouch = performance.now(); } });
  const release = () => {
    if (!world?.dragging) return;
    world.drop();
    grab.classList.remove('is-dragging');
    lastTouch = performance.now();
  };
  grab.addEventListener('pointerup', release);
  grab.addEventListener('pointercancel', release);

  // --- foco que sigue al cursor (solo ratón) ---
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const light = { x: 0, y: 0, tx: 0, ty: 0, on: false };
  footer.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !fine.matches) return;
    [light.tx, light.ty] = local(e);
    if (!light.on) {
      light.on = true;
      light.x = light.tx;
      light.y = light.ty;
      gsap.to(spot, { opacity: 1, duration: 0.4, overwrite: true });
    }
  });
  footer.addEventListener('pointerleave', () => { light.on = false; gsap.to(spot, { opacity: 0, duration: 0.6, overwrite: true }); });

  // --- un solo loop: disparo de los estados, física a paso fijo, foco ---
  loop.add((time, ratio) => {
    if (!near || document.hidden) return;
    const top = m.top - scrollY;
    const atEnd = lenis ? lenis.scroll >= lenis.limit - 2 : innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
    if (state === 'idle') {
      if (entered && (top <= DIE_AT * innerHeight || atEnd) && ready()) die();
    } else if (top > REVIVE_AT * innerHeight) {
      revive();
    }

    if (light.on || spot.style.opacity !== '0') {
      const a = 1 - Math.pow(1 - SPOT_LERP, ratio);
      light.x += (light.tx - light.x) * a;
      light.y += (light.ty - light.y) * a;
      spot.style.transform = `translate3d(${light.x}px, ${light.y}px, 0)`;
    }

    if (state === 'falling' && world?.star) {
      world.step(ratio * STEP_MS);
      const b = world.star;
      pose.x = b.position.x;
      pose.y = b.position.y;
      pose.angle = b.angle;
      // al dar vueltas rápido, un poco de giro en Y (se ve 3D); en reposo vuelve a mirar a cámara
      if (b.speed > SPIN.fast) pose.spinY += b.velocity.x * SPIN.gain * ratio;
      else pose.spinY += (Math.round(pose.spinY / TAU) * TAU - pose.spinY) * (1 - Math.pow(1 - SPIN.back, ratio));
      sync();
      const dist = Math.hypot(pose.x - m.slot.x, pose.y - m.slot.y) / (pose.h / 2);
      if (dist > FIT.away) armed = true;
      if (armed && !world.dragging && dist < FIT.radius && b.speed < FIT.speed) fit();
      else if (!hinted && b.isSleeping && performance.now() - lastTouch > HINT_AFTER) {
        hinted = true;
        hole.classList.add('is-hint');
        hole.addEventListener('animationend', () => hole.classList.remove('is-hint'), { once: true });
      }
    } else if (mode === '3d' && state !== 'idle') {
      sync(); // la página aún se mueve un poco (Lenis): el 3D sigue pegado al footer
    }
  });
}

// ---------- maqueta ----------
function markup(file, d) {
  const email = config.email;
  const ig = config.instagram;
  const link = (p) => `<li><a href="${p.href}"${p.href === file ? ' aria-current="page"' : ''}>${p.name}</a></li>`;
  const paths = LETTERS.map((l, i) => `<path class="fin__l fin__l--${l}" d="${d[i]}"/>`).join('');
  return `
    <i class="fin__glow" aria-hidden="true"></i>
    <i class="fin__spot" aria-hidden="true"></i>
    <h2 class="sr-only">disco.</h2>
    <div class="fin__top">
      <p class="fin__kicker">FIN DE LA SESIÓN</p>
      <p class="fin__title"><span class="fin__w"><span>¿Rodamos</span></span> <span class="fin__w"><span>juntos<b>?</b></span></span></p>
      <div class="fin__mail">
        <a class="fin__email" href="mailto:${email}">${email}</a>
        <button class="fin__copy" type="button" data-fin-copy>Copiar</button>
        <span class="fin__copied" data-fin-copied role="status" aria-live="polite"></span>
      </div>
    </div>
    <div class="fin__stage">
      <svg class="fin__logo" viewBox="330 575 960 290" aria-hidden="true" focusable="false">
        <g id="fin-logo">${paths}<path class="fin__hole" d="${d[5]}"/><path class="fin__slot" d="${d[5]}"/></g>
      </svg>
      <svg class="fin__mirror" viewBox="330 575 960 290" aria-hidden="true" focusable="false"><use href="#fin-logo"/></svg>
      <p class="fin__prize" hidden><a href="contacto.html">Ya sabes dónde encontrarnos →</a><button class="fin__again" type="button">Soltar ✦</button></p>
    </div>
    <div class="fin__row">
      <nav aria-label="Páginas"><ul class="fin__list">${PAGES.map(link).join('')}</ul></nav>
      <ul class="fin__list fin__list--mid">
        <li><a href="${ig.url}" target="_blank" rel="noopener">Instagram ${ig.handle}</a></li>
        ${LEGAL.map(link).join('')}
      </ul>
      <div class="fin__end">
        <span data-fin-clock>MADRID</span>
        <span>© ${new Date().getFullYear()} disco.</span>
        <button class="fin__up" type="button">Arriba ↑</button>
      </div>
    </div>
    <!-- la estrella que cae (SVG) y el asa para cogerla: en px del footer, como la física -->
    <svg class="fin__drop" aria-hidden="true" focusable="false"><path d="${d[5]}"/></svg>
    <i class="fin__grab" aria-hidden="true"></i>
    <i class="fin__flash" aria-hidden="true"></i>`;
}

function initCopy(root) {
  const out = root.querySelector('[data-fin-copied]');
  let timer = 0;
  root.querySelector('[data-fin-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(config.email);
      out.textContent = 'Copiado';
    } catch {
      out.textContent = 'No se pudo';
    }
    clearTimeout(timer);
    timer = setTimeout(() => { out.textContent = ''; }, 1600);
  });
}

// hora real de Madrid; los ":" parpadean cada segundo (CSS)
function initClock(el) {
  const fmt = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false });
  let last = '';
  const tick = () => {
    const parts = fmt.formatToParts(new Date());
    const h = parts.find((p) => p.type === 'hour').value;
    const min = parts.find((p) => p.type === 'minute').value;
    if (h + min === last) return;
    last = h + min;
    el.innerHTML = `MADRID ${h}<span class="fin__colon">:</span>${min}`;
  };
  tick();
  setInterval(tick, 10000);
}

// caja en px de pantalla de una caja del SVG del logo (sin las transformaciones de las letras)
function boxOf(svg, b) {
  const vb = svg.viewBox.baseVal;
  const r = svg.getBoundingClientRect();
  const k = r.width / vb.width;
  const top = r.top + (b.y - vb.y) * k;
  return { top, h: b.height * k, cy: top + (b.height * k) / 2 };
}
function logoBBox(svg) {
  const ys = [...svg.querySelectorAll('.fin__l')].map((p) => p.getBBox().y);
  return { y: Math.min(...ys), height: 0 };
}
function wrap(a) { return a - TAU * Math.round(a / TAU); }
