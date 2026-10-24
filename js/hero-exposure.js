// Hero: "larga exposición". La foto del hero es gente bailando con el obturador abierto (estelas); al hacer
// scroll el titular baila igual: las dos líneas se abren como la pista, las letras se despegan con ritmo y,
// con velocidad, dejan una estela naranja. Al parar, la estela se recoge y el titular "dispara" (un brillo
// muy corto, como el clic de una cámara).
//   p (posición): 0 con el hero arriba del todo → 1 cuando ha subido el 70 % de su alto (scrub 1 + lerp)
//   v (velocidad): lenis.velocity suavizada, ±40 → vn de -1 a 1
// Va ENCIMA del telón (js/scroll-fx.js escala .hero__stage) y del parallax (mueve .hero__copy): aquí solo se
// mueven las líneas y las letras dentro del título. Solo transform, opacity, filter y la variable --trail.
// Con movimiento reducido no se usa (js/hero.js hace un fundido simple).
const P_END = 0.7;            // × alto del hero
const P_SCRUB = 1;
const P_LERP = 0.08;          // lerp extra sobre el scrub: como mantequilla
const V_MAX = 40;
const V_LERP = 0.12;
const TRAIL_RELEASE = 0.05;   // la estela crece con la velocidad (V_LERP) y se apaga más despacio
const OPEN = 9;               // vw que se desplaza cada línea (móvil: 6)
const OPEN_MOBILE = 6;
const WAVE_Y = 0.55;          // em
const WAVE_ROT = 7;           // deg
const WAVE_MOBILE = 0.6;      // las ondas, al 60 % en móvil
const TRACK = 0.1;            // em de más entre letras con p = 1 (letter-spacing -0.02em → 0.08em)
const EXIT = 0.55;            // desde aquí las letras se van, de los extremos al centro
const EXIT_SPREAD = 0.6;      // fracción de la salida que tarda en empezar la letra del centro
const EXIT_BLUR = 6;          // px
const TAIL = [0.05, 0.3];     // subtítulo y botones se van antes que las letras
const TAIL_Y = -12;           // px
// "disparo" al parar: de |vn| > 0.25 a |vn| < 0.03, como mucho uno cada 1.2 s
const SHOT = { armed: 0.25, still: 0.03, gap: 1.2, bright: 1.35, flash: 0.18, recoil: 0.6 };
// RITMO hace de ecualizador mientras hay velocidad: amplitud por letra y fase a 118 BPM (--beat)
const EQ_WORD = 'ritmo';
const EQ_AMP = [0.24, 0.12, 0.35, 0.18, 0.29];
const BPM = 118;
// menos de 55 fps sostenidos con el efecto activo: se quita, por este orden, el ecualizador (solo móvil),
// el desenfoque de la salida y el tercer eco
const FPS_MIN = 55;
const FPS_WINDOW = 1.5;       // s
const MOBILE = '(max-width: 767px)';
const EPS = 0.0005;

// Cada línea → palabras (<span class="hero__w">, nunca se parten) → letras (<span class="hero__ch">)
export function splitLetters(lines) {
  lines.forEach((line) => {
    const words = line.textContent.trim().split(/\s+/);
    line.textContent = '';
    words.forEach((word, i) => {
      const w = document.createElement('span');
      w.className = 'hero__w';
      [...word].forEach((ch) => {
        const c = document.createElement('span');
        c.className = 'hero__ch';
        c.textContent = ch;
        w.append(c);
      });
      line.append(w);
      if (i < words.length - 1) line.append(' ');
    });
  });
}

