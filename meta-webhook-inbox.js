"use strict";

const crypto = require("crypto");

// At the 30-minute capped backoff, 160 attempts are enough to keep a
// recoverable Meta outage (including billing code 131042) live for the full
// 72-hour inbox window. The age boundary remains the authoritative limit.
const MAX_EVENT_ATTEMPTS = 160;
const MAX_EVENT_AGE_MS = 72 * 60 * 60 * 1000;
const RECOVERABLE_INTERNAL_ERROR_PREFIX = "recoverable_internal:";

function text(value, maximum) {
  const clean = String(value || "").trim();
  return maximum ? clean.slice(0, maximum) : clean;
}

function eventIdentifier(destinationId, message) {
  const supplied = text(message && message.id, 500);
  if (supplied) return "whatsapp:" + supplied;
  // Message IDs are expected from Meta. The deterministic fallback keeps an
  // unusual malformed retry idempotent without storing sender content in the
  // primary key.
  return "whatsapp:sha256:" + crypto.createHash("sha256")
    .update(text(destinationId, 500) + ":" + JSON.stringify(message || {}))
    .digest("hex");
}

function statusEventIdentifier(destinationId, status) {
  const identity = {
    destination_id: text(destinationId, 500),
    message_id: text(status && status.id, 500),
    status: text(status && status.status, 80).toLowerCase(),
    timestamp: text(status && status.timestamp, 80),
    recipient_id: text(status && status.recipient_id, 500),
    errors: Array.isArray(status && status.errors) ? status.errors.map(function (error) {
      return {
        code: text(error && error.code, 80),
        error_subcode: text(error && error.error_subcode, 80)
      };
    }) : []
  };
  return "whatsapp:status:sha256:" + crypto.createHash("sha256")
    .update(JSON.stringify(identity))
    .digest("hex");
}

function echoEventIdentifier(destinationId, echo) {
  const supplied = text(echo && echo.id, 500);
  if (supplied) return "whatsapp:echo:" + supplied;
  return "whatsapp:echo:sha256:" + crypto.createHash("sha256")
    .update(text(destinationId, 500) + ":" + JSON.stringify(echo || {}))
    .digest("hex");
}

function eventOrderingIdentity(payload) {
  const messageSender = text(payload && payload.message && payload.message.from, 500);
  if (messageSender) return messageSender;
  const statusRecipient = text(payload && payload.status && payload.status.recipient_id, 500);
  if (statusRecipient) return statusRecipient;
  const statusMessage = text(payload && payload.status && payload.status.id, 500);
  if (statusMessage) return "status:" + statusMessage;
  const echoRecipient = text(payload && payload.echo && payload.echo.to, 500);
  return echoRecipient || "unknown";
}

function expectedEventIdentifier(payload) {
  const destinationId = text(payload && payload.value && payload.value.metadata && payload.value.metadata.phone_number_id, 240);
  if (payload && payload.status) return statusEventIdentifier(destinationId, payload.status);
  if (payload && payload.echo) return echoEventIdentifier(destinationId, payload.echo);
  return eventIdentifier(destinationId, payload && payload.message);
}

function classifyWhatsAppDeliveryError(error) {
  const responseStatus = Number(error && error.response && error.response.status) || null;
  const meta = error && error.response && error.response.data && error.response.data.error || {};
  const metaCode = Number(meta.code) || null;
  const metaSubcode = Number(meta.error_subcode) || null;
  const retryableMetaCodes = new Set([
    1, 2, 4, 17, 32, 613, 80007, 130429, 131000, 131016, 131042, 131048, 131056, 133004
  ]);
  const retryable = !error || !error.response ||
    [408, 409, 425, 429].includes(responseStatus) ||
    responseStatus >= 500 ||
    retryableMetaCodes.has(metaCode) ||
    retryableMetaCodes.has(metaSubcode);
  return {
    retryable,
    permanent: !retryable,
    http_status: responseStatus,
    meta_code: metaCode,
    meta_subcode: metaSubcode,
    error_type: text(meta.type || error && error.code, 100) || null
  };
}

