"use strict";

const crypto = require("crypto");
const { EventEmitter } = require("events");

const CUSTOMER_NOTIFICATION_TOOL = "customer_panel_notification";
const CUSTOMER_NOTIFICATION_READ_TOOL = "customer_panel_notification_read";
const CUSTOMER_PUSH_SUBSCRIPTION_TOOL = "customer_panel_push_subscription";

function text(value, limit) {
  return String(value == null ? "" : value).trim().slice(0, limit || 500);
}

function tenant(value) {
  return text(value, 120).toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function actor(value) {
  return text(value, 240).toLowerCase();
}

function normalizeNotification(input) {
  input = input || {};
  const tenantId = tenant(input.tenant_id);
  const type = ["human_handoff_required", "customer_order_created", "appointment_created"].includes(text(input.type, 80))
    ? text(input.type, 80)
    : "human_handoff_required";
  const conversationId = text(input.conversation_id, 500);
  const orderId = text(input.order_id, 120);
  const appointmentId = text(input.appointment_id, 160);
  if (!tenantId) throw new Error("notification_tenant_required");
  if (type === "human_handoff_required" && !conversationId) throw new Error("notification_conversation_required");
  if (type === "customer_order_created" && !orderId) throw new Error("notification_order_required");
  if (type === "appointment_created" && !appointmentId) throw new Error("notification_appointment_required");
  const id = text(input.id, 120) || crypto.randomUUID();
  const createdAt = text(input.created_at, 80) || new Date().toISOString();
  const channel = ["whatsapp", "instagram", "messenger", "email"].includes(text(input.channel, 30).toLowerCase())
    ? text(input.channel, 30).toLowerCase()
    : "whatsapp";
  return {
    version: 1,
    id,
    tenant_id: tenantId,
    type,
    priority: "high",
    conversation_id: conversationId,
    order_id: orderId,
    appointment_id: appointmentId,
    channel,
    customer_label: text(input.customer_label, 160) || "Un cliente",
    reason: text(input.reason, 240) || "solicitud_cliente",
    title: text(input.title, 160) || (type === "customer_order_created" ? "Nuevo pedido por confirmar" : type === "appointment_created" ? "Nueva cita confirmada" : "Un cliente necesita tu ayuda"),
    message: text(input.message, 500) || (type === "customer_order_created" ? "Tu equipo tiene un pedido nuevo listo para revisar." : type === "appointment_created" ? "Tu Nextfor confirmó una cita y la dejó lista en la agenda." : "La IA pausó esta conversación para que tu equipo pueda continuar."),
    action_label: text(input.action_label, 80) || (type === "customer_order_created" ? "Ver pedido" : type === "appointment_created" ? "Ver cita" : "Abrir conversación"),
    action_url: type === "customer_order_created"
      ? "/admin/panel?tab=orders&order=" + encodeURIComponent(orderId)
      : type === "appointment_created"
        ? "/admin/panel?tab=appointments&appointment=" + encodeURIComponent(appointmentId)
        : "/admin/panel?tab=conversations&conversation=" + encodeURIComponent(conversationId),
    created_at: createdAt
  };
}

function normalizeSubscription(input, tenantId, actorId) {
  input = input || {};
  const endpoint = text(input.endpoint, 3000);
  const keys = input.keys || {};
  const p256dh = text(keys.p256dh, 1000);
  const auth = text(keys.auth, 500);
  if (!tenant(tenantId) || !actor(actorId)) throw new Error("push_subscription_scope_required");
  if (!/^https:\/\//i.test(endpoint) || !p256dh || !auth) throw new Error("push_subscription_invalid");
  return {
    version: 1,
    id: crypto.createHash("sha256").update(endpoint).digest("hex"),
    tenant_id: tenant(tenantId),
    actor_id: actor(actorId),
    endpoint,
    expirationTime: Number.isFinite(Number(input.expirationTime)) ? Number(input.expirationTime) : null,
    keys: { p256dh, auth },
    active: true,
    updated_at: new Date().toISOString()
  };
}

class InMemoryCustomerNotificationStore {
  constructor() {
    this.notifications = [];
    this.reads = [];
    this.subscriptions = [];
  }

  async appendNotification(record) {
    this.notifications.push(JSON.parse(JSON.stringify(record)));
    return record;
  }

  async listNotifications(tenantId, limit) {
    return this.notifications
      .filter(function (row) { return row.tenant_id === tenant(tenantId); })
      .slice().sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); })
      .slice(0, limit || 100);
  }

  async appendRead(record) {
    this.reads.push(JSON.parse(JSON.stringify(record)));
    return record;
  }

  async listReads(tenantId, actorId) {
    return this.reads.filter(function (row) {
      return row.tenant_id === tenant(tenantId) && row.actor_id === actor(actorId);
    });
  }

  async upsertSubscription(record) {
    this.subscriptions.push(JSON.parse(JSON.stringify(record)));
    return record;
  }

  async listSubscriptions(tenantId) {
    const latest = new Map();
    this.subscriptions.filter(function (row) { return row.tenant_id === tenant(tenantId); })
      .forEach(function (row) { latest.set(row.id, row); });
    return Array.from(latest.values()).filter(function (row) { return row.active; });
  }
}

