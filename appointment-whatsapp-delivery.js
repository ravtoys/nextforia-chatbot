"use strict";

function clean(value, limit) {
  return String(value == null ? "" : value).trim().slice(0, limit || 500);
}

function reminderText(params) {
  params = params || {};
  return "Hola " + (clean(params.customer_name, 160) || "Cliente") +
    ", te recordamos tu cita con " + (clean(params.business_name, 160) || "Nextfor") +
    " el " + clean(params.appointment_date, 160) +
    " a las " + clean(params.appointment_time, 80) +
    ". Responde a este mensaje si necesitas ayuda para reprogramarla.";
}

async function deliverAppointmentWhatsApp(options) {
  options = options || {};
  const appointment = options.appointment || {};
  const tenantId = clean(appointment.tenant_id, 80);
  const phone = clean(appointment.customer_phone, 80);
  const withinWindow = await options.customerWindowOpen(tenantId, phone);
  if (withinWindow) {
    const delivered = await options.sendText(phone, reminderText(options.params), { tenant_id: tenantId });
    if (delivered) return { ok: true, provider_id: "customer_window_text", mode: "text" };
  }
  const sent = await options.sendTemplate(phone, options.template, options.params, { tenant_id: tenantId });
  const message = sent && sent.meta && sent.meta.messages && sent.meta.messages[0];
  return {
    ok: !!(sent && sent.ok),
    provider_id: message && message.id || "",
    error: sent && sent.error || null,
    mode: "template"
  };
}

module.exports = { deliverAppointmentWhatsApp, reminderText };
