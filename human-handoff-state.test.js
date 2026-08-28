"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { evaluateHumanHandoffState } = require("./human-handoff-state");

const now = Date.parse("2026-08-28T18:00:00.000Z");
const botTtlMs = 2 * 60 * 60 * 1000;
const adminTtlMs = 12 * 60 * 60 * 1000;

assert.deepStrictEqual(
  evaluateHumanHandoffState([
    { ts: "2026-08-28T17:59:00.000Z", tools: ["human_handoff_active"] },
    { ts: "2026-08-27T12:40:00.000Z", tools: ["request_human_handoff"] }
  ], { now, botTtlMs, adminTtlMs }).expired,
  true,
  "ignored customer messages must not extend a bot handoff forever"
);

assert.strictEqual(
  evaluateHumanHandoffState([
    { ts: "2026-08-28T17:30:00.000Z", tools: ["request_human_handoff"] }
  ], { now, botTtlMs, adminTtlMs }).active,
  true,
  "a recent handoff must remain active"
);

assert.strictEqual(
  evaluateHumanHandoffState([
    { ts: "2026-08-28T17:50:00.000Z", tools: ["admin_release"] },
    { ts: "2026-08-28T17:30:00.000Z", tools: ["request_human_handoff"] }
  ], { now, botTtlMs, adminTtlMs }).active,
  false,
  "the latest explicit release must win"
);

assert.strictEqual(
  evaluateHumanHandoffState([
    { ts: "2026-08-28T09:00:00.000Z", tools: ["admin_takeover"] }
  ], { now, botTtlMs, adminTtlMs }).active,
  true,
  "admin takeover uses its longer, independent TTL"
);

const applicationSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
assert(!applicationSource.includes("if (hasHumanHandoff(userId, cleanTenant) && !instagramConversation) return true;"),
  "the in-memory cache must never bypass persisted TTL validation");
assert(applicationSource.includes("deleteHumanHandoff(userId, cleanTenant);"),
  "expired and released handoffs must be removed from memory");

console.log("human-handoff-state.test.js: all tests passed");
