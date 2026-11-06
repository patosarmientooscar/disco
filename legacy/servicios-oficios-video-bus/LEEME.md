# "Tres oficios": el panel Vídeo con el vídeo del autobús (antes de AR-E)

Hasta AR-E el panel Vídeo de servicios.html llevaba el baile en el bus (`assets/servicios/oficios-real/bus.mp4`,
`bus-720.mp4`, póster `bus-poster.webp`), con el botón de sonido (`.of-sound`), el botón "Reproducir" de movimiento
reducido (`.of-play`) y el timecode real del vídeo. Desde AR-E es una foto de E, S, B (`video-esb.webp`) con el
mismo efecto (corte, bandas de cine, REC, timecode) y un movimiento lento de cámara.

- `panel-video.html`: el `<article class="of-panel of-panel--video">` tal cual.
- `oficios.js`: el módulo entero antes del cambio (`videoFx`).
- `servicios-video.css`: las reglas de `.of-video`, `.of-play` y `.of-sound`.
Los vídeos siguen en `assets/servicios/oficios-real/`.
