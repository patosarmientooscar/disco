// Datos de servicios.html. Se cambian aquí, sin tocar el resto del código.
// BORRADOR: textos de sectores pendientes de revisar (PENDIENTES.md). Los textos del proceso (bento) están en
// servicios.html.

// Foto ("Dispara"): las fotos que se disparan y forman el muro, en orden (la última se queda en el centro).
// PROVISIONALES (fotos de la web): sustituir por 6–10 fotos reales de 1600 px de ancho como mínimo.
export const shots = [
  { src: 'assets/hero/03.webp', alt: 'Terraza con sombrillas blancas y una palmera frente al mar' },
  { src: 'assets/hero/01.webp', alt: 'Bola de discoteca encendida en la oscuridad' },
  { src: 'assets/hero/04.webp', alt: 'Mujer sonriendo con una copa en la mano, en blanco y negro' },
  { src: 'assets/hero/02.webp', alt: 'Dos personas bailando, movidas, iluminadas en rojo' },
  { src: 'assets/hero/06.webp', alt: 'Siluetas bailando a contraluz, en blanco y negro' },
  { src: 'assets/hero/07.webp', alt: 'Persona en movimiento, desenfocada, sobre fondo blanco' },
  { src: 'assets/hero/05.webp', alt: 'Chico con una pala de pádel contra un cielo azul' },
];

// Vídeo: la "hoja de montaje". video (opcional): { src, poster } de un clip mudo y corto. Cuando
// exista, la fila lo enseñará pequeño siguiendo al cursor (aún sin implementar: no hay vídeos).
export const formats = [
  { name: 'Reels y TikTok', spec: '9:16 · 15–60 s', tc: 45, video: null },
  { name: 'Vídeo de marca', spec: '16:9 · 1–3 min', tc: 120, video: null },
  { name: 'Aftermovie de eventos', spec: '16:9 + 9:16', tc: 90, video: null },
  { name: 'Entrevistas y testimonios', spec: '16:9 · multicámara', tc: 150, video: null },
  { name: 'Edición, color y sonido', spec: 'montaje al beat · etalonaje · subtítulos', tc: 60, video: null },
];

// Para quién (BORRADOR). photo: foto pequeña que sigue al cursor (null = sin foto, de momento)
export const sectors = [
  { name: 'Restaurantes y gastronomía', text: 'Platos, espacios y equipo. Contenido que abre el apetito.', photo: { src: 'assets/hero/03.webp', w: 1600, h: 1067 } },
  { name: 'Eventos, fiestas y noche', text: 'Aftermovies, foto de ambiente y reels en el mismo día.', photo: { src: 'assets/hero/01.webp', w: 1600, h: 1200 } },
  { name: 'Marcas, moda y producto', text: 'Campañas, lookbooks y producto con dirección de arte.', photo: null },
  { name: 'Empresas y artistas', text: 'Vídeo corporativo, entrevistas, retratos y contenido para redes.', photo: { src: 'assets/hero/04.webp', w: 1600, h: 1200 } },
  { name: 'Eventos deportivos', text: 'Cobertura en directo, highlights y foto de acción.', photo: { src: 'assets/hero/05.webp', w: 1600, h: 1067 } },
];
