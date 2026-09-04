"use strict";

const assert = require("assert");
const {
  InMemoryBotOpsStore,
  analyzeEvent,
  createBotOpsService,
  createResendBotOpsNotifier,
  scheduleParts
} = require("./bot-ops");

(async function () {
  let now = new Date("2026-08-14T11:05:00.000Z"); // 06:05 America/Bogota
  const clock = function () { return new Date(now); };
  const store = new InMemoryBotOpsStore({ clock });
  const safeActions = [];
  const alerts = [];
  const service = createBotOpsService({
    store,
    clock,
    safeAction: async function (action, context) {
      safeActions.push({ action, tenant_id: context.event.tenant_id });
      return { ok: true };
    },
    notifyCritical: async function (input) {
      alerts.push(input);
      return { id: "alert-1" };
    }
  });

  await service.recordEvent({
    event_id: "controlled-incident-1",
    tenant_id: "empresa-a",
    bot_id: "customer_service",
    channel: "whatsapp",
    user_id: "wa:3000000001",
    source_id: "wamid.failed",
    occurred_at: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
    event_type: "turn",
    payload: {
      user_id: "wa:3000000001",
      user_message: "Necesito ayuda con mi pedido",
      bot_reply: "",
      tools: ["atlas_route_customer_service"],
      status: "error"
    }
  });
  await service.recordEvent({
    event_id: "dissatisfied-customer-1",
    tenant_id: "empresa-a",
    bot_id: "customer_service",
    channel: "instagram",
    user_id: "ig:customer-1",
    source_id: "ig-msg-1",
    occurred_at: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
    event_type: "turn",
    payload: {
      user_id: "ig:customer-1",
      user_message: "Pésimo servicio, nadie responde y estoy muy molesta",
      bot_reply: "Lamento lo ocurrido. Te paso con una persona.",
      tools: ["request_human_handoff"],
      handoff: true,
      rating: 2,
      status: "ok"
    }
  });
  await service.recordEvent({
    event_id: "healthy-tenant-b-1",
    tenant_id: "empresa-b",
    bot_id: "appointments",
    channel: "voice",
    occurred_at: now.toISOString(),
    event_type: "appointment_result",
    payload: { ok: true, status: "booked", calendar_sync_status: "synced" }
  });

  const firstRun = await service.runDaily("2026-08-14", "controlled_test");
  assert.strictEqual(firstRun.ok, true);
  assert.strictEqual(firstRun.summary.reviewed_events, 3, "daily review must inspect only the three new events");
  assert.strictEqual(firstRun.summary.full_history_scanned, false);
  assert.deepStrictEqual(firstRun.summary.affected_companies, ["empresa-a", "empresa-b"]);
  assert.strictEqual(firstRun.overall_status, "critical");
  assert.strictEqual(alerts.length, 1, "the controlled critical incident must send one independent alert");
  assert(alerts[0].findings.some(function (finding) { return finding.category === "message_not_sent"; }));
  assert(safeActions.some(function (item) { return item.action === "human_attention" && item.tenant_id === "empresa-a"; }));

  const findings = await store.listFindings({});
  assert(findings.some(function (finding) { return finding.category === "customer_dissatisfaction" && finding.tenant_id === "empresa-a"; }), "dissatisfied customer must be detected");
  assert(findings.some(function (finding) { return finding.category === "handoff_pending" && finding.tenant_id === "empresa-a"; }), "human handoff must remain visible");
  assert(findings.some(function (finding) { return finding.category === "failed_or_missed_handoff" && finding.severity === "critical"; }), "an overdue handoff must become a critical missed-handoff finding");
  assert(!findings.some(function (finding) { return finding.tenant_id === "empresa-b"; }), "healthy activity from another company must not inherit findings");
  assert(findings.every(function (finding) { return !JSON.stringify(finding).includes("3000000001"); }), "Bot Ops findings must not expose customer identifiers");

  now = new Date("2026-08-15T11:05:00.000Z");
  const secondRun = await service.runDaily("2026-08-15", "incremental_test");
  assert.strictEqual(secondRun.summary.reviewed_events, 0, "the next daily review must not re-read old activity");
  assert.strictEqual(alerts.length, 1, "old critical events must not alert again without new activity");

  await service.recordEvent({
    event_id: "botops:inbound-failure:queue-1:retryable",
    tenant_id: "empresa-a",
    bot_id: "customer_service",
    channel: "whatsapp",
    source_id: "queue-1",
    event_type: "inbound_processing_failure",
    payload: { error_type: "whatsapp_sender_missing", retryable: true, attempts: 1 }
  });
  await service.runDaily("incident:queue-1:retryable", "controlled_test");
  await service.recordEvent({
    event_id: "botops:inbound-failure:queue-1:permanent",
    tenant_id: "empresa-a",
    bot_id: "customer_service",
    channel: "whatsapp",
    source_id: "queue-1",
    event_type: "inbound_processing_failure",
    payload: {
      error_type: "whatsapp_sender_missing",
      retryable: false,
      attempts: 1,
      message_type: "unsupported",
      direct_sender_present: false,
      contact_sender_count: 0
    }
  });
  await service.runDaily("incident:queue-1:permanent", "controlled_test");
  const senderlessFindings = (await store.listFindings({})).filter(function (finding) {
    return finding.category === "message_not_registered" && finding.source_event_id.includes("queue-1");
  });
  assert.strictEqual(senderlessFindings.length, 1, "one provider event must not create retryable and permanent duplicate incidents");
  assert.strictEqual(senderlessFindings[0].severity, "critical");
  assert.strictEqual(senderlessFindings[0].occurrence_count, 2);
  assert.strictEqual(senderlessFindings[0].evidence.message_type, "unsupported");

  now = new Date("2026-08-15T12:02:00.000Z");
  const monitorRun = await service.runDue(now, "continuous_test");
  assert.strictEqual(monitorRun.results[0].review_type, "daily");
  const sameMonitorBucket = await service.runDue(new Date("2026-08-15T12:04:59.000Z"), "continuous_test");
  assert.strictEqual(sameMonitorBucket.results[0].skipped, true, "all instances must share one five-minute monitoring claim");
  const nextMonitorBucket = await service.runDue(new Date("2026-08-15T12:05:00.000Z"), "continuous_test");
  assert.strictEqual(nextMonitorBucket.results[0].skipped, undefined, "the next monitoring bucket must run without waiting for the next day");

  now = new Date("2026-08-17T11:35:00.000Z"); // Monday 06:35 America/Bogota
  const weekly = await service.runWeekly("2026-08-17", "weekly_test");
  assert.strictEqual(weekly.ok, true);
  assert(weekly.summary.patterns.some(function (pattern) {
    return pattern.tenant_id === "empresa-a" && pattern.category === "customer_dissatisfaction";
  }), "weekly report must preserve company, bot and channel dimensions");
  assert.strictEqual(weekly.summary.full_conversation_history_scanned, false);

  const snapshot = await service.snapshot();
  assert.strictEqual(snapshot.overall_status, "critical");
  assert.strictEqual(snapshot.last_daily_review, "2026-08-15T12:02:00.000Z");
  assert.strictEqual(snapshot.last_weekly_review, "2026-08-17T11:35:00.000Z");
  assert.strictEqual(snapshot.last_updated, "2026-08-17T11:35:00.000Z");
  assert.strictEqual(snapshot.guardrails.automatic_prompt_changes, false);
  assert.strictEqual(snapshot.guardrails.automatic_bot_configuration_changes, false);
  assert.strictEqual(snapshot.guardrails.automatic_production_code_changes, false);
  assert.strictEqual(snapshot.guardrails.automatic_customer_data_changes, false);

  const routing = analyzeEvent({
    event_id: "wrong-route",
    tenant_id: "empresa-c",
    bot_id: "customer_service",
    channel: "whatsapp",
    conversation_key: "hashed-conversation",
    occurred_at: now.toISOString(),
    event_type: "turn",
    payload: {
      user_message: "Quiero agendar una cita mañana",
      bot_reply: "Te ayudo con productos",
      tools: ["atlas_route_customer_service"],
      status: "ok"
    }
  });
  assert(routing.findings.some(function (finding) { return finding.category === "incorrect_routing" && finding.requires_approval; }));

  const emailRequests = [];
  const emailNotifier = createResendBotOpsNotifier({
    apiKey: "test-key",
    from: "Nextfor Bot Ops <ops@example.com>",
    to: ["nextfor@example.com"],
    baseUrl: "https://staging.nextforia.com",
    axiosClient: {
      post: async function (url, body) {
        emailRequests.push({ url, body });
        return { data: { id: "email-1" } };
      }
    }
  });
  await emailNotifier({ findings: [{ tenant_id: "empresa-a", bot_id: "customer_service", channel: "whatsapp", title: "Mensaje sin envío" }] });
  assert.strictEqual(emailRequests.length, 1);
  assert.match(emailRequests[0].body.subject, /Critical/);
  assert.match(emailRequests[0].body.text, /empresa-a/);
  assert.match(emailRequests[0].body.text, /no se modificaron prompts/i);

  const due = scheduleParts(new Date("2026-08-17T11:35:00.000Z"), "America/Bogota");
  assert.deepStrictEqual(due, { date: "2026-08-17", weekday: "Mon", minuteOfDay: 395 });

  console.log("bot-ops tests passed");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
