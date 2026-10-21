/* LEGACY PRE-HERO — cámara de cine + "disco.es" en píxeles + scroll por las lentes (y su HUD,
   flash blanco y apertura en círculo). No se carga. Sustituido por la intro del prompt 3 (2026-10-21). */

import { config } from './config.js';

// Precarga de la secuencia de la cámara. Guarda los Image para pintarlos luego en el canvas
// sin volver a pedirlos. Se cuenta al descargar (onload), no al decodificar: decodificar los
// 193 frames de golpe ocuparía ~700 MB de memoria.
export function loadFrames() {
  const { mobileQuery, desktop, mobile, frame } = config.sequence;
  const set = matchMedia(mobileQuery).matches ? mobile : desktop;
  const images = new Array(set.count);
  const waiting = [];
  let loaded = 0;

  const progress = () => loaded / set.count;
  const check = () => {
    for (const w of [...waiting]) if (progress() >= w.ratio) { waiting.splice(waiting.indexOf(w), 1); w.resolve(); }
  };

  // en orden: el frame 1 (el que se ve primero) sale antes que el resto
  for (let i = 0; i < set.count; i++) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = img.onerror = () => { loaded++; check(); };
    img.src = frame(set.dir, i);
    images[i] = img;
  }

  return {
    images,
    count: set.count,
    step: set.step, // frames del vídeo por cada frame de la secuencia
    get progress() { return progress(); },
    reached: (ratio) => new Promise((resolve) => { waiting.push({ ratio, resolve }); check(); }),
  };
}
