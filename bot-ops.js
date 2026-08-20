"use strict";

const crypto = require("crypto");
const { detectAtlasIntent, ROUTES: ATLAS_ROUTES } = require("./atlas-coordinator");

const STATUS = Object.freeze({
  HEALTHY: "healthy",
  ATTENTION: "attention",
  CRITICAL: "critical"
});

const SEVERITY_ORDER = Object.freeze({ opportunity: 1, attention: 2, critical: 3 });
const OPEN_STATUSES = new Set(["open", "approval_pending"]);
const REPORT_REASON_TITLES = Object.freeze({
  respuesta_incorrecta: "El cliente reporto una respuesta incorrecta del bot",
  no_entendio: "El cliente reporto que el bot no entendio la consulta",
  no_respondio: "El cliente reporto que el bot dejo de responder",
  tono: "El cliente reporto un problema de tono del bot",
  otro: "El cliente reporto una falla del bot"
});

const HANDOFF_RESOLUTION_TOOLS = new Set(["admin_takeover", "admin_send_message", "admin_release", "admin_resolve"]);
const APPOINTMENT_TOOLS = new Set([
  "check_appointment_availability",
  "book_appointment",
  "atlas_route_appointments",
  "elevenlabs_post_call"
]);
const CUSTOMER_SERVICE_TOOLS = new Set([
  "search_products",
  "send_product_card",
  "lookup_order_status",
  "atlas_route_customer_service"
]);

function text(value, maximum) {
  const clean = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  return maximum ? clean.slice(0, maximum) : clean;
}

function iso(value, fallback) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : (fallback || new Date().toISOString());
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function slug(value, fallback) {
  return text(value, 160).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || fallback;
}

function severityStatus(findings) {
  const open = (findings || []).filter(function (finding) { return OPEN_STATUSES.has(finding.status || "open"); });
  if (open.some(function (finding) { return finding.severity === "critical"; })) return STATUS.CRITICAL;
  if (open.length) return STATUS.ATTENTION;
  return STATUS.HEALTHY;
}

function botForEvent(event, payload) {
  const explicit = slug(event && event.bot_id || payload && payload.bot_id, "");
  if (["appointments", "customer_service", "platform"].includes(explicit)) return explicit;
  const tools = Array.isArray(payload && payload.tools) ? payload.tools : [];
  if (tools.some(function (tool) { return APPOINTMENT_TOOLS.has(tool); })) return "appointments";
  if (tools.some(function (tool) { return CUSTOMER_SERVICE_TOOLS.has(tool); })) return "customer_service";
  if (event && String(event.channel || "").toLowerCase() === "voice") return "appointments";
  return "customer_service";
}

function sourceKey(event, suffix) {
  return hash([
    text(event && event.tenant_id, 160),
    text(event && event.channel, 40),
    text(event && event.conversation_key, 80),
    text(event && event.event_id, 300),
    text(suffix, 120)
  ].join("\u001f")).slice(0, 48);
}

function findingFor(event, payload, input) {
  const botId = botForEvent(event, payload);
  const tenantId = slug(event && event.tenant_id, "unknown-tenant");
  const channel = slug(event && event.channel, "unknown");
  const conversationKey = text(event && event.conversation_key, 80) || null;
  const scope = input.scope === "conversation" && conversationKey
    ? conversationKey
    : sourceKey(event, input.category);
  return {
    dedupe_key: [tenantId, botId, channel, input.category, scope].join(":"),
    tenant_id: tenantId,
    bot_id: botId,
    channel,
    category: input.category,
    severity: input.severity || "attention",
    status: input.requires_approval ? "approval_pending" : "open",
    title: text(input.title, 180),
    detail: text(input.detail, 1000),
    recommendation: text(input.recommendation, 1000),
    requires_approval: input.requires_approval === true,
    conversation_key: conversationKey,
    source_event_id: text(event && event.event_id, 500) || null,
    occurred_at: iso(event && event.occurred_at),
    evidence: Object.assign({
      source_type: text(event && event.event_type, 80),
      analysis_tier: "light_rules"
    }, input.evidence || {}),
    safe_action: input.safe_action || null
  };
}

function dissatisfactionDetected(message, rating) {
  if (Number(rating) > 0 && Number(rating) <= 3) return true;
  return /\b(?:p[eé]simo|terrible|mal servicio|muy mal|no sirve|in[uú]til|decepcionad[oa]|molest[oa]|enojad[oa]|queja|reclamo|nadie responde|no me ayud(?:a|ó)|wrong answer|bad service|unhappy|frustrated)\b/i.test(String(message || ""));
}

function weakReplyDetected(userMessage, reply, evaluation) {
  const cleanUser = text(userMessage, 2000);
  const cleanReply = text(reply, 3000);
  if (evaluation && ["no", "parcial"].includes(String(evaluation.resuelto || "").toLowerCase())) return true;
  if (evaluation && text(evaluation.errores, 160)) return true;
  if (cleanUser.length >= 24 && cleanReply.length > 0 && cleanReply.length < 12) return true;
  return /^(?:no s[eé]|no puedo ayudarte|no tengo (?:esa )?informaci[oó]n|intenta nuevamente|reformula tu solicitud)[.! ]*$/i.test(cleanReply);
}

