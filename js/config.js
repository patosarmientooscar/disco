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
  responseTime: '',     // [TIEMPO DE RESPUESTA], p. ej. 'menos de 24 h'  (contacto: "te respondemos en …"; vacío = "muy pronto")
  // EmailJS (opcional; js/contact.js lo usa solo con contactForm.provider = 'emailjs' y estas claves puestas; si no,
  // FormSubmit, abajo). Pasos para rellenarlas: docs/emailjs/LEEME.md
  emailjs: { publicKey: '', serviceId: '', templateId: '', autoReplyTemplateId: '' },
  // a quién llega el AVISO de cada formulario (js/contact.js). provider: 'formsubmit' (por defecto, sin cuenta ni
  // claves: https://formsubmit.co) o 'emailjs' (solo si arriba están sus claves; si no, FormSubmit). alias: el código
  // que da FormSubmit tras activar el email, para no dejar la dirección en el código (vacío = se usa `to`). Pasos:
  // docs/contacto.md
  contactForm: { provider: 'formsubmit', to: 'equipo@discoproduccion.com', alias: '' },
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
  // de < 900 px o con ahorro de datos; poster: su primer fotograma (o el de `start`, en s); pos: encuadre
  // (object-position); fps: los del vídeo (el timecode del hero es el real); star: false = sin el destello 3D.
  pageHeroes: {
    servicios: { video: 'assets/paginas/servicios-bg-hq.mp4', videoSm: 'assets/paginas/servicios-bg-hq-1280.mp4', poster: 'assets/paginas/servicios-poster-hq.webp', pos: '50% 50%', start: 0, fps: 30 },
    // la bola real etalonada en naranja, v3 (solo la parte oscura, grande, estabilizada y con la exposición constante;
    // bucle perfecto de 3,17 s): 2560 en horizontal (1280 solo con ahorro de datos o conexión lenta) y su versión
    // vertical; pos: el centro de la bola en cada una, medido en su póster (nunca se sale del encuadre). always: gira
    // siempre (js/page-hero.js). Sin destello (js/portfolio-hero.js). Los de antes, en legacy/portfolio-hero-bola-v2/
    // y legacy/portfolio-hero-bola-azul/
    portfolio: {
      video: 'assets/portfolio/hero/bola-v3.mp4', videoSm: 'assets/portfolio/hero/bola-v3-1280.mp4', poster: 'assets/portfolio/hero/bola-v3-poster-1920.webp',
      videoPortrait: 'assets/portfolio/hero/bola-v3-vertical.mp4', posterPortrait: 'assets/portfolio/hero/bola-v3-vertical-poster.webp',
      pos: '64% 53%', posPortrait: '47% 42%', start: 0, fps: 24, star: false, always: true,
    },
  },

  // (LEGACY PRE-HERO: la configuración de la secuencia de frames de la cámara está en la historia de git.)
};

export const whatsappUrl = () =>
  `https://wa.me/${config.whatsapp.phone}?text=${encodeURIComponent(config.whatsapp.message)}`;
