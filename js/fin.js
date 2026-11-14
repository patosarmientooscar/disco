import { config } from './config.js';
import { vp } from './viewport.js';

// Footer de todas las páginas: "¿Rodamos juntos?" de protagonista (con su entrada de palabras con máscara), debajo
// el email (+ Copiar) y, en la misma línea, Instagram y TikTok con el usuario; abajo, la fila de páginas, legal y
// "Arriba ↑". El destello que ha viajado por la página (js/star.js en la home, js/page-star.js en las interiores)
// termina junto al título (a su derecha en escritorio, encima en móvil) y, al llegar al final del scroll, se apaga
// suave; al volver a subir se enciende y sigue su recorrido.
// Si justo encima hay ya un cierre con "¿Rodamos juntos?" (la banda final de la home, el cierre naranja de
// nosotros): versión .fin--lite, sin el título grande; la línea de redes es la
// protagonista y el destello acaba junto a ella. (En contacto el H1 lo dice, pero lejos: el footer va completo.)
// (BC-A. LEGACY: el logo "disco" gigante con la física del destello que caía sobre él, en legacy/footer-logo-fisica/;
// el footer del editor de vídeo, en legacy/footer-editor/)
const PAGES = [
  { name: 'Inicio', href: 'index.html' },
  { name: 'Servicios', href: 'servicios.html' },
  { name: 'Portfolio', href: 'portfolio.html' },
  { name: 'Nosotros', href: 'nosotros.html' },
  { name: 'Contacto', href: 'contacto.html' },
];
// (+ "Configurar cookies": abre la 2.ª capa del aviso de cookies, js/consent.js; BE)
const LEGAL = [
  { name: 'Aviso legal', href: 'aviso-legal.html' },
  { name: 'Privacidad', href: 'privacidad.html' },
  { name: 'Cookies', href: 'cookies.html' },
];
// iconos propios (24 × 24, trazo de 1.6, monocromos: currentColor)
const ICONS = {
  Instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.9"/><circle cx="17.1" cy="6.9" r="0.4" fill="currentColor"/>',
  TikTok: '<path d="M13.6 3v12.1a4.1 4.1 0 1 1-4.1-4.1"/><path d="M13.6 3c.4 3.1 2.6 5.2 5.9 5.4"/>',
};
const LITE = /rodamos\s*juntos/i;  // el cierre de justo encima ya lo dice (nosotros lo parte con <br>)
const STOP = { gap: 0.32, size: 1.45, min: 56, max: 150, mobileGap: 14 };
const OFF_AT = 2;                  // px del final: se apaga
const ON_AT = 0.12;                // × alto de pantalla por encima del final: se vuelve a encender
const OFF = { k: 0.25, s: 1.4 };   // se queda al 25 % de brillo y el canvas se funde en 1.4 s

// Dónde acaba el destello (px de pantalla con el scroll al final): { cx, cy, h } o null si no hay footer.
// Junto a la línea protagonista: a su derecha (escritorio) o encima, centrado (móvil). (grow: sin uso desde BC)
export function finStop(max) {
  const footer = document.querySelector('.fin');
  const lead = footer?.querySelector('[data-fin-lead]');
  if (!lead || !lead.getBoundingClientRect().width) return null;
  const shift = scrollY - max;
  const t = textBox(lead);
  const font = parseFloat(getComputedStyle(lead).fontSize) || 40;
  const h = Math.min(STOP.max, Math.max(STOP.min, font * STOP.size));
  if (vp.w < 768) return { cx: vp.w / 2, cy: t.top + shift - STOP.mobileGap - h / 2, h };
  return { cx: Math.min(vp.w - h * 0.5, t.right + font * STOP.gap + h * 0.36), cy: t.top + t.height / 2 + shift, h };
}

export function initFin({ gsap, lenis, reduced, loop, star = null }) {
  const footer = document.querySelector('[data-footer]');
  if (!footer) return;
  const file = location.pathname.split('/').pop() || 'index.html';
  const sections = document.querySelectorAll('main > section');
  const before = sections[sections.length - 1];
  const lite = LITE.test(before?.querySelector('h1, h2')?.textContent || '');
  footer.className = lite ? 'fin fin--lite' : 'fin';
  footer.innerHTML = markup(file, lite);

  const $ = (s) => footer.querySelector(s);
  initCopy(footer);
  initClock($('[data-fin-clock]'));
  $('.fin__up').addEventListener('click', () => {
    if (lenis) lenis.scrollTo(0, { duration: reduced.matches ? 0 : 2, immediate: reduced.matches });
    else scrollTo({ top: 0, behavior: reduced.matches ? 'auto' : 'smooth' });
  });

  // --- entrada (una vez por visita): palabras con máscara, el resto con fade ---
  if (!reduced.matches) {
    const words = footer.querySelectorAll('.fin__w > span');
    const enter = gsap.timeline({ paused: true });
    if (words.length) enter.from(words, { yPercent: 110, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0); // (lite: sin título)
    enter.from(footer.querySelectorAll('.fin__mail, .fin__social'), { opacity: 0, duration: 0.8, ease: 'power1.out', stagger: 0.12 }, words.length ? 0.15 : 0)
      .from($('.fin__row'), { opacity: 0, duration: 0.8, ease: 'power1.out' }, 0.45);
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      enter.play();
    }, { threshold: 0.3 }).observe(footer);
  }

  // --- foco que sigue al cursor (solo ratón) ---
  const spot = $('.fin__spot');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const light = { x: 0, y: 0, tx: 0, ty: 0, on: false };
  const local = (e) => {
    const r = footer.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  footer.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !fine.matches) return;
    [light.tx, light.ty] = local(e);
    if (!light.on) {
      light.on = true;
      light.x = light.tx;
      light.y = light.ty;
      gsap.to(spot, { opacity: 1, duration: 0.4, overwrite: true });
    }
  });
  footer.addEventListener('pointerleave', () => { light.on = false; gsap.to(spot, { opacity: 0, duration: 0.6, overwrite: true }); });

  // --- el destello: al llegar al final se apaga suave; al subir, se enciende ---
  let adapter = null;
  if (star && !reduced.matches) Promise.resolve(star).then((s) => { adapter = s?.footer || null; }).catch(() => {});
  let off = false;
  let near = false;
  new IntersectionObserver(([e]) => { near = e.isIntersecting; }, { rootMargin: '25% 0px' }).observe(footer);

  loop.add((time, ratio) => {
    if (!near || document.hidden) return;
    if (light.on || spot.style.opacity !== '0') {
      const a = 1 - Math.pow(1 - 0.1, ratio);
      light.x += (light.tx - light.x) * a;
      light.y += (light.ty - light.y) * a;
      spot.style.transform = `translate3d(${light.x}px, ${light.y}px, 0)`;
    }
    if (!adapter || adapter.failed || !adapter.ready) return;
    const y = lenis ? lenis.scroll : scrollY;
    const limit = lenis ? lenis.limit : document.documentElement.scrollHeight - vp.h;
    if (!off && y >= limit - OFF_AT) {
      off = true;
      adapter.dim(OFF.k, OFF.s);
      adapter.fade(0, OFF.s);
    } else if (off && y < limit - ON_AT * vp.h) {
      off = false;
      adapter.relight();
      adapter.fade(1, 0.5);
    }
  });
}

