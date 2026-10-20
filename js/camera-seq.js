// Cámara del vídeo pintada frame a frame en un canvas a pantalla completa.
// Los frames llevan alpha (fondo quitado): la cámara tapa de verdad los píxeles de detrás.
const MAX_DPR = 2;
const MOBILE_COVER_FROM = 0.2; // móvil: tramo del vídeo en el que se pasa de "cámara al 85%"…
const MOBILE_COVER_TO = 0.5;   // …a "frame cubriendo la pantalla" (antes de que el frame deje de tener fondo)

const smooth = (v, a, b) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createCameraSequence(host, frames, { mobileQuery, cameraBox, mobileFill }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'prehero__camera';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);

  const ctx = canvas.getContext('2d');
  const mobile = matchMedia(mobileQuery);
  let width = 1, height = 1, dpr = 1;
  let wanted = 0;   // frame que pide el scroll
  let drawn = -1;   // frame pintado (puede ser un sustituto si el pedido aún no ha llegado)
  let dirty = true;

  const ready = (img) => img.complete && img.naturalWidth > 0;

  // El frame pedido o, si aún no se ha descargado, el más cercano que sí: nunca un hueco negro.
  const nearestLoaded = (i) => {
    for (let d = 0; d < frames.count; d++) {
      if (i - d >= 0 && ready(frames.images[i - d])) return i - d;
      if (i + d < frames.count && ready(frames.images[i + d])) return i + d;
    }
    return -1;
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    dirty = true;
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const paint = (img, index) => {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    let s, x, y;
    if (mobile.matches) {
      // al principio la cámara (no el frame) ocupa ~85% del ancho, centrada; al entrar en la
      // lente el frame pasa a cubrir la pantalla entera (si no, quedaría una franja con bordes duros)
      const s0 = (width * mobileFill) / (iw * cameraBox.width);
      const x0 = width / 2 - iw * cameraBox.cx * s0;
      const y0 = height / 2 - ih * cameraBox.cy * s0;
      const s1 = Math.max(width / iw, height / ih);
      const x1 = (width - iw * s1) / 2;
      const y1 = (height - ih * s1) / 2;
      const t = smooth(index / (frames.count - 1), MOBILE_COVER_FROM, MOBILE_COVER_TO);
      s = s0 + (s1 - s0) * t;
      x = x0 + (x1 - x0) * t;
      y = y0 + (y1 - y0) * t;
    } else {
      // cover anclado arriba: el panel LED llega al borde superior hacia el segundo 1.5
      s = Math.max(width / iw, height / ih);
      x = (width - iw * s) / 2;
      y = 0;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x, y, iw * s, ih * s);
  };

  return {
    element: canvas,
    get frame() { return wanted; },
    setFrame(i) { wanted = Math.max(0, Math.min(frames.count - 1, Math.round(i))); },
    // Llamar una vez por frame desde el loop principal: solo repinta si cambia algo.
    draw() {
      const j = nearestLoaded(wanted);
      if (j < 0 || (j === drawn && !dirty)) return;
      paint(frames.images[j], j);
      drawn = j;
      dirty = false;
    },
  };
}
