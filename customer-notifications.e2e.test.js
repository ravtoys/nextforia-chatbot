"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const net = require("net");
const path = require("path");
const webPush = require("web-push");

function availablePort() {
  return new Promise(function (resolve, reject) {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", function () {
      const port = server.address().port;
      server.close(function () { resolve(port); });
    });
  });
}

function waitForServer(child, port) {
  return new Promise(function (resolve, reject) {
    let output = "";
    const timer = setTimeout(function () { reject(new Error("server_start_timeout\n" + output)); }, 30000);
    function inspect(chunk) {
      output += String(chunk || "");
      if (output.includes("running on port " + port)) {
        clearTimeout(timer);
        resolve();
      }
    }
    child.stdout.on("data", inspect);
    child.stderr.on("data", inspect);
    child.once("exit", function (code) {
      clearTimeout(timer);
      reject(new Error("server_exited_" + code + "\n" + output));
    });
  });
}

async function login(base, email) {
  const response = await fetch(base + "/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ email, password: "TenantPassword2026" })
  });
  assert.strictEqual(response.status, 200);
  return String(response.headers.get("set-cookie") || "").split(";")[0];
}

async function json(base, pathName, cookie, options) {
  options = options || {};
  const response = await fetch(base + pathName, Object.assign({}, options, {
    headers: Object.assign({ accept: "application/json", cookie, origin: base }, options.headers || {})
  }));
  const body = await response.json();
  return { response, body };
}

async function openEvents(base, cookie) {
  const controller = new AbortController();
  const response = await fetch(base + "/admin/panel/notifications/events", {
    headers: { accept: "text/event-stream", cookie },
    signal: controller.signal
  });
  assert.strictEqual(response.status, 200);
  return { controller, reader: response.body.getReader(), decoder: new TextDecoder(), buffer: "" };
}

async function nextEvent(stream, expectedName, timeoutMs) {
  const timeout = setTimeout(function () { stream.controller.abort(); }, timeoutMs || 5000);
  try {
    while (true) {
      let boundary = stream.buffer.indexOf("\n\n");
      if (boundary >= 0) {
        const block = stream.buffer.slice(0, boundary);
        stream.buffer = stream.buffer.slice(boundary + 2);
        const event = (block.match(/^event:\s*(.+)$/m) || [])[1] || "message";
        const data = (block.match(/^data:\s*(.*)$/m) || [])[1] || "{}";
        if (event === expectedName) return JSON.parse(data);
        continue;
      }
      const chunk = await stream.reader.read();
      if (chunk.done) throw new Error("event_stream_closed");
      stream.buffer += stream.decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, "\n");
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForOutbox(base, cookie, count) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const result = await json(base, "/admin/test/customer-notification-email-outbox", cookie);
    if (result.body.count >= count) return result.body;
    await new Promise(function (resolve) { setTimeout(resolve, 50); });
  }
  throw new Error("notification_email_outbox_timeout");
}