export function initExposure({ gsap, lenis, loop, hero, title, tail }) {
  const masks = [...title.querySelectorAll('.hero__line')];
  const mobile = matchMedia(MOBILE);

  // índices y pesos de cada letra, una vez (no dependen del tamaño)
  const chars = [];
  masks.forEach((mask, line) => {
    const list = [...mask.querySelectorAll('.hero__ch')];
    const text = mask.textContent;
    const mid = (text.length - 1) / 2;   // posición en la línea contando espacios (para el tracking)
    const midI = (list.length - 1) / 2;  // índice entre letras (para el peso)
    let k = 0;
    list.forEach((el, i) => {
      while (text[k] === ' ') k++;
      const d = midI ? Math.abs(i - midI) / midI : 0; // 0 en el centro, 1 en los extremos
      chars.push({
        el,
        line,
        wave: Math.sin(i * 0.55 + line * 1.7),
        turn: Math.sin(i * 0.9),
        w: 0.6 + 0.4 * d,                 // el centro se mueve menos y se lee más tiempo
        track: k - mid,
        delay: (1 - d) * EXIT_SPREAD,     // los extremos se van primero; el del medio, el último
        eq: -1,
      });
      k++;
    });
  });
  masks.forEach((mask) => {
    mask.querySelectorAll('.hero__w').forEach((w) => {
      if (w.textContent.toLowerCase() !== EQ_WORD) return;
      [...w.children].forEach((el, i) => {
        const c = chars.find((ch) => ch.el === el);
        c.eq = i;
        el.classList.add('hero__ch--eq');
      });
    });
  });

  // p con ScrollTrigger (scrub 1) y un lerp más en el loop
  const prog = { p: 0 };
  gsap.to(prog, {
    p: 1,
    ease: 'none',
    scrollTrigger: { start: 0, end: () => hero.offsetHeight * P_END, scrub: P_SCRUB, invalidateOnRefresh: true },
  });

  const state = { p: 0, vn: 0, trail: 0, eq: 0, recoil: null, armed: false, lastShot: -Infinity };
  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(hero);

  let resting = true;
  let lite = 0; // 1: sin ecualizador (móvil) · 2: sin desenfoque · 3: sin tercer eco
  const fps = { t: 0, frames: 0 };

  const shoot = (time) => {
    state.lastShot = time;
    gsap.fromTo(title, { filter: `brightness(${SHOT.bright})` }, { filter: 'brightness(1)', duration: SHOT.flash, ease: 'power2.out', clearProps: 'filter' });
    state.recoil = gsap.to(state, {
      trail: 0,
      duration: SHOT.recoil,
      ease: 'elastic.out(1, 0.5)',
      onComplete: () => { state.recoil = null; },
    });
  };

  // todo como al principio: letras rectas, sin estela, legible
  const rest = () => {
    resting = true;
    masks.forEach((m) => { m.style.transform = ''; });
    chars.forEach(({ el }) => { el.style.transform = ''; el.style.opacity = ''; el.style.filter = ''; });
    tail.style.opacity = '';
    tail.style.transform = '';
    tail.style.visibility = '';
    title.style.removeProperty('--trail');
    title.style.willChange = '';
    title.classList.remove('is-trailing');
  };

  loop.add((time, ratio) => {
    if (!onScreen || hero.classList.contains('is-covered')) return;
    const k = (a) => 1 - Math.pow(1 - a, ratio); // lerps independientes de los fps

    // --- velocidad ---
    const v = Math.max(-V_MAX, Math.min(V_MAX, lenis.velocity || 0)) / V_MAX;
    state.vn += (v - state.vn) * k(V_LERP);
    const speed = Math.abs(state.vn);
    if (state.recoil && speed > SHOT.armed) { state.recoil.kill(); state.recoil = null; }
    if (!state.recoil) {
      const grow = Math.abs(state.vn) > Math.abs(state.trail) || Math.sign(state.vn) !== Math.sign(state.trail);
      state.trail += (state.vn - state.trail) * k(grow ? V_LERP : TRAIL_RELEASE);
    }
    if (speed > SHOT.armed) state.armed = true;
    else if (state.armed && speed < SHOT.still) {
      state.armed = false;
      if (time - state.lastShot > SHOT.gap) shoot(time);
    }
    const eqOn = lite < 1 || !mobile.matches;
    state.eq += ((eqOn ? speed : 0) - state.eq) * k(V_LERP);

    // --- posición ---
    const target = prog.p;
    state.p += (target - state.p) * k(P_LERP);
    if (Math.abs(target - state.p) < EPS) state.p = target;
    if (Math.abs(state.trail) < EPS && !state.recoil) state.trail = 0;
    if (state.eq < EPS) state.eq = 0;
    if (Math.abs(state.vn) < EPS) state.vn = 0;

    const { p, trail, eq } = state;
    if (p === 0 && trail === 0 && eq === 0) {
      if (!resting) rest();
      return;
    }
    resting = false;

    // --- fps: con el efecto activo, si cae por debajo de 55 de forma sostenida, se aligera ---
    fps.t += ratio / 60;
    fps.frames++;
    if (fps.t >= FPS_WINDOW) {
      if (fps.frames / fps.t < FPS_MIN && lite < 3) {
        lite += lite === 0 && !mobile.matches ? 2 : 1;
        if (lite >= 3) title.classList.add('is-lite');
      }
      fps.t = 0;
      fps.frames = 0;
    }

    const small = mobile.matches;
    const open = (small ? OPEN_MOBILE : OPEN) * p * p; // power2.in: empieza suave
    const waveK = small ? WAVE_MOBILE : 1;
    const exit = Math.max(0, (p - EXIT) / (1 - EXIT));
    const blur = lite < 2;
    const beat = time * (BPM / 60) * Math.PI * 2;

    title.style.willChange = p > 0 ? 'transform' : '';
    title.style.setProperty('--trail', trail.toFixed(3));
    title.classList.toggle('is-trailing', trail !== 0);
    masks.forEach((m, i) => { m.style.transform = open ? `translate3d(${(i ? open : -open).toFixed(3)}vw,0,0)` : ''; });

    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const y = c.wave * p * WAVE_Y * c.w * waveK;
      const r = c.turn * p * WAVE_ROT * c.w * waveK;
      const x = c.track * TRACK * p;
      let t = `translate3d(${x.toFixed(4)}em,${y.toFixed(4)}em,0) rotate(${r.toFixed(3)}deg)`;
      if (c.eq >= 0 && eq) {
        const amp = EQ_AMP[c.eq % EQ_AMP.length];
        t += ` scaleY(${(1 + eq * amp * (0.55 + 0.45 * Math.sin(beat + c.eq * 1.9))).toFixed(4)})`;
      }
      c.el.style.transform = t;
      const out = Math.min(1, Math.max(0, (exit - c.delay) / (1 - EXIT_SPREAD)));
      c.el.style.opacity = out ? (1 - out).toFixed(3) : '';
      c.el.style.filter = out && blur ? `blur(${(out * EXIT_BLUR).toFixed(2)}px)` : '';
    }

    const tp = Math.min(1, Math.max(0, (p - TAIL[0]) / (TAIL[1] - TAIL[0])));
    tail.style.opacity = tp ? (1 - tp).toFixed(3) : '';
    tail.style.visibility = tp >= 1 ? 'hidden' : ''; // ya ido: sin botones invisibles clicables
    tail.style.transform = tp ? `translate3d(0,${(TAIL_Y * tp).toFixed(2)}px,0)` : '';
  });
}
