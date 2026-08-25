"use strict";

const assert = require("assert");
const vm = require("vm");
const renderCustomerPanel = require("./customer-panel");

function renderPanel(initialTab) {
  const previousRedesign = process.env.CUSTOMER_PANEL_REDESIGN_V1_ENABLED;
  process.env.CUSTOMER_PANEL_REDESIGN_V1_ENABLED = "true";
  let html = "";
  const res = {
    status: function () { return this; },
    setHeader: function () { return this; },
    send: function (value) { html = String(value); return this; }
  };
  renderCustomerPanel(res, {
    auth: { name: "QA", role: "admin" },
    capabilities: {},
    initialTab: initialTab || "conversations",
    demoMode: true,
    channelConnectionsV1Enabled: true,
    pwaEnabled: true,
    botVersion: "v416-mobile-panel-stability"
  });
  if (previousRedesign === undefined) delete process.env.CUSTOMER_PANEL_REDESIGN_V1_ENABLED;
  else process.env.CUSTOMER_PANEL_REDESIGN_V1_ENABLED = previousRedesign;
  return html;
}

const html = renderPanel("conversations");
const clientScript = (html.match(/<script>([\s\S]*?)<\/script>/g) || [])
  .map(function (block) { return block.replace(/^<script>/, "").replace(/<\/script>$/, ""); })
  .join("\n;\n");

assert(clientScript.length > 1000, "no pude extraer el script del panel");
new vm.Script(clientScript);

// En movil, el boton (i) abre la misma ficha de cliente del escritorio.
assert(/id="chatCloseButton"[^>]*onclick="toggleConversationProfile\(\)"/.test(html),
  "el boton de informacion debe abrir la ficha del cliente");
assert(!/window\.innerWidth<=760\?closeConversation\(\):toggleConversationProfile\(\)/.test(html),
  "el boton de informacion no puede cerrar el chat en movil");
assert(/chat-open\.profile-open \.profileColumn\{[^}]*position:fixed[^}]*display:flex!important/.test(html),
  "la ficha del cliente necesita un drawer movil visible");
assert(/chat-open \.profileDrawerClose\{[^}]*position:fixed/.test(html),
  "la ficha movil necesita un cierre siempre alcanzable");

// El selector completo no puede quedar recortado dentro del compositor.
assert(/chat-open \.emojiPicker\{[^}]*position:fixed[^}]*grid-template-columns:repeat\(8,minmax\(0,1fr\)\)[^}]*overflow-y:auto/.test(html),
  "el selector de emojis debe salir del contenedor recortado y permitir scroll");

// iOS amplía automáticamente los inputs por debajo de 16 px. Eso hacía que el
// chat y el botón Enviar parecieran sobredimensionados al tocar el compositor.
assert(/chat-open \.composerRow textarea\{[^}]*font-size:16px!important/.test(html),
  "el compositor movil debe evitar el auto-zoom de iOS");
assert(/chat-open \.guidedReplyRow textarea\{font-size:16px!important\}/.test(html),
  "la respuesta guiada también debe evitar el auto-zoom");
assert(/chat-open \.sendCircle\{[^}]*width:42px[^}]*min-width:42px[^}]*flex:0 0 42px/.test(html),
  "el botón Enviar debe conservar un tamaño estable");

// Las notificaciones y preferencias de correo deben caber en 390 px sin que
// el texto empuje el panel ni deje el viewport desplazado.
assert(/\.notificationCard\{grid-template-columns:40px minmax\(0,1fr\)[^}]*overflow:hidden\}/.test(html),
  "la tarjeta de notificación móvil debe reservar espacio al texto");
assert(/\.notificationCopy\{min-width:0\}/.test(html),
  "el texto de notificaciones debe poder encogerse dentro de la grilla");
assert(/\.notificationDismiss\{top:9px;right:8px\}/.test(html),
  "el cierre de cada notificación debe caber también en móvil");
assert(!/\.panel-redesign \.mobileTabbar button\{display:grid!important/.test(html),
  "un tenant Atlas no puede mostrar la navegación de ambos bots a la vez");
assert(/\.notificationEmailType\{[^}]*grid-template-columns:22px minmax\(0,1fr\)/.test(html),
  "cada alerta debe reservar una columna real para el texto");
assert(/\.notificationEmailTypeCopy\{min-width:0\}/.test(html),
  "el texto de cada alerta debe poder encogerse dentro de su tarjeta");
["payment_pending", "shipping_pending", "sales_opportunity", "product_update", "human_attention"].forEach(function (type) {
  assert(new RegExp('data-notification-email-type="' + type + '"><span class="notificationEmailTypeCheck"').test(html),
    "la alerta " + type + " debe tener un control visual estable");
});

assert(clientScript.includes("window.scrollTo(0,0);resetMobileAccountViewport();"),
  "cambiar de módulo debe devolver el viewport móvil al inicio");

console.log("customer-panel-mobile-stability.test.js: ok");
