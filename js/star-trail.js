import * as THREE from 'three';

// LA FUGAZ (AR-A): la estela naranja que sigue al destello, común a la home (js/star.js), al hero de las páginas
// interiores (js/hero-star.js) y a su recorrido (js/page-star.js). Copias del destello (misma geometría) con un
// naranja aditivo, cada una en una pose PASADA del destello (posición, giro y ESCALA: si el destello crece o encoge,
// la fugaz va con su tamaño). Siempre que el destello se ve:
//   · en reposo, corta y tenue (REST.n copias, alpha REST.alpha, que respira muy despacio);
//   · en movimiento se alarga y se intensifica con la velocidad en pantalla (y con el giro: también al arrastrarlo),
//     hasta n copias y alpha MOVE.alpha; al frenar se recoge con suavidad (lerp por tiempo, nunca de golpe).
// Las copias van un pelo por detrás del destello (en z): donde se solapan, lo tapa él; solo asoma lo que se ha
// quedado atrás. Calidad: setMax(3) en vez de quitarla. Movimiento reducido: no se crea (lo deciden los módulos).
const REST = { n: 3, alpha: 0.12, breath: 0.02, period: 7 };   // en reposo (respira ±0.02 en ~7 s)
const MOVE = { alpha: 0.35, v0: 0.04, v1: 0.9, spin: 0.12 };    // velocidad (alto de pantalla / s) de 0 a lleno
const LAG = { rest: 0.11, move: 0.075 };                         // s entre copia y copia
const K = { up: 6, down: 2.2, gain: 3 };                         // 1/s: se enciende rápido, se recoge despacio
const BACK = 0.035;                                              // unidades de mundo por copia, hacia atrás
const KEEP = 1.2;
const GROW_MAX = 1.12;                                           // una copia, como mucho un 12 % mayor que el destello                                                // s de historial

