"use strict";

const crypto = require("crypto");

const NEXTFORIA_HOME_URL = "https://nextforia.com";
const NEXTFORIA_SETUP_EMAIL_FROM = "Nextfor IA <info@nextforia.com>";
const NEXTFORIA_SUPPORT_WHATSAPP = "https://wa.me/573106534553";
const SETUP_EMAIL_TEMPLATES = Object.freeze([
  "welcome",
  "training_incomplete",
  "payment_abandoned",
  "preparing",
  "live"
]);

function text(value, limit) {
  return String(value == null ? "" : value).trim().slice(0, limit || 500);
}

function escapeHtml(value) {
  return text(value, 10000).replace(/[&<>"']/g, function (character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
  });
}

function safeUrl(value, fallback) {
  try {
    const url = new URL(String(value || fallback || NEXTFORIA_HOME_URL));
    if (url.protocol !== "https:") return fallback || NEXTFORIA_HOME_URL;
    if (url.hostname !== "nextforia.com" && !url.hostname.endsWith(".nextforia.com")) {
      return fallback || NEXTFORIA_HOME_URL;
    }
    return url.toString();
  } catch (_) {
    return fallback || NEXTFORIA_HOME_URL;
  }
}

function formatPrice(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.round(numeric).toLocaleString("es-CO");
  return text(value, 40) || "por confirmar";
}

function emailFrame(content) {
  const preheader = escapeHtml(content.preheader || content.subject);
  const home = NEXTFORIA_HOME_URL;
  return "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" +
    escapeHtml(content.subject) +
    "</title></head><body style=\"margin:0;padding:0;background:#F3F6FA;color:#0A1836;\">" +
    "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;\">" + preheader + "</div>" +
    "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#F3F6FA;width:100%;\"><tr><td align=\"center\" style=\"padding:28px 14px;\">" +
    "<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"width:100%;max-width:600px;\">" +
    "<tr><td style=\"padding:22px 30px;border-radius:18px 18px 0 0;background:linear-gradient(145deg,#0E2148,#060F22);font-family:Arial,'Helvetica Neue',sans-serif;\"><a href=\"" + home + "\" style=\"color:#FFFFFF;text-decoration:none;font-size:20px;font-weight:700;\">Nextfor IA</a><div style=\"margin-top:5px;color:#93D8F8;font-size:12px;\">Inteligencia corporativa al servicio de las personas</div></td></tr>" +
    "<tr><td style=\"padding:38px 40px 34px;background:#FFFFFF;border-left:1px solid #DFE6F0;border-right:1px solid #DFE6F0;font-family:Arial,'Helvetica Neue',sans-serif;\">" +
    "<div style=\"padding-bottom:12px;color:#0587CC;font-size:11px;font-weight:700;letter-spacing:1.6px;\">" + escapeHtml(content.eyebrow) + "</div>" +
    "<h1 style=\"margin:0;padding:0 0 16px;color:#0A1836;font-size:30px;line-height:1.22;letter-spacing:-.8px;\">" + escapeHtml(content.heading) + "</h1>" +
    "<div style=\"padding-bottom:26px;color:#313C50;font-size:16px;line-height:1.62;\">" + content.bodyHtml + "</div>" +
    (content.highlightHtml || "") +
    "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td style=\"border-radius:12px;background:#0587CC;padding:16px 30px;\"><a href=\"" + escapeHtml(content.ctaUrl) + "\" style=\"display:block;color:#FFFFFF;text-decoration:none;font-size:17px;font-weight:700;\">" + escapeHtml(content.ctaLabel) + "</a></td></tr></table>" +
    (content.afterCtaHtml || "") +
    "<div style=\"padding-top:28px;color:#313C50;font-size:15px;line-height:1.6;\">Equipo Nextfor</div>" +
    "</td></tr>" +
    "<tr><td style=\"padding:24px 40px 28px;border:1px solid #DFE6F0;border-top:0;border-radius:0 0 18px 18px;background:#F6F8FB;font-family:Arial,'Helvetica Neue',sans-serif;color:#647289;font-size:13px;line-height:1.62;\">" +
    "<strong style=\"color:#0A1836;\">Nextfor IA</strong><br>¿Necesitas ayuda? Responde a este correo o escríbenos por <a href=\"" + NEXTFORIA_SUPPORT_WHATSAPP + "\" style=\"color:#0587CC;\">WhatsApp</a>.<br>" +
    "<a href=\"" + home + "\" style=\"display:inline-block;margin-top:12px;color:#0587CC;font-weight:700;\">Entrar a nextforia.com</a>" +
    "</td></tr></table></td></tr></table></body></html>";
}

