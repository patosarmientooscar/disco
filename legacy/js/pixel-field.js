/* LEGACY PRE-HERO — cámara de cine + "disco.es" en píxeles + scroll por las lentes (y su HUD,
   flash blanco y apertura en círculo). No se carga. Sustituido por la intro del prompt 3 (2026-10-21). */

/*
 * pixel-field.js — disco.es
 * Port a JavaScript puro (sin React, sin TypeScript, sin npm) del componente
 * PixelFlowField de 21st.dev, adaptado a fondo oscuro con letras blancas.
 *
 * NO tiene su propio requestAnimationFrame: el loop principal (main.js)
 * llama a field.draw() en cada frame.
 *
 * Uso:
 *   import { createPixelField } from './pixel-field.js';
 *   const field = createPixelField(document.querySelector('#prehero'), {
 *     text: 'disco.es',
 *   });
 *   // dentro del loop único:  field.draw();
 *   // al aparecer tras el flash: field.setRunning(true);
 */

const MAX_DPR = window.matchMedia('(max-width: 768px)').matches ? 2 : 1; // 1 en desktop (60 fps en retina), 2 en móvil
const RGB_MAX = 255;
const MS_PER_SECOND = 1000;
const TAU = Math.PI * 2;

// Paleta oscura: [fondo de celdas, transición, letra]
// Celdas fuera de la palabra → gris muy tenue; la palabra → blanco flash.
const DARK_COLORS = ['#2E2E33', '#8C8C94', '#F4F2EC'];

const DEFAULTS = {
  text: 'disco.es',
  weight: 700,
  fontFamily: '"Clash Display", system-ui, sans-serif',
  shape: 'square', // 'square' | 'circle' | 'cross'
  cellSize: 7,
  gap: 3,
  pointerRadius: 140,
  pointerStrength: 0.9,
  speed: 0.8,
  colors: DARK_COLORS,
  maxCells: 14000,
};

const MIN_STEP = 3;
const MIN_COLS = 44;
const MIN_DRAW = 0.35;

const TIER_COUNT = 7;
const RAMP_MID = 0.6;
const FIELD_ALPHA = 0.35; // un poco más alto que el original para que se vea sobre negro
const ACCENT_ALPHA = 0.92;
const INK_ALPHA = 1;

const MASK_LOW = 0.08;
const MASK_HIGH = 0.86;

const TEXT_HEIGHT_RATIO = 0.68;
const TEXT_WIDTH_RATIO = 0.86;
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

const LATTICE = 4;
const NOISE_SCALE = 0.19;
const TIME_SCALE = 0.14;
const FLOW_TURNS = 1.35;
const MAG_FLOOR = 0.35;
const MAG_RANGE = 0.65;
const NOISE_OFFSET_X = 37.2;
const NOISE_OFFSET_Y = 11.5;
const NOISE_COUNTER_FLOW = 0.8;

const DRIFT_RATIO = 0.95;
const WORD_CALM = 0.84;
const SIZE_FLOOR = 0.3;
const SIZE_MASK = 0.64;
const SIZE_FLOW = 0.2;
const STILL_MAG = 0.55;
const CROSS_THICKNESS = 0.34;

const REFORM_MS = 1750;
const STAGGER = 0.45;
const WORD_LEAD = 0.16;
const DELAY_X = 0.55;
const DELAY_Y = 0.3;
const DELAY_JITTER = 0.15;
const SCATTER_SIZE = 0.5;
const SCATTER_SPREAD = 1.25;

const WAKE_TAU = 0.42;
const WAKE_GAIN = 3.4;
const WAKE_CEILING = 2.4;
const MAX_SUBSTEPS = 4;
const MAX_DT = 0.05;

const HASH_X = 127.1;
const HASH_Y = 311.7;
const HASH_SEED = 74.7;
const HASH_MULTIPLIER = 43758.5453123;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const smoothstep = (v) => v * v * (3 - 2 * v);
const mixChannel = (a, b, t) => Math.round(a + (b - a) * t);

