# Filtros del portfolio (Todo, Restaurantes, Noche, Eventos, Marcas)

Quitados de portfolio.html por petición de Oscar. Para volver a ponerlos: el HTML va encima de la rejilla (`[data-grid]`, dentro de `#trabajos`), la función en js/portfolio.js (llamarla tras pintar la rejilla: `initFilters({ gsap, grid, reduced })`, y en los estados vacío y destacado ocultar `[data-filters]`), los estilos en css/portfolio.css y `<script src="assets/vendor/Flip-3.12.5.min.js" defer></script>` antes de js/page.js.

## HTML

```html
      <div class="pf__filters" role="group" aria-label="Filtrar trabajos" data-filters>
        <button type="button" class="pf__filter" data-filter="all" aria-pressed="true">Todo</button>
        <button type="button" class="pf__filter" data-filter="restaurantes" aria-pressed="false">Restaurantes</button>
        <button type="button" class="pf__filter" data-filter="noche" aria-pressed="false">Noche</button>
        <button type="button" class="pf__filter" data-filter="eventos" aria-pressed="false">Eventos</button>
        <button type="button" class="pf__filter" data-filter="marcas" aria-pressed="false">Marcas</button>
      </div>
```

## JS

```js
// --- filtros: Flip de gsap (el plugin se carga en portfolio.html) ---
function initFilters({ gsap, grid, reduced }) {
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const items = [...grid.children];
  const Flip = window.Flip;
  if (Flip) gsap.registerPlugin(Flip);
  buttons.forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.filter;
    buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const state = Flip && !reduced.matches ? Flip.getState(items) : null;
    items.forEach((li) => li.classList.toggle('is-out', f !== 'all' && li.dataset.cat !== f));
    if (state) {
      Flip.from(state, {
        duration: 0.6,
        ease: 'power3.inOut',
        absolute: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.5 }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.94, duration: 0.35 }),
      });
    }
    setCount(items.filter((li) => !li.classList.contains('is-out')).length);
  }));
}
```

## CSS

```css
/* --- filtros --- */
.pf__filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: clamp(28px, 4vh, 48px); }
.pf__filter {
  min-height: 44px;
  padding: 0 20px;
  border: 1px solid rgb(244 242 239 / 0.28);
  border-radius: 999px;
  font: 400 15px / 1 var(--font-display);
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
.pf__filter:hover { border-color: var(--paper); }
.pf__filter[aria-pressed="true"] { background: var(--paper); border-color: var(--paper); color: var(--ink); }
```
