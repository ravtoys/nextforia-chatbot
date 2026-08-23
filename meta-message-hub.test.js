"use strict";

const assert = require("assert");
const {
  InMemoryMetaMessageHubStore,
  USE_CASES,
  createMetaMessageHub,
  parameterValues,
  templateMatchesUseCase
} = require("./meta-message-hub");

function runtime(tenantId, channel) {
  return {
    tenant_id: tenantId,
    tenantId,
    channel,
    whatsapp_business_account_id: "waba-" + tenantId,
    whatsappBusinessAccountId: "waba-" + tenantId,
    phone_number_id: "phone-" + tenantId,
    access_token: "token-" + tenantId,
    page_id: "page-" + tenantId,
    instagram_user_id: "ig-" + tenantId,
    source: "channel_connection"
  };
}

function providerRow(name, status) {
  const blueprint = Object.values(USE_CASES).find(function (item) { return item.template_name === name; });
  return {
    id: "provider-" + name,
    name,
    language: blueprint.language,
    category: blueprint.category,
    status,
    components: blueprint.components
  };
}

(async function () {
  const catalogues = new Map();
  catalogues.set("tenant-a", [
    providerRow(USE_CASES.customer_service_followup.template_name, "APPROVED"),
    providerRow(USE_CASES.appointment_reminder.template_name, "APPROVED")
  ]);
  catalogues.set("tenant-b", [providerRow(USE_CASES.appointment_reminder.template_name, "PENDING")]);
  const sends = [];
  const store = new InMemoryMetaMessageHubStore();
  const hub = createMetaMessageHub({
    store,
    resolveRuntime: async function (tenantId, channel) { return runtime(tenantId, channel); },
    listProviderTemplates: async function (active) { return catalogues.get(active.tenant_id) || []; },
    createProviderTemplate: async function (active, blueprint) {
      const rows = catalogues.get(active.tenant_id) || [];
      rows.push(Object.assign({ id: "created-" + blueprint.name, status: "PENDING" }, blueprint));
      catalogues.set(active.tenant_id, rows);
      return { id: "created-" + blueprint.name, status: "PENDING" };
    },
    sendWhatsAppTemplate: async function (active, recipient, template, parameters) {
      sends.push({ active, recipient, template, parameters });
      return { provider_message_id: "wamid.1" };
    },
    sendMessengerTagged: async function (_active, _recipient, _text, tag) {
      sends.push({ tag });
      return { provider_message_id: "mid.1" };
    },
    sendInstagramHumanAgent: async function () { throw new Error("must_not_send_automated_instagram"); },
    now: function () { return new Date("2026-08-23T15:00:00.000Z"); }
  });

  const customerService = await hub.request({
    tenant_id: "tenant-a",
    channel: "whatsapp",
    source: "customer_service",
    use_case: "customer_service_followup",
    recipient: "573001112233",
    parameters: { customer_name: "María", business_name: "Empresa A", case_reference: "caso 10" },
    idempotency_key: "customer-service-case-10"
  });
  assert.strictEqual(customerService.mechanism, "whatsapp_message_template");
  assert.strictEqual(customerService.template.status, "approved");
  assert.strictEqual(sends[0].active.tenant_id, "tenant-a");
  assert.deepStrictEqual(sends[0].parameters, ["María", "Empresa A", "caso 10"]);

  const replay = await hub.request({
    tenant_id: "tenant-a",
    channel: "whatsapp",
    source: "customer_service",
    use_case: "customer_service_followup",
    recipient: "573001112233",
    parameters: { customer_name: "María", business_name: "Empresa A", case_reference: "caso 10" },
    idempotency_key: "customer-service-case-10"
  });
  assert.strictEqual(replay.idempotent_replay, true);
  assert.strictEqual(sends.length, 1, "idempotent replay must not send twice");

  const appointment = await hub.request({
    tenant_id: "tenant-a",
    channel: "whatsapp",
    source: "appointment",
    use_case: "appointment_reminder",
    recipient: "573009998877",
    parameters: {
      customer_name: "Luis",
      business_name: "Empresa A",
      appointment_date: "lunes 24 de agosto",
      appointment_time: "9:00 a. m."
    },
    idempotency_key: "appointment-44-24h"
  });
  assert.strictEqual(appointment.mechanism, "whatsapp_message_template");
  assert.strictEqual(sends[1].active.tenant_id, "tenant-a");

  await assert.rejects(function () {
    return hub.request({
      tenant_id: "tenant-b",
      channel: "whatsapp",
      source: "appointment",
      use_case: "appointment_reminder",
      recipient: "573009998877",
      parameters: {
        customer_name: "Luis", business_name: "Empresa B",
        appointment_date: "lunes", appointment_time: "9:00"
      },
      idempotency_key: "tenant-b-pending"
    });
  }, function (error) {
    return error.code === "approved_template_unavailable" && error.details.template_status === "pending";
  });
  assert.strictEqual(sends.length, 2, "pending templates must fail closed");

  await assert.rejects(function () {
    return hub.request({
      tenant_id: "tenant-a",
      channel: "instagram",
      source: "customer_service",
      use_case: "customer_service_followup",
      recipient: "ig:123",
      idempotency_key: "ig-automated"
    });
  }, function (error) { return error.code === "instagram_automated_out_of_window_not_allowed"; });

  const messenger = await hub.request({
    tenant_id: "tenant-a",
    channel: "messenger",
    source: "appointment",
    use_case: "appointment_reminder",
    confirmed_event: true,
    recipient: "ms:123",
    text: "Te recordamos tu cita confirmada de mañana.",
    idempotency_key: "messenger-confirmed-event"
  });
  assert.strictEqual(messenger.message_tag, "CONFIRMED_EVENT_UPDATE");

  const ensured = await hub.ensureTemplates({ tenant_id: "tenant-new", use_cases: ["appointment_reminder"] });
  assert.strictEqual(ensured.created.length, 1);
  assert.strictEqual(ensured.templates[0].status, "pending");

  const ambientHub = createMetaMessageHub({
    resolveRuntime: async function (tenantId, channel) {
      return Object.assign(runtime(tenantId, channel), { source: "environment" });
    },
    listProviderTemplates: async function () { return []; }
  });
  await assert.rejects(function () {
    return ambientHub.syncTemplates({ tenant_id: "tenant-a", channel: "whatsapp" });
  }, function (error) { return error.code === "tenant_scoped_credential_required"; });

  const importedAppointment = {
    name: "appointment_reminder_nextfor",
    components: [{ type: "BODY", text: "Hola {{1}}, te recordamos tu cita con {{4}} el {{2}} a las {{3}}." }]
  };
  assert(templateMatchesUseCase(importedAppointment, "appointment_reminder"));
  assert.deepStrictEqual(parameterValues("appointment_reminder", {
    customer_name: "Ana",
    business_name: "Empresa A",
    appointment_date: "lunes",
    appointment_time: "9:00"
  }, importedAppointment), ["Ana", "lunes", "9:00", "Empresa A"]);
  const tenantATemplates = await store.listTemplates("tenant-a", "whatsapp");
  const tenantBTemplates = await store.listTemplates("tenant-b", "whatsapp");
  assert(tenantATemplates.every(function (row) { return row.tenant_id === "tenant-a"; }));
  assert(tenantBTemplates.every(function (row) { return row.tenant_id === "tenant-b"; }));

  console.log("meta-message-hub: assertions passed");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
