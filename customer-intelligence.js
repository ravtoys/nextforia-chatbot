"use strict";

const STAGE_RANK = {
  none: 0,
  interested: 1,
  checkout_started: 2,
  payment_pending: 3,
  order_handoff: 4,
  confirmed_customer: 5
};

const DEFAULT_LIMITS = {
  standard: { maxTokens: 1000, historyMessages: 8 },
  engaged: { maxTokens: 1400, historyMessages: 12 },
  high: { maxTokens: 1800, historyMessages: 18 }
};

function cleanText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength || 160);
}

function normalizedText(value) {
  return cleanText(value, 1200)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function strongPurchaseIntent(value) {
  const text = normalizedText(value);
  return /\b(quiero comprar(?:lo|la)?|quiero pedir(?:lo|la)?|me lo llevo|me la llevo|lo compro|la compro|hagamos el pedido|tomame el pedido|como pago|quiero pagar|pasame el link|mandame el link|confirmo la compra|compro hoy|pago hoy|separalo|separamelo)\b/.test(text);
}

function warmPurchaseIntent(value) {
  const text = normalizedText(value);
  return /\b(precio|cuanto vale|cuanto cuesta|disponible|disponibilidad|envio|entrega|domicilio|busco|regalo|tienen)\b/.test(text);
}

function extractPreferredName(value) {
  const text = cleanText(value, 240);
  const match = text.match(/\b(?:me llamo|mi nombre es)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{1,48})/i);
  if (!match) return "";
  return cleanText(match[1].split(/[,.;!?]|\s+(?:y|pero|porque|para|quiero)\s+/i)[0], 50);
}

function normalizeList(values, maxItems, maxLength) {
  const out = [];
  (Array.isArray(values) ? values : []).forEach(function (value) {
    const clean = cleanText(value, maxLength);
    if (clean && !out.some(function (item) { return normalizedText(item) === normalizedText(clean); })) out.push(clean);
  });
  return out.slice(-maxItems);
}

function normalizeMemory(memory) {
  const value = memory && typeof memory === "object" ? memory : {};
  const stage = Object.prototype.hasOwnProperty.call(STAGE_RANK, value.purchase_stage) ? value.purchase_stage : "none";
  const priority = ["normal", "medium", "high"].includes(value.priority) ? value.priority : "normal";
  return {
    version: 1,
    preferred_name: cleanText(value.preferred_name, 50),
    purchase_stage: stage,
    priority,
    interests: normalizeList(value.interests, 6, 100),
    confirmed_orders: normalizeList(value.confirmed_orders, 5, 80),
    source_signals: normalizeList(value.source_signals, 8, 60),
    last_purchase_intent_at: value.last_purchase_intent_at || null,
    last_purchase_at: value.last_purchase_at || null,
    // Confirmacion de zona de servicio: persiste para no volver a preguntarla tras un reinicio.
    service_area_status: ["inside", "outside"].includes(value.service_area_status) ? value.service_area_status : null,
    service_area_country: /^[A-Za-z]{2}$/.test(String(value.service_area_country || "")) ? String(value.service_area_country).toUpperCase() : null,
    updated_at: value.updated_at || null
  };
}

function isMeaningfulMemory(memory) {
  const value = normalizeMemory(memory);
  return value.purchase_stage !== "none" || !!value.preferred_name || value.interests.length > 0 || value.confirmed_orders.length > 0 || !!value.service_area_status;
}

function memoryFingerprint(memory) {
  return JSON.stringify(normalizeMemory(memory));
}

function advanceStage(current, candidate) {
  const currentStage = Object.prototype.hasOwnProperty.call(STAGE_RANK, current) ? current : "none";
  const nextStage = Object.prototype.hasOwnProperty.call(STAGE_RANK, candidate) ? candidate : "none";
  return STAGE_RANK[nextStage] > STAGE_RANK[currentStage] ? nextStage : currentStage;
}

function checkoutProducts(checkout) {
  return normalizeList((checkout && checkout.products || []).map(function (product) { return product && product.title; }), 6, 100);
}