function analyzeTurnEvent(event) {
  const payload = event.payload || {};
  const findings = [];
  const status = text(payload.status, 80).toLowerCase() || "unknown";
  const userMessage = text(payload.user_message, 4000);
  const botReply = text(payload.bot_reply, 6000);
  const tools = Array.isArray(payload.tools) ? payload.tools.map(function (tool) { return text(tool, 120); }) : [];
  const failedStatus = ["error", "rate_limited", "outbound_pending"].includes(status);
  const emptyResponse = !!userMessage && !botReply && !tools.includes("human_handoff_active") && !tools.some(function (tool) { return HANDOFF_RESOLUTION_TOOLS.has(tool); });

  if (failedStatus) {
    findings.push(findingFor(event, payload, {
      category: status === "outbound_pending" ? "message_not_delivered" : "message_not_sent",
      severity: "critical",
      scope: "conversation",
      title: status === "outbound_pending" ? "Respuesta pendiente de entrega" : "Mensaje sin envío confirmado",
      detail: "El turno terminó con estado " + status + "; el cliente puede estar esperando una respuesta.",
      recommendation: "Mantener el reintento durable activo y pasar a atención humana si el siguiente intento falla.",
      safe_action: status === "outbound_pending" ? "durable_retry" : "human_attention",
      evidence: { turn_status: status }
    }));
  } else if (status === "fallback" || emptyResponse) {
    findings.push(findingFor(event, payload, {
      category: "message_unanswered",
      severity: emptyResponse ? "critical" : "attention",
      scope: "conversation",
      title: emptyResponse ? "Mensaje sin respuesta" : "Respuesta de respaldo utilizada",
      detail: emptyResponse ? "Se registró actividad entrante sin una respuesta del bot." : "El bot agotó su respuesta normal y utilizó un fallback.",
      recommendation: "Revisar la causa y proteger la conversación con respuesta humana si sigue abierta.",
      safe_action: emptyResponse ? "human_attention" : null,
      evidence: { turn_status: status }
    }));
  }

  if (dissatisfactionDetected(userMessage, payload.rating)) {
    findings.push(findingFor(event, payload, {
      category: "customer_dissatisfaction",
      severity: "attention",
      scope: "conversation",
      title: "Cliente insatisfecho detectado",
      detail: "El mensaje o la calificación contiene una señal explícita de insatisfacción.",
      recommendation: "Dar seguimiento humano y revisar el turno antes de proponer cambios al bot.",
      safe_action: "human_attention",
      evidence: { low_rating: Number(payload.rating) > 0 && Number(payload.rating) <= 3 }
    }));
  }

  if (weakReplyDetected(userMessage, botReply, payload.eval)) {
    findings.push(findingFor(event, payload, {
      category: "weak_or_incorrect_response",
      severity: "attention",
      scope: "conversation",
      title: "Respuesta débil o posiblemente incorrecta",
      detail: "La respuesta activó una regla de calidad o una evaluación previa indicó resolución parcial/incorrecta.",
      recommendation: "Revisar el caso y preparar una mejora para aprobación; no cambiar el prompt automáticamente.",
      requires_approval: true,
      evidence: { evaluated: !!payload.eval }
    }));
  }

  const zeroResults = Array.isArray(payload.zero_result_queries) ? payload.zero_result_queries : [];
  if (zeroResults.length) {
    findings.push(findingFor(event, payload, {
      category: "customer_experience_opportunity",
      severity: "opportunity",
      scope: "conversation",
      title: "Búsqueda sin resultados",
      detail: "El bot no encontró resultados para una consulta del cliente.",
      recommendation: "Revisar catálogo, sinónimos o respuesta alternativa antes de aprobar un cambio.",
      requires_approval: true,
      evidence: { zero_result_count: zeroResults.length }
    }));
  }

  const intent = detectAtlasIntent(userMessage);
  const routedAppointments = tools.includes("atlas_route_appointments");
  const routedCustomerService = tools.includes("atlas_route_customer_service");
  const wrongRoute = intent.intent === ATLAS_ROUTES.APPOINTMENTS && routedCustomerService ||
    intent.intent === ATLAS_ROUTES.CUSTOMER_SERVICE && routedAppointments;
  if (wrongRoute) {
    findings.push(findingFor(event, payload, {
      category: "incorrect_routing",
      severity: "critical",
      scope: "conversation",
      title: "Enrutamiento incorrecto entre bots",
      detail: "La intención explícita del cliente no coincide con la ruta registrada por Atlas.",
      recommendation: "Proteger el caso con atención humana y preparar una corrección de routing para aprobación.",
      requires_approval: true,
      safe_action: "human_attention",
      evidence: { detected_intent: intent.intent, registered_route: routedAppointments ? "appointments" : "customer_service" }
    }));
  }

  if (tools.includes("request_human_handoff") || payload.handoff === true) {
    findings.push(findingFor(event, payload, {
      category: "handoff_pending",
      severity: "attention",
      scope: "conversation",
      title: "Conversación pendiente de atención humana",
      detail: "El bot solicitó intervención humana y la conversación debe quedar visible hasta que un agente responda.",
      recommendation: "Confirmar que un agente tomó o resolvió la conversación.",
      safe_action: "human_attention"
    }));
  }

  const resolvesHandoff = tools.some(function (tool) { return HANDOFF_RESOLUTION_TOOLS.has(tool); });
  const resolveCategories = status === "ok" && !!botReply
    ? ["message_not_sent", "message_unanswered", "message_not_registered"]
    : [];
  return { findings, resolves_handoff: resolvesHandoff, resolve_categories: resolveCategories };
}

