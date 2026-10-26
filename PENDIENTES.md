# Pendientes de disco.

Lista de huecos (fotos y vídeos que faltan) y textos BORRADOR de la web. Ve tachando: `- [x]`.

- En el código, los textos BORRADOR llevan el atributo `data-draft`. Para encontrarlos, busca `data-draft`.
- Los huecos se ven como un visor con "FALTA FOTO" o "FALTA VÍDEO". Para cambiar uno por el archivo real, pon un `<img>` o `<video>` dentro de la misma `<figure class="ph">` y deja su `data-ratio`. El diseño no se mueve.

## Datos (js/config.js)

- [ ] **Email:** `equipo@discoproduccion.com`. Confirma que existe y que llega.
- [ ] **WhatsApp:** cambia `whatsapp.phone` (ahora `34600000000`, de relleno) y pon `ready.whatsapp: true`. Mientras sea `false`, no sale ningún botón de WhatsApp.
- [ ] **Teléfono visible:** `phone` y `ready.phone: true`. Ojo: el footer aún muestra `[TU TELÉFONO]` (no se ha tocado en este paso).
- [ ] **Tiempo de respuesta:** `responseTime`, p. ej. `'menos de 24 h'`. Sale en Contacto y en el footer.
- [ ] **Dominio ([DOMINIO]):** cuando exista, ponlo en `siteUrl` y además:
  - [ ] En el `<head>` de las 8 páginas, descomenta `canonical` y `og:url` y cambia [DOMINIO].
  - [ ] Pon `og:image` y `twitter:image` como URL completa (`https://dominio/assets/brand/og.jpg`).
  - [ ] `sitemap.xml`: cambia [DOMINIO] en las 8 URLs.
  - [ ] `robots.txt`: descomenta la línea `Sitemap`.
  - [ ] JSON-LD de index.html: añade `"url"`.
  - [ ] 404.html usa `<base href="/">`: si la web va en una subcarpeta, cámbialo.
- [ ] **Redes:** TikTok, YouTube y LinkedIn en `socials`, solo si existen.

## Home (index.html)

- [ ] **Prueba social:** `config.proof` en `js/config.js`. Logos de clientes (`{ src, alt }`) y 2–3 citas reales (`{ text, name, business }`). Con los dos vacíos la sección no aparece. Nada inventado.
- [ ] **Roles del equipo (BORRADOR):** los mismos que en Nosotros. Si cambian, cámbialos en los dos sitios.
- [ ] **"Cómo trabajamos":** ya no son los 3 pasos de Contacto, sino la frase "Conocemos tu marca…" con sus 4 notas. Si cambia el proceso, revisar también "Qué pasa después" de Contacto.

## Servicios (servicios.html, js/servicios-data.js)

Todo lo editable está en .

- [ ] **Fotos reales para la cubeta de revelado ():** 4–6 fotos de al menos 1600 px de ancho, con . Ahora hay 4 provisionales sacadas de la propia web (la terraza, la bola de discoteca, el retrato y el chico con la pala).
- [ ] **Fotos por sector ():** "Marcas, moda y producto" no tiene foto (no sale ninguna al pasar el ratón). Las demás son provisionales.
- [ ] **Proceso (BORRADOR):** los 8 pasos del cordel (), sus etiquetas de fase y en qué tramo de la barra cae cada uno.
- [ ] **Para quién (BORRADOR):** los 5 sectores y sus frases ().
- [ ] **Vídeos de la hoja de montaje (opcional, ):** cuando haya clips cortos y mudos, cada formato puede llevar uno. Falta programar que se enseñe al pasar el ratón; ahora solo está el campo.

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

- [ ] **Páginas legales:** tienen plantilla estándar (LSSI-CE y RGPD) que hay que **REVISAR CON UN PROFESIONAL ANTES DE PUBLICAR**. Huecos: [TITULAR], [NIF], [DOMICILIO], [FECHA], datos registrales, plazos de conservación y proveedores (privacidad).
- [ ] **Cookies:** la web no usa cookies de analítica ni de terceros, por eso no hay banner. Si se añade analítica, hay que poner banner y actualizar cookies.html.
- [ ] **Fuentes:** se cargan de Fontshare y Google Fonts (servicios externos). Alojarlas en el propio servidor es mejor para la privacidad y la velocidad.
- [ ] **Newsletter del footer:** sin servicio conectado (TODO en `js/footer.js`).
