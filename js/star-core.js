import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { gpuOK } from './gpu.js';

// Núcleo del destello 3D de plata, común a la home (js/star.js) y a las páginas interiores (js/hero-star.js,
// js/page-star.js): el modelo con sus materiales, el estudio de softboxes de los reflejos, el fundido de dos
// mapas de reflejos y la deriva orgánica. Render y entorno: copia del visor aprobado por Oscar.
export const MODEL = 'assets/3d/disco-star.glb';
export const MODEL_HEIGHT = 2.84;          // unidades del modelo (ancho 2.0, grosor 0.50); v1–v3 en legacy/assets/3d/
export const ENV_INTENSITY = 1.15;         // brillo de los reflejos (el visor usaba 1.4; Oscar lo quiere un poco menos brillante)
export const FOV = 28;
export const CAMERA_Z = 7.6;               // en vertical: max(7.6, 5.2 / aspect)
// deriva orgánica: 3 senos lentos de ~7, 11 y 17 s; ±0.035 de pantalla y ±0.06 rad de balanceo
export const DRIFT = { amp: 0.035, rot: 0.06, periods: [7, 11, 17] };
// prueba: el lateral con la misma textura que las caras (false = lateral liso, como viene en el GLB)
const SIDE_TEXTURE = true;

// El modelo: los materiales vienen configurados en el GLB (color, rugosidad y texturas); se convierten a
// MeshPhysicalMaterial para añadir el clearcoat del visor aprobado: face (pulido circular + destellos), side (lisa),
// engrave (oscura y mate: el grabado) y mark (la estrellita)
export function loadModel(renderer) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return loader.loadAsync(MODEL).then((gltf) => {
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const old = o.material;
      const { normalMap, roughnessMap } = old;
      [normalMap, roughnessMap].forEach((t) => { if (t) { t.anisotropy = maxAniso; t.needsUpdate = true; } });
      if (normalMap) normalMap.colorSpace = THREE.NoColorSpace;
      const engrave = old.name === 'disco-star-engrave';
      o.material = new THREE.MeshPhysicalMaterial({
        name: old.name,
        color: old.color.clone(),
        roughness: old.roughness,
        roughnessMap,
        normalMap,
        normalScale: old.normalScale.clone(),
        metalness: 1,
        envMapIntensity: ENV_INTENSITY,
        clearcoat: engrave ? 0 : 1,
        clearcoatRoughness: 0.03,
      });
      old.dispose();
    });
    if (SIDE_TEXTURE) texturizeSide(gltf.scene);
    return gltf;
  });
}

// Shaders listos antes de dibujar: en paralelo (KHR_parallel_shader_compile, sin congelar la página) si el
// navegador lo tiene; si no, como siempre
export function compileScene(renderer, scene, camera) {
  if (renderer.extensions.has('KHR_parallel_shader_compile')) return renderer.compileAsync(scene, camera);
  renderer.compile(scene, camera);
  return Promise.resolve();
}

// Páginas interiores: el GLB se carga una vez y lo comparten el hero y el recorrido. Cada uno recibe su copia
// (misma geometría y texturas; materiales propios, porque cada uno ajusta su brillo)
let shared = null;
export function sharedModel(renderer) {
  shared ||= loadModel(renderer);
  return shared.then((gltf) => {
    const copy = gltf.scene.clone(true);
    copy.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); });
    return copy;
  });
}

