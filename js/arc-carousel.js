// "Para quién" (servicios.html; AT-C): carrusel de tarjetas con foto colgadas del borde de una rueda (porte a vanilla del
// "Arc Card Carousel" de 21st.dev, sin React ni Tailwind). Una sola variable, POS, mueve todas las tarjetas: cada una se
// coloca en el borde de la rueda según su distancia a POS; la de distancia 0 queda plana (la activa) y las demás se
// inclinan mirando al centro de la rueda. Para disco, la rueda está girada 90°: su centro, DEBAJO del escenario y
// centrado en horizontal, así que la tarjeta plana queda centrada un poco por encima de la mitad y las demás se abren en
// arco a izquierda y derecha. El scroll hace rodar la rueda (la sección es alta y su escenario, sticky: no es un pin, la
// página sigue bajando) y, al soltar, se asienta en la tarjeta más cercana con lenis.scrollTo (convive con Lenis sin
// tirones). Sin bucle infinito. Pie de la tarjeta activa: número / total, título y su línea. Clic o Enter en una tarjeta:
// la trae a la posición plana. El destello se pone en la esquina de la tarjeta plana (js/page-star.js: .is-flat y
// data-active). Todo en el ticker único (loop). Movimiento reducido: una fila de tarjetas normales con su texto debajo.
const STEP = 18 * (Math.PI / 180);   // grados entre tarjeta y tarjeta (el original, 14°: con la rueda girada se pisaban)
const GEO = { u: 0.47, cardW: 0.34, ratio: 1.65, R: 0.78, lift: 0.07 }; // proporciones (u = min(alto, ancho / 0.47))
const RING = 10;                      // como mínimo, tarjetas en la rueda (el corte queda fuera de pantalla)
const FOLLOW = 0.11;                  // s: la posición persigue al objetivo (1 − e^(−dt / 110 ms))
const SETTLE = { idle: 150, min: 0.5, max: 1.4 }; // ms sin scroll; s de asentado (según lo que falte)
const PER_STEP = 0.6;                 // alto de la sección: escenario × (1 + pasos × 0.6)
// AY-G, móvil (< 640 px): tarjetas al 70 % del ancho, 9° entre una y otra (una rueda más grande y plana: las de los
// lados asoman sin cortarse a medias), la plana centrada a un 34 % del alto (mitad de arriba), el pie justo debajo y
// siempre entero, y menos scroll por tarjeta
const MOB = { max: 640, cardW: 0.7, step: 9 * (Math.PI / 180), peek: 0.92, y: 0.34, perStep: 0.45 };
const CAP = { y: 14, dur: 0.6, stagger: 0.06 };
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initArcCarousel({ root, items, gsap, ScrollTrigger, lenis, loop, still }) {
  const n = items.length;
  if (!root || !n) return null;
  const stage = root.querySelector('[data-arc-stage]');
  const ring = root.querySelector('[data-arc-ring]');
  const cap = root.querySelector('[data-arc-cap]');
  const live = root.querySelector('[data-arc-live]');
  const card = (it, i, copy) => `<div class="arc__card" data-arc-card="${i}"${copy ? ' aria-hidden="true"' : ` role="button" tabindex="0" aria-label="${esc(it.name)}, ${i + 1} de ${n}"`}>
      ${it.photo ? `<img src="${esc(it.photo.src)}" width="${it.photo.w}" height="${it.photo.h}" sizes="(max-width: 639px) 70vw, 34vw" alt="${copy ? '' : esc(it.photo.alt || '')}" loading="lazy" decoding="async">` : ''}
    </div>`;

  // movimiento reducido: una fila de tarjetas normales, cada una con su texto debajo
  if (still) {
    root.classList.add('is-still');
    ring.innerHTML = items.map((it, i) => `<figure class="arc__flat">${card(it, i, false).replace(' role="button" tabindex="0"', '')}<figcaption><span class="arc__n">${pad(i + 1)} / ${pad(n)}</span><span class="arc__title">${esc(it.name)}</span><span class="arc__line">${esc(it.text)}</span></figcaption></figure>`).join('');
    return null;
  }

  // la rueda: la lista repetida hasta tener al menos RING tarjetas
  const size = Math.ceil(RING / n) * n;
  ring.innerHTML = Array.from({ length: size }, (_, i) => card(items[i % n], i % n, i >= n)).join('');
  const cards = [...ring.children];
  const offsetOf = (i, pos) => { let d = (((i - pos) % size) + size) % size; if (d >= size / 2) d -= size; return d; };

  // geometría (se mide en resize): u, tarjeta, radio y centro de la rueda (debajo del escenario, centrado)
  const g = { W: 0, H: 0, cw: 0, ch: 0, R: 0, hx: 0, hy: 0, step: STEP, per: PER_STEP };
  const measure = () => {
    g.W = stage.clientWidth;
    g.H = stage.clientHeight;
    if (g.W < MOB.max) {
      g.step = MOB.step;
      g.per = MOB.perStep;
      g.cw = MOB.cardW * g.W;
      g.ch = g.cw / GEO.ratio;
      // (el radio que separa una tarjeta de la siguiente un 92 % de su ancho)
      g.R = (MOB.peek * g.cw) / Math.sin(MOB.step);
      g.hx = g.W / 2;
      g.hy = MOB.y * g.H + g.R;
    } else {
      g.step = STEP;
      g.per = PER_STEP;
      const u = Math.min(g.H, g.W / GEO.u);
      g.cw = GEO.cardW * u;
      g.ch = g.cw / GEO.ratio;
      g.R = GEO.R * u;
      g.hx = g.W / 2;
      g.hy = g.H / 2 + g.R - GEO.lift * g.H;
    }
    root.style.setProperty('--arc-w', `${g.cw.toFixed(1)}px`);
    root.style.setProperty('--arc-h', `${g.ch.toFixed(1)}px`);
    // el pie, debajo de la tarjeta plana
    root.style.setProperty('--arc-cap', `${(g.hy - g.R + g.ch / 2 + Math.max(36, 0.05 * g.H)).toFixed(1)}px`);
    root.style.height = `${(innerHeight * (1 + (n - 1) * g.per)).toFixed(0)}px`;
    drawn = -1;
  };
  // cada tarjeta, en el borde de la rueda: ángulo desde arriba; x / y en el borde; girada como el radio
  const place = (el, d) => {
    const a = d * g.step;
    const x = g.hx + g.R * Math.sin(a) - g.cw / 2;
    const y = g.hy - g.R * Math.cos(a) - g.ch / 2;
    el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${(a * 180 / Math.PI).toFixed(3)}deg)`;
    el.style.zIndex = String(Math.round((size - d) * 10));
    // (las que quedan bajo la rueda, ocultas)
    el.style.visibility = Math.abs(a) > Math.PI * 0.55 ? 'hidden' : '';
  };

  // el pie: número / total, título y su línea; entra con y 14 → 0 y fundido, escalonado
  const capN = cap.querySelector('[data-arc-n]');
  const capT = cap.querySelector('[data-arc-title]');
  const capL = cap.querySelector('[data-arc-line]');
  let active = -1;
  const setActive = (k) => {
    if (k === active) return;
    active = k;
    capN.textContent = `${pad(k + 1)} / ${pad(n)}`;
    capT.textContent = items[k].name;
    capL.textContent = items[k].text;
    gsap.fromTo([capN, capT, capL], { y: CAP.y, opacity: 0 }, { y: 0, opacity: 1, duration: CAP.dur, ease: 'power2.out', stagger: CAP.stagger, overwrite: true });
    live.textContent = `${items[k].name}, ${k + 1} de ${n}`;
    root.dataset.active = String(k);
  };

  // el scroll: progreso de la sección → objetivo; la posición lo persigue (lerp por tiempo)
  const st = { pos: 0, target: 0, last: 0, settling: false, scrolledAt: 0, user: false };
  const trig = ScrollTrigger.create({
    trigger: root,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => { st.target = self.progress * (n - 1); },
    onRefresh: (self) => { st.target = self.progress * (n - 1); },
  });
  const yOf = (k) => trig.start + (trig.end - trig.start) * (k / (n - 1));
  lenis.on('scroll', () => { if (!st.settling) { st.scrolledAt = performance.now(); st.user = true; } });
  // al soltar (150 ms sin scroll) dentro de la sección: a la tarjeta más cercana, con una curva lenta
  const settle = () => {
    const k = Math.round(st.target);
    const y = yOf(k);
    const dist = Math.abs(st.target - k);
    if (dist < 0.004) return;
    st.settling = true;
    lenis.scrollTo(y, {
      duration: SETTLE.min + (SETTLE.max - SETTLE.min) * Math.min(1, dist * 2),
      easing: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2), // power2.inOut
      onComplete: () => { st.settling = false; },
    });
  };
  const go = (k) => { st.user = false; lenis.scrollTo(yOf(k), { duration: 0.9, easing: (t) => 1 - Math.pow(1 - t, 3) }); };
  cards.forEach((el) => {
    const k = +el.dataset.arcCard;
    el.addEventListener('click', () => go(k));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(k); } });
  });

  let drawn = -1;
  measure();
  window.addEventListener('resize', () => { measure(); ScrollTrigger.refresh(); });
  setActive(0);
  loop.add((time, ratio) => {
    const dt = ratio / 60;
    st.pos += (st.target - st.pos) * (1 - Math.exp(-dt / FOLLOW));
    if (Math.abs(st.target - st.pos) < 0.0005) st.pos = st.target;
    // asentado (solo con la sección en juego y sin el usuario moviéndola)
    const inside = lenis.scroll > trig.start - 2 && lenis.scroll < trig.end + 2;
    if (inside && st.user && !st.settling && performance.now() - st.scrolledAt > SETTLE.idle) { st.user = false; settle(); }
    if (st.pos === drawn) return;
    drawn = st.pos;
    cards.forEach((el, i) => place(el, offsetOf(i, st.pos)));
    // la plana: la más cercana a POS
    const k = Math.min(n - 1, Math.max(0, Math.round(st.pos)));
    setActive(k);
    cards.forEach((el, i) => el.classList.toggle('is-flat', i === k));
  });
  return { get active() { return active; }, flat: () => cards[active] };
}
