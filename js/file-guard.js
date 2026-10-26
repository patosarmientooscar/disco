// Doble clic en un .html (file://): Chrome bloquea los módulos JS desde file://, así que la web no arranca.
// Script clásico (sí se carga desde file://): si el servidor local está encendido, salta a la misma página en
// http://localhost:5173; si no, en vez de una web rota enseña cómo encenderlo y salta sola en cuanto lo está.
(function () {
  if (location.protocol !== 'file:') return;
  var ORIGIN = 'http://localhost:5173/';
  var page = location.pathname.split('/').pop() || 'index.html';
  var target = ORIGIN + page + location.search + location.hash;
  var shown = false;

  document.documentElement.style.background = '#0b0909';
  document.documentElement.style.visibility = 'hidden';

  // ¿está encendido? Una imagen del propio servidor (sin CORS): carga → arriba; error → apagado
  function probe() {
    var img = new Image();
    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; down(); } }, 1500);
    img.onload = function () { if (done) return; done = true; clearTimeout(timer); location.replace(target); };
    img.onerror = function () { if (done) return; done = true; clearTimeout(timer); down(); };
    img.src = ORIGIN + 'assets/brand/favicon-32.png?t=' + Date.now();
  }

  function down() {
    if (!shown) {
      shown = true;
      if (document.body) render(); else document.addEventListener('DOMContentLoaded', render);
    }
    setTimeout(probe, 2000); // en cuanto se encienda, salta sola
  }

  function render() {
    var box = document.createElement('div');
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;background:#0b0909;color:#f4f2ef;visibility:visible;font-family:system-ui,sans-serif;';
    box.innerHTML =
      '<div style="max-width:520px">' +
        '<p style="margin:0 0 18px;font:500 12px/1 monospace;letter-spacing:.14em;color:#F35411">DISCO · SERVIDOR LOCAL APAGADO</p>' +
        '<h1 style="margin:0;font:600 34px/1.15 system-ui,sans-serif;letter-spacing:-.02em">Esta web se abre con su servidor local.</h1>' +
        '<p style="margin:18px 0 0;font:400 17px/1.55 system-ui,sans-serif;color:rgba(244,242,239,.82)">Haz doble clic en <b style="color:#f4f2ef">abrir-web.bat</b>, en esta misma carpeta. Si ya está encendido, esta página salta sola a <span style="font-family:monospace">localhost:5173</span>.</p>' +
        '<p style="margin:26px 0 0;font:400 12px/1.5 monospace;letter-spacing:.06em;color:rgba(244,242,239,.6)">Comprobando cada 2 s…</p>' +
      '</div>';
    document.body.appendChild(box);
  }

  probe();
})();
