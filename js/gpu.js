// ¿Merece la pena el 3D? Lo usan todos los WebGL de la web (el destello, los fluidos de los heroes, el degradado de
// "Dale al REC.", el estudio).
//   gpuOK(): WebGL con failIfMajorPerformanceCaveat. Sin aceleración por hardware (render por software, como
//     SwiftShader) el contexto no se crea: cada fotograma costaría decenas de ms de CPU y la página iría a tirones.
//     Entonces no se monta nada 3D y la web enseña sus versiones sin WebGL (fotos, la estrella 2D, el logo del
//     footer). Para probar el 3D en un navegador sin GPU: localStorage.disco_gl = 'force'; para probar la web sin
//     él: localStorage.disco_gl = 'off'.
//   webglOK(): criterio suave para lo ligero (la aurora de nosotros): basta con WebGL que no sea render por software
//     puro (SwiftShader, llvmpipe, "Basic Render Driver"…). Cualquier gráfica integrada vale.
//   Con ?debug en la URL, la consola dice el renderer de WebGL, gpuOK(), webglOK() y el motivo.
//   lowEnd(): móvil de gama baja (deviceMemory ≤ 4 o hardwareConcurrency ≤ 4): sin el fluido del hero de la home.
//   afterLoad(): después del load de la página, a la primera interacción (ratón, dedo, rueda, tecla, scroll) o a los
//     2 s sin tocar nada: el 3D no compite con el primer pintado, el LCP ni la primera respuesta.
const SOFTWARE = /swiftshader|llvmpipe|softpipe|basic render|microsoft basic|software/i;
const debug = /[?&]debug(?:[=&]|$)/.test(location.search);
const pref = () => { try { return localStorage.getItem('disco_gl'); } catch { return null; } };
// un contexto de prueba (con o sin failIfMajorPerformanceCaveat): ¿se crea? ¿qué renderer?
const probe = (strict) => {
  try {
    const c = document.createElement('canvas');
    const opts = strict ? { failIfMajorPerformanceCaveat: true } : {};
    const gl = c.getContext('webgl2', opts) || c.getContext('webgl', opts);
    if (!gl) return { gl: false, renderer: '' };
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { gl: true, renderer };
  } catch {
    return { gl: false, renderer: '' };
  }
};
const log = (what, ok, why, renderer) => { if (debug) console.info(`[disco] ${what}: ${ok} (${why}) · renderer: ${renderer || '—'}`); };

let ok;
export function gpuOK() {
  if (ok !== undefined) return ok;
  const p = pref();
  if (p === 'force') { log('gpuOK', (ok = true), 'forzado: disco_gl=force', ''); return ok; }
  if (p === 'off') { log('gpuOK', (ok = false), 'apagado: disco_gl=off', ''); return ok; }
  // failIfMajorPerformanceCaveat no siempre salta con el render por software: también se mira el renderer
  const t = probe(true);
  const software = t.gl && SOFTWARE.test(t.renderer);
  ok = t.gl && !software;
  log('gpuOK', ok, ok ? 'aceleración por hardware' : software ? 'render por software' : 'sin WebGL o rendimiento muy bajo (failIfMajorPerformanceCaveat)', t.renderer || probe(false).renderer);
  return ok;
}

let soft;
export function webglOK() {
  if (soft !== undefined) return soft;
  if (pref() === 'force') { log('webglOK', (soft = true), 'forzado: disco_gl=force', ''); return soft; }
  const t = probe(false);
  soft = t.gl && !SOFTWARE.test(t.renderer);
  log('webglOK', soft, !t.gl ? 'sin WebGL' : soft ? 'WebGL por hardware' : 'render por software', t.renderer);
  return soft;
}

export function lowEnd() {
  const mem = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  return (mem !== undefined && mem <= 4) || (cores !== undefined && cores <= 4);
}

let loaded = null;
export function afterLoad(idle = 2000) {
  loaded ||= new Promise((resolve) => {
    const EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
    const opts = { passive: true, capture: true };
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      EVENTS.forEach((e) => window.removeEventListener(e, go, opts));
      resolve();
    };
    const arm = () => { EVENTS.forEach((e) => window.addEventListener(e, go, opts)); setTimeout(go, idle); };
    if (document.readyState === 'complete') arm();
    else window.addEventListener('load', arm, { once: true });
    setTimeout(go, 6000); // por si el load no llega nunca (un vídeo que no termina de cargar…)
  });
  return loaded;
}
