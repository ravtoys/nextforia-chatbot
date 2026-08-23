"use strict";

const assert = require("assert");
const {
  buildAppointmentIntegrations,
  parseAppointmentCalendarTenantMap
} = require("./appointment-integrations");

const record = {
  tenant_id: "clinica-a",
  setup_completed: true,
  setup_review: { status: "testing" },
  answers: {
    setup_goal: "appointments",
    channels: { phone_calls: true },
    meta: { whatsapp_number: "+57 300 000 0000" },
    business: { contact_email: "admin@clinica.test" },
    team: { admin_email: "admin@clinica.test" },
    appointment_setup: {
      calendar_provider: "google",
      calendar_email: "agenda@clinica.test",
      appointment_whatsapp_enabled: true,
      appointment_email_enabled: true,
      appointment_email: "citas@clinica.test"
    }
  }
};
const recordWithPublicPhone = Object.assign({}, record, {
  appointment_configuration: {
    external_phone_number: "+15550001111",
    external_phone_provider: "twilio"
  }
});
const provisioning = {
  elevenlabsTemplateAgentId: "agent_template",
  elevenlabsAppointmentToolSecret: "nextfor-appointment-tool-secret-2026-secure",
  elevenlabsAppointmentToolBaseUrl: "https://api.nextforia.com",
  elevenlabsAgentWriteEnabled: true
};

let gate = buildAppointmentIntegrations(record, "clinica-a", Object.assign({}, provisioning, {
  elevenlabsApiKey: "el-key",
  elevenlabsWebhookSecret: "el-secret",
  agentTenantMap: { agent_a: "clinica-a" },
  googleCalendarOAuthConfigured: true,
  metaOAuthReady: true,
  supabaseAppointmentsEnabled: true
}));

assert.strictEqual(gate.ready_for_live, false);
assert.strictEqual(gate.bot.status, "needs_configuration");
assert(gate.blockers.includes("elevenlabs_agent_not_configured"));
assert.strictEqual(gate.calendar.status, "needs_customer_connection");
assert.strictEqual(gate.whatsapp.status, "needs_customer_connection");
assert(gate.blockers.includes("calendar_not_connected"));
assert(gate.blockers.includes("whatsapp_not_connected"));

gate = buildAppointmentIntegrations(record, "clinica-a", Object.assign({}, provisioning, {
  elevenlabsApiKey: "el-key",
  elevenlabsWebhookSecret: "el-secret",
  agentTenantMap: { agent_a: "clinica-a" },
  elevenlabsAgentConfigured: true,
  elevenlabsPhoneNumberMapped: true,
  googleCalendarOAuthConfigured: true,
  calendarTenantMap: parseAppointmentCalendarTenantMap({
    APPOINTMENT_CALENDAR_TENANT_MAP: JSON.stringify({
      "clinica-a": { provider: "google", status: "connected", calendar_id: "primary" }
    })
  }),
  metaOAuthReady: true,
  whatsappConnected: true,
  supabaseAppointmentsEnabled: true
}));

assert.strictEqual(gate.ready_for_live, false);
assert(gate.blockers.includes("calls_not_ready"));
assert.strictEqual(gate.calls.status, "needs_phone_assignment");

gate = buildAppointmentIntegrations(record, "clinica-a", Object.assign({}, provisioning, {
  elevenlabsApiKey: "el-key",
  elevenlabsWebhookSecret: "el-secret",
  agentTenantMap: { agent_a: "clinica-a" },
  elevenlabsAgentConfigured: true,
  elevenlabsPhoneAutoAssignmentEnabled: true,
  googleCalendarOAuthConfigured: true,
  calendarConnection: { status: "connected", calendar_id: "primary" },
  metaOAuthReady: true,
  whatsappConnected: true,
  supabaseAppointmentsEnabled: true
}));
assert.strictEqual(gate.calls.status, "needs_phone_assignment");
assert.strictEqual(gate.calls.phone_number_auto_assignable, true);
assert(gate.blockers.includes("calls_not_ready"));

gate = buildAppointmentIntegrations(recordWithPublicPhone, "clinica-a", Object.assign({}, provisioning, {
  elevenlabsApiKey: "el-key",
  elevenlabsWebhookSecret: "el-secret",
  agentTenantMap: { agent_a: "clinica-a" },
  elevenlabsAgentConfigured: true,
  elevenlabsPhoneNumberMapped: true,
  elevenlabsPhoneNumberConfigured: true,
  googleCalendarOAuthConfigured: true,
  calendarTenantMap: parseAppointmentCalendarTenantMap({
    APPOINTMENT_CALENDAR_TENANT_MAP: JSON.stringify({
      "clinica-a": { provider: "google", status: "connected", calendar_id: "primary" }
    })
  }),
  metaOAuthReady: true,
  whatsappConnected: true,
  supabaseAppointmentsEnabled: true
}));

