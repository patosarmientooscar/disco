// Datos del titular de la web (BF), en UN sitio: node tools/legal.mjs
// Cuando disco mande sus datos: cambia `legal` aquí abajo (y `fecha`, la de ese día), ejecuta `node tools/legal.mjs`,
// después `node tools/version.mjs` (que también lo llama, por si se olvida), commit y push.
//
// Lo escribe en el HTML estático (lo que lee Google) de:
//   · aviso-legal.html → <!-- legal:titular --> … <!-- /legal:titular -->: la lista de datos del titular (art. 10 LSSI-CE);
//   · privacidad.html  → <!-- legal:responsable --> … <!-- /legal:responsable -->: el responsable del tratamiento;
//   · aviso-legal, privacidad y cookies → <span data-legal="fecha">: "Última actualización";
//   · contacto.html (y cualquier página) → <span data-legal="titular">: el titular en la información básica del formulario.
// Un valor que siga siendo un hueco ("[TITULAR]"…) sale con data-draft (para buscarlo; sin estilo, css/placeholder.css).
// registro vacío ('') = autónomos, no una sociedad: la línea "Datos registrales" no se pinta.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const legal = {
  titular: '[TITULAR]',      // nombre y apellidos (autónomo) o razón social (sociedad)
  nif: '[NIF]',
  domicilio: '[DOMICILIO]',  // dirección completa, con código postal y ciudad
  registro: '[REGISTRO]',    // sociedad: "Registro Mercantil de Madrid, tomo …, folio …, hoja M-…"; autónomos: ''
  fecha: '2026-11-14',       // "Última actualización" de aviso legal, privacidad y cookies (AAAA-MM-DD)
};
const EMAIL = 'equipo@discoproduccion.com';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isGap = (v) => /^\[[^\]]+\]$/.test(String(v).trim());
const value = (key, v) => `<span data-legal="${key}"${isGap(v) ? ' data-draft' : ''}>${esc(v)}</span>`;
const fechaLarga = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
};

// las listas (mismo marcado que el resto de las legales: <ul> con <strong>Etiqueta:</strong>)
function list(rows, indent) {
  const li = rows.map(([k, label, html]) => `${indent}  <li><strong>${label}:</strong> ${html}</li>`).join('\n');
  return `${indent}<ul>\n${li}\n${indent}</ul>`;
}
const mail = `<a href="mailto:${EMAIL}">${EMAIL}</a>`;
function titularRows() {
  const rows = [
    ['titular', 'Titular', value('titular', legal.titular)],
    ['nif', 'NIF', value('nif', legal.nif)],
    ['domicilio', 'Domicilio', value('domicilio', legal.domicilio)],
    ['email', 'Email', mail],
  ];
  if (String(legal.registro).trim()) rows.push(['registro', 'Datos registrales', value('registro', legal.registro)]);
  return rows;
}
function responsableRows() {
  return [
    ['titular', 'Responsable', value('titular', legal.titular)],
    ['nif', 'NIF', value('nif', legal.nif)],
    ['domicilio', 'Domicilio', value('domicilio', legal.domicilio)],
    ['email', 'Email', mail],
  ];
}

// <!-- legal:NAME --> … <!-- /legal:NAME -->: se rehace entero, con la sangría del comentario de apertura
function putBlock(html, name, rows) {
  const re = new RegExp(`([ \\t]*)<!-- legal:${name} -->\\r?\\n[\\s\\S]*?<!-- \\/legal:${name} -->`);
  const m = html.match(re);
  if (!m) return html;
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  const ind = m[1];
  const body = `${ind}<!-- legal:${name} -->\n${list(rows, ind)}\n${ind}<!-- /legal:${name} -->`.replace(/\n/g, eol);
  return html.replace(re, body);
}

export function applyLegal({ quiet = false } = {}) {
  const changed = [];
  for (const page of readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort()) {
    const file = join(ROOT, page);
    const html = readFileSync(file, 'utf8');
    let out = putBlock(html, 'titular', titularRows());
    out = putBlock(out, 'responsable', responsableRows());
    // sueltos: <span data-legal="titular|nif|domicilio|registro"> y la fecha
    out = out.replace(/<span data-legal="(titular|nif|domicilio|registro)"(?: data-draft)?>[^<]*<\/span>/g, (_, k) => value(k, legal[k]));
    out = out.replace(/<span data-legal="fecha">[^<]*<\/span>/g, `<span data-legal="fecha">${fechaLarga(legal.fecha)}</span>`);
    if (out !== html) { writeFileSync(file, out); changed.push(page); }
  }
  if (!quiet) console.log(changed.length ? `datos legales: ${changed.join(', ')}` : 'datos legales: sin cambios');
  return changed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) applyLegal();
