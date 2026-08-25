"use strict";

const assert = require("assert");
const { createMetaVoiceHub } = require("./meta-voice-hub");

function runtime(tenantId, channel) {
  return {
    tenant_id: tenantId,
    channel,
    source: "channel_connection",
    phone_number_id: "phone-" + tenantId,
    access_token: "tenant-token-" + tenantId
  };
}

async function main() {
  const calls = [];
  const hub = createMetaVoiceHub({
    resolveRuntime: async function (tenantId, channel) { return runtime(tenantId, channel); },
    generateAudio: async function (input) {
      calls.push({ stage: "generate", tenant_id: input.tenant_id, text: input.text });
      return { buffer: Buffer.from("opus-bytes"), mime_type: "audio/ogg; codecs=opus", filename: "reply.ogg" };
    },
    uploadWhatsAppAudio: async function (active, audio) {
      calls.push({ stage: "upload", tenant_id: active.tenant_id, bytes: audio.buffer.length });
      return { media_id: "media-" + active.tenant_id };
    },
    sendWhatsAppAudio: async function (active, recipient, mediaId) {
      calls.push({ stage: "send", tenant_id: active.tenant_id, recipient, media_id: mediaId });
      return { provider_message_id: "wamid-" + active.tenant_id };
    }
  });

  const input = {
    tenant_id: "tenant-a",
    channel: "whatsapp",
    source: "customer_service",
    recipient: "573106534553",
    text: "Hola, esta es una respuesta de voz.",
    idempotency_key: "voice-turn-1"
  };
  const sent = await hub.request(input);
  assert.strictEqual(sent.status, "accepted");
  assert.strictEqual(sent.mechanism, "whatsapp_audio");
  assert.strictEqual(sent.provider_message_id, "wamid-tenant-a");
  assert.deepStrictEqual(calls.map(function (call) { return call.stage; }), ["generate", "upload", "send"]);
  assert(calls.every(function (call) { return call.tenant_id === "tenant-a"; }));

  const replay = await hub.request(input);
  assert.strictEqual(replay.idempotent_replay, true);
  assert.strictEqual(calls.length, 3, "an idempotent replay must not generate or deliver audio twice");

  await assert.rejects(
    hub.request(Object.assign({}, input, { channel: "instagram", idempotency_key: "ig-voice" })),
    function (error) { return error && error.code === "voice_channel_unsupported"; }
  );
  await assert.rejects(
    hub.request(Object.assign({}, input, { tenant_id: "", idempotency_key: "missing-tenant" })),
    function (error) { return error && error.code === "invalid_voice_request"; }
  );

  const wrongSourceHub = createMetaVoiceHub({
    resolveRuntime: async function (tenantId, channel) {
      return Object.assign(runtime(tenantId, channel), { source: "environment" });
    },
    generateAudio: async function () { return { buffer: Buffer.from("opus"), mime_type: "audio/ogg" }; },
    uploadWhatsAppAudio: async function () { return { media_id: "media" }; },
    sendWhatsAppAudio: async function () { return { provider_message_id: "wamid" }; }
  });
  await assert.rejects(
    wrongSourceHub.request(Object.assign({}, input, { idempotency_key: "environment-runtime" })),
    function (error) { return error && error.code === "tenant_scoped_credential_required"; }
  );
}

main().then(function () {
  console.log("meta-voice-hub: assertions passed");
}).catch(function (error) {
  console.error(error);
  process.exit(1);
});
