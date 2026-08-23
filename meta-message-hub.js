"use strict";

const crypto = require("crypto");

const TEMPLATE_STATUSES = new Set([
  "approved", "pending", "rejected", "paused", "disabled", "in_appeal", "pending_deletion", "unknown"
]);
const BOT_SOURCES = new Set(["customer_service", "appointment", "core_platform"]);

const USE_CASES = Object.freeze({
  customer_service_followup: {
    channel: "whatsapp",
    category: "UTILITY",
    language: "es_CO",
    template_name: "nextfor_customer_service_update_v1",
    aliases: ["customer_service", "customer_support", "support_followup", "service_update", "seguimiento", "actualizacion_solicitud"],
    variables: ["customer_name", "business_name", "case_reference"],
    components: [
      {
        type: "BODY",
        text: "Hola {{1}}, {{2}} tiene una actualización sobre tu solicitud {{3}}. Responde este mensaje para continuar la conversación.",
        example: { body_text: [["María", "Tu empresa", "caso 1048"]] }
      }
    ]
  },
  appointment_reminder: {
    channel: "whatsapp",
    category: "UTILITY",
    language: "es_CO",
    template_name: "nextfor_appointment_reminder_v1",
    aliases: ["appointment_reminder", "appointment", "reminder", "recordatorio_cita", "cita"],
    variables: ["customer_name", "business_name", "appointment_date", "appointment_time"],
    components: [
      {
        type: "BODY",
        text: "Hola {{1}}, te recordamos tu cita con {{2}} el {{3}} a las {{4}}. Responde este mensaje si necesitas confirmar o reprogramar.",
        example: { body_text: [["María", "Tu empresa", "viernes 28 de agosto", "4:00 p. m."]] }
      }
    ]
  }
});

function clean(value, limit) {
  return String(value == null ? "" : value).replace(/\u0000/g, "").trim().slice(0, limit || 1000);
}

function cleanId(value, limit) {
  return clean(value, limit || 160).toLowerCase().replace(/[^a-z0-9:_-]/g, "");
}

function normalizedStatus(value) {
  const status = clean(value, 40).toLowerCase();
  return TEMPLATE_STATUSES.has(status) ? status : "unknown";
}

function providerTemplate(input, tenantId, wabaId, now) {
  input = input || {};
  return {
    tenant_id: cleanId(tenantId, 160),
    channel: "whatsapp",
    provider_account_id: clean(wabaId, 240),
    provider_template_id: clean(input.id, 240) || null,
    name: clean(input.name, 512).toLowerCase(),
    language: clean(input.language, 40) || "unknown",
    category: clean(input.category, 40).toUpperCase() || "UNKNOWN",
    status: normalizedStatus(input.status),
    quality_score: clean(input.quality_score && (input.quality_score.score || input.quality_score), 80) || null,
    rejected_reason: clean(input.rejected_reason || input.reason, 500) || null,
    components: Array.isArray(input.components) ? input.components : [],
    synced_at: new Date(now || Date.now()).toISOString()
  };
}

function templateText(template) {
  return (template && Array.isArray(template.components) ? template.components : [])
    .map(function (component) { return clean(component && component.text, 4096).toLowerCase(); })
    .join(" ");
}

function templateMatchesUseCase(template, useCase) {
  const blueprint = USE_CASES[useCase];
  if (!blueprint || !template) return false;
  const name = clean(template.name, 512).toLowerCase();
  if (name === blueprint.template_name) return true;
  const haystack = (name + " " + templateText(template)).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (useCase === "appointment_reminder") {
    return (haystack.includes("appointment") || haystack.includes("cita")) &&
      (haystack.includes("reminder") || haystack.includes("record") || haystack.includes("cita"));
  }
  if (useCase === "customer_service_followup") {
    // A generic service template cannot safely receive arbitrary variables
    // unless the Hub owns its contract. Imported tenant templates require an
    // explicit future binding instead of guessing what each placeholder means.
    return false;
  }
  return false;
}

