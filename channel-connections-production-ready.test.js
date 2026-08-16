"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const path = require("path");

function availablePort() {
  return new Promise(function (resolve, reject) {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", function () {
      const port = server.address().port;
      server.close(function () { resolve(port); });
    });
  });
}

function waitForServer(child, port) {
  return new Promise(function (resolve, reject) {
    let output = "";
    const timer = setTimeout(function () { reject(new Error("server_start_timeout\n" + output)); }, 30000);
    function inspect(chunk) {
      output += String(chunk || "");
      if (output.includes("running on port " + port)) {
        clearTimeout(timer);
        resolve(output);
      }
    }
    child.stdout.on("data", inspect);
    child.stderr.on("data", inspect);
    child.once("exit", function (code) {
      clearTimeout(timer);
      reject(new Error("server_exited_" + code + "\n" + output));
    });
  });
}

function postSignedWebhook(base, route, secret, body) {
  const raw = JSON.stringify(body);
  const signature = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return fetch(base + route, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": signature },
    body: raw
  });
}

async function waitForJson(url, predicate, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 5000);
  let latest = null;
  while (Date.now() < deadline) {
    const response = await fetch(url);
    latest = await response.json();
    if (predicate(latest)) return latest;
    await new Promise(function (resolve) { setTimeout(resolve, 25); });
  }
  throw new Error("condition_timeout:" + url + "\n" + JSON.stringify(latest));
}

