// Prompt 3: la estrella hace de piloto de cámara → flash realista → zoom por las lentes → blanco.
// Todo dentro del loading (el scroll sigue bloqueado). Resuelve con la pantalla en blanco puro.
const STAR_CENTER = { x: 1235, y: 643 }; // centro de #logo-star en el viewBox del SVG
const PILOT_RATIO = 0.38;                 // diámetro del piloto / ancho de la estrella
const ZOOM_SECONDS = 1.2;                 // duración visible del zoom (máx. 1.6)
const END_FADE = 0.2;                     // últimos 0.2s del clip: fundido a #fff puro
const HIDDEN_LEAD = 0.11;                 // el vídeo arranca bajo el blanco sólido: 110ms que no se ven

const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

export function playIntroShot({ gsap, reduced, root }) {
  const svg = root.querySelector('[data-intro-logo]');
  const star = svg.querySelector('#logo-star');
  const pilot = root.querySelector('[data-intro-pilot]');
  const video = root.querySelector('[data-intro-video]');
  const ghost = root.querySelector('[data-intro-ghost]');
  const preflash = root.querySelector('[data-intro-preflash]');
  const burst = root.querySelector('[data-intro-burst]');
  const white = root.querySelector('[data-intro-white]');

  // sin flash ni vídeo: solo fundido a blanco
  if (reduced.matches) {
    return gsap.to(white, { opacity: 1, duration: 0.4, ease: 'power1.inOut' }).then(() => {});
  }

  // centro de la estrella en píxeles de pantalla (relativos al loading)
  const m = svg.getScreenCTM();
  const host = root.getBoundingClientRect();
  const c = new DOMPoint(STAR_CENTER.x, STAR_CENTER.y).matrixTransform(m);
  const starWidth = star.getBBox().width * m.a;
  const d = starWidth * PILOT_RATIO;
  gsap.set(pilot, { left: c.x - host.left, top: c.y - host.top, width: d, height: d });
  gsap.set(burst, { left: c.x - host.left, top: c.y - host.top });

  // imagen fantasma: copia del logo ya relleno (sin trazos, sin ids ni recortes)
  const copy = svg.cloneNode(true);
  copy.querySelectorAll('[id^="letter-"], #logo-star, defs').forEach((n) => n.remove());
  copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  copy.querySelectorAll('[clip-path]').forEach((n) => n.removeAttribute('clip-path'));
  copy.removeAttribute('role');
  copy.removeAttribute('aria-label');
  copy.setAttribute('aria-hidden', 'true');
  ghost.append(copy);

  return new Promise((resolve) => {
    const tl = gsap.timeline();

    // 1) piloto: aparece, 2 parpadeos rápidos, fijo 0.25s y crece un pelín antes del disparo
    tl.set(pilot, { opacity: 1 })
      .fromTo(pilot, { scale: 0 }, { scale: 1, duration: 0.18, ease: 'back.out(2)' })
      .to(pilot, { keyframes: { opacity: [1, 0.25, 1], easeEach: 'none' }, duration: 0.12 })
      .to(pilot, { keyframes: { opacity: [1, 0.25, 1], easeEach: 'none' }, duration: 0.12 })
      .to(pilot, { scale: 1.15, duration: 0.1, ease: 'power2.out' }, '+=0.25');

    // 2) pre-destello (70ms) y 60ms de pausa
    tl.to(preflash, { keyframes: { opacity: [0, 0.35, 0], easeEach: 'none' }, duration: 0.07 })
      .addLabel('shot', '+=0.06');

    // 3) disparo principal: radial desde la estrella + sobreexposición del logo → blanco sólido 110ms
    tl.fromTo(burst, { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 4, duration: 0.045, ease: 'expo.out' }, 'shot')
      .to(svg, { filter: 'brightness(4) blur(1.5px)', duration: 0.04, ease: 'none' }, 'shot')
      .set(white, { opacity: 1 }, 'shot+=0.045')
      .set([svg, pilot, burst, root.querySelector('[data-intro-bar]')], { opacity: 0 }, 'shot+=0.05')
      .add(() => startZoom(), 'shot+=0.045')
      .addLabel('release', 'shot+=0.155');

    // 4) afterimage: el logo en negativo, apenas visible, se desvanece con blur creciente
    tl.fromTo(ghost, { opacity: 0.18, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(8px)', duration: 0.5, ease: 'power1.out' }, 'release');

    // 5) del blanco directamente al vídeo (sin pasar por negro)
    tl.set(video, { opacity: 1 }, 'release')
      .to(white, { opacity: 0, duration: 0.15, ease: 'power1.out' }, 'release');

    // zoom por las lentes: dura ZOOM_SECONDS visibles y acaba en blanco puro
    let started = false;
    function startZoom() {
      if (started) return;
      started = true;
      const remaining = Math.max(0.1, (video.duration || ZOOM_SECONDS) - video.currentTime);
      // velocidad para que lo VISIBLE dure ZOOM_SECONDS (contando el tramo que tapa el blanco)
      video.playbackRate = Math.min(4, Math.max(1, remaining / (ZOOM_SECONDS + HIDDEN_LEAD)));
      const span = remaining / video.playbackRate; // segundos reales hasta el final del clip

      const finish = () => {
        gsap.to(white, { opacity: 1, duration: END_FADE, ease: 'power1.in', overwrite: true, onComplete: resolve });
      };
      video.play()
        .then(() => wait(Math.max(0, span - END_FADE)).then(finish))
        .catch(() => finish()); // si el navegador no deja reproducir: blanco igualmente
    }
  });
}
