// Agua dentro del logo de disco: lo usan el loading (js/intro-loader.js) y la transición entre páginas
// (js/transition.js). Un clipPath con las letras (y el subtítulo) y dentro un rect #f4f2ef cuyo borde de
// arriba es una ola: dos senoides superpuestas (delantera opaca, trasera al 45 %) + una línea de 1px más
// clara en la cresta delantera (el menisco). render(nivel, segundos) regenera los paths; se llama desde el loop.
const SVGNS = 'http://www.w3.org/2000/svg';
const WATER = '#f4f2ef';
const FRONT = { amp: 0.022, length: 0.38, period: 3.6, phase: 0 };   // amp: × alto de las letras; length: × ancho del logo
const BACK = { amp: 0.016, length: 0.52, period: 5.2, phase: 1.9 };
const SETTLE = 0.4;     // con el agua arriba, la ola baja al 40 % de su amplitud
const STEPS = 72;       // puntos de cada ola

let uid = 0;

// contorno fino (1px en pantalla) de cada subtrazado, para dibujarlos todos a la vez con stroke-dashoffset
export function outline(svg, paths, { opacity = 0.35 } = {}) {
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('fill', 'none');
  g.setAttribute('stroke', `rgb(255 255 255 / ${opacity})`);
  g.setAttribute('aria-hidden', 'true');
  const strokes = [];
  paths.forEach((path) => {
    path.getAttribute('d').split(/(?=M)/).forEach((d) => {
      const s = document.createElementNS(SVGNS, 'path');
      s.setAttribute('d', d);
      g.append(s);
      strokes.push(s);
    });
  });
  svg.append(g);
  const lengths = strokes.map((s) => s.getTotalLength());
  const width = () => g.setAttribute('stroke-width', 1 / (svg.getScreenCTM()?.a || 1));
  width();
  return {
    g,
    strokes,
    width,
    // sin dibujar (luego GSAP lleva strokeDashoffset a 0)
    hide() { strokes.forEach((s, i) => { s.style.strokeDasharray = lengths[i]; s.style.strokeDashoffset = lengths[i]; }); },
  };
}

export function createWater(svg, shapes) {
  const id = `disco-water-${++uid}`;
  const defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS(SVGNS, 'defs'), svg.firstChild);

  const clip = document.createElementNS(SVGNS, 'clipPath');
  clip.id = id;
  shapes.forEach((s) => {
    const c = document.createElementNS(SVGNS, 'path');
    c.setAttribute('d', s.getAttribute('d'));
    clip.append(c);
  });
  defs.append(clip);

  // caja de todas las formas (en unidades del viewBox). Se mide al pintar: con el logo oculto
  // (display: none) getBBox da ceros
  let x0, y0, x1, y1, close, maxA;
  let W = 0;
  let H = 0;
  const pad = 4;
  const measure = () => {
    if (W > 0) return true;
    const boxes = shapes.map((s) => s.getBBox());
    x0 = Math.min(...boxes.map((b) => b.x));
    y0 = Math.min(...boxes.map((b) => b.y));
    x1 = Math.max(...boxes.map((b) => b.x + b.width));
    y1 = Math.max(...boxes.map((b) => b.y + b.height));
    W = x1 - x0;
    H = y1 - y0;
    close = `L${(x1 + pad).toFixed(1)},${(y1 + pad).toFixed(1)}L${(x0 - pad).toFixed(1)},${(y1 + pad).toFixed(1)}Z`;
    maxA = Math.max(FRONT.amp, BACK.amp) * H;
    return W > 0;
  };

  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('clip-path', `url(#${id})`);
  g.setAttribute('aria-hidden', 'true');
  const back = document.createElementNS(SVGNS, 'path');
  const front = document.createElementNS(SVGNS, 'path');
  const crest = document.createElementNS(SVGNS, 'path');
  back.setAttribute('fill', WATER);
  back.setAttribute('opacity', '0.45');
  front.setAttribute('fill', WATER);
  crest.setAttribute('fill', 'none');
  crest.setAttribute('stroke', '#fff');
  g.append(back, front, crest);
  shapes[0].parentNode.insertBefore(g, shapes[0]);

  const crestWidth = () => crest.setAttribute('stroke-width', 1 / (svg.getScreenCTM()?.a || 1));
  crestWidth();

  const surface = (wave, base, k, t) => {
    const a = wave.amp * H * k;
    const len = wave.length * W;
    const w = (Math.PI * 2) / wave.period;
    let d = '';
    for (let i = 0; i <= STEPS; i++) {
      const x = x0 - pad + ((W + pad * 2) * i) / STEPS;
      const y = base + a * Math.sin(((x - x0) / len) * Math.PI * 2 - w * t + wave.phase);
      d += `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(2)}`;
    }
    return d;
  };

  let last = -1;
  return {
    g,
    resize: crestWidth,
    // level 0..1 (0: nada de agua, 1: todo lleno, sin que asome ningún valle); t en segundos
    render(level, t) {
      if (!measure()) return;
      const k = 1 - (1 - SETTLE) * level;
      // la superficie va de debajo de la caja (las crestas ni asoman) a encima (los valles no asoman)
      const base = y1 + maxA - level * (H + maxA * 2);
      const top = surface(FRONT, base, k, t);
      front.setAttribute('d', top + close);
      crest.setAttribute('d', top);
      back.setAttribute('d', surface(BACK, base, k, t) + close);
      crest.setAttribute('opacity', level > 0.001 && level < 0.999 ? 0.9 : 0);
      last = level;
    },
    // lleno y quieto (movimiento reducido o al terminar)
    fill() {
      if (!measure()) return;
      const r = `M${x0 - pad},${y0 - pad}H${x1 + pad}V${y1 + pad}H${x0 - pad}Z`;
      front.setAttribute('d', r);
      back.setAttribute('d', '');
      crest.setAttribute('d', '');
      last = 1;
    },
    get level() { return last; },
  };
}
