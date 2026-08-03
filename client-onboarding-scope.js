"use strict";

const { cleanTenantId } = require("./tenant-config");

function clientOnboardingRecordId(tenantId) {
  const cleanTenant = cleanTenantId(tenantId);
  return cleanTenant ? "client-onboarding:" + cleanTenant : "";
}

function inspectClientOnboardingScope(turn, record, expectedTenantId) {
  const expectedTenant = cleanTenantId(expectedTenantId || record && record.tenant_id);
  const recordTenant = cleanTenantId(record && record.tenant_id);
  const outerTenant = cleanTenantId(turn && turn.tenantId);
  const recordUserId = String(turn && turn.userId || "").trim();
  const expectedUserId = clientOnboardingRecordId(expectedTenant);
  const reasons = [];

  if (!expectedTenant) reasons.push("missing_expected_tenant");
  if (!recordTenant) reasons.push("missing_record_tenant");
  else if (expectedTenant && recordTenant !== expectedTenant) reasons.push("record_tenant_mismatch");
  if (!outerTenant) reasons.push("missing_outer_tenant");
  else if (expectedTenant && outerTenant !== expectedTenant) reasons.push("outer_tenant_mismatch");
  if (!recordUserId) reasons.push("missing_record_user_id");
  else if (expectedUserId && recordUserId !== expectedUserId) reasons.push("record_user_id_mismatch");

  return {
    ok: reasons.length === 0,
    tenant_id: expectedTenant || null,
    record_tenant_id: recordTenant || null,
    outer_tenant_id: outerTenant || null,
    record_user_id: recordUserId || null,
    expected_user_id: expectedUserId || null,
    reasons
  };
}

function assertClientOnboardingRecordScope(record, tenantId) {
  const expectedTenant = cleanTenantId(tenantId);
  const recordTenant = cleanTenantId(record && record.tenant_id);
  if (!expectedTenant || !recordTenant || expectedTenant !== recordTenant) {
    const error = new Error("client_onboarding_tenant_conflict");
    error.code = "client_onboarding_tenant_conflict";
    error.expected_tenant_id = expectedTenant || null;
    error.record_tenant_id = recordTenant || null;
    throw error;
  }
  return expectedTenant;
}

module.exports = {
  assertClientOnboardingRecordScope,
  clientOnboardingRecordId,
  inspectClientOnboardingScope
};
