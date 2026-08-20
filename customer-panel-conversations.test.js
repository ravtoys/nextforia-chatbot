"use strict";

// Los tres cambios del modulo Conversaciones (v409).
//
// Los dos primeros son bugs que un test no habria detectado nunca por si solo,
// asi que las aserciones apuntan a la causa, no al sintoma:
//  - el buscador se llenaba solo porque el navegador lo confundia con un campo
//    de correo; lo que hay que sostener en el tiempo son los atributos que lo
//    evitan, no "que el value este vacio".
//  - el badge de version flotaba sobre el compositor; lo que hay que sostener
//    es que la version siga estando en algun lado para soporte.

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const renderCustomerPanel = require("./customer-panel");
const { createBotOpsService, InMemoryBotOpsStore } = require("./bot-ops");
const {
  CUSTOMER_CONVERSATION_CLEAR_TOOL,
  filterClearedConversationTurns
} = require("./customer-conversation-clear");

// customer-panel.js no exporta piezas: renderiza el HTML completo. Lo pedimos
// una vez y sobre ese HTML corren las aserciones.
function renderPanel() {
  let html = "";
  const res = {
    status: function () { return this; },
    setHeader: function () { return this; },
    send: function (value) { html = String(value); return this; }
  };
  renderCustomerPanel(res, {
    auth: { name: "QA", role: "admin" },
    capabilities: {},
    initialTab: "conversations",
    demoMode: true,
    channelConnectionsV1Enabled: true,
    botVersion: "v409-customer-panel-conversations"
  });
  return html;
}

const html = renderPanel();
const markup = html;
const styles = html;
// El JS del panel va inline; lo sacamos para poder parsearlo de verdad.
const clientScript = (html.match(/<script>([\s\S]*?)<\/script>/g) || [])
  .map(function (block) { return block.replace(/^<script>/, "").replace(/<\/script>$/, ""); })
  .join("\n;\n");
assert(clientScript.length > 1000, "no pude extraer el script de cliente del panel");

// ─── 1. El buscador de chats no se autorellena ────────────────────────────

const searchTag = /<input id="conversationSearch"[^>]*>/.exec(markup);
assert(searchTag, "no encontre el buscador de conversaciones");
const search = searchTag[0];

assert(/type="search"/.test(search), "type=search evita que Safari lo trate como campo de correo");
assert(/name="nextfor-conversation-search"/.test(search), "necesita un name propio que no suene a email/usuario");
assert(/autocomplete="off"/.test(search), "falta autocomplete off");
assert(/data-1p-ignore/.test(search) && /data-lpignore="true"/.test(search),
  "1Password y LastPass ignoran autocomplete: necesitan su propio opt-out");
assert(!/\svalue=/.test(search), "el buscador nunca debe salir con un valor precargado");

// Lo anterior no alcanzaba: verificado en produccion, Chrome ignora
// autocomplete="off" y hace un preview del autorelleno que se confirma al
// primer clic, dejando la bandeja vacia. readonly es lo unico que ningun
// navegador ni gestor de contrasenas puede saltarse.
assert(/\sreadonly/.test(search), "el buscador arranca readonly para que nadie lo autorellene");
assert(/onfocus="unlockConversationSearch\(this\)"/.test(search) &&
  /onpointerdown="unlockConversationSearch\(this\)"/.test(search),
  "se desbloquea con mouse y con teclado, si no queda inutilizable");
