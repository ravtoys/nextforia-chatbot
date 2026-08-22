"use strict";

const crypto = require("crypto");

function cleanText(value, max) {
  return String(value == null ? "" : value).replace(/\u0000/g, "").trim().slice(0, max || 1000);
}

function cleanTenantId(value) {
  return cleanText(value, 120).toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function appointmentPromptHash(configuration) {
  return crypto.createHash("sha256")
    .update(cleanText(configuration && configuration.system_prompt, 200000) + "\n\n" + appointmentToolPrompt())
    .digest("hex");
}

function appointmentAgentIdForTenant(tenantId, agentTenantMap) {
  const cleanTenant = cleanTenantId(tenantId);
  const map = agentTenantMap || {};
  return Object.keys(map).find(function (agentId) {
    return cleanTenantId(map[agentId]) === cleanTenant;
  }) || "";
}

function parsePhoneNumberTenantMap(env) {
  env = env || {};
  const result = {};
  const raw = cleanText(env.ELEVENLABS_PHONE_NUMBER_TENANT_MAP, 20000);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      Object.keys(parsed || {}).forEach(function (phoneNumberId) {
        const tenantId = cleanTenantId(parsed[phoneNumberId]);
        if (cleanText(phoneNumberId, 160) && tenantId) result[cleanText(phoneNumberId, 160)] = tenantId;
      });
    } catch (_) {}
  }
  const dercoPhoneNumberId = cleanText(env.ELEVENLABS_DERCO_PHONE_NUMBER_ID, 160);
  if (dercoPhoneNumberId) result[dercoPhoneNumberId] = "grupo-derco";
  return Object.freeze(result);
}

function appointmentPhoneNumberIdForTenant(tenantId, phoneNumberTenantMap) {
  const cleanTenant = cleanTenantId(tenantId);
  const map = phoneNumberTenantMap || {};
  return Object.keys(map).find(function (phoneNumberId) {
    return cleanTenantId(map[phoneNumberId]) === cleanTenant;
  }) || "";
}

function appointmentAgentConfigured(configuration, tenantId, agentTenantMap) {
  const config = configuration && typeof configuration === "object" ? configuration : {};
  const cleanTenant = cleanTenantId(tenantId);
  const externalAgentId = cleanText(config.external_agent_id, 160);
  const externalMappedTenant = externalAgentId && cleanTenantId((agentTenantMap || {})[externalAgentId]);
  if (externalMappedTenant && externalMappedTenant !== cleanTenant) return false;
  const agentId = externalAgentId || appointmentAgentIdForTenant(tenantId, agentTenantMap);
  if (!agentId) return false;
  return config.external_provider === "elevenlabs" &&
    config.external_status === "configured" &&
    config.external_agent_id === agentId &&
    config.external_prompt_hash === appointmentPromptHash(config);
}

