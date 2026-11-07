# Formulario de contacto: el aviso por correo (Web3Forms)

Cuando alguien envía el formulario de `contacto.html`, llega un aviso por correo: «Nuevo interesado en la web · {negocio} · {nombre}», remitente «Web disco.». Trae el nombre, el negocio, el email, el teléfono, el mensaje, la fecha y hora de Madrid y la página desde la que se envió. Al darle a **Responder**, contestas directamente al interesado.

Desde AV lo envía [Web3Forms](https://web3forms.com). No necesita activación por correo: funciona con una **Access Key**. Antes era FormSubmit, que nunca llegó a mandar el correo de activación (su servidor respondía 522).

## Dónde está la Key

En `js/config.js` → `contactForm.web3formsKey`. Es pública por diseño: puede ir en el código del navegador sin problema.

```js
contactForm: { provider: 'web3forms', web3formsKey: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', to: 'patosarmientooscar@gmail.com', ... }
```

- La Key tiene forma de UUID (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). Web3Forms rechaza cualquier otra cosa con «Invalid form_id/access_key format. Must be a valid UUID.».
- **Sin Key puesta** (`web3formsKey: ''`), el formulario usa FormSubmit para no quedarse mudo.
- Después de cambiar la Key, publica: `node tools/version.mjs` y push.

## A qué correo llega

Al correo con el que se creó la Key en web3forms.com: de momento, `patosarmientooscar@gmail.com`. El destino lo fija la Key, no el código. `to` en `js/config.js` es solo informativo.

## Límite del plan gratuito

**250 envíos al mes.** Si se superan, Web3Forms deja de entregar hasta el mes siguiente (o hay que pasar a un plan de pago).

## Cuando exista equipo@discoproduccion.com

1. En [web3forms.com](https://web3forms.com), crea una Key nueva con `equipo@discoproduccion.com`. Llega por correo a ese buzón.
2. Ponla en `js/config.js` → `contactForm.web3formsKey`, y cambia también `to: 'equipo@discoproduccion.com'` (informativo).
3. Publica (`node tools/version.mjs` y push) y envía una prueba desde la web publicada.

## Si algo falla

- El formulario solo dice «Recibido, {nombre}.» si Web3Forms responde ok y `success: true`. Si no, o si no contesta en 12 s, muestra «No hemos podido enviarlo. Escríbenos a equipo@discoproduccion.com…».
- Para ver lo que se envía y la respuesta completa en la consola, abre la página con `?debug` (`contacto.html?debug`).
- Web3Forms solo acepta envíos desde un navegador. Las llamadas desde un servidor (curl, scripts) o desde navegadores automáticos sin ventana devuelven 403 («Use our API in client side…»). Para probar, usa un navegador normal.

## Alternativas (siguen en el código)

- `provider: 'formsubmit'`: [FormSubmit](https://formsubmit.co). Envía a `alias` (el código que da FormSubmit tras confirmar el email) o, si está vacío, a `to`, con copia a `cc`. La primera vez manda un «Confirm your email» que hay que confirmar.
- `provider: 'emailjs'`: EmailJS, con sus claves en `js/config.js` → `emailjs`. Pasos en `docs/emailjs/LEEME.md`. Sin las claves, se usa FormSubmit.

## Anti-spam (igual que antes)

- un campo trampa oculto (`web`; a Web3Forms va como `botcheck`): si viene relleno, no se envía nada;
- 3 s mínimos desde que se abre la página;
- 30 s entre envíos desde el mismo navegador.
