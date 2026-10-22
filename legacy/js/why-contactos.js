// "¿Por qué nosotros?" — hoja de contactos. Después del estudio "revelamos" el carrete: un negativo de
// 35 mm pasa en horizontal con el scroll; el fotograma que llega al centro pasa de negativo a positivo y
// un lápiz graso naranja lo marca (rectángulo a mano alzada + ✓), como al elegir la buena. Uno a la vez.
// Escritorio: pin (sticky en css/why.css) y la tira en x con scrub. Móvil: en vertical, cada fotograma se
// revela al cruzar la mitad de la pantalla. Movimiento reducido: todo en positivo y marcado, quieto.
const NEGATIVE = 'invert(1) hue-rotate(180deg) saturate(0.7) contrast(0.9)';
const POSITIVE = 'invert(0) hue-rotate(0deg) saturate(1) contrast(1)';
const ZONE = 0.08;             // ± ancho de pantalla alrededor del centro en el que un fotograma se revela
const FIRST = 0.12;            // p en el que el primer fotograma está en el centro…
const LAST = 0.88;             // …y el último
const SCRUB = 1.5;
const PARALLAX = 0.06;         // la foto va un 6% más lenta que su marco
const SHIFT_MAX = 34;          // px: lo que da de sí la foto (116% del marco)
const DIM = 0.35;              // texto de los fotogramas sin revelar

export function initWhy({ gsap, ScrollTrigger, reduced }) {
  const section = document.getElementById('porque');
  if (!section) return;
  const track = section.querySelector('[data-why-track]');
  const cells = [...section.querySelectorAll('[data-why-cell]')];
  const frames = cells.map((c) => c.querySelector('[data-why-frame]'));
  const imgs = cells.map((c) => c.querySelector('[data-why-img]'));
  const ambers = cells.map((c) => c.querySelector('.why__amber'));
  const captions = cells.map((c) => c.querySelector('[data-why-caption]'));
  const count = section.querySelector('[data-why-count]');
  const marks = frames.map((f, i) => buildMark(f, i));
  const layoutMarks = () => marks.forEach((m) => m.layout());
  window.addEventListener('resize', layoutMarks);
  imgs.forEach((img) => img.addEventListener('load', layoutMarks, { once: true }));
  layoutMarks();

  // las fotos se cargan cuando la sección está a una pantalla (en la tira, las de fuera no cuentan como cerca)
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    imgs.forEach((img) => { img.loading = 'eager'; });
  }, { rootMargin: '100% 0px' });
  io.observe(section);

  // --- movimiento reducido: positivas, marcadas y quietas ---
  if (reduced.matches) {
    section.classList.add('is-static');
    gsap.set(ambers, { opacity: 0 });
    marks.forEach((m) => m.show());
    requestAnimationFrame(layoutMarks);
    return;
  }

  gsap.set(imgs, { filter: NEGATIVE });
  gsap.set(captions, { opacity: DIM });

  // revelado: el del centro a positivo (0.9 s); el que se aleja vuelve a negativo despacio (1.2 s)
  let active = -1;
  const develop = (i, on) => {
    gsap.to(imgs[i], { filter: on ? POSITIVE : NEGATIVE, duration: on ? 0.9 : 1.2, ease: on ? 'power2.out' : 'power1.inOut', overwrite: 'auto' });
    gsap.to(ambers[i], { opacity: on ? 0 : 1, duration: on ? 0.9 : 1.2, ease: on ? 'power2.out' : 'power1.inOut', overwrite: 'auto' });
    gsap.to(captions[i], { opacity: on ? 1 : DIM, y: on ? -10 : 0, duration: 0.6, ease: 'expo.out', overwrite: 'auto' });
    if (on) marks[i].draw(); else marks[i].erase();
  };
  const setActive = (i) => {
    if (i === active) return;
    if (active >= 0) develop(active, false);
    if (i >= 0) {
      develop(i, true);
      count.textContent = String(i + 1).padStart(2, '0');
    }
    active = i;
  };

  gsap.matchMedia()
    // escritorio: la tira pasa por el centro; cada fotograma, centrado en su p (de FIRST a LAST)
    .add('(min-width: 768px)', () => {
      let centers = [];
      const measure = () => {
        centers = cells.map((c) => c.offsetLeft + c.offsetWidth / 2);
        layoutMarks();
      };
      const xAt = (p) => {
        const c0 = centers[0];
        const c1 = centers[centers.length - 1];
        return innerWidth / 2 - (c0 + ((p - FIRST) / (LAST - FIRST)) * (c1 - c0));
      };
      const shift = imgs.map((img) => gsap.quickSetter(img, 'x', 'px'));
      const tick = () => {
        const x = gsap.getProperty(track, 'x');
        let pick = -1;
        centers.forEach((c, i) => {
          const d = c + x - innerWidth / 2;
          if (Math.abs(d) < ZONE * innerWidth) pick = i;
          shift[i](gsap.utils.clamp(-SHIFT_MAX, SHIFT_MAX, -d * PARALLAX));
        });
        setActive(pick);
      };
      measure();
      gsap.fromTo(track, { x: () => { measure(); return xAt(0); } }, {
        x: () => xAt(1),
        ease: 'none',
        onUpdate: tick,
        scrollTrigger: {
          id: 'why',
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: SCRUB,
          invalidateOnRefresh: true,
        },
      });
      tick();
    })
    // móvil: en vertical; se revela el que cruza la mitad de la pantalla
    .add('(max-width: 767px)', () => {
      ScrollTrigger.create({ id: 'why', trigger: section, start: 'top top', end: 'bottom bottom' });
      frames.forEach((f, i) => {
        ScrollTrigger.create({
          trigger: f,
          start: 'top 50%',
          end: 'bottom 50%',
          onToggle: (self) => {
            if (self.isActive) setActive(i);
            else if (active === i) setActive(-1);
          },
        });
      });
      layoutMarks();
    });
}