async function createElevenLabsAppointmentAgentFromTemplate(record, tenantId, options) {
  options = options || {};
  const configuration = record && record.appointment_configuration || {};
  if (configuration.bot_type !== "appointments") {
    const error = new Error("appointment_not_selected");
    error.status = 422;
    throw error;
  }
  if (configuration.lifecycle !== "approved_for_testing") {
    const error = new Error("appointment_not_in_testing");
    error.status = 422;
    throw error;
  }
  if (!options.apiKey) {
    const error = new Error("elevenlabs_api_key_missing");
    error.status = 422;
    throw error;
  }
  if (options.writeEnabled !== true) {
    const error = new Error("elevenlabs_write_disabled");
    error.status = 409;
    throw error;
  }
  const templateAgentId = cleanText(options.templateAgentId, 160);
  if (!templateAgentId) {
    const error = new Error("elevenlabs_template_agent_missing");
    error.status = 422;
    throw error;
  }
  const http = options.httpClient;
  if (!http || typeof http.get !== "function" || typeof http.post !== "function") {
    const error = new Error("elevenlabs_client_unavailable");
    error.status = 503;
    throw error;
  }
  const headers = { "Content-Type": "application/json", "xi-api-key": options.apiKey };
  const templateResponse = await http.get(
    "https://api.elevenlabs.io/v1/convai/agents/" + encodeURIComponent(templateAgentId),
    { headers, timeout: options.timeoutMs || 15000 }
  );
  const template = templateResponse && templateResponse.data || {};
  const conversationConfig = JSON.parse(JSON.stringify(template.conversation_config || {}));
  delete conversationConfig.language_presets;
  conversationConfig.agent = conversationConfig.agent || {};
  conversationConfig.agent.first_message = appointmentFirstMessage(configuration);
  conversationConfig.agent.language = "es";
  conversationConfig.agent.prompt = conversationConfig.agent.prompt || {};
  conversationConfig.agent.prompt.prompt = cleanText(configuration.system_prompt, 200000) +
    "\n\n" + appointmentToolPrompt();
  const cleanTenant = cleanTenantId(tenantId || record && record.tenant_id);
  delete conversationConfig.agent.prompt.knowledge_base;
  delete conversationConfig.agent.prompt.tools;
  conversationConfig.agent.prompt.tool_ids = await createElevenLabsAppointmentTools(cleanTenant, {
    apiKey: options.apiKey,
    toolSecret: options.toolSecret,
    baseUrl: options.toolBaseUrl,
    httpClient: http,
    timeoutMs: options.timeoutMs
  });
  const payload = {
    name: cleanText(configuration.business_name, 80)
      ? "Nextfor Appointment · " + cleanText(configuration.business_name, 80)
      : "Nextfor Appointment · " + cleanTenant,
    tags: Array.from(new Set([].concat(template.tags || [], ["nextfor", "appointments", cleanTenant]).filter(Boolean))),
    conversation_config: conversationConfig
  };
  const sourcePlatformSettings = template.platform_settings && typeof template.platform_settings === "object"
    ? template.platform_settings
    : {};
  const templatePlatformSettings = {};
  ["privacy", "call_limits", "guardrails", "safety", "summary_language", "overrides", "workspace_overrides"].forEach(function (key) {
    if (sourcePlatformSettings[key] !== undefined) {
      templatePlatformSettings[key] = JSON.parse(JSON.stringify(sourcePlatformSettings[key]));
    }
  });
  payload.platform_settings = Object.assign({}, templatePlatformSettings, {
    data_collection: {
      appointment_status: { type: "string", description: "Estado final: booked, requested, failed, cancelled, rescheduled o not_requested." },
      appointment_datetime: { type: "string", description: "Fecha y hora confirmada en ISO 8601 con zona horaria." },
      appointment_duration_minutes: { type: "integer", description: "Duración confirmada de la cita en minutos." },
      client_name: { type: "string", description: "Nombre completo del cliente." },
      client_phone: { type: "string", description: "Teléfono del cliente con código de país." },
      client_email: { type: "string", description: "Correo del cliente si fue proporcionado." },
      consultation_reason: { type: "string", description: "Servicio o motivo de la cita." },
      data_processing_consent: { type: "string", description: "authorized si aceptó, denied si rechazó, unclear si no fue explícito." }
    }
  });
  const created = await http.post("https://api.elevenlabs.io/v1/convai/agents/create", payload, {
    headers,
    timeout: options.timeoutMs || 15000
  });
  const agentId = cleanText(created && created.data && created.data.agent_id, 160);
  if (!agentId) {
    const error = new Error("elevenlabs_agent_create_failed");
    error.status = 502;
    throw error;
  }
  return {
    ok: true,
    applied: true,
    created: true,
    template_agent_id: templateAgentId,
    agent_id: agentId,
    tenant_id: cleanTenant,
    prompt_hash: appointmentPromptHash(configuration),
    provider_response_status: created && created.status || 200,
    payload
  };
}

