// Proceso: la HOJA DE PRODUCCIÓN (servicios.html, css/servicios.css; AR-F). Tres filas, una por fase
// (Preproducción · Rodaje · Postproducción), con tarjetas compactas. Aquí solo la línea de tiempo de cada fila, que
// se dibuja de izquierda a derecha con el scroll (--draw de 0 a 1, scrub). El encendido de cada tarjeta lo hace el
// destello al aterrizar en ella (js/page-star.js: .is-lit, --sx / --sy y el evento "disco:light"; el borde, el halo
// y la marca naranja, en CSS). Sin transformaciones en las tarjetas: ni la sección ni ellas crean contexto de
// apilamiento (el texto, por encima del destello: AR-B).
// Movimiento reducido: las líneas, ya dibujadas.
// (LEGACY: el bento grande, con una ilustración animada por tarjeta, en legacy/servicios-bento-grande/)
export function initBento({ gsap, still }) {
  const sheet = document.querySelector('[data-bento]');
  if (!sheet) return;
  const rows = [...sheet.querySelectorAll('.sheet__row')];
  if (still) return;
  rows.forEach((row) => {
    row.style.setProperty('--draw', '0');
    gsap.to(row, {
      '--draw': 1,
      ease: 'none',
      scrollTrigger: { trigger: row, start: 'top 88%', end: 'top 58%', scrub: 0.8 },
    });
  });
}
