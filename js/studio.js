import * as THREE from 'three';
import { createStudioUI } from './studio-ui.js';

// Estudio de fotografía 360°: un panorama equirectangular en una esfera alrededor de la cámara, dibujado
// como fondo en el MISMO canvas y renderer que el destello 3D (star.setBackdrop), dentro del loop único.
// La sección (#estudio, 600vh) deja su interior fijo (sticky) y el scroll lleva la cámara por el estudio:
// del set naranja a cada puesto de trabajo (Luna = FOTO, cámara de cine = VÍDEO, monitores = EDICIÓN),
// parándose en cada uno, y una vuelta larga de vuelta al set. El destello (js/star.js) refleja el
// estudio (mismo giro en el entorno de reflejos). Encima, "¿Qué hacemos?" (js/studio-ui.js).
// Sin WebGL o con movimiento reducido: recorte fijo del set de fondo y todo el texto quieto.
const PANO = 'assets/studio/studio-360.jpg';               // 5792×2896
const PANO_MOBILE = 'assets/studio/studio-360-mobile.jpg'; // 4096×2048 (móvil y GPUs con límite de 4096)
const PANO_ENV = 'assets/studio/studio-360-env.jpg';       // 2048×1024: reflejos del destello
const SCRUB = 1.5;
const SMOOTH = 0.05;              // suavizado extra del giro (por frame a 60 fps, independiente del frame rate)
const PITCH = THREE.MathUtils.degToRad(3);
const FOV = 55;
const FOV_PORTRAIT = 70;
const FADE = 0.08;                // fundido de la esfera: primer y último 8% del progreso
const LIGHT_AT = '88%';           // se enciende cuando el top de la sección pasa por aquí (asoma por abajo)
const ENV_INTENSITY = 1.4;        // brillo de los reflejos dentro del estudio
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
  const flash = section.querySelector('.studio__flash');
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
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  // costura: los bordes izquierdo y derecho de la imagen no casan del todo (~10 niveles en el naranja,
  // más en el suelo). En una franja estrecha a cada lado se mezcla con el borde opuesto: en la costura
  // los dos lados dan el mismo color y no se ve la línea
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 texel = texture2D( map, vMapUv );
        vec4 mirror = texture2D( map, vec2( 1.0 - vMapUv.x, vMapUv.y ) );
        float edge = min( vMapUv.x, 1.0 - vMapUv.x );
        diffuseColor *= mix( 0.5 * ( texel + mirror ), texel, smoothstep( 0.0, ${SEAM.toFixed(4)}, edge ) );
      #endif
    `);
  };
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
    envSrc.dispose(); // la imagen sigue en memoria para regenerarlo al volver
    star.prepareEnvironment(envTex);
    if (active) star.setEnvironment(envTex, ENV_INTENSITY);
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
      t.mapping = THREE.EquirectangularReflectionMapping;
      t.colorSpace = THREE.SRGBColorSpace;
      envSrc = t;
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
      if (active) star.setEnvironment(null);
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
  const shot = () => gsap.timeline()
    .call(() => window.dispatchEvent(new CustomEvent('disco:studio-shot')), null, 0)
    .call(() => section.classList.add('is-lit'), null, 0.12)
    .fromTo(flash, { opacity: 0 }, { opacity: 0.85, duration: 0.12, ease: 'power2.out' }, 0)
    .to(flash, { opacity: 0, duration: 0.23, ease: 'power2.in' });
  const enter = (on) => {
    active = on;
    star.setEnvironment(on && envTex ? envTex : null, ENV_INTENSITY);
  };
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
  // el flash (de oscuro a claro, como un disparo al entrar) en cuanto la sección asoma por abajo (con "Dale al
  // REC." aún en pantalla): el negro entre la frase y el estudio no pasa de ~40vh. Desde ahí el set ya se ve,
  // recortado a la sección (draw), y sube con ella hasta que empieza el pin
  ScrollTrigger.create({
    trigger: section,
    start: `top ${LIGHT_AT}`,
    end: 'bottom top',
    onEnter: shot,
    onLeaveBack: () => { section.classList.remove('is-lit'); window.dispatchEvent(new CustomEvent('disco:studio-dark')); },
    onRefresh: (self) => { if (self.progress > 0) section.classList.add('is-lit'); },
  });

  // --- móvil: si va justo (< 40 fps durante 2 s dentro del estudio), dpr 1 ---
  const touch = matchMedia('(pointer: coarse), (max-width: 767px)').matches;
  let slow = 0;
  let lowered = false;

  let top = 0; // top de la sección en pantalla (px), para recortar el set antes del pin
  star.setBackdrop({
    update(ratio) {
      if (touch && active && !lowered) {
        slow = 60 / ratio < LOW_FPS ? slow + ratio / 60 : 0;
        if (slow > 2) { lowered = true; star.setDpr(1); }
      }

      const prev = p;
      p += (state.p - p) * (1 - Math.pow(1 - SMOOTH, ratio));
      if (Math.abs(state.p - p) < 1e-5) p = state.p;
      star.setStage(p);
      // antes del pin (encendido y asomando): el set entero, recortado a la sección
      top = section.getBoundingClientRect().top;
      const lit = section.classList.contains('is-lit') && top < innerHeight;
      const fade = (lit && p < FADE ? 1 : THREE.MathUtils.smoothstep(p, 0, FADE)) * (1 - THREE.MathUtils.smoothstep(p, 1 - FADE, 1));
      const show = fade > 0.001 && resident && !!panoTex;
      // giro del estudio y dónde caen los puestos en pantalla (también sin textura: el AF va igual)
      const yaw = THREE.MathUtils.degToRad(yawAt(p, portrait ? ASIDE_MOBILE : ASIDE));
      sphere.rotation.y = yaw;
      panoCam.rotation.x = Math.sin(p * Math.PI * 2) * PITCH + (portrait ? LOOK_UP_MOBILE : 0);
      star.setEnvRotation(yaw, envTex);
      sphere.updateMatrixWorld(true);
      panoCam.updateMatrixWorld();
      ui.update(state.p, anchors.map((an) => {
        an.getWorldPosition(v).project(panoCam);
        if (v.z > 1) return null; // detrás de la cámara
        return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
      }));
      const changed = p !== prev || sphere.visible !== show || (show && top > 0);
      sphere.visible = show;
      if (!show) return changed;
      mat.opacity = fade;
      return changed;
    },
    draw(r) {
      if (!sphere.visible) return;
      if (top > 0) { // aún subiendo: solo dentro de la sección (scissor: origen abajo a la izquierda)
        r.setScissorTest(true);
        r.setScissor(0, 0, innerWidth, Math.max(0, innerHeight - top));
      }
      r.render(panoScene, panoCam);
      r.setScissorTest(false);
    },
  });
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
