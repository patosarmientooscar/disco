# Footer con el logo "disco" gigante y física (hasta BC-A)

El footer tenía un logo "disco" enorme como suelo: al llegar al final, el destello "se moría" (parpadeo) y caía con
gravedad (matter-js, cargado desde CDN por `fin-physics.js`) sobre las letras; se podía coger y lanzar, y si se
encajaba en el hueco de la estrella encima de la O, flash y "Ya sabes dónde encontrarnos →".

Aquí están los tres archivos tal como estaban: `fin.js`, `fin.css` y `fin-physics.js`.

## Cómo volver
1. `git revert` del commit BC-A (lo más limpio), o a mano:
2. Copiar `fin.js` y `fin.css` de esta carpeta sobre `js/fin.js` y `css/fin.css`, y `fin-physics.js` a `js/`.
3. En `js/star.js` (`footerPoint`) y `js/page-star.js` (`footerStop`): volver a `x: 0` y a `finStop(max, GROW)` /
   `finStop(max, 1)` (el final encima del hueco del logo). Los adaptadores `footer` de los dos siguen teniendo
   `hold`, `release` y `flicker`, que es lo que usaba la física.
4. Volver a poner `<link rel="modulepreload" href="js/fin-physics.js">` en las páginas que lo tenían (index, contacto,
   nosotros, portfolio…) y ejecutar `node tools/version.mjs`.
