"use strict";

const assert = require("assert");
const renderCustomerPanel = require("./customer-panel");

let html = "";
const res = {
  status: function () { return this; },
  setHeader: function () { return this; },
  send: function (value) { html = String(value); return this; }
};

renderCustomerPanel(res, {
  auth: { name: "Admin", role: "admin" },
  capabilities: {},
  initialTab: "notifications",
  botVersion: "v-test"
});

assert(html.includes("function notificationCardKey"));
assert(html.includes("function notificationActionUrl"));
assert(html.includes('data-action-url="'));
assert(html.includes('notificationAction(this.dataset.actionUrl,this.dataset.notificationId)'));
assert(html.includes('new EventSource("/admin/panel/notifications/events")'));
assert(html.includes("function playNotificationSound"));
assert(html.includes("function notificationPublicKey"));
assert(html.includes("function notificationActivationMessage"));
assert(html.includes('code==="web_push_not_configured"'));
assert(html.includes('code==="push_public_key_invalid"'));
assert(html.includes("notificationActivationMessage(error)"));
assert(html.includes('id="notificationEmailSettings"'));
assert(html.includes('id="notificationEmailToggle"'));
assert(html.includes('aria-controls="notificationEmailDetails"'));
assert(html.includes('id="notificationEmailDetails" hidden'));
assert(html.includes("function toggleNotificationEmailSettings"));
assert(html.includes("preferences.enabled!==true"));
assert(html.includes('state.notificationEmailExpanded=result.preferences&&result.preferences.enabled?false:true'));
assert(/\.notificationEmailDetails\[hidden\]\{display:none\}/.test(html));
assert(html.includes('id="notificationEmailRecipient"'));
assert(html.includes('data-notification-email-type="payment_pending"'));
assert(html.includes('data-notification-email-type="human_attention"'));
assert(html.includes('api("/admin/panel/notifications/email-preferences"'));
assert(html.includes("function saveNotificationEmailPreferences"));
assert(html.includes("function previewNotificationEmailState"));
assert(html.includes('id="notificationEmailModeStatus"'));
assert(html.includes("Nextfor vigila por ti"));
assert(html.includes("No dejes pasar lo que mueve tu negocio"));
assert(html.includes("¿Qué quieres que vigilemos por ti?"));
assert(html.includes("Clientes que te necesitan"));
assert(html.includes("Guardar mis alertas"));
assert(/\.notificationEmailType\{[^}]*grid-template-columns:22px minmax\(0,1fr\)/.test(html));
assert(/@media\(max-width:760px\)[\s\S]*?\.notificationEmailTypes\{width:100%;grid-template-columns:minmax\(0,1fr\)\}/.test(html));
assert(html.includes('target.searchParams.set("return_to","/admin/panel?tab=notifications")'));
assert(html.includes('window.addEventListener("pageshow"'));
assert(html.includes('window.addEventListener("popstate"'));
assert(!html.includes('onclick="notificationAction("+JSON.stringify'));

console.log("customer-panel-notifications.test.js OK");
