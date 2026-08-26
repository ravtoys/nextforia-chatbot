"use strict";

const assert = require("assert");
const vm = require("vm");
const renderSuperAdminPanel = require("./super-admin-panel");

let contentType = "";
let html = "";
renderSuperAdminPanel({
  setHeader: function (name, value) {
    if (String(name).toLowerCase() === "content-type") contentType = value;
  },
  send: function (body) { html = body; }
}, {
  auth: { username: "root", name: '<script>alert("x")</script>', role: "super_admin" },
  botVersion: "v-test",
  tenant: { id: "rav-toys", name: "RAV Toys", status: "active", customer_number: 1 },
  registeredClients: [{
    tenant_id: "grupo-derco",
    brand_name: "Grupo Jurídico DERCO S.A.S.",
    short_name: "DERCO",
    customer_number: 1,
    status: "pilot",
    industry: "professional_services"
  }],
  commercialReadiness: {
    version: "test",
    stages: [
      { label: "Calificación comercial", owner: "NexforIA", status: "ready" },
      { label: "Meta WhatsApp", owner: "Meta", status: "waiting_meta" }
    ],
    requiredTenantFields: ["tenant_id", "shopify_admin_token"]
  },
  accessModel: {
    version: "test",
    roles: [{ role: "super_admin", level: 4, owner: "NexforIA", scope: "platform", purpose: "Opera plataforma." }],
    future_panels: [{ id: "platform_super_admin", label: "Super admin", owner: "NexforIA", roles: ["super_admin"], purpose: "Opera plataforma." }]
  },
  integration: {
    integration_number: 1,
    status: "activation_pending",
    label: "Aprobada - falta activar el numero",
    next_action: "Conectar y verificar +57 301 587 2708.",
    target_display_phone: "+57 301 587 2708",
    app_review: { approved: true, status: "approved" },
    connection: { mode: "test", real_number_active: false, graph_api_ready: true }
  }
});

