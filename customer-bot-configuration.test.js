"use strict";

const assert = require("assert");
const configurationUi = require("./customer-bot-configuration");
const renderCustomerPanel = require("./customer-panel");

assert(configurationUi.markup.includes("Tu bot ya está atendiendo. Ahora afínalo."));
assert(configurationUi.markup.includes('href="/admin/client-onboarding?edit=1"'));
assert(configurationUi.markup.includes("El cuestionario que llenaste en el setup"));
assert(configurationUi.markup.includes("Guardar y aplicar cambios"));
assert(configurationUi.markup.includes("siguiente respuesta del bot"));
assert(configurationUi.styles.includes("@media(max-width:860px)"));
assert(configurationUi.clientScript.includes('["shipping","Datos para un envío","Con Aura o Atlas"]'));
assert(configurationUi.clientScript.includes('["reminders","Recordatorio de cita o reserva","Con Tempo o Atlas"]'));
assert(configurationUi.clientScript.includes('["appointment_requirements","Datos para confirmar una cita","Con Tempo o Atlas"]'));
assert(configurationUi.clientScript.includes('/admin/panel/appointment-settings'));
assert(configurationUi.clientScript.includes('booking_requirements:state.nxAppointmentRequirements,deposit_policy:state.nxAppointmentDepositPolicy'));
assert(configurationUi.clientScript.includes('PANEL_CONTEXT.appointments'));
assert(configurationUi.clientScript.includes('Nombre completo'));
assert(configurationUi.clientScript.includes('Documento de identidad'));
assert(configurationUi.clientScript.includes('Pregunta personalizada'));
assert(configurationUi.clientScript.includes('Obligatorio'));
assert(configurationUi.clientScript.includes('Opcional'));
assert(configurationUi.clientScript.includes('¿Tu negocio requiere un anticipo?'));
assert(configurationUi.clientScript.includes('Transferencia bancaria'));
assert(configurationUi.clientScript.includes('Link de pago'));
assert(configurationUi.clientScript.includes('nxToggleAppointmentDeposit'));
assert(configurationUi.clientScript.includes("¿Cómo cobras el envío?"));
assert(configurationUi.clientScript.includes("shipping.flat_fee_cop"));
assert(configurationUi.clientScript.includes("shipping.free_over_cop"));
assert(configurationUi.clientScript.includes("shipping.policy"));
assert(configurationUi.clientScript.includes("nxSetShippingMode"));
assert(configurationUi.clientScript.includes("nxConfigSaveSequence+=1"));
assert(configurationUi.clientScript.includes("result.applied!==true"));
assert(configurationUi.clientScript.includes("Cambios aplicados al bot"));
assert(configurationUi.clientScript.includes('typeof payload.can_edit==="boolean"'));
assert(configurationUi.clientScript.includes("nxSelectLogoFile"));
assert(configurationUi.clientScript.includes("preparePanelImage(file)"));
assert(configurationUi.clientScript.includes("Descripción pública en WhatsApp"));
assert(configurationUi.clientScript.includes("La dirección también se publica"));
assert(configurationUi.clientScript.includes("Verificando perfil en WhatsApp"));
assert(!configurationUi.clientScript.includes("URL del logo o imagen"));
new Function(configurationUi.clientScript);

function render(role, tenant) {
  let html = "";
  const res = {
    status() { return this; },
    setHeader() { return this; },
    send(value) { html = String(value); return this; }
  };
  renderCustomerPanel(res, {
    auth: { name: "QA", role },
    capabilities: {},
    initialTab: "setup",
    botVersion: "v-config-test",
    tenantContext: tenant
  });
  return html;
}

const auraHtml = render("admin", {
  id: "tenant-a",
  company_name: "Empresa A",
  plan_id: "nextfor-aura",
  assigned_bot_id: "atencion-cliente"
});
assert(auraHtml.includes("Tu bot ya está atendiendo. Ahora afínalo."));
assert(auraHtml.includes('PANEL_PERSONALITY_PATH="/admin/panel/bot-personality"'));
assert(auraHtml.includes('PANEL_ACCOUNT_PATH="/admin/panel/account-profile"'));
assert(auraHtml.includes("Administrador de la cuenta"));
assert(auraHtml.includes("Celular de contacto"));
assert(auraHtml.includes("Cambiar contraseña"));
assert(auraHtml.includes("preparePanelImage"));
assert(auraHtml.includes("new FileReader()"));
assert(auraHtml.includes("reader.readAsDataURL(file)"));
assert(!auraHtml.includes("URL.createObjectURL(file)"));
assert(auraHtml.includes('canvas.toDataURL("image/jpeg"'));
assert(auraHtml.includes("/whatsapp-profile-sync"));
assert(auraHtml.includes("Bot y WhatsApp actualizados"));
assert(auraHtml.includes("Bot aplicado · actualiza el perfil en WhatsApp Business"));
assert(auraHtml.includes("Herramientas para la empresa → Perfil de empresa"));
assert(auraHtml.includes('sync.status==="manual_app_required"'));
assert(auraHtml.includes("Bot aplicado · WhatsApp no actualizado"));
assert(auraHtml.includes("loadBotSetup();loadBotPersonality(false)"));
assert(auraHtml.includes("Versión v-config-test"));
assert(!auraHtml.includes(">RAV Toys<"));

const tempoHtml = render("admin", {
  id: "tenant-tempo",
  company_name: "Empresa Tempo",
  plan_id: "nextfor-tempo",
  assigned_bot_id: "agendamiento"
});
assert(tempoHtml.includes("Datos para confirmar una cita"));
assert(tempoHtml.includes('/admin/panel/appointment-settings'));

const viewerHtml = render("viewer", {
  id: "tenant-b",
  company_name: "Empresa B",
  plan_id: "nextfor-uno",
  assigned_bot_id: "atencion-cliente"
});
assert(viewerHtml.includes("Empresa B"));
assert(viewerHtml.includes("nxApplyEditPermissions"));

console.log("customer-bot-configuration.test.js ok");
