// Páginas interiores (contacto, portfolio, nosotros): lo común.
// splitWords: parte en palabras con máscara los [data-words] (respeta <em> y <br>) y las hace subir
// (translateY 105% → 0, 0.9 s, stagger .06) cuando se abre el velo de la transición.
export function splitWords(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span');
          w.className = 'w';
          w.innerHTML = `<span class="w__in"></span>`;
          w.firstChild.textContent = part;
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') {
        walk(n);
      }
    });
  };
  // el lector de pantalla lee la frase entera, no palabra a palabra
  if (!el.hasAttribute('aria-label') && el.tagName !== 'P') el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  walk(el);
  el.classList.add('is-split');
  return [...el.querySelectorAll('.w__in')];
}

// litWords: el texto que se ilumina palabra a palabra con el scroll (los manifiestos de la web): el texto entero para
// el lector de pantalla y las palabras (.mw, apagadas al .4 por su CSS) ocultas para él, que pasan a 1 de una en una
// con el scroll (scrub). Movimiento reducido: solo el marcado (el CSS de cada página las deja a 1).
export function litWords(el, { gsap, reduced, start = 'top 80%', end = 'bottom 45%' }) {
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  el.innerHTML = `<span class="sr-only">${text}</span>${text.split(' ').map((w) => `<span class="mw" aria-hidden="true">${w}</span>`).join(' ')}`;
  const words = el.querySelectorAll('.mw');
  if (!reduced.matches) gsap.to(words, { opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: el, start, end, scrub: 0.6 } });
  return words;
}

export function enterHeader({ gsap, reduced, arrived }) {
  const words = [...document.querySelectorAll('.ip [data-words]')].flatMap(splitWords);
  if (reduced.matches || !words.length) return;
  gsap.set(words, { yPercent: 105 });
  arrived.then(() => {
    gsap.to(words, { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06, delay: 0.1 });
  });
}
