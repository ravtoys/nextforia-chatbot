"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const http = require("http");
const net = require("net");
const path = require("path");

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
    const timer = setTimeout(function () { reject(new Error("server_start_timeout\n" + output)); }, 15000);
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

function readBody(req) {
  return new Promise(function (resolve) {
    let raw = "";
    req.on("data", function (chunk) { raw += chunk; });
    req.on("end", function () {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (_) { resolve({}); }
    });
  });
}

function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}

async function startSupabaseWithBrokenReminderWrites() {
  const appointments = [];
  const conversationRows = [];
  let rejectedReminderWrites = 0;
  const server = http.createServer(async function (req, res) {
    const url = new URL(req.url, "http://127.0.0.1");
    const table = url.pathname.replace(/^\/rest\/v1\//, "");
    if (table === "appointments" && req.method === "GET") return json(res, 200, appointments);
    if (table === "appointments" && req.method === "POST") {
      const row = await readBody(req);
      const index = appointments.findIndex(function (item) {
        return item.tenant_id === row.tenant_id && item.appointment_id === row.appointment_id;
      });
      if (index >= 0) appointments[index] = row;
      else appointments.push(row);
      return json(res, 201, {});
    }
    if (table === "appointment_reminders" && req.method === "GET") return json(res, 200, []);
    if (table === "appointment_reminders" && req.method === "POST") {
      rejectedReminderWrites += 1;
      return json(res, 503, { message: "simulated_reminder_store_outage" });
    }
    if (table === "conversation_logs" && req.method === "GET") return json(res, 200, conversationRows.slice().reverse());
    if (table === "conversation_logs" && req.method === "POST") {
      const row = await readBody(req);
      conversationRows.push(row);
      return json(res, 201, {});
    }
    return json(res, 200, []);
  });
  const port = await new Promise(function (resolve, reject) {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", function () { resolve(server.address().port); });
  });
  return {
    origin: "http://127.0.0.1:" + port,
    rejectedReminderWrites: function () { return rejectedReminderWrites; },
    close: function () { return new Promise(function (resolve) { server.close(resolve); }); }
  };
}

function signature(body, secret, timestamp) {
  return "t=" + timestamp + ",v0=" + crypto.createHmac("sha256", secret).update(timestamp + "." + body).digest("hex");
}

(async function run() {
  const supabase = await startSupabaseWithBrokenReminderWrites();
  const port = await availablePort();
  const base = "http://127.0.0.1:" + port;
  const secret = "appointment-panel-read-resilience-secret";
  const password = "AppointmentReadResilience!";
  const fixture = [{
    user_id: "ddddd111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tenant_id: "agenda-resilience-tenant",
    company_name: "Agenda Resilience",
    email: "agenda-resilience@example.test",
    password,
    role: "admin",
    plan_id: "nextfor-tempo",
    assigned_bot_id: "agendamiento",
    tenant_status: "active"
  }];
  const child = childProcess.spawn(process.execPath, [path.join(__dirname, "index.js")], {
    cwd: __dirname,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      NODE_ENV: "test",
      ALLOW_SELF_HOSTED_SUPABASE: "1",
      SUPABASE_URL: supabase.origin,
      SUPABASE_KEY: "test-service-key",
      SUPABASE_TENANT_COLUMNS_ENABLED: "1",
      SUPABASE_APPOINTMENTS_ENABLED: "1",
      DASHBOARD_SESSION_SECRET: "appointment-panel-read-resilience-session",
      VERIFY_TOKEN: "appointment-panel-read-resilience-verify",
      WA_TOKEN: "appointment-panel-read-resilience-not-used",
      ANTHROPIC_API_KEY: "appointment-panel-read-resilience-not-used",
      ELEVENLABS_WEBHOOK_SECRET: secret,
      ELEVENLABS_AGENT_TENANT_MAP: JSON.stringify({ agent_resilience: "agenda-resilience-tenant" }),
      CUSTOMER_ACCESS_TEST_MODE: "1",
      CUSTOMER_ACCESS_TEST_USERS: JSON.stringify(fixture),
      CUSTOMER_PANEL_BASE_URL: "https://customer-panel-read-resilience.example.test",
      APPOINTMENT_PANEL_V2_ENABLED: "1",
      APPOINTMENT_REMINDERS_V1_ENABLED: "1",
      APPOINTMENT_REMINDER_SENDS_ENABLED: "0"
    }),
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer(child, port);
    let response = await fetch(base + "/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ email: fixture[0].email, password })
    });
    assert.strictEqual(response.status, 200);
    const cookie = String(response.headers.get("set-cookie") || "").split(";")[0];
    response = await fetch(base + "/admin/panel/appointment-settings", { headers: { cookie } });
    assert.strictEqual(response.status, 200);
    const settings = await response.json();
    response = await fetch(base + "/admin/panel/appointment-settings", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie, origin: base },
      body: JSON.stringify({
        revision: settings.revision,
        settings: { reminder_policy: { enabled: true, channel: "whatsapp", offsets_minutes: [1440] } }
      })
    });
    assert.strictEqual(response.status, 200);
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      type: "post_call_transcription",
      event_timestamp: timestamp,
      data: {
        agent_id: "agent_resilience",
        conversation_id: "resilience-conversation",
        analysis: {
          data_collection_results: {
            appointment_id: { value: "resilience-appointment" },
            appointment_status: { value: "booked" },
            appointment_datetime: { value: "2030-07-21T09:00:00-05:00" },
            client_name: { value: "Cliente Agenda" },
            consultation_reason: { value: "Consulta" },
            data_processing_consent: { value: "authorized" }
          }
        }
      }
    });
    response = await fetch(base + "/webhooks/elevenlabs/post-call", {
      method: "POST",
      headers: { "content-type": "application/json", "elevenlabs-signature": signature(body, secret, timestamp) },
      body
    });
    assert.strictEqual(response.status, 200, "a reminder-store outage must not fail a real appointment");
    assert(supabase.rejectedReminderWrites() > 0, "fixture must exercise the failed reminder write");

    response = await fetch(base + "/admin/panel/appointments-data", { headers: { cookie } });
    assert.strictEqual(response.status, 200, "the agenda must load even while reminder writes are unavailable");
    const payload = await response.json();
    assert.strictEqual(payload.appointments.length, 1);
    assert.strictEqual(payload.appointments[0].customer_name, "Cliente Agenda");
    assert.strictEqual(payload.tenant_id, "agenda-resilience-tenant");
    console.log("appointment panel read resilience e2e tests: ok");
  } finally {
    child.kill("SIGTERM");
    await supabase.close();
  }
})().catch(function (error) {
  console.error(error.stack || error.message);
  process.exit(1);
});
