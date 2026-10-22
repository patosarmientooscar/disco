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
  email: 'hola@disco.es',
  // footer (js/footer.js): lo que esté vacío sale como [HUECO] para rellenar
  phone: '',            // [TU TELÉFONO] visible, p. ej. '+34 600 000 000'
  responseTime: '',     // [TIEMPO DE RESPUESTA], p. ej. 'menos de 24 h'
  // redes del footer: solo salen las que tienen url
  socials: [
    { name: 'Instagram', handle: '@disco.es', url: 'https://www.instagram.com/disco.es/' },
    { name: 'TikTok', handle: '[TU USUARIO TIKTOK]', url: '' },
    { name: 'YouTube', handle: '[TU CANAL DE YOUTUBE]', url: '' },
    { name: 'LinkedIn', handle: '[TU PÁGINA DE LINKEDIN]', url: '' },
  ],

  // Loading: lo que se precarga de verdad (el % refleja su carga) y su duración mínima.
  intro: {
    images: ['assets/hero/hero-red.webp'], // foto del hero v2, la misma que pinta el <picture> (jpg = fallback)
    minSeconds: 2.8,
  },

  // (LEGACY PRE-HERO: la configuración de la secuencia de frames de la cámara está en la historia de git.)
};

export const whatsappUrl = () =>
  `https://wa.me/${config.whatsapp.phone}?text=${encodeURIComponent(config.whatsapp.message)}`;
