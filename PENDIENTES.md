# Pendientes de disco.

Lista de huecos (fotos y vídeos que faltan) y textos BORRADOR de la web. Ve tachando: `- [x]`.

- En el código, los textos BORRADOR llevan el atributo `data-draft`. Para encontrarlos, busca `data-draft`.
- Los huecos se ven como un visor con "FALTA FOTO" o "FALTA VÍDEO". Para cambiar uno por el archivo real, pon un `<img>` o `<video>` dentro de la misma `<figure class="ph">` y deja su `data-ratio`. El diseño no se mueve.

## Datos (js/config.js)

- [ ] **Email:** `equipo@discoproduccion.com`. Confirma que existe y que llega.
- [ ] **WhatsApp:** cambia `whatsapp.phone` (ahora `34600000000`, de relleno) y pon `ready.whatsapp: true`. Mientras sea `false`, no sale ningún botón de WhatsApp.
- [ ] **Teléfono visible:** `phone` y `ready.phone: true`. Ojo: el footer aún muestra `[TU TELÉFONO]` (no se ha tocado en este paso).
- [ ] **Tiempo de respuesta:** `responseTime`, p. ej. `'menos de 24 h'`. Sale en Contacto y en el footer.
- [ ] **Dominio:** `siteUrl`, p. ej. `'https://disco.es'`, para canonical y og:url (prompt N).
- [ ] **Redes:** TikTok, YouTube y LinkedIn en `socials`, solo si existen.
- [ ] **Favicon:** `assets/brand/favicon.svg` ahora es el icono provisional de la home (prompt N).

## Contacto (contacto.html, js/contact.js)

- [ ] **Envío del formulario:** `FORM_ENDPOINT` en `js/contact.js`. Elegir Formspree, Web3Forms o Netlify Forms y pegar la URL. Mientras esté vacío, el botón abre el correo (mailto) con todo ya escrito.
- [ ] **Rangos de presupuesto:** `[RANGO 1]`, `[RANGO 2]` y `[RANGO 3]`, en el campo 7 del formulario.
- [ ] **"Qué pasa después":** los 3 pasos son BORRADOR. Revisar el texto.
- [ ] **Preguntas frecuentes (BORRADOR).** Rellenar:
  - [ ] Precio: `[Si queréis: sesiones desde X €]`
  - [ ] Plazos: `[X días]` para foto y `[X días]` para vídeo
  - [ ] Fuera de Madrid: `[Fuera de Madrid, consúltanos]`
  - [ ] Uso del contenido: `[Confirmar condiciones]`
- [ ] **FAQ duplicadas.** Las preguntas están también en el JSON-LD del `<head>` de contacto.html (para Google). Si cambias una, cambia las dos.

## Portfolio (portfolio.html, js/portfolio-data.js)

Todo se rellena en `js/portfolio-data.js`, que trae un ejemplo comentado. Las carpetas van en `assets/portfolio/`.

- [ ] **Showreel (vídeo):**
  - Archivo: `assets/portfolio/showreel.mp4`, de 30–60 s.
  - Formato: 16:9, 1920×1080, H.264, unos 8–12 MB.
  - Póster: `showreel.webp`, 1920×1080.
  - Dónde se pone: `showreel.src` y `showreel.poster`.
- [ ] **Trabajos.** Cada uno lleva:
  - Portada: `assets/portfolio/<slug>/cover.webp`, de 1200 px de ancho, en 4:5 (1200×1500), 1:1 (1200×1200) o 9:16 (1200×2133).
  - Fotos de la ficha: webp de 1600–2000 px en el lado largo.
  - Vídeos de la ficha: mp4 H.264 con póster webp.
  - Opcional: `preview.mp4`, mudo, de 3–6 s y 720 px, que se reproduce al pasar el ratón.
  - Datos: título, cliente, categoría (`restaurantes`, `noche`, `eventos` o `marcas`), año y qué se entregó.
- [ ] Mientras no haya trabajos, la página enseña 6 huecos y el aviso "Estamos rodando nuestros primeros proyectos." No hay que hacer nada.

## Nosotros (nosotros.html)

- [ ] **Subtítulo (BORRADOR):** "Una productora pequeña, rápida y cercana…"
- [ ] **Manifiesto (BORRADOR):** "Creemos que cada negocio tiene una energía propia…"
- [ ] **Foto de Bruno:** `assets/team/bruno-marin-1280.webp` y `-720.webp` son provisionales. Hace falta la foto real, en 4:5 y 1280×1600, con el mismo nombre (se usa también en la home).
- [ ] **Roles (BORRADOR), confirmar:** "COFUNDADORA · DIRECCIÓN Y FOTO" y "COFUNDADOR · VÍDEO Y EDICIÓN".
- [ ] **Bios (BORRADOR):** dos líneas para Luna y dos para Bruno.
- [ ] **Kit favorito:** `[cámara / objetivo]` de cada uno.
- [ ] **Instagram personal** de Luna y de Bruno, si existe. Si no, no se pone nada.
- [ ] **"Cómo trabajamos" (BORRADOR):** las 4 frases de los pasos.
- [ ] **El estudio:** `[DIRECCIÓN O ZONA]`. Si no hay estudio fijo, borra la sección `.ab-studio` de nosotros.html.

## Otros

- [ ] **Páginas legales:** aviso legal, privacidad y cookies siguen en "Próximamente". El formulario enlaza a privacidad.html.
- [ ] **Newsletter del footer:** sin servicio conectado (TODO en `js/footer.js`).