function whatsappDeliveryFailure(error) {
  const classification = classifyWhatsAppDeliveryError(error);
  const code = classification.meta_subcode || classification.meta_code || classification.http_status || "unknown";
  const failure = new Error("whatsapp_delivery_failed_" + (classification.retryable ? "retryable" : "permanent") + ":" + code);
  failure.name = "WhatsAppDeliveryError";
  failure.whatsappDeliveryFailure = true;
  failure.retryable = classification.retryable;
  failure.permanent = classification.permanent;
  failure.http_status = classification.http_status;
  failure.meta_code = classification.meta_code;
  failure.meta_subcode = classification.meta_subcode;
  failure.error_type = classification.error_type;
  return failure;
}

function recoverableInternalError(error) {
  return !!(error && error.recoverAfterFix === true);
}

function storedProcessingError(error, recoverAfterFix) {
  const message = text(error && error.message || error, 500) || "processing_failed";
  return recoverAfterFix ? text(RECOVERABLE_INTERNAL_ERROR_PREFIX + message, 500) : message;
}

function whatsappMessageSender(value, message) {
  const directSender = text(message && message.from, 500);
  if (directSender) return directSender;
  const contactSenders = Array.from(new Set(
    (Array.isArray(value && value.contacts) ? value.contacts : [])
      .map(function (contact) { return text(contact && contact.wa_id, 500); })
      .filter(Boolean)
  ));
  return contactSenders.length === 1 ? contactSenders[0] : "";
}

function whatsappSenderMissingFailure(value, message) {
  const failure = new Error("whatsapp_sender_missing");
  // Retrying cannot add an identity that is absent from the stored provider
  // payload. Keep the encrypted event for diagnosis, but dead-letter it after
  // the first attempt instead of retrying it for three days.
  failure.permanent = true;
  failure.retryable = false;
  failure.diagnostic = {
    message_type: text(message && message.type, 80) || null,
    direct_sender_present: !!text(message && message.from, 500),
    contact_sender_count: Array.from(new Set(
      (Array.isArray(value && value.contacts) ? value.contacts : [])
        .map(function (contact) { return text(contact && contact.wa_id, 500); })
        .filter(Boolean)
    )).length
  };
  return failure;
}

function extractWhatsAppMessageEvents(body) {
  if (!body || body.object !== "whatsapp_business_account") return [];
  const events = [];
  for (const entry of Array.isArray(body.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry && entry.changes) ? entry.changes : []) {
      const value = change && change.value;
      const destinationId = text(value && value.metadata && value.metadata.phone_number_id, 240);
      for (const message of Array.isArray(value && value.messages) ? value.messages : []) {
        if (!destinationId || !message) continue;
        const sender = whatsappMessageSender(value, message);
        const normalizedMessage = sender && !text(message.from, 500)
          ? Object.assign({}, message, { from: sender })
          : message;
        events.push({
          event_id: eventIdentifier(destinationId, normalizedMessage),
          channel: "whatsapp",
          destination_id: destinationId,
          received_at: new Date().toISOString(),
          ordering_identity: sender,
          payload: { event_type: "message", value, message: normalizedMessage }
        });
      }
      for (const status of Array.isArray(value && value.statuses) ? value.statuses : []) {
        if (!destinationId || !status) continue;
        events.push({
          event_id: statusEventIdentifier(destinationId, status),
          channel: "whatsapp",
          destination_id: destinationId,
          received_at: new Date().toISOString(),
          ordering_identity: text(status.recipient_id, 500) || "status:" + text(status.id, 500),
          payload: { event_type: "status", value, status }
        });
      }
      if (String(change && change.field || "") === "smb_message_echoes") {
        for (const echo of Array.isArray(value && value.message_echoes) ? value.message_echoes : []) {
          if (!destinationId || !echo) continue;
          events.push({
            event_id: echoEventIdentifier(destinationId, echo),
            channel: "whatsapp",
            destination_id: destinationId,
            received_at: new Date().toISOString(),
            ordering_identity: text(echo.to, 500) || "echo:" + text(echo.id, 500),
            payload: { event_type: "business_app_echo", value, echo }
          });
        }
      }
    }
  }
  return events;
}

class InMemoryMetaWebhookInboxStore {
  constructor(options) {
    options = options || {};
    this.clock = options.clock || function () { return new Date(); };
    this.rows = new Map();
    this.sequence = 0;
  }

