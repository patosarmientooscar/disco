// "¿Por qué nosotros?" — enfoque de cámara. Las cuatro razones están a distintas distancias del objetivo;
// con el scroll el foco "viaja" de una a otra como un foquista: la activa nítida, las vecinas y las lejanas
// desenfocadas (interpolado continuo con el progreso, con un pequeño rebote de autofocus al llegar). La
// columna sube para que la activa quede siempre en el centro. Detrás, un bokeh cálido (canvas 2D a media
// resolución) que respira en cada cambio de foco; a la derecha, el anillo de diafragma gira y marca el
// progreso. Todo en el loop único (gsap.ticker), solo con la sección en pantalla.
// La hoja de contactos anterior está en legacy/js/why-contactos.js.
const SCRUB = 1.5;
const SMOOTH = 0.06;          // suavizado extra del progreso (por frame a 60 fps)
const EDGE = 0.06;            // al principio y al final del pin el foco se queda en la primera / última
const FOCUS = [               // por distancia al foco: activa, vecinas, lejanas
  { blur: 0, opacity: 1, scale: 1 },
  { blur: 10, opacity: 0.28, scale: 0.94 },
  { blur: 18, opacity: 0.12, scale: 0.9 },
];
const STOPS = ['f/1.4', 'f/2', 'f/2.8', 'f/4', 'f/5.6', 'f/8', 'f/11', 'f/16'];
const STOP_STEP = 20;         // grados entre cifras (8 cifras: 140° en total)
// qué cifra marca la línea índice según el foco (0 … 3): 01 → f/1.4–2.8, 02 → f/4, 03 → f/5.6–8, 04 → f/11–16
const RING_KEYS = [[-1, 0], [0, 1], [1, 3], [2, 4.5], [3, 6.5], [4, 7]];
const META_GAP = 14;          // px entre la palabra y su frase

