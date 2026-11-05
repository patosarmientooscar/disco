# Formulario de contacto: el aviso por correo (FormSubmit)

Cuando alguien envía el formulario de `contacto.html`, a `equipo@discoproduccion.com` le llega un aviso: «Nuevo interesado en la web · {negocio} · {nombre}», con una tabla con el nombre, el negocio, el email, el teléfono, el mensaje, la fecha y hora de Madrid y la página. Al darle a **Responder**, se contesta directamente al interesado.

Lo envía [FormSubmit](https://formsubmit.co), que no necesita cuenta ni claves. Se configura en `js/config.js` → `contactForm`.

## La primera vez (una sola vez)

1. Con la web **ya publicada**, envía el formulario una vez (con tus datos de prueba).
2. A `equipo@discoproduccion.com` llega un correo de FormSubmit, **«Confirm your email»** (mira también en spam). Pulsa el botón de confirmar.
3. Desde ese momento llegan todos los avisos. El de la prueba no llega: se usa para activar.

## Para no dejar el email en el código (recomendado)

1. Tras confirmar, FormSubmit manda otro correo con un **código aleatorio** (algo como `a1b2c3d4e5…`).
2. Ponlo en `js/config.js` → `contactForm.alias: 'a1b2c3d4e5…'`. El formulario pasa a enviar a `https://formsubmit.co/ajax/{código}` y el email deja de estar en el código.
3. Publica (`node tools/version.mjs` y push).

## Si algún día preferís EmailJS

Rellenad sus claves en `js/config.js` → `emailjs` (pasos en `docs/emailjs/LEEME.md`, con su plantilla más bonita) y poned `contactForm.provider: 'emailjs'`. Sin las claves, se sigue usando FormSubmit.

## Anti-spam (igual que antes)

Campo trampa oculto, 3 s mínimos desde que se abre la página y 30 s entre envíos desde el mismo navegador.
