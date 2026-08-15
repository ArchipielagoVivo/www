# Archipiélago Vivo — Web principal

Repositorio de la web pública de **Archipiélago Vivo**, una infraestructura digital para visibilizar, conectar y facilitar el descubrimiento de personas, colectivos, entidades y proyectos que cuidan, transforman y sostienen Canarias.

**Producción:** https://archipielagovivo.org/

> Este repositorio contiene la web principal y el tracker común de analítica. Otros servicios del ecosistema —como TV, inscripción y datos— se despliegan desde repositorios o subdominios propios.

---

## Ecosistema

| Servicio | URL | Función |
|---|---|---|
| Web principal | `https://archipielagovivo.org/` | Presentación, navegación y acceso al ecosistema |
| Mapa | `https://archipielagovivo.org/mapa.html` | Acceso al mapa de iniciativas |
| Agenda | `https://archipielagovivo.org/agenda.html` | Acceso a Agenda Viva |
| Inscripción | `https://inscripcion.archipielagovivo.org/` | Formulario de incorporación |
| TV | `https://tv.archipielagovivo.org/` | Emisión audiovisual multicanal |
| Datos | `https://data.archipielagovivo.org/` | Datos estáticos y feeds públicos |

Repositorios relacionados:

- `ArchipielagoVivo/www` — web principal y analítica común.
- `ArchipielagoVivo/tv` — interfaz, motor y reproducción de Archipiélago Vivo TV.
- `ArchipielagoVivo/data` — publicación de datos estáticos para mapa y TV.
- `ArchipielagoVivo/img` — recursos gráficos compartidos.

---

## Estructura principal

```text
.
├── index.html
├── mapa.html
├── agenda.html
├── styles.css
├── analytics.js
├── Code.gs
├── ANALYTICS_SETUP.md
├── privacidad.html
├── cookies.html
├── aviso-legal.html
├── site.webmanifest
├── CNAME
├── logo.png
├── logo.webp
└── ...
```

### Archivos clave

- `index.html` — portada principal.
- `mapa.html` — entrada al mapa.
- `agenda.html` — entrada a Agenda Viva.
- `styles.css` — estilos compartidos de la web principal.
- `analytics.js` — tracker first-party común para `archipielagovivo.org` y sus subdominios.
- `Code.gs` — backend de analítica en Google Apps Script.
- `ANALYTICS_SETUP.md` — documentación operativa de la analítica.
- `privacidad.html`, `cookies.html`, `aviso-legal.html` — textos legales.
- `CNAME` — dominio personalizado de GitHub Pages.

---

# Analítica first-party

Archipiélago Vivo utiliza un sistema propio de analítica basado en:

```text
Navegador
   ↓
analytics.js
   ↓
Google Apps Script
   ↓
Google Sheets · Eventos
```

No depende de Google Analytics ni de cookies analíticas.

El tracker común se publica desde este repositorio:

```text
https://archipielagovivo.org/analytics.js
```

Los distintos servicios pueden cargar directamente ese archivo:

```html
<script src="https://archipielagovivo.org/analytics.js"></script>
```

Esto permite compartir entre subdominios:

- lógica de sesión;
- atribución UTM;
- `utm_referrer`;
- `referrer`;
- modo `nostats`;
- envío de eventos específicos mediante `AVAnalytics.track()`.

---

## Sesión

Si la URL no contiene `av_session`, el navegador genera un identificador aleatorio efímero.

Los enlaces internos entre `archipielagovivo.org` y sus subdominios propagan:

```text
av_session=<id>
av_entry=<ruta inicial>
```

También se mantienen los parámetros de atribución permitidos.

No se utilizan cookies, `localStorage` ni `sessionStorage` para reconocer de forma persistente a una persona dentro del sistema de analítica.

> Algunas aplicaciones pueden usar `localStorage` para estado funcional propio —por ejemplo, recordar el último canal de TV—, pero no como identificador analítico.

---

## Rutas de subdominios

