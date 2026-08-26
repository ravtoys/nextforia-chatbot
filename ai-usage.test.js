"use strict";

const assert = require("assert");
const {
  aggregateAiUsageEvents,
  createAiUsageEvent,
  estimateUsageCostUsd,
  normalizeProviderError,
  normalizeUsage,
  parseAiUsageTurn,
  serializeAiUsageEvent,
  sumAnthropicCostReport,
  sumOpenAiCostReport
} = require("./ai-usage");

const anthropicCost = estimateUsageCostUsd("claude-sonnet-4-5-20250929", {
  input_tokens: 1000000,
  output_tokens: 100000,
  cached_input_tokens: 500000,
  cache_write_tokens: 200000
});
assert.strictEqual(anthropicCost.priced, true);
assert.strictEqual(anthropicCost.cost_usd, 5.4);

const openAiUsage = normalizeUsage("openai", {
  input_tokens: 1000,
  output_tokens: 200,
  input_tokens_details: { cached_tokens: 400 }
});
assert.deepStrictEqual(openAiUsage, {
  input_tokens: 600,
  output_tokens: 200,
  cached_input_tokens: 400,
  cache_write_tokens: 0,
  duration_seconds: 0,
  web_search_requests: 0
});

assert.deepStrictEqual(normalizeProviderError({
  response: { status: 429, data: { error: { type: "insufficient_quota", message: "Billing quota exceeded" } } }
}), { code: "no_credits", no_credits: true, http_status: 429 });
assert.deepStrictEqual(normalizeProviderError({ response: { status: 401, data: { error: { message: "Invalid API key" } } } }), {
  code: "invalid_credentials",
  no_credits: false,
  http_status: 401
});

const first = createAiUsageEvent({
  at: "2026-08-25T12:00:00.000Z",
  provider: "anthropic",
  model: "claude-sonnet-4-5-20250929",
  tenant_id: "tenant-a",
  user_id: "+573000000001",
  channel: "whatsapp",
  bot_id: "customer_service",
  feature: "customer_reply",
  usage: { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 500 }
});
const second = createAiUsageEvent({
  at: "2026-08-25T12:01:00.000Z",
  provider: "openai",
  model: "gpt-4.1-mini",
  tenant_id: "tenant-a",
  user_id: "+573000000001",
  channel: "whatsapp",
  bot_id: "customer_service",
  feature: "image_analysis",
  usage: { input_tokens: 2000, output_tokens: 100 }
});
assert.strictEqual(first.conversation_ref, second.conversation_ref);
assert(!serializeAiUsageEvent([first, second]).includes("+573000000001"), "stored payload must not contain the raw customer id");
const parsed = parseAiUsageTurn({ botReply: serializeAiUsageEvent([first, second]) });
assert.strictEqual(parsed.length, 2);

const aggregated = aggregateAiUsageEvents(parsed);
assert.strictEqual(aggregated.totals.calls, 2);
assert.strictEqual(aggregated.providers.length, 2);
assert.strictEqual(aggregated.bots.length, 1);
assert.strictEqual(aggregated.conversations.length, 1);
assert.strictEqual(aggregated.drivers.length, 2);

assert.strictEqual(sumAnthropicCostReport({ data: [{ results: [{ amount: "1.25", currency: "USD" }, { amount: "0.75", currency: "USD" }] }] }), 2);
assert.strictEqual(sumOpenAiCostReport({ data: [{ results: [{ amount: { value: 1.1, currency: "usd" } }, { amount: { value: 0.2, currency: "usd" } }] }] }), 1.3);

console.log("ai-usage.test.js ok");