function buildSetupJourneyEmail(template, input) {
  input = input || {};
  if (!SETUP_EMAIL_TEMPLATES.includes(template)) throw new Error("setup_email_template_invalid");
  const name = text(input.name || input.nombre || input.company_name, 120);
  const plan = text(input.plan_name || input.plan, 120) || "tu plan de Nextfor";
  const price = formatPrice(input.monthly_price != null ? input.monthly_price : input.precio);
  const setupUrl = safeUrl(input.setup_url, NEXTFORIA_HOME_URL + "/admin/client-onboarding");
  const paymentUrl = safeUrl(input.payment_url, NEXTFORIA_HOME_URL + "/admin/panel?tab=plan");
  const panelUrl = safeUrl(input.panel_url, NEXTFORIA_HOME_URL + "/admin/panel");
  const whatsappUrl = /^https:\/\/wa\.me\/[0-9]+$/i.test(String(input.whatsapp_url || ""))
    ? String(input.whatsapp_url)
    : "";
  let content;

  if (template === "welcome") {
    const suffix = name ? ", " + name : "";
    content = {
      subject: "Tu cuenta ya está lista" + suffix,
      preheader: "Tu cuenta de Nextfor está lista. Empieza a entrenar tu bot.",
      eyebrow: "CUENTA CREADA",
      heading: "Bienvenido a Nextfor" + suffix + ".",
      bodyHtml: "Acabas de dar el primer paso para dejar de hacerlo todo tú. Ahora enséñale a tu bot cómo funciona tu negocio: qué vendes, tus horarios y tu forma de responder. Toma unos minutos y tu avance se guarda automáticamente.",
      ctaLabel: "Entrenar mi bot",
      ctaUrl: setupUrl,
      afterCtaHtml: "<div style=\"padding-top:24px;color:#647289;font-size:14px;line-height:1.55;\">Puedes salir y volver cuando quieras. Nada se pierde.</div>"
    };
  } else if (template === "training_incomplete") {
    const suffix = name ? ", " + name : "";
    content = {
      subject: "Tu bot quedó a medio entrenar" + suffix,
      preheader: "Guardamos tu avance. Continúa justo donde lo dejaste.",
      eyebrow: "ENTRENAMIENTO GUARDADO",
      heading: "Tu bot te está esperando.",
      bodyHtml: "Guardamos todo lo que ya le enseñaste. Falta poco para que responda por ti preguntas sobre precios, horarios y disponibilidad. Retoma donde lo dejaste; no empiezas de cero.",
      ctaLabel: "Continuar entrenamiento",
      ctaUrl: setupUrl,
      afterCtaHtml: "<div style=\"padding-top:24px;color:#647289;font-size:14px;line-height:1.55;\">Tu información sigue guardada de forma segura.</div>"
    };
  } else if (template === "payment_abandoned") {
    content = {
      subject: "Estás a pocos pasos de tener a tu mejor empleado listo 24/7",
      preheader: "Tu entrenamiento está guardado. Solo falta activar tu plan.",
      eyebrow: "ÚLTIMO PASO",
      heading: "Ya entrenaste a tu bot. Solo falta activarlo.",
      bodyHtml: "Hiciste la parte más importante. Con <strong>" + escapeHtml(plan) + "</strong>, tu negocio puede atender incluso cuando tu equipo no está disponible.",
      highlightHtml: "<div style=\"margin-bottom:26px;padding:20px 22px;border:1px solid #DFE6F0;border-radius:14px;background:#F6F8FB;color:#313C50;font-size:15px;line-height:1.6;\"><strong style=\"color:#0A1836;font-size:16px;\">" + escapeHtml(plan) + "</strong> · $ " + escapeHtml(price) + " al mes<br><span style=\"color:#647289;font-size:14px;\">Tu entrenamiento queda intacto.</span></div>",
      ctaLabel: "Activar mi plan",
      ctaUrl: paymentUrl,
      afterCtaHtml: "<div style=\"padding-top:24px;color:#647289;font-size:14px;line-height:1.55;\">¿Estás empezando? Revisa las opciones disponibles desde tu panel de Nextfor.</div>"
    };
  } else if (template === "preparing") {
    content = {
      subject: "Tu bot está siendo preparado, falta poco",
      preheader: "Recibimos tu configuración y ya estamos verificándola.",
      eyebrow: "EN VERIFICACIÓN",
      heading: "Ya está todo en nuestras manos.",
      bodyHtml: "Entrenaste tu bot y elegiste <strong>" + escapeHtml(plan) + "</strong>. Ahora revisamos que responda como tu negocio necesita. Te avisaremos cuando la verificación termine.",
      ctaLabel: "Ver mi panel",
      ctaUrl: panelUrl,
      afterCtaHtml: "<div style=\"padding-top:24px;color:#647289;font-size:14px;line-height:1.55;\">No tienes que repetir el setup. Puedes consultar el estado desde tu panel.</div>"
    };
  } else {
    const suffix = name ? ", " + name : "";
    content = {
      subject: "¡Nextfor ya está atendiendo por ti!",
      preheader: "Tu bot ya está listo para atender a tus clientes.",
      eyebrow: "TODO LISTO",
      heading: "Tu bot ya está atendiendo" + suffix + ".",
      bodyHtml: "Desde ahora puede responder preguntas frecuentes, capturar oportunidades y permitirte tomar el control de una conversación cuando lo necesites. Escríbele primero para conocer la experiencia de tus clientes.",
      ctaLabel: whatsappUrl ? "Probar mi bot en WhatsApp" : "Ver mi panel",
      ctaUrl: whatsappUrl || panelUrl,
      afterCtaHtml: "<div style=\"padding-top:24px;color:#647289;font-size:14px;line-height:1.55;\">También puedes revisar conversaciones y resultados en tu <a href=\"" + escapeHtml(panelUrl) + "\" style=\"color:#0587CC;\">panel de control</a>.</div>"
    };
  }

  const actionUrl = content.ctaUrl;
  const plainBody = {
    welcome: "Tu cuenta de Nextfor está lista. Empieza a entrenar tu bot y guarda tu avance.",
    training_incomplete: "Guardamos tu avance. Continúa el entrenamiento justo donde lo dejaste.",
    payment_abandoned: "Tu entrenamiento está guardado. Activa " + plan + " por $ " + price + " al mes.",
    preparing: "Recibimos tu configuración para " + plan + " y ya la estamos verificando.",
    live: "Tu bot ya está listo para atender a tus clientes."
  }[template];
  return {
    template,
    from: NEXTFORIA_SETUP_EMAIL_FROM,
    subject: content.subject,
    text: plainBody + "\n\n" + content.ctaLabel + ": " + actionUrl + "\n\nEntrar a Nextfor: " + NEXTFORIA_HOME_URL,
    html: emailFrame(content)
  };
}

