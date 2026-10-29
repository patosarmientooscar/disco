# Hero de servicios en capas (U / V / X)

Sustituido por el hero reutilizable de las páginas interiores (js/page-hero.js, css/page-hero.css): vídeo a
pantalla completa, título enorme y el destello 3D de la home delante.

- `js/sv-hero.js`: capas con parallax por el ratón, entrada del título y salida con el scroll (U).
- `js/sv-video.js`: el vídeo "stacked alpha" pintado en dos canvas WebGL, fondo y figura, con el título entre
  medias (X).
- `hero.html`, `hero.css`: la maqueta y los estilos tal como estaban en servicios.html y css/servicios.css.
- `assets/`: hero-stack(-1280).mp4 (color arriba, máscara abajo) y sus pósters (fotograma 0; poster-fg con el
  color ya corregido, sin premultiplicar).

La versión con fotos (antes del vídeo) está en `legacy/servicios-v2-hero-fotos/`.
