"use strict";

const APPOINTMENT_STATUSES = new Set([
  "booked",
  "requested",
  "failed",
  "cancelled",
  "rescheduled",
  "not_requested"
]);

const APPOINTMENT_REMINDER_STATES = new Set([
  "not_scheduled",
  "programmed",
  "sending",
  "sent",
  "delivered",
  "read",
  "confirmed",
  "retrying",
  "no_response",
  "paused",
  "failed",
  "cancelled",
  "blocked"
]);
const DEPOSIT_STATUSES = new Set(["not_required", "pending", "customer_reported_paid", "verified"]);

function cleanText(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max || 500);
}

function cleanStatus(value) {
  const status = cleanText(value, 40).toLowerCase().replace(/[\s-]+/g, "_");
  return APPOINTMENT_STATUSES.has(status) ? status : "not_requested";
}

function cleanDepositStatus(value) {
  const status = cleanText(value, 40).toLowerCase().replace(/[\s-]+/g, "_");
  return DEPOSIT_STATUSES.has(status) ? status : "not_required";
}

function cleanReminderState(value) {
  if (value && typeof value === "object") value = value.status || value.state || value.delivery_status;
  const state = cleanText(value, 40).toLowerCase().replace(/[\s-]+/g, "_");
  const aliases = {
    scheduled: "programmed",
    pending: "programmed",
    queued: "programmed",
    acknowledged: "confirmed",
    canceled: "cancelled",
    blocked_template: "blocked"
  };
  const normalized = aliases[state] || state;
  return APPOINTMENT_REMINDER_STATES.has(normalized) ? normalized : "not_scheduled";
}

function cleanNonNegativeInteger(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number >= 0 ? number : (fallback == null ? 0 : fallback);
}

function normalizeReminderDelivery(input, index) {
  input = input || {};
  const status = cleanReminderState(input.status || input.delivery_status || input.state);
  const normalized = {
    id: cleanText(input.id || input.reminder_id, 160) || "delivery_" + String(index + 1),
    channel: cleanText(input.channel, 40).toLowerCase(),
    status,
    attempt: cleanNonNegativeInteger(input.attempt != null ? input.attempt : input.attempts, 0)
  };
  const scheduledFor = validIsoDate(input.scheduled_for || input.scheduled_at);
  if (scheduledFor) normalized.scheduled_for = scheduledFor;
  const sentAt = validIsoDate(input.sent_at);
  if (sentAt) normalized.sent_at = sentAt;
  const deliveredAt = validIsoDate(input.delivered_at);
  if (deliveredAt) normalized.delivered_at = deliveredAt;
  const readAt = validIsoDate(input.read_at);
  if (readAt) normalized.read_at = readAt;
  const confirmedAt = validIsoDate(input.confirmed_at);
  if (confirmedAt) normalized.confirmed_at = confirmedAt;
  const providerMessageId = cleanText(input.provider_message_id, 300);
  if (providerMessageId) normalized.provider_message_id = providerMessageId;
  const lastError = cleanText(input.last_error || input.error, 800);
  if (lastError) normalized.last_error = lastError;
  return normalized;
}

function normalizeReminderDeliveries(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).map(normalizeReminderDelivery);
}

function appointmentIdFromInput(input) {
  input = input || {};
  return cleanText(input.appointment_id || input.id || input.conversation_id, 160);
}

