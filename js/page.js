import { initCore } from './core.js';
import { initNav } from './nav.js';
import { initServices } from './services.js';

// Páginas interiores (servicios, portfolio, nosotros, contacto): sin loading, nav visible desde el principio.
const { gsap, ScrollTrigger, lenis, loop, reduced } = initCore();

const nav = initNav({ gsap, ScrollTrigger, reduced });

// servicios.html: la misma sección y el mismo JS que en la home
if (document.getElementById('servicios')) {
  initServices({ gsap, ScrollTrigger, reduced, loop });
}
nav.watchInk(); // después del pin de servicios
ScrollTrigger.refresh();

window.disco = { gsap, lenis, loop };
