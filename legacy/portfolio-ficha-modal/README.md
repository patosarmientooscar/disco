# Portfolio: la ficha en <dialog> y la galería del destacado (hasta la tarea AB)

Antes, "Ver proyecto" abría una ficha modal (`portfolio.html#slug`) y el proyecto destacado enseñaba en el propio
listado sus dos reels y las 20 fotos con un visor. Ahora cada proyecto tiene su página (`proyecto.html#slug`,
`js/proyecto.js`, `css/proyecto.css`) y el listado solo deja 3 fotos de adelanto.

- `ficha.html`: el `<dialog>` de la ficha que había en `portfolio.html`.
- `portfolio.css`: los estilos quitados de `css/portfolio.css` (ficha, reels, galería y visor).
- `portfolio.js`: el `js/portfolio.js` de entonces (initModal, initFeatured con reels y galería, initViewer).
