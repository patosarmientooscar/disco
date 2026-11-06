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
// bw: true en las fotos en blanco y negro (filtro "B/N" de la galería del proyecto).
// seo: { type, description } para su página (tools/proyectos.mjs).
// project: lo de su página (proyecto-<slug>.html, la genera tools/proyectos.mjs): frase, ficha, encargo / idea / resultado, reels y secuencia (reels:
//   [] = proyecto solo de fotos: la portada lleva la foto en vez del móvil y no hay sección de reels).
// Con UN solo trabajo, el portfolio lo enseña como proyecto destacado; con 2 o más, la rejilla. Cada uno abre su página.
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
      { type: 'img', bw: true, src: 'assets/portfolio/cachondeo/cachondeo-17.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-17-1000.webp', w: 2000, h: 1500, alt: 'En blanco y negro: grupo de amigos abrazados bajo el letrero luminoso de Cachondeo Group' },
      { type: 'img', bw: true, src: 'assets/portfolio/cachondeo/cachondeo-18.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-18-1000.webp', w: 1500, h: 2000, alt: 'En blanco y negro: chico con la bufanda del Getafe sobre la cabeza haciendo cuernos con las manos' },
      { type: 'img', bw: true, src: 'assets/portfolio/cachondeo/cachondeo-19.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-19-1000.webp', w: 1500, h: 2000, alt: 'En blanco y negro: chico con camiseta de Cachondeo Group sonriendo de perfil' },
      { type: 'img', bw: true, src: 'assets/portfolio/cachondeo/cachondeo-20.webp', thumb: 'assets/portfolio/cachondeo/cachondeo-20-1000.webp', w: 2000, h: 1500, alt: 'En blanco y negro: micrófono y pulseras de Cachondeo Group sobre una mesa' },
    ],
    year: 2026,
    deliverables: ['2 reels verticales', '+80 fotos editadas', 'Cobertura completa del evento'],
    // la página del proyecto (proyecto-cachondeo-group.html, js/proyecto.js). Textos: BORRADOR (Oscar los confirma)
    // SEO de su página (tools/proyectos.mjs): título = '{title}: {type} en Madrid — disco.' (≤ 60) y descripción (≤ 155)
    seo: { type: 'fiesta', description: 'Karaoke, fútbol y camisetas naranjas: la fiesta de Cachondeo Group en Madrid, contada en dos reels verticales y más de 80 fotos editadas.' },
    project: {
      tagline: 'Una noche de karaoke, fútbol y camisetas naranjas. La contamos en dos reels y más de 80 fotos.',
      facts: [
        ['Cliente', 'Cachondeo Group'],
        ['Tipo', 'Evento nocturno'],
        ['Lugar', 'Madrid [CONFIRMAR]'],
        ['Año', '2026'],
        ['Entregables', '2 reels, +80 fotos'],
        ['Equipo', 'Luna López, Bruno Marín'],
      ],
      story: [
        ['El encargo', 'Contar la fiesta de Cachondeo Group para sus redes, con la energía real de la noche.'],
        ['La idea', 'Rodar sin interrumpir: cámara en mano entre la gente, flash directo y el naranja de la marca en cada plano.'],
        ['El resultado', 'Dos reels verticales listos para Instagram y TikTok y una galería completa para el cliente al día siguiente.'],
      ],
      // los reels (duración: la real, se vuelve a leer del vídeo)
      reels: [
        { src: 'assets/portfolio/cachondeo/reel-recap.mp4', poster: 'assets/portfolio/cachondeo/reel-recap-poster.webp', title: 'Recap de la noche', duration: '0:19', alt: 'Reel resumen de la fiesta de Cachondeo Group' },
        { src: 'assets/portfolio/cachondeo/reel-fiesta.mp4', poster: 'assets/portfolio/cachondeo/reel-fiesta-poster.webp', title: 'La fiesta', duration: '0:23', alt: 'Reel de la fiesta de Cachondeo Group' },
      ],
      // "La noche en secuencia": 6 fotos (número de la foto) con su pie
      sequence: [
        ['01', '21:47 · Foto de grupo'],
        ['05', '22:20 · Abrazos'],
        ['08', '23:05 · La pista'],
        ['13', '23:40 · Karaoke'],
        ['15', '00:15 · El micro'],
        ['17', '01:30 · La última'],
      ],
    },
  },
  {
    slug: 'esb',
    title: 'E, S, B',                                   // BORRADOR: Oscar confirma el nombre del cliente
    client: 'E, S, B · Noche en Madrid',                 // BORRADOR: Oscar confirma lugar y fecha
    category: 'noche',
    kind: 'foto',
    cover: 'assets/portfolio/esb/esb-01-1000.webp',
    coverLarge: 'assets/portfolio/esb/esb-01.webp',
    ratio: '16/9',
    media: [
      { type: 'img', src: 'assets/portfolio/esb/esb-01.webp', thumb: 'assets/portfolio/esb/esb-01-1000.webp', w: 2000, h: 1125, alt: 'Chico con sudadera bajo el letrero luminoso de Desperados en un bar con luz azul y violeta' },
      { type: 'img', src: 'assets/portfolio/esb/esb-02.webp', thumb: 'assets/portfolio/esb/esb-02-1000.webp', w: 2000, h: 1333, alt: 'Bola de espejos iluminada en violeta en el techo del bar' },
      { type: 'img', src: 'assets/portfolio/esb/esb-03.webp', thumb: 'assets/portfolio/esb/esb-03-1000.webp', w: 2000, h: 1500, alt: 'Chico de pie en la barra, bajo el neón de Desperados y la luz azul del mostrador' },
      { type: 'img', src: 'assets/portfolio/esb/esb-04.webp', thumb: 'assets/portfolio/esb/esb-04-1000.webp', w: 1333, h: 2000, alt: 'Chico con gorra de los Rockies y cadena, de perfil, con una botella en la mano' },
      { type: 'img', src: 'assets/portfolio/esb/esb-05.webp', thumb: 'assets/portfolio/esb/esb-05-1000.webp', w: 2000, h: 1500, alt: 'Chico con gorra sonriendo a cámara delante de la barra llena de luces' },
      { type: 'img', src: 'assets/portfolio/esb/esb-06.webp', thumb: 'assets/portfolio/esb/esb-06-1000.webp', w: 1250, h: 2000, alt: 'Chica sonriendo junto a la diana, con luz violeta' },
      { type: 'img', src: 'assets/portfolio/esb/esb-07.webp', thumb: 'assets/portfolio/esb/esb-07-1000.webp', w: 2000, h: 1500, alt: 'Tres amigos sentados en el sofá hablando, con luz rosa y azulejos detrás' },
      { type: 'img', src: 'assets/portfolio/esb/esb-08.webp', thumb: 'assets/portfolio/esb/esb-08-1000.webp', w: 2000, h: 2000, alt: 'Chico con gorra de los Rockies sentado en el sofá bajo luz azul intensa' },
      { type: 'img', src: 'assets/portfolio/esb/esb-09.webp', thumb: 'assets/portfolio/esb/esb-09-1000.webp', w: 2000, h: 1125, alt: 'Grupo en los sofás entre velas y luces cálidas, con carteles antiguos en la pared' },
      { type: 'img', src: 'assets/portfolio/esb/esb-10.webp', thumb: 'assets/portfolio/esb/esb-10-1000.webp', w: 2000, h: 1125, alt: 'Dos chicas y un chico con gorra posando juntos en el sofá' },
      { type: 'img', src: 'assets/portfolio/esb/esb-11.webp', thumb: 'assets/portfolio/esb/esb-11-1000.webp', w: 2000, h: 1125, alt: 'Chica rubia sonriendo mientras habla con un chico con gorra' },
      { type: 'img', src: 'assets/portfolio/esb/esb-12.webp', thumb: 'assets/portfolio/esb/esb-12-1000.webp', w: 2000, h: 1125, alt: 'Chico de perfil a contraluz, con un fondo amarillo y rosa desenfocado' },
      { type: 'img', src: 'assets/portfolio/esb/esb-13.webp', thumb: 'assets/portfolio/esb/esb-13-1000.webp', w: 2000, h: 1125, alt: 'Dos chicos charlando en el sofá con luz roja, bajo un cartel de Marilyn Monroe' },
      { type: 'img', src: 'assets/portfolio/esb/esb-14.webp', thumb: 'assets/portfolio/esb/esb-14-1000.webp', w: 1500, h: 2000, alt: 'Dos amigos abrazados sonriendo a cámara en el bar' },
      { type: 'img', src: 'assets/portfolio/esb/esb-15.webp', thumb: 'assets/portfolio/esb/esb-15-1000.webp', w: 1500, h: 2000, alt: 'Tres amigos posando juntos, uno con los brazos cruzados delante' },
      { type: 'img', src: 'assets/portfolio/esb/esb-16.webp', thumb: 'assets/portfolio/esb/esb-16-1000.webp', w: 2000, h: 1500, alt: 'Chica de espaldas haciendo una foto con el móvil en la calle de noche' },
      { type: 'img', bw: true, src: 'assets/portfolio/esb/esb-17.webp', thumb: 'assets/portfolio/esb/esb-17-1000.webp', w: 2000, h: 1500, alt: 'En blanco y negro: chica con el pelo largo riendo en la calle' },
      { type: 'img', bw: true, src: 'assets/portfolio/esb/esb-18.webp', thumb: 'assets/portfolio/esb/esb-18-1000.webp', w: 2000, h: 1500, alt: 'En blanco y negro: chico con gorra de los Rockies y pendientes, de perfil' },
      { type: 'img', bw: true, src: 'assets/portfolio/esb/esb-19.webp', thumb: 'assets/portfolio/esb/esb-19-1000.webp', w: 1500, h: 2000, alt: 'En blanco y negro: dos chicos con chaquetas de cuero junto a la estatua de la entrada del bar' },
      { type: 'img', bw: true, src: 'assets/portfolio/esb/esb-20.webp', thumb: 'assets/portfolio/esb/esb-20-1000.webp', w: 2000, h: 1500, alt: 'En blanco y negro: chica y chico con gorra sonriendo juntos a cámara' },
    ],
    year: 2026,
    deliverables: ['+130 fotos editadas', 'Color y blanco y negro'],
    // la página del proyecto (proyecto-esb.html). Solo fotos: sin reels (js/proyecto.js pinta la portada con la foto
    // en vez del móvil y no pinta la sección de reels). Textos: BORRADOR (Oscar los confirma)
    seo: { type: 'sesión de fotos nocturna', description: 'Neones, sofás y amigos: una noche de E, S, B en Madrid contada en más de 130 fotos editadas, en color y en blanco y negro.' },
    project: {
      tagline: 'Una noche entre neones, sofás y amigos. La contamos en más de 130 fotos, en color y en blanco y negro.',
      facts: [
        ['Cliente', 'E, S, B [CONFIRMAR]'],
        ['Tipo', 'Sesión nocturna'],
        ['Lugar', 'Madrid [CONFIRMAR]'],
        ['Año', '2026'],
        ['Entregables', '+130 fotos'],
        ['Equipo', 'Luna López, Bruno Marín'],
      ],
      story: [
        ['El encargo', 'Retratar una noche con amigos tal como se vive: la barra, los sofás y la calle a la salida.'],
        ['La idea', 'Dejar que mande la luz del local: neones violetas, velas y rojos dentro, y un blanco y negro duro fuera, con flash directo.'],
        ['El resultado', 'Una serie de más de 130 fotos editadas, en color y en blanco y negro, lista para redes y para el recuerdo.'],
      ],
      reels: [],
      // "La noche en secuencia": 6 fotos con su pie (sin horas: no las tenemos)
      sequence: [
        ['02', 'La bola'],
        ['01', 'Desperados'],
        ['07', 'El sofá'],
        ['09', 'Velas'],
        ['14', 'Los de siempre'],
        ['17', 'Fuera'],
      ],
    },
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