function analyzeEvent(event) {
  const payload = event && event.payload || {};
  if (event && event.event_type === "turn") return analyzeTurnEvent(event);
  if (event && event.event_type === "delivery_status" && text(payload.status, 80).toLowerCase() === "failed") {
    const retryable = payload.retryable !== false;
    return { findings: [findingFor(event, payload, {
      category: "message_not_delivered",
      severity: "critical",
      title: "Meta reportó entrega fallida",
      detail: "El proveedor confirmó que un mensaje saliente no fue entregado.",
      recommendation: retryable
        ? "Conservar el reintento seguro y escalar a una persona si el fallo se repite."
        : "Pasar la conversación a una persona mientras se aprueba la corrección permanente.",
      requires_approval: !retryable,
      safe_action: retryable ? "durable_retry" : "human_attention",
      evidence: { provider: "meta", error_code: text(payload.error_code, 80) || null, retryable }
    })], resolves_handoff: false, resolve_categories: [] };
  }
  if (event && event.event_type === "delivery_status" && ["sent", "delivered", "read"].includes(text(payload.status, 80).toLowerCase())) {
    return { findings: [], resolves_handoff: false, resolve_categories: ["message_not_delivered"] };
  }
  if (event && event.event_type === "provider_error") {
    const retryable = payload.retryable !== false;
    return { findings: [findingFor(event, payload, {
      category: "provider_error",
      severity: "critical",
      title: "Error del proveedor del bot",
      detail: "El proveedor " + (text(payload.provider, 80) || "externo") + " falló durante una operación del bot.",
      recommendation: retryable
        ? "Reintentar de forma segura y vigilar recuperación."
        : "Usar fallback o atención humana hasta aprobar la corrección permanente.",
      requires_approval: !retryable,
      safe_action: retryable ? "safe_retry" : "human_attention",
      evidence: { provider: text(payload.provider, 80), error_type: text(payload.error_type, 120), retryable }
    })], resolves_handoff: false, resolve_categories: [] };
  }
  if (event && event.event_type === "inbound_processing_failure") {
    const retryable = payload.retryable !== false;
    return { findings: [findingFor(event, payload, {
      category: "message_not_registered",
      severity: retryable ? "attention" : "critical",
      scope: "conversation",
      title: "Mensaje entrante no registrado o procesado",
      detail: "El inbox durable no pudo completar el registro/procesamiento del mensaje entrante.",
      recommendation: retryable
        ? "Mantener el requeue seguro y confirmar la recuperación en la siguiente revisión."
        : "Escalar a atención humana y aprobar la corrección permanente antes de reactivar.",
      requires_approval: !retryable,
      safe_action: retryable ? "durable_retry" : "human_attention",
      evidence: { retryable, error_type: text(payload.error_type, 120) }
    })], resolves_handoff: false, resolve_categories: [] };
  }
  if (event && event.event_type === "appointment_result") {
    const failed = payload.ok === false || ["failed", "pending", "error"].includes(text(payload.calendar_sync_status, 80).toLowerCase());
    if (failed) return { findings: [findingFor(event, payload, {
      category: "appointment_processing_failed",
      severity: "critical",
      title: "Procesamiento de cita incompleto",
      detail: "Appointment no confirmó la operación o su sincronización de calendario.",
      recommendation: "Reintentar solo la sincronización segura y derivar a atención humana si no se recupera.",
      safe_action: "human_attention",
      evidence: { calendar_sync_status: text(payload.calendar_sync_status, 80) || "unknown" }
    })], resolves_handoff: false, resolve_categories: [] };
  }
  return { findings: [], resolves_handoff: false, resolve_categories: [] };
}

class InMemoryBotOpsStore {
  constructor(options) {
    options = options || {};
    this.clock = options.clock || function () { return new Date(); };
    this.events = [];
    this.eventIds = new Set();
    this.runs = [];
    this.findings = new Map();
    this.cursors = { daily: 0, weekly: 0 };
    this.sequence = 0;
  }

  async assertReady() { return true; }

  async appendEvent(event) {
    if (!event || !event.event_id || this.eventIds.has(event.event_id)) return false;
    const row = Object.assign({}, event, { seq: ++this.sequence, occurred_at: iso(event.occurred_at, this.clock().toISOString()) });
    this.events.push(row);
    this.eventIds.add(row.event_id);
    return true;
  }

  async claim(kind, scheduleKey, owner) {
    const existing = this.runs.find(function (run) { return run.review_type === kind && run.schedule_key === scheduleKey; });
    if (existing && ["running", "completed"].includes(existing.status)) return null;
    const run = existing || {
      id: crypto.randomUUID(), review_type: kind, schedule_key: scheduleKey,
      created_at: this.clock().toISOString()
    };
    Object.assign(run, {
      status: "running", owner, started_at: this.clock().toISOString(),
      cursor_start: this.cursors[kind] || 0, cursor_end: this.cursors[kind] || 0
    });
    if (!existing) this.runs.push(run);
    return Object.assign({}, run);
  }

  async listEventsAfter(cursor, limit) {
    return this.events.filter(function (event) { return event.seq > Number(cursor || 0); }).slice(0, limit || 500).map(function (event) { return Object.assign({}, event); });
  }

  async upsertFinding(input, runId) {
    const previous = this.findings.get(input.dedupe_key);
    const now = input.occurred_at || this.clock().toISOString();
    const row = Object.assign({}, previous || {}, input, {
      id: previous && previous.id || crypto.randomUUID(),
      run_id: runId,
      first_seen_at: previous && previous.first_seen_at || now,
      last_seen_at: now,
      occurrence_count: Number(previous && previous.occurrence_count || 0) + 1,
      status: previous && previous.status === "resolved" ? input.status : (input.status || previous && previous.status || "open"),
      updated_at: this.clock().toISOString()
    });
    this.findings.set(row.dedupe_key, row);
    return Object.assign({}, row);
  }

