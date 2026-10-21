/* LEGACY PRE-HERO — cámara de cine + "disco.es" en píxeles + scroll por las lentes (y su HUD,
   flash blanco y apertura en círculo). No se carga. Sustituido por la intro del prompt 3 (2026-10-21). */

// Apertura al hero principal: al llegar al último frame (fin del pin), capa #F4F2EC a pantalla
// completa y #hero-main se abre desde el centro. Hacia atrás, el círculo se cierra y vuelve el vídeo.
const CLOSED = 'circle(0% at 50% 50%)';
const OPEN = 'circle(150% at 50% 50%)';
// Una vez abierto, el hero se queda quieto este tramo de scroll: da tiempo a leerlo y
// evita volver a la lente (o seguir hacia servicios) con el primer gesto.
const HOLD = '+=80%';
// Margen hacia arriba: abierto, solo se cierra (vuelta a la lente) tras subir este tramo.
const CLOSE_BACK = 0.25; // fracción del alto de pantalla

export function initHeroMain({ gsap, ScrollTrigger, reduced, pin, onOpen, onClose }) {
  const hero = document.getElementById('hero-main');
  const white = document.querySelector('[data-whiteout]');
  let tl = null;
  let isOpen = false;

  const open = () => {
    if (isOpen) return;
    isOpen = true;
    tl?.kill();
    tl = gsap.timeline().to(white, { opacity: 1, duration: 0.15, ease: 'power1.out' }, 0);
    if (reduced.matches) tl.to(hero, { opacity: 1, duration: 0.6, ease: 'power1.inOut' }, 0.1);
    else tl.to(hero, { clipPath: OPEN, duration: 0.9, ease: 'expo.out' }, 0.1);
    onOpen?.();
  };

  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    tl?.kill();
    tl = gsap.timeline();
    if (reduced.matches) tl.to(hero, { opacity: 0, duration: 0.4, ease: 'power1.inOut' }, 0);
    else tl.to(hero, { clipPath: CLOSED, duration: 0.6, ease: 'expo.inOut' }, 0);
    tl.to(white, { opacity: 0, duration: 0.3, ease: 'power1.in' }, '>-0.15')
      .add(() => onClose?.());
  };

  // se abre justo al final del pin de la cámara…
  const trigger = ScrollTrigger.create({
    start: () => pin.end - 1,
    end: () => pin.end + 1,
    onEnter: open,
  });
  // …y solo se cierra al subir un poco más (no con el primer gesto hacia arriba)
  ScrollTrigger.create({
    start: () => pin.end - window.innerHeight * CLOSE_BACK,
    end: () => pin.end + 1,
    onLeaveBack: close,
  });

  // pausa de lectura: el hero empieza justo donde acaba el pin de la cámara
  ScrollTrigger.create({ trigger: hero, start: 'top top', end: HOLD, pin: true });

  return trigger;
}
