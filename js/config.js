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

  // Loading: lo que se precarga de verdad (el % refleja su carga) y su duración mínima.
  // El vídeo de las lentes está en el HTML (<video data-intro-video>, webm + mp4).
  intro: {
    images: ['assets/hero/hero-red.webp'], // foto del hero v2, la misma que pinta el <picture> (jpg = fallback)
    minSeconds: 2.8,
  },

  // (LEGACY PRE-HERO: la configuración de la secuencia de frames de la cámara está en la historia de git.)
};

export const whatsappUrl = () =>
  `https://wa.me/${config.whatsapp.phone}?text=${encodeURIComponent(config.whatsapp.message)}`;
