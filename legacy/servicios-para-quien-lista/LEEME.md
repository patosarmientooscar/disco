# "Para quién": la lista tipográfica (antes de AT-C)

Hasta AT-C, "Para quién" de servicios.html era una lista tipográfica de sectores. En escritorio, al pasar el ratón, salía la frase y una foto pequeña que seguía al cursor (`.sv-follow`, revelándose desde el negativo). En móvil era un acordeón con la foto. Desde AT-C es un carrusel en arco: `js/arc-carousel.js`.

En esta carpeta:

- `para-quien.html`: la sección tal cual.
- `para-quien.css`: sus reglas (escritorio y móvil).
- `initSectors.js`: la función de `js/servicios.js`, incluida la foto que sigue al cursor (necesita `FOLLOW = { lerp: 0.12, tilt: 0.06, max: 8 }`).

El destello del recorrido (`js/page-star.js`, `matePose`) se ponía a la derecha de la fila que tenías encima.
