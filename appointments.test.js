"use strict";

const assert = require("assert");
const { AppointmentRegistry, appointmentCustomerPhone, appointmentFromElevenLabsEvent } = require("./appointments");
const { DERCO_TENANT_ID, getRegisteredClient, listRegisteredClients, parseAgentTenantMap } = require("./client-registry");

function sampleEvent(overrides) {
  const event = {
    type: "post_call_transcription",
    event_timestamp: 1784390400,
    data: {
      agent_id: "agent_derco",
      conversation_id: "conv_001",
      metadata: { channel: "whatsapp" },
      analysis: {
        transcript_summary: "El cliente solicitó y confirmó una cita.",
        data_collection_results: {
          appointment_status: { value: "booked" },
          appointment_datetime: { value: "2026-07-21T09:00:00-05:00" },
          client_name: { value: "María Pérez" },
          client_phone: { value: "+573001234567" },
          client_email: { value: "MARIA@example.com" },
          consultation_reason: { value: "Consulta laboral" },
          data_processing_consent: { value: "authorized" }
        }
      }
    }
  };
  return Object.assign(event, overrides || {});
}

(async function run() {
  assert.equal(
    appointmentCustomerPhone("whatsapp", "wa:573013507371", "+573000000000"),
    "+573013507371",
    "WhatsApp bookings must use the real channel identity instead of a model-supplied placeholder"
  );
  assert.equal(appointmentCustomerPhone("voice", "voice:caller", "+573009998888"), "+573009998888");

  assert.equal(listRegisteredClients().length, 1);
  assert.equal(getRegisteredClient(DERCO_TENANT_ID).customer_number, 1);
  assert.equal(getRegisteredClient(DERCO_TENANT_ID).brand_name, "Grupo Jurídico DERCO S.A.S.");

  const agentMap = parseAgentTenantMap({
    ELEVENLABS_AGENT_TENANT_MAP: JSON.stringify({ agent_derco: DERCO_TENANT_ID, agent_unknown: "not-registered" })
  });
  assert.equal(agentMap.agent_derco, DERCO_TENANT_ID);
  assert.equal(agentMap.agent_unknown, "not-registered");

  const parsed = appointmentFromElevenLabsEvent(sampleEvent(), DERCO_TENANT_ID);
  assert.equal(parsed.status, "booked");
  assert.equal(parsed.customer_name, "María Pérez");
  assert.equal(parsed.customer_email, "maria@example.com");
  assert.equal(parsed.starts_at, "2026-07-21T14:00:00.000Z");
  assert.equal(parsed.duration_minutes, 60);
  assert.equal(parsed.data_processing_consent, "authorized");

  const persisted = [];
  const registry = new AppointmentRegistry({ onUpsert: async row => persisted.push(row) });
  await registry.ingestElevenLabs(sampleEvent(), DERCO_TENANT_ID);
  await registry.ingestElevenLabs(sampleEvent(), DERCO_TENANT_ID);
  assert.equal(registry.list(DERCO_TENANT_ID).length, 1, "retries must be idempotent");
  assert.equal(persisted.length, 2, "each delivery may safely upsert persistence");

  await registry.upsert({
    tenant_id: DERCO_TENANT_ID,
    conversation_id: "conv_002",
    agent_id: "agent_derco",
    status: "requested",
    customer_name: "Carlos",
    created_at: "2026-07-18T12:00:00Z",
    updated_at: "2026-07-18T12:00:00Z"
  }, false);
  const updated = await registry.applyPanelAction(DERCO_TENANT_ID, "conv_002", "cancel", {
    actor: "Admin DERCO",
    reason: "Cliente no puede asistir",
    persist: false
  });
  assert.equal(updated.status, "cancelled");
  assert.equal(updated.panel_action, "cancel");
  assert.equal(updated.panel_action_status, "queued");
  assert.equal(updated.panel_action_by, "Admin DERCO");
  const reminderRow = await registry.upsert(Object.assign({}, updated, {
    reminder_deliveries: {
      "6h": { status: "delivered", due_at: "2026-07-20T08:00:00Z", sent_at: "2026-07-20T08:01:00Z", attempts: 1, provider_id: "wamid.test" }
    }
  }), false);
  assert.equal(reminderRow.reminder_deliveries["6h"].status, "delivered");
  assert.equal(reminderRow.reminder_deliveries["6h"].provider_id, "wamid.test");
  const snapshot = registry.snapshot(DERCO_TENANT_ID, new Date("2026-07-18T12:00:00Z").getTime());
  assert.deepEqual(snapshot.metrics, {
    interactions: 2,
    requested: 2,
    booked: 1,
    pending: 0,
    cancelled: 1,
    failed: 0
  });
  assert.equal(snapshot.upcoming.length, 1);

  console.log("appointments tests: ok");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
