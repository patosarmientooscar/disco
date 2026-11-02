// Niveles de calidad de todos los WebGL de la web (el destello, los fluidos, la aurora, el degradado de "Dale al REC.",
// el estudio). REGLA: optimizar nunca apaga un efecto aprobado; si va lento, baja su calidad.
//   gpuLevel(): 'high' | 'mid' | 'low' | 'none'. 'none' SOLO si no hay WebGL o el render es por software puro
//     (SwiftShader, llvmpipe, "Basic Render Driver"…: cada fotograma costaría decenas de ms de CPU). El resto decide
//     la calidad, nunca si se ve: gráfica integrada → 'mid'; failIfMajorPerformanceCaveat (Chrome avisa de que irá
//     justa) o equipo de gama baja (lowEnd) → 'low'; lo demás → 'high'.
//   gpuOK() y webglOK(): nivel distinto de 'none' (¿hay efecto? sí o no).
//   levelDpr(max): el DPR máximo de un canvas según el nivel (high: max; mid: hasta 1.5; low: 1).
//   Para probar: localStorage.disco_gl = 'force' (todo en 'high', aunque sea por software), 'low' (todo se ve, con
//     calidad baja, aunque sea por software), 'off' (sin WebGL: las versiones de reserva).
//   Con ?debug en la URL, la consola dice el renderer, el nivel y el motivo (dlog: para los demás módulos).
//   lowEnd(): móvil u ordenador de gama baja (deviceMemory ≤ 4 o hardwareConcurrency ≤ 4).
//   afterLoad(): después del load de la página, a la primera interacción (ratón, dedo, rueda, tecla, scroll) o a los
//     2 s sin tocar nada: el 3D no compite con el primer pintado, el LCP ni la primera respuesta.
const SOFTWARE = /swiftshader|llvmpipe|softpipe|basic render|microsoft basic|software/i;
const INTEGRATED = /intel|uhd|iris|radeon\(tm\) graphics|radeon graphics|vega \d|mali|adreno|powervr/i;
const debug = /[?&]debug(?:[=&]|$)/.test(location.search);
export const dlog = (...a) => { if (debug) console.info('[disco]', ...a); };
export const isDebug = () => debug;
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

let level;
const decide = () => {
  const p = pref();
  if (p === 'force') return ['high', 'forzado: disco_gl=force', ''];
  if (p === 'low') return ['low', 'forzado: disco_gl=low', ''];
  if (p === 'off') return ['none', 'apagado: disco_gl=off', ''];
  const t = probe(false);
  if (!t.gl) return ['none', 'sin WebGL', ''];
  if (SOFTWARE.test(t.renderer)) return ['none', 'render por software', t.renderer];
  if (!probe(true).gl) return ['low', 'Chrome avisa de rendimiento justo (failIfMajorPerformanceCaveat)', t.renderer];
  if (lowEnd()) return ['low', 'equipo de gama baja', t.renderer];
  if (INTEGRATED.test(t.renderer)) return ['mid', 'gráfica integrada', t.renderer];
  return ['high', 'gráfica dedicada', t.renderer];
};
export function gpuLevel() {
  if (level) return level;
  const [l, why, renderer] = decide();
  level = l;
  dlog(`nivel de GPU: ${l} (${why}) · renderer: ${renderer || '—'}`);
  return level;
}
export const gpuOK = () => gpuLevel() !== 'none';
export const webglOK = gpuOK;
export function levelDpr(max) {
  const l = gpuLevel();
  return l === 'low' ? Math.min(max, 1) : l === 'mid' ? Math.min(max, 1.5) : max;
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
