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

  // Secuencia de frames de la cámara (se rellena en la fase 1). Con count 0 no hay nada que precargar.
  sequence: {
    count: 0,
    path: (i) => `assets/sequence/frame-${String(i + 1).padStart(3, '0')}.webp`,
  },

  sound: {
    // Ruta a un mp3 de obturador. Con null se sintetiza el clic con Web Audio.
    shutterSrc: null, // 'assets/sound/shutter.mp3'
  },
};

export const whatsappUrl = () =>
  `https://wa.me/${config.whatsapp.phone}?text=${encodeURIComponent(config.whatsapp.message)}`;
