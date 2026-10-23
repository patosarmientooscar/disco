import { config } from './config.js';

// Cierre de la home: email real con "Copiar" y la prueba social, que SOLO se pinta si config.proof trae logos
// o citas reales (nada inventado: con los dos arrays vacíos no existe en la página).
export function initHomeClose() {
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
