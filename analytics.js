/*
 * Archipiélago Vivo — analítica web first-party y sin cookies.
 *
 * - Registra un pageview por carga.
 * - Crea un av_session efímero si la URL no trae uno.
 * - Propaga av_session + atribución UTM/AV únicamente entre URLs de
 *   archipielagovivo.org y sus subdominios.
 * - No usa cookies, localStorage ni sessionStorage.
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

  function isArchipielagoVivoHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    return host === "archipielagovivo.org" || host.endsWith(".archipielagovivo.org");
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

    // Fallback para navegadores muy antiguos. No pretende identificar al usuario:
    // solo distinguir esta navegación concreta.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  }

  function cleanSessionId(value) {
    const text = String(value || "").trim().slice(0, MAX_SESSION_LENGTH);
    return /^[A-Za-z0-9._~-]+$/.test(text) ? text : "";
  }

  const currentUrl = new URL(window.location.href);
  const currentParams = currentUrl.searchParams;

  const sessionId = cleanSessionId(currentParams.get(SESSION_PARAM)) || generateSessionId();
  const entryPage = currentParams.get(ENTRY_PARAM) || window.location.pathname || "/";

  // Conservamos únicamente los parámetros de atribución explícitamente permitidos.
  const attribution = {};
  for (const key of ATTRIBUTION_PARAMS) {
    const value = currentParams.get(key);
    if (value) {
      attribution[key] = value;
    }
  }

  /**
   * Añade el contexto de navegación a los enlaces de Archipiélago Vivo.
   * Conserva hashes existentes (#contacto, #que-es, etc.).
   */
  function propagateSessionToLinks() {
    document.querySelectorAll("a[href]").forEach((anchor) => {
      const rawHref = anchor.getAttribute("href");

      if (!rawHref || rawHref.startsWith("#")) {
        // Un ancla dentro de la misma página no inicia una página nueva.
        return;
      }

      if (/^(mailto:|tel:|javascript:|data:)/i.test(rawHref)) {
        return;
      }

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
        const value = attribution[key];
        if (value) {
          target.searchParams.set(key, value);
        }
      }

      anchor.href = target.toString();
    });
  }

  /**
   * Envía el pageview. El Apps Script calcula has_campaign en servidor.
   */
  function sendPageview() {
    const payload = {
      event: "pageview",
      session_id: sessionId,
      page: window.location.pathname || "/",
      entry_page: entryPage
    };

    for (const key of ATTRIBUTION_PARAMS) {
      if (attribution[key]) {
        payload[key] = attribution[key];
      }
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
      // La analítica nunca debe bloquear ni alterar la navegación de la web.
    });
  }

  propagateSessionToLinks();
  sendPageview();
})();
