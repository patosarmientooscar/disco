# Servicios v2 "Dispara" y la hoja de montaje (sustituidas por "tres oficios")

Las secciones de foto y vídeo de servicios.html hasta el commit `9399961`:

- **"Dispara":** la sala a oscuras con la linterna, el flash, el muro de fotos y la foto ampliada.
- **Hoja de montaje:** los formatos de vídeo como clips, con el cabezal y el timecode.

Las sustituye una sola sección, "Tres oficios" (js/oficios.js): una foto partida en tres paneles que se abren.

| Archivo | Qué es |
|---|---|
| `shoot.js` | "Dispara" entero (antes en js/). |
| `servicios-foto-video.html` | El HTML de las dos secciones y del `<dialog>`. Iban entre el manifiesto y el proceso. |
| `servicios-foto-video.css` | Sus estilos (antes en css/servicios.css), con sus reglas de móvil y de movimiento reducido. |
| `servicios-foto-video.js` | La hoja de montaje (`initEdl`, antes en js/servicios.js) y los datos `shots` y `formats` (antes en js/servicios-data.js). |

Para volver a verlas, lo más rápido es `git checkout 9399961 -- servicios.html css/servicios.css js/servicios.js js/servicios-data.js js/shoot.js`.
