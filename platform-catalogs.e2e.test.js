"use strict";

// Extremo a extremo del catálogo de planes y bots y del ciclo de vida del cliente.
// Verifica lo que importa: que solo super_admin escriba, que el cliente solo lea
// activos, y que las tres salvaguardas del borrado no se puedan saltar.

const assert = require("assert");
const childProcess = require("child_process");
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

async function login(base, email, password) {
  const response = await fetch(base + "/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ email: email, password: password })
  });
  assert.strictEqual(response.status, 200, "login de " + email);
  return String(response.headers.get("set-cookie") || "").split(";")[0];
}

function asJson(base, cookie) {
  return async function (method, route, body) {
    const response = await fetch(base + route, {
      method: method,
      headers: Object.assign(
        { accept: "application/json", origin: base },
        body ? { "content-type": "application/json" } : {},
        cookie ? { cookie: cookie } : {}
      ),
      body: body ? JSON.stringify(body) : undefined
    });
    let payload = null;
    try { payload = await response.json(); } catch (_) { payload = null; }
    return { status: response.status, body: payload || {} };
  };
}

(async function run() {
  const port = await availablePort();
  const base = "http://127.0.0.1:" + port;
  const child = childProcess.spawn(process.execPath, [path.join(__dirname, "index.js")], {
    cwd: __dirname,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      NODE_ENV: "test",
      DASHBOARD_KEY: "catalogs-e2e-key",
      DASHBOARD_SESSION_SECRET: "catalogs-e2e-session-secret-value",
      DASHBOARD_USERS: JSON.stringify([
        { username: "platform@nextforia.example", email: "platform@nextforia.example", password: "platform-test-password", role: "super_admin", name: "Platform" },
        { username: "admin@legacy.example", email: "admin@legacy.example", password: "admin-test-password", role: "admin", tenant_id: "rav-toys", name: "Admin legado" },
        { username: "viewer@legacy.example", email: "viewer@legacy.example", password: "viewer-test-password", role: "viewer", tenant_id: "rav-toys", name: "Viewer legado" }
      ]),
      VERIFY_TOKEN: "catalogs-e2e-verify",
      WA_TOKEN: "catalogs-e2e-wa-dummy",
      ANTHROPIC_API_KEY: "catalogs-e2e-anthropic-dummy",
      SUPABASE_URL: "",
      SUPABASE_KEY: "",
      CUSTOMER_ACCESS_V2_ENABLED: "1",
      CUSTOMER_ACCESS_TEST_MODE: "1",
      CUSTOMER_PANEL_BASE_URL: "https://customer-panel.staging.example"
    }),
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer(child, port);

    // Sin sesión no se lee ni se escribe el catálogo.
    const anon = asJson(base, null);
    assert.strictEqual((await anon("GET", "/admin/catalogs")).status, 401);
    assert.strictEqual((await anon("POST", "/admin/catalogs/plans", { nombre: "Pirata" })).status, 401);
    assert.strictEqual((await anon("GET", "/admin/tenants")).status, 401);

    // Un admin de cliente no puede tocar el catálogo de la plataforma.
    const adminCookie = await login(base, "admin@legacy.example", "admin-test-password");
    const clientAdmin = asJson(base, adminCookie);
    assert.strictEqual((await clientAdmin("GET", "/admin/catalogs")).status, 401, "el catálogo completo es solo de la plataforma");
    assert.strictEqual((await clientAdmin("POST", "/admin/catalogs/plans", { nombre: "Pirata" })).status, 401);
    assert.strictEqual((await clientAdmin("POST", "/admin/tenants/rav-toys/delete", { company_name_confirmacion: "x", confirmacion_final: true })).status, 401);

    // Pero sí puede leer los planes activos: es lo que muestra su panel.
    const clientCatalogs = await clientAdmin("GET", "/admin/panel/catalogs");
    assert.strictEqual(clientCatalogs.status, 200, "el Panel de Cliente lee el catálogo activo");
    assert.ok(Array.isArray(clientCatalogs.body.plans));
    assert.ok(Array.isArray(clientCatalogs.body.bots));

    // Un viewer también, porque el panel se le muestra igual.
    const viewerCookie = await login(base, "viewer@legacy.example", "viewer-test-password");
    assert.strictEqual((await asJson(base, viewerCookie)("GET", "/admin/panel/catalogs")).status, 200);

    // ─── Super admin: escritura del catálogo ────────────────────────────────
    const superCookie = await login(base, "platform@nextforia.example", "platform-test-password");
    const superAdmin = asJson(base, superCookie);

    const created = await superAdmin("POST", "/admin/catalogs/plans", {
      nombre: "Bot Agendamiento de citas",
      descripcion: "Agenda, confirma y reprograma por WhatsApp.",
      bot_id: "agendamiento",
      precio_setup: "$990.000",
      precio_mensual: "299.900",
      beneficios: "Atención 24/7\nConfirmación automática",
      etiqueta: "Mejor valor",
      orden: 1
    });
    assert.strictEqual(created.status, 200, JSON.stringify(created.body));
    assert.strictEqual(created.body.plan.id, "bot-agendamiento-de-citas");
    assert.strictEqual(created.body.plan.precio_setup, 0, "setup cost queda eliminado aunque llegue desde clientes viejos");
    assert.strictEqual(created.body.plan.precio_mensual, 299900);
    assert.deepStrictEqual(created.body.plan.beneficios, ["Atención 24/7", "Confirmación automática"]);

    // Un plan que apunta a un bot inexistente se rechaza.
    assert.strictEqual((await superAdmin("POST", "/admin/catalogs/plans", { nombre: "Roto", bot_id: "no-existe" })).status, 400);
    // Y uno sin nombre también.
    assert.strictEqual((await superAdmin("POST", "/admin/catalogs/plans", { nombre: "" })).status, 400);

    // Desactivar lo saca de la oferta pero no lo borra.
    assert.strictEqual((await superAdmin("POST", "/admin/catalogs/plans/bot-agendamiento-de-citas/toggle", { activo: false })).status, 200);
    const afterToggle = await clientAdmin("GET", "/admin/panel/catalogs");
    assert.ok(!afterToggle.body.plans.some(function (row) { return row.id === "bot-agendamiento-de-citas"; }),
      "un plan desactivado deja de ofrecerse a clientes");
    const adminView = await superAdmin("GET", "/admin/catalogs");
    assert.ok(adminView.body.plans.some(function (row) { return row.id === "bot-agendamiento-de-citas"; }),
      "pero el super admin lo sigue viendo para reactivarlo");

    // Bots.
    const bot = await superAdmin("POST", "/admin/catalogs/bots", { nombre: "Voz saliente", descripcion: "Llamadas salientes", orden: 9 });
    assert.strictEqual(bot.status, 200);
    assert.strictEqual(bot.body.bot.id, "voz-saliente");

    // ─── Ciclo de vida del cliente ──────────────────────────────────────────
    const invite = await superAdmin("POST", "/admin/customer-invite", {
      company_name: "Panadería La Espiga",
      admin_email: "duenio@espiga.example",
      plan_id: "growth",
      assigned_bot_id: "atencion-cliente"
    });
    assert.strictEqual(invite.status, 201, JSON.stringify(invite.body));

    const tenants = await superAdmin("GET", "/admin/tenants");
    assert.strictEqual(tenants.status, 200);
    const tenant = tenants.body.tenants.find(function (row) { return row.company_name === "Panadería La Espiga"; });
    assert.ok(tenant, "el cliente creado aparece en el listado");

    // Suspender corta el acceso y es reversible.
    assert.strictEqual((await superAdmin("POST", "/admin/tenants/" + tenant.id + "/status", { status: "suspendido" })).status, 200);
    assert.strictEqual((await superAdmin("POST", "/admin/tenants/" + tenant.id + "/status", { status: "activo" })).status, 200);
    assert.strictEqual((await superAdmin("POST", "/admin/tenants/" + tenant.id + "/status", { status: "basura" })).status, 400);

    // El nombre de la empresa debe coincidir exactamente.
    const wrongName = await superAdmin("POST", "/admin/tenants/" + tenant.id + "/delete", {
      company_name_confirmacion: "Panaderia La Espiga",
      confirmacion_final: true
    });
    assert.strictEqual(wrongName.status, 400, "salvaguarda 2: nombre exacto");
    assert.strictEqual(wrongName.body.error, "company_name_mismatch");

    // Falta la confirmación final.
    const noFinal = await superAdmin("POST", "/admin/tenants/" + tenant.id + "/delete", {
      company_name_confirmacion: "Panadería La Espiga"
    });
    assert.strictEqual(noFinal.status, 400, "salvaguarda 3: confirmación explícita");
    assert.strictEqual(noFinal.body.error, "final_confirmation_required");

    // Con las salvaguardas cumplidas: suspende automáticamente, borra y devuelve el respaldo.
    const deleted = await superAdmin("POST", "/admin/tenants/" + tenant.id + "/delete", {
      company_name_confirmacion: "Panadería La Espiga",
      confirmacion_final: true
    });
    assert.strictEqual(deleted.status, 200, JSON.stringify(deleted.body));
    assert.ok(deleted.body.backup, "el borrado siempre devuelve respaldo");
    assert.strictEqual(deleted.body.backup.tenant.company_name, "Panadería La Espiga");

    const afterDelete = await superAdmin("GET", "/admin/tenants");
    assert.ok(!afterDelete.body.tenants.some(function (row) { return row.id === tenant.id; }), "el cliente ya no existe");

    // El respaldo nunca expone hashes de contraseña ni tokens.
    const backupText = JSON.stringify(deleted.body.backup);
    assert.doesNotMatch(backupText, /password_hash|password_salt|token_hash/, "el respaldo no filtra secretos");

    console.log("platform-catalogs.e2e.test.js: ok");
  } finally {
    child.kill("SIGKILL");
  }
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
