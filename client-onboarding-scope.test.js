"use strict";

const assert = require("assert");
const {
  assertClientOnboardingRecordScope,
  clientOnboardingRecordId,
  inspectClientOnboardingScope
} = require("./client-onboarding-scope");

function scopedTurn(tenantId) {
  return {
    tenantId,
    userId: clientOnboardingRecordId(tenantId)
  };
}

const genericTenant = "empresa-nueva-7f43";
const valid = inspectClientOnboardingScope(
  scopedTurn(genericTenant),
  { tenant_id: genericTenant, answers: { setup_goal: "both" } },
  genericTenant
);
assert.strictEqual(valid.ok, true, "el flujo genérico debe aceptar una empresa nueva sin excepciones");
assert.deepStrictEqual(valid.reasons, []);

const legacyOuter = inspectClientOnboardingScope(
  Object.assign(scopedTurn(genericTenant), { tenantId: "legacy-unassigned" }),
  { tenant_id: genericTenant, answers: {} },
  genericTenant
);
assert.strictEqual(legacyOuter.ok, false);
assert(legacyOuter.reasons.includes("outer_tenant_mismatch"));

const crossedRecord = inspectClientOnboardingScope(
  scopedTurn(genericTenant),
  { tenant_id: "otra-empresa", answers: {} },
  genericTenant
);
assert.strictEqual(crossedRecord.ok, false);
assert(crossedRecord.reasons.includes("record_tenant_mismatch"));

const crossedUserId = inspectClientOnboardingScope(
  { tenantId: genericTenant, userId: clientOnboardingRecordId("otra-empresa") },
  { tenant_id: genericTenant, answers: {} },
  genericTenant
);
assert.strictEqual(crossedUserId.ok, false);
assert(crossedUserId.reasons.includes("record_user_id_mismatch"));

const missingOuter = inspectClientOnboardingScope(
  { userId: clientOnboardingRecordId(genericTenant) },
  { tenant_id: genericTenant, answers: {} },
  genericTenant
);
assert.strictEqual(missingOuter.ok, false);
assert(missingOuter.reasons.includes("missing_outer_tenant"));

assert.strictEqual(assertClientOnboardingRecordScope({ tenant_id: genericTenant }, genericTenant), genericTenant);
assert.throws(
  function () { assertClientOnboardingRecordScope({ tenant_id: "otra-empresa" }, genericTenant); },
  function (error) { return error && error.code === "client_onboarding_tenant_conflict"; }
);

console.log("client onboarding scope tests passed");