function appointmentPhoneNumberConfigured(configuration, tenantId, phoneNumberTenantMap) {
  const config = configuration && typeof configuration === "object" ? configuration : {};
  const phoneNumberId = cleanText(config.external_phone_number_id, 160) ||
    appointmentPhoneNumberIdForTenant(tenantId, phoneNumberTenantMap);
  if (!phoneNumberId) return false;
  return config.external_phone_status === "configured" &&
    config.external_phone_number_id === phoneNumberId &&
    config.external_phone_agent_id === config.external_agent_id;
}

function assignedAgentId(phoneNumber) {
  const assigned = phoneNumber && phoneNumber.assigned_agent;
  return cleanText(
    assigned && (assigned.agent_id || assigned.agentId) ||
    phoneNumber && (phoneNumber.assigned_agent_id || phoneNumber.assignedAgentId),
    160
  );
}

async function resolveElevenLabsPhoneNumber(record, tenantId, options) {
  options = options || {};
  const configuration = record && record.appointment_configuration || {};
  const agentId = cleanText(
    options.agentId || configuration.external_agent_id ||
    appointmentAgentIdForTenant(tenantId || record && record.tenant_id, options.agentTenantMap),
    160
  );
  const configuredPhoneNumberId = cleanText(
    options.phoneNumberId || configuration.external_phone_number_id ||
    appointmentPhoneNumberIdForTenant(tenantId || record && record.tenant_id, options.phoneNumberTenantMap),
    160
  );
  const http = options.httpClient;
  if (configuredPhoneNumberId) {
    if (options.apiKey && http && typeof http.get === "function") {
      try {
        const configuredResponse = await http.get("https://api.elevenlabs.io/v1/convai/phone-numbers", {
          headers: { "Content-Type": "application/json", "xi-api-key": options.apiKey },
          timeout: options.timeoutMs || 15000
        });
        const configuredRow = (Array.isArray(configuredResponse && configuredResponse.data) ? configuredResponse.data : []).find(function (row) {
          return cleanText(row && (row.phone_number_id || row.phoneNumberId), 160) === configuredPhoneNumberId;
        });
        if (configuredRow) {
          return {
            phone_number_id: configuredPhoneNumberId,
            phone_number: cleanText(configuredRow.phone_number || configuredRow.phoneNumber, 40),
            provider: cleanText(configuredRow.provider, 40),
            source: "configured"
          };
        }
      } catch (_) {}
    }
    return { phone_number_id: configuredPhoneNumberId, phone_number: "", provider: "", source: "configured" };
  }
  if (options.autoAssignEnabled !== true) {
    const error = new Error("elevenlabs_phone_not_mapped");
    error.status = 422;
    throw error;
  }
  if (!options.apiKey) {
    const error = new Error("elevenlabs_api_key_missing");
    error.status = 422;
    throw error;
  }
  if (!http || typeof http.get !== "function") {
    const error = new Error("elevenlabs_client_unavailable");
    error.status = 503;
    throw error;
  }
  const response = await http.get("https://api.elevenlabs.io/v1/convai/phone-numbers", {
    headers: { "Content-Type": "application/json", "xi-api-key": options.apiKey },
    timeout: options.timeoutMs || 15000
  });
  const rows = Array.isArray(response && response.data) ? response.data : [];
  const reserved = new Set(Object.keys(options.phoneNumberTenantMap || {}).map(function (id) {
    return cleanText(id, 160);
  }).filter(Boolean));
  const candidates = rows.filter(function (row) {
    const id = cleanText(row && (row.phone_number_id || row.phoneNumberId), 160);
    const assigned = assignedAgentId(row);
    return id && (!assigned || assigned === agentId) && (!reserved.has(id) || assigned === agentId);
  }).sort(function (a, b) {
    const aAssigned = assignedAgentId(a) === agentId ? 0 : 1;
    const bAssigned = assignedAgentId(b) === agentId ? 0 : 1;
    if (aAssigned !== bAssigned) return aAssigned - bAssigned;
    const aPreferred = /nextfor|appointment|citas/i.test(cleanText(a && a.label, 160)) ? 0 : 1;
    const bPreferred = /nextfor|appointment|citas/i.test(cleanText(b && b.label, 160)) ? 0 : 1;
    if (aPreferred !== bPreferred) return aPreferred - bPreferred;
    return cleanText(a && (a.phone_number_id || a.phoneNumberId), 160)
      .localeCompare(cleanText(b && (b.phone_number_id || b.phoneNumberId), 160));
  });
  if (!candidates[0]) {
    const error = new Error("elevenlabs_phone_unavailable");
    error.status = 409;
    throw error;
  }
  return {
    phone_number_id: cleanText(candidates[0].phone_number_id || candidates[0].phoneNumberId, 160),
    phone_number: cleanText(candidates[0].phone_number || candidates[0].phoneNumber, 40),
    provider: cleanText(candidates[0].provider, 40),
    source: assignedAgentId(candidates[0]) === agentId ? "already_assigned" : "available_inventory"
  };
}

