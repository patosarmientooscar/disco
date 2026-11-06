# Formulario de contacto: el aviso por correo (FormSubmit)

Cuando alguien envía el formulario de `contacto.html`, llega un aviso por correo: «Nuevo interesado en la web · {negocio} · {nombre}». Es una tabla con el nombre, el negocio, el email, el teléfono, el mensaje, la fecha y hora de Madrid y la página desde la que se envió. Al darle a **Responder**, contestas directamente al interesado.

Lo envía [FormSubmit](https://formsubmit.co), que no necesita cuenta ni claves. Se configura en `js/config.js` → `contactForm`.

## Destino provisional (desde AR-H)

`equipo@discoproduccion.com` todavía no está activado en FormSubmit y puede que ese buzón ni exista. Por eso, de momento, los avisos van a otra dirección:

- `to: 'patosarmientooscar@gmail.com'`: aquí llegan los avisos.
- `cc: 'equipo@discoproduccion.com'`: copia de cada aviso, para cuando ese buzón exista.

**La primera vez (una sola vez):**

1. Envía el formulario una vez, con datos de prueba (vale desde el servidor local o desde la web publicada).
2. A `patosarmientooscar@gmail.com` llega un correo de FormSubmit, **«Confirm your email»**. Mira también en spam. Pulsa el botón de confirmar.
3. Desde ese momento llegan todos los avisos. El de la prueba no llega, porque solo sirve para activar.

> Si FormSubmit está caído (su web responde 522), el formulario no se queda colgado: a los 12 s muestra «No hemos podido enviarlo. Escríbenos a equipo@discoproduccion.com…». Nunca muestra un «Recibido» falso, solo lo muestra si FormSubmit contesta `success: "true"`. Para ver la respuesta completa de FormSubmit en la consola, abre la página con `?debug` (`contacto.html?debug`).

## Cuando exista equipo@discoproduccion.com

1. En `js/config.js`, cambia a `contactForm: { provider: 'formsubmit', to: 'equipo@discoproduccion.com', cc: '', alias: '' }`.
2. Publica (`node tools/version.mjs` y push) y envía una prueba.
3. A `equipo@discoproduccion.com` llega «Confirm your email». Pulsa el botón.

## Para no dejar el email en el código (recomendado)

1. Tras confirmar, FormSubmit manda otro correo con un **código aleatorio** (algo como `a1b2c3d4e5…`).
2. Pon ese código en `js/config.js` → `contactForm.alias: 'a1b2c3d4e5…'`. El formulario pasa a enviar a `https://formsubmit.co/ajax/{código}` y el email deja de estar en el código.
3. Publica (`node tools/version.mjs` y push).

## Si algún día preferís EmailJS

Rellenad sus claves en `js/config.js` → `emailjs` y poned `contactForm.provider: 'emailjs'`. Los pasos están en `docs/emailjs/LEEME.md`, que trae una plantilla más bonita. Sin las claves, se sigue usando FormSubmit.

## Anti-spam (igual que antes)

El formulario lleva tres protecciones:

- un campo trampa oculto;
- 3 s mínimos desde que se abre la página;
- 30 s entre envíos desde el mismo navegador.
