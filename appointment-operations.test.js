"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  AppointmentOperationsError,
  applyReminderAction,
  appointmentSettingsFromOnboarding,
  compileAvailabilityRules,
  compileBookingRequirements,
  compileDepositPolicy,
  deriveAppointmentReminderStatus,
  evaluateScheduleException,
  materializeAppointmentReminders,
  normalizeAppointmentSettings,
  normalizeBookingRequirements,
  reminderSnapshot,
  timingOffsets,
  updateAppointmentSettings,
  validateDepositPolicy,
  validateBookingRequirements
} = require("./appointment-operations");

const NOW = "2026-08-20T12:00:00.000Z";

assert.deepStrictEqual(timingOffsets("both"), [1440, 360]);
assert.deepStrictEqual(timingOffsets("24 horas antes y 6 horas antes"), [1440, 360]);
assert.deepStrictEqual(timingOffsets("2h"), [120]);
assert.deepStrictEqual(timingOffsets("none"), []);

const fromOnboarding = appointmentSettingsFromOnboarding({
  answers: {
    appointment_setup: {
      availability_rules: "Johan atiende de lunes a viernes de 8 a 5.",
      reminder_channel: "whatsapp",
      reminder_timing: "both"
    }
  }
}, { now: NOW });
assert.strictEqual(fromOnboarding.scheduling_rules.length, 1);
assert.strictEqual(fromOnboarding.reminder_policy.enabled, true);
assert.deepStrictEqual(fromOnboarding.reminder_policy.offsets_minutes, [1440, 360]);
assert.match(fromOnboarding.availability_rules, /Johan atiende/);
assert.strictEqual(fromOnboarding.booking_requirements.find(function (row) { return row.id === "appointment_type"; }).required, true);
assert.strictEqual(fromOnboarding.booking_requirements.find(function (row) { return row.id === "full_name"; }).required, true);

const configuredRequirements = normalizeBookingRequirements([
  { type: "appointment_type", active: true, required: true },
  { type: "full_name", active: true, required: true },
  { type: "phone", active: true, required: true },
  { type: "email", active: true, required: false },
  { id: "primera_cita", type: "custom", label: "Primera cita", question: "¿Es tu primera cita?", active: true, required: true }
]);
assert.match(compileBookingRequirements(configuredRequirements), /appointment_type.*OBLIGATORIO/);
assert.match(compileBookingRequirements(configuredRequirements), /primera_cita.*OBLIGATORIO/);
const completeRequirements = validateBookingRequirements(configuredRequirements, {
  consultation_reason: "Valoración",
  booking_fields: { primera_cita: "Sí" }
}, { profile: { name: "Ana Pérez" }, channelPhone: "+573001112233" });
assert.strictEqual(completeRequirements.ok, true);
assert.strictEqual(completeRequirements.values.appointment_type, "Valoración");
assert.strictEqual(completeRequirements.values.full_name, "Ana Pérez");
assert.strictEqual(completeRequirements.values.phone, "+573001112233");
const missingAppointmentType = validateBookingRequirements(configuredRequirements, {
  booking_fields: { primera_cita: "Sí" }
}, { profile: { name: "Ana Pérez" }, channelPhone: "+573001112233" });
assert.strictEqual(missingAppointmentType.missing[0].id, "appointment_type");
const isolatedTenantRequirements = normalizeBookingRequirements([
  { id: "sede", type: "custom", label: "Sede", question: "¿Qué sede prefieres?", active: true, required: true }
]);
assert.strictEqual(validateBookingRequirements(isolatedTenantRequirements, {}, {}).missing[0].id, "sede");
assert.strictEqual(configuredRequirements.some(function (row) { return row.id === "sede"; }), false);

const depositPolicy = validateDepositPolicy({
  required: true,
  appointment_value_cop: 250000,
  deposit_amount_cop: 50000,
  payment_methods: [
    { type: "bank_transfer", active: true },
    { type: "payment_link", active: true },
    { type: "cash", active: false },
    { type: "custom", id: "reception", label: "Pago en recepción", active: true }
  ]
});
assert.strictEqual(depositPolicy.ok, true);
assert.strictEqual(depositPolicy.policy.payment_methods.filter(function (row) { return row.active; }).length, 3);
assert.match(compileDepositPolicy(depositPolicy.policy), /\$50\.000 COP/);
assert.match(compileDepositPolicy(depositPolicy.policy), /Pago en recepción/);
assert.strictEqual(validateDepositPolicy({ required: true, appointment_value_cop: 250000, deposit_amount_cop: 0, payment_methods: [] }).error, "deposit_amount_required");

