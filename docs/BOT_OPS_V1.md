# Bot Operations & Improvement v1

Bot Ops is one platform-level operational service for every Nextfor bot. It does not create one agent per bot. All records carry `tenant_id`, `bot_id`, and `channel`, so one review can supervise the fleet without mixing companies.

## Runtime flow

1. Customer Service and Appointment runtime events are copied into `bot_ops_events` with encrypted payloads. Conversation logs remain unchanged and are not used as the Bot Ops record store.
2. The continuous review advances a durable event cursor and reads only new events plus already-flagged open handoffs.
3. Deterministic lightweight rules detect delivery/registration/provider failures, routing mismatches, weak replies, dissatisfaction, missed handoffs, and improvement opportunities.
4. Findings are deduplicated in `bot_ops_findings`. Runs and summaries live in `bot_ops_runs`; review cursors and timestamps live in `bot_ops_state`.
5. The weekly review aggregates dedicated findings from the previous seven days. It does not rescan conversation history.
6. Super Admin reads `/admin/bot-ops/summary`. New critical findings are also sent by email through Resend without customer message bodies or identifiers.
7. A WhatsApp payload with no resolvable sender is retained encrypted as one permanent incident. It is never guessed, dropped, or retried repeatedly because an unchanged stored payload cannot acquire a sender.

## Schedule

- Continuous: every five minutes, all day (`BOT_OPS_MONITOR_INTERVAL_MINUTES`).
- Weekly: Monday 06:30 America/Bogota.
- The Render process checks due work at startup and every five minutes. Database leases and schedule keys guarantee at most one completed run per review slot, including after a restart.

## Safe actions and approval boundary

Automatic actions are limited to the existing durable retry/requeue path and human-attention escalation. Bot health is degraded through Bot Ops status when critical findings remain open.

Bot Ops cannot automatically change prompts, bot configuration, Production code, tenant ownership, or customer data. Findings that recommend a permanent behavior/configuration change use `approval_pending`; customer protection stays on retry, fallback, or handoff until a person approves work outside Bot Ops.

## Deployment order

1. Apply `docs/migrations/20260814_bot_ops_v1_up.sql` to Staging.
2. Configure `BOT_OPS_ALERT_EMAIL`, `BOT_OPS_ALERT_FROM_EMAIL`, and the existing `RESEND_API_KEY` in Staging.
3. Deploy `v388-bot-ops-improvement-v1` to Staging with `BOT_OPS_CONTROLLED_TESTS_ENABLED=1` and verify `/admin/health` reports Bot Ops storage and email alerts ready. The controlled endpoint is hard-disabled unless the public hostname is `staging.nextforia.com` (or the process is under tests).
4. Call `POST /admin/bot-ops/controlled-test` as Super Admin with the `failed_message` and `dissatisfied_customer` fixtures, run daily and weekly reviews, and verify tenant isolation, dates, status, Super Admin rendering, and email delivery. Disable `BOT_OPS_CONTROLLED_TESTS_ENABLED` after validation.
5. Apply the same migration and environment values in Production.
6. Deploy the verified version to Production.
7. Confirm the in-process scheduler startup log and the review dates/status in Super Admin.

Rollback uses `docs/migrations/20260814_bot_ops_v1_down.sql` only after the application has been rolled back or `BOT_OPS_ENABLED=0` has stopped new writes.