function evolveCustomerMemory(currentMemory, event) {
  const current = normalizeMemory(currentMemory);
  const next = normalizeMemory(current);
  const input = event && typeof event === "object" ? event : {};
  const toolName = cleanText(input.toolName, 80);
  const result = input.toolResult && typeof input.toolResult === "object" ? input.toolResult : {};
  const checkout = input.checkout && typeof input.checkout === "object" ? input.checkout : null;
  const timestamp = input.now || new Date().toISOString();
  let qualifies = false;
  let candidateStage = "none";
  let signal = "";

  if (!toolName && strongPurchaseIntent(input.userMessage)) {
    qualifies = true;
    candidateStage = "interested";
    signal = "strong_intent_message";
  }

  if (toolName === "select_product_for_purchase" && !result.error && (result.added || result.already_in_cart)) {
    qualifies = true;
    candidateStage = "interested";
    signal = "product_selected";
  } else if (toolName === "save_checkout_field" && !result.error && result.saved) {
    qualifies = true;
    candidateStage = "checkout_started";
    signal = "checkout_started";
  } else if (toolName === "send_payment_link" && result.sent) {
    qualifies = true;
    candidateStage = "payment_pending";
    signal = "payment_link_sent";
  } else if (toolName === "notify_sale_team" && result.notified) {
    qualifies = true;
    candidateStage = "order_handoff";
    signal = "order_handoff";
  } else if (toolName === "lookup_order_status" && result.found && result.matched) {
    qualifies = true;
    candidateStage = "confirmed_customer";
    signal = "shopify_order_verified";
  }

  const explicitName = extractPreferredName(input.userMessage);
  if (explicitName) {
    next.preferred_name = explicitName;
    qualifies = true;
    signal = signal || "explicit_name";
  }

  if (!qualifies) return { changed: false, memory: current };

  const checkoutName = cleanText(checkout && checkout.data && checkout.data.nombre, 50);
  if (checkoutName) next.preferred_name = checkoutName;
  next.purchase_stage = advanceStage(next.purchase_stage, candidateStage);
  next.priority = candidateStage === "none" ? next.priority : "high";
  next.interests = normalizeList(next.interests.concat(checkoutProducts(checkout), result.title ? [result.title] : []), 6, 100);
  if (candidateStage === "confirmed_customer" && result.order_name) {
    next.confirmed_orders = normalizeList(next.confirmed_orders.concat([result.order_name]), 5, 80);
    next.last_purchase_at = result.created_at || timestamp;
  }
  if (candidateStage !== "none") next.last_purchase_intent_at = timestamp;
  next.source_signals = normalizeList(next.source_signals.concat(signal ? [signal] : []), 8, 60);
  next.updated_at = timestamp;

  return { changed: memoryFingerprint(next) !== memoryFingerprint(current), memory: normalizeMemory(next) };
}

function adaptiveConversationBudget(input) {
  const value = input && typeof input === "object" ? input : {};
  const memory = normalizeMemory(value.memory);
  const checkout = value.checkout && typeof value.checkout === "object" ? value.checkout : {};
  const historyLength = Array.isArray(value.history) ? value.history.length : Number(value.historyLength || 0);
  const limits = Object.assign({}, DEFAULT_LIMITS, value.limits || {});
  let score = 0;
  const reasons = [];

  if (strongPurchaseIntent(value.userMessage)) { score += 5; reasons.push("strong_purchase_intent"); }
  else if (warmPurchaseIntent(value.userMessage)) { score += 2; reasons.push("commercial_question"); }
  if (Array.isArray(checkout.products) && checkout.products.length > 0) { score += 6; reasons.push("active_checkout"); }
  if (memory.priority === "high") { score += 3; reasons.push("priority_memory"); }
  if (memory.confirmed_orders.length > 0) { score += 2; reasons.push("returning_customer"); }
  if (STAGE_RANK[memory.purchase_stage] >= STAGE_RANK.checkout_started) { score += 2; reasons.push("advanced_purchase_stage"); }
  if (historyLength >= 8) { score += 1; reasons.push("long_conversation"); }

  const tier = score >= 5 ? "high" : score >= 2 ? "engaged" : "standard";
  const selected = Object.assign({}, DEFAULT_LIMITS[tier], limits[tier] || {});
  return {
    tier,
    score,
    reasons,
    maxTokens: Number(selected.maxTokens) || DEFAULT_LIMITS[tier].maxTokens,
    historyMessages: Number(selected.historyMessages) || DEFAULT_LIMITS[tier].historyMessages
  };
}

function purchaseStageLabel(stage) {
  const labels = {
    interested: "mostro intencion clara de compra",
    checkout_started: "inicio el proceso de compra",
    payment_pending: "recibio instrucciones de pago",
    order_handoff: "dejo un pedido listo para seguimiento",
    confirmed_customer: "tiene una compra verificada en Shopify"
  };
  return labels[stage] || "sin hito comercial confirmado";
}

function buildCustomerMemoryContext(memory, options) {
  const value = normalizeMemory(memory);
  if (!isMeaningfulMemory(value)) return "";
  const isNewSession = !!(options && options.newSession);
  const lines = [
    "MEMORIA COMERCIAL PERSISTENTE DE ESTE CLIENTE (datos permitidos y separados por canal):",
    "- Nombre preferido: " + (value.preferred_name || "no confirmado"),
    "- Relacion: " + purchaseStageLabel(value.purchase_stage),
    "- Prioridad comercial: " + value.priority,
    "- Intereses o productos previos: " + (value.interests.length ? value.interests.join(", ") : "ninguno guardado"),
    "- Pedidos verificados: " + (value.confirmed_orders.length ? value.confirmed_orders.join(", ") : "ninguno")
  ];
  lines.push("REGLAS DE USO DE MEMORIA:");
  if (isNewSession && value.preferred_name) lines.push("- Saluda al cliente por su nombre una sola vez y de manera natural.");
  else lines.push("- No repitas el nombre en cada mensaje ni fuerces un saludo si la conversacion ya esta en curso.");
  lines.push("- Usa el contexto para ahorrar preguntas repetidas y dar seguimiento proactivo, sin revelar que existe una base de memoria.");
  lines.push("- No presentes una intencion o un checkout como compra confirmada. Solo los pedidos listados como verificados son compras confirmadas.");
  lines.push("- Prioridad alta significa responder con especial claridad y ayudar a cerrar, nunca presionar al cliente.");
  return lines.join("\n");
}

module.exports = {
  adaptiveConversationBudget,
  buildCustomerMemoryContext,
  evolveCustomerMemory,
  extractPreferredName,
  isMeaningfulMemory,
  memoryFingerprint,
  normalizeMemory,
  purchaseStageLabel,
  strongPurchaseIntent,
  warmPurchaseIntent
};
