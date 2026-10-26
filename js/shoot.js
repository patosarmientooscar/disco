import { shots } from './servicios-data.js';

// Foto: "Dispara" (servicios.html, css/servicios.css). En disco la foto nace del flash: una sala a oscuras
// (pin de 400vh; 300vh en móvil) donde el usuario hace las fotos.
//   · LA LINTERNA: el cursor es una luz tenue (radial de 240 px, borde muy suave, lerp .12) que deja ver la foto
//     escondida al 22 % de brillo, desaturada y con grano (canvas 2D). Táctil / móvil: sin linterna, la foto
//     escondida se ve entera al 22 %.
//   · EL DISPARO: cada tramo de scroll (o un clic / toque en la sala) dispara el flash (0 → .9 → 0 en 0.22 s,
//     subida instantánea y caída exponencial), la foto aparece entera y a color, "congelada" (zoom 1.04 → 1), y
//     encima, 0.6 s, una imagen residual en negativo naranja. Nunca más de 3 flashes por segundo.
//   · EL MURO: cada foto disparada se encoge hasta su sitio en el muro (rotación ±3°, profundidad, parallax con
//     el ratón por capas); la última se queda en el centro. Al final del pin, un último flash enciende el muro
//     entero y sus fotos se pueden abrir en grande (dialog: Esc, flechas).
// Al volver a subir, las fotos vuelven del muro a la oscuridad (sin flash). Movimiento reducido: sin pin, flash
// ni linterna; las fotos aparecen en el muro con un fundido.
const TORCH = { r: 240, lerp: 0.12, bright: 0.22, sat: 0.15, grain: 0.32, fade: 6 };
const FLASH = { peak: 0.9, dur: 0.22, after: 0.6, gap: 1 / 3 };  // gap: mínimo entre flashes (≤ 3 por segundo)
const BACK_GAP = 0.12;     // s entre pasos hacia atrás (sin flash)
const HOLD = 0.55;         // s que la foto se queda "congelada" antes de irse al muro
const PARALLAX = 26;       // px de recorrido con profundidad 1 (ratón en el borde)
const MOUSE_LERP = 0.06;
// muro: centro (x, y) y ancho (w) como fracción de la sala, giro (°) y profundidad (z: 0.4 fondo → 1 delante).
// En escritorio, nada en la esquina de arriba a la izquierda (el texto); la última foto va en el marco (FRAME)
const SLOTS = {
  desktop: [
    { x: 0.17, y: 0.8, w: 0.18, r: -2.5, z: 0.55 },
    { x: 0.92, y: 0.28, w: 0.15, r: 2.8, z: 0.45 },
    { x: 0.37, y: 0.88, w: 0.15, r: 2.2, z: 0.85 },
    { x: 0.46, y: 0.19, w: 0.12, r: -1.6, z: 0.7 },
    { x: 0.93, y: 0.7, w: 0.15, r: -3, z: 0.9 },
    { x: 0.76, y: 0.91, w: 0.16, r: 1.4, z: 0.6 },
    { x: 0.79, y: 0.13, w: 0.13, r: -2.2, z: 0.4 },
    { x: 0.07, y: 0.94, w: 0.13, r: 3, z: 0.75 },
    { x: 0.56, y: 0.92, w: 0.13, r: 2, z: 0.8 },
  ],
  mobile: [
    { x: 0.2, y: 0.9, w: 0.3, r: -3, z: 0.6 },
    { x: 0.8, y: 0.9, w: 0.28, r: 2.5, z: 0.8 },
    { x: 0.87, y: 0.5, w: 0.24, r: 3, z: 0.5 },
    { x: 0.13, y: 0.52, w: 0.22, r: -2, z: 0.7 },
    { x: 0.5, y: 0.96, w: 0.22, r: 1.5, z: 0.9 },
    { x: 0.92, y: 0.72, w: 0.2, r: -2.5, z: 0.45 },
    { x: 0.09, y: 0.73, w: 0.2, r: 2, z: 0.65 },
    { x: 0.6, y: 0.47, w: 0.18, r: -1, z: 0.4 },
    { x: 0.35, y: 0.47, w: 0.18, r: 1.2, z: 0.55 },
  ],
};
// el marco donde espera la foto escondida (y donde aparece al disparar): centro y caja máxima (fracciones)
const FRAME = { desktop: { x: 0.665, y: 0.53, w: 0.37, h: 0.6 }, mobile: { x: 0.5, y: 0.7, w: 0.8, h: 0.32 } };