const hash2 = (x, y) => {
  const v = Math.sin(x * HASH_X + y * HASH_Y + HASH_SEED) * HASH_MULTIPLIER;
  return v - Math.floor(v);
};

const valueNoise = (x, y) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const ux = smoothstep(x - ix);
  const uy = smoothstep(y - iy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  const top = a + (b - a) * ux;
  const bottom = c + (d - c) * ux;
  return top + (bottom - top) * uy;
};

/** Convierte cualquier color CSS (hex, rgb, var(--x)) a [r,g,b,a]. */
const resolveColors = (inputs, host) => {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  host.append(probe);
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const out = inputs.map((input) => {
    const css = input.trim().startsWith('--') ? `var(${input.trim()})` : input.trim();
    probe.style.color = '';
    probe.style.color = css;
    const computed = getComputedStyle(probe).color;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = computed;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const alpha = d[3] / RGB_MAX || 1;
    return [Math.round(d[0] / alpha), Math.round(d[1] / alpha), Math.round(d[2] / alpha), alpha];
  });
  probe.remove();
  return out;
};

const rampCss = (coverage, colors) => {
  const [field, accent, ink] = colors;
  const low = coverage <= RAMP_MID;
  const from = low ? field : accent;
  const to = low ? accent : ink;
  const t = low ? coverage / RAMP_MID : (coverage - RAMP_MID) / (1 - RAMP_MID);
  const fa = low ? FIELD_ALPHA : ACCENT_ALPHA;
  const ta = low ? ACCENT_ALPHA : INK_ALPHA;
  const a = (fa + (ta - fa) * t) * (to[3] ?? 1);
  return `rgba(${mixChannel(from[0], to[0], t)}, ${mixChannel(from[1], to[1], t)}, ${mixChannel(from[2], to[2], t)}, ${a.toFixed(3)})`;
};

/**
 * Crea el campo de píxeles dentro de `host` (la sección del pre-hero).
 * Inserta un <canvas> absoluto detrás del contenido.
 */