function createCustomerNotificationService(options) {
  options = options || {};
  const store = options.store || new InMemoryCustomerNotificationStore();
  const pushSender = options.pushSender || null;
  const emailDelivery = options.emailDelivery || null;
  const events = options.events || new EventEmitter();
  events.setMaxListeners(500);

  async function list(tenantId, actorId, limit) {
    const cleanTenant = tenant(tenantId);
    const cleanActor = actor(actorId);
    if (!cleanTenant || !cleanActor) throw new Error("notification_scope_required");
    const rows = await store.listNotifications(cleanTenant, Math.max(1, Math.min(Number(limit) || 100, 200)));
    const reads = await store.listReads(cleanTenant, cleanActor);
    const readIds = new Set((reads || []).map(function (row) { return row.notification_id; }));
    const items = (rows || []).map(function (row) {
      return Object.assign({}, row, { read: readIds.has(row.id) });
    });
    return {
      count: items.length,
      unread_count: items.filter(function (row) { return !row.read; }).length,
      items
    };
  }

  async function deliverPush(notification) {
    if (!pushSender || typeof pushSender.send !== "function") return { attempted: 0, delivered: 0 };
    const subscriptions = await store.listSubscriptions(notification.tenant_id);
    let delivered = 0;
    await Promise.all((subscriptions || []).map(async function (record) {
      try {
        if (typeof options.subscriptionAllowed === "function" &&
            await options.subscriptionAllowed(record, notification) !== true) {
          await store.upsertSubscription(Object.assign({}, record, {
            active: false,
            updated_at: new Date().toISOString()
          }));
          return;
        }
        await pushSender.send({ endpoint: record.endpoint, expirationTime: record.expirationTime, keys: record.keys }, {
          notification_id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.message,
          action_url: notification.action_url,
          tag: notification.type === "customer_order_created"
            ? "nextfor-order-" + notification.order_id
            : notification.type === "appointment_created"
              ? "nextfor-appointment-" + notification.appointment_id
            : "nextfor-handoff-" + notification.conversation_id
        });
        delivered += 1;
      } catch (error) {
        const status = Number(error && (error.statusCode || error.status));
        if (status === 404 || status === 410) {
          await store.upsertSubscription(Object.assign({}, record, {
            active: false,
            updated_at: new Date().toISOString()
          }));
        }
        if (typeof options.onError === "function") options.onError(error, notification, record);
      }
    }));
    return { attempted: (subscriptions || []).length, delivered };
  }

  async function createNotification(input) {
    const notification = normalizeNotification(input);
    const existing = await store.listNotifications(notification.tenant_id, 2000);
    const duplicate = (existing || []).find(function (row) { return row.id === notification.id; });
    if (duplicate) return duplicate;
    await store.appendNotification(notification);
    events.emit("tenant:" + notification.tenant_id, notification);
    deliverPush(notification).catch(function (error) {
      if (typeof options.onError === "function") options.onError(error, notification, null);
    });
    if (emailDelivery && typeof emailDelivery.scheduleNotification === "function") {
      emailDelivery.scheduleNotification(notification).catch(function (error) {
        if (typeof options.onError === "function") options.onError(error, notification, null);
      });
    }
    return notification;
  }

  async function createHandoff(input) {
    return createNotification(Object.assign({}, input, { type: "human_handoff_required" }));
  }

  async function createOrder(input) {
    return createNotification(Object.assign({}, input, { type: "customer_order_created" }));
  }

  async function createAppointment(input) {
    return createNotification(Object.assign({}, input, { type: "appointment_created" }));
  }

  async function markRead(tenantId, actorId, notificationId) {
    const cleanTenant = tenant(tenantId);
    const cleanActor = actor(actorId);
    const id = text(notificationId, 120);
    const rows = await store.listNotifications(cleanTenant, 200);
    const notification = (rows || []).find(function (row) { return row.id === id; });
    if (!notification) {
      const error = new Error("notification_not_found");
      error.status = 404;
      throw error;
    }
    await store.appendRead({
      version: 1,
      tenant_id: cleanTenant,
      actor_id: cleanActor,
      notification_id: id,
      read_at: new Date().toISOString()
    });
    return notification;
  }

  async function subscribe(tenantId, actorId, subscription) {
    const record = normalizeSubscription(subscription, tenantId, actorId);
    await store.upsertSubscription(record);
    return { id: record.id, active: true };
  }

  async function unsubscribe(tenantId, actorId, endpoint) {
    const cleanTenant = tenant(tenantId);
    const cleanActor = actor(actorId);
    const cleanEndpoint = text(endpoint, 3000);
    if (!cleanTenant || !cleanActor || !/^https:\/\//i.test(cleanEndpoint)) throw new Error("push_subscription_invalid");
    const id = crypto.createHash("sha256").update(cleanEndpoint).digest("hex");
    await store.upsertSubscription({
      version: 1,
      id,
      tenant_id: cleanTenant,
      actor_id: cleanActor,
      endpoint: cleanEndpoint,
      expirationTime: null,
      keys: { p256dh: "", auth: "" },
      active: false,
      updated_at: new Date().toISOString()
    });
    return { id, active: false };
  }

  async function unsubscribeActor(tenantId, actorId) {
    const cleanTenant = tenant(tenantId);
    const cleanActor = actor(actorId);
    if (!cleanTenant || !cleanActor) throw new Error("push_subscription_scope_required");
    const subscriptions = await store.listSubscriptions(cleanTenant);
    const owned = (subscriptions || []).filter(function (record) {
      return record.actor_id === cleanActor && record.active === true;
    });
    await Promise.all(owned.map(function (record) {
      return store.upsertSubscription(Object.assign({}, record, {
        active: false,
        updated_at: new Date().toISOString()
      }));
    }));
    return { disabled: owned.length };
  }

  return {
    events,
    createHandoff,
    createOrder,
    createAppointment,
    list,
    markRead,
    subscribe,
    unsubscribe,
    unsubscribeActor,
    pushAvailable: !!pushSender,
    emailAvailable: !!(emailDelivery && emailDelivery.available)
  };
}

module.exports = {
  CUSTOMER_NOTIFICATION_TOOL,
  CUSTOMER_NOTIFICATION_READ_TOOL,
  CUSTOMER_PUSH_SUBSCRIPTION_TOOL,
  InMemoryCustomerNotificationStore,
  createCustomerNotificationService,
  normalizeNotification,
  normalizeSubscription
};
