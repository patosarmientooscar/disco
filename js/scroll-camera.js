// Scroll por la cámara: #prehero se fija ~500vh y el scroll recorre el vídeo frame a frame.
// Primer 10%: se van HUD y CTA. Primer 40%: el fondo de píxeles se aleja (scale + opacity,
// sin blur: costaba ~5 fps en retina). Hacia atrás, al revés.
const PIN = '+=500%';
const PIN_REDUCED = '+=150%';
const UI_OUT = 0.1;
const FIELD_OUT = 0.4;

export function initScrollCamera({ gsap, ScrollTrigger, reduced, camera, field, frames, hud, fps }) {
  const prehero = document.getElementById('prehero');
  const ui = ['.hud', '.cta'];

  // el timecode sigue al frame del vídeo (en móvil cada frame de la secuencia son `step` del vídeo)
  hud.setSource(() => (camera.frame * frames.step) / fps);

  if (reduced.matches) {
    // sin scrub: cámara quieta en el frame 1 y fundidos al cruzar cada umbral
    camera.setFrame(0);
    const pin = ScrollTrigger.create({ trigger: prehero, start: 'top top', end: PIN_REDUCED, pin: true });
    // posiciones absolutas dentro del pin (un trigger relativo a #prehero creado después del pin
    // se desplazaría la longitud del pin y caería fuera)
    const fade = (targets, threshold) => ScrollTrigger.create({
      start: () => pin.start + (pin.end - pin.start) * threshold,
      end: () => pin.end,
      onEnter: () => gsap.to(targets, { autoAlpha: 0, duration: 0.4 }),
      onLeaveBack: () => gsap.to(targets, { autoAlpha: 1, duration: 0.4 }),
    });
    fade(ui, UI_OUT);
    fade(field.element, FIELD_OUT);
    return null;
  }

  const state = { frame: 0 };
  let fieldOn = true;
  return gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: prehero,
      start: 'top top',
      end: PIN,
      pin: true,
      scrub: 0.5,
      onUpdate: (self) => {
        // ya invisible: deja de dibujar los píxeles (y vuelve a empezar al subir)
        const on = self.progress < FIELD_OUT;
        if (on !== fieldOn) { fieldOn = on; field.setRunning(on); }
      },
    },
  })
    .to(state, { frame: frames.count - 1, duration: 1, onUpdate: () => camera.setFrame(state.frame) }, 0)
    .fromTo(field.element,
      { scale: 1, opacity: 1 },
      { scale: 0.7, opacity: 0, duration: FIELD_OUT }, 0)
    .fromTo(ui, { autoAlpha: 1 }, { autoAlpha: 0, duration: UI_OUT }, 0);
}
