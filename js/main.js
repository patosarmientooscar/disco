import { config } from './config.js';
import { initCore } from './core.js';
import { runIntroLoader } from './intro-loader.js';
import { initHero } from './hero.js';
import { initServices } from './services.js';
import { initNav } from './nav.js';

// Home. Lenis, ScrollTrigger, el loop único y los CTAs de WhatsApp están en core.js.
const { gsap, ScrollTrigger, lenis, loop, reduced } = initCore();

// Nav de cristal: oculta hasta "disco:intro-done", entra a la vez que la frase del hero
const nav = initNav({ gsap, ScrollTrigger, reduced });

// Hero v2: foto con estela líquida (OGL); la frase entra con "disco:intro-done"
// (LEGACY HERO: la fila curvada era initHeroContent, en legacy/js/hero-content.js)
const hero = initHero({ gsap, ScrollTrigger, reduced, loop });

// Loading (logo + progreso real) → luz roja → flash → lentes → blanco → hero
runIntroLoader({ gsap, lenis, reduced, loop, intro: config.intro }).then(() => {
  document.body.classList.remove('is-loading');
  // por si no hubo loading (sin "disco:intro-done"); si ya entraron, no hacen nada
  hero.show();
  nav.appear();
  hero.watchCta();
  window.disco.services = initServices({ gsap, ScrollTrigger, reduced, loop });
  nav.watchInk(); // después del pin de servicios
  ScrollTrigger.refresh();
});

window.disco = { gsap, lenis, loop };
