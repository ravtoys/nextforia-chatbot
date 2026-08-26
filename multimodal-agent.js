"use strict";

function cleanText(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max || 1000);
}

function enabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function list(value) {
  return String(value || "").split(",").map(function (entry) {
    return cleanText(entry, 120).toLowerCase();
  }).filter(Boolean);
}

function multimodalConfigFromEnv(env) {
  env = env || {};
  const tenantIds = list(env.MULTIMODAL_AGENT_TENANT_IDS);
  return {
    enabled: enabled(env.MULTIMODAL_AGENT_ENABLED),
    tenant_ids: tenantIds,
    voice_input_enabled: enabled(env.MULTIMODAL_VOICE_INPUT_ENABLED),
    image_input_enabled: enabled(env.MULTIMODAL_IMAGE_INPUT_ENABLED),
    voice_replies_enabled: enabled(env.MULTIMODAL_VOICE_REPLIES_ENABLED),
    transcription_provider: cleanText(env.MULTIMODAL_TRANSCRIPTION_PROVIDER || "openai", 40).toLowerCase(),
    vision_provider: cleanText(env.MULTIMODAL_VISION_PROVIDER || "openai", 40).toLowerCase(),
    voice_provider: cleanText(env.MULTIMODAL_VOICE_PROVIDER || "elevenlabs", 40).toLowerCase(),
    max_audio_bytes: Math.max(128000, Math.min(25 * 1024 * 1024, Number(env.MULTIMODAL_MAX_AUDIO_BYTES) || 16 * 1024 * 1024)),
    max_image_bytes: Math.max(128000, Math.min(10 * 1024 * 1024, Number(env.MULTIMODAL_MAX_IMAGE_BYTES) || 6 * 1024 * 1024))
  };
}

function tenantAllowed(config, tenantId) {
  const ids = Array.isArray(config.tenant_ids) ? config.tenant_ids : [];
  if (!ids.length) return false;
  const cleanTenantId = cleanText(tenantId, 120).toLowerCase();
  if (!cleanTenantId) return false;
  return ids.includes("*") || ids.includes(cleanTenantId);
}

function mediaFromWhatsAppMessage(message) {
  message = message || {};
  const type = cleanText(message.type, 40).toLowerCase();
  const payload = message[type] || {};
  if (type === "audio" || type === "voice") {
    return {
      kind: "audio",
      media_id: cleanText(payload.id, 200),
      mime_type: cleanText(payload.mime_type || "audio/ogg", 120),
      caption: "",
      sha256: cleanText(payload.sha256, 160)
    };
  }
  if (type === "image") {
    return {
      kind: "image",
      media_id: cleanText(payload.id, 200),
      mime_type: cleanText(payload.mime_type || "image/jpeg", 120),
      caption: cleanText(payload.caption, 1500),
      sha256: cleanText(payload.sha256, 160)
    };
  }
  return null;
}

function buildVoiceConversationInput(transcript, meta) {
  const clean = cleanText(transcript, 6000);
  if (!clean) return "";
  meta = meta || {};
  return [
    "[AGENTE MULTIMODAL: NOTA DE VOZ TRANSCRITA]",
    "El cliente envio una nota de voz. Usa esta transcripcion como mensaje del cliente y responde de forma natural.",
    meta.confidence ? "Confianza de transcripcion: " + cleanText(meta.confidence, 40) : "",
    "",
    clean
  ].filter(Boolean).join("\n");
}

function buildImageConversationInput(analysis, caption) {
  const cleanAnalysis = cleanText(analysis, 6000);
  const cleanCaption = cleanText(caption, 1500);
  if (!cleanAnalysis && !cleanCaption) return "";
  return [
    "[AGENTE MULTIMODAL: IMAGEN ANALIZADA]",
    "El cliente envio una imagen. Usa solo estos hallazgos visuales; si falta certeza, pregunta o escala a humano.",
    cleanCaption ? "Texto/caption del cliente: " + cleanCaption : "",
    "",
    cleanAnalysis || "La imagen no tuvo hallazgos suficientes."
  ].filter(Boolean).join("\n");
}

