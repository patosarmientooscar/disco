// Datos de servicios.html. Se cambian aquí, sin tocar el resto del código.
// BORRADOR: textos de sectores pendientes de revisar (PENDIENTES.md). Los textos del proceso (bento) están en
// servicios.html.

// Para quién (BORRADOR). photo: foto pequeña que sigue al cursor (null = sin foto). Fotos reales: la fiesta de
// Cachondeo Group y fotogramas del DISCO VIDEO; la de restaurantes sigue provisional (PENDIENTES.md)
export const sectors = [
  { name: 'Restaurantes y gastronomía', text: 'Platos, espacios y equipo. Contenido que abre el apetito.', photo: { src: 'assets/hero/03.webp', w: 1600, h: 1067, alt: 'Terraza con sombrillas blancas y gente comiendo frente al mar' } },
  { name: 'Eventos, fiestas y noche', text: 'Aftermovies, foto de ambiente y reels en el mismo día.', photo: { src: 'assets/portfolio/cachondeo/cachondeo-13-1000.webp', w: 1000, h: 667, alt: 'Dos chicas riendo y cantando, una con el micro y otra con la bufanda del Getafe' } },
  { name: 'Marcas, moda y producto', text: 'Campañas, lookbooks y producto con dirección de arte.', photo: { src: 'assets/servicios/sectores/marcas-padel.webp', w: 1600, h: 900, alt: 'Chico sin camiseta jugando al pádel contra un cielo azul' } },
  { name: 'Empresas y artistas', text: 'Vídeo corporativo, entrevistas, retratos y contenido para redes.', photo: { src: 'assets/servicios/sectores/artistas-directo.webp', w: 1600, h: 900, alt: 'En blanco y negro, retrato de un artista entre carteles y pantallas de un directo' } },
  { name: 'Eventos deportivos', text: 'Cobertura en directo, highlights y foto de acción.', photo: { src: 'assets/servicios/sectores/deportes-rugby.webp', w: 1600, h: 900, alt: 'Jugador de rugby con la camiseta azul del número 10 chutando en el campo' } },
];

// Tres oficios, panel Edición (js/oficios.js): antes / después con fotos reales. Cada pareja es LA MISMA foto sin editar
// (antes) y editada (después). Para añadir una:
//   · las dos con el mismo encuadre exacto y el mismo tamaño (si no, la cortinilla no casa);
//   · webp de 2000 px de ancho + su versión de 1000 px (-1000.webp), en assets/servicios/post/;
//   · ancho y alto (w, h) de la grande; alt: qué se ve, corto; nota: la etiqueta de la esquina (opcional);
//   · foco (opcional): el punto que manda al recortar la foto al panel ('50% 45%' si no se pone).
// Con una sola pareja no se ve la tira de miniaturas; con 2–8, sí (una por pareja, en este orden).
export const edicionPares = [
  {
    antes: 'assets/servicios/post/post-antes.webp',
    antesSm: 'assets/servicios/post/post-antes-1000.webp',
    despues: 'assets/servicios/post/post-despues.webp',
    despuesSm: 'assets/servicios/post/post-despues-1000.webp',
    w: 2000,
    h: 1500,
    alt: 'Cuatro amigas cantando y riendo con un micro en una fiesta',
    foco: '50% 30%',
    nota: 'RAW → DISCO GRADE',
  },
];