export function createTrail({ scene, model, n = 8, color = 0xF35411 }) {
  const ghosts = [];
  for (let i = 0; i < n; i++) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const g = model.clone(true);
    g.traverse((o) => { if (o.isMesh) o.material = mat; });
    const holder = new THREE.Group();
    holder.add(g);
    holder.visible = false;
    holder.renderOrder = -1 - i;
    scene.add(holder);
    ghosts.push({ holder, mat });
  }
  const hist = [];            // { t, x, y, z, rx, ry, rz, s } (lo más nuevo, primero)
  let max = n;
  let level = 0;              // 0 reposo … 1 movimiento lleno (suavizado)
  let gain = 0;               // brillo general (apagado en el footer, al aparecer…)
  let last = null;            // la pose anterior y su tiempo (para la velocidad)
  let fresh = true;
  const lerpAt = (t) => {
    // la pose del destello en el instante t (interpolada entre dos muestras)
    for (let i = 0; i < hist.length - 1; i++) {
      const a = hist[i];
      const b = hist[i + 1];
      if (t <= a.t && t >= b.t) {
        const f = (a.t - t) / Math.max(1e-6, a.t - b.t);
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, rx: a.rx + (b.rx - a.rx) * f, ry: a.ry + (b.ry - a.ry) * f, rz: a.rz + (b.rz - a.rz) * f, s: a.s + (b.s - a.s) * f };
      }
    }
    return hist[hist.length - 1];
  };
  const hide = () => { ghosts.forEach((g) => { g.holder.visible = false; }); };

  return {
    // time: s (el del ticker); src: el Group del destello (su pose de este fotograma); halfH: medio alto de la
    // pantalla en unidades de mundo. opts.on: se ve el destello; opts.gain: 0–1 (se apaga con él: footer, fundidos);
    // opts.gather: 0–1, las copias se juntan con el destello (relevo hero → recorrido)
    update(time, src, halfH, { on = true, gain: g = 1, gather = 0 } = {}) {
      if (!on || !src.visible) { hide(); fresh = true; last = null; gain = 0; return; }
      const p = src.position;
      const r = src.rotation;
      const s = src.scale.x;
      // salto de pose (aparece en otro sitio, relevo, resize): historial de cero, sin una copia cruzando la pantalla
      // (o un giro que salta una vuelta entera: se ve igual, pero las copias darían la vuelta)
      if (last && (Math.hypot(p.x - last.x, p.y - last.y) > halfH * 0.9 || time - last.t > 0.5
        || Math.abs(r.x - last.rx) > Math.PI || Math.abs(r.y - last.ry) > Math.PI || Math.abs(r.z - last.rz) > Math.PI)) fresh = true;
      if (fresh) { hist.length = 0; fresh = false; last = null; }
      const dt = last ? Math.max(1e-3, time - last.t) : 1 / 60;
      // velocidad en pantalla (alto de pantalla por segundo) y del giro (rad/s, también el de arrastrarlo)
      let v = 0;
      if (last) {
        const move = Math.hypot(p.x - last.x, p.y - last.y) / (2 * halfH) / dt;
        const grow = Math.abs(s - last.s) / Math.max(1e-4, s) / dt * 0.25;
        const spin = (Math.abs(r.x - last.rx) + Math.abs(r.y - last.ry) + Math.abs(r.z - last.rz)) / dt * MOVE.spin;
        v = move + grow + spin;
      }
      last = { t: time, x: p.x, y: p.y, s, rx: r.x, ry: r.y, rz: r.z };
      const want = THREE.MathUtils.smoothstep(v, MOVE.v0, MOVE.v1);
      level += (want - level) * (1 - Math.exp(-(want > level ? K.up : K.down) * dt));
      gain += (g - gain) * (1 - Math.exp(-K.gain * dt));
      hist.unshift({ t: time, x: p.x, y: p.y, z: p.z, rx: r.x, ry: r.y, rz: r.z, s });
      while (hist.length > 2 && time - hist[hist.length - 1].t > KEEP) hist.pop();

      // cuántas copias (fraccionario: la última entra con su opacidad), separación y brillo
      const count = Math.min(max, REST.n + (n - REST.n) * level);
      const lag = LAG.rest + (LAG.move - LAG.rest) * level;
      const breath = 1 + (REST.breath / REST.alpha) * Math.sin((time * Math.PI * 2) / REST.period);
      const alpha = (REST.alpha * breath + (MOVE.alpha - REST.alpha) * level) * gain * (1 - gather);
      const oldest = hist[hist.length - 1].t;
      ghosts.forEach((gh, i) => {
        const w = THREE.MathUtils.clamp(count - i, 0, 1);
        const t = time - lag * (i + 1);
        const o = alpha * (1 - i / Math.max(1, count + 0.5)) * w;
        if (o < 0.004 || t < oldest - 1e-3 || hist.length < 2) { gh.holder.visible = false; return; }
        const h = lerpAt(t);
        const m = (a, b) => a + (b - a) * gather;
        gh.holder.visible = true;
        gh.mat.opacity = o;
        gh.holder.position.set(m(h.x, p.x), m(h.y, p.y), m(h.z, p.z) - BACK * (i + 1) * (1 - gather));
        // (su tamaño de entonces, pero nunca mucho mayor que el de ahora: sin copias gigantes detrás de un destello
        // que encoge)
        gh.holder.scale.setScalar(Math.max(0.0001, m(Math.min(h.s, s * GROW_MAX), s)));
        gh.holder.rotation.set(m(h.rx, r.x), m(h.ry, r.y), m(h.rz, r.z));
      });
    },
    hide() { hide(); fresh = true; last = null; gain = 0; },
    // la calidad adaptativa baja copias (de 8 a 3), nunca la quita
    setMax(k) { max = Math.max(1, Math.min(n, k)); },
    get visible() { return ghosts.some((g) => g.holder.visible); },
    dispose() { ghosts.forEach((g) => g.mat.dispose()); },
  };
}
