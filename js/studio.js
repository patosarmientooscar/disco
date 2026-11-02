import * as THREE from 'three';
import { createStudioUI } from './studio-ui.js';
import { CROSS, cross as crossState } from './studio-cross.js';
import { dlog, isDebug } from './gpu.js';

// Estudio de fotografía 360°: un panorama equirectangular en una esfera alrededor de la cámara, dibujado
// como fondo en el MISMO canvas y renderer que el destello 3D (star.setBackdrop), dentro del loop único.
// La sección (#estudio, 600vh) deja su interior fijo (sticky) y el scroll lleva la cámara por el estudio:
// del set naranja a cada puesto de trabajo (Luna = FOTO, cámara de cine = VÍDEO, monitores = EDICIÓN),
// parándose en cada uno, y una vuelta larga de vuelta al set. El destello (js/star.js) refleja el
// estudio (mismo giro en el entorno de reflejos). Encima, "¿Qué hacemos?" (js/studio-ui.js).
// Sin WebGL o con movimiento reducido: recorte fijo del set de fondo y todo el texto quieto.
const PANO = 'assets/studio/studio-360.jpg';               // 5792×2896
const PANO_MOBILE = 'assets/studio/studio-360-mobile.jpg'; // 3584×1792, < 400 KB (móvil y GPUs con límite de 4096; el de 4096, en legacy/assets/studio/)
const PANO_ENV = 'assets/studio/studio-360-env.jpg';       // 2048×1024: reflejos del destello
const SCRUB = 1.5;
const SMOOTH = 0.05;              // suavizado extra del giro (por frame a 60 fps, independiente del frame rate)
const PITCH = THREE.MathUtils.degToRad(3);
const FOV = 55;
const FOV_PORTRAIT = 70;
// entrada: la sección se solapa con la última pantalla de "Dale al REC." (css/studio.css); cuando empieza el pin
// (el naranja ya está completo) el estudio entra en un corte rápido por tiempo (0.45 s: opacidad, desenfoque 12 px
// → 0 y escala 1.04 → 1; js/studio-cross.js) y el degradado naranja (js/rec.js) se apaga a la vez
const ENV_INTENSITY = 1.4;        // brillo de los reflejos dentro del estudio
const ENV_SIZE = 1024;            // ancho del equirectangular de reflejos → PMREM de 256, como el de softboxes (fundido)
// Puestos del estudio: yaw (giro de la esfera, grados) que deja cada objeto en el centro de la pantalla y
// su latitud. Con esta esfera el yaw es directamente el ángulo de la imagen + 90° (el set, en el centro de
// la imagen, queda delante con 90°). Medidos en capturas de esta esfera (los del visor de Claude —188/6,
// 215/8, 205/−2— caían en el cuerpo de Luna, debajo de la cámara de cine y en la mesa).
const SET = 90;
const SPOTS = [
  { yaw: 180, lat: 16 },  // FOTO: la cámara de Luna
  { yaw: 216, lat: 14 },  // VÍDEO: la cámara de cine
  { yaw: 206, lat: 5 },   // EDICIÓN: los monitores
];
// en cada parada el objeto queda un poco a la derecha del centro: a la izquierda está el título de cinta
// (y los objetos están altos, a su altura); a la derecha, abajo, la claqueta
const ASIDE = -5;
const ASIDE_MOBILE = 0;    // en vertical el encuadre es estrecho: el objeto, centrado…
const LOOK_UP_MOBILE = THREE.MathUtils.degToRad(9); // …y la cámara mira algo hacia arriba: el objeto baja y deja sitio al destello
const DRIFT = 1.5;         // grados: en las paradas el estudio sigue moviéndose un poco con el scroll
const LOW_FPS = 40;               // móvil: por debajo de esto durante 2 s → dpr 1
const SEAM = 0.012;               // ancho (fracción de la imagen) de la mezcla en la costura del panorama

