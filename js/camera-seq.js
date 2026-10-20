// Cámara del vídeo pintada frame a frame en un canvas a pantalla completa.
// Los frames llevan alpha (fondo quitado): la cámara tapa de verdad los píxeles de detrás.
const MAX_DPR = 2;

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

  const paint = (img) => {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    let s, x, y;
    if (mobile.matches) {
      // la cámara (no el frame) ocupa ~85% del ancho y queda centrada; se recorta el negro de los lados
      s = (width * mobileFill) / (iw * cameraBox.width);
      x = width / 2 - iw * cameraBox.cx * s;
      y = height / 2 - ih * cameraBox.cy * s;
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
      paint(frames.images[j]);
      drawn = j;
      dirty = false;
    },
  };
}