const normalized = normalizeAppointmentSettings({
  revision: 3,
  scheduling_rules: [
    { id: "weekday", text: "Atender lunes a viernes.", active: true, order: 1 },
    { id: "lunch", text: "No atender durante el almuerzo.", active: false, order: 2 }
  ],
  schedule_exceptions: [
    { id: "holiday", date: "2026-08-24", mode: "close", note: "Festivo" },
    { id: "partial-day", date: "2026-09-07", mode: "partial", available_from: "09:00", available_until: "12:00", outside_action: "reschedule", note: "Congreso médico" },
    { id: "partial-invalid", date: "2026-09-08", mode: "partial", available_from: "13:00", available_until: "09:00" },
    { id: "overflow", date: "2026-02-30", mode: "close" },
    { id: "invalid", date: "24 de agosto", mode: "close" }
  ],
  booking_policy: { default_duration_minutes: 45, buffer_minutes: 15 },
  reminder_policy: {
    enabled: true,
    channel: "whatsapp",
    offsets_minutes: [360, 1440, 360],
    retry_after_minutes: 90,
    max_attempts: 2,
    handoff_on_no_response: true
  }
}, { now: NOW });
assert.strictEqual(normalized.revision, 3);
assert.strictEqual(normalized.schedule_exceptions.length, 2);
assert.deepStrictEqual(normalized.booking_policy, { default_duration_minutes: 45, buffer_minutes: 15 });
assert.deepStrictEqual(normalized.reminder_policy.offsets_minutes, [1440, 360]);
assert.match(normalized.availability_rules, /Excepciones/);
assert.doesNotMatch(normalized.availability_rules, /almuerzo/);
assert.match(compileAvailabilityRules(normalized.scheduling_rules, normalized.schedule_exceptions), /Festivo/);
assert.match(normalized.availability_rules, /09:00 a 12:00/);
assert.strictEqual(evaluateScheduleException(normalized, "2026-09-07T14:30:00.000Z", 45, "America/Bogota"), null);
const partialBlocked = evaluateScheduleException(normalized, "2026-09-07T16:45:00.000Z", 30, "America/Bogota");
assert.strictEqual(partialBlocked.mode, "partial");
assert.strictEqual(partialBlocked.outside_action, "reschedule");
assert.strictEqual(partialBlocked.available_until, "12:00");

const updated = updateAppointmentSettings(normalized, {
  booking_policy: { default_duration_minutes: 60, buffer_minutes: 20 },
  deposit_policy: depositPolicy.policy,
  reminder_policy: { max_attempts: 3 },
  booking_requirements: configuredRequirements,
  scheduling_rules: normalized.scheduling_rules.concat([{ text: "Atender sábados en la mañana." }])
}, { expectedRevision: 3, actor: "admin@tenant-a.test", now: "2026-08-20T12:05:00.000Z" });
assert.strictEqual(updated.revision, 4);
assert.strictEqual(updated.updated_by, "admin@tenant-a.test");
assert.strictEqual(updated.scheduling_rules.length, 3);
assert.strictEqual(updated.reminder_policy.max_attempts, 3);
assert.deepStrictEqual(updated.booking_policy, { default_duration_minutes: 60, buffer_minutes: 20 });
assert.strictEqual(updated.deposit_policy.deposit_amount_cop, 50000);
assert.strictEqual(updated.booking_requirements.some(function (row) { return row.id === "primera_cita" && row.required; }), true);
assert.throws(function () {
  updateAppointmentSettings(updated, {}, { expectedRevision: 3, now: NOW });
}, function (error) {
  return error instanceof AppointmentOperationsError &&
    error.code === "appointment_settings_revision_conflict" && error.status === 409;
});

const appointment = {
  tenant_id: "tenant-a",
  appointment_id: "appt-1",
  customer_conversation_id: "wa:573001112233",
  status: "booked",
  starts_at: "2026-08-22T15:00:00.000Z"
};
let reminders = materializeAppointmentReminders(appointment, updated, [], { now: NOW });
assert.strictEqual(reminders.length, 2);
assert(reminders.every(function (row) { return row.tenant_id === "tenant-a"; }));
assert(reminders.every(function (row) { return row.conversation_id === "wa:573001112233"; }));
assert(reminders.every(function (row) { return row.reminder_key && row.reminder_key.includes("tenant-a"); }));
assert.notStrictEqual(reminders[0].id, reminders[1].id);

const storedWithDatabaseIds = reminders.map(function (row, index) {
  return Object.assign({}, row, {
    id: index ? "11111111-1111-4111-8111-111111111111" : "22222222-2222-4222-8222-222222222222",
    status: "sent"
  });
});
const rematerialized = materializeAppointmentReminders(appointment, updated, storedWithDatabaseIds, { now: NOW });
assert.strictEqual(rematerialized.length, 2, "database UUIDs must match existing reminders by reminder_key");
assert(rematerialized.every(function (row) { return row.status === "sent"; }));

