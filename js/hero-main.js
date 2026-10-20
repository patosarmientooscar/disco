// Apertura al hero principal: al llegar al último frame (fin del pin), capa #F4F2EC a pantalla
// completa y #hero-main se abre desde el centro. Hacia atrás, el círculo se cierra y vuelve el vídeo.
const CLOSED = 'circle(0% at 50% 50%)';
const OPEN = 'circle(150% at 50% 50%)';

export function initHeroMain({ gsap, ScrollTrigger, reduced, pin }) {
  const hero = document.getElementById('hero-main');
  const white = document.querySelector('[data-whiteout]');
  let tl = null;

  const open = () => {
    tl?.kill();
    tl = gsap.timeline().to(white, { opacity: 1, duration: 0.15, ease: 'power1.out' }, 0);
    if (reduced.matches) tl.to(hero, { opacity: 1, duration: 0.6, ease: 'power1.inOut' }, 0.1);
    else tl.to(hero, { clipPath: OPEN, duration: 0.9, ease: 'expo.out' }, 0.1);
  };

  const close = () => {
    tl?.kill();
    tl = gsap.timeline();
    if (reduced.matches) tl.to(hero, { opacity: 0, duration: 0.4, ease: 'power1.inOut' }, 0);
    else tl.to(hero, { clipPath: CLOSED, duration: 0.6, ease: 'expo.inOut' }, 0);
    tl.to(white, { opacity: 0, duration: 0.3, ease: 'power1.in' }, '>-0.15');
  };

  // justo al final del pin de la cámara
  return ScrollTrigger.create({
    start: () => pin.end - 1,
    end: () => pin.end + 1,
    onEnter: open,
    onLeaveBack: close,
  });
}
