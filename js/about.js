// Nosotros: manifiesto que se ilumina palabra a palabra con el scroll, fotos de B/N a color (hover; en
// móvil al entrar en pantalla), "cómo trabajamos" con un cabezal que recorre la línea (pin de 200vh en
// escritorio) y la franja del estudio con parallax suave. Movimiento reducido: todo visible y quieto.
const PIN = 2; // × alto de pantalla

export function init({ gsap, ScrollTrigger, reduced }) {
  const main = document.querySelector('main.ip');
  const manifesto = document.querySelector('[data-manifesto]');
  // palabras del manifiesto: el texto entero para lectores de pantalla, las palabras animadas ocultas para ellos
  const text = manifesto.textContent.trim();
  manifesto.innerHTML = `<span class="sr-only">${text}</span>${text.split(/\s+/).map((w) => `<span class="mw" aria-hidden="true">${w}</span>`).join(' ')}`;

  if (reduced.matches) {
    main.classList.add('ip-static');
    document.querySelectorAll('[data-person]').forEach((p) => p.classList.add('is-color'));
    return;
  }

  gsap.to(manifesto.querySelectorAll('.mw'), {
    opacity: 1,
    ease: 'none',
    stagger: 0.1,
    scrollTrigger: { trigger: manifesto, start: 'top 80%', end: 'bottom 45%', scrub: 0.6 },
  });

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
