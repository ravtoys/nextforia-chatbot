"use strict";

function evaluateHumanHandoffState(rows, options) {
  const config = options || {};
  const now = Number.isFinite(config.now) ? config.now : Date.now();
  const botTtlMs = Number(config.botTtlMs) || 0;
  const adminTtlMs = Number(config.adminTtlMs) || 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    const tools = Array.isArray(row && row.tools) ? row.tools : [];
    if (tools.includes("admin_release") || tools.includes("admin_resolve")) {
      return { active: false, reason: "released" };
    }

    const adminHandoff = tools.includes("admin_takeover") || tools.includes("admin_send_message");
    const botHandoff = tools.includes("request_human_handoff");
    if (!adminHandoff && !botHandoff) continue;

    const activatedAt = Date.parse(row.ts || row.created_at || "");
    const ttlMs = adminHandoff ? adminTtlMs : botTtlMs;
    if (!Number.isFinite(activatedAt) || ttlMs <= 0) {
      return { active: true, reason: "activation_timestamp_unknown", adminHandoff };
    }
    if (now - activatedAt > ttlMs) {
      return { active: false, expired: true, reason: "expired", activatedAt, ttlMs, adminHandoff };
    }
    return { active: true, reason: "active", activatedAt, ttlMs, adminHandoff };
  }

  return { active: false, reason: "no_transition" };
}

module.exports = { evaluateHumanHandoffState };
