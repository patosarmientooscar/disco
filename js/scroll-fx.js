// Sistema global de scroll "que sube": el contenido viene hacia ti en vez de bajar la página.
//   [data-speed="0.85…1.25"]  parallax por capas: lo de delante (>1) sube más rápido que lo de detrás (<1)
//   [data-rise]               entra desde abajo (14vh → 0, opacity 0 → 1) enlazado al scroll; al subir se deshace
//   curtain(hero, next)       telón: el hero se queda fijo, se aleja y se oscurece mientras la sección siguiente
//                             sube por encima con las esquinas de arriba redondeadas
// Solo transform / opacity / clip-path. Con movimiento reducido no hace nada (scroll nativo).
const RISE = 0.14;          // 14vh
const RISE_SCRUB = 1.2;
const CURTAIN = { scale: 0.92, shade: 0.6, radius: 28 };

export function initScrollFx({ gsap, ScrollTrigger, reduced }) {
  if (reduced.matches) return { curtain() {} };

  document.querySelectorAll('[data-speed]').forEach((el) => {
    const speed = parseFloat(el.dataset.speed) || 1;
    if (speed === 1) return;
    // recorrido total mientras cruza la pantalla; en el centro de la pantalla, sin desplazamiento
    const shift = () => (speed - 1) * (innerHeight + el.offsetHeight) * 0.5;
    gsap.fromTo(el, { y: () => shift() }, {
      y: () => -shift(),
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
    });
  });

  document.querySelectorAll('[data-rise]').forEach((el) => {
    gsap.fromTo(el, { y: () => innerHeight * RISE, opacity: 0 }, {
      y: 0,
      opacity: 1,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 62%', scrub: RISE_SCRUB, invalidateOnRefresh: true },
    });
  });

  return {
    curtain(hero, next) {
      const stage = hero.querySelector('.hero__stage');
      const shade = hero.querySelector('.hero__shade');
      const covered = (v) => hero.classList.toggle('is-covered', v); // el fluido se pausa tapado del todo
      gsap.timeline({
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: () => `+=${hero.offsetHeight}`,
          pin: true,
          pinSpacing: false, // la sección siguiente sube por encima, no detrás de un hueco
          scrub: true,
          invalidateOnRefresh: true,
          onLeave: () => covered(true),
          onEnterBack: () => covered(false),
        },
      })
        .fromTo(stage, { scale: 1 }, { scale: CURTAIN.scale, ease: 'none' }, 0)
        .fromTo(shade, { opacity: 0 }, { opacity: CURTAIN.shade, ease: 'none' }, 0);

      // esquinas de arriba redondeadas mientras sube; rectas al ocupar la pantalla
      gsap.fromTo(next, { borderTopLeftRadius: CURTAIN.radius, borderTopRightRadius: CURTAIN.radius }, {
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        ease: 'none',
        scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true },
      });
    },
  };
}