function importedAppointmentVariableOrder(template) {
  const body = (template && Array.isArray(template.components) ? template.components : [])
    .find(function (component) { return clean(component && component.type, 20).toUpperCase() === "BODY"; });
  const value = clean(body && body.text, 4096).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const matches = Array.from(value.matchAll(/\{\{(\d+)\}\}/g));
  if (!matches.length) return null;
  const byPosition = {};
  matches.forEach(function (match) {
    const index = Number(match[1]);
    const before = value.slice(Math.max(0, match.index - 45), match.index).replace(/\s+/g, " ");
    if (/hola(?:\s+estimad[oa])?\s*$/.test(before)) byPosition[index] = "customer_name";
    else if (/a\s+las\s*$/.test(before)) byPosition[index] = "appointment_time";
    else if (/(?:el|para)\s*$/.test(before)) byPosition[index] = "appointment_date";
    else if (/(?:con|en)\s*$/.test(before)) byPosition[index] = "business_name";
  });
  const maximum = Math.max.apply(Math, matches.map(function (match) { return Number(match[1]); }));
  const ordered = [];
  for (let index = 1; index <= maximum; index++) ordered.push(byPosition[index] || null);
  const required = USE_CASES.appointment_reminder.variables;
  return ordered.length === required.length && required.every(function (key) { return ordered.includes(key); })
    ? ordered
    : null;
}

function parameterValues(useCase, parameters, template) {
  const blueprint = USE_CASES[useCase];
  if (!blueprint) throw hubError("unsupported_use_case", 422);
  parameters = parameters && typeof parameters === "object" ? parameters : {};
  let variables = blueprint.variables;
  if (template && clean(template.name, 512).toLowerCase() !== blueprint.template_name) {
    variables = useCase === "appointment_reminder" ? importedAppointmentVariableOrder(template) : null;
    if (!variables) throw hubError("template_parameter_binding_required", 409, { template: clean(template.name, 512) });
  }
  return variables.map(function (key) {
    const value = clean(parameters[key], 1024);
    if (!value) throw hubError("missing_template_parameter", 422, { parameter: key });
    return value;
  });
}

function hubError(code, status, details) {
  const error = new Error(code);
  error.name = "MetaMessageHubError";
  error.code = code;
  error.status = status || 400;
  error.details = details || null;
  return error;
}

function deliveryKey(input) {
  const supplied = clean(input && input.idempotency_key, 240);
  if (!supplied) throw hubError("idempotency_key_required", 422);
  return crypto.createHash("sha256").update([
    cleanId(input.tenant_id), clean(input.channel, 40), clean(input.source, 40), supplied
  ].join("\u001f")).digest("hex");
}

class InMemoryMetaMessageHubStore {
  constructor() {
    this.templates = new Map();
    this.deliveries = new Map();
  }

  async replaceTemplates(tenantId, channel, templates) {
    this.templates.set(cleanId(tenantId) + ":" + clean(channel, 40), (templates || []).map(function (row) {
      return Object.assign({}, row);
    }));
    return templates || [];
  }

  async listTemplates(tenantId, channel) {
    return (this.templates.get(cleanId(tenantId) + ":" + clean(channel, 40)) || []).map(function (row) {
      return Object.assign({}, row);
    });
  }

  async getDelivery(tenantId, key) {
    return this.deliveries.get(cleanId(tenantId) + ":" + key) || null;
  }

  async saveDelivery(record) {
    this.deliveries.set(cleanId(record.tenant_id) + ":" + record.idempotency_hash, Object.assign({}, record));
    return record;
  }
}

