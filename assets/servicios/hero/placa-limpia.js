// placa limpia: el fondo sin el chico (ni su estela), rellenado con un degradado suave de su entorno
// Uso (Node + sharp; no lo carga la web): node placa-limpia.js bg.webp persona.webp bg-limpio.webp bg-limpio-1280.webp
const sharp = require('sharp');
const [bgPath, perPath, out, out1280] = process.argv.slice(2);
const W = 2560, H = 1434, S = 4; // el relleno se calcula a 1/4
const w = W / S, h = Math.round(H / S);

async function blurGray(buf, width, height, sigma) {
  const { data } = await sharp(Buffer.from(buf), { raw: { width, height, channels: 1 } }).blur(sigma).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  return data;
}

(async () => {
  const bg = await sharp(bgPath).removeAlpha().raw().toBuffer();
  const alpha = await sharp(perPath).ensureAlpha().extractChannel(3).raw().toBuffer();
  // todo el chico, también su estela semitransparente (ya va en la capa de la persona), un poco dilatado
  const core = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) {
    const t = Math.min(1, Math.max(0, (alpha[i] / 255 - 0.04) / 0.26));
    core[i] = Math.round(t * t * (3 - 2 * t) * 255);
  }
  const grown = await blurGray(core, W, H, 8);
  const mask = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = Math.min(255, grown[i] * 2.5);

  // relleno a 1/4: convolución normalizada (blur(color·peso) / blur(peso)) en varias escalas, de fina a gruesa; en
  // float y con blur de caja separable ×3 (≈ gauss). Sale un degradado suave del entorno real, sin bordes.
  const small = await sharp(bg, { raw: { width: W, height: H, channels: 3 } }).resize(w, h).raw().toBuffer();
  const msmall = await sharp(mask, { raw: { width: W, height: H, channels: 1 } }).resize(w, h).extractChannel(0).raw().toBuffer();
  const box = (src, r) => {
    let a = Float32Array.from(src), t = new Float32Array(a.length);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) { let acc = 0, n = 0; const row = y * w;
        for (let x = -r; x < w + r; x++) {
          if (x + r < w) { acc += a[row + x + r]; n++; }
          if (x - r - 1 >= 0) { acc -= a[row + x - r - 1]; n--; }
          if (x >= 0 && x < w) t[row + x] = acc / n;
        } }
      for (let x = 0; x < w; x++) { let acc = 0, n = 0;
        for (let y = -r; y < h + r; y++) {
          if (y + r < h) { acc += t[(y + r) * w + x]; n++; }
          if (y - r - 1 >= 0) { acc -= t[(y - r - 1) * w + x]; n--; }
          if (y >= 0 && y < h) a[y * w + x] = acc / n;
        } }
    }
    return a;
  };
  const wt = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) wt[i] = 1 - msmall[i] / 255;
  const fill = new Float32Array(w * h * 3);
  const got = new Float32Array(w * h);
  for (const r of [4, 12, 32, 80]) {
    const den = box(wt, r);
    const num = [0, 1, 2].map((c) => { const ch = new Float32Array(w * h); for (let i = 0; i < w * h; i++) ch[i] = small[i * 3 + c] * wt[i]; return box(ch, r); });
    for (let i = 0; i < w * h; i++) {
      if (got[i] >= 1 || den[i] < 0.01) continue;
      const k = Math.min(1 - got[i], Math.min(1, den[i] * 2));
      for (let c = 0; c < 3; c++) fill[i * 3 + c] += (num[c][i] / den[i]) * k;
      got[i] += k;
    }
  }
  // dentro del hueco, oscuro como el cuerpo (en la entrada, la silueta a medio aparecer es el propio chico); junto a
  // los bordes derecho y de arriba, que son los que asoman con el parallax contra la niebla, el color real del vecino
  const ok = (x, y) => msmall[y * w + x] < 40;
  const EDGE = 28; // px a 1/4 (≈ 110 px a tamaño completo)
  const ss = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  const fillBuf = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const g = Math.max(got[i], 1e-3);
      if (ok(x, y)) { for (let c = 0; c < 3; c++) fillBuf[i * 3 + c] = Math.round(fill[i * 3 + c] / g); continue; }
      let dr = 0; while (x + dr < w && !ok(x + dr, y) && dr <= EDGE) dr++;
      let dt = 0; while (y - dt >= 0 && !ok(x, y - dt) && dt <= EDGE) dt++;
      const wr = x + dr < w && dr <= EDGE ? 1 - ss(dr / EDGE) : 0;
      const wtp = y - dt >= 0 && dt <= EDGE ? 1 - ss(dt / EDGE) : 0;
      const ri = y * w + Math.min(w - 1, x + dr), ti = Math.max(0, y - dt) * w + x;
      const sum = Math.max(1, wr + wtp);
      for (let c = 0; c < 3; c++) {
        const dark = (fill[i * 3 + c] / g) * 0.3;
        const edge = wr + wtp > 0 ? (small[ri * 3 + c] * wr + small[ti * 3 + c] * wtp) / (wr + wtp) : dark;
        const k = Math.min(1, (wr + wtp) / sum);
        fillBuf[i * 3 + c] = Math.min(255, Math.round(dark * (1 - k) + edge * k));
      }
    }
  }
  const fillBig = await sharp(fillBuf, { raw: { width: w, height: h, channels: 3 } }).blur(1.5).resize(W, H, { kernel: 'cubic' }).raw().toBuffer();

  // mezcla, con un poco de grano en lo rellenado para que no quede "plástico"
  const outBuf = Buffer.alloc(W * H * 3);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  for (let i = 0; i < W * H; i++) {
    const m = mask[i] / 255;
    const n = rnd() * 6 * m;
    for (let c = 0; c < 3; c++) outBuf[i * 3 + c] = Math.max(0, Math.min(255, Math.round(bg[i * 3 + c] * (1 - m) + fillBig[i * 3 + c] * m + n)));
  }
  const img = sharp(outBuf, { raw: { width: W, height: H, channels: 3 } });
  const a = await img.clone().webp({ quality: 80 }).toFile(out);
  const b = await img.clone().resize(1280).webp({ quality: 78 }).toFile(out1280);
  console.log('plate', Math.round(a.size / 1024) + ' KB', Math.round(b.size / 1024) + ' KB');
})();