export function initStudio({ gsap, ScrollTrigger, reduced, loop, star }) {
  const section = document.getElementById('estudio');
  if (!section) return;
  const team = document.getElementById('equipo');
  // empieza a cargar cuando los cofundadores están a 1,5 pantallas (nunca en el loading inicial)
  const whenNear = (fn) => {
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      fn();
    }, { rootMargin: '150% 0px' });
    io.observe(team || section);
  };

  // --- sin WebGL o movimiento reducido: sin pin ni giro, el set naranja de fondo y el texto encima ---
  if (reduced.matches || !star) {
    section.classList.add('is-still', 'is-lit');
    createStudioUI({ gsap, section, still: true });
    // URL absoluta: en la variable CSS se resolvería desde css/
    whenNear(() => section.style.setProperty('--studio-still', `url("${new URL(PANO_MOBILE, location.href)}")`));
    return;
  }

  const { renderer } = star;
  const big = renderer.capabilities.maxTextureSize >= 8192 && innerWidth >= 1024;

  // --- esfera del panorama: su propia escena y cámara (fov 55 / 70), el destello va encima con la suya ---
  const panoScene = new THREE.Scene();
  const panoCam = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  panoCam.rotation.order = 'YXZ';
  // -1 en X: se ve desde dentro sin espejo; + media vuelta: así la esfera lee la imagen igual que el
  // entorno de reflejos de three (centro de la imagen en +X) y los dos giran con el mismo ángulo
  const geo = new THREE.SphereGeometry(50, 96, 48);
  geo.scale(-1, 1, 1);
  geo.rotateY(Math.PI);
  // (el panorama no se funde con el scroll: al final del pin se va con la sección, sin velo; ver draw)
  const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
  // fundido de la entrada (opacidad y desenfoque por sesgo de mipmap: barato y sin pasadas extra)
  const cross = { value: 1 };
  const blur = { value: 0 };
  // costura: los bordes izquierdo y derecho de la imagen no casan del todo (~10 niveles en el naranja,
  // más en el suelo). En una franja estrecha a cada lado se mezcla con el borde opuesto: en la costura
  // los dos lados dan el mismo color y no se ve la línea
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 texel = texture2D( map, vMapUv, uBlur );
        vec4 mirror = texture2D( map, vec2( 1.0 - vMapUv.x, vMapUv.y ), uBlur );
        float edge = min( vMapUv.x, 1.0 - vMapUv.x );
        diffuseColor *= mix( 0.5 * ( texel + mirror ), texel, smoothstep( 0.0, ${SEAM.toFixed(4)}, edge ) );
      #endif
      diffuseColor.a *= uCross;
    `);
    shader.uniforms.uCross = cross;
    shader.uniforms.uBlur = blur;
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', `uniform float uCross;
uniform float uBlur;
void main() {`);
  };
  mat.customProgramCacheKey = () => 'disco-studio-cross';
  const sphere = new THREE.Mesh(geo, mat);
  sphere.renderOrder = -1;
  sphere.visible = false;
  panoScene.add(sphere);
  // anclas de los puestos: hijas de la esfera (giran con el estudio). Dirección en la imagen: ángulo
  // (yaw − 90°) desde el centro, como lee la esfera la equirectangular (centro de la imagen en +X)
  const anchors = SPOTS.map(({ yaw, lat }) => {
    const a = new THREE.Object3D();
    const th = THREE.MathUtils.degToRad(yaw - SET);
    const ph = THREE.MathUtils.degToRad(lat);
    a.position.set(Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph)).multiplyScalar(40);
    sphere.add(a);
    return a;
  });
  const v = new THREE.Vector3();
  const ui = createStudioUI({ gsap, section, still: false });
  let portrait = false;

  const resize = () => {
    panoCam.aspect = innerWidth / innerHeight;
    panoCam.fov = panoCam.aspect >= 1 ? FOV : FOV_PORTRAIT;
    portrait = innerWidth < 768;
    panoCam.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  // --- texturas: carga diferida; fuera de alcance (2 pantallas) se liberan de la GPU y vuelven al acercarse ---
  const loader = new THREE.TextureLoader();
  let panoTex = null;
  let envSrc = null;
  let envTex = null;
  let pmrem = null;
  let resident = false;
  const buildEnv = () => {
    pmrem = pmrem || new THREE.PMREMGenerator(renderer);
    envTex = pmrem.fromEquirectangular(envSrc).texture;
    envSrc.dispose(); // el lienzo sigue en memoria para regenerarlo al volver
  };
  const load = () => {
    if (panoTex) return;
    loader.load(big ? PANO : PANO_MOBILE, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      t.wrapS = THREE.RepeatWrapping; // en la costura el filtrado mezcla con el otro borde, no con el mismo
      panoTex = t;
      mat.map = t;
      mat.needsUpdate = true;
      renderer.initTexture(t); // se sube a la GPU ya, no al aparecer
      resident = true;
    });
    loader.load(PANO_ENV, (t) => {
      // a ENV_SIZE × ENV_SIZE/2: su PMREM sale del mismo tamaño que el de softboxes y el destello puede fundirlos
      const c = document.createElement('canvas');
      c.width = ENV_SIZE;
      c.height = ENV_SIZE / 2;
      c.getContext('2d').drawImage(t.image, 0, 0, c.width, c.height);
      t.dispose();
      envSrc = new THREE.CanvasTexture(c);
      envSrc.mapping = THREE.EquirectangularReflectionMapping;
      envSrc.colorSpace = THREE.SRGBColorSpace;
      buildEnv();
    });
  };
  whenNear(load);
  new IntersectionObserver(([e]) => {
    if (!panoTex || !envSrc) return;
    if (!e.isIntersecting && resident) {
      resident = false;
      sphere.visible = false;
      panoTex.dispose();          // three la vuelve a subir sola desde la imagen la próxima vez que se dibuje
      star.setEnvMix(null);       // el destello deja de usarla antes de liberarla
      envTex?.dispose();
      envTex = null;
    } else if (e.isIntersecting && !resident) {
      resident = true;
      renderer.initTexture(panoTex);
      buildEnv();
    }
  }, { rootMargin: '200% 0px' }).observe(section);

  // --- progreso del pin (sticky en CSS): p 0 → 1 con scrub + suavizado extra ---
  const state = { p: 0 };
  let p = 0;
  let active = false;
  // se enciende el estudio (sin flash: aparece con el fundido) y el piloto de "Dale al REC." se queda fijo
  const light = () => {
    section.classList.add('is-lit');
    window.dispatchEvent(new CustomEvent('disco:studio-shot'));
  };
  const enter = (on) => { active = on; };
  gsap.to(state, {
    p: 1,
    ease: 'none',
    scrollTrigger: {
      id: 'studio',
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: SCRUB,
      invalidateOnRefresh: true,
      onToggle: (self) => enter(self.isActive),
    },
  });
  // se enciende cuando empieza el pin (el naranja de "Dale al REC." ya está completo)
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    onEnter: light,
    onLeaveBack: () => { section.classList.remove('is-lit'); window.dispatchEvent(new CustomEvent('disco:studio-dark')); },
    onRefresh: (self) => { if (self.progress > 0) section.classList.add('is-lit'); },
  });

  // --- móvil: si va justo (< 40 fps durante 2 s dentro del estudio), dpr 1 ---
  const touch = matchMedia('(pointer: coarse), (max-width: 767px)').matches;
  let slow = 0;
  let lowered = false;

  let top = 0;    // top de la sección en pantalla (px)
  let bottom = 0; // bottom: al acabar el pin la sección sube y el panorama se recorta con ella
  // el corte: entra (por tiempo) en cuanto está encendido y el panorama listo; al volver a subir, sale
  let crossTo = 0;
  let crossTw = null;
  const cut = (to) => {
    if (to === crossTo) return;
    crossTo = to;
    crossTw?.kill();
    crossTw = gsap.to(crossState, { v: to, duration: to ? CROSS.in : CROSS.out, ease: to ? 'power2.out' : 'power2.in' });
  };
  star.setBackdrop({
    update(ratio) {
      if (touch && active && !lowered) {
        slow = 60 / ratio < LOW_FPS ? slow + ratio / 60 : 0;
        if (slow > 2) { lowered = true; star.setDpr(1); }
      }

      const prev = p;
      p += (state.p - p) * (1 - Math.pow(1 - SMOOTH, ratio));
      if (Math.abs(state.p - p) < 1e-5) p = state.p;
      const sr = section.getBoundingClientRect();
      const prevB = bottom;
      top = sr.top;
      bottom = sr.bottom;
      cut(section.classList.contains('is-lit') && resident && panoTex ? 1 : 0);
      const e = crossState.v;
      const prevC = cross.value;
      cross.value = e;
      blur.value = (1 - e) * CROSS.blur;
      const zoom = CROSS.zoom - (CROSS.zoom - 1) * e;
      if (zoom !== panoCam.zoom) { panoCam.zoom = zoom; panoCam.updateProjectionMatrix(); }
      // reflejos del destello: los del estudio a medida que aparece; dentro del pin, del todo
      if (envTex) star.setEnvMix(envTex, active ? e : 0, ENV_INTENSITY);
      const lit = section.classList.contains('is-lit') && top < innerHeight && bottom > 0;
      const show = lit && resident && !!panoTex;
      // giro del estudio y dónde caen los puestos en pantalla (también sin textura: el AF va igual)
      const yaw = THREE.MathUtils.degToRad(yawAt(p, portrait ? ASIDE_MOBILE : ASIDE));
      sphere.rotation.y = yaw;
      panoCam.rotation.x = Math.sin(p * Math.PI * 2) * PITCH + (portrait ? LOOK_UP_MOBILE : 0);
      star.setEnvRotation(yaw);
      sphere.updateMatrixWorld(true);
      panoCam.updateMatrixWorld();
      ui.update(state.p, anchors.map((an) => {
        an.getWorldPosition(v).project(panoCam);
        if (v.z > 1) return null; // detrás de la cámara
        return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
      }));
      const changed = p !== prev || sphere.visible !== show || cross.value !== prevC || (bottom !== prevB && bottom < innerHeight);
      sphere.visible = show;
      if (isDebug()) layers(p);
      return changed;
    },
    draw(r) {
      if (!sphere.visible || cross.value === 0) return;
      // la sección ya se va hacia arriba: el panorama, solo en lo que queda de ella (debajo, la sección siguiente)
      const clip = bottom < innerHeight;
      if (clip) {
        r.setScissorTest(true);
        r.setScissor(0, innerHeight - bottom, innerWidth, bottom);
      }
      r.render(panoScene, panoCam);
      if (clip) r.setScissorTest(false);
    },
  });
}

// ?debug: al pasar por el 10, 50 y 90 % del pin, lista lo que hay encima del panorama: más del 40 % de la pantalla
// con opacidad entre 0.02 y 0.98, o cualquier backdrop-filter (js/gpu.js → dlog)
const seen = new Set();
function layers(p) {
  const at = [0.1, 0.5, 0.9].find((m) => p >= m && !seen.has(m));
  if (at === undefined) return;
  seen.add(at);
  const found = [];
  document.querySelectorAll('body *').forEach((e) => {
    const s = getComputedStyle(e);
    if (s.display === 'none' || s.visibility === 'hidden') return;
    const r = e.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    const area = (w * h) / (innerWidth * innerHeight);
    const name = `${e.tagName.toLowerCase()}.${String(e.className.baseVal ?? e.className).split(' ')[0]}`;
    if (w * h && s.backdropFilter && s.backdropFilter !== 'none') found.push(`${name} (backdrop, ${(area * 100).toFixed(1)} %)`);
    if (area > 0.4 && +s.opacity > 0.02 && +s.opacity < 0.98) found.push(`${name} (opacidad ${s.opacity})`);
  });
  dlog(`capas sobre el estudio al ${at * 100} %: ${found.join(' · ') || 'ninguna'}`);
}

// Recorrido de la cámara por el estudio (yaw en grados según p): set → Luna → cámara de cine → monitores
// → vuelta larga al set. En las paradas apenas se mueve (±DRIFT); entre ellas, paneos suaves.
function yawAt(p, aside) {
  const [foto, video, edit] = SPOTS.map((sp) => sp.yaw + aside);
  const keys = [
    [0, SET - DRIFT], [0.18, SET + DRIFT],
    [0.32, foto - DRIFT, 'pan'], [0.46, foto + DRIFT],
    [0.54, video - DRIFT, 'pan'], [0.68, video + DRIFT],
    [0.74, edit - DRIFT, 'pan'], [0.88, edit + DRIFT],
    [1, SET + 360, 'pan'],
  ];
  let i = 1;
  while (i < keys.length - 1 && p > keys[i][0]) i++;
  const [p0, y0] = keys[i - 1];
  const [p1, y1, kind] = keys[i];
  const t = THREE.MathUtils.clamp((p - p0) / (p1 - p0), 0, 1);
  const e = kind === 'pan' ? (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2) : t; // power2.inOut
  return y0 + (y1 - y0) * e;
}
