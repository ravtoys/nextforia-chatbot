"use strict";

const assert = require("assert");
const renderCustomerPanel = require("./customer-panel");

function render(options) {
  let status = 0;
  let contentType = "";
  let html = "";
  const res = {
    status: function (value) { status = value; return this; },
    setHeader: function (name, value) { if (name.toLowerCase() === "content-type") contentType = value; return this; },
    send: function (value) { html = String(value); return this; }
  };
  renderCustomerPanel(res, Object.assign({ auth: { name: "Admin", role: "admin" }, capabilities: {}, initialTab: "summary", botVersion: "v-test-panel" }, options || {}));
  assert.strictEqual(status, 200);
  assert(contentType.includes("text/html"));
  return html;
}

const legacy = render();
assert(legacy.includes("<title>Nextfor IA · Tu empresa</title>"));
assert(legacy.includes('<h1><span id="brandBusinessName">Tu empresa</span></h1><p>con <span>Nextfor IA</span></p>'));
assert(legacy.includes('<h1><span id="mobileBrandBusinessName">Tu empresa</span></h1><p>con <span>Nextfor IA</span></p>'));
assert(!legacy.includes('id="bot-support"'));
assert(!legacy.includes('id="bot-appointments"'));
assert(!legacy.includes(">RAV Toys<"));

const tenantA = render({
  tenantContext: { id: "tenant-a", company_name: "Empresa A", plan_id: "nextfor-aura", assigned_bot_id: "atencion-cliente", status: "live" }
});
assert(tenantA.includes("<title>Nextfor IA · Empresa A</title>"));
assert(tenantA.includes('<h1><span id="brandBusinessName">Empresa A</span></h1><p>con <span>Nextfor IA</span></p>'));
assert(tenantA.includes('id="bot-support"'));
assert(!tenantA.includes('id="bot-appointments"'));
assert(!tenantA.includes('id="navAppointments"'));
assert(!tenantA.includes('id="panel-appointments"'));
assert(tenantA.includes("1 bot entrenado y listo"));
assert(tenantA.includes("Atención al cliente · Plan Nextfor Aura"));
assert(tenantA.includes("Versión v-test-panel"));
assert(tenantA.includes("Configuración de tu bot"));
assert(tenantA.includes("Ver cuestionario completo"));
assert(tenantA.includes('item.last_delivery_status==="failed"'));
assert(tenantA.includes("Meta rechazó el envío"));
assert(tenantA.includes('m.delivery_status==="failed"'));
assert(tenantA.includes("No enviado"));
assert(tenantA.includes('id="customerProfileName"'), "el perfil debe permitir guardar el nombre del cliente");
assert(tenantA.includes('id="mobileCustomerProfileName"'), "el chat móvil debe permitir guardar el nombre del cliente");
assert(tenantA.includes('id="nameSuggestion"'), "el perfil debe mostrar la sugerencia de Nextfor");
assert(tenantA.includes('id="mobileNameSuggestion"'), "el chat móvil debe mostrar la sugerencia de Nextfor");
assert(tenantA.includes("Nextfor sugiere"));
assert(tenantA.includes("Guardar perfil"));
assert(tenantA.includes("name:customerNameValue()"), "el nombre confirmado debe enviarse al endpoint de metadata");
assert(!tenantA.includes(">Empresa B<"));
assert(!tenantA.includes(">RAV Toys<"));

const tenantB = render({
  tenantContext: { id: "tenant-b", company_name: "Empresa B", plan_id: "nextfor-uno", assigned_bot_id: "atencion-cliente", status: "live" }
});
assert(tenantB.includes("<title>Nextfor IA · Empresa B</title>"));
assert(tenantB.includes('<h1><span id="brandBusinessName">Empresa B</span></h1><p>con <span>Nextfor IA</span></p>'));
assert(tenantB.includes('id="bot-support"'));
assert(!tenantB.includes('id="bot-appointments"'));
assert(!tenantB.includes('id="navAppointments"'));
assert(!tenantB.includes('id="panel-appointments"'));
assert(tenantB.includes("Atención al cliente · Plan Nextfor Uno"));
assert(tenantB.includes('INITIAL_TAB="summary"'));
assert(!tenantB.includes(">Empresa A<"));
assert(!tenantB.includes(">RAV Toys<"));

