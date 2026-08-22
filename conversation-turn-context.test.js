"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const turnContext = require("./conversation-turn-context");

function deferred() {
  let resolve;
  const promise = new Promise(function (done) { resolve = done; });
  return { promise, resolve };
}

(async function run() {
  assert.strictEqual(turnContext.isActive(), false);
  assert.throws(function () { turnContext.snapshot(); }, /not active/);

  const aReady = deferred();
  const bReady = deferred();
  const bothReady = Promise.all([aReady.promise, bReady.promise]);

  const tenantA = turnContext.run(async function () {
    assert.strictEqual(turnContext.isActive(), true);
    turnContext.push("tools", "search_products");
    turnContext.push("zeroResultQueries", "patines");
    turnContext.set("handoff", true);
    turnContext.set("rating", 5);
    turnContext.set("zeroSearchActive", true);
    aReady.resolve();
    await bothReady;
    await new Promise(function (resolve) { setImmediate(resolve); });
    turnContext.push("tools", "request_human_handoff");
    return turnContext.snapshot();
  });

  const tenantB = turnContext.run({ rating: 2 }, async function () {
    assert.deepStrictEqual(turnContext.get("tools"), []);
    turnContext.push("tools", "lookup_order_status");
    turnContext.push("zeroResultQueries", "pedido-42");
    turnContext.set("zeroSearchActive", false);
    bReady.resolve();
    await bothReady;
    await new Promise(function (resolve) { setImmediate(resolve); });
    return turnContext.snapshot();
  });

  const results = await Promise.all([tenantA, tenantB]);
  assert.deepStrictEqual(results[0], {
    tools: ["search_products", "request_human_handoff"],
    zeroResultQueries: ["patines"],
    handoff: true,
    rating: 5,
    zeroSearchActive: true
  });
  assert.deepStrictEqual(results[1], {
    tools: ["lookup_order_status"],
    zeroResultQueries: ["pedido-42"],
    handoff: false,
    rating: 2,
    zeroSearchActive: false
  });

  await turnContext.run({ tools: ["outer"] }, async function () {
    await turnContext.run({ tools: ["inner"] }, async function () {
      turnContext.push("tools", "inner-only");
      assert.deepStrictEqual(turnContext.get("tools"), ["inner", "inner-only"]);
    });
    assert.deepStrictEqual(turnContext.get("tools"), ["outer"], "nested context must restore its parent");
  });

  assert.throws(function () { turnContext.push("handoff", true); }, /not appendable/);
  assert.throws(function () { turnContext.get("unknown"); }, /Unknown conversation turn field/);
  assert.strictEqual(turnContext.isActive(), false);

  const applicationSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
  assert(applicationSource.includes('const conversationTurnContext = require("./conversation-turn-context")'));
  assert(applicationSource.includes("return conversationTurnContext.run(function ()"), "every conversation must enter an isolated async context");
  assert(applicationSource.includes("conversationTurnContext.snapshot()"), "conversation persistence must use the isolated snapshot");
  assert(applicationSource.includes('conversationTurnContext.run({\n    tools: ["human_handoff_active"]'), "paused human turns must have their own context");
  assert(applicationSource.includes("function buildAppointmentRequirementsContext(onboarding)"), "appointment runtime must build a live tenant requirements context");
  assert(applicationSource.includes("REQUISITOS ACTIVOS PARA RESERVAR"), "appointment runtime must name the active booking requirements in the prompt");
  assert(applicationSource.includes("...(appointmentRequirementsContext ? [{ type: \"text\", text: appointmentRequirementsContext }] : [])"), "appointment requirements must be injected into dynamic system context");
  assert(applicationSource.includes("next_bot_instruction: nextMissing.question"), "missing configured appointment fields must guide the next bot reply");
  assert(!/\blet\s+turn(?:Tools|ZeroQueries|Handoff|Rating|ZeroSearchActive)\b/.test(applicationSource), "process-global turn state must not return");
  console.log("conversation-turn-context.test.js ok");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
