"use strict";

const assert = require("assert");
const { createAppointmentReminderService, timingOffsets } = require("./appointment-reminders");
const { deliverAppointmentWhatsApp, reminderText } = require("./appointment-whatsapp-delivery");

assert.deepStrictEqual(timingOffsets("both"), ["24h", "6h"]);
assert.deepStrictEqual(timingOffsets("24h"), ["24h"]);
assert.deepStrictEqual(timingOffsets("none"), []);

(async function () {
  const deliveryParams = { customer_name: "Ana", business_name: "Clínica", appointment_date: "viernes 21 de agosto", appointment_time: "03:00 p. m." };
  assert.match(reminderText(deliveryParams), /Ana/);
  let templateAttempts = 0;
  const openWindowDelivery = await deliverAppointmentWhatsApp({
    appointment: { tenant_id: "tenant-a", customer_phone: "+573001112233" },
    params: deliveryParams,
    template: "appointment_reminder_nextfor",
    customerWindowOpen: async () => true,
    sendText: async () => true,
    sendTemplate: async () => { templateAttempts += 1; return { ok: true }; }
  });
  assert.equal(openWindowDelivery.mode, "text");
  assert.equal(templateAttempts, 0, "an open customer window must not require a template");
  let textAttempts = 0;
  const closedWindowDelivery = await deliverAppointmentWhatsApp({
    appointment: { tenant_id: "tenant-a", customer_phone: "+573001112233" },
    params: deliveryParams,
    template: "appointment_reminder_nextfor",
    customerWindowOpen: async () => false,
    sendText: async () => { textAttempts += 1; return true; },
    sendTemplate: async () => ({ ok: true, meta: { messages: [{ id: "wamid.1" }] } })
  });
  assert.equal(closedWindowDelivery.mode, "template");
  assert.equal(closedWindowDelivery.provider_id, "wamid.1");
  assert.equal(textAttempts, 0, "a closed customer window must not attempt free-form text");

  const saved = [];
  const sent = [];
  let current = new Date("2026-08-21T14:00:00.000Z");
  const appointment = {
    tenant_id: "tenant-a", conversation_id: "appointment-1", status: "booked",
    starts_at: "2026-08-21T20:00:00.000Z", customer_name: "Ana", customer_phone: "+573001112233"
  };
  const service = createAppointmentReminderService({
    now: () => current,
    loadAppointments: async () => [appointment],
    loadConfiguration: async () => ({ channel: "whatsapp", timing: "both", template: "appointment_reminder_nextfor", business_name: "Clínica" }),
    persist: async row => saved.push(row),
    deliver: async (row, template, params) => { sent.push({ row, template, params }); return { ok: true, provider_id: "wamid.1" }; }
  });
  const first = await service.process();
  assert.strictEqual(first.programmed, 2);
  assert.strictEqual(first.delivered, 1, "6h reminder should send at its due time");
  assert.strictEqual(sent[0].template, "appointment_reminder_nextfor");
  assert.strictEqual(saved[0].reminder_deliveries["24h"].status, "missed", "a late 24h reminder must not be sent out of context");
  assert.strictEqual(saved[0].reminder_deliveries["6h"].status, "delivered");

  appointment.reminder_deliveries = saved[0].reminder_deliveries;
  const second = await service.process();
  assert.strictEqual(second.delivered, 0, "delivered reminder must not duplicate");
  console.log("appointment-reminders.test.js: ok");
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