  async enqueue(events) {
    let inserted = 0;
    const current = this.clock().toISOString();
    for (const event of events || []) {
      if (!event || !event.event_id || this.rows.has(event.event_id)) continue;
      this.rows.set(event.event_id, {
        queue_id: ++this.sequence,
        event_id: event.event_id,
        channel: event.channel,
        destination_id: event.destination_id,
        sender_key: crypto.createHash("sha256")
          .update(text(event.ordering_identity, 500) || eventOrderingIdentity(event.payload))
          .digest("hex"),
        payload: event.payload,
        status: "pending",
        attempts: 0,
        next_attempt_at: current,
        lease_until: null,
        lease_owner: null,
        received_at: event.received_at || current,
        processed_at: null,
        tenant_id: null,
        last_error: null
      });
      inserted++;
    }
    return { accepted: (events || []).length, inserted };
  }

  async claim(owner, leaseSeconds) {
    const now = this.clock();
    const rows = Array.from(this.rows.values());
    const eligible = rows.filter(function (row) {
      const due = Date.parse(row.next_attempt_at || "") <= now.getTime();
      const expired = !row.lease_until || Date.parse(row.lease_until) <= now.getTime();
      const active = row.status === "pending" && due || row.status === "processing" && expired;
      if (!active || row.attempts >= MAX_EVENT_ATTEMPTS || Date.parse(row.received_at) <= now.getTime() - MAX_EVENT_AGE_MS) {
        return false;
      }
      return !rows.some(function (earlier) {
        return earlier.queue_id < row.queue_id &&
          earlier.destination_id === row.destination_id &&
          earlier.sender_key === row.sender_key &&
          ["pending", "processing"].includes(earlier.status);
      });
    }).sort(function (left, right) {
      return left.queue_id - right.queue_id;
    })[0];
    if (!eligible) return null;
    eligible.status = "processing";
    eligible.attempts += 1;
    eligible.lease_owner = owner;
    eligible.lease_until = new Date(now.getTime() + Math.max(30, leaseSeconds || 120) * 1000).toISOString();
    return Object.assign({}, eligible);
  }

  async complete(eventId, owner, details) {
    const row = this.rows.get(eventId);
    if (!row || row.status !== "processing" || row.lease_owner !== owner) return false;
    row.status = "completed";
    row.processed_at = this.clock().toISOString();
    row.tenant_id = text(details && details.tenant_id, 240) || null;
    row.payload = null;
    row.lease_owner = null;
    row.lease_until = null;
    row.last_error = null;
    return true;
  }

  async heartbeat(eventId, owner, leaseSeconds) {
    const row = this.rows.get(eventId);
    if (!row || row.status !== "processing" || row.lease_owner !== owner) return false;
    row.lease_until = new Date(
      this.clock().getTime() + Math.max(30, leaseSeconds || 180) * 1000
    ).toISOString();
    return true;
  }

  async fail(eventId, owner, error, options) {
    const row = this.rows.get(eventId);
    if (!row || row.status !== "processing" || row.lease_owner !== owner) return false;
    const permanent = options && options.permanent === true || row.attempts >= MAX_EVENT_ATTEMPTS ||
      Date.parse(row.received_at) <= this.clock().getTime() - MAX_EVENT_AGE_MS;
    row.status = permanent ? "dead_letter" : "pending";
    row.next_attempt_at = permanent
      ? null
      : new Date(this.clock().getTime() + Math.max(1000, Number(options && options.delay_ms) || 1000)).toISOString();
    row.lease_owner = null;
    row.lease_until = null;
    row.last_error = storedProcessingError(error, options && options.recover_after_fix === true);
    return true;
  }

  async wakeRecoverable() {
    const now = this.clock();
    let recovered = 0;
    for (const row of this.rows.values()) {
      if (row.status !== "pending" || !String(row.last_error || "").startsWith(RECOVERABLE_INTERNAL_ERROR_PREFIX)) continue;
      if (row.attempts >= MAX_EVENT_ATTEMPTS || Date.parse(row.received_at) <= now.getTime() - MAX_EVENT_AGE_MS) continue;
      row.next_attempt_at = now.toISOString();
      recovered++;
    }
    return recovered;
  }