export function initShoot({ gsap, ScrollTrigger, lenis, loop, still }) {
  const section = document.querySelector('[data-shoot]');
  if (!section) return;
  const pin = section.querySelector('.sv-shoot__pin');
  const room = section.querySelector('[data-room]');
  const frame = section.querySelector('[data-frame]');
  const torch = section.querySelector('[data-torch]');
  const dim = section.querySelector('[data-dim]');
  const wall = section.querySelector('[data-wall]');
  const shot = section.querySelector('[data-shot]');
  const shotImg = shot.querySelector('.sv-shoot__img');
  const after = shot.querySelector('.sv-shoot__after');
  const flash = section.querySelector('[data-flash]');
  const glow = section.querySelector('[data-glow]');
  const hint = section.querySelector('[data-hint]');
  const n = shots.length;
  const mobile = matchMedia('(max-width: 899px)');
  const touch = matchMedia('(hover: none), (pointer: coarse)');
  const noTorch = () => mobile.matches || touch.matches;

  // --- el muro: un botón por foto (ampliar) ---
  wall.innerHTML = shots.map((s, i) => `<li class="sv-wall__item" data-i="${i}"><span class="sv-wall__par"><button class="sv-wall__btn" type="button" aria-label="Ampliar foto: ${s.alt}"><img src="${s.src}" alt="${s.alt}" decoding="async"></button></span></li>`).join('');
  const items = [...wall.children].map((li, i) => ({
    li, i, par: li.firstElementChild, img: li.querySelector('img'), btn: li.querySelector('button'),
    ratio: 1.33, box: null, px: 0, py: 0,
  }));
  const lb = lightbox({ lenis });
  items.forEach((it) => {
    it.btn.addEventListener('click', (e) => {
      // con el ratón, solo al final (antes, un clic en la sala dispara); con teclado, siempre
      if (!still && !done && e.detail !== 0) return;
      e.stopPropagation();
      lb.open(it.i, it.btn);
    });
  });

  // --- movimiento reducido: el muro en rejilla; cada foto aparece con un fundido al entrar ---
  if (still) {
    section.classList.add('is-still');
    items.forEach((it) => new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      it.li.classList.add('is-in');
    }, { threshold: 0.3 }).observe(it.li));
    return;
  }

  // --- geometría: el marco (con la proporción de la foto escondida) y el sitio de cada foto en el muro ---
  let cur = 0;          // foto escondida ahora (n = ninguna: ya están todas en el muro)
  const frameBox = (k) => {
    const W = room.clientWidth;
    const H = room.clientHeight;
    const F = mobile.matches ? FRAME.mobile : FRAME.desktop;
    const r = items[Math.min(k, n - 1)].ratio;
    let w = F.w * W;
    let h = w / r;
    if (h > F.h * H) { h = F.h * H; w = h * r; }
    return { x: F.x * W - w / 2, y: F.y * H - h / 2, w, h };
  };
  const place = (el, b) => {
    el.style.left = `${b.x.toFixed(1)}px`;
    el.style.top = `${b.y.toFixed(1)}px`;
    el.style.width = `${b.w.toFixed(1)}px`;
    el.style.height = `${b.h.toFixed(1)}px`;
  };
  const layout = () => {
    const W = room.clientWidth;
    const H = room.clientHeight;
    const S = mobile.matches ? SLOTS.mobile : SLOTS.desktop;
    items.forEach((it, i) => {
      if (i === n - 1) {
        it.box = { ...frameBox(i), r: 0, z: 1 };
      } else {
        const s = S[i % S.length];
        const w = s.w * W;
        const h = w / it.ratio;
        it.box = { x: s.x * W - w / 2, y: s.y * H - h / 2, w, h, r: s.r, z: s.z };
      }
      place(it.li, it.box);
      if (it.li.classList.contains('is-on') && !it.flying) gsap.set(it.li, { rotate: it.box.r });
    });
    place(frame, frameBox(cur));
    sizeTorch();
  };

  // --- la foto escondida: linterna (canvas) o, en táctil / móvil, entera al 22 % (img con filtro) ---
  const ctx = torch.getContext('2d');
  const cache = new Map(); // `${k}|${w}|${h}` → canvas procesado (desaturado, 22 %)
  const noise = makeNoise(128);
  const pattern = ctx.createPattern(noise, 'repeat');
  let dpr = Math.min(devicePixelRatio || 1, 1.5);
  const sizeTorch = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(frame.clientWidth * dpr));
    const h = Math.max(1, Math.round(frame.clientHeight * dpr));
    if (torch.width !== w || torch.height !== h) { torch.width = w; torch.height = h; }
    torchDirty = true;
  };
  const processed = (k) => {
    const key = `${k}|${torch.width}|${torch.height}`;
    if (cache.has(key)) return cache.get(key);
    const img = items[k].img;
    if (!img.complete || !img.naturalWidth) return null;
    const c = document.createElement('canvas');
    c.width = torch.width;
    c.height = torch.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, c.width, c.height); // el marco ya tiene la proporción de la foto
    const data = g.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = (L + (d[i] - L) * TORCH.sat) * TORCH.bright;
      d[i + 1] = (L + (d[i + 1] - L) * TORCH.sat) * TORCH.bright;
      d[i + 2] = (L + (d[i + 2] - L) * TORCH.sat) * TORCH.bright;
    }
    g.putImageData(data, 0, 0);
    cache.forEach((_, kk) => { if (!kk.endsWith(`|${c.width}|${c.height}`)) cache.delete(kk); });
    cache.set(key, c);
    return c;
  };
  const setHidden = (k) => {
    cur = k;
    place(frame, frameBox(Math.min(k, n - 1)));
    sizeTorch();
    if (k < n) { dim.src = shots[k].src; dim.alt = ''; }
    frame.classList.toggle('is-empty', k >= n);
  };

  // --- ratón: linterna, brillo tenue en la sala, pista y parallax del muro ---
  const m = { x: 0, y: 0, tx: 0, ty: 0, in: false, a: 0, mx: 0, my: 0, tmx: 0, tmy: 0, hx: 0, hy: 0 };
  let torchDirty = true;
  pin.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = room.getBoundingClientRect();
    m.tx = e.clientX - r.left;
    m.ty = e.clientY - r.top;
    m.tmx = (e.clientX - r.left) / r.width - 0.5;
    m.tmy = (e.clientY - r.top) / r.height - 0.5;
    if (!m.in) { m.x = m.tx; m.y = m.ty; m.hx = m.tx; m.hy = m.ty; }
    m.in = true;
  }, { passive: true });
  pin.addEventListener('pointerleave', () => { m.in = false; });

  // --- disparos: cuántos van (shown), si ya se encendió el muro (done) y hacia dónde va (target) ---
  let shown = 0;
  let done = false;
  let scrollCount = 0;
  let clickCount = 0;
  let nextAt = 0;
  let landing = null; // { k, call }
  let first = true;
  const level = () => shown + (done ? 1 : 0);
  const target = () => Math.max(scrollCount, clickCount);

  const flashFx = () => {
    gsap.fromTo(flash, { opacity: FLASH.peak }, { opacity: 0, duration: FLASH.dur, ease: 'expo.out', overwrite: true });
  };
  const fly = (it, from, to, dur, ease, onDone) => {
    const sx = from.w / to.w;
    it.flying = true;
    gsap.fromTo(it.li, {
      x: from.x + from.w / 2 - (to.x + to.w / 2),
      y: from.y + from.h / 2 - (to.y + to.h / 2),
      scale: sx,
      rotate: from.r ?? 0,
    }, { x: 0, y: 0, scale: 1, rotate: to.r ?? 0, duration: dur, ease, overwrite: true, onComplete: () => { it.flying = false; onDone?.(); } });
  };
  // la foto congelada se va a su sitio del muro (la última se queda en el marco)
  const land = (k) => {
    if (!landing || landing.k !== k) return;
    landing.call?.kill();
    landing = null;
    const it = items[k];
    const fb = frameBox(k);
    // recién disparada sigue encendida y se apaga despacio en la oscuridad (transición del filtro, CSS)
    it.li.classList.add('is-on', 'is-lit');
    requestAnimationFrame(() => requestAnimationFrame(() => it.li.classList.remove('is-lit')));
    gsap.set(shot, { opacity: 0 });
    if (k === n - 1) gsap.set(it.li, { x: 0, y: 0, scale: 1, rotate: 0 });
    else fly(it, { ...fb, r: 0 }, it.box, 0.9, 'expo.inOut');
    setHidden(k + 1);
  };
  const fire = () => {
    const k = shown;
    if (landing) land(landing.k);
    flashFx();
    if (k >= n) { // el último flash: se enciende el muro entero
      done = true;
      section.classList.add('is-done');
      return;
    }
    shown++;
    if (first) { first = false; section.classList.add('is-shot'); }
    // la foto, congelada en el marco: entera, nítida y a color; encima, la imagen residual
    shotImg.src = shots[k].src;
    after.src = shots[k].src;
    frame.classList.add('is-empty');
    gsap.set(shot, { opacity: 1 });
    gsap.fromTo(shotImg, { scale: 1.04 }, { scale: 1, duration: 0.9, ease: 'expo.out', overwrite: true });
    gsap.fromTo(after, { opacity: 0.75, scale: 1.02 }, { opacity: 0, scale: 1, duration: FLASH.after, ease: 'power2.out', overwrite: true });
    landing = { k, call: gsap.delayedCall(HOLD, () => land(k)) };
  };
  const unfire = () => {
    if (landing) land(landing.k);
    if (done) {
      done = false;
      section.classList.remove('is-done');
      return;
    }
    const k = shown - 1;
    if (k < 0) return;
    shown--;
    const it = items[k];
    // vuelve del muro a la oscuridad (al marco), y desde ahí se esconde
    const fb = frameBox(k);
    setHidden(k);
    frame.classList.add('is-empty');
    if (k === n - 1) { it.li.classList.remove('is-on'); frame.classList.remove('is-empty'); return; }
    gsap.to(it.li, {
      x: fb.x + fb.w / 2 - (it.box.x + it.box.w / 2),
      y: fb.y + fb.h / 2 - (it.box.y + it.box.h / 2),
      scale: fb.w / it.box.w,
      rotate: 0,
      duration: 0.6,
      ease: 'expo.inOut',
      overwrite: true,
      onComplete: () => {
        it.li.classList.remove('is-on');
        gsap.set(it.li, { x: 0, y: 0, scale: 1, rotate: it.box.r });
        if (cur === k) frame.classList.remove('is-empty');
      },
    });
  };

  // scroll: tramos iguales; n disparos y el último flash (n + 1)
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      const c = Math.min(n + 1, Math.floor(self.progress * (n + 2)));
      if (c < scrollCount) clickCount = c; // al subir, también se deshacen los disparos de clic
      scrollCount = c;
    },
  });
  // clic o toque en la sala: un disparo más
  pin.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    clickCount = Math.min(n + 1, target() + 1);
  });

  // --- un solo loop (solo con la sección cerca) ---
  let near = false;
  new IntersectionObserver(([e]) => {
    near = e.isIntersecting;
    if (near) items.forEach((it) => { it.img.loading = 'eager'; });
  }, { rootMargin: '50% 0px' }).observe(section);
  let grainAt = 0;
  let gx = 0;
  let gy = 0;
  loop.add((time, ratio) => {
    if (!near) return;
    const dt = ratio / 60;
    // disparos pendientes: hacia delante con flash (≤ 3/s), hacia atrás sin flash
    const t = target();
    const l = level();
    if (t !== l && time >= nextAt) {
      if (t > l) { fire(); nextAt = time + FLASH.gap; } else { unfire(); nextAt = time + BACK_GAP; }
    }

    const a = 1 - Math.pow(1 - TORCH.lerp, ratio);
    m.x += (m.tx - m.x) * a;
    m.y += (m.ty - m.y) * a;
    m.hx += (m.tx - m.hx) * a;
    m.hy += (m.ty - m.hy) * a;
    const showTorch = m.in && !noTorch() && cur < n;
    const aTo = showTorch ? 1 : 0;
    const prevA = m.a;
    m.a += (aTo - m.a) * (1 - Math.exp(-TORCH.fade * dt));
    if (Math.abs(aTo - m.a) < 0.002) m.a = aTo;
    glow.style.transform = `translate3d(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px, 0)`;
    glow.style.opacity = (m.in && !noTorch() ? 1 : 0).toString();
    if (!first || section.classList.contains('is-shot')) hint.style.opacity = '0';
    else if (!noTorch()) {
      hint.style.opacity = m.in ? '1' : '0';
      hint.style.transform = `translate3d(${(m.hx + 18).toFixed(1)}px, ${(m.hy + 18).toFixed(1)}px, 0)`;
    }

    // parallax del muro por capas
    const b = 1 - Math.pow(1 - MOUSE_LERP, ratio);
    m.mx += ((m.in ? m.tmx : 0) - m.mx) * b;
    m.my += ((m.in ? m.tmy : 0) - m.my) * b;
    if (!noTorch()) {
      items.forEach((it) => {
        const px = -m.mx * 2 * PARALLAX * it.box?.z || 0;
        const py = -m.my * 2 * PARALLAX * it.box?.z || 0;
        if (Math.abs(px - it.px) < 0.05 && Math.abs(py - it.py) < 0.05) return;
        it.px = px;
        it.py = py;
        it.par.style.transform = `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0)`;
      });
    }

    // linterna: la foto escondida, con grano, enmascarada con un radial en el cursor
    const grainTick = time - grainAt > 1 / 12;
    if (m.a <= 0 && prevA <= 0 && !torchDirty) return;
    if (m.a <= 0) { ctx.clearRect(0, 0, torch.width, torch.height); torchDirty = false; return; }
    if (!grainTick && Math.abs(m.tx - m.x) < 0.2 && Math.abs(m.ty - m.y) < 0.2 && m.a === prevA && !torchDirty) return;
    if (grainTick) { grainAt = time; gx = Math.random() * 128; gy = Math.random() * 128; }
    const src = cur < n ? processed(cur) : null;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, torch.width, torch.height);
    if (!src) return;
    torchDirty = false;
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = TORCH.grain;
    ctx.save();
    ctx.translate(-gx, -gy);
    ctx.fillStyle = pattern;
    ctx.fillRect(gx, gy, torch.width, torch.height);
    ctx.restore();
    // máscara: radial de 240 px en el cursor (coordenadas del marco)
    const fx = (m.x - frame.offsetLeft) * dpr;
    const fy = (m.y - frame.offsetTop) * dpr;
    const R = TORCH.r * dpr;
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, R);
    g.addColorStop(0, `rgba(0,0,0,${m.a})`);
    g.addColorStop(0.45, `rgba(0,0,0,${(0.82 * m.a).toFixed(3)})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, torch.width, torch.height);
  });

  // pista: en táctil, "Toca para disparar" (quieta, abajo)
  const hintText = hint.querySelector('[data-hint-text]');
  const setHint = () => {
    hintText.textContent = noTorch() ? 'Toca para disparar' : 'Haz scroll o pulsa para disparar';
    hint.classList.toggle('is-touch', noTorch());
    if (noTorch()) hint.style.transform = '';
  };
  setHint();
  mobile.addEventListener('change', () => { setHint(); layout(); });
  // cada foto, con su proporción real en cuanto carga
  items.forEach((it) => {
    const ready = () => { if (it.img.naturalWidth) { it.ratio = it.img.naturalWidth / it.img.naturalHeight; layout(); } };
    if (it.img.complete) ready(); else it.img.addEventListener('load', ready, { once: true });
  });
  window.addEventListener('resize', () => requestAnimationFrame(layout));
  layout();
  setHidden(0);
}

// grano: ruido gris en una tesela
function makeNoise(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// foto ampliada: <dialog> (Esc lo cierra; flechas para pasar; clic fuera de la foto, cierra)
function lightbox({ lenis }) {
  const dlg = document.querySelector('[data-lb]');
  const img = dlg.querySelector('[data-lb-img]');
  const cap = dlg.querySelector('[data-lb-cap]');
  const n = shots.length;
  let i = 0;
  let opener = null;
  const show = (k) => {
    i = (k + n) % n;
    img.src = shots[i].src;
    img.alt = shots[i].alt;
    cap.textContent = shots[i].alt;
  };
  dlg.querySelector('[data-lb-prev]').addEventListener('click', () => show(i - 1));
  dlg.querySelector('[data-lb-next]').addEventListener('click', () => show(i + 1));
  dlg.querySelector('[data-lb-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { lenis.start(); opener?.focus(); });
  return {
    open(k, from) {
      opener = from;
      show(k);
      dlg.showModal();
      lenis.stop();
    },
  };
}
