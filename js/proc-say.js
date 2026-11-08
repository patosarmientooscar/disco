// "En cada producción." (servicios.html; AU): un texto por fase de la hoja de producción (Preproducción · Rodaje ·
// Postproducción). Solo se ve el de la fase activa: la fase cuyo bloque cruza el 45 % de la pantalla (con los rects
// cacheados en resize / refresh: por frame solo se lee el scroll de Lenis; con histéresis para no parpadear en el
// borde). Al cambiar de fase, cada texto pasa a data-state "on" (entra) o "below" / "above" (se va por debajo o por
// encima, según el sentido): las transiciones, en CSS (css/servicios.css, cubic-bezier(.32,.72,0,1)), retoman desde
// donde estén si el scroll cambia de idea, así que ningún texto se queda a medias. Antes de la primera fase y después
// de la última, ninguno. Las líneas se parten aquí (cada una en su máscara) y se rehacen si cambia el ancho.
// Movimiento reducido: los tres visibles, sin animación (el CSS anula los estados).
const LINE = 0.45; // la línea de la pantalla que decide la fase activa
const HY = 40;     // px de histéresis alrededor de la fase activa
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// palabras de un <p> con <em>: cada palabra, en segmentos (los de <em>, en naranja; la puntuación pegada, no)
function wordsOf(p) {
  const words = [];
  let glue = false; // el siguiente trozo va pegado a la palabra anterior (sin espacio)
  p.childNodes.forEach((node) => {
    const hot = node.nodeName === 'EM';
    node.textContent.split(/(\s+)/).forEach((t) => {
      if (!t) return;
      if (/^\s+$/.test(t)) { glue = false; return; }
      if (glue && words.length) words[words.length - 1].push({ t, hot });
      else words.push([{ t, hot }]);
      glue = true;
    });
  });
  return words;
}
const wordHTML = (w) => `<span class="say__w">${w.map((s) => (s.hot ? `<span class="say__hot">${esc(s.t)}</span>` : esc(s.t))).join('')}</span>`;

export function initProcSay({ ScrollTrigger, lenis, still }) {
  const says = [...document.querySelectorAll('[data-say]')];
  if (!says.length) return;
  const items = says.map((el) => {
    const p = el.querySelector('p');
    return { el, p, phase: el.closest('[data-phase]'), text: p.textContent.replace(/\s+/g, ' ').trim(), words: wordsOf(p), w: -1, top: 0, bottom: 0 };
  });

  // las líneas: las palabras en una fila, se agrupan por su offsetTop y cada grupo va a su máscara
  const split = (it) => {
    const w = it.p.clientWidth;
    if (w === it.w) return;
    it.w = w;
    it.p.innerHTML = it.words.map(wordHTML).join(' ');
    const lines = [];
    let y = null;
    [...it.p.children].forEach((span, i) => {
      if (span.offsetTop !== y) { y = span.offsetTop; lines.push([]); }
      lines[lines.length - 1].push(wordHTML(it.words[i]));
    });
    it.p.innerHTML = `<span class="sr-only">${esc(it.text)}</span>${lines.map((l, i) => `<span class="say__line" aria-hidden="true"><span class="say__in" style="--i:${i}">${l.join(' ')}</span></span>`).join('')}`;
    // (el naranja, un instante después de que suban las líneas)
    it.p.style.setProperty('--hd', `${(0.15 + (lines.length - 1) * 0.06 + 0.45).toFixed(2)}s`);
  };
  if (still) {
    items.forEach((it) => { split(it); it.el.dataset.state = 'on'; });
    return;
  }

  let active = -1;
  const setState = (it, s) => {
    const prev = it.el.dataset.state;
    if (prev === s) return;
    // de oculto a oculto (por encima ↔ por debajo): un salto sin transición, para no cruzar la vista
    if (prev !== 'on' && s !== 'on') {
      it.el.classList.add('is-jump');
      it.el.dataset.state = s;
      void it.el.offsetWidth;
      it.el.classList.remove('is-jump');
    } else it.el.dataset.state = s;
  };
  const apply = (k) => {
    if (k === active) return;
    active = k;
    items.forEach((it, i) => setState(it, i === k ? 'on' : (k === -2 || i < k ? 'above' : 'below')));
  };
  // la fase activa: la que cruza la línea; la activa se mantiene HY px más allá de su borde; en el hueco entre dos
  // fases, la que estaba; antes de la primera, ninguna (-1); después de la última, ninguna (-2: se fueron por arriba)
  // AY-F, móvil (< 900 px, el texto encima de su fase): manda el inicio de cada fase, que es donde está su texto. Una
  // fase se activa cuando su inicio pasa del 75 % de la pantalla y sigue hasta que entra la siguiente; la última se
  // apaga cuando su final sale por arriba. (Con la línea del 45 % de escritorio, Rodaje, corta y justo detrás de una
  // fase alta, podía estar entera en pantalla con el texto aún escondido, y un gesto normal se la saltaba.)
  const stacked = matchMedia('(max-width: 899px)');
  const updateStacked = () => {
    const sy = lenis.scroll;
    const y = sy + innerHeight * 0.75;
    const last = items[items.length - 1];
    let k = -1;
    items.forEach((it, i) => { if (y >= it.top + (i === active + 1 ? HY : 0)) k = i; });
    // (histéresis: la activa no se suelta hasta que su inicio vuelve HY px por debajo de la línea)
    if (active >= 0 && k === active - 1 && y >= items[active].top - HY) k = active;
    if (k === items.length - 1 && sy > last.bottom) k = -2;
    apply(k);
  };
  const update = () => {
    if (stacked.matches) return updateStacked();
    const y = lenis.scroll + innerHeight * LINE;
    const cur = items[active];
    if (cur && y >= cur.top - HY && y <= cur.bottom + HY) return;
    const k = items.findIndex((it) => y >= it.top && y <= it.bottom);
    if (k >= 0) return apply(k);
    if (y < items[0].top) return apply(-1);
    if (y > items[items.length - 1].bottom) return apply(-2);
    // (en un hueco: la que estaba, o la de arriba si no había ninguna)
    if (active < 0) apply(items.findLastIndex((it) => it.bottom < y));
  };
  const measure = () => {
    items.forEach(split);
    const sy = lenis.scroll;
    items.forEach((it) => {
      const r = it.phase.getBoundingClientRect();
      it.top = r.top + sy;
      it.bottom = r.bottom + sy;
    });
    update();
  };
  items.forEach((it) => { it.el.classList.add('is-jump'); it.el.dataset.state = 'below'; });
  measure();
  requestAnimationFrame(() => items.forEach((it) => it.el.classList.remove('is-jump')));
  ScrollTrigger.addEventListener('refresh', measure);
  window.addEventListener('resize', measure);
  if (document.fonts) document.fonts.ready.then(() => { items.forEach((it) => { it.w = -1; }); measure(); });
  lenis.on('scroll', update);
}
