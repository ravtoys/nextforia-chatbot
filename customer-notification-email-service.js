"use strict";

const crypto = require("crypto");
const {
  CUSTOMER_NOTIFICATION_EMAIL_TEMPLATES
} = require("./customer-notification-emails");

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function text(value, limit) {
  return String(value == null ? "" : value).trim().slice(0, limit || 500);
}

function tenant(value) {
  return text(value, 120).toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function email(value) {
  const normalized = text(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : "";
}

function defaultTypes() {
  return CUSTOMER_NOTIFICATION_EMAIL_TEMPLATES.reduce(function (result, key) {
    result[key] = true;
    return result;
  }, {});
}

function normalizeTypes(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return CUSTOMER_NOTIFICATION_EMAIL_TEMPLATES.reduce(function (result, key) {
    result[key] = source[key] !== false;
    return result;
  }, {});
}

function normalizePreferences(input, scope) {
  input = input || {};
  scope = scope || {};
  const tenantId = tenant(scope.tenant_id);
  const actorId = email(scope.actor_id);
  const recipient = email(scope.recipient || actorId);
  if (!tenantId) throw new Error("customer_notification_email_tenant_required");
  if (!actorId || recipient !== actorId) throw new Error("customer_notification_email_membership_required");
  return {
    tenant_id: tenantId,
    actor_id: actorId,
    recipient,
    enabled: input.enabled === true,
    types: normalizeTypes(input.types),
    updated_at: new Date().toISOString()
  };
}

function publicPreferences(row, available) {
  const source = row || {};
  return {
    available: available === true,
    recipient: email(source.recipient || source.actor_id),
    enabled: source.enabled === true,
    types: normalizeTypes(source.types || defaultTypes()),
    updated_at: source.updated_at || null
  };
}

function normalizeDelivery(input) {
  input = input || {};
  const tenantId = tenant(input.tenant_id);
  const actorId = email(input.actor_id);
  const recipient = email(input.recipient);
  const template = text(input.template_key || input.template, 80);
  const notificationId = text(input.notification_id, 180);
  if (!tenantId || !actorId || !recipient || actorId !== recipient) throw new Error("customer_notification_email_scope_invalid");
  if (!CUSTOMER_NOTIFICATION_EMAIL_TEMPLATES.includes(template)) throw new Error("customer_notification_email_template_invalid");
  if (!notificationId) throw new Error("customer_notification_email_notification_required");
  const now = new Date().toISOString();
  return {
    id: text(input.id, 120) || crypto.randomUUID(),
    tenant_id: tenantId,
    actor_id: actorId,
    recipient,
    notification_id: notificationId,
    template_key: template,
    dedupe_key: text(input.dedupe_key, 500) || ["customer-notification-email", tenantId, actorId, template, notificationId].join(":"),
    payload: input.payload && typeof input.payload === "object" && !Array.isArray(input.payload) ? copy(input.payload) : {},
    status: "scheduled",
    send_after: new Date(input.send_after || now).toISOString(),
    attempts: 0,
    provider_message_id: null,
    last_error: null,
    sent_at: null,
    created_at: now,
    updated_at: now
  };
}

class InMemoryCustomerNotificationEmailStore {
  constructor() {
    this.preferences = [];
    this.deliveries = [];
  }

  async getPreferences(tenantId, actorId) {
    const row = this.preferences.find(function (item) {
      return item.tenant_id === tenant(tenantId) && item.actor_id === email(actorId);
    });
    return row ? copy(row) : null;
  }

  async upsertPreferences(record) {
    const index = this.preferences.findIndex(function (item) {
      return item.tenant_id === record.tenant_id && item.actor_id === record.actor_id;
    });
    if (index >= 0) this.preferences[index] = copy(record);
    else this.preferences.push(copy(record));
    return copy(record);
  }

  async listEnabledPreferences(tenantId, template) {
    return copy(this.preferences.filter(function (row) {
      return row.tenant_id === tenant(tenantId) && row.enabled === true && row.types && row.types[template] === true;
    }));
  }

  async scheduleDelivery(record) {
    const existing = this.deliveries.find(function (row) { return row.dedupe_key === record.dedupe_key; });
    if (existing) return copy(existing);
    this.deliveries.push(copy(record));
    return copy(record);
  }

  async claimDue(limit, at) {
    const now = new Date(at || new Date()).getTime();
    const due = this.deliveries.filter(function (row) {
      return ["scheduled", "failed"].includes(row.status) && row.attempts < 3 && Date.parse(row.send_after) <= now;
    }).sort(function (a, b) { return String(a.send_after).localeCompare(String(b.send_after)); }).slice(0, limit || 20);
    due.forEach(function (row) {
      row.status = "sending";
      row.attempts += 1;
      row.updated_at = new Date(now).toISOString();
    });
    return copy(due);
  }

  async patchDelivery(id, patch) {
    const row = this.deliveries.find(function (item) { return item.id === id; });
    if (!row) return null;
    Object.assign(row, copy(patch));
    return copy(row);
  }
}

class SupabaseCustomerNotificationEmailStore {
  constructor(options) {
    options = options || {};
    this.url = String(options.url || "").replace(/\/$/, "");
    this.headers = options.headers || {};
    this.axios = options.axiosClient;
    this.preferencesTable = options.preferencesTable || "customer_notification_email_preferences";
    this.deliveriesTable = options.deliveriesTable || "customer_notification_email_deliveries";
  }

  async getPreferences(tenantId, actorId) {
    const response = await this.axios.get(this.url + "/rest/v1/" + this.preferencesTable, {
      params: { select: "tenant_id,actor_id,recipient,enabled,types,updated_at", tenant_id: "eq." + tenant(tenantId), actor_id: "eq." + email(actorId), limit: 1 },
      headers: this.headers,
      timeout: 8000
    });
    return Array.isArray(response.data) ? response.data[0] || null : null;
  }

  async upsertPreferences(record) {
    const response = await this.axios.post(this.url + "/rest/v1/" + this.preferencesTable + "?on_conflict=tenant_id,actor_id", record, {
      headers: Object.assign({}, this.headers, { Prefer: "resolution=merge-duplicates,return=representation" }),
      timeout: 8000
    });
    return response.data && response.data[0] || record;
  }

  async listEnabledPreferences(tenantId, template) {
    const params = { select: "tenant_id,actor_id,recipient,enabled,types,updated_at", tenant_id: "eq." + tenant(tenantId), enabled: "eq.true", limit: 500 };
    params["types->>" + template] = "eq.true";
    const response = await this.axios.get(this.url + "/rest/v1/" + this.preferencesTable, {
      params,
      headers: this.headers,
      timeout: 8000
    });
    return Array.isArray(response.data) ? response.data : [];
  }

  async scheduleDelivery(record) {
    const response = await this.axios.post(this.url + "/rest/v1/" + this.deliveriesTable + "?on_conflict=dedupe_key", record, {
      headers: Object.assign({}, this.headers, { Prefer: "resolution=ignore-duplicates,return=representation" }),
      timeout: 8000
    });
    if (response.data && response.data[0]) return response.data[0];
    const existing = await this.axios.get(this.url + "/rest/v1/" + this.deliveriesTable, {
      params: { select: "*", dedupe_key: "eq." + record.dedupe_key, limit: 1 },
      headers: this.headers,
      timeout: 8000
    });
    return existing.data && existing.data[0] || record;
  }

  async claimDue(limit) {
    const response = await this.axios.post(this.url + "/rest/v1/rpc/claim_due_customer_notification_emails", {
      p_limit: Math.max(1, Math.min(Number(limit) || 20, 100))
    }, { headers: this.headers, timeout: 8000 });
    return Array.isArray(response.data) ? response.data : [];
  }

  async patchDelivery(id, patch) {
    const response = await this.axios.patch(this.url + "/rest/v1/" + this.deliveriesTable, patch, {
      params: { id: "eq." + id },
      headers: Object.assign({}, this.headers, { Prefer: "return=representation" }),
      timeout: 8000
    });
    return response.data && response.data[0] || null;
  }
}

function notificationTemplate(notification) {
  const type = text(notification && notification.type, 80);
  if (type === "human_handoff_required") return "human_attention";
  if (type === "customer_order_created") return "payment_pending";
  if (type === "shipping_pending_digest") return "shipping_pending";
  if (type === "sales_opportunity") return "sales_opportunity";
  if (type === "product_update") return "product_update";
  return "";
}

function notificationPayload(notification, baseUrl) {
  const template = notificationTemplate(notification);
  const base = {
    base_url: baseUrl,
    panel_url: "/admin/panel",
    action_url: notification && notification.action_url,
    customer_label: notification && notification.customer_label,
    conversation_id: notification && notification.conversation_id,
    channel: notification && notification.channel,
    message: notification && notification.message
  };
  if (template === "payment_pending") {
    base.order = Object.assign({}, notification && notification.order || {}, {
      id: notification && notification.order_id,
      order_id: notification && notification.order_id,
      name: notification && notification.customer_label
    });
    base.payment_reported = notification && notification.payment_reported === true;
  } else if (template === "shipping_pending") base.orders = notification && notification.orders || [];
  else if (template === "sales_opportunity") base.opportunity = notification && notification.opportunity || {};
  else if (template === "product_update") {
    base.title = notification && notification.title;
    base.subtitle = notification && notification.message;
    base.benefits = notification && notification.benefits || [];
  }
  return base;
}

function createCustomerNotificationEmailService(options) {
  options = options || {};
  const store = options.store || new InMemoryCustomerNotificationEmailStore();
  const sender = options.sender;
  const available = options.available === true;
  const baseUrl = text(options.baseUrl, 2000) || "https://nextforia.com";
  const now = typeof options.now === "function" ? options.now : function () { return new Date(); };
  const recipientAllowed = typeof options.recipientAllowed === "function" ? options.recipientAllowed : async function () { return true; };
  const deliveryAllowed = typeof options.deliveryAllowed === "function" ? options.deliveryAllowed : async function () { return true; };

  async function getPreferences(scope) {
    const tenantId = tenant(scope && scope.tenant_id);
    const actorId = email(scope && scope.actor_id);
    if (!tenantId || !actorId) throw new Error("customer_notification_email_scope_invalid");
    const stored = await store.getPreferences(tenantId, actorId);
    return publicPreferences(stored || { actor_id: actorId, recipient: actorId, enabled: false, types: defaultTypes() }, available);
  }

  async function savePreferences(scope, input) {
    const record = normalizePreferences(input, scope);
    if (record.enabled && available !== true) throw new Error("customer_notification_email_unavailable");
    if (await recipientAllowed(record) !== true) throw new Error("customer_notification_email_membership_required");
    return publicPreferences(await store.upsertPreferences(record), available);
  }

  async function scheduleEvent(input) {
    input = input || {};
    if (!available) return { scheduled: 0, skipped: "unavailable" };
    const tenantId = tenant(input.tenant_id);
    const template = text(input.template || input.template_key, 80);
    const notificationId = text(input.notification_id || input.id, 180);
    if (!tenantId || !notificationId || !CUSTOMER_NOTIFICATION_EMAIL_TEMPLATES.includes(template)) throw new Error("customer_notification_email_event_invalid");
    const preferences = await store.listEnabledPreferences(tenantId, template);
    let scheduled = 0;
    for (const preference of preferences) {
      if (await recipientAllowed(preference) !== true) continue;
      const delivery = normalizeDelivery({
        tenant_id: tenantId,
        actor_id: preference.actor_id,
        recipient: preference.recipient,
        notification_id: notificationId,
        template_key: template,
        payload: Object.assign({ base_url: baseUrl, panel_url: "/admin/panel" }, input.payload || {}),
        send_after: input.send_after
      });
      const stored = await store.scheduleDelivery(delivery);
      if (stored && stored.id) scheduled += 1;
    }
    return { scheduled };
  }

  async function scheduleNotification(notification) {
    const template = notificationTemplate(notification);
    if (!template) return { scheduled: 0, skipped: "unsupported_type" };
    return scheduleEvent({
      tenant_id: notification.tenant_id,
      notification_id: notification.id,
      template,
      payload: notificationPayload(notification, baseUrl)
    });
  }

  async function processDue(limit) {
    if (!available || !sender || typeof sender.send !== "function") return { claimed: 0, sent: 0, cancelled: 0, failed: 0 };
    const rows = await store.claimDue(limit || 20, now());
    const result = { claimed: rows.length, sent: 0, cancelled: 0, failed: 0 };
    for (const row of rows) {
      try {
        const preference = await store.getPreferences(row.tenant_id, row.actor_id);
        const allowed = preference && preference.enabled === true && preference.types && preference.types[row.template_key] === true &&
          preference.recipient === row.recipient && await recipientAllowed(preference) === true &&
          await deliveryAllowed(row) === true;
        if (!allowed) {
          await store.patchDelivery(row.id, { status: "cancelled", last_error: "recipient_no_longer_allowed", updated_at: now().toISOString() });
          result.cancelled += 1;
          continue;
        }
        const delivery = await sender.send(Object.assign({}, row.payload || {}, {
          template: row.template_key,
          to: row.recipient,
          tenant_id: row.tenant_id
        }));
        const sentAt = now().toISOString();
        await store.patchDelivery(row.id, { status: "sent", provider_message_id: delivery && delivery.id || null, sent_at: sentAt, last_error: null, updated_at: sentAt });
        result.sent += 1;
      } catch (error) {
        const permanent = Number(row.attempts) >= 3;
        const retryAt = new Date(now().getTime() + Math.min(60, Math.pow(2, Number(row.attempts) || 1) * 5) * 60 * 1000).toISOString();
        await store.patchDelivery(row.id, { status: permanent ? "failed_permanently" : "failed", last_error: text(error && error.message || "email_delivery_failed", 240), send_after: retryAt, updated_at: now().toISOString() });
        result.failed += 1;
      }
    }
    return result;
  }

  return { available, getPreferences, savePreferences, scheduleEvent, scheduleNotification, processDue, store };
}

module.exports = {
  InMemoryCustomerNotificationEmailStore,
  SupabaseCustomerNotificationEmailStore,
  createCustomerNotificationEmailService,
  defaultTypes,
  normalizeDelivery,
  normalizePreferences,
  notificationPayload,
  notificationTemplate,
  publicPreferences
};