  async list() {
    return Array.from(this.rows.values()).map(function (row) { return Object.assign({}, row); });
  }
}

class SupabaseMetaWebhookInboxStore {
  constructor(options) {
    options = options || {};
    this.url = String(options.url || "").replace(/\/$/, "");
    this.headers = Object.assign({}, options.headers || {});
    this.http = options.axiosClient;
    this.encrypt = options.encrypt;
    this.decrypt = options.decrypt;
    this.senderKey = options.senderKey;
    this.clock = options.clock || function () { return new Date(); };
    this.readyUntil = 0;
    this.readyPromise = null;
    if (!this.url || !this.http || !this.encrypt || !this.decrypt || !this.senderKey) {
      throw new Error("meta_webhook_inbox_store_not_configured");
    }
  }

  async enqueue(events) {
    const payload = (events || []).map((event) => ({
      event_id: event.event_id,
      channel: event.channel,
      destination_id: event.destination_id,
      sender_key: this.senderKey(text(event.ordering_identity, 500) || eventOrderingIdentity(event.payload)),
      payload_ciphertext: this.encrypt(JSON.stringify(event.payload || {})),
      status: "pending",
      attempts: 0,
      next_attempt_at: event.received_at || this.clock().toISOString(),
      received_at: event.received_at || this.clock().toISOString()
    }));
    if (!payload.length) return { accepted: 0, inserted: 0 };
    await this.http.post(
      this.url + "/rest/v1/meta_webhook_events?on_conflict=event_id",
      payload,
      {
        headers: Object.assign({}, this.headers, {
          Prefer: "resolution=ignore-duplicates,return=minimal"
        }),
        timeout: 8000
      }
    );
    return { accepted: payload.length, inserted: null };
  }

  async assertReady(options) {
    const force = options && options.force === true;
    if (!force && this.readyUntil > this.clock().getTime()) return true;
    if (this.readyPromise) return this.readyPromise;
    const self = this;
    const check = (async function () {
      await self.http.get(self.url + "/rest/v1/meta_webhook_events", {
        params: { select: "event_id", limit: 1 },
        headers: self.headers,
        timeout: 8000
      });
      const response = await self.http.post(
        self.url + "/rest/v1/rpc/meta_webhook_inbox_ready_v1",
        {},
        { headers: self.headers, timeout: 8000 }
      );
      if (response.data !== true) throw new Error("meta_webhook_inbox_rpc_unavailable");
      self.readyUntil = self.clock().getTime() + 30000;
      return true;
    })();
    this.readyPromise = check;
    try {
      return await check;
    } finally {
      if (this.readyPromise === check) this.readyPromise = null;
    }
  }

