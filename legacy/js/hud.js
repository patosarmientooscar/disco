/* LEGACY PRE-HERO — cámara de cine + "disco.es" en píxeles + scroll por las lentes (y su HUD,
   flash blanco y apertura en círculo). No se carga. Sustituido por la intro del prompt 3 (2026-10-21). */

const pad = (n) => String(n).padStart(2, '0');

export function initHud({ loop, fps: FPS }) {
  const tcEl = document.querySelector('[data-timecode]');

  // Timecode: por defecto tiempo real desde la entrada; setSource() lo sincroniza
  // con el frame del vídeo (la fuente devuelve segundos).
  let startedAt = 0;
  let source = () => (performance.now() - startedAt) / 1000;
  let lastFrame = -1;

  function render() {
    const total = Math.max(0, Math.floor(source() * FPS));
    if (total === lastFrame) return;
    lastFrame = total;
    const ff = total % FPS;
    const s = Math.floor(total / FPS);
    tcEl.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(ff)}`;
  }

  return {
    start() {
      startedAt = performance.now();
      loop.add(render);
    },
    setSource(fn) { source = fn; },
  };
}
