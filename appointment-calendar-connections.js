"use strict";

const crypto = require("crypto");
const { decryptStoredText, encryptStoredText, safeEqualText } = require("./security");

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly"
];
const MICROSOFT_CALENDAR_SCOPES = ["offline_access", "User.Read", "Calendars.ReadWrite"];
const APPOINTMENT_CALENDAR_SUMMARY = "Citas NextforIA";
const CALENDAR_STATUSES = ["not_connected", "connecting", "connected", "needs_attention", "disconnected"];
const CALENDAR_PROVIDERS = ["google", "microsoft"];
// Samsung Calendar is a device calendar, not a separate server-side calendar API.
// We store the surface the customer chose while keeping Google/Microsoft as the
// actual OAuth provider that owns events, availability and credentials.
const CALENDAR_SURFACES = ["direct", "samsung"];

class AppointmentCalendarError extends Error {
  constructor(code, status, internalMessage) {
    super(code);
    this.name = "AppointmentCalendarError";
    this.code = String(code || "calendar_connection_failed");
    this.status = Number(status) || 422;
    this.internalMessage = String(internalMessage || code || "").slice(0, 800);
  }
}

function cleanText(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max || 240);
}

function cleanTenantId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 80);
}

function iso(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function actorLabel(actor) {
  if (typeof actor === "string") return cleanText(actor, 200) || "system";
  return cleanText(actor && (actor.email || actor.username || actor.user_id || actor.name), 200) || "system";
}

function internalError(error) {
  const data = error && error.response && error.response.data;
  return cleanText(
    data && data.error_description ||
    data && data.error && (data.error.message || data.error) ||
    data && data.message ||
    error && error.internalMessage ||
    error && error.message ||
    "calendar_connection_failed",
    800
  );
}

function cleanCalendarProvider(value) {
  const provider = cleanText(value, 40).toLowerCase();
  return CALENDAR_PROVIDERS.includes(provider) ? provider : "google";
}

function cleanCalendarSurface(value) {
  const surface = cleanText(value, 40).toLowerCase();
  return CALENDAR_SURFACES.includes(surface) ? surface : "direct";
}

function emptyCalendarConnection(tenantId, providerId) {
  return {
    tenant_id: cleanTenantId(tenantId),
    provider: cleanCalendarProvider(providerId),
    surface: "direct",
    status: "not_connected",
    account_email: null,
    account_label: null,
    calendar_id: null,
    calendar_summary: null,
    calendar_mode: null,
    availability_calendar_ids: [],
    scopes: [],
    connected_at: null,
    connected_by: null,
    disconnected_at: null,
    disconnected_by: null,
    last_verified_at: null,
    last_error: null,
    last_error_at: null,
    updated_at: null,
    credentials_ciphertext: null,
    credential_source: null
  };
}

function publicCalendarConnection(record, options) {
  const safe = Object.assign(emptyCalendarConnection(record && record.tenant_id, record && record.provider), record || {});
  safe.provider = cleanCalendarProvider(safe.provider);
  safe.surface = cleanCalendarSurface(safe.surface);
  safe.availability_calendar_ids = Array.isArray(safe.availability_calendar_ids)
    ? safe.availability_calendar_ids.slice()
    : [];
  delete safe.credentials_ciphertext;
  delete safe.credential_source;
  safe.connect_available = ["not_connected", "connecting", "disconnected", "needs_attention"].includes(safe.status);
  safe.disconnect_available = ["connected", "needs_attention", "connecting"].includes(safe.status);
  safe.reconnect_available = ["needs_attention", "disconnected"].includes(safe.status);
  if (!(options && options.superAdmin)) {
    delete safe.last_error;
    delete safe.last_error_at;
    delete safe.connected_by;
    delete safe.disconnected_by;
  }
  return safe;
}

function createCalendarOAuthState(secret, input, now) {
  const key = String(secret || "");
  if (key.length < 32) throw new AppointmentCalendarError("calendar_oauth_not_configured", 503, "OAuth state secret is missing");
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    tenant_id: cleanTenantId(input && input.tenant_id),
    provider: cleanCalendarProvider(input && input.provider),
    surface: cleanCalendarSurface(input && input.surface),
    actor_id: cleanText(input && input.actor_id, 200),
    actor: cleanText(input && input.actor, 200),
    redirect_uri: cleanText(input && input.redirect_uri, 500),
    return_path: cleanText(input && input.return_path, 500),
    return_mode: input && input.return_mode === "popup" ? "popup" : "",
    nonce: crypto.randomBytes(24).toString("base64url"),
    exp: Number(now || Date.now()) + 10 * 60 * 1000
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", key).update("appointment-calendar-oauth." + payload).digest("base64url");
  return payload + "." + signature;
}

function readCalendarOAuthState(secret, token, now) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac("sha256", String(secret || "")).update("appointment-calendar-oauth." + parts[0]).digest("base64url");
  if (!safeEqualText(parts[1], expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (payload.v !== 1 || !payload.exp || payload.exp < Number(now || Date.now())) return null;
    payload.tenant_id = cleanTenantId(payload.tenant_id);
    payload.provider = cleanCalendarProvider(payload.provider);
    payload.surface = cleanCalendarSurface(payload.surface);
    payload.redirect_uri = cleanText(payload.redirect_uri, 500);
    payload.return_mode = payload.return_mode === "popup" ? "popup" : "";
    if (!payload.tenant_id || !payload.nonce || !payload.actor_id) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

class InMemoryAppointmentCalendarStore {
  constructor() {
    this.rows = [];
    this.audit = [];
  }

  async get(tenantId) {
    const cleanTenant = cleanTenantId(tenantId);
    const row = this.rows.find(function (item) { return item.tenant_id === cleanTenant; });
    return row ? Object.assign({}, row, {
      scopes: (row.scopes || []).slice(),
      availability_calendar_ids: (row.availability_calendar_ids || []).slice()
    }) : null;
  }

  async listAll() {
    return this.rows.map(function (row) {
      return Object.assign({}, row, {
        scopes: (row.scopes || []).slice(),
        availability_calendar_ids: (row.availability_calendar_ids || []).slice()
      });
    });
  }

  async upsert(input, event) {
    const tenantId = cleanTenantId(input && input.tenant_id);
    if (!tenantId) throw new AppointmentCalendarError("invalid_calendar_request", 400);
    let row = this.rows.find(function (item) { return item.tenant_id === tenantId; });
    if (!row) {
      row = emptyCalendarConnection(tenantId);
      this.rows.push(row);
    }
    Object.assign(row, input, {
      tenant_id: tenantId,
      provider: cleanCalendarProvider(input && input.provider || row.provider),
      updated_at: input.updated_at || new Date().toISOString()
    });
    if (event) {
      this.audit.push({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        action: cleanText(event.action, 80),
        actor: actorLabel(event.actor),
        details: event.details || {},
        created_at: new Date().toISOString()
      });
    }
    return this.get(tenantId);
  }
}

class AppendOnlyAppointmentCalendarStore {
  constructor(options) {
    this.loadLatest = options && options.loadLatest;
    this.loadAll = options && options.loadAll;
    this.append = options && options.append;
    if (typeof this.loadLatest !== "function" || typeof this.loadAll !== "function" || typeof this.append !== "function") {
      throw new Error("append_only_appointment_calendar_store_callbacks_required");
    }
  }

  recordId(tenantId) {
    return "appointment-calendar:" + cleanTenantId(tenantId);
  }

  async get(tenantId) {
    const cleanTenant = cleanTenantId(tenantId);
    if (!cleanTenant) return null;
    const row = await this.loadLatest(this.recordId(cleanTenant), cleanTenant);
    return row ? Object.assign(emptyCalendarConnection(cleanTenant, row.provider), row, {
      tenant_id: cleanTenant,
      provider: cleanCalendarProvider(row.provider)
    }) : null;
  }

  async listAll() {
    const rows = await this.loadAll();
    const seen = new Set();
    return (Array.isArray(rows) ? rows : []).filter(function (row) {
      const tenantId = cleanTenantId(row && row.tenant_id);
      if (!tenantId || seen.has(tenantId)) return false;
      seen.add(tenantId);
      return true;
    }).map(function (row) {
      return Object.assign(emptyCalendarConnection(row.tenant_id, row.provider), row, {
        tenant_id: cleanTenantId(row.tenant_id),
        provider: cleanCalendarProvider(row.provider)
      });
    });
  }

  async upsert(input, event) {
    const tenantId = cleanTenantId(input && input.tenant_id);
    if (!tenantId) throw new AppointmentCalendarError("invalid_calendar_request", 400);
    const current = await this.get(tenantId);
    const row = Object.assign(emptyCalendarConnection(tenantId, input && input.provider || current && current.provider), current || {}, input || {}, {
      tenant_id: tenantId,
      provider: cleanCalendarProvider(input && input.provider || current && current.provider),
      updated_at: input && input.updated_at || new Date().toISOString()
    });
    await this.append(this.recordId(tenantId), row, event || null);
    return row;
  }
}

class GoogleCalendarProvider {
  constructor(options) {
    options = options || {};
    this.clientId = cleanText(options.clientId, 300);
    this.clientSecret = cleanText(options.clientSecret, 800);
    this.redirectUri = cleanText(options.redirectUri, 500);
    this.authOrigin = String(options.authOrigin || "https://accounts.google.com").replace(/\/$/, "");
    this.tokenUrl = String(options.tokenUrl || "https://oauth2.googleapis.com/token");
    this.calendarOrigin = String(options.calendarOrigin || "https://www.googleapis.com").replace(/\/$/, "");
    this.axios = options.axiosClient;
  }

  configured() {
    return !!(this.clientId && this.clientSecret && this.redirectUri && this.axios);
  }

  authorizationUrl(state, options) {
    const redirectUri = cleanText(options && options.redirectUri || this.redirectUri, 500);
    if (!this.clientId || !this.clientSecret || !redirectUri) throw new AppointmentCalendarError("calendar_oauth_not_configured", 503);
    const url = new URL(this.authOrigin + "/o/oauth2/v2/auth");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", CALENDAR_SCOPES.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    return url.toString();
  }

  async exchangeCode(code, options) {
    const redirectUri = cleanText(options && options.redirectUri || this.redirectUri, 500);
    if (!code) throw new AppointmentCalendarError("calendar_authorization_denied", 400);
    const body = new URLSearchParams({
      code: String(code),
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    });
    const response = await this.axios.post(this.tokenUrl, body.toString(), {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      timeout: 10000
    });
    return this.normalizeToken(response.data);
  }

  async refreshToken(refreshToken) {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: String(refreshToken || ""),
      grant_type: "refresh_token"
    });
    const response = await this.axios.post(this.tokenUrl, body.toString(), {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      timeout: 10000
    });
    return this.normalizeToken(Object.assign({}, response.data, { refresh_token: refreshToken }));
  }

  normalizeToken(data) {
    const accessToken = cleanText(data && data.access_token, 4096);
    if (!accessToken) throw new AppointmentCalendarError("calendar_token_missing", 422);
    return {
      access_token: accessToken,
      refresh_token: cleanText(data && data.refresh_token, 4096),
      token_type: cleanText(data && data.token_type || "Bearer", 80),
      scope: cleanText(data && data.scope, 2000),
      expires_at: new Date(Date.now() + Math.max(60, Number(data && data.expires_in) || 3600) * 1000).toISOString()
    };
  }

  async listCalendars(token) {
    const response = await this.axios.get(this.calendarOrigin + "/calendar/v3/users/me/calendarList", {
      headers: { Authorization: "Bearer " + token.access_token },
      params: { showHidden: false },
      timeout: 10000
    });
    return Array.isArray(response.data && response.data.items) ? response.data.items : [];
  }

  calendarDetails(items, target, availabilityCalendarIds, calendarMode) {
    const primary = items.find(function (item) { return item.primary; }) || items[0] || {};
    return {
      calendar_id: cleanText(target && target.id || primary.id || "primary", 500) || "primary",
      calendar_summary: cleanText(target && target.summary || target && target.id || APPOINTMENT_CALENDAR_SUMMARY, 240),
      calendar_mode: cleanText(calendarMode, 80) || null,
      availability_calendar_ids: Array.from(new Set((availabilityCalendarIds || [primary.id, target && target.id])
        .map(function (value) { return cleanText(value, 500); })
        .filter(Boolean))),
      account_email: cleanText(primary.id && String(primary.id).indexOf("@") >= 0 ? primary.id : "", 240).toLowerCase(),
      account_label: cleanText(primary.summary || primary.id || "Google Calendar", 240),
      primary_calendar_id: cleanText(primary.id || "primary", 500) || "primary",
      primary_time_zone: cleanText(primary.timeZone || "", 120)
    };
  }

  async createAppointmentCalendar(token, timeZone) {
    const response = await this.axios.post(this.calendarOrigin + "/calendar/v3/calendars", {
      summary: APPOINTMENT_CALENDAR_SUMMARY,
      description: "Calendario creado por NextforIA para registrar las citas del bot.",
      timeZone: cleanText(timeZone, 120) || "America/Bogota"
    }, {
      headers: { Authorization: "Bearer " + token.access_token },
      timeout: 10000
    });
    const created = response.data || {};
    if (!cleanText(created.id, 500)) {
      throw new AppointmentCalendarError("calendar_creation_failed", 422, "Google did not return a calendar id");
    }
    return created;
  }

  async prepareAppointmentCalendar(token, current) {
    const items = await this.listCalendars(token);
    const primary = items.find(function (item) { return item.primary; }) || items[0] || {};
    const currentId = cleanText(current && current.calendar_id, 500);
    let target = current && current.calendar_mode === "app_created"
      ? items.find(function (item) { return cleanText(item.id, 500) === currentId; })
      : null;
    if (!target) target = await this.createAppointmentCalendar(token, primary.timeZone);
    return this.calendarDetails(items.concat([target]), target, [primary.id || "primary", target.id], "app_created");
  }

  async describeCalendar(token, options) {
    const items = await this.listCalendars(token);
    const calendarId = cleanText(options && options.calendarId, 500);
    const target = items.find(function (item) { return cleanText(item.id, 500) === calendarId; });
    if (options && options.requireCalendar && !target) {
      throw new AppointmentCalendarError("calendar_target_missing", 422, "Nextfor appointment calendar is missing");
    }
    return this.calendarDetails(items, target || items.find(function (item) { return item.primary; }) || items[0] || {},
      options && options.availabilityCalendarIds, options && options.calendarMode);
  }

  appointmentEventBody(appointment) {
    const start = new Date(appointment && appointment.starts_at);
    if (!Number.isFinite(start.getTime())) {
      throw new AppointmentCalendarError("appointment_start_required", 422);
    }
    const durationMinutes = Math.max(5, Math.min(Number(appointment && appointment.duration_minutes) || 60, 24 * 60));
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const customerName = cleanText(appointment && appointment.customer_name, 160) || "Cliente";
    const reason = cleanText(appointment && appointment.consultation_reason, 1000) || "Cita";
    const description = [
      "Cita gestionada por Nextfor IA.",
      appointment && appointment.customer_phone ? "Teléfono: " + cleanText(appointment.customer_phone, 80) : "",
      appointment && appointment.customer_email ? "Correo: " + cleanText(appointment.customer_email, 200) : "",
      appointment && appointment.transcript_summary ? "Contexto: " + cleanText(appointment.transcript_summary, 2000) : ""
    ].filter(Boolean).join("\n");
    return {
      summary: reason + " · " + customerName,
      description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      extendedProperties: {
        private: {
          nextfor_tenant_id: cleanTenantId(appointment && appointment.tenant_id),
          nextfor_appointment_id: cleanText(appointment && (appointment.appointment_id || appointment.conversation_id), 160),
          nextfor_conversation_id: cleanText(appointment && appointment.customer_conversation_id, 200)
        }
      }
    };
  }

  async upsertAppointment(token, calendarId, appointment) {
    const base = this.calendarOrigin + "/calendar/v3/calendars/" + encodeURIComponent(calendarId || "primary") + "/events";
    const eventId = cleanText(appointment && appointment.calendar_event_id, 500);
    const body = this.appointmentEventBody(appointment);
    const options = {
      headers: { Authorization: "Bearer " + token.access_token },
      params: { sendUpdates: "none" },
      timeout: 10000
    };
    const response = eventId
      ? await this.axios.patch(base + "/" + encodeURIComponent(eventId), body, options)
      : await this.axios.post(base, body, options);
    return {
      event_id: cleanText(response.data && response.data.id, 500) || eventId,
      event_link: cleanText(response.data && response.data.htmlLink, 1000),
      status: cleanText(response.data && response.data.status, 80) || "confirmed"
    };
  }

  async checkAvailability(token, calendarIds, startsAt, durationMinutes) {
    const start = new Date(startsAt);
    if (!Number.isFinite(start.getTime())) {
      throw new AppointmentCalendarError("appointment_start_required", 422);
    }
    const minutes = Math.max(5, Math.min(Number(durationMinutes) || 60, 24 * 60));
    const end = new Date(start.getTime() + minutes * 60 * 1000);
    const ids = Array.from(new Set((Array.isArray(calendarIds) ? calendarIds : [calendarIds])
      .map(function (value) { return cleanText(value, 500); })
      .filter(Boolean)));
    const response = await this.axios.post(this.calendarOrigin + "/calendar/v3/freeBusy", {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      items: (ids.length ? ids : ["primary"]).map(function (id) { return { id }; })
    }, {
      headers: { Authorization: "Bearer " + token.access_token },
      timeout: 10000
    });
    const calendars = response.data && response.data.calendars || {};
    const busy = Object.keys(calendars).reduce(function (all, calendarId) {
      const row = calendars[calendarId] || {};
      (Array.isArray(row.busy) ? row.busy : []).forEach(function (slot) {
        all.push(Object.assign({ calendar_id: calendarId }, slot));
      });
      return all;
    }, []);
    return {
      available: busy.length === 0,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      busy
    };
  }

  async cancelAppointment(token, calendarId, eventId) {
    const cleanEventId = cleanText(eventId, 500);
    if (!cleanEventId) return { cancelled: false, not_required: true };
    const url = this.calendarOrigin + "/calendar/v3/calendars/" + encodeURIComponent(calendarId || "primary") + "/events/" + encodeURIComponent(cleanEventId);
    await this.axios.delete(url, {
      headers: { Authorization: "Bearer " + token.access_token },
      params: { sendUpdates: "none" },
      timeout: 10000
    });
    return { cancelled: true, event_id: cleanEventId };
  }
}

class MicrosoftCalendarProvider {
  constructor(options) {
    options = options || {};
    this.clientId = cleanText(options.clientId, 300);
    this.clientSecret = cleanText(options.clientSecret, 800);
    this.redirectUri = cleanText(options.redirectUri, 500);
    this.tenant = cleanText(options.tenant || "common", 120) || "common";
    this.identityOrigin = String(options.identityOrigin || "https://login.microsoftonline.com").replace(/\/$/, "");
    this.graphOrigin = String(options.graphOrigin || "https://graph.microsoft.com/v1.0").replace(/\/$/, "");
    this.axios = options.axiosClient;
  }

  configured() {
    return !!(this.clientId && this.clientSecret && this.redirectUri && this.axios);
  }

  authorizationUrl(state, options) {
    const redirectUri = cleanText(options && options.redirectUri || this.redirectUri, 500);
    if (!this.clientId || !this.clientSecret || !redirectUri) {
      throw new AppointmentCalendarError("calendar_oauth_not_configured", 503);
    }
    const url = new URL(this.identityOrigin + "/" + encodeURIComponent(this.tenant) + "/oauth2/v2.0/authorize");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", MICROSOFT_CALENDAR_SCOPES.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    return url.toString();
  }

  tokenUrl() {
    return this.identityOrigin + "/" + encodeURIComponent(this.tenant) + "/oauth2/v2.0/token";
  }

  async exchangeCode(code, options) {
    const redirectUri = cleanText(options && options.redirectUri || this.redirectUri, 500);
    if (!code) throw new AppointmentCalendarError("calendar_authorization_denied", 400);
    const body = new URLSearchParams({
      code: String(code),
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
      scope: MICROSOFT_CALENDAR_SCOPES.join(" "),
      grant_type: "authorization_code"
    });
    const response = await this.axios.post(this.tokenUrl(), body.toString(), {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      timeout: 10000
    });
    return this.normalizeToken(response.data);
  }

  async refreshToken(refreshToken) {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: String(refreshToken || ""),
      scope: MICROSOFT_CALENDAR_SCOPES.join(" "),
      grant_type: "refresh_token"
    });
    const response = await this.axios.post(this.tokenUrl(), body.toString(), {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      timeout: 10000
    });
    return this.normalizeToken(Object.assign({ refresh_token: refreshToken }, response.data || {}));
  }

  normalizeToken(data) {
    const accessToken = cleanText(data && data.access_token, 4096);
    if (!accessToken) throw new AppointmentCalendarError("calendar_token_missing", 422);
    return {
      access_token: accessToken,
      refresh_token: cleanText(data && data.refresh_token, 4096),
      token_type: cleanText(data && data.token_type || "Bearer", 80),
      scope: cleanText(data && data.scope || MICROSOFT_CALENDAR_SCOPES.join(" "), 2000),
      expires_at: new Date(Date.now() + Math.max(60, Number(data && data.expires_in) || 3600) * 1000).toISOString()
    };
  }

  requestOptions(token, extra) {
    return Object.assign({
      headers: { Authorization: "Bearer " + token.access_token },
      timeout: 10000
    }, extra || {});
  }

  async profile(token) {
    const response = await this.axios.get(this.graphOrigin + "/me", this.requestOptions(token, {
      params: { "$select": "displayName,mail,userPrincipalName" }
    }));
    return response.data || {};
  }

  async listCalendars(token) {
    const response = await this.axios.get(this.graphOrigin + "/me/calendars", this.requestOptions(token, {
      params: { "$select": "id,name,isDefaultCalendar,canEdit" }
    }));
    return Array.isArray(response.data && response.data.value) ? response.data.value : [];
  }

  calendarDetails(items, profile, target, availabilityCalendarIds, calendarMode) {
    const primary = items.find(function (item) { return item.isDefaultCalendar; }) || items[0] || {};
    const email = cleanText(profile && (profile.mail || profile.userPrincipalName), 240).toLowerCase();
    return {
      calendar_id: cleanText(target && target.id || primary.id, 500),
      calendar_summary: cleanText(target && target.name || APPOINTMENT_CALENDAR_SUMMARY, 240),
      calendar_mode: cleanText(calendarMode, 80) || null,
      availability_calendar_ids: Array.from(new Set((availabilityCalendarIds || [primary.id, target && target.id])
        .map(function (value) { return cleanText(value, 500); })
        .filter(Boolean))),
      account_email: email,
      account_label: cleanText(profile && profile.displayName || email || "Microsoft Outlook", 240),
      primary_calendar_id: cleanText(primary.id, 500)
    };
  }

  async createAppointmentCalendar(token) {
    const response = await this.axios.post(this.graphOrigin + "/me/calendars", {
      name: APPOINTMENT_CALENDAR_SUMMARY
    }, this.requestOptions(token));
    const created = response.data || {};
    if (!cleanText(created.id, 500)) {
      throw new AppointmentCalendarError("calendar_creation_failed", 422, "Microsoft did not return a calendar id");
    }
    return created;
  }

  async calendarContext(token) {
    const result = await Promise.all([this.listCalendars(token), this.profile(token)]);
    return { items: result[0], profile: result[1] };
  }

  async prepareAppointmentCalendar(token, current) {
    const context = await this.calendarContext(token);
    const primary = context.items.find(function (item) { return item.isDefaultCalendar; }) || context.items[0] || {};
    const currentId = cleanText(current && current.provider === "microsoft" && current.calendar_id, 500);
    let target = currentId && current && current.calendar_mode === "app_created"
      ? context.items.find(function (item) { return cleanText(item.id, 500) === currentId; })
      : null;
    if (!target) target = await this.createAppointmentCalendar(token);
    return this.calendarDetails(context.items.concat([target]), context.profile, target, [primary.id, target.id], "app_created");
  }

  async describeCalendar(token, options) {
    const context = await this.calendarContext(token);
    const calendarId = cleanText(options && options.calendarId, 500);
    const target = context.items.find(function (item) { return cleanText(item.id, 500) === calendarId; });
    if (options && options.requireCalendar && !target) {
      throw new AppointmentCalendarError("calendar_target_missing", 422, "Nextfor appointment calendar is missing");
    }
    return this.calendarDetails(
      context.items,
      context.profile,
      target || context.items.find(function (item) { return item.isDefaultCalendar; }) || context.items[0] || {},
      options && options.availabilityCalendarIds,
      options && options.calendarMode
    );
  }

  appointmentEventBody(appointment) {
    const start = new Date(appointment && appointment.starts_at);
    if (!Number.isFinite(start.getTime())) throw new AppointmentCalendarError("appointment_start_required", 422);
    const durationMinutes = Math.max(5, Math.min(Number(appointment && appointment.duration_minutes) || 60, 24 * 60));
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const customerName = cleanText(appointment && appointment.customer_name, 160) || "Cliente";
    const reason = cleanText(appointment && appointment.consultation_reason, 1000) || "Cita";
    const description = [
      "Cita gestionada por Nextfor IA.",
      appointment && appointment.customer_phone ? "Teléfono: " + cleanText(appointment.customer_phone, 80) : "",
      appointment && appointment.customer_email ? "Correo: " + cleanText(appointment.customer_email, 200) : "",
      appointment && appointment.transcript_summary ? "Contexto: " + cleanText(appointment.transcript_summary, 2000) : ""
    ].filter(Boolean).join("\n");
    function graphDateTime(date) { return date.toISOString().replace(/Z$/, ""); }
    return {
      subject: reason + " · " + customerName,
      body: { contentType: "Text", content: description },
      start: { dateTime: graphDateTime(start), timeZone: "UTC" },
      end: { dateTime: graphDateTime(end), timeZone: "UTC" },
      showAs: "busy"
    };
  }

  async upsertAppointment(token, calendarId, appointment) {
    const base = this.graphOrigin + "/me/calendars/" + encodeURIComponent(calendarId) + "/events";
    const eventId = cleanText(appointment && appointment.calendar_event_id, 500);
    const body = this.appointmentEventBody(appointment);
    let response;
    if (eventId) {
      try {
        response = await this.axios.patch(base + "/" + encodeURIComponent(eventId), body, this.requestOptions(token));
      } catch (error) {
        if (!(error && error.response && error.response.status === 404)) throw error;
      }
    }
    if (!response) {
      body.transactionId = crypto.createHash("sha256").update([
        cleanTenantId(appointment && appointment.tenant_id),
        cleanText(appointment && (appointment.appointment_id || appointment.conversation_id), 160),
        cleanText(appointment && appointment.starts_at, 80)
      ].join(":"), "utf8").digest("hex").slice(0, 64);
      response = await this.axios.post(base, body, this.requestOptions(token));
    }
    return {
      event_id: cleanText(response.data && response.data.id, 500) || eventId,
      event_link: cleanText(response.data && response.data.webLink, 1000),
      status: cleanText(response.data && response.data.showAs, 80) || "confirmed"
    };
  }

  async checkAvailability(token, calendarIds, startsAt, durationMinutes) {
    const start = new Date(startsAt);
    if (!Number.isFinite(start.getTime())) throw new AppointmentCalendarError("appointment_start_required", 422);
    const minutes = Math.max(5, Math.min(Number(durationMinutes) || 60, 24 * 60));
    const end = new Date(start.getTime() + minutes * 60 * 1000);
    const ids = Array.from(new Set((Array.isArray(calendarIds) ? calendarIds : [calendarIds])
      .map(function (value) { return cleanText(value, 500); })
      .filter(Boolean)));
    const rows = await Promise.all((ids.length ? ids : [""]).map(async (calendarId) => {
      const path = calendarId
        ? "/me/calendars/" + encodeURIComponent(calendarId) + "/calendarView"
        : "/me/calendarView";
      const response = await this.axios.get(this.graphOrigin + path, this.requestOptions(token, {
        headers: {
          Authorization: "Bearer " + token.access_token,
          Prefer: 'outlook.timezone="UTC"'
        },
        params: {
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          "$select": "id,subject,start,end,showAs,isCancelled"
        }
      }));
      return (Array.isArray(response.data && response.data.value) ? response.data.value : []).map(function (event) {
        return Object.assign({ calendar_id: calendarId }, event);
      });
    }));
    const busy = rows.reduce(function (all, events) {
      return all.concat(events.filter(function (event) { return !event.isCancelled && event.showAs !== "free"; }));
    }, []);
    return {
      available: busy.length === 0,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      busy
    };
  }

  async cancelAppointment(token, calendarId, eventId) {
    const cleanEventId = cleanText(eventId, 500);
    if (!cleanEventId) return { cancelled: false, not_required: true };
    await this.axios.delete(
      this.graphOrigin + "/me/calendars/" + encodeURIComponent(calendarId) + "/events/" + encodeURIComponent(cleanEventId),
      this.requestOptions(token)
    );
    return { cancelled: true, event_id: cleanEventId };
  }
}