function createResendSetupJourneySender(options) {
  options = options || {};
  const apiKey = text(options.apiKey, 500);
  const replyTo = text(options.replyTo, 254);
  const axiosClient = options.axiosClient;
  return {
    async send(message) {
      if (!axiosClient || typeof axiosClient.post !== "function") throw new Error("setup_email_sender_unavailable");
      const email = buildSetupJourneyEmail(message.template, message);
      const response = await axiosClient.post("https://api.resend.com/emails", {
        from: NEXTFORIA_SETUP_EMAIL_FROM,
        to: [text(message.to, 254).toLowerCase()],
        reply_to: replyTo || undefined,
        subject: email.subject,
        text: email.text,
        html: email.html
      }, {
        headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
        timeout: 8000
      });
      return { id: response.data && response.data.id || null, email };
    }
  };
}

function setupEmailDedupeKey(template, tenantId, scope) {
  return ["setup-email", text(template, 40), text(tenantId, 120).toLowerCase(), text(scope, 180)].join(":");
}

function normalizeScheduledEmail(input) {
  input = input || {};
  if (!SETUP_EMAIL_TEMPLATES.includes(input.template)) throw new Error("setup_email_template_invalid");
  const recipient = text(input.to, 254).toLowerCase();
  const tenantId = text(input.tenant_id, 120).toLowerCase();
  if (!tenantId) throw new Error("setup_email_tenant_required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error("setup_email_recipient_invalid");
  const sendAfter = new Date(input.send_after || new Date()).toISOString();
  return {
    id: text(input.id, 120) || crypto.randomUUID(),
    tenant_id: tenantId,
    recipient,
    template_key: input.template,
    dedupe_key: text(input.dedupe_key, 500) || setupEmailDedupeKey(input.template, tenantId, "once"),
    payload: input.payload && typeof input.payload === "object" ? JSON.parse(JSON.stringify(input.payload)) : {},
    status: "scheduled",
    send_after: sendAfter,
    attempts: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

module.exports = {
  NEXTFORIA_HOME_URL,
  NEXTFORIA_SETUP_EMAIL_FROM,
  SETUP_EMAIL_TEMPLATES,
  buildSetupJourneyEmail,
  createResendSetupJourneySender,
  normalizeScheduledEmail,
  setupEmailDedupeKey
};