const staleCombinedBot = render({
  tenantContext: { id: "tenant-c", company_name: "Empresa C", plan_id: "nextfor-aura", assigned_bot_id: "both", status: "live" }
});
assert(staleCombinedBot.includes("Atención al cliente · Plan Nextfor Aura"));
assert(staleCombinedBot.includes("1 bot entrenado y listo"));
assert(!staleCombinedBot.includes('id="bot-appointments"'));
assert(!staleCombinedBot.includes('id="mobile-bot-appointments"'));
assert(!staleCombinedBot.includes('id="mnav-appointments"'));
assert(!staleCombinedBot.includes('id="mnav-appointment-chats"'));
assert(!staleCombinedBot.includes('id="navAppointments"'));
assert(!staleCombinedBot.includes('id="panel-appointments"'));
assert(staleCombinedBot.includes('INITIAL_TAB="summary"'));

const atlas = render({
  tenantContext: { id: "tenant-atlas", company_name: "Empresa Atlas", plan_id: "nextfor-atlas", assigned_bot_id: "both", status: "live" },
  ordersV1Enabled: true
});
assert(atlas.includes('id="bot-support"'));
assert(atlas.includes('id="bot-appointments"'));
assert(atlas.includes('id="nav-orders"'));
assert(atlas.includes("Oportunidades de venta"));
assert(atlas.includes('<strong>Atención al cliente</strong><span>Chatbot 24/7</span>'));
assert(atlas.includes('<strong>Agendamiento</strong><span>Citas y recordatorios</span>'));
assert(atlas.includes("Configuración"));
assert(atlas.includes("Cómo agendar"));
assert(!atlas.includes('<span>Config.</span>'));
assert(atlas.includes('id="mnav-appointment-reminders"'));
assert(!atlas.includes('id="mnav-appointment-settings"'), "la navegación móvil de citas debe tener exactamente Panel, Agenda, Chats, Recordatorios y Mi perfil");
assert(atlas.includes("openAppointmentConversations()"));
assert(atlas.includes('data-appt-nav="conversations"'), "conversaciones debe participar en el estado exclusivo del menú de citas");
assert(atlas.includes('data-appt-mobile="conversations"'), "el menú móvil debe compartir el mismo estado exclusivo");
assert(atlas.includes('document.body.classList.toggle("appointment-bot-view",appointments)'), "el estilo limpio debe activarse solo para el bot de citas");
assert(atlas.includes('button.getAttribute("data-appt-nav")==="conversations"'), "abrir conversaciones debe retirar cualquier selección anterior");

const tempoInbox = render({
  initialTab: "conversations",
  tenantContext: { id: "tenant-tempo", company_name: "Empresa Tempo", plan_id: "nextfor-tempo", assigned_bot_id: "agendamiento", status: "live" }
});
assert(tempoInbox.includes('INITIAL_TAB="conversations"'), "un tenant de citas puede abrir el inbox compartido");
assert(tempoInbox.includes('id="panel-inbox"'));
assert(tempoInbox.includes('id="nav-appointment-conversations"'));
assert(!tempoInbox.includes('id="mnav-appointment-settings"'));
assert(!tempoInbox.includes('id="nav-orders"'));

const escaped = render({
  tenantContext: { id: "unsafe", company_name: "<script>alert(1)</script>", plan_id: "nextfor-aura", assigned_bot_id: "atencion-cliente" }
});
assert(!escaped.includes("<script>alert(1)</script>"));
assert(escaped.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));

console.log("customer-panel-tenant-context.test.js: ok");
