import { initCore } from './core.js';
import { initNav } from './nav.js';
import { initFin } from './fin.js';

// Páginas interiores: sin loading, nav visible desde el principio.
// <body data-page="contacto|portfolio|nosotros|servicios"> carga su módulo (js/contact.js, js/portfolio.js,
// js/about.js, js/servicios.js; la página de cada proyecto, proyecto.html#slug: js/proyecto.js). Las cuatro abren con el mismo hero (js/page-hero.js: vídeo + el destello 3D de la
// home) y el destello vuelve después: en servicios recorre la página desde "Tres oficios"; en todas, cae en el footer
// (js/page-star.js). Sin three o sin WebGL, el hero sigue (vídeo + título) y en el footer cae la estrella del logo.
const { gsap, ScrollTrigger, lenis, loop, reduced, transitions } = initCore();

const nav = initNav({ gsap, ScrollTrigger, reduced });

const modules = { contacto: './contact.js', portfolio: './portfolio.js', nosotros: './about.js', servicios: './servicios.js', proyecto: './proyecto.js' };
const page = modules[document.body.dataset.page];
const ready = page
  ? Promise.all([import('./interior.js'), import('./placeholder.js'), import('./page-hero.js'), import(page)]).then(([interior, ph, hero, m]) => {
    ph.initPlaceholders();
    hero.initPageHero({ gsap, ScrollTrigger, lenis, loop, reduced, arrived: transitions.arrived });
    interior.enterHeader({ gsap, reduced, arrived: transitions.arrived });
    return m.init({ gsap, ScrollTrigger, lenis, loop, reduced, arrived: transitions.arrived });
  }).catch((e) => console.error(e))
  : Promise.resolve();

ready.then(() => {
  // el destello del recorrido (comparte three y el GLB con el del hero); sin él, cae la estrella del logo
  const star = page && !reduced.matches
    ? import('./page-star.js').then((m) => m.initPageStar({ gsap, ScrollTrigger, lenis, loop, reduced })).catch(() => null)
    : null;
  initFin({ gsap, lenis, reduced, loop, star });
  nav.watchInk(); // después de los pines (servicios, nosotros)
  ScrollTrigger.refresh();
});

window.disco = { gsap, lenis, loop };
