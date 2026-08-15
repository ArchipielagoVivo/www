/*
 * Archipiélago Vivo — analítica web first-party y sin cookies.
 *
 * - Registra un pageview por carga.
 * - Crea un av_session efímero si la URL no trae uno.
 * - Propaga av_session + atribución UTM/AV únicamente entre URLs de
 *   archipielagovivo.org y sus subdominios.
 * - Distingue los subdominios en la ruta analítica:
 *     /              -> web principal
 *     /@inscripcion/ -> inscripción
 *     /@tv/          -> TV
 * - No usa cookies, localStorage ni sessionStorage para analítica.
 * - No genera fingerprint ni envía user-agent/referrer como campos analíticos.
 * - La petición al Apps Script usa credentials: "omit" y no-referrer.
 */
(() => {
  "use strict";

  const AV_ANALYTICS_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbzbPglrJZRnMAFzfeMQ8nC5QsDmOA9RFHIh6wNk5h7_8u0ah-ZrCrHWb1T3pgPK_Q/exec";

  const ATTRIBUTION_PARAMS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "utm_id",
    "av_location",
    "av_island",
    "av_municipality"
  ];

  const SESSION_PARAM = "av_session";
  const ENTRY_PARAM = "av_entry";
  const MAX_SESSION_LENGTH = 100;
  const ROOT_HOST = "archipielagovivo.org";

  function isArchipielagoVivoHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    return host === ROOT_HOST || host.endsWith(`.${ROOT_HOST}`);
  }

  function analyticsPath(url = window.location) {
    const host = String(url.hostname || "").toLowerCase();
    const path = url.pathname || "/";

    if (host === ROOT_HOST || host === `www.${ROOT_HOST}`) {
      return path;
    }

    if (host.endsWith(`.${ROOT_HOST}`)) {
      const subdomain = host.slice(0, -(ROOT_HOST.length + 1));
      const safeSubdomain = subdomain.replace(/[^a-z0-9.-]/g, "-");
      return `/@${safeSubdomain}${path.startsWith("/") ? path : `/${path}`}`;
    }

    // Fallback defensivo. El tracker solo debería cargarse en dominios AV.
    return path;
  }

  function generateSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }

    // Fallback para navegadores muy antiguos. Solo distingue esta navegación.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  }

  function cleanSessionId(value) {
    const text = String(value || "").trim().slice(0, MAX_SESSION_LENGTH);
    return /^[A-Za-z0-9._~-]+$/.test(text) ? text : "";
  }

  function cleanEntry(value) {
    const text = String(value || "").trim().slice(0, 300);
    return text.startsWith("/") ? text : "";
  }

  const currentUrl = new URL(window.location.href);
  const currentParams = currentUrl.searchParams;
  const currentPage = analyticsPath(currentUrl);

  const sessionId = cleanSessionId(currentParams.get(SESSION_PARAM)) || generateSessionId();
  const entryPage = cleanEntry(currentParams.get(ENTRY_PARAM)) || currentPage;

  // Conservamos únicamente los parámetros de atribución explícitamente permitidos.
  const attribution = {};
  for (const key of ATTRIBUTION_PARAMS) {
    const value = currentParams.get(key);
    if (value) attribution[key] = value;
  }

  function decorateAnchor(anchor) {
    if (!anchor || !anchor.getAttribute) return;

    const rawHref = anchor.getAttribute("href");
    if (!rawHref || rawHref.startsWith("#")) return;
    if (/^(mailto:|tel:|javascript:|data:)/i.test(rawHref)) return;

    let target;
    try {
      target = new URL(rawHref, window.location.href);
    } catch (_) {
      return;
    }

    if (!/^https?:$/.test(target.protocol) || !isArchipielagoVivoHost(target.hostname)) {
      return;
    }

    target.searchParams.set(SESSION_PARAM, sessionId);
    target.searchParams.set(ENTRY_PARAM, entryPage);

    for (const key of ATTRIBUTION_PARAMS) {
      if (attribution[key]) target.searchParams.set(key, attribution[key]);
    }

    anchor.href = target.toString();
  }

  /**
   * Decora los enlaces existentes al cargar la página.
   */
  function propagateSessionToLinks() {
    document.querySelectorAll("a[href]").forEach(decorateAnchor);
  }

  /**
   * También decora enlaces creados o modificados dinámicamente (p. ej. TV)
   * justo antes de que se navegue por ellos.
   */
  document.addEventListener("click", (event) => {
    const anchor = event.target && event.target.closest
      ? event.target.closest("a[href]")
      : null;
    if (anchor) decorateAnchor(anchor);
  }, true);

  function sendPageview() {
    const payload = {
      event: "pageview",
      session_id: sessionId,
      page: currentPage,
      entry_page: entryPage
    };

    for (const key of ATTRIBUTION_PARAMS) {
      if (attribution[key]) payload[key] = attribution[key];
    }

    fetch(AV_ANALYTICS_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      credentials: "omit",
      cache: "no-store",
      keepalive: true,
      referrerPolicy: "no-referrer",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8"
      },
      body: JSON.stringify(payload)
    }).catch(() => {
      // La analítica nunca debe bloquear ni alterar la navegación.
    });
  }

  propagateSessionToLinks();
  sendPageview();
})();
