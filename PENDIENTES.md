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
- [x] **Roles del equipo:** confirmados (AD), los mismos que en Nosotros. Si cambian, cámbialos en los dos sitios.
- [ ] **"Cómo trabajamos":** ya no son los 3 pasos de Contacto, sino la frase "Conocemos tu marca…" con sus 4 notas. Si cambia el proceso, revisar también "Qué pasa después" de Contacto.

## Servicios (servicios.html, js/servicios-data.js)

Los sectores están en `js/servicios-data.js`. Los textos de "Tres oficios" y del proceso (bento) están en `servicios.html`.

- [x] **Hero de Servicios:** vídeo real, el DISCO VIDEO sin rótulos (`assets/paginas/servicios-bg.mp4`, `-1280` y `servicios-poster.webp`). El botón "Ver el manifiesto · 0:38" abre el vídeo completo con sonido (`assets/paginas/disco-manifiesto.mp4`). Si cambia su duración, cambia también el texto del botón en servicios.html.

- [x] **"Tres oficios" con material real** (la bailarina, en `legacy/servicios-oficios-bailarina/`). Foto: `assets/servicios/oficios-real/foto.webp` (si se cambia, ajusta las caras del AF en `FACES` de js/oficios.js). Vídeo: `assets/servicios/oficios-real/bus.mp4` (y `bus-720.mp4`, el baile en el bus, con su sonido: el botón le quita el silencio). Edición: `reel-fiesta.mp4` en el visor; `oficios-real/tira-reel.webp` son sus 8 clips (160×90 cada uno) y la forma de onda de A1 es la de su audio (`WAVE` en js/oficios.js, sacada con ffmpeg): si cambia el reel, hay que rehacer las dos.
- [x] **Fotos por sector (`sectors[].photo`):** reales en Eventos (Cachondeo Group), Marcas (pádel), Empresas y artistas (directo) y Deportes (rugby).
- [ ] **Foto de Restaurantes y gastronomía:** sigue la provisional (`assets/hero/03.webp`). Falta una foto real de un restaurante.
- [ ] **Proceso (BORRADOR):** los 8 textos de las tarjetas del bento, en `servicios.html` (`data-draft`).
- [x] **Fotos de las tarjetas del proceso:** reales (Cachondeo Group). "Postproducción" es un antes / después real: `assets/servicios/post/post-antes.webp` (RAW) y `post-despues.webp` (DISCO GRADE), con sus versiones `-1000`. "Entrega a medida": `cachondeo-02`.
- [ ] **Formulario de contacto (EmailJS):** rellenar las claves de `js/config.js` → `emailjs` siguiendo `docs/emailjs/LEEME.md` (cuenta gratis, conectar equipo@discoproduccion.com, pegar la plantilla `docs/emailjs/email-nuevo-contacto.html`). Hasta entonces el formulario dice "Formulario en configuración" y da el email. Cuando la web esté publicada: restringir el dominio en EmailJS.
- [ ] **Tiempo de respuesta:** si confirmáis "menos de 24 h", ponlo en `js/config.js` → `responseTime: 'menos de 24 h'` (contacto pasa de "muy pronto" a "en menos de 24 h").
- [ ] **Nosotros, el hero "Somos disco.":** la frase "Dos personas, una cámara y muchas ganas de contar lo que pasa." es BORRADOR. (El contraplano con los retratos, en legacy/nosotros-contraplano/.)
- [x] **Hero de Portfolio: la bola de espejos** (`assets/portfolio/hero/bola.mp4`, `-1280` y `bola-poster.webp`; js/portfolio-hero.js). Los reflejos que se escapan salen de los puntos de luz del póster (`SPOTS`): si se cambia el vídeo, hay que volver a sacarlos (y el centro de la bola, `BALL`).
- [ ] **Página de proyecto (`proyecto.html#cachondeo-group`):** textos BORRADOR en `js/portfolio-data.js` → `project`: la frase de la portada, la ficha (Lugar: "Madrid [CONFIRMAR]"), el encargo / la idea / el resultado, los títulos de los reels ("Recap de la noche", "La fiesta") y los pies con hora de "La noche en secuencia" (21:47 · Foto de grupo, etc.). Oscar los confirma.
- [ ] **Compartir proyectos:** el título y la descripción de `proyecto.html` están escritos para Cachondeo Group (las redes no leen el #slug). Con un segundo proyecto, conviene una página por proyecto (proyecto-casa-lola.html, copiando la plantilla) para que cada uno tenga su og:image.
- [ ] **CSS del manifiesto duplicado:** `css/manifesto.css` (portfolio) es una copia del bloque del final de `css/servicios.css`. Cuando se pueda tocar Servicios, que cargue `css/manifesto.css` y se borra el bloque de allí.
- [ ] **Para quién (BORRADOR):** los 5 sectores y sus frases (`sectors`).

## Hero de las páginas interiores (js/page-hero.js, js/config.js → pageHeroes)

- [x] **Vídeos de los cuatro heroes:** reales. Servicios: el DISCO VIDEO sin rótulos; Portfolio: el reel RECAP de Cachondeo; Nosotros: el reel de la fiesta de Cachondeo; Contacto: el chico caminando con la cámara (`assets/servicios/hero/bg.mp4`). Para cambiar uno: `video` (1920 px), `videoSm` (1280 px), `poster` (su primer fotograma), `pos` (encuadre) y `fps` (los del vídeo, para el timecode).
- [ ] **Reflejos del destello:** la plata refleja el vídeo de cada hero (en Servicios se tiñe de verde con el campo; en Nosotros, de dorado). Con un vídeo muy de un color, el destello se ve casi entero de ese color.

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

- [ ] **Showreel (vídeo):** de momento es el manifiesto de disco (`assets/paginas/disco-manifiesto.mp4`, 38 s, con sonido). Cuando haya un showreel propio (30–60 s, 16:9, H.264, 1920×1080 y su póster webp), cámbialo en `showreel.src` y `showreel.poster`.
- [ ] **Cachondeo Group (BORRADOR):** confirmar el lugar y la fecha de la fiesta (`client`, ahora "Cachondeo Group · Fiesta en Madrid") y los entregables ("+80 fotos editadas"). Las fotos y los reels están en `assets/portfolio/cachondeo/`.
- [ ] **Más proyectos:** con un solo trabajo, la página lo enseña como proyecto destacado (portada, reels y galería) y la tarjeta "Próximo proyecto: en rodaje". Al añadir el segundo, vuelve sola la rejilla con filtros.
- [ ] **Cada trabajo nuevo lleva:**
  - Portada: `assets/portfolio/<slug>/cover.webp`, de 1200 px de ancho, en 4:5 (1200×1500), 1:1 (1200×1200) o 9:16 (1200×2133).
  - Fotos de la ficha: webp de 1600–2000 px en el lado largo.
  - Vídeos de la ficha: mp4 H.264 con póster webp.
  - Opcional: `preview.mp4`, mudo, de 3–6 s y 720 px, que se reproduce al pasar el ratón.
  - Datos: título, cliente, categoría (`restaurantes`, `noche`, `eventos` o `marcas`), año y qué se entregó.
- [ ] Si un día no hubiera trabajos, la página enseña 6 huecos y el aviso "Estamos rodando nuestros primeros proyectos." No hay que hacer nada.

## Nosotros (nosotros.html)

- [ ] **Fotos de Luna y Bruno trabajando:** no hay ninguna real todavía (rodando, editando, en un set). Harían falta para la página y para el equipo de la home.

- [ ] **Subtítulo (BORRADOR):** "Una productora pequeña, rápida y cercana…"
- [ ] **Manifiesto (BORRADOR):** "Creemos que cada negocio tiene una energía propia…"
- [ ] **Foto de Bruno:** `assets/team/bruno-marin-1280.webp` y `-720.webp` son provisionales. Hace falta la foto real, en 4:5 y 1280×1600, con el mismo nombre (se usa también en la home).
- [x] **Roles:** Luna López, "Cofundadora · Dirección y edición de vídeo"; Bruno Marín, "Cofundador · Foto, vídeo y edición de foto" (nosotros y home).
- [ ] **Bios (BORRADOR):** dos líneas para Luna y dos para Bruno.
- [ ] **Kit favorito:** `[cámara / objetivo]` de cada uno.
- [ ] **Instagram personal** de Luna y de Bruno, si existe. Si no, no se pone nada.
- [ ] **"Cómo trabajamos" (BORRADOR):** las 4 frases de los pasos.
- [ ] **El estudio:** `[DIRECCIÓN O ZONA]`. Si no hay estudio fijo, borra la sección `.ab-studio` de nosotros.html.
- [ ] **Escuadras de autofoco (hover de las fotos):** están colocadas sobre la cara de las fotos actuales (`.ab-person__af` en css/about.css). Cuando llegue la foto real de Bruno, revisar su posición.
- [ ] **Rendimiento (AE, 30-10-2026):** el hero nuevo (aurora + destello grande con recorrido por toda la página) da en Lighthouse móvil 63–66, frente a 72–74 de la versión anterior medida el mismo día en esta máquina. Accesibilidad, buenas prácticas y SEO siguen en 100. La aurora ya no pesa: compila en paralelo y entra cuando la página está libre. Lo que queda es el arranque del 3D, ahora grande y visible desde el primer pantallazo. Para recuperar esos puntos habría que no cargar el destello en móvil hasta el primer scroll, y el hero de móvil lo enseña arriba a la derecha.

## Otros

- [ ] **Páginas legales:** tienen plantilla estándar (LSSI-CE y RGPD) que hay que **REVISAR CON UN PROFESIONAL ANTES DE PUBLICAR**. Huecos: [TITULAR], [NIF], [DOMICILIO], [FECHA], datos registrales, plazos de conservación y proveedores (privacidad).
- [ ] **Cookies:** la web no usa cookies de analítica ni de terceros, por eso no hay banner. Si se añade analítica, hay que poner banner y actualizar cookies.html.
- [x] **Fuentes:** alojadas en la propia web (`assets/fonts`: Clash Display, ITF Free Font License; IBM Plex Mono, OFL), con precarga y fallbacks métricos (AD-C).
- [ ] **Newsletter del footer:** sin servicio conectado (TODO en `js/footer.js`).

## Rendimiento y robustez (AD-C, 30-10-2026)

Lighthouse 12, móvil (4G simulado, CPU ×4), con un servidor como el de producción (gzip/brotli + caché). Antes = commit `pre: AD`. Rendimiento / Accesibilidad / Buenas prácticas / SEO.

| Página | Antes | Después | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- |
| index | 0 / 96 / 100 / 100 | 53–70 / 100 / 100 / 100 | sin medir → 4,0–4,3 s | — → 520–2.220 ms | 0 |
| servicios | 38 / 96 / 100 / 100 | 55–80 / 100 / 100 / 100 | 7,4 → 3,5–3,6 s | 6.800 → 350–1.710 ms | 0 |
| portfolio | 44 / 100 / 100 / 100 | 68–90 / 100 / 100 / 100 | 7,5 → 3,3–3,6 s | 1.590 → 80–910 ms | 0 |
| proyecto | 61 / 100 / 100 / 100 | 67–78 / 100 / 100 / 100 | 7,3 → 3,7 s | 460 → 190–950 ms | 0,264 → 0 |
| nosotros | 62 / 96 / 100 / 100 | 96–97 / 100 / 100 / 100 | 3,0 → 2,0 s | 2.000 → 130 ms | 0 |
| contacto | 56 / 100 / 100 / 100 | 97–98 / 100 / 100 / 100 | 2,9 → 2,0 s | 900 → 60–130 ms | 0,265 → 0 |

(Los rangos son de varias pasadas: Lighthouse varía bastante en páginas con 3D; casi todo el TBT que queda es el arranque del destello 3D.)

**Qué se ha hecho**
- Fuentes en la propia web (`assets/fonts`), con precarga de los dos pesos de Clash del primer pantallazo y fallbacks con las métricas ajustadas (el CLS de contacto venía de ahí).
- GSAP, ScrollTrigger, Flip y Lenis servidos desde `assets/vendor` (mismas versiones) y con `defer`; `modulepreload` de todos los módulos de cada página (sin cascada de imports); three minificado y OGL en un solo archivo (antes, decenas de peticiones).
- 3D solo cuando merece la pena (`js/gpu.js`): sin GPU de verdad no se descarga three y se ve la versión sin WebGL; en las páginas interiores el destello arranca después del load (a la primera interacción o a los 2 s). Shaders compilados en paralelo cuando el navegador lo permite. Reflejos vivos cada 8 fotogramas.
- Calidad adaptativa: si el destello va por debajo de 50 fps, baja el DPR, luego quita la estela y luego los reflejos vivos; el fluido de la home se quita si va por debajo de 50 fps. Móvil: DPR máx. 1,25 y sin fluido en gama baja.
- EmailJS solo se descarga al tocar el formulario. El vídeo del hero de servicios se pone a cargar después del load.
- Sin `requestAnimationFrame` sueltos (todo en `gsap.ticker`). Con atrás/adelante (bfcache) la página vuelve tal cual (antes se liberaba la GPU al salir).
- Proyecto: una pantalla reservada antes de pintar la ficha (el footer ya no salta). Panorama del estudio para móvil: 904 → 384 KB (el de 4096, en `legacy/assets/studio/`).
- Decisiones de Oscar (AD): la intro de la home, solo en escritorio (en móvil la home entra directa al hero); el subtítulo, los botones y la meta de los heroes interiores entran a 0,35 s (antes 0,75); el móvil del reel de proyecto sube sin fundido y su póster se precarga (`proyecto.html`: mapa `covers`, uno por proyecto con página; al añadir un proyecto, añadirlo ahí).
- En la home sin intro (móvil o segunda visita), el destello 3D se carga como en las interiores (tras el load); el fluido del hero solo se monta con ratón. El vídeo del hero de servicios y el reel de la portada de proyecto empiezan ya cargada la página (el póster, desde el principio).
- Contraste: las palabras "apagadas" de los manifiestos y de "Cómo trabajamos" pasan a ≥ 3:1 (texto grande, WCAG AA).
- `_headers` (Netlify / Cloudflare Pages) y `.htaccess` (Apache): `assets/` con caché de 1 año immutable; HTML, CSS y JS se revalidan; compresión.

**Comprobado** (Playwright): todas las páginas en 1440, 1024 y 390, con movimiento reducido, sin WebGL, con los vídeos bloqueados, con CPU ×4, redimensionando a mitad de la entrada, atrás/adelante, cambiando de página rápido, con scroll muy rápido y girando el móvil: consola sin errores propios, sin overflow horizontal y nunca dos destellos. Ningún enlace roto (458 referencias revisadas) ni `href="#"` sueltos.

**Lo que no llega al objetivo (≥ 90) y por qué**
- **index, servicios, proyecto (y a veces portfolio):** el LCP es el texto o el reel del hero, que el JS pinta y anima (Chrome no cuenta como LCP las imágenes que ocupan toda la pantalla, así que el póster de fondo no vale); con 4G simulado y CPU ×4 eso queda en 3,5–4,3 s. El TBT que queda es casi todo el arranque del destello 3D (three, el modelo y sus reflejos). Para pasar de 90 haría falta quitar el 3D en móvil o pintar los heroes sin JS; no se ha hecho porque cambia el diseño aprobado.
- **Escritorio, primera visita a la home:** sigue la intro completa (≥ 2,6 s), así que en una medición de escritorio cuenta en el LCP.

**Pendiente de hosting**
- [ ] **Antes de publicar, siempre: `node tools/version.mjs`** (AF, 30-10-2026). Pone `?v=<commit>` (más un hash del contenido si hay cambios sin commit) en cada `css/*.css` y `js/*.js` de todas las páginas y en el import map del `<head>`, que versiona también los import entre módulos. Sin esto, tras publicar en GitHub Pages un navegador podía juntar el HTML nuevo con un CSS o JS viejo durante 10 min: la página se veía rota. Se puede ejecutar las veces que haga falta. Orden: cambios → `node tools/version.mjs` → commit → push.
- [ ] **Diagnóstico del navegador:** abre cualquier página con `?debug` (p. ej. `nosotros.html?debug`) y la consola dice el renderer de WebGL y si se encienden el 3D (`gpuOK`) y la aurora (`webglOK`), con el motivo. Para ver la web sin 3D: `localStorage.disco_gl = 'off'`; para forzarlo: `'force'`; para volver a lo normal: `localStorage.removeItem('disco_gl')`.
- [ ] **Hosting:** aún no está decidido. GitHub Pages ignora `_headers` y `.htaccess` (pone su propia caché de 10 min y comprime él). En Netlify / Cloudflare Pages se usa `_headers`; en Apache, `.htaccess`. Con la caché immutable, si se sustituye un archivo de `assets/` hay que cambiarle el nombre.
- [ ] **EmailJS:** las claves siguen vacías (ver la sección de Contacto).
- [ ] **Foto real de Bruno** y textos en BORRADOR (`data-draft`): siguen pendientes (ver Nosotros).