El tracker normaliza automáticamente los subdominios para poder analizarlos en una única tabla.

Ejemplos:

```text
https://archipielagovivo.org/
→ /

https://tv.archipielagovivo.org/
→ /@tv/

https://inscripcion.archipielagovivo.org/
→ /@inscripcion/
```

El mecanismo funciona también con futuros subdominios.

---

## `nostats`

Para desarrollo y pruebas puede desactivarse toda la analítica añadiendo:

```text
?nostats=1
```

Ejemplo:

```text
https://tv.archipielagovivo.org/?debug=1&nostats=1
```

Cuando está activo:

- no se envía `pageview`;
- `AVAnalytics.track()` no genera eventos;
- `nostats=1` se propaga a los enlaces internos del ecosistema.

`debug=1` y `nostats=1` son independientes: puede depurarse una sesión real con estadísticas o una sesión excluida.

---

# API de eventos

`analytics.js` expone:

```js
window.AVAnalytics.track(eventName, details);
```

Ejemplo:

```js
AVAnalytics.track("tv_channel_change", {
  channel_id: "general",
  channel_number: 1,
  action_from: "fuerteventura",
  action_to: "general"
});
```

Los detalles pueden ser valores escalares:

```text
string
number
boolean
```

El navegador no decide qué columnas existen.

---

# Esquema dinámico por cabeceras

El backend de Apps Script utiliza la primera fila de la pestaña `Eventos` como **esquema y whitelist**.

La regla es:

```text
payload recibido
      ↓
leer cabeceras de Eventos
      ↓
¿existe una cabecera con ese nombre?
      ├── sí → sanitizar y escribir
      └── no → ignorar
```

Esto permite ampliar la analítica sin modificar `Code.gs`.

Por ejemplo, si se añaden estas columnas:

```text
playback_buffering_ms
device_class
connection_rtt
```

los clientes pueden comenzar a enviarlas inmediatamente.

Los campos:

```text
timestamp
has_campaign
```

son calculados por el servidor y no pueden ser sobrescritos por el navegador.

---

## Esquema actual de `Eventos`

```text
timestamp
event
session_id
page
entry_page
has_campaign
utm_source
utm_medium
utm_campaign
utm_content
utm_term
utm_id
av_location
av_island
av_municipality
utm_referrer
referrer
channel_id
channel_number
program_id
media_id
media_type
entity_id
youtube_id
action_from
action_to
error_code
intermission_planned_seconds
intermission_actual_seconds
next_program_start_delay_ms
intermission_success
playback_buffering_ms
user_agent
platform
device_class
fullscreen_supported
connection_effective_type
connection_downlink
connection_rtt
```

Las columnas pueden reordenarse sin romper el backend porque la escritura se realiza por nombre de cabecera.

---

# Atribución

El tracker reconoce:

```text
utm_source
utm_medium
utm_campaign
utm_content
utm_term
utm_id
utm_referrer
av_location
av_island
av_municipality
```

`has_campaign` se calcula en el servidor cuando existe cualquiera de estos valores.

Los parámetros se propagan únicamente entre URLs internas de Archipiélago Vivo.

---

## Referrer

Se registra un `referrer` saneado como:

```text
origin + pathname
```

sin query string ni fragmento `#`.

Ejemplo:

```text
https://example.org/articulo/canarias
```

en lugar de conservar parámetros potencialmente sensibles.

---

# Eventos de Archipiélago Vivo TV

El tracker común permite a TV registrar eventos funcionales sin disponer de un sistema de analítica independiente.

Eventos previstos/activos:

```text
tv_start
tv_channel_change
tv_media_start
tv_program_change
tv_intermission_start
tv_intermission_end
tv_entity_open
tv_sound_on
tv_fullscreen_on
tv_playback_degraded
tv_error
```

Campos habituales:

```text
channel_id
channel_number
program_id
media_id
media_type
entity_id
youtube_id
action_from
action_to
error_code
```

---

## Diagnóstico de reproducción TV

