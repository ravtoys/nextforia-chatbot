"use strict";

const assert = require("assert");
const {
  createOnboardingRecord,
  generateCustomerServiceConfiguration,
  normalizeCustomerServiceConfiguration
} = require("./client-onboarding");
const { normalizeBotPersonality } = require("./bot-personality");
const { resolveLiveBotConfiguration } = require("./live-bot-configuration");

function liveRecord(tenantId, businessName, instruction) {
  const answers = require("./client-onboarding").cloneDefaults();
  answers.setup_goal = "customer_service";
  answers.business.brand_name = businessName;
  answers.operations.services_products = "Servicios de " + businessName;
  answers.operations.bot_instructions = instruction;
  const configuration = normalizeCustomerServiceConfiguration(
    generateCustomerServiceConfiguration(answers, {
      actor: "test",
      source_setup_updated_at: "2026-08-08T12:00:00.000Z",
      now: "2026-08-08T12:00:00.000Z"
    }),
    { actor: "test", lifecycle: "approved_for_testing", now: "2026-08-08T12:00:00.000Z" }
  );
  return createOnboardingRecord(answers, {
    tenant_id: tenantId,
    status: "completed",
    updated_by: "test",
    review_status: "live",
    review_actor: "test",
    customer_service_configuration: configuration,
    configuration_lifecycle: "approved_for_testing",
    now: "2026-08-08T12:00:00.000Z"
  });
}

const recordA = liveRecord("company-a", "Empresa A", "Di siempre ALFA al explicar el servicio.");
const recordB = liveRecord("company-b", "Empresa B", "Di siempre BETA al explicar el servicio.");
const initialA = resolveLiveBotConfiguration(recordA, { tenant_id: "company-a", plan_id: "nextfor-aura" });
const initialB = resolveLiveBotConfiguration(recordB, { tenant_id: "company-b", plan_id: "nextfor-aura" });

assert.strictEqual(initialA.active, true);
assert.strictEqual(initialA.source, "client-onboarding");
assert(initialA.prompts.join("\n").includes("ALFA"), "el setup inicial debe alimentar el prompt live");
assert(!initialA.prompts.join("\n").includes("BETA"), "el prompt no puede mezclar tenants");
assert(initialB.prompts.join("\n").includes("BETA"));

recordA.bot_personality = normalizeBotPersonality({
  custom_instructions: "En la siguiente respuesta relevante incluye exactamente GAMMA.",
  greeting: { text: "Hola desde Empresa A" }
}, {
  fallback: initialA.personality,
  plan_id: "nextfor-aura",
  updated_at: "2026-08-08T12:01:00.000Z",
  updated_by: "customer-a"
});
const changedA = resolveLiveBotConfiguration(recordA, { tenant_id: "company-a", plan_id: "nextfor-aura" });
const unchangedB = resolveLiveBotConfiguration(recordB, { tenant_id: "company-b", plan_id: "nextfor-aura" });

assert.notStrictEqual(changedA.fingerprint, initialA.fingerprint);
assert(changedA.prompts.join("\n").includes("GAMMA"), "Configuración debe entrar al prompt live");
assert.strictEqual(unchangedB.fingerprint, initialB.fingerprint, "otro tenant debe quedar intacto");
assert(!unchangedB.prompts.join("\n").includes("GAMMA"));

const inactive = liveRecord("inactive", "Inactiva", "No pública");
inactive.setup_review.status = "building";
inactive.answers.customer_service_setup.setup_status = "pending_review";
inactive.customer_service_configuration.lifecycle = "draft";
const inactiveResolved = resolveLiveBotConfiguration(inactive, { tenant_id: "inactive", plan_id: "nextfor-uno" });
assert.strictEqual(inactiveResolved.active, false, "un setup no aprobado no se puede activar desde Customer Panel");
assert.deepStrictEqual(inactiveResolved.prompts, []);

console.log("live-bot-configuration.test.js ok");
