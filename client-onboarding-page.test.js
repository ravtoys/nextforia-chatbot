"use strict";

const assert = require("assert");
const vm = require("vm");
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
assert.match(html, /panelNode\.querySelector\(fieldSelector\(question\.path\)\)/);
assert.match(html, /customer_service_setup\.new_training_rule/);
assert.match(html, /data-field="appointment_setup\.calls_enabled"/);
assert.match(html, /<input data-field="appointment_setup\.business_category" maxlength="300" placeholder="Ej\. Peluquería para mascotas, clínica veterinaria, tienda de ropa\.\.\.">/);
assert.strictEqual((html.match(/data-field="appointment_setup\.business_category"/g) || []).length, 1, "the shared business-purpose question is rendered once for both bots");
assert.doesNotMatch(html, /<select data-field="appointment_setup\.business_category">/);
assert.doesNotMatch(html, /data-field="appointment_setup\.business_category_other"/);
assert.doesNotMatch(html, /data-field="voice\.formality"/);
assert.match(html, /data-customer-service-only/);
assert.match(html, /data-both-redundant/);
assert.match(html, /data-shared-consent-text/);
assert.match(html, /<input data-field="operations\.services_products" type="hidden">/);
assert.match(html, /function syncSharedSetupAnswers\(answers\)/);
assert.match(html, /appointment_setup\.forbidden_topics/);
assert.match(html, /appointment_setup\.business_hours/);
assert.match(html, /appointment_setup\.faqs/);
assert.match(html, /appointment_setup\.data_consent/);
assert.match(html, /id="appointmentScheduleSetup"/);
assert.match(html, /\+ Agregar horario distinto/);
assert.match(html, /function initAppointmentScheduleSetup\(\)/);
assert.match(html, /function syncAppointmentSchedule\(answers\)/);
assert.match(html, /function scheduleDefaults\(\)/);
assert.match(html, /function scheduleTimeLabel\(value\)/);
assert.match(html, /suffix=hour>=12\?"PM":"AM"/);
assert.match(html, /Lunes a viernes/);
assert.match(html, /Cerrado/);
assert.match(html, /block\.hidden=type==="service"\?[^:]+:goal!=="appointments"/);
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
const inlineScripts = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g)).map(function (match) { return match[1]; });
assert.strictEqual(inlineScripts.length, 1);
assert.doesNotThrow(function () { new vm.Script(inlineScripts[0], { filename: "client-onboarding-inline.js" }); });

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