(async function run() {
  const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
  const connectionSource = fs.readFileSync(path.join(__dirname, "channel-connections.js"), "utf8");
  const panelSource = fs.readFileSync(path.join(__dirname, "customer-panel.js"), "utf8");
  const whatsappV2MigrationSource = fs.readFileSync(
    path.join(__dirname, "docs/migrations/20260808_whatsapp_onboarding_v2_up.sql"),
    "utf8"
  );
  assert.match(whatsappV2MigrationSource, /whatsapp_outbound_billing_status_at timestamptz/);
  assert.match(connectionSource, /failureAt < watermarkAt/);
  assert.match(connectionSource, /failureAt === watermarkAt/);
  assert.match(connectionSource, /deliveredAt <= watermarkAt/);
  assert.match(source, /runStartupProtectionDiagnostics\(\{[\s\S]*?store: channelConnectionStore,[\s\S]*?env: process\.env,[\s\S]*?log/);
  assert.match(source, /const CHANNEL_CONNECTION_TENANT_ALIASES = Object\.freeze\(\{\}\)/);
  assert.match(source, /const protectedLegacyChannelConnections = Object\.freeze\(\[\]\)/);
  assert.doesNotMatch(source, /bootstrapExistingWhatsAppConnection|registerRavWhatsAppCloudNumberIfNeeded/);
  assert.doesNotMatch(source, /retireTemporaryInstagramReviewOwners|retireMisassignedRavInstagramOwners/);
  assert.doesNotMatch(source, /syncNextforPricingJuly2026|runRavInstagramHandoffRepairOnce|runRavInstagramDeliveryVerificationOnce/);
  assert.match(source, /function instagramGraphOriginForRuntime\(runtime\)[\s\S]*?runtime\.instagramLoginType \|\| runtime\.instagram_login_type[\s\S]*?=== "instagram"[\s\S]*?"https:\/\/graph\.instagram\.com"[\s\S]*?"https:\/\/graph\.facebook\.com"/);
  assert.match(source, /function rememberConversationRuntime\(userId, runtime\)[\s\S]*?instagramLoginType: cleanRuntimeText\(runtime\.instagramLoginType \|\| runtime\.instagram_login_type/);
  assert.match(source, /async function outboundRuntimeForConversation\(userId, options\)[\s\S]*?instagramLoginType: cleanRuntimeText\(options && \(options\.instagramLoginType \|\| options\.instagram_login_type\)/);
  assert.match(source, /await handleConversation\(userId, event\.message\.text,[\s\S]*?instagram_login_type: destination\.instagramLoginType \|\| destination\.instagram_login_type/);
  assert.match(source, /const INSTAGRAM_LOGIN_APP_ID =[\s\S]*?2073069230231933/);
  assert.match(source, /instagramLoginEnabled: INSTAGRAM_LOGIN_ENABLED/);
  assert.match(source, /tenantAliases: CHANNEL_CONNECTION_TENANT_ALIASES/);
  assert.match(source, /const graphOrigin = instagramGraphOriginForRuntime\(runtime\);[\s\S]*?`\$\{graphOrigin\}\/\$\{META_GRAPH_VERSION\}\/\$\{sendId\}\/messages`/);
  assert.match(source, /instagramRuntimeState\.last_error_code = metaError\.code \|\| null/);
  assert.match(source, /instagramRuntimeState\.last_error_subcode = metaError\.error_subcode \|\| null/);
  assert.match(source, /instagramRuntimeState\.last_error_type = metaError\.type \|\| err\.code \|\| null/);
  assert.match(source, /record\.status === "connected" && !record\.protected_legacy/);
  assert.doesNotMatch(source, /const ravAliasTenant = cleanTenantId\(CHANNEL_CONNECTION_BOOTSTRAP_WHATSAPP_TENANT_ID\)/);
  assert.match(source, /function customerTenantForAuth\(auth\)[\s\S]*?auth\.version !== 2[\s\S]*?auth\.session_version !== 2[\s\S]*?return cleanTenantId\(auth\.tenant_id\)/);
  assert.match(source, /function isRavTenantId\(tenantId\)[\s\S]*?CHANNEL_CONNECTION_BOOTSTRAP_WHATSAPP_TENANT_ID/);
  assert.match(source, /handoffCustomerReply[\s\S]*?recordTurn\(/);
  assert.match(source, /type === "audio"[\s\S]*?conversation_meta: \{[\s\S]*?require_persistence: !!inboxRow/);
  assert.match(source, /type === "image"[\s\S]*?conversation_meta: \{[\s\S]*?require_persistence: !!inboxRow/);
  assert.match(source, /Aún no puedo leer documentos directamente[\s\S]*?await recordTurn\(/);
  assert.match(source, /Solo puedo leer texto por ahora[\s\S]*?await recordTurn\(/);
  assert.doesNotMatch(source, /if \(alias && alias\.source === "channel_connection"\) return alias/);
  assert.doesNotMatch(source, /source: "environment"/);
  assert.doesNotMatch(source, /source: "legacy_destination"/);
  assert.doesNotMatch(source, /instagramEntryMatchesLegacyRuntime/);
  assert.doesNotMatch(source, /runtime && runtime\.accessToken \|\| (?:WA_TOKEN|IG_ACCESS_TOKEN|MESSENGER_PAGE_ACCESS_TOKEN)/);
  assert.match(source, /async function outboundRuntimeForConversation\(userId, options\)[\s\S]*?return null;\n}/);
  assert.match(source, /function splitMetaMessageText\(value, maxLength\)/);
  assert.match(source, /const chunks = splitMetaMessageText\(text, 950\)[\s\S]*?for \(const chunk of chunks\)[\s\S]*?message: \{ text: chunk \}/);
  assert.doesNotMatch(source, /recipient\.channel === "instagram"[\s\S]{0,1400}slice\(0, 2000\)/);
  assert.match(source, /rememberManagedInstagramOutbound\(chunk\)/);
  assert.match(source, /isRecentManagedInstagramOutbound\(event\.message\.text\)[\s\S]*?managed_outbound_echo/);
  assert.match(source, /ambiguous_instagram_destination_ids/);
  assert.match(source, /instagram_asset_tenant_conflict/);
  assert.match(source, /pending_activation/);
  assert.match(source, /tenant_bot_response_blocked/);
  assert.match(source, /applyTenantWhatsAppBusinessProfile/);
  assert.match(source, /bot-personality\/whatsapp-profile-sync/);
  assert.match(source, /whatsappBusinessProfileForPersonality/);
  assert.match(connectionSource, /async updateWhatsAppBusinessProfile\(credential, input\)/);
  assert.match(connectionSource, /update\.profile_picture_handle = handle/);
  assert.match(connectionSource, /whatsapp_business_profile_not_verified/);
  assert.match(connectionSource, /fields: "profile_picture_url,description,address"/);
  assert.match(source, /resolveTenantRuntimePolicy/);
  assert.doesNotMatch(source, /legacyRavFallbackAllowed/);
  assert.match(source, /executeSearchProducts\(userId, toolUse\.input, stateKey\)/);
  assert.match(source, /checkout: checkouts\.get\(stateKey\)/);
  assert.match(source, /pendingRatings\.has\(stateKey\)/);
  assert.match(source, /checkouts\.delete\(tenantConversationStateKey\(userId, tenantId\)\)/);
  assert.match(source, /recordRetargetingSignal\(\s*destination\.tenantId,\s*from,/,
    "WhatsApp webhook signals must use the resolved tenant, never the RAV default");
  assert.match(source, /"whatsapp_sender_unresolved"[\s\S]*?tenant_id: destination\.tenantId[\s\S]*?destination_suffix/,
    "unresolved WhatsApp senders must produce tenant-scoped operational telemetry");
  assert.match(source, /missingSender\.recoverAfterFix = true/,
    "an internal sender parsing failure must remain queued for the corrected release");
  assert.match(
    source,
    /const from = whatsappMessageSender\(value, message\);[\s\S]*?if \(type === "text"\)[\s\S]*?await handleConversation\(from, messageText, \{[\s\S]*?tenant_id: destination\.tenantId/,
    "the recovered inbound sender must remain the exact text-conversation and reply recipient"
  );
  assert.match(
    source,
    /receipt\.pending_reply[\s\S]*?sendText: function \(outboundText\) \{ return sendText\(from, outboundText, destination\); \}/,
    "a resumed reply must return to the same recovered sender and tenant destination"
  );
  assert.match(source, /recordRetargetingSignal\(destination\.tenantId, userId,[\s\S]*?ig:/,
    "Instagram webhook signals must use the resolved tenant");
  assert.match(source, /recordRetargetingSignal\(destination\.tenantId, userId,[\s\S]*?ms:/,
    "Messenger webhook signals must use the resolved tenant");
  assert.doesNotMatch(
    source,
    /async function recordRetargetingSignal\([\s\S]*?\n}\n\nasync function createRetargetingJobForCustomer[\s\S]*?const tenantId = CUSTOMER_PANEL_BUSINESS\.id/,
    "tenant B signals/jobs must never be attributed to RAV"
  );
  assert.match(source, /if \(isRavTenantId\(tenantId\)\) await notifyTeam\(notif, userId\)/,
    "external handoffs must remain tenant-local and never notify RAV recipients");
  assert.match(source, /CHANNEL_CONNECTIONS_DEDICATED_STORE_ENABLED && !metaWebhookInbox[\s\S]*?return res\.sendStatus\(503\)/,
    "dedicated delivery must fail closed when the durable inbox is unavailable");
  assert.match(source, /message_statuses: \{ sent: 0, delivered: 0, read: 0, failed: 0 \}/);
  assert.match(source, /processWhatsAppStatusInboxEvent\(value, deliveryStatus, inboxRow\)/);
  assert.match(source, /processWhatsAppBusinessAppEcho\(value, businessAppEcho, inboxRow\)/);
  const echoHandlerStart = source.indexOf("async function processWhatsAppBusinessAppEcho");
  const echoHandlerEnd = source.indexOf("\nasync function processWhatsAppStatusInboxEvent", echoHandlerStart);
  assert(echoHandlerStart >= 0 && echoHandlerEnd > echoHandlerStart);
  const echoHandler = source.slice(echoHandlerStart, echoHandlerEnd);
  assert.match(echoHandler, /addHumanHandoff\(recipientId, destination\.tenantId\)/,
    "a reply from WhatsApp Business App must pause the bot for that tenant conversation");
  assert.match(echoHandler, /recordAdminEvent\([\s\S]*?require_persistence: !!inboxRow/,
    "a Business App echo must be durably visible in the Customer Panel before inbox completion");
  assert.doesNotMatch(echoHandler, /handleConversation|sendText\(/,
    "a Business App echo is an outbound human reply and must never trigger another bot response");
  assert.doesNotMatch(source, /\[WhatsAppDeliveryStatus\]/,
    "delivery receipts are operational events and must not become visible conversation turns");
  assert.match(source, /if \(e && e\.whatsappDeliveryFailure\) throw e;/,
    "tool delivery failures must escape to the durable worker without a second fallback");
  assert.match(source, /if \(err && err\.whatsappDeliveryFailure\)[\s\S]*?throw err;/,
    "conversation delivery failures must escape to the durable worker");
  assert.match(source, /recordWhatsAppDeliveryStatus\([\s\S]*?destination\.tenantId,[\s\S]*?destination\.phoneNumberId/,
    "async Meta statuses must mutate only the resolved tenant and phone");
  assert.match(source, /status: "outbound_billing_blocked"[\s\S]*?outbound_billing_blocked: true/,
    "WhatsApp health must fail closed when durable billing is blocked");
  assert.match(connectionSource, /status !== "connected" \|\| cleanText\(current\.phone_number_id, 240\) !== cleanPhone/,
    "billing CAS must require the exact active tenant phone");
  assert.match(connectionSource, /whatsappOutboundBillingBlocked\(record\)[\s\S]*?return publicConnection\(current \|\| record/,
    "read-only verification must preserve the billing block");
  assert.match(connectionSource, /deliveredAt <= watermarkAt/,
    "out-of-order delivery receipts must never move the durable billing watermark backwards");
  assert.match(panelSource, /Comprobar pago/);
  assert.match(panelSource, /método de pago/i);
  assert.match(source, /receipt\.pending_reply[\s\S]*?resumeWhatsAppPendingReply/,
    "a durable retry must resume only the checkpointed delivery");
  assert.match(source, /checkpoint && checkpoint\.status \|\| "error"/,
    "a retryable text failure must persist outbound_pending before inbox retry");
  assert.match(source, /turn\.status === "outbound_pending" \? "pending"/);
  assert.match(panelSource, /Pendiente de reintento/);
  assert.match(panelSource, /Conservar mi WhatsApp Business/);
  assert.match(panelSource, /featureType:"whatsapp_business_app_onboarding"/);
  assert.match(panelSource, /FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING/);
  assert.match(connectionSource, /registration_managed_by: coexistence \? "meta_embedded_signup" : "nextfor"/);

  const port = await availablePort();
  const base = "http://127.0.0.1:" + port;
  const encryptionKey = crypto.randomBytes(32).toString("base64url");
  const child = childProcess.spawn(process.execPath, [path.join(__dirname, "index.js")], {
    cwd: __dirname,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      NODE_ENV: "production",
      DASHBOARD_KEY: "channel-production-dashboard-key-2026",
      DASHBOARD_SESSION_SECRET: "channel-production-session-secret-2026",
      DASHBOARD_USERS: JSON.stringify([
        { username: "owner", email: "owner@nextforia.test", password: "OwnerPassword2026", role: "super_admin", name: "Owner" }
      ]),
      VERIFY_TOKEN: "channel-production-verify",
      WA_TOKEN: "channel-production-wa-legacy",
      PHONE_NUMBER_ID: "rav-phone-id",
      META_APP_ID: "channel-production-meta-app",
      META_APP_SECRET: "channel-production-meta-secret-value",
      META_WHATSAPP_CONFIG_ID: "channel-production-whatsapp-config",
      IG_ACCESS_TOKEN: "channel-production-instagram-env-token",
      IG_USER_ID: "instagram-env-business-id",
      IG_SEND_ID: "instagram-env-business-id",
      MESSENGER_PAGE_ACCESS_TOKEN: "channel-production-messenger-env-token",
      MESSENGER_PAGE_ID: "messenger-env-page-id",
      PUBLIC_BASE_URL: "https://api.nextforia.com",
      CUSTOMER_PANEL_BASE_URL: "https://api.nextforia.com",
      ANTHROPIC_API_KEY: "channel-production-anthropic",
      DATA_ENCRYPTION_KEY: encryptionKey,
      CHANNEL_CONNECTIONS_V1_ENABLED: "1",
      CHANNEL_CONNECTIONS_MUTATIONS_ENABLED: "0",
      SUPABASE_URL: "https://nextforia-test.supabase.co",
      SUPABASE_KEY: "channel-production-supabase-key"
    }),
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer(child, port);

    let response = await postSignedWebhook(base, "/webhook", "channel-production-meta-secret-value", {
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value: {
        metadata: { phone_number_id: "rav-phone-id" },
        messages: [{ id: "wamid.environment-must-not-route", from: "573001112233", type: "text", text: { body: "No enrutar por ambiente" } }]
      } }] }]
    });
    assert.strictEqual(response.status, 200);
    response = await postSignedWebhook(base, "/instagram/webhook", "channel-production-meta-secret-value", {
      object: "instagram",
      entry: [{ id: "instagram-env-business-id", messaging: [{
        sender: { id: "instagram-env-sender" },
        recipient: { id: "instagram-env-business-id" },
        message: { mid: "igmid.environment-must-not-route", text: "No enrutar por ambiente" }
      }] }]
    });
    assert.strictEqual(response.status, 200);
    response = await postSignedWebhook(base, "/messenger/webhook", "channel-production-meta-secret-value", {
      object: "page",
      entry: [{ id: "messenger-env-page-id", messaging: [{
        sender: { id: "messenger-env-sender" },
        recipient: { id: "messenger-env-page-id" },
        message: { mid: "msmid.environment-must-not-route", text: "No enrutar por ambiente" }
      }] }]
    });
    assert.strictEqual(response.status, 200);

    response = await fetch(base + "/");
    assert.strictEqual(response.status, 200);
    assert((await response.text()).includes("NextforIA Chatbot v399-order-shipping-default-rebuild"));

    response = await fetch(base + "/admin/panel/channel-connections");
    assert.strictEqual(response.status, 401, "real channel endpoint must be enabled, not demo-only");

    response = await fetch(base + "/admin/channel-connections/meta/callback?state=cutover-test", {
      redirect: "manual"
    });
    assert.strictEqual(response.status, 302, "free cutover must close OAuth callbacks before provider work");
    assert.strictEqual(response.headers.get("retry-after"), "120");
    assert.strictEqual(
      response.headers.get("location"),
      "/admin/panel?tab=channels&connection=maintenance"
    );

    response = await fetch(base + "/admin/health");
    assert.strictEqual(response.status, 200);
    const maintenanceHealth = await response.json();
    assert.strictEqual(maintenanceHealth.customer_setup.meta_oauth_ready, false,
      "public health must expose that connector mutations are closed");

    const whatsappHealth = await waitForJson(base + "/whatsapp/health", function (body) {
      return body && body.runtime && body.runtime.last_skip_reason === "tenant_runtime_not_configured";
    });
    assert.strictEqual(whatsappHealth.configured, false, "environment credentials must not configure WhatsApp runtime");
    assert.strictEqual(whatsappHealth.status, "not_configured");
    assert.strictEqual(whatsappHealth.runtime.runtime_source, null);
    assert.strictEqual(whatsappHealth.runtime.webhook_requests, 1);
    assert.strictEqual(whatsappHealth.runtime.inbound_messages, 0);
    assert.strictEqual(whatsappHealth.runtime.last_skip_reason, "tenant_runtime_not_configured");

    response = await fetch(base + "/instagram/health");
    assert.strictEqual(response.status, 503);
    const instagramHealth = await response.json();
    assert.strictEqual(instagramHealth.configured, false);
    assert.strictEqual(instagramHealth.runtime.last_error_code, null);
    assert.strictEqual(instagramHealth.runtime.last_error_subcode, null);
    assert.strictEqual(instagramHealth.runtime.last_error_type, null);
    assert.strictEqual(instagramHealth.runtime.webhook_requests, 1);
    assert.strictEqual(instagramHealth.runtime.inbound_messages, 0);
    assert.strictEqual(instagramHealth.runtime.last_skip_reason, "tenant_runtime_not_configured");

    response = await fetch(base + "/messenger/health");
    assert.strictEqual(response.status, 503);
    const messengerHealth = await response.json();
    assert.strictEqual(messengerHealth.configured, false);
    assert.strictEqual(messengerHealth.status, "not_configured");
    assert.strictEqual(messengerHealth.runtime.last_health_runtime_source, null);
    assert.strictEqual(messengerHealth.runtime.webhook_requests, 1);
    assert.strictEqual(messengerHealth.runtime.inbound_messages, 0);
    assert.strictEqual(messengerHealth.runtime.last_skip_reason, "tenant_runtime_not_configured");

    response = await fetch(base + "/admin/panel-demo?tab=channels");
    assert.strictEqual(response.status, 200);
    const html = await response.text();
    assert(html.includes("Finaliza el entrenamiento de tu Nextfor"));
    assert(html.includes('id="commerceConnectorCards"'));
    assert(html.includes("Conecta tu tienda"));
    assert(html.includes("fallbackChannelConnections"));
    assert(html.includes("WhatsApp"));
    assert(html.includes("Instagram"));
    assert(html.includes("Facebook Messenger"));
    assert(!html.toLowerCase().includes("access token"));

    console.log("channel-connections-production-ready.test.js: ok");
  } finally {
    child.kill("SIGTERM");
  }
})().catch(function (error) {
  console.error(error.stack || error.message);
  process.exit(1);
});
