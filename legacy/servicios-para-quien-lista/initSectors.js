// ---------- F) para quién: al pasar, la frase y una foto que sigue al cursor revelándose; móvil, acordeón ----------
function initSectors({ gsap, loop, still, desktop }) {
  const list = document.querySelector('[data-sectors]');
  list.innerHTML = sectors.map((s, i) => `<li class="sv-for__item">
      <button class="sv-for__row" type="button" aria-expanded="false" aria-controls="sector-${i}">
        <span class="sv-for__name">${s.name}</span><span class="sv-for__text">${s.text}</span>
      </button>
      <div class="sv-for__panel" id="sector-${i}" hidden>
        <p>${s.text}</p>
        ${s.photo ? `<div class="sv-for__photo"><img src="${s.photo.src}" width="${s.photo.w}" height="${s.photo.h}" alt="${s.photo.alt || ''}" loading="lazy" decoding="async"></div>` : ''}
      </div></li>`).join('');
  const items = [...list.children];
  // acordeón (móvil); en escritorio el botón no abre nada (la frase ya está en la fila)
  items.forEach((item) => {
    const btn = item.querySelector('.sv-for__row');
    const panel = item.querySelector('.sv-for__panel');
    btn.addEventListener('click', () => {
      if (desktop.matches) return;
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      item.classList.toggle('is-on', open);
    });
    btn.addEventListener('focus', () => { if (desktop.matches) item.classList.add('is-on'); });
    btn.addEventListener('blur', () => { if (desktop.matches) item.classList.remove('is-on'); });
  });

  // la foto que sigue al cursor (solo ratón, escritorio)
  const follow = document.querySelector('[data-follow]');
  const img = follow.querySelector('img');
  const pos = { x: 0, y: 0, tx: 0, ty: 0, r: 0, on: false, shown: false };
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  items.forEach((item, i) => {
    item.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !desktop.matches) return;
      items.forEach((it) => it.classList.toggle('is-on', it === item));
      const ph = sectors[i].photo;
      if (!ph || still || !fine.matches) { pos.on = false; gsap.to(follow, { opacity: 0, duration: 0.2, overwrite: true }); return; }
      if (!img.src.endsWith(ph.src)) img.src = ph.src;
      // se revela desde el negativo en 0.4 s
      follow.classList.add('is-neg');
      gsap.delayedCall(0, () => gsap.delayedCall(0, () => follow.classList.remove('is-neg')));
      if (!pos.on) { pos.x = e.clientX; pos.y = e.clientY; }
      pos.on = true;
      gsap.to(follow, { opacity: 1, duration: 0.25, overwrite: true });
    });
  });
  list.addEventListener('pointerleave', () => {
    items.forEach((it) => { if (!it.contains(document.activeElement)) it.classList.remove('is-on'); });
    pos.on = false;
    gsap.to(follow, { opacity: 0, duration: 0.25, overwrite: true });
  });
  list.addEventListener('pointermove', (e) => { pos.tx = e.clientX; pos.ty = e.clientY; });
  loop.add((time, ratio) => {
    if (!pos.on && follow.style.opacity === '0') return;
    const a = 1 - Math.pow(1 - FOLLOW.lerp, ratio);
    const dx = (pos.tx - pos.x) * a;
    pos.x += dx;
    pos.y += (pos.ty - pos.y) * a;
    pos.r += (Math.max(-FOLLOW.max, Math.min(FOLLOW.max, dx * FOLLOW.tilt * 10)) - pos.r) * a;
    follow.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0) rotate(${pos.r.toFixed(2)}deg)`;
  });
}
