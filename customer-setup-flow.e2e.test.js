"use strict";

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

async function login(base, email, password, platform) {
  const response = await fetch(base + "/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify(platform ? { username: email, password } : { email, password })
  });
  assert.strictEqual(response.status, 200);
  return String(response.headers.get("set-cookie") || "").split(";")[0];
}

function completedAnswers(company, email, marker) {
  return {
    setup_goal: "customer_service",
    business: {
      brand_name: company,
      contact_email: email,
      contact_phone: "+57 300 000 0000"
    },
    meta: { whatsapp_number: "+57 300 000 0000", whatsapp_integration_intent: "yes" },
    operations: {
      primary_country: "Colombia",
      primary_city: "Bogotá",
      monthly_customer_volume: "300",
      support_hours: "Lunes a viernes",
      services_products: "Servicios " + marker,
      frequent_questions: "Preguntas " + marker,
      important_policies: "Políticas " + marker,
      bot_instructions: "Responder como " + marker
    },
    customer_service_setup: {
      business_offer_type: "products",
      business_offer_description: "Productos " + marker,
      ideal_customer: "Cliente ideal " + marker,
      value_proposition: "Diferencial " + marker,
      bot_display_name: "Nextfor de " + company,
      tone: "vendedor_dinamico",
      brand_restrictions: "No inventar precios ni descuentos",
      data_consent: true
    },
    commerce: {
      platform: "shopify",
      store_url: "https://store-" + String(marker).toLowerCase() + ".myshopify.com",
      catalog_ready: "yes",
      orders_required: true,
      access_owner: email,
      integration_intent: "yes"
    },
    team: {
      admin_email: email,
      human_support_contact: "Soporte " + marker
    },
    voice: { formality: "cercano", emojis: "moderados" }
  };
}

function appointmentStageOneAnswers(company) {
  return {
    setup_goal: "appointments",
    meta: {
      whatsapp_number: "+57 300 222 3333"
    },
    operations: {
      monthly_customer_volume: "180"
    },
    appointment_setup: {
      business_name: company,
      business_category: "salud_bienestar",
      target_customer: "Pacientes que quieren reservar consulta",
      business_description: "Atendemos de forma cercana y explicamos cada procedimiento antes de reservar.",
      assistant_tone: "calido_empatico",
      bot_display_name: "Nextfor de " + company,
      allowed_topics: "Servicios, precios, horarios y disponibilidad",
      forbidden_topics: "Diagnósticos, recomendaciones médicas y promesas de resultado",
      escalation_triggers: "Urgencias, quejas o cuando no pueda responder con seguridad",
      escalation_contact: "Recepción +57 300 000 0000",
      human_support_hours: "Lunes a viernes",
      services: "Consulta inicial · 45 minutos · precio por confirmar",
      business_hours: "Lunes a viernes de 8 a 6",
      payment_methods: "Efectivo, transferencia y tarjeta",
      faqs: "¿Cuánto dura? 45 minutos.",
      staff_mode: "one",
      appointment_locations: "Sede principal y virtual",
      availability_rules: "Lunes a viernes de 9 a 5",
      required_booking_fields: "Nombre completo, teléfono, servicio deseado y horario preferido",
      booking_confirmation_mode: "manual_approval",
      cancellation_policy: "Cancelar mínimo 12 horas antes",
      calendar_provider: "google",
      reminder_channel: "whatsapp",
      reminder_timing: "24h",
      survey_enabled: "yes",
      operational_channels: "WhatsApp activo",
      instagram_username: "@empresa",
      channel_email: "agenda@example.com",
      other_channels: "Messenger",
      social_accounts: "Instagram @empresa",
      data_consent: true
    }
  };
}

function bothBotAnswers(company, email) {
  const service = completedAnswers(company, email, "Both");
  const appointment = appointmentStageOneAnswers(company);
  service.setup_goal = "both";
  service.operations.monthly_customer_volume = "420";
  service.appointment_setup = appointment.appointment_setup;
  return service;
}