Para analizar problemas reales de reproducción —especialmente en navegadores de Android TV— se pueden recoger:

```text
playback_buffering_ms
user_agent
platform
device_class
fullscreen_supported
connection_effective_type
connection_downlink
connection_rtt
```

Estos campos tienen una finalidad técnica de diagnóstico y estabilidad.

No se pretende construir fingerprinting. No se recogen deliberadamente técnicas como canvas fingerprint, GPU fingerprint, listado de fuentes o plugins.

---

## Cortinillas y resincronización

TV utiliza cortinillas técnicas entre cambios reales de programa.

La primera versión muestra:

```text
[ LOGO ARCHIPIÉLAGO VIVO TV ]

CONTINUAMOS
EN BREVES INSTANTES
```

La duración no es necesariamente fija. Se calcula a partir del hueco real entre el final de la reproducción y la hora prevista del siguiente programa.

Las promos `entity` no generan cortinilla ni antes ni después.

Las transiciones pueden registrar:

```text
intermission_planned_seconds
intermission_actual_seconds
next_program_start_delay_ms
intermission_success
playback_buffering_ms
```

Esto permite determinar empíricamente si el margen utilizado es suficiente en las distintas instancias de reproducción.

---

# Privacidad

La analítica se ha diseñado para minimizar identificación y persistencia.

Principios actuales:

- sin cookies analíticas;
- sin identificador persistente propio;
- sesión efímera;
- `credentials: "omit"` en el POST analítico;
- `referrerPolicy: "no-referrer"` para la petición al Apps Script;
- propagación de sesión sólo dentro de Archipiélago Vivo;
- esquema de campos controlado por las cabeceras de la hoja;
- valores saneados antes de escribirse en Sheets.

Se recopilan determinados datos técnicos del navegador o dispositivo cuando son necesarios para diagnosticar el funcionamiento de servicios como TV.

Los textos legales públicos deben mantenerse alineados con la información técnica efectivamente recopilada.

---

# Google Apps Script

El backend está en:

```text
Code.gs
```

La implementación de producción utiliza:

```text
https://script.google.com/macros/s/AKfycbzbPglrJZRnMAFzfeMQ8nC5QsDmOA9RFHIh6wNk5h7_8u0ah-ZrCrHWb1T3pgPK_Q/exec
```

La configuración básica es:

1. Crear o abrir la hoja que contiene `Eventos`.
2. Extensiones → Apps Script.
3. Pegar `Code.gs`.
4. Ejecutar `configurar()` una vez.
5. Autorizar.
6. Implementar como aplicación web.
7. Usar la URL `/exec` de producción en `analytics.js`.

Al modificar `Code.gs`, comprobar que la implementación `/exec` de producción está usando la versión deseada.

---

# Desarrollo

La web principal es estática y puede probarse con cualquier servidor HTTP local.

Ejemplo con Python:

```bash
python -m http.server 8080
```

Después:

```text
http://localhost:8080/
```

Para pruebas en producción sin contaminar estadísticas:

```text
?nostats=1
```

Para TV:

```text
?debug=1&nostats=1
```

---

# Despliegue

El dominio principal se sirve mediante GitHub Pages usando:

```text
CNAME
```

con:

```text
archipielagovivo.org
```

Antes de publicar cambios conviene comprobar:

1. navegación principal;
2. responsive móvil;
3. enlaces entre subdominios;
4. propagación de `av_session`;
5. comportamiento de `nostats`;
6. carga de `analytics.js`;
7. textos legales;
8. favicon/manifest;
9. consola del navegador sin errores.

---

# Estado de la documentación

`README.md` describe la arquitectura general actual.

`ANALYTICS_SETUP.md` contiene documentación histórica/operativa del sistema de analítica y debe mantenerse sincronizado con el esquema dinámico actual, especialmente cuando cambien:

- campos recogidos;
- política de privacidad;
- comportamiento de `referrer`;
- diagnóstico técnico de TV.

---

## Proyecto

**Archipiélago Vivo**  
Canarias · 2026
