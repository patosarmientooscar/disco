import { config } from './config.js';

// Contacto (contacto.html, css/contact.css): sin hero. El titular y los canales (copiar el email, Instagram) y un
// formulario corto que ENVÍA EL CORREO DIRECTAMENTE con EmailJS (sin abrir el programa de correo): js/config.js →
// emailjs; la plantilla del correo y los pasos, en docs/emailjs/. Con las claves vacías, el formulario lo dice y da
// el email. Anti-spam: campo trampa, 3 s mínimos desde que se abre la página y 30 s entre envíos.
// Animaciones: el titular sube y los campos entran en cascada; mientras se escribe, el REC late más rápido; al
// enviar, el botón se vuelve una barra fina; al terminar, flash y "Recibido, {nombre}.".
// (LEGACY: la claqueta y el formulario largo, en legacy/contacto-hoja-rodaje/)
const MIN_MS = 3000;          // antes de esto, un envío es de un robot
const LOCK_MS = 30000;        // entre dos envíos
const TYPING_MS = 1200;       // el REC late rápido hasta 1,2 s después de la última tecla
const LOCK_KEY = 'disco_contact_sent';
const MSG = {
  nombre: 'Escribe tu nombre.',
  negocio: 'Escribe el nombre de tu negocio.',
  email: 'Escribe un email válido (nombre@dominio.com).',
  telefono: 'Escribe un teléfono válido (9 cifras como mínimo).',
  privacidad: 'Necesitamos que aceptes la política de privacidad.',
};
const loaded = performance.now();
// EmailJS (envía el correo desde el navegador): solo se descarga cuando hace falta (al tocar el formulario)
const EMAILJS = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/dist/email.min.js';
let emailjsReady = null;
const loadEmailjs = () => emailjsReady ||= new Promise((resolve, reject) => {
  if (window.emailjs) { resolve(window.emailjs); return; }
  const sc = document.createElement('script');
  sc.src = EMAILJS;
  sc.onload = () => (window.emailjs ? resolve(window.emailjs) : reject(new Error('emailjs')));
  sc.onerror = () => { emailjsReady = null; reject(new Error('emailjs')); };
  document.head.append(sc);
});

export function init({ gsap, lenis, reduced }) {
  const email = config.email;
  const still = reduced.matches;
  const sec = document.querySelector('.ct');
  document.querySelectorAll('[data-email]').forEach((a) => { a.href = `mailto:${email}`; a.textContent = email; });
  const ig = document.querySelector('[data-ig]');
  if (ig) { ig.href = config.instagram.url; ig.textContent = config.instagram.handle; }
  if (config.responseTime) document.querySelector('[data-ct-time]').textContent = `Cuéntanos qué necesitas y te respondemos en ${config.responseTime}.`;

  // --- copiar el email ---
  const copied = document.querySelector('[data-copied]');
  let copyTimer = 0;
  document.querySelector('[data-copy]')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(email); copied.textContent = 'Copiado'; } catch { copied.textContent = 'No se pudo copiar'; }
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { copied.textContent = ''; }, 1500);
  });

  // --- entrada: el titular sube y los campos, en cascada ---
  const fields = [...document.querySelectorAll('[data-cf]')];
  if (!still) {
    gsap.from('[data-ct-rise]', { yPercent: 105, duration: 1.2, ease: 'expo.out', delay: 0.1 });
    gsap.from('[data-ct-in]', { opacity: 0, y: 18, duration: 0.9, ease: 'expo.out', stagger: 0.08, delay: 0.3 });
    gsap.from(fields, { opacity: 0, y: 22, duration: 0.8, ease: 'expo.out', stagger: 0.06, delay: 0.35 });
  }

  // --- el formulario ---
  const form = document.querySelector('[data-form]');
  const send = form.querySelector('[data-send]');
  const bar = send.querySelector('[data-bar]');
  const status = form.querySelector('[data-status]');
  const done = document.querySelector('[data-done]');
  const flash = document.querySelector('[data-ct-flash]');
  const keys = config.emailjs || {};
  const ready = !!(keys.publicKey && keys.serviceId && keys.templateId);
  const fallback = `<a href="mailto:${email}">${email}</a>`;

  // con las claves puestas, EmailJS se descarga en cuanto se toca el formulario
  if (ready) form.addEventListener('focusin', () => loadEmailjs().catch(() => {}), { once: true });

  // mientras se escribe, el REC late más rápido
  let typing = 0;
  form.addEventListener('input', (e) => {
    sec.classList.add('is-typing');
    clearTimeout(typing);
    typing = setTimeout(() => sec.classList.remove('is-typing'), TYPING_MS);
    const f = e.target.closest('[data-cf]');
    if (f?.classList.contains('is-bad')) check(e.target);
  });

  const digits = (v) => v.replace(/\D/g, '');
  const valid = {
    nombre: (v) => v.trim().length > 1,
    negocio: (v) => v.trim().length > 1,
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
    telefono: (v) => digits(v).length >= 9,
  };
  // un campo: su error debajo (o nada)
  const check = (input) => {
    const name = input.name;
    const ok = name === 'privacidad' ? input.checked : valid[name] ? valid[name](input.value) : true;
    const box = input.closest('[data-cf]');
    const err = box.querySelector('.cf__err');
    box.classList.toggle('is-bad', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    if (err) err.textContent = ok ? '' : MSG[name];
    return ok;
  };
  form.querySelectorAll('input[required]').forEach((i) => i.addEventListener('blur', () => { if (i.value || i.type === 'checkbox') check(i); }));

  const say = (html, error = false) => { status.innerHTML = html; status.classList.toggle('is-error', error); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputs = [...form.querySelectorAll('input[required]')];
    const bad = inputs.filter((i) => !check(i));
    if (bad.length) { bad[0].focus(); say(''); return; }
    // anti-spam: campo trampa, demasiado rápido o reenvío en menos de 30 s (aparenta que sale bien)
    const data = Object.fromEntries(new FormData(form));
    const now = Date.now();
    let last = 0;
    try { last = Number(localStorage.getItem(LOCK_KEY)) || 0; } catch { /* sin almacenamiento */ }
    if (data.web) { finish(data); return; }
    if (performance.now() - loaded < MIN_MS) { say('Un segundo… vuelve a pulsar Enviar.'); return; }
    if (now - last < LOCK_MS) { say(`Ya nos ha llegado tu mensaje. Si quieres añadir algo, espera unos segundos o escríbenos a ${fallback}.`); return; }
    // sin claves: el formulario aún no envía
    let emailjs = null;
    if (ready) { try { emailjs = await loadEmailjs(); } catch { /* sin red o bloqueado */ } }
    if (!ready || !emailjs) {
      say(`Formulario en configuración: escríbenos a ${fallback}.`, true);
      return;
    }
    const params = buildParams(data);
    sending(true);
    try {
      await emailjs.send(keys.serviceId, keys.templateId, params, { publicKey: keys.publicKey });
      if (keys.autoReplyTemplateId) emailjs.send(keys.serviceId, keys.autoReplyTemplateId, params, { publicKey: keys.publicKey }).catch(() => {});
      try { localStorage.setItem(LOCK_KEY, String(Date.now())); } catch { /* sin almacenamiento */ }
      await gsap.to(bar, { scaleX: 1, duration: 0.25, ease: 'power2.out' });
      finish(data);
    } catch {
      sending(false);
      say(`No se ha podido enviar. Escríbenos a ${fallback} y te respondemos igual.`, true);
    }
  });

  let progress = null;
  function sending(on) {
    send.classList.toggle('is-sending', on);
    send.disabled = on;
    send.setAttribute('aria-busy', String(on));
    progress?.kill();
    if (on) {
      say('Enviando…');
      progress = gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 0.9, duration: 4, ease: 'power3.out' });
    } else gsap.set(bar, { scaleX: 0 });
  }
  // recibido: flash corto y el mensaje con el destello girando
  function finish(data) {
    const name = (data.nombre || '').trim().split(/\s+/)[0] || '';
    document.querySelector('[data-done-title]').textContent = name ? `Recibido, ${name}.` : 'Recibido.';
    document.querySelector('[data-done-text]').textContent = data.email ? `Te escribimos muy pronto a ${data.email.trim()}.` : 'Te escribimos muy pronto.';
    const swap = () => { form.hidden = true; done.hidden = false; done.focus({ preventScroll: true }); };
    if (still) { swap(); return; }
    gsap.timeline()
      .to(flash, { opacity: 0.9, duration: 0.08, ease: 'none' })
      .add(swap)
      .to(flash, { opacity: 0, duration: 0.45, ease: 'power2.out' })
      .from(done.children, { opacity: 0, y: 16, duration: 0.8, ease: 'expo.out', stagger: 0.08 }, '<');
  }

  initFaq({ gsap, reduced });
}