const unlock = /function unlockConversationSearch\([\s\S]*?\n(?=function |var )/.exec(clientScript + "\nfunction ");
assert(unlock, "falta unlockConversationSearch");
assert(/input\.value=""/.test(unlock[0]),
  "si el navegador alcanzo a pegar algo hay que limpiarlo antes de filtrar");

// ─── Notificaciones que se sienten ────────────────────────────────────────

const sound = /function playNotificationSound\(\)[\s\S]*?\n(?=function |var )/.exec(clientScript + "\nfunction ");
assert(sound, "no encontre playNotificationSound");
assert(/navigator\.vibrate/.test(sound[0]), "en movil el sonido solo no basta");
assert(/triangle/.test(sound[0]), "un seno puro se pierde con ruido de fondo");
const peak = /exponentialRampToValueAtTime\((\.\d+),/.exec(sound[0]);
assert(peak && Number(peak[1]) >= 0.35,
  "el volumen anterior (.18) era el motivo de que no se sintiera");
assert(/nxToastPulse/.test(styles), "el aviso visual tambien tiene que llamar la atencion");

// ─── 2. El badge de version ya no tapa el compositor ──────────────────────

assert(!/panelVersionFixed/.test(markup), "el badge flotante sale de la vista del cliente");
assert(!/panelVersionFixed/.test(styles), "y sus estilos tambien, para no dejar CSS muerto");
assert(/mobileProfileVersion/.test(markup),
  "la version tiene que seguir visible en Mi Perfil o soporte se queda sin ella");

// ─── Papelera de conversaciones ──────────────────────────────────────────

assert(/id="conversationTrashButton"/.test(markup), "falta la papelera discreta en el encabezado del chat");
assert(/aria-label="Vaciar conversación"/.test(markup), "la papelera necesita un nombre accesible");
assert(/id="conversationClearModal"[^>]*hidden/.test(markup), "la confirmacion debe iniciar cerrada");
assert(markup.includes("Su perfil y sus pedidos se conservan."),
  "la confirmacion debe explicar exactamente que datos se conservan");
assert(markup.includes("Si vuelve a escribir, aparecerá como una conversación nueva."),
  "la confirmacion debe explicar que ocurre con el siguiente mensaje");
assert(clientScript.includes('method:"DELETE"'), "vaciar debe usar una mutacion explicita");
assert(clientScript.includes('/admin/panel/conversations/'), "la papelera debe llamar al endpoint tenant-scoped");
assert(!/tenant_id/.test((/function confirmConversationClear\(\)[\s\S]*?\n(?=function |var )/.exec(clientScript + "\nfunction ") || [""])[0]),
  "el navegador nunca puede elegir el tenant que se vacia");

const clearOptions = {
  cleanTenantId: function (value) { return String(value || "").trim().toLowerCase(); },
  normalizeUserId: function (value) { return String(value || "").trim(); },
  isInternalTurn: function (turn) { return !!turn.internal; }
};
const clearTurn = {
  ts: "2026-08-20T12:00:00.000Z",
  tenantId: "tenant-a",
  userId: "instagram:client-1",
  tools: [CUSTOMER_CONVERSATION_CLEAR_TOOL],
  botReply: '[CustomerConversationClear] {"tenant_id":"tenant-a","user_id":"instagram:client-1","cleared_at":"2026-08-20T12:00:00.000Z"}'
};
const cleared = filterClearedConversationTurns([
  { ts: "2026-08-20T11:00:00.000Z", userId: "instagram:client-1", text: "old" },
  { ts: "2026-08-20T11:30:00.000Z", userId: "instagram:client-2", text: "other" },
  { ts: "2026-08-20T11:40:00.000Z", userId: "instagram:client-1", internal: true, text: "profile" },
  { ts: "2026-08-20T12:05:00.000Z", userId: "instagram:client-1", text: "new" }
], [clearTurn], "tenant-a", clearOptions);
assert(!cleared.some(function (turn) { return turn.text === "old"; }), "el historial anterior debe desaparecer");
assert(cleared.some(function (turn) { return turn.text === "new"; }), "un mensaje posterior debe abrir una conversacion nueva");
assert(cleared.some(function (turn) { return turn.text === "profile"; }), "el perfil interno se debe conservar");
assert(cleared.some(function (turn) { return turn.text === "other"; }), "otros clientes del mismo tenant no cambian");
const tenantB = filterClearedConversationTurns([
  { ts: "2026-08-20T11:00:00.000Z", userId: "instagram:client-1", text: "tenant-b-history" }
], [clearTurn], "tenant-b", clearOptions);
assert.strictEqual(tenantB.length, 1, "una papelera del tenant A no puede ocultar chats del tenant B");
const indexSource = fs.readFileSync(require.resolve("./index"), "utf8");
const clearEndpoint = /app\.delete\("\/admin\/panel\/conversations\/:userId"[\s\S]*?\n\}\);/.exec(indexSource);
assert(clearEndpoint, "falta el endpoint real para vaciar conversaciones");
assert(clearEndpoint[0].includes('conversationActionAuthOk(req, "agent")'), "viewer debe seguir siendo solo lectura");
assert(clearEndpoint[0].includes("customerTenantForAuth(auth)"), "el tenant debe salir de la sesion firmada");
assert(!/req\.(body|query).*tenant/i.test(clearEndpoint[0]), "el endpoint no puede confiar en tenant del navegador");
assert(clearEndpoint[0].includes("profile_preserved: true") && clearEndpoint[0].includes("orders_preserved: true"),
  "la respuesta debe confirmar que perfil y pedidos no se borraron");

// ─── 3. Reportar un bug del bot ───────────────────────────────────────────

assert(/id="reportBugTrigger"/.test(markup), "falta el boton dentro de la conversacion");
assert(/id="bugModal"/.test(markup), "falta el modal de reporte");
["respuesta_incorrecta", "no_entendio", "no_respondio", "tono", "otro"].forEach(function (reason) {
  assert(markup.includes('data-bug-reason="' + reason + '"'), "falta el motivo " + reason);
});
assert(/id="bugModal"[^>]*hidden/.test(markup), "el modal arranca cerrado");
assert(/\.bugModal\{/.test(styles) && /\.reportBugTrigger\{/.test(styles), "faltan estilos del reporte");

// El cliente no manda su tenant: eso lo pone el servidor desde la sesion.
const submit = /function submitBugReport\(\)[\s\S]*?\n(?=function |var )/.exec(clientScript + "\nfunction ");
assert(submit, "no encontre submitBugReport en el script de cliente");
assert(!/tenant/i.test(submit[0]),
  "el navegador no puede elegir el tenant del reporte; se falsifica");
assert(/\/admin\/panel\/bug-reports/.test(submit[0]), "debe llamar al endpoint de reportes");

new vm.Script(clientScript);

// ─── El reporte llega a la bandeja de operacion ───────────────────────────

(async function () {
  const store = new InMemoryBotOpsStore();
  const service = createBotOpsService({ store, owner: "test" });

  const result = await service.reportIssue({
    tenant_id: "Tenant-A",
    bot_id: "customer-service",
    channel: "whatsapp",
    conversation_key: "conv-1",
    reason: "respuesta_incorrecta",
    note: "Le dijo que no habia envio a Bogota y si hay.",
    reported_by: "ventas@ravtoys.com",
    bot_version: "v409-customer-panel-conversations"
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.finding_recorded, true, "el reporte debe crear un finding, no esperar la corrida diaria");

  const snapshot = await store.snapshot();
  const incident = (snapshot.open_incidents || []).find(function (row) {
    return row.category === "customer_reported";
  });
  assert(incident, "el reporte tiene que aparecer en la bandeja de operacion");
  assert.strictEqual(incident.tenant_id, "tenant-a", "el tenant se normaliza");
  assert.strictEqual(incident.detail, "Le dijo que no habia envio a Bogota y si hay.",
    "el Super Admin necesita leer lo que escribio el cliente, no un texto generico");
  assert.notStrictEqual(incident.severity, "opportunity",
    "una opportunity no entra a open_incidents y el reporte quedaria invisible");

  // Un motivo sin nota tambien sirve: el cliente no deberia estar obligado a escribir.
  const bare = await service.reportIssue({
    tenant_id: "tenant-a", bot_id: "customer-service", channel: "instagram",
    conversation_key: "conv-2", reason: "no_respondio", reported_by: "ventas@ravtoys.com"
  });
  assert.strictEqual(bare.ok, true);
  const second = (await store.snapshot()).open_incidents.find(function (row) {
    return row.conversation_key === "conv-2";
  });
  assert(second && second.detail, "sin nota igual hay que dejar un detalle legible");

  // Dos reportes distintos no se pisan; el mismo motivo en el mismo chat suma.
  const repeat = await service.reportIssue({
    tenant_id: "tenant-a", bot_id: "customer-service", channel: "whatsapp",
    conversation_key: "conv-1", reason: "respuesta_incorrecta", reported_by: "ventas@ravtoys.com"
  });
  assert.strictEqual(Number(repeat.finding.occurrence_count) > 1, true,
    "reportar dos veces lo mismo sube el contador en vez de duplicar la incidencia");

  // Aislamiento: el tenant B no ve lo del tenant A.
  await service.reportIssue({
    tenant_id: "tenant-b", bot_id: "customer-service", channel: "whatsapp",
    conversation_key: "conv-9", reason: "tono", reported_by: "otro@cliente.com"
  });
  const tenants = new Set((await store.snapshot()).open_incidents
    .filter(function (row) { return row.category === "customer_reported"; })
    .map(function (row) { return row.tenant_id; }));
  assert(tenants.has("tenant-a") && tenants.has("tenant-b"),
    "cada reporte queda bajo su propio tenant");

  console.log("customer-panel-conversations.test.js: ok");
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
