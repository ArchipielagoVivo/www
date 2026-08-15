/**
 * Archipiélago Vivo — receptor de analítica web first-party y sin cookies.
 *
 * Vincular este script a la copia de la hoja de estadísticas mediante
 * Google Sheets > Extensiones > Apps Script y ejecutar configurar() una vez.
 */

const SHEET_NAME = 'Eventos';

const EXPECTED_HEADERS = [
  'timestamp',
  'event',
  'session_id',
  'page',
  'entry_page',
  'has_campaign',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'av_location',
  'av_island',
  'av_municipality'
];

const MAX_LENGTH = {
  session_id: 100,
  page: 300,
  entry_page: 300,
  utm_source: 100,
  utm_medium: 100,
  utm_campaign: 150,
  utm_content: 150,
  utm_term: 150,
  utm_id: 150,
  av_location: 200,
  av_island: 100,
  av_municipality: 150
};

/**
 * Ejecutar UNA VEZ desde el Apps Script vinculado a la hoja definitiva.
 * Guarda el ID de esa copia en Script Properties y valida la pestaña Eventos.
 */
function configurar() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error(
      'No se ha podido detectar la hoja vinculada. Abre Apps Script desde Extensiones > Apps Script.'
    );
  }

  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(`No existe la pestaña "${SHEET_NAME}".`);
  }

  const headers = sheet
    .getRange(1, 1, 1, EXPECTED_HEADERS.length)
    .getDisplayValues()[0];

  const mismatch = EXPECTED_HEADERS.some((header, index) => headers[index] !== header);
  if (mismatch) {
    throw new Error(
      `La cabecera de "${SHEET_NAME}" no coincide con el esquema esperado: ${EXPECTED_HEADERS.join(', ')}`
    );
  }

  PropertiesService
    .getScriptProperties()
    .setProperty('SPREADSHEET_ID', spreadsheet.getId());

  console.log(`Configurado: ${spreadsheet.getName()} — ${spreadsheet.getId()}`);
}

function getSpreadsheet_() {
  const id = PropertiesService
    .getScriptProperties()
    .getProperty('SPREADSHEET_ID');

  if (!id) {
    throw new Error('Falta configuración. Ejecuta configurar() primero.');
  }

  return SpreadsheetApp.openById(id);
}

/**
 * Estado del servicio. Abrir la URL /exec debe devolver configured:true.
 */
function doGet() {
  try {
    const spreadsheet = getSpreadsheet_();

    return jsonResponse_({
      ok: true,
      service: 'archipielago-vivo-analytics',
      configured: true,
      spreadsheet: spreadsheet.getName()
    });
  } catch (error) {
    console.error(error);

    return jsonResponse_({
      ok: false,
      service: 'archipielago-vivo-analytics',
      configured: false,
      error: 'not_configured'
    });
  }
}

/**
 * Recibe pageviews desde archipielagovivo.org.
 */
function doPost(e) {
  try {
    const data = parseRequest_(e);

    const event = 'pageview';
    const sessionId = clean_(data.session_id, MAX_LENGTH.session_id);
    const page = cleanPath_(data.page, MAX_LENGTH.page);

    if (!page) {
      return jsonResponse_({ ok: false, error: 'missing_page' });
    }

    const entryPage = cleanPath_(data.entry_page, MAX_LENGTH.entry_page) || page;

    const utmSource = clean_(data.utm_source, MAX_LENGTH.utm_source);
    const utmMedium = clean_(data.utm_medium, MAX_LENGTH.utm_medium);
    const utmCampaign = clean_(data.utm_campaign, MAX_LENGTH.utm_campaign);
    const utmContent = clean_(data.utm_content, MAX_LENGTH.utm_content);
    const utmTerm = clean_(data.utm_term, MAX_LENGTH.utm_term);
    const utmId = clean_(data.utm_id, MAX_LENGTH.utm_id);

    const avLocation = clean_(data.av_location, MAX_LENGTH.av_location);
    const avIsland = clean_(data.av_island, MAX_LENGTH.av_island);
    const avMunicipality = clean_(data.av_municipality, MAX_LENGTH.av_municipality);

    // Se calcula en servidor; no se confía en un has_campaign recibido del navegador.
    const hasCampaign = [
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      utmId,
      avLocation,
      avIsland,
      avMunicipality
    ].some(Boolean) ? 1 : 0;

    const spreadsheet = getSpreadsheet_();
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error(`No existe la pestaña "${SHEET_NAME}".`);
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(5000);

    try {
      sheet.appendRow([
        new Date(),
        event,
        sessionId,
        page,
        entryPage,
        hasCampaign,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        utmId,
        avLocation,
        avIsland,
        avMunicipality
      ]);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse_({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse_({ ok: false, error: 'server_error' });
  }
}

function parseRequest_(e) {
  if (!e) {
    return {};
  }

  const raw = e.postData && typeof e.postData.contents === 'string'
    ? e.postData.contents.trim()
    : '';

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_) {
      // Si no es JSON se prueban parámetros POST convencionales.
    }
  }

  return e.parameter || {};
}

function clean_(value, maxLength) {
  if (value === undefined || value === null) {
    return '';
  }

  let text = String(value)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);

  // Evita formula injection en Google Sheets.
  if (/^[=+\-@]/.test(text)) {
    text = "'" + text;
  }

  return text;
}

function cleanPath_(value, maxLength) {
  const path = clean_(value, maxLength);
  return path && path.startsWith('/') ? path : '';
}

function jsonResponse_(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}
