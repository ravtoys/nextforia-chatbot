"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const net = require("net");
const path = require("path");
const vm = require("vm");

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

async function login(base, body) {
  const response = await fetch(base + "/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify(body)
  });
  assert.strictEqual(response.status, 200);
  return {
    body: await response.json(),
    cookie: String(response.headers.get("set-cookie") || "").split(";")[0]
  };
}

function whatsappEmbeddedListenerHarness(panel) {
  const start = panel.indexOf("function trustedWhatsAppEmbeddedOrigin");
  const end = panel.indexOf("\nfunction connectChannel", start);
  assert(start >= 0 && end > start, "the rendered panel must contain the Embedded Signup listener");
  let listener = null;
  const calls = { clears: [], completes: 0, loads: [], messages: [], requests: [], stops: [] };
  const context = {
    JSON,
    String,
    URL,
    api: function (url, options) {
      calls.requests.push({ url, options });
      return Promise.resolve({});
    },
    clearTimeout: function (timer) { calls.clears.push(timer); },
    completeWhatsAppEmbeddedSignup: function () { calls.completes++; },
    loadChannelConnections: function (force) { calls.loads.push(force); },
    renderChannelConnections: function () {},
    setChannelConnectionMessage: function (message, type) { calls.messages.push({ message, type }); },
    state: {
      channelConnections: { cached: true },
      whatsappConnecting: true,
      whatsappEmbedded: {
        completing: false,
        config: { configuration_id: "config-v4", onboarding_mode: "cloud_api" },
        code: "embedded-code",
        session: null,
        sessionTimer: "session-timer"
      }
    },
    stopWhatsAppVerification: function (options) { calls.stops.push(options); },
    window: {
      addEventListener: function (type, callback) {
        if (type === "message") listener = callback;
      }
    }
  };
  vm.runInNewContext(panel.slice(start, end), context);
  assert.strictEqual(typeof listener, "function");
  return { calls, context, listener };
}

function renderConnectionHubForOnboarding(panel, onboarding) {
  const start = panel.indexOf("function onboardingConfigurationStatus");
  const end = panel.indexOf("\nfunction requestCommerceConnector", start);
  assert(start >= 0 && end > start, "the rendered panel must contain the connection hub renderer");
  const connectionHubSummary = { innerHTML: "" };
  const context = {
    PANEL_CONTEXT: { assignedBotName: "Bot asignado" },
    String,
    channelConnectionInitial: function (channel) { return channel; },
    commerceDisplayStatus: function () { return "not_requested"; },
    commerceDisplayStore: function () { return ""; },
    commercePlatformLabel: function (platform) { return platform; },
    commerceStatusLabel: function (status) { return status; },
    document: {
      getElementById: function (id) { return id === "connectionHubSummary" ? connectionHubSummary : null; }
    },
    esc: function (value) { return String(value == null ? "" : value); },
    selectedChannelHints: function () { return []; },
    setupGoalLabel: function (goal) {
      return goal === "appointments" ? "Agendamiento" : goal === "customer_service" ? "Atención al cliente" : "Atención al cliente + Agendamiento";
    },
    setupShort: function (value, fallback) { return String(value || fallback || ""); },
    state: { channelConnections: { channels: [] }, onboarding: { onboarding } }
  };
  vm.runInNewContext(panel.slice(start, end), context);
  context.renderConnectionHub();
  return connectionHubSummary.innerHTML;
}

