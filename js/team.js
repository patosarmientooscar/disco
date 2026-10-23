// Cofundadores: la frase entra línea a línea, las fotos se destapan de abajo arriba (clip-path) mientras
// la imagen se aleja (scale 1.18 → 1) y los nombres aparecen justo después de su foto. Todo enlazado al
// scroll (scrub): al volver a subir se deshace. Parallax de las fotos y subfrase: data-speed / data-rise
// (js/scroll-fx.js). Con movimiento reducido, todo visible y quieto.
const SCRUB = 1.2;

export function initTeam({ gsap, ScrollTrigger, reduced }) {
  const section = document.getElementById('equipo');
  if (!section) return;
  // los retratos están justo después del hero: se cargan y decodifican ya (al terminar la intro),
  // para que la primera vez que se destapan no den tirones
  section.querySelectorAll('img').forEach((img) => {
    img.loading = 'eager';
    if (img.decode) img.decode().catch(() => {});
  });
  // frase puente al estudio ("Y todo pasa en un sitio:"): palabra a palabra, de .18 a 1 con el scroll
  const bridge = section.querySelector('[data-bridge]');
  if (bridge) {
    // el texto entero para lectores de pantalla; las palabras animadas, ocultas para ellos
    const text = bridge.textContent.trim();
    bridge.innerHTML = `<span class="sr-only">${text}</span>${text.split(/\s+/).map((w) => `<span class="bw" aria-hidden="true">${w}</span>`).join(' ')}`;
  }
  if (reduced.matches) return;
  if (bridge) {
    gsap.to(bridge.querySelectorAll('.bw'), {
      opacity: 1,
      ease: 'none',
      stagger: 0.15,
      scrollTrigger: { trigger: bridge, start: 'top 85%', end: 'center 50%', scrub: 0.6 },
    });
  }

  // --- frase: líneas reales (dependen del ancho) → se rehacen al cambiar el ancho ---
  const phrase = section.querySelector('[data-team-phrase]');
  let phraseTl = null;
  const buildPhrase = () => {
    phraseTl?.scrollTrigger?.kill();
    phraseTl?.kill();
    const lines = splitLines(phrase);
    phraseTl = gsap.timeline({
      scrollTrigger: { trigger: phrase, start: 'top 92%', end: 'top 45%', scrub: SCRUB },
    }).fromTo(lines, { yPercent: 105 }, { yPercent: 0, ease: 'none', stagger: 0.08 });
  };
  buildPhrase();
  let width = innerWidth;
  let timer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (innerWidth === width) return;
      width = innerWidth;
      buildPhrase();
      ScrollTrigger.refresh();
    }, 200);
  });

  // --- fotos y nombres: las dos a la vez (mismo trigger, misma animación, sin stagger) ---
  // En móvil van una debajo de otra: ahí cada una se destapa al llegar a ella.
  const reveal = (persons) => {
    const frames = persons.map((p) => p.querySelector('[data-team-frame]'));
    const zooms = persons.map((p) => p.querySelector('[data-team-zoom]'));
    const names = persons.map((p) => p.querySelector('[data-team-name]'));
    return gsap.timeline({
      scrollTrigger: { trigger: frames[0], start: 'top 95%', end: 'top 30%', scrub: SCRUB },
    })
      .fromTo(frames, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', duration: 1 }, 0)
      .fromTo(zooms, { scale: 1.18 }, { scale: 1, ease: 'none', duration: 1 }, 0)
      // los nombres, a la vez, un poco después de que las fotos terminen de destaparse
      .fromTo(names, { opacity: 0, y: 10 }, { opacity: 1, y: 0, ease: 'none', duration: 0.35 }, 1.15);
  };
  const persons = [...section.querySelectorAll('.team__person')];
  gsap.matchMedia()
    .add('(min-width: 768px)', () => { reveal(persons); })
    .add('(max-width: 767px)', () => { persons.forEach((p) => reveal([p])); });
}

// Parte el texto en sus líneas reales: cada una en una máscara (.team__line > .team__line-in)
function splitLines(el) {
  const text = el.dataset.text || (el.dataset.text = el.textContent.trim());
  el.textContent = '';
  const words = text.split(/\s+/).map((w) => {
    const s = document.createElement('span');
    s.textContent = w;
    s.style.display = 'inline-block';
    return s;
  });
  words.forEach((s, i) => { el.append(s); if (i < words.length - 1) el.append(' '); });
  const lines = [];
  let top = null;
  words.forEach((s) => {
    if (s.offsetTop !== top) { top = s.offsetTop; lines.push([]); }
    lines[lines.length - 1].push(s.textContent);
  });
  el.textContent = '';
  return lines.map((ws) => {
    const outer = document.createElement('span');
    const inner = document.createElement('span');
    outer.className = 'team__line';
    inner.className = 'team__line-in';
    inner.textContent = ws.join(' ');
    outer.append(inner);
    el.append(outer);
    return inner;
  });
}