// Marca de lápiz graso alrededor de la foto: un rectángulo torcido que no cierra y una ✓ en la esquina.
// Coordenadas en px de la foto (se rehace al cambiar de tamaño); cada fotograma, su propio pulso (semilla).
function buildMark(frame, i) {
  const photo = frame.querySelector('.why__photo');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'why__mark');
  svg.setAttribute('aria-hidden', 'true');
  const ring = document.createElementNS(ns, 'path');
  const tick = document.createElementNS(ns, 'path');
  [ring, tick].forEach((p) => { p.setAttribute('pathLength', '1'); svg.append(p); });
  frame.append(svg);
  const { gsap } = window;
  const P = 16; // margen del trazo alrededor de la foto

  return {
    layout() {
      const w = photo.offsetWidth;
      const h = photo.offsetHeight;
      if (!w) return;
      const rnd = seeded(i + 7);
      const j = (a) => (rnd() - 0.5) * 2 * a;
      Object.assign(svg.style, {
        left: `${photo.offsetLeft - P}px`,
        top: `${photo.offsetTop - P}px`,
        width: `${w + P * 2}px`,
        height: `${h + P * 2}px`,
      });
      svg.setAttribute('viewBox', `0 0 ${w + P * 2} ${h + P * 2}`);
      const x0 = P - 7;
      const y0 = P - 6;
      const x1 = w + P + 7;
      const y1 = h + P + 6;
      ring.setAttribute('d', [
        `M ${x0 + w * 0.12 + j(6)} ${y0 + j(3)}`,
        `Q ${(x0 + x1) / 2 + j(30)} ${y0 - 4 + j(3)} ${x1 + j(3)} ${y0 + 3 + j(3)}`,
        `Q ${x1 + 4 + j(3)} ${(y0 + y1) / 2 + j(30)} ${x1 - 3 + j(3)} ${y1 + j(3)}`,
        `Q ${(x0 + x1) / 2 + j(30)} ${y1 + 4 + j(3)} ${x0 + j(3)} ${y1 - 3 + j(3)}`,
        `Q ${x0 - 4 + j(3)} ${(y0 + y1) / 2 + j(30)} ${x0 + 4 + j(3)} ${y0 + 18 + j(5)}`,
      ].join(' '));
      const tx = x1 - 2;
      const ty = y0 + 2;
      tick.setAttribute('d', `M ${tx - 16} ${ty - 2} L ${tx - 7} ${ty + 9} L ${tx + 12} ${ty - 18}`);
    },
    draw() {
      gsap.killTweensOf([ring, tick]);
      gsap.timeline()
        .set([ring, tick], { opacity: 1 })
        .fromTo(ring, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, ease: 'power1.inOut' })
        .fromTo(tick, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.3, ease: 'power1.out' });
    },
    erase() {
      gsap.killTweensOf([ring, tick]);
      gsap.to([ring, tick], { opacity: 0, duration: 0.5, ease: 'power1.out', onComplete: () => gsap.set([ring, tick], { strokeDashoffset: 1 }) });
    },
    show() { gsap.set([ring, tick], { strokeDashoffset: 0, opacity: 1 }); },
  };
}

// pseudoaleatorio con semilla (mulberry32): el mismo trazo cada vez
function seeded(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
