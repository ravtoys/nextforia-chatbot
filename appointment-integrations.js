"use strict";

function cleanText(value, max) {
  return String(value == null ? "" : value).replace(/\u0000/g, "").trim().slice(0, max || 1000);
}

function cleanTenantId(value) {
  return cleanText(value, 120).toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(value, 240).toLowerCase());
}

function parseAppointmentCalendarTenantMap(env) {
  const raw = cleanText(env && env.APPOINTMENT_CALENDAR_TENANT_MAP, 20000);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const result = {};
    Object.keys(parsed || {}).forEach(function (tenantId) {
      const cleanTenant = cleanTenantId(tenantId);
      const row = parsed[tenantId] && typeof parsed[tenantId] === "object" ? parsed[tenantId] : {};
      if (!cleanTenant) return;
      result[cleanTenant] = {
        provider: cleanText(row.provider || row.id || "google", 80).toLowerCase(),
        status: cleanText(row.status || "connected", 80).toLowerCase(),
        calendar_email: cleanText(row.calendar_email || row.email, 180).toLowerCase(),
        calendar_id_present: !!(row.calendar_id || row.calendarId)
      };
    });
    return result;
  } catch (_) {
    return {};
  }
}

function calendarProviderLabel(provider) {
  const labels = {
    google: "Google Calendar",
    google_calendar: "Google Calendar",
    microsoft: "Microsoft Outlook",
    microsoft_calendar: "Microsoft Outlook",
    outlook: "Outlook Calendar",
    samsung: "Samsung Calendar",
    calendly: "Calendly",
    calcom: "Cal.com",
    cal_com: "Cal.com",
    internal: "Calendario interno",
    other: "Otro calendario",
    none: "Sin calendario"
  };
  return labels[provider] || (provider ? provider : "Calendario");
}