// ---------- maqueta ----------
function markup(file, lite) {
  const email = config.email;
  const link = (p) => `<li><a href="${p.href}"${p.href === file ? ' aria-current="page"' : ''}>${p.name}</a></li>`;
  const socials = config.socials.filter((s) => s.url && ICONS[s.name]);
  if (!socials.length && config.instagram?.url) socials.push({ name: 'Instagram', ...config.instagram });
  const handles = [...new Set(socials.map((s) => s.handle))];
  const icon = (s) => `<a class="fin__icon" href="${s.url}" target="_blank" rel="noopener" aria-label="${s.name} de disco">`
    + `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[s.name]}</svg></a>`;
  const social = socials.length ? `
      <div class="fin__social"${lite ? ' data-fin-lead' : ''}>
        <span class="fin__icons">${socials.map(icon).join('')}</span>
        <a class="fin__handle" href="${socials[0].url}" target="_blank" rel="noopener">${handles.join(' · ')}</a>
      </div>` : '';
  // (AY-I: en Contacto el email ya es la página entera: no se repite)
  const mail = file === 'contacto.html' ? '' : `
      <div class="fin__mail">
        <a class="fin__email" href="mailto:${email}">${email}</a>
        <button class="fin__copy" type="button" data-fin-copy>Copiar</button>
        <span class="fin__copied" data-fin-copied role="status" aria-live="polite"></span>
      </div>`;
  const title = lite ? '' : `
      <p class="fin__title" data-fin-lead><span class="fin__w"><span>¿Rodamos</span></span> <span class="fin__w"><span>juntos<b>?</b></span></span></p>`;
  return `
    <i class="fin__glow" aria-hidden="true"></i>
    <i class="fin__spot" aria-hidden="true"></i>
    <h2 class="sr-only">disco.</h2>
    <div class="fin__top">${title}
      <div class="fin__contact">${lite ? social + mail : mail + social}</div>
    </div>
    <div class="fin__row">
      <nav aria-label="Páginas"><ul class="fin__list">${PAGES.map(link).join('')}</ul></nav>
      <ul class="fin__list fin__list--mid">${LEGAL.map(link).join('')}<li><button class="fin__consent" type="button" data-consent-open aria-haspopup="dialog">Configurar cookies</button></li></ul>
      <div class="fin__end">
        <span data-fin-clock>MADRID</span>
        <span>© ${new Date().getFullYear()} disco.</span>
        <button class="fin__up" type="button">Arriba ↑</button>
      </div>
    </div>`;
}

function initCopy(root) {
  const out = root.querySelector('[data-fin-copied]');
  let timer = 0;
  root.querySelector('[data-fin-copy]')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(config.email);
      out.textContent = 'Copiado';
    } catch {
      out.textContent = 'No se pudo';
    }
    clearTimeout(timer);
    timer = setTimeout(() => { out.textContent = ''; }, 1600);
  });
}

// hora real de Madrid; los ":" parpadean cada segundo (CSS)
function initClock(el) {
  const fmt = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false });
  let last = '';
  const tick = () => {
    const parts = fmt.formatToParts(new Date());
    const h = parts.find((p) => p.type === 'hour').value;
    const min = parts.find((p) => p.type === 'minute').value;
    if (h + min === last) return;
    last = h + min;
    el.innerHTML = `MADRID ${h}<span class="fin__colon">:</span>${min}`;
  };
  tick();
  setInterval(tick, 10000);
}

// caja del texto real: alto, el del bloque (sus palabras pueden estar aún bajadas por la entrada); derecha, la del
// texto (el bloque ocupa toda la fila y el texto va centrado; la entrada solo mueve en vertical)
function textBox(el) {
  const b = el.getBoundingClientRect();
  const r = document.createRange();
  r.selectNodeContents(el);
  const rects = [...r.getClientRects()].filter((q) => q.width > 1);
  return { top: b.top, height: b.height, right: rects.length ? Math.max(...rects.map((q) => q.right)) : b.right };
}