export function initWhy({ gsap, ScrollTrigger, reduced, loop }) {
  const section = document.getElementById('porque');
  if (!section) return;
  const list = section.querySelector('[data-why-list]');
  const items = [...section.querySelectorAll('[data-why-item]')];
  const metas = items.map((it) => it.querySelector('.why__meta'));
  const sparks = items.map((it) => it.querySelector('.why__spark'));
  const small = () => innerWidth < 768;
  const bokeh = createBokeh(section.querySelector('[data-why-bokeh]'), small() ? 12 : 26);
  const ring = createRing(section.querySelector('[data-why-ring]'));

  // --- movimiento reducido: lista nítida, bokeh quieto ---
  if (reduced.matches) {
    section.classList.add('is-static');
    const still = () => { bokeh.resize(); bokeh.draw(0, 1, null); };
    still();
    window.addEventListener('resize', still);
    return;
  }

  // --- medidas sin transformaciones: posición natural de cada razón y alto de la frase de la activa ---
  let tops = [];
  let heights = [];
  let metaH = 0;
  const measure = () => {
    tops = items.map((it) => it.offsetTop);
    heights = items.map((it) => it.offsetHeight);
    metaH = Math.max(...metas.map((m) => m.offsetHeight)) + META_GAP * 2;
    bokeh.resize();
    applied = '';
  };

  const state = { p: 0 };
  gsap.to(state, {
    p: 1,
    ease: 'none',
    scrollTrigger: { id: 'why', trigger: section, start: 'top top', end: 'bottom bottom', scrub: SCRUB, invalidateOnRefresh: true },
  });
  ScrollTrigger.addEventListener('refresh', measure);
  window.addEventListener('resize', measure);

  // respiración del foco (todo el bokeh crece un 6% y vuelve) y rebote de autofocus de la activa
  const breath = { v: 1 };
  const bounce = items.map(() => ({ b: 0 }));
  let active = -1;
  let arrived = false;
  const activate = (i) => {
    const prev = active;
    active = i;
    arrived = false;
    if (prev >= 0) {
      gsap.to(metas[prev], { opacity: 0, y: -8, duration: 0.3, ease: 'power2.in', overwrite: 'auto' });
      gsap.to(sparks[prev], { scale: 0, rotate: 90, duration: 0.3, ease: 'power2.in', overwrite: 'auto' });
    }
    gsap.fromTo(metas[i], { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', overwrite: 'auto' });
    gsap.fromTo(sparks[i], { scale: 0, rotate: -120 }, { scale: 1, rotate: 0, duration: 0.6, ease: 'expo.out', overwrite: 'auto' });
    gsap.fromTo(breath, { v: 1 }, { v: 1.06, duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: 1, overwrite: true });
  };

  // mezcla de los tres estados de foco según la distancia (0 = activa, 1 = vecina, ≥ 2 = lejana)
  const focusAt = (d) => {
    const k = Math.min(d, 2);
    const a = FOCUS[Math.floor(k)];
    const b = FOCUS[Math.min(2, Math.floor(k) + 1)];
    const t = k - Math.floor(k);
    return { blur: a.blur + (b.blur - a.blur) * t, opacity: a.opacity + (b.opacity - a.opacity) * t, scale: a.scale + (b.scale - a.scale) * t };
  };

  let p = 0;
  let visible = false;
  let applied = '';
  loop.add((time, ratio) => {
    if (!visible || !tops.length) return;
    const prevP = p;
    p += (state.p - p) * (1 - Math.pow(1 - SMOOTH, ratio));
    if (Math.abs(state.p - p) < 1e-5) p = state.p;
    const n = items.length;
    const f = gsap.utils.clamp(0, 1, (p - EDGE) / (1 - EDGE * 2)) * (n - 1); // foco continuo: 0 … 3

    const i = Math.round(f);
    if (i !== active) activate(i);
    if (!arrived && Math.abs(f - i) < 0.03) {
      arrived = true;
      gsap.timeline().to(bounce[i], { b: 1.5, duration: 0.12, ease: 'power1.out' }).to(bounce[i], { b: 0, duration: 0.23, ease: 'power1.in' });
    }

    // las de después de la activa bajan para dejar sitio a su frase
    const push = items.map((_, k) => metaH * gsap.utils.clamp(0, 1, k - f));
    const center = (k) => tops[k] + push[k] + heights[k] / 2;
    const lo = Math.floor(f);
    const hi = Math.min(n - 1, lo + 1);
    const c = center(lo) + (center(hi) - center(lo)) * (f - lo);
    const listY = innerHeight / 2 - c;

    const key = `${f.toFixed(4)}|${bounce.map((o) => o.b.toFixed(2)).join()}|${breath.v.toFixed(3)}|${listY.toFixed(1)}`;
    if (key !== applied) {
      applied = key;
      list.style.transform = `translate3d(0, ${listY}px, 0)`;
      items.forEach((it, k) => {
        const st = focusAt(Math.abs(k - f));
        const blur = st.blur + bounce[k].b;
        it.style.transform = `translate3d(0, ${push[k]}px, 0) scale(${st.scale})`;
        it.style.opacity = st.opacity;
        it.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
      });
      // banda de la razón activa (en pantalla): el bokeh se apaga ahí para no restar contraste
      const top = innerHeight / 2 - heights[i] / 2 - 24;
      bokeh.draw(p, breath.v, { top, bottom: top + heights[i] + metaH, right: list.getBoundingClientRect().right });
      ring.turn(-STOP_STEP * ringStop(fRing(p)));
    } else if (p !== prevP) {
      ring.turn(-STOP_STEP * ringStop(fRing(p)));
    }
  });

  ring.turn(0);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '10% 0px' }).observe(section);
  measure();
  requestAnimationFrame(measure); // con las fuentes ya puestas
  document.fonts?.ready.then(measure);
}

// foco extendido para el anillo: de -1 (principio del pin) a 4 (final), 0 … 3 en las razones
function fRing(p) {
  if (p < EDGE) return -1 + p / EDGE;
  if (p > 1 - EDGE) return 3 + (p - (1 - EDGE)) / EDGE;
  return ((p - EDGE) / (1 - EDGE * 2)) * 3;
}
function ringStop(f) {
  let i = 1;
  while (i < RING_KEYS.length - 1 && f > RING_KEYS[i][0]) i++;
  const [f0, k0] = RING_KEYS[i - 1];
  const [f1, k1] = RING_KEYS[i];
  return k0 + (k1 - k0) * Math.max(0, Math.min(1, (f - f0) / (f1 - f0)));
}