function appointmentFirstMessage(configuration) {
  const assistant = cleanText(configuration && configuration.assistant_name, 80) || "Nextfor";
  const business = cleanText(configuration && configuration.business_name, 120) || "tu negocio";
  const identity = assistant.toLowerCase().includes(business.toLowerCase())
    ? assistant
    : assistant + " de " + business;
  return "Hola, soy " + identity + ". Puedo ayudarte a agendar, confirmar o reprogramar tu cita. ¿Qué necesitas?";
}

function appointmentToolPrompt() {
  return [
    "CONTEXTO TEMPORAL Y MEMORIA DE LA CONVERSACIÓN:",
    "- La fecha y hora actual real es {{system__time}}. La hora UTC es {{system__time_utc}} y la zona informada es {{system__timezone}}.",
    "- Nunca adivines el mes, la fecha ni el día de la semana. Para cualquier horario solicitado, usa la herramienta de disponibilidad y repite exactamente la fecha normalizada que devuelve.",
    "- Trata toda la conversación como un solo formulario acumulativo: conserva cada dato que el cliente ya entregó, incluso si dio varios en un mismo mensaje.",
    "- Nunca vuelvas a pedir un dato ya entregado. Pregunta únicamente los campos obligatorios que todavía falten. Si el cliente corrige un dato, reemplaza el anterior.",
    "- Responde de forma breve y natural. Haz como máximo una pregunta clara por turno y evita listas largas salvo que el cliente las solicite.",
    "- Si el cliente corrige la fecha, conserva la hora, el servicio y los demás datos ya entregados, excepto el dato corregido.",
    "- Antes de reservar, resume los datos reunidos una sola vez para confirmación; no los solicites de nuevo.",
    "- Si una herramienta reporta un campo faltante, pide solamente ese campo.",
    "- Envía los datos configurables a la herramienta de agendamiento dentro de booking_fields, usando exactamente el id indicado por la configuración del negocio.",
    "",
    "REGLAS OBLIGATORIAS DE HERRAMIENTAS:",
    "- Antes de ofrecer o confirmar un horario, usa la herramienta de disponibilidad.",
    "- Solo confirma una reserva cuando la herramienta de agendamiento responda ok=true.",
    "- Para cancelar o reprogramar, identifica una sola cita, confirma la intención del cliente y usa la herramienta correspondiente.",
    "- Solo confirma una cancelación o reprogramación cuando la herramienta responda ok=true.",
    "- Si una herramienta falla o devuelve varias coincidencias, no inventes el resultado: solicita el dato faltante o deriva a una persona.",
    "- Nunca reveles identificadores internos, tokens, errores técnicos ni datos de otros clientes."
  ].join("\n");
}

function appointmentToolToken(tenantId, secret) {
  const cleanTenant = cleanTenantId(tenantId);
  const key = cleanText(secret, 4096);
  if (!cleanTenant || key.length < 32) return "";
  return crypto.createHmac("sha256", key).update("nextfor-appointment-tool:" + cleanTenant).digest("base64url");
}

