"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
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
    const timer = setTimeout(function () {
      reject(new Error("server_start_timeout\n" + output));
    }, 30000);
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
    mv: Number(user.session_version || 1),
    exp: Date.now() + 60 * 60 * 1000
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return "nextforia_dashboard_session=" + encodeURIComponent(payload + "." + signature);
}

async function requestJson(base, pathName, cookie, options) {
  const response = await fetch(base + pathName, Object.assign({
    headers: { cookie }
  }, options || {}));
  return { response, body: await response.json() };
}

(async function run() {
  const port = await availablePort();
  const base = "http://127.0.0.1:" + port;
  const secret = "customer-bot-configuration-session-secret";
  const fixtureSalt = "BwcHBwcHBwcHBwcHBwcHBw";
  const fixtureHash = "vI4zYyHL91qWraHNLobM1UGoSLRKOz1_YcbXI30oWkRTA9nROmpb5PpP-S4bUfx9E6A5bIMHzvbVVehS_nubIw";
  const users = [
    { user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", tenant_id: "config-a", company_name: "Config A", email: "admin@config-a.example", password: "TenantPassword2026", role: "admin", plan_id: "nextfor-aura", assigned_bot_id: "atencion-cliente", bot_live: true, password_salt: fixtureSalt, password_hash: fixtureHash },
    { user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", tenant_id: "config-b", company_name: "Config B", email: "admin@config-b.example", password: "TenantPassword2026", role: "admin", plan_id: "nextfor-uno", assigned_bot_id: "atencion-cliente", bot_live: true, password_salt: fixtureSalt, password_hash: fixtureHash },
    { user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", tenant_id: "config-viewer", company_name: "Config Viewer", email: "viewer@config.example", password: "TenantPassword2026", role: "viewer", plan_id: "nextfor-atlas", assigned_bot_id: "atencion-cliente", bot_live: true, password_salt: fixtureSalt, password_hash: fixtureHash },
    { user_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", tenant_id: "config-inactive", company_name: "Config Inactive", email: "admin@inactive.example", password: "TenantPassword2026", role: "admin", plan_id: "nextfor-uno", assigned_bot_id: "atencion-cliente", password_salt: fixtureSalt, password_hash: fixtureHash }
  ];
  const child = childProcess.spawn(process.execPath, [path.join(__dirname, "index.js")], {
    cwd: __dirname,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      NODE_ENV: "test",
      DASHBOARD_KEY: "customer-bot-configuration-key",
      DASHBOARD_SESSION_SECRET: secret,
      DASHBOARD_USERS: "[]",
      VERIFY_TOKEN: "customer-bot-configuration-verify",
      WA_TOKEN: "customer-bot-configuration-wa-dummy",
      ANTHROPIC_API_KEY: "customer-bot-configuration-anthropic-dummy",
      SUPABASE_URL: "",
      SUPABASE_KEY: "",
      CUSTOMER_ACCESS_V2_ENABLED: "1",
      CUSTOMER_ACCESS_TEST_MODE: "1",
      CUSTOMER_ACCESS_TEST_FORCE_SCHEMA_UNAVAILABLE: "1",
      CUSTOMER_ACCESS_TEST_USERS: JSON.stringify(users),
      CUSTOMER_PANEL_BASE_URL: "https://customer-panel.test.example"
    }),
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer(child, port);
    const cookieA = signedSessionCookie(secret, users[0]);
    const cookieB = signedSessionCookie(secret, users[1]);
    const cookieViewer = signedSessionCookie(secret, users[2]);
    const cookieInactive = signedSessionCookie(secret, users[3]);

    let result = await requestJson(base, "/admin/panel/bot-personality", cookieA);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.tenant_id, "config-a");
    assert.strictEqual(result.body.plan_id, "nextfor-aura");
    assert.strictEqual(result.body.features.shipping, true);
    assert.strictEqual(result.body.features.reminders, false);
    assert.strictEqual(result.body.can_edit, true);
    assert.strictEqual(result.body.applied, true);
    assert.match(result.body.configuration_version, /^[a-f0-9]{64}$/);

    result = await requestJson(base, "/admin/panel/bot-personality", cookieA, {
      method: "PUT",
      headers: { cookie: cookieA, "content-type": "application/json", origin: base },
      body: JSON.stringify({
        personality: {
          plan_id: "nextfor-atlas",
          response_length: "muy_breve",
          greeting: { tone: "directo", text: "Hola desde Empresa A" },
          shipping: { fields: [{ id: "city", label: "Ciudad de entrega", required: true }] },
          reminders: { text: "Recordatorio adulterado" },
          catalog: { price_mode: "exact" },
          payments: { methods: ["card"] },
          faqs: [{ question: "¿Pregunta A?", answer: "Respuesta privada A" }]
        }
      })
    });
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.plan_id, "nextfor-aura", "el plan se deriva de la sesión, no del body");
    assert.strictEqual(result.body.can_edit, true, "el autoguardado debe conservar la pantalla editable");
    assert.strictEqual(result.body.applied, true, "no debe confirmar éxito sin verificar la configuración live");
    assert.strictEqual(result.body.applies_to_next_response, true);
    assert.strictEqual(result.body.personality.plan_id, "aura");
    assert.strictEqual(result.body.features.reminders, false);
    assert.strictEqual(result.body.personality.greeting.text, "Hola desde Empresa A");

    result = await requestJson(base, "/admin/panel/bot-personality", cookieB);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.tenant_id, "config-b");
    assert.strictEqual(result.body.plan_id, "nextfor-uno");
    assert.strictEqual(result.body.features.shipping, false);
    assert.strictEqual(result.body.features.catalog, false);
    assert.strictEqual(result.body.features.payments, false);
    assert(!result.body.personality.greeting.text.includes("Empresa A"), "el tenant B no puede leer la configuración de A");
    assert(!JSON.stringify(result.body).includes("Respuesta privada A"));

    result = await requestJson(base, "/admin/panel/bot-personality", cookieA);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.personality.greeting.text, "Hola desde Empresa A");
    assert.strictEqual(result.body.personality.faqs[0].answer, "Respuesta privada A");

    result = await requestJson(base, "/admin/panel/bot-personality", cookieViewer);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.can_edit, false);

    result = await requestJson(base, "/admin/panel/bot-personality", cookieViewer, {
      method: "PUT",
      headers: { cookie: cookieViewer, "content-type": "application/json", origin: base },
      body: JSON.stringify({ personality: { greeting: { text: "No autorizado" } } })
    });
    assert.strictEqual(result.response.status, 401);

    result = await requestJson(base, "/admin/panel/bot-personality", cookieInactive, {
      method: "PUT",
      headers: { cookie: cookieInactive, "content-type": "application/json", origin: base },
      body: JSON.stringify({ personality: { custom_instructions: "No debe confirmar aplicación" } })
    });
    assert.strictEqual(result.response.status, 409);
    assert.strictEqual(result.body.error, "bot_configuration_not_live");

    result = await requestJson(base, "/admin/panel/account-profile", cookieA);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.profile.tenant_id, "config-a");
    assert.strictEqual(result.body.profile.administrator_email, "admin@config-a.example");
    assert.strictEqual(result.body.can_edit, true);

    const logo = "data:image/png;base64,iVBORw0KGgo=";
    result = await requestJson(base, "/admin/panel/account-profile", cookieA, {
      method: "PUT",
      headers: { cookie: cookieA, "content-type": "application/json", origin: base },
      body: JSON.stringify({
        tenant_id: "config-b",
        business_name: "Config A Actualizada",
        administrator_name: "Administradora A",
        contact_phone: "+57 301 111 2233",
        logo_data_url: logo
      })
    });
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.profile.tenant_id, "config-a", "el tenant siempre se deriva de la sesión");
    assert.strictEqual(result.body.profile.business_name, "Config A Actualizada");
    assert.strictEqual(result.body.profile.administrator_name, "Administradora A");
    assert.strictEqual(result.body.profile.contact_phone, "+57 301 111 2233");
    assert.strictEqual(result.body.profile.logo_data_url, logo);

    result = await requestJson(base, "/admin/panel/account-profile", cookieB);
    assert.strictEqual(result.response.status, 200);
    assert.strictEqual(result.body.profile.tenant_id, "config-b");
    assert.notStrictEqual(result.body.profile.business_name, "Config A Actualizada");
    assert(!JSON.stringify(result.body).includes("Administradora A"));

    result = await requestJson(base, "/admin/panel/account-profile", cookieViewer, {
      method: "PUT",
      headers: { cookie: cookieViewer, "content-type": "application/json", origin: base },
      body: JSON.stringify({ business_name: "No autorizado" })
    });
    assert.strictEqual(result.response.status, 401);

    result = await requestJson(base, "/admin/panel/account-password", cookieA, {
      method: "POST",
      headers: { cookie: cookieA, "content-type": "application/json", origin: base },
      body: JSON.stringify({
        current_password: "TenantPassword2026",
        password: "ChangedTenantPassword2026",
        password_confirmation: "ChangedTenantPassword2026"
      })
    });
    assert.strictEqual(result.response.status, 200);
    let loginResponse = await fetch(base + "/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ email: "admin@config-a.example", password: "TenantPassword2026" })
    });
    assert.strictEqual(loginResponse.status, 401);
    loginResponse = await fetch(base + "/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ email: "admin@config-a.example", password: "ChangedTenantPassword2026" })
    });
    assert.strictEqual(loginResponse.status, 200);

    const anonymous = await fetch(base + "/admin/panel/bot-personality");
    assert.strictEqual(anonymous.status, 401);

    console.log("bot-personality.e2e.test.js ok");
  } finally {
    child.kill("SIGTERM");
  }
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
