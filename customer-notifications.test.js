"use strict";

const assert = require("assert");
const {
  InMemoryCustomerNotificationStore,
  createCustomerNotificationService,
  normalizeNotification
} = require("./customer-notifications");

(async function run() {
  const store = new InMemoryCustomerNotificationStore();
  const pushes = [];
  const emails = [];
  const service = createCustomerNotificationService({
    store,
    emailDelivery: {
      available: true,
      scheduleNotification: async function (notification) { emails.push(notification.id); }
    },
    pushSender: {
      send: async function (subscription, payload) {
        pushes.push({ subscription, payload });
      }
    }
  });
  const eventsA = [];
  const eventsB = [];
  service.events.on("tenant:tenant-a", function (event) { eventsA.push(event); });
  service.events.on("tenant:tenant-b", function (event) { eventsB.push(event); });

  await service.subscribe("tenant-a", "admin-a", {
    endpoint: "https://push.example/subscription-a",
    keys: { p256dh: "public-key-a", auth: "auth-a" }
  });
  await service.subscribe("tenant-b", "admin-b", {
    endpoint: "https://push.example/subscription-b",
    keys: { p256dh: "public-key-b", auth: "auth-b" }
  });

  const created = await service.createHandoff({
    id: "handoff-a-1",
    tenant_id: "tenant-a",
    conversation_id: "ig:customer-a",
    channel: "instagram",
    customer_label: "@cliente_a",
    reason: "solicitud_cliente"
  });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.strictEqual(created.tenant_id, "tenant-a");
  assert.strictEqual(created.action_url, "/admin/panel?tab=conversations&conversation=ig%3Acustomer-a");
  assert.strictEqual(eventsA.length, 1);
  assert.strictEqual(eventsB.length, 0);
  assert.strictEqual(pushes.length, 1);
  assert.strictEqual(pushes[0].subscription.endpoint, "https://push.example/subscription-a");
  assert.deepStrictEqual(emails, ["handoff-a-1"]);

  const orderStore = new InMemoryCustomerNotificationStore();
  const orderPushes = [];
  const orderEventsA = [];
  const orderEventsB = [];
  const orderService = createCustomerNotificationService({
    store: orderStore,
    pushSender: {
      send: async function (subscription, payload) {
        orderPushes.push({ subscription, payload });
      }
    }
  });
  orderService.events.on("tenant:tenant-a", function (event) { orderEventsA.push(event); });
  orderService.events.on("tenant:tenant-b", function (event) { orderEventsB.push(event); });
  await orderService.subscribe("tenant-a", "admin-a", {
    endpoint: "https://push.example/order-subscription-a",
    keys: { p256dh: "order-public-key-a", auth: "order-auth-a" }
  });
  const orderCreated = await orderService.createOrder({
    id: "order-notification-a-1",
    tenant_id: "tenant-a",
    order_id: "order-a-1001",
    conversation_id: "wa:573010000001",
    channel: "whatsapp",
    customer_label: "Cliente pedido A"
  });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.strictEqual(orderCreated.type, "customer_order_created");
  assert.strictEqual(orderCreated.action_url, "/admin/panel?tab=orders&order=order-a-1001");
  assert.strictEqual(orderCreated.action_label, "Ver pedido");
  assert.strictEqual(orderEventsA.length, 1);
  assert.strictEqual(orderEventsB.length, 0);
  assert.strictEqual(orderPushes.length, 1);
  assert.strictEqual(orderPushes[0].payload.tag, "nextfor-order-order-a-1001");
  assert.strictEqual((await orderService.list("tenant-a", "admin-a", 20)).count, 1);
  assert.strictEqual((await orderService.list("tenant-b", "admin-b", 20)).count, 0);
  await orderService.createOrder({
    id: "order-notification-a-1",
    tenant_id: "tenant-a",
    order_id: "order-a-1001"
  });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.strictEqual(orderEventsA.length, 1, "an order replay must not alert twice");
  assert.strictEqual(orderPushes.length, 1, "an order replay must not push twice");

  const appointmentCreated = await orderService.createAppointment({
    id: "appointment-notification-a-1",
    tenant_id: "tenant-a",
    appointment_id: "appointment-a-1001",
    conversation_id: "wa:573010000001",
    channel: "whatsapp",
    customer_label: "Cliente cita A"
  });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.strictEqual(appointmentCreated.type, "appointment_created");
  assert.strictEqual(appointmentCreated.action_url, "/admin/panel?tab=appointments&appointment=appointment-a-1001");
  assert.strictEqual(appointmentCreated.action_label, "Ver cita");
  assert.strictEqual(orderEventsA.length, 2);
  assert.strictEqual(orderEventsB.length, 0);
  assert.strictEqual(orderPushes.length, 2);
  assert.strictEqual(orderPushes[1].payload.tag, "nextfor-appointment-appointment-a-1001");
  await orderService.createAppointment({
    id: "appointment-notification-a-1",
    tenant_id: "tenant-a",
    appointment_id: "appointment-a-1001"
  });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.strictEqual(orderEventsA.length, 2, "an appointment replay must not alert twice");
  assert.strictEqual(orderPushes.length, 2, "an appointment replay must not push twice");

  const duplicate = await service.createHandoff({
    id: "handoff-a-1",
    tenant_id: "tenant-a",
    conversation_id: "ig:customer-a"
  });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.strictEqual(duplicate.id, "handoff-a-1");
  assert.strictEqual(eventsA.length, 1, "a replay must not alert twice");
  assert.strictEqual(pushes.length, 1, "a replay must not push twice");
  assert.deepStrictEqual(emails, ["handoff-a-1"], "a replay must not email twice");

  let list = await service.list("tenant-a", "admin-a", 20);
  assert.strictEqual(list.count, 1);
  assert.strictEqual(list.unread_count, 1);
  assert.strictEqual((await service.list("tenant-b", "admin-b", 20)).count, 0);
  await service.markRead("tenant-a", "admin-a", created.id);
  list = await service.list("tenant-a", "admin-a", 20);
  assert.strictEqual(list.unread_count, 0);
  assert.strictEqual((await service.list("tenant-a", "agent-a", 20)).unread_count, 1, "read state is per user");

  assert.strictEqual((await service.unsubscribeActor("tenant-a", "admin-a")).disabled, 1);
  await service.createHandoff({
    id: "handoff-a-2",
    tenant_id: "tenant-a",
    conversation_id: "wa:573010000000"
  });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.strictEqual(pushes.length, 1, "a logged-out actor must not keep receiving push alerts");

  const guardedStore = new InMemoryCustomerNotificationStore();
  const guardedPushes = [];
  const guarded = createCustomerNotificationService({
    store: guardedStore,
    subscriptionAllowed: async function (record) { return record.actor_id === "active@a.example"; },
    pushSender: { send: async function (subscription) { guardedPushes.push(subscription.endpoint); } }
  });
  await guarded.subscribe("tenant-a", "inactive@a.example", {
    endpoint: "https://push.example/inactive",
    keys: { p256dh: "inactive-key", auth: "inactive-auth" }
  });
  await guarded.createHandoff({ id: "handoff-guarded", tenant_id: "tenant-a", conversation_id: "573010000001" });
  await new Promise(function (resolve) { setImmediate(resolve); });
  assert.deepStrictEqual(guardedPushes, [], "inactive memberships must not receive push alerts");
  assert.strictEqual((await guardedStore.listSubscriptions("tenant-a")).length, 0);

  await assert.rejects(
    service.markRead("tenant-b", "admin-b", created.id),
    /notification_not_found/
  );
  assert.throws(function () {
    normalizeNotification({ tenant_id: "", conversation_id: "customer" });
  }, /notification_tenant_required/);
  assert.throws(function () {
    normalizeNotification({ tenant_id: "tenant-a", conversation_id: "" });
  }, /notification_conversation_required/);
  assert.throws(function () {
    normalizeNotification({ type: "customer_order_created", tenant_id: "tenant-a", order_id: "" });
  }, /notification_order_required/);
  assert.throws(function () {
    normalizeNotification({ type: "appointment_created", tenant_id: "tenant-a", appointment_id: "" });
  }, /notification_appointment_required/);

  console.log("customer-notifications.test.js OK");
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
