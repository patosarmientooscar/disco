// LEGACY servicios v2 (commit 9399961): la hoja de montaje (antes en js/servicios.js) y los datos de "Dispara" y de
// los formatos (antes en js/servicios-data.js). "Dispara" entero está en shoot.js (esta misma carpeta).

// Foto ("Dispara"): las fotos que se disparan y forman el muro, en orden (la última se queda en el centro).
// PROVISIONALES (fotos de la web): sustituir por 6–10 fotos reales de 1600 px de ancho como mínimo.
export const shots = [
  { src: 'assets/hero/03.webp', alt: 'Terraza con sombrillas blancas y una palmera frente al mar' },
  { src: 'assets/hero/01.webp', alt: 'Bola de discoteca encendida en la oscuridad' },
  { src: 'assets/hero/04.webp', alt: 'Mujer sonriendo con una copa en la mano, en blanco y negro' },
  { src: 'assets/hero/02.webp', alt: 'Dos personas bailando, movidas, iluminadas en rojo' },
  { src: 'assets/hero/06.webp', alt: 'Siluetas bailando a contraluz, en blanco y negro' },
  { src: 'assets/hero/07.webp', alt: 'Persona en movimiento, desenfocada, sobre fondo blanco' },
  { src: 'assets/hero/05.webp', alt: 'Chico con una pala de pádel contra un cielo azul' },
];

// Vídeo: la "hoja de montaje". video (opcional): { src, poster } de un clip mudo y corto. Cuando
// exista, la fila lo enseñará pequeño siguiendo al cursor (aún sin implementar: no hay vídeos).
export const formats = [
  { name: 'Reels y TikTok', spec: '9:16 · 15–60 s', tc: 45, video: null },
  { name: 'Vídeo de marca', spec: '16:9 · 1–3 min', tc: 120, video: null },
  { name: 'Aftermovie de eventos', spec: '16:9 + 9:16', tc: 90, video: null },
  { name: 'Entrevistas y testimonios', spec: '16:9 · multicámara', tc: 150, video: null },
  { name: 'Edición, color y sonido', spec: 'montaje al beat · etalonaje · subtítulos', tc: 60, video: null },
];


// ---------- D) hoja de montaje: filas como clips; al pasar, cabezal y timecode que cuenta ----------
function initEdl({ gsap, ScrollTrigger, still, desktop }) {
  const list = document.querySelector('[data-formats]');
  list.innerHTML = formats.map((f) => `<li class="sv-edl__row" data-tc="${f.tc}">
      <span class="sv-edl__name">${f.name}</span><span class="sv-edl__dots" aria-hidden="true"></span>
      <span class="sv-edl__spec">${f.spec}</span><span class="sv-edl__tc" aria-hidden="true">00:00:00:00</span>
      <i class="sv-edl__head" aria-hidden="true"></i></li>`).join('');
  const rows = [...list.children];
  if (still) return;
  const tc = (s) => {
    const f = Math.floor((s % 1) * 25);
    const sec = Math.floor(s);
    const p = (v) => String(v).padStart(2, '0');
    return `00:${p(Math.floor(sec / 60))}:${p(sec % 60)}:${p(f)}`;
  };
  const on = (row, yes) => {
    row.classList.toggle('is-on', yes);
    if (!yes) return;
    const head = row.querySelector('.sv-edl__head');
    const out = row.querySelector('.sv-edl__tc');
    const clock = { s: 0 };
    gsap.timeline()
      .fromTo(head, { left: '0%', opacity: 1 }, { left: '100%', duration: EDL_SWEEP, ease: 'power1.inOut' })
      .to(head, { opacity: 0, duration: 0.15 });
    gsap.fromTo(clock, { s: 0 }, { s: Number(row.dataset.tc), duration: EDL_SWEEP, ease: 'power1.inOut', onUpdate: () => { out.textContent = tc(clock.s); } });
  };
  rows.forEach((row) => {
    row.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') on(row, true); });
    row.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') on(row, false); });
  });
  // entrada: como clips que se colocan en la línea de tiempo
  gsap.from(rows, { x: -40, opacity: 0, duration: 0.7, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: list, start: 'top 82%', once: true } });
  // móvil / táctil: se enciende la que pasa por el centro
  gsap.matchMedia().add('(hover: none), (max-width: 899px)', () => {
    const ts = rows.map((row) => ScrollTrigger.create({ trigger: row, start: 'top 55%', end: 'bottom 45%', onToggle: (self) => on(row, self.isActive) }));
    return () => ts.forEach((t) => t.kill());
  });
}

