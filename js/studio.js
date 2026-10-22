import * as THREE from 'three';

// Estudio de fotografía 360°: un panorama equirectangular en una esfera alrededor de la cámara, dibujado
// como fondo en el MISMO canvas y renderer que el destello 3D (star.setBackdrop), dentro del loop único.
// La sección (#estudio, 400vh) deja su interior fijo (sticky) y el scroll gira el estudio entero:
// yaw = 90° + p × 360° (empieza y acaba mirando al set naranja), cabeceo ±3°. El destello posa quieto
// en el centro (js/star.js) y refleja el estudio (mismo giro en el entorno de reflejos).
// Encima, "¿Por qué nosotros?". Sin WebGL o con movimiento reducido: recorte fijo del set de fondo.
const PANO = 'assets/studio/studio-360.jpg';               // 5792×2896
const PANO_MOBILE = 'assets/studio/studio-360-mobile.jpg'; // 4096×2048 (móvil y GPUs con límite de 4096)
const PANO_ENV = 'assets/studio/studio-360-env.jpg';       // 2048×1024: reflejos del destello
const SCRUB = 1.5;
const SMOOTH = 0.05;              // suavizado extra del giro (por frame a 60 fps, independiente del frame rate)
const YAW0 = Math.PI / 2;         // con +90° el set naranja (centro de la imagen) queda delante
const PITCH = THREE.MathUtils.degToRad(3);
const FOV = 55;
const FOV_PORTRAIT = 70;
const FADE = 0.08;                // fundido de la esfera: primer y último 8% del progreso
const ENV_INTENSITY = 1.4;        // brillo de los reflejos dentro del estudio
const COPY_IN = 0.12;             // el texto entra al llegar aquí…
const COPY_OUT = 0.9;             // …y se va desde aquí, enlazado al scroll
const LOW_FPS = 40;               // móvil: por debajo de esto durante 2 s → dpr 1
const SEAM = 0.012;               // ancho (fracción de la imagen) de la mezcla en la costura del panorama

export function initStudio({ gsap, ScrollTrigger, reduced, loop, star }) {
  const section = document.getElementById('estudio');
  if (!section) return;
  const card = section.querySelector('[data-studio-card]');
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

  const resize = () => {
    panoCam.aspect = innerWidth / innerHeight;
    panoCam.fov = panoCam.aspect >= 1 ? FOV : FOV_PORTRAIT;
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
  // el flash (de oscuro a claro, como un disparo al entrar) cuando la sección llega a la línea del menú:
  // a la vez que el menú cambia a tinta oscura (data-nav-ink, js/nav.js)
  const nav = document.querySelector('[data-nav]');
  const line = () => (nav ? nav.getBoundingClientRect().top + nav.offsetHeight / 2 : 0);
  ScrollTrigger.create({
    trigger: section,
    start: () => `top ${line()}px`,
    end: 'bottom top',
    onEnter: shot,
    onLeaveBack: () => section.classList.remove('is-lit'),
    onRefresh: (self) => { if (self.progress > 0) section.classList.add('is-lit'); },
  });

  // --- "¿Por qué nosotros?": entra todo el bloque a la vez al llegar a COPY_IN; se va desde COPY_OUT ---
  const copy = { k: 0, out: 1, applied: '' };
  let copyShown = false;
  const copyIn = gsap.to(copy, { k: 1, duration: 1.2, ease: 'expo.out', paused: true });
  gsap.set(card, { opacity: 0 });
  // los dos movimientos en el mismo elemento, combinados a mano (la opacidad en un padre rompería el blur del cristal)
  const applyCopy = () => {
    const y = 60 * (1 - copy.k) - 40 * (1 - copy.out);
    const blur = 8 * (1 - copy.k);
    const key = `${y.toFixed(2)}|${(copy.k * copy.out).toFixed(3)}|${blur.toFixed(2)}`;
    if (key === copy.applied) return;
    copy.applied = key;
    gsap.set(card, { y, opacity: copy.k * copy.out, filter: blur > 0.05 ? `blur(${blur}px)` : 'none' });
  };

  // --- móvil: si va justo (< 40 fps durante 2 s dentro del estudio), dpr 1 ---
  const touch = matchMedia('(pointer: coarse), (max-width: 767px)').matches;
  let slow = 0;
  let lowered = false;

  star.setBackdrop({
    update(ratio) {
      // el texto: entra/sale según el progreso real (sin suavizar) del pin
      const raw = state.p;
      if ((raw >= COPY_IN) !== copyShown) {
        copyShown = !copyShown;
        if (copyShown) copyIn.play(); else copyIn.reverse();
      }
      copy.out = 1 - THREE.MathUtils.clamp((raw - COPY_OUT) / (1 - COPY_OUT), 0, 1);
      applyCopy();

      if (touch && active && !lowered) {
        slow = 60 / ratio < LOW_FPS ? slow + ratio / 60 : 0;
        if (slow > 2) { lowered = true; star.setDpr(1); }
      }

      const prev = p;
      p += (state.p - p) * (1 - Math.pow(1 - SMOOTH, ratio));
      if (Math.abs(state.p - p) < 1e-5) p = state.p;
      star.setStage(p);
      const fade = THREE.MathUtils.smoothstep(p, 0, FADE) * (1 - THREE.MathUtils.smoothstep(p, 1 - FADE, 1));
      const show = fade > 0.001 && resident && !!panoTex;
      const changed = p !== prev || sphere.visible !== show;
      sphere.visible = show;
      if (!show) return changed;
      mat.opacity = fade;
      const yaw = YAW0 + p * Math.PI * 2;
      sphere.rotation.y = yaw;
      panoCam.rotation.x = Math.sin(p * Math.PI * 2) * PITCH;
      star.setEnvRotation(yaw, envTex);
      return changed;
    },
    draw(r) {
      if (sphere.visible) r.render(panoScene, panoCam);
    },
  });
}