(async function run() {
  const port = await availablePort();
  const base = "http://127.0.0.1:" + port;
  const password = "TenantPassword2026";
  const fixtures = [
    {
      user_id: "11111111-1111-4111-8111-111111111111",
      tenant_id: "tenant-setup-a",
      company_name: "Empresa Setup A",
      email: "admin@setup-a.example",
      password,
      role: "admin",
      plan_id: "nextfor-aura",
      assigned_bot_id: "atencion-cliente",
      setup_completed: false
    },
    {
      user_id: "22222222-2222-4222-8222-222222222222",
      tenant_id: "tenant-returning-b",
      company_name: "Empresa Returning B",
      email: "admin@returning-b.example",
      password,
      role: "admin",
      plan_id: "nextfor-aura",
      assigned_bot_id: "atencion-cliente",
      setup_completed: true
    },
    {
      user_id: "33333333-3333-4333-8333-333333333333",
      tenant_id: "tenant-appointments-c",
      company_name: "Empresa Citas C",
      email: "admin@citas-c.example",
      password,
      role: "admin",
      plan_id: "nextfor-aura",
      assigned_bot_id: "atencion-cliente",
      setup_completed: false
    },
    {
      user_id: "44444444-4444-4444-8444-444444444444",
      tenant_id: "tenant-both-d",
      company_name: "Empresa Ambos D",
      email: "admin@ambos-d.example",
      password,
      role: "admin",
      plan_id: "nextfor-uno",
      assigned_bot_id: "atencion-cliente",
      setup_completed: false
    }
  ];
  const child = childProcess.spawn(process.execPath, [path.join(__dirname, "index.js")], {
    cwd: __dirname,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      NODE_ENV: "test",
      DASHBOARD_KEY: "customer-setup-key",
      DASHBOARD_SESSION_SECRET: "customer-setup-session-secret",
      DASHBOARD_USERS: JSON.stringify([
        {
          username: "platform-owner",
          email: "owner@nextforia.example",
          password: "SuperAdminPassword2026",
          name: "Platform Owner",
          role: "super_admin"
        }
      ]),
      VERIFY_TOKEN: "customer-setup-verify",
      WA_TOKEN: "customer-setup-wa-dummy",
      ANTHROPIC_API_KEY: "customer-setup-anthropic-dummy",
      SUPABASE_URL: "",
      SUPABASE_KEY: "",
      CUSTOMER_ACCESS_V2_ENABLED: "1",
      CUSTOMER_ACCESS_TEST_MODE: "1",
      CUSTOMER_ACCESS_TEST_USERS: JSON.stringify(fixtures),
      CUSTOMER_PANEL_BASE_URL: "https://customer-panel.staging.example",
      SHOPIFY_APP_INSTALL_URL: "https://apps.shopify.com/nexforia-commerce",
      NEXFORIA_PAIRING_SECRET: "customer-setup-pairing-secret-2026",
      NEXFORIA_COMMERCE_SERVICE_SECRET: "customer-setup-commerce-service-secret-2026"
    }),
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer(child, port);
    const cookieA = await login(base, fixtures[0].email, password);
    const cookieB = await login(base, fixtures[1].email, password);
    const cookieC = await login(base, fixtures[2].email, password);
    const cookieD = await login(base, fixtures[3].email, password);
    const superAdminCookie = await login(base, "platform-owner", "SuperAdminPassword2026", true);

    let response = await fetch(base + "/admin/panel?tab=summary", {
      headers: { cookie: cookieA },
      redirect: "manual"
    });
    assert.strictEqual(response.status, 302, "a new customer must enter setup before the panel");
    assert.strictEqual(response.headers.get("location"), "/admin/client-onboarding");

    response = await fetch(base + "/admin/client-onboarding", { headers: { cookie: cookieA } });
    assert.strictEqual(response.status, 200);
    const setupHtml = await response.text();
    assert(setupHtml.includes("Comenzar el entrenamiento"));
    assert(setupHtml.includes('id="setupLogout"'));
    assert(setupHtml.includes('fetch("/admin/logout",{method:"POST",credentials:"same-origin",cache:"no-store"'));
    assert(setupHtml.includes("Entrena a Nextfor para trabajar por"));
    assert(setupHtml.includes("tu negocio."));
    assert(setupHtml.includes("¿Qué quieres que NextforIA impulse primero?"));
    assert(setupHtml.includes('name="setupGoal"'));
    assert(setupHtml.includes('name="setupGoal" data-field="setup_goal" value="appointments"'), "customer setup must offer appointment training");
    assert(setupHtml.includes('name="setupGoal" data-field="setup_goal" value="both"'), "customer setup must offer both bots");
    assert(setupHtml.includes("TODO GRAN VENDEDOR EMPIEZA CONOCIENDO SU EMPRESA"));
    assert(setupHtml.includes("Enséñale a Nextfor lo esencial de tu negocio"));
    assert(setupHtml.includes("¿Qué vende tu empresa?"));
    assert(setupHtml.includes("WordPress + WooCommerce"));
    assert(setupHtml.includes("WordPress sin tienda"));
    assert(setupHtml.includes("¿Quieres conectar esta tienda con NextforIA?"));
    assert(setupHtml.includes("Conectar Shopify"));
    assert(setupHtml.includes('/admin/integrations/shopify/connect'));
    assert(setupHtml.includes("Configuración → Dominios"));
    assert(setupHtml.includes(".myshopify.com"));
    assert(setupHtml.includes("No escribas contraseñas, tokens ni claves privadas aquí"));
    assert(setupHtml.includes("commerce.integration_intent"));
    assert(setupHtml.includes("Atención al cliente: clientes atendidos al mes"));
    assert(setupHtml.includes("operations.monthly_customer_volume"));
    assert(setupHtml.includes("customer_service_setup.business_offer_type"));
    assert(setupHtml.includes('name="selected_plan" value="nextfor-tempo"'), "customer setup must offer Nextfor Tempo");
    assert(setupHtml.includes('name="selected_plan" value="nextfor-atlas"'), "customer setup must offer Nextfor Atlas");
    assert(!setupHtml.includes('name="selected_plan" value="nextfor-signature"'), "customer setup must not offer Nextfor Signature");
    assert(setupHtml.includes("Terminar el entrenamiento de Nextfor"));
    assert(setupHtml.includes("lumen-entrenando.png"));
    assert(setupHtml.includes("Empresa Setup A"));
    assert(setupHtml.includes("admin@setup-a.example"));
    assert(setupHtml.includes("Nextfor Aura"));
    assert(setupHtml.includes("Atención al cliente"));
    assert(setupHtml.includes("Revisa y confirma el entrenamiento"));
    assert(setupHtml.includes('id="setupSummaryGrid"'));
    assert(setupHtml.includes("autoSaveDraft"));
    assert(setupHtml.includes("Guardado automático"));
    assert(setupHtml.includes("Elige el plan para tu empresa"));
    assert(setupHtml.includes("No requiere autorización de Super Admin"));
    assert(!setupHtml.includes("¿Quieres integrar este WhatsApp con Meta desde Nextfor IA?"));
    assert(setupHtml.includes("Usaremos este número para guiar la conexión oficial con Meta"));
    assert(setupHtml.includes("WhatsApp + número"));
    assert(setupHtml.includes("Instagram + usuario"));
    assert(setupHtml.includes("Te falta completar: "));
    assert(setupHtml.includes("missingSummary"));
    assert(setupHtml.includes(".field.invalid .segment span"));
    assert(setupHtml.includes(".goalCards.invalid .goalCardBody"));
    assert(setupHtml.includes('name="selected_plan" value="nextfor-uno"'));
    assert(!setupHtml.includes("Empresa Returning B"));

    response = await fetch(base + "/admin/client-onboarding/data?tenant_id=tenant-returning-b", {
      headers: { cookie: cookieA }
    });
    assert.strictEqual(response.status, 200);
    let payload = await response.json();
    assert.strictEqual(payload.tenant.id, "tenant-setup-a");
    assert.strictEqual(payload.onboarding.setup_completed, false);
    assert(payload.questionnaire.questions.some(function (question) { return question.id === "bot_communication_instructions"; }));

    const draft = completedAnswers("Empresa Setup A", fixtures[0].email, "A");
    draft.operations.important_policies = "";
    response = await fetch(base + "/admin/client-onboarding/data?tenant_id=tenant-returning-b", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: base, cookie: cookieA },
      body: JSON.stringify({ tenant_id: "tenant-returning-b", status: "draft", plan_id: "nextfor-uno", answers: draft })
    });
    assert.strictEqual(response.status, 200);
    payload = await response.json();
    assert.strictEqual(payload.onboarding.tenant_id, "tenant-setup-a");
    assert.strictEqual(payload.onboarding.status, "draft");
    assert.strictEqual(payload.onboarding.setup_completed, false);
    assert.strictEqual(payload.onboarding.answers.operations.services_products, "Servicios A");
    assert.strictEqual(payload.selected_plan_id, "nextfor-uno");
    assert(payload.onboarding.last_updated_at);

    response = await fetch(base + "/admin/integrations/shopify/connect?tenant_id=tenant-returning-b", {
      headers: { cookie: cookieA },
      redirect: "manual"
    });
    assert.strictEqual(response.status, 302, "Shopify connect must redirect to the app install URL");
    const shopifyLocation = new URL(response.headers.get("location"));
    assert.strictEqual(shopifyLocation.origin + shopifyLocation.pathname, "https://apps.shopify.com/nexforia-commerce");
    assert.strictEqual(shopifyLocation.searchParams.get("tenant_id"), "tenant-setup-a");
    assert.strictEqual(shopifyLocation.searchParams.get("shop"), "store-a.myshopify.com");
    assert(String(shopifyLocation.searchParams.get("pairing_token") || "").startsWith("nexforia-pairing-v1."));

    response = await fetch(base + "/admin/client-onboarding/data", { headers: { cookie: cookieA } });
    payload = await response.json();
    assert.strictEqual(payload.onboarding.answers.commerce.shopify_shop, "store-a.myshopify.com");
    assert.strictEqual(payload.onboarding.answers.commerce.integration_status, "pending_customer");

    response = await fetch(base + "/admin/client-onboarding/data", { headers: { cookie: cookieA } });
    payload = await response.json();
    assert.strictEqual(payload.tenant.plan_id, "nextfor-uno", "the customer selection updates its own central tenant");

    response = await fetch(base + "/admin/client-onboarding/data", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: base, cookie: cookieA },
      body: JSON.stringify({ status: "completed", answers: draft })
    });
    assert.strictEqual(response.status, 422);
    assert.strictEqual((await response.json()).error, "setup_incomplete");

    response = await fetch(base + "/admin/client-onboarding/data", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: base, cookie: cookieA },
      body: JSON.stringify({ status: "completed", answers: completedAnswers("Empresa Setup A", fixtures[0].email, "A") })
    });
    assert.strictEqual(response.status, 200);
    payload = await response.json();
    assert.strictEqual(payload.onboarding.setup_completed, true);
    assert.strictEqual(payload.onboarding.status, "completed");
    assert.strictEqual(payload.onboarding.answers.setup_goal, "customer_service");
    assert.strictEqual(payload.onboarding.answers.customer_service_setup.setup_status, "pending_review");
    assert.strictEqual(payload.onboarding.answers.customer_service_setup.data_consent, true);
    assert.strictEqual(payload.onboarding.answers.operations.monthly_customer_volume, "300");
    assert.strictEqual(payload.onboarding.answers.meta.whatsapp_integration_intent, "yes");
    assert.strictEqual(payload.onboarding.answers.meta.whatsapp_integration_status, "requested");
    assert.strictEqual(payload.onboarding.answers.commerce.platform, "shopify");
    assert.strictEqual(payload.onboarding.answers.commerce.integration_status, "requested");
    assert.strictEqual(payload.onboarding.answers.commerce.store_url, "https://store-a.myshopify.com");
    assert(payload.onboarding.setup_completed_at);
    assert(payload.onboarding.last_updated_at);
    assert.strictEqual(payload.redirect, "/admin/panel?tab=setup&from=onboarding");

    response = await fetch(base + "/admin/integrations/shopify/connect", {
      headers: { cookie: cookieA },
      redirect: "manual"
    });
    assert.strictEqual(response.status, 302);
    response = await fetch(base + "/internal/shopify/sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer customer-setup-commerce-service-secret-2026"
      },
      body: JSON.stringify({
        session: [
          ["id", "offline_store-a.myshopify.com"],
          ["shop", "store-a.myshopify.com"],
          ["isOnline", false],
          ["accessToken", "private-shopify-token"],
          ["scope", "read_products,read_inventory,read_orders"]
        ]
      })
    });
    assert.strictEqual(response.status, 200);
    response = await fetch(base + "/admin/client-onboarding/data", { headers: { cookie: cookieA } });
    payload = await response.json();
    assert.strictEqual(payload.onboarding.answers.commerce.integration_status, "connected", "panel data reconciles a completed Shopify install");
    assert.strictEqual(payload.onboarding.answers.commerce.shopify_shop, "store-a.myshopify.com");

    response = await fetch(base + "/internal/shopify/pairings/claim", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer customer-setup-commerce-service-secret-2026"
      },
      body: JSON.stringify({ shop: "store-a.myshopify.com" })
    });
    assert.strictEqual(response.status, 200, "the authenticated Shopify app must finish pairing without a browser cookie");
    payload = await response.json();
    assert.strictEqual(payload.tenant_id, "tenant-setup-a");
    assert.strictEqual(payload.bot_id, "atencion-cliente");
    response = await fetch(base + "/admin/client-onboarding/data", { headers: { cookie: cookieA } });
    payload = await response.json();
    assert.strictEqual(payload.onboarding.answers.commerce.integration_status, "connected");
    assert.strictEqual(payload.onboarding.answers.commerce.shopify_shop, "store-a.myshopify.com");

    response = await fetch(base + "/admin/customer-setups/tenant-setup-a", {
      headers: { cookie: superAdminCookie }
    });
    assert.strictEqual(response.status, 200);
    payload = await response.json();
    assert.strictEqual(payload.review.status, "ready");
    assert.strictEqual(payload.onboarding.customer_service_configuration.bot_type, "customer_service");
    assert.strictEqual(payload.onboarding.customer_service_configuration.lifecycle, "draft");
    assert(payload.review.history.some(function (event) {
      return event.action === "auto_build_configuration";
    }));

    response = await fetch(base + "/admin/customer-setups/tenant-setup-a", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: base, cookie: superAdminCookie },
      body: JSON.stringify({ action: "update", review_status: "testing" })
    });
    assert.strictEqual(response.status, 200);
    payload = await response.json();
    assert.strictEqual(payload.review.status, "ready", "a manual status value cannot skip Building");

    response = await fetch(base + "/admin/customer-setups/tenant-setup-a", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: base, cookie: superAdminCookie },
      body: JSON.stringify({ action: "build_configuration" })
    });
    assert.strictEqual(response.status, 422);
    assert.strictEqual((await response.json()).error, "setup_must_be_approved");

    response = await fetch(base + "/admin/customer-setups/tenant-setup-a", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: base, cookie: superAdminCookie },
      body: JSON.stringify({ action: "approve" })
    });
    assert.strictEqual(response.status, 200);
    payload = await response.json();
    assert.strictEqual(payload.review.status, "building");
    assert.strictEqual(payload.onboarding.answers.customer_service_setup.setup_status, "approved");

    response = await fetch(base + "/admin/customer-setups/tenant-setup-a", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: base, cookie: superAdminCookie },
      body: JSON.stringify({ action: "build_configuration" })
    });
    assert.strictEqual(response.status, 200);
    payload = await response.json();
    assert.strictEqual(payload.review.status, "building");
    assert.strictEqual(payload.onboarding.customer_service_configuration.bot_type, "customer_service");
    assert.strictEqual(payload.onboarding.customer_service_configuration.lifecycle, "draft");
    assert.strictEqual(payload.onboarding.customer_service_configuration.source_record, "client-onboarding");
    assert.strictEqual(payload.onboarding.customer_service_configuration.commerce_platform, "shopify");
    assert.strictEqual(payload.onboarding.customer_service_configuration.commerce_integration_status, "connected");
    assert.match(payload.onboarding.customer_service_configuration.system_prompt, /No gestiones citas/);

    const editedConfiguration = payload.onboarding.customer_service_configuration;
    editedConfiguration.objective = "Atender y convertir oportunidades calificadas.";
    response = await fetch(base + "/admin/customer-setups/tenant-setup-a", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: base, cookie: superAdminCookie },
      body: JSON.stringify({
        action: "save_configuration",
        customer_service_configuration: editedConfiguration
      })
    });
    assert.strictEqual(response.status, 200);
    payload = await response.json();
    assert.strictEqual(payload.review.status, "building");
    assert.match(payload.onboarding.customer_service_configuration.system_prompt, /Atender y convertir oportunidades calificadas/);

    response = await fetch(base + "/admin/customer-setups/tenant-setup-a", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: base, cookie: superAdminCookie },
      body: JSON.stringify({
        action: "approve_configuration",
        customer_service_configuration: payload.onboarding.customer_service_configuration
      })
    });
    assert.strictEqual(response.status, 200);
    payload = await response.json();
    assert.strictEqual(payload.review.status, "testing");
    assert.strictEqual(payload.onboarding.customer_service_configuration.lifecycle, "approved_for_testing");
    assert.strictEqual(payload.onboarding.customer_service_configuration.approved_for_testing_by, "Platform Owner");

    response = await fetch(base + "/admin/customer-setups/tenant-setup-a", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: base, cookie: superAdminCookie },
      body: JSON.stringify({ action: "launch_live", review_status: "live" })
    });
    assert.strictEqual(response.status, 400);
    assert.strictEqual((await response.json()).error, "launch_confirmation_required");

    const validLaunchConfiguration = payload.onboarding.customer_service_configuration;
    const invalidWhatsappAnswers = JSON.parse(JSON.stringify(payload.onboarding.answers));
    invalidWhatsappAnswers.meta.whatsapp_number = "3000000000";
    response = await fetch(base + "/admin/customer-setups/tenant-setup-a", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: base, cookie: superAdminCookie },
      body: JSON.stringify({
        action: "launch_live",
        launch_confirmed: true,
        answers: invalidWhatsappAnswers,
        customer_service_configuration: validLaunchConfiguration
      })
    });
    assert.strictEqual(response.status, 409);
    payload = await response.json();
    assert.strictEqual(payload.error, "launch_blocked");
    assert(payload.details.blockers.some(function (item) {
      return item.code === "whatsapp_number_invalid";
    }), "Live must block WhatsApp numbers without country code");

    response = await fetch(base + "/admin/customer-setups/tenant-setup-a", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: base, cookie: superAdminCookie },
      body: JSON.stringify({
        action: "launch_live",
        launch_confirmed: true,
        customer_service_configuration: validLaunchConfiguration
      })
    });
    assert.strictEqual(response.status, 200);
    payload = await response.json();
    assert.strictEqual(payload.review.status, "live");
    assert.strictEqual(payload.onboarding.answers.customer_service_setup.setup_status, "active");
    assert.strictEqual(payload.onboarding.customer_service_configuration.lifecycle, "approved_for_testing");
    assert.strictEqual(payload.launch.ready, true);

    response = await fetch(base + "/admin/customer-setups/tenant-setup-a/test", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie: cookieA },
      body: "{}"
    });
    assert.strictEqual(response.status, 401, "a customer cannot run Super Admin operational tests");

    response = await fetch(base + "/admin/customer-setups/tenant-setup-a/test", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie: superAdminCookie },
      body: "{}"
    });
    assert.strictEqual(response.status, 200);
    payload = await response.json();
    assert.strictEqual(payload.result.safe, true);
    assert.strictEqual(payload.result.tenant_id, "tenant-setup-a");
    assert.strictEqual(payload.result.total, 7);
    assert(payload.result.checks.some(function (check) {
      return check.code === "bot_configuration" && check.ok;
    }));
    assert.strictEqual(
      payload.review.history[payload.review.history.length - 1].action,
      "run_safe_test",
      "the per-customer test must be audited"
    );

    response = await fetch(base + "/admin/customer-setups/tenant-setup-a/sync-live", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie: superAdminCookie },
      body: "{}"
    });
    assert.strictEqual(response.status, 200);
    payload = await response.json();
    assert.strictEqual(payload.tenant.status, "activo");
    assert.strictEqual(
      payload.review.history[payload.review.history.length - 1].action,
      "sync_live_access",
      "manual Live access repair must be audited"
    );

    response = await fetch(base + "/admin/panel?tab=summary", {
      headers: { cookie: cookieA },
      redirect: "manual"
    });
    assert.strictEqual(response.status, 200, "completed setup must open the normal panel");
    const panelA = await response.text();
    assert(panelA.includes("Empresa Setup A"));
    assert(panelA.includes('id="setupHomeCard" hidden'), "completed setup must not show a second onboarding reminder");

    response = await fetch(base + "/admin/client-onboarding", {
      headers: { cookie: cookieA },
      redirect: "manual"
    });
    assert.strictEqual(response.status, 302, "completed customers must not repeat onboarding");
    assert.strictEqual(response.headers.get("location"), "/admin/panel?tab=setup&from=onboarding");

    response = await fetch(base + "/admin/panel?tab=summary", {
      headers: { cookie: cookieB },
      redirect: "manual"
    });
    assert.strictEqual(response.status, 200, "returning customers skip setup");
    const panelB = await response.text();
    assert(panelB.includes("Empresa Returning B"));
    assert(!panelB.includes("Empresa Setup A"));
    assert(panelB.includes('id="setupHomeCard" hidden'));

    response = await fetch(base + "/admin/client-onboarding/data?tenant_id=tenant-setup-a", {
      headers: { cookie: cookieB }
    });
    payload = await response.json();
    assert.strictEqual(payload.tenant.id, "tenant-returning-b");
    assert.strictEqual(payload.tenant.plan_id, "nextfor-aura", "tenant B plan must not change when tenant A selects a plan");
    assert(!JSON.stringify(payload).includes("Servicios A"), "tenant B cannot infer tenant A setup");

    response = await fetch(base + "/admin/panel/commerce-connector?tenant_id=tenant-setup-a", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie: cookieB },
      body: JSON.stringify({ tenant_id: "tenant-setup-a", platform: "shopify" })
    });
    assert.strictEqual(response.status, 200, "customer can request commerce later from the panel");
    payload = await response.json();
    assert.strictEqual(payload.onboarding.tenant_id, "tenant-returning-b");
    assert.strictEqual(payload.commerce.platform, "shopify");
    assert.strictEqual(payload.commerce.integration_intent, "yes");
    assert.strictEqual(payload.commerce.integration_status, "requested");
    assert.strictEqual(payload.commerce.requested_from, "customer_panel");

    response = await fetch(base + "/admin/client-onboarding/data", { headers: { cookie: cookieB } });
    payload = await response.json();
    assert.strictEqual(payload.onboarding.answers.commerce.platform, "shopify");
    assert.strictEqual(payload.onboarding.answers.commerce.integration_status, "requested");
    assert.strictEqual(payload.tenant.id, "tenant-returning-b");

    response = await fetch(base + "/admin/client-onboarding/data", { headers: { cookie: cookieA } });
    payload = await response.json();
    assert.notStrictEqual(payload.onboarding.answers.commerce.requested_from, "customer_panel", "commerce request cannot cross tenants");

    response = await fetch(base + "/admin/panel/commerce-connector", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, cookie: cookieB },
      body: JSON.stringify({ platform: "magento" })
    });
    assert.strictEqual(response.status, 400);

    response = await fetch(base + "/admin/client-onboarding/data", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: base, cookie: cookieC },
      body: JSON.stringify({
        status: "completed",
        plan_id: "nextfor-tempo",
        bot_id: "agendamiento",
        answers: appointmentStageOneAnswers("Empresa Citas C")
      })
    });
    assert.strictEqual(response.status, 200, "Nextfor Tempo can complete the customer setup");
    payload = await response.json();
    assert.strictEqual(payload.selected_plan_id, "nextfor-tempo");
    assert.strictEqual(payload.selected_bot_id, "agendamiento");

    response = await fetch(base + "/admin/client-onboarding/data", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: base, cookie: cookieD },
      body: JSON.stringify({
        status: "completed",
        plan_id: "nextfor-atlas",
        bot_id: "atencion-cliente",
        answers: bothBotAnswers("Empresa Ambos D", fixtures[3].email)
      })
    });
    assert.strictEqual(response.status, 200, "Nextfor Atlas can complete the customer setup");
    payload = await response.json();
    assert.strictEqual(payload.selected_plan_id, "nextfor-atlas");

    console.log("customer-setup-flow.e2e.test.js: ok");
  } finally {
    child.kill("SIGTERM");
  }
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