assert.match(contentType, /text\/html/);
assert.match(html, /Panel Super Admin/);
assert.match(html, /Versión del panel/);
assert.match(html, /v-test/);
assert.match(html, /data-view="overview"/);
assert.match(html, /data-view="clients"/);
assert.match(html, /data-view="leads"/);
assert.match(html, /id="leadNavCount"/);
assert.match(html, /data-view="incidents"/);
assert.match(html, /data-view="botOps"/);
assert.match(html, /data-panel="botOps"/);
assert.match(html, /Bot Ops &amp; Improvement/);
assert.match(html, /id="botOpsOverall"/);
assert.match(html, /id="botOpsDaily"/);
assert.match(html, /id="botOpsWeekly"/);
assert.match(html, /id="botOpsUpdated"/);
assert.match(html, /id="botOpsIncidents"/);
assert.match(html, /id="botOpsOpportunities"/);
assert.match(html, /id="botOpsApprovals"/);
assert.match(html, /\/admin\/bot-ops\/summary/);
assert.match(html, /loadBotOps/);
assert.match(html, /no modifica prompts/i);
assert.match(html, /data-view="billing"/);
assert.match(html, /data-view="aiCosts"/);
assert.match(html, /data-panel="aiCosts"/);
assert.match(html, /IA · costos y recargas/);
assert.match(html, /id="aiProviderCards"/);
assert.match(html, /id="aiBotRows"/);
assert.match(html, /id="aiConversationRows"/);
assert.match(html, /id="aiDriverRows"/);
assert.match(html, /\/admin\/ai-costs/);
assert.match(html, /platform\.claude\.com\/settings\/billing/);
assert.match(html, /platform\.openai\.com\/settings\/organization\/billing\/overview/);
assert.match(html, /data-view="questionnaire"/);
assert.match(html, /data-view="setupReview"/);
assert.match(html, /data-view="agendamiento"/);
assert.match(html, /Supervisión real de Appointment/);
assert.match(html, /id="appointmentOverviewRows"/);
assert.match(html, /\/admin\/appointments-overview/);
assert.match(html, /loadAppointmentOverview/);
assert.match(html, /data-view="atencion"/);
assert.match(html, /Bandeja de operación/);
assert.match(html, /Revisión antes de activar bots/);
assert.match(html, /id="setupReviewRows"/);
assert.match(html, /id="setupReviewDetail"/);
assert.match(html, /id="setupReviewSearchInput"/);
assert.match(html, /applySetupReviewSearch/);
assert.match(html, /id="setupReviewSortOrder"/);
assert.match(html, /\/admin\/customer-setups/);
assert.match(html, /appointment_elevenlabs_agent_not_configured/);
assert.match(html, /appointment_calls_not_ready/);
assert.match(html, /Configurar agente/);
assert.match(html, /Canales solicitados por el cliente/);
assert.match(html, /Esto no significa que ya estén conectados/);
assert.match(html, /Pendiente de conexión/);
assert.match(html, /Conectado/);
assert.match(html, /Incomplete/);
assert.match(html, /Ready/);
assert.match(html, /Building/);
assert.match(html, /Testing/);
assert.match(html, /Live/);
assert.match(html, /Pedir cambios/);
assert.match(html, /Aprobar setup/);
assert.match(html, /Eliminar cliente/);
assert.match(html, /espera aprobación de Super Admin/);
assert.match(html, /Construir configuración/);
assert.match(html, /Aprobar para Testing/);
assert.match(html, /Borrador de Customer Service/);
assert.match(html, /Despliegue y QA/);
assert.match(html, /Appointment Setup queda reservado exclusivamente/);
assert.match(html, /Shopify y WordPress/);
assert.match(html, /Estado del catálogo/);
assert.match(html, /Responsable de autorización/);
assert.match(html, /Antes de activar Live/);
assert.match(html, /Aceptar y activar Live/);
assert.match(html, /Operación del cliente/);
assert.match(html, /Ejecutar prueba segura/);
assert.match(html, /Sincronizar acceso Live/);
assert.match(html, /\/admin\/customer-setups\/.*\/test/);
assert.match(html, /\/admin\/customer-setups\/.*\/sync-live/);
assert.match(html, /Invitar Super Admin/);
assert.match(html, /id="superAdminInviteModal"/);
assert.match(html, /id="superAdminInviteEmail"/);
assert.match(html, /id="superAdminInviteLink"/);
assert.match(html, /\/admin\/super-admin\/invitations/);
assert.match(html, /copySuperAdminInvite/);
assert.match(html, /launch_blocked/);
assert.match(html, /Conectar WhatsApp/);
assert.match(html, /Conectar Shopify/);
assert.match(html, /startSetupChannelConnection/);
assert.match(html, /\/\^\\\+\\d\{10,15\}\$\//);
assert.match(html, /\/admin\/integrations\/shopify\/connect\//);
assert.doesNotMatch(html, /id="setupReviewStatus"/);
assert.match(html, /mismo setup que usa Customer Panel/);
assert.match(html, /Editor simple del Customer Setup/);
assert.match(html, /data-question-bot="customer_service"/);
assert.match(html, /data-question-bot="appointments"/);
assert.match(html, /Bot Atención \/ Ventas 24\/7/);
assert.match(html, /Bot Agendamiento/);
assert.match(html, /si elige ambos, completa los dos cuestionarios/i);
assert.match(html, /No se borran preguntas ni respuestas/);
assert.match(html, /Las preguntas creadas aquí quedan asignadas a este bot/);
assert.match(html, /No se borra; puedes ocultarla/);
assert.match(html, /id="questionnaireRows"/);
assert.match(html, /Nueva pregunta/);
assert.match(html, /Guardar cuestionario/);
assert.match(html, /\/admin\/customer-setup-questionnaire/);
assert.match(html, /\/admin\/assets\/lumen\.png/);
// La tarjeta del sidebar acompaña el camino a los 340 clientes, no el margen.
assert.match(html, /Camino a 340/);
assert.match(html, /de 340 clientes/);
assert.match(html, /id="goalHeadline"/);
assert.match(html, /id="goalPhrase"/);
assert.match(html, /aria-label="Editar meta de clientes"/);
assert.match(html, /id="goalModal"/);
assert.match(html, /Editar meta de Lumen/);
assert.match(html, /\/admin\/platform-goals\/customers/);
assert.match(html, /mobile-goal-shell/);
assert.doesNotMatch(html, /Margen del mes/);
assert.match(html, /--gradient-cyan/);
assert.match(html, /Grupo Jurídico DERCO/);
assert.match(html, /\/admin\/pilots\/derco/);
assert.match(html, /Cliente #1 · RAV Toys/);
assert.match(html, /rav-toys · Integracion #1/);
assert.match(html, /Piloto #1/);
assert.match(html, /Clientes visibles/);
assert.match(html, /hideLegacyClient/);
assert.match(html, /\/admin\/legacy-clients\//);
assert.match(html, />Eliminar<\/button>/);
assert.match(html, /Filtro 1 de 2/);
assert.match(html, /Filtro 2 de 2/);
assert.match(html, /company_name_confirmacion/);
assert.match(html, /confirmacion_final/);
assert.doesNotMatch(html, /La lista antigua ya no se muestra en Staging/);
assert.match(html, /Crear acceso RAV/);
assert.match(html, /role="dialog" aria-modal="true"/);
assert.match(html, /Meta aprobada/);
assert.match(html, /Activacion del numero real pendiente/);
assert.match(html, /\/admin\/integrations\/rav\/test/);
assert.match(html, /Ejecutar prueba segura/);
assert.match(html, /No se muestran datos de ejemplo como si fueran producción/);
assert.match(html, /Lead = cuenta creada/);
assert.match(html, /id="leadPipelineRows"/);
assert.match(html, /id="leadSearchInput"/);
assert.match(html, /applyLeadSearch/);
assert.match(html, /id="leadSortOrder"/);
assert.match(html, /Más recientes primero/);
assert.match(html, /Más antiguos primero/);
assert.match(html, /<span>Fecha<\/span>/);
assert.match(html, /\/admin\/leads/);
assert.match(html, /email y clave/);
assert.doesNotMatch(html, /<script>alert\("x"\)<\/script>/);
assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/);
assert(inlineScript, "Super Admin must render its application script");
assert.doesNotThrow(function () {
  new vm.Script(inlineScript[1], { filename: "super-admin-inline.js" });
}, "Super Admin inline JavaScript must be syntactically valid");

// Sin fuente financiera el panel no inventa cifras.
assert.match(html, /sin fuente financiera conectada/);
assert.match(html, /El Pareto de ingresos aparece con ventas reales/);

// Los registros heredados pueden ocultarse del panel sin activar Customer Access v2.
let hiddenLegacyHtml = "";
renderSuperAdminPanel({
  setHeader: function () {},
  send: function (body) { hiddenLegacyHtml = body; }
}, {
  auth: { username: "root", name: "Root", role: "super_admin" },
  botVersion: "v-test",
  tenant: { id: "rav-toys", name: "RAV Toys", status: "active", customer_number: 1 },
  registeredClients: [{
    tenant_id: "grupo-derco",
    brand_name: "Grupo Jurídico DERCO S.A.S.",
    short_name: "DERCO",
    customer_number: 1,
    status: "pilot",
    industry: "professional_services"
  }],
  hiddenLegacyClientIds: ["grupo-derco"],
  commercialReadiness: { stages: [], requiredTenantFields: [] },
  accessModel: { roles: [], future_panels: [] },
  integration: { status: "activation_pending", label: "Activacion pendiente", app_review: {} }
});
assert.doesNotMatch(hiddenLegacyHtml, /Grupo Jurídico DERCO/);
assert.match(hiddenLegacyHtml, /RAV Toys/);

let setupBridgeHtml = "";
renderSuperAdminPanel({
  setHeader: function () {},
  send: function (body) { setupBridgeHtml = body; }
}, {
  auth: { username: "root", name: "Root", role: "super_admin" },
  botVersion: "v-test",
  tenant: { id: "rav-toys", name: "RAV Toys", status: "active", customer_number: 1 },
  registeredClients: [],
  commercialReadiness: { stages: [], requiredTenantFields: [] },
  accessModel: { roles: [], future_panels: [] },
  integration: { status: "activation_pending", label: "Activacion pendiente", app_review: {} },
  leads: {
    kpis: { active: 1, won: 0, demos: 0, conversion: 0 },
    sources: [{ name: "Setup", paid: false, leads: 1, won: 0 }],
    rows: [{
      tenant_id: "mi-empresa",
      company_name: "Mi Empresa QA",
      admin_email: "qa@example.com",
      contact_phone: "+57 300 000 0000",
      stage: "setup_completed",
      stage_label: "Setup completo · falta pago/trial",
      next_action: "Activar pago, trial o piloto aprobado.",
      completion: 100,
      setup_completed: true,
      plan_id: "nextfor-uno",
      assigned_bot_id: "atencion-cliente",
      updated_at: "2026-07-27T18:00:00.000Z"
    }],
    customers: []
  }
});
assert.match(setupBridgeHtml, /Cuentas nuevas del setup/);
assert.match(setupBridgeHtml, /Mi Empresa QA/);
assert.match(setupBridgeHtml, /100% setup/);
assert.match(setupBridgeHtml, /Setup completo/);
assert.match(setupBridgeHtml, /Ver ficha\/setup/);
assert.match(setupBridgeHtml, /openTenantSetup/);
assert.match(setupBridgeHtml, />Suspender<\/button>/);
assert.match(setupBridgeHtml, /openTenantDelete/);

// Con fuente financiera conectada el diseño pinta desglose, tabla y Pareto.
let richHtml = "";
renderSuperAdminPanel({
  setHeader: function () {},
  send: function (body) { richHtml = body; }
}, {
  auth: { username: "root", name: "Root", role: "super_admin" },
  botVersion: "v-test",
  tenant: { id: "rav-toys", name: "RAV Toys", status: "active" },
  registeredClients: [],
  commercialReadiness: { stages: [], requiredTenantFields: [] },
  accessModel: { roles: [], future_panels: [] },
  finance: {
    currency: "COP",
    bots: [
      { id: "agendamiento", name: "Agendamiento", clients: 3, mrr: 6000000, users: 420, usersUnit: "citas/mes", costs: 1500000 },
      { id: "atencion", name: "Atención al cliente", clients: 2, mrr: 4000000, users: 1800, usersUnit: "conv./mes", costs: 1200000 }
    ],
    pareto: [
      { name: "Agendamiento", revenue: 6000000, botId: "agendamiento" },
      { name: "Atención al cliente", revenue: 4000000, botId: "atencion" }
    ],
    attention: { webhooks: 2, pendingAppointments: 7, queues: 1, overdue: 0 }
  },
  leads: {
    kpis: { active: 12, won: 3, demos: 5, conversion: 25 },
    sources: [{ name: "Meta Ads", paid: true, leads: 8, won: 2 }],
    rows: [{
      tenant_id: "lead-demo",
      company_name: "Lead Demo S.A.S.",
      admin_email: "lead@example.com",
      contact_phone: "+57 300 111 2222",
      stage: "account_created",
      stage_label: "Cuenta creada",
      next_action: "Acompañar para que empiece el setup.",
      completion: 0,
      plan_id: "starter",
      assigned_bot_id: "atencion-cliente",
      updated_at: "2026-07-26T13:00:00.000Z"
    }]
  }
});
assert.match(richHtml, /Consolidado/);
assert.match(richHtml, /Pareto de ingresos/);
assert.match(richHtml, /Meta Ads/);
assert.match(richHtml, /Lead Demo S\.A\.S\./);
assert.match(richHtml, /Cuenta creada/);
assert.match(richHtml, /2026-07-26/);
assert.match(richHtml, /Acompañar para que empiece el setup/);
assert.doesNotMatch(richHtml, /sin fuente financiera conectada/);

let accessV2Html = "";
renderSuperAdminPanel({
  setHeader: function () {},
  send: function (body) { accessV2Html = body; }
}, {
  auth: { username: "root", name: "Root", role: "super_admin" },
  botVersion: "v-test",
  tenant: { id: "rav-toys", name: "RAV Toys", status: "active" },
  registeredClients: [],
  commercialReadiness: { stages: [], requiredTenantFields: [] },
  accessModel: { roles: [], future_panels: [] },
  customerAccessV2Enabled: true
});
assert.match(accessV2Html, /Crear cliente/);
assert.match(accessV2Html, /Altas e invitaciones/);
assert.match(accessV2Html, /name="company_name"/);
assert.match(accessV2Html, /name="admin_email"/);
assert.match(accessV2Html, /name="plan_id"/);
assert.match(accessV2Html, /name="assigned_bot_id"/);
assert.match(accessV2Html, /\/admin\/customer-access\/catalogs/);
assert.match(accessV2Html, /\/admin\/customer-invitations/);
assert.match(accessV2Html, /syncCustomerCreateBotToPlan/);
assert.match(accessV2Html, /botSelect\.disabled=true/);
assert.match(accessV2Html, /customerCreatePlan\.addEventListener\("change",syncCustomerCreateBotToPlan\)/);
assert.match(accessV2Html, /No existe registro público/);
assert.doesNotMatch(accessV2Html, /body:JSON\.stringify\(\{[^}]*setup_url/);

// Catálogo de planes y bots: la sección solo existe con el gate encendido.
assert.match(accessV2Html, /data-view="catalogs"/);
assert.match(accessV2Html, /Planes y bots/);
assert.match(accessV2Html, /id="planEditorModal"/);
assert.match(accessV2Html, /id="botEditorModal"/);
assert.match(accessV2Html, /row\.name\|\|row\.nombre\|\|row\.id/);
assert.doesNotMatch(accessV2Html, /name="precio_setup"/);
assert.match(accessV2Html, /Setup cost/);
assert.match(accessV2Html, /name="precio_mensual"/);
assert.match(accessV2Html, /name="beneficios"/);
assert.match(accessV2Html, /\/admin\/catalogs/);

// Clientes reales: el registro heredado no aparece con v2; eliminar es más directo.
assert.match(accessV2Html, /Clientes reales/);
assert.doesNotMatch(accessV2Html, /Registro heredado/);
assert.doesNotMatch(accessV2Html, /escrito en código/);
assert.match(accessV2Html, /id="tenantDeleteModal"/);
assert.match(accessV2Html, /Ver ficha\/setup/);
assert.match(accessV2Html, /Servicios globales, no conexión del cliente/);
assert.match(accessV2Html, /La operación real vive por cliente/);
assert.match(accessV2Html, /Escribe el nombre exacto de la empresa/);
assert.match(accessV2Html, /Se descarga un respaldo antes de borrar/);
assert.match(accessV2Html, /El acceso se corta automáticamente/);
assert.match(accessV2Html, /Perderá acceso al panel, pero sus datos quedan guardados/);
assert.match(accessV2Html, /\/admin\/tenants/);

// Sin el gate, nada del catálogo se filtra al panel.
assert.doesNotMatch(html, /data-view="catalogs"/);
assert.doesNotMatch(html, /id="planEditorModal"/);
assert.doesNotMatch(html, /Clientes reales/);

console.log("super-admin-panel.test.js: ok");