// Páginas interiores: UN solo renderer por página. El destello del hero (js/hero-star.js) y el del recorrido
// (js/page-star.js) pintan en el mismo canvas fijo a pantalla completa (.ps-canvas, css/page-hero.css), con la misma
// cámara y cada uno su escena; nunca a la vez. draw() apunta quién pintó lo último (también en el canvas:
// data-star = hero | page, para las pruebas); blank() solo borra lo suyo.
// Sin WebGL: null (el hero sigue con su vídeo y en el footer cae la estrella del logo).
// CALIDAD ADAPTATIVA: measure(dt) cuenta los fotogramas dibujados; cada 2 s, si van por debajo de 50 fps, baja un
// escalón, en este orden: DPR a 1 → sin la estela del hero → sin los reflejos vivos del vídeo (gl.quality).
const GL_DPR = { desk: 1.75, mob: 1.25 };
const QUALITY = { window: 2, min: 50 };
let gl;
export function sharedGL() {
  if (gl !== undefined) return gl;
  if (!gpuOK()) { gl = null; return gl; } // sin GPU de verdad (js/gpu.js): como sin WebGL
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    gl = null;
    return gl;
  }
  const mobile = () => matchMedia('(max-width: 767px)').matches;
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = 'ps-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  const view = { halfW: 1, halfH: 1, w: 1, h: 1, mobile: false };
  const subs = [];
  const quality = { dpr: true, trail: true, live: true, step: 0 };
  const resize = () => {
    const w = innerWidth;
    const h = innerHeight;
    camera.aspect = w / h;
    camera.position.set(0, 0, w >= h ? CAMERA_Z : Math.max(CAMERA_Z, (5.2 * h) / w));
    camera.updateProjectionMatrix();
    view.mobile = mobile();
    renderer.setPixelRatio(quality.dpr ? Math.min(devicePixelRatio, view.mobile ? GL_DPR.mob : GL_DPR.desk) : 1);
    renderer.setSize(w, h);
    view.halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    view.halfW = view.halfH * camera.aspect;
    view.w = w;
    view.h = h;
    subs.forEach((f) => f());
  };
  resize();
  window.addEventListener('resize', resize);
  // al salir de verdad se libera la GPU; si la página se queda en la caché de atrás/adelante (bfcache), no: al
  // volver sigue igual
  window.addEventListener('pagehide', (e) => { if (!e.persisted) renderer.dispose(); });
  let owner = null;
  const fps = { t: 0, n: 0 };
  const lower = () => {
    quality.step++;
    if (quality.step === 1) { quality.dpr = false; renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); }
    else if (quality.step === 2) quality.trail = false;
    else if (quality.step === 3) quality.live = false;
  };
  gl = {
    renderer,
    canvas,
    camera,
    view,
    onResize(fn) { subs.push(fn); },
    draw(scene, who) { renderer.render(scene, camera); if (owner !== who) canvas.dataset.star = who; owner = who; },
    blank(who) { if (owner === who) { renderer.clear(); owner = null; canvas.dataset.star = ''; } },
    get owner() { return owner; },
    quality,
    // tras cada dibujo (el tiempo real del fotograma, en s): ventanas de 2 s mientras queden escalones
    measure(dt) {
      if (quality.step >= 3 || document.hidden) return;
      fps.t += dt;
      fps.n++;
      if (fps.t < QUALITY.window) return;
      if (fps.n / fps.t < QUALITY.min) lower();
      fps.t = 0;
      fps.n = 0;
    },
  };
  return gl;
}

// Estudio oscuro con softboxes (lo que hace que parezca plata pulida). La escena sola (para añadirle cosas, como
// el vídeo del hero) o ya convertida en mapa de entorno (studio)
export function softboxScene() {
  const env = new THREE.Scene();
  const disposables = [];
  const add = (geometry, material) => {
    disposables.push(geometry, material);
    const mesh = new THREE.Mesh(geometry, material);
    env.add(mesh);
    return mesh;
  };
  add(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0b0b0d, side: THREE.BackSide }));
  const panel = (w, h, [x, y, z], color, intensity) => {
    const m = add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
  };
  panel(10, 3, [0, 9, 2], 0xffffff, 6);      // softbox superior
  panel(2, 12, [-9, 0, 3], 0xffffff, 4);     // tira izquierda
  panel(2, 12, [9, 1, -2], 0xf2f4ff, 3.5);   // tira derecha fría
  panel(8, 2, [0, -8, 4], 0xffffff, 1.2);    // rebote del suelo
  panel(6, 6, [0, 2, -10], 0xff3a1a, 1.6);   // rebote rojo por detrás (casa con la foto del hero)
  panel(3, 3, [6, -3, 8], 0xffffff, 2.5);    // kicker para los brillos
  panel(16, 7, [-3, 4, 13], 0xffffff, 1.1);  // panel frontal grande (detrás de la cámara): sin él las caras planas se ven negras de frente
  return { scene: env, add, dispose: () => disposables.forEach((d) => d.dispose()) };
}
export function studio(renderer) {
  const env = softboxScene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(env.scene, 0.02).texture;
  pmrem.dispose();
  env.dispose();
  return texture;
}

