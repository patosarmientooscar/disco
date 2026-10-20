// Frase del loading a 118 BPM: una palabra por golpe, "ritmo" protagonista.
export const BEAT = 60 / 118; // 0.508s

const RED = '#FF2B2B';
const AMBER = '#FFB547';
const VIOLET = '#8B5CF6';
const WHITE = '#F4F2EC';
const STAR = 'ritmo';

// root: <p> con el texto real en .sr-only y un contenedor aria-hidden para las palabras
export function createPhrase(gsap, root) {
  const text = root.querySelector('.sr-only').textContent.trim();
  const holder = root.querySelector('[data-loader-words]');

  const words = text.split(/\s+/).map((word, i) => {
    const mask = document.createElement('span');
    const inner = document.createElement('span');
    const isStar = word.toLowerCase() === STAR;
    mask.className = isStar ? 'lw lw--star' : 'lw';
    inner.className = 'lw__in';
    inner.textContent = word;
    const glows = isStar
      ? ['red', 'amber', 'violet'].map((c) => {
          const g = document.createElement('span');
          g.className = `lw__glow lw__glow--${c}`;
          g.textContent = word;
          inner.append(g);
          return g;
        })
      : [];
    mask.append(inner);
    if (i) holder.append(' ');
    holder.append(mask);
    return { mask, inner, isStar, glows };
  });

  const inners = words.map((w) => w.inner);
  const star = words.find((w) => w.isStar);
  let glowLoop = null;

  // text-shadow que rota rojo → ámbar → violeta, un color por golpe
  function startGlow() {
    const [r, a, v] = star.glows;
    glowLoop = gsap.timeline({ repeat: -1 });
    [r, a, v].forEach((g, i, all) => {
      glowLoop
        .to(g, { opacity: 0, duration: BEAT, ease: 'sine.inOut' }, i * BEAT)
        .to(all[(i + 1) % 3], { opacity: 1, duration: BEAT, ease: 'sine.inOut' }, i * BEAT);
    });
    gsap.to(r, { opacity: 1, duration: 0.25 });
  }

  function stopGlow(duration) {
    glowLoop?.kill();
    if (star) gsap.to(star.glows, { opacity: 0, duration });
  }

  return {
    hide() {
      gsap.set(inners, { yPercent: 110, color: WHITE });
      gsap.set(root, { opacity: 1 });
    },

    showStatic() {
      gsap.set(inners, { yPercent: 0, color: WHITE });
    },

    // Una palabra por golpe con máscara, overshoot y color rojo → ámbar → violeta → blanco
    enter() {
      const tl = gsap.timeline();
      words.forEach(({ mask, inner, isStar }, i) => {
        const at = i * BEAT;
        tl.fromTo(inner, { yPercent: 110 }, { yPercent: 0, duration: 0.35, ease: 'back.out(1.6)' }, at)
          .set(inner, { color: RED }, at)
          .to(inner, { keyframes: { color: [RED, AMBER, VIOLET, WHITE], easeEach: 'none' }, duration: 0.45, ease: 'none' }, at);
        if (!isStar) return;
        // ya dentro, la máscara deja respirar el glow
        tl.set(mask, { overflow: 'visible' }, at + 0.36).add(startGlow, at + 0.3);
        for (let k = 1; k <= 3; k++) {
          tl.to(mask, { scale: 1.06, duration: BEAT / 4, ease: 'power1.out', yoyo: true, repeat: 1 }, at + (k * BEAT) / 2);
        }
      });
      // la timeline dura golpes enteros: el cierre cae a compás
      return tl.set({}, {}, words.length * BEAT);
    },

    // Versión corta (ya visto en la sesión): todas las palabras de golpe, en blanco
    enterQuick() {
      return gsap.timeline().to(inners, { yPercent: 0, duration: 0.3, ease: 'back.out(1.6)', stagger: 0.04 });
    },

    // Cierre: la frase late una vez, mini flash y fundido a negro
    finale(flash) {
      stopGlow(BEAT);
      return gsap.timeline()
        .to(root, { scale: 1.03, duration: BEAT / 2, ease: 'power2.out', yoyo: true, repeat: 1 }, 0)
        .to(flash, { keyframes: { opacity: [0, 0.35, 0], easeEach: 'none' }, duration: 0.25, ease: 'none' }, BEAT / 2)
        .to(root, { opacity: 0, duration: 0.35, ease: 'power2.in' }, BEAT);
    },

    fadeOut(duration) {
      stopGlow(duration);
      return gsap.to(root, { opacity: 0, duration, ease: 'power1.inOut' });
    },
  };
}
