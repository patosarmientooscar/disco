// Portfolio: todo sale de aquí (js/portfolio.js lo pinta). Vacío = huecos y el aviso "Estamos rodando...".
// Fotos y vídeos en assets/portfolio/ (medidas recomendadas en PENDIENTES.md).

// Showreel: vídeo de 30–60 s, 16:9 (mp4 H.264, 1920×1080, ~8–12 MB) y su póster (webp 1920×1080).
export const showreel = { src: '', poster: '' };

// category: 'restaurantes' | 'noche' | 'eventos' | 'marcas'
// kind: 'foto' | 'video'
// cover: portada de la rejilla (webp; 1200 px de ancho). ratio de la portada: '4/5', '1/1' o '9/16'
// preview: (opcional, solo vídeo) mp4 mudo y corto (3–6 s, 720 px) que se reproduce al pasar el ratón
// media: lo que se ve en la ficha: fotos { type: 'img', src, alt } y vídeos { type: 'video', src, poster }
export const works = [
  /* EJEMPLO (descoméntalo y cámbialo):
  {
    slug: 'casa-lola',                       // va en la URL: portfolio.html#casa-lola
    title: 'Casa Lola',
    client: 'Casa Lola · Restaurante en Chamberí',
    category: 'restaurantes',
    kind: 'video',
    cover: 'assets/portfolio/casa-lola/cover.webp',
    ratio: '4/5',
    preview: 'assets/portfolio/casa-lola/preview.mp4',
    media: [
      { type: 'video', src: 'assets/portfolio/casa-lola/reel-01.mp4', poster: 'assets/portfolio/casa-lola/reel-01.webp' },
      { type: 'img', src: 'assets/portfolio/casa-lola/01.webp', alt: 'Plato de arroz negro sobre la barra' },
    ],
    year: 2026,
    deliverables: ['3 reels', '20 fotos'],
  },
  */
];
