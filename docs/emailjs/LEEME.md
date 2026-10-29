# Formulario de contacto: envío directo con EmailJS

El formulario de `contacto.html` envía el correo desde el navegador con EmailJS, sin abrir el programa de correo. Hasta que se rellenen las claves de `js/config.js` → `emailjs`, el formulario no envía: dice "Formulario en configuración" y da el email `equipo@discoproduccion.com`.

## Pasos (una sola vez, unos 10 minutos)

1. **Crear la cuenta** en [emailjs.com](https://www.emailjs.com/). El plan gratis permite 200 correos al mes.
2. **Conectar el correo.** Ve a *Email Services* → *Add New Service* → Gmail u Outlook. Conecta `equipo@discoproduccion.com` y copia el **Service ID** (empieza por `service_…`).
3. **Crear la plantilla del aviso a disco.** Ve a *Email Templates* → *Create New Template*.
   - En el contenido, cambia a HTML / Code y pega todo `email-nuevo-contacto.html` (está en esta carpeta).
   - **Subject:** `Nuevo contacto · {{negocio}} · {{nombre}}`
   - **To Email:** `equipo@discoproduccion.com`
   - **Reply To:** `{{email}}`. Así, al pulsar "Responder", el correo va directo al cliente.
   - **From Name:** `Web disco.`
   - Guarda la plantilla y copia el **Template ID** (`template_…`).
4. **Respuesta automática al cliente (opcional).** Crea otra plantilla:
   - **To Email:** `{{email}}`
   - **Subject:** `Hemos recibido tu mensaje · disco.`
   - Un texto corto, por ejemplo: "Hola {{nombre}}, gracias por escribirnos. Hemos recibido tu mensaje y te respondemos muy pronto. — disco."
   - Copia su Template ID.
5. **La clave pública.** Ve a *Account* → *General* → **Public Key** y cópiala.
6. **Pegar los valores** en `js/config.js`:
   ```js
   emailjs: { publicKey: 'xxxx', serviceId: 'service_xxxx', templateId: 'template_xxxx', autoReplyTemplateId: '' },
   ```
   `autoReplyTemplateId` puede quedarse vacío si no hiciste el paso 4.
7. **Seguridad.** Cuando la web esté publicada, ve a *Account* → *Security* y restringe el uso a tu dominio (`disco.es`). Así nadie puede usar tus claves desde otra web.

## Qué recibe la plantilla

El formulario manda estos campos, con estos nombres exactos:

| Campo | Qué es |
| --- | --- |
| `nombre`, `negocio`, `email`, `telefono` | Lo que escribe el cliente (los cuatro son obligatorios). |
| `mensaje` | "Cuéntanos un poco más" (si lo deja vacío: "—"). |
| `fecha` | Fecha y hora de Madrid. |
| `pagina` | La URL desde la que escribe. |
| `referencia` | El proyecto que estaba viendo (`?ref=…`, p. ej. `cachondeo-group`) o "—". |
| `origen` | De dónde llegó (la página anterior y `utm_source` / `utm_campaign`) o "Directo". |
| `dispositivo` | "Móvil" u "Ordenador", y el navegador. |
| `idioma` | El idioma del navegador. |
| `whatsapp_url` | Un enlace de WhatsApp a su teléfono con un saludo ya escrito (botón "WhatsApp" del correo). |

## Anti-spam

El formulario lleva tres protecciones:

- un campo trampa oculto (los robots lo rellenan y su envío se descarta);
- no acepta envíos hechos menos de 3 s después de abrir la página;
- no permite un segundo envío hasta pasados 30 s.

## Probarlo

Con las claves puestas, rellena el formulario y envíalo. Tienes que ver "Recibido, {nombre}." y, en `equipo@discoproduccion.com`, el correo con los botones Responder, WhatsApp y Llamar. Si no llega, mira *Email History* en EmailJS.
