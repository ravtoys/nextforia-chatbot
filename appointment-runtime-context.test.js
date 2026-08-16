"use strict";

const assert = require("assert");
const {
  DEFAULT_TIME_ZONE,
  buildAppointmentDateContext,
  normalizeTimeZone
} = require("./appointment-runtime-context");

const context = buildAppointmentDateContext({
  now: new Date("2026-08-15T15:00:00.000Z"),
  timeZone: "America/Bogota"
});

assert.ok(context.includes("Ahora en America/Bogota: 2026-08-15 (sábado) a las 10:00:00"));
assert.ok(context.includes("2026-08-14 — viernes"));
assert.ok(context.includes("2026-08-15 — sábado"));
assert.ok(context.includes("reemplaza cualquier fecha vieja o contradictoria"));
assert.ok(context.includes("No ofrezcas ni consultes horarios anteriores"));
assert.strictEqual(normalizeTimeZone("Invalid/Zone"), DEFAULT_TIME_ZONE);

console.log("appointment-runtime-context: assertions passed");