function buildAppointmentIntegrations(record, tenantId, options) {
  options = options || {};
  const cleanTenant = cleanTenantId(tenantId || record && record.tenant_id);
  const answers = record && record.answers || {};
  const appointment = answers.appointment_setup || {};
  const meta = answers.meta || {};
  const business = answers.business || {};
  const team = answers.team || {};
  const setupGoal = cleanText(answers.setup_goal, 40);
  const selected = setupGoal === "appointments" || setupGoal === "both";
  const setupCompleted = !!(record && record.setup_completed);
  const reviewStatus = cleanText(record && record.setup_review && record.setup_review.status, 40) || (setupCompleted ? "ready" : "incomplete");
  const agentTenantMap = options.agentTenantMap || {};
  const externalAgentId = cleanText(record && record.appointment_configuration && record.appointment_configuration.external_agent_id, 160);
  const agentMapped = !!externalAgentId || Object.keys(agentTenantMap).some(function (agentId) {
    return cleanTenantId(agentTenantMap[agentId]) === cleanTenant;
  });
  const webhookReady = !!options.elevenlabsWebhookSecret;
  const elevenLabsApiReady = !!options.elevenlabsApiKey;
  const templateReady = !!options.elevenlabsTemplateAgentId;
  const appointmentToolSecretReady = cleanText(options.elevenlabsAppointmentToolSecret, 4096).length >= 32;
  const appointmentToolBaseUrlReady = /^https:\/\//.test(cleanText(options.elevenlabsAppointmentToolBaseUrl, 500));
  const agentWriteEnabled = options.elevenlabsAgentWriteEnabled === true;
  const provisioningReady = elevenLabsApiReady && templateReady && appointmentToolSecretReady &&
    appointmentToolBaseUrlReady && agentWriteEnabled;
  const agentConfigured = options.elevenlabsAgentConfigured === true;
  const phoneNumberMapped = options.elevenlabsPhoneNumberMapped === true;
  const phoneNumberAutoAssignable = options.elevenlabsPhoneAutoAssignmentEnabled === true;
  const phoneNumberConfigured = options.elevenlabsPhoneNumberConfigured === true;
  const publicPhoneNumber = cleanText(
    record && record.appointment_configuration && record.appointment_configuration.external_phone_number,
    40
  );
  const phoneProvider = cleanText(
    record && record.appointment_configuration && record.appointment_configuration.external_phone_provider,
    40
  );
  const voiceRequested = !!(answers.channels && answers.channels.phone_calls) ||
    appointment.calls_enabled === true ||
    appointment.calls_enabled === "yes" ||
    appointment.phone_calls === true;
  const calendarProvider = cleanText(appointment.calendar_provider || "", 80).toLowerCase();
  const normalizedProvider = calendarProvider === "google_calendar"
    ? "google"
    : ["microsoft_calendar", "outlook"].includes(calendarProvider)
      ? "microsoft"
      : calendarProvider;
  const calendarEmail = cleanText(appointment.calendar_email || "", 180).toLowerCase();
  const calendarMap = options.calendarTenantMap || {};
  const calendarConnection = calendarMap[cleanTenant] || null;
  const liveCalendarConnection = options.calendarConnection || null;
  const calendarOAuthProviders = options.calendarOAuthProviders || {
    google: !!options.googleCalendarOAuthConfigured,
    microsoft: !!options.microsoftCalendarOAuthConfigured
  };
  const liveCalendarSurface = liveCalendarConnection && liveCalendarConnection.surface === "samsung" ? "samsung" : "direct";
  const liveCalendarConnected = !!(liveCalendarConnection && liveCalendarConnection.status === "connected");
  const selectedOAuthProvider = liveCalendarConnection && liveCalendarConnection.provider || normalizedProvider || "google";
  const visibleCalendarProvider = liveCalendarSurface === "samsung"
    ? "samsung"
    : normalizedProvider || liveCalendarConnection && liveCalendarConnection.provider || "";
  const calendarOAuthConfigured = calendarOAuthProviders[selectedOAuthProvider] === true;
  let calendarStatus = "needs_provider";
  if (options.calendarConnected || liveCalendarConnected) calendarStatus = "ready";
  else if (calendarConnection && calendarConnection.status === "connected") calendarStatus = "ready";
  else if (["none", ""].includes(normalizedProvider)) calendarStatus = "needs_provider";
  else if (["google", "microsoft"].includes(normalizedProvider) && calendarOAuthConfigured) calendarStatus = "needs_customer_connection";
  else if (["google", "microsoft"].includes(normalizedProvider)) calendarStatus = "oauth_not_configured";
  else calendarStatus = "manual_connection_required";

  const appointmentWhatsappEnabled = appointment.appointment_whatsapp_enabled === true ||
    appointment.reminder_channel === "whatsapp" ||
    !!appointment.appointment_whatsapp_number ||
    (!!meta.whatsapp_number && meta.whatsapp_integration_intent !== "no");
  const appointmentWhatsappNumber = cleanText(appointment.appointment_whatsapp_number || meta.whatsapp_number, 40);
  const tenantMetaConnected = !!options.whatsappConnected;
  let whatsappStatus = "disabled";
  if (appointmentWhatsappEnabled && !appointmentWhatsappNumber) whatsappStatus = "needs_number";
  else if (appointmentWhatsappEnabled && tenantMetaConnected) whatsappStatus = "ready";
  else if (appointmentWhatsappEnabled && options.metaOAuthReady) whatsappStatus = "needs_customer_connection";
  else if (appointmentWhatsappEnabled) whatsappStatus = "oauth_not_configured";

  const appointmentEmailEnabled = !!appointment.appointment_email_enabled;
  const appointmentEmail = cleanText(appointment.appointment_email || business.contact_email || team.admin_email, 180).toLowerCase();
  let emailStatus = "optional";
  if (appointmentEmailEnabled && isEmail(appointmentEmail)) emailStatus = "ready";
  else if (appointmentEmailEnabled) emailStatus = "needs_email";

  let callsStatus = "not_requested";
  if (voiceRequested && agentMapped && webhookReady && agentConfigured && phoneNumberMapped && phoneNumberConfigured) callsStatus = "ready";
  else if (voiceRequested && agentMapped && webhookReady && agentConfigured && phoneNumberMapped && !phoneNumberConfigured) callsStatus = "needs_phone_assignment";
  else if (voiceRequested && agentMapped && webhookReady && agentConfigured && phoneNumberAutoAssignable) callsStatus = "needs_phone_assignment";
  else if (voiceRequested && agentMapped && webhookReady && agentConfigured && !phoneNumberMapped) callsStatus = "needs_phone_number";
  else if (voiceRequested && agentMapped && webhookReady && !agentConfigured) callsStatus = "needs_configuration";
  else if (voiceRequested && !agentMapped) callsStatus = "needs_agent";
  else if (voiceRequested && !webhookReady) callsStatus = "needs_webhook";

  const botStatus = agentMapped && webhookReady && agentConfigured ? "ready" : agentMapped && webhookReady ? "needs_configuration" : agentMapped ? "needs_webhook" : "needs_agent";
  const persistenceStatus = options.supabaseAppointmentsEnabled ? "ready" : "not_configured";
  const blockers = [];
  if (!selected) blockers.push("appointment_not_selected");
  if (selected && !setupCompleted) blockers.push("setup_not_completed");
  if (selected && !["testing", "live"].includes(reviewStatus)) blockers.push("appointment_not_in_testing");
  if (selected && botStatus !== "ready") blockers.push(botStatus === "needs_configuration" ? "elevenlabs_agent_not_configured" : botStatus === "needs_webhook" ? "elevenlabs_webhook_not_ready" : "elevenlabs_agent_not_mapped");
  if (selected && !elevenLabsApiReady) blockers.push("elevenlabs_api_key_missing");
  if (selected && !templateReady) blockers.push("elevenlabs_template_agent_missing");
  if (selected && !appointmentToolSecretReady) blockers.push("elevenlabs_appointment_tool_secret_missing");
  if (selected && !appointmentToolBaseUrlReady) blockers.push("elevenlabs_appointment_tool_url_missing");
  if (selected && !agentWriteEnabled) blockers.push("elevenlabs_agent_write_disabled");
  if (selected && calendarStatus !== "ready") blockers.push("calendar_not_connected");
  if (selected && appointmentWhatsappEnabled && whatsappStatus !== "ready") blockers.push("whatsapp_not_connected");
  if (selected && appointmentEmailEnabled && emailStatus !== "ready") blockers.push("email_not_ready");
  if (selected && voiceRequested && callsStatus !== "ready") blockers.push("calls_not_ready");
  if (selected && persistenceStatus !== "ready") blockers.push("appointments_persistence_not_ready");

  return {
    tenant_id: cleanTenant,
    selected,
    setup_completed: setupCompleted,
    review_status: reviewStatus,
    ready_for_testing: selected && setupCompleted && ["testing", "live"].includes(reviewStatus) && botStatus === "ready",
    ready_for_live: selected && blockers.length === 0,
    blockers: Array.from(new Set(blockers)),
    bot: {
      provider: "elevenlabs",
      status: botStatus,
      agent_mapped: agentMapped,
      webhook_ready: webhookReady,
      api_ready: elevenLabsApiReady,
      agent_configured: agentConfigured,
      provisioning_ready: provisioningReady,
      template_ready: templateReady,
      appointment_tool_secret_ready: appointmentToolSecretReady,
      appointment_tool_base_url_ready: appointmentToolBaseUrlReady,
      write_enabled: agentWriteEnabled
    },
    calendar: {
      provider: visibleCalendarProvider,
      label: calendarProviderLabel(visibleCalendarProvider),
      email: calendarEmail || cleanText(liveCalendarConnection && (liveCalendarConnection.account_email || liveCalendarConnection.calendar_summary), 180).toLowerCase(),
      status: calendarStatus,
      oauth_configured: calendarOAuthConfigured,
      connected: calendarStatus === "ready",
      account_label: cleanText(liveCalendarConnection && liveCalendarConnection.account_label, 240),
      calendar_id_present: !!(liveCalendarConnection && liveCalendarConnection.calendar_id) || !!(calendarConnection && calendarConnection.calendar_id_present)
    },
    whatsapp: { enabled: appointmentWhatsappEnabled, number: appointmentWhatsappNumber, shared_meta: true, tenant_connected: tenantMetaConnected, status: whatsappStatus },
    email: { enabled: appointmentEmailEnabled, address: appointmentEmail, status: emailStatus },
    calls: {
      requested: voiceRequested,
      enabled: callsStatus === "ready",
      readonly: true,
      status: callsStatus,
      phone_number_mapped: phoneNumberMapped,
      phone_number_auto_assignable: phoneNumberAutoAssignable,
      phone_number_configured: phoneNumberConfigured,
      number: publicPhoneNumber,
      provider: phoneProvider,
      label: callsStatus === "ready" ? "Llamadas listas para este tenant" : voiceRequested ? "Falta conectar voz para este tenant" : "No solicitadas por el cliente"
    },
    persistence: { provider: "supabase", status: persistenceStatus }
  };
}

module.exports = {
  buildAppointmentIntegrations,
  calendarProviderLabel,
  parseAppointmentCalendarTenantMap
};
