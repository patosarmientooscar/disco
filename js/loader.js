import { createPhrase } from './loader-text.js';

const SEEN_KEY = 'disco:loader-visto';
const MIN_PRELOAD = 0.3;  // no se sale sin el 30% de los frames…
const MAX_TOTAL_S = 4;    // …salvo red muy lenta: tope de seguridad
const SHORT_S = 1;        // versión corta si ya se vio en la sesión
const REDUCED_S = 0.8;    // movimiento reducido: frase quieta, sin animación

const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const seen = () => { try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };
const markSeen = () => { try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* sin storage: siempre versión larga */ } };

const fontsReady = () => Promise.race([
  document.fonts ? Promise.all([document.fonts.load('600 1em "Clash Display"'), document.fonts.load('400 1em "Clash Display"')]) : Promise.resolve(),
  wait(1),
]);

// Loading: "disco.es" → frase → (30% de frames) → fuera. Resuelve cuando el loader ha desaparecido.
export async function runLoader({ gsap, lenis, reduced, frames }) {
  const el = document.getElementById('loader');
  if (!el) return;

  const start = performance.now();
  const elapsed = () => (performance.now() - start) / 1000;
  const logo = el.querySelector('[data-loader-logo]');
  const phrase = createPhrase(gsap, el.querySelector('[data-loader-phrase]'));
  const short = seen();
  markSeen();

  lenis.stop();
  document.documentElement.classList.add('is-locked');

  // la salida espera a la animación y al 30% de la precarga, con tope total
  const gate = (animation) => Promise.race([
    Promise.all([animation.then(), frames.reached(MIN_PRELOAD)]),
    wait(Math.max(0, MAX_TOTAL_S - elapsed())),
  ]);

  await fontsReady();

  if (reduced.matches) {
    phrase.showStatic();
    await gate(wait(REDUCED_S));
    await phrase.fadeOut(0.3);
  } else if (short) {
    phrase.hide();
    await gate(phrase.enterQuick());
    await phrase.fadeOut(Math.max(0.15, SHORT_S - elapsed()));
  } else {
    phrase.hide();
    // "disco.es" aparece, se mantiene 0.6s y se desvanece (opacity + blur + scale);
    // la frase arranca mientras el logo aún se está yendo
    await new Promise((phraseStart) => {
      gsap.timeline()
        .fromTo(logo, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' })
        .to(logo, { opacity: 0, filter: 'blur(8px)', scale: 0.96, duration: 0.35, ease: 'power2.in' }, '+=0.6')
        .call(phraseStart, null, '-=0.25');
    });
    await gate(phrase.enter());
    await wait(0.15);
    await phrase.fadeOut(0.25);
  }

  el.remove();
  document.documentElement.classList.remove('is-locked');
  lenis.start();
}
