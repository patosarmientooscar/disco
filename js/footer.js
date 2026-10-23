import { config } from './config.js';

// Footer de todas las páginas: la página "Edit" de un programa de edición de vídeo. Cada herramienta hace
// el trabajo de una parte normal de un footer: Media Pool = menú de páginas, Visor = llamada a la acción,
// Inspector = contacto y newsletter, Línea de tiempo = redes, páginas, contacto y legal, pestañas de
// página = navegación. El cabezal se mueve con el ratón (scrub), con ← → o reproduciendo; el clip de V1
// que pisa cambia el visor con un "corte". Todo en el loop único (gsap.ticker), solo con el footer en pantalla.
const TOTAL = 30;      // segundos de la línea de tiempo (5 clips × 6 s)
const FPS = 25;
const SCRUB = 0.25;    // lerp del cabezal hacia el ratón
const PLAY_STEP = 2.4; // s por clip al reproducir

// Páginas: clip del Media Pool, de V1, pestaña y contenido del visor
const PAGES = [
  { name: 'Inicio', href: 'index.html', dur: '00:12', label: 'CLIP 01 · INICIO', title: ['Ponle ritmo', 'a tu negocio'], cta: 'Hablemos', to: 'contacto.html', icon: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z' },
  { name: 'Servicios', href: 'servicios.html', dur: '00:18', label: 'CLIP 02 · SERVICIOS', title: ['Foto, vídeo', 'y edición'], cta: 'Ver servicios', to: 'servicios.html', icon: 'M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { name: 'Portfolio', href: 'portfolio.html', dur: '00:24', label: 'CLIP 03 · PORTFOLIO', title: ['Lo que ya', 'hemos grabado'], cta: 'Ver trabajos', to: 'portfolio.html', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  { name: 'Nosotros', href: 'nosotros.html', dur: '00:09', label: 'CLIP 04 · NOSOTROS', title: ['Luna y Bruno,', 'detrás de la cámara'], cta: 'Conócenos', to: 'nosotros.html', icon: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M12.5 14.5c1-.3 2.2-.5 3.5-.5 3.3 0 6 2.7 6 6' },
  { name: 'Contacto', href: 'contacto.html', dur: '00:06', label: 'CLIP 05 · CONTACTO', title: ['¿Rodamos', 'juntos?'], cta: 'Escríbenos', to: 'contacto.html', icon: 'M4 5h16v11H9l-5 4z' },
];
const THUMBS = ['inicio', 'servicios', 'portfolio', 'nosotros', 'contacto'];
const LEGAL = [
  { name: 'Aviso legal', href: 'aviso-legal.html' },
  { name: 'Privacidad', href: 'privacidad.html' },
  { name: 'Cookies', href: 'cookies.html' },
];

export function initFooter({ gsap, ScrollTrigger, reduced, loop }) {
  const root = document.querySelector('[data-footer]');
  if (!root) return;
  const file = location.pathname.split('/').pop() || 'index.html';
  const current = PAGES.findIndex((p) => p.href === file); // -1 en las páginas legales
  root.innerHTML = markup(current);
  root.className = 'ed'; // fuera el menú sencillo de respaldo (.ed-fallback)

  const tl = root.querySelector('[data-ed-tl]');
  const lanes = root.querySelector('[data-ed-lanes]');
  const head = root.querySelector('[data-ed-playhead]');
  const tcs = [...root.querySelectorAll('[data-ed-tc]')];
  const pageClips = [...root.querySelectorAll('[data-ed-page]')];
  const tabs = [...root.querySelectorAll('[data-ed-tab]')];
  const shot = root.querySelector('[data-ed-shot]');
  const black = root.querySelector('[data-ed-black]');
  const playBtn = root.querySelector('[data-ed-play]');
  const wave = root.querySelector('[data-ed-wave]');

  // --- forma de onda (canvas): barras de 2px desde la línea central; k = cuánto han crecido ---
  const drawWave = (k = 1) => {
    if (!wave) return;
    const dpr = Math.min(devicePixelRatio, 2);
    const w = wave.clientWidth;
    const h = wave.clientHeight;
    if (!w || !h) return;
    wave.width = w * dpr;
    wave.height = h * dpr;
    const g = wave.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = '#6fbf8a';
    const rnd = seeded(3);
    for (let x = 0; x < w; x += 3) {
      const env = 0.35 + 0.65 * Math.abs(Math.sin(x / 37) * Math.sin(x / 11 + 1));
      const bar = Math.max(1, (0.15 + 0.85 * rnd()) * env * (h - 2) * k);
      g.fillRect(x, (h - bar) / 2, 2, bar);
    }
  };

  // --- cabezal: f de 0 a 1 a lo ancho de las pistas ---
  const centerOf = (i) => (i + 0.5) / PAGES.length;
  const rest = centerOf(Math.max(0, current));
  const state = { f: reduced.matches ? rest : 0, target: rest, active: -1, playing: false, clock: 0, sweeping: false, visible: false, applied: -1 };
  const timecode = (f) => {
    const frames = Math.round(f * TOTAL * FPS);
    const ff = frames % FPS;
    const s = Math.floor(frames / FPS);
    const pad = (n) => String(n).padStart(2, '0');
    return `01:${pad(Math.floor(s / 60))}:${pad(s % 60)}:${pad(ff)}`;
  };

  // corte de edición: el plano viejo se va (0.15 s), 1 frame en negro y entra el nuevo
  let cutTl = null;
  const cut = (i) => {
    const p = PAGES[i];
    const fill = () => {
      shot.querySelector('[data-ed-label]').textContent = p.label;
      shot.querySelector('[data-ed-title]').innerHTML = `${p.title[0]}<br>${p.title[1]}`;
      const a = shot.querySelector('[data-ed-cta]');
      a.href = p.to;
      a.querySelector('span').textContent = p.cta;
    };
    if (reduced.matches) { fill(); return; }
    cutTl?.kill();
    cutTl = gsap.timeline()
      .to(shot, { opacity: 0, duration: 0.15, ease: 'none' })
      .set(black, { opacity: 1 })
      .call(fill)
      .set(shot, { opacity: 1 }, '+=0.04')
      .set(black, { opacity: 0 }, '<');
  };
  const activate = (i) => {
    if (i === state.active) return;
    state.active = i;
    pageClips.forEach((c, k) => c.classList.toggle('is-active', k === i));
    tabs.forEach((t, k) => t.classList.toggle('is-lit', k === i));
    cut(i);
  };

  const apply = () => {
    if (state.f === state.applied) return;
    state.applied = state.f;
    head.style.transform = `translateX(${state.f * lanes.clientWidth}px)`;
    const tc = timecode(state.f);
    tcs.forEach((el) => { el.textContent = tc; });
    activate(Math.min(PAGES.length - 1, Math.floor(state.f * PAGES.length)));
  };

  // --- loop: solo con el footer en pantalla ---
  const tick = (time, ratio) => {
    if (!state.visible) return;
    if (state.playing) {
      state.clock += ratio / 60;
      if (state.clock >= PLAY_STEP) {
        state.clock = 0;
        state.target = centerOf((state.active + 1) % PAGES.length);
        if (reduced.matches) state.f = state.target;
      }
    }
    if (!state.sweeping) {
      const d = state.target - state.f;
      state.f = Math.abs(d) < 1e-4 ? state.target : state.f + d * (1 - Math.pow(1 - SCRUB, ratio));
    }
    apply();
  };
  loop.add(tick);

  const setPlaying = (on) => {
    state.playing = on;
    state.clock = 0;
    playBtn.setAttribute('aria-pressed', String(on));
    playBtn.setAttribute('aria-label', on ? 'Pausa' : 'Reproducir');
    playBtn.classList.toggle('is-playing', on);
  };
  const step = (dir) => {
    const i = Math.max(0, state.active);
    state.target = centerOf((i + dir + PAGES.length) % PAGES.length);
  };

  // scrub con el ratón; al salir vuelve al clip de la página actual
  const fAt = (x) => {
    const r = lanes.getBoundingClientRect();
    return gsap.utils.clamp(0, 0.9999, (x - r.left) / r.width);
  };
  tl.addEventListener('pointerenter', () => setPlaying(false));
  tl.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && !state.sweeping) state.target = fAt(e.clientX); });
  tl.addEventListener('pointerleave', () => { state.target = rest; });
  // teclado: solo dentro de la línea de tiempo
  tl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setPlaying(false);
      step(e.key === 'ArrowRight' ? 1 : -1);
    } else if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      setPlaying(!state.playing);
    }
  });
  playBtn.addEventListener('click', () => setPlaying(!state.playing));
  root.querySelector('[data-ed-prev]').addEventListener('click', () => { setPlaying(false); step(-1); });
  root.querySelector('[data-ed-next]').addEventListener('click', () => { setPlaying(false); step(1); });

  // --- inspector: copiar email/teléfono; newsletter sin servicio conectado ---
  const status = root.querySelector('[data-ed-status]');
  root.querySelectorAll('[data-ed-copy]').forEach((b) => {
    b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.edCopy);
        b.textContent = 'Copiado';
        status.textContent = `Copiado: ${b.dataset.edCopy}`;
      } catch {
        status.textContent = 'No se ha podido copiar';
      }
      setTimeout(() => { b.textContent = 'Copiar'; }, 1600);
    });
  });
  const form = root.querySelector('[data-ed-news]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    // TODO: conectar el servicio de newsletter (Mailchimp, Brevo…). Ahora no se envía nada.
    form.querySelector('[data-ed-news-status]').textContent = 'Gracias, te avisaremos';
    form.reset();
  });

  // --- entrada (una vez): bordes, clips desde la izquierda, la onda crece y el cabezal barre ---
  let entered = false;
  const enter = () => {
    entered = true;
    if (reduced.matches) { drawWave(1); return; }
    const panels = root.querySelectorAll('[data-ed-panel]');
    const clips = root.querySelectorAll('.ed-clip, .ed-pool__clip');
    const wk = { k: 0 };
    state.sweeping = true;
    gsap.timeline({ onComplete: () => { state.sweeping = false; state.target = rest; } })
      .fromTo(panels, { clipPath: 'inset(0 100% 100% 0)' }, { clipPath: 'inset(0 0% 0% 0)', duration: 0.4, ease: 'power2.out', stagger: 0.06, clearProps: 'clipPath' })
      .fromTo(clips, { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.04, clearProps: 'transform' }, 0.15)
      .to(wk, { k: 1, duration: 0.8, ease: 'power2.out', onUpdate: () => drawWave(wk.k) }, 0.3)
      .fromTo(state, { f: 0 }, { f: rest, duration: 1.2, ease: 'power3.inOut' }, 0.2);
  };

  new IntersectionObserver(([e]) => {
    state.visible = e.isIntersecting;
    if (!e.isIntersecting && state.playing) setPlaying(false); // pausa automática fuera de pantalla
    if (e.isIntersecting && !entered) enter();
  }, { threshold: 0.2 }).observe(root);

  window.addEventListener('resize', () => { drawWave(entered ? 1 : 0); state.applied = -1; });
  drawWave(reduced.matches ? 1 : 0);
  state.applied = -1;
  apply();
}

