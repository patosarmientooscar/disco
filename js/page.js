import { initCore } from './core.js';
import { initNav } from './nav.js';
import { initFin } from './fin.js';

// Páginas interiores: sin loading, nav visible desde el principio.
// <body data-page="contacto|portfolio|nosotros|servicios"> carga su módulo (js/contact.js, js/portfolio.js,
// js/about.js, js/servicios.js).
const { gsap, ScrollTrigger, lenis, loop, reduced, transitions } = initCore();

const nav = initNav({ gsap, ScrollTrigger, reduced });

const modules = { contacto: './contact.js', portfolio: './portfolio.js', nosotros: './about.js', servicios: './servicios.js' };
const page = modules[document.body.dataset.page];
const ready = page
  ? Promise.all([import('./interior.js'), import('./placeholder.js'), import(page)]).then(([interior, ph, m]) => {
    ph.initPlaceholders();
    interior.enterHeader({ gsap, reduced, arrived: transitions.arrived });
    return m.init({ gsap, ScrollTrigger, lenis, loop, reduced, arrived: transitions.arrived });
  }).catch((e) => console.error(e))
  : Promise.resolve();

ready.then(() => {
  initFin({ gsap, lenis, reduced, loop }); // sin 3D: la que cae es la estrella del logo
  nav.watchInk(); // después de los pines (servicios, nosotros)
  ScrollTrigger.refresh();
});

window.disco = { gsap, lenis, loop };
