// Servicios, "el visor": al hacer scroll se cambia de servicio como quien cambia de objetivo.
// Desktop: pin de 300vh (1/3 por servicio) con un encuadre único. Móvil y movimiento reducido:
// los 3 servicios apilados; en móvil el flash y el enfoque saltan al entrar cada encuadre.
const PIN = '+=300%';
const TC_FPS = 25;
const TC_START = 12 * TC_FPS + 4; // 00:00:12:04
const pad = (n) => String(n).padStart(2, '0');
const timecode = (f) => {
  const s = Math.floor(f / TC_FPS);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f % TC_FPS)}`;
};

export function initServices({ gsap, ScrollTrigger, reduced, loop }) {
  const section = document.getElementById('servicios');
  const items = [...section.querySelectorAll('[data-service]')];
  const tcEls = [...section.querySelectorAll('[data-edit-tc]')];

  // timecode de Edición: avanza solo mientras se ve
  let tcRunning = false;
  let tcFrames = TC_START;
  let tcShown = -1;
  loop.add((time, ratio) => {
    if (!tcRunning) return;
    tcFrames += (ratio * TC_FPS) / 60;
    const f = Math.floor(tcFrames);
    if (f === tcShown) return;
    tcShown = f;
    const text = timecode(f);
    tcEls.forEach((el) => { el.textContent = text; });
  });

  // mini flash solo dentro del encuadre + las esquinas se cierran un 6% y vuelven
  const shoot = (frame, onPeak) => gsap.timeline()
    .to(frame.querySelector('.viewer__flash'), { opacity: 0.8, duration: 0.09, ease: 'none' })
    .add(() => onPeak?.())
    .to(frame.querySelector('.viewer__flash'), { opacity: 0, duration: 0.09, ease: 'none' })
    .fromTo(frame.querySelector('.viewer__brackets'), { scale: 1 },
      { scale: 0.94, duration: 0.15, ease: 'power2.out', yoyo: true, repeat: 1 }, 0);

  const stacked = matchMedia('(max-width: 768px)').matches || reduced.matches;

  if (stacked) {
    items.forEach((li, i) => {
      const frame = li.querySelector('.service__viewer .viewer__frame');
      ScrollTrigger.create({
        trigger: frame,
        start: 'top 85%',
        end: 'bottom 15%',
        onEnter: () => { if (!reduced.matches) shoot(frame); },
        onEnterBack: () => { if (!reduced.matches) shoot(frame); },
        onToggle: (self) => { if (i === 2) tcRunning = self.isActive && !reduced.matches; },
      });
    });
    return null;
  }

  // --- desktop: encuadre único ---
  const frame = section.querySelector('[data-viewer-frame]');
  const imgs = [...section.querySelectorAll('[data-viewer-img]')];
  const huds = [...section.querySelectorAll('[data-viewer-hud]')];
  const details = items.map((li) => li.querySelector('.service__detail'));
  let active = 0;

  const setActive = (i) => {
    if (i === active) return;
    active = i;
    items.forEach((li, k) => li.classList.toggle('is-active', k === i));
    details.forEach((d, k) => gsap.to(d, { height: k === i ? 'auto' : 0, duration: 0.4, ease: 'power2.inOut', overwrite: true }));
    // la foto y la etiqueta cambian en el pico del flash
    shoot(frame, () => {
      imgs.forEach((img, k) => img.classList.toggle('is-active', k === i));
      huds.forEach((h, k) => { h.hidden = k !== i; });
      tcRunning = i === 2;
    });
  };

  const pin = ScrollTrigger.create({
    trigger: section.querySelector('[data-services-pin]'),
    start: 'top top',
    end: PIN,
    pin: true,
    onUpdate: (self) => setActive(Math.min(2, Math.floor(self.progress * 3))),
  });
  return pin;
}
