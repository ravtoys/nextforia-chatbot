"use strict";

const assert = require("assert");
const renderCustomerPanel = require("./customer-panel");

function render(capabilities) {
  let html = "";
  renderCustomerPanel({
    status: function () { return this; },
    setHeader: function () { return this; },
    send: function (value) { html = String(value); return this; }
  }, {
    auth: { name: "QA", role: "admin" },
    capabilities: capabilities || {},
    initialTab: "tests",
    botVersion: "v-test-multimodal"
  });
  return html;
}

const adminHtml = render({ run_tests: true });
assert(adminHtml.includes('id="nav-tests"'));
assert(adminHtml.includes('id="testChatMessages"'));
assert(adminHtml.includes('id="testChatForm"'));
assert(adminHtml.includes('id="testChatInput"'));
assert(adminHtml.includes('id="testAudioFile" type="file" accept="audio/*"'));
assert(adminHtml.includes('id="testImageFile" type="file" accept="image/*"'));
assert(adminHtml.includes('/admin/panel/conversation-test'));
assert(adminHtml.includes('/admin/panel/multimodal-test?kind='));
assert(adminHtml.includes("ningún mensaje sale a WhatsApp"));
assert(adminHtml.includes("Conversa como lo hará un cliente por WhatsApp."));
assert(!adminHtml.includes('id="multimodalTestForm"'));

const viewerHtml = render({ run_tests: false });
assert(!viewerHtml.includes('id="nav-tests"'));

console.log("customer-panel-multimodal.test.js: ok");
