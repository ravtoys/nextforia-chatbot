"use strict";

const crypto = require("crypto");

const PRICE_VERSION = "2026-08-26";
const AI_USAGE_PREFIX = "[AIUsage] ";

const MODEL_PRICES_USD_PER_MILLION = Object.freeze({
  "claude-sonnet-4": { input: 3, output: 15, cache_write: 3.75, cache_read: 0.30 },
  "claude-sonnet-4-5": { input: 3, output: 15, cache_write: 3.75, cache_read: 0.30 },
  "claude-sonnet-4-6": { input: 3, output: 15, cache_write: 3.75, cache_read: 0.30 },
  "gpt-4.1-mini": { input: 0.40, output: 1.60, cached_input: 0.10 },
  "gpt-4o-mini-transcribe": { input: 1.25, output: 5, minute: 0.003 }
});

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function cleanText(value, limit) {
  return String(value == null ? "" : value).trim().slice(0, limit || 160);
}

function modelPrice(model) {
  const name = cleanText(model, 120).toLowerCase();
  if (MODEL_PRICES_USD_PER_MILLION[name]) return MODEL_PRICES_USD_PER_MILLION[name];
  if (name.startsWith("claude-sonnet-4-5-")) return MODEL_PRICES_USD_PER_MILLION["claude-sonnet-4-5"];
  if (name.startsWith("claude-sonnet-4-6-")) return MODEL_PRICES_USD_PER_MILLION["claude-sonnet-4-6"];
  if (name.startsWith("claude-sonnet-4-")) return MODEL_PRICES_USD_PER_MILLION["claude-sonnet-4"];
  if (name.startsWith("gpt-4.1-mini-")) return MODEL_PRICES_USD_PER_MILLION["gpt-4.1-mini"];
  if (name.startsWith("gpt-4o-mini-transcribe-")) return MODEL_PRICES_USD_PER_MILLION["gpt-4o-mini-transcribe"];
  return null;
}

function normalizeUsage(provider, usage) {
  const source = usage && typeof usage === "object" ? usage : {};
  const details = source.input_tokens_details && typeof source.input_tokens_details === "object"
    ? source.input_tokens_details
    : {};
  const cachedInput = finiteNonNegative(source.cached_input_tokens != null
    ? source.cached_input_tokens
    : source.cache_read_input_tokens != null ? source.cache_read_input_tokens : details.cached_tokens);
  const inputTotal = finiteNonNegative(source.input_tokens != null ? source.input_tokens : source.prompt_tokens);
  return {
    input_tokens: provider === "openai" ? Math.max(0, inputTotal - cachedInput) : inputTotal,
    output_tokens: finiteNonNegative(source.output_tokens != null ? source.output_tokens : source.completion_tokens),
    cached_input_tokens: provider === "openai" ? cachedInput : finiteNonNegative(
      source.cached_input_tokens != null ? source.cached_input_tokens : source.cache_read_input_tokens
    ),
    cache_write_tokens: finiteNonNegative(source.cache_write_tokens != null ? source.cache_write_tokens : source.cache_creation_input_tokens),
    duration_seconds: finiteNonNegative(source.duration_seconds != null ? source.duration_seconds : source.seconds),
    web_search_requests: finiteNonNegative(source.server_tool_use && source.server_tool_use.web_search_requests)
  };
}

function estimateUsageCostUsd(model, usage) {
  const normalized = normalizeUsage(String(model || "").startsWith("claude-") ? "anthropic" : "openai", usage);
  const price = modelPrice(model);
  if (!price) return { priced: false, cost_usd: null, price_version: PRICE_VERSION };
  let cost = 0;
  if (price.minute && normalized.duration_seconds > 0) {
    cost += normalized.duration_seconds / 60 * price.minute;
  } else {
    cost += normalized.input_tokens * finiteNonNegative(price.input) / 1e6;
    cost += normalized.output_tokens * finiteNonNegative(price.output) / 1e6;
    cost += normalized.cached_input_tokens * finiteNonNegative(price.cached_input != null ? price.cached_input : price.cache_read) / 1e6;
    cost += normalized.cache_write_tokens * finiteNonNegative(price.cache_write) / 1e6;
  }
  return { priced: true, cost_usd: Math.round(cost * 1e8) / 1e8, price_version: PRICE_VERSION };
}

function conversationReference(tenantId, channel, userId) {
  const seed = [cleanText(tenantId, 120), cleanText(channel, 40), cleanText(userId, 300)].join("\u001f");
  if (!seed.replace(/\u001f/g, "")) return "operacion-interna";
  return "conv-" + crypto.createHash("sha256").update(seed).digest("hex").slice(0, 12);
}