  async claim(owner, leaseSeconds) {
    const response = await this.http.post(
      this.url + "/rest/v1/rpc/claim_meta_webhook_event_v1",
      { p_owner: owner, p_lease_seconds: Math.max(30, Number(leaseSeconds) || 120) },
      { headers: this.headers, timeout: 10000 }
    );
    const row = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!row || !row.event_id) return null;
    let payload;
    try {
      payload = JSON.parse(this.decrypt(row.payload_ciphertext));
    } catch (error) {
      error.permanent = true;
      error.event_id = row.event_id;
      error.lease_owner = owner;
      throw error;
    }
    const destinationId = text(payload && payload.value && payload.value.metadata && payload.value.metadata.phone_number_id, 240);
    const expectedEventId = expectedEventIdentifier(payload);
    const expectedSenderKey = this.senderKey(eventOrderingIdentity(payload));
    if (destinationId !== row.destination_id || expectedEventId !== row.event_id || expectedSenderKey !== row.sender_key) {
      const invalid = new Error("meta_webhook_inbox_integrity_failed");
      invalid.permanent = true;
      invalid.event_id = row.event_id;
      invalid.lease_owner = owner;
      throw invalid;
    }
    return Object.assign({}, row, { payload });
  }

  async heartbeat(eventId, owner, leaseSeconds) {
    const response = await this.http.patch(
      this.url + "/rest/v1/meta_webhook_events",
      {
        lease_until: new Date(
          this.clock().getTime() + Math.max(30, Number(leaseSeconds) || 180) * 1000
        ).toISOString(),
        updated_at: this.clock().toISOString()
      },
      {
        params: { event_id: "eq." + eventId, status: "eq.processing", lease_owner: "eq." + owner },
        headers: Object.assign({}, this.headers, { Prefer: "return=representation" }),
        timeout: 8000
      }
    );
    return Array.isArray(response.data) && response.data.length === 1;
  }

  async complete(eventId, owner, details) {
    const response = await this.http.patch(
      this.url + "/rest/v1/meta_webhook_events",
      {
        status: "completed",
        processed_at: this.clock().toISOString(),
        tenant_id: text(details && details.tenant_id, 240) || null,
        payload_ciphertext: null,
        lease_owner: null,
        lease_until: null,
        last_error: null
      },
      {
        params: { event_id: "eq." + eventId, status: "eq.processing", lease_owner: "eq." + owner },
        headers: Object.assign({}, this.headers, { Prefer: "return=representation" }),
        timeout: 8000
      }
    );
    return Array.isArray(response.data) && response.data.length === 1;
  }

  async fail(eventId, owner, error, options) {
    const permanent = options && options.permanent === true;
    const payload = {
      status: permanent ? "dead_letter" : "pending",
      next_attempt_at: permanent
        ? null
        : new Date(this.clock().getTime() + Math.max(1000, Number(options && options.delay_ms) || 1000)).toISOString(),
      lease_owner: null,
      lease_until: null,
      last_error: storedProcessingError(error, options && options.recover_after_fix === true)
    };
    const response = await this.http.patch(
      this.url + "/rest/v1/meta_webhook_events",
      payload,
      {
        params: { event_id: "eq." + eventId, status: "eq.processing", lease_owner: "eq." + owner },
        headers: Object.assign({}, this.headers, { Prefer: "return=representation" }),
        timeout: 8000
      }
    );
    return Array.isArray(response.data) && response.data.length === 1;
  }

  async wakeRecoverable() {
    const now = this.clock();
    const response = await this.http.patch(
      this.url + "/rest/v1/meta_webhook_events",
      { next_attempt_at: now.toISOString(), updated_at: now.toISOString() },
      {
        params: {
          select: "event_id",
          status: "eq.pending",
          last_error: "like." + RECOVERABLE_INTERNAL_ERROR_PREFIX + "*",
          attempts: "lt." + MAX_EVENT_ATTEMPTS,
          received_at: "gt." + new Date(now.getTime() - MAX_EVENT_AGE_MS).toISOString()
        },
        headers: Object.assign({}, this.headers, { Prefer: "return=representation" }),
        timeout: 8000
      }
    );
    return Array.isArray(response.data) ? response.data.length : 0;
  }
}

