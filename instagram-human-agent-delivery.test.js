"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

(async function run() {
  const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
  const helperStart = source.indexOf("function instagramStandardWindowClosed");
  const helperEnd = source.indexOf("\nasync function sendText", helperStart);
  assert(helperStart >= 0 && helperEnd > helperStart, "Instagram delivery helpers must exist");

  const calls = [];
  let firstError = null;
  let secondError = null;
  const helperContext = {
    META_GRAPH_VERSION: "v25.0",
    Object,
    Number,
    axios: {
      post: async function (url, body, options) {
        calls.push({ url, body, options });
        if (calls.length === 1 && firstError) throw firstError;
        if (calls.length === 2 && secondError) throw secondError;
        return { data: { message_id: "mid-ok" } };
      }
    }
  };
  vm.runInNewContext(source.slice(helperStart, helperEnd), helperContext);

  const closedError = {
    response: { data: { error: { code: 10, error_subcode: 2534022 } } }
  };
  firstError = closedError;
  let delivered = await helperContext.deliverInstagramTextChunk({
    graphOrigin: "https://graph.instagram.com",
    sendId: "ig-business",
    recipientId: "ig-customer",
    accessToken: "test-token",
    text: "Respuesta humana",
    humanAgent: true
  });
  assert.strictEqual(delivered.human_agent, true);
  assert.strictEqual(calls.length, 2);
  assert.strictEqual(calls[0].body.tag, undefined, "the standard window must be tried first");
  assert.strictEqual(calls[1].body.tag, "HUMAN_AGENT", "only a manual reply may use Meta's human-agent window");

  calls.length = 0;
  firstError = closedError;
  secondError = null;
  await assert.rejects(function () {
    return helperContext.deliverInstagramTextChunk({
      graphOrigin: "https://graph.instagram.com",
      sendId: "ig-business",
      recipientId: "ig-customer",
      accessToken: "test-token",
      text: "Respuesta automática",
      humanAgent: false
    });
  });
  assert.strictEqual(calls.length, 1, "bot messages must never use HUMAN_AGENT");

  calls.length = 0;
  firstError = closedError;
  secondError = { response: { data: { error: { code: 10, message: "Human Agent unavailable" } } } };
  let finalError;
  try {
    await helperContext.deliverInstagramTextChunk({
      graphOrigin: "https://graph.instagram.com",
      sendId: "ig-business",
      recipientId: "ig-customer",
      accessToken: "test-token",
      text: "Respuesta humana tardía",
      humanAgent: true
    });
  } catch (error) {
    finalError = error;
  }
  assert(finalError);
  assert.strictEqual(finalError.nextforDeliveryFailure.error, "instagram_reply_window_closed");
  assert.strictEqual(finalError.nextforDeliveryFailure.status, 409);
  assert.match(finalError.nextforDeliveryFailure.message, /nuevo mensaje por Instagram/);

  const deliveryStart = source.indexOf("async function executeAdminMessageDelivery");
  const deliveryEnd = source.indexOf("\nfunction executeAdminMessageDeliveryOnce", deliveryStart);
  assert(deliveryStart >= 0 && deliveryEnd > deliveryStart, "Customer Panel delivery handler must exist");
  let sendOptions;
  const deliveryContext = {
    Object,
    sendText: async function (_userId, _text, options) {
      sendOptions = options;
      Object.assign(options.delivery_result, finalError.nextforDeliveryFailure);
      return false;
    },
    recordAdminEvent: async function () {},
    hasHumanHandoff: function () { return false; }
  };
  vm.runInNewContext(source.slice(deliveryStart, deliveryEnd), deliveryContext);
  const result = await deliveryContext.executeAdminMessageDelivery(
    "ig:customer",
    "Respuesta humana",
    { tenant_id: "tenant-a" },
    "Agente",
    "request-1234"
  );
  assert.strictEqual(sendOptions.human_agent, true);
  assert.strictEqual(result.status, 409);
  assert.strictEqual(result.body.error, "instagram_reply_window_closed");
  assert.strictEqual(result.body.meta_sent, false);

  console.log("instagram-human-agent-delivery.test.js: ok");
})().catch(function (error) {
  console.error(error.stack || error.message);
  process.exit(1);
});
