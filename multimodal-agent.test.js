"use strict";

const assert = require("assert");
const {
  buildImageConversationInput,
  buildVoiceConversationInput,
  createMultimodalAgent,
  mediaFromWhatsAppMessage,
  multimodalConfigFromEnv,
  tenantAllowed
} = require("./multimodal-agent");

const config = multimodalConfigFromEnv({
  MULTIMODAL_AGENT_ENABLED: "1",
  MULTIMODAL_AGENT_TENANT_IDS: "rav-toys, demo",
  MULTIMODAL_VOICE_INPUT_ENABLED: "1",
  MULTIMODAL_IMAGE_INPUT_ENABLED: "1",
  MULTIMODAL_VOICE_REPLIES_ENABLED: "0"
});
assert.strictEqual(config.enabled, true);
assert.strictEqual(config.voice_input_enabled, true);
assert.strictEqual(config.image_input_enabled, true);
assert.strictEqual(config.voice_replies_enabled, false);
assert.strictEqual(tenantAllowed(config, "rav-toys"), true);
assert.strictEqual(tenantAllowed(config, "other"), false);

assert.deepStrictEqual(mediaFromWhatsAppMessage({
  type: "audio",
  audio: { id: "media-audio-1", mime_type: "audio/ogg", sha256: "abc" }
}), {
  kind: "audio",
  media_id: "media-audio-1",
  mime_type: "audio/ogg",
  caption: "",
  sha256: "abc"
});
assert.deepStrictEqual(mediaFromWhatsAppMessage({
  type: "image",
  image: { id: "media-image-1", mime_type: "image/jpeg", caption: "Este producto llego asi" }
}).kind, "image");
assert.strictEqual(mediaFromWhatsAppMessage({ type: "document", document: { id: "doc-1" } }), null);

assert(buildVoiceConversationInput("Hola, quiero saber si tienen carros Hot Wheels").includes("NOTA DE VOZ TRANSCRITA"));
assert(buildImageConversationInput("Se observa una caja de juguete con una pieza rota.", "Garantia").includes("IMAGEN ANALIZADA"));

(async function () {
  const agent = createMultimodalAgent(config);
  assert.strictEqual(agent.canHandle("audio", "rav-toys"), true);
  assert.strictEqual(agent.canHandle("image", "demo"), true);
  assert.strictEqual(agent.canHandle("image", "other"), false);

  let routedMessage = "";
  const handledAudio = await agent.handleIncomingMedia({
    user_id: "573001112233",
    tenant_id: "rav-toys",
    message: { type: "audio", audio: { id: "audio-1", mime_type: "audio/ogg" } },
    downloadMedia: async function () { return { buffer: Buffer.from("fake-audio"), mime_type: "audio/ogg" }; },
    transcribeAudio: async function () { return { text: "Busco juguetes para una nina de 5 anos", confidence: "high" }; },
    sendText: async function () { throw new Error("fallback should not be used"); },
    handleConversation: async function (userId, message) {
      assert.strictEqual(userId, "573001112233");
      routedMessage = message;
    }
  });
  assert.strictEqual(handledAudio.handled, true);
  assert(routedMessage.includes("nina de 5 anos"));

  let fallbackSent = "";
  const handledFallback = await agent.handleIncomingMedia({
    user_id: "573001112233",
    tenant_id: "rav-toys",
    message: { type: "image", image: { id: "image-1", mime_type: "image/jpeg" } },
    downloadMedia: async function () { return { buffer: Buffer.from("fake-image"), mime_type: "image/jpeg" }; },
    analyzeImage: async function () { throw new Error("vision_down"); },
    sendText: async function (userId, text) {
      fallbackSent = text;
      return true;
    },
    handleConversation: async function () { throw new Error("conversation should not run"); }
  });
  assert.strictEqual(handledFallback.handled, true);
  assert.strictEqual(handledFallback.fallback, true);
  assert(fallbackSent.includes("imagen"));

  const disabled = createMultimodalAgent({ enabled: false, voice_input_enabled: true });
  const disabledResult = await disabled.handleIncomingMedia({
    tenant_id: "rav-toys",
    message: { type: "audio", audio: { id: "audio-2" } }
  });
  assert.deepStrictEqual(disabledResult, { handled: false, reason: "disabled" });

  console.log("multimodal agent tests passed");
})().catch(function (error) {
  console.error(error.stack || error.message);
  process.exit(1);
});
