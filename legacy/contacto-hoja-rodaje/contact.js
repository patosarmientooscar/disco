import { config } from './config.js';

// Contacto: canales directos (copiar email, WhatsApp solo si es real) y el formulario "hoja de rodaje".
// ENVÍO: aún no hay backend. FORM_ENDPOINT vacío → se abre el correo (mailto) con todo ordenado.
// TODO: poner aquí el endpoint de Formspree / Web3Forms / Netlify Forms (recibe JSON por POST).
const FORM_ENDPOINT = '';

const LABELS = {
  nombre: 'Nombre',
  negocio: 'Negocio',
  email: 'Email',
  telefono: 'Teléfono',
  necesidad: 'Qué necesita',
  tipo: 'Tipo de negocio',
  cuando: 'Para cuándo',
  presupuesto: 'Presupuesto orientativo',
  mensaje: 'Mensaje',
  ref: 'Referencia (portfolio)',
};

export function init({ gsap, lenis, reduced }) {
  const email = config.email;
  document.querySelectorAll('[data-email]').forEach((a) => { a.href = `mailto:${email}`; a.textContent = email; });

  // --- copiar email ---
  const copied = document.querySelector('[data-copied]');
  let copyTimer = 0;
  document.querySelector('[data-copy]')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(email);
      copied.textContent = 'Copiado';
    } catch {
      copied.textContent = 'No se pudo copiar';
    }
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { copied.textContent = ''; }, 1500);
  });

  // --- canales que dependen de datos reales ---
  const wa = config.ready.whatsapp;
  const waUrl = (text) => `https://wa.me/${config.whatsapp.phone}?text=${encodeURIComponent(text)}`;
  if (wa) {
    document.querySelector('[data-whatsapp]').hidden = false;
    document.querySelector('[data-wa-link]').href = waUrl(config.whatsapp.message);
  }
  const ig = document.querySelector('[data-ig]');
  if (ig) { ig.href = config.instagram.url; ig.textContent = config.instagram.handle; }
  const response = document.querySelector('[data-response]');
  if (config.responseTime) { response.hidden = false; response.textContent = `Respondemos en ${config.responseTime}`; }

  // --- formulario ---
  const form = document.querySelector('[data-form]');
  const slate = document.querySelector('[data-slate]');
  const done = document.querySelector('[data-done]');
  const stick = document.querySelector('[data-stick]');
  const waSend = document.querySelector('[data-wa-send]');
  // en móvil la hoja ocupa todo el ancho: el menú pasa a tinta negra encima de ella (en escritorio va a la derecha)
  if (matchMedia('(max-width: 899px)').matches) slate.setAttribute('data-nav-ink', 'dark');

  // ?ref=slug (desde "Quiero algo así →" del portfolio): se añade al mensaje
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref) {
    const note = document.querySelector('[data-ref]');
    note.hidden = false;
    note.textContent = `REF: ${ref} · quieres algo como este trabajo`;
  }

  const fields = {
    nombre: { el: form.elements.nombre, check: (v) => (v.trim() ? '' : 'Dinos cómo te llamas.') },
    negocio: { el: form.elements.negocio, check: (v) => (v.trim() ? '' : 'Dinos el nombre de tu negocio.') },
    email: {
      el: form.elements.email,
      check: (v) => {
        if (!v.trim()) return 'Necesitamos un email para contestarte.';
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Revisa el email: parece que le falta algo (ej. nombre@negocio.com).';
      },
    },
    telefono: { el: form.elements.telefono, check: (v) => (!v.trim() || /^[+\d][\d\s().-]{6,}$/.test(v.trim()) ? '' : 'Revisa el teléfono (solo números, espacios y +).') },
    privacidad: { el: form.elements.privacidad, check: (_, el) => (el.checked ? '' : 'Marca la casilla para poder enviarlo.') },
  };
  const errOf = (el) => document.getElementById(el.getAttribute('aria-describedby'));
  const validate = (name) => {
    const { el, check } = fields[name];
    const msg = check(el.value, el);
    el.setAttribute('aria-invalid', String(!!msg));
    errOf(el).textContent = msg;
    return !msg;
  };
  // tras el primer intento, se revisa cada campo al salir de él
  let tried = false;
  Object.keys(fields).forEach((name) => {
    const ev = fields[name].el.type === 'checkbox' ? 'change' : 'blur';
    fields[name].el.addEventListener(ev, () => { if (tried) validate(name); });
  });

  const values = () => {
    const data = new FormData(form);
    const out = {};
    Object.keys(LABELS).forEach((k) => {
      const v = k === 'necesidad' ? data.getAll(k).join(', ') : (data.get(k) || '').toString().trim();
      if (v) out[k] = v;
    });
    if (ref) out.ref = ref;
    return out;
  };
  const bodyText = (v) => [
    'Hola, equipo de disco:',
    '',
    ...Object.keys(LABELS).filter((k) => v[k] && k !== 'mensaje').map((k) => `${LABELS[k]}: ${v[k]}`),
    ...(v.mensaje ? ['', 'Mensaje:', v.mensaje] : []),
  ].join('\n');
  const subject = (v) => `Presupuesto — ${v.negocio || 'mi negocio'}`;

  // "o envíalo por WhatsApp" con el mismo texto (solo si el WhatsApp es real)
  if (wa) {
    waSend.hidden = false;
    const sync = () => { waSend.href = waUrl(`${subject(values())}\n\n${bodyText(values())}`); };
    form.addEventListener('input', sync);
    sync();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    tried = true;
    const bad = Object.keys(fields).filter((name) => !validate(name));
    if (bad.length) {
      fields[bad[0]].el.focus();
      return;
    }
    // honeypot relleno: un robot. Se le da por bueno sin enviar nada
    if (form.elements.web.value) { success(''); return; }

    const v = values();
    if (FORM_ENDPOINT) {
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      try {
        const res = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ ...v, _subject: subject(v) }),
        });
        if (!res.ok) throw new Error(res.status);
        success('');
      } catch {
        btn.disabled = false;
        errOf(fields.privacidad.el).textContent = `No se ha podido enviar. Escríbenos a ${email} y te contestamos igual.`;
      }
      return;
    }
    location.href = `mailto:${email}?subject=${encodeURIComponent(subject(v))}&body=${encodeURIComponent(bodyText(v))}`;
    success('Se ha abierto tu correo con el mensaje ya escrito: solo tienes que darle a enviar.');
  });

  // la claqueta "se cierra": el palo baja y choca (0.25 s) con un pequeño temblor, y sale el mensaje
  function success(note) {
    document.querySelector('[data-done-note]').textContent = note;
    slate.style.minHeight = `${slate.offsetHeight}px`; // la hoja no encoge (la página no salta)
    const show = () => {
      form.hidden = true;
      done.hidden = false;
      done.focus({ preventScroll: true });
      // el mensaje, en el centro de la pantalla
      const box = slate.getBoundingClientRect();
      lenis.scrollTo(scrollY + box.top + box.height / 2 - innerHeight / 2, { immediate: reduced.matches, duration: 0.9 });
    };
    if (reduced.matches) { gsap.set(stick, { rotate: 0 }); show(); return; }
    gsap.timeline()
      .to(stick, { rotate: 0, duration: 0.25, ease: 'power3.in' })
      .to(slate, { keyframes: { x: [0, -5, 4, -2, 0] }, duration: 0.22, ease: 'none' })
      .to(form, { autoAlpha: 0, duration: 0.25, ease: 'power1.out' }, '<')
      .add(show)
      .fromTo(done, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'expo.out' });
  }

  initFaq({ gsap, reduced });
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
