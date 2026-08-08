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

function signedSessionCookie(secret, user) {
  const payload = Buffer.from(JSON.stringify({
    v: 2,
    rst: "customer-access-membership-only-2026-08-08",
    uid: user.user_id,
    e: user.email,
    n: user.email,
    r: user.role,
    t: user.tenant_id,
    mv: 1,
    exp: Date.now() + 60 * 60 * 1000
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return "nextforia_dashboard_session=" + encodeURIComponent(payload + "." + signature);
}

async function requestJson(base, pathName, cookie, options) {
  const response = await fetch(base + pathName, Object.assign({ headers: { cookie } }, options || {}));
  return { response, body: await response.json() };
}

async function startPersistentStore() {
  const rows = [];
  const port = await availablePort();
  const server = http.createServer(function (req, res) {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "POST" && url.pathname === "/rest/v1/conversation_logs") {
      let raw = "";
      req.on("data", function (chunk) { raw += chunk; });
      req.on("end", function () {
        const row = JSON.parse(raw || "{}");
        row.id = rows.length + 1;
        rows.push(row);
        res.writeHead(201, { "content-type": "application/json" });
        res.end("{}");
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/rest/v1/conversation_logs") {
      let result = rows.slice();
      const userFilter = String(url.searchParams.get("user_id") || "").replace(/^eq\./, "");
      const tenantFilter = String(url.searchParams.get("tenant_id") || "").replace(/^eq\./, "");
      if (userFilter) result = result.filter(function (row) { return row.user_id === userFilter; });
      if (tenantFilter) result = result.filter(function (row) { return row.tenant_id === tenantFilter; });
      result.sort(function (a, b) { return String(b.ts).localeCompare(String(a.ts)); });
      result = result.slice(0, Number(url.searchParams.get("limit")) || 20);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end("[]");
  });
  await new Promise(function (resolve) { server.listen(port, "127.0.0.1", resolve); });
  return { server, rows, url: "http://127.0.0.1:" + port };
}

async function startApp(secret, users, supabaseUrl) {
  const port = await availablePort();
  const child = childProcess.spawn(process.execPath, [path.join(__dirname, "index.js")], {
    cwd: __dirname,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      NODE_ENV: "test",
      DASHBOARD_KEY: "configuration-persistence-key",
      DASHBOARD_SESSION_SECRET: secret,
      DASHBOARD_USERS: "[]",
      VERIFY_TOKEN: "configuration-persistence-verify",
      WA_TOKEN: "configuration-persistence-wa",
      ANTHROPIC_API_KEY: "configuration-persistence-ai",
      CUSTOMER_ACCESS_V2_ENABLED: "1",
      CUSTOMER_ACCESS_TEST_MODE: "1",
      CUSTOMER_ACCESS_TEST_FORCE_SCHEMA_UNAVAILABLE: "1",
      CUSTOMER_ACCESS_TEST_USERS: JSON.stringify(users),
      CUSTOMER_PANEL_BASE_URL: "https://customer-panel.persistence.test",
      SUPABASE_URL: supabaseUrl,
      SUPABASE_KEY: "configuration-persistence-supabase-key",
      SUPABASE_TABLE: "conversation_logs",
      SUPABASE_TENANT_COLUMNS_ENABLED: "1",
      ALLOW_SELF_HOSTED_SUPABASE: "1"
    }),
    stdio: ["ignore", "pipe", "pipe"]
  });
  await waitForServer(child, port);
  return { child, base: "http://127.0.0.1:" + port };
}

(async function run() {
  const secret = "configuration-persistence-session-secret";
  const fixtureSalt = "BwcHBwcHBwcHBwcHBwcHBw";
  const fixtureHash = "vI4zYyHL91qWraHNLobM1UGoSLRKOz1_YcbXI30oWkRTA9nROmpb5PpP-S4bUfx9E6A5bIMHzvbVVehS_nubIw";
  const users = [
    { user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", tenant_id: "persistent-a", company_name: "Persistente A", email: "admin@persistent-a.example", password: "TenantPassword2026", role: "admin", plan_id: "nextfor-aura", assigned_bot_id: "atencion-cliente", bot_live: true, password_salt: fixtureSalt, password_hash: fixtureHash },
    { user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", tenant_id: "persistent-b", company_name: "Persistente B", email: "admin@persistent-b.example", password: "TenantPassword2026", role: "admin", plan_id: "nextfor-aura", assigned_bot_id: "atencion-cliente", bot_live: true, password_salt: fixtureSalt, password_hash: fixtureHash }
  ];
  const store = await startPersistentStore();
  let app = null;
  try {
    app = await startApp(secret, users, store.url);
    const cookieA = signedSessionCookie(secret, users[0]);
    let result = await requestJson(app.base, "/admin/panel/bot-personality", cookieA, {
      method: "PUT",
      headers: { cookie: cookieA, "content-type": "application/json", origin: app.base },
      body: JSON.stringify({ personality: { custom_instructions: "PERSISTE-DESPUES-DEL-REINICIO" } })
    });
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.applied, true);
    const appliedVersion = result.body.configuration_version;
    assert(store.rows.some(function (row) {
      return row.user_id === "client-onboarding:persistent-a" && row.tenant_id === "persistent-a";
    }), "the applied tenant record must reach persistent storage: " + JSON.stringify(store.rows.map(function (row) {
      return { user_id: row.user_id, tenant_id: row.tenant_id };
    })));
    app.child.kill("SIGTERM");
    await new Promise(function (resolve) { app.child.once("exit", resolve); });

    app = await startApp(secret, users, store.url);
    result = await requestJson(app.base, "/admin/panel/bot-personality", cookieA);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.applied, true);
    assert.strictEqual(result.body.personality.custom_instructions, "PERSISTE-DESPUES-DEL-REINICIO");
    assert.strictEqual(result.body.configuration_version, appliedVersion);

    const cookieB = signedSessionCookie(secret, users[1]);
    result = await requestJson(app.base, "/admin/panel/bot-personality", cookieB);
    assert.strictEqual(result.response.status, 200);
    assert(!JSON.stringify(result.body).includes("PERSISTE-DESPUES-DEL-REINICIO"));
    console.log("bot-configuration-persistence.e2e.test.js ok");
  } finally {
    if (app && app.child && !app.child.killed) app.child.kill("SIGTERM");
    await new Promise(function (resolve) { store.server.close(resolve); });
  }
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