  async resolveHandoff(tenantId, conversationKey, resolvedAt) {
    return this.resolveCategories(tenantId, conversationKey, ["handoff_pending", "failed_or_missed_handoff"], resolvedAt);
  }

  async resolveCategories(tenantId, conversationKey, categories, resolvedAt) {
    let count = 0;
    for (const row of this.findings.values()) {
      if (row.tenant_id === tenantId && row.conversation_key === conversationKey && categories.includes(row.category) && OPEN_STATUSES.has(row.status)) {
        row.status = "resolved";
        row.resolved_at = resolvedAt || this.clock().toISOString();
        row.updated_at = this.clock().toISOString();
        count++;
      }
    }
    return count;
  }

  async listFindings(options) {
    options = options || {};
    return Array.from(this.findings.values()).filter(function (row) {
      if (options.openOnly && !OPEN_STATUSES.has(row.status)) return false;
      if (options.since && Date.parse(row.last_seen_at) < Date.parse(options.since)) return false;
      return true;
    }).map(function (row) { return Object.assign({}, row); });
  }

  async completeRun(runId, input) {
    const run = this.runs.find(function (row) { return row.id === runId; });
    if (!run) throw new Error("bot_ops_run_not_found");
    Object.assign(run, input, { status: "completed", completed_at: this.clock().toISOString() });
    this.cursors[run.review_type] = Math.max(this.cursors[run.review_type] || 0, Number(input.cursor_end || 0));
    return Object.assign({}, run);
  }

  async failRun(runId, error) {
    const run = this.runs.find(function (row) { return row.id === runId; });
    if (run) Object.assign(run, { status: "failed", error: text(error && error.message || error, 500), completed_at: this.clock().toISOString() });
  }

  async snapshot() {
    const findings = await this.listFindings({});
    const open = findings.filter(function (row) { return OPEN_STATUSES.has(row.status); });
    const latest = function (kind) {
      return this.runs.filter(function (run) { return run.review_type === kind && run.status === "completed"; }).sort(function (a, b) {
        return Date.parse(b.completed_at) - Date.parse(a.completed_at);
      })[0] || null;
    }.bind(this);
    const daily = latest("daily");
    const weekly = latest("weekly");
    const lastUpdated = [daily && daily.completed_at, weekly && weekly.completed_at].filter(Boolean).sort().reverse()[0] || null;
    return buildSnapshot(open, daily, weekly, lastUpdated, true);
  }
}

class SupabaseBotOpsStore {
  constructor(options) {
    options = options || {};
    this.url = String(options.url || "").replace(/\/$/, "");
    this.headers = Object.assign({}, options.headers || {});
    this.http = options.axiosClient;
    this.encrypt = options.encrypt;
    this.decrypt = options.decrypt;
    if (!this.url || !this.http || !this.encrypt || !this.decrypt) throw new Error("bot_ops_store_not_configured");
  }

  async assertReady() {
    const response = await this.http.post(this.url + "/rest/v1/rpc/bot_ops_storage_ready_v1", {}, { headers: this.headers, timeout: 8000 });
    if (response.data !== true) throw new Error("bot_ops_storage_unavailable");
    return true;
  }

  async appendEvent(event) {
    const payload = {
      event_id: event.event_id,
      tenant_id: event.tenant_id,
      bot_id: event.bot_id,
      channel: event.channel,
      event_type: event.event_type,
      conversation_key: event.conversation_key || null,
      source_id: event.source_id || null,
      occurred_at: event.occurred_at,
      payload_ciphertext: this.encrypt(JSON.stringify(event.payload || {}))
    };
    await this.http.post(this.url + "/rest/v1/bot_ops_events?on_conflict=event_id", payload, {
      headers: Object.assign({}, this.headers, { Prefer: "resolution=ignore-duplicates,return=minimal" }), timeout: 8000
    });
    return true;
  }

  async claim(kind, scheduleKey, owner) {
    const response = await this.http.post(this.url + "/rest/v1/rpc/claim_bot_ops_review_v1", {
      p_review_type: kind, p_schedule_key: scheduleKey, p_owner: owner, p_lease_seconds: 900
    }, { headers: this.headers, timeout: 10000 });
    const row = Array.isArray(response.data) ? response.data[0] : response.data;
    return row && row.id ? row : null;
  }

  async listEventsAfter(cursor, limit) {
    const response = await this.http.get(this.url + "/rest/v1/bot_ops_events", {
      params: { select: "*", seq: "gt." + Number(cursor || 0), order: "seq.asc", limit: limit || 500 },
      headers: this.headers, timeout: 10000
    });
    return (Array.isArray(response.data) ? response.data : []).map(function (row) {
      let payload = {};
      try { payload = JSON.parse(this.decrypt(row.payload_ciphertext)); }
      catch (error) { error.botOpsEventId = row.event_id; throw error; }
      return Object.assign({}, row, { payload });
    }, this);
  }

  async upsertFinding(input, runId) {
    const response = await this.http.post(this.url + "/rest/v1/rpc/upsert_bot_ops_finding_v1", {
      p_finding: Object.assign({}, input, { run_id: runId })
    }, { headers: this.headers, timeout: 10000 });
    return Array.isArray(response.data) ? response.data[0] : response.data;
  }

  async resolveHandoff(tenantId, conversationKey, resolvedAt) {
    return this.resolveCategories(tenantId, conversationKey, ["handoff_pending", "failed_or_missed_handoff"], resolvedAt);
  }

