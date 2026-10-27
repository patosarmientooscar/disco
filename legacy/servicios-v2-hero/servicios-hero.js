// LEGACY servicios v2 (commit eea12fe): la cabecera (initHead) y la luz roja que seguía al cursor (initLights),
// antes en js/servicios.js. Se llamaban desde init() con initHead({ gsap, ScrollTrigger, lenis, still, arrived }) e
// initLights({ ScrollTrigger, loop, still }).
const RED = { lerp: 0.04, rest: [0.82, 0.12] }; // la luz roja persigue al cursor con mucha inercia; sin ratón, arriba a la derecha
const HEAD_PARALLAX = { travel: 0.22, faster: 1.08 }; // las líneas del titular suben al hacer scroll; la 2.ª, un 8 % más rápida

// ---------- A) cabecera: líneas subiendo con máscara; parallax entre las dos líneas; "Ver cómo trabajamos" ----------
function initHead({ gsap, ScrollTrigger, lenis, still, arrived }) {
  const lines = document.querySelectorAll('[data-head-line]');
  const masks = [...document.querySelectorAll('[data-head-mask]')];
  const after = document.querySelectorAll('[data-head-after]');
  // baja con Lenis al proceso (sin JS, el ancla normal)
  document.querySelector('[data-to-proc]')?.addEventListener('click', (e) => {
    e.preventDefault();
    lenis.scrollTo('#proceso', { duration: still ? 0 : 1.8, easing: (t) => 1 - Math.pow(1 - t, 4), immediate: still });
  });
  if (still) return;
  gsap.set(lines, { yPercent: 105 });
  gsap.set(after, { opacity: 0, y: 14 });
  arrived.then(() => {
    gsap.timeline({ delay: 0.1 })
      .to(lines, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12 })
      .to(after, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.1 }, 0.45);
  });
  // parallax: las dos líneas suben con el scroll, la segunda un 8 % más rápida (se separan un poco)
  masks.forEach((m, i) => {
    gsap.to(m, {
      y: () => -innerHeight * HEAD_PARALLAX.travel * (i ? HEAD_PARALLAX.faster : 1),
      ease: 'none',
      scrollTrigger: { trigger: '[data-head]', start: 'top top', end: 'bottom top', scrub: 0.4, invalidateOnRefresh: true },
    });
  });
}

// ---------- luz roja de seguridad: sigue al cursor con mucha inercia y se apaga al llegar a los tres oficios ----------
function initLights({ ScrollTrigger, loop, still }) {
  const red = document.querySelector('[data-light-red]');
  if (!red) return;
  const s = { x: innerWidth * RED.rest[0], y: innerHeight * RED.rest[1], tx: innerWidth * RED.rest[0], ty: innerHeight * RED.rest[1], k: 1, key: '' };
  // 1 en la cabecera → 0 cuando los tres oficios ocupan la pantalla (degradado de luz, sin corte)
  ScrollTrigger.create({
    trigger: '[data-oficios]',
    start: 'top 90%',
    end: 'top 10%',
    scrub: true,
    onUpdate: (self) => { s.k = 1 - self.progress; },
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    s.tx = e.clientX;
    s.ty = e.clientY;
  }, { passive: true });
  window.addEventListener('resize', () => { if (still) { s.x = s.tx = innerWidth * RED.rest[0]; s.y = s.ty = innerHeight * RED.rest[1]; } });
  loop.add((time, ratio) => {
    const a = still ? 1 : 1 - Math.pow(1 - RED.lerp, ratio);
    if (!still) {
      s.x += (s.tx - s.x) * a;
      s.y += (s.ty - s.y) * a;
    }
    const key = `${s.x.toFixed(1)}|${s.y.toFixed(1)}|${s.k.toFixed(3)}`;
    if (key === s.key) return;
    s.key = key;
    red.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)`;
    red.style.opacity = s.k.toFixed(3);
  });
}