function createMetaWebhookInbox(options) {
  options = options || {};
  const store = options.store;
  const processEvent = options.processEvent;
  const log = options.log || function () {};
  const onFailure = typeof options.onFailure === "function" ? options.onFailure : null;
  const owner = text(options.owner, 200) || "webhook-worker:" + crypto.randomUUID();
  const intervalMs = Math.max(1000, Number(options.interval_ms) || 5000);
  let draining = false;
  let stopped = false;
  let timer = null;

  function leaseLost(eventId, cause) {
    const error = new Error("meta_webhook_lease_lost:" + String(eventId || "unknown").slice(-32));
    error.leaseLost = true;
    error.permanent = false;
    if (cause) error.cause = cause;
    return error;
  }

  async function renewLease(row) {
    let renewed;
    try {
      renewed = await store.heartbeat(row.event_id, owner, 180);
    } catch (error) {
      throw leaseLost(row.event_id, error);
    }
    if (renewed !== true) throw leaseLost(row.event_id);
    return true;
  }

  async function drain() {
    if (draining || stopped) return 0;
    draining = true;
    let processed = 0;
    try {
      while (processed < 100) {
        let row;
        try {
          row = await store.claim(owner, 180);
        } catch (error) {
          if (error && error.event_id) {
            await store.fail(error.event_id, error.lease_owner || owner, error, { permanent: true });
          }
          throw error;
        }
        if (!row) break;
        try {
          await renewLease(row);
          let heartbeatFailure = null;
          let heartbeatInFlight = false;
          const heartbeat = setInterval(function () {
            if (heartbeatInFlight || heartbeatFailure) return;
            heartbeatInFlight = true;
            renewLease(row).catch(function (error) {
              heartbeatFailure = error;
              log("warn", "meta_webhook_heartbeat_failed", {
                event_id_suffix: String(row.event_id || "").slice(-16),
                error: text(error && error.message, 240)
              });
            }).finally(function () {
              heartbeatInFlight = false;
            });
          }, 30000);
          if (heartbeat.unref) heartbeat.unref();
          try {
            const result = await processEvent(row.payload, row);
            if (heartbeatFailure) throw heartbeatFailure;
            await renewLease(row);
            const completed = await store.complete(row.event_id, owner, result || {});
            if (completed !== true) throw leaseLost(row.event_id);
            if (Number(row.attempts) > 1) {
              log("info", "meta_webhook_event_recovered", {
                event_id_suffix: String(row.event_id || "").slice(-16),
                attempts: row.attempts,
                tenant_id: text(result && result.tenant_id, 240) || null
              });
            }
          } finally {
            clearInterval(heartbeat);
          }
        } catch (error) {
          if (error && error.leaseLost) throw error;
          const recoveryPending = recoverableInternalError(error) && Number(row.attempts) < MAX_EVENT_ATTEMPTS;
          const permanent = !recoveryPending && (error && error.permanent === true || Number(row.attempts) >= MAX_EVENT_ATTEMPTS);
          const exponent = Math.min(10, Math.max(0, Number(row.attempts) - 1));
          const delayMs = Math.min(30 * 60 * 1000, 1000 * Math.pow(2, exponent));
          const failed = await store.fail(row.event_id, owner, error, {
            permanent,
            delay_ms: delayMs,
            recover_after_fix: recoveryPending
          });
          if (failed !== true) throw leaseLost(row.event_id);
          if (onFailure) {
            try {
              await onFailure(row, error, { permanent, retryable: !permanent, delay_ms: permanent ? null : delayMs });
            } catch (callbackError) {
              log("warn", "meta_webhook_failure_observer_failed", {
                event_id_suffix: String(row.event_id || "").slice(-16),
                error: text(callbackError && callbackError.message, 240)
              });
            }
          }
          log("warn", "meta_webhook_event_failed", {
            event_id_suffix: String(row.event_id || "").slice(-16),
            attempts: row.attempts,
            permanent,
            recovery_pending: recoveryPending,
            error: text(error && error.message, 240)
          });
        }
        processed++;
      }
      return processed;
    } finally {
      draining = false;
    }
  }

  function kick() {
    if (stopped) return;
    setImmediate(function () { drain().catch(function (error) {
      log("warn", "meta_webhook_inbox_drain_failed", { error: text(error && error.message, 240) });
    }); });
  }

  function start() {
    if (timer || stopped) return;
    timer = setInterval(kick, intervalMs);
    if (timer.unref) timer.unref();
    Promise.resolve(typeof store.wakeRecoverable === "function" ? store.wakeRecoverable() : 0)
      .then(function (count) {
        if (count) log("info", "meta_webhook_recovery_woken", { event_count: count });
      })
      .catch(function (error) {
        log("warn", "meta_webhook_recovery_wake_failed", { error: text(error && error.message, 240) });
      })
      .finally(kick);
  }

  function stop() {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = null;
  }

  return {
    enqueue: async function (events) {
      const result = await store.enqueue(events);
      kick();
      return result;
    },
    wakeRecoverable: async function () {
      if (typeof store.wakeRecoverable !== "function") return 0;
      const count = await store.wakeRecoverable();
      if (count) log("info", "meta_webhook_recovery_woken", { event_count: count });
      kick();
      return count;
    },
    drain,
    start,
    stop
  };
}

module.exports = {
  InMemoryMetaWebhookInboxStore,
  SupabaseMetaWebhookInboxStore,
  classifyWhatsAppDeliveryError,
  createMetaWebhookInbox,
  eventOrderingIdentity,
  extractWhatsAppMessageEvents,
  recoverableInternalError,
  whatsappMessageSender,
  whatsappSenderMissingFailure,
  whatsappDeliveryFailure
};