function createMetaMessageHub(options) {
  options = options || {};
  const store = options.store || new InMemoryMetaMessageHubStore();
  const resolveRuntime = options.resolveRuntime;
  const listProviderTemplates = options.listProviderTemplates;
  const createProviderTemplate = options.createProviderTemplate;
  const sendWhatsAppTemplate = options.sendWhatsAppTemplate;
  const sendMessengerTagged = options.sendMessengerTagged;
  const sendInstagramHumanAgent = options.sendInstagramHumanAgent;
  const now = typeof options.now === "function" ? options.now : function () { return new Date(); };
  const inFlight = new Map();

  if (typeof resolveRuntime !== "function") throw new Error("meta_message_hub_runtime_resolver_required");

  async function runtime(tenantId, channel) {
    const cleanTenant = cleanId(tenantId, 160);
    const cleanChannel = clean(channel, 40).toLowerCase();
    if (!cleanTenant || !["whatsapp", "messenger", "instagram"].includes(cleanChannel)) {
      throw hubError("invalid_tenant_or_channel", 422);
    }
    const result = await resolveRuntime(cleanTenant, cleanChannel);
    const actualTenant = cleanId(result && (result.tenant_id || result.tenantId), 160);
    if (!result || actualTenant !== cleanTenant || clean(result.channel, 40) !== cleanChannel) {
      throw hubError("tenant_channel_not_connected", 409, { channel: cleanChannel });
    }
    if (clean(result.source, 80) !== "channel_connection") {
      throw hubError("tenant_scoped_credential_required", 409, { channel: cleanChannel });
    }
    return result;
  }

  async function syncTemplates(input) {
    const tenantId = cleanId(input && input.tenant_id, 160);
    const channel = clean(input && input.channel || "whatsapp", 40).toLowerCase();
    if (channel !== "whatsapp") return { tenant_id: tenantId, channel, templates: [], supported: false };
    if (typeof listProviderTemplates !== "function") throw hubError("template_sync_unavailable", 503);
    const active = await runtime(tenantId, channel);
    const wabaId = clean(active.whatsapp_business_account_id || active.whatsappBusinessAccountId, 240);
    if (!wabaId) throw hubError("whatsapp_business_account_missing", 409);
    const providerRows = await listProviderTemplates(active);
    const rows = (providerRows || []).map(function (row) {
      return providerTemplate(row, tenantId, wabaId, now());
    });
    await store.replaceTemplates(tenantId, channel, rows);
    return { tenant_id: tenantId, channel, provider_account_id: wabaId, templates: rows, supported: true };
  }

  async function ensureTemplates(input) {
    const tenantId = cleanId(input && input.tenant_id, 160);
    const requested = Array.isArray(input && input.use_cases) && input.use_cases.length
      ? input.use_cases.map(function (value) { return clean(value, 80); })
      : Object.keys(USE_CASES);
    requested.forEach(function (useCase) {
      if (!USE_CASES[useCase]) throw hubError("unsupported_use_case", 422, { use_case: useCase });
    });
    let snapshot = await syncTemplates({ tenant_id: tenantId, channel: "whatsapp" });
    const active = await runtime(tenantId, "whatsapp");
    const created = [];
    for (const useCase of requested) {
      if (snapshot.templates.some(function (template) { return templateMatchesUseCase(template, useCase); })) continue;
      if (typeof createProviderTemplate !== "function") throw hubError("template_creation_unavailable", 503);
      const blueprint = USE_CASES[useCase];
      const result = await createProviderTemplate(active, {
        name: blueprint.template_name,
        language: blueprint.language,
        category: blueprint.category,
        components: blueprint.components
      });
      created.push({ use_case: useCase, name: blueprint.template_name, provider: result || null });
    }
    if (created.length) snapshot = await syncTemplates({ tenant_id: tenantId, channel: "whatsapp" });
    return Object.assign({}, snapshot, { created });
  }

  async function requestUnlocked(input, hash) {
    const tenantId = cleanId(input && input.tenant_id, 160);
    const channel = clean(input && input.channel, 40).toLowerCase();
    const source = clean(input && input.source, 40).toLowerCase();
    const useCase = clean(input && input.use_case, 80).toLowerCase();
    if (!tenantId || !channel || !source || !useCase) throw hubError("invalid_message_request", 422);
    if (!BOT_SOURCES.has(source)) throw hubError("unsupported_message_source", 422);
    const previous = await store.getDelivery(tenantId, hash);
    if (previous) return Object.assign({}, previous, { idempotent_replay: true });
    const active = await runtime(tenantId, channel);
    let result;

    if (channel === "whatsapp") {
      if (!USE_CASES[useCase]) throw hubError("unsupported_use_case", 422, { use_case: useCase });
      const snapshot = await syncTemplates({ tenant_id: tenantId, channel });
      const candidates = snapshot.templates.filter(function (template) {
        return templateMatchesUseCase(template, useCase);
      });
      const approved = candidates.find(function (template) { return template.status === "approved"; });
      if (!approved) {
        const pendingStatus = candidates[0] && candidates[0].status || "missing";
        throw hubError("approved_template_unavailable", 409, {
          use_case: useCase,
          template_status: pendingStatus,
          templates: candidates.map(function (template) {
            return { name: template.name, language: template.language, status: template.status, rejected_reason: template.rejected_reason };
          })
        });
      }
      if (typeof sendWhatsAppTemplate !== "function") throw hubError("whatsapp_template_delivery_unavailable", 503);
      const parameters = parameterValues(useCase, input.parameters, approved);
      const sent = await sendWhatsAppTemplate(active, clean(input.recipient, 500), approved, parameters);
      result = {
        tenant_id: tenantId,
        channel,
        source,
        use_case: useCase,
        status: "accepted",
        mechanism: "whatsapp_message_template",
        template: { id: approved.provider_template_id, name: approved.name, language: approved.language, status: approved.status },
        provider_message_id: clean(sent && sent.provider_message_id, 500) || null,
        sent_at: now().toISOString()
      };
    } else if (channel === "messenger") {
      if (useCase !== "appointment_reminder" || input.confirmed_event !== true) {
        throw hubError("messenger_out_of_window_use_case_not_allowed", 409, { use_case: useCase });
      }
      if (source !== "appointment") throw hubError("messenger_confirmed_event_source_required", 409);
      if (typeof sendMessengerTagged !== "function") throw hubError("messenger_tagged_delivery_unavailable", 503);
      const sent = await sendMessengerTagged(active, clean(input.recipient, 500), clean(input.text, 2000), "CONFIRMED_EVENT_UPDATE");
      result = {
        tenant_id: tenantId,
        channel,
        source,
        use_case: useCase,
        status: "accepted",
        mechanism: "messenger_message_tag",
        message_tag: "CONFIRMED_EVENT_UPDATE",
        provider_message_id: clean(sent && sent.provider_message_id, 500) || null,
        sent_at: now().toISOString()
      };
    } else if (channel === "instagram") {
      // Meta explicitly disallows automated messages with HUMAN_AGENT. Bot
      // sources therefore fail closed. A separate, explicitly human action may
      // use the seven-day human support path.
      if (input.human_agent !== true || input.actor_type !== "human") {
        throw hubError("instagram_automated_out_of_window_not_allowed", 409);
      }
      if (typeof sendInstagramHumanAgent !== "function") throw hubError("instagram_human_agent_delivery_unavailable", 503);
      const sent = await sendInstagramHumanAgent(active, clean(input.recipient, 500), clean(input.text, 950));
      result = {
        tenant_id: tenantId,
        channel,
        source,
        use_case: useCase,
        status: "accepted",
        mechanism: "instagram_human_agent",
        provider_message_id: clean(sent && sent.provider_message_id, 500) || null,
        sent_at: now().toISOString()
      };
    } else {
      throw hubError("unsupported_channel", 422);
    }

    result.idempotency_hash = hash;
    await store.saveDelivery(result);
    return result;
  }

  async function request(input) {
    const hash = deliveryKey(input);
    const existing = inFlight.get(hash);
    if (existing) return existing;
    const pending = requestUnlocked(input || {}, hash).finally(function () { inFlight.delete(hash); });
    inFlight.set(hash, pending);
    return pending;
  }

  return { ensureTemplates, request, syncTemplates, store };
}

module.exports = {
  BOT_SOURCES,
  InMemoryMetaMessageHubStore,
  USE_CASES,
  createMetaMessageHub,
  hubError,
  parameterValues,
  providerTemplate,
  importedAppointmentVariableOrder,
  templateMatchesUseCase
};
