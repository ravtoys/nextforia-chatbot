"use strict";

const assert = require("assert");
const {
  InMemorySetupEmailJourneyStore,
  createSetupEmailJourneyService
} = require("./setup-email-journey-service");

(async function () {
  const now = new Date("2026-08-15T18:00:00.000Z");
  const sent = [];
  const store = new InMemorySetupEmailJourneyStore();
  const service = createSetupEmailJourneyService({
    store,
    now: function () { return now; },
    sender: { send: async function (message) { sent.push(message); return { id: "provider-1" }; } },
    shouldSend: async function (row) { return row.tenant_id !== "cancelled-tenant"; }
  });
  const base = {
    tenant_id: "tenant-a",
    to: "admin@tenant-a.com",
    template: "welcome",
    dedupe_key: "welcome:tenant-a",
    send_after: now.toISOString(),
    payload: { name: "Ana" }
  };
  await service.schedule(base);
  await service.schedule(base);
  assert.strictEqual(store.rows.length, 1);
  const outcome = await service.processDue();
  assert.deepStrictEqual(outcome, { claimed: 1, sent: 1, cancelled: 0, failed: 0 });
  assert.strictEqual(sent[0].to, "admin@tenant-a.com");
  assert.strictEqual(store.rows[0].status, "sent");

  await service.schedule({
    tenant_id: "cancelled-tenant",
    to: "admin@cancelled.com",
    template: "training_incomplete",
    dedupe_key: "draft:cancelled",
    send_after: now.toISOString()
  });
  const cancelled = await service.processDue();
  assert.strictEqual(cancelled.cancelled, 1);
  assert.strictEqual(store.rows[1].status, "cancelled");
  console.log("setup-email-journey-service.test.js: ok");
})().catch(function (error) {
  console.error(error.stack || error.message);
  process.exit(1);
});
