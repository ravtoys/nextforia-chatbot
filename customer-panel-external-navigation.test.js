"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const renderCustomerPanel = require("./customer-panel");

let html = "";
const res = {
  status() { return this; },
  setHeader() { return this; },
  type() { return this; },
  send(value) { html = String(value); return this; }
};

renderCustomerPanel(res, {
  auth: { name: "QA", role: "admin" },
  capabilities: {},
  tenantContext: {
    id: "tenant-external-tabs",
    company_name: "Empresa QA",
    plan_id: "nextfor-aura",
    assigned_bot_id: "atencion-cliente"
  },
  channelConnectionsV1Enabled: true
});

assert.match(html, /function prepareExternalIntegrationTab\(label\)/);
assert.match(html, /window\.open\("about:blank","_blank"\)/);
assert.match(html, /function navigateExternalIntegrationTab\(tab,url\)/);
assert.match(html, /state\.externalIntegrationPending=true/);
assert.match(html, /function refreshExternalIntegrationState\(payload\)/);
assert.match(html, /new BroadcastChannel\("nextfor-integrations"\)/);
assert.match(html, /event\.key!=="nextfor-integration-result"/);
assert.match(html, /window\.addEventListener\("focus"/);
assert.match(html, /Meta se abrió en una pestaña nueva/);
assert.match(html, /appointment-calendar\/"\+provider\+"\/connect/);
assert.match(html, /function openSamsungCalendarDialog\(\)/);
assert.match(html, /Samsung Calendar muestra y sincroniza los calendarios de Google u Outlook/);
assert.match(html, /function chooseSamsungCalendarProvider\(provider\)/);
assert.match(html, /surface:surface/);
assert.match(html, /function renderAppointmentCalendarGroup\(calendars,canManage\)/);
assert.match(html, /¿Qué calendario usa tu negocio\?/);
assert.match(html, /Elige Google, Microsoft o Samsung/);
assert.doesNotMatch(html, /function renderAppointmentCalendarCard\(calendar,canManage\)/);
assert.match(html, /Shopify se abrió en una pestaña nueva/);
assert.match(html, /onclick="openShopifyConnection\(\)"/);
assert.doesNotMatch(html, /location\.assign\(body\.authorization_url\)/);
assert.doesNotMatch(html, /location\.href="\/admin\/integrations\/shopify\/connect"/);
assert.doesNotMatch(html, /href="\/admin\/integrations\/shopify\/connect">Conectar Shopify/);
assert.doesNotMatch(html, /location\.href=body\.checkout\.checkout_url/);

const serverSource = fs.readFileSync(require.resolve("./index"), "utf8");
assert.match(serverSource, /function externalIntegrationCallbackPage\(res, options\)/);
assert.match(serverSource, /return_mode: "popup"/);
assert.match(serverSource, /type: "nextfor-integration-result"/);
assert.match(serverSource, /localStorage\.setItem\("nextfor-integration-result"/);
assert.match(serverSource, /externalIntegrationCallbackPage\(res, \{ provider: "meta"/);

console.log("customer-panel-external-navigation.test.js OK");