(async function run() {
  const port = await availablePort();
  const base = "http://127.0.0.1:" + port;
  const encryptionKey = crypto.randomBytes(32).toString("base64url");
  const fixtures = [
    { user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", tenant_id: "tenant-a", company_name: "Empresa A", email: "admin@a.example", password: "TenantPassword2026", role: "admin" },
    { user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", tenant_id: "tenant-b", company_name: "Empresa B", email: "admin@b.example", password: "TenantPassword2026", role: "admin" },
    { user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", tenant_id: "tenant-c", company_name: "Agenda C", email: "admin@c.example", password: "TenantPassword2026", role: "admin", plan_id: "nextfor-tempo", assigned_bot_id: "agendamiento" },
    { user_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", tenant_id: "rav-customer-account", company_name: "RAV Toys", email: "admin@ravtoys.example", password: "TenantPassword2026", role: "admin" }
  ];
  const child = childProcess.spawn(process.execPath, [path.join(__dirname, "index.js")], {
    cwd: __dirname,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      NODE_ENV: "test",
      DASHBOARD_KEY: "channel-e2e-dashboard-key",
      DASHBOARD_SESSION_SECRET: "channel-e2e-session-secret-value-long",
      DASHBOARD_USERS: JSON.stringify([
        { username: "owner", email: "owner@nextforia.test", password: "OwnerPassword2026", role: "super_admin", name: "Owner" }
      ]),
      VERIFY_TOKEN: "channel-e2e-verify",
      WA_TOKEN: "channel-e2e-wa-legacy",
      PHONE_NUMBER_ID: "rav-phone-id",
      TENANT_DISPLAY_PHONE: "+57 301 000 0000",
      ANTHROPIC_API_KEY: "channel-e2e-anthropic",
      DATA_ENCRYPTION_KEY: encryptionKey,
      CUSTOMER_ACCESS_V2_ENABLED: "1",
      CUSTOMER_ACCESS_TEST_MODE: "1",
      CUSTOMER_ACCESS_TEST_USERS: JSON.stringify(fixtures),
      PUBLIC_BASE_URL: "https://api.nextforia.com",
      CUSTOMER_PANEL_BASE_URL: "https://api.nextforia.com",
      CHANNEL_CONNECTIONS_V1_ENABLED: "1",
      CHANNEL_CONNECTIONS_TEST_MODE: "1",
      CHANNEL_CONNECTION_INTERNAL_TENANT_ALIASES: JSON.stringify({
        "rav-customer-account": "rav-toys"
      }),
      META_APP_ID: "123456789",
      META_APP_SECRET: "channel-e2e-meta-app-secret-value",
      META_WHATSAPP_CONFIG_ID: "channel-e2e-whatsapp-config",
      META_WHATSAPP_COEXISTENCE_CONFIG_ID: "channel-e2e-whatsapp-coexistence-config",
      META_GRAPH_VERSION: "v23.0",
      SUPABASE_URL: "",
      SUPABASE_KEY: ""
    }),
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer(child, port);
    let response = await fetch(base + "/admin/health");
    assert.strictEqual(response.status, 200);
    let body = await response.json();
    assert.strictEqual(body.customer_setup.meta_oauth_ready, true);
    assert.strictEqual(body.customer_setup.channel_storage_ready, true);
    assert.strictEqual(body.customer_setup.shopify_install_ready, false);
    assert(!JSON.stringify(body).includes("channel-e2e-meta-app-secret-value"));

    const userA = await login(base, { email: "admin@a.example", password: "TenantPassword2026" });
    const userB = await login(base, { email: "admin@b.example", password: "TenantPassword2026" });
    const appointmentUser = await login(base, { email: "admin@c.example", password: "TenantPassword2026" });
    const ravCustomer = await login(base, { email: "admin@ravtoys.example", password: "TenantPassword2026" });
    const superAdmin = await login(base, { username: "owner@nextforia.test", password: "OwnerPassword2026" });
    response = await fetch(base + "/admin/panel?tab=channels", { headers: { cookie: userA.cookie } });
    assert.strictEqual(response.status, 200);
    const panel = await response.text();
    assert(panel.includes("Finaliza el entrenamiento de tu Nextfor"));
    assert(panel.includes('id="connectionHubSummary"'));
    assert(panel.includes('id="channelConnectionCards"'));
    assert(panel.includes('id="commerceConnectorCards"'));
    assert(panel.includes("Conectar número nuevo"));
    assert(panel.includes("Conservar mi WhatsApp Business"));
    assert(panel.includes("Volver a conectar un número existente"));
    assert(panel.includes("Meta puede exigir al menos 7 días de actividad real"));
    assert(panel.includes('code==="3441045"'));
    assert(panel.includes("Meta todavía no habilita coexistencia para este número"));
    assert(panel.includes("Cancelar intento"));
    assert(panel.includes("/admin/panel/channel-connections/whatsapp/attempt"));
    assert(!panel.includes("/admin/panel/channel-connections/whatsapp/activate"));
    assert(!panel.includes("activateWhatsApp("));
    assert(panel.includes("if(state.whatsappLaunch||state.whatsappEmbedded||state.whatsappConnecting)return"));
    assert(panel.includes('if(channel==="whatsapp"){prepareWhatsAppConnection(onboardingMode);return;}'));
    assert(panel.includes("extras:whatsappLoginExtras(config)"));
    assert(panel.includes('return config.onboarding_mode==="coexistence"'));
    assert(panel.includes("function openWhatsAppMetaWindow()"));
    assert(panel.includes("Abrir Meta y elegir mi número"));
    assert(panel.includes("function preloadMetaSdk()"));
    assert(panel.includes('sessionInfoVersion:"3"'));
    assert(panel.includes('features:[{name:"app_only_install"}]'));
    assert(panel.includes('"FINISH_ONLY_WABA"'));
    assert(panel.includes('"FINISH_GRANT_ONLY_API_ACCESS"'));
    assert(panel.includes("WHATSAPP_VERIFY_WINDOW_MS=120000"));
    assert(panel.includes("/admin/panel/channel-connections/whatsapp/verify"));
    assert(panel.includes("metaSdkPromise=null"));
    assert(panel.includes('featureType:"whatsapp_business_app_onboarding"'));
    assert(panel.includes('connectChannel(&quot;whatsapp&quot;,&quot;coexistence&quot;)'));
    assert(panel.includes('connectChannel(&quot;whatsapp&quot;,&quot;coexistence_recovery&quot;)'));
    assert(panel.includes('connectChannel(&quot;whatsapp&quot;,&quot;cloud_api&quot;)'));
    assert(panel.includes('connection&&connection.status==="connected"'));
    assert(panel.includes('FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'));
    assert(panel.includes('coexistence:eventMode!=="cloud_api"'));
    assert(!panel.includes("scheduleWhatsAppActivationCheck"));
    assert(!panel.includes('id="whatsappRegistrationPin"'));
    assert(!panel.includes("JSON.stringify({pin:pin})"));
    assert(panel.includes("Conecta tu tienda"));
    assert(panel.includes("Hacer esto más tarde"));
    assert(!panel.toLowerCase().includes("access token"));

    const finishHarness = whatsappEmbeddedListenerHarness(panel);
    finishHarness.listener({
      origin: "https://business.facebook.com",
      data: JSON.stringify({
        type: "WA_EMBEDDED_SIGNUP",
        event: "FINISH",
        data: { waba_id: "waba-v4", phone_number_id: "phone-v4", business_id: "business-v4" }
      })
    });
    assert.strictEqual(finishHarness.context.state.whatsappEmbedded.session.waba_id, "waba-v4");
    assert.strictEqual(finishHarness.context.state.whatsappEmbedded.session.phone_number_id, "phone-v4");
    assert.strictEqual(finishHarness.context.state.whatsappEmbedded.session.business_id, "business-v4");
    assert.strictEqual(finishHarness.context.state.whatsappEmbedded.session.onboarding_event, "FINISH");
    assert.deepStrictEqual(finishHarness.calls.clears, ["session-timer"]);
    assert.strictEqual(finishHarness.calls.completes, 1);

    const coexistenceHarness = whatsappEmbeddedListenerHarness(panel);
    coexistenceHarness.context.state.whatsappEmbedded.config.onboarding_mode = "coexistence";
    coexistenceHarness.listener({
      origin: "https://business.facebook.com",
      data: {
        type: "WA_EMBEDDED_SIGNUP",
        event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
        data: { waba_id: "waba-coexistence", business_id: "business-coexistence" }
      }
    });
    assert.strictEqual(coexistenceHarness.context.state.whatsappEmbedded.session.waba_id, "waba-coexistence");
    assert.strictEqual(coexistenceHarness.context.state.whatsappEmbedded.session.onboarding_event,
      "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING");
    assert.strictEqual(coexistenceHarness.context.state.whatsappEmbedded.session.coexistence, true);
    assert.strictEqual(coexistenceHarness.context.state.whatsappEmbedded.session.is_wa_login_user, true);
    assert.strictEqual(coexistenceHarness.calls.completes, 1);

    const recoveryHarness = whatsappEmbeddedListenerHarness(panel);
    recoveryHarness.context.state.whatsappEmbedded.config.onboarding_mode = "coexistence_recovery";
    recoveryHarness.listener({
      origin: "https://business.facebook.com",
      data: {
        type: "WA_EMBEDDED_SIGNUP",
        event: "FINISH_GRANT_ONLY_API_ACCESS",
        data: {
          waba_id: "waba-recovery",
          phone_number_id: "phone-recovery",
          business_id: "business-recovery"
        }
      }
    });
    assert.strictEqual(recoveryHarness.context.state.whatsappEmbedded.session.waba_id, "waba-recovery");
    assert.strictEqual(recoveryHarness.context.state.whatsappEmbedded.session.onboarding_event,
      "FINISH_GRANT_ONLY_API_ACCESS");
    assert.strictEqual(recoveryHarness.context.state.whatsappEmbedded.session.coexistence, true);
    assert.strictEqual(recoveryHarness.context.state.whatsappEmbedded.session.app_only_install, true);
    assert.strictEqual(recoveryHarness.calls.completes, 1);

    const genericRecoveryHarness = whatsappEmbeddedListenerHarness(panel);
    genericRecoveryHarness.context.state.whatsappEmbedded.config.onboarding_mode = "coexistence_recovery";
    genericRecoveryHarness.listener({
      origin: "https://business.facebook.com",
      data: {
        type: "WA_EMBEDDED_SIGNUP",
        event: "FINISH",
        data: {
          waba_id: "waba-generic-recovery",
          phone_number_id: "phone-generic-recovery",
          business_id: "business-generic-recovery"
        }
      }
    });
    assert.strictEqual(genericRecoveryHarness.context.state.whatsappEmbedded.session.waba_id,
      "waba-generic-recovery");
    assert.strictEqual(genericRecoveryHarness.context.state.whatsappEmbedded.session.onboarding_event, "FINISH");
    assert.strictEqual(genericRecoveryHarness.context.state.whatsappEmbedded.session.app_only_install, true);
    assert.strictEqual(genericRecoveryHarness.calls.completes, 1,
      "a v4 generic FINISH must complete the signed recovery mode selected by the customer");

    const nestedRecoveryHarness = whatsappEmbeddedListenerHarness(panel);
    nestedRecoveryHarness.context.state.whatsappEmbedded.config.onboarding_mode = "coexistence_recovery";
    nestedRecoveryHarness.listener({
      origin: "https://www.facebook.com",
      data: JSON.stringify({
        type: "WA_EMBEDDED_SIGNUP",
        data: {
          event: "FINISH_GRANT_ONLY_API_ACCESS",
          data: {
            whatsapp_business_account_id: "waba-nested-recovery",
            phone_id: "phone-nested-recovery",
            business_manager_id: "business-nested-recovery"
          }
        }
      })
    });
    assert.strictEqual(nestedRecoveryHarness.context.state.whatsappEmbedded.session.waba_id,
      "waba-nested-recovery");
    assert.strictEqual(nestedRecoveryHarness.context.state.whatsappEmbedded.session.phone_number_id,
      "phone-nested-recovery");
    assert.strictEqual(nestedRecoveryHarness.context.state.whatsappEmbedded.session.business_id,
      "business-nested-recovery");
    assert.strictEqual(nestedRecoveryHarness.calls.completes, 1);

    const modeMismatchHarness = whatsappEmbeddedListenerHarness(panel);
    modeMismatchHarness.listener({
      origin: "https://business.facebook.com",
      data: {
        type: "WA_EMBEDDED_SIGNUP",
        event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
        data: { waba_id: "waba-wrong-mode" }
      }
    });
    assert.strictEqual(modeMismatchHarness.context.state.whatsappEmbedded, null);
    assert.strictEqual(modeMismatchHarness.calls.completes, 0);
    assert.strictEqual(modeMismatchHarness.calls.messages[0].type, "error");
    assert.strictEqual(modeMismatchHarness.calls.requests[0].url,
      "/admin/panel/channel-connections/whatsapp/attempt");
    assert.strictEqual(modeMismatchHarness.calls.requests[0].options.method, "DELETE");

    const finishOnlyWabaHarness = whatsappEmbeddedListenerHarness(panel);
    finishOnlyWabaHarness.listener({
      origin: "https://business.facebook.com",
      data: {
        type: "WA_EMBEDDED_SIGNUP",
        event: "FINISH_ONLY_WABA",
        data: { waba_id: "waba-only-v4", business_id: "business-v4" }
      }
    });
    assert.strictEqual(finishOnlyWabaHarness.context.state.whatsappEmbedded.session.waba_id, "waba-only-v4");
    assert.strictEqual(finishOnlyWabaHarness.context.state.whatsappEmbedded.session.phone_number_id, "");
    assert.strictEqual(finishOnlyWabaHarness.context.state.whatsappEmbedded.session.onboarding_event, "FINISH_ONLY_WABA");
    assert.strictEqual(finishOnlyWabaHarness.calls.completes, 1);

    const untrustedOriginHarness = whatsappEmbeddedListenerHarness(panel);
    untrustedOriginHarness.listener({
      origin: "https://evilfacebook.com",
      data: { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { waba_id: "attacker-waba" } }
    });
    assert.strictEqual(untrustedOriginHarness.context.state.whatsappEmbedded.session, null);
    assert.strictEqual(untrustedOriginHarness.calls.completes, 0);

    const cancelHarness = whatsappEmbeddedListenerHarness(panel);
    cancelHarness.listener({
      origin: "https://web.facebook.com",
      data: { type: "WA_EMBEDDED_SIGNUP", event: "CANCEL", data: { current_step: "phone_number" } }
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(cancelHarness.context.state.whatsappEmbedded, null);
    assert.strictEqual(cancelHarness.context.state.whatsappConnecting, false);
    assert.strictEqual(cancelHarness.context.state.channelConnections, null);
    assert.strictEqual(cancelHarness.calls.loads.length, 1);
    assert.strictEqual(cancelHarness.calls.loads[0], true);
    assert.strictEqual(cancelHarness.calls.messages[0].type, "error");
    assert.strictEqual(cancelHarness.calls.requests[0].url,
      "/admin/panel/channel-connections/whatsapp/attempt");
    assert.strictEqual(cancelHarness.calls.requests[0].options.method, "DELETE");

    const errorHarness = whatsappEmbeddedListenerHarness(panel);
    errorHarness.listener({
      origin: "https://www.facebook.com",
      data: { type: "WA_EMBEDDED_SIGNUP", event: "ERROR", data: { error_message: "Number already linked" } }
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(errorHarness.context.state.whatsappEmbedded, null);
    assert.strictEqual(errorHarness.context.state.whatsappConnecting, false);
    assert.strictEqual(errorHarness.calls.loads.length, 1);
    assert.strictEqual(errorHarness.calls.messages[0].type, "error");
    assert(errorHarness.calls.messages[0].message.includes("otro portafolio"));

    const readyHub = renderConnectionHubForOnboarding(panel, {
      setup_completed: true,
      answers: { setup_goal: "customer_service" },
      customer_service_configuration: {
        lifecycle: "approved_for_testing",
        system_prompt: "Instrucciones activas del tenant"
      }
    });
    assert(readyHub.includes("Listo para atender/probar"));
    assert(!readyHub.includes("queda pendiente la aprobación final"));

    const draftHub = renderConnectionHubForOnboarding(panel, {
      setup_completed: true,
      answers: { setup_goal: "appointments" },
      appointment_configuration: {
        lifecycle: "draft",
        system_prompt: "Borrador de instrucciones"
      }
    });
    assert(draftHub.includes("Agendamiento: Borrador"));
    assert(!draftHub.includes("Listo para atender/probar"));

    response = await fetch(base + "/admin/panel?tab=channels", { headers: { cookie: appointmentUser.cookie } });
    assert.strictEqual(response.status, 200);
    const appointmentPanel = await response.text();
    assert(appointmentPanel.includes("Conectar canales"));
    assert(appointmentPanel.includes("Finaliza el entrenamiento de tu Nextfor"));
    response = await fetch(base + "/admin/panel/channel-connections", { headers: { cookie: appointmentUser.cookie } });
    assert.strictEqual(response.status, 200);
    body = await response.json();
    assert.strictEqual(body.appointment_calendar.name, "Google Calendar");
    assert.strictEqual(body.appointment_calendar.status, "not_connected");
    assert.strictEqual(body.appointment_calendar.authorization_available, false);
    assert(!JSON.stringify(body).includes("google-calendar-secret"));

    response = await fetch(base + "/admin/panel/channel-connections?tenant_id=tenant-b", {
      headers: { cookie: userA.cookie }
    });
    assert.strictEqual(response.status, 200);
    body = await response.json();
    assert.strictEqual(body.appointment_calendar, null);
    assert.deepStrictEqual(body.channels.map(function (row) { return row.name; }), [
      "WhatsApp", "Instagram", "Facebook Messenger"
    ]);
    assert(body.channels.every(function (row) { return row.tenant_id === "tenant-a"; }));
    assert(!JSON.stringify(body).includes("tenant-b"));

    response = await fetch(base + "/admin/panel/channel-connections", {
      headers: { cookie: ravCustomer.cookie }
    });
    assert.strictEqual(response.status, 200);
    body = await response.json();
    const ravWhatsapp = body.channels.find(function (row) { return row.channel === "whatsapp"; });
    assert.strictEqual(ravWhatsapp.tenant_id, "rav-customer-account");
    assert.strictEqual(ravWhatsapp.status, "not_connected");
    assert.strictEqual(ravWhatsapp.account_label, null);
    assert.strictEqual(ravWhatsapp.connect_available, true);
    assert.strictEqual(ravWhatsapp.disconnect_available, false);

    response = await fetch(base + "/admin/send-message", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie: userA.cookie },
      body: JSON.stringify({ userId: "ig:123456789", text: "Prueba de entrega" })
    });
    assert.strictEqual(response.status, 502, "a rejected Meta delivery must never look successful");
    body = await response.json();
    assert.strictEqual(body.error, "channel_delivery_failed");
    assert.strictEqual(body.meta_sent, false);
    response = await fetch(base + "/admin/panel/data?limit=500", { headers: { cookie: userA.cookie } });
    assert.strictEqual(response.status, 200);
    body = await response.json();
    assert(!JSON.stringify(body).includes("Prueba de entrega"), "a rejected reply must not appear as a sent message");
    assert(!JSON.stringify(body).includes("DeliveryFailure"), "delivery audit rows must stay internal");

    response = await fetch(base + "/admin/takeover/ig%3A123456789", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie: userA.cookie },
      body: "{}"
    });
    assert.strictEqual(response.status, 200);
    response = await fetch(base + "/admin/release/ig%3A123456789", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie: userB.cookie },
      body: "{}"
    });
    assert.strictEqual(response.status, 200);
    body = await response.json();
    assert.strictEqual(body.wasInHandoff, false, "tenant B must not release tenant A's handoff state");
    response = await fetch(base + "/admin/release/ig%3A123456789", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie: userA.cookie },
      body: "{}"
    });
    assert.strictEqual(response.status, 200);
    body = await response.json();
    assert.strictEqual(body.wasInHandoff, true, "tenant A must retain its own handoff state");

    response = await fetch(base + "/admin/customer-meta/ig%3A123456789", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie: userA.cookie },
      body: JSON.stringify({
        tags: ["vip"],
        note: "Solo Empresa A",
        name: "Cliente A",
        phone: "+573011112233",
        email: "cliente.a@example.com",
        address: "Calle privada 123",
        city: "Bogotá",
        delivery_instructions: "Entregar en recepción"
      })
    });
    assert.strictEqual(response.status, 200);
    body = await response.json();
    assert.strictEqual(body.meta.note, "Solo Empresa A");
    assert.strictEqual(body.meta.profile.email, "cliente.a@example.com");
    assert.strictEqual(body.meta.profile.city, "Bogotá");

    response = await fetch(base + "/admin/customer-meta/ig%3A123456789", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie: userA.cookie },
      body: JSON.stringify({ note: "Nota actualizada sin borrar el perfil" })
    });
    assert.strictEqual(response.status, 200);
    body = await response.json();
    assert.strictEqual(body.meta.profile.email, "cliente.a@example.com", "partial panel updates must preserve bot-captured profile fields");
    assert.strictEqual(body.meta.profile.address, "Calle privada 123");
    response = await fetch(base + "/admin/panel/data?limit=500", { headers: { cookie: userA.cookie } });
    assert.strictEqual(response.status, 200);
    body = await response.json();
    assert(JSON.stringify(body).includes("cliente.a@example.com"), "tenant A panel must receive its customer profile");
    response = await fetch(base + "/admin/panel/data?limit=500", { headers: { cookie: userB.cookie } });
    assert.strictEqual(response.status, 200);
    body = await response.json();
    assert(!JSON.stringify(body).includes("cliente.a@example.com"), "customer profiles must not leak across companies");
    assert(!JSON.stringify(body).includes("Calle privada 123"), "shipping data must remain tenant isolated");

    response = await fetch(base + "/admin/panel/channel-connections/whatsapp/connect", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://nextforia.com",
        "x-nextforia-panel-origin": "https://nextforia.com",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "nextforia.com",
        cookie: ravCustomer.cookie
      },
      body: "{}"
    });
    assert.strictEqual(response.status, 200, "the Customer Panel must start WhatsApp with one simple action");
    body = await response.json();
    assert.strictEqual(body.embedded_signup.app_id, "123456789");
    assert.strictEqual(body.embedded_signup.configuration_id, "channel-e2e-whatsapp-config");
    assert.strictEqual(body.embedded_signup.graph_version, "v23.0");
    assert.strictEqual(body.embedded_signup.onboarding_mode, "cloud_api");
    assert.strictEqual(body.embedded_signup.flow, "new_cloud_api_number");
    assert(body.embedded_signup.oauth_state);
    assert(!JSON.stringify(body).includes("channel-e2e-meta-app-secret-value"));

    response = await fetch(base + "/admin/panel/channel-connections/whatsapp/activate", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie: userA.cookie },
      body: JSON.stringify({ tenant_id: "rav-customer-account" })
    });
    assert.strictEqual(response.status, 410, "the retired customer endpoint must never retry registration");
    assert.strictEqual((await response.json()).error, "whatsapp_activation_retired");

    response = await fetch(base + "/admin/panel/channel-connections/whatsapp/complete", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie: ravCustomer.cookie },
      body: JSON.stringify({
        state: body.embedded_signup.oauth_state + "altered",
        code: "fake",
        session: { waba_id: "waba-a", phone_number_id: "phone-a" }
      })
    });
    assert.strictEqual(response.status, 403);

    response = await fetch(base + "/admin/panel/channel-connections/whatsapp/attempt", {
      method: "DELETE",
      headers: { "content-type": "application/json", origin: base, cookie: ravCustomer.cookie }
    });
    assert.strictEqual(response.status, 200);
    assert.strictEqual((await response.json()).connection.status, "not_connected");

    response = await fetch(base + "/admin/panel/channel-connections/whatsapp/connect", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://nextforia.com",
        "x-nextforia-panel-origin": "https://nextforia.com",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "nextforia.com",
        cookie: ravCustomer.cookie
      },
      body: JSON.stringify({ onboarding_mode: "coexistence" })
    });
    assert.strictEqual(response.status, 200, "the customer must be able to choose WhatsApp Business coexistence");
    body = await response.json();
    assert.strictEqual(body.embedded_signup.configuration_id, "channel-e2e-whatsapp-coexistence-config");
    assert.strictEqual(body.embedded_signup.onboarding_mode, "coexistence");
    assert.strictEqual(body.embedded_signup.flow, "whatsapp_business_app_coexistence");
    response = await fetch(base + "/admin/panel/channel-connections/whatsapp/attempt", {
      method: "DELETE",
      headers: { "content-type": "application/json", origin: base, cookie: ravCustomer.cookie }
    });
    assert.strictEqual(response.status, 200);
    assert.strictEqual((await response.json()).connection.status, "not_connected");

    response = await fetch(base + "/admin/panel/channel-connections/whatsapp/connect", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://nextforia.com",
        "x-nextforia-panel-origin": "https://nextforia.com",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "nextforia.com",
        cookie: ravCustomer.cookie
      },
      body: JSON.stringify({ onboarding_mode: "coexistence_recovery" })
    });
    assert.strictEqual(response.status, 200, "the customer must be able to recover an existing coexistence grant");
    body = await response.json();
    assert.strictEqual(body.embedded_signup.configuration_id, "channel-e2e-whatsapp-coexistence-config");
    assert.strictEqual(body.embedded_signup.onboarding_mode, "coexistence_recovery");
    assert.strictEqual(body.embedded_signup.flow, "whatsapp_business_app_recovery");
    response = await fetch(base + "/admin/panel/channel-connections/whatsapp/attempt", {
      method: "DELETE",
      headers: { "content-type": "application/json", origin: base, cookie: ravCustomer.cookie }
    });
    assert.strictEqual(response.status, 200);
    assert.strictEqual((await response.json()).connection.status, "not_connected");

    response = await fetch(base + "/admin/panel/channel-connections/instagram/connect", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://nextforia.com",
        "x-nextforia-panel-origin": "https://nextforia.com",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "nextforia.com",
        cookie: userA.cookie
      },
      body: JSON.stringify({ tenant_id: "tenant-b" })
    });
    assert.strictEqual(response.status, 200);
    body = await response.json();
    const authorization = new URL(body.authorization_url);
    assert.strictEqual(authorization.hostname, "www.instagram.com");
    assert.strictEqual(authorization.searchParams.get("redirect_uri"), "https://nextforia.com/admin/channel-connections/meta/callback/");
    assert(authorization.searchParams.get("scope").includes("instagram_business_manage_messages"));
    assert(!authorization.searchParams.get("scope").includes("pages_show_list"));
    assert(!body.authorization_url.includes("channel-e2e-meta-app-secret-value"));

    response = await fetch(base + "/admin/panel/channel-connections", { headers: { cookie: userA.cookie } });
    body = await response.json();
    assert.strictEqual(body.channels.find(function (row) { return row.channel === "instagram"; }).status, "connecting");

    response = await fetch(base + "/admin/panel/channel-connections", { headers: { cookie: userB.cookie } });
    body = await response.json();
    assert.strictEqual(body.channels.find(function (row) { return row.channel === "instagram"; }).status, "not_connected");
    assert(!JSON.stringify(body).includes("tenant-a"));

    response = await fetch(base + "/admin/panel/channel-connections/instagram/disconnect", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie: userB.cookie },
      body: JSON.stringify({ tenant_id: "tenant-a" })
    });
    assert.strictEqual(response.status, 404, "tenant B cannot disconnect tenant A's connection");

    response = await fetch(base + "/admin/panel/channel-connections/instagram/disconnect", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie: userA.cookie },
      body: JSON.stringify({ tenant_id: "tenant-b" })
    });
    assert.strictEqual(response.status, 200);
    assert.strictEqual((await response.json()).connection.status, "disconnected");

    response = await fetch(base + "/admin/channel-connections/meta/callback?state=altered&code=fake");
    assert.strictEqual(response.status, 200);
    assert(response.url.includes("/admin/login"), "an invalid unauthenticated callback must end at login");

    response = await fetch(base + "/admin/channel-connections", { headers: { cookie: userA.cookie } });
    assert.strictEqual(response.status, 401);
    response = await fetch(base + "/admin/channel-connections", { headers: { cookie: superAdmin.cookie } });
    assert.strictEqual(response.status, 200);
    body = await response.json();
    assert(!body.channels.some(function (row) {
      return row.protected_legacy || row.credential_source === "environment";
    }), "environment credentials must not create tenant-owned channel records on startup");
    assert(!JSON.stringify(body).toLowerCase().includes("access_token"));
    assert(!JSON.stringify(body).includes("channel-e2e-wa-legacy"));
    assert(!JSON.stringify(body).includes(encryptionKey));

    response = await fetch(base + "/admin/super-admin?view=channels", { headers: { cookie: superAdmin.cookie } });
    assert.strictEqual(response.status, 200);
    const superPanel = await response.text();
    assert(superPanel.includes('data-panel="channels"'));
    assert(superPanel.includes("Los tokens nunca salen del almacenamiento cifrado"));
    assert(!superPanel.includes("channel-e2e-wa-legacy"));
    assert(!superPanel.includes(encryptionKey));

    response = await fetch(base + "/admin/channel-connections/tenant-a/whatsapp/connect", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://nextforia.com",
        "x-nextforia-panel-origin": "https://nextforia.com",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "nextforia.com",
        cookie: superAdmin.cookie
      },
      body: "{}"
    });
    assert.strictEqual(response.status, 409, "support must not connect a customer's WhatsApp on its behalf");
    body = await response.json();
    assert.strictEqual(body.error, "whatsapp_customer_panel_required");
    response = await fetch(base + "/admin/channel-connections", { headers: { cookie: superAdmin.cookie } });
    body = await response.json();
    assert.strictEqual(body.channels.find(function (row) {
      return row.tenant_id === "tenant-a" && row.channel === "whatsapp";
    }).status, "not_connected");

    response = await fetch(base + "/admin/channel-connections/rav-toys/whatsapp/disconnect", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie: superAdmin.cookie },
      body: "{}"
    });
    assert.strictEqual(response.status, 404);
    assert.strictEqual((await response.json()).error, "connection_not_found");

    console.log("channel-connections.e2e.test.js: ok");
  } finally {
    child.kill("SIGTERM");
  }
})().catch(function (error) {
  console.error(error.stack || error.message);
  process.exit(1);
});
