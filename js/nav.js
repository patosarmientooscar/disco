// Nav flotante de cristal: desplegable (clic fuera / Esc / enlace lo cierran), flotación sutil,
// aparición con "disco:intro-done" en la home y tinta blanca/negra según la sección de debajo.
export function initNav({ gsap, ScrollTrigger, reduced }) {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return { appear() {}, watchInk() {} };

  const float = nav.querySelector('.nav__float');
  const bar = nav.querySelector('.nav__bar');
  const toggle = nav.querySelector('[data-nav-toggle]');
  const panel = document.getElementById(toggle.getAttribute('aria-controls'));
  const items = [...panel.querySelectorAll('.nav__item')];

  // --- flotación: 0 → -3px → 0 en 6 s (en el wrapper: no toca el translateX(-50%) de .nav) ---
  if (!reduced.matches) {
    gsap.to(float, { y: -3, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }

  // --- desplegable ---
  let open = false;
  const setOpen = (value, { focusToggle = false } = {}) => {
    if (value === open) return;
    open = value;
    toggle.setAttribute('aria-expanded', String(open));
    gsap.killTweensOf([panel, ...items]);
    if (open) {
      panel.hidden = false;
      if (reduced.matches) {
        gsap.fromTo(panel, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 });
        gsap.set(items, { y: 0, opacity: 1 });
      } else {
        gsap.fromTo(panel, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out' });
        gsap.fromTo(items, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.05, delay: 0.05 });
      }
    } else {
      gsap.to(panel, {
        autoAlpha: 0, y: reduced.matches ? 0 : -8, duration: 0.2, ease: 'power1.in',
        onComplete: () => { panel.hidden = true; },
      });
      if (focusToggle) toggle.focus();
    }
  };

  toggle.addEventListener('click', () => setOpen(!open));
  document.addEventListener('pointerdown', (e) => { if (open && !nav.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (open && e.key === 'Escape') setOpen(false, { focusToggle: true }); });
  // el foco sale del menú con Tab → se cierra
  nav.addEventListener('focusout', (e) => { if (open && e.relatedTarget && !nav.contains(e.relatedTarget)) setOpen(false); });
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
