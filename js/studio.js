import * as THREE from 'three';

// Estudio de fotografía 360°: un panorama equirectangular en una esfera alrededor de la cámara, dibujado
// como fondo en el MISMO canvas y renderer que el destello 3D (star.setBackdrop), dentro del loop único.
// La sección (#estudio, 400vh) deja su interior fijo (sticky) y el scroll gira el estudio entero:
// yaw = 90° + p × 360° (empieza y acaba mirando al set naranja), cabeceo ±3°. El destello posa quieto
// en el centro (js/star.js) y refleja el estudio (mismo giro en el entorno de reflejos).
// Encima, "¿Por qué nosotros?" a la izquierda y las razones de una en una a la derecha.
// Sin WebGL o con movimiento reducido: recorte fijo del set de fondo y todo el texto quieto.
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
const COPY_IN = 0.12;             // el titular entra al llegar aquí…
const COPY_OUT = 0.9;             // …y titular y razones se van desde aquí, enlazado al scroll
// Razones (BORRADOR: Oscar las revisará): [titular, frase de apoyo]. Se ven de una en una.
const REASONS = [
  ['Foto, vídeo y edición', 'Todo en un mismo equipo, de la idea al contenido final.'],
  ['Pensado para redes', 'Cada plano nace para funcionar en Instagram y TikTok.'],
  ['Vivimos la noche de Madrid', 'Conocemos el ritmo de los locales que fotografiamos.'],
  ['Entregas rápidas', 'Sin perder calidad ni esperar semanas.'],
];
const REASON_AT = [0.15, 0.34, 0.53, 0.72]; // p en el que entra cada razón (la última dura hasta COPY_OUT)
const LOW_FPS = 40;               // móvil: por debajo de esto durante 2 s → dpr 1
const SEAM = 0.012;               // ancho (fracción de la imagen) de la mezcla en la costura del panorama

export function initStudio({ gsap, ScrollTrigger, reduced, loop, star }) {
  const section = document.getElementById('estudio');
  if (!section) return;
  const title = section.querySelector('[data-studio-title]');
  const reasons = section.querySelector('[data-studio-reasons]');
  const [veilLeft, veilRight] = section.querySelectorAll('.studio__veil');
  const items = renderReasons(section.querySelector('[data-studio-list]'));
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

  // --- titular: entra todo a la vez al llegar a COPY_IN (tiempo, no scrub); desde COPY_OUT, titular y
  //   razones se van hacia arriba con el scroll. Entrada y salida en el mismo elemento: combinadas a mano ---
  const copy = { k: 0, out: 1, applied: '' };
  const veil = { r: 0 }; // aparte de copy: su tween no debe pisar la entrada del titular
  let copyShown = false;
  const copyIn = gsap.to(copy, { k: 1, duration: 1.2, ease: 'expo.out', paused: true });
  gsap.set(title, { opacity: 0 });
  const applyCopy = () => {
    const y = 60 * (1 - copy.k) - 40 * (1 - copy.out);
    const blur = 8 * (1 - copy.k);
    const key = `${y.toFixed(2)}|${copy.k.toFixed(3)}|${copy.out.toFixed(3)}|${veil.r.toFixed(3)}`;
    if (key === copy.applied) return;
    copy.applied = key;
    gsap.set(title, { y, opacity: copy.k * copy.out, filter: blur > 0.05 ? `blur(${blur}px)` : 'none' });
    gsap.set(reasons, { y: -40 * (1 - copy.out), opacity: copy.out });
    gsap.set(veilLeft, { opacity: copy.k * copy.out });
    gsap.set(veilRight, { opacity: veil.r * copy.out });
  };

  // --- razones: una cada vez según p (al cruzar cada umbral, no scrub). La que sale sube y se va; la que
  //   entra viene de abajo cuando la otra ya se ha ido (nunca se solapan). Hacia arriba, al revés ---
  let current = -1;
  const showReason = (next) => {
    const dir = next > current ? 1 : -1;
    const prev = items[current];
    if (prev) {
      gsap.killTweensOf(prev);
      gsap.to(prev, { y: -28 * dir, opacity: 0, filter: 'blur(6px)', duration: 0.5, ease: 'power2.in' });
    }
    const el = items[next];
    if (el) {
      gsap.killTweensOf(el);
      gsap.fromTo(el, { y: 28 * dir, opacity: 0, filter: 'blur(6px)' }, {
        y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out', delay: prev ? 0.65 : 0,
      });
    }
    // el velo de la derecha, solo mientras hay una razón
    if ((current < 0) !== (next < 0)) gsap.to(veil, { r: next < 0 ? 0 : 1, duration: 0.8, ease: 'power2.out', overwrite: true });
    current = next;
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
      let next = -1;
      REASON_AT.forEach((at, i) => { if (raw >= at) next = i; });
      if (next !== current) showReason(next);
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

// Las razones del array, como lista (todas en el DOM: los lectores de pantalla las leen todas)
function renderReasons(list) {
  if (!list) return [];
  const total = String(REASONS.length).padStart(2, '0');
  return REASONS.map(([head, text], i) => {
    const li = document.createElement('li');
    li.className = 'studio__reason';
    const count = document.createElement('span');
    count.className = 'studio__count';
    count.textContent = `${String(i + 1).padStart(2, '0')} / ${total}`;
    count.setAttribute('aria-hidden', 'true');
    const h = document.createElement('h3');
    h.className = 'studio__reason-title';
    h.textContent = head;
    const p = document.createElement('p');
    p.className = 'studio__reason-text';
    p.textContent = text;
    li.append(count, h, p);
    list.append(li);
    return li;
  });
}