(async function run() {
  const port = await availablePort();
  const base = "http://127.0.0.1:" + port;
  const vapid = webPush.generateVAPIDKeys();
  const fixtures = [
    { user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", tenant_id: "tenant-a", company_name: "Empresa A", email: "admin@a.example", password: "TenantPassword2026", role: "admin", plan_id: "nextfor-aura", assigned_bot_id: "atencion-cliente" },
    { user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", tenant_id: "tenant-b", company_name: "Empresa B", email: "admin@b.example", password: "TenantPassword2026", role: "admin", plan_id: "nextfor-aura", assigned_bot_id: "atencion-cliente" }
  ];
  const child = childProcess.spawn(process.execPath, [path.join(__dirname, "index.js")], {
    cwd: __dirname,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      NODE_ENV: "test",
      DASHBOARD_KEY: "notification-e2e-dashboard-key",
      DASHBOARD_SESSION_SECRET: "notification-e2e-session-secret-value-long",
      VERIFY_TOKEN: "notification-e2e-verify",
      WA_TOKEN: "notification-e2e-wa-token",
      PHONE_NUMBER_ID: "notification-e2e-phone",
      ANTHROPIC_API_KEY: "notification-e2e-anthropic",
      DATA_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64url"),
      CUSTOMER_ACCESS_V2_ENABLED: "1",
      CUSTOMER_ACCESS_TEST_MODE: "1",
      CUSTOMER_NOTIFICATION_EMAIL_TEST_MODE: "1",
      CUSTOMER_ACCESS_TEST_USERS: JSON.stringify(fixtures),
      PUBLIC_BASE_URL: "https://test.nextforia.example",
      CUSTOMER_PANEL_BASE_URL: "https://test.nextforia.example",
      WEB_PUSH_VAPID_PUBLIC_KEY: vapid.publicKey,
      WEB_PUSH_VAPID_PRIVATE_KEY: vapid.privateKey,
      WEB_PUSH_VAPID_SUBJECT: "mailto:test@nextforia.example",
      SUPABASE_URL: "",
      SUPABASE_KEY: ""
    }),
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer(child, port);
    const cookieA = await login(base, "admin@a.example");
    const cookieB = await login(base, "admin@b.example");
    let emailPreferences = await json(base, "/admin/panel/notifications/email-preferences", cookieA);
    assert.strictEqual(emailPreferences.response.status, 200);
    assert.strictEqual(emailPreferences.body.preferences.enabled, false);
    assert.strictEqual(emailPreferences.body.preferences.recipient, "admin@a.example");
    emailPreferences = await json(base, "/admin/panel/notifications/email-preferences", cookieA, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled: true,
        types: { payment_pending: true, shipping_pending: false, sales_opportunity: false, product_update: false, human_attention: true }
      })
    });
    assert.strictEqual(emailPreferences.response.status, 200);
    assert.strictEqual(emailPreferences.body.preferences.enabled, true);
    const preferencesB = await json(base, "/admin/panel/notifications/email-preferences", cookieB);
    assert.strictEqual(preferencesB.body.preferences.enabled, false, "tenant B must not inherit tenant A email preferences");
    const streamA = await openEvents(base, cookieA);
    await nextEvent(streamA, "ready", 3000);

    let result = await json(base, "/admin/test/human-handoff-notification", cookieA, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversation_id: "ig:178500000001", message: "Quiero hablar con alguien" })
    });
    assert.strictEqual(result.response.status, 200);
    const event = await nextEvent(streamA, "notification", 5000);
    assert.strictEqual(event.tenant_id, "tenant-a");
    assert.strictEqual(event.conversation_id, "ig:178500000001");
    assert.strictEqual(event.type, "human_handoff_required");
    assert(event.action_url.includes("conversation=ig%3A178500000001"));
    streamA.controller.abort();
    const handoffEmailsA = await waitForOutbox(base, cookieA, 1);
    assert.strictEqual(handoffEmailsA.items[0].template, "human_attention");
    assert.strictEqual(handoffEmailsA.items[0].tenant_id, "tenant-a");
    assert.strictEqual(handoffEmailsA.items[0].to, "admin@a.example");
    const handoffEmailsB = await json(base, "/admin/test/customer-notification-email-outbox", cookieB);
    assert.strictEqual(handoffEmailsB.body.count, 0, "tenant B must never see or receive tenant A email delivery");

    result = await json(base, "/admin/panel/notifications", cookieA);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.unread_count, 1);
    assert.strictEqual(result.body.items[0].id, event.id);
    assert.strictEqual(result.body.push_available, true);
    assert.strictEqual(result.body.push_public_key, vapid.publicKey);

    const isolated = await json(base, "/admin/panel/notifications", cookieB);
    assert.strictEqual(isolated.response.status, 200);
    assert.strictEqual(isolated.body.count, 0);
    const crossTenantRead = await json(base, "/admin/panel/notifications/" + encodeURIComponent(event.id) + "/read", cookieB, { method: "POST" });
    assert.strictEqual(crossTenantRead.response.status, 404);

    const read = await json(base, "/admin/panel/notifications/" + encodeURIComponent(event.id) + "/read", cookieA, { method: "POST" });
    assert.strictEqual(read.response.status, 200);
    result = await json(base, "/admin/panel/notifications", cookieA);
    assert.strictEqual(result.body.unread_count, 0);

    const orderStreamA = await openEvents(base, cookieA);
    await nextEvent(orderStreamA, "ready", 3000);
    const orderResult = await json(base, "/admin/test/customer-order-notification", cookieA, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        order_id: "order-a-1001",
        order_number: "A-1001",
        conversation_id: "wa:573010000001",
        name: "Cliente pedido A"
      })
    });
    assert.strictEqual(orderResult.response.status, 200);
    assert.strictEqual(orderResult.body.tenant_id, "tenant-a");
    const orderEvent = await nextEvent(orderStreamA, "notification", 5000);
    assert.strictEqual(orderEvent.type, "customer_order_created");
    assert.strictEqual(orderEvent.tenant_id, "tenant-a");
    assert.strictEqual(orderEvent.order_id, "order-a-1001");
    assert.strictEqual(orderEvent.action_url, "/admin/panel?tab=orders&order=order-a-1001");
    orderStreamA.controller.abort();
    const orderEmailsA = await waitForOutbox(base, cookieA, 2);
    assert.strictEqual(orderEmailsA.items[1].template, "payment_pending");
    assert.strictEqual((await json(base, "/admin/test/customer-notification-email-outbox", cookieB)).body.count, 0);

    result = await json(base, "/admin/panel/notifications", cookieA);
    assert.strictEqual(result.body.unread_count, 1);
    assert.strictEqual(result.body.items[0].id, orderEvent.id);
    assert.strictEqual(result.body.items[0].action_label, "Ver pedido");
    const isolatedAfterOrder = await json(base, "/admin/panel/notifications", cookieB);
    assert.strictEqual(isolatedAfterOrder.response.status, 200);
    assert.strictEqual(isolatedAfterOrder.body.count, 0, "tenant B must never see tenant A order notifications");
    const crossTenantOrderRead = await json(base, "/admin/panel/notifications/" + encodeURIComponent(orderEvent.id) + "/read", cookieB, { method: "POST" });
    assert.strictEqual(crossTenantOrderRead.response.status, 404);

    const ordersA = await json(base, "/admin/panel/orders-data", cookieA);
    assert.strictEqual(ordersA.response.status, 200);
    assert(ordersA.body.orders.some(function (order) { return order.id === "order-a-1001"; }));
    const ordersB = await json(base, "/admin/panel/orders-data", cookieB);
    assert.strictEqual(ordersB.response.status, 200);
    assert.strictEqual(ordersB.body.orders.some(function (order) { return order.id === "order-a-1001"; }), false);

    let response = await fetch(base + "/admin/panel?tab=conversations&conversation=ig%3A178500000001", { headers: { cookie: cookieA } });
    assert.strictEqual(response.status, 200);
    const panel = await response.text();
    assert(panel.includes('INITIAL_CONVERSATION="ig:178500000001"'));
    assert(panel.includes("startNotificationStream()"));
    assert(panel.includes("playNotificationSound()"));
    assert(panel.includes("pushManager.subscribe"));
    response = await fetch(base + "/admin/panel?tab=orders&order=order-a-1001", { headers: { cookie: cookieA } });
    assert.strictEqual(response.status, 200);
    const orderPanel = await response.text();
    assert(orderPanel.includes('INITIAL_ORDER="order-a-1001"'));
    assert(orderPanel.includes('id="navOrderCount"'));
    assert(orderPanel.includes('id="mnavOrderCount"'));
    assert(orderPanel.includes('function renderOrderBadges()'));
    assert(orderPanel.includes('item.type==="customer_order_created"'));
    response = await fetch(base + "/admin/panel-demo?tab=orders&order=1042");
    assert.strictEqual(response.status, 200);
    const demoOrderPanel = await response.text();
    assert(demoOrderPanel.includes('INITIAL_ORDER="1042"'), "demo notification links must preserve the exact order on mobile and desktop");
    response = await fetch(base + "/admin/customer-notification-sw.js", { headers: { cookie: cookieA } });
    assert.strictEqual(response.status, 200);
    const serviceWorker = await response.text();
    assert(serviceWorker.includes('self.addEventListener("push"'));
    assert(serviceWorker.includes('self.addEventListener("notificationclick"'));

    console.log("customer-notifications.e2e.test.js OK");
  } finally {
    child.kill("SIGTERM");
  }
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
