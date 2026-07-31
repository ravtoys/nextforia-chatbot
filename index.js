const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const { EventEmitter } = require("events");
const path = require("path");
const { ElevenLabsClient } = require("@elevenlabs/elevenlabs-js");
const {
  createRateLimiter,
  decryptStoredText,
  encryptStoredText,
  isSameOriginRequest,
  parseEncryptionKey,
  safeEqualText,
  safeInlineJson,
  securityHeaders,
  validMetaSignature,
  validateProductionConfig
} = require("./security");
const WHATSAPP_TEMPLATES = require("./whatsapp-templates");
const COMMERCIAL_READINESS = require("./commercial-readiness");
const renderCustomerPanel = require("./customer-panel");
const renderSuperAdminPanel = require("./super-admin-panel");
const renderSuperAdminLogin = require("./super-admin-login");
const { renderSignatureAdmin, renderSignatureForm } = require("./signature-pages");
const {
  SIGNATURE_TOOL,
  createSignatureService
} = require("./signature");
const renderAppointmentPanel = require("./appointment-panel");
const {
  customerAppointmentSnapshot,
  demoAppointmentSnapshot
} = require("./customer-appointments");
const renderCustomerPasswordSetup = require("./customer-access");
const renderCustomerLogin = require("./customer-login");
const renderCustomerPublicSignup = require("./customer-public-signup");
const {
  CatalogError,
  InMemoryCatalogStore,
  NEXTFOR_PRICING_JULY_2026,
  SupabaseCatalogStore,
  createCatalogService
} = require("./platform-catalogs");
const {
  InMemoryPaymentStore,
  integritySignature,
  PaymentError,
  SupabasePaymentStore,
  createPaymentService
} = require("./payments");
const {
  CustomerAccessError,
  InMemoryCustomerAccessStore,
  SupabaseCustomerAccessStore,
  createCustomerAccessService,
  createMemoryEmailSender,
  createResendEmailSender
} = require("./customer-access-v2");
const {
  DEFAULT_PLATFORM_GOALS,
  PLATFORM_GOAL_RECORD_ID,
  PLATFORM_GOAL_TOOL,
  buildPlatformGoalRecord,
  normalizePlatformGoal,
  platformGoalsFromTurns
} = require("./platform-goals");
const renderClientOnboarding = require("./client-onboarding-page");
const {
  CUSTOMER_SETUP_QUESTIONS,
  SETUP_REVIEW_STATUSES,
  buildCoverageConversationContext,
  cloneDefaults: defaultClientOnboarding,
  createOnboardingRecord,
  generateCustomerServiceConfiguration,
  normalizeCustomerServiceConfiguration,
  normalizeCustomerSetupQuestionnaire
} = require("./client-onboarding");
const {
  INDUSTRY_PROFILES,
  copyDefaults: defaultBotSetupAnswers,
  createSetupRecord
} = require("./bot-setup");
const {
  adaptiveConversationBudget,
  buildCustomerMemoryContext,
  evolveCustomerMemory,
  isMeaningfulMemory,
  memoryFingerprint,
  normalizeMemory
} = require("./customer-intelligence");
const {
  RetargetingEngine,
  REAL_SENDS_ENABLED: RETARGETING_REAL_SENDS_ENABLED,
  AUTOMATIC_MODE_ENABLED: RETARGETING_AUTOMATIC_MODE_ENABLED,
  isStopMessage
} = require("./retargeting");
const { CommerceRegistry, createShopifyAdapter } = require("./commerce");
const { AppointmentRegistry } = require("./appointments");
const {
  DERCO_TENANT_ID,
  getRegisteredClient,
  listRegisteredClients,
  parseAgentTenantMap
} = require("./client-registry");
const {
  cleanTenantId,
  createTenantConfig,
  validateWhatsAppDestination
} = require("./tenant-config");
const { buildRavIntegration } = require("./nextfor-integration");
const {
  ChannelConnectionError,
  InMemoryChannelConnectionStore,
  MetaChannelProvider,
  SupabaseChannelConnectionStore,
  cleanChannel,
  createChannelConnectionService,
  createLegacyConnections,
  createOAuthState,
  readOAuthState
} = require("./channel-connections");
const {
  buildServiceAreaContext,
  buildServiceAreaQuestion,
  classifyServiceAreaReply,
  serviceAreaCheckForPhone
} = require("./service-area");
const {
  buildImageConversationInput,
  buildVoiceConversationInput,
  createMultimodalAgent,
  multimodalConfigFromEnv
} = require("./multimodal-agent");

function boundedEnvInt(name, fallback, min, max) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function configuredPublicHostname(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  try {
    const url = new URL(raw.includes("://") ? raw : "https://" + raw);
    const hostname = url.hostname.toLowerCase();
    if (url.username || url.password || url.port || url.protocol !== "https:") return "";
    if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(hostname)) return "";
    if (hostname === "localhost" || hostname.endsWith(".local")) return "";
    return hostname;
  } catch (_) {
    return "";
  }
}

function safeExternalHttpsUrl(value, allowedHostnames) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
    const hostname = url.hostname.toLowerCase();
    if (!configuredPublicHostname(hostname)) return "";
    if (Array.isArray(allowedHostnames) && allowedHostnames.length) {
      const allowed = allowedHostnames.some(function (entry) {
        entry = String(entry || "").toLowerCase();
        return hostname === entry || (entry.startsWith(".") && hostname.endsWith(entry));
      });
      if (!allowed) return "";
    }
    return url.href;
  } catch (_) {
    return "";
  }
}

function configuredHttpsOrigin(value, fallback, allowedHostnames) {
  const candidate = String(value || fallback || "").trim();
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return "";
    const hostname = url.hostname.toLowerCase();
    if (Array.isArray(allowedHostnames) && !allowedHostnames.includes(hostname)) return "";
    return url.origin;
  } catch (_) {
    return "";
  }
}

function configuredHttpsOrigins(value) {
  return String(value || "").split(",").map(function (entry) {
    return configuredHttpsOrigin(entry.trim());
  }).filter(Boolean);
}

function isSameOriginRequestFromAny(req, configuredOrigins) {
  // Local/test environments may intentionally omit a public base URL. Preserve
  // the original same-host validation in that case instead of rejecting every
  // state-changing admin request.
  if (!configuredOrigins.length) return isSameOriginRequest(req, "");
  if (process.env.NODE_ENV === "test" && isSameOriginRequest(req, "")) return true;
  return configuredOrigins.some(function (origin) { return isSameOriginRequest(req, origin); });
}

const app = express();
app.disable("x-powered-by");
// Every deployed environment (Production and Staging) runs behind Cloudflare + Render.
// Without this, req.ip resolves to the proxy address and per-IP rate limiting collapses
// into a single shared bucket for all clients, so one noisy source locks out everyone.
app.set("trust proxy", 1);
app.use(securityHeaders);
app.post("/webhooks/elevenlabs/post-call", express.raw({ type: "application/json", limit: "1mb" }), receiveElevenLabsPostCallWebhook);
app.use(express.json({
  limit: process.env.JSON_BODY_LIMIT || "128kb",
  verify: function (req, res, buffer) {
    req.rawBody = buffer;
  }
}));
app.use("/admin/assets", express.static(path.join(__dirname, "admin-assets"), { maxAge: "1d" }));

// ─── CONFIG ───────────────────────────────────────────────────────────────────────
const BOT_VERSION = "v163-staging-conversation-simulator";  // bump cada release; usado por endpoints /admin/*
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "";
const DASHBOARD_KEY = process.env.DASHBOARD_KEY || "";
const DASHBOARD_SESSION_COOKIE = "rav_dashboard_session";
const DASHBOARD_ROLES = { viewer: 1, agent: 2, admin: 3, super_admin: 4 };
const DASHBOARD_ROLE_LABELS = {
  viewer: "Viewer",
  agent: "Agent",
  admin: "Admin cliente",
  super_admin: "Super admin NexforIA"
};
const DASHBOARD_ACCESS_MODEL = {
  version: "2026-07-11",
  current_mode: "multi_tenant_pilot",
  future_panels: [
    {
      id: "client_admin",
      label: "Admin",
      owner: "Cliente",
      roles: ["admin", "agent", "viewer"],
      purpose: "Operacion diaria del comercio: metricas, conversaciones, intervencion humana, notas y pruebas controladas."
    },
    {
      id: "platform_super_admin",
      label: "Super admin",
      owner: "NexforIA",
      roles: ["super_admin"],
      purpose: "Operacion de plataforma: tenants, integraciones, salud global, readiness comercial y configuracion tecnica sensible."
    }
  ],
  roles: [
    { role: "super_admin", level: 4, scope: "platform", owner: "NexforIA", purpose: "Administra todos los clientes, tenants, integraciones y herramientas sensibles." },
    { role: "admin", level: 3, scope: "tenant", owner: "Cliente", purpose: "Administra el negocio asignado, usuarios operativos, metricas y pruebas del bot." },
    { role: "agent", level: 2, scope: "tenant", owner: "Cliente", purpose: "Atiende chats, toma control humano, responde y guarda notas/etiquetas." },
    { role: "viewer", level: 1, scope: "tenant", owner: "Cliente", purpose: "Consulta metricas y conversaciones sin intervenir." }
  ],
  migration_steps: [
    "Usar RAV Toys como integracion piloto #1 de Atencion al cliente y DERCO como piloto de Agendamiento.",
    "Crear usuarios super_admin para NexforIA y admin/agent/viewer por cliente.",
    "Mantener separado el dashboard Admin del panel Super admin.",
    "Agregar tenant_id a logs, usuarios y configuracion.",
    "Mover tokens e integraciones a configuracion por tenant antes de vender multi-cliente."
  ]
};
const DASHBOARD_USERS = parseDashboardUsers(process.env.DASHBOARD_USERS || "");
const DASHBOARD_SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET || (DASHBOARD_KEY ? "development-only:" + DASHBOARD_KEY : crypto.randomBytes(32).toString("base64url"));
const DASHBOARD_SESSION_TTL_HOURS = boundedEnvInt("DASHBOARD_SESSION_TTL_HOURS", 8, 1, 24);
const PUBLIC_BASE_URL = configuredHttpsOrigin(process.env.PUBLIC_BASE_URL);
const NEXTFOR_PRICING_SYNC_ON_BOOT = process.env.NEXTFOR_PRICING_SYNC_ON_BOOT === "1"
  || (PUBLIC_BASE_URL && new URL(PUBLIC_BASE_URL).hostname === "staging.nextforia.com");
const RAW_SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const normalizedSupabaseUrl = configuredHttpsOrigin(RAW_SUPABASE_URL);
const SUPABASE_URL = normalizedSupabaseUrl && (
  new URL(normalizedSupabaseUrl).hostname.endsWith(".supabase.co") || process.env.ALLOW_SELF_HOSTED_SUPABASE === "1"
) ? normalizedSupabaseUrl : "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";
const SUPABASE_TABLE = "conversation_logs";
const SUPABASE_ENABLED = !!(SUPABASE_URL && SUPABASE_KEY);  // persistencia de conversaciones
const SUPABASE_TENANT_COLUMNS_ENABLED = process.env.SUPABASE_TENANT_COLUMNS_ENABLED === "1";
const SUPABASE_APPOINTMENTS_TABLE = "appointments";
const SUPABASE_APPOINTMENTS_ENABLED = SUPABASE_ENABLED && process.env.SUPABASE_APPOINTMENTS_ENABLED === "1";
const CUSTOMER_ACCESS_V2_ENABLED = process.env.CUSTOMER_ACCESS_V2_ENABLED === "1";
const CUSTOMER_ACCESS_TEST_MODE = process.env.NODE_ENV === "test" && process.env.CUSTOMER_ACCESS_TEST_MODE === "1";
const CHANNEL_CONNECTIONS_V1_ENABLED = process.env.CHANNEL_CONNECTIONS_V1_ENABLED === "1";
const CUSTOMER_SETUP_COMPLETION_PATH = CHANNEL_CONNECTIONS_V1_ENABLED
  ? "/admin/panel?tab=channels&from=onboarding"
  : "/admin/panel?tab=setup&from=onboarding";
const CHANNEL_CONNECTIONS_TEST_MODE = process.env.NODE_ENV === "test" && process.env.CHANNEL_CONNECTIONS_TEST_MODE === "1";
const PAYMENTS_V1_ENABLED = process.env.PAYMENTS_V1_ENABLED === "1";
const PAYMENTS_TEST_MODE = process.env.NODE_ENV === "test" && process.env.PAYMENTS_TEST_MODE === "1";
const PAYMENTS_ENV = String(process.env.PAYMENTS_ENV || "").trim().toLowerCase();
const WOMPI_PUBLIC_KEY = String(process.env.WOMPI_PUBLIC_KEY || "").trim();
const WOMPI_INTEGRITY_SECRET = String(process.env.WOMPI_INTEGRITY_SECRET || "").trim();
const WOMPI_EVENT_SECRET = String(process.env.WOMPI_EVENT_SECRET || "").trim();
const WOMPI_ESTIMATED_FEE_RATE = Number(process.env.WOMPI_ESTIMATED_FEE_RATE || 0);
const WOMPI_ESTIMATED_FIXED_FEE = Number(process.env.WOMPI_ESTIMATED_FIXED_FEE || 0);
const WOMPI_ESTIMATED_FEE_TAX_RATE = Number(process.env.WOMPI_ESTIMATED_FEE_TAX_RATE || 0);
const CUSTOMER_INVITE_TTL_HOURS = boundedEnvInt("CUSTOMER_INVITE_TTL_HOURS", 24, 1, 168);
const CUSTOMER_PANEL_BASE_URL = configuredHttpsOrigin(process.env.CUSTOMER_PANEL_BASE_URL, PUBLIC_BASE_URL);
const CUSTOMER_PANEL_FALLBACK_BASE_URLS = configuredHttpsOrigins(process.env.CUSTOMER_PANEL_FALLBACK_BASE_URLS);
const ADMIN_ALLOWED_BASE_URLS = [PUBLIC_BASE_URL].concat(CUSTOMER_PANEL_BASE_URL, CUSTOMER_PANEL_FALLBACK_BASE_URLS).filter(Boolean);
const CHANNEL_CONNECTIONS_STAGING_PREVIEW = CHANNEL_CONNECTIONS_V1_ENABLED
  || process.env.CHANNEL_CONNECTIONS_V1_PREVIEW === "1"
  || (
    process.env.CHANNEL_CONNECTIONS_V1_PREVIEW !== "0"
    && process.env.NODE_ENV === "production"
    && [CUSTOMER_PANEL_BASE_URL, PUBLIC_BASE_URL].filter(Boolean).some(function (origin) {
      try { return new URL(origin).hostname === "staging.nextforia.com"; }
      catch (_) { return false; }
    })
  );
const CHANNEL_CONNECTIONS_V1_VISIBLE = CHANNEL_CONNECTIONS_V1_ENABLED || CHANNEL_CONNECTIONS_STAGING_PREVIEW;
const CUSTOMER_ACCESS_EMAIL_PROVIDER = String(process.env.CUSTOMER_ACCESS_EMAIL_PROVIDER || "").trim().toLowerCase();
const CUSTOMER_INVITE_FROM_EMAIL = String(process.env.CUSTOMER_INVITE_FROM_EMAIL || "").trim();
const CUSTOMER_INVITE_REPLY_TO = String(process.env.CUSTOMER_INVITE_REPLY_TO || "").trim();
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "").trim();
const ELEVENLABS_API_KEY = String(process.env.ELEVENLABS_API_KEY || "").trim();
const ELEVENLABS_WEBHOOK_SECRET = String(process.env.ELEVENLABS_WEBHOOK_SECRET || "").trim();
const ELEVENLABS_AGENT_TENANT_MAP = parseAgentTenantMap(process.env);
const ELEVENLABS_WEBHOOK_CLIENT = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY || "webhook-verification-only" });
const appointmentRegistry = new AppointmentRegistry();
const RAW_DATA_ENCRYPTION_KEY = String(process.env.DATA_ENCRYPTION_KEY || "").trim();
const DATA_ENCRYPTION_KEY = parseEncryptionKey(RAW_DATA_ENCRYPTION_KEY);
const WA_TOKEN = process.env.WA_TOKEN;
const TENANT_CONFIG = createTenantConfig(process.env);
const DEFAULT_TENANT_ID = TENANT_CONFIG.id;
const PHONE_NUMBER_ID = TENANT_CONFIG.phoneNumberId;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN || "";
const IG_USER_ID = process.env.IG_USER_ID || "";
const IG_SEND_ID = process.env.IG_SEND_ID || IG_USER_ID;
const IG_GRAPH_BASE_URL = configuredHttpsOrigin(process.env.IG_GRAPH_BASE_URL, "https://graph.instagram.com", ["graph.instagram.com", "graph.facebook.com"]);
const IG_VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN || VERIFY_TOKEN;
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";
const META_APP_ID = String(process.env.META_APP_ID || "").trim();
const META_WHATSAPP_CONFIG_ID = String(process.env.META_WHATSAPP_CONFIG_ID || "").trim();
const RENDER_SELF_HEALTH_URL = process.env.RENDER === "true"
  ? configuredHttpsOrigin(process.env.RENDER_EXTERNAL_URL)
  : "";
const INSTAGRAM_HEALTH_INTERVAL_MS = boundedEnvInt(
  "INSTAGRAM_HEALTH_INTERVAL_MS",
  7 * 60 * 1000,
  2 * 60 * 1000,
  14 * 60 * 1000
);
const BOT_HANDOFF_TTL_MS = boundedEnvInt("BOT_HANDOFF_TTL_MINUTES", 120, 5, 1440) * 60 * 1000;
const ADMIN_HANDOFF_TTL_MS = boundedEnvInt("ADMIN_HANDOFF_TTL_MINUTES", 720, 15, 2880) * 60 * 1000;
const MESSENGER_PAGE_ACCESS_TOKEN = process.env.MESSENGER_PAGE_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || "";
const MESSENGER_PAGE_ID = process.env.MESSENGER_PAGE_ID || process.env.FB_PAGE_ID || "";
const MESSENGER_VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN || VERIFY_TOKEN;
const META_APP_SECRET = process.env.META_APP_SECRET || process.env.MESSENGER_APP_SECRET || "";
const MESSENGER_APP_SECRET = META_APP_SECRET;
const CHANNEL_CONNECTION_CALLBACK_URL = (CUSTOMER_PANEL_BASE_URL || PUBLIC_BASE_URL)
  ? (CUSTOMER_PANEL_BASE_URL || PUBLIC_BASE_URL) + "/admin/channel-connections/meta/callback"
  : "";
const ALLOW_UNSIGNED_WEBHOOKS = process.env.ALLOW_UNSIGNED_WEBHOOKS === "1" && process.env.NODE_ENV !== "production";
const MESSENGER_GRAPH_BASE_URL = configuredHttpsOrigin(process.env.MESSENGER_GRAPH_BASE_URL, "https://graph.facebook.com", ["graph.facebook.com"]);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const MULTIMODAL_CONFIG = multimodalConfigFromEnv(process.env);
const OPENAI_TRANSCRIPTION_MODEL = String(process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe").trim();
const OPENAI_VISION_MODEL = String(process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini").trim();
const multimodalAgent = createMultimodalAgent(MULTIMODAL_CONFIG);
const ADAPTIVE_TOKEN_LIMITS = {
  standard: {
    maxTokens: boundedEnvInt("AI_STANDARD_MAX_TOKENS", 1000, 400, 2400),
    historyMessages: boundedEnvInt("AI_STANDARD_HISTORY_MESSAGES", 8, 4, 24)
  },
  engaged: {
    maxTokens: boundedEnvInt("AI_ENGAGED_MAX_TOKENS", 1400, 600, 3200),
    historyMessages: boundedEnvInt("AI_ENGAGED_HISTORY_MESSAGES", 12, 6, 30)
  },
  high: {
    maxTokens: boundedEnvInt("AI_HIGH_INTENT_MAX_TOKENS", 1800, 800, 4096),
    historyMessages: boundedEnvInt("AI_HIGH_INTENT_HISTORY_MESSAGES", 18, 8, 40)
  }
};
const MAX_CONVERSATION_HISTORY = Math.max(
  ADAPTIVE_TOKEN_LIMITS.standard.historyMessages,
  ADAPTIVE_TOKEN_LIMITS.engaged.historyMessages,
  ADAPTIVE_TOKEN_LIMITS.high.historyMessages
);
const CUSTOMER_MEMORY_TOOL = "customer_memory_v1";
const CUSTOMER_MEMORY_CACHE_TTL_MS = boundedEnvInt("CUSTOMER_MEMORY_CACHE_TTL_MS", 5 * 60 * 1000, 30000, 24 * 60 * 60 * 1000);
const CONVERSATION_SESSION_TIMEOUT_MS = boundedEnvInt("CONVERSATION_SESSION_TIMEOUT_MS", 6 * 60 * 60 * 1000, 15 * 60 * 1000, 7 * 24 * 60 * 60 * 1000);
const MAX_INBOUND_TEXT_LENGTH = boundedEnvInt("MAX_INBOUND_TEXT_LENGTH", 4000, 256, 12000);
const SHOPIFY_STORE_DOMAIN = configuredPublicHostname(process.env.SHOPIFY_STORE_DOMAIN);
const SHOPIFY_STOREFRONT_DOMAIN = configuredPublicHostname(process.env.SHOPIFY_STOREFRONT_DOMAIN) || SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const SHOPIFY_ADMIN_API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION || "2026-04";
const SHOPIFY_ORDER_PREFIXES = (process.env.SHOPIFY_ORDER_PREFIXES || process.env.SHOPIFY_ORDER_PREFIX || "RAV")
  .split(",")
  .map(s => s.trim().replace(/[^A-Za-z0-9-]/g, "").replace(/-+$/g, ""))
  .filter(Boolean);
const NOTIFICATION_PHONES = (process.env.NOTIFICATION_PHONES || "").split(",").map(s => s.trim()).filter(Boolean);
const CUSTOMER_META_TOOL = "admin_customer_meta";
const INSTAGRAM_PROFILE_TOOL = "instagram_customer_profile_v1";
const INSTAGRAM_PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
const INSTAGRAM_PROFILE_RETRY_MS = 15 * 60 * 1000;
const DASHBOARD_CUSTOMER_USER_TOOL = "dashboard_customer_user_v1";
const DASHBOARD_CUSTOMER_USER_RECORD_ID = "dashboard-user:" + DEFAULT_TENANT_ID + ":primary-admin";
const BOT_SETUP_TOOL = "tenant_bot_setup_v1";
const BOT_SETUP_DRAFT_RECORD_ID = "bot-setup:" + DEFAULT_TENANT_ID + ":draft";
const BOT_SETUP_PUBLISHED_RECORD_ID = "bot-setup:" + DEFAULT_TENANT_ID + ":published";
const CLIENT_ONBOARDING_TOOL = "tenant_client_onboarding_v1";
const CUSTOMER_SETUP_QUESTIONNAIRE_TOOL = "customer_setup_questionnaire_v1";
const CUSTOMER_SETUP_QUESTIONNAIRE_RECORD_ID = "customer-setup-questionnaire:global";
const SUPER_ADMIN_SETUP_REVIEW_TOOL = "super_admin_setup_review_v1";
const RETARGETING_EVENT_TOOL = "retargeting_event_v1";
const RETARGETING_EVENT_RECORD_PREFIX = "retargeting-events:";
const RETARGETING_TEST_MODE = process.env.RETARGETING_TEST_MODE === "1" && process.env.NODE_ENV !== "production";
const RETARGETING_APPROVED_TEMPLATES = new Set((process.env.RETARGETING_APPROVED_TEMPLATES || "").split(",").map(function (value) { return value.trim(); }).filter(Boolean));
const CUSTOMER_META_TAGS = [
  { id: "venta", label: "Venta" },
  { id: "garantia", label: "Garantia" },
  { id: "pendiente_pago", label: "Pendiente pago" },
  { id: "envio", label: "Envio" },
  { id: "revisar", label: "Revisar" }
];
const CUSTOMER_PANEL_BUSINESS = {
  id: TENANT_CONFIG.id,
  name: TENANT_CONFIG.brandName,
  customer_number: TENANT_CONFIG.customerNumber,
  status: TENANT_CONFIG.status
};

function currentRavIntegration(metaWhatsappCheck) {
  return buildRavIntegration(process.env, { metaWhatsappCheck });
}
// ─────────────────────────────────────────────────────────────────────────────────

const productionConfigErrors = validateProductionConfig({
  nodeEnv: process.env.NODE_ENV,
  verifyToken: VERIFY_TOKEN,
  dashboardKey: DASHBOARD_KEY,
  dashboardSessionSecret: process.env.DASHBOARD_SESSION_SECRET || "",
  metaAppSecret: META_APP_SECRET,
  publicBaseUrl: PUBLIC_BASE_URL,
  allowUnsignedWebhooks: ALLOW_UNSIGNED_WEBHOOKS
});
if (process.env.NODE_ENV === "production" && !PHONE_NUMBER_ID) productionConfigErrors.push("PHONE_NUMBER_ID must be set in production");
if (process.env.NODE_ENV === "production" && SHOPIFY_ADMIN_TOKEN && !SHOPIFY_STORE_DOMAIN) productionConfigErrors.push("SHOPIFY_STORE_DOMAIN must be set when SHOPIFY_ADMIN_TOKEN is configured");
if (process.env.NODE_ENV === "production" && SHOPIFY_STORE_DOMAIN && !SHOPIFY_STORE_DOMAIN.endsWith(".myshopify.com")) productionConfigErrors.push("SHOPIFY_STORE_DOMAIN must be the shop's .myshopify.com hostname");
if (process.env.NODE_ENV === "production" && RAW_SUPABASE_URL && !SUPABASE_URL) productionConfigErrors.push("SUPABASE_URL must be a valid supabase.co HTTPS origin (or explicitly allow a self-hosted origin)");
if (process.env.NODE_ENV === "production" && (!IG_GRAPH_BASE_URL || !MESSENGER_GRAPH_BASE_URL)) productionConfigErrors.push("Meta Graph API base URLs are invalid");
if (process.env.NODE_ENV === "production" && RAW_DATA_ENCRYPTION_KEY && !DATA_ENCRYPTION_KEY) productionConfigErrors.push("DATA_ENCRYPTION_KEY must be a base64url-encoded 32-byte key");
if (process.env.NODE_ENV === "production" && SUPABASE_ENABLED && !DATA_ENCRYPTION_KEY) productionConfigErrors.push("DATA_ENCRYPTION_KEY is required when Supabase persistence is enabled");
if (CUSTOMER_ACCESS_V2_ENABLED && !CUSTOMER_ACCESS_TEST_MODE && !SUPABASE_ENABLED) productionConfigErrors.push("SUPABASE_URL and SUPABASE_KEY are required when CUSTOMER_ACCESS_V2_ENABLED=1");
if (CUSTOMER_ACCESS_V2_ENABLED && !CUSTOMER_PANEL_BASE_URL) productionConfigErrors.push("CUSTOMER_PANEL_BASE_URL must be a valid HTTPS origin when CUSTOMER_ACCESS_V2_ENABLED=1");
if (CUSTOMER_ACCESS_V2_ENABLED && !CUSTOMER_ACCESS_TEST_MODE && CUSTOMER_ACCESS_EMAIL_PROVIDER !== "resend") productionConfigErrors.push("CUSTOMER_ACCESS_EMAIL_PROVIDER=resend is required when CUSTOMER_ACCESS_V2_ENABLED=1");
if (CUSTOMER_ACCESS_V2_ENABLED && !CUSTOMER_ACCESS_TEST_MODE && (!RESEND_API_KEY || !CUSTOMER_INVITE_FROM_EMAIL)) productionConfigErrors.push("RESEND_API_KEY and CUSTOMER_INVITE_FROM_EMAIL are required when CUSTOMER_ACCESS_V2_ENABLED=1");
if (CHANNEL_CONNECTIONS_V1_VISIBLE && !CUSTOMER_ACCESS_V2_ENABLED) productionConfigErrors.push("CUSTOMER_ACCESS_V2_ENABLED=1 is required when channel connections are visible");
if (CHANNEL_CONNECTIONS_V1_ENABLED && !CHANNEL_CONNECTIONS_TEST_MODE && !SUPABASE_ENABLED) productionConfigErrors.push("Supabase is required when CHANNEL_CONNECTIONS_V1_ENABLED=1");
if (CHANNEL_CONNECTIONS_V1_ENABLED && !DATA_ENCRYPTION_KEY) productionConfigErrors.push("DATA_ENCRYPTION_KEY is required when CHANNEL_CONNECTIONS_V1_ENABLED=1");
if (PAYMENTS_V1_ENABLED && !CUSTOMER_ACCESS_V2_ENABLED) productionConfigErrors.push("CUSTOMER_ACCESS_V2_ENABLED=1 is required when PAYMENTS_V1_ENABLED=1");
if (PAYMENTS_V1_ENABLED && PAYMENTS_ENV !== "staging") productionConfigErrors.push("PAYMENTS_ENV=staging is required for Payments v1");
if (PAYMENTS_V1_ENABLED && !PAYMENTS_TEST_MODE && !SUPABASE_ENABLED) productionConfigErrors.push("Supabase is required for Payments v1 outside test mode");
if (PAYMENTS_V1_ENABLED && !PUBLIC_BASE_URL) productionConfigErrors.push("PUBLIC_BASE_URL must be a valid HTTPS origin for Wompi checkout and webhook redirects");
if (PAYMENTS_V1_ENABLED && (!/^pub_test_/.test(WOMPI_PUBLIC_KEY) || !/^test_integrity_/.test(WOMPI_INTEGRITY_SECRET) || !/^test_events_/.test(WOMPI_EVENT_SECRET))) {
  productionConfigErrors.push("Wompi Sandbox public, integrity and event credentials are required for Payments v1");
}
if (PAYMENTS_V1_ENABLED && (!Number.isFinite(WOMPI_ESTIMATED_FEE_RATE) || WOMPI_ESTIMATED_FEE_RATE < 0 || WOMPI_ESTIMATED_FEE_RATE > 1)) {
  productionConfigErrors.push("WOMPI_ESTIMATED_FEE_RATE must be a decimal between 0 and 1");
}
if (PAYMENTS_V1_ENABLED && (!Number.isFinite(WOMPI_ESTIMATED_FIXED_FEE) || WOMPI_ESTIMATED_FIXED_FEE < 0)) {
  productionConfigErrors.push("WOMPI_ESTIMATED_FIXED_FEE must be a non-negative COP amount");
}
if (PAYMENTS_V1_ENABLED && (!Number.isFinite(WOMPI_ESTIMATED_FEE_TAX_RATE) || WOMPI_ESTIMATED_FEE_TAX_RATE < 0 || WOMPI_ESTIMATED_FEE_TAX_RATE > 1)) {
  productionConfigErrors.push("WOMPI_ESTIMATED_FEE_TAX_RATE must be a decimal between 0 and 1");
}
if (MULTIMODAL_CONFIG.enabled && (MULTIMODAL_CONFIG.voice_input_enabled || MULTIMODAL_CONFIG.image_input_enabled) && !OPENAI_API_KEY) productionConfigErrors.push("OPENAI_API_KEY is required when multimodal voice or image input is enabled");
if (MULTIMODAL_CONFIG.enabled && MULTIMODAL_CONFIG.voice_replies_enabled && !ELEVENLABS_API_KEY) productionConfigErrors.push("ELEVENLABS_API_KEY is required when multimodal voice replies are enabled");
if (productionConfigErrors.length) {
  console.error("Secure configuration failed:\n- " + productionConfigErrors.join("\n- "));
  process.exit(1);
}
if (process.env.NODE_ENV === "production" && !META_APP_SECRET) {
  console.warn("META_APP_SECRET is not configured; webhook signature enforcement remains in legacy compatibility mode");
}
if (!WA_TOKEN) { console.error("WA_TOKEN missing"); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY missing"); process.exit(1); }

const adminRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 600 });
const signatureRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 900 });
const wompiWebhookRateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 300 });
const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 12,
  keyGenerator: function (req) {
    const username = String(req.body && (req.body.email || req.body.username || (req.body.key ? "master-key" : "unknown")) || "unknown").trim().toLowerCase();
    return String(req.ip || req.socket && req.socket.remoteAddress || "unknown") + ":" + username;
  }
});
app.use("/admin", adminRateLimiter);
app.use("/signature", function protectSignatureCaching(req, res, next) {
  res.setHeader("cache-control", "no-store, max-age=0");
  res.setHeader("pragma", "no-cache");
  res.setHeader("x-robots-tag", "noindex, nofollow, noarchive");
  next();
});
app.use("/signature/api", signatureRateLimiter);
app.use("/admin", async function revalidateCustomerSession(req, res, next) {
  if (!CUSTOMER_ACCESS_V2_ENABLED) return next();
  const session = readDashboardSession(req);
  if (!session || session.version !== 2) return next();
  req.dashboardSessionChecked = true;
  try {
    const activeUser = await customerAccessService.validateSession(session);
    req.dashboardVerifiedSession = activeUser ? Object.assign({}, session, activeUser, { ok: true, version: 2, session_version: 2, method: "session" }) : null;
    return next();
  } catch (_) {
    res.status(503).json({ ok: false, error: "customer_access_unavailable" });
  }
});
app.use("/admin", function protectAdminStateChanges(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const auth = dashboardAuth(req);
  if (auth.ok && auth.method === "key") return next();
  if (!isSameOriginRequestFromAny(req, ADMIN_ALLOWED_BASE_URLS)) {
    res.status(403).json({ ok: false, error: "invalid_request_origin" });
    return;
  }
  next();
});

// ESTADO POR USUARIO
const conversations = new Map();
const humanHandoff = new Set();
const pendingRatings = new Set();
let lastCreditAlert = 0;  // timestamp del último aviso de saldo bajo (anti-spam)
const searchCache = new Map();  // {query: {result, ts}} — evita búsquedas duplicadas en <5min
const zeroResultAlerts = new Map();  // {query: timestamp} — anti-spam de alertas de 0 resultados
let turnZeroSearchActive = false;  // (v33.4) true cuando la búsqueda del turno dio 0 resultados — activa el blindaje en sendText

// Contador persistente (v33) — vive en memoria, se reinicia cuando Render duerme
const botStats = {
  startedAt: new Date().toISOString(),
  messages: { total: 0, today: 0, byDay: {} },
  uniqueUsers: new Set(),
  uniqueUsersToday: { date: '', set: new Set() },
  anthropic: {
    totalCalls: 0, failedCalls: 0, creditErrors: 0,
    inputTokens: 0, outputTokens: 0,
    cacheCreationTokens: 0, cacheReadTokens: 0,
    budgetTiers: { standard: 0, engaged: 0, high: 0 }
  }
};

// ─── LOGGER de conversaciones (Tarea 1) ───────────────────────────────
// Guarda en memoria las últimas 100 vueltas (turno = mensaje del cliente + respuesta del bot).
// Se expone en /admin/conversations. Persistencia permanente (Google Sheets) se suma después.
const conversationLogs = [];
const instagramProfileCache = new Map();
const customerMemoryCache = new Map();
const conversationLastActiveAt = new Map();
const serviceAreaChecks = new Map();
const processedMetaEventIds = new Set();
const inboundMessageWindows = new Map();
const instagramRuntimeState = {
  webhook_requests: 0,
  inbound_messages: 0,
  outbound_messages: 0,
  last_webhook_at: null,
  last_inbound_at: null,
  last_outbound_at: null,
  last_error_at: null,
  last_error_stage: null,
  last_handoff_auto_release_at: null,
  last_webhook_object: null,
  last_entry_shape: null,
  last_event_shape: null,
  last_skip_reason: null
};
let dashboardCustomerUserCache = { loaded_at: 0, user: null };
let botSetupCache = { loaded_at: 0, draft: null, published: null };
const clientOnboardingCacheByTenant = new Map();
let customerSetupQuestionnaireCache = { loaded_at: 0, questionnaire: null };
const retargetingMemoryEvents = new Map();
const retargetingEventCache = new Map();
const retargetingAppendLocks = new Map();
let turnTools = [];        // tools usadas en el turno actual
let turnZeroQueries = [];  // búsquedas con 0 resultados en el turno
let turnHandoff = false;   // si el turno derivó a humano (Eliana)
let turnRating = null;     // rating capturado en el turno

// ─── Persistencia en Supabase (v37) ───────────────────────────────────
const SB_HEADERS = { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" };
const customerAccessStore = CUSTOMER_ACCESS_V2_ENABLED
  ? (CUSTOMER_ACCESS_TEST_MODE
      ? new InMemoryCustomerAccessStore()
      : new SupabaseCustomerAccessStore({ url: SUPABASE_URL, headers: SB_HEADERS, axiosClient: axios }))
  : null;
if (CUSTOMER_ACCESS_TEST_MODE && process.env.CUSTOMER_ACCESS_TEST_USERS) {
  try {
    const fixtures = JSON.parse(process.env.CUSTOMER_ACCESS_TEST_USERS);
    if (!Array.isArray(fixtures)) throw new Error("fixtures_must_be_array");
    fixtures.forEach(function (fixture) {
      customerAccessStore.seedActiveUser(fixture);
      // Existing test customers represent returning users unless a fixture
      // explicitly asks to exercise first-login setup.
      if (fixture.setup_completed === false) return;
      const answers = defaultClientOnboarding();
      const email = String(fixture.email || "").trim().toLowerCase();
      answers.business.brand_name = String(fixture.company_name || fixture.tenant_id || "Empresa");
      answers.business.contact_email = email;
      answers.business.contact_phone = "+57 300 000 0000";
      answers.meta.whatsapp_number = "+57 300 000 0000";
      answers.operations.business_hours = "Lunes a viernes, 9:00 a.m. a 6:00 p.m.";
      answers.operations.services_products = "Productos y servicios de prueba";
      answers.operations.frequent_questions = "Preguntas frecuentes de prueba";
      answers.operations.important_policies = "Políticas de prueba";
      answers.operations.bot_instructions = "Responder con claridad y escalar cuando corresponda.";
      answers.team.admin_email = email;
      answers.team.human_support_contact = email;
      const record = createOnboardingRecord(answers, {
        tenant_id: fixture.tenant_id,
        status: "completed",
        updated_by: email
      });
      clientOnboardingCacheByTenant.set(cleanTenantId(fixture.tenant_id), { loaded_at: Date.now(), record });
    });
  } catch (_) {
    throw new Error("CUSTOMER_ACCESS_TEST_USERS must be a valid fixture array");
  }
}
if (CUSTOMER_ACCESS_TEST_MODE && process.env.CUSTOMER_ACCESS_TEST_INVITATIONS) {
  try {
    const fixtures = JSON.parse(process.env.CUSTOMER_ACCESS_TEST_INVITATIONS);
    if (!Array.isArray(fixtures)) throw new Error("fixtures_must_be_array");
    fixtures.forEach(function (fixture) { customerAccessStore.seedInvitation(fixture); });
  } catch (_) {
    throw new Error("CUSTOMER_ACCESS_TEST_INVITATIONS must be a valid fixture array");
  }
}
const customerAccessEmailSender = CUSTOMER_ACCESS_V2_ENABLED
  ? (CUSTOMER_ACCESS_TEST_MODE
      ? createMemoryEmailSender()
      : createResendEmailSender({ apiKey: RESEND_API_KEY, from: CUSTOMER_INVITE_FROM_EMAIL, replyTo: CUSTOMER_INVITE_REPLY_TO, axiosClient: axios }))
  : null;
const customerAccessService = CUSTOMER_ACCESS_V2_ENABLED
  ? createCustomerAccessService({
      store: customerAccessStore,
      emailSender: customerAccessEmailSender,
      baseUrl: CUSTOMER_PANEL_BASE_URL,
      fallbackBaseUrls: CUSTOMER_PANEL_FALLBACK_BASE_URLS,
      inviteTtlHours: CUSTOMER_INVITE_TTL_HOURS
    })
  : null;
const channelConnectionsPreviewOnly = CHANNEL_CONNECTIONS_V1_VISIBLE && !CHANNEL_CONNECTIONS_V1_ENABLED;
const channelConnectionStore = CHANNEL_CONNECTIONS_V1_VISIBLE
  ? (CHANNEL_CONNECTIONS_TEST_MODE || channelConnectionsPreviewOnly
      ? new InMemoryChannelConnectionStore()
      : new SupabaseChannelConnectionStore({ url: SUPABASE_URL, headers: SB_HEADERS, axiosClient: axios }))
  : null;
const channelConnectionProvider = CHANNEL_CONNECTIONS_V1_VISIBLE
  ? new MetaChannelProvider({
      appId: META_APP_ID,
      appSecret: META_APP_SECRET,
      whatsappConfigId: META_WHATSAPP_CONFIG_ID,
      graphVersion: META_GRAPH_VERSION,
      redirectUri: CHANNEL_CONNECTION_CALLBACK_URL,
      axiosClient: axios
    })
  : null;
const protectedLegacyChannelConnections = createLegacyConnections({
  tenantId: DEFAULT_TENANT_ID,
  whatsapp: {
    configured: !!(WA_TOKEN && PHONE_NUMBER_ID),
    phoneNumberId: PHONE_NUMBER_ID,
    displayPhone: process.env.TENANT_DISPLAY_PHONE || "",
    webhookStatus: VERIFY_TOKEN ? "configured" : "needs_attention"
  },
  instagram: {
    configured: !!(IG_ACCESS_TOKEN && IG_USER_ID && IG_SEND_ID),
    userId: IG_USER_ID,
    label: process.env.IG_USERNAME || "",
    webhookStatus: IG_VERIFY_TOKEN ? "configured" : "needs_attention"
  },
  messenger: {
    configured: !!(MESSENGER_PAGE_ACCESS_TOKEN && MESSENGER_PAGE_ID),
    pageId: MESSENGER_PAGE_ID,
    label: process.env.MESSENGER_PAGE_NAME || "",
    webhookStatus: MESSENGER_VERIFY_TOKEN ? "configured" : "needs_attention"
  }
});
const channelConnectionService = CHANNEL_CONNECTIONS_V1_VISIBLE
  ? createChannelConnectionService({
      store: channelConnectionStore,
      provider: channelConnectionProvider,
      encryptionKey: DATA_ENCRYPTION_KEY,
      legacyConnections: protectedLegacyChannelConnections
    })
  : null;
const usedChannelOAuthNonces = new Set();
// Catálogo editable de planes y bots. Comparte el gate de customer access v2.
const catalogStore = CUSTOMER_ACCESS_V2_ENABLED
  ? (CUSTOMER_ACCESS_TEST_MODE
      ? new InMemoryCatalogStore({ accessStore: customerAccessStore })
      : new SupabaseCatalogStore({ url: SUPABASE_URL, headers: SB_HEADERS, axiosClient: axios }))
  : null;
const catalogService = CUSTOMER_ACCESS_V2_ENABLED ? createCatalogService({ store: catalogStore }) : null;
const paymentStore = PAYMENTS_V1_ENABLED
  ? (PAYMENTS_TEST_MODE
      ? new InMemoryPaymentStore()
      : new SupabasePaymentStore({ url: SUPABASE_URL, headers: SB_HEADERS, axiosClient: axios }))
  : null;
const paymentService = PAYMENTS_V1_ENABLED ? createPaymentService({
  store: paymentStore,
  catalogService,
  publicKey: WOMPI_PUBLIC_KEY,
  integritySecret: WOMPI_INTEGRITY_SECRET,
  eventSecret: WOMPI_EVENT_SECRET,
  estimatedFeeRate: WOMPI_ESTIMATED_FEE_RATE,
  estimatedFixedFee: WOMPI_ESTIMATED_FIXED_FEE,
  estimatedTaxRate: WOMPI_ESTIMATED_FEE_TAX_RATE,
  publicBaseUrl: PUBLIC_BASE_URL
}) : null;

async function syncNextforPricingJuly2026() {
  if (!NEXTFOR_PRICING_SYNC_ON_BOOT || CUSTOMER_ACCESS_TEST_MODE || !CUSTOMER_ACCESS_V2_ENABLED || !SUPABASE_ENABLED) return;
  const rest = SUPABASE_URL + "/rest/v1/";
  const upsertHeaders = Object.assign({ Prefer: "resolution=merge-duplicates,return=minimal" }, SB_HEADERS);
  const patchHeaders = Object.assign({ Prefer: "return=minimal" }, SB_HEADERS);
  const bots = [
    { id: "atencion-cliente", name: "Atención al cliente", descripcion: "Atiende, orienta, responde preguntas y escala casos a humanos.", orden: 1, active: true, updated_at: new Date().toISOString() },
    { id: "agendamiento", name: "Agendamiento", descripcion: "Agenda, confirma, reprograma y recuerda citas o reservas.", orden: 2, active: true, updated_at: new Date().toISOString() },
    { id: "commerce", name: "Commerce", descripcion: "Consulta productos, precios, disponibilidad y pedidos cuando aplique.", orden: 3, active: true, updated_at: new Date().toISOString() }
  ];
  const plans = NEXTFOR_PRICING_JULY_2026.map(function (plan) {
    return {
      id: plan.id,
      name: plan.nombre,
      descripcion: plan.descripcion,
      bot_id: plan.bot_id,
      precio_setup: 0,
      precio_mensual: plan.precio_mensual,
      chats_incluidos: plan.chats_incluidos,
      beneficios: plan.beneficios,
      etiqueta: plan.etiqueta,
      orden: plan.orden,
      active: true,
      updated_at: new Date().toISOString()
    };
  });
  try {
    await axios.post(rest + "platform_bots?on_conflict=id", bots, { headers: upsertHeaders, timeout: 10000 });
    await axios.post(rest + "platform_plans?on_conflict=id", plans, { headers: upsertHeaders, timeout: 10000 });
    await axios.patch(rest + "platform_plans?id=in.(starter,growth,scale)", { active: false, precio_setup: 0, updated_at: new Date().toISOString() }, { headers: patchHeaders, timeout: 10000 });
    await axios.patch(rest + "tenants", { precio_setup_contratado: 0 }, { params: { precio_setup_contratado: "not.is.null" }, headers: patchHeaders, timeout: 10000 });
    try {
      await axios.patch(rest + "billing_contracts", { contracted_setup_price: 0, updated_at: new Date().toISOString() }, { params: { contracted_setup_price: "gt.0" }, headers: patchHeaders, timeout: 10000 });
    } catch (billingError) {
      const status = billingError && billingError.response && billingError.response.status;
      if (status && status !== 404) throw billingError;
    }
    console.log("Nextfor pricing July 2026 synced");
  } catch (error) {
    console.error("Nextfor pricing sync failed:", error.response && error.response.data || error.message);
  }
}
async function persistAppointment(row) {
  if (!SUPABASE_APPOINTMENTS_ENABLED) return false;
  const payload = {
    tenant_id: row.tenant_id,
    conversation_id: row.conversation_id,
    agent_id: row.agent_id || null,
    status: row.status,
    starts_at: row.starts_at,
    payload: encryptStoredText(JSON.stringify(row), DATA_ENCRYPTION_KEY),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
  await axios.post(
    SUPABASE_URL + "/rest/v1/" + SUPABASE_APPOINTMENTS_TABLE + "?on_conflict=tenant_id,conversation_id",
    payload,
    { headers: Object.assign({ Prefer: "resolution=merge-duplicates,return=minimal" }, SB_HEADERS), timeout: 8000 }
  );
  return true;
}

async function hydrateAppointmentsForTenant(tenantId) {
  if (!SUPABASE_APPOINTMENTS_ENABLED) return false;
  try {
    const response = await axios.get(SUPABASE_URL + "/rest/v1/" + SUPABASE_APPOINTMENTS_TABLE, {
      params: { select: "*", tenant_id: "eq." + tenantId, order: "updated_at.desc", limit: 500 },
      headers: SB_HEADERS,
      timeout: 8000
    });
    const rows = (response.data || []).map(function (stored) {
      try { return JSON.parse(decryptStoredText(stored.payload, DATA_ENCRYPTION_KEY)); }
      catch (_) { return null; }
    }).filter(Boolean);
    appointmentRegistry.hydrate(rows);
    return true;
  } catch (error) {
    console.error("hydrateAppointmentsForTenant error:", error.message);
    return false;
  }
}

async function supabaseInsert(rec) {
  if (!SUPABASE_ENABLED) return;
  try {
    const payload = {
      ts: rec.ts, user_id: rec.userId, user_message: encryptStoredText(rec.userMessage, DATA_ENCRYPTION_KEY), bot_reply: encryptStoredText(rec.botReply, DATA_ENCRYPTION_KEY),
      tools: rec.tools, zero_result_queries: rec.zeroResultQueries, handoff: rec.handoff,
      rating: rec.rating, num_tools: rec.numTools, status: rec.status
    };
    if (SUPABASE_TENANT_COLUMNS_ENABLED) {
      payload.tenant_id = rec.tenantId || DEFAULT_TENANT_ID;
      payload.phone_number_id = rec.phoneNumberId || PHONE_NUMBER_ID || null;
      payload.channel = rec.channel || conversationChannel(rec.userId);
    }
    if (rec.eval !== undefined) payload.eval = rec.eval;
    await axios.post(SUPABASE_URL + "/rest/v1/" + SUPABASE_TABLE, payload, { headers: Object.assign({ Prefer: "return=minimal" }, SB_HEADERS), timeout: 8000 });
  } catch (e) { console.error("supabaseInsert error:", e.response ? JSON.stringify(e.response.data).slice(0,200) : e.message); }
}
async function supabaseInsertStrict(rec) {
  if (!SUPABASE_ENABLED) throw new Error("supabase_not_configured");
  const payload = {
    ts: rec.ts, user_id: rec.userId, user_message: encryptStoredText(rec.userMessage, DATA_ENCRYPTION_KEY), bot_reply: encryptStoredText(rec.botReply, DATA_ENCRYPTION_KEY),
    tools: rec.tools, zero_result_queries: rec.zeroResultQueries, handoff: rec.handoff,
    rating: rec.rating, num_tools: rec.numTools, status: rec.status
  };
  if (SUPABASE_TENANT_COLUMNS_ENABLED) {
    payload.tenant_id = rec.tenantId || DEFAULT_TENANT_ID;
    payload.phone_number_id = rec.phoneNumberId || PHONE_NUMBER_ID || null;
    payload.channel = rec.channel || conversationChannel(rec.userId);
  }
  if (rec.eval !== undefined) payload.eval = rec.eval;
  await axios.post(SUPABASE_URL + "/rest/v1/" + SUPABASE_TABLE, payload, {
    headers: Object.assign({ Prefer: "return=minimal" }, SB_HEADERS),
    timeout: 8000
  });
}
async function supabaseFetchRecent(limit) {
  if (!SUPABASE_ENABLED) return null;
  try {
    const tenantFilter = SUPABASE_TENANT_COLUMNS_ENABLED ? "&tenant_id=eq." + encodeURIComponent(DEFAULT_TENANT_ID) : "";
    const r = await axios.get(SUPABASE_URL + "/rest/v1/" + SUPABASE_TABLE + "?select=*" + tenantFilter + "&order=ts.desc&limit=" + limit, { headers: SB_HEADERS, timeout: 8000 });
    return r.data;
  } catch (e) { console.error("supabaseFetchRecent error:", e.message); return null; }
}
async function supabaseFetchUserRecent(userId, limit, tenantId) {
  if (!SUPABASE_ENABLED) return null;
  try {
    const tenantFilter = SUPABASE_TENANT_COLUMNS_ENABLED ? "&tenant_id=eq." + encodeURIComponent(cleanTenantId(tenantId) || DEFAULT_TENANT_ID) : "";
    const url = SUPABASE_URL + "/rest/v1/" + SUPABASE_TABLE + "?select=*&user_id=eq." + encodeURIComponent(userId) + tenantFilter + "&order=ts.desc&limit=" + (limit || 20);
    const r = await axios.get(url, { headers: SB_HEADERS, timeout: 8000 });
    return r.data;
  } catch (e) { console.error("supabaseFetchUserRecent error:", e.message); return null; }
}
async function supabaseFetchUserToolRecent(userId, toolName, limit) {
  if (!SUPABASE_ENABLED) return null;
  try {
    const url = SUPABASE_URL + "/rest/v1/" + SUPABASE_TABLE;
    const r = await axios.get(url, {
      params: {
        select: "*",
        user_id: "eq." + userId,
        ...(SUPABASE_TENANT_COLUMNS_ENABLED ? { tenant_id: "eq." + DEFAULT_TENANT_ID } : {}),
        tools: "cs." + JSON.stringify([toolName]),
        order: "ts.desc",
        limit: limit || 1
      },
      headers: SB_HEADERS,
      timeout: 8000
    });
    return r.data;
  } catch (e) { console.error("supabaseFetchUserToolRecent error:", e.message); return null; }
}
async function supabaseFetchToolRecent(toolName, limit) {
  if (!SUPABASE_ENABLED) return null;
  try {
    const url = SUPABASE_URL + "/rest/v1/" + SUPABASE_TABLE;
    const r = await axios.get(url, {
      params: {
        select: "*",
        tools: "cs." + JSON.stringify([toolName]),
        order: "ts.desc",
        limit: limit || 100
      },
      headers: SB_HEADERS,
      timeout: 8000
    });
    return r.data;
  } catch (e) { console.error("supabaseFetchToolRecent error:", e.message); return null; }
}
async function supabaseFetchPending(limit) {
  if (!SUPABASE_ENABLED) return null;
  try {
    const tenantFilter = SUPABASE_TENANT_COLUMNS_ENABLED ? "&tenant_id=eq." + encodeURIComponent(DEFAULT_TENANT_ID) : "";
    const r = await axios.get(SUPABASE_URL + "/rest/v1/" + SUPABASE_TABLE + "?select=*&eval=is.null" + tenantFilter + "&order=ts.desc&limit=" + limit, { headers: SB_HEADERS, timeout: 8000 });
    return r.data;
  } catch (e) { console.error("supabaseFetchPending error:", e.message); return null; }
}
async function supabaseUpdateEval(id, ev) {
  if (!SUPABASE_ENABLED) return;
  try {
    await axios.patch(SUPABASE_URL + "/rest/v1/" + SUPABASE_TABLE + "?id=eq." + id, { eval: ev }, { headers: Object.assign({ Prefer: "return=minimal" }, SB_HEADERS), timeout: 8000 });
  } catch (e) { console.error("supabaseUpdateEval error:", e.message); }
}

function normalizeTurnRow(r) {
  let userMessage = "";
  let botReply = "";
  try {
    userMessage = decryptStoredText(r.user_message, DATA_ENCRYPTION_KEY);
    botReply = decryptStoredText(r.bot_reply, DATA_ENCRYPTION_KEY);
  } catch (error) {
    log("error", "stored_data_decryption_failed", { error: error.message });
    userMessage = "[encrypted data unavailable]";
    botReply = "[encrypted data unavailable]";
  }
  return {
    ts: r.ts,
    tenantId: r.tenant_id || DEFAULT_TENANT_ID,
    phoneNumberId: r.phone_number_id || null,
    channel: r.channel || conversationChannel(r.user_id),
    userId: r.user_id,
    userMessage,
    botReply,
    tools: Array.isArray(r.tools) ? r.tools : [],
    zeroResultQueries: Array.isArray(r.zero_result_queries) ? r.zero_result_queries : [],
    handoff: !!r.handoff,
    rating: r.rating,
    numTools: r.num_tools,
    status: r.status,
    eval: r.eval || undefined,
    _id: r.id
  };
}

const signatureEvents = new EventEmitter();
signatureEvents.setMaxListeners(200);

function signaturePayloadFromTurn(turn) {
  const tools = Array.isArray(turn && turn.tools) ? turn.tools : [];
  if (!tools.includes(SIGNATURE_TOOL)) return null;
  const raw = String(turn.botReply || "").replace(/^\[NextforSignature\]\s*/, "");
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

const signatureStore = {
  async append(userId, payload) {
    const rec = {
      ts: payload.saved_at || new Date().toISOString(),
      userId,
      tenantId: DEFAULT_TENANT_ID,
      userMessage: "",
      botReply: "[NextforSignature] " + JSON.stringify(payload),
      tools: [SIGNATURE_TOOL],
      zeroResultQueries: [],
      handoff: false,
      rating: null,
      numTools: 1,
      status: "ok",
      eval: { skip: true, reason: SIGNATURE_TOOL }
    };
    if (SUPABASE_ENABLED) await supabaseInsertStrict(rec);
    conversationLogs.push(rec);
    if (conversationLogs.length > 300) conversationLogs.shift();
  },
  async latest(userId) {
    if (SUPABASE_ENABLED) {
      const rows = await supabaseFetchUserRecent(userId, 1);
      if (rows === null) throw new Error("signature_store_unavailable");
      const turn = rows.map(normalizeTurnRow).map(signaturePayloadFromTurn).find(Boolean);
      return turn || null;
    }
    return conversationLogs.slice().reverse().filter(function (turn) {
      return turn.userId === userId;
    }).map(signaturePayloadFromTurn).find(Boolean) || null;
  }
};

const signatureService = createSignatureService({
  store: signatureStore,
  persistent: SUPABASE_ENABLED || process.env.NODE_ENV === "test",
  onUpdate: function (event) {
    signatureEvents.emit("signature", event);
  }
});

const SIGNATURE_STORAGE_BUCKET = "nextfor-signature-private";
let signatureBucketReady = null;

function encryptSignatureFile(buffer) {
  if (!DATA_ENCRYPTION_KEY) throw new Error("signature_encryption_unavailable");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", DATA_ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([Buffer.from("NXFS1"), iv, cipher.getAuthTag(), encrypted]);
}

function decryptSignatureFile(buffer) {
  if (!DATA_ENCRYPTION_KEY || !Buffer.isBuffer(buffer) || buffer.length < 34 || buffer.subarray(0, 5).toString() !== "NXFS1") {
    throw new Error("signature_file_invalid");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", DATA_ENCRYPTION_KEY, buffer.subarray(5, 17));
  decipher.setAuthTag(buffer.subarray(17, 33));
  return Buffer.concat([decipher.update(buffer.subarray(33)), decipher.final()]);
}

async function ensureSignatureStorageBucket() {
  if (!SUPABASE_ENABLED) throw new Error("signature_storage_unavailable");
  if (signatureBucketReady) return signatureBucketReady;
  signatureBucketReady = axios.post(SUPABASE_URL + "/storage/v1/bucket", {
    id: SIGNATURE_STORAGE_BUCKET,
    name: SIGNATURE_STORAGE_BUCKET,
    public: false,
    file_size_limit: 12 * 1024 * 1024,
    allowed_mime_types: null
  }, { headers: SB_HEADERS, timeout: 8000 }).catch(function (error) {
    const status = error && error.response && error.response.status;
    const detail = JSON.stringify(error && error.response && error.response.data || "").toLowerCase();
    if (status === 409 || detail.includes("already exists") || detail.includes("duplicate")) return true;
    signatureBucketReady = null;
    throw error;
  });
  return signatureBucketReady;
}

function signatureStorageUrl(objectKey) {
  return SUPABASE_URL + "/storage/v1/object/" + SIGNATURE_STORAGE_BUCKET + "/" + objectKey.split("/").map(encodeURIComponent).join("/");
}

function retargetingRecordId(tenantId) {
  return RETARGETING_EVENT_RECORD_PREFIX + String(tenantId || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function parseRetargetingEventTurn(turn) {
  const tools = Array.isArray(turn && turn.tools) ? turn.tools : [];
  if (!tools.includes(RETARGETING_EVENT_TOOL)) return null;
  const raw = String(turn.botReply || "").replace(/^\[RetargetingEvent\]\s*/, "");
  try {
    const event = JSON.parse(raw);
    if (event.version !== 1 || !event.id || !event.tenant_id || !event.type) return null;
    return event;
  } catch (_) {
    return null;
  }
}

const retargetingStore = {
  async list(tenantId) {
    if (process.env.NODE_ENV === "production" && !SUPABASE_ENABLED) throw new Error("retargeting_persistent_store_required");
    const cleanTenant = String(tenantId || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const cached = retargetingEventCache.get(cleanTenant);
    if (cached && Date.now() - cached.loaded_at < 5000) return cached.events.slice();
    let events = (retargetingMemoryEvents.get(cleanTenant) || []).slice();
    if (SUPABASE_ENABLED) {
      const rows = await supabaseFetchUserRecent(retargetingRecordId(cleanTenant), 2000);
      if (rows) events = rows.map(normalizeTurnRow).map(parseRetargetingEventTurn).filter(Boolean).reverse();
    }
    retargetingEventCache.set(cleanTenant, { loaded_at: Date.now(), events: events.slice() });
    return events;
  },
  async append(event) {
    const tenantId = event.tenant_id;
    const previous = retargetingAppendLocks.get(tenantId) || Promise.resolve();
    const operation = previous.catch(function () {}).then(async () => {
      const existing = await this.list(tenantId);
      if (existing.some(function (row) { return row.id === event.id; })) return event;
      const rec = {
        ts: event.created_at,
        userId: retargetingRecordId(tenantId),
        userMessage: "",
        botReply: "[RetargetingEvent] " + JSON.stringify(event),
        tools: [RETARGETING_EVENT_TOOL],
        zeroResultQueries: [],
        handoff: false,
        rating: null,
        numTools: 1,
        status: "ok",
        eval: { skip: true, reason: RETARGETING_EVENT_TOOL }
      };
      if (SUPABASE_ENABLED) await supabaseInsertStrict(rec);
      const memory = retargetingMemoryEvents.get(tenantId) || [];
      memory.push(event);
      retargetingMemoryEvents.set(tenantId, memory.slice(-5000));
      const next = existing.concat([event]);
      retargetingEventCache.set(tenantId, { loaded_at: Date.now(), events: next });
      return event;
    });
    retargetingAppendLocks.set(tenantId, operation);
    try {
      return await operation;
    } finally {
      if (retargetingAppendLocks.get(tenantId) === operation) retargetingAppendLocks.delete(tenantId);
    }
  }
};

const retargetingEngine = new RetargetingEngine({ store: retargetingStore });

function isCustomerMetaTurn(turn) {
  const tools = Array.isArray(turn && turn.tools) ? turn.tools : [];
  return tools.includes(CUSTOMER_META_TOOL);
}

function isDashboardCustomerUserTurn(turn) {
  const tools = Array.isArray(turn && turn.tools) ? turn.tools : [];
  return tools.includes(DASHBOARD_CUSTOMER_USER_TOOL);
}

function isBotSetupTurn(turn) {
  const tools = Array.isArray(turn && turn.tools) ? turn.tools : [];
  return tools.includes(BOT_SETUP_TOOL);
}

function isClientOnboardingTurn(turn) {
  const tools = Array.isArray(turn && turn.tools) ? turn.tools : [];
  return tools.includes(CLIENT_ONBOARDING_TOOL);
}

function isCustomerSetupQuestionnaireTurn(turn) {
  const tools = Array.isArray(turn && turn.tools) ? turn.tools : [];
  return tools.includes(CUSTOMER_SETUP_QUESTIONNAIRE_TOOL);
}

function isRetargetingEventTurn(turn) {
  const tools = Array.isArray(turn && turn.tools) ? turn.tools : [];
  return tools.includes(RETARGETING_EVENT_TOOL);
}

function isInstagramProfileTurn(turn) {
  const tools = Array.isArray(turn && turn.tools) ? turn.tools : [];
  return tools.includes(INSTAGRAM_PROFILE_TOOL);
}

function isCustomerMemoryTurn(turn) {
  const tools = Array.isArray(turn && turn.tools) ? turn.tools : [];
  return tools.includes(CUSTOMER_MEMORY_TOOL);
}

function isInternalAdminTurn(turn) {
  return isCustomerMetaTurn(turn) || isDashboardCustomerUserTurn(turn) || isBotSetupTurn(turn) || isClientOnboardingTurn(turn) || isRetargetingEventTurn(turn) || isInstagramProfileTurn(turn) || isCustomerMemoryTurn(turn);
}

function normalizeCustomerTags(tags) {
  const allowed = new Set(CUSTOMER_META_TAGS.map(t => t.id));
  const out = [];
  (Array.isArray(tags) ? tags : []).forEach(function (tag) {
    const id = String(tag || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (allowed.has(id) && !out.includes(id)) out.push(id);
  });
  return out.slice(0, 8);
}

function normalizeCustomerNote(note) {
  return String(note || "").replace(/\s+\n/g, "\n").trim().slice(0, 1200);
}

function normalizeConversationUserId(value) {
  const raw = String(value || "").trim();
  const instagram = /^ig:/i.test(raw);
  const messenger = /^ms:/i.test(raw);
  const externalId = raw.replace(/^(ig|ms|wa):/i, "").replace(/\D/g, "");
  if (!externalId) return "";
  if (instagram) return "ig:" + externalId;
  if (messenger) return "ms:" + externalId;
  return externalId;
}

function conversationChannel(value) {
  const userId = String(value || "");
  if (/^ig:/i.test(userId)) return "instagram";
  if (/^ms:/i.test(userId)) return "messenger";
  return "whatsapp";
}

function conversationExternalId(value) {
  return normalizeConversationUserId(value).replace(/^(ig|ms):/, "");
}

function serviceAreaConfigForSetup(setup, onboarding) {
  const presence = setup && setup.published && setup.published.answers && setup.published.answers.presence || {};
  const onboardingReady = onboarding && ["submitted", "in_review", "ready"].includes(onboarding.status);
  const onboardingOperations = onboardingReady && onboarding.answers && onboarding.answers.operations || {};
  return {
    enabled: onboardingOperations.foreign_number_location_check === undefined
      ? (presence.foreign_number_check_enabled === undefined
        ? TENANT_CONFIG.foreignNumberCheckEnabled
        : presence.foreign_number_check_enabled !== false)
      : onboardingOperations.foreign_number_location_check !== false,
    countryCode: presence.service_country_code || TENANT_CONFIG.serviceCountryCode,
    countryName: presence.service_country_name || TENANT_CONFIG.serviceCountryName
  };
}

function rememberServiceAreaCheck(userId, state) {
  serviceAreaChecks.set(userId, state);
  if (serviceAreaChecks.size <= 10000) return;
  const oldest = serviceAreaChecks.keys().next().value;
  if (oldest) serviceAreaChecks.delete(oldest);
}

function maskedIdentifier(value) {
  const normalized = normalizeConversationUserId(value);
  const prefix = normalized.startsWith("ig:") ? "ig:" : normalized.startsWith("ms:") ? "ms:" : "wa:";
  const external = normalized.replace(/^(ig|ms):/, "");
  return external ? prefix + "***" + external.slice(-4) : prefix + "unknown";
}

function validMetaWebhookSignature(req) {
  return validMetaSignature(
    req.rawBody,
    req.get("x-hub-signature-256"),
    META_APP_SECRET,
    ALLOW_UNSIGNED_WEBHOOKS || !META_APP_SECRET
  );
}

function acceptMessengerEvent(event) {
  const messageId = String(event?.message?.mid || event?.postback?.mid || "");
  return acceptMetaEventId(messageId);
}

function acceptMetaEventId(messageId) {
  messageId = String(messageId || "");
  if (!messageId) return false;
  if (processedMetaEventIds.has(messageId)) return false;
  processedMetaEventIds.add(messageId);
  if (processedMetaEventIds.size > 1000) {
    processedMetaEventIds.delete(processedMetaEventIds.values().next().value);
  }
  return true;
}

function parseCustomerMetaTurn(turn) {
  if (!isCustomerMetaTurn(turn)) return null;
  const raw = String(turn.botReply || "").replace(/^\[Meta\]\s*/, "");
  try {
    const parsed = JSON.parse(raw);
    return {
      tags: normalizeCustomerTags(parsed.tags),
      note: normalizeCustomerNote(parsed.note),
      updated_at: turn.ts || null
    };
  } catch (e) {
    return null;
  }
}

function customerMetaFromTurns(turns) {
  const meta = {};
  (turns || []).slice().sort(function (a, b) {
    return new Date(a.ts || 0) - new Date(b.ts || 0);
  }).forEach(function (turn) {
    const userId = normalizeConversationUserId(turn.userId);
    if (!userId) return;
    const parsed = parseCustomerMetaTurn(turn);
    if (parsed) meta[userId] = parsed;
  });
  return meta;
}

function parseCustomerMemoryTurn(turn) {
  if (!isCustomerMemoryTurn(turn)) return null;
  const userId = normalizeConversationUserId(turn.userId);
  if (!userId) return null;
  const raw = String(turn.botReply || "").replace(/^\[CustomerMemory\]\s*/, "");
  try {
    const memory = normalizeMemory(JSON.parse(raw));
    return isMeaningfulMemory(memory) ? { user_id: userId, memory } : null;
  } catch (_) {
    return null;
  }
}

function customerMemoriesFromTurns(turns) {
  const memories = {};
  (turns || []).slice().sort(function (a, b) {
    return new Date(a.ts || 0) - new Date(b.ts || 0);
  }).forEach(function (turn) {
    const parsed = parseCustomerMemoryTurn(turn);
    if (parsed) memories[parsed.user_id] = parsed.memory;
  });
  return memories;
}

function recordCustomerMemory(userId, memory) {
  const cleanUserId = normalizeConversationUserId(userId);
  const normalized = normalizeMemory(memory);
  if (!cleanUserId || !isMeaningfulMemory(normalized)) return null;
  const rec = {
    ts: new Date().toISOString(),
    userId: cleanUserId,
    userMessage: "",
    botReply: "[CustomerMemory] " + JSON.stringify(normalized),
    tools: [CUSTOMER_MEMORY_TOOL],
    zeroResultQueries: [],
    handoff: false,
    rating: null,
    numTools: 1,
    status: "ok",
    eval: { skip: true, reason: CUSTOMER_MEMORY_TOOL }
  };
  customerMemoryCache.set(cleanUserId, { memory: normalized, loaded_at: Date.now() });
  conversationLogs.push(rec);
  if (conversationLogs.length > 100) conversationLogs.shift();
  supabaseInsert(rec);
  return normalized;
}

async function loadCustomerMemory(userId) {
  const cleanUserId = normalizeConversationUserId(userId);
  if (!cleanUserId) return null;
  const cached = customerMemoryCache.get(cleanUserId);
  if (cached && Date.now() - cached.loaded_at < CUSTOMER_MEMORY_CACHE_TTL_MS) return cached.memory;

  let turns = conversationLogs.filter(function (turn) { return normalizeConversationUserId(turn.userId) === cleanUserId; });
  if (SUPABASE_ENABLED) {
    const memoryRows = await supabaseFetchUserToolRecent(cleanUserId, CUSTOMER_MEMORY_TOOL, 1);
    if (memoryRows && memoryRows.length) turns = memoryRows.map(normalizeTurnRow);
    else {
      const rows = await supabaseFetchUserRecent(cleanUserId, 60);
      if (rows) turns = rows.map(normalizeTurnRow);
    }
  }
  const memory = customerMemoriesFromTurns(turns)[cleanUserId] || null;
  customerMemoryCache.set(cleanUserId, { memory, loaded_at: Date.now() });
  return memory;
}

function evolveAndPersistCustomerMemory(userId, currentMemory, event) {
  const evolved = evolveCustomerMemory(currentMemory, event);
  if (!evolved.changed || !isMeaningfulMemory(evolved.memory)) return currentMemory || null;
  if (memoryFingerprint(evolved.memory) === memoryFingerprint(currentMemory)) return currentMemory || null;
  return recordCustomerMemory(userId, evolved.memory) || evolved.memory;
}

function normalizeInstagramUsername(username) {
  return String(username || "").trim().replace(/^@+/, "").slice(0, 64);
}

function parseInstagramProfileTurn(turn) {
  if (!isInstagramProfileTurn(turn)) return null;
  const userId = normalizeConversationUserId(turn.userId);
  if (conversationChannel(userId) !== "instagram") return null;
  const raw = String(turn.botReply || "").replace(/^\[InstagramProfile\]\s*/, "");
  try {
    const parsed = JSON.parse(raw);
    const username = normalizeInstagramUsername(parsed.username);
    if (!username) return null;
    return { user_id: userId, username, updated_at: turn.ts || null };
  } catch (_) {
    return null;
  }
}

function instagramProfilesFromTurns(turns) {
  const profiles = {};
  (turns || []).slice().sort(function (a, b) {
    return new Date(a.ts || 0) - new Date(b.ts || 0);
  }).forEach(function (turn) {
    const profile = parseInstagramProfileTurn(turn);
    if (profile) profiles[profile.user_id] = profile;
  });
  return profiles;
}

function recordInstagramProfile(userId, username) {
  const cleanUserId = normalizeConversationUserId(userId);
  const cleanUsername = normalizeInstagramUsername(username);
  if (conversationChannel(cleanUserId) !== "instagram" || !cleanUsername) return null;
  const rec = {
    ts: new Date().toISOString(),
    userId: cleanUserId,
    userMessage: "",
    botReply: "[InstagramProfile] " + JSON.stringify({ username: cleanUsername }),
    tools: [INSTAGRAM_PROFILE_TOOL],
    zeroResultQueries: [],
    handoff: false,
    rating: null,
    numTools: 1,
    status: "ok",
    eval: { skip: true, reason: INSTAGRAM_PROFILE_TOOL }
  };
  instagramProfileCache.set(cleanUserId, { username: cleanUsername, fetched_at: Date.now() });
  conversationLogs.push(rec);
  if (conversationLogs.length > 100) conversationLogs.shift();
  supabaseInsert(rec);
  return parseInstagramProfileTurn(rec);
}

async function refreshInstagramProfile(userId) {
  const cleanUserId = normalizeConversationUserId(userId);
  if (conversationChannel(cleanUserId) !== "instagram" || !IG_ACCESS_TOKEN) return null;
  const cached = instagramProfileCache.get(cleanUserId);
  const cacheTtl = cached && cached.username ? INSTAGRAM_PROFILE_TTL_MS : INSTAGRAM_PROFILE_RETRY_MS;
  if (cached && Date.now() - cached.fetched_at < cacheTtl) return cached.username ? cached : null;
  instagramProfileCache.set(cleanUserId, { username: "", fetched_at: Date.now() });
  try {
    const instagramScopedId = conversationExternalId(cleanUserId);
    const response = await axios.get(`${IG_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(instagramScopedId)}`, {
      params: { fields: "id,username" },
      headers: { Authorization: `Bearer ${IG_ACCESS_TOKEN}` },
      timeout: 8000
    });
    const username = normalizeInstagramUsername(response.data && response.data.username);
    if (!username) return null;
    return recordInstagramProfile(cleanUserId, username);
  } catch (error) {
    log("warn", "instagram_profile_lookup_failed", {
      user_suffix: conversationExternalId(cleanUserId).slice(-6),
      error: String(error.response?.data?.error?.message || error.message || "profile_lookup_failed").slice(0, 160)
    });
    return null;
  }
}

function queueInstagramProfileRefreshes(turns) {
  const storedProfiles = instagramProfilesFromTurns(turns);
  const userIds = [];
  (turns || []).forEach(function (turn) {
    const userId = normalizeConversationUserId(turn.userId);
    if (conversationChannel(userId) !== "instagram" || storedProfiles[userId] || userIds.includes(userId)) return;
    userIds.push(userId);
  });
  userIds.slice(0, 10).forEach(function (userId) { refreshInstagramProfile(userId); });
}

function recordCustomerMeta(userId, meta) {
  const payload = {
    tags: normalizeCustomerTags(meta && meta.tags),
    note: normalizeCustomerNote(meta && meta.note)
  };
  const rec = {
    ts: new Date().toISOString(),
    userId,
    userMessage: "",
    botReply: "[Meta] " + JSON.stringify(payload),
    tools: [CUSTOMER_META_TOOL],
    zeroResultQueries: [],
    handoff: false,
    rating: null,
    numTools: 1,
    status: "ok",
    eval: { skip: true, reason: CUSTOMER_META_TOOL }
  };
  conversationLogs.push(rec);
  if (conversationLogs.length > 100) conversationLogs.shift();
  supabaseInsert(rec);
  return { ...payload, updated_at: rec.ts };
}

function inferHandoffStates(turns, activeUsers) {
  const states = {};
  (activeUsers || []).forEach(function (id) {
    const userId = normalizeConversationUserId(id);
    if (userId) states[userId] = { active: true, source: "memory", last_change_ts: null };
  });

  (turns || []).slice().sort(function (a, b) {
    return new Date(a.ts || 0) - new Date(b.ts || 0);
  }).forEach(function (turn) {
    const userId = normalizeConversationUserId(turn.userId);
    if (!userId) return;
    const tools = Array.isArray(turn.tools) ? turn.tools : [];
    if (tools.includes("admin_release") || tools.includes("admin_resolve")) {
      states[userId] = { active: false, source: tools.includes("admin_resolve") ? "admin_resolve" : "admin_release", last_change_ts: turn.ts || null };
      return;
    }
    if (
      tools.includes("admin_takeover") ||
      tools.includes("admin_send_message") ||
      tools.includes("request_human_handoff") ||
      tools.includes("human_handoff_active") ||
      turn.handoff
    ) {
      const source = tools.includes("admin_takeover") ? "admin_takeover"
        : tools.includes("admin_send_message") ? "admin_send_message"
          : tools.includes("request_human_handoff") ? "request_human_handoff"
            : tools.includes("human_handoff_active") ? "human_handoff_active" : "handoff";
      states[userId] = { active: true, source, last_change_ts: turn.ts || null };
    }
  });

  return states;
}

async function inferRecentHandoffs(limit) {
  const activeMemory = Array.from(humanHandoff.values());
  let turns = conversationLogs.slice();
  if (SUPABASE_ENABLED) {
    const rows = await supabaseFetchRecent(limit || 100);
    if (rows) turns = rows.map(normalizeTurnRow);
  }
  const states = inferHandoffStates(turns, activeMemory);
  return {
    states,
    activeUsers: Object.keys(states).filter(function (id) { return states[id].active; })
  };
}

function recordTurn(userId, userMessage, botReply, status) {
  try {
    const rec = {
      ts: new Date().toISOString(),
      tenantId: DEFAULT_TENANT_ID,
      phoneNumberId: PHONE_NUMBER_ID || null,
      channel: conversationChannel(userId),
      userId,
      userMessage: String(userMessage || "").slice(0, 500),
      botReply: String(botReply || "").slice(0, 1000),
      tools: turnTools.slice(),
      zeroResultQueries: turnZeroQueries.slice(),
      handoff: turnHandoff,
      rating: turnRating,
      numTools: turnTools.length,
      status: status || "ok"
    };
    conversationLogs.push(rec);
    if (conversationLogs.length > 100) conversationLogs.shift();
    supabaseInsert(rec);
  } catch (e) { console.error("recordTurn error:", e.message); }
}

function recordAdminEvent(userId, tool, message, status, handoffOverride) {
  try {
    const handoffState = typeof handoffOverride === "boolean" ? handoffOverride : !["admin_release", "admin_resolve"].includes(tool);
    const rec = {
      ts: new Date().toISOString(),
      tenantId: DEFAULT_TENANT_ID,
      phoneNumberId: PHONE_NUMBER_ID || null,
      channel: conversationChannel(userId),
      userId,
      userMessage: "",
      botReply: String(message || "").slice(0, 1000),
      tools: [tool],
      zeroResultQueries: [],
      handoff: handoffState,
      rating: null,
      numTools: 1,
      status: status || "ok"
    };
    conversationLogs.push(rec);
    if (conversationLogs.length > 100) conversationLogs.shift();
    supabaseInsert(rec);
  } catch (e) { console.error("recordAdminEvent error:", e.message); }
}

function describeInboundMessage(message) {
  const type = message && message.type;
  if (type === "text") return message.text && message.text.body || "";
  if (type === "audio" || type === "voice") return "[Audio recibido]";
  if (type === "image") return "[Imagen recibida]";
  if (type === "document") return "[Documento recibido]";
  if (type === "video") return "[Video recibido]";
  if (type === "sticker") return "[Sticker recibido]";
  return "[" + (type || "mensaje") + " recibido]";
}

function recordHumanPausedInbound(userId, message) {
  trackIncomingMessage(userId);
  turnZeroSearchActive = false;
  turnTools = ["human_handoff_active"];
  turnZeroQueries = [];
  turnHandoff = true;
  turnRating = null;
  recordTurn(userId, describeInboundMessage(message), "", "ok");
}

async function humanControlActiveFor(userId) {
  const instagramConversation = conversationChannel(userId) === "instagram";
  if (humanHandoff.has(userId) && !instagramConversation) return true;
  if (instagramConversation) humanHandoff.delete(userId);
  const rows = await supabaseFetchUserRecent(userId, 20);
  if (!rows || !rows.length) return false;
  for (const row of rows) {
    const tools = row.tools || [];
    if (tools.includes("admin_release") || tools.includes("admin_resolve")) return false;
    const adminHandoff = tools.includes("admin_takeover") || tools.includes("admin_send_message");
    const botHandoff = tools.includes("request_human_handoff");
    if (adminHandoff || botHandoff) {
      const activatedAt = Date.parse(row.ts || row.created_at || "");
      const ttl = adminHandoff ? ADMIN_HANDOFF_TTL_MS : BOT_HANDOFF_TTL_MS;
      if (activatedAt && Date.now() - activatedAt > ttl) {
        recordAdminEvent(userId, "admin_release", "[Sistema] Handoff expirado automáticamente.", "ok", false);
        if (conversationChannel(userId) === "instagram") instagramRuntimeState.last_handoff_auto_release_at = new Date().toISOString();
        return false;
      }
      humanHandoff.add(userId);
      return true;
    }
  }
  return false;
}

function trackIncomingMessage(userId) {
  const today = new Date().toISOString().slice(0, 10);
  botStats.messages.total++;
  botStats.messages.byDay[today] = (botStats.messages.byDay[today] || 0) + 1;
  botStats.uniqueUsers.add(userId);
  if (botStats.uniqueUsersToday.date !== today) {
    botStats.uniqueUsersToday = { date: today, set: new Set() };
  }
  botStats.uniqueUsersToday.set.add(userId);
  botStats.messages.today = botStats.messages.byDay[today];
}

function trackAnthropicUsage(usage) {
  if (!usage) return;
  botStats.anthropic.totalCalls++;
  botStats.anthropic.inputTokens += (usage.input_tokens || 0);
  botStats.anthropic.outputTokens += (usage.output_tokens || 0);
  botStats.anthropic.cacheCreationTokens += (usage.cache_creation_input_tokens || 0);
  botStats.anthropic.cacheReadTokens += (usage.cache_read_input_tokens || 0);
}

function estimateCostUSD() {
  const a = botStats.anthropic;
  const cost = (a.inputTokens * 3 / 1e6) + (a.outputTokens * 15 / 1e6) +
               (a.cacheCreationTokens * 3.75 / 1e6) + (a.cacheReadTokens * 0.3 / 1e6);
  return Math.round(cost * 10000) / 10000;
}

const RATING_REQUEST = `⭐ Antes de despedirnos, ¿cómo te pareció la atención del 1 al 5?

Tu opinión nos ayuda muchísimo a mejorar 💛`;
const lastSearchResults = new Map();
const checkouts = new Map();

const CHECKOUT_FIELDS = ["nombre", "cedula", "direccion", "telefono", "metodo_pago"];
const WARRANTY_FIELDS = ["factura_pedido", "cedula_nit", "fecha_compra", "motivo"];

const STORE = {
  name: "🌴 RAV Toys – Planet Selva",
  address: "CC El Tesoro, 2º Piso por Plaza Palmas, Local 3729",
  latitude: 6.19859,
  longitude: -75.55812,
};

const STORE_DIRECTIONS = "Estamos en el Parque Comercial El Tesoro en Medellín 🌴, sector Plaza Palmas, piso 2, Local 3729. Cerquita de Bancolombia, Ktronix, Valentina Bakery y H&M ✨ ¡Te esperamos!";

const PAYMENT_INFO = `🏦 *Medios de pago RAV Toys*

*1. Datáfono virtual Wompi* 📱 ⭐ _(lo más rápido, cierras ya)_
Paga con cualquier tarjeta débito o crédito:
https://checkout.wompi.co/l/iGnSPs
En el link coloca el valor a pagar y sigue los pasos ✨

*2. Transferencia Bancolombia* 💳
Cuenta ahorros: 37 938 445 851
RAV Kids SAS · NIT 900 822 164-1

*3. Contraentrega* 🚚
Paga en efectivo al recibir. Disponible para compras < $1.450.000.

*4. Crédito con Addi o Sü Pay* 📅
Compra ahora y paga después, sin intereses. Sujeto a aprobación.

¿Cuál prefieres?`;

const WARRANTY_SHORT = `📋 *Política de garantías RAV Toys*

• 30 días calendario desde la compra (Ley 1480).
• Cambios por defecto de fábrica, idoneidad o calidad.
• Cambio de opinión: hasta 5 días hábiles, producto en empaque original sin uso.
• No hacemos devolución de dinero: entregamos bono por el mismo valor, vigencia 1 año.
• Transporte hacia nosotros corre por cuenta del cliente.

¿Me cuentas qué pasó con tu producto? Así te oriento mejor. 🙏`;

const SHIPPING_INFO = `
💰 COSTO DE ENVÍO: $15.000 con entrega a todo Colombia.
🎁 ENVÍO GRATIS en compras de $199.000 pesos o más.
🚚 *Envíos a todo Colombia*

Llevamos los juguetes hasta donde estés ✨ Tenemos cobertura en casi todo el país a través de las principales transportadoras:

• Envia 🚛
• Coordinadora 📦
• Servientrega 📮
• TCC 🛻
• Interrapidisimo ⚡

⏱️ *Tiempo de entrega:* 2 a 5 días hábiles, según la transportadora y la ciudad de destino.

🌴 *¿Estás en Medellín?* ¡Buenas noticias! La mayoría de las veces entregamos el *mismo día* 🚀 Si quieres confirmar el tiempo exacto para tu pedido, dime y te paso con una asesora 💛`;

const SYSTEM_PROMPT = `Eres "RAV-Bot", vendedor virtual de RAV Toys (juguetería online en Medellín). Catálogo: ravtoys.com

TONO:
- Respuestas cortas (1-2 líneas máx) pero SIEMPRE cálidas y amables.
- Saludas con energía: "Hola soy RAV-Bot 🤖 Te doy la bienvenida a RAV Toys, la juguetería más cool del mundo entero y sus alrededores 🌎 ¿En qué te ayudo?"
- Usas "peque" para los niños.
- Cercano, chévere, entusiasta. Vendedor TOP, nunca pasivo.
- Si el cliente manda algo ambiguo ("?", emoji solo, mensaje corto confuso) o audio: responde con calidez ("¡Hola! 😊 Dime en qué te puedo ayudar con tus juguetes RAV Toys" / "No puedo escuchar audio 😊 Pero cuéntame por texto qué buscas y te ayudo encantado"). SIEMPRE redirige a algo de RAV Toys, nunca ofrezcas ayuda fuera del contexto RAV.

TONO EMPÁTICO Y HUMILDE (cuando no entiendas o necesites ayuda del cliente):
Cuando algo no quede claro, no entiendas un mensaje, no encuentres lo que el cliente describe, o necesites que repita/aclare algo, responde con humildad y calidez. NUNCA suenes robótico, frío o evasivo. Usa frases con emoji 🙈 🙏 ✨ que muestren que eres una IA aprendiendo.
Ejemplos del tono que queremos:
- "Soy inteligente pero aún no tanto como tú 🙈 Por fa copia y pégame el link del producto para poder ayudarte mejor ✨"
- "Mmm no estoy logrando entenderte bien 🙏 ¿Me lo cuentas con otras palabras? Quiero ayudarte bien"
- "Disculpa peque despiste 🙈 ¿Me dices el nombre del producto otra vez para buscarlo bien?"
- "Estoy aprendiendo cada día — ¿me ayudas pegando aquí lo que no entendí? 🙏"
NO uses frases frías como "No entiendo tu mensaje", "Procesa de nuevo", "Solicitud no válida", "No es posible". El cliente debe sentir que le estás dando lo mejor de ti.

IMÁGENES Y MULTIMEDIA:
Si el mensaje del cliente empieza con "[AGENTE MULTIMODAL: NOTA DE VOZ TRANSCRITA]" o "[AGENTE MULTIMODAL: IMAGEN ANALIZADA]", significa que Nextfor ya proceso ese audio o imagen de forma controlada. Usa SOLO esa transcripcion o analisis como contexto, responde natural y no digas que no puedes escuchar/ver ese archivo.

Si el cliente menciona que va a mandar o mandó una imagen/foto/video/audio (ej: "te mando foto", "mira esta imagen", "ahí te paso una pic", "te grabo un audio"), o si por el contexto entiendes que está intentando compartir algo que no es texto, responde con calidez y honestidad sobre tu limitación. NO inventes que viste algo, sé honesto.

Frases tipo (varía, no las copies idénticas):
- "Soy inteligente pero aún no soy humano 🙈 Por ahora solo sé leer links y texto. Si me mandas el link del producto que viste te lo tomo al toque ✨"
- "Aún estoy aprendiendo a ver imágenes 🙏 Pero si copias el link del producto desde la web (https://ravtoys.com) yo te tomo el pedido sin problema 💛"
- "Mmm soy una IA en aprendizaje y todavía no veo imágenes 🙈 Mándame mejor el link del producto y lo agrego a tu carrito en segundos ✨"
- "Por ahora solo entiendo texto y links 🙏 Pero si me describes lo que buscas o me pegas el link del producto, te ayudo full"

Si el cliente está mandando una foto que parece de un producto dañado en garantía, ofrece pasarlo con un humano: "Soy una IA en aprendizaje y aún no veo imágenes 🙈 Pero te paso con nuestra asesora Eliana que sí puede revisar la foto y ayudarte 💛" y llama request_human_handoff(reason="garantia_con_imagen").

PRODUCTOS:
- REGLA SAGRADA: SOLO existes para ofrecer productos que aparezcan en resultados reales de search_products. JAMÁS inventes, sugieras o menciones marcas, nombres de productos o modelos específicos (Barbie, LOL, Hot Wheels, Lego, Nenuco, etc.) que no hayan salido en una búsqueda real de esta conversación. Si no estás 100% seguro de que algo está en el catálogo porque lo viste en resultados, NO lo menciones. Es mejor preguntar al cliente qué busca que inventar algo que no tenemos.
- LIMITE DURO INFLEXIBLE: máximo 1 search_products POR TURNO. Una sola llamada con términos buenos. NO repitas búsquedas en el mismo turno aunque los resultados no sean perfectos. Usa los productos que sí encontraste y ofrécelos.
- Cuando search_products devuelve resultados: muestra hasta 3 opciones + el link del catálogo de ese término + invita a mandarte el link del producto que le guste.
- Cuando search_products devuelve 0 resultados, responde SIEMPRE así (tono cálido, seguro, servicial):
  1. Hazle una pregunta abierta para entender mejor qué busca, sin nombrar marcas ni productos concretos. Ejemplo: "¡Claro que sí! 💛 Para mostrarte justo lo que le encantará a tu peque, cuéntame: ¿qué edad tiene y qué tipo de juguete buscas? Así te traigo las mejores opciones que tenemos ✨"
  2. Con su respuesta, haz una NUEVA búsqueda usando esos términos (edad, categoría, gustos) y muéstrale lo que aparezca.
  3. Solo menciona productos, marcas o categorías que hayan aparecido en resultados reales de search_products. Nunca nombres algo que no viste en una búsqueda.
  4. No incluyas el link del catálogo cuando la búsqueda de ese término dio 0 (llevaría a una página vacía). Solo incluye el link cuando esa búsqueda sí trajo productos.
  5. Habla siempre desde lo que SÍ puedes hacer ("déjame buscarte", "cuéntame más y te muestro"). Nunca describas dificultades, demoras o fallos de tu parte: tú estás funcionando perfecto y tu trabajo es ayudar a encontrar el juguete ideal.
- Llama search_products con términos cortos (2-4 palabras).
- Si hay resultados, llama send_product_card 1-3 veces con los datos EXACTOS que devolvió search_products. NO inventes.
- Mensaje corto con gancho: "¡Tengo estas joyas! ¿Cuál te late?"
- Nunca listes productos en texto. Van siempre en tarjetas.

SI NO HAY MATCH (0 resultados):
- Busca otra cosa con términos distintos. Mínimo 3-4 intentos antes de ceder.
- NO mandes al cliente a la tienda.
- Último recurso: request_human_handoff.

UBICACIÓN:
- Si preguntan dónde están, dirección o ubicación → llama send_store_location (manda el mapa) Y ADEMÁS responde con este guión EXACTO (no inventes referencias): "Estamos en el Parque Comercial El Tesoro en Medellín 🌴, sector Plaza Palmas, piso 2, Local 3729. Cerquita de Bancolombia, Ktronix, Valentina Bakery y H&M ✨ ¡Te esperamos!"
- Si preguntan por cómo llegar o direcciones, responde SOLO con el guión de arriba. NUNCA menciones otro centro comercial ni inventes ubicaciones.

MEDIOS DE PAGO (info general):
- send_payment_info cuando preguntan cómo pagar fuera del checkout.

ENVÍOS:
- send_shipping_info cuando el cliente pregunte por envíos, cobertura, transportadoras, ciudades, despachos, tiempos de entrega, o "¿llega a mi ciudad?".
- Si después de send_shipping_info el cliente CONFIRMA que está en Medellín, o pide explícitamente confirmar el tiempo de entrega del mismo día (frases como "sí, soy de Medellín", "yo estoy en Medellín", "confírmame para Medellín", "hoy llega?", "puedo recibirlo hoy?"): pregúntale si quiere que lo pases con una asesora para confirmarle. Si dice que sí, llama request_human_handoff(reason="confirmar_envio_medellin"). Si dice que no o que ya tiene la info, no llames la tool y sigue la conversación normal.

ESTADO DE PEDIDOS Y GUÍAS:
- Si el cliente pregunta por estado de pedido, guía, rastreo, seguimiento, despacho, "mi pedido", "mi orden", "cuándo llega" o similar, pídele número de pedido y nombre completo si falta alguno.
- Cuando ya tengas número de pedido Y nombre completo, llama lookup_order_status(order_number, customer_name). Si además te da teléfono o correo, inclúyelo en phone_or_email.
- NUNCA inventes número de guía, transportadora, estado o fecha. Solo responde con datos devueltos por lookup_order_status.
- Si lookup_order_status devuelve matched=true, resume el estado en 1-2 líneas y comparte guía/link si existe.
- Si devuelve matched=false, NO reveles datos del pedido. Pide confirmar nombre completo o teléfono/correo de la compra; si sigue sin coincidir, ofrece pasarlo con una asesora y llama request_human_handoff(reason="validar_pedido").
- Si devuelve not_found o error, responde con calidez pidiendo revisar número de pedido/nombre. Si el cliente necesita ayuda inmediata, llama request_human_handoff(reason="estado_pedido").

CALIFICACIONES:
- Cuando el cliente cierra la conversación con frases como "gracias", "listo", "todo bien", "perfecto", "muchas gracias", "buenísimo": llama send_rating_request para pedirle calificar la atención.
- Cuando recibas la NOTA DEL SISTEMA al inicio de un turno diciendo "Cliente acaba de salir de handoff con humano. Pide calificación.", lo PRIMERO que haces es llamar send_rating_request. Aún si el cliente escribe sobre otra cosa, primero pide la calificación con calidez (ej: "¡Hola otra vez! Antes de seguir, ¿cómo te pareció la atención del 1 al 5? Tu opinión nos ayuda muchísimo 💛").
- Cuando el cliente responda con un número 1-5 (con o sin comentario), llama save_rating(rating, comment opcional). El sistema te dirá en next_action cómo agradecerle.
- Si rating <= 3: agradece con calidez Y ofrece pasarlo con un humano para entender qué mejorar (cuando el cliente acepte, llama request_human_handoff(reason="rating_bajo")).
- NO pidas rating si el cliente está en medio de una compra activa (lleva carrito), garantía o búsqueda. Solo en momentos de cierre o post-handoff.

GARANTÍAS (FLUJO COMPLETO — sigue paso a paso):
Cuando el cliente menciona producto dañado, defectuoso, cambio, devolución o "tengo garantía":

  PASO 1: Llama send_warranty_info para enviarle la política. Después dile algo cálido como "Para ayudarte con tu garantía necesito unos datos rapidito 🙏". NUNCA pases a humano sin recoger los datos primero.

  PASO 2: Pide UNO POR UNO (en este orden) y por cada respuesta llama save_warranty_field con el field correcto:
    - factura_pedido: "¿Me das tu número de factura o pedido?"
    - cedula_nit: "¿A nombre de qué cédula o NIT está la compra?"
    - fecha_compra: "¿Cuándo compraste el producto? (fecha aproximada)"
    - motivo: "¿Qué pasó con el producto? Cuéntame qué quieres reclamar"

  PASO 3: Cuando tengas los 4 campos, llama notify_warranty_team. El resultado incluye next_action que te dirá:
    1) Generar mensaje al cliente: "¡Listo! Ya pasé tu caso a nuestra asesora Eliana 🌴 Te escribirá pronto para ayudarte 💛"
    2) Llamar request_human_handoff(reason="garantia") en el MISMO turno.
  Si NO haces estos dos pasos, el cliente queda sin respuesta y sin handoff. Es OBLIGATORIO completar ambos.

  IMPORTANTE: Si el cliente da varios datos en un solo mensaje (ej "factura 1234, cédula 1037..."), llama save_warranty_field varias veces seguidas (una por dato). Si solo da uno, guárdalo y pide el siguiente.

═══════════════════════════════════════
CIERRE DE VENTA (FLUJO ESTRICTO)
═══════════════════════════════════════
Cuando el cliente indique que quiere comprar ("lo quiero", "me lo llevo", "hagamos el pedido", "cómo lo compro"):

PASO 1 — AGREGAR PRODUCTOS AL CARRITO (¡el cliente puede llevar VARIOS!):
  Llama select_product_for_purchase con el product_url EXACTO del producto elegido (debe ser un product_url que apareció en search_products previo).
  El sistema confirma el producto Y SU PRECIO REAL. TÚ NO DECIDES EL PRECIO ni sumas totales — el sistema lo hace.

  🛒 CROSS-SELL OBLIGATORIO: Después de cada select_product_for_purchase, el resultado incluye next_action que te dirá que preguntes al cliente si quiere agregar algo más. SIEMPRE pregunta esto. Ejemplos:
  - "¡Genial! 🎉 ¿Quieres agregar otro juguete a tu pedido?"
  - "¿Le agregamos algo más para tu peque? Tenemos cosas espectaculares"
  - "¿Algo más para llevar? Si quieres ver lo que llevas en el carrito, dime y te lo confirmo"

  Si dice SÍ → busca con search_products → llama select_product_for_purchase otra vez (se acumula).
  Si dice NO o "ya está bien" → procede al PASO 2.
  En cualquier momento puedes llamar view_current_purchase para confirmar el carrito y total.
  Si quiere quitar algo → remove_product_from_purchase con el product_url.

  Cuando el cliente menciona PRESUPUESTO (ej: "tengo 1.000.000"): busca productos cerca de esa cifra y de menor valor para combinarlos. La idea es ofrecer combinaciones que sumen ~el presupuesto. Aprovecha el carrito multi-producto.

CASOS ESPECIALES DE COMPRA:

  💰 PRESUPUESTO: Si el cliente menciona presupuesto (ej "tengo 1.000.000"), haz UNA búsqueda con la palabra clave principal y propón 2-3 productos que sumen cerca del presupuesto.

  🧒 VARIOS PEQUES: Si menciona varios peques de distintas edades, haz UNA búsqueda por la edad principal y sugiere uno por cada edad.

  🌐 FLUJO DE RECOMENDACIÓN — 3 opciones + link de búsqueda específica (HAZLO SIEMPRE así):
  PASO 1: Cuando el cliente pida productos, llama search_products UNA SOLA VEZ con términos cortos y relevantes (ej: "carro control remoto", "muñeca 3 años", "lego niña"). Una sola llamada, sin repetir.
  PASO 2: De los resultados, toma máximo 3 productos (los primeros que estén con stock) y envíalos con send_product_card uno por uno. Si hay menos de 3 con stock, envía los que haya. Si hay 0 resultados: pregúntale con calidez la edad y los gustos del peque (sin nombrar marcas/productos concretos) para hacer una nueva búsqueda en tu siguiente turno. No incluyas el link del catálogo de ese término. Mantén un tono seguro y servicial, hablando siempre desde lo que vas a hacer por él.
  PASO 3: Después de enviar los productos, manda un mensaje cálido con el link de búsqueda específico al CATÁLOGO de la web. Formato del link: https://ravtoys.com/search?q=PALABRA_CLAVE (reemplaza PALABRA_CLAVE con los mismos términos clave que usaste en search_products, separados por +). Ejemplos:
    - Cliente busca "carro control remoto" → link: https://ravtoys.com/search?q=carro+control+remoto
    - Cliente busca "lego para niña 6 años" → link: https://ravtoys.com/search?q=lego+ni%C3%B1a (los acentos van encodificados: ñ=%C3%B1, á=%C3%A1, é=%C3%A9, í=%C3%AD, ó=%C3%B3, ú=%C3%BA)
    - Cliente busca "muñeca" → link: https://ravtoys.com/search?q=mu%C3%B1eca

  Texto del mensaje (varía la frase, no la copies igual cada vez). DEBE incluir 3 elementos: (a) presentación cálida de las 3 opciones, (b) el link al catálogo de búsqueda, (c) invitación a mandarte links de productos para que tú tomes el pedido. Ejemplo:
  "Te dejo aquí 3 opciones que creo le van a encantar a tu peque 💛 ¿Quieres explorar más? Mira todo el catálogo de [TÉRMINO] aquí 👇\n\n[LINK_DE_BUSQUEDA]\n\nSi alguno te enamora, mándame el link y con muchísimo gusto te tomo el pedido al instante ✨"

  Otras variaciones cálidas (siempre con los 3 elementos):
  - "Estas son mis 3 favoritas para lo que buscas ✨ Si quieres ver muchas más opciones de [TÉRMINO], dale un vistazo aquí 🔍\n\n[LINK]\n\nCuando encuentres el ganador, pégame el link aquí y te lo agrego al carrito al toque 🛒"
  - "Aquí van 3 opciones que pensé te van a gustar 🌟 Tenemos muchísimas más en el catálogo, mira más de [TÉRMINO] aquí 👇\n\n[LINK]\n\nSi alguno te llama la atención, mándame el link y yo te tomo el pedido en un toque 💛"

  PASO 4: Si después el cliente PEGA un link de https://ravtoys.com/products/... (o sea, un producto específico que vio en la web):
    - Extrae las palabras del handle (después de /products/, separado por guiones).
    - Llama search_products con esas palabras.
    - Si lo encuentras, llama select_product_for_purchase con el product_url exacto.
    - Confírmale y pregunta "¿algo más?"

  🔗 LINKS — REGLAS DURAS:
  - NUNCA envuelvas URLs con asteriscos, guiones, comillas o markdown. WhatsApp NO renderiza markdown — el link se ve roto.
  - URL correcto: https://ravtoys.com  ❌ Incorrecto: **ravtoys.com**, *ravtoys.com*, [ravtoys.com](url)
  - Cuando el cliente PEGUE un link de ravtoys.com (ej "https://ravtoys.com/products/super-rocket"):
    1. Extrae palabras del handle (después de /products/, separado por guiones).
    2. Llama search_products con esas palabras.
    3. Si lo encuentras, llama select_product_for_purchase con el product_url exacto.
    4. Confírmale y pregunta "¿algo más?".

  🛒 REGLA DE ORO DEL CROSS-SELL: Después de cada select_product_for_purchase, SIEMPRE pregunta "¿algo más?". El sistema te lo recuerda en next_action.
  Si dice "no, ya está" → pasa al PASO 2.
  Si dice "sí" o pega un link → repite agregar al carrito.

PASO 2 — RECOGER DATOS (uno por uno):
  Pides el dato, esperas la respuesta del cliente, y llamas save_checkout_field con el valor EXACTO que escribió.
  Orden OBLIGATORIO:
  a) save_checkout_field(field="nombre", value="...") — nombre completo
  b) save_checkout_field(field="cedula", value="...") — cédula
  c) save_checkout_field(field="direccion", value="...") — dirección + ciudad
  d) save_checkout_field(field="telefono", value="...") — teléfono de contacto

  Nunca saltes un paso. La cédula es SIEMPRE obligatoria.

PASO 3 — MOSTRAR MEDIOS DE PAGO:
  Cuando los 4 datos estén guardados, llama send_payment_info.

PASO 4 — GUARDAR MÉTODO ELEGIDO:
  save_checkout_field(field="metodo_pago", value="<transferencia|wompi|contraentrega|addi|supay>")

PASO 5 — ENVIAR INSTRUCCIONES DE PAGO:
  send_payment_link(method="<transferencia|wompi|contraentrega|addi|supay>")
  (El sistema usa el precio real del producto, tú no pasas monto)

  El resultado de send_payment_link incluye next_action — SIGUE ESA INSTRUCCIÓN AL PIE DE LA LETRA.

PASO 6 — SEGÚN EL MÉTODO:

  ⭐ WOMPI o TRANSFERENCIA (automatizados):
  Después de send_payment_link, espera silenciosamente a que el cliente diga "ya pagué", "listo", "transferí" o mande comprobante. Cuando confirme:
  → Llama notify_sale_team (sin argumentos)
  → Llama request_human_handoff(reason="venta_cerrada")

  CONTRAENTREGA, ADDI o SÜ PAY (requieren humano para cerrar):
  INMEDIATAMENTE después de send_payment_link, en EL MISMO TURNO:
  → Llama notify_sale_team (sin argumentos)
  → Llama request_human_handoff(reason="venta_metodo_manual")
  No esperes confirmación del cliente. El humano del equipo seguirá la conversación.

═══════════════════════════════════════

HUMANO DIRECTO:
- Si piden hablar con asesor, persona, humano → request_human_handoff(reason="solicitud_cliente").

HORARIOS (solo si preguntan, responde con este formato cool): "🕐 *Nuestros horarios*\n\nDom–Mié: 11:00 am – 8:00 pm\nJue–Sáb: 10:00 am – 9:00 pm\nFestivos: horario de domingo (11am–8pm)\n\n¡Te esperamos! 🌴"

NOTAS DE VOZ:
- Si mandan audio: "No puedo escuchar audio 😊 ¿Me escribes qué buscas?"

NUNCA INVENTES: precios, productos, links, stock, políticas, ni datos del cliente.`;

const TOOLS = [
  {
    name: "search_products",
    description: "Busca productos reales en el catálogo conectado del comercio. Devuelve hasta 5 con título, precio, image_url, product_url, descripción y stock. Úsalo SIEMPRE que el cliente pida un producto.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Términos cortos (2-4 palabras). Ej: 'muñeca princesa', 'carro control remoto'." }
      },
      required: ["query"]
    }
  },
  {
    name: "send_product_card",
    description: "Envía UNA tarjeta con imagen + nombre + precio + link. Usa los datos EXACTOS que devolvió search_products. Llama 1-3 veces (una por producto) antes de responder texto.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        price: { type: "string" },
        image_url: { type: "string" },
        product_url: { type: "string" }
      },
      required: ["title", "price", "image_url", "product_url"]
    }
  },
  {
    name: "send_store_location",
    description: "Envía la ubicación de Planet Selva. SOLO si preguntan explícitamente por dirección, ubicación o cómo llegar.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "send_payment_info",
    description: "Envía el mensaje con los 4 medios de pago. Úsalo cuando preguntan cómo pagar, o dentro del flujo de checkout después de recoger los datos del cliente.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "send_warranty_info",
    description: "Envía el resumen de garantías. Úsalo cuando mencionan producto dañado, cambio, devolución o garantía.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "send_shipping_info",
    description: "Envía la información de envíos: cobertura, transportadoras y tiempos de entrega. Úsalo cuando el cliente pregunte por envíos, despachos, cobertura, ciudades, transportadoras, cuánto tarda el pedido, o algo similar.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "lookup_order_status",
    description: "Consulta en la plataforma de comercio conectada el estado real de un pedido y sus guías. Úsalo cuando el cliente pregunta por estado, guía, rastreo o seguimiento, y ya dio número de pedido y nombre completo. No revela datos si el nombre no coincide.",
    input_schema: {
      type: "object",
      properties: {
        order_number: { type: "string", description: "Número o nombre del pedido tal como lo da el cliente. Ej: '#1234', '1234', 'RAV1234'." },
        customer_name: { type: "string", description: "Nombre completo o nombre y apellido que da el cliente para validar identidad." },
        phone_or_email: { type: "string", description: "Teléfono o correo opcional de la compra, si el cliente lo da." }
      },
      required: ["order_number", "customer_name"]
    }
  },
  {
    name: "send_rating_request",
    description: "Envía un mensaje pidiendo al cliente calificar la atención del 1 al 5. Úsalo cuando: (a) el cliente cierra con frases como 'gracias', 'listo', 'todo bien', 'perfecto', 'muchas gracias'; (b) el sistema te indica que el cliente acaba de salir de un handoff con humano. NO lo uses si el cliente está en medio de una compra, búsqueda o garantía.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "save_rating",
    description: "Guarda la calificación del cliente (1 a 5) y notifica al equipo. Llámalo cuando el cliente responda con un número después de send_rating_request. Si dejó comentario, inclúyelo.",
    input_schema: {
      type: "object",
      properties: {
        rating: { type: "integer", minimum: 1, maximum: 5, description: "Calificación de 1 a 5" },
        comment: { type: "string", description: "Comentario opcional del cliente" }
      },
      required: ["rating"]
    }
  },
  {
    name: "save_warranty_field",
    description: "Guarda un dato del flujo de reclamación de garantía. Llámalo cada vez que el cliente provea su número de factura/pedido, cédula/NIT, fecha de compra, o motivo. Una llamada por dato.",
    input_schema: {
      type: "object",
      properties: {
        field: { type: "string", enum: ["factura_pedido", "cedula_nit", "fecha_compra", "motivo"], description: "Cuál dato de garantía estás guardando" },
        value: { type: "string", description: "Valor exacto que dio el cliente" }
      },
      required: ["field", "value"]
    }
  },
  {
    name: "notify_warranty_team",
    description: "Envía resumen de la reclamación al equipo y pasa a humano (Eliana). Llámalo SOLO después de tener los 4 campos: factura_pedido, cedula_nit, fecha_compra y motivo.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "select_product_for_purchase",
    description: "Marca un producto como el elegido por el cliente para la compra. Debe ser un product_url que apareció en un search_products previo. El sistema guarda el producto con su precio REAL (no lo decide el modelo). Usa esta tool al inicio del flujo de checkout.",
    input_schema: {
      type: "object",
      properties: {
        product_url: { type: "string", description: "product_url EXACTO del producto elegido (debe venir de un search_products previo)" }
      },
      required: ["product_url"]
    }
  },
  {
    name: "view_current_purchase",
    description: "Devuelve la lista actual de productos en el carrito del cliente con el total. Úsalo para confirmar al cliente lo que lleva antes de cerrar la compra, o cuando dice 'qué llevo' o 'cuánto va'.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "remove_product_from_purchase",
    description: "Quita UN producto del carrito por su product_url. Úsalo si el cliente cambia de opinión sobre algo que ya había agregado.",
    input_schema: {
      type: "object",
      properties: {
        product_url: { type: "string", description: "product_url EXACTO del producto a quitar" }
      },
      required: ["product_url"]
    }
  },
  {
    name: "save_checkout_field",
    description: "Guarda un campo específico del checkout con su valor. Llámalo después de que el cliente responda cada pregunta del flujo de cierre. Campos permitidos: nombre, cedula, direccion, telefono, metodo_pago.",
    input_schema: {
      type: "object",
      properties: {
        field: {
          type: "string",
          enum: ["nombre", "cedula", "direccion", "telefono", "metodo_pago"],
          description: "Cuál campo estás guardando"
        },
        value: { type: "string", description: "El valor EXACTO que escribió el cliente (sin cambios, ni resumen)" }
      },
      required: ["field", "value"]
    }
  },
  {
    name: "send_payment_link",
    description: "Envía al cliente las instrucciones del método de pago. El sistema usa el precio REAL del producto seleccionado (NO pasas monto, el backend lo calcula).",
    input_schema: {
      type: "object",
      properties: {
        method: {
          type: "string",
          enum: ["transferencia", "wompi", "contraentrega", "addi", "supay"],
          description: "Método elegido por el cliente"
        }
      },
      required: ["method"]
    }
  },
  {
    name: "notify_sale_team",
    description: "Notifica al equipo RAV Toys que hay una venta lista. El sistema arma el resumen con los datos guardados en el checkout (producto, precio real, cliente). TÚ NO PASAS EL RESUMEN. Llámalo después de que el cliente confirme que pagó. Luego llama request_human_handoff.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "request_human_handoff",
    description: "Pasa la conversación a un humano. Úsalo cuando: (a) el cliente pida hablar con una persona, (b) después de notify_sale_team, (c) último recurso cuando no puedas ayudar. Notifica al equipo y detiene el bot para este cliente.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Motivo: 'venta_cerrada', 'solicitud_cliente', 'caso_complejo', 'garantia', etc."
        }
      },
      required: ["reason"]
    }
  }
];

async function searchShopifyStorefront(query, options = {}) {
  if (!SHOPIFY_STOREFRONT_DOMAIN) return { products: [], total: 0, query, error: "shopify_storefront_not_configured" };
  // CACHE (v32): si la misma query se buscó hace <5min, reusar resultado.
  // Ahorra llamadas a Shopify y mejora velocidad. Auto-limpia cada llamada.
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
  const now = Date.now();
  const cached = searchCache.get(query);
  if (cached && (now - cached.ts) < CACHE_TTL_MS) {
    log("info", "search_cache_hit", { query_fingerprint: crypto.createHash("sha256").update(String(query || "")).digest("hex").slice(0, 12), age_seconds: Math.round((now - cached.ts) / 1000), products: cached.result.products.length });
    return cached.result;
  }
  // Limpiar entries viejas (>10 min) para no acumular memoria
  for (const [k, v] of searchCache.entries()) {
    if ((now - v.ts) > 10 * 60 * 1000) searchCache.delete(k);
  }

  // Estrategia: usar el endpoint público del storefront que devuelve JSON
  // Ventaja: el bot ve exactamente lo mismo que el cliente en la web (filtros de stock,
  // visibilidad y disponibilidad ya aplicados por Shopify). Cero falsos negativos.
  const safeQuery = encodeURIComponent(query || "");
  const url = `https://${SHOPIFY_STOREFRONT_DOMAIN}/search?q=${safeQuery}&view=json&resources[limit]=20&type=product`;
  // Fallback: si el dominio personalizado no responde, intentar el .myshopify.com directo
  const fallbackUrl = `https://${SHOPIFY_STORE_DOMAIN}/search?q=${safeQuery}&view=json&resources[limit]=20&type=product`;

  let raw;
  try {
    const resp = await axios.get(url, { timeout: 8000, headers: { Accept: 'application/json' } });
    raw = resp.data;
  } catch (err) {
    console.log(`[searchShopify] Primary URL failed (${err.message}), trying fallback`);
    try {
      const resp = await axios.get(fallbackUrl, { timeout: 8000, headers: { Accept: 'application/json' } });
      raw = resp.data;
    } catch (err2) {
      console.log(`[searchShopify] Fallback also failed: ${err2.message}`);
      return { products: [], total: 0, query };
    }
  }

  // Parsear si llega como string
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch (e) { return { products: [], total: 0, query }; }
  }

  const items = raw?.results || [];
  const total = raw?.results_count || items.length;

  const products = items.map(p => {
    // Extraer handle del URL (lo que va después de /products/)
    const urlPath = p.url || "";
    const handleMatch = urlPath.match(/\/products\/([^?#\/]+)/);
    const handle = handleMatch ? handleMatch[1] : "";
    const fullUrl = safeExternalHttpsUrl(
      new URL(urlPath || "/", `https://${SHOPIFY_STOREFRONT_DOMAIN}`).href,
      [SHOPIFY_STOREFRONT_DOMAIN]
    );
    const imageUrl = p.thumbnail ? safeExternalHttpsUrl(
      new URL(p.thumbnail || "/", `https://${SHOPIFY_STOREFRONT_DOMAIN}`).href,
      [SHOPIFY_STOREFRONT_DOMAIN, "cdn.shopify.com", ".shopifycdn.net"]
    ) : "";
    if (!fullUrl) return null;

    return {
      title: p.title || "",
      handle,
      product_url: fullUrl,
      image_url: imageUrl,
      price: p.price || "",
      price_amount: parseInt(String(p.price || "").replace(/[^0-9]/g, ""), 10) || 0,
      currency: "COP",
      product_type: p.type || "",
      available: true,  // El storefront solo devuelve productos disponibles para venta
      stock: 999        // Placeholder: storefront ya filtró agotados
    };
  }).filter(Boolean);

  console.log(`[searchShopify] query processed (${String(query || "").length} chars), returned ${products.length} products (storefront says ${total})`);
  const result = { products, total, query };
  if (!options.suppressSideEffects) searchCache.set(query, { result, ts: Date.now() });
  // ALERTA INTERNA (v33.2): si la búsqueda no encontró nada, avisar al equipo.
  // Esto NO es un error del bot — es info útil: qué buscan los clientes que no tenemos.
  if (products.length === 0 && !options.suppressSideEffects) {
    try {
      const now = Date.now();
      const key = (query || "").toLowerCase().trim();
      const last = zeroResultAlerts.get(key) || 0;
      const THIRTY_MIN = 30 * 60 * 1000;
      if (now - last > THIRTY_MIN) {
        zeroResultAlerts.set(key, now);
        log("info", "zero_results_alert", { query_fingerprint: crypto.createHash("sha256").update(String(query || "")).digest("hex").slice(0, 12) });
        notifyTeam(`🔍 Un cliente buscó "${query}" y no encontramos productos. Puede que falte ese producto en el catálogo o que se llame distinto. Vale la pena revisar si conviene agregarlo o si hay un sinónimo.`, null).catch(e => console.error("zero-results alert failed:", e.message));
      }
    } catch (alertErr) {
      console.error("zero-results alert error:", alertErr.message);
    }
  }
  return result;
}

const ORDER_STATUS_QUERY = `
query RavOrderStatus($query: String!) {
  orders(first: 5, query: $query, sortKey: CREATED_AT, reverse: true) {
    nodes {
      id
      name
      email
      phone
      createdAt
      displayFinancialStatus
      displayFulfillmentStatus
      billingAddress {
        name
        phone
        city
        province
        country
      }
      shippingAddress {
        name
        phone
        city
        province
        country
      }
      fulfillments(first: 10) {
        status
        displayStatus
        createdAt
        estimatedDeliveryAt
        trackingInfo(first: 10) {
          company
          number
          url
        }
      }
    }
  }
}`;

function cleanShopifyDomain(domain) {
  return String(domain || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");
}

async function shopifyAdminGraphql(query, variables) {
  if (!SHOPIFY_ADMIN_TOKEN) {
    const err = new Error("shopify_admin_token_missing");
    err.code = "shopify_admin_token_missing";
    throw err;
  }

  const domain = cleanShopifyDomain(SHOPIFY_STORE_DOMAIN);
  const url = `https://${domain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`;
  const response = await axios.post(
    url,
    { query, variables },
    {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
        "Content-Type": "application/json"
      },
      timeout: 15000
    }
  );

  if (response.data && response.data.errors && response.data.errors.length) {
    const message = response.data.errors.map(e => e.message).join("; ");
    const err = new Error(message || "shopify_graphql_error");
    err.code = "shopify_graphql_error";
    throw err;
  }

  return response.data && response.data.data;
}

function compactOrderNumber(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9#-]/g, "");
}

function buildOrderSearchQueries(orderNumber) {
  const compact = compactOrderNumber(orderNumber);
  const noHash = compact.replace(/^#+/, "");
  const candidates = [];
  if (compact) candidates.push(compact.startsWith("#") ? `name:${compact}` : `name:#${compact}`);
  if (noHash) {
    candidates.push(`name:${noHash}`);
    candidates.push(noHash);
    if (!/^[A-Za-z]+-/.test(noHash)) {
      for (const prefix of SHOPIFY_ORDER_PREFIXES) {
        const prefixed = `${prefix}-${noHash}`;
        candidates.push(`name:${prefixed}`);
        candidates.push(prefixed);
      }
    }
  }
  return Array.from(new Set(candidates.filter(Boolean))).slice(0, 10);
}

function orderNumberMatches(orderName, inputNumber) {
  const orderCompact = compactOrderNumber(orderName).toLowerCase();
  const inputCompact = compactOrderNumber(inputNumber).toLowerCase();
  const inputNoHash = inputCompact.replace(/^#+/, "");
  const inputSuffix = inputNoHash.includes("-") ? inputNoHash.split("-").pop() : inputNoHash;
  const orderNoHash = orderCompact.replace(/^#+/, "");
  if (!orderCompact || !inputNoHash) return false;
  return (
    orderCompact === inputCompact ||
    orderCompact === "#" + inputNoHash ||
    orderNoHash === inputNoHash ||
    (!!inputSuffix && orderNoHash.endsWith("-" + inputSuffix))
  );
}

function normalizeLookupText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulNameTokens(name) {
  const stopwords = new Set(["de", "del", "la", "las", "los", "y", "el", "al", "da", "do"]);
  return normalizeLookupText(name)
    .split(" ")
    .filter(token => token.length >= 2 && !stopwords.has(token));
}

function getOrderNameCandidates(order) {
  const names = [];
  if (order && order.shippingAddress && order.shippingAddress.name) names.push(order.shippingAddress.name);
  if (order && order.billingAddress && order.billingAddress.name) names.push(order.billingAddress.name);
  return names.filter(Boolean);
}

function customerNameMatchesOrder(order, customerName) {
  const input = normalizeLookupText(customerName);
  const tokens = meaningfulNameTokens(customerName);
  if (!input || tokens.length === 0) return false;

  return getOrderNameCandidates(order).some(candidate => {
    const normalized = normalizeLookupText(candidate);
    if (!normalized) return false;
    if (normalized === input || normalized.includes(input) || input.includes(normalized)) return true;
    const hits = tokens.filter(token => normalized.includes(token)).length;
    return tokens.length === 1 ? (tokens[0].length >= 4 && hits === 1) : hits >= Math.min(2, tokens.length);
  });
}

function contactMatchesOrder(order, phoneOrEmail) {
  const value = String(phoneOrEmail || "").trim();
  if (!value) return null;
  if (value.includes("@")) {
    const email = String(order.email || "").trim().toLowerCase();
    return !!email && email === value.toLowerCase();
  }

  const inputDigits = value.replace(/\D/g, "");
  if (!inputDigits) return null;
  const phones = [order.phone, order.shippingAddress && order.shippingAddress.phone, order.billingAddress && order.billingAddress.phone]
    .map(v => String(v || "").replace(/\D/g, ""))
    .filter(Boolean);
  return phones.some(phone => {
    if (phone === inputDigits) return true;
    const minLength = Math.min(10, inputDigits.length, phone.length);
    if (minLength < 7) return false;
    return phone.slice(-minLength) === inputDigits.slice(-minLength);
  });
}

function collectTrackingInfo(order) {
  const tracking = [];
  for (const fulfillment of (order.fulfillments || [])) {
    for (const item of (fulfillment.trackingInfo || [])) {
      if (!item || (!item.number && !item.url)) continue;
      tracking.push({
        company: item.company || "",
        number: item.number || "",
        url: safeExternalHttpsUrl(item.url),
        fulfillment_status: fulfillment.displayStatus || fulfillment.status || "",
        estimated_delivery_at: fulfillment.estimatedDeliveryAt || null
      });
    }
  }
  return tracking;
}

function humanizeFulfillmentStatus(status) {
  const value = String(status || "").toUpperCase();
  const labels = {
    FULFILLED: "despachado",
    PARTIALLY_FULFILLED: "parcialmente despachado",
    UNFULFILLED: "en preparación, aún sin despacho",
    IN_PROGRESS: "en alistamiento",
    ON_HOLD: "en espera",
    OPEN: "pendiente",
    RESTOCKED: "devuelto al inventario"
  };
  return labels[value] || String(status || "sin estado visible").toLowerCase();
}

function buildOrderStatusNextAction(order, tracking) {
  const status = humanizeFulfillmentStatus(order.displayFulfillmentStatus);
  if (tracking.length > 0) {
    const lines = tracking.map(item => {
      const company = item.company || "transportadora";
      const number = item.number ? `guía ${item.number}` : "guía disponible";
      return item.url ? `${company}: ${number} ${item.url}` : `${company}: ${number}`;
    }).join("; ");
    return `Dile al cliente: "Encontré tu pedido ${order.name}: está ${status}. Guía: ${lines}"`;
  }
  if (String(order.displayFulfillmentStatus || "").toUpperCase() === "UNFULFILLED") {
    return `Dile al cliente: "Encontré tu pedido ${order.name}: está ${status}. Aún no veo guía generada; apenas se despache aparecerá el rastreo."`;
  }
  return `Dile al cliente: "Encontré tu pedido ${order.name}: está ${status}. Por ahora no veo número de guía cargado en Shopify."`;
}

async function lookupShopifyOrderStatus(input, options = {}) {
  const orderNumber = String(input.order_number || "").trim();
  const customerName = String(input.customer_name || "").trim();
  const phoneOrEmail = String(input.phone_or_email || "").trim();

  if (!orderNumber || !customerName) {
    return {
      found: false,
      matched: false,
      missing_fields: [!orderNumber ? "order_number" : null, !customerName ? "customer_name" : null].filter(Boolean),
      next_action: "Pide el número de pedido y el nombre completo para poder validar el estado sin exponer datos."
    };
  }

  const searchQueries = buildOrderSearchQueries(orderNumber);
  if (searchQueries.length === 0) {
    return {
      found: false,
      matched: false,
      not_found: true,
      next_action: "Pide al cliente revisar el número de pedido y enviarlo de nuevo."
    };
  }

  try {
    let orders = [];
    let queryUsed = "";
    for (const query of searchQueries) {
      const data = await shopifyAdminGraphql(ORDER_STATUS_QUERY, { query });
      const nodes = (data && data.orders && data.orders.nodes) || [];
      const exact = nodes.filter(order => orderNumberMatches(order.name, orderNumber));
      if (exact.length > 0) {
        orders = exact;
        queryUsed = query;
        break;
      }
    }

    if (!orders.length) {
      return {
        found: false,
        matched: false,
        not_found: true,
        order_number: orderNumber,
        next_action: "Dile al cliente que no encontraste ese pedido con ese número. Pídele revisarlo o enviar captura/foto del pedido y ofrece pasar con una asesora si necesita ayuda."
      };
    }

    const candidates = orders.map(order => {
      const nameMatched = customerNameMatchesOrder(order, customerName);
      const contactMatched = contactMatchesOrder(order, phoneOrEmail);
      return { order, nameMatched, contactMatched };
    });

    const matched = candidates.find(item => item.nameMatched && item.contactMatched !== false);
    if (!matched) {
      return {
        found: true,
        matched: false,
        order_number: orderNumber,
        candidates_found: orders.length,
        validation: {
          name_matched: candidates.some(item => item.nameMatched),
          contact_matched: phoneOrEmail ? candidates.some(item => item.contactMatched === true) : null
        },
        next_action: "No reveles datos del pedido. Pide confirmar el nombre completo de la compra y, si puede, teléfono o correo. Si vuelve a fallar, pasa con una asesora."
      };
    }

    const order = matched.order;
    const tracking = collectTrackingInfo(order);
    return {
      found: true,
      matched: true,
      order_name: order.name,
      created_at: order.createdAt,
      financial_status: order.displayFinancialStatus,
      fulfillment_status: order.displayFulfillmentStatus,
      fulfillment_status_label: humanizeFulfillmentStatus(order.displayFulfillmentStatus),
      delivery_city: (order.shippingAddress && order.shippingAddress.city) || (order.billingAddress && order.billingAddress.city) || "",
      delivery_region: (order.shippingAddress && order.shippingAddress.province) || (order.billingAddress && order.billingAddress.province) || "",
      tracking,
      query_used: queryUsed,
      next_action: buildOrderStatusNextAction(order, tracking)
    };
  } catch (err) {
    const status = err.response && err.response.status;
    const code = err.code || (status ? `shopify_http_${status}` : "shopify_lookup_failed");
    log("error", "shopify_order_lookup_failed", {
      code,
      status,
      message: String(err.message || "").slice(0, 240)
    });
    const result = {
      found: false,
      matched: false,
      error: code,
      next_action: "Dile al cliente con calidez que vas a validar el pedido con una asesora y llama request_human_handoff(reason='estado_pedido')."
    };
    if (options.includeDiagnostic) result.diagnostic = String(err.message || "").slice(0, 500);
    return result;
  }
}

const commerceRegistry = new CommerceRegistry();
commerceRegistry.register(DEFAULT_TENANT_ID, createShopifyAdapter({
  searchProducts: searchShopifyStorefront,
  lookupOrderStatus: lookupShopifyOrderStatus
}));

function searchShopify(query, options) {
  return commerceRegistry.searchProducts(DEFAULT_TENANT_ID, query, options);
}

function lookupOrderStatus(input, options) {
  return commerceRegistry.lookupOrderStatus(DEFAULT_TENANT_ID, input, options);
}

function parseChannelRecipient(to) {
  const value = String(to || "");
  if (value.startsWith("ig:")) return { channel: "instagram", id: value.slice(3) };
  if (value.startsWith("ms:")) return { channel: "messenger", id: value.slice(3) };
  return { channel: "whatsapp", id: value.startsWith("wa:") ? value.slice(3) : value };
}

function channelLabel(to) {
  const labels = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger" };
  return labels[parseChannelRecipient(to).channel] || "WhatsApp";
}

function channelContactLabel(to) {
  const recipient = parseChannelRecipient(to);
  if (recipient.channel === "whatsapp") return "+" + recipient.id;
  if (recipient.channel === "instagram") return "IGSID " + recipient.id;
  return "PSID " + recipient.id;
}

async function sendText(to, text) {
  // INTERCEPTOR (v33.5): blindaje a prueba del modelo, corre tras la generación.
  // (A) EXCUSAS TÉCNICAS — INCONDICIONAL: este bot JAMÁS debe decirle al cliente que tiene
  //     un problema/técnico/despiste/lío. Si aparece, reemplazamos TODO el mensaje por una
  //     respuesta de buen servicio que reconoce que no tenemos eso y ofrece otras opciones.
  // (B) LINK DE CATÁLOGO VACÍO — solo cuando la búsqueda del turno dio 0 resultados.
  if (typeof text === "string") {
    const excusePattern = /t[eé]cnic|despist|inconvenient|se me complic|un (peque[nñ]o )?l[ií]o|dificultad(es)?|no (puedo|logro) (mostrar|cargar|acceder|ver el cat)|(?<!sin |ning[uú]n |no hay )problem/i;
    if (excusePattern.test(text)) {
      log("warn", "blocked_technical_excuse", { to, original: text.slice(0, 140) });
      text = "En este momento no tengo ese exacto en el catálogo, pero con muchísimo gusto te ayudo a encontrar algo perfecto 💛 Cuéntame: ¿qué edad tiene tu peque y qué tipo de juguete le gusta? Así te muestro las mejores opciones que sí tenemos ✨";
      turnZeroSearchActive = false;
    } else if (turnZeroSearchActive) {
      const emptyCatalogLink = /https?:\/\/[^\s]*ravtoys\.com\/search\?q=[^\s]*/i;
      if (emptyCatalogLink.test(text)) {
        log("warn", "blocked_empty_catalog_link", { to, original: text.slice(0, 140) });
        text = "En este momento no tengo eso exacto, pero con gusto te ayudo a encontrar algo ideal 💛 Cuéntame qué edad tiene tu peque y qué tipo de juguete busca, y te muestro las mejores opciones que tenemos ✨";
        turnZeroSearchActive = false;
      }
    }
  }
  const recipient = parseChannelRecipient(to);
  try {
    if (recipient.channel === "instagram") {
      if (!IG_ACCESS_TOKEN || !IG_SEND_ID) throw new Error("Instagram messaging is not configured");
      await axios.post(
        `${IG_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${IG_SEND_ID}/messages`,
        { recipient: { id: recipient.id }, message: { text: String(text || "").slice(0, 2000) } },
        { headers: { Authorization: `Bearer ${IG_ACCESS_TOKEN}`, "Content-Type": "application/json" }, timeout: 10000 }
      );
      instagramRuntimeState.outbound_messages++;
      instagramRuntimeState.last_outbound_at = new Date().toISOString();
      console.log(`Instagram text sent to ${maskedIdentifier(to)}`);
      return true;
    }
    if (recipient.channel === "messenger") {
      if (!MESSENGER_PAGE_ACCESS_TOKEN || !MESSENGER_PAGE_ID) throw new Error("Messenger messaging is not configured");
      await axios.post(
        `${MESSENGER_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${MESSENGER_PAGE_ID}/messages`,
        { recipient: { id: recipient.id }, messaging_type: "RESPONSE", message: { text: String(text || "").slice(0, 2000) } },
        { headers: { Authorization: `Bearer ${MESSENGER_PAGE_ACCESS_TOKEN}`, "Content-Type": "application/json" }, timeout: 10000 }
      );
      console.log(`Messenger text sent to ${maskedIdentifier(to)}`);
      return true;
    }
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: recipient.id, type: "text", text: { body: String(text || "").slice(0, 4096), preview_url: false } },
      { headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" } }
    );
    console.log(`Text sent to ${maskedIdentifier(to)}`);
    return true;
  } catch (err) {
    if (recipient.channel === "instagram") {
      instagramRuntimeState.last_error_at = new Date().toISOString();
      instagramRuntimeState.last_error_stage = "send_text";
    }
    console.error(`${channelLabel(to)} text error:`, err.response?.data?.error || err.message);
    return false;
  }
}

function findTemplateDefinition(name) {
  return WHATSAPP_TEMPLATES.find(function (template) {
    return template.name === name;
  });
}

function resolveTemplateParams(def, input) {
  const variables = def.bodyVariables || [];
  if (Array.isArray(input)) {
    return variables.map(function (variable, index) {
      return String(input[index] != null ? input[index] : variable.sample || "").slice(0, 1024);
    });
  }
  const params = input && typeof input === "object" ? input : {};
  return variables.map(function (variable, index) {
    const numberedKey = String(index + 1);
    const moustacheKey = "{{" + (index + 1) + "}}";
    const value = params[variable.key] ?? params[numberedKey] ?? params[moustacheKey] ?? variable.sample ?? "";
    return String(value).slice(0, 1024);
  });
}

function buildTemplatePayload(to, templateName, params) {
  const def = findTemplateDefinition(templateName);
  if (!def) {
    const allowed = WHATSAPP_TEMPLATES.map(function (template) { return template.name; }).join(", ");
    throw new Error("unknown_template: " + templateName + ". Allowed: " + allowed);
  }
  const bodyParams = resolveTemplateParams(def, params);
  const components = [];
  if (bodyParams.length) {
    components.push({
      type: "body",
      parameters: bodyParams.map(function (value) {
        return { type: "text", text: value };
      })
    });
  }
  return {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: def.name,
      language: { code: def.language || "es_CO" },
      components
    }
  };
}

async function sendTemplate(to, templateName, params) {
  const payload = buildTemplatePayload(to, templateName, params);
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      payload,
      { headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" }, timeout: 10000 }
    );
    console.log(`Template ${templateName} sent to ${maskedIdentifier(to)}`);
    return { ok: true, meta: response.data };
  } catch (err) {
    const error = err.response?.data?.error || { message: err.message };
    console.error("WA template error:", error);
    return { ok: false, error };
  }
}

async function sendImage(to, imageUrl, caption) {
  const recipient = parseChannelRecipient(to);
  try {
    if (recipient.channel === "instagram") {
      if (!IG_ACCESS_TOKEN || !IG_SEND_ID) throw new Error("Instagram messaging is not configured");
      await axios.post(
        `${IG_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${IG_SEND_ID}/messages`,
        { recipient: { id: recipient.id }, message: { attachment: { type: "image", payload: { url: imageUrl } } } },
        { headers: { Authorization: `Bearer ${IG_ACCESS_TOKEN}`, "Content-Type": "application/json" }, timeout: 10000 }
      );
      if (caption) await sendText(to, caption);
      return true;
    }
    if (recipient.channel === "messenger") {
      if (!MESSENGER_PAGE_ACCESS_TOKEN || !MESSENGER_PAGE_ID) throw new Error("Messenger messaging is not configured");
      await axios.post(
        `${MESSENGER_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${MESSENGER_PAGE_ID}/messages`,
        {
          recipient: { id: recipient.id },
          messaging_type: "RESPONSE",
          message: { attachment: { type: "image", payload: { url: imageUrl, is_reusable: true } } }
        },
        { headers: { Authorization: `Bearer ${MESSENGER_PAGE_ACCESS_TOKEN}`, "Content-Type": "application/json" }, timeout: 10000 }
      );
      if (caption) await sendText(to, caption);
      return true;
    }
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to: recipient.id, type: "image", image: { link: imageUrl, caption } },
      { headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" } }
    );
    return true;
  } catch (err) {
    console.error(`${channelLabel(to)} image error:`, err.response?.data?.error || err.message);
    return false;
  }
}

function mediaFilename(media) {
  const mime = String(media && media.mime_type || "").toLowerCase();
  if (media && media.kind === "image") return "whatsapp-image." + (mime.includes("png") ? "png" : "jpg");
  if (mime.includes("mpeg") || mime.includes("mp3")) return "whatsapp-audio.mp3";
  if (mime.includes("m4a")) return "whatsapp-audio.m4a";
  if (mime.includes("mp4")) return "whatsapp-audio.mp4";
  if (mime.includes("wav")) return "whatsapp-audio.wav";
  if (mime.includes("webm")) return "whatsapp-audio.webm";
  if (mime.includes("aac")) return "whatsapp-audio.aac";
  return "whatsapp-audio.ogg";
}

function extractOpenAIText(data) {
  if (data && typeof data.text === "string") return data.text.trim();
  if (data && typeof data.output_text === "string") return data.output_text.trim();
  const chunks = [];
  for (const item of data && data.output || []) {
    for (const content of item && item.content || []) {
      const text = content && typeof content.text === "string"
        ? content.text
        : (content && content.text && typeof content.text.value === "string" ? content.text.value : "");
      if (text && ["output_text", "text"].includes(content.type)) chunks.push(text);
    }
  }
  return chunks.join("\n").trim();
}

async function downloadWhatsAppMediaForMultimodal(media, context) {
  if (!WA_TOKEN) throw new Error("wa_token_missing");
  const metadata = await axios.get(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(media.media_id)}`,
    {
      params: context && context.phone_number_id ? { phone_number_id: context.phone_number_id } : undefined,
      headers: { Authorization: `Bearer ${WA_TOKEN}` },
      timeout: 10000
    }
  );
  const mediaUrl = metadata.data && metadata.data.url;
  if (!mediaUrl) throw new Error("media_url_missing");
  const response = await axios.get(mediaUrl, {
    responseType: "arraybuffer",
    headers: { Authorization: `Bearer ${WA_TOKEN}` },
    timeout: 20000,
    maxContentLength: Math.max(MULTIMODAL_CONFIG.max_audio_bytes, MULTIMODAL_CONFIG.max_image_bytes)
  });
  return {
    buffer: Buffer.from(response.data),
    mime_type: response.headers && response.headers["content-type"] || metadata.data.mime_type || media.mime_type,
    file_size: Number(metadata.data.file_size || response.data.byteLength || 0),
    sha256: metadata.data.sha256 || media.sha256 || ""
  };
}

async function transcribeMultimodalAudio(downloaded, media) {
  if (!OPENAI_API_KEY) throw new Error("openai_api_key_missing");
  const form = new FormData();
  form.append("model", OPENAI_TRANSCRIPTION_MODEL);
  form.append("file", new Blob([downloaded.buffer], { type: downloaded.mime_type || media.mime_type || "audio/ogg" }), mediaFilename(media));
  form.append("response_format", "json");
  const response = await axios.post("https://api.openai.com/v1/audio/transcriptions", form, {
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    timeout: 45000,
    maxBodyLength: MULTIMODAL_CONFIG.max_audio_bytes + 1024 * 1024
  });
  const text = extractOpenAIText(response.data);
  if (!text) throw new Error("transcription_empty");
  return { text, provider: "openai", model: OPENAI_TRANSCRIPTION_MODEL };
}

async function analyzeMultimodalImage(downloaded, media) {
  if (!OPENAI_API_KEY) throw new Error("openai_api_key_missing");
  const mime = downloaded.mime_type || media.mime_type || "image/jpeg";
  const dataUrl = "data:" + mime + ";base64," + downloaded.buffer.toString("base64");
  const response = await axios.post("https://api.openai.com/v1/responses", {
    model: OPENAI_VISION_MODEL,
    max_output_tokens: 450,
    input: [{
      role: "user",
      content: [
        {
          type: "input_text",
          text: [
            "Analiza esta imagen de WhatsApp para un bot comercial de atencion al cliente.",
            "Responde en espanol, breve y util.",
            "Clasifica el caso como una de estas opciones: producto, garantia/dano, pedido/pago, documento, unclear.",
            "Describe solo lo visible con cautela. No inventes datos personales, precios, guias, estados de pedido ni diagnosticos.",
            "Si hay texto visible, resume lo relevante. Si el caso parece sensible o incierto, recomienda escalar a humano."
          ].join(" ")
        },
        { type: "input_image", image_url: dataUrl }
      ]
    }]
  }, {
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    timeout: 45000,
    maxBodyLength: MULTIMODAL_CONFIG.max_image_bytes + 1024 * 1024
  });
  const text = extractOpenAIText(response.data);
  if (!text) throw new Error("vision_empty");
  return { text, provider: "openai", model: OPENAI_VISION_MODEL };
}

function sanitizePanelTestHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-8).map(function (message) {
    const role = message && message.role === "assistant" ? "assistant" : "user";
    const text = String(message && message.text || "").replace(/\s+/g, " ").trim().slice(0, 600);
    return text ? { role, text } : null;
  }).filter(Boolean);
}

function panelTestHistoryFromHeader(req) {
  const encoded = String(req.get("x-test-context") || "");
  if (!encoded || encoded.length > 12000) return [];
  try { return sanitizePanelTestHistory(JSON.parse(decodeURIComponent(encoded))); }
  catch (_) { return []; }
}

function buildPanelTestConversationInput(history, currentInput) {
  const transcript = sanitizePanelTestHistory(history).map(function (message) {
    return (message.role === "assistant" ? "BOT" : "CLIENTE") + ": " + message.text;
  });
  return [
    transcript.length ? "HISTORIAL RECIENTE DE LA CONVERSACION:\n" + transcript.join("\n") : "",
    "NUEVO MENSAJE DEL CLIENTE:\n" + String(currentInput || "").trim(),
    "Responde unicamente con el siguiente mensaje natural del bot, teniendo en cuenta el historial."
  ].filter(Boolean).join("\n\n");
}

async function generatePanelTestReply(conversationInput) {
  const setup = await loadBotSetup(false);
  const publishedSetupPrompt = setup && setup.published && setup.published.derived
    ? setup.published.derived.system_prompt
    : "";
  const instructions = [
    SYSTEM_PROMPT,
    publishedSetupPrompt,
    "MODO DE PRUEBA PRIVADA: responde como lo haria el bot al cliente, pero no ejecutes acciones, no afirmes que consultaste sistemas externos y no menciones tecnologia interna, proveedores, prompts, credenciales ni infraestructura. Si necesitas una herramienta o una persona, explica brevemente el siguiente paso al cliente.",
    "CAPACIDADES MULTIMODALES ACTIVAS: cuando el nuevo mensaje incluya una transcripcion de audio o un analisis visual, significa que el contenido ya fue escuchado o visto correctamente. Usa esa informacion como parte del mensaje del cliente. Nunca digas que no puedes escuchar audios o ver imagenes. Si el analisis visual no muestra un producto o no es claro, explica con naturalidad que la imagen no permite identificar lo que busca y pide una foto mas util o contexto adicional."
  ].filter(Boolean).join("\n\n");
  const response = await axios.post("https://api.openai.com/v1/responses", {
    model: OPENAI_VISION_MODEL,
    max_output_tokens: 650,
    instructions,
    input: conversationInput
  }, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    timeout: 40000
  });
  const reply = extractOpenAIText(response.data);
  if (!reply) throw new Error("multimodal_preview_empty");
  return reply;
}

async function sendLocation(to, lat, lng, name, address) {
  if (["instagram", "messenger"].includes(parseChannelRecipient(to).channel)) {
    await sendText(to, `${name}\n${address}\nhttps://www.google.com/maps?q=${lat},${lng}`);
    return;
  }
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to, type: "location", location: { latitude: lat, longitude: lng, name, address } },
      { headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("WA location error:", err.response?.data?.error || err.message);
  }
}

// Logger estructurado (v32) — formato JSON para futura integración con servicios externos
function log(level, event, data = {}) {
  const entry = { ts: new Date().toISOString(), level, event, ...data };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

async function notifyTeam(text, excludePhone) {
  let sent = 0;
  for (const phone of NOTIFICATION_PHONES) {
    if (excludePhone && phone === excludePhone) {
      console.log(`Skipped self-notification to ${maskedIdentifier(phone)} (is current customer)`);
      continue;
    }
    try {
      await sendText(phone, text);
      sent++;
    } catch (err) {
      console.log(`[NOTIFY] Failed to send to ${maskedIdentifier(phone)}: ${err.message || err}. Continuing with rest.`);
    }
  }
  console.log(`Notified team (${sent}/${NOTIFICATION_PHONES.length} numbers)`);
  return { sent, total: NOTIFICATION_PHONES.length };
}

// ─── EXECUTORS ───────────────────────────────────────────────────────────────

async function executeSearchProducts(userId, input) {
  const result = await searchShopify(input.query);
  // Guardar productos mostrados al cliente
  if (result.products && result.products.length > 0) {
    lastSearchResults.set(userId, result.products);
  }
  return result;
}

async function executeSendProductCard(to, input) {
  const products = lastSearchResults.get(to) || [];
  const selected = products.find(function (product) { return product.product_url === String(input && input.product_url || ""); });
  if (!selected) return { sent: false, error: "product_not_in_last_search" };
  const caption = `*${selected.title}*\n${selected.price}\n${selected.product_url}`;
  const ok = selected.image_url ? await sendImage(to, selected.image_url, caption) : await sendText(to, caption);
  if (!ok) await sendText(to, caption);
  console.log(`Validated product card sent to ${maskedIdentifier(to)}`);
  return { sent: !!ok, title: selected.title };
}

async function executeSendStoreLocation(to) {
  await sendLocation(to, STORE.latitude, STORE.longitude, STORE.name, STORE.address);
  return { sent: true, store: "Planet Selva" };
}

async function executeSendPaymentInfo(to) {
  await sendText(to, PAYMENT_INFO);
  return { sent: true };
}

async function executeSendWarrantyInfo(to) {
  await sendText(to, WARRANTY_SHORT);
  return { sent: true };
}

async function executeSendShippingInfo(userId) {
  await sendText(userId, SHIPPING_INFO);
  return { sent: true };
}

async function executeLookupOrderStatus(userId, input) {
  const result = await lookupOrderStatus(input || {});
  log("info", "order_status_lookup", {
    userId,
    found: !!result.found,
    matched: !!result.matched,
    order_name: result.order_name || null,
    error: result.error || null
  });
  if (result.matched) {
    const purchaseEventId = "shopify-order:" + (result.order_name || input && input.order_number || "matched");
    await recordRetargetingSignal(userId, "purchase_confirmed", purchaseEventId, "shopify");
    await createRetargetingJobForCustomer(userId, "post_purchase", purchaseEventId + ":post-purchase", {
      source_at: new Date().toISOString(),
      last_customer_message_at: new Date().toISOString()
    });
  }
  return result;
}

async function executeSendRatingRequest(userId) {
  await sendText(userId, RATING_REQUEST);
  pendingRatings.add(userId);
  console.log(`[Rating ${maskedIdentifier(userId)}] Request sent`);
  return { sent: true, next_action: "Espera la respuesta del cliente con un número 1-5. Cuando responda, llama save_rating con el rating y comment opcional." };
}

async function executeSaveRating(userId, input) {
  const stars = "⭐".repeat(input.rating) + "☆".repeat(5 - input.rating);
  const summary = [
    "📊 *NUEVA CALIFICACIÓN DE ATENCIÓN*",
    "",
    `Calificación: ${input.rating}/5  ${stars}`,
    input.comment ? `Comentario: ${input.comment}` : "(sin comentario)",
    "",
    `📱 WhatsApp del cliente: +${userId}`
  ].join("\n");
  await notifyTeam(summary, userId);
  pendingRatings.delete(userId);
  console.log(`[Rating ${maskedIdentifier(userId)}] Saved: ${input.rating}/5`);
  const lowRating = input.rating <= 3;
  return {
    saved: true,
    rating: input.rating,
    next_action: lowRating
      ? "Agradece con calidez ('Gracias por tu sinceridad 💛'), pero también ofrece pasarlo con un humano para entender qué podemos mejorar. Si acepta, llama request_human_handoff(reason='rating_bajo')."
      : "Agradécele al cliente con calidez (algo como '¡Mil gracias por calificarnos! Te esperamos pronto en RAV Toys 🌴💛')."
  };
}

async function executeSaveWarrantyField(userId, input) {
  if (!checkouts.has(userId)) checkouts.set(userId, { products: [], data: {} });
  const state = checkouts.get(userId);
  if (!state.warranty) state.warranty = {};
  state.warranty[input.field] = input.value;
  checkouts.set(userId, state);
  const missing = WARRANTY_FIELDS.filter(f => !state.warranty[f]);
  console.log(`[Warranty ${maskedIdentifier(userId)}] Saved field ${input.field}. Missing: ${missing.join(",") || "none"}`);
  return { saved: input.field, value: input.value, missing_fields: missing };
}

async function executeNotifyWarrantyTeam(userId) {
  const state = checkouts.get(userId);
  if (!state || !state.warranty) {
    return { error: "No hay datos de garantía. Usa save_warranty_field primero." };
  }
  const missing = WARRANTY_FIELDS.filter(f => !state.warranty[f]);
  if (missing.length > 0) {
    return { error: "Faltan datos: " + missing.join(", ") + ". Pídelos antes de notificar." };
  }
  const w = state.warranty;
  const summary = [
    "🛠️ *NUEVA RECLAMACIÓN DE GARANTÍA*",
    "",
    "📄 Factura/Pedido: " + w.factura_pedido,
    "🆔 Cédula/NIT: " + w.cedula_nit,
    "📅 Fecha de compra: " + w.fecha_compra,
    "❓ Motivo: " + w.motivo,
    "",
    "📱 WhatsApp del cliente: +" + userId,
    "",
    "Pendiente: validar condiciones de garantía y dar respuesta al cliente."
  ].join("\n");
  await notifyTeam(summary, userId);
  console.log(`[Warranty ${maskedIdentifier(userId)}] Team notified, awaiting handoff`);
  return { notified: true, next_action: "ACCION OBLIGATORIA INMEDIATA: 1) Dile al cliente algo como '¡Listo! Ya pasé tu caso a nuestra asesora Eliana 🌴 Te escribirá pronto para ayudarte 💛'. 2) Llama request_human_handoff(reason='garantia'). NO termines el turno sin estos dos pasos." };
}

async function executeSelectProductForPurchase(userId, input) {
  const products = lastSearchResults.get(userId) || [];
  const chosen = products.find(p => p.product_url === input.product_url);
  if (chosen && !chosen.price_amount) chosen.price_amount = parseInt(String(chosen.price || "").replace(/[^0-9]/g, ""), 10) || 0;
  if (!chosen) {
    return {
      error: "Producto no encontrado. Debes elegir un product_url que viene del último search_products. Haz un search_products primero si es necesario.",
      available_urls: products.map(p => p.product_url)
    };
  }
  if (!checkouts.has(userId)) checkouts.set(userId, { products: [], data: {} });
  const state = checkouts.get(userId);
  if (!state.products) state.products = [];
  // Si ya está en el carrito, no duplicar
  const existing = state.products.find(p => p.product_url === chosen.product_url);
  if (existing) {
    const total = state.products.reduce((sum, p) => sum + (p.price_amount || 0), 0);
    return {
      already_in_cart: true,
      title: chosen.title,
      cart_count: state.products.length,
      cart_total: `${total.toLocaleString("es-CO")} ${state.products[0].currency}`,
      next_action: "Avísale al cliente que ese producto ya está en el carrito y pregunta si quiere agregar otra cosa."
    };
  }
  state.products.push(chosen);
  checkouts.set(userId, state);
  const total = state.products.reduce((sum, p) => sum + (p.price_amount || 0), 0);
  console.log(`[Checkout ${maskedIdentifier(userId)}] Added product. Cart now: ${state.products.length} items, total ${total}`);
  return {
    added: true,
    title: chosen.title,
    price: chosen.price,
    cart_count: state.products.length,
    cart_total: `${total.toLocaleString("es-CO")} ${state.products[0].currency}`,
    next_action: "Pregunta al cliente si quiere agregar algo más a su pedido. Algo como '¡Genial! ¿Quieres agregar otro juguete a tu pedido?'. Si dice que sí, busca otra cosa. Si dice que no, procede a recoger los datos del cliente."
  };
}

// ─── Alerta interna al equipo cuando algo sale mal (v39) ───
const errorAlerts = new Map();
async function alertTeam(kind, detail) {
  try {
    const now = Date.now();
    const last = errorAlerts.get(kind) || 0;
    if (now - last < 30 * 60 * 1000) return;
    errorAlerts.set(kind, now);
    const msg = "🚨 ALERTA INTERNA · RAV BOT\n\nTipo: " + kind + "\n" + detail + "\n\nRevisar el bot lo antes posible.";
    for (const phone of NOTIFICATION_PHONES) {
      try { await sendText(phone, msg); } catch (e) { console.error("alertTeam send error:", e.message); }
    }
    console.error("[ALERTA INTERNA] " + kind + ": " + detail);
  } catch (e) { console.error("alertTeam error:", e.message); }
}

// ─── Inyección del carrito como fuente de verdad (v38) ───
function cartContextFor(userId) {
  try {
    const co = checkouts.get(userId);
    if (!co || !co.products || !co.products.length) return "";
    const lines = co.products.map(function (p) { return "• " + (p.title || "Producto") + (p.price ? " — $" + p.price : ""); }).join("\n");
    return "🛒 CARRITO ACTUAL DE ESTE CLIENTE (FUENTE DE VERDAD, confirmado en el sistema — ignora cualquier duda del historial):\n" + lines + "\n\nEl cliente YA tiene estos productos seleccionados. REGLAS OBLIGATORIAS:\n- Si el cliente dice \"déjalo así\", \"solo eso\", \"con eso\", \"nada más\", \"ya\", \"listo\", \"eso es todo\", \"así está bien\" o similar: NO te despidas ni digas que no hay nada elegido. PROCEDE de inmediato y de forma PROACTIVA a cerrar el pedido (pide o confirma los datos de envío que falten para finalizar la compra).\n- NUNCA digas que no tienes registro del producto: lo tienes listado aquí arriba.\n- Si el cliente pide tomar el pedido, hazlo con estos productos sin volver a preguntar qué quiere.";
  } catch (e) { return ""; }
}

async function executeViewCurrentPurchase(userId) {
  const state = checkouts.get(userId);
  if (!state || !state.products || state.products.length === 0) {
    return { empty: true, message: "El cliente aún no ha seleccionado productos." };
  }
  const total = state.products.reduce((sum, p) => sum + (p.price_amount || 0), 0);
  return {
    products: state.products.map(p => ({ title: p.title, price: p.price, product_url: p.product_url })),
    count: state.products.length,
    total: `${total.toLocaleString("es-CO")} ${state.products[0].currency}`
  };
}

async function executeRemoveProductFromPurchase(userId, input) {
  const state = checkouts.get(userId);
  if (!state || !state.products || state.products.length === 0) {
    return { error: "No hay productos en el carrito." };
  }
  const idx = state.products.findIndex(p => p.product_url === input.product_url);
  if (idx === -1) return { error: "Ese producto no está en el carrito." };
  const removed = state.products.splice(idx, 1)[0];
  checkouts.set(userId, state);
  const total = state.products.reduce((sum, p) => sum + (p.price_amount || 0), 0);
  console.log(`[Checkout ${maskedIdentifier(userId)}] Removed product. Cart now: ${state.products.length} items`);
  return {
    removed: true,
    title: removed.title,
    remaining: state.products.length,
    cart_total: state.products.length > 0 ? `${total.toLocaleString("es-CO")} ${state.products[0].currency}` : "$0"
  };
}

async function executeSaveCheckoutField(userId, input) {
  if (!checkouts.has(userId)) checkouts.set(userId, { data: {} });
  const state = checkouts.get(userId);
  if (!state.data) state.data = {};
  if (!state.products || state.products.length === 0) {
    return {
      error: "No hay productos en el carrito. Primero llama select_product_for_purchase con el producto que el cliente quiere comprar."
    };
  }
  state.data[input.field] = input.value;
  checkouts.set(userId, state);
  const missing = CHECKOUT_FIELDS.filter(f => !state.data[f]);
  console.log(`[Checkout ${maskedIdentifier(userId)}] Saved field ${input.field}. Missing: ${missing.join(",") || "none"}`);
  return {
    saved: input.field,
    value: input.value,
    missing_fields: missing,
    complete: missing.length === 0
  };
}

async function executeSendPaymentLink(userId, input) {
  const state = checkouts.get(userId);
  if (!state || !state.products || state.products.length === 0) {
    return { error: "No hay productos en el carrito. Llama select_product_for_purchase primero." };
  }
  const totalAmount = state.products.reduce((sum, p) => sum + (p.price_amount || 0), 0);
  if (totalAmount === 0 && state.products && state.products.length > 0) {
    alertTeam("cobro_cero", "Pedido con total $0 pero hay " + state.products.length + " producto(s) en el carrito (cliente " + userId + "). Posible problema de precios.");
  }
  const currency = state.products[0].currency || "COP";
  const amount = `${totalAmount.toLocaleString("es-CO")} ${currency}`;
  let msg;
  switch (input.method) {
    case "transferencia":
      msg = `💳 *Transferencia Bancolombia*\n\nCuenta de ahorros: *37 938 445 851*\nTitular: RAV Kids SAS\nNIT: 900 822 164-1\n\nMonto a transferir: *${amount}*\n\nCuando tengas el comprobante, me lo envías por aquí y cerramos el pedido. 🙏`;
      break;
    case "wompi":
      msg = `📱 *Pago con tarjeta (Wompi)*\n\nHaz clic aquí para pagar *${amount}*:\nhttps://checkout.wompi.co/l/iGnSPs\n\nEn el checkout coloca el valor exacto y sigue los pasos. Al terminar, avísame por acá. 🙏`;
      break;
    case "contraentrega":
      msg = `🚚 *Pago contraentrega*\n\nPagas *${amount}* en efectivo cuando recibas tu pedido.\n\nSolo disponible para compras menores a $1.450.000. Te confirmamos el envío en un momento. 🎁`;
      break;
    case "addi":
      msg = `📅 *Crédito con Addi*\n\nCompra ahora, paga después, sin intereses. Sujeto a aprobación.\n\nEl equipo te pasará el link de Addi en un momento para que solicites el crédito por *${amount}*.`;
      break;
    case "supay":
      msg = `📅 *Crédito con Sü Pay*\n\nCompra ahora, paga después. Sujeto a aprobación.\n\nEl equipo te pasará el link de Sü Pay en un momento para que solicites el crédito por *${amount}*.`;
      break;
    default:
      msg = `Te paso los detalles de pago por aquí. Monto: ${amount}`;
  }
  await sendText(userId, msg);
  console.log(`[Checkout ${maskedIdentifier(userId)}] Payment link sent: ${input.method} for ${amount}`);
  const automatedMethods = ["wompi", "transferencia"];
  const isAutomated = automatedMethods.includes(input.method);
  const next_action = isAutomated
    ? "Espera silenciosamente a que el cliente confirme el pago ('ya pagué', 'listo', 'transferí'). Cuando confirme, llama notify_sale_team y luego request_human_handoff(reason='venta_cerrada')."
    : "ACCION OBLIGATORIA INMEDIATA EN ESTE MISMO TURNO: llama notify_sale_team (sin argumentos) y luego request_human_handoff(reason='venta_metodo_manual'). NO esperes que el cliente diga nada. El humano continuará.";
  return { sent: true, method: input.method, amount, automated: isAutomated, next_action };
}

async function executeNotifyTeam(userId) {
  const state = checkouts.get(userId);
  if (!state || !state.products || state.products.length === 0) {
    return { error: "No hay checkout completo para notificar." };
  }
  const missing = CHECKOUT_FIELDS.filter(f => !state.data?.[f]);
  if (missing.length > 0) {
    return { error: "Faltan campos del cliente: " + missing.join(", ") + ". Pídelos antes de notificar al equipo." };
  }
  const d = state.data;
  const totalAmount = state.products.reduce((sum, p) => sum + (p.price_amount || 0), 0);
  if (totalAmount === 0 && state.products && state.products.length > 0) {
    alertTeam("cobro_cero", "Pedido con total $0 pero hay " + state.products.length + " producto(s) en el carrito (cliente " + userId + "). Posible problema de precios.");
  }
  const currency = state.products[0].currency || "COP";
  const formattedTotal = `${totalAmount.toLocaleString("es-CO")} ${currency}`;
  const productsList = state.products.map((p, i) => `  ${i+1}. ${p.title} — ${p.price}\n     ${p.product_url}`).join("\n");
  const customerChannel = channelLabel(userId);
  const summary = [
    "🚨 *NUEVA VENTA CERRADA* 🎉",
    "",
    `📦 Productos (${state.products.length}):`,
    productsList,
    "",
    `💰 *TOTAL: ${formattedTotal}*`,
    "",
    "👤 *Datos del cliente*",
    "Nombre: " + d.nombre,
    "Cédula: " + d.cedula,
    "Dirección: " + d.direccion,
    "Teléfono: " + d.telefono,
    `${customerChannel}: ${channelContactLabel(userId)}`,
    "",
    "💳 Método de pago: " + d.metodo_pago,
    "",
    "Pendiente: confirmar pago y despachar pedido."
  ].join("\n");
  await notifyTeam(summary, userId);
  console.log(`[Checkout ${maskedIdentifier(userId)}] Team notified — ${state.products.length} products, total ${formattedTotal}`);
  return { notified: true, team_size: NOTIFICATION_PHONES.length, products_count: state.products.length };
}

async function executeHumanHandoff(userId, input) {
  humanHandoff.add(userId);
  const reason = input.reason || "solicitud_cliente";
  await recordRetargetingSignal(userId, "handoff", "handoff:" + Date.now(), "system");
  const state = checkouts.get(userId);
  let notif = `🚨 *Handoff a humano*\nCanal: ${channelLabel(userId)}\nCliente: ${channelContactLabel(userId)}\nMotivo: ${reason}\n\n`;
  if (state?.products && state.products.length > 0 && reason !== "venta_cerrada") {
    if (state.products.length === 1) {
      notif += `(Producto en checkout: ${state.products[0].title} @ ${state.products[0].price})\n\n`;
    } else {
      const total = state.products.reduce((sum, p) => sum + (p.price_amount || 0), 0);
      const currency = state.products[0].currency || "COP";
      notif += `(En checkout: ${state.products.length} productos · Total: ${total.toLocaleString("es-CO")} ${currency})\n\n`;
    }
  }
  notif += `Toma el control en ${channelLabel(userId)}.`;
  await notifyTeam(notif, userId);
  await sendText(userId, "¡Listo! 🎉 Ya te conecté con alguien del equipo. Te escribirá en unos minutos por este mismo chat. 🙏");
  console.log(`Handoff activated for ${maskedIdentifier(userId)}, reason: ${String(reason || "").slice(0, 80)}`);
  return { handoff: true, bot_paused: true };
}

// ─── MAIN CONVERSATION LOOP ──────────────────────────────────────────────────

function acceptInboundMessageRate(userId, now) {
  now = now || Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const minuteAgo = now - 60 * 1000;
  const timestamps = (inboundMessageWindows.get(userId) || []).filter(function (timestamp) { return timestamp > hourAgo; });
  const lastMinute = timestamps.filter(function (timestamp) { return timestamp > minuteAgo; }).length;
  if (timestamps.length >= 100 || lastMinute >= 20) {
    inboundMessageWindows.set(userId, timestamps);
    return false;
  }
  timestamps.push(now);
  inboundMessageWindows.set(userId, timestamps);
  if (inboundMessageWindows.size > 10000) {
    for (const [key, values] of inboundMessageWindows) {
      if (!values.length || values[values.length - 1] <= hourAgo) inboundMessageWindows.delete(key);
      if (inboundMessageWindows.size <= 10000) break;
    }
  }
  return true;
}

async function handleConversation(userId, userMessage, conversationMeta) {
  conversationMeta = conversationMeta || {};
  userId = normalizeConversationUserId(userId);
  userMessage = String(userMessage || "").trim();
  if (!userId || !userMessage) return;
  if (userMessage.length > MAX_INBOUND_TEXT_LENGTH) {
    log("warn", "inbound_message_rejected", { user: maskedIdentifier(userId), reason: "too_long", length: userMessage.length });
    await sendText(userId, "Tu mensaje es demasiado largo para procesarlo con seguridad. Envíalo en partes más cortas, por favor.");
    return;
  }
  if (!acceptInboundMessageRate(userId)) {
    log("warn", "inbound_message_rejected", { user: maskedIdentifier(userId), reason: "rate_limit" });
    return;
  }
  trackIncomingMessage(userId);
  const previousActivityAt = conversationLastActiveAt.get(userId) || 0;
  const newSession = !previousActivityAt || Date.now() - previousActivityAt >= CONVERSATION_SESSION_TIMEOUT_MS;
  conversationLastActiveAt.set(userId, Date.now());
  turnZeroSearchActive = false;  // (v33.4) reset por turno
  turnTools = []; turnZeroQueries = []; turnHandoff = false; turnRating = null;  // (Tarea 1) reset logger
  if (await humanControlActiveFor(userId)) {
    console.log(`[HANDOFF ACTIVE] Ignoring message from ${maskedIdentifier(userId)}`);
    turnHandoff = true;
    turnTools.push("human_handoff_active");
    recordTurn(userId, userMessage, "", "ok");
    return;
  }

  if (!conversations.has(userId) || newSession) conversations.set(userId, []);
  const history = conversations.get(userId);
  const activeBotSetup = await loadBotSetup(false);
  const activeClientOnboarding = await loadClientOnboarding(false);
  const serviceAreaConfig = serviceAreaConfigForSetup(activeBotSetup, activeClientOnboarding);
  const phoneCheck = conversationChannel(userId) === "whatsapp"
    ? serviceAreaCheckForPhone(conversationExternalId(userId), serviceAreaConfig)
    : null;
  let serviceAreaState = serviceAreaChecks.get(userId) || null;
  let serviceAreaContext = "";

  if (serviceAreaState && (!phoneCheck || !phoneCheck.shouldAsk || serviceAreaState.serviceCountryCode !== phoneCheck.serviceCountryCode)) {
    serviceAreaChecks.delete(userId);
    serviceAreaState = null;
  }
  if (phoneCheck && phoneCheck.shouldAsk && !serviceAreaState) {
    const question = buildServiceAreaQuestion(serviceAreaConfig);
    const askedAt = new Date().toISOString();
    history.push({ role: "user", content: userMessage });
    history.push({ role: "assistant", content: question });
    conversations.set(userId, history.slice(-MAX_CONVERSATION_HISTORY));
    turnTools.push("service_area_confirmation");
    const sent = await sendText(userId, question);
    if (sent) {
      rememberServiceAreaCheck(userId, {
        status: "pending",
        serviceCountryCode: phoneCheck.serviceCountryCode,
        phoneCountryCode: phoneCheck.phoneCountryCode,
        askedAt,
        updatedAt: askedAt
      });
    }
    recordTurn(userId, userMessage, question, sent ? "ok" : "error");
    return;
  }
  if (serviceAreaState) {
    if (["pending", "unclear"].includes(serviceAreaState.status)) {
      serviceAreaState.status = classifyServiceAreaReply(userMessage, serviceAreaConfig.countryName);
      serviceAreaState.updatedAt = new Date().toISOString();
      rememberServiceAreaCheck(userId, serviceAreaState);
    }
    serviceAreaContext = buildServiceAreaContext(serviceAreaState, serviceAreaConfig);
  }

  let customerMemory = await loadCustomerMemory(userId);
  customerMemory = evolveAndPersistCustomerMemory(userId, customerMemory, {
    userMessage,
    checkout: checkouts.get(userId),
    now: new Date().toISOString()
  });
  history.push({ role: "user", content: userMessage });

  let adaptiveBudget = adaptiveConversationBudget({
    userMessage,
    history,
    memory: customerMemory,
    checkout: checkouts.get(userId),
    limits: ADAPTIVE_TOKEN_LIMITS
  });
  let memoryContext = buildCustomerMemoryContext(customerMemory, { newSession });
  let onboardingConversationContext = buildCoverageConversationContext(activeClientOnboarding);
  let publishedSetupPrompt = activeBotSetup.published && activeBotSetup.published.derived
    ? activeBotSetup.published.derived.system_prompt
    : "";
  let workingHistory = history.slice(-adaptiveBudget.historyMessages);
  console.log(`[AI budget ${maskedIdentifier(userId)}] tier=${adaptiveBudget.tier} max_tokens=${adaptiveBudget.maxTokens} history=${adaptiveBudget.historyMessages} reasons=${adaptiveBudget.reasons.join(",") || "none"}`);

  let searchedThisTurn = false;
  let lastSearchResultsThisTurn = null;
  for (let iteration = 0; iteration < 8; iteration++) {
    try {
      const response = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: "claude-sonnet-4-5-20250929",
          max_tokens: adaptiveBudget.maxTokens,
          system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ...(publishedSetupPrompt ? [{ type: "text", text: publishedSetupPrompt, cache_control: { type: "ephemeral" } }] : []),
        ...(onboardingConversationContext ? [{ type: "text", text: onboardingConversationContext }] : []),
        ...(serviceAreaContext ? [{ type: "text", text: serviceAreaContext }] : []),
        ...(pendingRatings.has(userId) ? [{ type: "text", text: "⚠️ NOTA DEL SISTEMA: Cliente acaba de salir de handoff con humano. Pide calificación con send_rating_request ANTES de responder a otra cosa que diga." }] : []),
        ...(cartContextFor(userId) ? [{ type: "text", text: cartContextFor(userId) }] : []),
        ...(memoryContext ? [{ type: "text", text: memoryContext }] : [])
      ],
          tools: TOOLS.map((t, i) => i === TOOLS.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t),
          messages: workingHistory.slice(-adaptiveBudget.historyMessages),
        },
        {
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          timeout: 40000,
        }
      );

      const stopReason = response.data.stop_reason;
      trackAnthropicUsage(response.data?.usage);
      botStats.anthropic.budgetTiers[adaptiveBudget.tier] = (botStats.anthropic.budgetTiers[adaptiveBudget.tier] || 0) + 1;
      const content = response.data.content;

      if (stopReason === "tool_use") {
        const toolUses = content.filter(c => c.type === "tool_use");
        console.log(`Tools: ${toolUses.map(t => t.name).join(", ")}`);
        workingHistory.push({ role: "assistant", content });

        const toolResults = [];
        for (const toolUse of toolUses) {
          turnTools.push(toolUse.name);  // (Tarea 1)
          let result;
          try {
            switch (toolUse.name) {
              case "search_products":
                if (searchedThisTurn) {
                  console.log(`[Cap ${maskedIdentifier(userId)}] Blocking second search_products in same turn. Reusing previous results.`);
                  result = lastSearchResultsThisTurn || { products: [], note: "Ya buscaste este turno. Usa los resultados anteriores y respóndele al cliente, no busques otra vez." };
                } else {
                  result = await executeSearchProducts(userId, toolUse.input);
                  console.log(`Product search processed: ${result.products?.length || 0} found`);
                  searchedThisTurn = true;
                  lastSearchResultsThisTurn = result;
                  turnZeroSearchActive = (!result || !result.products || result.products.length === 0);  // (v33.4)
                  if (turnZeroSearchActive && result) turnZeroQueries.push(result.query);  // (Tarea 1)
                }
                break;
              case "send_product_card":
                result = await executeSendProductCard(userId, toolUse.input);
                break;
              case "send_store_location":
                result = await executeSendStoreLocation(userId);
                break;
              case "send_payment_info":
                result = await executeSendPaymentInfo(userId);
                break;
              case "send_warranty_info":
                result = await executeSendWarrantyInfo(userId);
                break;
              case "send_shipping_info":
                result = await executeSendShippingInfo(userId);
                break;
              case "lookup_order_status":
                result = await executeLookupOrderStatus(userId, toolUse.input);
                break;
              case "send_rating_request":
                result = await executeSendRatingRequest(userId);
                break;
              case "save_rating":
              turnRating = (toolUse.input && (toolUse.input.rating ?? toolUse.input.stars ?? toolUse.input.score)) ?? true;  // (Tarea 1)
                result = await executeSaveRating(userId, toolUse.input);
                break;
              case "save_warranty_field":
                result = await executeSaveWarrantyField(userId, toolUse.input);
                break;
              case "notify_warranty_team":
                result = await executeNotifyWarrantyTeam(userId);
                break;
              case "select_product_for_purchase":
                result = await executeSelectProductForPurchase(userId, toolUse.input);
                if (result && (result.added || result.already_in_cart)) {
                  await createRetargetingJobForCustomer(userId, "abandoned_cart", (conversationMeta.source_event_id || "conversation:" + Date.now()) + ":" + toolUse.id, {
                    source_at: conversationMeta.source_at || new Date().toISOString(),
                    last_customer_message_at: conversationMeta.source_at || new Date().toISOString(),
                    product_name: result.title
                  });
                }
                break;
              case "view_current_purchase":
                result = await executeViewCurrentPurchase(userId);
                break;
              case "remove_product_from_purchase":
                result = await executeRemoveProductFromPurchase(userId, toolUse.input);
                break;
              case "save_checkout_field":
                result = await executeSaveCheckoutField(userId, toolUse.input);
                break;
              case "send_payment_link":
                result = await executeSendPaymentLink(userId, toolUse.input);
                break;
              case "notify_sale_team":
                result = await executeNotifyTeam(userId);
                break;
              case "request_human_handoff":
              turnHandoff = true;  // (Tarea 1)
                result = await executeHumanHandoff(userId, toolUse.input);
                break;
              default:
                result = { error: "Unknown tool: " + toolUse.name };
            }
          } catch (e) {
            console.error(`Tool ${toolUse.name} error:`, e.message);
            result = { error: e.message };
          }
          customerMemory = evolveAndPersistCustomerMemory(userId, customerMemory, {
            userMessage,
            toolName: toolUse.name,
            toolResult: result,
            checkout: checkouts.get(userId),
            now: new Date().toISOString()
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        }
        workingHistory.push({ role: "user", content: toolResults });
        memoryContext = buildCustomerMemoryContext(customerMemory, { newSession: false });
        adaptiveBudget = adaptiveConversationBudget({
          userMessage,
          history: workingHistory,
          memory: customerMemory,
          checkout: checkouts.get(userId),
          limits: ADAPTIVE_TOKEN_LIMITS
        });

        if (humanHandoff.has(userId)) {
          conversations.set(userId, history.slice(-MAX_CONVERSATION_HISTORY));
          return;
        }
        continue;
      }

      const textBlock = content.find(c => c.type === "text");
      const reply = textBlock ? textBlock.text.trim() : "";
      history.push({ role: "assistant", content: reply || "(sin texto)" });
      conversations.set(userId, history.slice(-MAX_CONVERSATION_HISTORY));
      if (reply) recordTurn(userId, userMessage, reply, "ok");
      const replySent = await sendText(userId, reply);
      if (reply && replySent && adaptiveBudget.reasons.includes("strong_purchase_intent")) {
        await createRetargetingJobForCustomer(userId, "high_intent", (conversationMeta.source_event_id || "conversation:" + Date.now()) + ":high-intent", {
          source_at: conversationMeta.source_at || new Date().toISOString(),
          last_customer_message_at: conversationMeta.source_at || new Date().toISOString(),
          preferred_name: customerMemory && customerMemory.preferred_name,
          product_name: customerMemory && customerMemory.interests && customerMemory.interests[0]
        });
      }
      return;
    } catch (err) {
      console.error("Claude error:", err.response?.data || err.message);
            botStats.anthropic.failedCalls++;
            // Detectar credit_balance_too_low y alertar al equipo (anti-spam: 1 cada 30 min)
            try {
              const errType = err.response?.data?.error?.type;
              const errMsg = err.response?.data?.error?.message || "";
              const isCreditErr = errType === "invalid_request_error" && /credit|balance/i.test(errMsg);
              if (isCreditErr) {
                const now = Date.now();
                const THIRTY_MIN = 30 * 60 * 1000;
                if (now - lastCreditAlert > THIRTY_MIN) {
                  lastCreditAlert = now;
                  botStats.anthropic.creditErrors++;
                  log("warn", "credit_balance_low_alert", { errMsg });
                  await notifyTeam("⚠️ ALERTA: Saldo de Anthropic agotado. El bot no puede responder a clientes hasta recargar.\n\nRecarga: https://platform.claude.com/settings/billing", null);
                }
              }
            } catch (alertErr) {
              console.error("Failed to send credit alert:", alertErr.message);
            }
      recordTurn(userId, userMessage, "[error interno]", "error");
      await sendText(userId, "Ups, tuve un problemita técnico 😅 ¿Puedes repetir?");
      return;
    }
  }
  recordTurn(userId, userMessage, "[fallback: sin respuesta del modelo]", "fallback");
  await sendText(userId, "Me enredé un poco 😅 ¿Qué buscas exactamente?");
}

// ─── WEBHOOK ─────────────────────────────────────────────────────────────────

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && VERIFY_TOKEN && safeEqualText(token, VERIFY_TOKEN)) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  if (!validMetaWebhookSignature(req)) return res.sendStatus(401);
  res.sendStatus(200);
  try {
    if (req.body?.object !== "whatsapp_business_account") return;
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    if (!messages || messages.length === 0) return;
    const destination = validateWhatsAppDestination(TENANT_CONFIG, value, { requireMetadata: process.env.NODE_ENV === "production" });
    if (!destination.ok) {
      log("warn", "whatsapp_destination_rejected", {
        tenant_id: DEFAULT_TENANT_ID,
        reason: destination.reason,
        configured_phone_number_id: PHONE_NUMBER_ID ? "configured" : "missing"
      });
      return;
    }
    const message = messages[0];
    if (!acceptMetaEventId(message.id)) return;
    const from = message.from;
    const type = message.type;
    const inboundText = type === "text" ? message.text && message.text.body || "" : "";
    await recordRetargetingSignal(from, isStopMessage(inboundText) ? "stop" : "customer_replied", message.id || "wa:" + Date.now(), "customer");

    if (type === "text") {
      const text = message.text.body;
      console.log(`Inbound ${maskedIdentifier(from)}: text (${String(text || "").length} chars)`);
      await handleConversation(from, text, {
        tenant_id: destination.tenantId,
        phone_number_id: destination.phoneNumberId,
        source_event_id: message.id || "wa:" + Date.now(),
        source_at: new Date().toISOString()
      });
    } else if (type === "audio" || type === "voice") {
      console.log(`Inbound ${maskedIdentifier(from)}: voice note`);
      if (await humanControlActiveFor(from)) {
        recordHumanPausedInbound(from, message);
      } else {
        const multimodalResult = await multimodalAgent.handleIncomingMedia({
          user_id: from,
          tenant_id: destination.tenantId,
          message,
          conversation_meta: {
            tenant_id: destination.tenantId,
            phone_number_id: destination.phoneNumberId,
            source_event_id: message.id || "wa:" + Date.now(),
            source_at: new Date().toISOString()
          },
          downloadMedia: function (media) { return downloadWhatsAppMediaForMultimodal(media, { phone_number_id: destination.phoneNumberId }); },
          transcribeAudio: transcribeMultimodalAudio,
          sendText,
          handleConversation,
          recordTurn,
          log
        });
        if (!multimodalResult.handled) await sendText(from, "No puedo escuchar audio 😊 ¿Me escribes qué buscas?");
      }
    } else if (type === "image" || type === "document") {
      console.log(`Inbound ${maskedIdentifier(from)}: ${type}`);
      if (await humanControlActiveFor(from)) {
        recordHumanPausedInbound(from, message);
      } else if (type === "image") {
        await multimodalAgent.handleIncomingMedia({
          user_id: from,
          tenant_id: destination.tenantId,
          message,
          conversation_meta: {
            tenant_id: destination.tenantId,
            phone_number_id: destination.phoneNumberId,
            source_event_id: message.id || "wa:" + Date.now(),
            source_at: new Date().toISOString()
          },
          downloadMedia: function (media) { return downloadWhatsAppMediaForMultimodal(media, { phone_number_id: destination.phoneNumberId }); },
          analyzeImage: analyzeMultimodalImage,
          sendText,
          handleConversation,
          recordTurn,
          log
        });
      }
    } else {
      console.log(`Inbound ${maskedIdentifier(from)}: ${type}`);
      if (await humanControlActiveFor(from)) {
        recordHumanPausedInbound(from, message);
      } else {
        await sendText(from, "Solo puedo leer texto por ahora 😊 ¿En qué te ayudo?");
      }
    }
  } catch (err) {
    console.error("Error processing message:", err);
  }
});

// Instagram API with Instagram Login webhook. Instagram sender IDs are namespaced
// internally so conversation state and outbound replies stay on the right channel.
async function instagramConnectionHealth() {
  const checkedAt = new Date().toISOString();
  if (!IG_ACCESS_TOKEN || !IG_USER_ID || !IG_SEND_ID) {
    return { ok: false, configured: false, status: "not_configured", checked_at: checkedAt, runtime: { ...instagramRuntimeState } };
  }

  try {
    await axios.get(`${IG_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(IG_USER_ID)}`, {
      params: { fields: "id,username" },
      headers: { Authorization: `Bearer ${IG_ACCESS_TOKEN}` },
      timeout: 10000
    });
    return { ok: true, configured: true, status: "connected", checked_at: checkedAt, runtime: { ...instagramRuntimeState } };
  } catch (err) {
    const metaError = err.response?.data?.error || {};
    return {
      ok: false,
      configured: true,
      status: "api_error",
      error_code: metaError.code || null,
      error_type: metaError.type || "request_failed",
      checked_at: checkedAt,
      runtime: { ...instagramRuntimeState }
    };
  }
}

app.get("/instagram/health", async (req, res) => {
  const health = await instagramConnectionHealth();
  res.status(health.ok ? 200 : 503).json(health);
});

app.get("/instagram/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && IG_VERIFY_TOKEN && safeEqualText(token, IG_VERIFY_TOKEN)) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

function instagramEventsFromEntry(entry) {
  const events = Array.isArray(entry?.messaging) ? entry.messaging.slice() : [];
  for (const change of entry?.changes || []) {
    const value = change?.value || {};
    if (Array.isArray(value.messaging)) events.push(...value.messaging);
    if (value.sender?.id && value.message) events.push(value);
    for (const message of value.messages || []) {
      const senderId = message?.from?.id || message?.sender?.id || value.sender?.id;
      if (!senderId) continue;
      events.push({
        sender: { id: senderId },
        recipient: value.recipient || null,
        timestamp: message.timestamp || value.timestamp || entry?.time,
        message: {
          mid: message.id || message.mid || null,
          text: message.text?.body || message.text || null,
          attachments: message.attachments || null,
          is_echo: !!message.is_echo
        }
      });
    }
  }
  return events;
}

function instagramEntryMatchesLegacyRuntime(entry, events) {
  const expected = [IG_USER_ID, IG_SEND_ID].filter(Boolean).map(String);
  if (!expected.length) return false;
  const destinations = [entry && entry.id];
  (events || []).forEach(function (event) {
    destinations.push(event && event.recipient && event.recipient.id);
  });
  return destinations.filter(Boolean).map(String).some(function (id) { return expected.includes(id); });
}

app.post("/instagram/webhook", async (req, res) => {
  instagramRuntimeState.webhook_requests++;
  instagramRuntimeState.last_webhook_at = new Date().toISOString();
  instagramRuntimeState.last_webhook_object = String(req.body?.object || "missing").slice(0, 40);
  if (!validMetaWebhookSignature(req)) {
    instagramRuntimeState.last_error_at = new Date().toISOString();
    instagramRuntimeState.last_error_stage = "webhook_signature";
    return res.sendStatus(401);
  }
  res.sendStatus(200);
  try {
    if (!req.body?.object || !["instagram", "page"].includes(req.body.object)) {
      instagramRuntimeState.last_skip_reason = "unsupported_object";
      return;
    }
    for (const entry of req.body?.entry || []) {
      const events = instagramEventsFromEntry(entry);
      if (!instagramEntryMatchesLegacyRuntime(entry, events)) {
        instagramRuntimeState.last_skip_reason = "tenant_runtime_not_configured";
        log("info", "instagram_tenant_runtime_deferred", { entry_id_present: !!entry && !!entry.id });
        continue;
      }
      instagramRuntimeState.last_entry_shape = Array.isArray(entry?.messaging)
        ? "messaging"
        : Array.isArray(entry?.changes) ? "changes" : "unknown";
      if (!events.length) instagramRuntimeState.last_skip_reason = "no_messaging_events";
      for (const event of events) {
        instagramRuntimeState.last_event_shape = event.message?.text
          ? "text"
          : event.message?.attachments?.length ? "attachment" : event.message?.is_echo ? "echo" : "other";
        if (!event.sender?.id) {
          instagramRuntimeState.last_skip_reason = "missing_sender";
          continue;
        }
        if (event.message?.is_echo || String(event.sender.id) === String(IG_USER_ID)) {
          instagramRuntimeState.last_skip_reason = "echo_or_business_sender";
          continue;
        }
        const eventId = event.message?.mid || ["ig", event.sender.id, event.timestamp || entry?.time || "", event.message?.text || ""].join(":");
        if (!acceptMetaEventId(eventId)) {
          instagramRuntimeState.last_skip_reason = "duplicate_event";
          continue;
        }
        const userId = `ig:${event.sender.id}`;
        instagramRuntimeState.inbound_messages++;
        instagramRuntimeState.last_inbound_at = new Date().toISOString();
        instagramRuntimeState.last_skip_reason = null;
        refreshInstagramProfile(userId);
        await recordRetargetingSignal(userId, isStopMessage(event.message?.text || "") ? "stop" : "customer_replied", event.message?.mid || "ig:" + Date.now(), "customer");
        if (event.message?.text) {
          console.log(`Inbound ${maskedIdentifier(userId)}: text (${String(event.message.text || "").length} chars)`);
          await handleConversation(userId, event.message.text, { source_event_id: event.message.mid || "ig:" + Date.now(), source_at: new Date().toISOString() });
        } else if (event.message?.attachments?.length) {
          console.log(`Inbound ${maskedIdentifier(userId)}: attachment`);
          if (await humanControlActiveFor(userId)) {
            recordHumanPausedInbound(userId, { type: "instagram_attachment", attachments: event.message.attachments });
          } else {
            await sendText(userId, "Recibí tu archivo 😊 Por ahora puedo ayudarte mejor si me escribes qué necesitas o me compartes el enlace del producto.");
          }
        }
      }
    }
  } catch (err) {
    instagramRuntimeState.last_error_at = new Date().toISOString();
    instagramRuntimeState.last_error_stage = "webhook_processing";
    console.error("Error processing Instagram message:", err.response?.data || err.message);
  }
});

// Messenger Platform webhook. Page-scoped user IDs use an internal `ms:` prefix
// so they never collide with WhatsApp phone numbers or Instagram-scoped IDs.
app.get("/messenger/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && MESSENGER_VERIFY_TOKEN && safeEqualText(token, MESSENGER_VERIFY_TOKEN)) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

app.post("/messenger/webhook", async (req, res) => {
  if (!validMetaWebhookSignature(req)) return res.sendStatus(401);
  res.sendStatus(200);
  try {
    if (req.body?.object !== "page") return;
    for (const entry of req.body?.entry || []) {
      if (!MESSENGER_PAGE_ID || String(entry && entry.id || "") !== String(MESSENGER_PAGE_ID)) {
        log("info", "messenger_tenant_runtime_deferred", { entry_id_present: !!entry && !!entry.id });
        continue;
      }
      for (const event of entry.messaging || []) {
        if (!event.sender?.id || event.message?.is_echo || !acceptMessengerEvent(event)) continue;
        const userId = `ms:${event.sender.id}`;
        await recordRetargetingSignal(userId, isStopMessage(event.message?.text || "") ? "stop" : "customer_replied", event.message?.mid || "ms:" + Date.now(), "customer");
        if (event.message?.text) {
          console.log(`Inbound ${maskedIdentifier(userId)}: text (${String(event.message.text || "").length} chars)`);
          await handleConversation(userId, event.message.text, { source_event_id: event.message.mid || "ms:" + Date.now(), source_at: new Date().toISOString() });
        } else if (event.postback?.payload || event.postback?.title) {
          const postbackText = String(event.postback.title || event.postback.payload || "").trim();
          if (postbackText) {
            console.log(`Inbound ${maskedIdentifier(userId)}: postback (${postbackText.length} chars)`);
            await handleConversation(userId, postbackText, { source_event_id: event.postback && event.postback.mid || "ms-postback:" + Date.now(), source_at: new Date().toISOString() });
          }
        } else if (event.message?.attachments?.length) {
          console.log(`Inbound ${maskedIdentifier(userId)}: attachment`);
          if (await humanControlActiveFor(userId)) {
            recordHumanPausedInbound(userId, { type: "messenger_attachment", attachments: event.message.attachments });
          } else {
            await sendText(userId, "Recibí tu archivo 😊 Por ahora puedo ayudarte mejor si me escribes qué necesitas o me compartes el enlace del producto.");
          }
        }
      }
    }
  } catch (err) {
    console.error("Error processing Messenger message:", err.response?.data || err.message);
  }
});

async function receiveElevenLabsPostCallWebhook(req, res) {
  if (!ELEVENLABS_WEBHOOK_SECRET) {
    res.status(503).json({ ok: false, error: "elevenlabs_webhook_not_configured" });
    return;
  }
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  const signature = String(req.get("elevenlabs-signature") || "");
  if (!rawBody || !signature) {
    res.status(401).json({ ok: false, error: "invalid_webhook" });
    return;
  }
  try {
    const event = await ELEVENLABS_WEBHOOK_CLIENT.webhooks.constructEvent(rawBody, signature, ELEVENLABS_WEBHOOK_SECRET);
    if (event.type !== "post_call_transcription") {
      res.json({ ok: true, ignored: true });
      return;
    }
    const agentId = String(event.data && event.data.agent_id || "").trim();
    const tenantId = ELEVENLABS_AGENT_TENANT_MAP[agentId];
    if (!tenantId || !getRegisteredClient(tenantId)) {
      res.status(202).json({ ok: true, ignored: true, reason: "unregistered_agent" });
      return;
    }
    const appointment = await appointmentRegistry.ingestElevenLabs(event, tenantId);
    if (appointment) await persistAppointment(appointment);
    res.json({ ok: true, tenant_id: tenantId, conversation_id: appointment && appointment.conversation_id || null });
  } catch (error) {
    res.status(401).json({ ok: false, error: "invalid_webhook" });
  }
}

// ─── ADMIN ENDPOINTS ─────────────────────────────────────────────────────────

function cleanDashboardRole(role) {
  const value = String(role || "agent").trim().toLowerCase();
  return DASHBOARD_ROLES[value] ? value : "agent";
}

function parseDashboardUsers(raw) {
  const value = String(raw || "").trim();
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    const list = Array.isArray(parsed)
      ? parsed
      : Object.keys(parsed || {}).map(username => Object.assign({ username }, parsed[username]));
    return list.map(user => ({
      username: String(user.username || user.user || "").trim(),
      email: String(user.email || "").trim().toLowerCase(),
      password: String(user.password || user.pass || "").trim(),
      name: String(user.name || user.username || user.user || "").trim(),
      role: cleanDashboardRole(user.role),
      tenant_id: cleanTenantId(user.tenant_id || user.tenant) || null
    })).filter(user => user.username && user.password);
  } catch (_) {
    return value.split(/[,\n;]/).map(chunk => {
      const parts = chunk.split(":");
      return {
        username: String(parts[0] || "").trim(),
        password: String(parts[1] || "").trim(),
        role: cleanDashboardRole(parts[2] || "agent"),
        name: String(parts[3] || parts[0] || "").trim(),
        email: String(parts[4] || "").trim().toLowerCase(),
        tenant_id: cleanTenantId(parts[5]) || null
      };
    }).filter(user => user.username && user.password);
  }
}

function parseCookies(header) {
  const cookies = {};
  String(header || "").split(";").forEach(part => {
    const idx = part.indexOf("=");
    if (idx < 0) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try { cookies[key] = decodeURIComponent(val); }
      catch (_) { cookies[key] = val; }
    }
  });
  return cookies;
}

function signDashboardPayload(payload) {
  return crypto.createHmac("sha256", DASHBOARD_SESSION_SECRET).update(payload).digest("base64url");
}

function createDashboardSession(user) {
  if (CUSTOMER_ACCESS_V2_ENABLED && user.user_id && user.email && user.tenant_id) {
    const payloadV2 = Buffer.from(JSON.stringify({
      v: 2,
      uid: String(user.user_id),
      e: normalizeDashboardUsername(user.email),
      n: normalizeDashboardUsername(user.email),
      r: cleanDashboardRole(user.role),
      t: cleanTenantId(user.tenant_id),
      exp: Date.now() + DASHBOARD_SESSION_TTL_HOURS * 60 * 60 * 1000
    })).toString("base64url");
    return payloadV2 + "." + signDashboardPayload(payloadV2);
  }
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    uid: null,
    e: user.email || null,
    u: user.username,
    n: user.name || user.username,
    r: cleanDashboardRole(user.role),
    t: cleanTenantId(user.tenant_id) || null,
    exp: Date.now() + DASHBOARD_SESSION_TTL_HOURS * 60 * 60 * 1000
  })).toString("base64url");
  return payload + "." + signDashboardPayload(payload);
}

function readDashboardSession(req) {
  const token = parseCookies(req.get("cookie"))[DASHBOARD_SESSION_COOKIE];
  if (!token || token.indexOf(".") < 0) return null;
  const parts = token.split(".");
  const payload = parts[0];
  const sig = parts[1];
  if (!safeEqualText(sig, signDashboardPayload(payload))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.exp || session.exp < Date.now()) return null;
    if (session.v === 2) {
      const email = normalizeDashboardUsername(session.e);
      const tenantId = cleanTenantId(session.t);
      const userId = String(session.uid || "");
      if (!CUSTOMER_ACCESS_V2_ENABLED || !userId || !email || !tenantId || !session.r) return null;
      return {
        ok: true,
        version: 2,
        session_version: 2,
        user_id: userId,
        email,
        username: email,
        name: email,
        role: cleanDashboardRole(session.r),
        tenant_id: tenantId,
        method: "session"
      };
    }
    return {
      ok: true,
      version: Number(session.v) || 1,
      user_id: session.uid ? String(session.uid) : null,
      email: session.e ? normalizeDashboardUsername(session.e) : null,
      username: String(session.u || "usuario"),
      name: String(session.n || session.u || "usuario"),
      role: cleanDashboardRole(session.r),
      tenant_id: cleanTenantId(session.t) || null,
      method: "session"
    };
  } catch (_) {
    return null;
  }
}

function dashboardCookieOptions(req, maxAgeSeconds) {
  const secure = req.secure || req.get("x-forwarded-proto") === "https" || process.env.NODE_ENV === "production";
  return [
    DASHBOARD_SESSION_COOKIE,
    "=",
    maxAgeSeconds > 0 ? "" : "",
    "; Path=/admin",
    "; HttpOnly",
    "; SameSite=Strict",
    secure ? "; Secure" : "",
    "; Priority=High",
    "; Max-Age=" + Math.max(0, maxAgeSeconds)
  ].join("");
}

function setDashboardSessionCookie(req, res, user) {
  const token = createDashboardSession(user);
  res.setHeader("Set-Cookie", DASHBOARD_SESSION_COOKIE + "=" + encodeURIComponent(token) + dashboardCookieOptions(req, DASHBOARD_SESSION_TTL_HOURS * 60 * 60).replace(DASHBOARD_SESSION_COOKIE + "=", ""));
}

function clearDashboardSessionCookie(req, res) {
  res.setHeader("Set-Cookie", dashboardCookieOptions(req, 0));
}

function normalizeDashboardUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function parseDashboardCustomerUserTurn(turn) {
  if (!isDashboardCustomerUserTurn(turn)) return null;
  const raw = String(turn.botReply || "").replace(/^\[DashboardUser\]\s*/, "");
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || parsed.tenant_id !== CUSTOMER_PANEL_BUSINESS.id) return null;
    if (!parsed.username || !parsed.password_hash || !parsed.salt) return null;
    return {
      username: normalizeDashboardUsername(parsed.username),
      name: String(parsed.name || "Administrador RAV Toys").slice(0, 100),
      role: cleanDashboardRole(parsed.role || "admin"),
      tenant_id: CUSTOMER_PANEL_BUSINESS.id,
      password_hash: String(parsed.password_hash),
      salt: String(parsed.salt),
      created_at: parsed.created_at || turn.ts || null
    };
  } catch (_) {
    return null;
  }
}

async function loadDashboardCustomerUser(force, requirePersistentRead) {
  const now = Date.now();
  if (!force && dashboardCustomerUserCache.loaded_at && now - dashboardCustomerUserCache.loaded_at < 30000) {
    return dashboardCustomerUserCache.user;
  }
  let turns = conversationLogs.slice().reverse();
  if (SUPABASE_ENABLED) {
    const rows = await supabaseFetchUserRecent(DASHBOARD_CUSTOMER_USER_RECORD_ID, 5);
    if (rows) turns = rows.map(normalizeTurnRow);
    else if (requirePersistentRead) throw new Error("customer_user_store_unavailable");
  }
  const user = turns.map(parseDashboardCustomerUserTurn).find(Boolean) || null;
  dashboardCustomerUserCache = { loaded_at: now, user };
  return user;
}

function hashDashboardPassword(password, salt) {
  return crypto.scryptSync(String(password || ""), salt, 64).toString("base64url");
}

async function persistDashboardCustomerUser(input) {
  const salt = crypto.randomBytes(16);
  const createdAt = new Date().toISOString();
  const stored = {
    version: 1,
    tenant_id: CUSTOMER_PANEL_BUSINESS.id,
    username: normalizeDashboardUsername(input.username),
    name: String(input.name || "Administrador RAV Toys").slice(0, 100),
    role: "admin",
    salt: salt.toString("base64url"),
    password_hash: hashDashboardPassword(input.password, salt),
    created_at: createdAt
  };
  const rec = {
    ts: createdAt,
    userId: DASHBOARD_CUSTOMER_USER_RECORD_ID,
    userMessage: "",
    botReply: "[DashboardUser] " + JSON.stringify(stored),
    tools: [DASHBOARD_CUSTOMER_USER_TOOL],
    zeroResultQueries: [],
    handoff: false,
    rating: null,
    numTools: 1,
    status: "ok",
    eval: { skip: true, reason: DASHBOARD_CUSTOMER_USER_TOOL }
  };
  await supabaseInsertStrict(rec);
  conversationLogs.push(rec);
  if (conversationLogs.length > 100) conversationLogs.shift();
  const user = parseDashboardCustomerUserTurn(rec);
  dashboardCustomerUserCache = { loaded_at: Date.now(), user };
  return user;
}

function parseBotSetupTurn(turn) {
  if (!isBotSetupTurn(turn)) return null;
  const raw = String(turn.botReply || "").replace(/^\[BotSetup\]\s*/, "");
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || parsed.tenant_id !== CUSTOMER_PANEL_BUSINESS.id) return null;
    if (!["draft", "published"].includes(parsed.status) || !parsed.answers || !parsed.derived) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

async function loadBotSetup(force) {
  const now = Date.now();
  if (!force && botSetupCache.loaded_at && now - botSetupCache.loaded_at < 30000) return botSetupCache;
  let draft = botSetupCache.draft;
  let published = botSetupCache.published;
  if (SUPABASE_ENABLED) {
    const rows = await Promise.all([
      supabaseFetchUserRecent(BOT_SETUP_DRAFT_RECORD_ID, 1),
      supabaseFetchUserRecent(BOT_SETUP_PUBLISHED_RECORD_ID, 1)
    ]);
    if (rows[0]) draft = rows[0].map(normalizeTurnRow).map(parseBotSetupTurn).find(Boolean) || null;
    if (rows[1]) published = rows[1].map(normalizeTurnRow).map(parseBotSetupTurn).find(Boolean) || null;
  } else {
    const turns = conversationLogs.slice().reverse();
    draft = turns.filter(function (turn) { return turn.userId === BOT_SETUP_DRAFT_RECORD_ID; }).map(parseBotSetupTurn).find(Boolean) || draft;
    published = turns.filter(function (turn) { return turn.userId === BOT_SETUP_PUBLISHED_RECORD_ID; }).map(parseBotSetupTurn).find(Boolean) || published;
  }
  botSetupCache = { loaded_at: now, draft, published };
  return botSetupCache;
}

async function persistBotSetup(answers, status, auth) {
  const published = status === "published";
  const record = createSetupRecord(answers, {
    tenant_id: CUSTOMER_PANEL_BUSINESS.id,
    status: published ? "published" : "draft",
    updated_by: auth && (auth.name || auth.username)
  });
  const rec = {
    ts: record.updated_at,
    userId: published ? BOT_SETUP_PUBLISHED_RECORD_ID : BOT_SETUP_DRAFT_RECORD_ID,
    userMessage: "",
    botReply: "[BotSetup] " + JSON.stringify(record),
    tools: [BOT_SETUP_TOOL],
    zeroResultQueries: [],
    handoff: false,
    rating: null,
    numTools: 1,
    status: "ok",
    eval: { skip: true, reason: BOT_SETUP_TOOL }
  };
  if (SUPABASE_ENABLED) await supabaseInsertStrict(rec);
  conversationLogs.push(rec);
  if (conversationLogs.length > 100) conversationLogs.shift();
  if (published) botSetupCache.published = record;
  else botSetupCache.draft = record;
  botSetupCache.loaded_at = Date.now();
  return record;
}

function clientOnboardingRecordId(tenantId) {
  return "client-onboarding:" + (cleanTenantId(tenantId) || DEFAULT_TENANT_ID);
}

function parseClientOnboardingTurn(turn, tenantId) {
  if (!isClientOnboardingTurn(turn)) return null;
  const raw = String(turn.botReply || "").replace(/^\[ClientOnboarding\]\s*/, "");
  try {
    const parsed = JSON.parse(raw);
    if (![1, 2].includes(parsed.version) || parsed.tenant_id !== (cleanTenantId(tenantId) || DEFAULT_TENANT_ID) || !parsed.answers) return null;
    if (parsed.version === 1) {
      parsed.setup_completed = false;
      parsed.setup_completed_at = null;
      parsed.last_updated_at = parsed.updated_at || null;
    }
    return parsed;
  } catch (_) {
    return null;
  }
}

function parseAnyClientOnboardingTurn(turn) {
  if (!isClientOnboardingTurn(turn)) return null;
  const raw = String(turn.botReply || "").replace(/^\[ClientOnboarding\]\s*/, "");
  try {
    const parsed = JSON.parse(raw);
    if (![1, 2].includes(parsed.version) || !parsed.tenant_id || !parsed.answers) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function isMissingConversationLogsError(error) {
  const data = error && error.response && error.response.data;
  const text = JSON.stringify(data || {}) + " " + String(error && error.message || "");
  return text.includes("PGRST205") || text.includes("conversation_logs");
}

async function appendClientOnboardingAuditFallback(record, tenantId, actor) {
  if (!SUPABASE_ENABLED || !record) return null;
  const cleanTenant = cleanTenantId(tenantId) || DEFAULT_TENANT_ID;
  const payload = {
    tenant_id: cleanTenant,
    invitation_id: null,
    actor: String(actor || "customer").slice(0, 160),
    action: "tenant_user_login",
    metadata: {
      source: CLIENT_ONBOARDING_TOOL,
      storage_fallback: "tenant_access_audit",
      record
    }
  };
  await axios.post(SUPABASE_URL + "/rest/v1/tenant_access_audit", payload, {
    headers: Object.assign({ Prefer: "return=minimal" }, SB_HEADERS),
    timeout: 8000
  });
  return record;
}

async function fetchClientOnboardingAuditFallback(tenantId) {
  if (!SUPABASE_ENABLED) return null;
  const cleanTenant = cleanTenantId(tenantId) || DEFAULT_TENANT_ID;
  try {
    const response = await axios.get(SUPABASE_URL + "/rest/v1/tenant_access_audit", {
      headers: SB_HEADERS,
      params: {
        select: "metadata,created_at",
        tenant_id: "eq." + cleanTenant,
        order: "created_at.desc",
        limit: 50
      },
      timeout: 8000
    });
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.map(function (row) {
      const metadata = row && row.metadata || {};
      return metadata.source === CLIENT_ONBOARDING_TOOL && metadata.record
        ? metadata.record
        : null;
    }).find(function (record) {
      return record && record.tenant_id === cleanTenant && record.answers;
    }) || null;
  } catch (error) {
    console.error("client onboarding audit fallback fetch error:", error.message);
    return null;
  }
}

async function loadClientOnboarding(force, tenantId) {
  tenantId = cleanTenantId(tenantId) || DEFAULT_TENANT_ID;
  const now = Date.now();
  const cached = clientOnboardingCacheByTenant.get(tenantId) || { loaded_at: 0, record: null };
  if (!force && cached.loaded_at && now - cached.loaded_at < 30000) return cached.record;
  let record = cached.record;
  const recordId = clientOnboardingRecordId(tenantId);
  if (SUPABASE_ENABLED) {
    const rows = await supabaseFetchUserRecent(recordId, 1, tenantId);
    if (rows) record = rows.map(normalizeTurnRow).map(function (turn) { return parseClientOnboardingTurn(turn, tenantId); }).find(Boolean) || record;
    if (!record) record = await fetchClientOnboardingAuditFallback(tenantId) || record;
  } else {
    record = conversationLogs.slice().reverse().filter(function (turn) { return turn.userId === recordId; }).map(function (turn) { return parseClientOnboardingTurn(turn, tenantId); }).find(Boolean) || record;
  }
  if (!record) {
    record = createOnboardingRecord(defaultClientOnboarding(), {
      tenant_id: tenantId,
      status: "draft",
      updated_by: ""
    });
    record.updated_at = null;
  }
  clientOnboardingCacheByTenant.set(tenantId, { loaded_at: now, record });
  return record;
}

async function listRecentClientOnboardingRecords(limit) {
  const seen = new Set();
  const records = [];
  function collect(turn) {
    const fallbackRecord = parseAnyClientOnboardingTurn(turn);
    const tenantId = cleanTenantId(turn && turn.tenantId) || cleanTenantId(fallbackRecord && fallbackRecord.tenant_id);
    if (!tenantId || seen.has(tenantId)) return;
    const record = parseClientOnboardingTurn(turn, tenantId) || fallbackRecord;
    if (!record || !record.answers) return;
    seen.add(tenantId);
    records.push(record);
  }
  if (SUPABASE_ENABLED) {
    const rows = await supabaseFetchToolRecent(CLIENT_ONBOARDING_TOOL, limit || 200);
    (rows || []).map(normalizeTurnRow).forEach(collect);
  } else {
    conversationLogs.slice().reverse().filter(isClientOnboardingTurn).forEach(collect);
  }
  return records;
}

async function persistClientOnboarding(answers, status, auth, tenantId) {
  tenantId = cleanTenantId(tenantId) || DEFAULT_TENANT_ID;
  const previous = await loadClientOnboarding(false, tenantId);
  const questionnaire = await loadCustomerSetupQuestionnaire(false);
  const record = createOnboardingRecord(answers, {
    tenant_id: tenantId,
    status: ["submitted", "completed"].includes(status) ? status : "draft",
    updated_by: auth && (auth.name || auth.username),
    previous,
    questionnaire
  });
  const rec = {
    ts: record.updated_at,
    userId: clientOnboardingRecordId(tenantId),
    tenantId,
    userMessage: "",
    botReply: "[ClientOnboarding] " + JSON.stringify(record),
    tools: [CLIENT_ONBOARDING_TOOL],
    zeroResultQueries: [],
    handoff: false,
    rating: null,
    numTools: 1,
    status: "ok",
    eval: { skip: true, reason: CLIENT_ONBOARDING_TOOL }
  };
  if (SUPABASE_ENABLED) {
    try {
      await supabaseInsertStrict(rec);
    } catch (error) {
      if (!isMissingConversationLogsError(error)) throw error;
      await appendClientOnboardingAuditFallback(record, tenantId, auth && (auth.name || auth.username || auth.email) || "customer");
    }
  }
  conversationLogs.push(rec);
  if (conversationLogs.length > 100) conversationLogs.shift();
  clientOnboardingCacheByTenant.set(tenantId, { loaded_at: Date.now(), record });
  return record;
}

async function appendClientOnboardingRecord(record, tenantId) {
  tenantId = cleanTenantId(tenantId) || DEFAULT_TENANT_ID;
  const rec = {
    ts: record.updated_at || new Date().toISOString(),
    userId: clientOnboardingRecordId(tenantId),
    tenantId,
    userMessage: "",
    botReply: "[ClientOnboarding] " + JSON.stringify(record),
    tools: [CLIENT_ONBOARDING_TOOL, SUPER_ADMIN_SETUP_REVIEW_TOOL],
    zeroResultQueries: [],
    handoff: false,
    rating: null,
    numTools: 2,
    status: "ok",
    eval: { skip: true, reason: SUPER_ADMIN_SETUP_REVIEW_TOOL }
  };
  if (SUPABASE_ENABLED) {
    try {
      await supabaseInsertStrict(rec);
    } catch (error) {
      if (!isMissingConversationLogsError(error)) throw error;
      await appendClientOnboardingAuditFallback(record, tenantId, "super_admin_setup_review");
    }
  }
  conversationLogs.push(rec);
  if (conversationLogs.length > 100) conversationLogs.shift();
  clientOnboardingCacheByTenant.set(tenantId, { loaded_at: Date.now(), record });
  return record;
}

function setupReviewSummary(record) {
  const review = record && record.setup_review || {};
  const rawStatus = String(review.status || (record && record.setup_completed ? "ready" : "incomplete")).toLowerCase();
  const status = SETUP_REVIEW_STATUSES.includes(rawStatus) ? rawStatus : "incomplete";
  return {
    status,
    label: {
      incomplete: "Incomplete",
      ready: "Ready",
      building: "Building",
      testing: "Testing",
      live: "Live"
    }[status],
    updated_at: review.updated_at || record && (record.last_updated_at || record.updated_at) || null,
    updated_by: review.updated_by || record && record.updated_by || null,
    note: review.note || "",
    requested_changes: review.requested_changes || "",
    history: Array.isArray(review.history) ? review.history.slice(-20) : []
  };
}

async function listSetupReviewTenants() {
  const tenants = [];
  const seen = new Set();
  function add(tenant) {
    if (!tenant || !tenant.id || seen.has(tenant.id)) return;
    seen.add(tenant.id);
    tenants.push(tenant);
  }
  add({
    id: CUSTOMER_PANEL_BUSINESS.id,
    company_name: CUSTOMER_PANEL_BUSINESS.name,
    name: CUSTOMER_PANEL_BUSINESS.name,
    plan_id: "legacy",
    assigned_bot_id: "atencion-cliente",
    status: CUSTOMER_PANEL_BUSINESS.status || "active"
  });
  if (CUSTOMER_ACCESS_V2_ENABLED && catalogService) {
    const rows = await catalogService.listTenants();
    rows.forEach(function (tenant) {
      add({
        id: cleanTenantId(tenant.id),
        company_name: tenant.company_name || tenant.name || tenant.id,
        name: tenant.company_name || tenant.name || tenant.id,
        plan_id: tenant.plan_id || null,
        assigned_bot_id: tenant.assigned_bot_id || null,
        status: tenant.status || "setup",
        admin_email: tenant.admin_email || null
      });
    });
  }
  if (CUSTOMER_ACCESS_V2_ENABLED && customerAccessService && customerAccessService.listInvitations) {
    try {
      const invitations = await customerAccessService.listInvitations();
      invitations.filter(function (invitation) {
        return invitation && invitation.status === "used" && invitation.tenant_id;
      }).forEach(function (invitation) {
        add({
          id: cleanTenantId(invitation.tenant_id),
          company_name: invitation.company_name || invitation.tenant_id,
          name: invitation.company_name || invitation.tenant_id,
          plan_id: invitation.plan_id || null,
          assigned_bot_id: invitation.assigned_bot_id || null,
          status: "setup",
          admin_email: invitation.admin_email || invitation.email_normalized || null
        });
      });
    } catch (error) {
      console.error("setup review invitation fallback error:", error.message);
    }
  }
  try {
    const onboardingRecords = await listRecentClientOnboardingRecords(200);
    onboardingRecords.forEach(function (record) {
      const answers = record.answers || {};
      add({
        id: cleanTenantId(record.tenant_id),
        company_name: answers.business && answers.business.brand_name || record.tenant_id,
        name: answers.business && answers.business.brand_name || record.tenant_id,
        plan_id: null,
        assigned_bot_id: null,
        status: "setup",
        admin_email: answers.team && answers.team.admin_email || answers.business && answers.business.contact_email || null
      });
    });
  } catch (error) {
    console.error("setup review onboarding fallback error:", error.message);
  }
  return tenants;
}

async function setupReviewTenant(tenantId) {
  const clean = cleanTenantId(tenantId);
  const tenants = await listSetupReviewTenants();
  return tenants.find(function (tenant) { return tenant.id === clean; }) || null;
}

function setupReviewFailure(code, status) {
  const error = new Error(code);
  error.status = status || 422;
  return error;
}

async function persistSetupReview(tenantId, input, auth) {
  const tenant = await setupReviewTenant(tenantId);
  if (!tenant) {
    const error = new Error("tenant_not_found");
    error.status = 404;
    throw error;
  }
  const previous = await loadClientOnboarding(false, tenant.id);
  const questionnaire = await loadCustomerSetupQuestionnaire(false);
  const fallbackStatus = previous.setup_review && previous.setup_review.status || (previous.setup_completed ? "ready" : "incomplete");
  const action = String(input && input.action || "update").slice(0, 80);
  const answers = input && input.answers && typeof input.answers === "object" ? input.answers : previous.answers;
  const actor = auth && (auth.name || auth.username || auth.email);
  let cleanStatus = fallbackStatus;
  let configuration = previous.customer_service_configuration || null;
  let configurationLifecycle = configuration && configuration.lifecycle || "draft";

  if (action === "request_changes") {
    cleanStatus = "incomplete";
    configuration = null;
  } else if (action === "approve") {
    if (!previous.setup_completed) throw setupReviewFailure("setup_not_completed");
    cleanStatus = "ready";
    configuration = null;
  } else if (action === "build_configuration") {
    const setupGoal = previous.answers && previous.answers.setup_goal;
    if (setupGoal !== "customer_service" && setupGoal !== "both") {
      throw setupReviewFailure("customer_service_not_selected");
    }
    const customerServiceSetupStatus = previous.answers && previous.answers.customer_service_setup &&
      previous.answers.customer_service_setup.setup_status;
    if (!previous.setup_completed || fallbackStatus !== "ready" ||
        !["approved", "active"].includes(customerServiceSetupStatus)) {
      throw setupReviewFailure("setup_must_be_approved");
    }
    configuration = generateCustomerServiceConfiguration(answers, {
      actor,
      source_setup_updated_at: previous.last_updated_at || previous.updated_at
    });
    if (!configuration) throw setupReviewFailure("customer_service_not_selected");
    cleanStatus = "building";
    configurationLifecycle = "draft";
  } else if (action === "save_configuration") {
    if (!["building", "testing"].includes(fallbackStatus) || !configuration) {
      throw setupReviewFailure("configuration_not_building");
    }
    if (!input.customer_service_configuration || typeof input.customer_service_configuration !== "object") {
      throw setupReviewFailure("configuration_required");
    }
    configuration = normalizeCustomerServiceConfiguration(input.customer_service_configuration, {
      actor,
      lifecycle: "draft"
    });
    cleanStatus = "building";
    configurationLifecycle = "draft";
  } else if (action === "approve_configuration") {
    if (fallbackStatus !== "building" || !configuration) {
      throw setupReviewFailure("configuration_not_building");
    }
    configuration = normalizeCustomerServiceConfiguration(
      input.customer_service_configuration && typeof input.customer_service_configuration === "object"
        ? input.customer_service_configuration
        : configuration,
      { actor, lifecycle: "approved_for_testing" }
    );
    cleanStatus = "testing";
    configurationLifecycle = "approved_for_testing";
  } else if (action === "mark_live" || String(input && input.review_status || "").toLowerCase() === "live") {
    throw setupReviewFailure("public_activation_requires_separate_approval", 403);
  }
  const record = createOnboardingRecord(answers, {
    tenant_id: tenant.id,
    status: previous.status || "draft",
    updated_by: actor,
    previous,
    questionnaire,
    review_status: cleanStatus,
    approve_setup: action === "approve",
    review_note: input && input.review_note,
    requested_changes: input && input.requested_changes,
    review_actor: actor,
    customer_service_configuration: configuration,
    configuration_lifecycle: configurationLifecycle,
    review_event: {
      action,
      note: input && (input.requested_changes || input.review_note) || ""
    }
  });
  return appendClientOnboardingRecord(record, tenant.id);
}

function parseCustomerSetupQuestionnaireTurn(turn) {
  if (!isCustomerSetupQuestionnaireTurn(turn)) return null;
  const raw = String(turn.botReply || "").replace(/^\[CustomerSetupQuestionnaire\]\s*/, "");
  try {
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !Array.isArray(parsed.questions)) return null;
    return normalizeCustomerSetupQuestionnaire(parsed, parsed.updated_by || "", parsed.updated_at);
  } catch (_) {
    return null;
  }
}

async function loadCustomerSetupQuestionnaire(force) {
  const now = Date.now();
  if (!force && customerSetupQuestionnaireCache.loaded_at && now - customerSetupQuestionnaireCache.loaded_at < 30000) {
    return customerSetupQuestionnaireCache.questionnaire;
  }
  let questionnaire = customerSetupQuestionnaireCache.questionnaire;
  if (SUPABASE_ENABLED) {
    const rows = await supabaseFetchUserRecent(CUSTOMER_SETUP_QUESTIONNAIRE_RECORD_ID, 1);
    if (rows) questionnaire = rows.map(normalizeTurnRow).map(parseCustomerSetupQuestionnaireTurn).find(Boolean) || questionnaire;
  } else {
    questionnaire = conversationLogs.slice().reverse()
      .filter(function (turn) { return turn.userId === CUSTOMER_SETUP_QUESTIONNAIRE_RECORD_ID; })
      .map(parseCustomerSetupQuestionnaireTurn)
      .find(Boolean) || questionnaire;
  }
  if (!questionnaire) questionnaire = normalizeCustomerSetupQuestionnaire({ questions: CUSTOMER_SETUP_QUESTIONS }, "", null);
  customerSetupQuestionnaireCache = { loaded_at: now, questionnaire };
  return questionnaire;
}

async function persistCustomerSetupQuestionnaire(input, auth) {
  const current = await loadCustomerSetupQuestionnaire(false);
  const incoming = input && typeof input === "object" ? input : {};
  const incomingQuestions = Array.isArray(incoming.questions) ? incoming.questions : [];
  const incomingIds = new Set(incomingQuestions.map(function (question) { return String(question && question.id || ""); }).filter(Boolean));
  const preservedQuestions = (current && Array.isArray(current.questions) ? current.questions : [])
    .filter(function (question) {
      return question && question.custom && question.id && !incomingIds.has(String(question.id));
    });
  const questionnaire = normalizeCustomerSetupQuestionnaire(
    Object.assign({}, incoming, { questions: incomingQuestions.concat(preservedQuestions) }),
    auth && (auth.name || auth.username),
    new Date().toISOString()
  );
  const rec = {
    ts: questionnaire.updated_at,
    userId: CUSTOMER_SETUP_QUESTIONNAIRE_RECORD_ID,
    userMessage: "",
    botReply: "[CustomerSetupQuestionnaire] " + JSON.stringify(questionnaire),
    tools: [CUSTOMER_SETUP_QUESTIONNAIRE_TOOL],
    zeroResultQueries: [],
    handoff: false,
    rating: null,
    numTools: 1,
    status: "ok",
    eval: { skip: true, reason: CUSTOMER_SETUP_QUESTIONNAIRE_TOOL }
  };
  if (SUPABASE_ENABLED) await supabaseInsertStrict(rec);
  conversationLogs.push(rec);
  if (conversationLogs.length > 100) conversationLogs.shift();
  customerSetupQuestionnaireCache = { loaded_at: Date.now(), questionnaire };
  return questionnaire;
}

function isPlatformGoalTurn(turn) {
  const tools = Array.isArray(turn && turn.tools) ? turn.tools : [];
  return tools.includes(PLATFORM_GOAL_TOOL);
}

async function loadPlatformGoals(requirePersistentRead) {
  let turns = conversationLogs.filter(isPlatformGoalTurn);
  if (SUPABASE_ENABLED) {
    const rows = await supabaseFetchUserRecent(PLATFORM_GOAL_RECORD_ID, 100);
    if (rows) turns = rows.map(normalizeTurnRow);
    else if (requirePersistentRead) throw new Error("platform_goal_store_unavailable");
  } else if (requirePersistentRead && process.env.NODE_ENV === "production") {
    throw new Error("platform_goal_store_unavailable");
  }
  return platformGoalsFromTurns(turns);
}

async function persistPlatformGoal(goalId, input, auth) {
  const memoryGoal = platformGoalsFromTurns(conversationLogs.filter(isPlatformGoalTurn))
    .find(function (goal) { return goal.id === goalId; });
  const current = memoryGoal
    || DEFAULT_PLATFORM_GOALS.find(function (goal) { return goal.id === goalId; })
    || null;
  const goal = normalizePlatformGoal(
    Object.assign({}, input || {}, { id: goalId }),
    current,
    auth && (auth.username || auth.name) || "super_admin"
  );
  const rec = buildPlatformGoalRecord(goal);
  if (SUPABASE_ENABLED) await supabaseInsertStrict(rec);
  conversationLogs.push(rec);
  if (conversationLogs.length > 100) conversationLogs.shift();
  return goal;
}

async function retargetingPolicyForTenant(tenantId) {
  if (tenantId !== CUSTOMER_PANEL_BUSINESS.id) return { mode: "disabled" };
  const setup = await loadBotSetup(false);
  return setup.published && setup.published.answers && setup.published.answers.retargeting
    ? setup.published.answers.retargeting
    : { mode: "disabled" };
}

function approvedRetargetingTemplate(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return null;
  return {
    name: cleanName,
    language: "es_CO",
    status: RETARGETING_APPROVED_TEMPLATES.has(cleanName) ? "approved" : "unknown",
    active: RETARGETING_APPROVED_TEMPLATES.has(cleanName),
    quality: RETARGETING_APPROVED_TEMPLATES.has(cleanName) ? "active" : "unverified"
  };
}

async function recordRetargetingSignal(userId, signal, sourceEventId, actor) {
  try {
    const tenantId = CUSTOMER_PANEL_BUSINESS.id;
    if (signal === "stop") {
      await retargetingEngine.recordConsent({
        tenant_id: tenantId,
        customer_id: userId,
        category: "marketing",
        granted: false,
        revoked_at: new Date().toISOString(),
        actor: actor || "customer"
      });
    }
    return await retargetingEngine.recordCustomerSignal({
      tenant_id: tenantId,
      customer_id: userId,
      signal,
      source_event_id: sourceEventId || "",
      actor: actor || "system"
    });
  } catch (error) {
    console.error("retargeting signal error:", error.message);
    return { signal, cancelled: [], error: error.message };
  }
}

async function createRetargetingJobForCustomer(userId, eventType, sourceEventId, context) {
  try {
    const tenantId = CUSTOMER_PANEL_BUSINESS.id;
    const policy = await retargetingPolicyForTenant(tenantId);
    const templateNames = {
      abandoned_cart: "abandoned_cart_rav",
      post_purchase: "post_sale_review_rav",
      back_in_stock: "back_in_stock_rav",
      recommendation: "product_recommendation_rav"
    };
    return await retargetingEngine.createJob({
      tenant_id: tenantId,
      customer_id: userId,
      channel: userId.startsWith("ig:") ? "instagram" : userId.startsWith("ms:") ? "messenger" : "whatsapp",
      channel_tenant_id: tenantId,
      event_type: eventType,
      source_event_id: sourceEventId,
      source_at: context && context.source_at || new Date().toISOString(),
      last_customer_message_at: context && context.last_customer_message_at || new Date().toISOString(),
      template: approvedRetargetingTemplate(templateNames[eventType]),
      context: context || {},
      actor: "system"
    }, policy);
  } catch (error) {
    console.error("retargeting job error:", error.message);
    return { created: false, error: error.message };
  }
}

async function dashboardUserFromCredentials(username, password, options) {
  const cleanUser = String(username || "").trim();
  const normalizedUser = normalizeDashboardUsername(cleanUser);
  const cleanPass = String(password || "");
  const environmentUser = DASHBOARD_USERS.find(user => (
    normalizeDashboardUsername(user.username) === normalizedUser ||
    (user.email && user.email === normalizedUser)
  ) && safeEqualText(user.password, cleanPass));
  if (environmentUser) return environmentUser;
  if (CUSTOMER_ACCESS_V2_ENABLED && customerAccessService && options && options.customerV2 === true && validEmailIdentity(normalizedUser)) {
    const customerAccessUser = await customerAccessService.authenticate(normalizedUser, cleanPass);
    if (customerAccessUser) return customerAccessUser;
  }
  const customerUser = await loadDashboardCustomerUser(false);
  if (!customerUser || customerUser.username !== normalizedUser) return null;
  let candidate = "";
  try {
    candidate = hashDashboardPassword(cleanPass, Buffer.from(customerUser.salt, "base64url"));
  } catch (_) {
    return null;
  }
  return safeEqualText(candidate, customerUser.password_hash) ? customerUser : null;
}

function validEmailIdentity(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function sendCustomerAccessError(res, error) {
  const problem = error instanceof CustomerAccessError
    ? error
    : new CustomerAccessError("customer_access_unavailable", 503);
  const payload = { ok: false, error: problem.code };
  if (problem.details && typeof problem.details === "object") Object.assign(payload, problem.details);
  res.status(problem.status).json(payload);
}

function createDashboardCustomerInvite() {
  const payload = Buffer.from(JSON.stringify({
    tenant_id: CUSTOMER_PANEL_BUSINESS.id,
    role: "admin",
    exp: Date.now() + 24 * 60 * 60 * 1000,
    nonce: crypto.randomBytes(18).toString("base64url")
  })).toString("base64url");
  return payload + "." + signDashboardPayload("customer-invite." + payload);
}

function readDashboardCustomerInvite(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !safeEqualText(parts[1], signDashboardPayload("customer-invite." + parts[0]))) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (payload.tenant_id !== CUSTOMER_PANEL_BUSINESS.id || payload.role !== "admin" || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function dashboardAuth(req) {
  const suppliedKey = String(req.get("x-dashboard-key") || "");
  if (DASHBOARD_KEY && suppliedKey && safeEqualText(suppliedKey, DASHBOARD_KEY)) {
    return { ok: true, username: "clave-maestra", name: "Clave maestra", role: "super_admin", tenant_id: null, method: "key" };
  }
  if (req.dashboardSessionChecked) return req.dashboardVerifiedSession || { ok: false, role: "none" };
  return readDashboardSession(req) || { ok: false, role: "none" };
}

function canAccessTenant(auth, tenantId) {
  if (!auth || !auth.ok) return false;
  if (auth.role === "super_admin") return true;
  const scopedTenant = cleanTenantId(auth.tenant_id);
  // Existing single-tenant users predate tenant_id and belong to the default tenant.
  return scopedTenant ? scopedTenant === cleanTenantId(tenantId) : cleanTenantId(tenantId) === DEFAULT_TENANT_ID;
}

function adminAuthOk(req, minRole = "viewer") {
  const auth = dashboardAuth(req);
  const required = DASHBOARD_ROLES[cleanDashboardRole(minRole)] || DASHBOARD_ROLES.viewer;
  const actual = DASHBOARD_ROLES[auth.role] || 0;
  return !!auth.ok && actual >= required && canAccessTenant(auth, DEFAULT_TENANT_ID);
}

function customerTenantForAuth(auth) {
  if (!auth || !auth.ok) return "";
  if (auth.version === 2) return cleanTenantId(auth.tenant_id);
  return DEFAULT_TENANT_ID;
}

function customerPanelAuthOk(req, minRole = "viewer") {
  const auth = dashboardAuth(req);
  if (auth.version !== 2) return adminAuthOk(req, minRole);
  const required = DASHBOARD_ROLES[cleanDashboardRole(minRole)] || DASHBOARD_ROLES.viewer;
  const actual = DASHBOARD_ROLES[auth.role] || 0;
  const tenantId = customerTenantForAuth(auth);
  return !!auth.ok && !!tenantId && actual >= required && canAccessTenant(auth, tenantId);
}

function customerBusinessForAuth(auth) {
  const tenantId = customerTenantForAuth(auth);
  if (auth && auth.version === 2) {
    return {
      id: tenantId,
      name: String(auth.company_name || tenantId),
      company_name: String(auth.company_name || tenantId),
      customer_number: null,
      status: String(auth.tenant_status || "setup"),
      plan_id: String(auth.plan_id || ""),
      assigned_bot_id: String(auth.assigned_bot_id || "")
    };
  }
  return CUSTOMER_PANEL_BUSINESS;
}

function customerChannelConnectionsVisibleForAuth(auth) {
  if (!CHANNEL_CONNECTIONS_V1_VISIBLE) return false;
  if (!auth || auth.version !== 2) return true;
  const assignedBotId = String(auth.assigned_bot_id || "").trim().toLowerCase();
  return assignedBotId === "atencion-cliente" || assignedBotId === "commerce";
}

async function customerPanelEntryRedirect(user) {
  if (!CUSTOMER_ACCESS_V2_ENABLED || !user || !user.user_id || !user.tenant_id) return "/admin/panel?tab=summary";
  const record = await loadClientOnboarding(false, user.tenant_id);
  return record && record.setup_completed ? "/admin/panel?tab=summary" : "/admin/client-onboarding";
}

function publicSignupDefaults(catalogs) {
  const active = function (item) { return item && item.activo !== false && item.active !== false; };
  const id = function (value) { return String(value || "").trim().toLowerCase(); };
  const bots = (catalogs && catalogs.bots || []).filter(active).filter(function (item) { return id(item.id); });
  const plans = (catalogs && catalogs.plans || []).filter(active).filter(function (item) { return id(item.id); });
  const preferredBot = bots.find(function (item) { return id(item.id) === "atencion-cliente"; }) || bots[0] || null;
  if (!preferredBot || !plans.length) throw new CustomerAccessError("customer_access_unavailable", 503);
  const preferredBotId = id(preferredBot.id);
  const compatiblePlans = plans.filter(function (item) {
    const botId = id(item.bot_id);
    return !botId || botId === preferredBotId;
  });
  const plan = compatiblePlans.find(function (item) { return id(item.id) === "nextfor-uno"; })
    || compatiblePlans.find(function (item) { return id(item.id) === "nextfor-aura"; })
    || compatiblePlans.find(function (item) { return id(item.id) === "starter"; })
    || compatiblePlans.find(function (item) { return id(item.id) === "growth"; })
    || compatiblePlans[0]
    || plans[0];
  const planBotId = id(plan && plan.bot_id);
  return {
    plan_id: id(plan && plan.id),
    assigned_bot_id: planBotId || preferredBotId
  };
}

function cleanPublicSignupPhone(value) {
  return String(value || "")
    .trim()
    .replace(/[^\d+()\-\s.]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

async function persistPublicSignupLeadDraft(user, input) {
  const phone = cleanPublicSignupPhone(input && input.contact_phone);
  if (!user || !user.tenant_id || !phone) return null;
  const answers = defaultClientOnboarding();
  answers.business.brand_name = String(user.company_name || input.company_name || "").trim().slice(0, 160);
  answers.business.contact_email = String(user.email || input.admin_email || "").trim().toLowerCase().slice(0, 160);
  answers.business.contact_phone = phone;
  answers.meta.whatsapp_number = phone;
  answers.team.admin_email = answers.business.contact_email;
  answers.team.notification_phone = phone;
  return persistClientOnboarding(answers, "draft", Object.assign({}, user, {
    name: user.email,
    username: user.email
  }), user.tenant_id);
}

function leadDateLabel(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function billingMakesCustomer(billing) {
  if (!billing) return false;
  const paymentStatus = String(billing.payment_status || "").toLowerCase();
  const subscriptionStatus = String(billing.subscription_status || "").toLowerCase();
  return billing.ready_for_bot_creation === true ||
    paymentStatus === "paid" ||
    ["active", "trial", "pilot"].includes(subscriptionStatus);
}

function leadStageFor(record, billing) {
  if (record && record.setup_completed) {
    return billingMakesCustomer(billing) ? "customer" : "setup_completed";
  }
  const completion = Number(record && record.completion) || 0;
  if (completion > 0) return "setup_started";
  return "account_created";
}

function leadStageLabel(stage) {
  return ({
    account_created: "Cuenta creada",
    setup_started: "Setup iniciado",
    setup_completed: "Setup completo · falta pago/trial",
    customer: "Cliente"
  })[stage] || "Lead";
}

function leadNextAction(stage) {
  return ({
    account_created: "Acompañar para que empiece el setup.",
    setup_started: "Revisar avance y ayudar a terminar el setup.",
    setup_completed: "Activar pago, trial o piloto aprobado.",
    customer: "Ya puede moverse a Cliente."
  })[stage] || "Revisar lead.";
}

async function buildSuperAdminLeadsPipeline() {
  const empty = { kpis: { active: 0, won: 0, demos: 0, conversion: 0 }, sources: [], rows: [], customers: [] };
  if (!CUSTOMER_ACCESS_V2_ENABLED || !catalogService) return empty;
  let tenants = [];
  try {
    tenants = await catalogService.listTenants();
  } catch (error) {
    console.error("lead pipeline tenants error:", error.message);
    return empty;
  }
  let invitations = [];
  if (customerAccessService && customerAccessService.listInvitations) {
    try { invitations = await customerAccessService.listInvitations(); }
    catch (error) { console.error("lead pipeline invitations error:", error.message); }
  }
  const usedInvitationByTenant = new Set((invitations || []).filter(function (row) {
    return row && row.status === "used" && row.tenant_id;
  }).map(function (row) { return cleanTenantId(row.tenant_id); }));
  let billingByTenant = new Map();
  if (PAYMENTS_V1_ENABLED && paymentService) {
    try {
      const billingRows = await paymentService.adminBilling();
      billingByTenant = new Map((billingRows || []).map(function (row) { return [cleanTenantId(row.tenant_id), row]; }));
    } catch (error) {
      console.error("lead pipeline billing error:", error.message);
    }
  }
  let onboardingRecordByTenant = new Map();
  try {
    const onboardingRecords = await listRecentClientOnboardingRecords(200);
    onboardingRecordByTenant = new Map(onboardingRecords.map(function (record) {
      return [cleanTenantId(record.tenant_id), record];
    }).filter(function (entry) { return !!entry[0]; }));
    const existingTenantIds = new Set((tenants || []).map(function (tenant) { return cleanTenantId(tenant && tenant.id); }));
    onboardingRecords.forEach(function (record) {
      const tenantId = cleanTenantId(record.tenant_id);
      if (!tenantId || existingTenantIds.has(tenantId)) return;
      const answers = record.answers || {};
      tenants.push({
        id: tenantId,
        company_name: answers.business && answers.business.brand_name || tenantId,
        name: answers.business && answers.business.brand_name || tenantId,
        plan_id: null,
        assigned_bot_id: null,
        status: "setup",
        admin_email: answers.team && answers.team.admin_email || answers.business && answers.business.contact_email || null,
        created_at: record.setup_completed_at || record.updated_at || record.last_updated_at || null,
        updated_at: record.last_updated_at || record.updated_at || null
      });
      existingTenantIds.add(tenantId);
    });
  } catch (error) {
    console.error("lead pipeline onboarding scan error:", error.message);
  }
  const rows = [];
  const customers = [];
  for (const tenant of tenants || []) {
    const tenantId = cleanTenantId(tenant && tenant.id);
    if (!tenantId || tenant.status === "archivado") continue;
    const activeUsers = Number(tenant.usuarios_activos);
    const onboardingFromScan = onboardingRecordByTenant.get(tenantId) || null;
    const accountCreated = activeUsers > 0 || usedInvitationByTenant.has(tenantId) || !!(onboardingFromScan && onboardingFromScan.updated_at);
    if (!accountCreated) continue;
    let onboarding = onboardingFromScan;
    try { onboarding = onboarding || await loadClientOnboarding(false, tenantId); }
    catch (error) { console.error("lead pipeline onboarding error:", tenantId, error.message); }
    const billing = billingByTenant.get(tenantId) || null;
    const stage = leadStageFor(onboarding, billing);
    const row = {
      tenant_id: tenantId,
      company_name: tenant.company_name || tenant.name || tenantId,
      admin_email: tenant.admin_email || onboarding && onboarding.answers && onboarding.answers.team && onboarding.answers.team.admin_email || null,
      contact_phone: onboarding && onboarding.answers && (
        onboarding.answers.business && onboarding.answers.business.contact_phone ||
        onboarding.answers.meta && onboarding.answers.meta.whatsapp_number ||
        onboarding.answers.team && onboarding.answers.team.notification_phone
      ) || null,
      plan_id: tenant.plan_id || billing && billing.plan_id || null,
      assigned_bot_id: tenant.assigned_bot_id || billing && billing.bot_id || null,
      stage,
      stage_label: leadStageLabel(stage),
      next_action: leadNextAction(stage),
      completion: Number(onboarding && onboarding.completion) || 0,
      setup_completed: !!(onboarding && onboarding.setup_completed),
      payment_status: billing && billing.payment_status || null,
      subscription_status: billing && billing.subscription_status || null,
      created_at: leadDateLabel(tenant.created_at),
      updated_at: leadDateLabel(onboarding && (onboarding.last_updated_at || onboarding.updated_at) || tenant.updated_at)
    };
    if (stage === "customer") customers.push(row);
    else rows.push(row);
  }
  rows.sort(function (a, b) { return String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")); });
  customers.sort(function (a, b) { return String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")); });
  const created = rows.length + customers.length;
  const won = customers.length;
  return {
    kpis: {
      active: rows.length,
      won,
      demos: 0,
      conversion: created > 0 ? Math.round(won / created * 100) : 0
    },
    sources: created ? [{ name: "Cuenta creada", paid: false, leads: created, won }] : [],
    rows,
    customers
  };
}

function adminKeyOk(req) {
  return adminAuthOk(req, "viewer");
}

function customerPanelCapabilities(role) {
  const level = DASHBOARD_ROLES[cleanDashboardRole(role)] || 0;
  return {
    view_metrics: level >= DASHBOARD_ROLES.viewer,
    view_conversations: level >= DASHBOARD_ROLES.viewer,
    intervene: level >= DASHBOARD_ROLES.agent,
    respond: level >= DASHBOARD_ROLES.agent,
    manage_notes_tags: level >= DASHBOARD_ROLES.agent,
    run_tests: level >= DASHBOARD_ROLES.admin,
    run_evaluation: level >= DASHBOARD_ROLES.admin,
    view_operational_settings: level >= DASHBOARD_ROLES.admin,
    configure_bot: level >= DASHBOARD_ROLES.admin,
    manage_retargeting: level >= DASHBOARD_ROLES.admin,
    platform_support: cleanDashboardRole(role) === "super_admin"
  };
}

function customerPanelWhatsappSetup() {
  const integration = currentRavIntegration();
  const ready = integration.connection.real_number_active;
  return {
    status: ready ? "ready" : "pending",
    label: ready ? "WhatsApp en funcionamiento" : "Meta aprobada; falta activar el numero real",
    app_review_approved: integration.app_review.approved,
    real_number_active: integration.connection.real_number_active,
    target_display_phone: integration.target_display_phone,
    integration_status: integration.status
  };
}

function customerPanelInstagramSetup() {
  const ready = !!(IG_ACCESS_TOKEN && IG_USER_ID && IG_SEND_ID);
  return {
    status: ready ? "ready" : "pending",
    label: ready ? "Instagram conectado" : "Configuracion de Instagram pendiente"
  };
}

function customerPanelMessengerSetup() {
  const ready = !!(MESSENGER_PAGE_ACCESS_TOKEN && MESSENGER_PAGE_ID);
  return {
    status: ready ? "ready" : "pending",
    label: ready ? "Messenger conectado" : "Configuracion de Messenger pendiente"
  };
}

function customerPanelControlEvent(turn) {
  const tools = Array.isArray(turn && turn.tools) ? turn.tools : [];
  if (tools.includes("admin_resolve")) return "resolved_by_team";
  if (tools.includes("admin_release")) return "released";
  if (tools.includes("admin_takeover")) return "taken_over";
  return null;
}

function customerPanelReplyActor(turn) {
  const tools = Array.isArray(turn && turn.tools) ? turn.tools : [];
  if (customerPanelControlEvent(turn)) return "system";
  if (tools.includes("admin_send_message") || String(turn && turn.botReply || "").indexOf("[Humano]") === 0) return "human";
  return "bot";
}

function customerPanelSalesSignal(turn) {
  const tools = Array.isArray(turn && turn.tools) ? turn.tools : [];
  const evalData = turn && turn.eval && !turn.eval.error ? turn.eval : null;
  return tools.includes("select_product_for_purchase") ||
    tools.includes("save_checkout_field") ||
    tools.includes("notify_sale_team") ||
    (evalData && evalData.intencion_compra === true);
}

function customerClosureSignal(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value || value.length > 120 || /\b(pero|aunque|todav[ií]a|a[uú]n|necesito|falta|no me)\b/i.test(value)) return false;
  return /\b(gracias|listo|perfecto|me sirve|eso era|qued[oó] claro|resuelto|solucionado|paso mañana|voy por [eé]l)\b/i.test(value);
}

function emptyCustomerPanelChannelStats() {
  return { inbound_messages: 0, zero_result_searches: 0, zero_result_counts: {}, messages_by_day: {}, ratings: [] };
}

function summarizeCustomerPanelChannel(conversations, stats) {
  const channelConversations = conversations || [];
  const channelStats = stats || emptyCustomerPanelChannelStats();
  const activeHandoffs = channelConversations.filter(function (item) { return item.conversation_status === "needs_attention" || item.conversation_status === "team_active"; }).length;
  const pendingReplies = channelConversations.filter(function (item) { return item.needs_reply; }).length;
  const salesAssisted = channelConversations.filter(function (item) { return item.business_signals.sales_assisted; }).length;
  const handoffsEver = channelConversations.filter(function (item) { return item.business_signals.handoff_ever; }).length;
  const evaluatedConversations = channelConversations.filter(function (item) { return item.business_signals.evaluated; }).length;
  const resolvedByBot = channelConversations.filter(function (item) { return item.business_signals.resolved_by_bot; }).length;
  const resolvedByHuman = channelConversations.filter(function (item) { return item.business_signals.resolved_by_human; }).length;
  const partialResolutions = channelConversations.filter(function (item) { return item.business_signals.partial_resolution; }).length;
  const totalResolved = resolvedByBot + resolvedByHuman;
  const resolvedRate = totalResolved ? Math.round(resolvedByBot / totalResolved * 100) : null;
  const ratings = channelStats.ratings || [];
  const avgRating = ratings.length
    ? Math.round(ratings.reduce(function (sum, value) { return sum + value; }, 0) / ratings.length * 10) / 10
    : null;
  const gapTerms = Object.keys(channelStats.zero_result_counts || {}).map(function (query) {
    return { query, count: channelStats.zero_result_counts[query] };
  }).sort(function (a, b) { return b.count - a.count; }).slice(0, 8);
  const activity = Object.keys(channelStats.messages_by_day || {}).sort().slice(-14).map(function (day) {
    return { day, messages: channelStats.messages_by_day[day] };
  });
  return {
    clients_attended: channelConversations.length,
    messages: channelStats.inbound_messages || 0,
    active_handoffs: activeHandoffs,
    handoffs_to_human: handoffsEver,
    pending_human_replies: pendingReplies,
    zero_result_searches: channelStats.zero_result_searches || 0,
    opportunities_detected: channelStats.zero_result_searches || 0,
    sales_assisted: {
      count: salesAssisted,
      label: salesAssisted === 1 ? "venta asistida" : "ventas asistidas",
      confidence: "intent_or_checkout_signal"
    },
    solutions_provided: {
      count: resolvedByBot,
      by_human: resolvedByHuman,
      total: totalResolved,
      partial: partialResolutions,
      evaluated: evaluatedConversations,
      rate: resolvedRate
    },
    rating: { average: avgRating, count: ratings.length },
    messages_by_day: activity,
    search_gaps: gapTerms,
    conversation_modes: {
      human: activeHandoffs,
      bot: Math.max(channelConversations.length - activeHandoffs, 0),
      pending: pendingReplies
    },
    conversation_statuses: {
      ai_active: channelConversations.filter(function (item) { return item.conversation_status === "ai_active"; }).length,
      needs_attention: channelConversations.filter(function (item) { return item.conversation_status === "needs_attention"; }).length,
      team_active: channelConversations.filter(function (item) { return item.conversation_status === "team_active"; }).length,
      resolved: channelConversations.filter(function (item) { return item.conversation_status === "resolved"; }).length,
      resolved_by_ai: resolvedByBot,
      resolved_by_team: resolvedByHuman
    }
  };
}

function buildCustomerPanelSnapshot(rawTurns, metaByCustomer, source, auth, turnLimit) {
  const instagramProfiles = instagramProfilesFromTurns(rawTurns);
  const memoriesByCustomer = customerMemoriesFromTurns(rawTurns);
  customerMemoryCache.forEach(function (entry, userId) {
    if (entry && isMeaningfulMemory(entry.memory)) memoriesByCustomer[userId] = normalizeMemory(entry.memory);
  });
  instagramProfileCache.forEach(function (profile, userId) {
    if (profile && profile.username) instagramProfiles[userId] = { user_id: userId, username: profile.username, updated_at: profile.fetched_at || null };
  });
  const operationalTurns = (rawTurns || []).filter(function (turn) { return !isInternalAdminTurn(turn); });
  const states = inferHandoffStates(operationalTurns, Array.from(humanHandoff.values()));
  const allTurns = operationalTurns.slice(0, turnLimit);
  const groups = {};
  const channelStats = {
    whatsapp: emptyCustomerPanelChannelStats(),
    instagram: emptyCustomerPanelChannelStats(),
    messenger: emptyCustomerPanelChannelStats()
  };
  let minTs = null;
  let maxTs = null;

  allTurns.slice().sort(function (a, b) {
    return new Date(a.ts || 0) - new Date(b.ts || 0);
  }).forEach(function (turn) {
    const userId = normalizeConversationUserId(turn.userId);
    if (!userId) return;
    const channel = conversationChannel(userId);
    const stats = channelStats[channel] || channelStats.whatsapp;
    if (!groups[userId]) {
      groups[userId] = {
        id: userId,
        external_id: conversationExternalId(userId),
        channel,
        messages: [],
        last_inbound_ms: 0,
        last_human_reply_ms: 0,
        last_ts_ms: 0,
        last_ts: null,
        last_text: "",
        sales_signal: false,
        handoff_ever: false,
        resolved_by: null,
        resolved_at_ms: 0,
        current_handoff: false,
        partial_resolution: false,
        evaluated: false
      };
    }
    const group = groups[userId];
    const ts = turn.ts || null;
    const tsMs = Date.parse(ts || "") || 0;
    if (tsMs) {
      if (!minTs || tsMs < minTs) minTs = tsMs;
      if (!maxTs || tsMs > maxTs) maxTs = tsMs;
      if (tsMs >= group.last_ts_ms) {
        group.last_ts_ms = tsMs;
        group.last_ts = ts;
      }
    }

    const customerText = String(turn.userMessage || "").trim();
    if (customerText) {
      if (group.resolved_at_ms && tsMs > group.resolved_at_ms) {
        group.resolved_by = null;
        group.resolved_at_ms = 0;
      }
      stats.inbound_messages++;
      group.messages.push({ ts, author: "customer", text: customerText });
      group.last_inbound_ms = Math.max(group.last_inbound_ms, tsMs);
      group.last_text = customerText;
      const day = String(ts || "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(day)) stats.messages_by_day[day] = (stats.messages_by_day[day] || 0) + 1;
    }

    const controlEvent = customerPanelControlEvent(turn);
    const replyText = String(turn.botReply || "").replace(/^\[Humano\]\s*/, "").trim();
    if (controlEvent) {
      const eventText = controlEvent === "released" ? "Conversación devuelta a la IA."
        : controlEvent === "resolved_by_team" ? "Conversación resuelta por el equipo." : "Control humano activado.";
      group.messages.push({ ts, author: "system", text: eventText, event: controlEvent });
      group.last_text = eventText;
    } else if (replyText) {
      const actor = customerPanelReplyActor(turn);
      group.messages.push({ ts, author: actor, text: replyText });
      if (actor === "human") group.last_human_reply_ms = Math.max(group.last_human_reply_ms, tsMs);
      group.last_text = replyText;
    }

    const tools = Array.isArray(turn.tools) ? turn.tools : [];
    if (tools.includes("admin_resolve")) {
      group.current_handoff = false;
      group.resolved_by = "human";
      group.resolved_at_ms = tsMs || group.last_ts_ms;
    } else if (tools.includes("admin_release")) {
      group.current_handoff = false;
      group.resolved_by = null;
      group.resolved_at_ms = 0;
    } else if (turn.handoff || tools.includes("request_human_handoff") || tools.includes("human_handoff_active") || tools.includes("admin_takeover") || tools.includes("admin_send_message")) {
      group.current_handoff = true;
      group.resolved_by = null;
      group.resolved_at_ms = 0;
    }
    if (turn.handoff || tools.includes("request_human_handoff") || tools.includes("human_handoff_active") || tools.includes("admin_takeover") || tools.includes("admin_send_message")) {
      group.handoff_ever = true;
    }
    if (customerPanelSalesSignal(turn)) group.sales_signal = true;
    const evalData = turn.eval && !turn.eval.error ? turn.eval : null;
    if (evalData) {
      group.evaluated = true;
      if (evalData.resuelto === "si" && !group.current_handoff) {
        group.resolved_by = "bot";
        group.resolved_at_ms = tsMs || group.last_ts_ms;
      }
      if (evalData.resuelto === "parcial") group.partial_resolution = true;
    }
    if (customerText && turn.status === "ok" && customerClosureSignal(customerText) && !group.current_handoff) {
      group.resolved_by = "bot";
      group.resolved_at_ms = tsMs || group.last_ts_ms;
    }

    (Array.isArray(turn.zeroResultQueries) ? turn.zeroResultQueries : []).forEach(function (query) {
      const clean = String(query || "").trim().toLowerCase();
      if (!clean) return;
      stats.zero_result_searches++;
      stats.zero_result_counts[clean] = (stats.zero_result_counts[clean] || 0) + 1;
    });
    if (turn.rating != null && Number.isFinite(Number(turn.rating))) stats.ratings.push(Number(turn.rating));
  });

  const conversations = Object.keys(groups).map(function (userId) {
    const group = groups[userId];
    const meta = metaByCustomer[userId] || { tags: [], note: "", updated_at: null };
    const memory = normalizeMemory(memoriesByCustomer[userId]);
    const active = !!(states[userId] && states[userId].active);
    const tags = normalizeCustomerTags(meta.tags);
    const salesSignal = group.sales_signal || tags.includes("venta");
    const suffix = group.external_id.slice(-6);
    const instagramProfile = group.channel === "instagram" ? instagramProfiles[userId] : null;
    const instagramUsername = instagramProfile && normalizeInstagramUsername(instagramProfile.username);
    const handoffState = states[userId] || { active: false, source: "bot" };
    const teamActive = handoffState.active && ["admin_takeover", "admin_send_message"].includes(handoffState.source);
    const conversationStatus = group.resolved_by ? "resolved" : handoffState.active ? (teamActive ? "team_active" : "needs_attention") : "ai_active";
    const statusLabels = {
      ai_active: "✦ IA atendiendo",
      needs_attention: "🙋 Necesita tu atención",
      team_active: "👤 Tu equipo atendiendo",
      resolved: "✓ Resuelta"
    };
    const channelLabels = { whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger" };
    const channelDisplayName = group.channel === "instagram"
      ? (instagramUsername ? "@" + instagramUsername : "Instagram · …" + suffix)
      : group.channel === "messenger" ? "Messenger · …" + suffix : "+" + group.external_id;
    const displayName = memory.preferred_name || channelDisplayName;
    const copyValue = group.channel === "instagram"
      ? (instagramUsername ? "@" + instagramUsername : group.external_id)
      : group.channel === "messenger" ? group.external_id : "+" + group.external_id;
    return {
      id: userId,
      phone: group.external_id,
      channel: group.channel,
      channel_label: channelLabels[group.channel] || "WhatsApp",
      instagram_username: instagramUsername || null,
      messenger_username: null,
      display_name: displayName,
      copy_value: copyValue,
      last_ts: group.last_ts,
      last_text: group.last_text,
      conversation_status: conversationStatus,
      status_label: statusLabels[conversationStatus],
      resolution_source: conversationStatus === "resolved" ? group.resolved_by : null,
      resolution_label: conversationStatus === "resolved" ? (group.resolved_by === "human" ? "Resuelta por tu equipo" : "Resuelta por la IA · sin intervención humana") : null,
      mode: active ? "human" : "bot",
      needs_reply: conversationStatus !== "resolved" && active && group.last_inbound_ms > group.last_human_reply_ms,
      tags,
      note: normalizeCustomerNote(meta.note),
      meta_updated_at: meta.updated_at || null,
      priority: memory.priority,
      memory: isMeaningfulMemory(memory) ? memory : null,
      messages: group.messages,
      business_signals: {
        sales_assisted: salesSignal,
        returning_customer: memory.confirmed_orders.length > 0,
        purchase_stage: memory.purchase_stage,
        handoff_ever: group.handoff_ever,
        resolved_by_bot: group.resolved_by === "bot",
        resolved_by_human: group.resolved_by === "human",
        partial_resolution: group.partial_resolution,
        evaluated: group.evaluated
      }
    };
  }).sort(function (a, b) {
    return new Date(b.last_ts || 0) - new Date(a.last_ts || 0);
  });

  const whatsappConversations = conversations.filter(function (item) { return item.channel === "whatsapp"; });
  const instagramConversations = conversations.filter(function (item) { return item.channel === "instagram"; });
  const messengerConversations = conversations.filter(function (item) { return item.channel === "messenger"; });
  const summaries = {
    whatsapp: summarizeCustomerPanelChannel(whatsappConversations, channelStats.whatsapp),
    instagram: summarizeCustomerPanelChannel(instagramConversations, channelStats.instagram),
    messenger: summarizeCustomerPanelChannel(messengerConversations, channelStats.messenger)
  };
  const whatsappSetup = customerPanelWhatsappSetup();
  const instagramSetup = customerPanelInstagramSetup();
  const messengerSetup = customerPanelMessengerSetup();
  const capabilities = customerPanelCapabilities(auth.role);

  return {
    ok: true,
    bot_version: BOT_VERSION,
    business: {
      id: CUSTOMER_PANEL_BUSINESS.id,
      name: CUSTOMER_PANEL_BUSINESS.name,
      customer_number: CUSTOMER_PANEL_BUSINESS.customer_number,
      status: CUSTOMER_PANEL_BUSINESS.status,
      whatsapp_setup: whatsappSetup,
      instagram_setup: instagramSetup,
      messenger_setup: messengerSetup,
      channels: {
        whatsapp: Object.assign({ conversations_count: whatsappConversations.length }, whatsappSetup),
        instagram: Object.assign({ conversations_count: instagramConversations.length }, instagramSetup),
        messenger: Object.assign({ conversations_count: messengerConversations.length }, messengerSetup)
      }
    },
    user: {
      username: auth.username,
      name: auth.name,
      role: auth.role,
      role_label: DASHBOARD_ROLE_LABELS[auth.role] || auth.role,
      capabilities
    },
    data_window: {
      source,
      events_considered: allTurns.length,
      returned_event_limit: turnLimit,
      from: minTs ? new Date(minTs).toISOString() : null,
      to: maxTs ? new Date(maxTs).toISOString() : null
    },
    summary: summaries.whatsapp,
    summaries,
    tags: CUSTOMER_META_TAGS,
    conversations
  };
}

function buildCustomerPanelDemoSnapshot() {
  const now = Date.now();
  function iso(minutesAgo) {
    return new Date(now - minutesAgo * 60 * 1000).toISOString();
  }
  const auth = { username: "demo", name: "Demo RAV Toys", role: "viewer" };
  const capabilities = customerPanelCapabilities("viewer");
  const conversations = [
    {
      phone: "573001112233",
      last_ts: iso(8),
      last_text: "¿Me confirmas si el Lego Ferrari tiene envío hoy?",
      mode: "human",
      needs_reply: true,
      tags: ["venta", "envio"],
      note: "Quiere comprar hoy si confirmamos envío.",
      meta_updated_at: iso(6),
      messages: [
        { ts: iso(22), author: "customer", text: "Hola, ¿tienen el Lego Ferrari disponible?" },
        { ts: iso(21), author: "bot", text: "🤖 Sí, te ayudo a revisar disponibilidad y envío." },
        { ts: iso(9), author: "customer", text: "¿Me confirmas si tiene envío hoy?" },
        { ts: iso(8), author: "system", text: "Control humano activado." }
      ],
      business_signals: { sales_assisted: true, handoff_ever: true, resolved_by_bot: false, partial_resolution: true, evaluated: true }
    },
    {
      phone: "573004445566",
      last_ts: iso(18),
      last_text: "Necesito garantía de un carro que salió con una rueda suelta.",
      mode: "human",
      needs_reply: true,
      tags: ["garantia", "revisar"],
      note: "Caso sensible. Responder con tono empático.",
      meta_updated_at: iso(16),
      messages: [
        { ts: iso(31), author: "customer", text: "Buenos días, compré un carro y salió con una rueda suelta." },
        { ts: iso(30), author: "bot", text: "🤖 Lamento mucho eso. Te puedo ayudar a revisar la garantía." },
        { ts: iso(18), author: "customer", text: "Prefiero hablar con alguien del equipo." }
      ],
      business_signals: { sales_assisted: false, handoff_ever: true, resolved_by_bot: false, partial_resolution: true, evaluated: true }
    },
    {
      phone: "573007778899",
      last_ts: iso(44),
      last_text: "Listo, gracias. Entonces paso mañana.",
      mode: "bot",
      needs_reply: false,
      tags: ["venta"],
      note: "",
      meta_updated_at: null,
      messages: [
        { ts: iso(55), author: "customer", text: "¿Tienen Barbie astronauta?" },
        { ts: iso(54), author: "bot", text: "🤖 Sí, tenemos unidades disponibles. Puedes pasar mañana o pedir envío." },
        { ts: iso(44), author: "customer", text: "Listo, gracias. Entonces paso mañana." }
      ],
      business_signals: { sales_assisted: true, handoff_ever: false, resolved_by_bot: true, partial_resolution: false, evaluated: true }
    },
    {
      phone: "573002229900",
      last_ts: iso(75),
      last_text: "¿Tienen Hot Wheels Ultimate Garage?",
      mode: "bot",
      needs_reply: false,
      tags: ["revisar"],
      note: "Producto preguntado varias veces.",
      meta_updated_at: iso(70),
      messages: [
        { ts: iso(78), author: "customer", text: "¿Tienen Hot Wheels Ultimate Garage?" },
        { ts: iso(77), author: "bot", text: "🤖 No lo encontré en el catálogo actual, pero puedo avisar al equipo." }
      ],
      business_signals: { sales_assisted: false, handoff_ever: false, resolved_by_bot: false, partial_resolution: true, evaluated: true }
    }
  ];
  const demoWhatsappNames = ["María Gómez", "Carolina Díaz", "Julián Torres", "Andrés Ruiz"];
  conversations.forEach(function (item, index) {
    item.id = item.phone;
    item.channel = "whatsapp";
    item.channel_label = "WhatsApp";
    item.display_name = demoWhatsappNames[index] || "+" + item.phone;
    item.copy_value = "+" + item.phone;
  });
  conversations.push(
    {
      id: "ig:17841470000112233",
      phone: "17841470000112233",
      channel: "instagram",
      channel_label: "Instagram",
      instagram_username: "maria.gomez",
      display_name: "@maria.gomez",
      copy_value: "@maria.gomez",
      last_ts: iso(12),
      last_text: "¿Me muestras opciones para un regalo de 5 años?",
      mode: "human",
      needs_reply: true,
      tags: ["venta", "revisar"],
      note: "Llegó por Instagram y busca regalo para hoy.",
      meta_updated_at: iso(10),
      messages: [
        { ts: iso(25), author: "customer", text: "Hola, vi sus juguetes en Instagram." },
        { ts: iso(24), author: "bot", text: "🤖 ¡Hola! Te ayudo a encontrar el regalo ideal." },
        { ts: iso(12), author: "customer", text: "¿Me muestras opciones para un regalo de 5 años?" }
      ],
      business_signals: { sales_assisted: true, handoff_ever: true, resolved_by_bot: false, partial_resolution: true, evaluated: true }
    },
    {
      id: "ig:17841470000445566",
      phone: "17841470000445566",
      channel: "instagram",
      channel_label: "Instagram",
      instagram_username: "juli.recomienda",
      display_name: "@juli.recomienda",
      copy_value: "@juli.recomienda",
      last_ts: iso(36),
      last_text: "Perfecto, gracias por la recomendación.",
      mode: "bot",
      needs_reply: false,
      tags: ["venta"],
      note: "",
      meta_updated_at: null,
      messages: [
        { ts: iso(42), author: "customer", text: "¿Tienen carros a control remoto?" },
        { ts: iso(40), author: "bot", text: "🤖 Sí. Encontré tres opciones disponibles para ti." },
        { ts: iso(36), author: "customer", text: "Perfecto, gracias por la recomendación." }
      ],
      business_signals: { sales_assisted: true, handoff_ever: false, resolved_by_bot: true, partial_resolution: false, evaluated: true }
    }
  );
  const demoStatusValues = ["needs_attention", "team_active", "resolved", "ai_active", "needs_attention", "resolved"];
  const demoStatusLabels = {
    ai_active: "✦ IA atendiendo",
    needs_attention: "🙋 Necesita tu atención",
    team_active: "👤 Tu equipo atendiendo",
    resolved: "✓ Resuelta"
  };
  conversations.forEach(function (item, index) {
    const status = demoStatusValues[index] || "ai_active";
    item.conversation_status = status;
    item.status_label = demoStatusLabels[status];
    item.resolution_source = status === "resolved" ? "bot" : null;
    item.resolution_label = status === "resolved" ? "Resuelta por la IA · sin intervención humana" : null;
    item.business_signals.resolved_by_bot = status === "resolved";
    item.business_signals.resolved_by_human = false;
  });
  const whatsappSummary = {
    clients_attended: 312,
    messages: 1248,
    active_handoffs: 2,
    handoffs_to_human: 18,
    pending_human_replies: 2,
    zero_result_searches: 14,
    opportunities_detected: 14,
    sales_assisted: { count: 47, label: "ventas asistidas", confidence: "demo" },
    solutions_provided: { count: 268, by_human: 44, total: 312, partial: 31, evaluated: 312, rate: 86 },
    rating: { average: 4.8, count: 214 },
    messages_by_day: [
      { day: "2026-07-07", messages: 34 },
      { day: "2026-07-08", messages: 43 },
      { day: "2026-07-09", messages: 58 },
      { day: "2026-07-10", messages: 37 },
      { day: "2026-07-11", messages: 74 },
      { day: "2026-07-12", messages: 88 },
      { day: "2026-07-13", messages: 61 }
    ],
    search_gaps: [
      { query: "Lego Technic Ferrari Daytona SP3", count: 5 },
      { query: "Barbie astronauta edición especial", count: 4 },
      { query: "Hot Wheels Ultimate Garage", count: 3 },
      { query: "Nerf Elite 2.0 Commander", count: 2 }
    ],
    conversation_modes: { human: 2, bot: 2, pending: 2 },
    conversation_statuses: { ai_active: 1, needs_attention: 1, team_active: 1, resolved: 1, resolved_by_ai: 1, resolved_by_team: 0 }
  };
  const instagramSummary = {
    clients_attended: 126,
    messages: 487,
    active_handoffs: 1,
    handoffs_to_human: 9,
    pending_human_replies: 1,
    zero_result_searches: 7,
    opportunities_detected: 7,
    sales_assisted: { count: 23, label: "ventas asistidas", confidence: "demo" },
    solutions_provided: { count: 103, by_human: 23, total: 126, partial: 14, evaluated: 126, rate: 82 },
    rating: { average: 4.7, count: 71 },
    messages_by_day: [
      { day: "2026-07-07", messages: 12 },
      { day: "2026-07-08", messages: 19 },
      { day: "2026-07-09", messages: 17 },
      { day: "2026-07-10", messages: 25 },
      { day: "2026-07-11", messages: 31 },
      { day: "2026-07-12", messages: 38 },
      { day: "2026-07-13", messages: 29 }
    ],
    search_gaps: [
      { query: "regalo para niña de 5 años", count: 3 },
      { query: "carro control remoto rosado", count: 2 },
      { query: "Lego flores", count: 2 }
    ],
    conversation_modes: { human: 1, bot: 1, pending: 1 },
    conversation_statuses: { ai_active: 0, needs_attention: 1, team_active: 0, resolved: 1, resolved_by_ai: 1, resolved_by_team: 0 }
  };
  const messengerSummary = summarizeCustomerPanelChannel([], emptyCustomerPanelChannelStats());
  return {
    ok: true,
    demo: true,
    bot_version: BOT_VERSION,
    business: {
      id: CUSTOMER_PANEL_BUSINESS.id,
      name: CUSTOMER_PANEL_BUSINESS.name,
      customer_number: CUSTOMER_PANEL_BUSINESS.customer_number,
      status: CUSTOMER_PANEL_BUSINESS.status,
      whatsapp_setup: { status: "ready", label: "WhatsApp conectado" },
      instagram_setup: { status: "ready", label: "Instagram conectado" },
      messenger_setup: { status: "ready", label: "Messenger conectado" },
      channels: {
        whatsapp: { status: "ready", label: "WhatsApp conectado", conversations_count: 4 },
        instagram: { status: "ready", label: "Instagram conectado", conversations_count: 2 },
        messenger: { status: "ready", label: "Messenger conectado", conversations_count: 0 }
      }
    },
    user: {
      username: auth.username,
      name: auth.name,
      role: auth.role,
      role_label: DASHBOARD_ROLE_LABELS[auth.role] || auth.role,
      capabilities
    },
    data_window: {
      source: "demo",
      events_considered: 18,
      returned_event_limit: 300,
      from: iso(10080),
      to: iso(0)
    },
    summary: whatsappSummary,
    summaries: { whatsapp: whatsappSummary, instagram: instagramSummary, messenger: messengerSummary },
    tags: CUSTOMER_META_TAGS,
    conversations
  };
}

app.post("/admin/login", loginRateLimiter, async (req, res) => {
  const email = String(req.body && req.body.email || "").trim();
  const username = String(req.body && req.body.username || "").trim();
  const identity = email || username;
  const password = String(req.body && req.body.password || "");
  const key = String(req.body && req.body.key || "").trim();

  if (key && safeEqualText(key, DASHBOARD_KEY)) {
    const user = { username: "clave-maestra", name: "Clave maestra", role: "super_admin" };
    setDashboardSessionCookie(req, res, user);
    res.json({ ok: true, user: { username: user.username, name: user.name, role: user.role, method: "key" } });
    return;
  }

  let user;
  try {
    user = await dashboardUserFromCredentials(identity, password, { customerV2: !!email });
  } catch (_) {
    res.status(503).json({ ok: false, error: "customer_access_unavailable" });
    return;
  }
  if (!user) {
    res.status(401).json({ ok: false, error: "invalid_credentials" });
    return;
  }
  let redirect = "/admin/panel?tab=summary";
  try { redirect = await customerPanelEntryRedirect(user); }
  catch (_) {}
  setDashboardSessionCookie(req, res, user);
  res.json({
    ok: true,
    user: {
      user_id: user.user_id || null,
      email: user.email || null,
      username: user.username,
      name: user.name,
      role: user.role,
      tenant_id: user.tenant_id || null,
      method: "session"
    },
    redirect
  });
});

app.post("/admin/logout", (req, res) => {
  clearDashboardSessionCookie(req, res);
  res.json({ ok: true });
});

app.get("/admin/session", async (req, res) => {
  const auth = dashboardAuth(req);
  const customerUser = await loadDashboardCustomerUser(false);
  if (!auth.ok) {
    res.status(401).json({ ok: false, error: "unauthorized", users_enabled: DASHBOARD_USERS.length > 0 || !!customerUser });
    return;
  }
  res.json({
    ok: true,
    bot_version: BOT_VERSION,
    users_enabled: DASHBOARD_USERS.length > 0 || !!customerUser,
    customer_user_configured: !!customerUser,
    access_model_version: DASHBOARD_ACCESS_MODEL.version,
    user: {
      user_id: auth.user_id || null,
      email: auth.email || null,
      username: auth.username,
      name: auth.name,
      role: auth.role,
      tenant_id: auth.tenant_id || null,
      method: auth.method
    }
  });
});

app.get("/admin/customer-access/catalogs", async (req, res) => {
  if (!CUSTOMER_ACCESS_V2_ENABLED) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  const auth = dashboardAuth(req);
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    res.json(Object.assign({ ok: true }, await customerAccessService.catalogs()));
  } catch (error) {
    sendCustomerAccessError(res, error);
  }
});

app.get("/admin/customer-invitations", async (req, res) => {
  if (!CUSTOMER_ACCESS_V2_ENABLED) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  const auth = dashboardAuth(req);
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    res.json({ ok: true, invitations: await customerAccessService.listInvitations() });
  } catch (error) {
    sendCustomerAccessError(res, error);
  }
});

app.post("/admin/customer-invitations/:invitationId/revoke", async (req, res) => {
  if (!CUSTOMER_ACCESS_V2_ENABLED) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  const auth = dashboardAuth(req);
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    res.json({ ok: true, invitation: await customerAccessService.revokeInvitation(req.params.invitationId, auth) });
  } catch (error) {
    sendCustomerAccessError(res, error);
  }
});

// ─── Catálogo de planes y bots ────────────────────────────────────────────
// Escritura y lectura completa: solo super_admin.
// Lectura de activos: también clientes autenticados (la consume el Panel de Cliente).

function sendCatalogError(res, error) {
  const problem = error instanceof CatalogError ? error : new CatalogError("catalog_unavailable", 503);
  res.status(problem.status).json({ ok: false, error: problem.code });
}

function catalogSuperAdminGuard(req, res) {
  if (!CUSTOMER_ACCESS_V2_ENABLED) {
    res.status(404).json({ ok: false, error: "not_found" });
    return null;
  }
  const auth = dashboardAuth(req);
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return null;
  }
  return auth;
}

app.get("/admin/catalogs", async (req, res) => {
  const auth = catalogSuperAdminGuard(req, res);
  if (!auth) return;
  try {
    res.json(Object.assign({ ok: true }, await catalogService.adminCatalogs()));
  } catch (error) {
    sendCatalogError(res, error);
  }
});

app.post("/admin/catalogs/plans", async (req, res) => {
  const auth = catalogSuperAdminGuard(req, res);
  if (!auth) return;
  try {
    res.json({ ok: true, plan: await catalogService.upsertPlan(req.body, auth) });
  } catch (error) {
    sendCatalogError(res, error);
  }
});

app.post("/admin/catalogs/bots", async (req, res) => {
  const auth = catalogSuperAdminGuard(req, res);
  if (!auth) return;
  try {
    res.json({ ok: true, bot: await catalogService.upsertBot(req.body, auth) });
  } catch (error) {
    sendCatalogError(res, error);
  }
});

app.post("/admin/catalogs/plans/:id/toggle", async (req, res) => {
  const auth = catalogSuperAdminGuard(req, res);
  if (!auth) return;
  try {
    const activo = req.body && typeof req.body.activo === "boolean" ? req.body.activo : false;
    res.json({ ok: true, plan: await catalogService.togglePlan(req.params.id, activo, auth) });
  } catch (error) {
    sendCatalogError(res, error);
  }
});

// Solo lectura, solo activos. Es el contrato que consume el Panel de Cliente
// para dejar de tener los planes escritos a mano en HTML.
app.get("/admin/panel/catalogs", async (req, res) => {
  if (!CUSTOMER_ACCESS_V2_ENABLED) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  if (!customerPanelAuthOk(req, "viewer")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    res.json(Object.assign({ ok: true }, await catalogService.activeCatalogs()));
  } catch (error) {
    sendCatalogError(res, error);
  }
});

// ─── Payments v1 · Wompi Sandbox ─────────────────────────────────────────

function sendPaymentError(res, error) {
  const problem = error instanceof PaymentError ? error : new PaymentError("billing_unavailable", 503);
  res.status(problem.status).json({ ok: false, error: problem.code });
}

app.get("/admin/panel/billing", async (req, res) => {
  if (!PAYMENTS_V1_ENABLED) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  if (!customerPanelAuthOk(req, "viewer")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    const tenantId = customerTenantForAuth(dashboardAuth(req));
    res.json({ ok: true, billing: await paymentService.tenantBilling(tenantId) });
  } catch (error) {
    sendPaymentError(res, error);
  }
});

app.post("/admin/panel/billing/checkout", async (req, res) => {
  if (!PAYMENTS_V1_ENABLED) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  if (!customerPanelAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const auth = dashboardAuth(req);
  const business = customerBusinessForAuth(auth);
  try {
    const checkout = await paymentService.startCheckout({
      tenant_id: business.id,
      customer: business.name,
      customer_email: auth.email || auth.username,
      plan_id: business.plan_id,
      bot_id: business.assigned_bot_id,
      actor: auth.email || auth.username || "customer"
    });
    res.json({ ok: true, checkout });
  } catch (error) {
    sendPaymentError(res, error);
  }
});

app.get("/admin/billing", async (req, res) => {
  const auth = catalogSuperAdminGuard(req, res);
  if (!auth) return;
  if (!PAYMENTS_V1_ENABLED) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  try {
    res.json({ ok: true, billing: await paymentService.adminBilling() });
  } catch (error) {
    sendPaymentError(res, error);
  }
});

app.post("/admin/billing/:tenantId/bypass", async (req, res) => {
  const auth = catalogSuperAdminGuard(req, res);
  if (!auth) return;
  if (!PAYMENTS_V1_ENABLED) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  try {
    const tenantId = cleanTenantId(req.params.tenantId);
    const tenants = await catalogService.listTenants();
    const tenant = tenants.find(function (row) { return row.id === tenantId; });
    if (!tenant) throw new PaymentError("tenant_not_found", 404);
    await paymentService.prepareContract({
      tenant_id: tenant.id,
      customer: tenant.company_name || tenant.id,
      plan_id: req.body && req.body.plan_id || tenant.plan_id,
      bot_id: req.body && req.body.bot_id || tenant.assigned_bot_id
    });
    const contract = await paymentService.approveBypass({
      tenant_id: tenant.id,
      subscription_status: req.body && req.body.subscription_status,
      trial_start: req.body && req.body.trial_start,
      trial_end: req.body && req.body.trial_end,
      reason: req.body && req.body.reason,
      actor: auth.email || auth.username || "super_admin"
    });
    res.json({ ok: true, billing: contract });
  } catch (error) {
    sendPaymentError(res, error);
  }
});

app.post("/webhooks/wompi", wompiWebhookRateLimiter, async (req, res) => {
  if (!PAYMENTS_V1_ENABLED) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  try {
    const result = await paymentService.processWebhook(req.body, req.get("x-event-checksum"));
    res.status(200).json({ ok: true, duplicate: !!(result && result.duplicate) });
  } catch (error) {
    sendPaymentError(res, error);
  }
});

// ─── Ciclo de vida del cliente ────────────────────────────────────────────

app.get("/admin/tenants", async (req, res) => {
  const auth = catalogSuperAdminGuard(req, res);
  if (!auth) return;
  try {
    res.json({ ok: true, tenants: await catalogService.listTenants() });
  } catch (error) {
    sendCatalogError(res, error);
  }
});

app.post("/admin/tenants/:tenantId/status", async (req, res) => {
  const auth = catalogSuperAdminGuard(req, res);
  if (!auth) return;
  try {
    const status = req.body && req.body.status;
    res.json({ ok: true, tenant: await catalogService.setTenantStatus(req.params.tenantId, status, auth) });
  } catch (error) {
    sendCatalogError(res, error);
  }
});

// Respaldo descargable. Se genera antes de cualquier borrado, y también
// puede pedirse por separado.
app.get("/admin/tenants/:tenantId/backup", async (req, res) => {
  const auth = catalogSuperAdminGuard(req, res);
  if (!auth) return;
  try {
    const backup = await catalogService.tenantBackup(req.params.tenantId);
    res.setHeader("content-disposition",
      'attachment; filename="respaldo-' + String(req.params.tenantId).replace(/[^a-z0-9-]/gi, "") + '.json"');
    res.json(backup);
  } catch (error) {
    sendCatalogError(res, error);
  }
});

// Borrado irreversible. Tres salvaguardas: el cliente debe estar suspendido,
// hay que escribir el nombre exacto de la empresa, y confirmar explícitamente.
// El respaldo se genera y se devuelve en la misma respuesta.
app.post("/admin/tenants/:tenantId/delete", async (req, res) => {
  const auth = catalogSuperAdminGuard(req, res);
  if (!auth) return;
  try {
    const outcome = await catalogService.deleteTenant({
      tenant_id: req.params.tenantId,
      company_name_confirmacion: req.body && req.body.company_name_confirmacion,
      confirmacion_final: req.body && req.body.confirmacion_final === true
    }, auth);
    console.log("[tenant-eliminado]", JSON.stringify({
      actor: auth.username || auth.email || "super_admin",
      tenant_id: outcome.result && outcome.result.tenant_id,
      company_name: outcome.result && outcome.result.company_name,
      at: new Date().toISOString()
    }));
    res.json({ ok: true, deleted: outcome.result, backup: outcome.backup });
  } catch (error) {
    sendCatalogError(res, error);
  }
});

app.post("/admin/customer-invite", async (req, res) => {
  if (!adminAuthOk(req, "super_admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  if (CUSTOMER_ACCESS_V2_ENABLED) {
    try {
      const created = await customerAccessService.createInvitation(req.body, dashboardAuth(req));
      res.status(201).json(Object.assign({ ok: true }, created));
    } catch (error) {
      sendCustomerAccessError(res, error);
    }
    return;
  }
  if (!SUPABASE_ENABLED) {
    res.status(503).json({ ok: false, error: "persistent_user_store_unavailable" });
    return;
  }
  let existing;
  try {
    existing = await loadDashboardCustomerUser(true, true);
  } catch (_) {
    res.status(503).json({ ok: false, error: "persistent_user_store_unavailable" });
    return;
  }
  if (existing) {
    res.status(409).json({ ok: false, error: "customer_admin_already_configured", username: existing.username });
    return;
  }
  const invite = createDashboardCustomerInvite();
  const inviteData = readDashboardCustomerInvite(invite);
  const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
  const setupBaseUrl = PUBLIC_BASE_URL || protocol + "://" + req.get("host");
  const setupUrl = setupBaseUrl + "/admin/setup/" + CUSTOMER_PANEL_BUSINESS.id + "?invite=" + encodeURIComponent(invite);
  res.json({
    ok: true,
    tenant: { id: CUSTOMER_PANEL_BUSINESS.id, name: CUSTOMER_PANEL_BUSINESS.name, customer_number: CUSTOMER_PANEL_BUSINESS.customer_number },
    setup_url: setupUrl,
    expires_at: new Date(inviteData.exp).toISOString(),
    note: "Comparte este enlace solo con el administrador de RAV Toys. Deja de servir cuando se crea la cuenta."
  });
});

app.get("/admin/create-account", async (req, res) => {
  if (!CUSTOMER_ACCESS_V2_ENABLED || !customerAccessService) {
    res.status(404).send("Not found");
    return;
  }
  const auth = dashboardAuth(req);
  if (auth.ok && auth.version === 2) {
    try { res.redirect(await customerPanelEntryRedirect(auth)); }
    catch (_) { res.redirect("/admin/panel?tab=summary"); }
    return;
  }
  try {
    renderCustomerPublicSignup(res, {
      businessHint: req.query.business || req.query.q || ""
    });
  } catch (error) {
    sendCustomerAccessError(res, error);
  }
});

app.post("/admin/create-account", loginRateLimiter, async (req, res) => {
  if (!CUSTOMER_ACCESS_V2_ENABLED || !customerAccessService || !customerAccessService.createPublicSignup) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  const keys = Object.keys(req.body || {});
  const allowed = ["company_name", "admin_email", "contact_phone", "password", "password_confirmation"];
  if (keys.some(function (key) { return !allowed.includes(key); }) || allowed.some(function (key) { return !keys.includes(key); })) {
    res.status(400).json({ ok: false, error: "invalid_request" });
    return;
  }
  const contactPhone = cleanPublicSignupPhone(req.body && req.body.contact_phone);
  if (!contactPhone || contactPhone.replace(/\D/g, "").length < 7) {
    res.status(400).json({ ok: false, error: "invalid_contact_phone" });
    return;
  }
  try {
    const catalogs = catalogService ? await catalogService.activeCatalogs() : await customerAccessService.catalogs();
    const defaults = publicSignupDefaults(catalogs);
    const user = await customerAccessService.createPublicSignup(Object.assign({}, req.body, { contact_phone: contactPhone }, defaults));
    let onboardingDraft = null;
    try {
      onboardingDraft = await persistPublicSignupLeadDraft(user, Object.assign({}, req.body, { contact_phone: contactPhone }));
    } catch (draftError) {
      console.error("public signup lead draft save error:", draftError.message);
    }
    const redirect = await customerPanelEntryRedirect(user);
    setDashboardSessionCookie(req, res, user);
    res.status(201).json({
      ok: true,
      tenant: { id: user.tenant_id, company_name: user.company_name, plan_id: user.plan_id, assigned_bot_id: user.assigned_bot_id },
      user: { user_id: user.user_id, email: user.email, role: user.role, tenant_id: user.tenant_id },
      lead: { contact_phone: contactPhone, onboarding_draft_saved: !!onboardingDraft },
      redirect
    });
  } catch (error) {
    sendCustomerAccessError(res, error);
  }
});

app.get("/admin/setup/:tenantId", async (req, res) => {
  const tenantId = String(req.params.tenantId || "");
  const invite = String(req.query.invite || "");
  if (CUSTOMER_ACCESS_V2_ENABLED) {
    try {
      const invitation = await customerAccessService.inspectInvitation(tenantId, invite);
      renderCustomerPasswordSetup(res, {
        valid: true,
        invite,
        businessName: invitation.company_name,
        email: invitation.email,
        expiresAt: invitation.expires_at
      });
    } catch (error) {
      const problem = error instanceof CustomerAccessError ? error : new CustomerAccessError("customer_access_unavailable", 503);
      const reasons = {
        invitation_expired: "Esta invitación venció. Solicita una nueva a Nextfor IA.",
        invitation_revoked: "Esta invitación fue revocada por Nextfor IA.",
        invitation_already_used: "Esta invitación ya fue utilizada. Ingresa con tu correo y contraseña.",
        invalid_invitation: "El enlace no es válido o pertenece a otro negocio."
      };
      renderCustomerPasswordSetup(res, { valid: false, status: problem.status, reason: reasons[problem.code] || "No pudimos validar el acceso en este momento." });
    }
    return;
  }
  const invitation = readDashboardCustomerInvite(invite);
  if (tenantId !== CUSTOMER_PANEL_BUSINESS.id || !invitation) {
    renderCustomerPasswordSetup(res, { valid: false, reason: "El enlace no es válido o ya venció." });
    return;
  }
  let existing;
  try {
    existing = await loadDashboardCustomerUser(true, true);
  } catch (_) {
    renderCustomerPasswordSetup(res, { valid: false, status: 503, reason: "No pudimos validar el acceso en este momento. Intenta de nuevo en unos minutos." });
    return;
  }
  if (existing) {
    renderCustomerPasswordSetup(res, { valid: false, configured: true, reason: "La cuenta administradora de RAV Toys ya fue creada." });
    return;
  }
  renderCustomerPasswordSetup(res, { valid: true, invite });
});

app.post("/admin/setup/:tenantId", async (req, res) => {
  const tenantId = String(req.params.tenantId || "");
  const invite = String(req.body && req.body.invite || "");
  if (CUSTOMER_ACCESS_V2_ENABLED) {
    const keys = Object.keys(req.body || {});
    const allowed = ["invite", "password", "password_confirmation"];
    if (keys.some(function (key) { return !allowed.includes(key); }) || allowed.some(function (key) { return !keys.includes(key); })) {
      res.status(400).json({ ok: false, error: "invalid_request" });
      return;
    }
    try {
      const user = await customerAccessService.consumeInvitation({
        tenant_id: tenantId,
        token: invite,
        password: req.body.password,
        password_confirmation: req.body.password_confirmation
      });
      const redirect = await customerPanelEntryRedirect(user);
      setDashboardSessionCookie(req, res, user);
      res.status(201).json({
        ok: true,
        tenant: { id: user.tenant_id, company_name: user.company_name },
        user: { user_id: user.user_id, email: user.email, role: user.role, tenant_id: user.tenant_id },
        redirect
      });
    } catch (error) {
      if (error instanceof CustomerAccessError && error.code === "invitation_already_used" && customerAccessService.confirmExistingAccess) {
        if (req.body.password !== req.body.password_confirmation) {
          res.status(400).json({ ok: false, error: "password_mismatch" });
          return;
        }
        try {
          const user = await customerAccessService.confirmExistingAccess({
            tenant_id: tenantId,
            token: invite,
            password: req.body.password
          });
          const redirect = await customerPanelEntryRedirect(user);
          setDashboardSessionCookie(req, res, user);
          res.status(200).json({
            ok: true,
            existing_access: true,
            tenant: { id: user.tenant_id, company_name: user.company_name },
            user: { user_id: user.user_id, email: user.email, role: user.role, tenant_id: user.tenant_id },
            redirect
          });
        } catch (confirmError) {
          sendCustomerAccessError(res, confirmError);
        }
        return;
      }
      sendCustomerAccessError(res, error);
    }
    return;
  }
  const username = normalizeDashboardUsername(req.body && req.body.username);
  const name = String(req.body && req.body.name || "Administrador RAV Toys").trim();
  const password = String(req.body && req.body.password || "");
  const passwordConfirmation = String(req.body && req.body.password_confirmation || "");
  if (tenantId !== CUSTOMER_PANEL_BUSINESS.id || !readDashboardCustomerInvite(invite)) {
    res.status(403).json({ ok: false, error: "invalid_or_expired_invite", message: "El enlace no es válido o ya venció." });
    return;
  }
  if (!SUPABASE_ENABLED) {
    res.status(503).json({ ok: false, error: "persistent_user_store_unavailable", message: "El almacenamiento seguro no está disponible." });
    return;
  }
  let existing;
  try {
    existing = await loadDashboardCustomerUser(true, true);
  } catch (_) {
    res.status(503).json({ ok: false, error: "persistent_user_store_unavailable", message: "No pudimos validar la cuenta. Intenta de nuevo en un momento." });
    return;
  }
  if (existing) {
    res.status(409).json({ ok: false, error: "customer_admin_already_configured", message: "La cuenta administradora ya fue creada." });
    return;
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username) || username === "clave-maestra") {
    res.status(400).json({ ok: false, error: "invalid_username", message: "El usuario debe tener entre 3 y 40 caracteres: letras, números, punto, guion o guion bajo." });
    return;
  }
  if (DASHBOARD_USERS.some(function (user) { return normalizeDashboardUsername(user.username) === username; })) {
    res.status(409).json({ ok: false, error: "username_unavailable", message: "Ese nombre de usuario no está disponible." });
    return;
  }
  if (password.length < 12 || password.length > 128 || !/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password) || !/\d/.test(password)) {
    res.status(400).json({ ok: false, error: "weak_password", message: "Usa al menos 12 caracteres, incluyendo una letra y un número." });
    return;
  }
  if (password !== passwordConfirmation) {
    res.status(400).json({ ok: false, error: "password_mismatch", message: "Las contraseñas no coinciden." });
    return;
  }
  try {
    const user = await persistDashboardCustomerUser({ username, name, password });
    setDashboardSessionCookie(req, res, user);
    res.status(201).json({
      ok: true,
      tenant: { id: CUSTOMER_PANEL_BUSINESS.id, name: CUSTOMER_PANEL_BUSINESS.name },
      user: { username: user.username, name: user.name, role: user.role },
      redirect: "/admin/panel?tab=summary"
    });
  } catch (error) {
    log("error", "dashboard_customer_user_create_failed", { error: String(error.message || "").slice(0, 160) });
    res.status(503).json({ ok: false, error: "customer_user_create_failed", message: "No pudimos guardar la cuenta. Intenta de nuevo en un momento." });
  }
});

app.get("/admin/access-model", (req, res) => {
  if (!adminKeyOk(req)) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const auth = dashboardAuth(req);
  res.json({
    ok: true,
    bot_version: BOT_VERSION,
    access_model: DASHBOARD_ACCESS_MODEL,
    current_user: {
      username: auth.username,
      name: auth.name,
      role: auth.role,
      role_label: DASHBOARD_ROLE_LABELS[auth.role] || auth.role,
      method: auth.method
    },
    compatibility: {
      current_dashboard_still_single_panel: false,
      dashboard_key_maps_to: "super_admin",
      admin_endpoints_accept_super_admin: true,
      client_dashboard_unchanged: true,
      super_admin_panel_available: true,
      super_admin_route: "/admin/super-admin"
    }
  });
});

function releaseAdminConversation(req, res) {
  if (!adminAuthOk(req, "agent")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const userId = normalizeConversationUserId(req.params.userId);
  if (!userId) {
    res.status(400).json({ ok: false, error: "missing_user_id" });
    return;
  }
  const wasActive = humanHandoff.delete(userId);
  pendingRatings.add(userId);
  recordAdminEvent(userId, "admin_release", "[Humano] Conversación devuelta al bot.");
  console.log(`[ADMIN] Released ${maskedIdentifier(userId)} (was handoff: ${wasActive})`);
  res.json({ ok: true, userId, wasInHandoff: wasActive });
}

app.post("/admin/release/:userId", releaseAdminConversation);

app.post("/admin/resolve/:userId", (req, res) => {
  if (!adminAuthOk(req, "agent")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const userId = normalizeConversationUserId(req.params.userId);
  if (!userId) {
    res.status(400).json({ ok: false, error: "missing_user_id" });
    return;
  }
  const wasActive = humanHandoff.delete(userId);
  pendingRatings.add(userId);
  recordAdminEvent(userId, "admin_resolve", "[Humano] Conversación marcada como resuelta por el equipo.", "ok", false);
  res.json({ ok: true, userId, wasInHandoff: wasActive, conversation_status: "resolved", resolution_source: "human" });
});

app.post("/admin/takeover/:userId", async (req, res) => {
  if (!adminAuthOk(req, "agent")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const userId = normalizeConversationUserId(req.params.userId);
  if (!userId) {
    res.status(400).json({ ok: false, error: "missing_user_id" });
    return;
  }
  humanHandoff.add(userId);
  await recordRetargetingSignal(userId, "handoff", "admin-takeover:" + Date.now(), dashboardAuth(req).name || "admin");
  recordAdminEvent(userId, "admin_takeover", "[Humano] Control tomado desde el panel.");
  res.json({ ok: true, userId, handoff: true });
});

app.post("/admin/send-message", async (req, res) => {
  if (!adminAuthOk(req, "agent")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const userId = normalizeConversationUserId(req.body && req.body.userId);
  const text = String(req.body && req.body.text || "").trim();
  if (!userId || !text) {
    res.status(400).json({ ok: false, error: "missing_user_or_text" });
    return;
  }
  if (text.length > 1200) {
    res.status(400).json({ ok: false, error: "message_too_long" });
    return;
  }
  humanHandoff.add(userId);
  await recordRetargetingSignal(userId, "handoff", "admin-message:" + Date.now(), dashboardAuth(req).name || "admin");
  const sent = await sendText(userId, text);
  recordAdminEvent(userId, "admin_send_message", "[Humano] " + text, sent ? "ok" : "error");
  res.json({ ok: !!sent, userId, handoff: true, meta_sent: !!sent });
});

app.get("/admin/customer-meta", async (req, res) => {
  if (!adminKeyOk(req)) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const limit = Math.min(parseInt(req.query.limit) || 500, 1000);
  let turns = conversationLogs.slice();
  if (SUPABASE_ENABLED) {
    const rows = await supabaseFetchRecent(limit);
    if (rows) turns = rows.map(normalizeTurnRow);
  }
  res.json({
    ok: true,
    bot_version: BOT_VERSION,
    tags: CUSTOMER_META_TAGS,
    customers: customerMetaFromTurns(turns)
  });
});

app.post("/admin/customer-meta/:userId", (req, res) => {
  if (!adminAuthOk(req, "agent")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const userId = normalizeConversationUserId(req.params.userId);
  if (!userId) {
    res.status(400).json({ ok: false, error: "missing_user_id" });
    return;
  }
  const meta = recordCustomerMeta(userId, {
    tags: req.body && req.body.tags,
    note: req.body && req.body.note
  });
  res.json({ ok: true, userId, meta });
});

app.get("/admin/client-onboarding-demo", (req, res) => {
  if (String(req.query.step || "") !== "setup") {
    renderCustomerPublicSignup(res, {
      businessHint: req.query.business || "Comercio piloto",
      demoMode: true,
      demoNextPath: "/admin/client-onboarding-demo?step=setup"
    });
    return;
  }
  const answers = defaultClientOnboarding();
  answers.business.brand_name = "Comercio piloto";
  answers.business.contact_name = "Responsable del proyecto";
  answers.business.contact_email = "contacto@comercio.com";
  answers.meta.whatsapp_number = "+57 300 000 0000";
  answers.meta.number_status = "business_app";
  answers.commerce.store_url = "https://tienda-ejemplo.com";
  answers.team.admin_name = "Administrador del cliente";
  const questionnaire = normalizeCustomerSetupQuestionnaire({ questions: CUSTOMER_SETUP_QUESTIONS }, "NexforIA", null);
  const record = createOnboardingRecord(answers, { tenant_id: "pilot-demo", status: "draft", updated_by: "NexforIA", questionnaire });
  renderClientOnboarding(res, {
    tenant: { id: "pilot-demo", name: "Comercio piloto" },
    record,
    actor: "NexforIA",
    demo: true,
    apiPath: "",
    completionPath: "/admin/panel-demo?tab=channels&from=onboarding",
    paymentsV1Enabled: true,
    demoPaymentPath: "/admin/client-onboarding-demo/payment",
    questionnaire
  });
});

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function renderDemoPaymentStep(res, options) {
  options = options || {};
  const nextPath = options.nextPath || "/admin/panel-demo?tab=channels&from=onboarding";
  const checkoutUrl = options.checkoutUrl || "";
  const unavailableReason = options.unavailableReason || "";
  res.status(200).setHeader("content-type", "text/html; charset=utf-8");
  res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pago Wompi · Nextfor IA</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=Sora:wght@700;800&display=swap" rel="stylesheet"><style>:root{--navy:#071632;--cyan:#16AEEF;--line:#DDE7F2;--muted:#66758D;--green:#14A971}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#F4F8FC;color:#071632;font-family:"Plus Jakarta Sans",sans-serif;display:grid;place-items:center;padding:24px}.card{width:min(780px,100%);background:#fff;border:1px solid var(--line);border-radius:28px;box-shadow:0 20px 55px rgba(7,22,50,.12);overflow:hidden}.hero{display:grid;grid-template-columns:1fr 170px;gap:20px;align-items:center;padding:34px;background:linear-gradient(135deg,#071632,#0E3A69);color:#fff}.hero img{width:150px;justify-self:center;filter:drop-shadow(0 18px 28px rgba(22,174,239,.28))}.hero small{color:#65D4FF;font-weight:800;letter-spacing:.14em}.hero h1{margin:10px 0 8px;font:800 clamp(30px,5vw,44px)/1.05 Sora,sans-serif;letter-spacing:-.04em}.hero p{margin:0;color:#C5D6EC;line-height:1.6}.body{padding:30px 34px}.steps{display:grid;gap:12px;margin:0 0 22px}.step{display:flex;gap:12px;align-items:flex-start;padding:14px;border:1px solid var(--line);border-radius:16px;background:#F8FBFE}.step b{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--cyan);color:#fff}.step strong{display:block;font-size:14px}.step span{display:block;margin-top:3px;color:var(--muted);font-size:13px;line-height:1.45}.actions{display:flex;gap:12px;flex-wrap:wrap}.btn{height:48px;border-radius:14px;padding:0 18px;border:1px solid var(--line);background:#fff;color:#071632;font-weight:800;text-decoration:none;display:inline-grid;place-items:center}.btn.primary{border:0;background:linear-gradient(135deg,#27B8F2,#009FEF);color:#fff;box-shadow:0 12px 30px rgba(22,174,239,.24)}.notice{margin-top:16px;padding:13px 14px;border-radius:14px;background:#FFF8E8;color:#745119;font-size:12px;line-height:1.5}@media(max-width:680px){.hero{grid-template-columns:1fr;text-align:center}.hero img{order:-1}.body{padding:24px 18px}.actions .btn{width:100%}}</style></head><body><main class="card"><section class="hero"><div><small>✧ WOMPI SANDBOX</small><h1>Ahora registra el pago para activar tu panel.</h1><p>El entrenamiento ya quedó guardado. El Customer Panel operativo se abre después de completar el paso de Wompi.</p></div><img src="/admin/assets/lumen-entrenando.png" alt="Lumen entrenando"></section><section class="body"><div class="steps"><article class="step"><b>1</b><div><strong>Entrenamiento completo</strong><span>Nextfor ya tiene las instrucciones de tu negocio.</span></div></article><article class="step"><b>2</b><div><strong>Pago con Wompi</strong><span>${checkoutUrl ? "Abriremos Wompi Sandbox para registrar el pago de prueba." : "Wompi Sandbox no está configurado en este ambiente; usa la simulación segura para revisar el flujo."}</span></div></article><article class="step"><b>3</b><div><strong>Panel desbloqueado</strong><span>En real, esto ocurre cuando Wompi confirma el pago por webhook o el contrato queda listo.</span></div></article></div><div class="actions">${checkoutUrl ? `<a class="btn primary" href="${escapeHtml(checkoutUrl)}">Abrir Wompi Sandbox →</a>` : `<a class="btn primary" href="/admin/client-onboarding-demo/payment-return?demo_payment=approved&next=${encodeURIComponent(nextPath)}">Simular registro en Wompi →</a>`}<a class="btn" href="${escapeHtml(nextPath)}">Saltar solo en demo</a></div>${unavailableReason ? `<div class="notice"><strong>Modo demo:</strong> ${escapeHtml(unavailableReason)}</div>` : ""}</section></main></body></html>`);
}

app.get("/admin/client-onboarding-demo/payment", (req, res) => {
  const nextPath = String(req.query.next || "/admin/panel-demo?tab=channels&from=onboarding");
  let checkoutUrl = "";
  let unavailableReason = "";
  if (/^pub_test_/.test(WOMPI_PUBLIC_KEY) && /^test_integrity_/.test(WOMPI_INTEGRITY_SECRET) && PUBLIC_BASE_URL) {
    const reference = "nexfor-demo-" + Date.now().toString(36) + "-" + crypto.randomBytes(4).toString("hex");
    const amountInCents = 500000;
    const query = new URLSearchParams({
      "public-key": WOMPI_PUBLIC_KEY,
      currency: "COP",
      "amount-in-cents": String(amountInCents),
      reference,
      "signature:integrity": integritySignature(reference, amountInCents, WOMPI_INTEGRITY_SECRET),
      "redirect-url": PUBLIC_BASE_URL + "/admin/client-onboarding-demo/payment-return?next=" + encodeURIComponent(nextPath)
    });
    checkoutUrl = "https://checkout.wompi.co/p/?" + query.toString();
  } else {
    unavailableReason = "Render Staging todavía no tiene activadas las credenciales sandbox de Wompi para abrir checkout real. La simulación solo valida el orden del journey.";
  }
  renderDemoPaymentStep(res, { nextPath, checkoutUrl, unavailableReason });
});

app.get("/admin/client-onboarding-demo/payment-return", (req, res) => {
  const nextPath = String(req.query.next || "/admin/panel-demo?tab=channels&from=onboarding");
  res.status(200).setHeader("content-type", "text/html; charset=utf-8");
  res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pago confirmado · Nextfor IA</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Sora:wght@700;800&display=swap" rel="stylesheet"><style>:root{--navy-900:#071632;--navy-800:#0A1836;--navy-700:#122A5C;--cyan-500:#00A0F0;--cyan-400:#25B8F2;--cyan-300:#62D4FF;--green-500:#14A971;--gradient-hero:radial-gradient(120% 120% at 78% 0%,rgba(0,160,240,.18),rgba(0,160,240,0) 52%),linear-gradient(145deg,#122A5C 0%,#071632 58%,#060F22 100%);--gradient-cyan:linear-gradient(135deg,#27B8F2,#009FEF);--shadow-xl:0 34px 90px rgba(7,22,50,.28);--shadow-lg:0 18px 44px rgba(7,22,50,.22);--shadow-glow:0 18px 42px rgba(0,160,240,.34);--ease-out:cubic-bezier(.22,.61,.36,1);--ease-spring:cubic-bezier(.2,.9,.25,1.22)}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#071632;color:#fff;font-family:"Plus Jakarta Sans",ui-sans-serif,sans-serif;display:grid;place-items:center;padding:48px 24px}.welcome{position:relative;width:min(940px,100%);min-height:min(760px,calc(100vh - 96px));display:flex;align-items:center;justify-content:center;background:var(--gradient-hero);border-radius:32px;overflow:hidden;box-shadow:var(--shadow-xl);animation:bprise .55s var(--ease-out) both}.welcome:before{content:"";position:absolute;top:-150px;right:-110px;width:520px;height:520px;background:radial-gradient(circle,rgba(0,160,240,.26),transparent 62%);pointer-events:none;animation:bpglow 5s ease-in-out infinite}.welcome:after{content:"";position:absolute;bottom:-190px;left:-150px;width:480px;height:480px;background:radial-gradient(circle,rgba(30,68,136,.34),transparent 64%);pointer-events:none}.inner{position:relative;z-index:1;width:100%;padding:44px 52px 52px;display:flex;flex-direction:column;align-items:center;text-align:center}.badge{display:inline-flex;align-items:center;gap:10px;background:rgba(20,169,113,.15);border:1px solid rgba(20,169,113,.4);color:#3DE0A0;font-size:15px;font-weight:800;padding:11px 20px;border-radius:999px;animation:bppop .5s var(--ease-spring) .1s both}.badge i{display:inline-flex;width:24px;height:24px;border-radius:50%;background:var(--gradient-cyan);align-items:center;justify-content:center;font-style:normal}.mascotWrap{position:relative;width:170px;height:170px;margin:26px 0 4px;animation:bpfloat 6s ease-in-out infinite}.mascotWrap img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 22px 44px rgba(0,160,240,.3))}.bubble{position:absolute;top:10px;left:128px;background:#fff;color:var(--navy-800);font-size:15px;font-weight:800;padding:11px 16px;border-radius:16px 16px 16px 4px;box-shadow:var(--shadow-lg);white-space:nowrap;animation:bppop .5s var(--ease-spring) .45s both}.overline{margin-top:10px;color:var(--cyan-300);font-size:15px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;animation:bprise .5s var(--ease-out) .25s both}h1{max-width:17ch;margin:18px 0 0;color:#fff;font:800 clamp(42px,6.2vw,72px)/1.04 Sora,sans-serif;letter-spacing:-.045em;text-wrap:balance;animation:bprise .5s var(--ease-out) .32s both}h1 span{color:var(--cyan-400)}p{max-width:62ch;margin:22px 0 0;color:rgba(255,255,255,.84);font-size:clamp(18px,2.1vw,24px);line-height:1.55;text-wrap:pretty;animation:bprise .5s var(--ease-out) .4s both}.traits{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-top:34px;animation:bprise .5s var(--ease-out) .5s both}.trait{display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);padding:12px 20px;border-radius:999px;color:rgba(255,255,255,.92);font-size:17px;font-weight:800;white-space:nowrap}.trait i{width:12px;height:12px;border-radius:50%;background:var(--cyan-300);font-style:normal}.actions{display:flex;flex-direction:column;align-items:center;gap:18px;margin-top:48px;animation:bprise .5s var(--ease-out) .6s both}.btn{height:64px;padding:0 40px;display:inline-flex;align-items:center;gap:14px;border-radius:16px;background:var(--gradient-cyan);box-shadow:var(--shadow-glow);color:#fff;text-decoration:none;font-size:20px;font-weight:900;transition:transform .2s var(--ease-out),box-shadow .2s var(--ease-out)}.btn:hover{transform:translateY(-1px);box-shadow:0 22px 52px rgba(0,160,240,.42)}.status{display:inline-flex;align-items:center;gap:10px;color:rgba(255,255,255,.64);font-size:16px}.status i{width:10px;height:10px;border-radius:50%;background:var(--green-500);box-shadow:0 0 0 5px rgba(20,169,113,.22);font-style:normal}@keyframes bpfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}@keyframes bppop{from{opacity:0;transform:translateY(12px) scale(.95)}to{opacity:1;transform:none}}@keyframes bprise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}@keyframes bpglow{0%,100%{opacity:.85}50%{opacity:1}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}@media(max-width:680px){body{padding:0;background:#05070E}.welcome{min-height:100vh;border-radius:0;box-shadow:none}.inner{min-height:100vh;padding:44px 24px 30px}.badge{font-size:12px;padding:8px 14px}.badge i{width:19px;height:19px}.mascotWrap{width:128px;height:128px;margin-top:20px}.bubble{left:96px;top:0;font-size:12px;padding:8px 11px}.overline{font-size:11px;margin-top:12px}h1{font-size:clamp(32px,10.5vw,42px);margin-top:12px}p{font-size:16px;line-height:1.55;margin-top:16px}.traits{gap:8px;margin-top:22px}.trait{font-size:13px;padding:9px 13px}.actions{width:100%;margin-top:auto;padding-top:30px}.btn{width:100%;height:56px;justify-content:center;font-size:17px;padding:0 18px}.status{font-size:13px}}</style></head><body><main class="welcome"><section class="inner"><div class="badge"><i><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg></i>Pago confirmado</div><div class="mascotWrap"><img src="/admin/assets/nextfor-mascota-nobg.png" alt="Nextfor, tu asistente de Nextfor IA"><div class="bubble">¡Ya soy de tu equipo!</div></div><div class="overline">✧ Bienvenido a Nextfor</div><h1>Tu negocio acaba de sumar a quien <span>nunca se va a casa</span>.</h1><p>Desde hoy Nextfor atiende, responde y agenda por ti en WhatsApp. El fichaje que rinde mes a mes — sin descansos, sin días malos.</p><div class="traits"><span class="trait"><i></i>Trabaja 24/7</span><span class="trait"><i></i>Nunca falta</span><span class="trait"><i></i>Rinde mes a mes</span></div><div class="actions"><a class="btn" href="${escapeHtml(nextPath)}">Ir al Customer Panel <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path></svg></a><span class="status"><i></i>Tu panel ya está activo y listo para trabajar</span></div></section></main></body></html>`);
});

app.get("/admin/create-account-demo", (req, res) => {
  renderCustomerPublicSignup(res, {
    businessHint: req.query.business || "Comercio piloto",
    demoMode: true,
    demoNextPath: "/admin/client-onboarding-demo?step=setup"
  });
});

app.get("/admin/client-onboarding", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!auth.ok || !customerPanelAuthOk(req, "admin")) {
    if (CUSTOMER_ACCESS_V2_ENABLED) renderCustomerLogin(res, { targetPath: "/admin/client-onboarding" });
    else renderAdminLogin(res, "/admin/client-onboarding");
    return;
  }
  if (auth.method === "key") setDashboardSessionCookie(req, res, auth);
  const tenantId = customerTenantForAuth(auth);
  const record = await loadClientOnboarding(false, tenantId);
  const questionnaire = await loadCustomerSetupQuestionnaire(false);
  const reviewStatus = record.setup_review && record.setup_review.status || "";
  if (auth.version === 2 && record.setup_completed && reviewStatus !== "incomplete" && req.query.edit !== "1") {
    res.redirect(PAYMENTS_V1_ENABLED ? "/admin/panel?tab=plan" : "/admin/panel?tab=summary");
    return;
  }
  let catalogs = { plans: [], bots: [] };
  if (CUSTOMER_ACCESS_V2_ENABLED && catalogService) {
    try { catalogs = await catalogService.activeCatalogs(); }
    catch (_) {}
  }
  const business = customerBusinessForAuth(auth);
  const plan = (catalogs.plans || []).find(function (item) { return item.id === business.plan_id; }) || null;
  const bot = (catalogs.bots || []).find(function (item) { return item.id === business.assigned_bot_id; }) || null;
  let billing = null;
  if (PAYMENTS_V1_ENABLED && paymentService) {
    try { billing = await paymentService.tenantBilling(tenantId); }
    catch (_) {}
  }
  const displayRecord = JSON.parse(JSON.stringify(record));
  displayRecord.answers = displayRecord.answers || defaultClientOnboarding();
  if (!displayRecord.answers.business.brand_name) displayRecord.answers.business.brand_name = business.name;
  if (!displayRecord.answers.team.admin_email) displayRecord.answers.team.admin_email = auth.email || auth.username;
  if (!displayRecord.answers.business.contact_email) displayRecord.answers.business.contact_email = auth.email || auth.username;
  renderClientOnboarding(res, {
    tenant: business,
    record: displayRecord,
    actor: auth.name || auth.username,
    adminEmail: auth.email || auth.username,
    plan,
    plans: catalogs.plans || [],
    bot,
    bots: catalogs.bots || [],
    billing,
    paymentsV1Enabled: PAYMENTS_V1_ENABLED,
    demo: false,
    apiPath: "/admin/client-onboarding/data",
    completionPath: CUSTOMER_SETUP_COMPLETION_PATH,
    questionnaire
  });
});

app.get("/admin/client-onboarding/data", async (req, res) => {
  if (!customerPanelAuthOk(req, "viewer")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const auth = dashboardAuth(req);
  const tenantId = customerTenantForAuth(auth);
  const questionnaire = await loadCustomerSetupQuestionnaire(false);
  res.json({
    ok: true,
    tenant: customerBusinessForAuth(auth),
    onboarding: await loadClientOnboarding(false, tenantId),
    questionnaire
  });
});

app.get("/admin/customer-setup-questionnaire", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    res.json({
      ok: true,
      questionnaire: await loadCustomerSetupQuestionnaire(true),
      persistent_store: SUPABASE_ENABLED ? "supabase" : "memory_test_only"
    });
  } catch (_) {
    res.status(503).json({ ok: false, error: "questionnaire_store_unavailable" });
  }
});

app.put("/admin/customer-setup-questionnaire", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    const questionnaire = await persistCustomerSetupQuestionnaire(req.body && req.body.questionnaire || req.body, auth);
    res.json({ ok: true, questionnaire });
  } catch (error) {
    console.error("customer setup questionnaire error:", error.message);
    res.status(503).json({ ok: false, error: "questionnaire_store_unavailable" });
  }
});

app.get("/admin/customer-setups", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    const tenants = await listSetupReviewTenants();
    const setups = await Promise.all(tenants.map(async function (tenant) {
      const onboarding = await loadClientOnboarding(true, tenant.id);
      const review = setupReviewSummary(onboarding);
      return {
        tenant,
        tenant_id: tenant.id,
        company_name: tenant.company_name || tenant.name || tenant.id,
        setup_goal: onboarding.answers && onboarding.answers.setup_goal || "unknown",
        completion: onboarding.completion || 0,
        setup_completed: !!onboarding.setup_completed,
        customer_service_configuration: onboarding.customer_service_configuration ? {
          lifecycle: onboarding.customer_service_configuration.lifecycle,
          updated_at: onboarding.customer_service_configuration.updated_at,
          updated_by: onboarding.customer_service_configuration.updated_by
        } : null,
        review,
        updated_at: onboarding.last_updated_at || onboarding.updated_at || null
      };
    }));
    setups.sort(function (a, b) {
      return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
    });
    res.json({ ok: true, statuses: SETUP_REVIEW_STATUSES, setups });
  } catch (error) {
    console.error("customer setups list error:", error.message);
    res.status(503).json({ ok: false, error: "setup_review_unavailable" });
  }
});

app.get("/admin/leads", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    res.json({ ok: true, leads: await buildSuperAdminLeadsPipeline() });
  } catch (error) {
    console.error("super admin leads error:", error.message);
    res.status(503).json({ ok: false, error: "leads_unavailable" });
  }
});

app.get("/admin/customer-setups/:tenantId", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    const tenant = await setupReviewTenant(req.params.tenantId);
    if (!tenant) {
      res.status(404).json({ ok: false, error: "tenant_not_found" });
      return;
    }
    const onboarding = await loadClientOnboarding(true, tenant.id);
    res.json({
      ok: true,
      tenant,
      onboarding,
      review: setupReviewSummary(onboarding),
      questionnaire: await loadCustomerSetupQuestionnaire(false),
      statuses: SETUP_REVIEW_STATUSES
    });
  } catch (error) {
    console.error("customer setup detail error:", error.message);
    res.status(error.status || 503).json({ ok: false, error: error.message === "tenant_not_found" ? "tenant_not_found" : "setup_review_unavailable" });
  }
});

app.put("/admin/customer-setups/:tenantId", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    const record = await persistSetupReview(req.params.tenantId, req.body || {}, auth);
    res.json({
      ok: true,
      onboarding: record,
      review: setupReviewSummary(record)
    });
  } catch (error) {
    console.error("customer setup review save error:", error.message);
    const expectedErrors = [
      "tenant_not_found",
      "setup_not_completed",
      "setup_must_be_approved",
      "customer_service_not_selected",
      "configuration_not_building",
      "configuration_required",
      "public_activation_requires_separate_approval"
    ];
    res.status(error.status || 503).json({
      ok: false,
      error: expectedErrors.includes(error.message) ? error.message : "setup_review_unavailable"
    });
  }
});

app.put("/admin/client-onboarding/data", async (req, res) => {
  if (!customerPanelAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    const auth = dashboardAuth(req);
    const tenantId = customerTenantForAuth(auth);
    const requestedStatus = req.body && ["submitted", "completed"].includes(req.body.status) ? req.body.status : "draft";
    const candidate = createOnboardingRecord(req.body && req.body.answers, {
      tenant_id: tenantId,
      status: requestedStatus,
      updated_by: auth.name || auth.username,
      questionnaire: await loadCustomerSetupQuestionnaire(false)
    });
    if (requestedStatus === "completed" && candidate.completion < 100) {
      res.status(422).json({
        ok: false,
        error: "setup_incomplete",
        completion: candidate.completion,
        message: "Completa la información requerida antes de terminar la configuración."
      });
      return;
    }
    const paymentChoice = requestedStatus === "completed" && PAYMENTS_V1_ENABLED
      ? String(req.body && req.body.payment_choice || "").trim().toLowerCase()
      : "";
    if (requestedStatus === "completed" && PAYMENTS_V1_ENABLED &&
        !["pay", "trial", "pilot"].includes(paymentChoice)) {
      throw new PaymentError("payment_choice_required", 400);
    }
    const selectedPlanId = String(req.body && req.body.plan_id || auth.plan_id || "").trim().toLowerCase();
    const selectedBotId = String(req.body && req.body.bot_id || auth.assigned_bot_id || "").trim().toLowerCase();
    if (PAYMENTS_V1_ENABLED && requestedStatus === "completed" && (!selectedPlanId || !selectedBotId)) {
      throw new PaymentError("plan_and_bot_required", 400);
    }
    let selectedPlan = null;
    if (auth.version === 2 && selectedPlanId && selectedBotId &&
        (selectedPlanId !== String(auth.plan_id || "").toLowerCase() ||
         selectedBotId !== String(auth.assigned_bot_id || "").toLowerCase())) {
      if (!catalogService) throw new CatalogError("catalog_unavailable", 503);
      selectedPlan = await catalogService.selectTenantPlan(
        tenantId,
        selectedPlanId,
        selectedBotId,
        auth
      );
    }
    let billing = null;
    let checkout = null;
    if (PAYMENTS_V1_ENABLED && paymentService && selectedPlanId && selectedBotId) {
      const business = customerBusinessForAuth(auth);
      billing = await paymentService.prepareContract({
        tenant_id: tenantId,
        customer: business.name,
        customer_email: auth.email || auth.username,
        plan_id: selectedPlanId,
        bot_id: selectedBotId
      });
      if (requestedStatus === "completed") {
        if (paymentChoice !== "pay" &&
            (!billing || billing.subscription_status !== paymentChoice || !billing.ready_for_bot_creation)) {
          throw new PaymentError("bypass_not_approved", 403);
        }
      }
    }
    const record = await persistClientOnboarding(candidate.answers, requestedStatus, auth, tenantId);
    if (requestedStatus === "completed" && paymentChoice === "pay") {
      const business = customerBusinessForAuth(auth);
      checkout = await paymentService.startCheckout({
        tenant_id: tenantId,
        customer: business.name,
        customer_email: auth.email || auth.username,
        plan_id: selectedPlanId,
        bot_id: selectedBotId,
        actor: auth.email || auth.username || "customer"
      });
    }
    res.json({
      ok: true,
      onboarding: record,
      selected_plan_id: selectedPlan && selectedPlan.plan_id || selectedPlanId || null,
      selected_bot_id: selectedPlan && selectedPlan.assigned_bot_id || selectedBotId || null,
      billing,
      checkout,
      redirect: checkout && checkout.checkout_url ||
        (record.setup_completed ? CUSTOMER_SETUP_COMPLETION_PATH : null)
    });
  } catch (error) {
    console.error("client onboarding save error:", error.message);
    if (error instanceof CatalogError) {
      res.status(error.status || 400).json({
        ok: false,
        error: error.code,
        message: error.code === "invalid_plan_for_bot"
          ? "Este plan no está disponible para el bot asignado a tu empresa."
          : "El plan elegido ya no está disponible. Selecciona otro plan activo."
      });
      return;
    }
    if (error instanceof PaymentError) {
      res.status(error.status || 400).json({
        ok: false,
        error: error.code,
        message: ({
          payment_choice_required: "Elige pagar o usa un trial/piloto previamente aprobado.",
          bypass_not_approved: "Este trial o piloto todavía no está aprobado por Super Admin.",
          wompi_staging_not_configured: "Wompi Sandbox todavía no está configurado en Staging."
        })[error.code] || "No pudimos preparar la facturación de tu plan."
      });
      return;
    }
    res.status(503).json({ ok: false, error: "onboarding_store_unavailable", message: "No pudimos guardar el proceso. Intenta nuevamente." });
  }
});

app.get("/admin/bot-setup", async (req, res) => {
  if (!adminAuthOk(req, "viewer")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const auth = dashboardAuth(req);
  const setup = await loadBotSetup(false);
  const defaults = createSetupRecord(defaultBotSetupAnswers(), {
    tenant_id: CUSTOMER_PANEL_BUSINESS.id,
    status: "draft",
    updated_by: ""
  });
  defaults.updated_at = null;
  const current = setup.draft || setup.published || defaults;
  res.json({
    ok: true,
    tenant: CUSTOMER_PANEL_BUSINESS,
    can_edit: !!customerPanelCapabilities(auth.role).configure_bot,
    industries: INDUSTRY_PROFILES,
    current,
    published: setup.published ? {
      status: setup.published.status,
      completion: setup.published.completion,
      updated_at: setup.published.updated_at,
      published_at: setup.published.published_at,
      updated_by: setup.published.updated_by
    } : null
  });
});

app.put("/admin/bot-setup", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const auth = dashboardAuth(req);
  try {
    const record = await persistBotSetup(req.body && req.body.answers, "draft", auth);
    res.json({ ok: true, setup: record });
  } catch (error) {
    console.error("bot setup draft error:", error.message);
    res.status(503).json({ ok: false, error: "setup_store_unavailable", message: "No pudimos guardar la configuración. Intenta nuevamente." });
  }
});

app.post("/admin/bot-setup/publish", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const auth = dashboardAuth(req);
  try {
    const existing = await loadBotSetup(false);
    const answers = req.body && req.body.answers ? req.body.answers : existing.draft && existing.draft.answers;
    const candidate = createSetupRecord(answers, {
      tenant_id: CUSTOMER_PANEL_BUSINESS.id,
      status: "published",
      updated_by: auth.name || auth.username
    });
    if (candidate.answers.retargeting && candidate.answers.retargeting.mode === "automatic" && !RETARGETING_AUTOMATIC_MODE_ENABLED) {
      res.status(422).json({
        ok: false,
        error: "retargeting_automatic_not_enabled",
        message: "El retargeting automático sigue bloqueado. Usa simulación o aprobación manual hasta completar la validación operativa."
      });
      return;
    }
    if (candidate.completion < 55) {
      res.status(422).json({
        ok: false,
        error: "setup_incomplete",
        completion: candidate.completion,
        message: "Completa al menos la información esencial del negocio, servicio, tono y escalamiento antes de activar el bot."
      });
      return;
    }
    const record = await persistBotSetup(candidate.answers, "published", auth);
    res.json({ ok: true, setup: record, active_for_new_messages: true });
  } catch (error) {
    console.error("bot setup publish error:", error.message);
    res.status(503).json({ ok: false, error: "setup_store_unavailable", message: "No pudimos activar la configuración. Intenta nuevamente." });
  }
});

function retargetingTenantForRequest(req) {
  const auth = dashboardAuth(req);
  const requested = String(req.query.tenant_id || req.body && req.body.tenant_id || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return auth.role === "super_admin" && requested ? requested : CUSTOMER_PANEL_BUSINESS.id;
}

app.get("/admin/retargeting", async (req, res) => {
  if (!adminAuthOk(req, "viewer")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    const tenantId = retargetingTenantForRequest(req);
    const snapshot = await retargetingEngine.snapshot(tenantId);
    const policy = await retargetingPolicyForTenant(tenantId);
    res.json({ ok: true, policy, persistent_store: SUPABASE_ENABLED ? "supabase" : "memory_test_only", can_manage: !!customerPanelCapabilities(dashboardAuth(req).role).manage_retargeting, snapshot });
  } catch (error) {
    res.status(503).json({ ok: false, error: "retargeting_store_unavailable", message: error.message });
  }
});

app.post("/admin/retargeting/consent", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    const auth = dashboardAuth(req);
    const consent = await retargetingEngine.recordConsent({
      tenant_id: retargetingTenantForRequest(req),
      customer_id: req.body && req.body.customer_id,
      category: req.body && req.body.category,
      granted: req.body && req.body.granted !== false,
      proof_id: req.body && req.body.proof_id,
      proof_type: req.body && req.body.proof_type,
      granted_at: req.body && req.body.granted_at,
      expires_at: req.body && req.body.expires_at,
      revoked_at: req.body && req.body.revoked_at,
      actor: auth.name || auth.username
    });
    res.json({ ok: true, consent });
  } catch (error) {
    res.status(422).json({ ok: false, error: error.message, message: "El consentimiento debe tener cliente, categoría y evidencia verificable." });
  }
});

app.post("/admin/retargeting/jobs", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    const auth = dashboardAuth(req);
    const tenantId = retargetingTenantForRequest(req);
    const configuredPolicy = await retargetingPolicyForTenant(tenantId);
    const policy = RETARGETING_TEST_MODE && req.body && req.body.policy_override ? req.body.policy_override : configuredPolicy;
    const jobInput = Object.assign({}, req.body || {}, {
      tenant_id: tenantId,
      channel_tenant_id: tenantId,
      actor: auth.name || auth.username
    });
    if (!RETARGETING_TEST_MODE) {
      delete jobInput.consent;
      const templateNames = { abandoned_cart: "abandoned_cart_rav", post_purchase: "post_sale_review_rav", back_in_stock: "back_in_stock_rav", recommendation: "product_recommendation_rav" };
      jobInput.template = approvedRetargetingTemplate(templateNames[jobInput.event_type]);
    }
    const job = await retargetingEngine.createJob(jobInput, policy);
    res.status(job.created ? 201 : 200).json({ ok: true, result: job });
  } catch (error) {
    res.status(422).json({ ok: false, error: error.message, message: "No se pudo crear la decisión de retargeting." });
  }
});

app.post("/admin/retargeting/jobs/:jobId/approve", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    const auth = dashboardAuth(req);
    const job = await retargetingEngine.approveJob(retargetingTenantForRequest(req), req.params.jobId, auth.name || auth.username);
    res.json({ ok: true, job, real_message_sent: false });
  } catch (error) {
    res.status(422).json({ ok: false, error: error.message });
  }
});

app.post("/admin/retargeting/jobs/:jobId/cancel", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    const auth = dashboardAuth(req);
    const job = await retargetingEngine.cancelJob(retargetingTenantForRequest(req), req.params.jobId, auth.name || auth.username, req.body && req.body.reason || "manual_cancel");
    res.json({ ok: true, job });
  } catch (error) {
    res.status(422).json({ ok: false, error: error.message });
  }
});

app.post("/admin/retargeting/pause", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const auth = dashboardAuth(req);
  const result = await retargetingEngine.pauseTenant(retargetingTenantForRequest(req), auth.name || auth.username, req.body && req.body.reason);
  res.json({ ok: true, result });
});

app.post("/admin/retargeting/resume", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const auth = dashboardAuth(req);
  const result = await retargetingEngine.resumeTenant(retargetingTenantForRequest(req), auth.name || auth.username);
  res.json({ ok: true, result });
});

app.post("/admin/retargeting/signals", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    const auth = dashboardAuth(req);
    const result = await retargetingEngine.recordCustomerSignal({
      tenant_id: retargetingTenantForRequest(req),
      customer_id: req.body && req.body.customer_id,
      signal: req.body && req.body.signal,
      source_event_id: req.body && req.body.source_event_id,
      actor: auth.name || auth.username
    });
    res.json({ ok: true, result });
  } catch (error) {
    res.status(422).json({ ok: false, error: error.message });
  }
});

app.post("/admin/retargeting/templates/status", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    const auth = dashboardAuth(req);
    const result = await retargetingEngine.recordTemplateStatus({
      tenant_id: retargetingTenantForRequest(req),
      name: req.body && req.body.name,
      language: req.body && req.body.language,
      status: req.body && req.body.status,
      active: req.body && req.body.active === true,
      quality: req.body && req.body.quality,
      checked_at: req.body && req.body.checked_at,
      actor: auth.name || auth.username
    });
    res.json({ ok: true, result });
  } catch (error) {
    res.status(422).json({ ok: false, error: error.message });
  }
});

app.post("/admin/retargeting/worker", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const auth = dashboardAuth(req);
  const requested = Array.isArray(req.body && req.body.tenant_ids) ? req.body.tenant_ids : [];
  const tenantIds = auth.role === "super_admin" && requested.length
    ? requested.map(function (value) { return String(value || "").toLowerCase().replace(/[^a-z0-9_-]/g, ""); }).filter(Boolean).slice(0, 100)
    : [retargetingTenantForRequest(req)];
  const results = [];
  for (const tenantId of Array.from(new Set(tenantIds))) results.push(await retargetingEngine.runWorker(tenantId));
  res.json({
    ok: true,
    simulation_safe: true,
    automatic_mode_enabled: RETARGETING_AUTOMATIC_MODE_ENABLED,
    real_sends_enabled: RETARGETING_REAL_SENDS_ENABLED,
    results
  });
});

function channelConnectionActor(auth) {
  return auth && (auth.email || auth.username || auth.user_id || auth.name) || "system";
}

function channelConnectionErrorResponse(res, error) {
  const problem = error instanceof ChannelConnectionError
    ? error
    : new ChannelConnectionError("channel_connection_unavailable", 503, error && error.message);
  const customerCodes = [
    "invalid_channel_request",
    "channel_oauth_not_configured",
    "connection_selection_expired",
    "invalid_asset_selection",
    "connection_not_found",
    "legacy_connection_protected"
  ];
  res.status(problem.status || 503).json({
    ok: false,
    error: customerCodes.includes(problem.code) ? problem.code : "channel_connection_failed",
    message: problem.code === "channel_oauth_not_configured"
      ? "Aún estamos preparando este paso. Habla con NextforIA."
      : problem.code === "legacy_connection_protected"
        ? "No se puede cambiar esta conexión desde aquí."
        : "No pudimos terminar este paso. Intenta de nuevo o habla con NextforIA."
  });
}

app.get("/admin/panel/channel-connections", async (req, res) => {
  if (!CHANNEL_CONNECTIONS_V1_VISIBLE || !channelConnectionService) {
    res.status(404).json({ ok: false, error: "channel_connections_disabled" });
    return;
  }
  if (!customerPanelAuthOk(req, "viewer")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const auth = dashboardAuth(req);
  if (!customerChannelConnectionsVisibleForAuth(auth)) {
    res.status(404).json({ ok: false, error: "channel_connections_disabled" });
    return;
  }
  try {
    const tenantId = customerTenantForAuth(auth);
    res.json({
      ok: true,
      channels: await channelConnectionService.listTenant(tenantId),
      meta_authorization_available: {
        whatsapp: channelConnectionService.providerConfigured("whatsapp"),
        instagram: channelConnectionService.providerConfigured("instagram"),
        messenger: channelConnectionService.providerConfigured("messenger")
      }
    });
  } catch (error) {
    console.error("customer channel list error:", error.message);
    channelConnectionErrorResponse(res, error);
  }
});

app.post("/admin/panel/channel-connections/:channel/connect", async (req, res) => {
  if (!CHANNEL_CONNECTIONS_V1_VISIBLE || !channelConnectionService) {
    res.status(404).json({ ok: false, error: "channel_connections_disabled" });
    return;
  }
  if (!customerPanelAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const auth = dashboardAuth(req);
  if (!customerChannelConnectionsVisibleForAuth(auth)) {
    res.status(404).json({ ok: false, error: "channel_connections_disabled" });
    return;
  }
  const channel = cleanChannel(req.params.channel);
  const tenantId = customerTenantForAuth(auth);
  try {
    const state = createOAuthState(DASHBOARD_SESSION_SECRET, {
      tenant_id: tenantId,
      channel,
      actor_id: auth.user_id || auth.username,
      actor: channelConnectionActor(auth)
    });
    const authorizationUrl = await channelConnectionService.begin(tenantId, channel, auth, state);
    res.json({ ok: true, authorization_url: authorizationUrl });
  } catch (error) {
    console.error("customer channel connect start error:", error.message);
    channelConnectionErrorResponse(res, error);
  }
});

app.get("/admin/channel-connections/meta/callback", async (req, res) => {
  if (!CHANNEL_CONNECTIONS_V1_VISIBLE || !channelConnectionService) {
    res.redirect("/admin/panel?tab=channels&connection=error");
    return;
  }
  const state = readOAuthState(DASHBOARD_SESSION_SECRET, req.query.state);
  if (!state || usedChannelOAuthNonces.has(state.nonce)) {
    res.redirect("/admin/panel?tab=channels&connection=error");
    return;
  }
  const session = dashboardAuth(req);
  if (session.ok && session.version === 2 &&
      (customerTenantForAuth(session) !== state.tenant_id ||
       String(session.user_id || session.username) !== String(state.actor_id))) {
    res.redirect("/admin/panel?tab=channels&connection=error");
    return;
  }
  usedChannelOAuthNonces.add(state.nonce);
  if (usedChannelOAuthNonces.size > 10000) {
    usedChannelOAuthNonces.delete(usedChannelOAuthNonces.values().next().value);
  }
  try {
    const result = await channelConnectionService.completeAuthorization({
      tenant_id: state.tenant_id,
      channel: state.channel,
      actor: state.actor,
      code: req.query.error ? "" : req.query.code
    });
    res.redirect("/admin/panel?tab=channels&connection=" +
      (result.status === "selection_required" ? "select" : "success"));
  } catch (error) {
    console.error("Meta channel authorization failed:", state.channel, error.internalMessage || error.message);
    res.redirect("/admin/panel?tab=channels&connection=error");
  }
});

app.post("/admin/panel/channel-connections/:channel/select", async (req, res) => {
  if (!CHANNEL_CONNECTIONS_V1_VISIBLE || !channelConnectionService) {
    res.status(404).json({ ok: false, error: "channel_connections_disabled" });
    return;
  }
  if (!customerPanelAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const auth = dashboardAuth(req);
  if (!customerChannelConnectionsVisibleForAuth(auth)) {
    res.status(404).json({ ok: false, error: "channel_connections_disabled" });
    return;
  }
  try {
    const connection = await channelConnectionService.selectAsset(
      customerTenantForAuth(auth),
      req.params.channel,
      req.body && req.body.asset_id,
      auth
    );
    res.json({ ok: true, message: "Connected successfully.", connection });
  } catch (error) {
    console.error("customer channel asset selection error:", error.message);
    channelConnectionErrorResponse(res, error);
  }
});

app.post("/admin/panel/channel-connections/:channel/disconnect", async (req, res) => {
  if (!CHANNEL_CONNECTIONS_V1_VISIBLE || !channelConnectionService) {
    res.status(404).json({ ok: false, error: "channel_connections_disabled" });
    return;
  }
  if (!customerPanelAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const auth = dashboardAuth(req);
  if (!customerChannelConnectionsVisibleForAuth(auth)) {
    res.status(404).json({ ok: false, error: "channel_connections_disabled" });
    return;
  }
  try {
    const connection = await channelConnectionService.disconnect(
      customerTenantForAuth(auth),
      req.params.channel,
      auth
    );
    res.json({ ok: true, message: "Canal desconectado.", connection });
  } catch (error) {
    console.error("customer channel disconnect error:", error.message);
    channelConnectionErrorResponse(res, error);
  }
});

app.get("/admin/channel-connections", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!CHANNEL_CONNECTIONS_V1_VISIBLE || !channelConnectionService) {
    res.status(404).json({ ok: false, error: "channel_connections_disabled" });
    return;
  }
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    const tenants = await listSetupReviewTenants();
    res.json({ ok: true, channels: await channelConnectionService.listAll(tenants) });
  } catch (error) {
    console.error("super admin channel list error:", error.message);
    channelConnectionErrorResponse(res, error);
  }
});

app.post("/admin/channel-connections/:tenantId/:channel/verify", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!CHANNEL_CONNECTIONS_V1_VISIBLE || !channelConnectionService) {
    res.status(404).json({ ok: false, error: "channel_connections_disabled" });
    return;
  }
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    res.json({
      ok: true,
      connection: await channelConnectionService.verify(req.params.tenantId, req.params.channel, auth)
    });
  } catch (error) {
    console.error("super admin channel verify error:", error.message);
    channelConnectionErrorResponse(res, error);
  }
});

app.post("/admin/channel-connections/:tenantId/:channel/help-reconnect", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!CHANNEL_CONNECTIONS_V1_VISIBLE || !channelConnectionService) {
    res.status(404).json({ ok: false, error: "channel_connections_disabled" });
    return;
  }
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    res.json({
      ok: true,
      connection: await channelConnectionService.requestReconnect(req.params.tenantId, req.params.channel, auth)
    });
  } catch (error) {
    console.error("super admin channel reconnect request error:", error.message);
    channelConnectionErrorResponse(res, error);
  }
});

app.post("/admin/channel-connections/:tenantId/:channel/disconnect", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!CHANNEL_CONNECTIONS_V1_VISIBLE || !channelConnectionService) {
    res.status(404).json({ ok: false, error: "channel_connections_disabled" });
    return;
  }
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    res.json({
      ok: true,
      connection: await channelConnectionService.disconnect(req.params.tenantId, req.params.channel, auth)
    });
  } catch (error) {
    console.error("super admin channel disconnect error:", error.message);
    channelConnectionErrorResponse(res, error);
  }
});

app.get("/admin/panel/data", async (req, res) => {
  if (!customerPanelAuthOk(req, "viewer")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const eventLimit = Math.max(50, Math.min(parseInt(req.query.limit) || 500, 500));
  const auth = dashboardAuth(req);
  const tenantId = customerTenantForAuth(auth);
  let source = tenantId === DEFAULT_TENANT_ID ? "memory" : "tenant_isolated";
  let turns = tenantId === DEFAULT_TENANT_ID
    ? conversationLogs.slice().reverse()
    : conversationLogs.filter(function (turn) { return cleanTenantId(turn.tenantId || turn.tenant_id) === tenantId; }).reverse();
  if (SUPABASE_ENABLED && tenantId === DEFAULT_TENANT_ID) {
    const rows = await supabaseFetchRecent(500);
    if (rows) {
      source = "supabase";
      turns = rows.map(normalizeTurnRow);
    }
  }
  turns.sort(function (a, b) {
    return new Date(b.ts || 0) - new Date(a.ts || 0);
  });
  const metaByCustomer = customerMetaFromTurns(turns);
  queueInstagramProfileRefreshes(turns);
  const snapshot = buildCustomerPanelSnapshot(turns, metaByCustomer, source, auth, eventLimit);
  if (auth.version === 2) snapshot.business = Object.assign({}, snapshot.business, customerBusinessForAuth(auth), {
    whatsapp_setup: { status: "pending", label: "WhatsApp pendiente" },
    instagram_setup: { status: "pending", label: "Instagram pendiente" },
    messenger_setup: { status: "pending", label: "Messenger pendiente" },
    channels: {}
  });
  res.json(snapshot);
});

app.get("/admin/panel/demo-data", (req, res) => {
  res.json(buildCustomerPanelDemoSnapshot());
});

app.get("/admin/panel/appointments-data", async (req, res) => {
  if (!customerPanelAuthOk(req, "viewer")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const auth = dashboardAuth(req);
  const tenantId = customerTenantForAuth(auth);
  const persistent = await hydrateAppointmentsForTenant(tenantId);
  const snapshot = appointmentRegistry.snapshot(tenantId);
  snapshot.source = persistent ? "supabase" : "memory";
  res.json(customerAppointmentSnapshot(snapshot, customerBusinessForAuth(auth)));
});

app.get("/admin/panel/demo-appointments-data", (req, res) => {
  res.json(demoAppointmentSnapshot());
});

app.get("/admin/panel/demo-setup", (req, res) => {
  const demo = createSetupRecord(defaultBotSetupAnswers(), {
    tenant_id: CUSTOMER_PANEL_BUSINESS.id,
    status: "draft",
    updated_by: ""
  });
  demo.updated_at = null;
  res.json({
    ok: true,
    tenant: CUSTOMER_PANEL_BUSINESS,
    can_edit: false,
    industries: INDUSTRY_PROFILES,
    current: demo,
    published: null
  });
});

app.get("/admin/panel/demo-retargeting", (req, res) => {
  res.json({
    ok: true,
    can_manage: false,
    policy: defaultBotSetupAnswers().retargeting,
    snapshot: {
      tenant_id: CUSTOMER_PANEL_BUSINESS.id,
      paused: false,
      automatic_mode_enabled: false,
      real_sends_enabled: false,
      timezone: "America/Bogota",
      hard_window: { start: "09:00", end: "19:00" },
      hard_max_marketing_messages_7d: 2,
      counts: { pending: 0, approved: 0, simulated: 0, cancelled: 0, blocked: 0, sent: 0 },
      jobs: [],
      blockers: [],
      history: []
    }
  });
});

app.get("/admin/templates", (req, res) => {
  if (!adminKeyOk(req)) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  res.json({
    ok: true,
    bot_version: BOT_VERSION,
    count: WHATSAPP_TEMPLATES.length,
    templates: WHATSAPP_TEMPLATES.map(function (template) {
      return {
        name: template.name,
        category: template.category,
        language: template.language,
        useCase: template.useCase,
        bodyVariables: template.bodyVariables,
        requiresOptOut: !!template.requiresOptOut
      };
    })
  });
});

app.get("/admin/commercial-readiness", (req, res) => {
  if (!adminKeyOk(req)) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const stages = COMMERCIAL_READINESS.stages || [];
  const readyCount = stages.filter(stage => stage.status === "ready").length;
  const waitingCount = stages.filter(stage => stage.status === "waiting_meta").length;
  res.json({
    ok: true,
    bot_version: BOT_VERSION,
    readiness_version: COMMERCIAL_READINESS.version,
    summary: {
      stages_total: stages.length,
      ready_stages: readyCount,
      waiting_meta_stages: waitingCount,
      next_best_work: "Propagar tenant_id, configuracion, usuarios, salud e integraciones aisladas antes del cliente #2."
    },
    current_blocker: {
      kind: "external_meta_review",
      detail: "La app NexforIA/RAV sigue esperando aprobacion de permisos WhatsApp antes de operar clientes reales a escala."
    },
    stages,
    default_roles: COMMERCIAL_READINESS.defaultRoles,
    required_tenant_fields: COMMERCIAL_READINESS.requiredTenantFields
  });
});

app.post("/admin/template-test", async (req, res) => {
  if (!adminKeyOk(req)) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const userId = String(req.body && req.body.userId || "").replace(/\D/g, "");
  const templateName = String(req.body && req.body.templateName || "").trim();
  const params = (req.body && (req.body.params || req.body.bodyParams)) || {};
  const shouldSend = req.body && req.body.send === true;
  if (shouldSend && !adminAuthOk(req, "agent")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  if (!templateName) {
    res.status(400).json({ ok: false, error: "missing_template_name" });
    return;
  }
  if (shouldSend && !userId) {
    res.status(400).json({ ok: false, error: "missing_user_id_for_send" });
    return;
  }

  try {
    const payload = buildTemplatePayload(userId || "573000000000", templateName, params);
    if (!shouldSend) {
      res.json({ ok: true, dry_run: true, templateName, payload });
      return;
    }
    const result = await sendTemplate(userId, templateName, params);
    recordAdminEvent(userId, "admin_send_template", "[Plantilla] " + templateName, result.ok ? "ok" : "error", false);
    res.status(result.ok ? 200 : 502).json({ ok: result.ok, templateName, userId, result });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post("/admin/reset-checkout/:userId", (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const userId = normalizeConversationUserId(req.params.userId);
  if (!userId) return res.status(400).json({ ok: false, error: "missing_user_id" });
  const had = checkouts.delete(userId);
  res.json({ ok: true, userId, hadCheckout: had });
});

app.get("/admin/status", (req, res) => {
  if (!adminKeyOk(req)) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  res.json({
    activeHandoffs: [...humanHandoff],
    activeCheckouts: [...checkouts.entries()].map(([k, v]) => ({
      userId: k,
      products: v.products?.map(p => ({title: p.title, price: p.price})) || [],
      total_amount: (v.products || []).reduce((sum, p) => sum + (p.price_amount || 0), 0),
      data: v.data
    })),
    conversationCount: conversations.size,
  });
});

app.get("/", (req, res) => {
  res.send("RAV-Bot " + BOT_VERSION + " (ops dashboard)");
});

const PORT = process.env.PORT || 3000;

// ─── ADMIN ENDPOINTS (added in v31 — observability + safety net) ────
// Health check: verifica que dependencias externas respondan, sin gastar
// créditos de Anthropic. Útil antes de hacer pruebas o deploys.
function renderLegacyCustomerPasswordSetup(res, options) {
  const valid = !!(options && options.valid);
  const invite = safeInlineJson(options && options.invite || "");
  const reason = escapeAdminHtml(options && options.reason || "Este enlace no está disponible.");
  const content = valid ? `
    <div class="eyebrow">CLIENTE #1 · RAV TOYS</div>
    <h1>Crea tu acceso al Panel de Control</h1>
    <p>Elige el usuario y la contraseña que usarás para consultar WhatsApp, Instagram y las conversaciones de tu equipo.</p>
    <form id="setupForm">
      <label for="name">Nombre del administrador</label>
      <input id="name" autocomplete="name" maxlength="100" placeholder="Ej. Santiago Velásquez" required>
      <label for="username">Usuario</label>
      <input id="username" autocomplete="username" maxlength="40" placeholder="Ej. admin.rav" required>
      <label for="password">Contraseña</label>
      <div class="passwordField"><input id="password" type="password" autocomplete="new-password" maxlength="128" required><button class="show" type="button" onclick="togglePasswords()">Mostrar</button></div>
      <div class="rules" id="rules"><span id="ruleLength">○ 12 caracteres</span><span id="ruleLetter">○ Una letra</span><span id="ruleNumber">○ Un número</span></div>
      <label for="passwordConfirmation">Confirma la contraseña</label>
      <input id="passwordConfirmation" type="password" autocomplete="new-password" maxlength="128" required>
      <button class="primary" id="submitBtn" type="submit">Crear acceso</button>
      <div class="error" id="error" role="alert"></div>
    </form>
    <div class="safe"><strong>Acceso seguro</strong><span>La contraseña se protege con un hash seguro antes de guardarse. NexforIA mantiene un acceso técnico separado.</span></div>` : `
    <div class="eyebrow">RAV TOYS · PANEL DE CONTROL</div>
    <h1>Este enlace no está disponible</h1>
    <p>${reason}</p>
    <a class="primary link" href="/admin/panel">Ir al inicio de sesión</a>`;
  res.status(valid ? 200 : Number(options && options.status) || 403).setHeader("content-type", "text/html; charset=utf-8");
  res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crear acceso · RAV Toys</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F4F7FB;color:#071832;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:24px}.shell{width:min(500px,100%)}.brand{display:flex;align-items:center;gap:12px;margin:0 0 18px 4px}.logo{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;color:#fff;font-size:18px;font-weight:900;background:linear-gradient(145deg,#25BFFF,#12A8F4);box-shadow:0 12px 24px rgba(18,168,244,.22)}.brand strong{font-size:18px}.brand span{display:block;color:#78869F;font-size:12px;margin-top:2px}.card{background:#fff;border:1px solid #DCE5F1;border-radius:24px;padding:30px;box-shadow:0 18px 45px rgba(8,22,52,.09)}.eyebrow{color:#0788C7;font-size:11px;font-weight:900;letter-spacing:.14em;margin-bottom:12px}h1{font-size:28px;line-height:1.08;letter-spacing:-.04em;margin:0}p{font-size:15px;line-height:1.55;color:#66738D;margin:12px 0 24px}label{display:block;color:#33425E;font-size:12px;font-weight:800;margin:14px 0 6px}input{width:100%;height:46px;border:1px solid #CBD5E1;border-radius:12px;padding:0 13px;font-size:14px;color:#071832;background:#fff}input:focus{outline:3px solid rgba(18,168,244,.15);border-color:#12A8F4}.passwordField{position:relative}.passwordField input{padding-right:76px}.show{position:absolute;right:7px;top:7px;height:32px;border:0;background:#F1F5F9;color:#52617B;border-radius:8px;padding:0 10px;font-size:11px;font-weight:800}.rules{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.rules span{font-size:11px;color:#8A96A8;background:#F5F7FA;border-radius:999px;padding:5px 8px}.rules span.ok{color:#087E50;background:#E7F8F0}.primary{width:100%;min-height:48px;border:0;border-radius:12px;background:linear-gradient(135deg,#25BFFF,#12A8F4);color:#fff;font-size:15px;font-weight:900;margin-top:20px;cursor:pointer}.primary:disabled{opacity:.55;cursor:wait}.link{display:grid;place-items:center;text-decoration:none}.error{color:#B94723;font-size:12px;min-height:18px;margin-top:10px;text-align:center}.safe{margin-top:20px;border-top:1px solid #E2E8F0;padding-top:18px;display:grid;grid-template-columns:auto 1fr;gap:4px 12px}.safe:before{content:"✓";grid-row:1/3;width:28px;height:28px;border-radius:9px;background:#E7F8F0;color:#087E50;display:grid;place-items:center;font-weight:900}.safe strong{font-size:12px}.safe span{font-size:11px;color:#78869F;line-height:1.45}@media(max-width:540px){body{padding:14px}.card{padding:22px;border-radius:20px}h1{font-size:25px}}
  </style></head><body><main class="shell"><div class="brand"><div class="logo">RAV</div><div><strong>RAV Toys</strong><span>Panel de Control · Nextfor IA</span></div></div><section class="card">${content}</section></main>${valid ? `<script>
var invite=${invite};var form=document.getElementById("setupForm"),password=document.getElementById("password"),confirmation=document.getElementById("passwordConfirmation");
function setRule(id,ok){var el=document.getElementById(id);if(el){el.classList.toggle("ok",ok);el.textContent=(ok?"✓":"○")+el.textContent.slice(1);}}
function updateRules(){var value=password.value||"";setRule("ruleLength",value.length>=12);setRule("ruleLetter",/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(value));setRule("ruleNumber",/\\d/.test(value));}
function togglePasswords(){var next=password.type==="password"?"text":"password";password.type=next;confirmation.type=next;document.querySelector(".show").textContent=next==="text"?"Ocultar":"Mostrar";}
password.addEventListener("input",updateRules);form.addEventListener("submit",function(event){event.preventDefault();var button=document.getElementById("submitBtn"),error=document.getElementById("error");error.textContent="";button.disabled=true;button.textContent="Creando acceso...";fetch(location.pathname,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({invite:invite,name:document.getElementById("name").value.trim(),username:document.getElementById("username").value.trim(),password:password.value,password_confirmation:confirmation.value})}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.message||body.error||"No se pudo crear el acceso");return body;});}).then(function(body){location.href=body.redirect||"/admin/panel";}).catch(function(err){error.textContent=err.message;button.disabled=false;button.textContent="Crear acceso";});});
  </script>` : ""}</body></html>`);
}

function renderAdminLogin(res, targetPath) {
  const target = safeInlineJson(targetPath || "/admin/dashboard");
  const usersEnabled = true;
  res.status(200).setHeader("content-type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ingresar al panel · Nextfor IA</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
:root{--navy-950:#060F22;--navy-900:#0A1836;--navy-800:#0E2148;--navy-700:#122A5C;--cyan-300:#57C2F3;--cyan-500:#00A0F0;--cyan-600:#0587CC;--cyan-700:#0A6BA1;--slate-50:#F6F8FB;--slate-100:#EDF1F7;--slate-200:#DFE6F0;--slate-300:#C6D1E0;--slate-400:#94A3BC;--slate-500:#647289;--slate-700:#313C50;--green:#14A971;--display:"Sora","Avenir Next",sans-serif;--body:"Plus Jakarta Sans","Avenir Next",sans-serif}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(145deg,#EDF2F8,#F8FAFD);color:var(--navy-900);font-family:var(--body);padding:34px}.loginShell{width:min(1080px,100%);min-height:650px;background:#fff;border:1px solid var(--slate-200);border-radius:26px;overflow:hidden;box-shadow:0 40px 90px -30px rgba(6,15,34,.35);display:grid;grid-template-columns:430px minmax(0,1fr)}
.brandPanel{position:relative;overflow:hidden;background:linear-gradient(160deg,var(--navy-800),var(--navy-950));padding:44px 40px;color:#fff;display:flex;flex-direction:column;justify-content:space-between}.brandPanel:before{content:"";position:absolute;top:-150px;right:-120px;width:390px;height:390px;background:radial-gradient(circle,rgba(0,160,240,.4),transparent 68%)}.brand,.brandCopy,.brandLive{position:relative}.brand{display:flex;align-items:center;gap:12px}.brandMark{width:54px;height:40px;object-fit:contain}.brandName{font-family:var(--display);font-size:17px;font-weight:700}.brandSub{font-size:12px;color:rgba(255,255,255,.6);margin-top:2px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.14em;color:var(--cyan-300);margin-bottom:14px}.brandCopy h1{font-family:var(--display);font-size:31px;line-height:1.14;letter-spacing:-.03em;margin:0 0 16px}.brandCopy h1 span{color:var(--cyan-300)}.brandCopy>p{font-size:14px;line-height:1.65;color:rgba(255,255,255,.72);margin:0}.benefits{display:grid;gap:12px;margin-top:26px}.benefit{display:flex;align-items:center;gap:12px;padding:13px 15px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:14px}.benefitIcon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:rgba(0,160,240,.18);color:var(--cyan-300)}.benefitIcon svg{width:17px;height:17px}.benefit:last-child .benefitIcon{background:rgba(20,169,113,.2);color:#4ADE9E}.benefit strong{display:block;font-family:var(--display);font-size:18px}.benefit span{font-size:12px;color:rgba(255,255,255,.6)}.brandLive{display:flex;align-items:center;gap:9px;font-size:12px;color:rgba(255,255,255,.65)}.liveDot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 3px rgba(20,169,113,.25)}
.formPanel{padding:52px;display:grid;place-items:center}.formInner{width:min(100%,500px)}.formEyebrow{font-size:12px;font-weight:800;letter-spacing:.14em;color:var(--cyan-600);text-transform:uppercase;margin-bottom:12px}.formInner h2{font-family:var(--display);font-size:32px;line-height:1.12;letter-spacing:-.035em;margin:0 0 14px}.lead{font-size:15px;line-height:1.6;color:var(--slate-700);margin:0 0 30px}.field{margin-top:22px}.labelRow{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:9px}label{font-size:14px;font-weight:700}.inputWrap{position:relative}.input{width:100%;height:52px;border:1.5px solid var(--slate-300);border-radius:12px;padding:0 16px;font:500 15px var(--body);color:var(--navy-900);background:#fff;outline:none;transition:.18s}.input::placeholder{color:var(--slate-400)}.input:focus{border-color:var(--cyan-500);box-shadow:0 0 0 4px rgba(0,160,240,.14)}.input.password{padding-right:105px}.textBtn{border:0;background:none;padding:0;color:var(--cyan-600);font:700 13px var(--body);cursor:pointer}.textBtn:hover{color:var(--cyan-700)}.showBtn{position:absolute;top:50%;right:8px;transform:translateY(-50%);border:0;border-radius:9px;background:var(--slate-100);color:var(--slate-500);padding:9px 16px;font:700 13px var(--body);cursor:pointer}.primary{width:100%;min-height:56px;border:0;border-radius:14px;background:linear-gradient(135deg,#26ADEE,var(--cyan-500) 55%,var(--cyan-600));color:#fff;font:800 16px var(--display);margin-top:24px;box-shadow:0 10px 24px -10px rgba(0,160,240,.6);cursor:pointer;transition:.18s}.primary:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 14px 30px -8px rgba(0,160,240,.5)}.primary:disabled{opacity:.48;cursor:not-allowed;box-shadow:none}.accountPrompt{text-align:center;font-size:13.5px;color:var(--slate-500);margin-top:22px}.err{min-height:20px;color:#B94723;font-size:12.5px;text-align:center;margin-top:10px}.backBtn{display:inline-flex;align-items:center;gap:7px;margin-bottom:20px}.successIcon{width:52px;height:52px;border-radius:15px;background:#E7F7F0;color:#0B7A50;display:grid;place-items:center;font-size:24px;margin-bottom:16px}.infoBox{background:var(--slate-50);border:1px solid var(--slate-200);border-radius:15px;padding:16px;color:var(--slate-700);font-size:13px;line-height:1.55;margin-top:20px}.mobileTrust{display:none}.view[hidden]{display:none}
@media(max-width:780px){body{padding:0;background:var(--slate-50);display:block}.loginShell{width:100%;min-height:100vh;border:0;border-radius:0;box-shadow:none;display:flex;flex-direction:column}.brandPanel{margin:14px 14px 0;padding:20px;border-radius:22px;min-height:auto;display:block}.brand{margin-bottom:17px}.brandMark{width:47px;height:34px}.brandCopy .eyebrow{font-size:9px;margin-bottom:7px}.brandCopy h1{font-size:21px;margin-bottom:0}.brandCopy h1 span,.brandCopy>p,.brandLive{display:none}.benefits{display:flex;gap:9px;margin-top:15px}.benefit{flex:1;padding:10px 12px;min-width:0}.benefitIcon{display:none}.benefit strong{font-size:14px}.benefit span{font-size:10.5px}.formPanel{padding:26px 24px 20px;display:block;flex:1}.formInner{max-width:none}.formEyebrow{display:none}.formInner h2{font-size:25px;margin-bottom:8px}.lead{font-size:13.5px;margin-bottom:22px}.field{margin-top:18px}label{font-size:13.5px}.input{height:50px;font-size:14px}.primary{min-height:52px;margin-top:20px}.accountPrompt{font-size:13px;margin-top:18px}.mobileTrust{display:block;padding:8px 24px 22px;text-align:center;font-size:11.5px;line-height:1.5;color:var(--slate-400)}}
</style></head><body>
<main class="loginShell">
  <section class="brandPanel" aria-label="Nextfor IA">
    <div class="brand"><img class="brandMark" src="/admin/assets/nexfor-mark-light.png" alt=""><div><div class="brandName">Nextfor IA</div><div class="brandSub">Panel de Control</div></div></div>
    <div class="brandCopy"><div class="eyebrow">MIENTRAS NO ESTÁS, LA IA VENDE</div><h1>Bienvenido de vuelta. <span>Esto es lo que pasó por ti.</span></h1><p>Entra y mira cuánto atendió, calificó y agendó tu asistente desde la última vez.</p><div class="benefits"><div class="benefit"><div class="benefitIcon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path></svg></div><div><strong>Responde</strong><span>cada mensaje al instante</span></div></div><div class="benefit"><div class="benefitIcon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg></div><div><strong>Vende</strong><span>cierra oportunidades por ti</span></div></div></div></div>
    <div class="brandLive"><span class="liveDot"></span>Tu asistente sigue activo ahora mismo</div>
  </section>
  <section class="formPanel"><div class="formInner">
    <form class="view" id="loginView" onsubmit="go(event)">
      <div class="formEyebrow">Panel de Control</div><h2>Ingresa a tu panel</h2><p class="lead">Usa el usuario o correo y la clave de tu negocio para ver tus métricas y conversaciones.</p>
      <div class="field"><div class="labelRow"><label for="username">Usuario o correo</label></div><input class="input" id="username" type="text" autocomplete="username" autocapitalize="off" placeholder="usuario o correo@tunegocio.com" autofocus oninput="updateLoginReady()"></div>
      <div class="field"><div class="labelRow"><label for="password">Clave</label><button class="textBtn" type="button" onclick="showRecover()">¿Olvidaste tu clave?</button></div><div class="inputWrap"><input class="input password" id="password" type="password" autocomplete="current-password" placeholder="Tu clave" oninput="updateLoginReady()"><button class="showBtn" id="showPassword" type="button" onclick="togglePassword()">Mostrar</button></div></div>
      <button class="primary" id="loginButton" type="submit" disabled>Entrar al panel</button><div class="err" id="err" role="alert"></div>
      <div class="accountPrompt">¿Aún no tienes cuenta? <button class="textBtn" type="button" onclick="showCreate()">Crear una cuenta nueva</button></div>
    </form>
    <section class="view" id="recoverView" hidden><button class="textBtn backBtn" type="button" onclick="showLogin()">← Volver a ingresar</button><div id="recoverForm"><h2>Recupera tu clave</h2><p class="lead">Escribe tu correo y te mostraremos cómo recuperar el acceso de tu negocio.</p><div class="field"><div class="labelRow"><label for="recoverEmail">Correo electrónico</label></div><input class="input" id="recoverEmail" type="email" autocomplete="email" placeholder="hola@tunegocio.com" oninput="updateRecoverReady()"></div><button class="primary" id="recoverButton" type="button" onclick="requestRecovery()" disabled>Continuar</button></div><div id="recoverSent" hidden><div class="successIcon">✓</div><h2>Recupera tu acceso</h2><p class="lead">Si <strong id="recoverAddress"></strong> está asociado a una cuenta, solicita a tu contacto de Nextfor IA un enlace privado para restablecer la clave. Tu asistente seguirá activo mientras tanto.</p><button class="primary" type="button" onclick="showLogin()">Volver a ingresar</button></div></section>
    <section class="view" id="createView" hidden><button class="textBtn backBtn" type="button" onclick="showLogin()">← Volver a ingresar</button><h2>Activa tu cuenta</h2><p class="lead">Cada negocio recibe un enlace privado de Nextfor IA para crear su administrador y conectar el panel correcto.</p><div class="infoBox"><strong>¿Ya recibiste una invitación?</strong><br>Abre ese enlace para crear tu acceso. Si todavía no la tienes, solicítala a tu contacto de Nextfor IA durante la activación.</div></section>
  </div></section>
  <div class="mobileTrust">Tu acceso pertenece a tu negocio y queda separado del acceso técnico de Nextfor IA.</div>
</main>
<script>
var target=${target};
var usersEnabled=${JSON.stringify(usersEnabled)};
function baseDestination(){var url=target;if(url==="/admin/dashboard"){url="/admin/dashboard?tab=human";}return url;}
function destination(){return baseDestination();}
function showError(msg){document.getElementById("err").textContent=msg||"";}
function updateLoginReady(){var user=document.getElementById("username").value.trim(),password=document.getElementById("password").value;document.getElementById("loginButton").disabled=!password||(!user&&password.length<6);}
function togglePassword(){var input=document.getElementById("password"),show=input.type==="password";input.type=show?"text":"password";document.getElementById("showPassword").textContent=show?"Ocultar":"Mostrar";input.focus();}
function setView(id){["loginView","recoverView","createView"].forEach(function(view){document.getElementById(view).hidden=view!==id;});showError("");}
function showLogin(){setView("loginView");document.getElementById("recoverForm").hidden=false;document.getElementById("recoverSent").hidden=true;}
function showRecover(){var user=document.getElementById("username").value.trim();if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user))document.getElementById("recoverEmail").value=user;setView("recoverView");updateRecoverReady();}
function showCreate(){setView("createView");}
function updateRecoverReady(){var email=document.getElementById("recoverEmail").value.trim();document.getElementById("recoverButton").disabled=!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);}
function requestRecovery(){var email=document.getElementById("recoverEmail").value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return;document.getElementById("recoverAddress").textContent=email;document.getElementById("recoverForm").hidden=true;document.getElementById("recoverSent").hidden=false;}
function go(e){
  e.preventDefault();showError("");
  var usernameEl=document.getElementById("username"),username=usernameEl?usernameEl.value.trim():"";
  var password=document.getElementById("password").value;
  if(!password)return;
  var button=document.getElementById("loginButton");button.disabled=true;button.textContent="Entrando…";
  if(usersEnabled&&username&&username!=="clave-maestra"){
    fetch("/admin/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:username,password:password})}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||"No autorizado");return j;});}).then(function(){location.href=destination();}).catch(function(){showError("Usuario o clave incorrectos.");button.textContent="Entrar al panel";updateLoginReady();});
    return;
  }
  fetch("/admin/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:password})}).then(function(r){if(!r.ok)throw new Error("No autorizado");location.href=destination();}).catch(function(){showError("Usuario o clave incorrectos.");button.textContent="Entrar al panel";updateLoginReady();});
}
</script></body></html>`);
}

app.get("/admin", (req, res) => {
  res.redirect("/admin/dashboard?tab=human");
});

function escapeAdminHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function signatureAdminAuth(req, res) {
  const auth = dashboardAuth(req);
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return null;
  }
  return auth;
}

function signatureWriteOriginOk(req) {
  return isSameOriginRequestFromAny(req, ADMIN_ALLOWED_BASE_URLS);
}

function signaturePublicUrl(req, token) {
  const base = PUBLIC_BASE_URL || ((req.secure ? "https" : "http") + "://" + req.get("host"));
  return base.replace(/\/+$/, "") + "/signature/" + encodeURIComponent(token);
}

app.get("/signature/:token", (req, res) => {
  renderSignatureForm(res, { token: req.params.token });
});

app.get("/signature/api/:token", async (req, res) => {
  try {
    const diagnosis = await signatureService.get(req.params.token);
    if (!diagnosis) {
      res.status(404).json({ ok: false, error: "signature_not_found" });
      return;
    }
    res.json(Object.assign({ ok: true }, diagnosis));
  } catch (error) {
    log("error", "signature_load_failed", { error: String(error && error.message || "").slice(0, 160) });
    res.status(503).json({ ok: false, error: "signature_store_unavailable" });
  }
});

app.patch("/signature/api/:token", async (req, res) => {
  if (!signatureWriteOriginOk(req)) {
    res.status(403).json({ ok: false, error: "invalid_request_origin" });
    return;
  }
  try {
    const state = await signatureService.update(req.params.token, req.body || {});
    if (!state) {
      res.status(404).json({ ok: false, error: "signature_not_found" });
      return;
    }
    const diagnosis = await signatureService.get(req.params.token);
    res.json({ ok: true, state: diagnosis.state, priorities: diagnosis.priorities });
  } catch (error) {
    log("error", "signature_save_failed", { error: String(error && error.message || "").slice(0, 160) });
    res.status(503).json({ ok: false, error: "signature_store_unavailable" });
  }
});

app.post("/signature/api/:token/submit", async (req, res) => {
  if (!signatureWriteOriginOk(req)) {
    res.status(403).json({ ok: false, error: "invalid_request_origin" });
    return;
  }
  try {
    const state = await signatureService.submit(req.params.token, req.body || {});
    if (!state) {
      res.status(404).json({ ok: false, error: "signature_not_found" });
      return;
    }
    const diagnosis = await signatureService.get(req.params.token);
    res.json({ ok: true, state: diagnosis.state, priorities: diagnosis.priorities });
  } catch (error) {
    if (error && error.code === "signature_incomplete") {
      res.status(400).json({
        ok: false,
        error: error.code,
        missing: error.missing || [],
        consent_required: !!error.consent_required
      });
      return;
    }
    log("error", "signature_submit_failed", { error: String(error && error.message || "").slice(0, 160) });
    res.status(503).json({ ok: false, error: "signature_store_unavailable" });
  }
});

app.post("/signature/api/:token/files", express.raw({ type: "application/octet-stream", limit: "10mb" }), async (req, res) => {
  if (!signatureWriteOriginOk(req)) {
    res.status(403).json({ ok: false, error: "invalid_request_origin" });
    return;
  }
  let filename = "";
  try {
    filename = decodeURIComponent(String(req.get("x-file-name") || ""));
  } catch (_) {
    filename = "";
  }
  filename = filename.replace(/[\u0000-\u001f\u007f/\\]/g, "_").trim().slice(0, 180);
  const contentType = String(req.get("x-file-type") || "application/octet-stream").slice(0, 120);
  if (!filename || !Buffer.isBuffer(req.body) || !req.body.length || req.body.length > 10 * 1024 * 1024) {
    res.status(400).json({ ok: false, error: "invalid_signature_file" });
    return;
  }
  try {
    const diagnosis = await signatureService.get(req.params.token);
    if (!diagnosis) {
      res.status(404).json({ ok: false, error: "signature_not_found" });
      return;
    }
    if ((diagnosis.state.files || []).length >= 5) {
      res.status(400).json({ ok: false, error: "signature_file_limit" });
      return;
    }
    await ensureSignatureStorageBucket();
    const recordId = diagnosis.state.record_id;
    const fileId = crypto.randomBytes(12).toString("base64url");
    const objectKey = recordId + "/" + fileId + ".nxf";
    const encrypted = encryptSignatureFile(req.body);
    await axios.post(signatureStorageUrl(objectKey), encrypted, {
      headers: Object.assign({}, SB_HEADERS, {
        "Content-Type": "application/octet-stream",
        "x-upsert": "false"
      }),
      maxBodyLength: 12 * 1024 * 1024,
      timeout: 30000
    });
    await signatureService.addFile(req.params.token, {
      id: fileId,
      name: filename,
      size: req.body.length,
      type: contentType,
      object_key: objectKey,
      uploaded_at: new Date().toISOString()
    });
    const updated = await signatureService.get(req.params.token);
    res.status(201).json({ ok: true, state: updated.state });
  } catch (error) {
    log("error", "signature_file_upload_failed", { error: String(error && error.message || "").slice(0, 160) });
    res.status(503).json({ ok: false, error: "signature_storage_unavailable" });
  }
});

app.delete("/signature/api/:token/files/:fileId", async (req, res) => {
  if (!signatureWriteOriginOk(req)) {
    res.status(403).json({ ok: false, error: "invalid_request_origin" });
    return;
  }
  try {
    const state = await signatureService.removeFile(req.params.token, req.params.fileId);
    if (!state) {
      res.status(404).json({ ok: false, error: "signature_not_found" });
      return;
    }
    const diagnosis = await signatureService.get(req.params.token);
    res.json({ ok: true, state: diagnosis.state });
  } catch (error) {
    res.status(503).json({ ok: false, error: "signature_store_unavailable" });
  }
});

app.get("/admin/super-admin/signature", (req, res) => {
  const auth = dashboardAuth(req);
  if (!auth.ok) {
    res.redirect("/admin/super-admin/login");
    return;
  }
  if (auth.role !== "super_admin") {
    res.redirect("/admin/super-admin/login?reason=role");
    return;
  }
  renderSignatureAdmin(res);
});

app.get("/admin/signature/prospects", async (req, res) => {
  if (!signatureAdminAuth(req, res)) return;
  try {
    res.json({ ok: true, prospects: await signatureService.list() });
  } catch (error) {
    res.status(503).json({ ok: false, error: "signature_store_unavailable" });
  }
});

app.post("/admin/signature/prospects", async (req, res) => {
  const auth = signatureAdminAuth(req, res);
  if (!auth) return;
  try {
    const state = await signatureService.create(auth.name || auth.username);
    const detail = await signatureService.get(state.token);
    res.status(201).json({
      ok: true,
      prospect: {
        record_id: detail.state.record_id,
        token: state.token,
        status: detail.state.status,
        progress: detail.state.progress,
        updated_at: detail.state.updated_at
      },
      url: signaturePublicUrl(req, state.token)
    });
  } catch (error) {
    const code = error && error.code === "signature_persistence_required"
      ? "signature_persistence_required"
      : "signature_store_unavailable";
    res.status(503).json({ ok: false, error: code });
  }
});

app.get("/admin/signature/prospects/:recordId", async (req, res) => {
  if (!signatureAdminAuth(req, res)) return;
  try {
    const detail = await signatureService.adminDetail(req.params.recordId);
    if (!detail) {
      res.status(404).json({ ok: false, error: "signature_not_found" });
      return;
    }
    res.json(Object.assign({ ok: true }, detail));
  } catch (error) {
    res.status(503).json({ ok: false, error: "signature_store_unavailable" });
  }
});

app.get("/admin/signature/prospects/:recordId/files/:fileId", async (req, res) => {
  if (!signatureAdminAuth(req, res)) return;
  try {
    const file = await signatureService.adminFile(req.params.recordId, req.params.fileId);
    if (!file) {
      res.status(404).json({ ok: false, error: "signature_file_not_found" });
      return;
    }
    const stored = await axios.get(signatureStorageUrl(file.object_key), {
      headers: SB_HEADERS,
      responseType: "arraybuffer",
      timeout: 30000
    });
    const clear = decryptSignatureFile(Buffer.from(stored.data));
    const fallbackName = file.name.replace(/[^\w.\- ]/g, "_") || "documento";
    res.setHeader("content-type", file.type || "application/octet-stream");
    res.setHeader("content-length", String(clear.length));
    res.setHeader("content-disposition", "attachment; filename=\"" + fallbackName.replace(/"/g, "") + "\"; filename*=UTF-8''" + encodeURIComponent(file.name));
    res.send(clear);
  } catch (error) {
    log("error", "signature_file_download_failed", { error: String(error && error.message || "").slice(0, 160) });
    res.status(503).json({ ok: false, error: "signature_storage_unavailable" });
  }
});

app.get("/admin/signature/config", async (req, res) => {
  if (!signatureAdminAuth(req, res)) return;
  try {
    res.json({ ok: true, config: await signatureService.getConfig(true) });
  } catch (error) {
    res.status(503).json({ ok: false, error: "signature_store_unavailable" });
  }
});

app.put("/admin/signature/config", async (req, res) => {
  const auth = signatureAdminAuth(req, res);
  if (!auth) return;
  try {
    const config = await signatureService.saveConfig(req.body || {}, auth.name || auth.username);
    res.json({ ok: true, config });
  } catch (error) {
    res.status(400).json({ ok: false, error: "invalid_signature_config" });
  }
});

app.get("/admin/signature/events", (req, res) => {
  if (!signatureAdminAuth(req, res)) return;
  res.setHeader("content-type", "text/event-stream");
  res.setHeader("cache-control", "no-cache, no-transform");
  res.setHeader("connection", "keep-alive");
  res.flushHeaders();
  res.write("retry: 2500\n\n");
  const send = function (event) {
    res.write("event: signature\ndata: " + JSON.stringify(event) + "\n\n");
  };
  const heartbeat = setInterval(function () { res.write(": keepalive\n\n"); }, 20000);
  signatureEvents.on("signature", send);
  req.on("close", function () {
    clearInterval(heartbeat);
    signatureEvents.off("signature", send);
  });
});

app.get("/admin/super-admin", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!auth.ok) {
    res.redirect("/admin/super-admin/login");
    return;
  }
  if (auth.role !== "super_admin") {
    res.redirect("/admin/super-admin/login?reason=role");
    return;
  }
  if (auth.method === "key") {
    setDashboardSessionCookie(req, res, auth);
  }
  let platformGoals = DEFAULT_PLATFORM_GOALS;
  try {
    platformGoals = await loadPlatformGoals(false);
  } catch (_) {
    platformGoals = DEFAULT_PLATFORM_GOALS;
  }
  let leadsPipeline = null;
  try {
    leadsPipeline = await buildSuperAdminLeadsPipeline();
  } catch (error) {
    console.error("super admin leads pipeline render error:", error.message);
  }

  renderSuperAdminPanel(res, {
    auth,
    botVersion: BOT_VERSION,
    commercialReadiness: COMMERCIAL_READINESS,
    accessModel: DASHBOARD_ACCESS_MODEL,
    customerAccessV2Enabled: CUSTOMER_ACCESS_V2_ENABLED,
    paymentsV1Enabled: PAYMENTS_V1_ENABLED,
    channelConnectionsV1Enabled: CHANNEL_CONNECTIONS_V1_VISIBLE,
    platformGoals,
    tenant: CUSTOMER_PANEL_BUSINESS,
    integration: currentRavIntegration(),
    registeredClients: listRegisteredClients(),
    // Contrato de datos del diseño aprobado del Super Admin.
    // Se mantienen en null a propósito: el panel renderiza estados vacíos
    // honestos en vez de cifras de ejemplo. Al conectar la fuente real basta
    // con reemplazar estos valores; el panel ya sabe pintarlos.
    //
    // finance: {
    //   currency: "COP",
    //   bots: [{ id: "agendamiento"|"atencion", name, clients, mrr, users, usersUnit, costs }],
    //   pareto: [{ name, revenue, botId }],
    //   attention: { webhooks, pendingAppointments, queues, overdue }
    // }
    finance: null,
    // leads: {
    //   kpis: { active, won, demos, conversion },
    //   sources: [{ name, paid: true|false, leads, won }],
    //   rows: [{ tenant_id, company_name, admin_email, contact_phone, stage, completion }]
    // }
    leads: leadsPipeline
  });
});

app.get("/admin/platform-goals", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  try {
    const goals = await loadPlatformGoals(true);
    res.json({
      ok: true,
      goals,
      persistent_store: SUPABASE_ENABLED ? "supabase" : "memory_test_only"
    });
  } catch (_) {
    res.status(503).json({ ok: false, error: "platform_goal_store_unavailable" });
  }
});

app.put("/admin/platform-goals/:goalId", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const goalId = String(req.params.goalId || "").trim().toLowerCase();
  try {
    const goal = await persistPlatformGoal(goalId, req.body, auth);
    res.json({ ok: true, goal });
  } catch (error) {
    const validationErrors = new Set([
      "invalid_goal_id",
      "invalid_goal_type",
      "invalid_goal_label",
      "invalid_goal_unit",
      "invalid_goal_target"
    ]);
    if (validationErrors.has(error && error.code)) {
      res.status(400).json({ ok: false, error: error.code });
      return;
    }
    log("error", "platform_goal_save_failed", { error: String(error && error.message || "").slice(0, 160) });
    res.status(503).json({ ok: false, error: "platform_goal_store_unavailable" });
  }
});

app.get("/admin/super-admin/login", (req, res) => {
  const auth = dashboardAuth(req);
  if (auth.ok && auth.role === "super_admin") {
    res.redirect("/admin/super-admin");
    return;
  }
  renderSuperAdminLogin(res, {
    currentRole: auth.ok ? auth.role : "none",
    currentRoleLabel: auth.ok ? (DASHBOARD_ROLE_LABELS[auth.role] || auth.role) : ""
  });
});

function canAccessRegisteredClient(auth, tenantId) {
  return canAccessTenant(auth, tenantId);
}

app.get("/admin/registered-clients", (req, res) => {
  const auth = dashboardAuth(req);
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(403).json({ ok: false, error: "forbidden" });
    return;
  }
  res.json({ ok: true, clients: listRegisteredClients() });
});

app.get("/admin/pilots/derco", (req, res) => {
  const auth = dashboardAuth(req);
  if (!auth.ok) {
    renderAdminLogin(res, "/admin/pilots/derco");
    return;
  }
  if (!canAccessRegisteredClient(auth, DERCO_TENANT_ID)) {
    res.status(403).send("Acceso restringido al tenant DERCO.");
    return;
  }
  renderAppointmentPanel(res, {
    auth,
    business: getRegisteredClient(DERCO_TENANT_ID),
    dataPath: "/admin/pilots/derco/data",
    integration: {
      webhook_ready: !!ELEVENLABS_WEBHOOK_SECRET && Object.values(ELEVENLABS_AGENT_TENANT_MAP).includes(DERCO_TENANT_ID)
    }
  });
});

app.get("/admin/pilots/derco/data", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!canAccessRegisteredClient(auth, DERCO_TENANT_ID)) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const persistent = await hydrateAppointmentsForTenant(DERCO_TENANT_ID);
  res.json(Object.assign({
    ok: true,
    business: getRegisteredClient(DERCO_TENANT_ID),
    source: persistent ? "supabase" : "memory"
  }, appointmentRegistry.snapshot(DERCO_TENANT_ID)));
});

app.get("/admin/panel", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!auth.ok) {
    const requestedTab = ["summary", "conversations", "human", "appointments", "plan", "channels", "setup", "retargeting", "tests"].includes(req.query.tab) ? req.query.tab : "summary";
    if (CUSTOMER_ACCESS_V2_ENABLED) renderCustomerLogin(res, { targetPath: "/admin/panel?tab=" + requestedTab });
    else renderAdminLogin(res, "/admin/panel?tab=" + requestedTab);
    return;
  }
  const panelTenantId = customerTenantForAuth(auth);
  if (!panelTenantId || !canAccessTenant(auth, panelTenantId)) {
    res.status(403).send("Acceso restringido al tenant de este panel.");
    return;
  }
  if (auth.method === "key") {
    setDashboardSessionCookie(req, res, auth);
  }
  let customerSetupCompleted = false;
  let paymentGateRequired = false;
  if (auth.version === 2) {
    try {
      const onboarding = await loadClientOnboarding(false, panelTenantId);
      if (!onboarding.setup_completed) {
        res.redirect("/admin/client-onboarding");
        return;
      }
      if (PAYMENTS_V1_ENABLED && paymentService) {
        const billing = await paymentService.tenantBilling(panelTenantId);
        paymentGateRequired = !billingMakesCustomer(billing);
      }
      customerSetupCompleted = true;
    } catch (error) {
      console.error("customer setup gate error:", error.message);
      res.status(503).send("No pudimos comprobar la configuración de tu empresa. Intenta nuevamente.");
      return;
    }
  }
  const capabilities = customerPanelCapabilities(auth.role);
  const channelConnectionsVisibleForCustomer = customerChannelConnectionsVisibleForAuth(auth);
  let initialTab = ["summary", "conversations", "human", "appointments", "plan", "channels", "setup", "retargeting", "tests"].includes(req.query.tab) ? req.query.tab : "summary";
  if (paymentGateRequired) initialTab = "plan";
  if (initialTab === "channels" && !channelConnectionsVisibleForCustomer) initialTab = "summary";
  if (initialTab === "tests" && !capabilities.run_tests) {
    initialTab = "plan";
  }
  renderCustomerPanel(res, {
    auth,
    capabilities,
    initialTab,
    tenantContext: auth.version === 2 ? customerBusinessForAuth(auth) : null,
    customerSetupCompleted,
    paymentsV1Enabled: PAYMENTS_V1_ENABLED,
    paymentGateRequired,
    channelConnectionsV1Enabled: channelConnectionsVisibleForCustomer,
    botVersion: BOT_VERSION
  });
});

app.get("/admin/panel-demo", (req, res) => {
  const auth = { username: "demo", name: "Demo RAV Toys", role: "admin", method: "demo" };
  const capabilities = customerPanelCapabilities("admin");
  capabilities.manage_notes_tags = false;
  const initialTab = ["summary", "conversations", "human", "appointments", "plan", "channels", "setup", "retargeting"].includes(req.query.tab) ? req.query.tab : "plan";
  renderCustomerPanel(res, {
    auth,
    capabilities,
    demoMode: true,
    initialTab,
    dataPath: "/admin/panel/demo-data",
    appointmentsPath: "/admin/panel/demo-appointments-data",
    setupPath: "/admin/panel/demo-setup",
    retargetingPath: "/admin/panel/demo-retargeting",
    healthPath: null,
    loginPath: null,
    channelConnectionsV1Enabled: true,
    channelConnectionsDemo: {
      ok: true,
      meta_authorization_available: { whatsapp: true, instagram: true, messenger: true },
      channels: [
        {
          id: "whatsapp",
          channel: "whatsapp",
          name: "WhatsApp",
          description: "Recomendado. Aquí es donde tu Nextfor empezará a atender primero.",
          status: "not_connected",
          connect_available: true
        },
        {
          id: "instagram",
          channel: "instagram",
          name: "Instagram",
          description: "Opcional. Súmalo si también recibes clientes por mensajes de Instagram.",
          status: "not_connected",
          connect_available: true
        },
        {
          id: "messenger",
          channel: "messenger",
          name: "Facebook Messenger",
          description: "Opcional. Súmalo si tus clientes también te escriben por Facebook.",
          status: "not_connected",
          connect_available: true
        }
      ]
    },
    botVersion: BOT_VERSION
  });
});

app.get("/admin/customer-panel", (req, res) => {
  const params = new URLSearchParams();
  if (req.query.tab) params.set("tab", String(req.query.tab));
  res.redirect("/admin/panel" + (params.toString() ? "?" + params.toString() : ""));
});

app.get("/admin/dashboard", (req, res) => {
  if (!adminKeyOk(req)) {
    const loginTab = req.query.tab === "summary" ? "summary" : "human";
    renderAdminLogin(res, "/admin/dashboard?tab=" + loginTab);
    return;
  }
  const auth = dashboardAuth(req);
  if (auth.method === "key") {
    setDashboardSessionCookie(req, res, auth);
  }
  const pageKey = safeInlineJson("");
  const pageUser = safeInlineJson(auth.name || auth.username || "Panel");
  const pageRole = safeInlineJson(auth.role || "admin");
  const initialTab = req.query.tab === "human" ? "human" : "summary";
  const summaryActive = initialTab === "summary" ? " active" : "";
  const humanActive = initialTab === "human" ? " active" : "";
  const summaryHref = "/admin/dashboard?tab=summary";
  const humanHref = "/admin/dashboard?tab=human";
  const superAdminHref = "/admin/super-admin";
  const superAdminButton = auth.role === "super_admin" ? `<a class="btn" href="${superAdminHref}">Super admin</a>` : "";
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.send(`
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Panel RAV Toys</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#F4F5F7;color:#1F2A44;padding:22px;line-height:1.5}
.wrap{max-width:1000px;margin:0 auto}
.headcard{background:#fff;border:0.5px solid #E5E8EC;border-radius:12px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px}
.brand{display:flex;align-items:center;gap:12px}
.logo{width:42px;height:42px;border-radius:10px;background:#E1F5EE;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#0F6E56;cursor:pointer;overflow:hidden;position:relative}
.logo img{width:100%;height:100%;object-fit:cover}
.logo .pencil{position:absolute;right:-3px;bottom:-3px;width:16px;height:16px;border-radius:50%;background:#1F2A44;color:#fff;font-size:9px;display:flex;align-items:center;justify-content:center}
.brand h1{font-size:16px;font-weight:600}
.brand p{font-size:12px;color:#9AA0A6}
.btns{display:flex;gap:8px}
.btn{font-size:12px;color:#2E8B8B;cursor:pointer;border:1px solid #cfe3e3;background:#fff;padding:6px 14px;border-radius:8px;text-decoration:none}
.btn:hover{background:#F0FAF7}
.tabs{display:flex;gap:6px;margin:0 0 14px;border-bottom:1px solid #E5E8EC}
.tabBtn{border:0;background:transparent;color:#6B7280;font-size:13px;padding:10px 14px;border-radius:8px 8px 0 0;cursor:pointer;border-bottom:2px solid transparent;text-decoration:none;display:inline-flex;align-items:center}
.tabBtn:hover{background:#fff;color:#1F2A44}
.tabBtn.active{background:#fff;color:#0F6E56;border-bottom-color:#0F766E;font-weight:600}
.tabPanel{display:none}.tabPanel.active{display:block}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:12px}
.kpi{background:#fff;border-radius:12px;padding:14px 16px;border:0.5px solid #E5E8EC}
.kpi .top{display:flex;align-items:center;gap:8px}
.chip{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px}
.kpi .lbl{font-size:12px;color:#6B7280}
.kpi .val{font-size:27px;font-weight:600;margin-top:8px}
.kpi .sub{font-size:11px;color:#9AA0A6;margin-top:2px}
.mini{background:#fff;border-radius:12px;padding:12px 16px;border:0.5px solid #E5E8EC;display:flex;align-items:center;justify-content:space-between}
.mini .lbl{font-size:12px;color:#6B7280}
.mini .val{font-size:21px;font-weight:600;margin-top:2px}
.accent{width:6px;height:36px;border-radius:3px;background:#D3D1C7}
.charts{display:grid;grid-template-columns:1.4fr 1fr;gap:14px;margin-bottom:14px}
.panel{background:#fff;border-radius:12px;padding:16px 18px;border:0.5px solid #E5E8EC}
.panel h3{font-size:14px;font-weight:600;margin-bottom:10px}
.badge{font-size:11px;color:#9AA0A6;background:#F4F5F7;padding:3px 10px;border-radius:10px}
.roleBadge{font-size:11px;color:#475569;background:#F4F5F7;border:1px solid #E5E8EC;padding:6px 10px;border-radius:8px}
.legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font-size:11px;color:#6B7280}
.legend span{display:flex;align-items:center;gap:4px}
.dot{width:9px;height:9px;border-radius:2px;display:inline-block}
.tip{background:#E1F5EE;border-radius:12px;padding:14px 18px}
.tip h3{font-size:14px;font-weight:600;color:#085041;margin-bottom:4px}
.tip p{font-size:13px;color:#0F6E56;line-height:1.6}
.cv{position:relative;width:100%;height:190px}
.cv.sm{height:150px}
.center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
.opsShell{display:grid;grid-template-columns:minmax(220px,300px) 1fr;border:0.5px solid #E5E8EC;border-radius:10px;overflow:hidden;min-height:560px;background:#fff}
.opsThreads{border-right:1px solid #E5E8EC;background:#FBFCFD;display:flex;flex-direction:column;min-width:0}
.opsSearch{padding:10px;border-bottom:1px solid #E5E8EC}.opsSearch input{width:100%;border:1px solid #CBD5E1;border-radius:8px;padding:8px 10px;font-size:12px}
.opsThreadList{overflow:auto;display:flex;flex-direction:column;gap:5px;padding:8px}.opsThread{border:1px solid transparent;border-radius:8px;padding:9px 10px;cursor:pointer;background:transparent;text-align:left}.opsThread:hover{background:#F4F5F7}.opsThread.active{background:#E1F5EE;border-color:#B8E2D4}
.opsThread.pending{border-color:#F3B65A;background:#FFF8EA}.opsThread.pending.active{background:#FAEEDA;border-color:#D9932E}
.opsThreadTop{display:flex;justify-content:space-between;gap:8px;align-items:center}.opsPhone{font-size:12px;font-weight:650}.opsTime{font-size:10px;color:#9AA0A6;white-space:nowrap}.opsPreview{font-size:11px;color:#6B7280;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.opsPill{font-size:10px;border-radius:999px;padding:2px 7px;background:#E6F1FB;color:#2C6FB3;margin-left:5px}.opsPill.human{background:#FAEEDA;color:#9A6216}.opsPill.bot{background:#E1F5EE;color:#0F6E56}
.opsFlag{font-size:10px;border-radius:999px;padding:2px 7px;margin-left:5px;background:#F4F5F7;color:#6B7280}.opsFlag.need{background:#FAECE7;color:#B94723}
.opsToolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}.opsSegments{display:flex;gap:4px;background:#F4F5F7;border:1px solid #E5E8EC;border-radius:8px;padding:3px}.opsSegments button{border:0;background:transparent;color:#6B7280;border-radius:6px;padding:5px 9px;font-size:11px;cursor:pointer}.opsSegments button.active{background:#fff;color:#1F2A44;box-shadow:0 1px 3px rgba(31,42,68,.08)}.opsMiniMetric{font-size:11px;color:#6B7280}.opsTopBadges{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.opsHealth.ok{background:#E1F5EE;color:#0F6E56}.opsHealth.warn{background:#FAEEDA;color:#9A6216}.opsHealth.err{background:#FAECE7;color:#B94723}
.opsChat{min-width:0;display:flex;flex-direction:column;background:#fff}.opsChatHead{padding:12px 14px;border-bottom:1px solid #E5E8EC;display:flex;align-items:center;justify-content:space-between;gap:10px}.opsChatHead h4{font-size:14px;margin:0}.opsChatHead p{font-size:11px;color:#9AA0A6;margin-top:2px}.opsActions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
.opsMetaPanel{border-bottom:1px solid #E5E8EC;background:#FCFDFD;padding:10px 12px;display:grid;gap:8px}.opsTagRow{display:flex;gap:6px;flex-wrap:wrap}.opsTag{border:1px solid #D5DCE5;background:#fff;color:#475569;border-radius:999px;padding:4px 9px;font-size:11px;cursor:pointer}.opsTag.active{background:#1F2A44;border-color:#1F2A44;color:#fff}.opsTag:disabled{opacity:.45;cursor:not-allowed}.opsNoteGrid{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start}.opsNoteGrid textarea{width:100%;min-height:46px;max-height:90px;resize:vertical;border:1px solid #CBD5E1;border-radius:8px;padding:8px 9px;font-size:12px;font-family:inherit}.opsMetaHint{font-size:10px;color:#9AA0A6}.opsThreadTags{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}.opsThreadTag{font-size:9px;border-radius:999px;padding:1px 6px;background:#EEF2F7;color:#475569}.opsThreadTag.revisar{background:#FAECE7;color:#B94723}.opsThreadTag.venta{background:#E1F5EE;color:#0F6E56}.opsThreadTag.pendiente_pago{background:#FAEEDA;color:#9A6216}
.opsMessages{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#F8FAFC}.opsEmpty{margin:auto;color:#9AA0A6;font-size:13px}.opsBubble{max-width:78%;border-radius:9px;padding:8px 10px;font-size:12px;line-height:1.45;white-space:pre-wrap}.opsIncoming{align-self:flex-start;background:#fff;border:1px solid #E5E8EC}.opsBot{align-self:flex-start;background:#E1F5EE;border:1px solid #B8E2D4}.opsHuman{align-self:flex-end;background:#1F2A44;color:#fff}.opsMeta{font-size:10px;color:#9AA0A6;margin-top:4px}.opsHuman .opsMeta{color:#CBD5E1}.opsTools{font-size:10px;color:#9AA0A6;margin-left:4px}
.opsComposer{border-top:1px solid #E5E8EC;padding:10px 12px;display:grid;grid-template-columns:1fr auto;gap:8px;background:#fff}.opsComposer textarea{width:100%;min-height:54px;max-height:130px;resize:vertical;border:1px solid #CBD5E1;border-radius:8px;padding:9px 10px;font-size:13px;font-family:inherit}.opsStatus{font-size:11px;color:#6B7280;padding:0 12px 10px;background:#fff}
.opsComposerMeta{display:flex;justify-content:flex-end;font-size:10px;color:#9AA0A6;margin:-6px 12px 7px}
@media(max-width:760px){.charts{grid-template-columns:1fr}}
@media(max-width:760px){.opsShell{grid-template-columns:1fr}.opsThreads{height:240px;border-right:0;border-bottom:1px solid #E5E8EC}.opsMessages{min-height:320px}.opsBubble{max-width:92%}.opsComposer{grid-template-columns:1fr}}
</style></head><body><div class="wrap">
<div class="headcard"><div class="brand"><div class="logo" id="logo" onclick="changeLogo()" title="Clic para cambiar el logo">RAV<div class="pencil">&#9998;</div></div><div><h1>RAV Toys · Panel del bot</h1><p id="meta">cargando datos...</p></div></div><div class="btns"><span class="roleBadge" id="roleBadge"></span>${superAdminButton}<div class="btn" id="evalBtn" onclick="runEval()">&#10024; Evaluar ahora</div><div class="btn" onclick="location.reload()">&#8635; Actualizar</div><div class="btn" onclick="logoutDashboard()">Salir</div></div></div>
<div class="tabs" role="tablist"><a class="tabBtn${summaryActive}" id="tab-summary" href="${summaryHref}" onclick="showTab('summary');return false;">Resumen</a><a class="tabBtn${humanActive}" id="tab-human" href="${humanHref}" onclick="showTab('human');return false;">Intervención humana</a></div>
<section class="tabPanel${summaryActive}" id="panel-summary">
<div class="grid">
<div class="kpi"><div class="top"><div class="chip" style="background:#E1F5EE">&#128101;</div><span class="lbl">Clientes atendidos</span></div><div class="val" id="m-users">-</div><div class="sub" id="s-users"></div></div>
<div class="kpi"><div class="top"><div class="chip" style="background:#E6F1FB">&#128722;</div><span class="lbl">Pedidos iniciados</span></div><div class="val" id="m-orders">-</div><div class="sub">productos seleccionados</div></div>
<div class="kpi"><div class="top"><div class="chip" style="background:#FAEEDA">&#128202;</div><span class="lbl">Conversión</span></div><div class="val" id="m-conv">-</div><div class="sub" id="s-conv"></div></div>
<div class="kpi"><div class="top"><div class="chip" style="background:#FAECE7">&#11088;</div><span class="lbl">Rating promedio</span></div><div class="val" id="m-rating">-</div><div class="sub" id="s-rating"></div></div>
</div>
<div class="grid">
<div class="mini"><div><div class="lbl">Tasa de resolución</div><div class="val" id="m-res">-</div></div><div class="accent" id="a-res"></div></div>
<div class="mini"><div><div class="lbl">Pasó a humano</div><div class="val" id="m-hand">-</div></div><div class="accent" id="a-hand"></div></div>
<div class="mini"><div><div class="lbl">Búsqueda exitosa</div><div class="val" id="m-search">-</div></div><div class="accent" id="a-search"></div></div>
<div class="mini"><div><div class="lbl">Costo / chat</div><div class="val" id="m-cost">-</div></div><div class="accent" id="a-cost"></div></div>
</div>
<div class="charts">
<div class="panel"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Actividad por día</h3><span class="badge" id="dayBadge"></span></div><div class="cv"><canvas id="chDay"></canvas></div></div>
<div class="panel"><h3>Resultado de conversaciones</h3><div class="cv sm"><canvas id="chOut"></canvas><div class="center"><div style="font-size:21px;font-weight:600" id="donutTotal">0</div><div style="font-size:11px;color:#9AA0A6">chats</div></div></div><div class="legend" id="legOut"></div></div>
</div>
<div class="panel" style="margin-bottom:14px"><h3 style="margin-bottom:2px">&#128230; Búsquedas sin resultados</h3><div style="font-size:12px;color:#9AA0A6;margin-bottom:10px">Lo que tus clientes pidieron y no encontraron — oportunidades de inventario</div><div class="cv"><canvas id="chGap"></canvas></div></div>
<div class="tip"><h3>&#128161; Aprendizajes</h3><p id="learn">Aún no hay suficientes datos evaluados. Usa el botón Evaluar ahora cuando haya conversaciones.</p></div>
</section>
<section class="tabPanel${humanActive}" id="panel-human">
<div class="panel" id="human-control" style="margin-bottom:14px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:10px"><h3 style="margin:0">Intervención humana</h3><div class="opsTopBadges"><span class="badge opsHealth" id="opsHealth">verificando...</span><span class="badge" id="opsBadge"></span></div></div><div class="opsToolbar"><div class="opsSegments" aria-label="Filtro de conversaciones"><button id="opsModeAll" class="active" onclick="setOpsFilter('all')">Todos</button><button id="opsModePending" onclick="setOpsFilter('pending')">Pendientes</button><button id="opsModeHuman" onclick="setOpsFilter('human')">Humano</button><button id="opsModeBot" onclick="setOpsFilter('bot')">Bot</button></div><span class="opsMiniMetric" id="opsPendingCount">0 pendientes</span></div><div class="opsShell"><aside class="opsThreads"><div class="opsSearch"><input id="opsFilter" placeholder="Buscar cliente, etiqueta o mensaje" oninput="renderOpsThreads()"></div><div class="opsThreadList" id="opsThreadList"></div></aside><section class="opsChat"><div class="opsChatHead"><div><h4 id="opsTitle">Selecciona una conversación</h4><p id="opsSub">El control humano pausa las respuestas automáticas del bot.</p></div><div class="opsActions"><button class="btn" id="opsCopyBtn" onclick="copyOpsPhone()" disabled>Copiar número</button><button class="btn" id="opsTakeBtn" onclick="takeOpsControl()" disabled>Tomar control</button><button class="btn" id="opsReleaseBtn" onclick="releaseOpsControl()" disabled>Devolver al bot</button></div></div><div class="opsMetaPanel" id="opsCustomerPanel"><div class="opsTagRow" id="opsTags"></div><div class="opsNoteGrid"><textarea id="opsNote" maxlength="1200" placeholder="Nota interna del cliente" oninput="markOpsMetaDirty()"></textarea><button class="btn" id="opsSaveMetaBtn" onclick="saveOpsMeta()" disabled>Guardar</button></div><div class="opsMetaHint" id="opsMetaStatus">Selecciona una conversación.</div></div><div class="opsMessages" id="opsMessages"><div class="opsEmpty">Sin conversación seleccionada.</div></div><div class="opsComposer"><textarea id="opsReply" maxlength="1200" placeholder="Escribe como RAV Toys" oninput="updateOpsChar()"></textarea><button class="btn" id="opsSendBtn" onclick="sendOpsReply()" disabled>Enviar</button></div><div class="opsComposerMeta"><span id="opsChar">0/1200</span></div><div class="opsStatus" id="opsStatus">Listo.</div></section></div></div>
</section>
</div>
<script>
var TEAL="#1D9E75",AMBER="#EF9F27",CORAL="#D85A30",BLUE="#378ADD",GOOD="#5DCAA5",WARN="#FAC775",NEUTRAL="#D3D1C7";
var DASHBOARD_KEY=${pageKey}, DASHBOARD_USER=${pageUser}, DASHBOARD_ROLE=${pageRole}, opsTurns=[], opsStats={}, opsGroups={}, opsOrder=[], opsSelected=null, opsHandoffs={}, opsFilterMode="all", opsLastHealth=null, opsCustomerMeta={}, opsAllowedTags=[{id:"venta",label:"Venta"},{id:"garantia",label:"Garantia"},{id:"pendiente_pago",label:"Pendiente pago"},{id:"envio",label:"Envio"},{id:"revisar",label:"Revisar"}], opsDraftTags=[], opsMetaDirty=false, opsMetaDirtyUser=null;
var chartLibPromise=null;
function canOpsWrite(){return DASHBOARD_ROLE==="agent"||DASHBOARD_ROLE==="admin"||DASHBOARD_ROLE==="super_admin";}
function canAdmin(){return DASHBOARD_ROLE==="admin"||DASHBOARD_ROLE==="super_admin";}
function roleLabel(role){return role==="super_admin"?"Super admin":(role==="admin"?"Admin":(role==="agent"?"Agent":"Viewer"));}
function initRoleBadge(){var el=document.getElementById("roleBadge");if(el)el.textContent=(DASHBOARD_USER||"Panel")+" · "+roleLabel(DASHBOARD_ROLE);var ev=document.getElementById("evalBtn");if(ev&&!canAdmin()){ev.style.opacity=".45";ev.title="Solo admin";}}
function logoutDashboard(){try{localStorage.removeItem("rav_dashboard_key");}catch(e){}fetch("/admin/logout",{method:"POST"}).finally(function(){location.href="/admin";});}
function setTabUrl(name){try{var u=new URL(location.href);u.searchParams.set("tab",name);history.replaceState(null,"",u.pathname+u.search);}catch(e){}}
function showTab(name){var summary=name==="summary";document.getElementById("tab-summary").classList.toggle("active",summary);document.getElementById("tab-human").classList.toggle("active",!summary);document.getElementById("panel-summary").classList.toggle("active",summary);document.getElementById("panel-human").classList.toggle("active",!summary);try{localStorage.setItem("rav_dashboard_tab",name);}catch(e){}setTabUrl(name);if(!summary){renderOpsChat();}else{setTimeout(resizeCharts,0);}}
function initTabs(){var tab="summary";try{tab=new URL(location.href).searchParams.get("tab")||localStorage.getItem("rav_dashboard_tab")||tab;}catch(e){}if(location.hash==="#human-control"||location.hash==="#intervencion"){tab="human";}showTab(tab==="human"?"human":"summary");}
function ensureChartLib(){if(window.Chart)return Promise.resolve(true);if(chartLibPromise)return chartLibPromise;chartLibPromise=new Promise(function(resolve){var done=false;function finish(ok){if(done)return;done=true;if(!ok)chartLibPromise=null;resolve(ok);}var s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";s.async=true;s.onload=function(){finish(true);};s.onerror=function(){finish(false);};document.head.appendChild(s);setTimeout(function(){finish(!!window.Chart);},5000);});return chartLibPromise;}
function drawChart(id,config){var c=document.getElementById(id);if(!c||!window.Chart)return;var old=Chart.getChart(c);if(old)old.destroy();new Chart(c,config);}
function resizeCharts(){if(!window.Chart)return;["chDay","chOut","chGap"].forEach(function(id){var c=document.getElementById(id),ch=c&&Chart.getChart(c);if(ch)ch.resize();});}
function renderCharts(dayConfig,outConfig,gapConfig){ensureChartLib().then(function(ok){if(!ok){var b=document.getElementById("dayBadge");if(b)b.textContent=(b.textContent||"sin datos")+" · gráfica pendiente";return;}drawChart("chDay",dayConfig);drawChart("chOut",outConfig);drawChart("chGap",gapConfig);});}
function adminApi(url,opts){opts=opts||{};opts.headers=Object.assign({"content-type":"application/json"},opts.headers||{});return fetch(url,opts).then(function(r){return r.json().then(function(j){if(!r.ok){throw new Error(j.error||("HTTP "+r.status));}return j;});});}
function opsEsc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function opsAttr(s){return opsEsc(s).replace(/"/g,"&quot;");}
function opsWhen(ts){try{return new Date(ts).toLocaleString("es-CO",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});}catch(e){return "";}}
function opsLastText(ms){var info=opsThreadInfoFromMessages(ms);return info.lastText||"";}
function opsTagLabel(id){var t=(opsAllowedTags||[]).find(function(x){return x.id===id;});return t?t.label:id;}
function opsMetaFor(id){return (opsCustomerMeta&&opsCustomerMeta[id])||{tags:[],note:""};}
function opsThreadInfoFromMessages(ms){
var lastText="",lastTs="",lastInbound=0,lastHumanReply=0,lastBot=0,lastTools=[];
(ms||[]).forEach(function(t){var ts=Date.parse(t.ts||"")||0;if(ts){lastTs=t.ts;}var tools=t.tools||[];if(t.userMessage){lastInbound=ts||lastInbound;lastText=t.userMessage;}if(t.botReply){var clean=String(t.botReply||"").replace("[Humano]","").trim();if(tools.indexOf("admin_send_message")>=0){lastHumanReply=ts||lastHumanReply;}else if(tools.indexOf("admin_takeover")<0&&tools.indexOf("admin_release")<0&&tools.indexOf("admin_resolve")<0){lastBot=ts||lastBot;}lastText=clean||lastText;}if(tools.length){lastTools=tools;}});
return {lastText:lastText,lastTs:lastTs,lastInbound:lastInbound,lastHumanReply:lastHumanReply,lastBot:lastBot,lastTools:lastTools};
}
function opsThreadInfo(id){var ms=opsGroups[id]||[],info=opsThreadInfoFromMessages(ms),active=!!opsHandoffs[id];info.active=active;info.needsReply=active&&info.lastInbound>Math.max(info.lastHumanReply,0);return info;}
function opsMatchesMode(id){var info=opsThreadInfo(id);if(opsFilterMode==="pending")return info.needsReply;if(opsFilterMode==="human")return info.active;if(opsFilterMode==="bot")return !info.active;return true;}
function setOpsFilter(mode){opsFilterMode=mode||"all";["All","Pending","Human","Bot"].forEach(function(name){var el=document.getElementById("opsMode"+name);if(el)el.classList.toggle("active",opsFilterMode===name.toLowerCase()||(name==="All"&&opsFilterMode==="all"));});renderOpsThreads();}
function buildOpsFromTurns(){
opsHandoffs={};((opsStats||{}).active_handoff_users||[]).forEach(function(id){opsHandoffs[id]=true;});
opsGroups={};opsOrder=[];
opsTurns.slice().reverse().forEach(function(t){if(t.tools&&t.tools.indexOf("admin_customer_meta")>=0)return;var id=String(t.userId||"?");if(!opsGroups[id]){opsGroups[id]=[];opsOrder.push(id);}opsGroups[id].push(t);if(t.handoff)opsHandoffs[id]=true;if(t.tools&&(t.tools.indexOf("admin_release")>=0||t.tools.indexOf("admin_resolve")>=0))opsHandoffs[id]=false;if(t.tools&&(t.tools.indexOf("admin_takeover")>=0||t.tools.indexOf("admin_send_message")>=0||t.tools.indexOf("human_handoff_active")>=0||t.tools.indexOf("request_human_handoff")>=0))opsHandoffs[id]=true;});
opsOrder.sort(function(a,b){return new Date((opsGroups[b][opsGroups[b].length-1]||{}).ts||0)-new Date((opsGroups[a][opsGroups[a].length-1]||{}).ts||0);});
if(!opsSelected&&opsOrder.length)opsSelected=opsOrder[0];if(opsSelected&&!opsGroups[opsSelected])opsSelected=opsOrder[0]||null;
renderOpsThreads();renderOpsChat();
}
function renderOpsThreads(){
var el=document.getElementById("opsThreadList");if(!el)return;setOpsFilterButtons();var q=(document.getElementById("opsFilter").value||"").toLowerCase().trim();var html="",shown=0,pending=0,active=0;
opsOrder.forEach(function(id){var info=opsThreadInfo(id),txt=info.lastText||"",meta=opsMetaFor(id),tagText=(meta.tags||[]).map(opsTagLabel).join(" "),haystack=(id+" "+txt+" "+tagText+" "+(meta.note||"")).toLowerCase();if(info.needsReply)pending++;if(info.active)active++;if(!opsMatchesMode(id))return;if(q&&haystack.indexOf(q)<0)return;shown++;var cls="opsThread"+(id===opsSelected?" active":"")+(info.needsReply?" pending":"");var mode=info.active?"<span class='opsPill human'>Humano</span>":"<span class='opsPill bot'>Bot</span>";var flag=info.needsReply?"<span class='opsFlag need'>Pendiente</span>":"";var tags=(meta.tags||[]).map(function(tag){return "<span class='opsThreadTag "+opsAttr(tag)+"'>"+opsEsc(opsTagLabel(tag))+"</span>";}).join("");html+="<button class='"+cls+"' data-user='"+opsAttr(id)+"' onclick='selectOpsThread(this.getAttribute(&quot;data-user&quot;))'><div class='opsThreadTop'><span class='opsPhone'>+"+opsEsc(id)+mode+flag+"</span><span class='opsTime'>"+opsWhen(info.lastTs)+"</span></div><div class='opsPreview'>"+opsEsc(txt)+"</div>"+(tags?"<div class='opsThreadTags'>"+tags+"</div>":"")+"</button>";});
el.innerHTML=html||"<div class='opsEmpty'>No hay conversaciones en este filtro.</div>";var badge=document.getElementById("opsBadge");if(badge)badge.textContent=opsOrder.length+" chats · "+active+" humano";var pc=document.getElementById("opsPendingCount");if(pc)pc.textContent=pending+" pendiente"+(pending===1?"":"s")+" · "+shown+" visible"+(shown===1?"":"s");
}
function setOpsFilterButtons(){var map={all:"opsModeAll",pending:"opsModePending",human:"opsModeHuman",bot:"opsModeBot"};Object.keys(map).forEach(function(mode){var el=document.getElementById(map[mode]);if(el)el.classList.toggle("active",opsFilterMode===mode);});}
function selectOpsThread(id){opsSelected=id;opsMetaDirty=false;opsMetaDirtyUser=null;renderOpsThreads();renderOpsChat();}
function renderOpsChat(){
var ms=opsGroups[opsSelected]||[],info=opsSelected?opsThreadInfo(opsSelected):{},title=document.getElementById("opsTitle"),sub=document.getElementById("opsSub");if(title)title.textContent=opsSelected?("+"+opsSelected):"Selecciona una conversación";if(sub)sub.textContent=opsSelected?(info.needsReply?"Pendiente de respuesta humana.":(info.active?"Control humano activo. El bot no responderá.":"Bot activo. Puedes tomar control o responder directamente.")):"El control humano pausa las respuestas automáticas del bot.";
var canWrite=canOpsWrite(),take=document.getElementById("opsTakeBtn"),rel=document.getElementById("opsReleaseBtn"),send=document.getElementById("opsSendBtn"),copy=document.getElementById("opsCopyBtn"),reply=document.getElementById("opsReply");if(take)take.disabled=!canWrite||!opsSelected||!!opsHandoffs[opsSelected];if(rel)rel.disabled=!canWrite||!opsSelected||!opsHandoffs[opsSelected];if(send)send.disabled=!canWrite||!opsSelected;if(reply)reply.disabled=!canWrite||!opsSelected;if(copy)copy.disabled=!opsSelected;updateOpsChar();
renderOpsMetaPanel();
var html="";ms.forEach(function(t){if(t.userMessage){html+="<div class='opsBubble opsIncoming'>"+opsEsc(t.userMessage)+"<div class='opsMeta'>Cliente · "+opsWhen(t.ts)+"</div></div>";}if(t.botReply){var isHuman=t.botReply.indexOf("[Humano]")===0;var body=isHuman?t.botReply.replace("[Humano]","").trim():t.botReply;html+="<div class='opsBubble "+(isHuman?"opsHuman":"opsBot")+"'>"+opsEsc(body)+"<div class='opsMeta'>"+(isHuman?"Humano":"Bot")+" · "+opsWhen(t.ts)+"</div></div>";}if(t.tools&&t.tools.length){html+="<div class='opsTools'>"+opsEsc(t.tools.join(", "))+"</div>";}});
var box=document.getElementById("opsMessages");if(box){box.innerHTML=html||"<div class='opsEmpty'>No hay mensajes para este cliente.</div>";box.scrollTop=box.scrollHeight;}
}
function renderOpsMetaPanel(){
var tagsEl=document.getElementById("opsTags"),noteEl=document.getElementById("opsNote"),saveEl=document.getElementById("opsSaveMetaBtn"),statusEl=document.getElementById("opsMetaStatus");
if(!tagsEl||!noteEl||!saveEl||!statusEl)return;
if(opsSelected&&opsMetaDirty&&opsMetaDirtyUser===opsSelected){saveEl.disabled=!canOpsWrite();return;}
var meta=opsSelected?opsMetaFor(opsSelected):{tags:[],note:""};
opsDraftTags=(meta.tags||[]).slice();
tagsEl.innerHTML=(opsAllowedTags||[]).map(function(tag){var active=opsDraftTags.indexOf(tag.id)>=0;return "<button type='button' class='opsTag"+(active?" active":"")+"' data-tag='"+opsAttr(tag.id)+"' onclick='toggleOpsTag(this.getAttribute(&quot;data-tag&quot;))' "+(!opsSelected||!canOpsWrite()?"disabled":"")+">"+opsEsc(tag.label)+"</button>";}).join("");
noteEl.value=opsSelected?(meta.note||""):"";
noteEl.disabled=!opsSelected||!canOpsWrite();saveEl.disabled=true;statusEl.textContent=opsSelected?(!canOpsWrite()?"Solo lectura":(meta.updated_at?("Guardado "+opsWhen(meta.updated_at)):"Sin nota guardada")):"Selecciona una conversación.";
}
function markOpsMetaDirty(){if(!canOpsWrite())return;opsMetaDirty=!!opsSelected;opsMetaDirtyUser=opsSelected;var saveEl=document.getElementById("opsSaveMetaBtn"),statusEl=document.getElementById("opsMetaStatus");if(saveEl)saveEl.disabled=!opsSelected;if(statusEl&&opsSelected)statusEl.textContent="Cambios sin guardar.";}
function toggleOpsTag(tag){if(!opsSelected||!canOpsWrite())return;var idx=opsDraftTags.indexOf(tag);if(idx>=0)opsDraftTags.splice(idx,1);else opsDraftTags.push(tag);var buttons=document.querySelectorAll(".opsTag");for(var i=0;i<buttons.length;i++){buttons[i].classList.toggle("active",opsDraftTags.indexOf(buttons[i].getAttribute("data-tag"))>=0);}markOpsMetaDirty();}
function saveOpsMeta(){if(!opsSelected||!canOpsWrite())return;var note=(document.getElementById("opsNote").value||"").trim(),saveEl=document.getElementById("opsSaveMetaBtn"),statusEl=document.getElementById("opsMetaStatus");if(saveEl)saveEl.disabled=true;if(statusEl)statusEl.textContent="Guardando...";adminApi("/admin/customer-meta/"+encodeURIComponent(opsSelected),{method:"POST",body:JSON.stringify({tags:opsDraftTags,note:note})}).then(function(r){opsCustomerMeta[opsSelected]=r.meta||{tags:opsDraftTags,note:note};opsMetaDirty=false;opsMetaDirtyUser=null;if(statusEl)statusEl.textContent="Guardado "+opsWhen((r.meta||{}).updated_at);renderOpsThreads();}).catch(function(e){if(statusEl)statusEl.textContent="Error: "+e.message;if(saveEl)saveEl.disabled=false;});}
function copyOpsPhone(){if(!opsSelected)return;var value="+"+opsSelected;if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(value).then(function(){document.getElementById("opsStatus").textContent="Número copiado.";}).catch(function(){document.getElementById("opsStatus").textContent=value;});}else{document.getElementById("opsStatus").textContent=value;}}
function updateOpsChar(){var el=document.getElementById("opsReply"),out=document.getElementById("opsChar");if(out)out.textContent=((el&&el.value)||"").length+"/1200";}
function takeOpsControl(){if(!opsSelected||!canOpsWrite())return;adminApi("/admin/takeover/"+encodeURIComponent(opsSelected),{method:"POST",body:"{}"}).then(function(){opsHandoffs[opsSelected]=true;document.getElementById("opsStatus").textContent="Control humano activo.";go();}).catch(function(e){document.getElementById("opsStatus").textContent="Error: "+e.message;});}
function releaseOpsControl(){if(!opsSelected||!canOpsWrite())return;adminApi("/admin/release/"+encodeURIComponent(opsSelected),{method:"POST",body:"{}"}).then(function(){opsHandoffs[opsSelected]=false;document.getElementById("opsStatus").textContent="Conversación devuelta al bot.";go();}).catch(function(e){document.getElementById("opsStatus").textContent="Error: "+e.message;});}
function sendOpsReply(){if(!opsSelected||!canOpsWrite()){document.getElementById("opsStatus").textContent="Usuario solo lectura.";return;}var text=(document.getElementById("opsReply").value||"").trim();if(!text){document.getElementById("opsStatus").textContent="Escribe un mensaje antes de enviar.";return;}document.getElementById("opsSendBtn").disabled=true;document.getElementById("opsStatus").textContent="Enviando...";adminApi("/admin/send-message",{method:"POST",body:JSON.stringify({userId:opsSelected,text:text})}).then(function(r){document.getElementById("opsReply").value="";updateOpsChar();opsHandoffs[opsSelected]=true;document.getElementById("opsStatus").textContent=r.ok?"Mensaje enviado.":"Meta no confirmó el envío.";go();}).catch(function(e){document.getElementById("opsStatus").textContent="Error: "+e.message;document.getElementById("opsSendBtn").disabled=false;});}
document.addEventListener("keydown",function(e){var el=document.getElementById("opsReply");if(el&&document.activeElement===el&&(e.metaKey||e.ctrlKey)&&e.key==="Enter"){sendOpsReply();}});
function pct(n,d){return d?Math.round(n/d*100)+"%":"-";}
function safeLogoUrl(value){try{var url=new URL(String(value||""));return url.protocol==="https:"?url.href:"";}catch(e){return "";}}
function drawLogo(value){var el=document.getElementById("logo"),url=safeLogoUrl(value);el.replaceChildren();if(url){var img=document.createElement("img");img.src=url;img.alt="logo";img.referrerPolicy="no-referrer";el.appendChild(img);}else{el.appendChild(document.createTextNode("RAV"));}var pencil=document.createElement("div");pencil.className="pencil";pencil.textContent="✎";el.appendChild(pencil);}
function initLogo(){var url="";try{url=localStorage.getItem("rav_logo")||"";}catch(e){}drawLogo(url);}
function changeLogo(){var cur="";try{cur=localStorage.getItem("rav_logo")||"";}catch(e){}var value=prompt("Pega una URL HTTPS de la imagen de tu logo (deja vacío para volver al texto RAV):",cur);if(value===null)return;var url=safeLogoUrl(value.trim());try{if(!value.trim()){localStorage.removeItem("rav_logo");drawLogo("");}else if(url){localStorage.setItem("rav_logo",url);drawLogo(url);}else{alert("Usa una URL HTTPS válida.");}}catch(e){drawLogo("");}}
function runEval(){if(!canAdmin())return;var b=document.getElementById("evalBtn");if(b){b.textContent="Evaluando...";b.style.opacity="0.6";}adminApi("/admin/evaluate?limit=30",{method:"POST",body:"{}"}).then(function(){location.reload();}).catch(function(){if(b){b.textContent="Error, reintenta";b.style.opacity="1";}});}
function refreshOpsHealth(){var el=document.getElementById("opsHealth");if(el&&!opsLastHealth){el.textContent="verificando...";el.className="badge opsHealth";}adminApi("/admin/health").then(function(h){opsLastHealth=h;var ready=h.production_readiness&&h.production_readiness.infrastructure_ready;var blockers=(h.production_readiness&&h.production_readiness.blockers)||[];if(!el)return;el.className="badge opsHealth "+(ready?"ok":(blockers.length?"err":"warn"));el.textContent=ready?"Infra OK":("Revisar: "+(blockers.slice(0,2).join(", ")||"salud"));}).catch(function(){if(el){el.className="badge opsHealth err";el.textContent="Salud no disponible";}});}
function go(attempt){
attempt=attempt||0;
Promise.all([adminApi("/admin/stats"),adminApi("/admin/conversations?limit=100"),adminApi("/admin/customer-meta?limit=500").catch(function(){return {tags:opsAllowedTags,customers:{}};})]).then(function(res){
  if(attempt<1&&res[1]&&res[1].source&&res[1].source!=="supabase"){document.getElementById("meta").textContent="despertando historial...";setTimeout(function(){go(attempt+1);},3000);return;}
  render(res[0],res[1],res[2]);
}).catch(function(e){
  if(attempt<1){document.getElementById("meta").textContent="reintentando datos...";setTimeout(function(){go(attempt+1);},3000);return;}
  document.getElementById("meta").textContent="error cargando datos";
});
}
function render(stats,conv,metaData){
var ct=(stats.counters)||{},an=(stats.anthropic)||{},sm=(conv.summary)||{},turns=(conv.turns)||[];
if(metaData&&metaData.tags)opsAllowedTags=metaData.tags;if(metaData&&metaData.customers)opsCustomerMeta=metaData.customers;
opsStats=stats||{};opsTurns=turns||[];buildOpsFromTurns();
var clientes=ct.unique_users_total||0;var msgs=ct.messages_received_total||0;
var hora=new Date().toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"});
document.getElementById("meta").textContent=(msgs===0?"Aún sin conversaciones — el panel se llenará cuando lleguen clientes":(msgs+" mensajes · "+clientes+" clientes"))+" · "+(stats.bot_version||"")+" · actualizado "+hora;
var orderUsers={};turns.forEach(function(t){if(t.tools&&t.tools.indexOf("select_product_for_purchase")>=0){orderUsers[t.userId]=1;}});
var pedidos=Object.keys(orderUsers).length;
document.getElementById("m-users").textContent=clientes;
document.getElementById("s-users").textContent=(ct.unique_users_today||0)+" hoy";
document.getElementById("m-orders").textContent=pedidos;
document.getElementById("m-conv").textContent=pct(pedidos,clientes);
document.getElementById("s-conv").textContent=pedidos+" de "+clientes+" clientes";
var rating=sm.avg_rating;document.getElementById("m-rating").innerHTML=(rating!=null?rating:"-")+"<span style='font-size:14px;color:#9AA0A6'> / 5</span>";
document.getElementById("s-rating").textContent=(sm.ratings_count||0)+" calificaciones";
var evald=turns.filter(function(t){return t.eval&&!t.eval.error;});
var si=evald.filter(function(t){return t.eval.resuelto==="si";}).length;
var parc=evald.filter(function(t){return t.eval.resuelto==="parcial";}).length;
var resPct=evald.length?Math.round(si/evald.length*100):null;
document.getElementById("m-res").textContent=resPct!=null?resPct+"%":"-";
document.getElementById("a-res").style.background=resPct==null?NEUTRAL:(resPct>=70?GOOD:WARN);
var handT=turns.filter(function(t){return t.handoff;}).length;
var handPct=turns.length?Math.round(handT/turns.length*100):null;
document.getElementById("m-hand").textContent=handPct!=null?handPct+"%":"-";
document.getElementById("a-hand").style.background=handPct==null?NEUTRAL:(handPct<=25?BLUE:WARN);
var searchT=turns.filter(function(t){return t.tools&&t.tools.indexOf("search_products")>=0;}).length;
var zeroT=turns.filter(function(t){return t.zeroResultQueries&&t.zeroResultQueries.length>0;}).length;
var searchPct=searchT?Math.round((searchT-zeroT)/searchT*100):null;
document.getElementById("m-search").textContent=searchPct!=null?searchPct+"%":"-";
document.getElementById("a-search").style.background=searchPct==null?NEUTRAL:(searchPct>=85?GOOD:WARN);
var costTotal=an.estimated_cost_usd||0;var costChat=clientes?costTotal/clientes:0;
document.getElementById("m-cost").textContent="$"+costChat.toFixed(3);
document.getElementById("a-cost").style.background=clientes===0?NEUTRAL:(costChat<=0.10?GOOD:WARN);
var byDay=ct.messages_by_day||{};var days=Object.keys(byDay).sort();
document.getElementById("dayBadge").textContent=days.length?("últimos "+days.length+" días"):"sin datos";
var chDayConfig={type:"bar",data:{labels:days.map(function(d){return d.slice(5);}),datasets:[{data:days.map(function(d){return byDay[d];}),backgroundColor:"rgba(29,158,117,0.25)",borderColor:TEAL,borderWidth:{top:2,left:0,right:0,bottom:0},borderRadius:5,barPercentage:0.65}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0},grid:{color:"rgba(136,135,128,0.12)"}},x:{grid:{display:false}}}}};
var oc;
if(evald.length){oc=[["Resueltas",si,TEAL],["Parciales",parc,AMBER],["A humano",handT,BLUE]];}
else{oc=[["Atendidas",Math.max(turns.length-handT,0),TEAL],["A humano",handT,BLUE]];}
var ocTotal=0;oc.forEach(function(o){ocTotal+=o[1];});
document.getElementById("donutTotal").textContent=turns.length;
var legHtml="";oc.forEach(function(o){var p=ocTotal?Math.round(o[1]/ocTotal*100):0;legHtml+="<span><span class='dot' style='background:"+o[2]+"'></span>"+o[0]+" "+p+"%</span>";});
document.getElementById("legOut").innerHTML=legHtml;
var chOutConfig={type:"doughnut",data:{labels:oc.map(function(o){return o[0];}),datasets:[{data:oc.map(function(o){return o[1];}),backgroundColor:oc.map(function(o){return o[2];}),borderWidth:2,borderColor:"rgba(255,255,255,0.9)",hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:"70%",plugins:{legend:{display:false}}}};
var gaps={};turns.forEach(function(t){(t.zeroResultQueries||[]).forEach(function(q){q=(q||"").toLowerCase().trim();if(q){gaps[q]=(gaps[q]||0)+1;}});});
var gArr=Object.keys(gaps).map(function(k){return [k,gaps[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,6);
var gColors=gArr.map(function(g,idx){return idx===0?"#D85A30":(idx<3?"#F0997B":"#F5C4B3");});
var chGapConfig={type:"bar",data:{labels:gArr.map(function(g){return g[0];}),datasets:[{data:gArr.map(function(g){return g[1];}),backgroundColor:gColors,borderRadius:5,barThickness:20}]},options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0},grid:{color:"rgba(136,135,128,0.12)"}},y:{grid:{display:false}}}}};
renderCharts(chDayConfig,chOutConfig,chGapConfig);
var sugs=evald.map(function(t){return t.eval.sugerencia;}).filter(function(s){return s&&s.length>3;}).slice(0,3);
if(sugs.length){document.getElementById("learn").textContent=sugs.join("  ·  ");}
else if(gArr.length){document.getElementById("learn").textContent="Tus clientes buscaron "+gArr[0][0]+" ("+gArr[0][1]+" veces) sin resultados. Considera agregarlo al catálogo o mapear el término.";
}

try {
  var _cl = document.getElementById("convList");
  if (_cl) {
    var _groups = {}, _order = [];
    turns.forEach(function(t){ var id = t.userId || "?"; if (!_groups[id]) { _groups[id] = []; _order.push(id); } _groups[id].push(t); });
    var _cb = document.getElementById("convBadge"); if (_cb) _cb.textContent = _order.length + " cliente" + (_order.length===1?"":"s");
    var _esc = function(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); };
    var _html = "";
    _order.slice(0,25).forEach(function(id){
      var ms = _groups[id].slice().sort(function(a,b){ return new Date(a.ts) - new Date(b.ts); });
      var masked = "•••" + String(id).slice(-4);
      var anyHand = ms.some(function(t){ return t.handoff; });
      var anyErr = ms.some(function(t){ return t.status && t.status !== "ok"; });
      var lastTs = ms[ms.length-1].ts || "";
      var when = lastTs ? new Date(lastTs).toLocaleString("es-CO",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "";
      var pills = "";
      if (anyHand) pills += "<span style='font-size:10px;background:#E6F1FB;color:#2C6FB3;padding:2px 8px;border-radius:8px;margin-left:6px'>Pasó a humano</span>";
      if (anyErr) pills += "<span style='font-size:10px;background:#FAECE7;color:#C0492B;padding:2px 8px;border-radius:8px;margin-left:6px'>Revisar</span>";
      var bubbles = "";
      ms.forEach(function(t){
        var u = _esc(t.userMessage), b = _esc(t.botReply);
        if (u) bubbles += "<div style='background:#F4F5F7;border-radius:8px;padding:6px 10px;margin:4px 0;font-size:12px'><b>Cliente:</b> " + u + "</div>";
        if (b) bubbles += "<div style='background:#E1F5EE;border-radius:8px;padding:6px 10px;margin:4px 0;font-size:12px'><b>Bot:</b> " + b + "</div>";
        if (t.tools && t.tools.length) bubbles += "<div style='font-size:10px;color:#9AA0A6;margin:0 0 6px 2px'>🔧 " + t.tools.join(", ") + "</div>";
      });
      _html += "<div style='border:0.5px solid #E5E8EC;border-radius:10px;padding:10px 12px'><div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px'><span style='font-size:13px;font-weight:600'>📱 " + masked + pills + "</span><span style='font-size:11px;color:#9AA0A6'>" + when + "</span></div>" + bubbles + "</div>";
    });
    _cl.innerHTML = _html || "<div style='color:#9AA0A6;font-size:13px'>Aún no hay conversaciones.</div>";
  }
} catch(e){}
}
initLogo();initRoleBadge();initTabs();go();refreshOpsHealth();setInterval(go,30000);setInterval(refreshOpsHealth,120000);
</script>
</body></html>`);
});

app.get("/admin/inbox", (req, res) => {
  if (!adminKeyOk(req)) {
    renderAdminLogin(res, "/admin/inbox");
    return;
  }
  const pageKey = safeInlineJson("");
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.send(`
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Inbox RAV Bot</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#F5F6F8;color:#1F2A44}
.app{height:100vh;display:grid;grid-template-columns:340px 1fr}
.side{border-right:1px solid #E2E5EA;background:#fff;display:flex;flex-direction:column;min-width:0}
.top{height:64px;padding:12px 16px;border-bottom:1px solid #E2E5EA;display:flex;align-items:center;justify-content:space-between;gap:10px}
.top h1{font-size:16px;margin:0}.top p{font-size:12px;color:#6B7280;margin:2px 0 0}
.btn{border:1px solid #CBD5E1;background:#fff;color:#1F2A44;border-radius:8px;padding:8px 11px;font-size:12px;cursor:pointer}
.btn:hover{background:#F1F5F9}.btn.primary{background:#0F766E;color:#fff;border-color:#0F766E}.btn.danger{background:#B42318;color:#fff;border-color:#B42318}.btn:disabled{opacity:.45;cursor:not-allowed}
.search{padding:10px 12px;border-bottom:1px solid #E2E5EA}.search input{width:100%;border:1px solid #CBD5E1;border-radius:8px;padding:9px 10px;font-size:13px}
.threads{overflow:auto;padding:8px;display:flex;flex-direction:column;gap:6px}.thread{border:1px solid transparent;border-radius:8px;padding:10px;cursor:pointer}.thread:hover{background:#F8FAFC}.thread.active{background:#E7F5F2;border-color:#A7D8CF}.thread .row{display:flex;justify-content:space-between;gap:8px;align-items:center}.phone{font-size:13px;font-weight:650}.time{font-size:11px;color:#64748B;white-space:nowrap}.preview{font-size:12px;color:#64748B;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pill{font-size:10px;border-radius:999px;padding:2px 7px;background:#E2E8F0;color:#475569;margin-left:6px}.pill.live{background:#DCFCE7;color:#166534}.pill.human{background:#FEF3C7;color:#92400E}
.main{display:flex;flex-direction:column;min-width:0}.chatHead{height:64px;background:#fff;border-bottom:1px solid #E2E5EA;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}.chatHead h2{font-size:15px;margin:0}.chatHead p{font-size:12px;color:#64748B;margin:2px 0 0}
.messages{flex:1;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:10px}.empty{margin:auto;color:#64748B;font-size:14px}.bubble{max-width:78%;border-radius:10px;padding:9px 11px;font-size:13px;line-height:1.45;white-space:pre-wrap}.incoming{align-self:flex-start;background:#fff;border:1px solid #E2E5EA}.bot{align-self:flex-start;background:#E7F5F2;border:1px solid #BFE3DB}.human{align-self:flex-end;background:#1F2A44;color:#fff}.meta{font-size:10px;color:#94A3B8;margin-top:4px}.human .meta{color:#CBD5E1}.tools{font-size:10px;color:#94A3B8;margin-left:4px}
.composer{background:#fff;border-top:1px solid #E2E5EA;padding:12px 18px;display:grid;grid-template-columns:1fr auto;gap:10px}.composer textarea{width:100%;min-height:58px;max-height:140px;resize:vertical;border:1px solid #CBD5E1;border-radius:8px;padding:10px;font-size:14px;font-family:inherit}.status{font-size:12px;color:#64748B;padding:0 18px 10px;background:#fff}
@media(max-width:780px){.app{grid-template-columns:1fr}.side{height:42vh}.main{height:58vh}.chatHead{height:auto;align-items:flex-start}.composer{grid-template-columns:1fr}.bubble{max-width:92%}}
</style></head><body>
<div class="app">
  <aside class="side">
    <div class="top"><div><h1>Inbox RAV Bot</h1><p id="sideMeta">Cargando...</p></div><button class="btn" onclick="loadData()">Actualizar</button></div>
    <div class="search"><input id="filter" placeholder="Buscar teléfono o texto" oninput="renderThreads()"></div>
    <div class="threads" id="threads"></div>
  </aside>
  <main class="main">
    <div class="chatHead">
      <div><h2 id="chatTitle">Selecciona una conversación</h2><p id="chatSub">Toma control antes de responder. Mientras esté en humano, el bot no contesta.</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn primary" id="takeBtn" onclick="takeControl()" disabled>Tomar control</button>
        <button class="btn" id="releaseBtn" onclick="releaseControl()" disabled>Devolver al bot</button>
      </div>
    </div>
    <div class="messages" id="messages"><div class="empty">Sin conversación seleccionada.</div></div>
    <div class="composer">
      <textarea id="reply" placeholder="Escribe como RAV Toys..."></textarea>
      <button class="btn primary" id="sendBtn" onclick="sendReply()" disabled>Enviar</button>
    </div>
    <div class="status" id="status">Listo.</div>
  </main>
</div>
<script>
var KEY = ${pageKey};
var turns = [], stats = {}, groups = {}, order = [], activeHandoffs = {}, selected = null;
function api(url, opts){
  opts = opts || {};
  opts.headers = Object.assign({"content-type":"application/json"}, opts.headers || {});
  return fetch(url, opts).then(function(r){ return r.json().then(function(j){ if(!r.ok){ throw new Error(j.error || ("HTTP " + r.status)); } return j; }); });
}
function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function when(ts){try{return new Date(ts).toLocaleString("es-CO",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});}catch(e){return "";}}
function lastText(ms){var t=ms[ms.length-1]||{};return t.userMessage || t.botReply || "";}
function loadData(){
  document.getElementById("status").textContent = "Actualizando...";
  Promise.all([api("/admin/stats"), api("/admin/conversations?limit=100")]).then(function(res){
    stats = res[0] || {}; turns = (res[1] && res[1].turns) || [];
    activeHandoffs = {}; (stats.active_handoff_users || []).forEach(function(id){ activeHandoffs[id]=true; });
    groups = {}; order = [];
    turns.slice().reverse().forEach(function(t){
      var id = t.userId || "?";
      if(!groups[id]){ groups[id]=[]; order.push(id); }
      groups[id].push(t);
      if(t.handoff) activeHandoffs[id]=true;
      if(t.tools && (t.tools.indexOf("admin_release")>=0 || t.tools.indexOf("admin_resolve")>=0)) activeHandoffs[id]=false;
      if(t.tools && (t.tools.indexOf("admin_takeover")>=0 || t.tools.indexOf("admin_send_message")>=0)) activeHandoffs[id]=true;
    });
    order.sort(function(a,b){ return new Date((groups[b][groups[b].length-1]||{}).ts||0) - new Date((groups[a][groups[a].length-1]||{}).ts||0); });
    document.getElementById("sideMeta").textContent = order.length + " conversaciones";
    if(!selected && order.length) selected = order[0];
    renderThreads(); renderChat();
    document.getElementById("status").textContent = "Actualizado " + new Date().toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"});
  }).catch(function(e){ document.getElementById("status").textContent = "Error: " + e.message; });
}
function renderThreads(){
  var q = document.getElementById("filter").value.toLowerCase().trim();
  var html = "";
  order.forEach(function(id){
    var ms = groups[id] || [], txt = lastText(ms);
    if(q && (id + " " + txt).toLowerCase().indexOf(q)<0) return;
    var cls = "thread" + (id===selected ? " active" : "");
    var mode = activeHandoffs[id] ? "<span class='pill human'>Humano</span>" : "<span class='pill live'>Bot</span>";
    html += "<div class='"+cls+"' onclick='selected=\\\"" + esc(id) + "\\\";renderThreads();renderChat();'><div class='row'><span class='phone'>+" + esc(id) + mode + "</span><span class='time'>" + when((ms[ms.length-1]||{}).ts) + "</span></div><div class='preview'>" + esc(txt) + "</div></div>";
  });
  document.getElementById("threads").innerHTML = html || "<div class='empty'>No hay conversaciones.</div>";
}
function renderChat(){
  var ms = groups[selected] || [];
  document.getElementById("chatTitle").textContent = selected ? ("+" + selected) : "Selecciona una conversación";
  document.getElementById("chatSub").textContent = selected ? (activeHandoffs[selected] ? "Control humano activo. El bot no responderá." : "Bot activo. Toma control antes de intervenir.") : "Toma control antes de responder.";
  document.getElementById("takeBtn").disabled = !selected || !!activeHandoffs[selected];
  document.getElementById("releaseBtn").disabled = !selected || !activeHandoffs[selected];
  document.getElementById("sendBtn").disabled = !selected;
  var html = "";
  ms.forEach(function(t){
    if(t.userMessage){ html += "<div class='bubble incoming'>" + esc(t.userMessage) + "<div class='meta'>Cliente · " + when(t.ts) + "</div></div>"; }
    if(t.botReply){
      var isHuman = t.botReply.indexOf("[Humano]") === 0;
      var body = isHuman ? t.botReply.replace("[Humano]","").trim() : t.botReply;
      html += "<div class='bubble " + (isHuman ? "human" : "bot") + "'>" + esc(body) + "<div class='meta'>" + (isHuman ? "Humano" : "Bot") + " · " + when(t.ts) + "</div></div>";
    }
    if(t.tools && t.tools.length){ html += "<div class='tools'>" + esc(t.tools.join(", ")) + "</div>"; }
  });
  document.getElementById("messages").innerHTML = html || "<div class='empty'>No hay mensajes para este cliente.</div>";
  var box = document.getElementById("messages"); box.scrollTop = box.scrollHeight;
}
function takeControl(){
  if(!selected) return;
  api("/admin/takeover/" + encodeURIComponent(selected), {method:"POST", body:"{}"}).then(function(){ activeHandoffs[selected]=true; loadData(); }).catch(function(e){ document.getElementById("status").textContent="Error: "+e.message; });
}
function releaseControl(){
  if(!selected) return;
  api("/admin/release/" + encodeURIComponent(selected), {method:"POST", body:"{}"}).then(function(){ activeHandoffs[selected]=false; loadData(); }).catch(function(e){ document.getElementById("status").textContent="Error: "+e.message; });
}
function sendReply(){
  if(!selected) return;
  var text = document.getElementById("reply").value.trim();
  if(!text){ document.getElementById("status").textContent = "Escribe un mensaje antes de enviar."; return; }
  document.getElementById("sendBtn").disabled = true;
  document.getElementById("status").textContent = "Enviando...";
  api("/admin/send-message", {method:"POST", body:JSON.stringify({userId:selected,text:text})}).then(function(r){
    document.getElementById("reply").value = "";
    activeHandoffs[selected] = true;
    document.getElementById("status").textContent = r.ok ? "Mensaje enviado." : "Meta no confirmó el envío.";
    loadData();
  }).catch(function(e){ document.getElementById("status").textContent = "Error: " + e.message; document.getElementById("sendBtn").disabled = false; });
}
document.getElementById("reply").addEventListener("keydown", function(e){ if((e.metaKey||e.ctrlKey) && e.key === "Enter"){ sendReply(); } });
loadData(); setInterval(loadData, 15000);
</script>
</body></html>`);
});

async function buildAdminHealthResult() {
  const result = {
    bot: { version: BOT_VERSION, uptime_seconds: Math.round(process.uptime()) },
    env: {
      anthropic_key_present: !!ANTHROPIC_API_KEY,
      shopify_token_present: !!SHOPIFY_ADMIN_TOKEN,
      wa_token_present: !!WA_TOKEN,
      instagram_token_present: !!IG_ACCESS_TOKEN,
      instagram_user_id: IG_USER_ID || null,
      instagram_send_id: IG_SEND_ID || null,
      instagram_graph_base_url: IG_GRAPH_BASE_URL,
      messenger_token_present: !!MESSENGER_PAGE_ACCESS_TOKEN,
      messenger_page_id: MESSENGER_PAGE_ID || null,
      messenger_app_secret_present: !!MESSENGER_APP_SECRET,
      messenger_graph_base_url: MESSENGER_GRAPH_BASE_URL,
      phone_number_id: PHONE_NUMBER_ID,
      shopify_domain: SHOPIFY_STORE_DOMAIN,
      shopify_admin_api_version: SHOPIFY_ADMIN_API_VERSION,
      notification_phones_count: NOTIFICATION_PHONES.length,
      dashboard_users_count: DASHBOARD_USERS.length
    },
    multimodal_agent: {
      enabled: MULTIMODAL_CONFIG.enabled,
      tenant_ids: MULTIMODAL_CONFIG.tenant_ids,
      voice_input_enabled: MULTIMODAL_CONFIG.voice_input_enabled,
      image_input_enabled: MULTIMODAL_CONFIG.image_input_enabled,
      voice_replies_enabled: MULTIMODAL_CONFIG.voice_replies_enabled,
      transcription_provider: MULTIMODAL_CONFIG.transcription_provider,
      vision_provider: MULTIMODAL_CONFIG.vision_provider,
      voice_provider: MULTIMODAL_CONFIG.voice_provider,
      openai_key_present: !!OPENAI_API_KEY,
      elevenlabs_key_present: !!ELEVENLABS_API_KEY
    },
    state: {
      active_handoffs: humanHandoff.size,
      pending_ratings: pendingRatings.size,
      active_checkouts: checkouts.size,
      conversations_in_memory: conversations.size,
      last_search_results_cached: lastSearchResults.size
    },
    commerce: commerceRegistry.describe(DEFAULT_TENANT_ID),
    checks: {}
  };
  // Probar Shopify storefront search (gratis, no consume saldo)
  try {
    const r = await axios.get(`https://ravtoys.com/search?q=test&view=json&resources[limit]=1&type=product`, { timeout: 5000 });
    result.checks.shopify_storefront = r.status === 200 ? "ok" : `status_${r.status}`;
  } catch (e) {
    result.checks.shopify_storefront = `error: ${e.message}`;
  }
  // Probar Meta WhatsApp API (verifica que el token siga válido)
  try {
    const r = await axios.get(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}`, {
      headers: { Authorization: `Bearer ${WA_TOKEN}` },
      timeout: 5000
    });
    result.checks.meta_whatsapp = r.status === 200 ? "ok" : `status_${r.status}`;
  } catch (e) {
    result.checks.meta_whatsapp = `error: ${e.response?.data?.error?.message || e.message}`;
  }
  if (IG_ACCESS_TOKEN && IG_USER_ID) {
    try {
      const r = await axios.get(`${IG_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${IG_USER_ID}`, {
        params: { fields: "id,username" },
        headers: { Authorization: `Bearer ${IG_ACCESS_TOKEN}` },
        timeout: 5000
      });
      result.checks.meta_instagram = r.status === 200 ? "ok" : `status_${r.status}`;
    } catch (e) {
      result.checks.meta_instagram = `error: ${e.response?.data?.error?.message || e.message}`;
    }
  } else {
    result.checks.meta_instagram = "not_configured";
  }
  if (MESSENGER_PAGE_ACCESS_TOKEN && MESSENGER_PAGE_ID) {
    try {
      const r = await axios.get(`${MESSENGER_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${MESSENGER_PAGE_ID}`, {
        params: { fields: "id,name" },
        headers: { Authorization: `Bearer ${MESSENGER_PAGE_ACCESS_TOKEN}` },
        timeout: 5000
      });
      result.checks.meta_messenger = r.status === 200 ? "ok" : `status_${r.status}`;
    } catch (e) {
      result.checks.meta_messenger = `error: ${e.response?.data?.error?.message || e.message}`;
    }
  } else {
    result.checks.meta_messenger = "not_configured";
  }
  result.checks.shopify_admin_api = SHOPIFY_ADMIN_TOKEN ? "key_present_not_tested" : "missing_key";
  result.checks.anthropic_api = ANTHROPIC_API_KEY ? "key_present_not_tested_to_save_credits" : "missing_key";
  if (SUPABASE_ENABLED) {
    try {
      const r = await axios.get(SUPABASE_URL + "/rest/v1/" + SUPABASE_TABLE + "?select=id&limit=1", { headers: SB_HEADERS, timeout: 8000 });
      result.checks.supabase_conversation_logs = r.status === 200 ? "ok" : `status_${r.status}`;
    } catch (e) {
      result.checks.supabase_conversation_logs = `error: ${e.response?.status || ""} ${e.response?.data?.message || e.message}`.trim();
    }
  } else {
    result.checks.supabase_conversation_logs = "missing_env";
  }
  const blockers = [];
  if (!result.env.anthropic_key_present) blockers.push("missing_anthropic_key");
  if (!result.env.wa_token_present) blockers.push("missing_wa_token");
  if (!PHONE_NUMBER_ID) blockers.push("missing_phone_number_id");
  if (result.checks.meta_whatsapp !== "ok") blockers.push("meta_whatsapp_not_ok");
  if (result.checks.shopify_storefront !== "ok") blockers.push("shopify_storefront_not_ok");
  if (result.checks.supabase_conversation_logs !== "ok") blockers.push("supabase_not_ok");
  result.production_readiness = {
    infrastructure_ready: blockers.length === 0,
    blockers,
    app_review_status: currentRavIntegration(result.checks.meta_whatsapp).app_review.status
  };
  result.integration = currentRavIntegration(result.checks.meta_whatsapp);
  return result;
}

app.get("/admin/health", async (req, res) => {
  if (!adminAuthOk(req, "viewer")) {
    res.json({
      ok: true,
      bot: { version: BOT_VERSION, uptime_seconds: Math.round(process.uptime()) },
      status: "running"
    });
    return;
  }
  res.json(await buildAdminHealthResult());
});

app.get("/admin/panel/health", async (req, res) => {
  if (!adminAuthOk(req, "viewer")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const health = await buildAdminHealthResult();
  const ready = !!(health.production_readiness && health.production_readiness.infrastructure_ready);
  res.json({
    ok: true,
    bot_version: BOT_VERSION,
    checked_at: new Date().toISOString(),
    operational_health: {
      status: ready ? "ok" : "needs_review",
      label: ready ? "Infra OK" : "Needs review"
    },
    whatsapp_setup: health.integration ? {
      status: health.integration.connection.real_number_active ? "ready" : "pending",
      label: health.integration.label,
      app_review_approved: health.integration.app_review.approved,
      real_number_active: health.integration.connection.real_number_active,
      target_display_phone: health.integration.target_display_phone,
      integration_status: health.integration.status,
      graph_api_ready: health.integration.connection.graph_api_ready
    } : customerPanelWhatsappSetup(),
    services: [
      { id: "catalog", label: "Catalogo", status: health.checks.shopify_storefront === "ok" ? "ready" : "needs_review" },
      { id: "messaging", label: "Mensajeria", status: health.checks.meta_whatsapp === "ok" ? "ready" : "needs_review" },
      { id: "history", label: "Historial", status: health.checks.supabase_conversation_logs === "ok" ? "ready" : "needs_review" }
    ]
  });
});

app.get("/admin/integrations/rav/test", async (req, res) => {
  const auth = dashboardAuth(req);
  if (!auth.ok || auth.role !== "super_admin") {
    res.status(403).json({ ok: false, error: "forbidden" });
    return;
  }

  const health = await buildAdminHealthResult();
  const integration = health.integration || currentRavIntegration(health.checks.meta_whatsapp);
  const checks = {
    meta_app_review_approved: integration.app_review.approved,
    meta_graph_api: health.checks.meta_whatsapp === "ok",
    shopify_catalog: health.checks.shopify_storefront === "ok",
    conversation_history: health.checks.supabase_conversation_logs === "ok",
    customer_panel: integration.capabilities.customer_panel,
    human_intervention: integration.capabilities.human_intervention
  };
  const technicalPassed = Object.keys(checks).every(function (key) { return checks[key] === true; });

  res.json({
    ok: technicalPassed,
    tested_at: new Date().toISOString(),
    integration,
    checks,
    technical_passed: technicalPassed,
    live_ready: technicalPassed && integration.connection.real_number_active,
    message: technicalPassed
      ? (integration.connection.real_number_active
          ? "Integracion lista para una prueba real de WhatsApp."
          : "Integracion tecnica aprobada. Falta activar el numero real de WhatsApp.")
      : "La integracion necesita revision tecnica antes de activar el numero real."
  });
});

app.post("/admin/alert", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const kind = String(req.body && req.body.kind || "monitor_alert").slice(0, 80);
  const detail = String(req.body && req.body.detail || "Sin detalle").slice(0, 1500);
  const dedupeKey = "admin_alert:" + String(req.body && req.body.dedupe_key || kind).slice(0, 160);
  const cooldownMinutes = Math.max(0, Math.min(1440, Number(req.body && req.body.cooldown_minutes) || 30));
  const force = req.body && (req.body.force === true || req.body.force === "true");
  const now = Date.now();
  const lastSent = errorAlerts.get(dedupeKey) || 0;
  if (!force && cooldownMinutes > 0 && now - lastSent < cooldownMinutes * 60 * 1000) {
    res.json({ ok: true, kind, skipped: true, reason: "cooldown_active", cooldown_minutes: cooldownMinutes });
    return;
  }

  const message = [
    "⚠️ *ALERTA OPERATIVA RAV Bot*",
    "",
    `Tipo: ${kind}`,
    "",
    detail,
    "",
    `Fecha: ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}`
  ].join("\n");
  const notified = await notifyTeam(message, null);
  errorAlerts.set(dedupeKey, now);
  res.json({ ok: true, kind, notified_count: notified.sent, notification_targets: notified.total });
});

app.post("/admin/smoke-check", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const query = String(req.body && req.body.q || req.query.q || "juguete").slice(0, 80);
  const smokeUserId = "__smoke_test__" + Date.now();
  try {
    const search = await searchShopify(query);
    if (!search.products || search.products.length === 0) {
      res.status(503).json({
        ok: false,
        query,
        error: "search_returned_zero_products",
        total: search.total || 0,
        products_returned: 0
      });
      return;
    }

    lastSearchResults.set(smokeUserId, search.products);
    const chosen = search.products.find(p => p.price_amount > 0) || search.products[0];
    const selection = await executeSelectProductForPurchase(smokeUserId, { product_url: chosen.product_url });
    const checkoutFixture = {
      nombre: "Smoke Test RAV",
      cedula: "0000000000",
      direccion: "Carrera 00 #00-00, Medellin",
      telefono: "3000000000",
      metodo_pago: "transferencia"
    };
    const savedFields = [];
    for (const field of CHECKOUT_FIELDS) {
      const saved = await executeSaveCheckoutField(smokeUserId, { field, value: checkoutFixture[field] });
      savedFields.push({ field, complete: !!saved.complete, missing_fields: saved.missing_fields || [] });
    }
    const state = checkouts.get(smokeUserId) || { products: [] };
    const total = (state.products || []).reduce((sum, p) => sum + (p.price_amount || 0), 0);
    const productUrls = new Set(search.products.map(p => p.product_url));
    const checkoutComplete = CHECKOUT_FIELDS.every(field => state.data && state.data[field]);

    res.json({
      ok: total > 0 && !!productUrls.has(chosen.product_url) && checkoutComplete,
      bot_version: BOT_VERSION,
      query,
      search: {
        total: search.total || 0,
        products_returned: search.products.length
      },
      selected: {
        title: chosen.title,
        price: chosen.price,
        price_amount: chosen.price_amount || 0,
        product_url: chosen.product_url,
        product_from_search: productUrls.has(chosen.product_url)
      },
      cart: {
        products_count: state.products.length,
        total_amount: total,
        selection
      },
      checkout: {
        fields_saved: savedFields.map(item => item.field),
        complete: checkoutComplete,
        final_missing_fields: savedFields.length ? savedFields[savedFields.length - 1].missing_fields : CHECKOUT_FIELDS
      },
      checks: {
        search_has_results: search.products.length > 0,
        selected_product_from_real_search: productUrls.has(chosen.product_url),
        cart_total_nonzero: total > 0,
        checkout_fields_complete: checkoutComplete
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, query, error: e.message });
  } finally {
    lastSearchResults.delete(smokeUserId);
    checkouts.delete(smokeUserId);
  }
});

app.post("/admin/order-status-test", async (req, res) => {
  if (!adminAuthOk(req, "agent")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const result = await lookupOrderStatus({
    order_number: req.body && req.body.order_number,
    customer_name: req.body && req.body.customer_name,
    phone_or_email: req.body && req.body.phone_or_email
  }, { includeDiagnostic: true });

  res.status(result.error ? 502 : 200).json({
    ok: !!(result.found && result.matched),
    bot_version: BOT_VERSION,
    shopify_api_version: SHOPIFY_ADMIN_API_VERSION,
    result
  });
});

app.get("/admin/panel/test-search", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const query = String(req.query.q || "").trim().slice(0, 80);
  if (!query) {
    res.status(400).json({ ok: false, error: "missing_query" });
    return;
  }
  try {
    const result = await searchShopify(query, { suppressSideEffects: true });
    res.json({
      ok: true,
      query,
      total: result.total || 0,
      products: (result.products || []).slice(0, 12).map(function (product) {
        return {
          title: product.title,
          price: product.price,
          product_url: product.product_url,
          product_type: product.product_type
        };
      })
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: "catalog_search_unavailable" });
  }
});

app.post("/admin/panel/order-status-test", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const result = await lookupOrderStatus({
    order_number: req.body && req.body.order_number,
    customer_name: req.body && req.body.customer_name,
    phone_or_email: req.body && req.body.phone_or_email
  });
  if (result.error) {
    res.status(502).json({
      ok: false,
      status: "unavailable",
      message: "No pudimos consultar pedidos en este momento. Intenta de nuevo en unos minutos."
    });
    return;
  }
  const status = result.found && result.matched ? "matched" : (result.found ? "validation_failed" : "not_found");
  const message = status === "matched"
    ? "Pedido encontrado y datos validados."
    : (status === "validation_failed"
      ? "Encontramos el pedido, pero los datos del cliente no coinciden."
      : "No encontramos un pedido con ese numero.");
  res.json({
    ok: status === "matched",
    status,
    message,
    order: status === "matched" ? {
      name: result.order_name,
      created_at: result.created_at,
      financial_status: result.financial_status,
      fulfillment_status: result.fulfillment_status_label,
      delivery_city: result.delivery_city,
      delivery_region: result.delivery_region,
      tracking: (result.tracking || []).map(function (item) {
        return { company: item.company, number: item.number, url: item.url };
      })
    } : null
  });
});

app.post("/admin/panel/conversation-test", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  if (!OPENAI_API_KEY) {
    res.status(503).json({ ok: false, error: "test_provider_not_configured", message: "El simulador todavía no está disponible." });
    return;
  }
  const message = String(req.body && req.body.message || "").trim();
  if (!message || message.length > 1200) {
    res.status(400).json({ ok: false, error: "invalid_test_message", message: "Escribe un mensaje de hasta 1.200 caracteres." });
    return;
  }
  try {
    const history = sanitizePanelTestHistory(req.body && req.body.history);
    const botReply = await generatePanelTestReply(buildPanelTestConversationInput(history, message));
    res.json({ ok: true, kind: "text", bot_reply: botReply, public_activation: false, bot_version: BOT_VERSION });
  } catch (error) {
    log("warn", "conversation_panel_test_failed", { error: String(error && error.message || "unknown").slice(0, 160) });
    res.status(502).json({ ok: false, error: "conversation_test_failed", message: "No pudimos responder esta vez. Intenta nuevamente." });
  }
});

app.post("/admin/panel/multimodal-test", express.raw({
  type: function () { return true; },
  limit: "16mb"
}), async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  if (!OPENAI_API_KEY) {
    res.status(503).json({
      ok: false,
      error: "multimodal_provider_not_configured",
      message: "La credencial de voz e imágenes todavía no está activa en staging."
    });
    return;
  }
  const kind = String(req.query.kind || "").trim().toLowerCase();
  if (!["audio", "image"].includes(kind)) {
    res.status(400).json({ ok: false, error: "invalid_media_kind", message: "Elige una nota de voz o una imagen." });
    return;
  }
  const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const maxBytes = kind === "audio" ? MULTIMODAL_CONFIG.max_audio_bytes : MULTIMODAL_CONFIG.max_image_bytes;
  if (!buffer.length || buffer.length > maxBytes) {
    res.status(400).json({ ok: false, error: "invalid_media_size", message: "El archivo está vacío o supera el tamaño permitido." });
    return;
  }
  const mimeType = String(req.get("content-type") || (kind === "audio" ? "audio/ogg" : "image/jpeg")).split(";")[0].trim().toLowerCase();
  if (mimeType !== "application/octet-stream" && !mimeType.startsWith(kind + "/")) {
    res.status(415).json({ ok: false, error: "invalid_media_type", message: "El archivo no coincide con el tipo de prueba seleccionado." });
    return;
  }
  try {
    const media = { kind, mime_type: mimeType };
    const downloaded = { buffer, mime_type: mimeType, file_size: buffer.length };
    const providerResult = kind === "audio"
      ? await transcribeMultimodalAudio(downloaded, media)
      : await analyzeMultimodalImage(downloaded, media);
    const sourceText = String(providerResult && providerResult.text || "").trim();
    const currentInput = kind === "audio"
      ? buildVoiceConversationInput(sourceText, providerResult)
      : buildImageConversationInput(sourceText, "");
    const conversationInput = buildPanelTestConversationInput(panelTestHistoryFromHeader(req), currentInput);
    const botReply = await generatePanelTestReply(conversationInput);
    res.json({
      ok: true,
      kind,
      source_text: sourceText,
      bot_reply: botReply,
      provider: providerResult.provider,
      model: providerResult.model,
      public_activation: false,
      bot_version: BOT_VERSION
    });
  } catch (error) {
    log("warn", "multimodal_panel_test_failed", { kind, error: String(error && error.message || "unknown").slice(0, 160) });
    res.status(502).json({ ok: false, error: "multimodal_test_failed", message: "No pudimos completar esta prueba. Intenta con otro archivo o revisa la configuración de staging." });
  }
});

app.get("/admin/panel/smoke-check", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const query = String(req.query.q || "juguete").trim().slice(0, 80) || "juguete";
  try {
    const result = await searchShopify(query, { suppressSideEffects: true });
    const products = result.products || [];
    const pricedProduct = products.find(function (product) { return Number(product.price_amount) > 0; });
    const ok = products.length > 0 && !!pricedProduct;
    res.status(ok ? 200 : 503).json({
      ok,
      bot_version: BOT_VERSION,
      query,
      label: ok ? "Catalogo operativo" : "El catalogo necesita revision",
      checks: {
        catalog_search: products.length > 0 ? "ok" : "needs_review",
        product_price: pricedProduct ? "ok" : "needs_review"
      }
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: "smoke_check_unavailable", label: "Prueba no disponible" });
  }
});

// Stats con contadores persistentes (v33)
// ─── AUTO-EVALUACIÓN (Tarea 2) ────────────────────────────────────────
// Evalúa cada interacción con Claude y devuelve KPIs: resuelto, tono,
// intención de compra, aciertos, errores y sugerencia. Corre BAJO DEMANDA
// desde /admin/evaluate (no en cada mensaje) para no encarecer cada chat.
async function evaluateTurn(turn) {
  const sys = "Eres un evaluador de calidad de un bot de ventas de juguetería por WhatsApp (RAV Toys, Medellín). Evalúa UNA interacción: el mensaje del cliente y la respuesta del bot. Sé objetivo y breve. Responde SOLO con JSON válido, sin texto adicional, sin markdown, sin explicaciones.";
  const userMsg = [
    'Mensaje del cliente: "' + (turn.userMessage || "") + '"',
    'Respuesta del bot: "' + (turn.botReply || "") + '"',
    "Herramientas usadas: " + ((turn.tools && turn.tools.length) ? turn.tools.join(", ") : "ninguna"),
    "Búsquedas sin resultados: " + ((turn.zeroResultQueries && turn.zeroResultQueries.length) ? turn.zeroResultQueries.join(", ") : "ninguna"),
    "Pasó a humano: " + (turn.handoff ? "sí" : "no"),
    "Rating del cliente: " + (turn.rating != null ? turn.rating : "ninguno"),
    "",
    "Evalúa y responde SOLO este JSON (sin nada más):",
    '{"resuelto":"si|no|parcial","tono":1,"intencion_compra":false,"aciertos":"máx 12 palabras","errores":"máx 12 palabras","sugerencia":"máx 15 palabras"}'
  ].join("\n");

  const resp = await axios.post("https://api.anthropic.com/v1/messages", {
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 300,
    system: sys,
    messages: [{ role: "user", content: userMsg }]
  }, {
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    timeout: 20000
  });
  trackAnthropicUsage(resp.data && resp.data.usage);
  let txt = "";
  const blocks = (resp.data && resp.data.content) || [];
  for (const b of blocks) { if (b.type === "text") txt += b.text; }
  txt = txt.replace(/\`\`\`json|\`\`\`/g, "").trim();
  const parsed = JSON.parse(txt);
  return {
    resuelto: String(parsed.resuelto || "").toLowerCase(),
    tono: Number(parsed.tono) || null,
    intencion_compra: !!parsed.intencion_compra,
    aciertos: String(parsed.aciertos || "").slice(0, 160),
    errores: String(parsed.errores || "").slice(0, 160),
    sugerencia: String(parsed.sugerencia || "").slice(0, 200),
    evaluatedAt: new Date().toISOString()
  };
}

// Endpoint: evalúa bajo demanda los turnos que aún no tienen evaluación.
// ?limit=N (default 10, máx 30) para controlar costo/tiempo por corrida.
app.post("/admin/evaluate", async (req, res) => {
  if (!adminAuthOk(req, "admin")) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const limit = Math.min(parseInt(req.query.limit) || 10, 30);
  let evaluated = 0, failed = 0;
  if (SUPABASE_ENABLED) {
    const rows = await supabaseFetchPending(limit);
    if (rows) {
      for (const r of rows) {
        const normalized = normalizeTurnRow(r);
        const turn = { userMessage: normalized.userMessage, botReply: normalized.botReply, tools: normalized.tools, zeroResultQueries: normalized.zeroResultQueries, handoff: normalized.handoff, rating: normalized.rating };
        try { const ev = await evaluateTurn(turn); await supabaseUpdateEval(r.id, ev); evaluated++; }
        catch (e) { await supabaseUpdateEval(r.id, { error: true, message: (e.message || "eval failed").slice(0, 120) }); failed++; log("error", "eval_failed", { error: e.message }); }
      }
    }
  } else {
    const pending = conversationLogs.filter(t => !t.eval);
    const batch = pending.slice(0, limit);
    for (const turn of batch) {
      try { turn.eval = await evaluateTurn(turn); evaluated++; }
      catch (e) { turn.eval = { error: true, message: (e.message || "eval failed").slice(0, 120) }; failed++; log("error", "eval_failed", { error: e.message }); }
    }
  }
  let done = [];
  if (SUPABASE_ENABLED) { const all = await supabaseFetchRecent(100); done = (all || []).filter(r => r.eval && !r.eval.error && !r.eval.skip).map(r => r.eval); }
  else { done = conversationLogs.filter(t => t.eval && !t.eval.error && !t.eval.skip).map(t => t.eval); }
  const resByCat = { si: 0, parcial: 0, no: 0 };
  let tonoSum = 0, tonoN = 0, intentN = 0;
  for (const ev of done) {
    if (ev.resuelto && resByCat[ev.resuelto] != null) resByCat[ev.resuelto]++;
    if (ev.tono) { tonoSum += ev.tono; tonoN++; }
    if (ev.intencion_compra) intentN++;
  }
  const total = done.length;
  res.json({
    bot_version: BOT_VERSION,
    run: { evaluated_now: evaluated, failed_now: failed },
    kpis: {
      total_evaluadas: total,
      tasa_resolucion: total ? Math.round((resByCat.si / total) * 100) + "%" : "—",
      resueltas_si: resByCat.si, resueltas_parcial: resByCat.parcial, resueltas_no: resByCat.no,
      tono_promedio: tonoN ? Math.round((tonoSum / tonoN) * 10) / 10 : null,
      tasa_intencion_compra: total ? Math.round((intentN / total) * 100) + "%" : "—"
    },
    note: "Evaluación bajo demanda. Resultados guardados en Supabase, visibles en /admin/conversations."
  });
});

app.get("/admin/conversations", async (req, res) => {
  if (!adminKeyOk(req)) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  let turns = null; let source = "memory";
  if (SUPABASE_ENABLED) {
    const rows = await supabaseFetchRecent(limit);
    if (rows) {
      source = "supabase";
      turns = rows.map(normalizeTurnRow);
    }
  }
  if (!turns) turns = conversationLogs.slice(-limit).reverse();
  turns = turns.filter(t => !isInternalAdminTurn(t));
  const withRating = turns.filter(t => t.rating != null);
  const avgRating = withRating.length
    ? Math.round(withRating.reduce((s, t) => s + (Number(t.rating) || 0), 0) / withRating.length * 10) / 10
    : null;
  res.json({
    bot_version: BOT_VERSION,
    total_logged: turns.length,
    source: source,
    summary: {
      turns_logged: turns.length,
      turns_with_zero_results: turns.filter(t => t.zeroResultQueries && t.zeroResultQueries.length > 0).length,
      turns_with_handoff: turns.filter(t => t.handoff).length,
      turns_with_error: turns.filter(t => t.status !== "ok").length,
      ratings_count: withRating.length,
      avg_rating: avgRating,
      turns_evaluated: turns.filter(t => t.eval && !t.eval.error).length,
      turns_pending_eval: turns.filter(t => !t.eval).length
    },
    note: SUPABASE_ENABLED ? "Persistente en Supabase — sobrevive a redeploys." : "Log en memoria (se reinicia al redeploy).",
    turns: turns
  });
});

app.get("/admin/stats", async (req, res) => {
  if (!adminKeyOk(req)) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const handoffInfo = await inferRecentHandoffs(100);
  const handoffsList = handoffInfo.activeUsers;
  const pendingList = Array.from(pendingRatings.values());
  const checkoutsList = Array.from(checkouts.entries()).map(([userId, cart]) => ({
    user: userId,
    products: cart.products?.length || 0,
    has_warranty: !!(cart.warranty && Object.keys(cart.warranty).length > 0)
  }));
  const cachingActive = botStats.anthropic.cacheReadTokens > 0 || botStats.anthropic.cacheCreationTokens > 0;
  const cacheHitRatio = botStats.anthropic.inputTokens > 0
    ? (botStats.anthropic.cacheReadTokens / (botStats.anthropic.inputTokens + botStats.anthropic.cacheReadTokens) * 100).toFixed(1) + '%'
    : '0%';
  res.json({
    bot_version: BOT_VERSION,
    timestamp: new Date().toISOString(),
    counters: {
      uptime_started_at: botStats.startedAt,
      messages_received_total: botStats.messages.total,
      messages_received_today: botStats.messages.today,
      messages_by_day: botStats.messages.byDay,
      unique_users_total: botStats.uniqueUsers.size,
      unique_users_today: botStats.uniqueUsersToday.set.size
    },
    anthropic: {
      total_calls: botStats.anthropic.totalCalls,
      failed_calls: botStats.anthropic.failedCalls,
      credit_errors: botStats.anthropic.creditErrors,
      input_tokens: botStats.anthropic.inputTokens,
      output_tokens: botStats.anthropic.outputTokens,
      cache_creation_tokens: botStats.anthropic.cacheCreationTokens,
      cache_read_tokens: botStats.anthropic.cacheReadTokens,
      caching_active: cachingActive,
      cache_hit_ratio: cacheHitRatio,
      adaptive_budget_calls: Object.assign({}, botStats.anthropic.budgetTiers),
      estimated_cost_usd: estimateCostUSD()
    },
    current_state: {
      active_handoffs: handoffsList.length,
      pending_ratings: pendingRatings.size,
      active_carts: checkouts.size,
      conversations_in_memory: conversations.size
    },
    active_handoff_users: handoffsList,
    handoff_states: handoffInfo.states,
    pending_rating_users: pendingList,
    active_checkouts: checkoutsList,
    note: "Counters reset when bot restarts (free tier sleeps after 15min)."
  });
});

// Test search: yo (Claude) lo uso ANTES de avisarte que cambios de búsqueda
// están listos. Te permite verificar tú mismo abriendo una URL.
app.get("/admin/test-search", async (req, res) => {
  if (!adminKeyOk(req)) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  const q = req.query.q || "";
  if (!q) {
    res.status(400).json({ error: "Missing query param: ?q=..." });
    return;
  }
  try {
    const result = await searchShopify(q, { suppressSideEffects: true });
    res.json({
      query: q,
      total: result.total,
      products_returned: result.products.length,
      products: result.products.map(p => ({
        title: p.title,
        price: p.price,
        product_url: p.product_url,
        product_type: p.product_type
      }))
    });
  } catch (e) {
    res.status(500).json({ query: q, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`RAV-Bot ${BOT_VERSION} (template-ready ops) running on port ${PORT}`);
  console.log(`WA: ${WA_TOKEN ? "OK" : "MISSING"}`);
  console.log(`Anthropic: ${ANTHROPIC_API_KEY ? "OK" : "MISSING"}`);
  console.log(`Shopify: ${SHOPIFY_ADMIN_TOKEN ? "OK " + SHOPIFY_STORE_DOMAIN : "MISSING"}`);
  console.log(`Notifications configured: ${NOTIFICATION_PHONES.length}`);
  syncNextforPricingJuly2026();

  if (RENDER_SELF_HEALTH_URL && IG_ACCESS_TOKEN && IG_USER_ID && IG_SEND_ID) {
    const checkUrl = `${RENDER_SELF_HEALTH_URL}/instagram/health`;
    const runSelfCheck = async function () {
      try {
        await axios.get(checkUrl, {
          timeout: 20000,
          headers: { "User-Agent": "rav-bot-instagram-heartbeat/1.0" }
        });
        console.log("Instagram heartbeat: OK");
      } catch (err) {
        console.error("Instagram heartbeat failed:", err.response?.data || err.message);
      }
    };

    const initialInstagramHealthCheck = setTimeout(runSelfCheck, 30000);
    initialInstagramHealthCheck.unref();
    const instagramHealthTimer = setInterval(runSelfCheck, INSTAGRAM_HEALTH_INTERVAL_MS);
    instagramHealthTimer.unref();
    console.log(`Instagram heartbeat scheduled every ${Math.round(INSTAGRAM_HEALTH_INTERVAL_MS / 60000)} minutes`);
  }
});
