// ¿Merece la pena el 3D? Lo usan todos los WebGL de la web (el destello, los fluidos de los heroes, el degradado de
// "Dale al REC.", el estudio).
//   gpuOK(): WebGL con failIfMajorPerformanceCaveat. Sin aceleración por hardware (render por software, como
//     SwiftShader) el contexto no se crea: cada fotograma costaría decenas de ms de CPU y la página iría a tirones.
//     Entonces no se monta nada 3D y la web enseña sus versiones sin WebGL (fotos, la estrella 2D, el logo del
//     footer). Para probar el 3D en un navegador sin GPU: localStorage.disco_gl = 'force'.
//   lowEnd(): móvil de gama baja (deviceMemory ≤ 4 o hardwareConcurrency ≤ 4): sin el fluido del hero de la home.
//   afterLoad(): después del load de la página, a la primera interacción (ratón, dedo, rueda, tecla, scroll) o a los
//     2 s sin tocar nada: el 3D no compite con el primer pintado, el LCP ni la primera respuesta.
let ok;
export function gpuOK() {
  if (ok !== undefined) return ok;
  try { if (localStorage.getItem('disco_gl') === 'force') return (ok = true); } catch { /* sin almacenamiento */ }
  try {
    const c = document.createElement('canvas');
    const opts = { failIfMajorPerformanceCaveat: true };
    const gl = c.getContext('webgl2', opts) || c.getContext('webgl', opts);
    ok = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    ok = false;
  }
  return ok;
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
