// Portfolio: todo sale de aquí (js/portfolio.js lo pinta). Vacío = huecos y el aviso "Estamos rodando...".
// Fotos y vídeos en assets/portfolio/ (medidas recomendadas en PENDIENTES.md).

// Showreel: vídeo de 30–60 s, 16:9 (mp4 H.264) y su póster. De momento, el manifiesto de disco (38 s, con sonido).
export const showreel = { src: 'assets/paginas/disco-manifiesto.mp4', poster: 'assets/paginas/disco-manifiesto-poster.webp' };

// category: 'restaurantes' | 'noche' | 'eventos' | 'marcas'
// kind: 'foto' | 'video'
// cover: portada de la rejilla (webp; 1200 px de ancho). ratio de la portada: '4/5', '1/1' o '9/16'
// preview: (opcional, solo vídeo) mp4 mudo y corto (3–6 s, 720 px) que se reproduce al pasar el ratón
// media: lo que se ve en la ficha: fotos { type: 'img', src, thumb, w, h, alt } (src: la grande, para el visor;
//   thumb: la de 1000 px, para la rejilla) y vídeos { type: 'video', src, poster, alt }
// Con UN solo trabajo, la página lo enseña como proyecto destacado (portada, reels y galería); con 2 o más, la rejilla.
export const works = [
  {
    slug: 'cachondeo-group',
    title: 'Cachondeo Group',
    client: 'Cachondeo Group · Fiesta en Madrid', // BORRADOR: Oscar confirma lugar y fecha
    category: 'noche',
    kind: 'video',
    cover: 'assets/portfolio/cachondeo/cachondeo-01-1000.webp',
    coverLarge: 'assets/portfolio/cachondeo/cachondeo-01.webp',
    ratio: '16/9',
    preview: 'assets/portfolio/cachondeo/reel-recap.mp4',
    media: [
      { type: 'video', src: 'assets/portfolio/cachondeo/reel-recap.mp4', poster: 'assets/portfolio/cachondeo/reel-recap-poster.webp', alt: 'Reel resumen de la fiesta de Cachondeo Group' },
      { type: 'video', src: 'assets/portfolio/cachondeo/reel-fiesta.mp4', poster: 'assets/portfolio/cachondeo/reel-fiesta-poster.webp', alt: 'Reel de la fiesta de Cachondeo Group' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-01.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-01-1000.webp', w: 2000, h: 1125, alt: 'Grupo de amigos con camisetas naranjas de Cachondeo Group posando juntos en la fiesta' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-02.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-02-1000.webp', w: 1333, h: 2000, alt: 'Chico con camiseta naranja de Cachondeo Group cantando al micro entre la gente' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-03.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-03-1000.webp', w: 2000, h: 1500, alt: 'Dos chicas cantando al micro, una con la bufanda del Getafe' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-04.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-04-1000.webp', w: 1333, h: 2000, alt: 'Chica con la bufanda del Getafe riendo a carcajadas con el micro junto a su amiga' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-05.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-05-1000.webp', w: 2000, h: 1500, alt: 'Pareja abrazada y sonriendo; él con la camiseta naranja de Cachondeo Group' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-06.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-06-1000.webp', w: 1333, h: 2000, alt: 'Chico con camiseta naranja dando un beso en la mejilla a una chica que sonríe con los ojos cerrados' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-07.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-07-1000.webp', w: 1333, h: 2000, alt: 'Dos chicos con camisetas naranjas, uno con la bufanda del Getafe, hablándose al oído' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-08.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-08-1000.webp', w: 2000, h: 1125, alt: 'Chico con camiseta naranja bailando con los brazos abiertos delante de un grupo de chicas' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-09.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-09-1000.webp', w: 1333, h: 2000, alt: 'Chico con camiseta naranja de Cachondeo Group cantando con fuerza al micro' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-10.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-10-1000.webp', w: 1333, h: 2000, alt: 'Chica rubia cantando al micro junto a un chico con camiseta naranja' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-11.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-11-1000.webp', w: 1333, h: 2000, alt: 'Chico con camiseta naranja de Cachondeo Group cantando en mitad de la fiesta' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-12.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-12-1000.webp', w: 2000, h: 1500, alt: 'Dos amigas abrazadas cantando juntas al mismo micro' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-13.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-13-1000.webp', w: 2000, h: 1333, alt: 'Dos chicas riendo y cantando, una con el micro y otra con la bufanda del Getafe' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-14.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-14-1000.webp', w: 2000, h: 1500, alt: 'Grupo de chicas cantando y riendo en la pista con un micro' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-15.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-15-1000.webp', w: 2000, h: 1333, alt: 'Chico con camiseta naranja cantando al micro con la gente detrás' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-16.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-16-1000.webp', w: 1333, h: 2000, alt: 'Chico sonriente con camiseta naranja de Cachondeo Group y la bufanda del Getafe al hombro' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-17.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-17-1000.webp', w: 2000, h: 1500, alt: 'En blanco y negro: grupo de amigos abrazados bajo el letrero luminoso de Cachondeo Group' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-18.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-18-1000.webp', w: 1500, h: 2000, alt: 'En blanco y negro: chico con la bufanda del Getafe sobre la cabeza haciendo cuernos con las manos' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-19.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-19-1000.webp', w: 1500, h: 2000, alt: 'En blanco y negro: chico con camiseta de Cachondeo Group sonriendo de perfil' },
      { type: 'img', src: 'assets/portfolio/cachondeo/cachondeo-20.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-20-1000.webp', w: 2000, h: 1500, alt: 'En blanco y negro: micrófono y pulseras de Cachondeo Group sobre una mesa' },
    ],
    year: 2026,
    deliverables: ['2 reels verticales', '+80 fotos editadas', 'Cobertura completa del evento'],
  },
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