  async resolveCategories(tenantId, conversationKey, categories, resolvedAt) {
    const response = await this.http.patch(this.url + "/rest/v1/bot_ops_findings", {
      status: "resolved", resolved_at: resolvedAt, updated_at: resolvedAt
    }, {
      params: { tenant_id: "eq." + tenantId, conversation_key: "eq." + conversationKey, category: "in.(" + categories.join(",") + ")", status: "in.(open,approval_pending)" },
      headers: Object.assign({}, this.headers, { Prefer: "return=representation" }), timeout: 8000
    });
    return Array.isArray(response.data) ? response.data.length : 0;
  }

  async listFindings(options) {
    options = options || {};
    const params = { select: "*", order: "last_seen_at.desc", limit: options.limit || 1000 };
    if (options.openOnly) params.status = "in.(open,approval_pending)";
    if (options.since) params.last_seen_at = "gte." + options.since;
    const response = await this.http.get(this.url + "/rest/v1/bot_ops_findings", { params, headers: this.headers, timeout: 10000 });
    return Array.isArray(response.data) ? response.data : [];
  }

  async completeRun(runId, input) {
    const response = await this.http.post(this.url + "/rest/v1/rpc/complete_bot_ops_review_v1", {
      p_run_id: runId,
      p_cursor_end: Number(input.cursor_end || 0),
      p_overall_status: input.overall_status,
      p_summary: input.summary || {},
      p_counts: input.counts || {}
    }, { headers: this.headers, timeout: 10000 });
    return Array.isArray(response.data) ? response.data[0] : response.data;
  }

  async failRun(runId, error) {
    await this.http.patch(this.url + "/rest/v1/bot_ops_runs", {
      status: "failed", error: text(error && error.message || error, 500), completed_at: new Date().toISOString(), lease_until: null
    }, {
      params: { id: "eq." + runId }, headers: Object.assign({}, this.headers, { Prefer: "return=minimal" }), timeout: 8000
    });
  }

  async latestRun(kind) {
    const response = await this.http.get(this.url + "/rest/v1/bot_ops_runs", {
      params: { select: "*", review_type: "eq." + kind, status: "eq.completed", order: "completed_at.desc", limit: 1 },
      headers: this.headers, timeout: 8000
    });
    return Array.isArray(response.data) ? response.data[0] || null : null;
  }

  async snapshot() {
    await this.assertReady();
    const results = await Promise.all([this.listFindings({ openOnly: true, limit: 500 }), this.latestRun("daily"), this.latestRun("weekly")]);
    const lastUpdated = [results[1] && results[1].completed_at, results[2] && results[2].completed_at].filter(Boolean).sort().reverse()[0] || null;
    return buildSnapshot(results[0], results[1], results[2], lastUpdated, true);
  }
}

function publicFinding(row) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    bot_id: row.bot_id,
    channel: row.channel,
    category: row.category,
    severity: row.severity,
    status: row.status,
    title: row.title,
    detail: row.detail,
    recommendation: row.recommendation,
    requires_approval: row.requires_approval === true,
    // Sin esto el Super Admin ve "un cliente reporto algo" y no puede ubicar
    // que conversacion fue. Campo aditivo: nadie que ya consumia esto se rompe.
    conversation_key: row.conversation_key || null,
    first_seen_at: row.first_seen_at,
    last_seen_at: row.last_seen_at,
    occurrence_count: Number(row.occurrence_count || 1)
  };
}

function buildSnapshot(openFindings, daily, weekly, lastUpdated, storageReady) {
  const publicOpen = (openFindings || []).map(publicFinding);
  return {
    ok: true,
    storage_ready: storageReady === true,
    overall_status: severityStatus(publicOpen),
    last_daily_review: daily && daily.completed_at || null,
    last_weekly_review: weekly && weekly.completed_at || null,
    last_updated: lastUpdated || null,
    counts: {
      open_incidents: publicOpen.filter(function (row) { return row.severity !== "opportunity"; }).length,
      improvement_opportunities: publicOpen.filter(function (row) { return row.severity === "opportunity" || row.category === "weak_or_incorrect_response"; }).length,
      pending_approvals: publicOpen.filter(function (row) { return row.requires_approval || row.status === "approval_pending"; }).length
    },
    open_incidents: publicOpen.filter(function (row) { return row.severity !== "opportunity"; }).slice(0, 100),
    improvement_opportunities: publicOpen.filter(function (row) { return row.severity === "opportunity" || row.category === "weak_or_incorrect_response"; }).slice(0, 100),
    pending_approvals: publicOpen.filter(function (row) { return row.requires_approval || row.status === "approval_pending"; }).slice(0, 100),
    daily_report: daily && daily.summary || null,
    weekly_report: weekly && weekly.summary || null,
    guardrails: {
      automatic_prompt_changes: false,
      automatic_bot_configuration_changes: false,
      automatic_production_code_changes: false,
      automatic_tenant_ownership_changes: false,
      automatic_customer_data_changes: false,
      safe_actions_only: true
    }
  };
}

function scheduleParts(now, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(now).reduce(function (result, part) {
    result[part.type] = part.value;
    return result;
  }, {});
  return {
    date: [parts.year, parts.month, parts.day].join("-"),
    weekday: parts.weekday,
    minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute)
  };
}

