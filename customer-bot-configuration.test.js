"use strict";

const assert = require("assert");
const configurationUi = require("./customer-bot-configuration");
const renderCustomerPanel = require("./customer-panel");

assert(configurationUi.markup.includes("Tu bot ya está atendiendo. Ahora afínalo."));
assert(configurationUi.markup.includes('href="/admin/client-onboarding/edit"'));
assert(configurationUi.markup.includes("El cuestionario que llenaste en el setup"));
assert(configurationUi.markup.includes("Guardar y aplicar cambios"));
assert(configurationUi.markup.includes("siguiente respuesta del bot"));
assert(configurationUi.styles.includes("@media(max-width:860px)"));
assert(configurationUi.clientScript.includes('["shipping","Datos para un envío","Con Aura o Atlas"]'));
assert(configurationUi.clientScript.includes('["reminders","Recordatorio de cita o reserva","Con Tempo o Atlas"]'));
assert(configurationUi.clientScript.includes('["appointment_requirements","Datos para confirmar una cita","Con Tempo o Atlas"]'));
assert(configurationUi.clientScript.includes('["appointment_services","Servicios y reglas","Con Tempo o Atlas"]'));
assert(configurationUi.clientScript.includes("Descripción del servicio"));
assert(configurationUi.clientScript.includes("nxAttachAppointmentServiceDescriptions"));
assert(configurationUi.clientScript.includes('/admin/panel/appointment-settings'));
assert(configurationUi.clientScript.includes('booking_requirements:state.nxAppointmentRequirements,appointment_services:state.nxAppointmentServices'));
assert(configurationUi.clientScript.includes('nxAppointmentServicesBody'));
assert(configurationUi.clientScript.includes('data-nx-service-field'));
assert(configurationUi.clientScript.includes('data-nx-service-deposit'));
assert(configurationUi.clientScript.includes('data-nx-service-method-instructions'));
assert(!configurationUi.clientScript.includes('data-nx-appt-content="services"'));
assert(!configurationUi.clientScript.includes('nxAppointmentServicesRulesBody'));
assert(configurationUi.clientScript.includes('PANEL_CONTEXT.appointments'));
assert(configurationUi.clientScript.includes('Nombre completo'));
assert(configurationUi.clientScript.includes('Documento de identidad'));
assert(configurationUi.clientScript.includes('Pregunta personalizada'));
assert(configurationUi.clientScript.includes('Obligatorio'));
assert(configurationUi.clientScript.includes('Opcional'));
assert(configurationUi.clientScript.includes('¿Pides anticipo para este servicio?'));
assert(configurationUi.clientScript.includes('Transferencia bancaria'));
assert(configurationUi.clientScript.includes('Link de pago'));
assert(configurationUi.clientScript.includes('nxToggleAppointmentServiceDeposit'));
assert(configurationUi.clientScript.includes("¿Cómo cobras el envío?"));
assert(configurationUi.clientScript.includes("+ Agregar método de pago"));
assert(configurationUi.clientScript.includes("data-nx-payment-instructions"));
assert(configurationUi.clientScript.includes("nxTogglePaymentMethod"));
assert(!configurationUi.clientScript.includes("NX_PAYMENT_LABELS"));
assert(configurationUi.clientScript.includes("nxApplyCredentialAutocompleteGuards"));
assert(configurationUi.clientScript.includes('data-bwignore="true"'));
assert(configurationUi.clientScript.includes("nxConfigInputAttributes"));
assert(configurationUi.styles.includes(".nxAccordionIcon svg{width:1em;height:1em;display:block}"));
for (const iconPath of [
  "M5 3.5h14A1.5 1.5 0 0 1 20.5 5v14",
  "M20.5 14.5a2 2 0 0 1-2 2H8l-4 3.5V5",
  "M3.2 9.5 5.2 4.5h13.6l2 5",
  "M12 2.8 20.4 7v10L12 21.2 3.6 17V7",
  "M6.2 10a5.8 5.8 0 0 1 11.6 0",
  "M12.6 2.6A2 2 0 0 0 11.2 2H4.4",
  "M13.2 17.5H4.5a2 2 0 0 1-2-2v-7",
  "M9.7 7.9a2.6 2.6 0 0 1 5 .9c0 1.7-2.4 2-2.4 3.4",
  "M8.6 11.6a3.6 3.6 0 1 0 0-7.2",
  "M9.2 11.5V6.3a1.6 1.6 0 0 1 3.2 0v5.2",
  "M15 14c.2-1 .7-1.8 1.5-2.5"
]) assert(configurationUi.clientScript.includes(iconPath));
assert(configurationUi.clientScript.includes("shipping.flat_fee_cop"));
assert(configurationUi.clientScript.includes("shipping.free_over_cop"));
assert(configurationUi.clientScript.includes("shipping.policy"));
assert(configurationUi.clientScript.includes("nxSetShippingMode"));
assert(configurationUi.clientScript.includes("nxConfigSaveSequence+=1"));
assert(configurationUi.clientScript.includes("result.applied!==true"));
assert(configurationUi.clientScript.includes("Cambios aplicados al bot"));
assert(configurationUi.clientScript.includes('typeof payload.can_edit==="boolean"'));
assert(configurationUi.clientScript.includes('payload&&typeof payload.can_edit==="boolean"?payload.can_edit:state.personalityCanEdit===true'));
assert(configurationUi.clientScript.includes('document.addEventListener("click",function(event){var target=event.target'));
assert(configurationUi.clientScript.includes('Escribe la instrucción primero o activa el método'));
assert(configurationUi.clientScript.includes('document.addEventListener("pointerdown",function(event){var control='));
assert(configurationUi.clientScript.includes('function nxAppointmentBusinessAttrs(name,kind)'));
assert(configurationUi.clientScript.includes('transaction-amount'));
assert(configurationUi.clientScript.includes('nextfor_appointment_service_'));
assert(configurationUi.clientScript.includes('data-protonpass-ignore'));
assert(configurationUi.clientScript.includes('nxServiceDepositCheckbox'));
assert(configurationUi.clientScript.includes('nxUpgradeAppointmentDepositControls'));
assert(configurationUi.clientScript.includes('nxSetAppointmentServiceDepositFromCheckbox'));
assert(configurationUi.clientScript.includes('nxSyncAppointmentServiceDepositFields'));
assert(configurationUi.clientScript.includes('amountTitle.textContent=percentage?"Anticipo (%)":"Anticipo (COP)"'));
assert(configurationUi.clientScript.includes('row.insertAdjacentElement("afterend",modeLabel)'));
assert(configurationUi.clientScript.includes('serviceField.getAttribute("data-nx-service-field")'));
assert(configurationUi.clientScript.includes('fieldName+"_instructions"'));
assert(configurationUi.clientScript.includes('method.type==="cash"'));
assert(configurationUi.clientScript.includes('data-nx-service-id'));
assert(configurationUi.clientScript.includes('function nxAppointmentServiceError()'));
assert(configurationUi.clientScript.includes('nxAppointmentRequirementsSaveQueued'));
assert(configurationUi.clientScript.includes('Guardaremos el último cambio en seguida…'));
assert(configurationUi.clientScript.includes('Aún no hay servicios guardados.'));
assert(configurationUi.clientScript.includes('indica una duración de al menos 5 minutos'));
assert(configurationUi.clientScript.includes('Pregunta personalizada'));
assert(configurationUi.clientScript.includes('+ Añadir otra pregunta'));
assert(configurationUi.clientScript.includes('nxAddAppointmentRequirement()'));
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
assert(tempoHtml.includes("Servicios y reglas"));
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
