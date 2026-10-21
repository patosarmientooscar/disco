import { Renderer, Program, Mesh, Triangle, Texture, Flowmap, Vec2 } from 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/index.js';

// Hero v2: foto roja a pantalla completa. Con ratón, una estela líquida (Flowmap de OGL: velocidad
// del ratón en una textura ping-pong) arrastra los píxeles, separa los canales y deja un brillo
// en el borde; se relaja sola. Sin ratón, quieta. Se renderiza solo mientras hay estela y el hero
// está en pantalla, desde el único loop (gsap.ticker). Sin WebGL o con movimiento reducido: el <img>.
const MAX_DPR = 2;
const FLOW = { size: 128, falloff: 0.22, dissipation: 0.98, alpha: 0.6 }; // disp = rg·b: decae al cuadrado; 0.98 → la estela se ve ~1 s
const VEL_SCALE = 0.8;     // px/ms → unidades del flowmap (un gesto normal, ~0.5–1 px/ms, ya se nota)
const VEL_MAX = 0.6;       // tope: un tirón brusco no rompe la imagen (máx. ~8% de desplazamiento)
const VEL_LERP = 0.1;
const STRENGTH = 0.14;     // refracción
const ABERRATION = 0.045;  // separación RGB, solo donde hay estela (la foto ya está movida: es lo que vende el efecto)
const STILL_MS = 50;       // sin eventos de ratón durante este tiempo = ratón quieto
const SETTLE_MS = 2600;    // tras el último movimiento: (0.98^156)² < 0.2% → la estela ya es invisible

const vertex = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
uniform sampler2D tFlow;
uniform vec2 uRes;       // tamaño del hero (px)
uniform vec2 uImage;     // tamaño de la foto (px)
uniform float uStrength;
uniform float uAberration;
varying vec2 vUv;

