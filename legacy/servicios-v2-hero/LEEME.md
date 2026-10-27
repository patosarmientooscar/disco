# Hero de servicios anterior (sustituido por el hero en capas)

Es la cabecera tipográfica de servicios.html hasta el commit `eea12fe`: "De la idea / a la pantalla." sobre negro, con parallax entre las dos líneas. Incluye también la luz roja que seguía al cursor, que se quitó porque chocaba con la foto nueva.

| Archivo | Qué es |
|---|---|
| `servicios-hero.html` | La luz roja (`<i class="sv-light sv-light--red">`) y el `<header class="sv-head">`. Iban al principio del `<main>`. |
| `servicios-hero.css` | Sus estilos, antes en css/servicios.css. Las clases compartidas `.sv-mask`, `.sv-more` y `.sv-btn` siguen allí. |
| `servicios-hero.js` | `initHead` e `initLights` y sus constantes, antes en js/servicios.js. |

Para volver a verlo: `git checkout eea12fe -- servicios.html css/servicios.css js/servicios.js`.
