import { config } from './config.js';

// Cierre de la home: "cómo trabajamos" (una frase que se construye con el scroll), email real con "Copiar" y la
// prueba social, que SOLO se pinta si config.proof trae logos o citas reales (nada inventado: con los dos
// arrays vacíos no existe en la página).
export function initHomeClose({ gsap, reduced }) {
  initHow({ gsap, reduced });
  const email = config.email;
  document.querySelectorAll('.hc-close [data-email]').forEach((a) => { a.href = `mailto:${email}`; a.textContent = email; });

  const ok = document.querySelector('.hc-close [data-copied]');
  let timer = 0;
  document.querySelector('[data-copy-email]')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(email);
      ok.textContent = 'Copiado';
    } catch {
      ok.textContent = 'No se pudo copiar';
    }
    clearTimeout(timer);
    timer = setTimeout(() => { ok.textContent = ''; }, 1500);
  });

  renderProof();
}

// Cada línea de la frase se ilumina (.25 → 1) al acercarse al centro de la pantalla (scrub corto) y a la vez se
// dibuja el subrayado naranja de su palabra clave. Las notas no dependen de eso: aparecen todas a la vez cuando
// la sección entra y se quedan. Movimiento reducido: todo visible (CSS).
function initHow({ gsap, reduced }) {
  if (reduced.matches) return;
  document.querySelectorAll('[data-how-row]').forEach((row) => {
    const line = row.querySelector('.hc-how__line');
    gsap.timeline({ scrollTrigger: { trigger: line, start: 'top 85%', end: 'center 62%', scrub: 0.4 } })
      .fromTo(line, { opacity: 0.25 }, { opacity: 1, ease: 'none', duration: 1 }, 0)
      .fromTo(row.querySelectorAll('.hc-how__ul path'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'power1.inOut', duration: 0.5 }, 0.45);
  });
  const list = document.querySelector('[data-how]');
  if (!list) return;
  gsap.fromTo(list.querySelectorAll('.hc-how__note'), { opacity: 0, y: 12 }, {
    opacity: 1,
    y: 0,
    duration: 0.8,
    ease: 'expo.out',
    stagger: 0.06,
    scrollTrigger: { trigger: list, start: 'top 80%', once: true },
  });
}

// config.proof = { logos: [{ src, alt }], quotes: [{ text, name, business }] }
function renderProof() {
  const { logos = [], quotes = [] } = config.proof || {};
  if (!logos.length && !quotes.length) return;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const section = document.createElement('section');
  section.className = 'hc-proof';
  section.setAttribute('aria-labelledby', 'hc-proof-title');
  section.innerHTML = `<div class="hc-wrap">
    <h2 class="sr-only" id="hc-proof-title">Con quién hemos trabajado</h2>
    ${logos.length ? `<ul class="hc-proof__logos">${logos.map((l) => `<li><img src="${esc(l.src)}" alt="${esc(l.alt)}" loading="lazy" decoding="async" height="32"></li>`).join('')}</ul>` : ''}
    ${quotes.length ? `<div class="hc-proof__quotes">${quotes.slice(0, 3).map((q) => `<blockquote class="hc-proof__quote"><p>${esc(q.text)}</p><cite>${esc(q.name)}${q.business ? ` · ${esc(q.business)}` : ''}</cite></blockquote>`).join('')}</div>` : ''}
  </div>`;
  document.querySelector('.hc-close')?.before(section);
}
