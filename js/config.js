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
    // Cámara en el frame 1 (fracción del frame): bbox x 345–890, y 43–683 de 1280×720.
    // En móvil se escala para que ocupe ~85% del ancho, recortando solo el negro de los lados.
    cameraBox: { width: 546 / 1280, cx: 617.5 / 1280, cy: 363 / 720 },
    mobileFill: 0.85,
    frame: (dir, i) => `${dir}/${String(i + 1).padStart(4, '0')}.webp`,
  },
};

export const whatsappUrl = () =>
  `https://wa.me/${config.whatsapp.phone}?text=${encodeURIComponent(config.whatsapp.message)}`;