// ---------------- marcado ----------------
function markup(current) {
  const email = config.email || '[TU EMAIL]';
  const phone = config.phone || '[TU TELÉFONO]';
  const tel = config.phone ? config.phone.replace(/[^\d+]/g, '') : '';
  const socials = (config.socials || []).filter((s) => s.url);
  const ig = socials.find((s) => s.name === 'Instagram');
  const response = config.responseTime || '[TIEMPO DE RESPUESTA]';
  const tc = (s) => `01:00:${String(s).padStart(2, '0')}:00`;
  const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
  const cur = (i) => (i === current ? ' aria-current="page"' : '');
  const lane = (items, cls) => items.map((it, i) => {
    const x = (i / items.length) * 100;
    const w = 100 / items.length;
    return `<li class="ed-clip ${cls}" style="--x:${x};--w:${w}">${it}</li>`;
  }).join('');

  return `
  <div class="ed__top" data-ed-panel>
    <a class="ed__logo" href="index.html" aria-label="disco.es, inicio">disco<span>.</span></a>
    <p class="ed__project">Proyecto: disco.es — Línea de tiempo: Home_final_v3</p>
    <p class="ed__live"><i aria-hidden="true"></i>EN DIRECTO DESDE MADRID</p>
    <p class="ed__tc" data-ed-tc aria-hidden="true">01:00:00:00</p>
  </div>

  <div class="ed__panels">
    <section class="ed-pool" data-ed-panel aria-labelledby="ed-pool-h">
      <h2 class="ed-head" id="ed-pool-h">Media Pool · Páginas</h2>
      <nav aria-label="Páginas">
        <ul class="ed-pool__grid">
          ${PAGES.map((p, i) => `<li><a class="ed-pool__clip" href="${p.href}"${cur(i)}>
            <img src="assets/footer/thumb-${THUMBS[i]}.webp" width="252" height="124" alt="" loading="lazy" decoding="async">
            <span class="ed-pool__name">${p.name}</span><span class="ed-pool__dur">${p.dur}</span></a></li>`).join('')}
        </ul>
      </nav>
      <p class="ed-foot">5 clips · 1 bin · 25 fps</p>
    </section>

    <section class="ed-visor" data-ed-panel aria-label="Visor">
      <div class="ed-visor__monitor" data-ed-monitor>
        <i class="ed-visor__safe" aria-hidden="true"></i>
        <p class="ed-visor__tc" data-ed-tc aria-hidden="true">01:00:00:00</p>
        <div class="ed-visor__shot" data-ed-shot>
          <p class="ed-visor__label" data-ed-label>${PAGES[0].label}</p>
          <p class="ed-visor__title" data-ed-title>${PAGES[0].title[0]}<br>${PAGES[0].title[1]}</p>
          <a class="ed-visor__cta" data-ed-cta href="${PAGES[0].to}"><span>${PAGES[0].cta}</span> <b aria-hidden="true">→</b></a>
        </div>
        <i class="ed-visor__black" data-ed-black aria-hidden="true"></i>
      </div>
      <div class="ed-transport">
        <button type="button" class="ed-btn" data-ed-prev aria-label="Clip anterior">${icon('M18 6v12L9 12zM7 6v12')}</button>
        <button type="button" class="ed-btn ed-btn--play" data-ed-play aria-label="Reproducir" aria-pressed="false">
          <svg class="ed-ico-play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z"/></svg>
          <svg class="ed-ico-pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>
        </button>
        <button type="button" class="ed-btn" data-ed-next aria-label="Clip siguiente">${icon('M6 6v12l9-6zM17 6v12')}</button>
      </div>
    </section>

    <section class="ed-insp" data-ed-panel aria-labelledby="ed-insp-h">
      <h2 class="ed-head" id="ed-insp-h">Inspector · Contacto</h2>
      <div class="ed-insp__body">
        <address class="ed-block">
          <h3 class="ed-block__head">Transform · Estudio</h3>
          <dl class="ed-rows">
            <div><dt>Ciudad</dt><dd>Madrid</dd></div>
            <div><dt>Email</dt><dd><a href="mailto:${email}">${email}</a><button type="button" class="ed-copy" data-ed-copy="${email}">Copiar</button></dd></div>
            <div><dt>Teléfono</dt><dd>${tel ? `<a href="tel:${tel}">${phone}</a><button type="button" class="ed-copy" data-ed-copy="${phone}">Copiar</button>` : phone}</dd></div>
            <div><dt>Instagram</dt><dd>${ig ? `<a href="${ig.url}" rel="noopener" target="_blank">${ig.handle}</a>` : '[TU INSTAGRAM]'}</dd></div>
          </dl>
        </address>
        <div class="ed-block">
          <h3 class="ed-block__head">Ritmo de respuesta</h3>
          <div class="ed-slider" aria-hidden="true"><i style="width:86%"></i></div>
          <p class="ed-slider__val">${response}</p>
        </div>
        <form class="ed-block ed-news" data-ed-news>
          <h3 class="ed-block__head">Render en cola · Newsletter</h3>
          <label class="ed-news__label" for="ed-news-email">Tu email para novedades</label>
          <div class="ed-news__row">
            <input class="ed-news__input" id="ed-news-email" type="email" name="email" required autocomplete="email" placeholder="tu@email.com">
            <button class="ed-news__btn" type="submit">Añadir</button>
          </div>
          <p class="ed-news__status" data-ed-news-status role="status"></p>
        </form>
        <p class="ed-sr" data-ed-status role="status"></p>
      </div>
    </section>
  </div>

  <div class="ed-tl" data-ed-tl data-ed-panel tabindex="0" role="group" aria-label="Línea de tiempo. Flechas izquierda y derecha para moverte entre páginas; Espacio para reproducir o pausar.">
    <div class="ed-tl__ruler" aria-hidden="true"><span class="ed-tl__corner"></span>
      <ol class="ed-tl__ticks">${[0, 6, 12, 18, 24].map((s, i) => `<li style="--x:${i * 20}">${tc(s)}</li>`).join('')}</ol>
    </div>
    <div class="ed-track ed-track--v2"><p class="ed-track__head"><b>V2</b> Redes</p>
      <ul class="ed-track__lane">${lane(socials.map((s) => `<a href="${s.url}" rel="noopener" target="_blank"><span>${s.name}</span><small>${s.handle}</small></a>`), 'ed-clip--social')}</ul>
    </div>
    <div class="ed-track ed-track--v1"><p class="ed-track__head"><b>V1</b> Páginas</p>
      <ul class="ed-track__lane" data-ed-lanes>${lane(PAGES.map((p, i) => `<a href="${p.href}" data-ed-page${cur(i)}><span>${p.name}</span><small>${tc(i * 6)}</small></a>`), 'ed-clip--page')}</ul>
    </div>
    <div class="ed-track ed-track--a1"><p class="ed-track__head"><b>A1</b> Contacto</p>
      <ul class="ed-track__lane">
        <li class="ed-clip ed-clip--audio" style="--x:0;--w:60"><a href="mailto:${email}"><canvas class="ed-wave" data-ed-wave aria-hidden="true"></canvas><span>Voz · ${email} · ${phone}</span></a></li>
        <li class="ed-clip ed-clip--audio ed-clip--music" style="--x:60;--w:40"><div><span>Música · Madrid, España</span></div></li>
      </ul>
    </div>
    <div class="ed-track ed-track--a2"><p class="ed-track__head"><b>A2</b> Legal</p>
      <ul class="ed-track__lane">${lane(LEGAL.map((l) => `<a href="${l.href}"><span>${l.name}</span></a>`), 'ed-clip--legal')}</ul>
    </div>
    <div class="ed-tl__head" data-ed-playhead aria-hidden="true"><i></i></div>
  </div>

  <div class="ed-tabs" data-ed-panel>
    <nav class="ed-tabs__nav" aria-label="Pestañas de página">
      <ul>${PAGES.map((p, i) => `<li><a class="ed-tab${i === current ? ' is-current' : ''}" href="${p.href}" data-ed-tab${cur(i)}>${icon(p.icon)}${p.name}</a></li>`).join('')}</ul>
    </nav>
    <p class="ed-copyright">© 2026 disco. Todos los derechos reservados</p>
  </div>`;
}

// pseudoaleatorio con semilla (mulberry32): la misma onda cada vez
function seeded(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