void main() {
  // "cover" centrado en cualquier proporción
  float rs = uRes.x / uRes.y;
  float ri = uImage.x / uImage.y;
  vec2 scale = vec2(min(1.0, rs / ri), min(1.0, ri / rs));
  vec2 coverUv = (vUv - 0.5) * scale + 0.5;

  vec3 flow = texture2D(tFlow, vUv).rgb;   // rg = dirección, b = intensidad
  vec2 disp = flow.rg * flow.b;
  vec2 uv = coverUv - disp * uStrength;

  float r = texture2D(tMap, uv - disp * uAberration).r;
  float g = texture2D(tMap, uv).g;
  float b = texture2D(tMap, uv + disp * uAberration).b;

  // brillo de superficie de agua en el borde de la estela
  float l = length(disp);
  float edge = smoothstep(0.02, 0.15, l) * (1.0 - smoothstep(0.15, 0.4, l));
  gl_FragColor = vec4(vec3(r, g, b) + edge * 0.06, 1.0);
}`;

export function initHero({ gsap, ScrollTrigger, reduced, loop }) {
  const hero = document.getElementById('hero-main');
  const img = hero.querySelector('[data-hero-img]');
  const lines = hero.querySelectorAll('[data-hero-line]');
  const scroll = hero.querySelector('[data-hero-scroll]');
  const fixedCta = document.querySelector('[data-cta-fixed]');

  if (!reduced.matches && hasWebGL()) setupLiquid({ hero, img, loop });

  // --- entrada de la frase y del "scroll to explore" (al terminar la intro) ---
  let shown = false;
  const show = () => {
    if (shown) return;
    shown = true;
    const tl = gsap.timeline({
      onComplete: () => window.dispatchEvent(new CustomEvent('disco:hero-ready')),
    });
    if (reduced.matches) {
      tl.to(lines, { y: 0, opacity: 1, duration: 0.5, ease: 'power1.out' })
        .to(scroll, { opacity: 1, duration: 0.5, ease: 'power1.out' }, 0.4);
    } else {
      // y: 0 anula el translateY(105%) del CSS que GSAP leería en px (se sumaría al yPercent)
      tl.fromTo(lines, { y: 0, yPercent: 105, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.12 })
        .to(scroll, { opacity: 1, duration: 0.8, ease: 'power2.out' }, 0.12 * (lines.length - 1) + 0.4);
    }
  };
  window.addEventListener('disco:intro-done', show, { once: true });

  return {
    show,
    // CTA fijo: aparece cuando el hero ha salido por arriba y se queda el resto de la página
    watchCta() {
      ScrollTrigger.create({
        trigger: hero,
        start: 'bottom top',
        onEnter: () => {
          gsap.to(fixedCta, { autoAlpha: 1, duration: 0.3 });
          fixedCta.removeAttribute('tabindex');
          fixedCta.removeAttribute('aria-hidden');
        },
        onLeaveBack: () => {
          gsap.to(fixedCta, { autoAlpha: 0, duration: 0.2 });
          fixedCta.setAttribute('tabindex', '-1');
          fixedCta.setAttribute('aria-hidden', 'true');
        },
      });
    },
  };
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function setupLiquid({ hero, img, loop }) {
  const renderer = new Renderer({ dpr: Math.min(devicePixelRatio, MAX_DPR), antialias: false, depth: false });
  const { gl } = renderer;
  gl.canvas.className = 'hero__canvas';
  gl.canvas.setAttribute('aria-hidden', 'true');
  hero.querySelector('.hero__media').after(gl.canvas);

  const flowmap = new Flowmap(gl, FLOW);
  const texture = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR });
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      tMap: { value: texture },
      tFlow: flowmap.uniform,
      uRes: { value: new Vec2(1, 1) },
      uImage: { value: new Vec2(img.naturalWidth || 2560, img.naturalHeight || 1706) },
      uStrength: { value: STRENGTH },
      uAberration: { value: ABERRATION },
    },
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

  let ready = false;
  let onScreen = true;
  let activeUntil = 0;
  const draw = () => {
    flowmap.update();
    renderer.render({ scene: mesh });
  };

  const resize = () => {
    const { width, height } = hero.getBoundingClientRect();
    renderer.setSize(width, height);
    program.uniforms.uRes.value.set(width, height);
    flowmap.aspect = width / height;
    if (ready) draw();
  };
  new ResizeObserver(resize).observe(hero);
  resize();

  // la misma foto que ya descarga el <img> (webp o jpg)
  img.decode().then(() => {
    texture.image = img;
    program.uniforms.uImage.value.set(img.naturalWidth, img.naturalHeight);
    ready = true;
    draw();
    hero.classList.add('is-gl');
  }).catch(() => gl.canvas.remove()); // si la foto no carga, se queda el <img>

  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(hero);

  // --- ratón: posición en uv del hero y velocidad en px/ms (solo ratón; táctil = foto quieta) ---
  const target = new Vec2();
  let last = null;
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = hero.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const now = performance.now();
    flowmap.mouse.set(x / r.width, 1 - y / r.height);
    if (last) {
      const dt = Math.max(1000 / 120, now - last.t);
      target.set(((x - last.x) / dt) * VEL_SCALE, ((y - last.y) / dt) * VEL_SCALE);
      const len = target.len();
      if (len > VEL_MAX) target.multiply(VEL_MAX / len);
    }
    last = { x, y, t: now };
    activeUntil = now + SETTLE_MS;
  });
  hero.addEventListener('pointerleave', () => { last = null; });

  loop.add((time, ratio) => {
    const now = performance.now();
    if (!ready || !onScreen || now > activeUntil) return;
    // ratón quieto (sin eventos en ~3 frames, no solo entre dos eventos): el sello sale de la
    // textura y la estela se relaja sola con la dissipation (si no, el sello a velocidad 0 la borraría)
    if (!last || now - last.t > STILL_MS) {
      target.set(0, 0);
      flowmap.velocity.set(0, 0);
      flowmap.mouse.set(-1, -1);
    }
    flowmap.velocity.lerp(target, 1 - Math.pow(1 - VEL_LERP, ratio));
    draw();
  });
}
