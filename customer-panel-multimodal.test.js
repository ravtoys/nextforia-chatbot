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
assert(adminHtml.includes('id="multimodalTestForm"'));
assert(adminHtml.includes('id="multimodalFile" type="file" accept="audio/*"'));
assert(adminHtml.includes('/admin/panel/multimodal-test?kind='));
assert(adminHtml.includes("No envía mensajes ni cambia el bot público."));

const viewerHtml = render({ run_tests: false });
assert(!viewerHtml.includes('id="nav-tests"'));

console.log("customer-panel-multimodal.test.js: ok");
