// Fusión de "Dale al REC." con el estudio (home): mientras el estudio sube desde abajo (su top, de la altura de la
// pantalla a 0), el panorama aparece por encima del degradado naranja (js/studio.js: opacidad 0 → 1, desenfoque
// 12 px → 0 y escala 1.04 → 1) y el degradado baja su opacidad (js/rec.js). Mismo cálculo en los dos.
// (LEGACY: el iris de seis palas, en legacy/js/iris.js)
export const CROSS = { zoom: 1.04, blur: 3.5, recFrom: 0.55 }; // blur: sesgo de mipmap (≈ 12 px de desenfoque)

export function crossAt(top, h = innerHeight) {
  const t = Math.min(1, Math.max(0, 1 - top / h));
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // power2.inOut
}
