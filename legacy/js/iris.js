// Iris de la entrada al estudio (home): el diafragma de un objetivo que se abre desde el centro (hexágono de
// 6 palas que gira mientras se abre). Lo usan el panorama del estudio (js/studio.js, se ve DENTRO) y el
// degradado de "Dale al REC." (js/rec.js, las palas FUERA): mismo cálculo en los dos, el borde casa.
// t: 0 → 1 mientras el estudio sube desde abajo (su top, de la altura de la pantalla a 0).
export const IRIS_TURN = Math.PI / 3; // giro de las palas al abrirse (60°)

export function irisAt(top, w = innerWidth, h = innerHeight) {
  const t = Math.min(1, Math.max(0, 1 - top / h));
  const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; // cubic.inOut
  // apotema del hexágono: con e = 1 tapa la pantalla entera (media diagonal y un poco más)
  const r = e * Math.hypot(w, h) * 0.5 * 1.04;
  return { t, r, rot: (1 - e) * IRIS_TURN, cx: w / 2, cy: h / 2 };
}

// GLSL: 1 dentro del hexágono (apotema r, girado rot, centro c; px de pantalla), 0 fuera; borde de ~1.5 px
export const IRIS_GLSL = /* glsl */ `
float irisMask( vec2 frag, vec2 c, float r, float rot ) {
  vec2 q = frag - c;
  float cs = cos( rot ), sn = sin( rot );
  q = abs( mat2( cs, -sn, sn, cs ) * q );
  float d = max( dot( q, vec2( 0.8660254, 0.5 ) ), q.y );
  return 1.0 - smoothstep( r - 1.5, r + 1.5, d );
}`;
