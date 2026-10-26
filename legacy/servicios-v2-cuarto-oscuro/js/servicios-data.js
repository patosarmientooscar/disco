// Datos de servicios.html ("cuarto oscuro"). Se cambian aquí, sin tocar el resto del código.
// BORRADOR: textos de proceso y sectores pendientes de revisar (PENDIENTES.md).

// 01 · Foto: las copias que se revelan en la cubeta, en orden. PROVISIONALES (fotos de la web):
// sustituir por 4–6 fotos reales, de 1600 px de ancho como mínimo. w y h: tamaño real del archivo.
export const photos = [
  { src: 'assets/servicios/foto.webp', w: 1366, h: 1708, categoria: 'Espacios', año: 2026, alt: 'Terraza con sombrillas blancas y palmera frente al mar' },
  { src: 'assets/hero/01.webp', w: 1600, h: 1200, categoria: 'Ambiente', año: 2026, alt: 'Bola de discoteca encendida en la oscuridad' },
  { src: 'assets/hero/04.webp', w: 1600, h: 1200, categoria: 'Retrato', año: 2026, alt: 'Mujer sonriendo con una copa en la mano, en blanco y negro' },
  { src: 'assets/hero/05.webp', w: 1600, h: 1067, categoria: 'Personas', año: 2026, alt: 'Chico con una pala de pádel contra un cielo azul' },
];

// 02 · Vídeo: la "hoja de montaje". video (opcional): { src, poster } de un clip mudo y corto. Cuando
// exista, la fila lo enseñará pequeño siguiendo al cursor (aún sin implementar: no hay vídeos).
export const formats = [
  { name: 'Reels y TikTok', spec: '9:16 · 15–60 s', tc: 45, video: null },
  { name: 'Vídeo de marca', spec: '16:9 · 1–3 min', tc: 120, video: null },
  { name: 'Aftermovie de eventos', spec: '16:9 + 9:16', tc: 90, video: null },
  { name: 'Entrevistas y testimonios', spec: '16:9 · multicámara', tc: 150, video: null },
  { name: 'Edición, color y sonido', spec: 'montaje al beat · etalonaje · subtítulos', tc: 60, video: null },
];

// 03 · Proceso (BORRADOR): las copias colgadas del cordel. tramo: en qué parte de la barra de progreso cae
export const steps = [
  { n: '01', title: 'Conocemos tu marca', text: 'Escuchamos tu negocio, tu público y tus objetivos. Analizamos qué te hace diferente.', tag: 'FASE 1 · BRIEFING', tramo: 0 },
  { n: '02', title: 'Idea y concepto creativo', text: 'Proponemos la idea, el tono y las referencias visuales que mejor cuentan tu historia.', tag: 'FASE 1 · CREATIVIDAD', tramo: 0 },
  { n: '03', title: 'Planificación de la obra audiovisual', text: 'Guion, storyboard, plan de rodaje, localizaciones, permisos y calendario. Nada se deja al azar.', tag: 'FASE 2 · PREPRODUCCIÓN', tramo: 0 },
  { n: '04', title: 'Producción', text: 'Equipo técnico, iluminación, dirección de arte y talento. Todo listo antes de encender la cámara.', tag: 'FASE 2 · PRODUCCIÓN', tramo: 1 },
  { n: '05', title: 'Rodaje y sesión', text: 'Grabamos y fotografiamos con energía, captando el ritmo real de tu negocio.', tag: 'FASE 3 · RODAJE', tramo: 2 },
  { n: '06', title: 'Postproducción', text: 'Edición, color, sonido, retoque y subtítulos para que cada pieza brille.', tag: 'FASE 4 · POST', tramo: 3 },
  { n: '07', title: 'Entrega a medida', text: 'Formatos para cada red, web, pantalla o impresión. Versiones verticales y horizontales, listas para publicar.', tag: 'FASE 4 · ENTREGA', tramo: 3 },
  { n: '08', title: 'Sostenibilidad audiovisual', text: 'Rodajes de bajo impacto: equipos eficientes, desplazamientos optimizados, cero plásticos de un solo uso y archivo digital responsable.', tag: 'SIEMPRE · COMPROMISO', tramo: 3 },
];
export const tramos = ['PRE', 'PRODUCCIÓN', 'RODAJE', 'POST'];

// 04 · Para quién (BORRADOR). photo: foto pequeña que sigue al cursor (null = sin foto, de momento)
export const sectors = [
  { name: 'Restaurantes y gastronomía', text: 'Platos, espacios y equipo. Contenido que abre el apetito.', photo: { src: 'assets/hero/03.webp', w: 1600, h: 1067 } },
  { name: 'Eventos, fiestas y noche', text: 'Aftermovies, foto de ambiente y reels en el mismo día.', photo: { src: 'assets/hero/01.webp', w: 1600, h: 1200 } },
  { name: 'Marcas, moda y producto', text: 'Campañas, lookbooks y producto con dirección de arte.', photo: null },
  { name: 'Empresas y artistas', text: 'Vídeo corporativo, entrevistas, retratos y contenido para redes.', photo: { src: 'assets/hero/04.webp', w: 1600, h: 1200 } },
  { name: 'Eventos deportivos', text: 'Cobertura en directo, highlights y foto de acción.', photo: { src: 'assets/hero/05.webp', w: 1600, h: 1067 } },
];