function appointmentWebhookToolConfig(name, description, url, properties, required) {
  return {
    tool_config: {
      type: "webhook",
      name,
      description,
      response_timeout_secs: 20,
      api_schema: {
        url,
        method: "POST",
        path_params_schema: {},
        request_body_schema: { type: "object", description, properties, required },
        request_headers: {}
      }
    }
  };
}

function appointmentToolName(base, tenantId) {
  const suffix = crypto.createHash("sha256").update(cleanTenantId(tenantId)).digest("hex").slice(0, 10);
  return cleanText(base, 48) + "_" + suffix;
}

function existingAppointmentToolId(rows, definition) {
  const expected = definition && definition.tool_config || {};
  const expectedUrl = expected.api_schema && expected.api_schema.url;
  const match = (rows || []).find(function (row) {
    const config = row && row.tool_config || {};
    return config.name === expected.name &&
      config.type === expected.type &&
      config.api_schema && config.api_schema.url === expectedUrl;
  });
  return cleanText(match && match.id, 160);
}

async function createElevenLabsAppointmentTools(tenantId, options) {
  options = options || {};
  const cleanTenant = cleanTenantId(tenantId);
  const token = appointmentToolToken(cleanTenant, options.toolSecret);
  const baseUrl = String(options.baseUrl || "").replace(/\/+$/, "");
  const http = options.httpClient;
  if (!token) {
    const error = new Error("elevenlabs_appointment_tool_secret_missing");
    error.status = 422;
    throw error;
  }
  if (!/^https:\/\//.test(baseUrl)) {
    const error = new Error("elevenlabs_appointment_tool_url_missing");
    error.status = 422;
    throw error;
  }
  if (!http || typeof http.post !== "function") {
    const error = new Error("elevenlabs_client_unavailable");
    error.status = 503;
    throw error;
  }
  const root = baseUrl + "/webhooks/elevenlabs/appointments/" + encodeURIComponent(cleanTenant);
  const dateProperties = {
    starts_at: { type: "string", description: "Fecha y hora ISO 8601 con zona horaria." },
    duration_minutes: { type: "integer", description: "Duración del servicio en minutos." }
  };
  const definitions = [
    appointmentWebhookToolConfig(
      appointmentToolName("nextfor_check_appointment_availability", cleanTenant),
      "Consulta el calendario real del cliente Nextfor antes de ofrecer o confirmar un horario.",
      root + "/availability?token=" + encodeURIComponent(token),
      dateProperties,
      ["starts_at", "duration_minutes"]
    ),
    appointmentWebhookToolConfig(
      appointmentToolName("nextfor_book_appointment_v2", cleanTenant),
      "Crea una cita confirmada en Nextfor y el calendario conectado después de comprobar disponibilidad y obtener consentimiento.",
      root + "/book?token=" + encodeURIComponent(token),
      Object.assign({}, dateProperties, {
        customer_name: { type: "string", description: "Nombre completo del cliente." },
        customer_phone: { type: "string", description: "Teléfono del cliente con código de país." },
        customer_email: { type: "string", description: "Correo del cliente si lo proporcionó." },
        booking_fields: {
          type: "object",
          description: "Datos configurados por el negocio, indexados por su id exacto. Incluye campos estándar y preguntas personalizadas.",
          additionalProperties: { type: "string" }
        },
        consultation_reason: { type: "string", description: "Servicio o motivo de la cita." },
        deposit_status: {
          type: "string",
          enum: ["not_required", "pending", "customer_reported_paid", "verified"],
          description: "verified solo cuando el flujo de pago autorizado verificó el anticipo; nunca por una afirmación del cliente."
        },
        data_processing_consent: { type: "boolean", description: "True solo si el cliente autorizó tratamiento de datos." }
      }),
      ["starts_at", "duration_minutes", "consultation_reason", "data_processing_consent"]
    ),
    appointmentWebhookToolConfig(
      appointmentToolName("nextfor_cancel_appointment", cleanTenant),
      "Cancela una cita existente en Nextfor y en el calendario conectado solo después de que el cliente confirme la cancelación.",
      root + "/cancel?token=" + encodeURIComponent(token),
      {
        appointment_id: { type: "string", description: "Identificador de la cita si está disponible." },
        customer_phone: { type: "string", description: "Teléfono del cliente con código de país para identificar la cita." },
        customer_email: { type: "string", description: "Correo del cliente para identificar la cita." },
        current_starts_at: { type: "string", description: "Fecha y hora actual de la cita en ISO 8601 con zona horaria." },
        reason: { type: "string", description: "Motivo de cancelación indicado por el cliente." },
        cancellation_confirmed: { type: "boolean", description: "True solo cuando el cliente confirmó que desea cancelar." }
      },
      ["cancellation_confirmed"]
    ),
    appointmentWebhookToolConfig(
      appointmentToolName("nextfor_reschedule_appointment", cleanTenant),
      "Reprograma una cita existente en Nextfor y en el calendario conectado después de verificar el nuevo horario y confirmar el cambio.",
      root + "/reschedule?token=" + encodeURIComponent(token),
      {
        appointment_id: { type: "string", description: "Identificador de la cita si está disponible." },
        customer_phone: { type: "string", description: "Teléfono del cliente con código de país para identificar la cita." },
        customer_email: { type: "string", description: "Correo del cliente para identificar la cita." },
        current_starts_at: { type: "string", description: "Fecha y hora actual de la cita en ISO 8601 con zona horaria." },
        new_starts_at: { type: "string", description: "Nueva fecha y hora solicitada en ISO 8601 con zona horaria." },
        duration_minutes: { type: "integer", description: "Duración de la cita en minutos." },
        reason: { type: "string", description: "Motivo del cambio si fue indicado." },
        reschedule_confirmed: { type: "boolean", description: "True solo cuando el cliente confirmó el nuevo horario." }
      },
      ["new_starts_at", "duration_minutes", "reschedule_confirmed"]
    )
  ];
  let existingTools = [];
  if (typeof http.get === "function") {
    try {
      const response = await http.get("https://api.elevenlabs.io/v1/convai/tools", {
        headers: { "Content-Type": "application/json", "xi-api-key": options.apiKey },
        timeout: options.timeoutMs || 15000
      });
      existingTools = Array.isArray(response && response.data)
        ? response.data
        : Array.isArray(response && response.data && response.data.tools)
          ? response.data.tools
          : [];
    } catch (_) {}
  }
  const ids = [];
  for (const definition of definitions) {
    const existingId = existingAppointmentToolId(existingTools, definition);
    if (existingId) {
      ids.push(existingId);
      continue;
    }
    const response = await http.post("https://api.elevenlabs.io/v1/convai/tools", definition, {
      headers: { "Content-Type": "application/json", "xi-api-key": options.apiKey },
      timeout: options.timeoutMs || 15000
    });
    const id = cleanText(response && response.data && response.data.id, 160);
    if (!id) {
      const error = new Error("elevenlabs_tool_create_failed");
      error.status = 502;
      throw error;
    }
    ids.push(id);
  }
  return ids;
}

