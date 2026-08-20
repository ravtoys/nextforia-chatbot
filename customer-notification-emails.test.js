"use strict";

const assert = require("assert");
const {
  CUSTOMER_NOTIFICATION_EMAIL_FROM,
  CUSTOMER_NOTIFICATION_EMAIL_TEMPLATES,
  buildCustomerNotificationEmail,
  createResendCustomerNotificationEmailSender
} = require("./customer-notification-emails");

const fixtures = {
  payment_pending: {
    base_url: "https://staging.nextforia.com",
    action_url: "/admin/panel?tab=orders&order=order-a",
    payment_reported: true,
    order: { id: "order-a", order_number: "NX-1001", name: "Ana <script>", items: [{ name: "Producto A", qty: 2, price: 25000 }], total: 50000, currency: "COP", payment: "Nequi" }
  },
  shipping_pending: {
    base_url: "https://staging.nextforia.com",
    orders: [{ id: "order-b", order_number: "NX-1002", name: "Beatriz", item_count: 1, city: "Bogotá", wait_days: 2 }]
  },
  sales_opportunity: {
    base_url: "https://staging.nextforia.com",
    opportunity: { customer_name: "Carlos", purchase_count: 3, score: 87, signal: "Consultó el producto dos veces.", suggestion: "Revisar la conversación.", potential_value: 189000 }
  },
  product_update: {
    base_url: "https://staging.nextforia.com",
    title: "Nueva mejora",
    subtitle: "Ya está disponible.",
    benefits: [{ title: "Menos trabajo", description: "La IA lo organiza por ti." }]
  },
  human_attention: {
    base_url: "https://staging.nextforia.com",
    conversation_id: "wa:573010000001",
    customer_label: "Daniel",
    channel: "whatsapp",
    message: "El cliente está esperando que continúes."
  }
};

CUSTOMER_NOTIFICATION_EMAIL_TEMPLATES.forEach(function (template) {
  const email = buildCustomerNotificationEmail(template, fixtures[template]);
  assert.strictEqual(email.from, "Nextfor IA <info@nextforia.com>");
  assert(email.subject.length > 5);
  assert(email.html.includes("NEXFOR"));
  assert(email.html.includes("https://staging.nextforia.com/admin/panel"));
  assert(email.text.includes("https://staging.nextforia.com/admin/panel"));
  assert(!email.html.includes("javascript:"));
});

assert.strictEqual(CUSTOMER_NOTIFICATION_EMAIL_FROM, "Nextfor IA <info@nextforia.com>");
assert(!buildCustomerNotificationEmail("payment_pending", fixtures.payment_pending).html.includes("<script>"));
assert(buildCustomerNotificationEmail("payment_pending", Object.assign({}, fixtures.payment_pending, { action_url: "https://attacker.example/steal" })).html.includes("https://staging.nextforia.com/admin/panel"));
assert.throws(function () { buildCustomerNotificationEmail("unknown", {}); }, /template_invalid/);

(async function () {
  let request;
  const sender = createResendCustomerNotificationEmailSender({
    apiKey: "resend-test-key",
    replyTo: "info@nextforia.com",
    axiosClient: {
      post: async function (url, body, config) {
        request = { url, body, config };
        return { data: { id: "resend-notification-1" } };
      }
    }
  });
  const result = await sender.send(Object.assign({ template: "human_attention", to: "admin@empresa.example" }, fixtures.human_attention));
  assert.strictEqual(result.id, "resend-notification-1");
  assert.strictEqual(request.url, "https://api.resend.com/emails");
  assert.strictEqual(request.body.from, "Nextfor IA <info@nextforia.com>");
  assert.deepStrictEqual(request.body.to, ["admin@empresa.example"]);
  assert.strictEqual(request.body.reply_to, "info@nextforia.com");
  assert.strictEqual(request.config.headers.Authorization, "Bearer resend-test-key");
  console.log("customer-notification-emails.test.js: ok");
})().catch(function (error) {
  console.error(error.stack || error.message);
  process.exit(1);
});
