const FPS = 25;
const pad = (n) => String(n).padStart(2, '0');

export function initHud({ loop, sound }) {
  const tcEl = document.querySelector('[data-timecode]');
  const toggle = document.querySelector('[data-sound-toggle]');
  const toggleState = toggle.querySelector('[data-sound-state]');

  // Timecode: por defecto tiempo real desde la entrada. En la fase 3 setSource()
  // lo sincroniza con el scroll (la fuente devuelve segundos).
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

  toggle.addEventListener('click', () => {
    const on = !sound.enabled;
    sound.setEnabled(on);
    toggle.setAttribute('aria-pressed', String(on));
    toggleState.textContent = on ? 'ON' : 'OFF';
  });

  return {
    start() {
      startedAt = performance.now();
      loop.add(render);
    },
    setSource(fn) { source = fn; },
  };
}
