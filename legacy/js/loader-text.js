/* LEGACY LOADING — loading anterior ("disco.es" → "Le ponemos ritmo a tu negocio").
   No se carga. Sustituido por js/intro-loader.js + css/intro-loader.css (2026-10-21). */

// Frase del loading: minimalista, una línea. Cada palabra sube desde su máscara
// y pasa rojo → ámbar → violeta antes de quedarse en blanco.
const RED = '#FF2B2B';
const AMBER = '#FFB547';
const VIOLET = '#8B5CF6';
const WHITE = '#F4F2EC';

const ENTER = 0.22;   // entrada de cada palabra
const COLOR = 0.25;   // paso de color al entrar
const PHRASE = 1.6;   // la frase entera

// root: <p> con el texto real en .sr-only y un contenedor aria-hidden para las palabras
export function createPhrase(gsap, root) {
  const text = root.querySelector('.sr-only').textContent.trim();
  const holder = root.querySelector('[data-loader-words]');

  const inners = text.split(/\s+/).map((word, i) => {
    const mask = document.createElement('span');
    const inner = document.createElement('span');
    mask.className = 'lw';
    inner.className = 'lw__in';
    inner.textContent = word;
    mask.append(inner);
    if (i) holder.append(' ');
    holder.append(mask);
    return inner;
  });

  const step = (PHRASE - ENTER) / (inners.length - 1);

  return {
    hide() {
      gsap.set(inners, { yPercent: 110, color: WHITE });
      gsap.set(root, { opacity: 1 });
    },

    showStatic() {
      gsap.set(inners, { yPercent: 0, color: WHITE });
      gsap.set(root, { opacity: 1 });
    },

    enter() {
      const tl = gsap.timeline();
      inners.forEach((inner, i) => {
        const at = i * step;
        tl.fromTo(inner, { yPercent: 110 }, { yPercent: 0, duration: ENTER, ease: 'power3.out' }, at)
          .set(inner, { color: RED }, at)
          .to(inner, { keyframes: { color: [RED, AMBER, VIOLET, WHITE], easeEach: 'none' }, duration: COLOR, ease: 'none' }, at);
      });
      return tl;
    },

    // versión corta (ya visto en la sesión): todas las palabras casi a la vez, en blanco
    enterQuick() {
      return gsap.timeline().to(inners, { yPercent: 0, duration: ENTER, ease: 'power3.out', stagger: 0.04 });
    },

    fadeOut(duration) {
      return gsap.to(root, { opacity: 0, duration, ease: 'power1.inOut' });
    },
  };
}
