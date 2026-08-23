"use strict";

const assert = require("assert");
const crypto = require("crypto");
const {
  GoogleCalendarProvider,
  InMemoryAppointmentCalendarStore,
  createAppointmentCalendarConnectionService,
  createCalendarOAuthState,
  readCalendarOAuthState
} = require("./appointment-calendar-connections");

const secret = "appointment-calendar-state-secret-2026";
const state = createCalendarOAuthState(secret, {
  tenant_id: "Grupo Derco!",
  surface: "samsung",
  actor_id: "admin@derco.example",
  actor: "Admin DERCO",
  redirect_uri: "https://nextforia.com/admin/appointment-calendar/google/callback",
  return_path: "/admin/panel?tab=appointments",
  return_mode: "popup"
}, 1000);
const parsed = readCalendarOAuthState(secret, state, 1001);
assert.strictEqual(parsed.tenant_id, "grupo-derco");
assert.strictEqual(parsed.provider, "google");
assert.strictEqual(parsed.surface, "samsung");
assert.strictEqual(parsed.actor_id, "admin@derco.example");
assert.strictEqual(parsed.return_mode, "popup");
assert.strictEqual(readCalendarOAuthState(secret, state.slice(0, -1) + (state.endsWith("x") ? "y" : "x"), 1001), null);
assert.strictEqual(readCalendarOAuthState(secret, state, 1000 + 11 * 60 * 1000), null);

const calls = [];
let appointmentCalendarCreated = false;
const axiosClient = {
  async post(url, body, options) {
    calls.push(["post", url, body, options && options.headers && options.headers["content-type"]]);
    if (/\/calendar\/v3\/freeBusy$/.test(url)) {
      assert.match(options.headers.Authorization, /^Bearer access-/);
      assert.deepStrictEqual(body.items.map(function (item) { return item.id; }), ["agenda@derco.example", "nextfor-calendar-1"]);
      return { data: { calendars: { "agenda@derco.example": { busy: [] }, "nextfor-calendar-1": { busy: [] } } } };
    }
    if (/\/calendar\/v3\/calendars$/.test(url)) {
      assert.strictEqual(body.summary, "Citas NextforIA");
      appointmentCalendarCreated = true;
      return { data: { id: "nextfor-calendar-1", summary: "Citas NextforIA", timeZone: "America/Bogota" } };
    }
    if (/\/calendar\/v3\/calendars\//.test(url)) {
      assert.match(options.headers.Authorization, /^Bearer access-/);
      return { data: { id: "event-derco-1", htmlLink: "https://calendar.google.com/event?eid=derco", status: "confirmed" } };
    }
    assert.strictEqual(options.headers["content-type"], "application/x-www-form-urlencoded");
    if (String(body).includes("grant_type=refresh_token")) {
      return { data: { access_token: "access-refreshed", expires_in: 3600, scope: "https://www.googleapis.com/auth/calendar.app.created" } };
    }
    return { data: { access_token: "access-1", refresh_token: "refresh-1", expires_in: 3600, scope: "https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.calendarlist.readonly" } };
  },
  async get(url, options) {
    calls.push(["get", url, options && options.headers && options.headers.Authorization]);
    assert.match(options.headers.Authorization, /^Bearer access-/);
    return { data: { items: [
      { id: "agenda@derco.example", summary: "Agenda DERCO", primary: true, timeZone: "America/Bogota" },
      ...(appointmentCalendarCreated ? [{ id: "nextfor-calendar-1", summary: "Citas NextforIA", timeZone: "America/Bogota" }] : [])
    ] } };
  },
  async patch(url, body, options) {
    calls.push(["patch", url, body, options && options.headers && options.headers.Authorization]);
    return { data: { id: "event-derco-1", htmlLink: "https://calendar.google.com/event?eid=derco", status: "confirmed" } };
  },
  async delete(url, options) {
    calls.push(["delete", url, options && options.headers && options.headers.Authorization]);
    return { status: 204 };
  }
};

const provider = new GoogleCalendarProvider({
  clientId: "google-client",
  clientSecret: "google-secret",
  redirectUri: "https://nextforia.com/admin/appointment-calendar/google/callback",
  axiosClient
});
assert.strictEqual(provider.configured(), true);
const authUrl = provider.authorizationUrl("signed-state");
assert.match(authUrl, /accounts\.google\.com/);
assert.match(authUrl, /calendar\.app\.created/);
assert.doesNotMatch(authUrl, /calendar\.events/);
assert.doesNotMatch(authUrl, /include_granted_scopes/);
assert.match(authUrl, /access_type=offline/);