function normalizeProviderError(error) {
  const status = Number(error && error.response && error.response.status) || 0;
  const body = error && error.response && error.response.data;
  const providerError = body && body.error && typeof body.error === "object" ? body.error : {};
  const type = cleanText(providerError.type || providerError.code || error && error.code, 80).toLowerCase();
  const message = cleanText(providerError.message || error && error.message, 240).toLowerCase();
  const noCredits = status === 402 || type === "insufficient_quota" || type === "billing_hard_limit_reached" ||
    /credit.balance|insufficient.quota|billing|payment|required|quota.*exceed|balance.*low/.test(type + " " + message);
  const auth = status === 401 || status === 403 || /invalid.*api.*key|authentication|permission/.test(type + " " + message);
  const rateLimited = status === 429 && !noCredits;
  return {
    code: noCredits ? "no_credits" : auth ? "invalid_credentials" : rateLimited ? "rate_limited" : status >= 500 ? "provider_error" : "request_failed",
    no_credits: noCredits,
    http_status: status || null
  };
}

function createAiUsageEvent(input) {
  input = input || {};
  const provider = cleanText(input.provider, 30).toLowerCase();
  const usage = normalizeUsage(provider, input.usage);
  const estimate = estimateUsageCostUsd(input.model, usage);
  const status = input.status === "error" ? "error" : "ok";
  const error = status === "error" ? normalizeProviderError(input.error) : null;
  return {
    version: 1,
    at: input.at || new Date().toISOString(),
    provider,
    model: cleanText(input.model, 120),
    tenant_id: cleanText(input.tenant_id, 120) || "platform",
    conversation_ref: input.conversation_ref || conversationReference(input.tenant_id, input.channel, input.user_id),
    channel: cleanText(input.channel, 40) || "internal",
    bot_id: cleanText(input.bot_id, 80) || "platform",
    feature: cleanText(input.feature, 80) || "conversation",
    status,
    error_code: error && error.code || null,
    no_credits: !!(error && error.no_credits),
    http_status: error && error.http_status || null,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cached_input_tokens: usage.cached_input_tokens,
    cache_write_tokens: usage.cache_write_tokens,
    duration_seconds: usage.duration_seconds,
    web_search_requests: usage.web_search_requests,
    estimated_cost_usd: estimate.cost_usd,
    priced: estimate.priced,
    price_version: estimate.price_version,
    context_messages: finiteNonNegative(input.context_messages),
    tools_available: finiteNonNegative(input.tools_available),
    iteration: finiteNonNegative(input.iteration)
  };
}

function serializeAiUsageEvent(event) {
  const events = Array.isArray(event) ? event : [event];
  return AI_USAGE_PREFIX + JSON.stringify({ version: 1, events });
}

function parseAiUsageTurn(turn) {
  const raw = String(turn && (turn.botReply || turn.bot_reply) || "");
  if (!raw.startsWith(AI_USAGE_PREFIX)) return null;
  try {
    const parsed = JSON.parse(raw.slice(AI_USAGE_PREFIX.length));
    const events = parsed && Array.isArray(parsed.events) ? parsed.events : [parsed];
    return events.filter(function (event) {
      return event && event.version === 1 && ["anthropic", "openai"].includes(event.provider);
    });
  } catch (_) {
    return null;
  }
}

function emptyTotals() {
  return {
    calls: 0,
    successful_calls: 0,
    failed_calls: 0,
    no_credit_errors: 0,
    input_tokens: 0,
    output_tokens: 0,
    cached_input_tokens: 0,
    cache_write_tokens: 0,
    duration_seconds: 0,
    estimated_cost_usd: 0,
    unpriced_calls: 0,
    last_success_at: null,
    last_error_at: null,
    last_error_code: null
  };
}

function addEvent(target, event) {
  target.calls++;
  target.input_tokens += finiteNonNegative(event.input_tokens);
  target.output_tokens += finiteNonNegative(event.output_tokens);
  target.cached_input_tokens += finiteNonNegative(event.cached_input_tokens);
  target.cache_write_tokens += finiteNonNegative(event.cache_write_tokens);
  target.duration_seconds += finiteNonNegative(event.duration_seconds);
  if (event.priced && event.estimated_cost_usd != null) target.estimated_cost_usd += finiteNonNegative(event.estimated_cost_usd);
  else if (event.status === "ok") target.unpriced_calls++;
  if (event.status === "error") {
    target.failed_calls++;
    if (event.no_credits) target.no_credit_errors++;
    if (!target.last_error_at || event.at > target.last_error_at) {
      target.last_error_at = event.at;
      target.last_error_code = event.error_code || "request_failed";
    }
  } else {
    target.successful_calls++;
    if (!target.last_success_at || event.at > target.last_success_at) target.last_success_at = event.at;
  }
}

