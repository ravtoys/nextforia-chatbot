"use strict";

const assert = require("assert");
const {
  InMemorySignatureStore,
  createSignatureService,
  signatureConfigDefaults
} = require("./signature");
const { renderSignatureAdmin, renderSignatureForm } = require("./signature-pages");

function createService(events) {
  return createSignatureService({
    store: new InMemorySignatureStore(),
    persistent: true,
    onUpdate: function (event) { events.push(event); }
  });
}

function requiredAnswers(config) {
  const answers = {};
  config.questions.forEach(function (question) {
    if (!question.required) return;
    if (question.type === "multiple") answers[question.id] = question.options.slice(0, 1);
    else if (question.type === "single") answers[question.id] = question.options[0];
    else answers[question.id] = "Respuesta " + question.number;
  });
  answers.q3 = "prospecto@example.com";
  return answers;
}

function render(renderer, options) {
  let body = "";
  const headers = {};
  const res = {
    statusCode: 0,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    send(value) { body = value; }
  };
  renderer(res, options || {});
  return { body, headers, statusCode: res.statusCode };
}

(async function run() {
  const events = [];
  const service = createService(events);
  const config = await service.getConfig();
  assert.strictEqual(config.questions.length, 28);
  assert.strictEqual(config.questions.filter(function (q) { return q.required; }).length, 20);

  const created = await service.create("Super Admin");
  assert.strictEqual(created.status, "iniciado");
  assert.strictEqual(created.progress, 0);
  assert.ok(created.token.length >= 40);

  const updated = await service.update(created.token, {
    answers: { q1: "Acme SAS", q2: "Ana Gómez · Gerente", q10: ["Ventas y seguimiento comercial"] },
    step: 1
  });
  assert.strictEqual(updated.empresa, "Acme SAS");
  assert.strictEqual(updated.status, "en_progreso");
  assert.strictEqual(updated.step, 1);

  const concurrently = await Promise.all([
    service.update(created.token, { answers: { q3: "ana@acme.co" } }),
    service.update(created.token, { answers: { q4: "+57 300 123 4567" } })
  ]);
  const afterConcurrency = await service.get(created.token);
  assert.strictEqual(afterConcurrency.state.answers.q3, "ana@acme.co");
  assert.strictEqual(afterConcurrency.state.answers.q4, "+57 300 123 4567");
  assert.ok(concurrently[1].revision > concurrently[0].revision);

  await assert.rejects(
    service.submit(created.token, { consent: true }),
    function (error) { return error.code === "signature_incomplete" && error.missing.length > 0; }
  );

  const file = {
    id: "file-1",
    name: "proceso.pdf",
    size: 1200,
    type: "application/pdf",
    object_key: "record/file.nxf",
    uploaded_at: new Date().toISOString()
  };
  await service.addFile(created.token, file);
  const publicDiagnosis = await service.get(created.token);
  assert.strictEqual(publicDiagnosis.state.files[0].name, "proceso.pdf");
  assert.strictEqual(publicDiagnosis.state.files[0].object_key, undefined);

  const answers = requiredAnswers(config);
  const completed = await service.submit(created.token, { answers, consent: true });
  assert.strictEqual(completed.status, "completado");
  assert.strictEqual(completed.progress, 100);
  assert.ok(completed.submitted_at);

  const prospects = await service.list();
  assert.strictEqual(prospects.length, 1);
  assert.strictEqual(prospects[0].empresa, "Respuesta 1");
  assert.ok(prospects[0].token);

  const detail = await service.adminDetail(prospects[0].record_id);
  assert.strictEqual(detail.priorities.timeline, config.questions.find(function (q) { return q.id === "q24"; }).options[0]);
  assert.strictEqual((await service.adminFile(prospects[0].record_id, "file-1")).object_key, "record/file.nxf");

  const editable = signatureConfigDefaults();
  editable.questions[0].label = "Nombre legal de tu empresa";
  const savedConfig = await service.saveConfig(editable, "Admin");
  assert.strictEqual(savedConfig.questions[0].label, "Nombre legal de tu empresa");
  assert.strictEqual((await service.get(created.token)).state.answers.q1, "Respuesta 1");

  assert.ok(events.some(function (event) { return event.type === "created"; }));
  assert.ok(events.some(function (event) { return event.type === "updated"; }));
  assert.ok(events.some(function (event) { return event.type === "submitted"; }));
  assert.ok(events.some(function (event) { return event.type === "config"; }));

  const form = render(renderSignatureForm, { token: created.token });
  assert.strictEqual(form.statusCode, 200);
  assert.ok(form.body.includes("/admin/assets/lumen.png"));
  assert.ok(!form.body.includes("lumen-atlas"));
  assert.ok(!form.body.includes("lumen-aura"));
  assert.ok(!form.body.includes("lumen-tempo"));
  assert.ok(!form.body.includes("lumen-uno"));
  assert.ok(form.body.includes("Guardar y continuar después"));

  const admin = render(renderSignatureAdmin);
  assert.strictEqual(admin.statusCode, 200);
  assert.ok(admin.body.includes("Ver como cliente"));
  assert.ok(admin.body.includes("Editar formulario"));
  assert.ok(admin.body.includes("/admin/assets/lumen.png"));

  console.log("signature tests passed");
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
