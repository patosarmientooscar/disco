import { config } from './config.js';
import { createPhrase } from './loader-text.js';

const SEEN_KEY = 'disco:loader-visto';
const MIN_PRELOAD = 0.3;  // la salida espera al 30% de la precarga…
const MAX_PHRASE_S = 4;   // …pero la frase nunca dura más de 4s
const SHORT_S = 1;        // versión corta si ya se vio en la sesión

const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const seen = () => { try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };
const markSeen = () => { try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* sin storage: siempre versión larga */ } };

// Frames de la secuencia de la cámara (vacío hasta la fase 1)
function frameUrls() {
  const { count, path } = config.sequence;
  return Array.from({ length: count }, (_, i) => path(i));
}

function preload(urls) {
  let loaded = 0;
  const waiting = [];
  const progress = () => (urls.length ? loaded / urls.length : 1);
  const check = () => waiting.filter((w) => progress() >= w.ratio).forEach((w) => { waiting.splice(waiting.indexOf(w), 1); w.resolve(); });

  urls.forEach((src) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    img.decode().catch(() => {}).finally(() => { loaded++; check(); });
  });

  return {
    get progress() { return progress(); },
    reached: (ratio) => new Promise((resolve) => { waiting.push({ ratio, resolve }); check(); }),
  };
}

const fontsReady = () => Promise.race([
  document.fonts ? document.fonts.load('600 1em "Clash Display"') : Promise.resolve(),
  wait(1),
]);

// Acto 1. Resuelve cuando el loader ha desaparecido.
export async function runLoader({ gsap, lenis, reduced }) {
  const el = document.getElementById('loader');
  if (!el) return;

  const logo = el.querySelector('[data-loader-logo]');
  const flash = el.querySelector('[data-loader-flash]');
  const phrase = createPhrase(gsap, el.querySelector('[data-loader-phrase]'));
  const frames = preload(frameUrls());
  const short = seen();
  markSeen();

  lenis.stop();
  document.documentElement.classList.add('is-locked');

  await fontsReady();
  phrase.hide();

  // la salida espera a la animación y al 30% de precarga, con tope
  const gate = (animation, capS) => Promise.race([
    Promise.all([animation.then(), frames.reached(MIN_PRELOAD)]),
    wait(capS),
  ]);

  if (reduced.matches) {
    // frase completa en blanco, fundido simple
    phrase.showStatic();
    await gsap.fromTo(el.querySelector('[data-loader-phrase]'), { opacity: 0 }, { opacity: 1, duration: 0.4 });
    await gate(wait(1), 1.6);
    await phrase.fadeOut(0.4);
  } else if (short) {
    const start = performance.now();
    await gate(phrase.enterQuick(), SHORT_S * 0.55);
    await phrase.fadeOut(Math.max(0.15, SHORT_S - (performance.now() - start) / 1000));
  } else {
    // "disco.es" aparece, se mantiene 0.6s y se desvanece (opacity + blur + scale);
    // la frase arranca mientras el logo aún se está yendo
    await new Promise((phraseStart) => {
      gsap.timeline()
        .fromTo(logo, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' })
        .to(logo, { opacity: 0, filter: 'blur(8px)', scale: 0.96, duration: 0.35, ease: 'power2.in' }, '+=0.6')
        .call(phraseStart, null, '-=0.2');
    });
    await gate(phrase.enter(), MAX_PHRASE_S);
    await phrase.finale(flash);
  }

  el.remove();
  document.documentElement.classList.remove('is-locked');
  lenis.start();
}
