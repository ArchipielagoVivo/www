/*
 * Archipiélago Vivo — analítica first-party común para todo el ecosistema.
 *
 * La hoja de Google Sheets, a través del Apps Script, actúa como whitelist:
 * cualquier detalle escalar enviado por AVAnalytics.track() se remite al
 * backend y sólo se guarda si existe una columna con ese mismo nombre.
 */
(() => {
  "use strict";

  const AV_ANALYTICS_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbzbPglrJZRnMAFzfeMQ8nC5QsDmOA9RFHIh6wNk5h7_8u0ah-ZrCrHWb1T3pgPK_Q/exec";

  const ROOT_HOST = "archipielagovivo.org";
  const SESSION_PARAM = "av_session";
  const ENTRY_PARAM = "av_entry";
  const NOSTATS_PARAM = "nostats";
  const MAX_SESSION_LENGTH = 100;
  const MAX_REFERRER_LENGTH = 500;

  const ATTRIBUTION_PARAMS = [
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "utm_id", "utm_referrer", "av_location", "av_island", "av_municipality"
  ];

  const RESERVED_DETAIL_FIELDS = new Set([
    "event", "session_id", "page", "entry_page", "has_campaign", "timestamp",
    "nostats", "referrer", ...ATTRIBUTION_PARAMS
  ]);

  function isArchipielagoVivoHost(hostname) {
    const host = String(hostname || "").toLowerCase();
    return host === ROOT_HOST || host.endsWith(`.${ROOT_HOST}`);
  }

  function analyticsPath(url = window.location) {
    const host = String(url.hostname || "").toLowerCase();
    const path = url.pathname || "/";
    if (host === ROOT_HOST || host === `www.${ROOT_HOST}`) return path;
    if (host.endsWith(`.${ROOT_HOST}`)) {
      const subdomain = host.slice(0, -(ROOT_HOST.length + 1));
      const safeSubdomain = subdomain.replace(/[^a-z0-9.-]/g, "-");
      return `/@${safeSubdomain}${path.startsWith("/") ? path : `/${path}`}`;
    }
    return path;
  }

  function generateSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    }
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

  function isNoStats(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  }

  function normalizedReferrer() {
    const raw = String(document.referrer || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      if (!/^https?:$/.test(url.protocol)) return "";
      return `${url.origin}${url.pathname}`.slice(0, MAX_REFERRER_LENGTH);
    } catch (_) {
      return "";
    }
  }

  function isScalar(value) {
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
  }

  const currentUrl = new URL(window.location.href);
  const currentParams = currentUrl.searchParams;
  const currentPage = analyticsPath(currentUrl);
  const statsDisabled = isNoStats(currentParams.get(NOSTATS_PARAM));
  const sessionId = cleanSessionId(currentParams.get(SESSION_PARAM)) || generateSessionId();
  const entryPage = cleanEntry(currentParams.get(ENTRY_PARAM)) || currentPage;
  const referrer = normalizedReferrer();

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
    try { target = new URL(rawHref, window.location.href); } catch (_) { return; }
    if (!/^https?:$/.test(target.protocol) || !isArchipielagoVivoHost(target.hostname)) return;
    target.searchParams.set(SESSION_PARAM, sessionId);
    target.searchParams.set(ENTRY_PARAM, entryPage);
    for (const key of ATTRIBUTION_PARAMS) {
      if (attribution[key]) target.searchParams.set(key, attribution[key]);
    }
    if (statsDisabled) target.searchParams.set(NOSTATS_PARAM, "1");
    anchor.href = target.toString();
  }

  document.querySelectorAll("a[href]").forEach(decorateAnchor);
  document.addEventListener("click", event => {
    const anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (anchor) decorateAnchor(anchor);
  }, true);

  function buildPayload(eventName, details = {}) {
    const payload = {
      event: String(eventName || "").trim(),
      session_id: sessionId,
      page: currentPage,
      entry_page: entryPage
    };
    for (const key of ATTRIBUTION_PARAMS) {
      if (attribution[key]) payload[key] = attribution[key];
    }
    if (referrer) payload.referrer = referrer;
    if (details && typeof details === "object" && !Array.isArray(details)) {
      for (const [key, value] of Object.entries(details)) {
        if (!/^[a-zA-Z0-9_]{1,100}$/.test(key)) continue;
        if (RESERVED_DETAIL_FIELDS.has(key)) continue;
        if (!isScalar(value)) continue;
        if (typeof value === "number" && !Number.isFinite(value)) continue;
        payload[key] = value;
      }
    }
    return payload;
  }

  function sendEvent(eventName, details = {}) {
    if (statsDisabled) return false;
    const event = String(eventName || "").trim();
    if (!event) return false;
    fetch(AV_ANALYTICS_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      credentials: "omit",
      cache: "no-store",
      keepalive: true,
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(buildPayload(event, details))
    }).catch(() => {});
    return true;
  }

  window.AVAnalytics = Object.freeze({
    track(eventName, details = {}) { return sendEvent(eventName, details); },
    disabled: statsDisabled
  });

  sendEvent("pageview");
})();
