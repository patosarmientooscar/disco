// Aviso de cookies (BE). Script clásico (defer), en todas las páginas desde el bloque consent:head
// (tools/consent-head.html). Estilos: css/consent.css. LSSI art. 22.2 y guía de cookies de la AEPD:
//   · nada de analítica hasta que se acepta (Consent Mode v2: el default "denied" ya está en el <head>, antes de GTM);
//   · rechazar igual de fácil que aceptar (mismo botón, misma capa); nada preseleccionado;
//   · hacer scroll, navegar o cerrar NO es aceptar; Escape en la primera capa = rechazar;
//   · se puede cambiar de opinión siempre: cualquier [data-consent-open] (footer, política de cookies) abre la 2.ª capa.
// La elección: localStorage disco_consent = { v, analytics, fecha }. Caduca a los 12 meses o al cambiar V (se vuelve a
// preguntar). La MISMA regla está en el <head> (tools/consent-head.html): si cambias V o MESES, cámbialos allí también.
// Sin localStorage: se pregunta en cada visita y todo se queda en denied.
(function () {
  'use strict';

  var KEY = 'disco_consent';
  var V = 1;
  var MESES = 12;
  var DELAY = 1200;        // ms tras la carga (en la home: tras la intro, "disco:intro-done")
  var INTRO_MAX = 9000;    // por si la intro no avisa: como mucho, esto
  var GA_DOMAIN = 'discoproduccion.com';

  var root = document.documentElement;
  var banner = null;
  var panel = null;
  var opener = null;       // quién abrió la 2.ª capa (para devolverle el foco)
  var before = null;       // dónde estaba el foco antes de que saliera el aviso
  var keyboard = false;    // ¿navega con teclado? (Tab): entonces el foco va al primer botón
  document.addEventListener('keydown', function (e) { if (e.key === 'Tab') keyboard = true; }, true);
  document.addEventListener('pointerdown', function () { keyboard = false; }, true);

  // ---------- la elección guardada ----------
  function read() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY));
      if (!c || c.v !== V || typeof c.analytics !== 'boolean') return null;
      var end = new Date(c.fecha);
      if (isNaN(end)) return null;
      end.setMonth(end.getMonth() + MESES);
      return end > new Date() ? c : null;
    } catch (e) { return null; }
  }
  function save(analytics) {
    try { localStorage.setItem(KEY, JSON.stringify({ v: V, analytics: analytics, fecha: new Date().toISOString() })); } catch (e) { /* sin storage: se volverá a preguntar */ }
  }

  function gtagSafe() {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag.apply(null, arguments);
  }

  // ---------- aplicar ----------
  function choose(analytics) {
    var prev = read();
    save(analytics);
    gtagSafe('consent', 'update', { analytics_storage: analytics ? 'granted' : 'denied' });
    window.dataLayer.push({ event: 'disco_consent', analytics: analytics });
    // si la retira (o rechaza), fuera las cookies de Google Analytics que hubiera
    if (!analytics) clearGa();
    hideBanner();
    closePanel(true);
    return prev;
  }

  // _ga y _ga_<ID>, en el host, en .host y en el dominio de la web (y sus subdominios)
  function clearGa() {
    var names = document.cookie.split(';').map(function (c) { return c.split('=')[0].trim(); })
      .filter(function (n) { return n === '_ga' || n.indexOf('_ga_') === 0; });
    if (!names.length) return;
    var host = location.hostname;
    var domains = ['', host, '.' + host];
    var parts = host.split('.');
    for (var i = 1; i < parts.length - 1; i++) domains.push('.' + parts.slice(i).join('.'));
    domains.push(GA_DOMAIN, '.' + GA_DOMAIN);
    var past = 'expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/';
    names.forEach(function (n) {
      domains.forEach(function (d) { document.cookie = n + '=; ' + past + (d ? '; domain=' + d : ''); });
    });
  }

  // ---------- primera capa ----------
  var isDoc = !!document.querySelector('main.legal'); // cookies, privacidad, aviso legal: se lee la política antes

  function buildBanner() {
    var el = document.createElement('section');
    el.className = 'consent' + (isDoc ? ' consent--doc' : '');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'false');
    el.setAttribute('aria-labelledby', 'consent-title');
    el.setAttribute('aria-describedby', 'consent-text');
    el.tabIndex = -1;
    el.hidden = true;
    el.innerHTML =
      '<p class="consent__title" id="consent-title">Cookies</p>' +
      '<p class="consent__text" id="consent-text">Usamos cookies de analítica (Google Analytics) para saber cómo se usa la web y mejorarla. Solo si nos dejas. Más información en la <a href="cookies.html">política de cookies</a>.</p>' +
      '<div class="consent__actions">' +
        '<button class="consent__btn" type="button" data-consent="accept">Aceptar</button>' +
        '<button class="consent__btn" type="button" data-consent="reject">Rechazar</button>' +
        '<button class="consent__more" type="button" data-consent="settings" aria-haspopup="dialog">Configurar</button>' +
      '</div>';
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-consent]');
      if (!b) return;
      var a = b.getAttribute('data-consent');
      if (a === 'accept') choose(true);
      else if (a === 'reject') choose(false);
      else openPanel(b);
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); choose(false); } // cerrar = rechazar
    });
    document.body.appendChild(el);
    return el;
  }

  function showBanner() {
    if (read() || (panel && panel.open)) return;
    banner = banner || buildBanner();
    before = document.activeElement;
    banner.hidden = false;
    if (isDoc) {
      root.classList.add('consent-doc-on');
      var setH = function () { if (banner && !banner.hidden) root.style.setProperty('--consent-h', banner.offsetHeight + 24 + 'px'); };
      setH();
      window.addEventListener('resize', setH, { passive: true });
    }
    // un fotograma con opacity 0 y después la entrada (fade + 8 px)
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.classList.add('is-in');
        // con teclado, al primer botón; con ratón o táctil, al aviso (se anuncia con su título y el siguiente Tab
        // cae en "Aceptar"): así ningún botón sale con el anillo de foco y "Aceptar" no destaca sobre "Rechazar"
        var first = banner.querySelector('.consent__btn');
        if (keyboard && first) first.focus({ preventScroll: true });
        else banner.focus({ preventScroll: true });
      });
    });
    // Escape con el foco fuera del aviso (en la página, no en un menú abierto): también rechaza
    document.addEventListener('keydown', escOutside);
  }
  function escOutside(e) {
    if (e.key !== 'Escape' || !banner || banner.hidden || (panel && panel.open)) return;
    var a = document.activeElement;
    if (a && a !== document.body && !banner.contains(a)) return; // (p. ej. el menú de la nav: es suyo)
    choose(false);
  }

  function hideBanner() {
    document.removeEventListener('keydown', escOutside);
    if (!banner || banner.hidden) return;
    var hadFocus = banner.contains(document.activeElement);
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    banner.classList.remove('is-in');
    banner.classList.add('is-out');
    var done = function () {
      banner.hidden = true;
      banner.classList.remove('is-out');
      root.classList.remove('consent-doc-on');
    };
    if (reduce) done(); else setTimeout(done, 320);
    if (hadFocus && !(panel && panel.open)) {
      if (before && before !== document.body && document.contains(before)) before.focus({ preventScroll: true });
      else if (document.activeElement) document.activeElement.blur();
    }
  }

  // ---------- segunda capa ----------
  function buildPanel() {
    var d = document.createElement('dialog');
    d.className = 'consent-panel';
    d.setAttribute('aria-labelledby', 'consent-panel-title');
    d.setAttribute('aria-describedby', 'consent-panel-intro');
    d.setAttribute('data-lenis-prevent', '');
    d.innerHTML =
      '<div class="consent-panel__in">' +
        '<div class="consent-panel__head">' +
          '<p class="consent-panel__title" id="consent-panel-title">Configurar cookies</p>' +
          '<button class="consent-panel__close" type="button" data-consent="close" aria-label="Cerrar sin guardar">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>' +
        '</div>' +
        '<p class="consent-panel__intro" id="consent-panel-intro">Elige qué aceptas. Puedes cambiarlo cuando quieras desde «Configurar cookies», al pie de cada página. Más detalle en la <a href="cookies.html">política de cookies</a>.</p>' +
        '<ul class="consent-panel__rows">' +
          '<li class="consent-row">' +
            '<p class="consent-row__name">Necesarias</p>' +
            '<span class="consent-row__state">Siempre activas</span>' +
            '<p class="consent-row__desc">Las marcas técnicas de la web (en <code>sessionStorage</code>: la intro ya vista y la transición entre páginas) y guardar tu elección de cookies. No te identifican ni se comparten.</p>' +
          '</li>' +
          '<li class="consent-row">' +
            '<p class="consent-row__name" id="consent-ga-name">Analítica</p>' +
            '<label class="consent-switch">' +
              '<span class="consent-switch__label" data-consent-state aria-hidden="true">No</span>' +
              '<input type="checkbox" role="switch" data-consent-ga aria-labelledby="consent-ga-name" aria-describedby="consent-ga-desc">' +
              '<span class="consent-switch__track" aria-hidden="true"></span>' +
            '</label>' +
            '<p class="consent-row__desc" id="consent-ga-desc">Google Analytics 4: cuántas visitas hay y qué páginas se ven, para mejorar la web. Usa las cookies <code>_ga</code> y <code>_ga_*</code>, de Google. Solo si la activas.</p>' +
          '</li>' +
        '</ul>' +
        '<div class="consent-panel__actions">' +
          '<button class="consent__btn" type="button" data-consent="save">Guardar selección</button>' +
          '<button class="consent__btn" type="button" data-consent="accept">Aceptar todo</button>' +
          '<button class="consent__btn" type="button" data-consent="reject">Rechazar todo</button>' +
        '</div>' +
      '</div>';
    var sw = d.querySelector('[data-consent-ga]');
    var state = d.querySelector('[data-consent-state]');
    sw.addEventListener('change', function () { state.textContent = sw.checked ? 'Sí' : 'No'; });
    d.addEventListener('click', function (e) {
      if (e.target === d) { closePanel(false); return; } // clic fuera (en el fondo): cerrar sin guardar
      var b = e.target.closest('[data-consent]');
      if (!b) return;
      var a = b.getAttribute('data-consent');
      if (a === 'save') choose(sw.checked);
      else if (a === 'accept') choose(true);
      else if (a === 'reject') choose(false);
      else if (a === 'close') closePanel(false);
    });
    // Escape: cerrar sin guardar (si aún no había elegido, vuelve a la primera capa: sigue todo denegado)
    d.addEventListener('cancel', function (e) { e.preventDefault(); closePanel(false); });
    // Tab atrapado dentro del panel
    d.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = [].filter.call(d.querySelectorAll('button, a[href], input'), function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0];
      var last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.body.appendChild(d);
    return d;
  }

  function lenis(on) {
    var l = window.disco && window.disco.lenis;
    if (l && typeof l.stop === 'function') { if (on) l.start(); else l.stop(); }
  }

  function openPanel(from) {
    panel = panel || buildPanel();
    if (panel.open) return;
    opener = from || document.activeElement;
    var c = read();
    var sw = panel.querySelector('[data-consent-ga]');
    sw.checked = !!(c && c.analytics); // nada preseleccionado: solo lo que ya eligió
    panel.querySelector('[data-consent-state]').textContent = sw.checked ? 'Sí' : 'No';
    lenis(false);
    if (typeof panel.showModal === 'function') panel.showModal(); else panel.setAttribute('open', '');
    var first = panel.querySelector('.consent__btn');
    if (first) first.focus({ preventScroll: true });
  }

  function closePanel(decided) {
    if (!panel || !panel.open) return;
    if (typeof panel.close === 'function') panel.close(); else panel.removeAttribute('open');
    lenis(true);
    var back = opener;
    opener = null;
    // sin elegir y con el aviso aún fuera: el foco vuelve a "Configurar"
    if (!decided && banner && !banner.hidden) back = banner.querySelector('.consent__more');
    if (back && document.contains(back) && !back.closest('[hidden]')) back.focus({ preventScroll: true });
  }

  // ---------- enlaces permanentes: "Configurar cookies" ----------
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-consent-open]');
    if (!t) return;
    e.preventDefault();
    openPanel(t);
  });

  // ---------- cuándo sale ----------
  function schedule() {
    if (read()) return;
    var home = !!document.getElementById('intro-loader') || !!document.getElementById('hero-main');
    if (!home) { setTimeout(showBanner, DELAY); return; }
    // en la home: después de la intro (nunca encima del titular mientras entra)
    var fired = false;
    var go = function () { if (fired) return; fired = true; setTimeout(showBanner, DELAY); };
    window.addEventListener('disco:intro-done', go, { once: true });
    setTimeout(go, INTRO_MAX);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();

  // para depurar en consola: discoConsent.open(), .reset()
  window.discoConsent = {
    open: function () { openPanel(null); },
    reset: function () { try { localStorage.removeItem(KEY); } catch (e) { /* nada */ } }
  };
})();
