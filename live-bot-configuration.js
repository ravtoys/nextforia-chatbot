"use strict";

const crypto = require("crypto");
const {
  generateCustomerServiceConfiguration,
  normalizeCustomerServiceConfiguration
} = require("./client-onboarding");
const {
  buildBotPersonalityPrompt,
  personalityForOnboarding
} = require("./bot-personality");

function cleanGoal(record) {
  return String(record && record.answers && record.answers.setup_goal || "").trim().toLowerCase();
}

function customerServiceContracted(record) {
  return ["customer_service", "both"].includes(cleanGoal(record));
}

function customerServiceApproved(record) {
  const configuration = record && record.customer_service_configuration;
  const reviewStatus = String(record && record.setup_review && record.setup_review.status || "").toLowerCase();
  const setupStatus = String(record && record.answers && record.answers.customer_service_setup &&
    record.answers.customer_service_setup.setup_status || "").toLowerCase();
  return !!(configuration && configuration.lifecycle === "approved_for_testing") ||
    reviewStatus === "live" || setupStatus === "active";
}

function canonicalCustomerServiceConfiguration(record) {
  if (!customerServiceContracted(record)) return null;
  const existing = record && record.customer_service_configuration;
  const approved = customerServiceApproved(record);
  if (existing) {
    return normalizeCustomerServiceConfiguration(existing, {
      actor: existing.updated_by,
      lifecycle: approved ? "approved_for_testing" : existing.lifecycle,
      now: existing.updated_at || record.updated_at
    });
  }
  if (!approved) return null;
  const generated = generateCustomerServiceConfiguration(record.answers, {
    actor: record.updated_by || "Nextfor runtime",
    source_setup_updated_at: record.last_updated_at || record.updated_at,
    now: record.last_updated_at || record.updated_at
  });
  return generated
    ? normalizeCustomerServiceConfiguration(generated, {
      actor: record.updated_by || "Nextfor runtime",
      lifecycle: "approved_for_testing",
      now: record.last_updated_at || record.updated_at
    })
    : null;
}

function stableFingerprint(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function resolveLiveBotConfiguration(record, options) {
  options = options || {};
  const tenantId = String(options.tenant_id || record && record.tenant_id || "").trim().toLowerCase();
  const planId = options.plan_id || record && record.bot_personality && record.bot_personality.plan_id;
  const contracted = customerServiceContracted(record);
  const service = canonicalCustomerServiceConfiguration(record);
  const active = !!(contracted && service && service.lifecycle === "approved_for_testing" && service.system_prompt);
  const personality = personalityForOnboarding(record || {}, planId);
  const personalityPrompt = active ? buildBotPersonalityPrompt(personality, { plan_id: planId }) : "";
  const prompts = active ? [service.system_prompt, personalityPrompt].filter(Boolean) : [];
  const fingerprint = stableFingerprint({
    tenant_id: tenantId,
    goal: cleanGoal(record),
    prompts
  });
  return {
    source: "client-onboarding",
    tenant_id: tenantId,
    contracted,
    approved: customerServiceApproved(record),
    active,
    customer_service_configuration: service,
    personality,
    personality_prompt: personalityPrompt,
    prompts,
    fingerprint,
    applied_at: personality.updated_at || record && (record.last_updated_at || record.updated_at) || null
  };
}

module.exports = {
  canonicalCustomerServiceConfiguration,
  customerServiceApproved,
  customerServiceContracted,
  resolveLiveBotConfiguration,
  stableFingerprint
};
