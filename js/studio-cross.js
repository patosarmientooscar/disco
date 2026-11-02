// Paso de "Dale al REC." al estudio (home). El estudio se solapa con la última pantalla del tramo naranja
// (css/studio.css: margin-top −100vh, transparente hasta que empieza): su pin empieza justo cuando el naranja está
// completo, sin una pantalla de scroll de por medio. Ahí el panorama entra en un corte rápido POR TIEMPO (no con el
// scroll: opacidad 0 → 1, desenfoque ≈ 12 px → 0 y escala 1.04 → 1) y el degradado se apaga a la vez. Un solo valor
// para los dos: js/studio.js lo anima, js/rec.js lo lee.
// (LEGACY: el fundido ligado al scroll mientras el estudio subía, en legacy/js/studio-cross-scroll.js; el iris de
// seis palas, en legacy/js/iris.js)
export const CROSS = { zoom: 1.04, blur: 3.5, in: 0.45, out: 0.3 }; // blur: sesgo de mipmap; in / out: s
export const cross = { v: 0 };
