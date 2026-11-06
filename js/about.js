import { initNosotrosHero } from './nosotros-hero.js';
import { litWords } from './interior.js';

// Nosotros: el hero "Somos disco." (js/nosotros-hero.js), manifiesto que se ilumina palabra a palabra con el scroll,
// Luna y Bruno en zigzag (cada foto entra desde su lado; sus textos, palabra a palabra; de B/N a color con el ratón
// encima, en móvil al entrar en pantalla), "cómo trabajamos" con un cabezal que recorre la línea (pin de 200vh en
// escritorio) y la franja del estudio con parallax suave. Movimiento reducido: todo visible y quieto.
const PIN = 2; // × alto de pantalla

export function init({ gsap, ScrollTrigger, lenis, loop, reduced }) {
  initNosotrosHero({ gsap, lenis, loop, reduced });
  const main = document.querySelector('main.ip');
  // el manifiesto, palabra a palabra con el scroll (js/interior.js → litWords)
  litWords(document.querySelector('[data-manifesto]'), { gsap, reduced });
  // Luna y Bruno: sus textos, igual; y cada foto se abre desde su borde al entrar en pantalla (1 s, css/about.css).
  // Solo se esconden las que aún no han llegado y si hay observador: si no, se ven
  document.querySelectorAll('[data-person-bio]').forEach((el) => litWords(el, { gsap, reduced, start: 'top 85%', end: 'bottom 55%' }));
  if (!reduced.matches && 'IntersectionObserver' in window) revealPhotos();

  // AR-G: la foto tiene que verse SIEMPRE. La entrada (clip-path) solo si el observador llega; si una foto pendiente
  // está en pantalla 1,5 s sin que haya llegado, se destapa igual; si ya está por encima (la página se abrió bajada, se
  // restauró el scroll o se vuelve atrás), se destapa sin animación. Se comprueba en cada scroll (una lectura por
  // foto pendiente, solo mientras quede alguna), al volver de la caché (pageshow) y al cargar.
  function revealPhotos() {
    const SAFE = 1500;
    const pending = new Map(); // foto → temporizador del seguro
    const open = (p, instant = false) => {
      if (!pending.has(p)) return;
      clearTimeout(pending.get(p));
      pending.delete(p);
      io.unobserve(p);
      if (instant) p.style.transition = 'none';
      p.classList.remove('is-pending');
      if (instant) requestAnimationFrame(() => { p.style.transition = ''; });
      if (!pending.size) window.removeEventListener('scroll', check);
    };
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) open(e.target); }), { rootMargin: '0px 0px -12% 0px' });
    const check = () => pending.forEach((timer, p) => {
      const r = p.getBoundingClientRect();
      if (r.bottom < 0) { open(p, true); return; }                  // ya por encima: sin animación
      if (r.top < innerHeight && !timer) pending.set(p, setTimeout(() => open(p), SAFE)); // en pantalla: el seguro
    });
    document.querySelectorAll('[data-person-photo]').forEach((p) => {
      if (p.getBoundingClientRect().top < innerHeight * 0.88) return;
      p.classList.add('is-pending');
      pending.set(p, 0);
      io.observe(p);
    });
    if (!pending.size) return;
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('pageshow', check);
    window.addEventListener('load', check, { once: true });
    requestAnimationFrame(check);
  }

  if (reduced.matches) {
    main.classList.add('ip-static');
    document.querySelectorAll('[data-person]').forEach((p) => p.classList.add('is-color'));
    return;
  }

  const mm = gsap.matchMedia();

  // móvil: la foto pasa a color al entrar en pantalla
  mm.add('(hover: none), (max-width: 899px)', () => {
    document.querySelectorAll('[data-person]').forEach((p) => {
      ScrollTrigger.create({ trigger: p, start: 'top 70%', end: 'bottom 30%', toggleClass: 'is-color' });
    });
  });

  // escritorio: pin y cabezal
  mm.add('(min-width: 900px)', () => {
    const how = document.querySelector('[data-how]');
    const steps = [...how.querySelectorAll('[data-how-step]')];
    const head = how.querySelector('[data-how-head]');
    const fill = how.querySelector('[data-how-fill]');
    const ruler = how.querySelector('.ab-how__ruler');
    // cada paso se enciende cuando el cabezal llega al principio de su columna
    const at = () => steps.map((s) => (s.offsetLeft - ruler.offsetLeft) / ruler.offsetWidth);
    let marks = at();
    ScrollTrigger.create({
      trigger: how,
      start: 'top top',
      end: () => `+=${innerHeight * PIN}`,
      pin: how.querySelector('[data-how-pin]'),
      scrub: true,
      invalidateOnRefresh: true,
      onRefresh: () => { marks = at(); },
      onUpdate: (self) => {
        const p = self.progress;
        gsap.set(head, { left: `${p * 100}%` });
        gsap.set(fill, { scaleX: p });
        steps.forEach((s, i) => s.classList.toggle('is-on', p >= marks[i] - 0.001));
      },
    });
    steps[0].classList.add('is-on');
  });

  // el estudio: parallax suave de la foto dentro de su franja
  const img = document.querySelector('[data-studio-img]');
  gsap.fromTo(img, { yPercent: -12 }, {
    yPercent: 0,
    ease: 'none',
    scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
  });
}
