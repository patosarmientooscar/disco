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
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.remove('is-pending');
      io.unobserve(e.target);
    }), { rootMargin: '0px 0px -12% 0px' });
    document.querySelectorAll('[data-person-photo]').forEach((p) => {
      if (p.getBoundingClientRect().top < innerHeight * 0.88) return;
      p.classList.add('is-pending');
      io.observe(p);
    });
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
