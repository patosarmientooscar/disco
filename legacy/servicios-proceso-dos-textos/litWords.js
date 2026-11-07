// derecha, lo celebra: js/page-star.js) ----------
// (las palabras, una a una en spans .mw; las de <em>, .mw--hot. Lo comparten el manifiesto y el texto de "En cada
// producción.")
function splitWords(el) {
  const hot = new Set([...el.querySelectorAll('em')].map((e) => e.textContent.trim()));
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  el.innerHTML = `<span class="sr-only">${text}</span>${text.split(' ').map((w) => {
    const bare = w.replace(/[.,]/g, '');
    // (la puntuación del final, aparte: en una palabra clave no se tiñe de naranja)
    const [, word, punct] = w.match(/^(.*?)([.,;:]*)$/);
    return `<span class="mw${hot.has(bare) ? ' mw--hot' : ''}" aria-hidden="true">${word}${punct ? `<span class="mw-p">${punct}</span>` : ''}</span>`;
  }).join(' ')}`;
}
// el texto de "En cada producción.": la misma animación que el manifiesto (sin las palabras clave del destello)
function litWords(gsap, el, still) {
  splitWords(el);
  if (still) return;
  // (las palabras clave, <em>, se vuelven naranjas al encenderse: .is-lit; al apagarse, vuelven)
  const hot = [...el.querySelectorAll('.mw--hot')];
  gsap.to(el.querySelectorAll('.mw'), {
    opacity: 1,
    ease: 'none',
    stagger: 0.1,
    scrollTrigger: { trigger: el, start: 'top 75%', end: 'bottom 40%', scrub: 0.6 },
    onUpdate: () => hot.forEach((w) => w.classList.toggle('is-lit', +gsap.getProperty(w, 'opacity') > 0.85)),
  });