function finalizeTotals(value) {
  value.estimated_cost_usd = Math.round(value.estimated_cost_usd * 1e6) / 1e6;
  return value;
}

function namedRows(map, nameKey) {
  return Array.from(map.entries()).map(function (entry) {
    return finalizeTotals(Object.assign({ [nameKey]: entry[0] }, entry[1]));
  }).sort(function (a, b) {
    return b.estimated_cost_usd - a.estimated_cost_usd || b.calls - a.calls;
  });
}

function aggregateAiUsageEvents(events) {
  const overall = emptyTotals();
  const providers = new Map();
  const bots = new Map();
  const conversations = new Map();
  const drivers = new Map();
  (Array.isArray(events) ? events : []).forEach(function (event) {
    if (!event || !["anthropic", "openai"].includes(event.provider)) return;
    addEvent(overall, event);
    const provider = providers.get(event.provider) || emptyTotals();
    addEvent(provider, event);
    providers.set(event.provider, provider);
    const botKey = [event.tenant_id || "platform", event.bot_id || "platform"].join("\u001f");
    const bot = bots.get(botKey) || Object.assign(emptyTotals(), { tenant_id: event.tenant_id || "platform", bot_id: event.bot_id || "platform" });
    addEvent(bot, event);
    bots.set(botKey, bot);
    const conversationKey = [event.tenant_id || "platform", event.conversation_ref || "operacion-interna", event.bot_id || "platform"].join("\u001f");
    const conversation = conversations.get(conversationKey) || Object.assign(emptyTotals(), {
      tenant_id: event.tenant_id || "platform",
      conversation_ref: event.conversation_ref || "operacion-interna",
      channel: event.channel || "internal",
      bot_id: event.bot_id || "platform",
      providers: [],
      models: []
    });
    if (!conversation.providers.includes(event.provider)) conversation.providers.push(event.provider);
    if (event.model && !conversation.models.includes(event.model)) conversation.models.push(event.model);
    addEvent(conversation, event);
    conversations.set(conversationKey, conversation);
    const driver = drivers.get(event.feature || "conversation") || emptyTotals();
    addEvent(driver, event);
    drivers.set(event.feature || "conversation", driver);
  });
  return {
    totals: finalizeTotals(overall),
    providers: namedRows(providers, "provider"),
    bots: Array.from(bots.values()).map(finalizeTotals).sort(function (a, b) { return b.estimated_cost_usd - a.estimated_cost_usd || b.calls - a.calls; }),
    conversations: Array.from(conversations.values()).map(finalizeTotals).sort(function (a, b) { return b.estimated_cost_usd - a.estimated_cost_usd || String(b.last_success_at || b.last_error_at || "").localeCompare(String(a.last_success_at || a.last_error_at || "")); }),
    drivers: namedRows(drivers, "feature")
  };
}

function sumAnthropicCostReport(payload) {
  let total = 0;
  (payload && Array.isArray(payload.data) ? payload.data : []).forEach(function (bucket) {
    (Array.isArray(bucket && bucket.results) ? bucket.results : []).forEach(function (row) {
      if (!row.currency || String(row.currency).toUpperCase() === "USD") total += finiteNonNegative(row.amount);
    });
  });
  return Math.round(total * 1e6) / 1e6;
}

function sumOpenAiCostReport(payload) {
  let total = 0;
  (payload && Array.isArray(payload.data) ? payload.data : []).forEach(function (bucket) {
    (Array.isArray(bucket && bucket.results) ? bucket.results : []).forEach(function (row) {
      const amount = row && row.amount;
      if (!amount || !amount.currency || String(amount.currency).toLowerCase() === "usd") total += finiteNonNegative(amount && amount.value);
    });
  });
  return Math.round(total * 1e6) / 1e6;
}

module.exports = {
  AI_USAGE_PREFIX,
  PRICE_VERSION,
  aggregateAiUsageEvents,
  conversationReference,
  createAiUsageEvent,
  estimateUsageCostUsd,
  normalizeProviderError,
  normalizeUsage,
  parseAiUsageTurn,
  serializeAiUsageEvent,
  sumAnthropicCostReport,
  sumOpenAiCostReport
};
