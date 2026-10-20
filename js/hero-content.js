import { createTiltedGrid } from './tilted-grid.js';

// Contenido del hero principal: fila curvada de fotos, entrada del titular y CTA fijo.
export function initHeroContent({ gsap, ScrollTrigger, reduced, photos }) {
  const hero = document.getElementById('hero-main');
  const title = hero.querySelector('[data-split]');
  const sub = hero.querySelector('[data-hero-sub]');
  const heroCta = hero.querySelector('[data-hero-cta]');
  const fixedCta = document.querySelector('[data-cta-fixed]');

  // --- fila curvada: solo se mueve con el círculo abierto y el hero en pantalla ---
  // móvil: la fila más arriba (axis 55) para no dejar un hueco vacío bajo el titular
  const mobile = matchMedia('(max-width: 768px)').matches;
  const grid = createTiltedGrid(hero, {
    images: photos.map(({ src, alt }) => ({ src, alt })),
    axis: mobile ? 55 : 62, tileHeight: 30, speed: 4,
  });
  let open = false;
  let onScreen = false;
  const sync = () => (open && onScreen ? grid.play() : grid.pause());
  // tilted-grid construye (y reconstruye al redimensionar) los tiles en su propio ResizeObserver,
  // ya en marcha: este observer se registra después, así que corre después y reaplica el estado.
  new ResizeObserver(sync).observe(hero);
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }).observe(hero);

  // --- titular palabra a palabra desde su máscara (el texto sigue siendo el del H1) ---
  const words = title.textContent.trim().split(/\s+/);
  title.textContent = '';
  const inners = words.map((word, i) => {
    const mask = document.createElement('span');
    const inner = document.createElement('span');
    mask.className = 'w';
    inner.className = 'w__in';
    inner.textContent = word;
    mask.append(inner);
    if (i) title.append(' ');
    title.append(mask);
    return inner;
  });

  let tl = null;
  const hide = () => {
    tl?.kill();
    if (reduced.matches) {
      gsap.set([title, sub], { opacity: 0 });
    } else {
      gsap.set(inners, { yPercent: 110 });
      gsap.set(sub, { opacity: 0 });
    }
  };
  hide();

  return {
    grid,
    // CTA fijo: aparece cuando el del hero sale por arriba y se queda el resto de la página.
    // Se llama después de crear el pin de la cámara (si no, su posición no cuenta los 500vh del pin).
    watchCta() {
      ScrollTrigger.create({
        trigger: heroCta,
        start: 'bottom top',
        onEnter: () => {
          gsap.to(fixedCta, { autoAlpha: 1, duration: 0.3 });
          fixedCta.removeAttribute('tabindex');
          fixedCta.removeAttribute('aria-hidden');
        },
        onLeaveBack: () => {
          gsap.to(fixedCta, { autoAlpha: 0, duration: 0.2 });
          fixedCta.setAttribute('tabindex', '-1');
          fixedCta.setAttribute('aria-hidden', 'true');
        },
      });
    },
    // al abrirse el círculo
    show() {
      open = true;
      sync();
      tl?.kill();
      tl = gsap.timeline({ delay: 0.15 });
      if (reduced.matches) {
        tl.to([title, sub], { opacity: 1, duration: 0.5, ease: 'power1.out' });
      } else {
        tl.to(inners, { yPercent: 0, duration: 0.5, ease: 'power3.out', stagger: 0.06 })
          .to(sub, { opacity: 1, duration: 0.5, ease: 'power1.out' }, '-=0.15');
      }
    },
    // al cerrarse (volver al vídeo): queda listo para volver a entrar
    hide() {
      open = false;
      sync();
      hide();
    },
  };
}
