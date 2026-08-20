"use strict";

const assert = require("assert");
const {
  NEXTFORIA_SETUP_EMAIL_FROM,
  SETUP_EMAIL_TEMPLATES,
  buildSetupJourneyEmail,
  createResendSetupJourneySender,
  normalizeScheduledEmail,
  setupEmailDedupeKey
} = require("./setup-email-journey");

SETUP_EMAIL_TEMPLATES.forEach(function (template) {
  const email = buildSetupJourneyEmail(template, {
    name: "María Peña",
    plan_name: "Nextfor Aura",
    monthly_price: 299900,
    setup_url: "https://nextforia.com/admin/client-onboarding",
    payment_url: "https://nextforia.com/admin/panel?tab=plan",
    panel_url: "https://nextforia.com/admin/panel"
  });
  assert.strictEqual(email.from, "Nextfor IA <info@nextforia.com>");
  assert(email.html.includes("https://nextforia.com"));
  assert(email.text.includes("https://nextforia.com"));
  assert(!email.html.includes("nextfor.ai"));
  assert(!email.text.includes("nextfor.ai"));
});

assert.strictEqual(NEXTFORIA_SETUP_EMAIL_FROM, "Nextfor IA <info@nextforia.com>");
assert.match(buildSetupJourneyEmail("welcome", { name: "María Peña" }).subject, /María Peña/);
assert.match(buildSetupJourneyEmail("payment_abandoned", { plan: "Nextfor Aura", precio: 299900 }).html, /299\.900/);
assert.throws(function () { buildSetupJourneyEmail("unknown", {}); }, /setup_email_template_invalid/);

const queued = normalizeScheduledEmail({
  tenant_id: "cliente-1",
  to: "ADMIN@EMPRESA.COM",
  template: "welcome",
  dedupe_key: setupEmailDedupeKey("welcome", "cliente-1", "account")
});
assert.strictEqual(queued.recipient, "admin@empresa.com");
assert.strictEqual(queued.status, "scheduled");

(async function () {
  let payload;
  const sender = createResendSetupJourneySender({
    apiKey: "resend-test-key",
    replyTo: "info@nextforia.com",
    axiosClient: {
      post: async function (url, body) {
        assert.strictEqual(url, "https://api.resend.com/emails");
        payload = body;
        return { data: { id: "email-1" } };
      }
    }
  });
  const result = await sender.send({ template: "welcome", to: "cliente@empresa.com", name: "Ana" });
  assert.strictEqual(result.id, "email-1");
  assert.strictEqual(payload.from, "Nextfor IA <info@nextforia.com>");
  assert(payload.html.includes("https://nextforia.com"));
  assert(payload.text.includes("https://nextforia.com"));
  console.log("setup-email-journey.test.js: ok");
})().catch(function (error) {
  console.error(error.stack || error.message);
  process.exit(1);
});
