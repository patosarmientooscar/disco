// Datos de contacto — rellenar con los reales antes de publicar.
export const config = {
  whatsapp: {
    phone: '34600000000', // formato internacional sin + ni espacios
    message: 'Hola disco.es, quiero pedir presupuesto para',
  },
  instagram: {
    handle: '@disco.es',
    url: 'https://www.instagram.com/disco.es/',
  },
  email: 'equipo@discoproduccion.com',
  siteUrl: '',          // [DOMINIO], p. ej. 'https://disco.es' (para og:url / canonical)
  city: 'Madrid',
  // (el footer del editor, en legacy/footer-editor/, sacaba de aquí estos datos; lo que esté vacío sale como [HUECO])
  phone: '',            // [TU TELÉFONO] visible, p. ej. '+34 600 000 000'
  responseTime: '',     // [TIEMPO DE RESPUESTA], p. ej. 'menos de 24 h'
  // qué datos son reales: con false, ese botón o dato NO se pinta (nada de enlaces a 34600000000)
  ready: { whatsapp: false, phone: false },
  // prueba social de la home (js/home-close.js): solo datos REALES. Con los dos arrays vacíos la sección no existe.
  //   logos: [{ src: 'assets/clientes/casa-lola.svg', alt: 'Casa Lola' }]
  //   quotes: [{ text: '...', name: 'Lola Pérez', business: 'Casa Lola' }]  (máximo 3)
  proof: { logos: [], quotes: [] },
  // redes del footer: solo salen las que tienen url
  socials: [
    { name: 'Instagram', handle: '@disco.es', url: 'https://www.instagram.com/disco.es/' },
    { name: 'TikTok', handle: '[TU USUARIO TIKTOK]', url: '' },
    { name: 'YouTube', handle: '[TU CANAL DE YOUTUBE]', url: '' },
    { name: 'LinkedIn', handle: '[TU PÁGINA DE LINKEDIN]', url: '' },
  ],

  // Loading: lo que se precarga de verdad (el nivel del agua refleja su carga) y su duración mínima.
  intro: {
    // foto del hero v2 (la misma que pinta el <picture>; jpg = fallback) y la foto del flash de la intro
    images: ['assets/hero/hero-red.webp', 'assets/intro/flash-burst.webp'],
    minSeconds: 2.6,
  },

  // Hero de las páginas interiores (js/page-hero.js): el vídeo de fondo de cada una. video: el de 1920; videoSm: el
  // de < 900 px o con ahorro de datos; poster: su fotograma en `start` (s); pos: encuadre (object-position).
  // Portfolio, Nosotros y Contacto usan DE MOMENTO el vídeo de la bailarina de "Tres oficios" (PENDIENTES.md).
  pageHeroes: {
    servicios: { video: 'assets/servicios/hero/bg.mp4', videoSm: 'assets/servicios/hero/bg-1280.mp4', poster: 'assets/servicios/hero/bg-poster.webp', pos: '50% 34%', start: 0 },
    portfolio: { video: 'assets/servicios/oficios-720.mp4', videoSm: 'assets/servicios/oficios-720.mp4', poster: 'assets/paginas/portfolio-poster.webp', pos: '50% 30%', start: 0.8 },
    nosotros: { video: 'assets/servicios/oficios-720.mp4', videoSm: 'assets/servicios/oficios-720.mp4', poster: 'assets/paginas/nosotros-poster.webp', pos: '28% 40%', start: 2.2 },
    contacto: { video: 'assets/servicios/oficios-720.mp4', videoSm: 'assets/servicios/oficios-720.mp4', poster: 'assets/paginas/contacto-poster.webp', pos: '72% 45%', start: 3.6 },
  },

  // (LEGACY PRE-HERO: la configuración de la secuencia de frames de la cámara está en la historia de git.)
};

export const whatsappUrl = () =>
  `https://wa.me/${config.whatsapp.phone}?text=${encodeURIComponent(config.whatsapp.message)}`;
