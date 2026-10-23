import { config, whatsappUrl } from './config.js';

// WhatsApp flotante, solo en móvil y SOLO si config.ready.whatsapp === true (si no, no existe).
// Aparece al pasar la primera pantalla (el hero en la home), se esconde sobre el footer y con el menú abierto.
const MOBILE = '(max-width: 767px)';

export function initWaFloat() {
  if (config.ready?.whatsapp !== true || !matchMedia(MOBILE).matches) return;
  const a = document.createElement('a');
  a.className = 'wa-float';
  a.href = whatsappUrl();
  a.target = '_blank';
  a.rel = 'noopener';
  a.setAttribute('aria-label', 'Escríbenos por WhatsApp');
  a.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg>';
  document.body.append(a);

  let pastHero = false;
  let overFooter = false;
  const nav = document.querySelector('[data-nav]');
  const update = () => {
    const menuOpen = nav?.classList.contains('is-open');
    a.classList.toggle('is-on', pastHero && !overFooter && !menuOpen);
  };
  const onScroll = () => { pastHero = scrollY > innerHeight * 0.85; update(); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const footer = document.querySelector('[data-footer]');
  if (footer) new IntersectionObserver(([e]) => { overFooter = e.isIntersecting; update(); }).observe(footer);
  if (nav) new MutationObserver(update).observe(nav, { attributes: true, attributeFilter: ['class'] });
}
