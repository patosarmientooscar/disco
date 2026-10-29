# Capas del hero de servicios

Las tres fotos tienen el mismo encuadre (2560×1434, y 1280×717 para pantallas de menos de 900 px), así que superpuestas encajan píxel a píxel.

| Archivo | Qué es |
|---|---|
| `bg.webp`, `bg-1280.webp` | El fondo original, con el chico dentro. **No lo usa la web**: es la fuente de la placa limpia. |
| `bg-limpio.webp`, `bg-limpio-1280.webp` | El fondo que usa la web: el original sin el chico ni su estela. |
| `persona.webp`, `persona-1280.webp` | El chico recortado (con transparencia). |
| `luces.webp`, `luces-1280.webp` | Solo las estelas sobre negro (se pinta en modo `screen`). Con WebGL las pinta un shader vivo (js/sv-luces.js); la `<img>` se ve mientras carga, sin WebGL y con movimiento reducido. |
| `placa-limpia.js` | El script que genera `bg-limpio` (Node + sharp; la web no lo carga). |

**Por qué hay una placa limpia.** Con el parallax, la persona se mueve 36 px y el fondo 8 px. Si el fondo llevara al chico dentro, asomaría un segundo chico desplazado detrás del primero.

Cómo se rellena el hueco:

- En el interior, un tono oscuro como el del cuerpo: si llega a asomar, se lee como su sombra.
- Junto a los bordes derecho y de arriba, el color real de la niebla: es lo que asoma al separarse las capas.

**Si cambian las fotos**, vuelve a generar la placa desde esta carpeta:

```
node placa-limpia.js bg.webp persona.webp bg-limpio.webp bg-limpio-1280.webp
```