export function createPixelField(host, userOptions = {}) {
  const opts = { ...DEFAULTS, ...userOptions };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (isMobile) {
    opts.cellSize = userOptions.cellSize ?? 6;
    opts.maxCells = userOptions.maxCells ?? 8000;
  }

  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.className = 'pixel-field';
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0;';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;';
  layer.append(canvas);
  host.prepend(layer);

  const context = canvas.getContext('2d');
  if (!context) {
    // Sin canvas: trama de puntos estática como respaldo.
    layer.style.backgroundImage = `radial-gradient(${opts.colors[1]} 1px, transparent 1px)`;
    layer.style.backgroundSize = `${opts.cellSize + opts.gap}px ${opts.cellSize + opts.gap}px`;
    layer.style.opacity = '0.4';
    const noop = () => {};
    return { draw: noop, setRunning: noop, setPointer: noop, resize: noop, scatter: noop, destroy: () => layer.remove(), element: layer };
  }

  const sampler = document.createElement('canvas');
  const samplerContext = sampler.getContext('2d', { willReadFrequently: true });

  const settings = {
    cellSize: Math.max(opts.cellSize, MIN_STEP),
    gap: Math.max(opts.gap, 0),
    colors: resolveColors(opts.colors, host),
    fontFamily: opts.fontFamily,
    pointerRadius: Math.max(opts.pointerRadius, 1),
    pointerStrength: clamp(opts.pointerStrength, 0, 1),
    scatterSeed: 0,
    shape: opts.shape,
    speed: Math.max(opts.speed, 0),
    still: reduceMotion.matches,
    text: opts.text,
    weight: opts.weight,
  };

  let width = 1, height = 1, cols = 1, rows = 1, count = 1;
  let step = settings.cellSize + settings.gap;
  let cellPx = settings.cellSize;

  let mask, ampFactor, sizeBase, homeX, homeY, scatterX, scatterY, wakeX, wakeY, delay;
  let latticeIndex, latticeWx, latticeWy;
  let latCols = 2, latRows = 2;
  let fieldU = new Float32Array(4);
  let fieldV = new Float32Array(4);
  let tiers = [];
  let tierCss = [];
  let sampleKey = '';

  let pointerX = 0, pointerY = 0, prevPointerX = 0, prevPointerY = 0;
  let pointerActive = false;

  const startedAt = performance.now();
  let lastFrameAt = startedAt;
  let scatterAt = startedAt;
  let hasStarted = false;
  let running = false;
  let onScreen = true;
  let destroyed = false;

  const allocate = () => {
    mask = new Float32Array(count);
    ampFactor = new Float32Array(count);
    sizeBase = new Float32Array(count);
    homeX = new Float32Array(count);
    homeY = new Float32Array(count);
    scatterX = new Float32Array(count);
    scatterY = new Float32Array(count);
    wakeX = new Float32Array(count);
    wakeY = new Float32Array(count);
    delay = new Float32Array(count);
    latticeIndex = new Int32Array(count);
    latticeWx = new Float32Array(count);
    latticeWy = new Float32Array(count);
  };
  allocate();

  const sampleSource = () => {
    if (!samplerContext) { mask.fill(0); return; }
    sampler.width = cols;
    sampler.height = rows;
    samplerContext.clearRect(0, 0, cols, rows);
    if (settings.text.length > 0) {
      let fontSize = Math.max(rows * TEXT_HEIGHT_RATIO, 1);
      samplerContext.font = `${settings.weight} ${fontSize}px ${settings.fontFamily}`;
      const measured = samplerContext.measureText(settings.text).width;
      const maxWidth = cols * TEXT_WIDTH_RATIO;
      if (measured > maxWidth && measured > 0) {
        fontSize = Math.max((fontSize * maxWidth) / measured, 1);
        samplerContext.font = `${settings.weight} ${fontSize}px ${settings.fontFamily}`;
      }
      samplerContext.fillStyle = '#ffffff';
      samplerContext.textAlign = 'center';
      samplerContext.textBaseline = 'middle';
      samplerContext.fillText(settings.text, cols / 2, rows / 2);
    }
    const px = samplerContext.getImageData(0, 0, cols, rows).data;
    const span = MASK_HIGH - MASK_LOW;
    for (let i = 0; i < count; i++) {
      const p = i * 4;
      const luma = (px[p] * LUMA_R + px[p + 1] * LUMA_G + px[p + 2] * LUMA_B) / RGB_MAX;
      const coverage = (luma * px[p + 3]) / RGB_MAX;
      mask[i] = smoothstep(clamp((coverage - MASK_LOW) / span, 0, 1));
    }
  };

  const buildDerived = () => {
    for (let row = 0; row < rows; row++) {
      const ny = rows > 1 ? row / (rows - 1) : 0;
      const latY = row / LATTICE;
      const iy = Math.floor(latY);
      const wy = latY - iy;
      for (let col = 0; col < cols; col++) {
        const i = row * cols + col;
        const nx = cols > 1 ? col / (cols - 1) : 0;
        const m = mask[i];
        homeX[i] = (col + 0.5) * step;
        homeY[i] = (row + 0.5) * step;
        ampFactor[i] = 1 - m * WORD_CALM;
        sizeBase[i] = SIZE_FLOOR + SIZE_MASK * m;
        delay[i] = clamp(nx * DELAY_X + ny * DELAY_Y + hash2(col, row) * DELAY_JITTER - m * WORD_LEAD, 0, 1);
        const latX = col / LATTICE;
        const ix = Math.floor(latX);
        latticeIndex[i] = iy * latCols + ix;
        latticeWx[i] = latX - ix;
        latticeWy[i] = wy;
      }
    }
  };

  const buildScatter = (seed) => {
    const offset = (SCATTER_SPREAD - 1) / 2;
    for (let i = 0; i < count; i++) {
      scatterX[i] = (hash2(i + 1, seed * 1.7 + 3.1) * SCATTER_SPREAD - offset) * width;
      scatterY[i] = (hash2(seed * 2.3 + 7.7, i + 1) * SCATTER_SPREAD - offset) * height;
    }
  };

  const buildTiers = () => {
    const buckets = Array.from({ length: TIER_COUNT }, () => []);
    for (let i = 0; i < count; i++) {
      buckets[Math.min(TIER_COUNT - 1, Math.floor(mask[i] * TIER_COUNT))].push(i);
    }
    tiers = buckets.map((b) => Int32Array.from(b));
    tierCss = buckets.map((_, t) => rampCss((t + 0.5) / TIER_COUNT, settings.colors));
  };

  const buildGrid = () => {
    step = Math.max(settings.cellSize + settings.gap, MIN_STEP);
    cellPx = settings.cellSize;
    cols = Math.max(1, Math.ceil(width / step));
    rows = Math.max(1, Math.ceil(height / step));

    const legibleStep = Math.max(width / MIN_COLS, MIN_STEP);
    if (width >= MIN_COLS && legibleStep < step) {
      cellPx *= legibleStep / step;
      step = legibleStep;
      cols = Math.max(1, Math.ceil(width / step));
      rows = Math.max(1, Math.ceil(height / step));
    }
    if (cols * rows > opts.maxCells) {
      const scale = Math.sqrt((cols * rows) / opts.maxCells);
      step *= scale;
      cellPx *= scale;
      cols = Math.max(1, Math.ceil(width / step));
      rows = Math.max(1, Math.ceil(height / step));
    }

    const nextCount = cols * rows;
    const resized = nextCount !== count;
    count = nextCount;
    latCols = Math.ceil(cols / LATTICE) + 2;
    latRows = Math.ceil(rows / LATTICE) + 2;
    if (resized) allocate();
    if (fieldU.length !== latCols * latRows) {
      fieldU = new Float32Array(latCols * latRows);
      fieldV = new Float32Array(latCols * latRows);
    }

    const key = [cols, rows, settings.text, settings.weight, settings.fontFamily].join('|');
    if (key !== sampleKey || resized) {
      sampleKey = key;
      sampleSource();
    }
    buildDerived();
    buildScatter(settings.scatterSeed);
    buildTiers();
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    const pw = Math.max(1, Math.round(width * dpr));
    const ph = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildGrid();
  };

  const traceCell = (cx, cy, size) => {
    const half = size / 2;
    if (settings.shape === 'circle') {
      context.moveTo(cx + half, cy);
      context.arc(cx, cy, half, 0, TAU);
    } else if (settings.shape === 'cross') {
      const arm = size * CROSS_THICKNESS;
      context.rect(cx - half, cy - arm / 2, size, arm);
      context.rect(cx - arm / 2, cy - half, arm, size);
    } else {
      context.rect(cx - half, cy - half, size, size);
    }
  };

  const updateFlowField = (time) => {
    for (let ly = 0; ly < latRows; ly++) {
      const gy = ly * LATTICE * NOISE_SCALE;
      const base = ly * latCols;
      for (let lx = 0; lx < latCols; lx++) {
        const gx = lx * LATTICE * NOISE_SCALE;
        const swirl = valueNoise(gx, gy + time);
        const strength = valueNoise(gx + NOISE_OFFSET_X, gy - time * NOISE_COUNTER_FLOW + NOISE_OFFSET_Y);
        const angle = swirl * TAU * FLOW_TURNS;
        const mag = MAG_FLOOR + MAG_RANGE * strength;
        fieldU[base + lx] = Math.cos(angle) * mag;
        fieldV[base + lx] = Math.sin(angle) * mag;
      }
    }
  };

  const stampWake = (px, py, dt) => {
    const radius = settings.pointerRadius;
    const limit = radius * radius;
    const ceiling = step * WAKE_CEILING;
    const c0 = clamp(Math.floor((px - radius) / step), 0, cols - 1);
    const c1 = clamp(Math.ceil((px + radius) / step), 0, cols - 1);
    const r0 = clamp(Math.floor((py - radius) / step), 0, rows - 1);
    const r1 = clamp(Math.ceil((py + radius) / step), 0, rows - 1);
    for (let row = r0; row <= r1; row++) {
      const base = row * cols;
      for (let col = c0; col <= c1; col++) {
        const i = base + col;
        const dx = homeX[i] - px;
        const dy = homeY[i] - py;
        const sq = dx * dx + dy * dy;
        if (sq >= limit || sq === 0) continue;
        const dist = Math.sqrt(sq);
        const falloff = 1 - dist / radius;
        const push = falloff * falloff * settings.pointerStrength * radius * WAKE_GAIN * dt;
        wakeX[i] = clamp(wakeX[i] + (dx / dist) * push, -ceiling, ceiling);
        wakeY[i] = clamp(wakeY[i] + (dy / dist) * push, -ceiling, ceiling);
      }
    }
  };

  const advanceWake = (dt) => {
    if (!pointerActive) {
      prevPointerX = pointerX;
      prevPointerY = pointerY;
      return;
    }
    const dx = pointerX - prevPointerX;
    const dy = pointerY - prevPointerY;
    const steps = clamp(Math.ceil(Math.hypot(dx, dy) / step), 1, MAX_SUBSTEPS);
    const slice = dt / steps;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      stampWake(prevPointerX + dx * t, prevPointerY + dy * t, slice);
    }
    prevPointerX = pointerX;
    prevPointerY = pointerY;
  };

  const drawResolved = () => {
    for (let t = 0; t < tiers.length; t++) {
      const bucket = tiers[t];
      if (!bucket.length) continue;
      context.fillStyle = tierCss[t];
      context.beginPath();
      for (const i of bucket) {
        const size = cellPx * (sizeBase[i] + SIZE_FLOW * STILL_MAG);
        if (size > MIN_DRAW) traceCell(homeX[i], homeY[i], size);
      }
      context.fill();
    }
  };

  const drawFlowing = (reform, decay) => {
    const settled = reform >= 1;
    const rest = 1 / (1 - STAGGER);
    const drift = step * DRIFT_RATIO;
    for (let t = 0; t < tiers.length; t++) {
      const bucket = tiers[t];
      if (!bucket.length) continue;
      context.fillStyle = tierCss[t];
      context.beginPath();
      for (const i of bucket) {
        const wx = wakeX[i] * decay;
        const wy = wakeY[i] * decay;
        wakeX[i] = wx;
        wakeY[i] = wy;

        const corner = latticeIndex[i];
        const tx = latticeWx[i];
        const ty = latticeWy[i];
        const below = corner + latCols;
        const uTop = fieldU[corner] + (fieldU[corner + 1] - fieldU[corner]) * tx;
        const uBot = fieldU[below] + (fieldU[below + 1] - fieldU[below]) * tx;
        const vTop = fieldV[corner] + (fieldV[corner + 1] - fieldV[corner]) * tx;
        const vBot = fieldV[below] + (fieldV[below + 1] - fieldV[below]) * tx;
        const u = uTop + (uBot - uTop) * ty;
        const v = vTop + (vBot - vTop) * ty;
        const mag = Math.abs(u) + Math.abs(v);

        const amp = drift * ampFactor[i];
        let x = homeX[i] + u * amp + wx;
        let y = homeY[i] + v * amp + wy;
        let scale = 1;
        if (!settled) {
          const local = clamp((reform - delay[i] * STAGGER) * rest, 0, 1);
          const inv = 1 - local;
          const eased = 1 - inv * inv * inv;
          x = scatterX[i] + (x - scatterX[i]) * eased;
          y = scatterY[i] + (y - scatterY[i]) * eased;
          scale = SCATTER_SIZE + (1 - SCATTER_SIZE) * eased;
        }
        const size = cellPx * (sizeBase[i] + SIZE_FLOW * mag) * scale;
        if (size <= MIN_DRAW) continue;
        if (x < -size || x > width + size || y < -size || y > height + size) continue;
        traceCell(x, y, size);
      }
      context.fill();
    }
  };

  /** Llamar UNA vez por frame desde el loop principal. */
  const draw = () => {
    if (destroyed || !running || !onScreen) return;
    context.clearRect(0, 0, width, height);
    if (settings.still) { drawResolved(); return; }
    const now = performance.now();
    const dt = clamp((now - lastFrameAt) / MS_PER_SECOND, 0, MAX_DT);
    lastFrameAt = now;
    updateFlowField(((now - startedAt) / MS_PER_SECOND) * settings.speed * TIME_SCALE);
    advanceWake(dt);
    drawFlowing(clamp((now - scatterAt) / REFORM_MS, 0, 1), Math.exp(-dt / WAKE_TAU));
  };

  /** Empieza/para. La primera vez que arranca, los píxeles llegan dispersos y forman la palabra. */
  const setRunning = (next) => {
    if (destroyed || running === next) return;
    running = next;
    if (next) {
      lastFrameAt = performance.now();
      if (!hasStarted) {
        hasStarted = true;
        scatterAt = lastFrameAt;
      }
    } else {
      // Deja pintado el último estado quieto.
      context.clearRect(0, 0, width, height);
      drawResolved();
    }
  };

  /** Dispersa los píxeles y deja que se vuelvan a formar (p. ej. tras un flash). */
  const scatter = () => {
    settings.scatterSeed += 1;
    buildScatter(settings.scatterSeed);
    scatterAt = performance.now();
    wakeX.fill(0);
    wakeY.fill(0);
  };

  const setPointer = (x, y, active) => {
    if (!pointerActive) { prevPointerX = x; prevPointerY = y; }
    pointerX = x;
    pointerY = y;
    pointerActive = active;
  };

  // Eventos del puntero en el HOST (la cámara va encima del canvas).
  const track = (e) => {
    const r = canvas.getBoundingClientRect();
    setPointer(e.clientX - r.left, e.clientY - r.top, true);
  };
  const release = () => setPointer(0, 0, false);
  if (!settings.still) {
    host.addEventListener('pointermove', track, { passive: true });
    host.addEventListener('pointerdown', track, { passive: true });
    host.addEventListener('pointerleave', release);
    host.addEventListener('pointercancel', release);
  }

  const resizeObserver = new ResizeObserver(() => {
    resize();
    if (!running) { context.clearRect(0, 0, width, height); drawResolved(); }
  });
  resizeObserver.observe(canvas);

  const io = new IntersectionObserver((entries) => {
    onScreen = entries.some((en) => en.isIntersecting);
  });
  io.observe(host);

  // La fuente debe estar cargada antes de rasterizar el texto.
  document.fonts.ready.then(() => {
    sampleKey = '';
    resize();
  }).catch(() => {});

  reduceMotion.addEventListener?.('change', (e) => { settings.still = e.matches; });

  resize();

  return {
    draw,
    setRunning,
    setPointer,
    resize,
    scatter,
    element: layer,
    destroy: () => {
      destroyed = true;
      running = false;
      resizeObserver.disconnect();
      io.disconnect();
      host.removeEventListener('pointermove', track);
      host.removeEventListener('pointerdown', track);
      host.removeEventListener('pointerleave', release);
      host.removeEventListener('pointercancel', release);
      layer.remove();
    },
  };
}
