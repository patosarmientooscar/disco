import { config } from './config.js';

// Nav flotante de cristal. Al pulsar MENÚ no sale un panel debajo: la propia píldora se transforma en el menú.
//   1 (0–0.35 s)    el logo y CONTACTO se desvanecen y encogen; "MENÚ" → "CERRAR" y sus dos líneas → X
//   2 (0.2–1.0 s)   la píldora crece (ancho, alto y radio) con expo.inOut
//   3 (0.55 s →)    las páginas entran desde abajo con máscara, una a una
// Cerrar (CERRAR, Esc, clic fuera o en un enlace): lo mismo al revés en 0.8 s. Foco atrapado mientras está
// abierto; vuelve al botón al cerrar. Además: flotación sutil, aparición con "disco:intro-done" en la home y
// tinta blanca/negra según la sección de debajo. (El panel desplegable anterior está en la historia de git.)
const OPEN_W = 460;          // ancho abierto: min(460px, 92vw); móvil (≤639px): todo el ancho menos 24px
const CLOSE_SECONDS = 0.8;

export function initNav({ gsap, ScrollTrigger, reduced }) {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return { appear() {}, watchInk() {} };

  const float = nav.querySelector('.nav__float');
  const bar = nav.querySelector('.nav__bar');
  const toggle = nav.querySelector('[data-nav-toggle]');
  const logo = nav.querySelector('.nav__logo');
  const link = nav.querySelector('.nav__link');
  const panel = document.getElementById(toggle.getAttribute('aria-controls'));
  const items = [...panel.querySelectorAll('.nav__item')];
  const mobile = matchMedia('(max-width: 639px)');

  // --- montaje: el panel pasa dentro de la píldora; textos del botón para el cruce; estrellita en cada página ---
  bar.append(panel);
  const label = [...toggle.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
  const labels = document.createElement('span');
  labels.className = 'nav__label';
  labels.innerHTML = '<span class="nav__label-a">Menú</span><span class="nav__label-b" aria-hidden="true">Cerrar</span>';
  label?.replaceWith(labels);
  const [labelA, labelB] = labels.children;
  items.forEach((a) => {
    const word = document.createElement('span');
    word.className = 'nav__word';
    word.textContent = a.textContent;
    a.textContent = '';
    a.append(Object.assign(document.createElement('i'), { className: 'nav__spark' }), word);
    a.firstChild.setAttribute('aria-hidden', 'true');
  });
  const meta = document.createElement('p');
  meta.className = 'nav__meta';
  meta.innerHTML = `<a href="${config.instagram.url}" target="_blank" rel="noopener">${config.instagram.handle}</a><a href="mailto:${config.email}">${config.email}</a>`;
  panel.append(meta);
  const scrim = document.createElement('div');
  scrim.className = 'nav__scrim';
  scrim.setAttribute('aria-hidden', 'true');
  document.body.append(scrim);

  // --- flotación: 0 → -3px → 0 en 6 s (en el wrapper: no toca el translateX(-50%) de .nav) ---
  if (!reduced.matches) {
    gsap.to(float, { y: -3, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  // --- la transformación: se construye al abrir (con las medidas de ese momento) y se invierte al cerrar ---
  let open = false;
  let tl = null;
  const build = () => {
    const w0 = bar.offsetWidth;
    const h0 = bar.offsetHeight;
    panel.hidden = false;
    const w1 = mobile.matches ? innerWidth - 24 : Math.min(OPEN_W, innerWidth * 0.92);
    gsap.set(panel, { width: w1 });
    const h1 = h0 + panel.offsetHeight;
    gsap.set(panel, { clearProps: 'width' });

    return gsap.timeline({
      paused: true,
      onReverseComplete: () => {
        panel.hidden = true;
        nav.classList.remove('is-open');
        gsap.set([bar, logo, link], { clearProps: 'width,height,borderRadius,opacity,visibility,scale,filter' });
        tl = null;
      },
    })
      .fromTo(scrim, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'power1.out' }, 0)
      .to([logo, link], { autoAlpha: 0, scale: 0.85, filter: 'blur(4px)', duration: 0.35, ease: 'power2.in' }, 0)
      .fromTo(labelA, { yPercent: 0, opacity: 1 }, { yPercent: -100, opacity: 0, duration: 0.35, ease: 'power2.inOut' }, 0)
      .fromTo(labelB, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.35, ease: 'power2.inOut' }, 0)
      .fromTo(bar, { width: w0, height: h0, borderRadius: h0 / 2 }, { width: w1, height: h1, borderRadius: 28, duration: 0.8, ease: 'expo.inOut' }, 0.2)
      .fromTo(items, { yPercent: 100 }, { yPercent: 0, duration: 0.7, ease: 'expo.out', stagger: 0.07 }, 0.55)
      .fromTo(meta, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out' }, 0.9);
  };

  const setOpen = (value, { focusToggle = false } = {}) => {
    if (value === open) return;
    open = value;
    toggle.setAttribute('aria-expanded', String(open));
    labelA.setAttribute('aria-hidden', String(open));
    labelB.setAttribute('aria-hidden', String(!open));
    if (open) {
      if (!tl) tl = build();
      nav.classList.add('is-open');
      tl.timeScale(1).play();
      if (reduced.matches) tl.progress(1);
    } else {
      if (!tl) return;
      nav.classList.remove('is-open');
      tl.timeScale(tl.duration() / CLOSE_SECONDS).reverse();
      if (reduced.matches) tl.progress(0);
      if (focusToggle) toggle.focus();
    }
  };

  toggle.addEventListener('click', () => setOpen(!open));
  document.addEventListener('pointerdown', (e) => { if (open && !nav.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { setOpen(false, { focusToggle: true }); return; }
    if (e.key !== 'Tab') return;
    // foco atrapado: el botón, las páginas y los enlaces del pie de la píldora
    const loop = [toggle, ...items, ...meta.querySelectorAll('a')];
    const i = loop.indexOf(document.activeElement);
    const next = e.shiftKey ? (i <= 0 ? loop.length - 1 : i - 1) : (i === loop.length - 1 ? 0 : i + 1);
    e.preventDefault();
    loop[next].focus();
  });
  // un enlace del menú: se cierra la píldora y la transición entre páginas (js/transition.js) se encarga
  items.forEach((a) => a.addEventListener('click', () => setOpen(false)));

  // --- aparición (home): a la vez que la frase del hero ---
  let shown = !nav.hasAttribute('data-nav-wait');
  const appear = () => {
    if (shown) return;
    shown = true;
    nav.removeAttribute('data-nav-wait');
    if (reduced.matches) {
      gsap.fromTo(bar, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'power1.out' });
    } else {
      gsap.fromTo(bar, { autoAlpha: 0, y: -20 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out' });
    }
  };
  if (!shown) window.addEventListener('disco:intro-done', appear, { once: true });

  return {
    appear,
    // tinta negra mientras la barra está sobre una sección clara. Se llama después de crear los
    // pins (si no, las posiciones no cuentan el pin de servicios).
    watchInk() {
      const line = () => nav.getBoundingClientRect().top + nav.offsetHeight / 2;
      document.querySelectorAll('[data-nav-ink="dark"]').forEach((section) => {
        ScrollTrigger.create({
          trigger: section,
          start: () => `top ${line()}px`,
          end: () => `bottom ${line()}px`,
          toggleClass: { targets: nav, className: 'is-ink-dark' },
        });
      });
    },
  };
}