function weeklyPatterns(findings) {
  const patterns = new Map();
  for (const row of findings || []) {
    const key = [row.tenant_id, row.bot_id, row.channel, row.category].join(":");
    const previous = patterns.get(key) || {
      tenant_id: row.tenant_id, bot_id: row.bot_id, channel: row.channel, category: row.category,
      severity: row.severity, impact: 0, occurrences: 0, open: 0, resolved: 0,
      recommendation: row.recommendation
    };
    previous.occurrences += Number(row.occurrence_count || 1);
    previous.impact += SEVERITY_ORDER[row.severity] || 1;
    if (OPEN_STATUSES.has(row.status)) previous.open++;
    else previous.resolved++;
    if ((SEVERITY_ORDER[row.severity] || 1) > (SEVERITY_ORDER[previous.severity] || 1)) previous.severity = row.severity;
    patterns.set(key, previous);
  }
  return Array.from(patterns.values()).map(function (pattern) {
    return Object.assign(pattern, {
      priority: pattern.severity === "critical" ? "high" : pattern.severity === "attention" ? "medium" : "low",
      repeated: pattern.occurrences > 1,
      resolution: pattern.open > 0 ? (pattern.resolved > 0 ? "repeated_after_resolution" : "open") : "resolved"
    });
  }).sort(function (a, b) { return b.impact - a.impact || b.occurrences - a.occurrences; }).slice(0, 100);
}