function createAppointmentCalendarConnectionService(options) {
  options = options || {};
  const store = options.store;
  const providers = Object.assign({}, options.providers || {}, options.provider ? { google: options.provider } : {});
  const defaultProvider = cleanCalendarProvider(options.defaultProvider || "google");
  const encryptionKey = options.encryptionKey;
  const now = options.now || function () { return new Date(); };
  if (!store) throw new Error("appointment_calendar_store_required");

  function providerFor(providerId) {
    return providers[cleanCalendarProvider(providerId)];
  }

  function encryptedCredential(payload) {
    if (!encryptionKey) throw new AppointmentCalendarError("calendar_encryption_not_configured", 503);
    return encryptStoredText(JSON.stringify(payload || {}), encryptionKey);
  }

  function credentialPayload(record) {
    if (!record || !record.credentials_ciphertext || !encryptionKey) return null;
    try { return JSON.parse(decryptStoredText(record.credentials_ciphertext, encryptionKey)); }
    catch (error) { throw new AppointmentCalendarError("calendar_credentials_unreadable", 503, error.message); }
  }

  async function markFailure(tenantId, providerId, actor, error) {
    const at = iso(now());
    const current = await store.get(tenantId);
    const cleanProvider = cleanCalendarProvider(providerId || current && current.provider);
    // A cancelled or failed attempt to switch providers must not disable the
    // calendar that is already connected and serving this tenant.
    if (current && current.status === "connected" && current.provider !== cleanProvider) return;
    await store.upsert({
      tenant_id: tenantId,
      provider: cleanProvider,
      status: "needs_attention",
      last_error: internalError(error),
      last_error_at: at,
      updated_at: at
    }, {
      action: "connection_failed",
      actor: actorLabel(actor),
      details: { error: internalError(error) }
    });
  }

  async function verifyWithRefresh(record, actor) {
    const provider = providerFor(record && record.provider);
    if (!provider || !provider.configured()) throw new AppointmentCalendarError("calendar_oauth_not_configured", 503);
    let credential = credentialPayload(record);
    if (!credential || !credential.access_token) throw new AppointmentCalendarError("calendar_connection_not_found", 404);
    try {
      const details = await provider.describeCalendar(credential, {
        calendarId: record.calendar_id,
        calendarMode: record.calendar_mode,
        requireCalendar: record.calendar_mode === "app_created",
        availabilityCalendarIds: record.availability_calendar_ids
      });
      return { credential, details };
    } catch (error) {
      if (!(error && error.response && error.response.status === 401) || !credential.refresh_token) throw error;
      credential = Object.assign({}, credential, await provider.refreshToken(credential.refresh_token));
      const details = await provider.describeCalendar(credential, {
        calendarId: record.calendar_id,
        calendarMode: record.calendar_mode,
        requireCalendar: record.calendar_mode === "app_created",
        availabilityCalendarIds: record.availability_calendar_ids
      });
      await store.upsert({
        tenant_id: record.tenant_id,
        credentials_ciphertext: encryptedCredential(credential),
        credential_source: "oauth",
        updated_at: iso(now())
      }, {
        action: "token_refreshed",
        actor: actorLabel(actor),
        details: {}
      });
      return { credential, details };
    }
  }

  async function withFreshCredential(record, actor, operation) {
    const provider = providerFor(record && record.provider);
    if (!provider || !provider.configured()) throw new AppointmentCalendarError("calendar_oauth_not_configured", 503);
    let credential = credentialPayload(record);
    if (!credential || !credential.access_token) {
      throw new AppointmentCalendarError("calendar_connection_not_found", 404);
    }
    try {
      return await operation(credential);
    } catch (error) {
      if (!(error && error.response && error.response.status === 401) || !credential.refresh_token) throw error;
      credential = Object.assign({}, credential, await provider.refreshToken(credential.refresh_token));
      await store.upsert({
        tenant_id: record.tenant_id,
        credentials_ciphertext: encryptedCredential(credential),
        credential_source: "oauth",
        updated_at: iso(now())
      }, {
        action: "token_refreshed",
        actor: actorLabel(actor),
        details: {}
      });
      return operation(credential);
    }
  }

  return {
    providerConfigured(providerId) {
      const provider = providerFor(providerId || defaultProvider);
      return !!(provider && provider.configured());
    },

    providerAvailability() {
      return CALENDAR_PROVIDERS.reduce(function (result, providerId) {
        const provider = providerFor(providerId);
        result[providerId] = !!(provider && provider.configured());
        return result;
      }, {});
    },

    async get(tenantId, options) {
      const cleanTenant = cleanTenantId(tenantId);
      const row = await store.get(cleanTenant);
      return publicCalendarConnection(row || emptyCalendarConnection(cleanTenant), options);
    },

    async listAll(tenants) {
      const rows = await store.listAll();
      const byTenant = new Map(rows.map(function (row) { return [cleanTenantId(row.tenant_id), row]; }));
      const tenantRows = Array.isArray(tenants) ? tenants : [];
      const tenantIds = new Set(rows.map(function (row) { return cleanTenantId(row.tenant_id); }));
      tenantRows.forEach(function (tenant) { const id = cleanTenantId(tenant.id || tenant.tenant_id); if (id) tenantIds.add(id); });
      return Array.from(tenantIds).map(function (tenantId) {
        const tenant = tenantRows.find(function (item) { return cleanTenantId(item.id || item.tenant_id) === tenantId; }) || {};
        return Object.assign({ company_name: tenant.company_name || tenant.name || tenantId }, publicCalendarConnection(byTenant.get(tenantId) || emptyCalendarConnection(tenantId), { superAdmin: true }));
      }).sort(function (left, right) { return String(left.company_name).localeCompare(String(right.company_name)); });
    },

    async begin(tenantId, providerId, actor, state, beginOptions) {
      if (!CALENDAR_PROVIDERS.includes(String(providerId || "").toLowerCase())) {
        beginOptions = state;
        state = actor;
        actor = providerId;
        providerId = defaultProvider;
      }
      const cleanTenant = cleanTenantId(tenantId);
      const cleanProvider = cleanCalendarProvider(providerId);
      const provider = providerFor(cleanProvider);
      if (!cleanTenant) throw new AppointmentCalendarError("invalid_calendar_request", 400);
      if (!provider || !provider.configured()) throw new AppointmentCalendarError("calendar_oauth_not_configured", 503);
      const current = await store.get(cleanTenant);
      const surface = cleanCalendarSurface(beginOptions && beginOptions.surface);
      if (!(current && current.status === "connected" && current.provider !== cleanProvider)) {
        await store.upsert({
          tenant_id: cleanTenant,
          provider: cleanProvider,
          surface,
          status: "connecting",
          last_error: null,
          last_error_at: null,
          updated_at: iso(now())
        }, {
          action: "connection_started",
          actor: actorLabel(actor),
          details: { provider: cleanProvider, surface }
        });
      }
      return provider.authorizationUrl(state, beginOptions);
    },

    async completeAuthorization(input) {
      const tenantId = cleanTenantId(input && input.tenant_id);
      const providerId = cleanCalendarProvider(input && input.provider || defaultProvider);
      const surface = cleanCalendarSurface(input && input.surface);
      const provider = providerFor(providerId);
      if (!tenantId) throw new AppointmentCalendarError("invalid_calendar_request", 400);
      if (!provider || !provider.configured()) throw new AppointmentCalendarError("calendar_oauth_not_configured", 503);
      try {
        const current = await store.get(tenantId);
        const token = await provider.exchangeCode(input.code, { redirectUri: input && input.redirect_uri });
        const details = await provider.prepareAppointmentCalendar(token, current);
        const connectedAt = iso(now());
        const row = await store.upsert({
          tenant_id: tenantId,
          provider: providerId,
          surface,
          status: "connected",
          account_email: details.account_email,
          account_label: details.account_label,
          calendar_id: details.calendar_id,
          calendar_summary: details.calendar_summary,
          calendar_mode: details.calendar_mode,
          availability_calendar_ids: details.availability_calendar_ids,
          scopes: String(token.scope || "").split(/\s+/).filter(Boolean),
          connected_at: connectedAt,
          connected_by: actorLabel(input.actor),
          disconnected_at: null,
          disconnected_by: null,
          last_verified_at: connectedAt,
          last_error: null,
          last_error_at: null,
          credentials_ciphertext: encryptedCredential(token),
          credential_source: "oauth",
          updated_at: connectedAt
        }, {
          action: "connected",
          actor: actorLabel(input.actor),
          details: { provider: providerId, surface, calendar_id_present: !!details.calendar_id }
        });
        return publicCalendarConnection(row);
      } catch (error) {
        await markFailure(tenantId, providerId, input && input.actor, error);
        throw error instanceof AppointmentCalendarError
          ? error
          : new AppointmentCalendarError("calendar_connection_failed", 422, internalError(error));
      }
    },

    async verify(tenantId, actor) {
      const cleanTenant = cleanTenantId(tenantId);
      const record = await store.get(cleanTenant);
      if (!record || !["connected", "needs_attention"].includes(record.status)) {
        throw new AppointmentCalendarError("calendar_connection_not_found", 404);
      }
      try {
        const verified = await verifyWithRefresh(record, actor);
        const checkedAt = iso(now());
        const row = await store.upsert({
          tenant_id: cleanTenant,
          provider: record.provider,
          status: "connected",
          account_email: verified.details.account_email || record.account_email,
          account_label: verified.details.account_label || record.account_label,
          calendar_id: verified.details.calendar_id || record.calendar_id,
          calendar_summary: verified.details.calendar_summary || record.calendar_summary,
          calendar_mode: verified.details.calendar_mode || record.calendar_mode,
          availability_calendar_ids: verified.details.availability_calendar_ids && verified.details.availability_calendar_ids.length
            ? verified.details.availability_calendar_ids
            : record.availability_calendar_ids,
          last_verified_at: checkedAt,
          last_error: null,
          last_error_at: null,
          updated_at: checkedAt
        }, {
          action: "verified",
          actor: actorLabel(actor),
          details: {}
        });
        return publicCalendarConnection(row, { superAdmin: true });
      } catch (error) {
        await markFailure(cleanTenant, record.provider, actor, error);
        throw error instanceof AppointmentCalendarError
          ? error
          : new AppointmentCalendarError("calendar_verification_failed", 422, internalError(error));
      }
    },

    async syncAppointment(tenantId, appointment, actor) {
      const cleanTenant = cleanTenantId(tenantId);
      const record = await store.get(cleanTenant);
      if (!record || record.status !== "connected" || !record.calendar_id) {
        throw new AppointmentCalendarError("calendar_connection_not_found", 404);
      }
      try {
        const provider = providerFor(record.provider);
        const event = await withFreshCredential(record, actor, function (credential) {
          return provider.upsertAppointment(credential, record.calendar_id, appointment);
        });
        return {
          calendar_sync_status: "synced",
          calendar_event_id: event.event_id,
          calendar_event_link: event.event_link,
          calendar_synced_at: iso(now()),
          calendar_last_error: ""
        };
      } catch (error) {
        await markFailure(cleanTenant, record.provider, actor, error);
        throw error instanceof AppointmentCalendarError
          ? error
          : new AppointmentCalendarError("calendar_sync_failed", 422, internalError(error));
      }
    },

    async checkAvailability(tenantId, startsAt, durationMinutes, actor) {
      const cleanTenant = cleanTenantId(tenantId);
      const record = await store.get(cleanTenant);
      if (!record || record.status !== "connected" || !record.calendar_id) {
        throw new AppointmentCalendarError("calendar_connection_not_found", 404);
      }
      try {
        const provider = providerFor(record.provider);
        const result = await withFreshCredential(record, actor, function (credential) {
          return provider.checkAvailability(
            credential,
            record.availability_calendar_ids && record.availability_calendar_ids.length
              ? record.availability_calendar_ids
              : [record.calendar_id],
            startsAt,
            durationMinutes
          );
        });
        return Object.assign({}, result, {
          primary_time_zone: cleanText(record.primary_time_zone, 120) || "America/Bogota"
        });
      } catch (error) {
        if (error instanceof AppointmentCalendarError) throw error;
        throw new AppointmentCalendarError("calendar_availability_failed", 422, internalError(error));
      }
    },

    async cancelAppointment(tenantId, appointment, actor) {
      const cleanTenant = cleanTenantId(tenantId);
      const record = await store.get(cleanTenant);
      if (!record || record.status !== "connected" || !record.calendar_id) {
        throw new AppointmentCalendarError("calendar_connection_not_found", 404);
      }
      try {
        const provider = providerFor(record.provider);
        const result = await withFreshCredential(record, actor, function (credential) {
          return provider.cancelAppointment(credential, record.calendar_id, appointment && appointment.calendar_event_id);
        });
        return {
          calendar_sync_status: result.not_required ? "not_required" : "synced",
          calendar_event_id: cleanText(appointment && appointment.calendar_event_id, 500),
          calendar_event_link: "",
          calendar_synced_at: iso(now()),
          calendar_last_error: ""
        };
      } catch (error) {
        await markFailure(cleanTenant, record.provider, actor, error);
        throw error instanceof AppointmentCalendarError
          ? error
          : new AppointmentCalendarError("calendar_sync_failed", 422, internalError(error));
      }
    },

    async disconnect(tenantId, actor) {
      const cleanTenant = cleanTenantId(tenantId);
      const current = await store.get(cleanTenant);
      const at = iso(now());
      const row = await store.upsert({
        tenant_id: cleanTenant,
        provider: current && current.provider || defaultProvider,
        status: "disconnected",
        disconnected_at: at,
        disconnected_by: actorLabel(actor),
        credentials_ciphertext: null,
        credential_source: null,
        updated_at: at
      }, {
        action: "disconnected",
        actor: actorLabel(actor),
        details: {}
      });
      return publicCalendarConnection(row);
    }
  };
}

module.exports = {
  APPOINTMENT_CALENDAR_SUMMARY,
  CALENDAR_SCOPES,
  MICROSOFT_CALENDAR_SCOPES,
  CALENDAR_PROVIDERS,
  CALENDAR_SURFACES,
  CALENDAR_STATUSES,
  AppointmentCalendarError,
  AppendOnlyAppointmentCalendarStore,
  GoogleCalendarProvider,
  MicrosoftCalendarProvider,
  InMemoryAppointmentCalendarStore,
  cleanCalendarProvider,
  cleanCalendarSurface,
  cleanTenantId,
  createAppointmentCalendarConnectionService,
  createCalendarOAuthState,
  emptyCalendarConnection,
  publicCalendarConnection,
  readCalendarOAuthState
};
