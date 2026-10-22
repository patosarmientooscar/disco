import { config } from './config.js';
import { initCore } from './core.js';
import { runIntroLoader } from './intro-loader.js';
import { initHero } from './hero.js';
import { initNav } from './nav.js';
import { initScrollFx } from './scroll-fx.js';
import { initTeam } from './team.js';
import { initWhy } from './why.js';
import { initFooter } from './footer.js';

// Home. Lenis, ScrollTrigger, el loop único y los CTAs de WhatsApp están en core.js.
const { gsap, ScrollTrigger, lenis, loop, reduced } = initCore();

// Nav de cristal: oculta hasta "disco:intro-done", entra a la vez que la frase del hero
const nav = initNav({ gsap, ScrollTrigger, reduced });

// Hero v2: foto con estela líquida (OGL); la frase entra con "disco:intro-done"
// (LEGACY HERO: la fila curvada era initHeroContent, en legacy/js/hero-content.js)
const hero = initHero({ gsap, ScrollTrigger, reduced, loop });

// Destello 3D (Three.js). import() dinámico: si el CDN de three falla, la web sigue igual sin él.
// Su GLB cuenta en el progreso del loading.
const star = import('./star.js')
  .then((m) => m.initStar({ gsap, ScrollTrigger, lenis, reduced, loop }))
  .catch(() => null);
const starLoaded = star.then((s) => s && s.loaded);

// Loading (logo + progreso real) → luz roja → flash → lentes → blanco → hero
runIntroLoader({ gsap, lenis, reduced, loop, intro: config.intro, assets: [starLoaded] }).then(() => {
  document.body.classList.remove('is-loading');
  // por si no hubo loading (sin "disco:intro-done"); si ya entraron, no hacen nada
  hero.show();
  nav.appear();
  // scroll que sube: telón (hero fijo mientras los cofundadores suben por encima), parallax y entradas
  const fx = initScrollFx({ gsap, ScrollTrigger, reduced });
  fx.curtain(document.getElementById('hero-main'), document.getElementById('equipo'));
  initTeam({ gsap, ScrollTrigger, reduced });
  hero.watchCta();
  // Servicios ya no está en la home (vive en servicios.html, con js/services.js)
  initWhy({ gsap, ScrollTrigger, reduced }); // hoja de contactos: "¿Por qué nosotros?"
  initFooter({ gsap, ScrollTrigger, reduced, loop }); // el editor de vídeo (su visor es el último punto de paso del destello)
  nav.watchInk();
  ScrollTrigger.refresh();
  // estudio 360° (mismo renderer que el destello), antes de que el destello calcule su recorrido: su pin
  // es un punto de paso. Sin three (CDN caído) o sin modelo: el estudio queda como imagen fija.
  // El destello entra a la vez que la frase; su recorrido se calcula ya con los pines del estudio y de "por qué".
  star.then(async (s) => {
    if (s) await s.loaded;
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
    if (s) { s.watchScroll(); s.enter(); }
  });
});

window.disco = { gsap, lenis, loop };