// ---------- bokeh: 26 círculos desenfocados en 3 capas de profundidad (parallax), a media resolución ----------
function createBokeh(canvas, count) {
  const g = canvas.getContext('2d');
  const rnd = seeded(11);
  const COLORS = [
    () => `rgba(243, 84, 17, ${0.1 + rnd() * 0.12})`,
    () => `rgba(255, 210, 189, ${0.18 + rnd() * 0.12})`,
    () => 'rgba(255, 255, 255, 0.5)',
  ];
  const dots = Array.from({ length: count }, () => {
    const r = 40 + rnd() * 180;
    const layer = r > 150 ? 0 : r > 90 ? 1 : 2;       // los grandes y borrosos, detrás y más lentos
    return { x: rnd(), y: rnd() * 1.8, r, layer, color: COLORS[Math.floor(rnd() * 3)]() };
  }).sort((a, b) => a.layer - b.layer);
  const SPEED = [0.35, 0.65, 1];
  let w = 0;
  let h = 0;
  const scale = 0.5;
  return {
    resize() {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
    },
    draw(p, breath, band) {
      if (!w) return;
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.clearRect(0, 0, w, h);
      dots.forEach((d) => {
        const r = d.r * breath;
        const x = d.x * w;
        const y = (d.y - p * 0.8 * SPEED[d.layer]) * h;
        if (y < -r || y > h + r) return;
        // detrás de la razón activa, más apagado
        const hit = band && x - r < band.right && y + r > band.top && y - r < band.bottom;
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, d.color);
        grad.addColorStop(0.7, d.color);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        g.globalAlpha = hit ? 0.35 : 1;
        g.fillStyle = grad;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      });
      g.globalAlpha = 1;
    },
  };
}

// ---------- anillo de diafragma (SVG): marcas cada 6°, cifras f/…, línea índice naranja a las 9 ----------
function createRing(el) {
  if (!el) return { turn() {} };
  const R = 209;
  const ticks = [];
  for (let a = 0; a < 360; a += 6) {
    const long = a % 30 === 0;
    const rad = (a * Math.PI) / 180;
    const r0 = long ? R - 16 : R - 9;
    ticks.push(`<line class="tick" x1="${(Math.cos(rad) * r0).toFixed(2)}" y1="${(Math.sin(rad) * r0).toFixed(2)}" x2="${(Math.cos(rad) * R).toFixed(2)}" y2="${(Math.sin(rad) * R).toFixed(2)}"/>`);
  }
  // cifra k en el ángulo 180 + 20k: pasa por la línea índice (180°, a las 9) cuando el anillo ha girado −20k
  const labels = STOPS.map((s, k) => {
    const a = 180 + STOP_STEP * k;
    const rad = (a * Math.PI) / 180;
    const x = Math.cos(rad) * (R - 34);
    const y = Math.sin(rad) * (R - 34);
    return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" transform="rotate(${a - 180} ${x.toFixed(2)} ${y.toFixed(2)})">${s}</text>`;
  });
  el.innerHTML = `<svg viewBox="-210 -210 420 420" focusable="false"><g data-rot><circle r="${R}"/>${ticks.join('')}${labels.join('')}</g><line class="index" x1="-226" y1="0" x2="-200" y2="0"/></svg>`;
  const rot = el.querySelector('[data-rot]');
  const texts = [...el.querySelectorAll('text')];
  let on = -1;
  let last = null;
  return {
    turn(deg) {
      if (last !== null && Math.abs(deg - last) < 0.01) return;
      last = deg;
      rot.setAttribute('transform', `rotate(${deg.toFixed(2)})`);
      const k = Math.max(0, Math.min(STOPS.length - 1, Math.round(-deg / STOP_STEP)));
      if (k !== on) {
        texts[on]?.classList.remove('is-on');
        texts[k].classList.add('is-on');
        on = k;
      }
    },
  };
}

// pseudoaleatorio con semilla (mulberry32): el mismo bokeh cada vez
function seeded(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
