# Panel Edición de "Tres oficios" como sala de montaje (servicios, hasta la tarea BG)

El visor ocupaba todo el panel con la foto de E, S, B en dos estados (LOG: en bruto, con un filtro CSS; GRADE: tal
cual), una cortinilla que seguía al ratón y un movimiento lento de cámara (escala 1.04 → 1.10). Debajo, la línea de
tiempo: V1 con los 8 clips del reel de la fiesta (`tira-reel.webp`), A1 con la forma de onda real de su audio (`WAVE`)
y un cabezal que la recorría.

Sustituido en BG por un antes / después con fotos reales (la misma foto sin editar y editada) y una tira de miniaturas
para elegir la pareja (`edicionPares` en `js/servicios-data.js`).

- `panel-edicion.html`: el marcado del panel.
- `edicion.css`: su bloque de `css/servicios.css` (en el bloque de móvil había además `.of-tl { padding: 8px 10px 8px 8px; }`).
- `oficios.js`: el `js/oficios.js` entero de entonces (con la serie de fotos de BG-A ya hecha). Lo de Edición:
  `editFx`, `WAVE`, `CLIPS`, `DOLLY`, `WIPE` y `SRC.edit`.
- `assets/`: `tira-reel.webp` y `video-esb.webp` / `video-esb-1200.webp` (estaban en `assets/servicios/oficios-real/`).
