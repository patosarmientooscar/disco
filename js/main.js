import { config, whatsappUrl } from './config.js';
import { initFlash } from './flash.js';
import { initHud } from './hud.js';
import { runLoader } from './loader.js';
import { loadFrames } from './frames.js';
import { createPixelField } from './pixel-field.js';
import { createCameraSequence } from './camera-seq.js';
import { initScrollCamera } from './scroll-camera.js';
import { initHeroMain } from './hero-main.js';
import { initHeroContent } from './hero-content.js';
import { heroPhotos } from './photos.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

// Un único loop: gsap.ticker (un rAF) mueve Lenis, ScrollTrigger y todas las tareas.
const tasks = new Set();
const loop = {
  add(fn) { tasks.add(fn); return () => tasks.delete(fn); },
};

const lenis = new Lenis({
  autoRaf: false,
  lerp: reduced.matches ? 1 : 0.1,
  smoothWheel: !reduced.matches,
});
lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.lagSmoothing(0);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
  const ratio = gsap.ticker.deltaRatio(60);
  tasks.forEach((fn) => fn(time, ratio));
});

// CTAs de WhatsApp (pre-hero, hero principal y el fijo)
document.querySelectorAll('[data-cta]').forEach((a) => { a.href = whatsappUrl(); });

// Módulos (la precarga de frames arranca ya, en paralelo al loading)
const frames = loadFrames();
const flash = initFlash({ gsap, reduced });
const hud = initHud({ loop, fps: config.sequence.fps });

// Pre-hero: píxeles "disco.es" detrás, cámara del vídeo delante
const prehero = document.getElementById('prehero');
// En móvil la palabra vive en una franja baja: celdas más finas para que se lea entera.
const mobile = matchMedia(config.sequence.mobileQuery).matches;
const field = createPixelField(document.getElementById('prehero-bg'), {
  text: 'disco.es',
  ...(mobile && { cellSize: 3, gap: 1.5 }),
});
const camera = createCameraSequence(prehero, frames, config.sequence);
let pin = null;
let oddFrame = false;
loop.add(() => {
  // con el scroll en marcha los píxeles ya se están yendo (fundido + escala): a 30 fps no se nota
  // y deja GPU libre para la secuencia (medido: ~45 → ~55 fps en retina)
  oddFrame = !oddFrame;
  if (oddFrame || !(pin?.progress > 0)) field.draw();
  camera.draw();
});

// Hero principal: fila curvada (parada hasta que se abra el círculo) y titular listo para entrar
const heroContent = initHeroContent({ gsap, ScrollTrigger, reduced, photos: heroPhotos });

// Loading → flash de transición → pre-hero
runLoader({ gsap, lenis, reduced, frames }).then(() => {
  flash.transition(() => {
    document.body.classList.remove('is-loading');
    hud.start();
    field.setRunning(true);
    // movimiento reducido: un único dibujado quieto y se para
    if (reduced.matches) requestAnimationFrame(() => field.setRunning(false));
    // el scroll se monta ya con la página visible (los valores iniciales de HUD/CTA son los reales)
    pin = initScrollCamera({ gsap, ScrollTrigger, reduced, camera, field, frames, hud, fps: config.sequence.fps });
    initHeroMain({ gsap, ScrollTrigger, reduced, pin, onOpen: heroContent.show, onClose: heroContent.hide });
    heroContent.watchCta();
    window.disco.pin = pin;
  });
});

// Para las fases siguientes
window.disco = { gsap, lenis, loop, hud, flash, frames, field, camera };