function validIsoDate(value) {
  const text = cleanText(value, 80);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function validAppointmentAction(value) {
  const action = cleanText(value, 40).toLowerCase().replace(/[\s-]+/g, "_");
  return ["confirm", "cancel", "reprogram"].includes(action) ? action : "";
}

function cleanAppointmentActionStatus(value) {
  const status = cleanText(value, 60).toLowerCase().replace(/[\s-]+/g, "_");
  return ["queued", "saved", "applied", "synced", "pending", "failed", "not_required"].includes(status) ? status : "";
}

function cleanDurationMinutes(value) {
  const minutes = Math.round(Number(value));
  return Number.isFinite(minutes) && minutes >= 5 && minutes <= 24 * 60 ? minutes : 60;
}

function cleanBookingFields(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const result = {};
  Object.keys(source).slice(0, 60).forEach(function (key) {
    const cleanKey = cleanText(key, 80).toLowerCase().replace(/[^a-z0-9_]/g, "");
    const cleanValue = cleanText(source[key], 2000);
    if (cleanKey && cleanValue) result[cleanKey] = cleanValue;
  });
  return result;
}

function appointmentCustomerPhone(channel, conversationIdentity, requestedPhone) {
  if (cleanText(channel, 40).toLowerCase() === "whatsapp") {
    const channelDigits = cleanText(conversationIdentity, 100)
      .replace(/^wa:/i, "")
      .replace(/\D/g, "");
    if (channelDigits.length >= 8 && channelDigits.length <= 15) return "+" + channelDigits;
  }
  return cleanText(requestedPhone, 80);
}

function cleanReminderDeliveries(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const result = {};
  ["24h", "6h"].forEach(function (offset) {
    const row = source[offset];
    if (!row || typeof row !== "object" || Array.isArray(row)) return;
    const status = cleanText(row.status, 60).toLowerCase().replace(/[\s-]+/g, "_");
    if (!status) return;
    result[offset] = {
      status,
      offset,
      due_at: validIsoDate(row.due_at),
      sent_at: validIsoDate(row.sent_at),
      next_attempt_at: validIsoDate(row.next_attempt_at),
      updated_at: validIsoDate(row.updated_at),
      attempts: Math.max(0, Math.min(10, Math.round(Number(row.attempts) || 0))),
      provider_id: cleanText(row.provider_id, 200),
      error: cleanText(row.error, 240)
    };
  });
  return result;
}

function cleanConfirmationDelivery(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const status = cleanText(source.status, 40).toLowerCase().replace(/[\s-]+/g, "_");
  if (!["sending", "delivered", "retrying", "failed"].includes(status)) return null;
  return {
    status,
    attempts: Math.max(0, Math.min(10, Math.round(Number(source.attempts) || 0))),
    sent_at: validIsoDate(source.sent_at),
    delivered_at: validIsoDate(source.delivered_at),
    next_attempt_at: validIsoDate(source.next_attempt_at),
    updated_at: validIsoDate(source.updated_at),
    provider_id: cleanText(source.provider_id, 240),
    mode: cleanText(source.mode, 40),
    error: cleanText(source.error, 240)
  };
}

function analysisValue(collection, key) {
  const entry = collection && collection[key];
  if (entry == null) return "";
  if (typeof entry === "object" && Object.prototype.hasOwnProperty.call(entry, "value")) return entry.value;
  return entry;
}

function dataCollectionFromAnalysis(analysis) {
  analysis = analysis || {};
  return analysis.data_collection_results || analysis.data_collection || analysis.collected_data || {};
}

function transcriptSummary(analysis) {
  return cleanText(analysis && (analysis.transcript_summary || analysis.summary), 2000);
}

function appointmentFromElevenLabsEvent(event, tenantId, now) {
  if (!event || event.type !== "post_call_transcription" || !event.data) return null;
  const data = event.data;
  const conversationId = cleanText(data.conversation_id, 160);
  const agentId = cleanText(data.agent_id, 160);
  if (!conversationId || !agentId || !tenantId) return null;
  const collection = dataCollectionFromAnalysis(data.analysis);
  const createdAt = new Date((Number(event.event_timestamp) || Math.floor((now || Date.now()) / 1000)) * 1000).toISOString();
  const status = cleanStatus(analysisValue(collection, "appointment_status"));
  const appointmentId = cleanText(analysisValue(collection, "appointment_id"), 160) || conversationId;
  return {
    tenant_id: cleanText(tenantId, 80),
    appointment_id: appointmentId,
    conversation_id: conversationId,
    agent_id: agentId,
    status,
    starts_at: validIsoDate(analysisValue(collection, "appointment_datetime")),
    duration_minutes: cleanDurationMinutes(analysisValue(collection, "appointment_duration_minutes")),
    customer_name: cleanText(analysisValue(collection, "client_name"), 160),
    customer_phone: cleanText(analysisValue(collection, "client_phone"), 80),
    customer_email: cleanText(analysisValue(collection, "client_email"), 200).toLowerCase(),
    consultation_reason: cleanText(analysisValue(collection, "consultation_reason"), 1000),
    data_processing_consent: cleanText(analysisValue(collection, "data_processing_consent"), 40).toLowerCase() || "unclear",
    transcript_summary: transcriptSummary(data.analysis),
    source: "elevenlabs",
    channel: cleanText(data.metadata && (data.metadata.channel || data.metadata.type), 40) || "voice",
    created_at: createdAt,
    updated_at: createdAt
  };
}

function normalizeAppointment(input) {
  input = input || {};
  const conversationId = cleanText(input.conversation_id, 160);
  const appointmentId = appointmentIdFromInput(input);
  const tenantId = cleanText(input.tenant_id, 80);
  if (!appointmentId || !tenantId) return null;
  const normalized = {
    tenant_id: tenantId,
    appointment_id: appointmentId,
    // conversation_id is the historic appointment identifier. Keep it for
    // persisted rows and callers that have not migrated yet, but never use it
    // as the customer thread identifier.
    conversation_id: conversationId || appointmentId,
    agent_id: cleanText(input.agent_id, 160),
    status: cleanStatus(input.status),
    starts_at: validIsoDate(input.starts_at),
    duration_minutes: cleanDurationMinutes(input.duration_minutes),
    customer_name: cleanText(input.customer_name, 160),
    customer_phone: cleanText(input.customer_phone, 80),
    customer_email: cleanText(input.customer_email, 200).toLowerCase(),
    consultation_reason: cleanText(input.consultation_reason, 1000),
    data_processing_consent: cleanText(input.data_processing_consent, 40).toLowerCase() || "unclear",
    transcript_summary: cleanText(input.transcript_summary, 2000),
    source: cleanText(input.source, 40) || "elevenlabs",
    channel: cleanText(input.channel, 40) || "voice",
    created_at: validIsoDate(input.created_at) || new Date().toISOString(),
    updated_at: validIsoDate(input.updated_at) || new Date().toISOString()
  };
  const bookingFields = cleanBookingFields(input.booking_fields);
  if (Object.keys(bookingFields).length) normalized.booking_fields = bookingFields;
  if (Object.prototype.hasOwnProperty.call(input, "booking_requirements_version")) {
    normalized.booking_requirements_version = Math.max(1, Math.min(100, Math.round(Number(input.booking_requirements_version) || 1)));
  }
  if (Object.prototype.hasOwnProperty.call(input, "deposit_status")) {
    normalized.deposit_status = cleanDepositStatus(input.deposit_status);
  }
  const customerConversationId = cleanText(input.customer_conversation_id, 200);
  if (customerConversationId) normalized.customer_conversation_id = customerConversationId;
  if (Object.prototype.hasOwnProperty.call(input, "reminder_state")) {
    normalized.reminder_state = cleanReminderState(input.reminder_state);
  }
  if (Object.prototype.hasOwnProperty.call(input, "reminder_deliveries")) {
    normalized.reminder_deliveries = normalizeReminderDeliveries(input.reminder_deliveries);
  }
  const panelAction = validAppointmentAction(input.panel_action);
  if (panelAction) normalized.panel_action = panelAction;
  const panelActionStatus = cleanAppointmentActionStatus(input.panel_action_status);
  if (panelActionStatus) normalized.panel_action_status = panelActionStatus;
  const calendarSyncStatus = cleanAppointmentActionStatus(input.calendar_sync_status);
  if (calendarSyncStatus) normalized.calendar_sync_status = calendarSyncStatus;
  const panelActionAt = validIsoDate(input.panel_action_at);
  if (panelActionAt) normalized.panel_action_at = panelActionAt;
  const panelActionBy = cleanText(input.panel_action_by, 160);
  if (panelActionBy) normalized.panel_action_by = panelActionBy;
  const panelActionReason = cleanText(input.panel_action_reason, 1000);
  if (panelActionReason) normalized.panel_action_reason = panelActionReason;
  const panelActionMessage = cleanText(input.panel_action_message, 1000);
  if (panelActionMessage) normalized.panel_action_message = panelActionMessage;
  const calendarEventId = cleanText(input.calendar_event_id, 500);
  if (calendarEventId) normalized.calendar_event_id = calendarEventId;
  const calendarEventLink = cleanText(input.calendar_event_link, 1000);
  if (calendarEventLink) normalized.calendar_event_link = calendarEventLink;
  const calendarSyncedAt = validIsoDate(input.calendar_synced_at);
  if (calendarSyncedAt) normalized.calendar_synced_at = calendarSyncedAt;
  const calendarLastError = cleanText(input.calendar_last_error, 800);
  if (calendarLastError) normalized.calendar_last_error = calendarLastError;
  const reminderDeliveries = cleanReminderDeliveries(input.reminder_deliveries);
  if (Object.keys(reminderDeliveries).length) normalized.reminder_deliveries = reminderDeliveries;
  const confirmationDelivery = cleanConfirmationDelivery(input.confirmation_delivery);
  if (confirmationDelivery) normalized.confirmation_delivery = confirmationDelivery;
  return normalized;
}

class AppointmentRegistry {
  constructor(options) {
    this.rows = new Map();
    this.onUpsert = options && options.onUpsert;
  }

  key(row) {
    return row.tenant_id + ":" + row.appointment_id;
  }

  get(tenantId, appointmentId) {
    const cleanTenantId = cleanText(tenantId, 80);
    const cleanAppointmentId = cleanText(appointmentId, 160);
    if (!cleanTenantId || !cleanAppointmentId) return null;
    const direct = this.rows.get(cleanTenantId + ":" + cleanAppointmentId);
    if (direct) return direct;
    // Compatibility for rows persisted before appointment_id existed. The
    // fallback is tenant-scoped and only succeeds when it is unambiguous.
    const legacy = this.list(cleanTenantId).filter(function (row) {
      return row.conversation_id === cleanAppointmentId;
    });
    return legacy.length === 1 ? legacy[0] : null;
  }

  async upsert(input, persist) {
    const row = normalizeAppointment(input);
    if (!row) throw new Error("invalid_appointment");
    const key = this.key(row);
    const existing = this.rows.get(key);
    const merged = Object.assign({}, existing || {}, row, {
      created_at: existing && existing.created_at || row.created_at,
      updated_at: row.updated_at || new Date().toISOString()
    });
    this.rows.set(key, merged);
    if (persist !== false && typeof this.onUpsert === "function") await this.onUpsert(merged);
    return merged;
  }

  async ingestElevenLabs(event, tenantId) {
    const row = appointmentFromElevenLabsEvent(event, tenantId);
    if (!row) return null;
    return this.upsert(row, true);
  }

  hydrate(rows) {
    (rows || []).forEach(row => {
      const normalized = normalizeAppointment(row);
      if (normalized) this.rows.set(this.key(normalized), normalized);
    });
  }

  list(tenantId) {
    return Array.from(this.rows.values()).filter(row => row.tenant_id === tenantId).sort(function (a, b) {
      return new Date(b.starts_at || b.updated_at || 0) - new Date(a.starts_at || a.updated_at || 0);
    });
  }

  snapshot(tenantId, now) {
    const rows = this.list(tenantId);
    const current = now == null ? Date.now() : Number(now);
    const countedRequested = new Set(["booked", "requested", "failed", "cancelled", "rescheduled"]);
    const metrics = {
      interactions: rows.length,
      requested: rows.filter(row => countedRequested.has(row.status)).length,
      booked: rows.filter(row => row.status === "booked" || row.status === "rescheduled").length,
      pending: rows.filter(row => row.status === "requested").length,
      cancelled: rows.filter(row => row.status === "cancelled").length,
      failed: rows.filter(row => row.status === "failed").length
    };
    const upcoming = rows.filter(function (row) {
      return row.starts_at && new Date(row.starts_at).getTime() >= current && (row.status === "booked" || row.status === "rescheduled");
    }).sort(function (a, b) { return new Date(a.starts_at) - new Date(b.starts_at); });
    return { tenant_id: tenantId, metrics, appointments: rows.slice(0, 200), upcoming: upcoming.slice(0, 50) };
  }

  async applyPanelAction(tenantId, appointmentId, action, options) {
    const cleanTenantId = cleanText(tenantId, 80);
    const cleanAppointmentId = cleanText(appointmentId, 160);
    const cleanAction = validAppointmentAction(action);
    if (!cleanTenantId || !cleanAppointmentId || !cleanAction) throw new Error("invalid_appointment_action");
    const existing = this.get(cleanTenantId, cleanAppointmentId);
    if (!existing) throw new Error("appointment_not_found");
    const now = new Date().toISOString();
    const statusByAction = { confirm: "booked", cancel: "cancelled", reprogram: "requested" };
    const actionMessageByAction = {
      confirm: "Cita confirmada desde el panel Nextfor.",
      cancel: "Cita cancelada desde el panel Nextfor.",
      reprogram: "Reprogramación solicitada desde el panel Nextfor."
    };
    const row = Object.assign({}, existing, {
      status: statusByAction[cleanAction],
      panel_action: cleanAction,
      panel_action_status: cleanAction === "confirm" ? "saved" : "queued",
      panel_action_at: now,
      panel_action_by: cleanText(options && options.actor, 160),
      panel_action_reason: cleanText(options && options.reason, 1000),
      panel_action_message: cleanText(options && options.message, 1000) || actionMessageByAction[cleanAction],
      calendar_sync_status: cleanAction === "confirm" ? cleanText(existing.calendar_sync_status, 60) || "queued" : cleanText(existing.calendar_sync_status, 60) || "not_required",
      updated_at: now
    });
    return this.upsert(row, options && options.persist);
  }
}

module.exports = {
  APPOINTMENT_STATUSES,
  APPOINTMENT_REMINDER_STATES,
  AppointmentRegistry,
  appointmentFromElevenLabsEvent,
  appointmentIdFromInput,
  appointmentCustomerPhone,
  cleanBookingFields,
  cleanReminderState,
  cleanReminderDeliveries,
  normalizeAppointment,
  normalizeReminderDeliveries,
  validAppointmentAction
};
