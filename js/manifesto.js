// El manifiesto de disco (servicios.html): el vídeo completo, con sus frases y CON sonido, a pantalla completa. Se
// abre desde el botón del hero; el fondo del hero es la versión sin rótulos. Controles propios: play/pausa, barra
// naranja con el timecode, silencio y cerrar. Es un <dialog> modal: el foco se queda dentro, Esc cierra y, al cerrar,
// el foco vuelve al botón. Al abrir, un flash corto como el de la intro; mientras está abierto, el vídeo del hero
// para (evento "disco:hero-hold", js/page-hero.js) y la página no hace scroll.
const SRC = 'assets/paginas/disco-manifiesto.mp4';
const FPS = 30;
const FLASH = 0.56;

export function initManifesto({ gsap, lenis, reduced }) {
  const dialog = document.querySelector('[data-manifesto]');
  const opener = document.querySelector('[data-manifesto-open]');
  if (!dialog || !opener) return;
  const $ = (s) => dialog.querySelector(s);
  const video = $('[data-mf-video]');
  const toggle = $('[data-mf-toggle]');
  const seek = $('[data-mf-seek]');
  const tc = $('[data-mf-tc]');
  const mute = $('[data-mf-mute]');
  const flash = $('.mf__flash');
  const hold = (on) => document.dispatchEvent(new CustomEvent('disco:hero-hold', { detail: on }));
  const two = (n) => String(n).padStart(2, '0');

  const paint = () => {
    const d = video.duration || 0;
    const t = video.currentTime;
    seek.value = d ? Math.round((t / d) * 1000) : 0;
    seek.style.setProperty('--p', `${d ? (t / d) * 100 : 0}%`);
    seek.setAttribute('aria-valuetext', `${Math.floor(t / 60)}:${two(Math.floor(t % 60))} de ${Math.floor(d / 60)}:${two(Math.floor(d % 60))}`);
    const f = Math.floor(t * FPS);
    const s = Math.floor(f / FPS);
    tc.textContent = `TC 00:${two(Math.floor(s / 60))}:${two(s % 60)}:${two(f % FPS)}`;
  };
  const state = () => {
    const playing = !video.paused;
    dialog.classList.toggle('is-playing', playing);
    toggle.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
  };

  opener.addEventListener('click', () => {
    if (!video.src) video.src = SRC; // no se descarga nada hasta que se pide
    hold(true);
    lenis.stop();
    dialog.showModal();
    video.muted = false;
    mute.setAttribute('aria-pressed', 'false');
    mute.setAttribute('aria-label', 'Silenciar');
    dialog.classList.remove('is-muted');
    video.play().catch(() => {}); // empieza al pulsar, con sonido
    if (!reduced.matches) gsap.fromTo(flash, { opacity: 0 }, { keyframes: { opacity: [0, 0.85, 0] }, duration: FLASH, ease: 'none' });
    toggle.focus();
  });
  toggle.addEventListener('click', () => { if (video.paused) video.play().catch(() => {}); else video.pause(); });
  video.addEventListener('click', () => toggle.click());
  ['play', 'pause', 'ended'].forEach((ev) => video.addEventListener(ev, state));
  video.addEventListener('timeupdate', paint);
  video.addEventListener('loadedmetadata', paint);
  seek.addEventListener('input', () => {
    if (video.duration) video.currentTime = (seek.value / 1000) * video.duration;
    paint();
  });
  mute.addEventListener('click', () => {
    video.muted = !video.muted;
    mute.setAttribute('aria-pressed', String(video.muted));
    mute.setAttribute('aria-label', video.muted ? 'Activar el sonido' : 'Silenciar');
    dialog.classList.toggle('is-muted', video.muted);
  });
  $('[data-mf-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // clic fuera del vídeo
  dialog.addEventListener('close', () => {
    video.pause();
    hold(false);
    lenis.start();
    opener.focus();
  });
}