// Fundido de dos mapas de reflejos (PMREM, mismo tamaño): el de la escena (envMap) y el del estudio (envMap2,
// con su giro envRot2), mezclados con envMix en la irradiancia y en la radiancia (también la del clearcoat)
export function mixEnv(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const chunk = THREE.ShaderChunk.envmap_physical_pars_fragment
      .replace('#ifdef USE_ENVMAP', `#ifdef USE_ENVMAP
	uniform sampler2D envMap2;
	uniform float envMix;
	uniform mat3 envRot2;
	vec4 mixEnv( const in vec3 dir, const in float roughness ) {
		vec4 a = textureCubeUV( envMap, envMapRotation * dir, roughness );
		return envMix > 0.0 ? mix( a, textureCubeUV( envMap2, envRot2 * dir, roughness ), envMix ) : a;
	}`)
      .replace('textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 )', 'mixEnv( worldNormal, 1.0 )')
      .replace('textureCubeUV( envMap, envMapRotation * reflectVec, roughness )', 'mixEnv( reflectVec, roughness )');
    shader.fragmentShader = shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>', chunk);
  };
  material.customProgramCacheKey = () => 'disco-star-envmix';
}

// Deriva orgánica: 3 senos lentos en x e y (periodos ~7, 11 y 17 s) y balanceo; amplitud total ±DRIFT
export function drift(t) {
  const [a, b, c] = DRIFT.periods.map((T) => (t * Math.PI * 2) / T);
  return {
    x: (Math.sin(a) * 0.5 + Math.sin(b + 1.3) * 0.3 + Math.sin(c + 2.1) * 0.2) * DRIFT.amp,
    y: (Math.sin(b + 0.7) * 0.5 + Math.sin(a + 2.4) * 0.3 + Math.sin(c + 4.0) * 0.2) * DRIFT.amp,
    r: (Math.sin(c + 0.5) * 0.6 + Math.sin(a * 0.9 + 1.1) * 0.4) * DRIFT.rot,
  };
}

// El lateral no trae coordenadas de textura: se le generan con una proyección plana según hacia
// dónde mira cada vértice (lateral "en X" → (z, y); "en Y" → (x, z)), con la misma densidad que la
// cara, y recibe el material de la cara (normalMap + roughnessMap) con el color del lateral.
function texturizeSide(root) {
  let face = null;
  let side = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.name === 'disco-star-face') face = o;
    if (o.material.name === 'disco-star-side') side = o;
  });
  if (!face || !side || !face.geometry.attributes.uv) return;

  // densidad de la cara: unidades de uv por unidad de modelo (en x)
  const fp = face.geometry.attributes.position;
  const fuv = face.geometry.attributes.uv;
  let minX = Infinity, maxX = -Infinity, minU = Infinity, maxU = -Infinity;
  for (let i = 0; i < fp.count; i++) {
    minX = Math.min(minX, fp.getX(i)); maxX = Math.max(maxX, fp.getX(i));
    minU = Math.min(minU, fuv.getX(i)); maxU = Math.max(maxU, fuv.getX(i));
  }
  const density = (maxU - minU) / (maxX - minX || 1);

  const pos = side.geometry.attributes.position;
  const nrm = side.geometry.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const alongX = Math.abs(nrm.getX(i)) > Math.abs(nrm.getY(i));
    uv[i * 2] = 0.5 + (alongX ? z + y * 0.37 : x) * density;     // 0.37: desfase para que las dos proyecciones no repitan el mismo trozo
    uv[i * 2 + 1] = 0.5 + (alongX ? y : z + x * 0.37) * density;
  }
  side.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  const m = face.material.clone();
  m.name = 'disco-star-side';
  m.color.copy(side.material.color);
  side.material.dispose();
  side.material = m;
}
