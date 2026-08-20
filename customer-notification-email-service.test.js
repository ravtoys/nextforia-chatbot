"use strict";

const assert = require("assert");
const {
  InMemoryCustomerNotificationEmailStore,
  createCustomerNotificationEmailService
} = require("./customer-notification-email-service");

(async function () {
  const store = new InMemoryCustomerNotificationEmailStore();
  const sent = [];
  const active = new Set(["tenant-a:admin@a.example", "tenant-b:admin@b.example"]);
  const service = createCustomerNotificationEmailService({
    store,
    available: true,
    baseUrl: "https://staging.nextforia.com",
    recipientAllowed: async function (record) {
      return active.has(record.tenant_id + ":" + record.recipient);
    },
    sender: {
      send: async function (message) {
        sent.push(message);
        return { id: "email-" + sent.length };
      }
    }
  });

  let preferences = await service.getPreferences({ tenant_id: "tenant-a", actor_id: "admin@a.example" });
  assert.strictEqual(preferences.enabled, false, "email must be opt-in");
  assert.strictEqual(preferences.recipient, "admin@a.example");
  assert.strictEqual(preferences.available, true);

  preferences = await service.savePreferences({ tenant_id: "tenant-a", actor_id: "admin@a.example", recipient: "admin@a.example" }, {
    enabled: true,
    types: { payment_pending: true, human_attention: true, shipping_pending: false }
  });
  assert.strictEqual(preferences.enabled, true);
  await assert.rejects(
    service.savePreferences({ tenant_id: "tenant-a", actor_id: "admin@a.example", recipient: "other@a.example" }, { enabled: true }),
    /membership_required/
  );

  await service.savePreferences({ tenant_id: "tenant-b", actor_id: "admin@b.example", recipient: "admin@b.example" }, { enabled: true });
  let scheduled = await service.scheduleNotification({
    id: "handoff-a-1",
    tenant_id: "tenant-a",
    type: "human_handoff_required",
    conversation_id: "wa:573010000001",
    customer_label: "Cliente A",
    channel: "whatsapp",
    action_url: "/admin/panel?tab=conversations&conversation=wa%3A573010000001"
  });
  assert.strictEqual(scheduled.scheduled, 1);
  assert.strictEqual(store.deliveries.length, 1);
  assert.strictEqual(store.deliveries[0].tenant_id, "tenant-a");
  assert.strictEqual(store.deliveries[0].recipient, "admin@a.example");

  scheduled = await service.scheduleNotification({ id: "handoff-a-1", tenant_id: "tenant-a", type: "human_handoff_required", conversation_id: "wa:573010000001" });
  assert.strictEqual(store.deliveries.length, 1, "replayed notification must not duplicate email");
  assert.strictEqual(scheduled.scheduled, 1);

  let outcome = await service.processDue();
  assert.deepStrictEqual(outcome, { claimed: 1, sent: 1, cancelled: 0, failed: 0 });
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].to, "admin@a.example");
  assert.strictEqual(sent[0].tenant_id, "tenant-a");

  await service.scheduleNotification({ id: "order-a-1", tenant_id: "tenant-a", type: "customer_order_created", order_id: "order-a", customer_label: "Cliente A" });
  active.delete("tenant-a:admin@a.example");
  outcome = await service.processDue();
  assert.strictEqual(outcome.cancelled, 1, "disabled membership must cancel queued email");
  assert.strictEqual(sent.length, 1);

  const unavailable = createCustomerNotificationEmailService({ available: false, store: new InMemoryCustomerNotificationEmailStore() });
  const disabled = await unavailable.getPreferences({ tenant_id: "tenant-a", actor_id: "admin@a.example" });
  assert.strictEqual(disabled.available, false);
  await assert.rejects(
    unavailable.savePreferences({ tenant_id: "tenant-a", actor_id: "admin@a.example" }, { enabled: true }),
    /unavailable/
  );

  console.log("customer-notification-email-service.test.js: ok");
})().catch(function (error) {
  console.error(error.stack || error.message);
  process.exit(1);
});
