// Medidas sin forzar el layout (AY-A). Leer innerHeight / innerWidth o getBoundingClientRect() dentro del loop,
// después de que GSAP haya escrito transformaciones, obliga al navegador a recalcular estilos y layout en mitad del
// fotograma (en móvil, la mitad del tiempo del fotograma). Aquí:
// - vp: el tamaño de la ventana, actualizado en resize ANTES que cualquier otro listener (capture, y este módulo se
//   carga el primero).
// - box(el): la caja de un elemento EN PANTALLA a partir de su posición en el documento, medida en resize, al cargar,
//   en cada refresh de ScrollTrigger y cuando cambia el alto de la página; por fotograma solo se resta scrollY (que no
//   fuerza el layout). Solo para elementos que no se mueven con transform ni con sticky (secciones, escenarios).
// - el scroll: también en caché. Leer scrollY en mitad del fotograma fuerza el layout igual que un rect; se lee en el
//   evento scroll (al principio del fotograma, con el layout limpio). Con Lenis, su animatedScroll (lo que acaba de
//   poner en su raf: con la rueda suavizada, el evento scroll llegaría un fotograma tarde).
const lenisY = () => { const l = window.disco?.lenis; return l && Number.isFinite(l.animatedScroll) ? l.animatedScroll : vp.y; };
export const vp = { w: innerWidth, h: innerHeight, y: scrollY, x: scrollX };
addEventListener('scroll', () => { vp.y = scrollY; vp.x = scrollX; }, { passive: true, capture: true });

const boxes = new Map(); // el → { top, left, width, height } en coordenadas del documento
let pending = 0;
const measure = () => {
  pending = 0;
  const sy = (vp.y = scrollY);
  const sx = (vp.x = scrollX);
  boxes.forEach((b, el) => {
    const r = el.getBoundingClientRect();
    b.top = r.top + sy;
    b.left = r.left + sx;
    b.width = r.width;
    b.height = r.height;
  });
};
const later = () => { if (!pending) pending = requestAnimationFrame(measure); };

addEventListener('resize', () => { vp.w = innerWidth; vp.h = innerHeight; measure(); }, { capture: true });
addEventListener('load', later);
document.fonts?.ready.then(later);
// (ScrollTrigger crea los espaciadores de los pines al refrescar: las cajas se miden después)
const hook = () => { if (window.ScrollTrigger) window.ScrollTrigger.addEventListener('refresh', measure); else setTimeout(hook, 100); };
hook();
if ('ResizeObserver' in window) new ResizeObserver(later).observe(document.documentElement);

export function box(el) {
  let b = boxes.get(el);
  if (!b) {
    b = { top: 0, left: 0, width: 0, height: 0 };
    boxes.set(el, b);
    const r = el.getBoundingClientRect();
    b.top = r.top + (vp.y = scrollY);
    b.left = r.left + (vp.x = scrollX);
    b.width = r.width;
    b.height = r.height;
  }
  const top = b.top - lenisY();
  const left = b.left - vp.x;
  return { top, bottom: top + b.height, left, right: left + b.width, width: b.width, height: b.height };
}