function buildElevenLabsAppointmentAgentPayload(record, tenantId, options) {
  options = options || {};
  const configuration = record && record.appointment_configuration || {};
  const agentId = cleanText(options.agentId || configuration.external_agent_id || appointmentAgentIdForTenant(tenantId || record && record.tenant_id, options.agentTenantMap), 160);
  const prompt = cleanText(configuration.system_prompt, 200000);
  if (!prompt) {
    const error = new Error("appointment_configuration_required");
    error.status = 422;
    throw error;
  }
  if (configuration.bot_type !== "appointments") {
    const error = new Error("appointment_not_selected");
    error.status = 422;
    throw error;
  }
  if (configuration.lifecycle !== "approved_for_testing") {
    const error = new Error("appointment_not_in_testing");
    error.status = 422;
    throw error;
  }
  if (!agentId) {
    const error = new Error("elevenlabs_agent_not_mapped");
    error.status = 422;
    throw error;
  }
  const cleanTenant = cleanTenantId(tenantId || record && record.tenant_id);
  const payload = {
    name: cleanText(configuration.business_name, 80)
      ? "Nextfor Appointment · " + cleanText(configuration.business_name, 80)
      : "Nextfor Appointment · " + cleanTenant,
    tags: ["nextfor", "appointments", cleanTenant].filter(Boolean),
    conversation_config: {
      agent: {
        first_message: appointmentFirstMessage(configuration),
        language: "es",
        prompt: { prompt: prompt + "\n\n" + appointmentToolPrompt() }
      }
    }
  };
  return {
    agent_id: agentId,
    tenant_id: cleanTenant,
    prompt_hash: appointmentPromptHash(configuration),
    endpoint: "https://api.elevenlabs.io/v1/convai/agents/" + encodeURIComponent(agentId),
    payload
  };
}