assert.strictEqual(gate.ready_for_live, true);
assert.deepStrictEqual(gate.blockers, []);
assert.strictEqual(gate.bot.status, "ready");
assert.strictEqual(gate.calendar.status, "ready");
assert.strictEqual(gate.whatsapp.status, "ready");
assert.strictEqual(gate.calls.status, "ready");
assert.strictEqual(gate.calls.number, "+15550001111");
assert.strictEqual(gate.calls.provider, "twilio");

gate = buildAppointmentIntegrations(record, "clinica-a", Object.assign({}, provisioning, {
  elevenlabsApiKey: "el-key",
  elevenlabsWebhookSecret: "el-secret",
  agentTenantMap: { agent_a: "clinica-a" },
  elevenlabsAgentConfigured: true,
  elevenlabsPhoneNumberMapped: true,
  elevenlabsPhoneNumberConfigured: true,
  googleCalendarOAuthConfigured: true,
  calendarConnection: {
    tenant_id: "clinica-a",
    status: "connected",
    account_label: "Agenda Clínica A",
    calendar_id: "primary"
  },
  metaOAuthReady: true,
  whatsappConnected: true,
  supabaseAppointmentsEnabled: true
}));
assert.strictEqual(gate.ready_for_live, true);
assert.strictEqual(gate.calendar.status, "ready");
assert.strictEqual(gate.calendar.account_label, "Agenda Clínica A");
assert.strictEqual(gate.calendar.calendar_id_present, true);

const samsungRecord = JSON.parse(JSON.stringify(record));
samsungRecord.answers.appointment_setup.calendar_provider = "none";
gate = buildAppointmentIntegrations(samsungRecord, "clinica-a", Object.assign({}, provisioning, {
  elevenlabsApiKey: "el-key",
  elevenlabsWebhookSecret: "el-secret",
  agentTenantMap: { agent_a: "clinica-a" },
  elevenlabsAgentConfigured: true,
  elevenlabsPhoneNumberMapped: true,
  elevenlabsPhoneNumberConfigured: true,
  googleCalendarOAuthConfigured: true,
  calendarConnection: {
    tenant_id: "clinica-a",
    provider: "google",
    surface: "samsung",
    status: "connected",
    account_label: "Agenda Samsung",
    calendar_id: "nextfor-samsung"
  },
  metaOAuthReady: true,
  whatsappConnected: true,
  supabaseAppointmentsEnabled: true
}));
assert.strictEqual(gate.calendar.status, "ready");
assert.strictEqual(gate.calendar.provider, "samsung");
assert.strictEqual(gate.calendar.label, "Samsung Calendar");
assert.strictEqual(gate.calendar.account_label, "Agenda Samsung");

gate = buildAppointmentIntegrations(record, "clinica-a", {
  elevenlabsApiKey: "el-key",
  elevenlabsWebhookSecret: "el-secret",
  agentTenantMap: { agent_a: "clinica-a" },
  elevenlabsAgentConfigured: true,
  elevenlabsPhoneNumberMapped: true,
  elevenlabsPhoneNumberConfigured: true,
  googleCalendarOAuthConfigured: true,
  calendarConnection: { status: "connected", calendar_id: "primary" },
  metaOAuthReady: true,
  whatsappConnected: true,
  supabaseAppointmentsEnabled: true
});
assert.strictEqual(gate.ready_for_live, false);
assert(gate.blockers.includes("elevenlabs_template_agent_missing"));
assert(gate.blockers.includes("elevenlabs_appointment_tool_secret_missing"));
assert(gate.blockers.includes("elevenlabs_agent_write_disabled"));

const notSelected = buildAppointmentIntegrations({ setup_completed: true, answers: { setup_goal: "customer_service" } }, "tenant-b", {});
assert.strictEqual(notSelected.selected, false);
assert(notSelected.blockers.includes("appointment_not_selected"));

const callsSelectedInSetup = buildAppointmentIntegrations({
  setup_completed: true,
  setup_review: { status: "testing" },
  answers: {
    setup_goal: "appointments",
    appointment_setup: {
      calls_enabled: "yes",
      appointment_whatsapp_enabled: false,
      calendar_provider: "google"
    }
  }
}, "tenant-c", Object.assign({}, provisioning, {
  elevenLabsApiKey: "el-key",
  elevenLabsWebhookSecret: "el-secret",
  elevenLabsPhoneAutoAssignmentEnabled: true,
  googleCalendarOAuthConfigured: true,
  calendarConnection: { status: "connected", calendar_id: "primary" },
  supabaseAppointmentsEnabled: true
}));
assert.strictEqual(callsSelectedInSetup.calls.requested, true);
assert.strictEqual(callsSelectedInSetup.calls.status, "needs_agent");

console.log("appointment integration gate tests: ok");