const voiceWithoutCustomerThread = materializeAppointmentReminders({
  tenant_id: "tenant-a",
  appointment_id: "voice-appointment",
  conversation_id: "elevenlabs-call-id",
  channel: "voice",
  status: "booked",
  starts_at: "2026-08-22T16:00:00.000Z"
}, updated, [], { now: NOW });
assert(voiceWithoutCustomerThread.every(function (row) { return !row.conversation_id; }),
  "a voice provider call ID must never be exposed as a customer inbox thread");

let paused = applyReminderAction(reminders[0], "pause", {
  tenantId: "tenant-a",
  actor: "agent@tenant-a.test",
  now: "2026-08-20T12:10:00.000Z"
});
assert.strictEqual(paused.status, "paused");
paused = applyReminderAction(paused, "resume", {
  tenantId: "tenant-a",
  actor: "agent@tenant-a.test",
  now: "2026-08-20T12:11:00.000Z"
});
assert.strictEqual(paused.status, "scheduled");
const sendNow = applyReminderAction(paused, "send_now", {
  tenantId: "tenant-a",
  actor: "agent@tenant-a.test",
  now: "2026-08-20T12:12:00.000Z"
});
assert.strictEqual(sendNow.force_send, true);
assert.strictEqual(sendNow.scheduled_for, "2026-08-20T12:12:00.000Z");
assert.throws(function () {
  applyReminderAction(reminders[0], "pause", { tenantId: "tenant-b", now: NOW });
}, function (error) {
  return error instanceof AppointmentOperationsError && error.status === 404;
});

const oldReminder = Object.assign({}, reminders[0], { status: "scheduled" });
const rescheduled = materializeAppointmentReminders(Object.assign({}, appointment, {
  starts_at: "2026-08-23T15:00:00.000Z",
  status: "rescheduled"
}), updated, [oldReminder], { now: NOW });
assert(rescheduled.some(function (row) { return row.id === oldReminder.id && row.status === "cancelled"; }));
assert.strictEqual(rescheduled.filter(function (row) { return row.status === "scheduled"; }).length, 2);

const cancelled = materializeAppointmentReminders(Object.assign({}, appointment, { status: "cancelled" }), updated, reminders, { now: NOW });
assert(cancelled.every(function (row) { return row.status === "cancelled"; }));

const snapshot = reminderSnapshot([
  Object.assign({}, reminders[0], { scheduled_for: "2026-08-20T11:00:00.000Z" }),
  Object.assign({}, reminders[1], { status: "no_response" }),
  Object.assign({}, reminders[1], { id: "tenant-b-row", tenant_id: "tenant-b" })
], { tenantId: "tenant-a", now: NOW });
assert.strictEqual(snapshot.count, 2);
assert.strictEqual(snapshot.due_count, 1);
assert.strictEqual(snapshot.needs_attention_count, 1);
const derived = deriveAppointmentReminderStatus([
  Object.assign({}, reminders[0], { status: "scheduled" }),
  Object.assign({}, reminders[1], { status: "sent" })
], { tenantId: "tenant-a", now: NOW });
assert.strictEqual(derived.status, "programmed");
assert.strictEqual(derived.deliveries.length, 2);
assert.strictEqual(derived.needs_attention, false);

assert.throws(function () {
  applyReminderAction(Object.assign({}, reminders[0], { status: "confirmed" }), "retry", {
    tenantId: "tenant-a",
    now: NOW
  });
}, function (error) {
  return error instanceof AppointmentOperationsError &&
    error.code === "appointment_reminder_action_not_allowed";
});

const up = fs.readFileSync(path.join(__dirname, "docs/migrations/20260820_appointment_operations_v1_up.sql"), "utf8");
const down = fs.readFileSync(path.join(__dirname, "docs/migrations/20260820_appointment_operations_v1_down.sql"), "utf8");
[
  /add column if not exists appointment_id text/i,
  /add column if not exists customer_conversation_id text/i,
  /create table if not exists public\.appointment_reminders/i,
  /create table if not exists public\.appointment_events/i,
  /force row level security/i,
  /create policy appointment_reminders_service_role/i,
  /auth\.role\(\)::text[\s\S]*service_role/i,
  /for update skip locked/i,
  /grant execute .* to service_role/i,
  /foreign key \(tenant_id, appointment_id\)/i
].forEach(function (pattern) { assert.match(up, pattern); });
assert.match(down, /rollback blocked: multiple appointments now share a conversation/i);
assert.match(down, /drop table if exists public\.appointment_reminders/i);

console.log("appointment operations tests: ok");
