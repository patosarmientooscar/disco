import { config } from './config.js';
import { initCore } from './core.js';
import { runIntroLoader } from './intro-loader.js';
import { initHero } from './hero.js';
import { initNav } from './nav.js';
import { initScrollFx } from './scroll-fx.js';
import { initTeam } from './team.js';
import { initWhy } from './why.js';
import { initFin } from './fin.js';
import { initHomeClose } from './home-close.js';

// Home. Lenis, ScrollTrigger, el loop único y los CTAs de WhatsApp están en core.js.
// Al cargar o refrescar, arriba del todo (antes de Lenis y de los ScrollTriggers): si el navegador
// restaurase el scroll, el destello entraría en el punto de otra sección. Con #ancla se respeta.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const anchored = location.hash.length > 1;
if (!anchored) window.scrollTo(0, 0);

const { gsap, ScrollTrigger, lenis, loop, reduced, transitions } = initCore();

// Nav de cristal: oculta hasta "disco:intro-done", entra a la vez que la frase del hero
const nav = initNav({ gsap, ScrollTrigger, reduced });

// Hero v2: foto con estela líquida (OGL); la frase entra con "disco:intro-done"
// (LEGACY HERO: la fila curvada era initHeroContent, en legacy/js/hero-content.js)
const hero = initHero({ gsap, ScrollTrigger, lenis, reduced, loop });

// Destello 3D (Three.js). import() dinámico: si el CDN de three falla, la web sigue igual sin él.
// Su GLB cuenta en el progreso del loading.
const star = import('./star.js')
  .then((m) => m.initStar({ gsap, ScrollTrigger, lenis, reduced, loop }))
  .catch(() => null);
const starLoaded = star.then((s) => s && s.loaded);

// Loading (logo + progreso real) → luz roja → flash → el blanco se disuelve en el hero. Solo la primera vez por
// sesión (html.intro-skip, desde el <head>): después, el hero entra directamente (o al abrirse el velo de la transición).
const skipIntro = () => {
  document.getElementById('intro-loader')?.remove();
  return transitions.arrived.then(() => window.dispatchEvent(new CustomEvent('disco:intro-done')));
};
const skipped = document.documentElement.classList.contains('intro-skip');
const intro = skipped
  ? skipIntro()
  : runIntroLoader({ gsap, lenis, reduced, loop, intro: config.intro, assets: [starLoaded] });

intro.then(() => {
  document.body.classList.remove('is-loading');
  // por si no hubo loading (sin "disco:intro-done"); si ya entraron, no hacen nada
  hero.show();
  nav.appear();
  // scroll que sube: telón (hero fijo mientras los cofundadores suben por encima), parallax y entradas
  const fx = initScrollFx({ gsap, ScrollTrigger, reduced });
  fx.curtain(document.getElementById('hero-main'), document.getElementById('equipo'));
  initTeam({ gsap, ScrollTrigger, reduced });
  hero.watchParallax();
  // Servicios ya no está en la home (vive en servicios.html, con js/services.js)
  initWhy({ gsap, ScrollTrigger, reduced, loop }); // "¿Por qué nosotros?": enfoque + bokeh + diafragma
  // ningún texto por debajo del menú flotante
  fx.navFade('.team__phrase, .team__sub, .team__name-in, .team__more, [data-nav-fade]');
  fx.exitFade(document.getElementById('porque'), document.querySelector('#porque .why__pin'));
  initHomeClose(); // cómo trabajamos + banda final (+ prueba social si hay datos)
  // footer "fin de la sesión": el destello se muere y cae sobre el logo (su hueco es el último punto de paso)
  initFin({ gsap, lenis, reduced, loop, star });
  nav.watchInk();
  ScrollTrigger.refresh();
  // Destello: entra en el hero cuando se va el flash (primera visita; el blanco total dura 120 ms) o cuando
  // se abre el velo de la transición, con el layout ya definitivo (fuentes + primer refresh). Mientras entra
  // está congelado en el hero. Después: el estudio 360° (mismo renderer; su pin es un punto de paso del
  // recorrido, por eso va antes de watchScroll) y el recorrido por el scroll. Sin three (CDN caído) o sin
  // modelo: el estudio queda como imagen fija.
  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  const flashOut = skipped ? 0 : 120;
  star.then(async (s) => {
    if (s) {
      await Promise.all([s.loaded, fonts, new Promise((r) => setTimeout(r, flashOut))]);
      await s.enter({ instant: anchored });
    }
    try {
      const { initStudio } = await import('./studio.js');
      initStudio({ gsap, ScrollTrigger, reduced, loop, star: s && s.ok !== false ? s : null });
    } catch {
      const studio = document.getElementById('estudio');
      studio?.classList.add('is-still', 'is-lit');
      studio?.style.setProperty('--studio-still', `url("${new URL('assets/studio/studio-360-mobile.jpg', location.href)}")`);
      if (studio) import('./studio-ui.js').then((m) => m.createStudioUI({ gsap, section: studio, still: true })).catch(() => {});
    }
    ScrollTrigger.refresh();
    if (s) s.watchScroll();
  });
});

window.disco = { gsap, lenis, loop };
