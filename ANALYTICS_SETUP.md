# Analítica privada de Archipiélago Vivo

Analítica first-party para registrar cargas de página y reconstruir una navegación aproximada sin cookies ni almacenamiento persistente en el navegador.

## Endpoint de producción

```text
https://script.google.com/macros/s/AKfycbzbPglrJZRnMAFzfeMQ8nC5QsDmOA9RFHIh6wNk5h7_8u0ah-ZrCrHWb1T3pgPK_Q/exec
```

El endpoint ya está configurado en `analytics.js`.

## Esquema de Eventos

- `timestamp`
- `event`
- `session_id`
- `page`
- `entry_page`
- `has_campaign`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `utm_id`
- `av_location`
- `av_island`
- `av_municipality`

## Sesiones sin cookies

Cuando una página no recibe `av_session`, `analytics.js` crea un identificador aleatorio efímero. Los enlaces que llevan a `archipielagovivo.org` o a uno de sus subdominios reciben:

```text
av_session=<id efímero>
av_entry=<primera ruta>
```

Además se heredan los campos UTM/AV de la entrada para conservar la atribución durante esa navegación.

No se propaga el identificador a dominios externos como WhatsApp, GitHub o redes sociales.

Los enlaces de ancla de la propia página (`#contacto`, `#que-es`, etc.) no se modifican.

Una recarga de la primera página sin `av_session` puede iniciar una nueva sesión estadística. Esto es deliberado: no se usa cookie, localStorage ni sessionStorage para reconocer al navegador.

## Privacidad

El código de Archipiélago Vivo no almacena ni envía como campos analíticos:

- IP
- user-agent
- referrer
- fingerprint
- cookie
- identificador persistente de persona o dispositivo

La petición al Apps Script usa `credentials: "omit"` y `referrerPolicy: "no-referrer"`.

Google, como proveedor de la infraestructura HTTP/Apps Script, puede procesar metadatos técnicos necesarios para prestar el servicio, aunque esos datos no formen parte de la hoja `Eventos` ni sean accesibles mediante este esquema de analítica.

## Apps Script

La copia definitiva de la hoja debe contener la pestaña `Eventos` con las 15 columnas indicadas. Desde esa misma hoja:

1. Extensiones → Apps Script.
2. Pegar `google-apps-script/Code.gs`.
3. Ejecutar `configurar()` una vez.
4. Desplegar como aplicación web ejecutada por la cuenta de Archipiélago Vivo y con acceso anónimo.
5. Usar la URL `/exec` en `analytics.js`.

## QR actual del CAJI

El tracker reconoce directamente los campos del QR actual:

```text
utm_source=caji
utm_medium=qr
utm_campaign=caji_exposicion
utm_content=mapa_interior
av_location=interior_caji_fuerteventura_puerto_del_rosario
av_island=fuerteventura
av_municipality=puerto_del_rosario
```

En la primera carga y en las siguientes páginas enlazadas dentro del ecosistema Archipiélago Vivo se conservarán esos valores junto con la misma `session_id`.
