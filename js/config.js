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

  // Secuencia de frames de la cámara (vídeo a 24 fps). Móvil: 1 de cada 2 frames.
  sequence: {
    fps: 24,
    mobileQuery: '(max-width: 767px)',
    desktop: { dir: 'assets/seq/desktop', count: 193, step: 1 },
    mobile: { dir: 'assets/seq/mobile', count: 97, step: 2 },
    frame: (dir, i) => `${dir}/${String(i + 1).padStart(4, '0')}.webp`,
  },
};

export const whatsappUrl = () =>
  `https://wa.me/${config.whatsapp.phone}?text=${encodeURIComponent(config.whatsapp.message)}`;