(async function run() {
  const store = new InMemoryAppointmentCalendarStore();
  const service = createAppointmentCalendarConnectionService({
    store,
    provider,
    encryptionKey: crypto.randomBytes(32),
    now: function () { return new Date("2026-07-28T12:00:00.000Z"); }
  });
  assert.strictEqual(service.providerConfigured(), true);
  const beginUrl = await service.begin("grupo-derco", "google", { email: "admin@derco.example" }, "signed-state", { surface: "samsung" });
  assert.match(beginUrl, /signed-state/);
  let status = await service.get("grupo-derco");
  assert.strictEqual(status.status, "connecting");
  assert.strictEqual(status.connect_available, true, "An interrupted OAuth attempt must be immediately retryable");
  const connected = await service.completeAuthorization({
    tenant_id: "grupo-derco",
    provider: "google",
    surface: "samsung",
    actor: "admin@derco.example",
    code: "code-1"
  });
  assert.strictEqual(connected.status, "connected");
  assert.strictEqual(connected.surface, "samsung");
  assert.strictEqual(connected.calendar_summary, "Citas NextforIA");
  assert.strictEqual(connected.account_email, "agenda@derco.example");
  assert.strictEqual(connected.calendar_mode, "app_created");
  assert.deepStrictEqual(connected.availability_calendar_ids, ["agenda@derco.example", "nextfor-calendar-1"]);
  assert.strictEqual(connected.credentials_ciphertext, undefined);
  const stored = await store.get("grupo-derco");
  assert.match(stored.credentials_ciphertext, /^enc:v1:/);
  const verified = await service.verify("grupo-derco", "super_admin");
  assert.strictEqual(verified.status, "connected");
  const availability = await service.checkAvailability("grupo-derco", "2026-07-29T15:00:00.000Z", 45, "super_admin");
  assert.strictEqual(availability.available, true);
  assert.strictEqual(availability.ends_at, "2026-07-29T15:45:00.000Z");
  assert.strictEqual(availability.primary_time_zone, "America/Bogota");
  const synced = await service.syncAppointment("grupo-derco", {
    tenant_id: "grupo-derco",
    conversation_id: "conv-derco-1",
    starts_at: "2026-07-29T15:00:00.000Z",
    duration_minutes: 45,
    customer_name: "Cliente DERCO",
    customer_phone: "+573001112233",
    consultation_reason: "Prueba de manejo"
  }, "super_admin");
  assert.strictEqual(synced.calendar_sync_status, "synced");
  assert.strictEqual(synced.calendar_event_id, "event-derco-1");
  assert.match(synced.calendar_event_link, /calendar\.google\.com/);
  const updated = await service.syncAppointment("grupo-derco", Object.assign({
    tenant_id: "grupo-derco",
    conversation_id: "conv-derco-1",
    starts_at: "2026-07-29T16:00:00.000Z",
    duration_minutes: 45,
    customer_name: "Cliente DERCO",
    consultation_reason: "Prueba de manejo"
  }, synced), "super_admin");
  assert.strictEqual(updated.calendar_event_id, "event-derco-1");
  const cancelled = await service.cancelAppointment("grupo-derco", updated, "super_admin");
  assert.strictEqual(cancelled.calendar_sync_status, "synced");
  const disconnected = await service.disconnect("grupo-derco", "super_admin");
  assert.strictEqual(disconnected.status, "disconnected");
  assert.strictEqual((await store.get("grupo-derco")).credentials_ciphertext, null);
  assert(calls.some(function (call) { return call[0] === "post" && /oauth2/.test(call[1]); }));
  assert(calls.some(function (call) { return call[0] === "post" && /\/calendar\/v3\/calendars$/.test(call[1]); }));
  assert(calls.some(function (call) { return call[0] === "post" && /\/events$/.test(call[1]); }));
  assert(calls.some(function (call) { return call[0] === "patch" && /\/events\/event-derco-1$/.test(call[1]); }));
  assert(calls.some(function (call) { return call[0] === "delete" && /\/events\/event-derco-1$/.test(call[1]); }));
  console.log("appointment calendar connection tests: ok");
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