function imageAnalysisPrompt(botMode) {
  const mode = cleanText(botMode, 40).toLowerCase();
  const shared = [
    "Analiza esta imagen recibida por WhatsApp para un bot profesional de Nextfor IA.",
    "Responde en espanol, breve y util.",
    "Describe solo lo visible con cautela y no inventes datos, identidades, consentimientos ni resultados.",
    "Si hay texto visible, resume solo lo necesario y evita repetir numeros de identificacion, datos medicos o financieros completos.",
    "Si el caso parece sensible o incierto, indica que debe preguntarse al cliente o escalarse a una persona."
  ];
  if (mode === "appointments") {
    shared.push(
      "El bot se dedica a agendamiento de citas.",
      "Clasifica el caso como solicitud_de_cita, horario_o_disponibilidad, confirmacion_o_comprobante, documento, o unclear.",
      "No diagnostiques, no confirmes una cita solo por la imagen y no asumas autorizacion para tratar datos personales."
    );
  } else if (mode === "both") {
    shared.push(
      "El tenant usa atencion al cliente y agendamiento de citas.",
      "Identifica cual de los dos flujos corresponde antes de resumir la imagen.",
      "No confirmes pedidos, pagos ni citas solo por la imagen."
    );
  } else if (mode === "customer_service") {
    shared.push(
      "El bot se dedica a atencion comercial al cliente.",
      "Clasifica el caso como producto, garantia_o_dano, pedido_o_pago, documento, o unclear.",
      "No inventes precios, guias, estados de pedido ni diagnosticos."
    );
  } else {
    shared.push(
      "Identifica la intencion segun la configuracion del bot y resume la imagen sin asumir un flujo comercial o de citas.",
      "Clasifica el caso con una descripcion funcional breve o como unclear.",
      "No ejecutes ni confirmes acciones solo por lo que aparezca en la imagen."
    );
  }
  return shared.join(" ");
}

function createMultimodalAgent(config) {
  config = Object.assign(multimodalConfigFromEnv({}), config || {});

  function canHandle(kind, tenantId) {
    if (!config.enabled || !tenantAllowed(config, tenantId)) return false;
    if (kind === "audio") return !!config.voice_input_enabled;
    if (kind === "image") return !!config.image_input_enabled;
    return false;
  }

  async function handleIncomingMedia(input) {
    input = input || {};
    const media = input.media || mediaFromWhatsAppMessage(input.message);
    if (!media || !canHandle(media.kind, input.tenant_id)) return { handled: false, reason: "disabled" };
    if (!media.media_id) return { handled: false, reason: "missing_media_id" };

    const logger = input.log || function () {};
    const sendText = input.sendText;
    const handleConversation = input.handleConversation;
    const recordTurn = input.recordTurn || function () {};
    if (typeof sendText !== "function" || typeof handleConversation !== "function") {
      throw new Error("multimodal_dependencies_missing");
    }

    try {
      const downloaded = await input.downloadMedia(media);
      const byteLength = downloaded && downloaded.buffer ? downloaded.buffer.length : 0;
      if (media.kind === "audio" && byteLength > config.max_audio_bytes) throw new Error("audio_too_large");
      if (media.kind === "image" && byteLength > config.max_image_bytes) throw new Error("image_too_large");

      let conversationInput = "";
      if (media.kind === "audio") {
        const transcript = await input.transcribeAudio(downloaded, media, {
          tenant_id: input.tenant_id,
          user_id: input.user_id,
          conversation_meta: input.conversation_meta || {}
        });
        conversationInput = buildVoiceConversationInput(transcript && transcript.text || transcript, transcript || {});
      } else if (media.kind === "image") {
        const analysis = await input.analyzeImage(downloaded, media, {
          tenant_id: input.tenant_id,
          user_id: input.user_id,
          conversation_meta: input.conversation_meta || {}
        });
        conversationInput = buildImageConversationInput(analysis && analysis.text || analysis, media.caption);
      }

      if (!conversationInput) throw new Error("multimodal_empty_result");
      await handleConversation(input.user_id, conversationInput, Object.assign({}, input.conversation_meta || {}, {
        multimodal: true,
        media_kind: media.kind,
        media_id: media.media_id
      }));
      logger("info", "multimodal_agent_handled", {
        tenant_id: cleanText(input.tenant_id, 120),
        media_kind: media.kind
      });
      return { handled: true, media_kind: media.kind };
    } catch (error) {
      // handleConversation may have delivered a reply and then failed its
      // strict inbox persistence. A fallback here would produce two replies.
      if (error && error.conversationPersistenceFailure) throw error;
      logger("warn", "multimodal_agent_failed", {
        media_kind: media.kind,
        error: cleanText(error && error.message, 160)
      });
      const fallback = media.kind === "audio"
        ? "Aun no pude procesar esa nota de voz con seguridad. ¿Me la escribes en texto o quieres que te pase con alguien del equipo?"
        : "Aun no pude analizar esa imagen con seguridad. ¿Me describes lo que aparece o quieres que te pase con alguien del equipo?";
      const sent = await sendText(input.user_id, fallback);
      await recordTurn(input.user_id, media.kind === "audio" ? "[Audio recibido]" : "[Imagen recibida]", fallback, sent ? "ok" : "error");
      return { handled: true, media_kind: media.kind, fallback: true, error: cleanText(error && error.message, 160) };
    }
  }

  return {
    config,
    canHandle,
    handleIncomingMedia
  };
}

module.exports = {
  buildImageConversationInput,
  buildVoiceConversationInput,
  createMultimodalAgent,
  imageAnalysisPrompt,
  mediaFromWhatsAppMessage,
  multimodalConfigFromEnv,
  tenantAllowed
};
