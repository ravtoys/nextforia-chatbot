"use strict";

const crypto = require("crypto");

const VOICE_SOURCES = new Set(["customer_service", "appointment", "core_platform"]);
const WHATSAPP_MAX_AUDIO_BYTES = 16 * 1024 * 1024;

function clean(value, limit) {
  return String(value == null ? "" : value).replace(/\u0000/g, "").trim().slice(0, limit || 1000);
}

function cleanId(value, limit) {
  return clean(value, limit || 160).toLowerCase().replace(/[^a-z0-9:_-]/g, "");
}

function voiceError(code, status, details) {
  const error = new Error(code);
  error.name = "MetaVoiceHubError";
  error.code = code;
  error.status = status || 400;
  error.details = details || null;
  return error;
}

function deliveryKey(input) {
  const supplied = clean(input && input.idempotency_key, 240);
  if (!supplied) throw voiceError("idempotency_key_required", 422);
  return "voice-" + crypto.createHash("sha256").update([
    cleanId(input.tenant_id),
    clean(input.channel, 40).toLowerCase(),
    clean(input.source, 40).toLowerCase(),
    supplied
  ].join("\u001f")).digest("hex");
}

function validAudio(audio) {
  const buffer = audio && audio.buffer;
  const mimeType = clean(audio && audio.mime_type, 120).toLowerCase();
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw voiceError("voice_audio_empty", 502);
  if (buffer.length > WHATSAPP_MAX_AUDIO_BYTES) {
    throw voiceError("voice_audio_too_large", 502, { max_bytes: WHATSAPP_MAX_AUDIO_BYTES });
  }
  if (!mimeType.startsWith("audio/ogg")) {
    throw voiceError("voice_audio_format_unsupported", 502, { mime_type: mimeType || null });
  }
  return {
    buffer,
    mime_type: mimeType,
    filename: clean(audio && audio.filename, 160) || "nextfor-response.ogg"
  };
}

class InMemoryMetaVoiceHubStore {
  constructor() {
    this.deliveries = new Map();
  }

  async getDelivery(tenantId, key) {
    return this.deliveries.get(cleanId(tenantId) + ":" + clean(key, 160)) || null;
  }

  async saveDelivery(record) {
    this.deliveries.set(
      cleanId(record && record.tenant_id) + ":" + clean(record && record.idempotency_hash, 160),
      Object.assign({}, record)
    );
    return record;
  }
}

function createMetaVoiceHub(options) {
  options = options || {};
  const store = options.store || new InMemoryMetaVoiceHubStore();
  const resolveRuntime = options.resolveRuntime;
  const generateAudio = options.generateAudio;
  const uploadWhatsAppAudio = options.uploadWhatsAppAudio;
  const sendWhatsAppAudio = options.sendWhatsAppAudio;
  const now = typeof options.now === "function" ? options.now : function () { return new Date(); };
  const inFlight = new Map();

  if (typeof resolveRuntime !== "function") throw new Error("meta_voice_hub_runtime_resolver_required");
  if (typeof generateAudio !== "function") throw new Error("meta_voice_hub_audio_generator_required");

  async function runtime(tenantId, channel) {
    const cleanTenant = cleanId(tenantId, 160);
    const cleanChannel = clean(channel, 40).toLowerCase();
    if (!cleanTenant || !cleanChannel) throw voiceError("invalid_tenant_or_channel", 422);
    const result = await resolveRuntime(cleanTenant, cleanChannel);
    const actualTenant = cleanId(result && (result.tenant_id || result.tenantId), 160);
    if (!result || actualTenant !== cleanTenant || clean(result.channel, 40).toLowerCase() !== cleanChannel) {
      throw voiceError("tenant_channel_not_connected", 409, { channel: cleanChannel });
    }
    if (clean(result.source, 80) !== "channel_connection") {
      throw voiceError("tenant_scoped_credential_required", 409, { channel: cleanChannel });
    }
    return result;
  }

  async function requestUnlocked(input, hash) {
    const tenantId = cleanId(input && input.tenant_id, 160);
    const channel = clean(input && input.channel, 40).toLowerCase();
    const source = clean(input && input.source, 40).toLowerCase();
    const recipient = clean(input && input.recipient, 500);
    const text = clean(input && input.text, 4000);
    if (!tenantId || !channel || !source || !recipient || !text) throw voiceError("invalid_voice_request", 422);
    if (!VOICE_SOURCES.has(source)) throw voiceError("unsupported_voice_source", 422);
    const previous = await store.getDelivery(tenantId, hash);
    if (previous) return Object.assign({}, previous, { idempotent_replay: true });

    if (channel !== "whatsapp") {
      throw voiceError("voice_channel_unsupported", 409, { channel, fallback: "text" });
    }
    if (typeof uploadWhatsAppAudio !== "function" || typeof sendWhatsAppAudio !== "function") {
      throw voiceError("whatsapp_voice_delivery_unavailable", 503);
    }

    const active = await runtime(tenantId, channel);
    const audio = validAudio(await generateAudio({
      tenant_id: tenantId,
      channel,
      source,
      text
    }));
    const uploaded = await uploadWhatsAppAudio(active, audio);
    const mediaId = clean(uploaded && uploaded.media_id, 500);
    if (!mediaId) throw voiceError("whatsapp_audio_upload_failed", 502);
    const sent = await sendWhatsAppAudio(active, recipient, mediaId);
    const result = {
      tenant_id: tenantId,
      channel,
      source,
      status: "accepted",
      mechanism: "whatsapp_audio",
      provider_media_id: mediaId,
      provider_message_id: clean(sent && sent.provider_message_id, 500) || null,
      audio_mime_type: audio.mime_type,
      audio_bytes: audio.buffer.length,
      sent_at: now().toISOString(),
      idempotency_hash: hash
    };
    await store.saveDelivery(result);
    return result;
  }

  async function request(input) {
    const hash = deliveryKey(input);
    if (inFlight.has(hash)) return inFlight.get(hash);
    const pending = requestUnlocked(input || {}, hash).finally(function () { inFlight.delete(hash); });
    inFlight.set(hash, pending);
    return pending;
  }

  return { request, store };
}

module.exports = {
  InMemoryMetaVoiceHubStore,
  VOICE_SOURCES,
  createMetaVoiceHub,
  deliveryKey,
  voiceError
};