function buildElevenLabsPhoneNumberAssignmentPayload(record, tenantId, options) {
  options = options || {};
  const configuration = record && record.appointment_configuration || {};
  const agentId = cleanText(options.agentId || configuration.external_agent_id || appointmentAgentIdForTenant(tenantId || record && record.tenant_id, options.agentTenantMap), 160);
  const phoneNumberId = cleanText(
    options.phoneNumberId || configuration.external_phone_number_id ||
    appointmentPhoneNumberIdForTenant(tenantId || record && record.tenant_id, options.phoneNumberTenantMap),
    160
  );
  if (configuration.bot_type !== "appointments") {
    const error = new Error("appointment_not_selected");
    error.status = 422;
    throw error;
  }
  if (configuration.lifecycle !== "approved_for_testing") {
    const error = new Error("appointment_not_in_testing");
    error.status = 422;
    throw error;
  }
  if (!agentId) {
    const error = new Error("elevenlabs_agent_not_mapped");
    error.status = 422;
    throw error;
  }
  if (!phoneNumberId) {
    const error = new Error("elevenlabs_phone_not_mapped");
    error.status = 422;
    throw error;
  }
  const cleanTenant = cleanTenantId(tenantId || record && record.tenant_id);
  return {
    agent_id: agentId,
    phone_number_id: phoneNumberId,
    tenant_id: cleanTenant,
    endpoint: "https://api.elevenlabs.io/v1/convai/phone-numbers/" + encodeURIComponent(phoneNumberId),
    payload: { agent_id: agentId }
  };
}

async function applyElevenLabsAppointmentAgent(record, tenantId, options) {
  options = options || {};
  const draft = buildElevenLabsAppointmentAgentPayload(record, tenantId, options);
  if (!options.apiKey) {
    const error = new Error("elevenlabs_api_key_missing");
    error.status = 422;
    error.draft = draft;
    throw error;
  }
  if (options.writeEnabled !== true) {
    const error = new Error("elevenlabs_write_disabled");
    error.status = 409;
    error.draft = draft;
    throw error;
  }
  const http = options.httpClient;
  if (!http || typeof http.patch !== "function") {
    const error = new Error("elevenlabs_client_unavailable");
    error.status = 503;
    error.draft = draft;
    throw error;
  }
  if (options.toolSecret && options.toolBaseUrl) {
    draft.payload.conversation_config.agent.prompt.tool_ids = await createElevenLabsAppointmentTools(
      draft.tenant_id,
      {
        apiKey: options.apiKey,
        toolSecret: options.toolSecret,
        baseUrl: options.toolBaseUrl,
        httpClient: http,
        timeoutMs: options.timeoutMs
      }
    );
    delete draft.payload.conversation_config.agent.prompt.tools;
  }
  const response = await http.patch(draft.endpoint, draft.payload, {
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": options.apiKey
    },
    timeout: options.timeoutMs || 15000
  });
  return {
    ok: true,
    applied: true,
    agent_id: draft.agent_id,
    tenant_id: draft.tenant_id,
    prompt_hash: draft.prompt_hash,
    provider_response_status: response && response.status || 200,
    payload: draft.payload
  };
}

