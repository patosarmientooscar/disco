// Flash de transición loading → pre-hero: fogonazo blanco 0→1 en 0.04s y 1→0 en 0.5s (expo.out).
// Con movimiento reducido no hay fogonazo, solo un fundido suave.
export function initFlash({ gsap, reduced }) {
  const screen = document.querySelector('[data-flash]');

  return {
    transition(onPeak) {
      const tl = gsap.timeline();
      if (reduced.matches) {
        tl.to(screen, { opacity: 0.12, duration: 0.25, ease: 'sine.inOut' })
          .add(onPeak)
          .to(screen, { opacity: 0, duration: 0.6, ease: 'sine.inOut' });
      } else {
        tl.to(screen, { opacity: 1, duration: 0.04, ease: 'none' })
          .add(onPeak)
          .to(screen, { opacity: 0, duration: 0.5, ease: 'expo.out' });
      }
      return tl;
    },
  };
}
