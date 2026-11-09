// Paso de "Dale al REC." al estudio (home). El estudio se solapa con la última pantalla del tramo naranja
// (css/studio.css: margin-top −100vh, transparente hasta que empieza): su pin empieza justo cuando el naranja está
// completo, sin una pantalla de scroll de por medio. Ahí el panorama entra en un corte rápido POR TIEMPO (no con el
// scroll: opacidad 0 → 1, desenfoque ≈ 12 px → 0 y escala 1.04 → 1) y el degradado se apaga a la vez. Un solo valor
// para los dos: js/studio.js lo anima, js/rec.js lo lee.
// (LEGACY: el fundido ligado al scroll mientras el estudio subía, en legacy/js/studio-cross-scroll.js; el iris de
// seis palas, en legacy/js/iris.js)
export const CROSS = { zoom: 1.04, blur: 3.5, in: 0.45, out: 0.3 }; // blur: sesgo de mipmap; in / out: s
export const cross = { v: 0 };
// AZ: la entrada al estudio. Al encenderse (desde arriba), la cámara se queda un momento en el set y gira SOLA
// hasta FOTO, por tiempo (js/studio.js). q: progreso de esa intro (0 → 1, lineal en el tiempo); 1 = hecha o sin
// intro (entrando desde abajo). OLD: la parte del recorrido de antes que ahora hace la intro (el set y el paneo a
// FOTO eran p 0 → 0.32 del scroll): el progreso "de antes", para lo que va con las fracciones de siempre (las fichas,
// el destello), es OLD · q + (1 − OLD) · p.
export const intro = { q: 1, OLD: 0.32 };
export const oldP = (p) => intro.OLD * intro.q + (1 - intro.OLD) * p;