async function applyElevenLabsPhoneNumberAssignment(record, tenantId, options) {
  options = options || {};
  const draft = buildElevenLabsPhoneNumberAssignmentPayload(record, tenantId, options);
  if (!options.apiKey) {
    const error = new Error("elevenlabs_api_key_missing");
    error.status = 422;
    error.draft = draft;
    throw error;
  }
  if (options.writeEnabled !== true) {
    const error = new Error("elevenlabs_write_disabled");
    error.status = 409;
    error.draft = draft;
    throw error;
  }
  const http = options.httpClient;
  if (!http || typeof http.patch !== "function") {
    const error = new Error("elevenlabs_client_unavailable");
    error.status = 503;
    error.draft = draft;
    throw error;
  }
  const response = await http.patch(draft.endpoint, draft.payload, {
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": options.apiKey
    },
    timeout: options.timeoutMs || 15000
  });
  return {
    ok: true,
    applied: true,
    agent_id: draft.agent_id,
    phone_number_id: draft.phone_number_id,
    phone_number: cleanText(options.phoneNumber || options.phone_number, 40),
    phone_provider: cleanText(options.phoneProvider || options.phone_provider, 40),
    tenant_id: draft.tenant_id,
    provider_response_status: response && response.status || 200,
    payload: draft.payload
  };
}

function markAppointmentConfigurationElevenLabsApplied(configuration, result, actor, now) {
  return Object.assign({}, configuration, {
    external_provider: "elevenlabs",
    external_status: "configured",
    external_agent_id: cleanText(result && result.agent_id, 160),
    external_prompt_hash: cleanText(result && result.prompt_hash, 80),
    external_configured_at: cleanText(now, 40) || new Date().toISOString(),
    external_configured_by: cleanText(actor, 160),
    external_last_error: ""
  });
}

function markAppointmentConfigurationPhoneApplied(configuration, result, actor, now) {
  return Object.assign({}, configuration, {
    external_phone_status: "configured",
    external_phone_number_id: cleanText(result && result.phone_number_id, 160),
    external_phone_number: cleanText(result && result.phone_number, 40),
    external_phone_provider: cleanText(result && result.phone_provider, 40),
    external_phone_agent_id: cleanText(result && result.agent_id, 160),
    external_phone_configured_at: cleanText(now, 40) || new Date().toISOString(),
    external_phone_configured_by: cleanText(actor, 160),
    external_phone_last_error: ""
  });
}

function markAppointmentConfigurationElevenLabsFailed(configuration, error, actor, now) {
  return Object.assign({}, configuration, {
    external_provider: "elevenlabs",
    external_status: "failed",
    external_configured_by: cleanText(actor, 160),
    external_configured_at: cleanText(now, 40) || new Date().toISOString(),
    external_last_error: cleanText(error && error.message || error, 500)
  });
}

function markAppointmentConfigurationPhoneFailed(configuration, error, actor, now) {
  return Object.assign({}, configuration, {
    external_phone_status: "failed",
    external_phone_configured_by: cleanText(actor, 160),
    external_phone_configured_at: cleanText(now, 40) || new Date().toISOString(),
    external_phone_last_error: cleanText(error && error.message || error, 500)
  });
}

module.exports = {
  applyElevenLabsAppointmentAgent,
  applyElevenLabsPhoneNumberAssignment,
  appointmentAgentConfigured,
  appointmentAgentIdForTenant,
  appointmentPhoneNumberConfigured,
  appointmentPhoneNumberIdForTenant,
  appointmentPromptHash,
  appointmentToolToken,
  buildElevenLabsPhoneNumberAssignmentPayload,
  buildElevenLabsAppointmentAgentPayload,
  createElevenLabsAppointmentAgentFromTemplate,
  createElevenLabsAppointmentTools,
  markAppointmentConfigurationElevenLabsApplied,
  markAppointmentConfigurationElevenLabsFailed,
  markAppointmentConfigurationPhoneApplied,
  markAppointmentConfigurationPhoneFailed,
  parsePhoneNumberTenantMap,
  resolveElevenLabsPhoneNumber
};
