import { Renderer, Program, Mesh, Triangle, Texture } from 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/index.js';

// Cubeta de revelado (servicios.html): un solo canvas OGL que se mete dentro de la copia que se está revelando
// y la pinta con u_develop (0 → 1):
//   0          NEGATIVO: invertido, desaturado y teñido del ámbar/rojo de la luz de seguridad
//   0 → 0.7    la imagen positiva aparece desde las sombras hacia las luces (umbral de luminancia que sube),
//              bajo la luz roja; el papel ondula en el líquido (seno + ruido) y un brillo de líquido lo cruza
//   0.7 → 1    la luz roja se apaga: color real y nítido (idéntico al <img>, así el cambio no se ve)
// Solo pinta cuando cambia algo (y mientras ondula). Sin WebGL: null (js/servicios.js usa el filtro CSS).
const MAX_DPR = 2;

const vertex = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

const fragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tMap;
uniform float uDevelop;
uniform float uTime;
uniform vec2 uRes;      // tamaño de la caja (px)
uniform vec2 uImage;    // tamaño de la foto (px)

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  float d = uDevelop;
  // ondulación del líquido: baja a 0 al terminar de revelarse
  float wet = 1.0 - smoothstep(0.0, 0.78, d);
  vec2 uv = vUv;
  float n = noise(uv * 3.0 + uTime * 0.25);
  uv += wet * vec2(
    sin(uv.y * 16.0 + uTime * 1.5 + n * 3.0) * 0.006,
    cos(uv.x * 12.0 + uTime * 1.2 + n * 2.0) * 0.006
  );
  // "cover" centrado
  float rs = uRes.x / uRes.y;
  float ri = uImage.x / uImage.y;
  vec2 scale = vec2(min(1.0, rs / ri), min(1.0, ri / rs));
  vec2 cuv = clamp((uv - 0.5) * scale + 0.5, 0.0, 1.0);
  vec3 c = texture2D(tMap, cuv).rgb;
  float L = dot(c, vec3(0.299, 0.587, 0.114));

  // negativo bajo la luz de seguridad
  vec3 neg = (1.0 - L) * vec3(1.0, 0.56, 0.36) * 0.82;
  // positivo apareciendo: primero las sombras (umbral que sube)
  float T = d / 0.7 * 1.2;
  float rev = 1.0 - smoothstep(T - 0.16, T, L);
  // bajo la luz roja hasta 0.7; después, color real
  float off = smoothstep(0.7, 1.0, d);
  vec3 pos = mix(vec3(L) * vec3(1.08, 0.36, 0.26), c, off);
  vec3 col = mix(neg, pos, rev);
  // brillo del líquido que se mueve
  float band = smoothstep(0.82, 1.0, sin(vUv.x * 5.0 + vUv.y * 2.4 - uTime * 0.8 + n) * 0.5 + 0.5);
  col += wet * band * 0.09;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createDarkroom({ loop }) {
  let renderer;
  try {
    renderer = new Renderer({ dpr: Math.min(devicePixelRatio, MAX_DPR), alpha: false, antialias: false, depth: false });
  } catch {
    return null;
  }
  const { gl } = renderer;
  if (!gl) return null;
  gl.canvas.setAttribute('aria-hidden', 'true');
  const texture = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR });
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      tMap: { value: texture },
      uDevelop: { value: 0 },
      uTime: { value: 0 },
      uRes: { value: [1, 1] },
      uImage: { value: [1, 1] },
    },
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

  let box = null;
  let img = null;
  let ready = false;
  let develop = 0;
  let dirty = false;
  let running = true;
  const size = () => {
    if (!box) return;
    const { width, height } = box.getBoundingClientRect();
    // getBoundingClientRect incluye la inclinación del papel: el tamaño real es el del layout
    const w = box.offsetWidth || width;
    const h = box.offsetHeight || height;
    renderer.setSize(w, h);
    program.uniforms.uRes.value = [w, h];
    dirty = true;
  };
  const ro = new ResizeObserver(size);

  loop.add((time) => {
    if (!running || !ready || !box) return;
    const wet = develop < 0.78;
    if (!dirty && !wet) return;
    program.uniforms.uTime.value = time;
    program.uniforms.uDevelop.value = develop;
    renderer.render({ scene: mesh });
    dirty = false;
  });

  return {
    canvas: gl.canvas,
    // mete el canvas en la caja de la foto y la sube como textura (la del <img>, ya descargada)
    attach(target, image) {
      if (box === target) return;
      if (box) ro.unobserve(box);
      box = target;
      img = image;
      ready = false;
      box.append(gl.canvas);
      ro.observe(box);
      size();
      const go = () => {
        if (img !== image) return;
        texture.image = image;
        program.uniforms.uImage.value = [image.naturalWidth, image.naturalHeight];
        ready = true;
        dirty = true;
      };
      if (image.complete && image.naturalWidth) go();
      else image.decode().then(go).catch(() => {});
    },
    set(d) { if (d !== develop) { develop = d; dirty = true; } },
    pause(on) { running = !on; if (!on) dirty = true; },
  };
}
