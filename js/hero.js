const LERP = 0.08;     // parallax de la cámara
const MAX_ROT = 8;     // grados
const MAX_SHIFT = 18;  // px para la capa con depth 1

export function initHero({ gsap, loop, reduced, flash }) {
  const hero = document.getElementById('hero');
  const stage = hero.querySelector('[data-camera-stage]');
  const layers = [...stage.querySelectorAll('[data-depth]')].map((el) => ({ el, depth: Number(el.dataset.depth) }));
  const reticle = document.querySelector('[data-reticle]');
  const reticleInner = reticle.querySelector('[data-reticle-inner]');

  const desktop = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)');

  const target = { x: 0, y: 0 };  // -1..1
  const current = { x: 0, y: 0 };
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, dirty: false };
  let inView = true;
  let overHero = false;

  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; }).observe(hero);

  const parallaxOn = () => desktop.matches && !reduced.matches;

  function syncReticleMode() {
    hero.classList.toggle('has-reticle', desktop.matches);
    if (!desktop.matches) reticle.classList.remove('is-visible');
  }
  syncReticleMode();
  desktop.addEventListener('change', syncReticleMode);

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.dirty = true;

    overHero = hero.contains(e.target);
    const onControl = !!e.target.closest('a, button');
    reticle.classList.toggle('is-visible', desktop.matches && overHero && !onControl);

    if (overHero) {
      target.x = (e.clientX / innerWidth) * 2 - 1;
      target.y = (e.clientY / innerHeight) * 2 - 1;
    }
  }, { passive: true });

  document.documentElement.addEventListener('pointerleave', () => {
    target.x = target.y = 0;
    reticle.classList.remove('is-visible');
  });

  // Flash con carga: mantener pulsado (ratón o dedo) carga, soltar dispara
  hero.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('a, button')) return;
    flash.press();
  });
  window.addEventListener('pointerup', () => flash.release());
  window.addEventListener('pointercancel', () => flash.cancel());
  window.addEventListener('blur', () => flash.cancel());
  hero.addEventListener('contextmenu', (e) => { if (flash.charging) e.preventDefault(); });

  // Enfoque de la retícula en cada disparo
  flash.onFire(() => {
    if (reduced.matches) return;
    reticle.classList.add('is-locked');
    gsap.fromTo(reticleInner, { scale: 1.3 }, {
      scale: 1, duration: 0.45, ease: 'expo.out', overwrite: true,
      onComplete: () => reticle.classList.remove('is-locked'),
    });
  });

  loop.add((time, ratio) => {
    if (pointer.dirty && desktop.matches) {
      reticle.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
      pointer.dirty = false;
    }

    if (!inView) return;
    const tx = parallaxOn() ? target.x : 0;
    const ty = parallaxOn() ? target.y : 0;
    const k = 1 - Math.pow(1 - LERP, ratio);
    const dx = tx - current.x;
    const dy = ty - current.y;
    if (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) return;
    current.x += dx * k;
    current.y += dy * k;
    apply();
  });

  function apply() {
    stage.style.transform = `rotateX(${(-current.y * MAX_ROT).toFixed(3)}deg) rotateY(${(current.x * MAX_ROT).toFixed(3)}deg)`;
    for (const { el, depth } of layers) {
      const s = MAX_SHIFT * depth;
      el.style.transform = `translate3d(${(current.x * s).toFixed(2)}px, ${(current.y * s).toFixed(2)}px, ${depth * 40}px)`;
    }
  }
  apply();
}