function createBotOpsService(options) {
  options = options || {};
  const store = options.store;
  const clock = options.clock || function () { return new Date(); };
  const owner = text(options.owner, 200) || "bot-ops:" + crypto.randomUUID();
  const notifyCritical = typeof options.notifyCritical === "function" ? options.notifyCritical : async function () { return { skipped: true }; };
  const safeAction = typeof options.safeAction === "function" ? options.safeAction : async function () { return { skipped: true }; };
  const deepAnalyze = typeof options.deepAnalyze === "function" ? options.deepAnalyze : null;
  const deepReviewLimit = Math.max(0, Math.min(25, Number(options.deepReviewLimit) || 8));
  const log = typeof options.log === "function" ? options.log : function () {};
  const timeZone = options.timeZone || "America/Bogota";
  const dailyMinute = Number.isFinite(Number(options.dailyMinute)) ? Number(options.dailyMinute) : 360;
  const weeklyMinute = Number.isFinite(Number(options.weeklyMinute)) ? Number(options.weeklyMinute) : 390;
  const handoffMaxAgeMs = Math.max(60 * 1000, Number(options.handoffMaxAgeMs) || 15 * 60 * 1000);

  if (!store) throw new Error("bot_ops_store_required");

  async function recordEvent(input) {
    const tenantId = slug(input && input.tenant_id, "unknown-tenant");
    const channel = slug(input && input.channel, "unknown");
    const userId = text(input && input.user_id, 500);
    const sourceId = text(input && (input.source_id || input.source_event_id), 500);
    const eventType = slug(input && input.event_type, "unknown");
    const payload = Object.assign({}, input && input.payload || {});
    const eventId = text(input && input.event_id, 500) || "botops:" + hash([
      tenantId, channel, eventType, sourceId, JSON.stringify(payload)
    ].join("\u001f"));
    return store.appendEvent({
      event_id: eventId,
      tenant_id: tenantId,
      bot_id: botForEvent(input, payload),
      channel,
      event_type: eventType,
      conversation_key: userId ? hash(tenantId + "\u001f" + channel + "\u001f" + userId) : text(input && input.conversation_key, 80) || null,
      source_id: sourceId || null,
      occurred_at: iso(input && input.occurred_at, clock().toISOString()),
      payload
    });
  }

  async function runDaily(scheduleKey, trigger) {
    const run = await store.claim("daily", scheduleKey, owner);
    if (!run) return { ok: true, skipped: true, reason: "already_claimed", review_type: "daily", schedule_key: scheduleKey };
    let cursor = Number(run.cursor_start || 0);
    const touched = [];
    const eventsByTenant = {};
    let reviewed = 0;
    let deepReviewed = 0;
    try {
      while (true) {
        const batch = await store.listEventsAfter(cursor, 500);
        if (!batch.length) break;
        for (const event of batch) {
          reviewed++;
          cursor = Math.max(cursor, Number(event.seq || 0));
          eventsByTenant[event.tenant_id] = (eventsByTenant[event.tenant_id] || 0) + 1;
          const result = analyzeEvent(event);
          const deepCandidate = result.findings.some(function (finding) {
            return ["customer_dissatisfaction", "weak_or_incorrect_response", "incorrect_routing"].includes(finding.category);
          });
          if (deepAnalyze && deepCandidate && deepReviewed < deepReviewLimit && event.event_type === "turn") {
            try {
              const deep = await deepAnalyze(event, result.findings);
              deepReviewed++;
              if (deep && ["weak", "incorrect", "uncertain"].includes(deep.quality)) {
                const deepFinding = findingFor(event, event.payload || {}, {
                  category: "weak_or_incorrect_response",
                  severity: deep.priority === "high" ? "critical" : "attention",
                  scope: "conversation",
                  title: deep.quality === "incorrect" ? "Respuesta incorrecta confirmada por revisión profunda" : "Respuesta requiere revisión profunda",
                  detail: text(deep.reason, 500) || "La revisión profunda encontró un riesgo de calidad.",
                  recommendation: text(deep.recommendation, 500) || "Revisar y aprobar una mejora antes de cambiar el comportamiento del bot.",
                  requires_approval: true,
                  safe_action: deep.priority === "high" ? "human_attention" : null,
                  evidence: { analysis_tier: "deep_flagged_only", quality: deep.quality }
                });
                const existingQualityIndex = result.findings.findIndex(function (finding) {
                  return finding.category === "weak_or_incorrect_response";
                });
                if (existingQualityIndex >= 0) result.findings[existingQualityIndex] = deepFinding;
                else result.findings.push(deepFinding);
              }
            } catch (error) {
              log("warn", "bot_ops_deep_review_failed", { error: text(error && error.message, 200) });
            }
          }
          if (result.resolves_handoff && event.conversation_key) {
            await store.resolveHandoff(event.tenant_id, event.conversation_key, event.occurred_at || clock().toISOString());
          }
          if (event.conversation_key && result.resolve_categories && result.resolve_categories.length && typeof store.resolveCategories === "function") {
            await store.resolveCategories(event.tenant_id, event.conversation_key, result.resolve_categories, event.occurred_at || clock().toISOString());
          }
          for (const candidate of result.findings) {
            const saved = await store.upsertFinding(candidate, run.id);
            touched.push(saved || candidate);
            if (candidate.safe_action) {
              await safeAction(candidate.safe_action, { finding: saved || candidate, event }).catch(function (error) {
                log("warn", "bot_ops_safe_action_failed", { action: candidate.safe_action, error: text(error && error.message, 200) });
              });
            }
          }
        }
        if (batch.length < 500) break;
      }
      let open = await store.listFindings({ openOnly: true, limit: 2000 });
      const existingMissedHandoffs = new Set(open.filter(function (row) {
        return row.category === "failed_or_missed_handoff";
      }).map(function (row) { return row.tenant_id + ":" + row.conversation_key; }));
      for (const pending of open.filter(function (row) {
        return row.category === "handoff_pending" && row.conversation_key &&
          clock().getTime() - Date.parse(row.last_seen_at || row.first_seen_at || "") >= handoffMaxAgeMs;
      })) {
        const missedKey = pending.tenant_id + ":" + pending.conversation_key;
        if (existingMissedHandoffs.has(missedKey)) continue;
        const missed = findingFor({
          event_id: "flagged-handoff:" + pending.id,
          tenant_id: pending.tenant_id,
          bot_id: pending.bot_id,
          channel: pending.channel,
          conversation_key: pending.conversation_key,
          event_type: "flagged_handoff",
          occurred_at: clock().toISOString()
        }, {}, {
          category: "failed_or_missed_handoff",
          severity: "critical",
          scope: "conversation",
          title: "Handoff humano vencido",
          detail: "La conversación sigue pendiente después del tiempo máximo de atención.",
          recommendation: "Asignar atención humana inmediata y revisar por qué el handoff no fue atendido.",
          safe_action: "human_attention"
        });
        const savedMissed = await store.upsertFinding(missed, run.id);
        touched.push(savedMissed || missed);
        existingMissedHandoffs.add(missedKey);
      }
      open = await store.listFindings({ openOnly: true, limit: 2000 });
      const critical = touched.filter(function (row) { return row.severity === "critical" && OPEN_STATUSES.has(row.status || "open"); });
      const summary = {
        review_type: "daily",
        trigger: text(trigger, 80) || "scheduler",
        schedule_key: scheduleKey,
        reviewed_events: reviewed,
        new_or_repeated_findings: touched.length,
        critical_findings: critical.length,
        deep_reviews: deepReviewed,
        affected_companies: Object.keys(eventsByTenant).sort(),
        per_company_event_counts: eventsByTenant,
        analysis_tier: deepReviewed ? "light_rules_plus_flagged_deep_review" : "light_rules",
        full_history_scanned: false,
        guardrails_respected: true
      };
      const overallStatus = severityStatus(open);
      const completed = await store.completeRun(run.id, {
        cursor_end: cursor, overall_status: overallStatus, summary,
        counts: { reviewed_events: reviewed, findings: touched.length, critical: critical.length }
      });
      if (critical.length) {
        await notifyCritical({ run: completed || run, findings: critical.map(publicFinding), summary }).catch(function (error) {
          log("error", "bot_ops_critical_alert_failed", { error: text(error && error.message, 200) });
        });
      }
      return { ok: true, review_type: "daily", run: completed || run, summary, overall_status: overallStatus };
    } catch (error) {
      await store.failRun(run.id, error).catch(function () {});
      throw error;
    }
  }

  async function runWeekly(scheduleKey, trigger) {
    const run = await store.claim("weekly", scheduleKey, owner);
    if (!run) return { ok: true, skipped: true, reason: "already_claimed", review_type: "weekly", schedule_key: scheduleKey };
    try {
      const since = new Date(clock().getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const findings = await store.listFindings({ since, limit: 5000 });
      const patterns = weeklyPatterns(findings);
      const open = await store.listFindings({ openOnly: true, limit: 2000 });
      const summary = {
        review_type: "weekly",
        trigger: text(trigger, 80) || "scheduler",
        schedule_key: scheduleKey,
        window_started_at: since,
        patterns,
        affected_companies: Array.from(new Set(patterns.map(function (row) { return row.tenant_id; }))).sort(),
        repeated_patterns: patterns.filter(function (row) { return row.repeated; }).length,
        resolved_patterns: patterns.filter(function (row) { return row.resolution === "resolved"; }).length,
        full_conversation_history_scanned: false,
        source: "bot_ops_findings"
      };
      const overallStatus = severityStatus(open);
      const completed = await store.completeRun(run.id, {
        cursor_end: Number(run.cursor_start || 0), overall_status: overallStatus, summary,
        counts: { patterns: patterns.length, repeated: summary.repeated_patterns, resolved: summary.resolved_patterns }
      });
      return { ok: true, review_type: "weekly", run: completed || run, summary, overall_status: overallStatus };
    } catch (error) {
      await store.failRun(run.id, error).catch(function () {});
      throw error;
    }
  }

  async function runDue(now, trigger) {
    const date = now instanceof Date ? now : clock();
    const parts = scheduleParts(date, timeZone);
    const results = [];
    if (parts.minuteOfDay >= dailyMinute) results.push(await runDaily(parts.date, trigger || "due_scheduler"));
    if (parts.weekday === "Mon" && parts.minuteOfDay >= weeklyMinute) results.push(await runWeekly(parts.date, trigger || "due_scheduler"));
    return { ok: true, checked_at: date.toISOString(), time_zone: timeZone, results };
  }

  // Reporte manual que hace el cliente desde el Customer Panel.
  // No pasa por el analizador diario a proposito: si alguien se toma el trabajo
  // de reportar un bug, tiene que aparecer en la bandeja de operacion en el
  // momento, no 24 horas despues.
  //
  // El evento se guarda siempre; el finding es lo que le da visibilidad
  // inmediata al Super Admin. Si la escritura del finding falla (por ejemplo
  // porque la base exige run_id), el reporte NO se pierde: queda como evento y
  // la corrida diaria lo recoge. Por eso el evento va primero.
  async function reportIssue(input) {
    input = input || {};
    const tenantId = slug(input.tenant_id, "unknown-tenant");
    const channel = slug(input.channel, "unknown");
    const botId = slug(input.bot_id, "unknown-bot");
    const conversationKey = text(input.conversation_key, 80) || null;
    const reason = slug(input.reason, "otro");
    const note = text(input.note, 1000);
    const reportedBy = text(input.reported_by, 200);
    const occurredAt = iso(input.occurred_at, clock().toISOString());
    const evidence = {
      source_type: "customer_report",
      analysis_tier: "customer_reported",
      reason,
      note,
      reported_by: reportedBy,
      bot_version: text(input.bot_version, 120),
      customer_message: text(input.customer_message, 500),
      bot_reply: text(input.bot_reply, 500)
    };

    const event = await recordEvent({
      tenant_id: tenantId,
      channel,
      event_type: "customer_bug_report",
      conversation_key: conversationKey,
      occurred_at: occurredAt,
      payload: Object.assign({ bot_id: botId }, evidence)
    }).catch(function (error) {
      log("bot-ops customer report event failed", error && error.message);
      return null;
    });

    const finding = {
      dedupe_key: [tenantId, botId, channel, "customer_reported", conversationKey || hash(reason + occurredAt), reason].join(":"),
      tenant_id: tenantId,
      bot_id: botId,
      channel,
      category: "customer_reported",
      severity: "attention",
      status: "open",
      title: text(REPORT_REASON_TITLES[reason] || REPORT_REASON_TITLES.otro, 180),
      detail: note || "El cliente reporto una falla del bot desde el Customer Panel sin detalle adicional.",
      recommendation: "Revisar la conversacion reportada y confirmarle al cliente que se corrigio.",
      requires_approval: false,
      conversation_key: conversationKey,
      source_event_id: event && event.event_id || null,
      occurred_at: occurredAt,
      evidence,
      safe_action: "human_attention"
    };

    let stored = null;
    let findingError = null;
    try {
      stored = await store.upsertFinding(finding, null);
    } catch (error) {
      findingError = error && error.message || "finding_write_failed";
      log("bot-ops customer report finding failed", findingError);
    }

    return {
      ok: !!(event || stored),
      event_recorded: !!event,
      finding_recorded: !!stored,
      finding_error: findingError,
      finding: stored || null
    };
  }

  return {
    assertReady: function () { return store.assertReady(); },
    recordEvent,
    reportIssue,
    runDaily,
    runWeekly,
    runDue,
    snapshot: function () { return store.snapshot(); },
    schedule: { time_zone: timeZone, daily_minute: dailyMinute, weekly_minute: weeklyMinute }
  };
}

function createResendBotOpsNotifier(options) {
  options = options || {};
  const apiKey = text(options.apiKey, 500);
  const from = text(options.from, 320);
  const recipients = (Array.isArray(options.to) ? options.to : String(options.to || "").split(","))
    .map(function (value) { return text(value, 320).toLowerCase(); })
    .filter(function (value, index, values) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && values.indexOf(value) === index; });
  const http = options.axiosClient;
  const baseUrl = String(options.baseUrl || "").replace(/\/$/, "");
  return async function notifyCritical(input) {
    if (!apiKey || !from || !recipients.length || !http) return { skipped: true, reason: "email_not_configured" };
    const findings = input.findings || [];
    const companies = Array.from(new Set(findings.map(function (finding) { return finding.tenant_id; }))).sort();
    const lines = findings.slice(0, 12).map(function (finding) {
      return "- " + finding.tenant_id + " · " + finding.bot_id + " · " + finding.channel + ": " + finding.title;
    });
    const reportUrl = baseUrl ? baseUrl + "/admin/super-admin?view=botOps" : "";
    const body = [
      "Bot Ops detectó " + findings.length + " incidente(s) crítico(s).",
      "Empresas afectadas: " + (companies.join(", ") || "sin identificar"),
      "",
      lines.join("\n"),
      reportUrl ? "\nAbrir Super Admin: " + reportUrl : "",
      "",
      "Las protecciones automáticas se limitan a reintentos seguros y atención humana; no se modificaron prompts, configuración ni datos de clientes."
    ].filter(Boolean).join("\n");
    const response = await http.post("https://api.resend.com/emails", {
      from,
      to: recipients,
      subject: "[Critical] Nextfor Bot Ops requiere atención",
      text: body
    }, { headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" }, timeout: 8000 });
    return { id: response.data && response.data.id || null, recipients: recipients.length };
  };
}

module.exports = {
  InMemoryBotOpsStore,
  STATUS,
  SupabaseBotOpsStore,
  analyzeEvent,
  buildSnapshot,
  createBotOpsService,
  createResendBotOpsNotifier,
  dissatisfactionDetected,
  scheduleParts,
  severityStatus,
  weeklyPatterns
};
