"use strict";

const CUSTOMER_CONVERSATION_CLEAR_TOOL = "customer_conversation_clear_v1";

function parseConversationClearTurn(turn, options) {
  options = options || {};
  const cleanTenantId = options.cleanTenantId || function (value) { return String(value || "").trim().toLowerCase(); };
  const normalizeUserId = options.normalizeUserId || function (value) { return String(value || "").trim(); };
  const tools = Array.isArray(turn && turn.tools) ? turn.tools : [];
  if (!tools.includes(CUSTOMER_CONVERSATION_CLEAR_TOOL)) return null;
  const raw = String(turn && (turn.botReply || turn.bot_reply) || "").replace(/^\[CustomerConversationClear\]\s*/, "");
  try {
    const payload = JSON.parse(raw);
    const tenantId = cleanTenantId(payload && payload.tenant_id);
    const userId = normalizeUserId(payload && payload.user_id || turn && (turn.userId || turn.user_id));
    const clearedAt = String(payload && payload.cleared_at || turn && turn.ts || "");
    if (!tenantId || !userId || !Number.isFinite(Date.parse(clearedAt))) return null;
    return { tenant_id: tenantId, user_id: userId, cleared_at: new Date(clearedAt).toISOString() };
  } catch (_) {
    return null;
  }
}

function conversationClearCutoffs(turns, tenantId, options) {
  options = options || {};
  const cleanTenantId = options.cleanTenantId || function (value) { return String(value || "").trim().toLowerCase(); };
  const cleanTenant = cleanTenantId(tenantId);
  const cutoffs = new Map();
  (turns || []).forEach(function (turn) {
    const payload = parseConversationClearTurn(turn, options);
    if (!payload || payload.tenant_id !== cleanTenant) return;
    const current = cutoffs.get(payload.user_id);
    if (!current || Date.parse(payload.cleared_at) > Date.parse(current)) cutoffs.set(payload.user_id, payload.cleared_at);
  });
  return cutoffs;
}

function filterClearedConversationTurns(turns, clearTurns, tenantId, options) {
  options = options || {};
  const normalizeUserId = options.normalizeUserId || function (value) { return String(value || "").trim(); };
  const isInternalTurn = options.isInternalTurn || function () { return false; };
  const cutoffs = conversationClearCutoffs(clearTurns, tenantId, options);
  if (!cutoffs.size) return (turns || []).slice();
  return (turns || []).filter(function (turn) {
    if (isInternalTurn(turn)) return true;
    const userId = normalizeUserId(turn && (turn.userId || turn.user_id));
    const cutoff = cutoffs.get(userId);
    if (!cutoff) return true;
    const turnAt = Date.parse(turn && turn.ts || "");
    return Number.isFinite(turnAt) && turnAt > Date.parse(cutoff);
  });
}

module.exports = {
  CUSTOMER_CONVERSATION_CLEAR_TOOL,
  conversationClearCutoffs,
  filterClearedConversationTurns,
  parseConversationClearTurn
};