// los parámetros que recibe la plantilla de EmailJS (docs/emailjs/email-nuevo-contacto.html), con estos nombres
function buildParams(d) {
  const q = new URLSearchParams(location.search);
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Otro navegador';
  const mobile = matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone/i.test(ua);
  const utm = [q.get('utm_source') && `utm_source=${q.get('utm_source')}`, q.get('utm_campaign') && `utm_campaign=${q.get('utm_campaign')}`].filter(Boolean).join(' · ');
  const origen = [document.referrer, utm].filter(Boolean).join(' · ') || 'Directo';
  // teléfono para WhatsApp: solo cifras, sin 00 delante y con el 34 si no trae prefijo
  let tel = (d.telefono || '').replace(/\D/g, '').replace(/^00/, '');
  if (tel.length === 9) tel = `34${tel}`;
  const nombre = (d.nombre || '').trim();
  const hola = `Hola ${nombre.split(/\s+/)[0] || ''}, somos disco. Gracias por escribirnos…`;
  return {
    nombre,
    negocio: (d.negocio || '').trim(),
    email: (d.email || '').trim(),
    telefono: (d.telefono || '').trim(),
    mensaje: (d.mensaje || '').trim() || '—',
    fecha: new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' }).format(new Date()),
    pagina: location.href,
    referencia: q.get('ref') || '—',
    origen,
    dispositivo: `${mobile ? 'Móvil' : 'Ordenador'} · ${browser}`,
    idioma: navigator.language || '—',
    whatsapp_url: `https://wa.me/${tel}?text=${encodeURIComponent(hola)}`,
  };
}

// acordeón: <details> nativo; con movimiento, la altura se anima (abre y cierra suave)
function initFaq({ gsap, reduced }) {
  if (reduced.matches) return;
  document.querySelectorAll('[data-faq] details').forEach((d) => {
    const summary = d.querySelector('summary');
    const body = d.querySelector('.faq__a');
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      gsap.killTweensOf(body);
      if (!d.open) {
        d.open = true;
        gsap.fromTo(body, { height: 0 }, { height: 'auto', duration: 0.45, ease: 'power3.out', clearProps: 'height' });
      } else {
        gsap.to(body, { height: 0, duration: 0.35, ease: 'power3.inOut', onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'height' }); } });
      }
    });
  });
}
