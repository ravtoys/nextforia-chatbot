"use strict";

const assert = require("assert");
const renderClientOnboarding = require("./client-onboarding-page");

let html = "";
const res = {
  status: function () { return res; },
  setHeader: function () { return res; },
  send: function (value) {
    html = value;
    return res;
  }
};
renderClientOnboarding(res, {
  tenant: { id: "tenant-render-test", name: "Tenant Render Test" },
  adminEmail: "admin@example.com",
  record: {
    status: "draft",
    completion: 0,
    setup_completed: false,
    answers: { setup_goal: "customer_service" }
  },
  returnPath: "/admin/panel?tab=notifications",
  questionnaire: {
    questions: [{
      id: "new_real_setup_question",
      path: "customer_service_setup.new_training_rule",
      section: "business",
      order: 999,
      active: true,
      required: false,
      type: "textarea",
      label: "Nueva pregunta real"
    }]
  }
});

assert.match(html, /function renderDynamicQuestions\(\)/);
assert.match(html, /createQuestionField\(question\)/);
assert.match(html, /question\.path!=="setup_goal"&&questionApplies\(question\)/);
assert.match(html, /grid\.querySelector\(fieldSelector\(question\.path\)\)/);
assert.match(html, /customer_service_setup\.new_training_rule/);
assert.match(html, /data-field="appointment_setup\.calls_enabled"/);
assert.match(html, /Sí, activar llamadas/);
assert.match(html, /El número aparecerá en tu Customer Panel listo para compartir/);
assert.match(html, /Nextfor asignará el número automáticamente/);
assert.match(html, /class="returnLink" href="\/admin\/panel\?tab=notifications"/);
assert.match(html, /← Volver al Panel de Control/);
assert.match(html, /function prepareOnboardingExternalTab\(label\)/);
assert.match(html, /window\.open\("about:blank","_blank"\)/);
assert.match(html, /navigateOnboardingExternalTab\(externalTab,shopifyConnectButton\.href\)/);
assert.doesNotMatch(html, /location\.href=shopifyConnectButton\.href/);
assert.match(html, /class="setupPage goalStepMode hidden" id="setupPage"/);
assert.match(html, /repeat\(auto-fit,minmax\(min\(100%,220px\),1fr\)\)/);
assert.match(html, /@media\(max-width:1020px\) and \(min-width:861px\)/);
assert.match(html, /startSetup"\)\.onclick=function\(\)\{[^}]*render\(\)/);

let partialCatalogHtml = "";
renderClientOnboarding({
  status: function () { return this; },
  setHeader: function () { return this; },
  send: function (value) { partialCatalogHtml = value; return this; }
}, {
  tenant: { id: "tenant-partial-catalog", name: "Catálogo parcial", plan_id: "nextfor-uno", assigned_bot_id: "atencion-cliente" },
  record: { status: "draft", completion: 0, setup_completed: false, answers: { setup_goal: "customer_service" } },
  plans: [{ id: "nextfor-uno", bot_id: "atencion-cliente", nombre: "Nextfor Uno", precio_mensual: 49900, activo: true }],
  bots: [{ id: "atencion-cliente", nombre: "Atención al cliente", activo: true }],
  questionnaire: { version: 1, questions: [] }
});
assert.match(partialCatalogHtml, /name="selected_plan" value="nextfor-uno"/);
assert.match(partialCatalogHtml, /name="selected_plan" value="nextfor-aura"/, "Aura remains selectable when the dynamic catalog is incomplete");
assert.match(partialCatalogHtml, /data-plan-bot="atencion-cliente"/);

console.log("client-onboarding-page.test.js: ok");
