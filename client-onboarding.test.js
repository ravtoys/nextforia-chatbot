"use strict";

const assert = require("assert");
const {
  APPOINTMENT_DEPLOYMENT_INSTRUCTIONS,
  CUSTOMER_SETUP_QUESTIONS,
  CUSTOMER_SERVICE_DEPLOYMENT_INSTRUCTIONS,
  SETUP_REVIEW_STATUSES,
  buildAppointmentSystemPrompt,
  buildCustomerServiceSystemPrompt,
  buildCoverageConversationContext,
  cloneDefaults,
  createOnboardingRecord,
  generateAppointmentConfiguration,
  generateCustomerServiceConfiguration,
  normalizeAppointmentConfiguration,
  normalizeCustomerServiceConfiguration,
  mergeCustomerSetupQuestionnaireHistory,
  normalizeCustomerSetupQuestionnaire,
  normalizeOnboarding,
  onboardingCompletion,
  pendingQuestionnaireItems
} = require("./client-onboarding");

assert.strictEqual(onboardingCompletion(cloneDefaults()), 0);
assert.deepStrictEqual(
  CUSTOMER_SETUP_QUESTIONS.map(function (question) { return question.order; }),
  CUSTOMER_SETUP_QUESTIONS.map(function (question) { return question.order; }).slice().sort(function (a, b) { return a - b; })
);
assert.strictEqual(new Set(CUSTOMER_SETUP_QUESTIONS.map(function (question) { return question.id; })).size, CUSTOMER_SETUP_QUESTIONS.length);
assert(CUSTOMER_SETUP_QUESTIONS.every(function (question) { return question.path && question.type; }));
assert(CUSTOMER_SETUP_QUESTIONS.some(function (question) { return question.id === "whatsapp_integration_intent" && question.active === false && question.required === false; }));
assert(CUSTOMER_SETUP_QUESTIONS.some(function (question) {
  return question.id === "appointment_calls_enabled" &&
    question.path === "appointment_setup.calls_enabled" &&
    question.active === true &&
    question.required === false;
}));
assert.deepStrictEqual(SETUP_REVIEW_STATUSES, ["incomplete", "ready", "building", "testing", "live"]);

const normalized = normalizeOnboarding({
  setup_goal: "customer_service",
  business: { brand_name: "  Tienda Piloto  ", contact_email: "ADMIN@EXAMPLE.COM" },
  meta: { number_status: "invalid", whatsapp_integration_intent: "yes" },
  channels: { instagram: true, other: true, other_details: "Marketplace" },
  commerce: {
    platform: "other",
    other_platform: "Sistema propio",
    orders_required: false,
    shopify_pairing_expires_at: "2026-07-28T18:00:00.000Z",
    shopify_pairing_bot_id: "atencion-cliente"
  },
  confirmations: { owns_information: true }
});
assert.strictEqual(normalized.business.brand_name, "Tienda Piloto");
assert.strictEqual(normalized.business.contact_email, "admin@example.com");
assert.strictEqual(normalized.meta.number_status, "unknown");
assert.strictEqual(normalized.meta.whatsapp_integration_intent, "yes");
assert.strictEqual(normalized.meta.whatsapp_integration_status, "requested");
assert.strictEqual(normalized.channels.instagram, true);
assert.strictEqual(normalized.channels.other_details, "Marketplace");
assert.strictEqual(normalized.commerce.other_platform, "Sistema propio");
assert.strictEqual(normalized.commerce.orders_required, false);
assert.strictEqual(normalized.commerce.shopify_pairing_expires_at, "2026-07-28T18:00:00.000Z");
assert.strictEqual(normalized.commerce.shopify_pairing_bot_id, "atencion-cliente");
assert.strictEqual(normalized.confirmations.owns_information, true);

const normalizedAppointmentCalls = normalizeOnboarding({
  setup_goal: "appointments",
  appointment_setup: { calls_enabled: "yes" }
});
assert.strictEqual(normalizedAppointmentCalls.appointment_setup.calls_enabled, "yes");
assert.strictEqual(normalizedAppointmentCalls.channels.phone_calls, true);

const normalizedAppointmentCallsDisabled = normalizeOnboarding({
  setup_goal: "appointments",
  channels: { phone_calls: true },
  appointment_setup: { calls_enabled: "no" }
});
assert.strictEqual(normalizedAppointmentCallsDisabled.appointment_setup.calls_enabled, "no");
assert.strictEqual(normalizedAppointmentCallsDisabled.channels.phone_calls, false);

const record = createOnboardingRecord(normalized, { tenant_id: "pilot-2", status: "submitted", updated_by: "Admin" });
assert.strictEqual(record.version, 2);
assert.strictEqual(record.tenant_id, "pilot-2");
assert.strictEqual(record.status, "submitted");
assert.ok(record.completion > 0 && record.completion < 100);
assert.strictEqual(record.setup_completed, false);
assert.strictEqual(record.setup_completed_at, null);
assert.ok(record.last_updated_at);

const completedAnswers = cloneDefaults();
completedAnswers.business.brand_name = "Empresa Completa";
completedAnswers.setup_goal = "customer_service";
completedAnswers.operations.primary_country = "Colombia";
completedAnswers.operations.primary_city = "Bogotá";
completedAnswers.operations.monthly_customer_volume = "300";
completedAnswers.business.contact_email = "admin@completa.example";
completedAnswers.business.contact_phone = "+57 300 000 0000";
completedAnswers.meta.whatsapp_number = "+57 300 000 0000";
completedAnswers.meta.whatsapp_integration_intent = "yes";
completedAnswers.operations.support_hours = "Lunes a viernes";
completedAnswers.customer_service_setup.business_offer_type = "products";
completedAnswers.customer_service_setup.business_offer_description = "Juguetes educativos y regalos";
completedAnswers.customer_service_setup.ideal_customer = "Familias que buscan regalos";
completedAnswers.customer_service_setup.value_proposition = "Curaduría y asesoría rápida";
completedAnswers.customer_service_setup.bot_display_name = "Nextfor de Empresa Completa";
completedAnswers.customer_service_setup.tone = "vendedor_dinamico";
completedAnswers.customer_service_setup.brand_restrictions = "No inventar precios ni descuentos";
completedAnswers.customer_service_setup.data_consent = true;
completedAnswers.commerce.platform = "shopify";
completedAnswers.commerce.store_url = "https://empresa-completa.myshopify.com";
completedAnswers.commerce.catalog_ready = "yes";
completedAnswers.commerce.orders_required = true;
completedAnswers.commerce.access_owner = "admin@completa.example";
completedAnswers.commerce.integration_intent = "yes";
completedAnswers.operations.services_products = "Servicios";
completedAnswers.operations.frequent_questions = "Preguntas y respuestas";
completedAnswers.operations.important_policies = "Políticas";
completedAnswers.operations.bot_instructions = "Responder con claridad";
completedAnswers.team.admin_email = "admin@completa.example";
completedAnswers.team.human_support_contact = "Soporte +57 300 000 0000";
assert.strictEqual(onboardingCompletion(completedAnswers), 100);
const missingCommerceUrl = JSON.parse(JSON.stringify(completedAnswers));
missingCommerceUrl.commerce.store_url = "";
assert(onboardingCompletion(missingCommerceUrl) < 100, "Shopify requiere URL de tienda");
const noStoreAnswers = JSON.parse(JSON.stringify(completedAnswers));
noStoreAnswers.commerce.platform = "none";
noStoreAnswers.commerce.store_url = "";
noStoreAnswers.commerce.integration_intent = "no";
noStoreAnswers.commerce.orders_required = false;
assert.strictEqual(onboardingCompletion(noStoreAnswers), 100, "un negocio sin tienda puede completar Customer Service");
const completedRecord = createOnboardingRecord(completedAnswers, { tenant_id: "completa", status: "completed" });
assert.strictEqual(completedRecord.setup_completed, true);
assert.strictEqual(completedRecord.setup_review.status, "ready");
assert.strictEqual(completedRecord.answers.customer_service_setup.setup_status, "pending_review");
assert.ok(completedRecord.setup_completed_at);
const changesRequestedRecord = createOnboardingRecord(completedAnswers, {
  tenant_id: "completa",
  status: "completed",
  previous: completedRecord,
  review_status: "incomplete",
  requested_changes: "Completar políticas de garantía y horario de soporte.",
  review_actor: "ventas@ravtoys.com",
  review_event: { action: "request_changes", note: "Faltan políticas." }
});
assert.strictEqual(changesRequestedRecord.setup_review.status, "incomplete");
assert.strictEqual(changesRequestedRecord.setup_review.requested_changes, "Completar políticas de garantía y horario de soporte.");
assert.strictEqual(changesRequestedRecord.setup_review.updated_by, "ventas@ravtoys.com");
assert.strictEqual(changesRequestedRecord.setup_review.history.length, 1);
assert.strictEqual(changesRequestedRecord.setup_review.history[0].action, "request_changes");
assert.strictEqual(changesRequestedRecord.answers.customer_service_setup.setup_status, "changes_requested");
const approvedRecord = createOnboardingRecord(changesRequestedRecord.answers, {
  tenant_id: "completa",
  status: "completed",
  previous: changesRequestedRecord,
  review_status: "ready",
  approve_setup: true,
  review_actor: "ventas@ravtoys.com",
  review_event: { action: "approve", note: "Setup aprobado." }
});
assert.strictEqual(approvedRecord.setup_review.status, "ready");
assert.strictEqual(approvedRecord.setup_review.history.length, 2);
assert.strictEqual(approvedRecord.answers.customer_service_setup.setup_status, "approved");
const mixedAnswers = JSON.parse(JSON.stringify(completedAnswers));
mixedAnswers.setup_goal = "both";
mixedAnswers.appointment_setup.business_name = "APPOINTMENT-SECRET-MARKER";
mixedAnswers.appointment_setup.allowed_topics = "APPOINTMENT-ONLY-RULE";
const generatedConfiguration = generateCustomerServiceConfiguration(mixedAnswers, {
  actor: "root@nextforia.com",
  source_setup_updated_at: approvedRecord.updated_at,
  now: "2026-07-25T12:00:00.000Z"
});
assert.strictEqual(generatedConfiguration.bot_type, "customer_service");
assert.strictEqual(generatedConfiguration.lifecycle, "draft");
assert.strictEqual(generatedConfiguration.source_record, "client-onboarding");
assert.strictEqual(generatedConfiguration.commerce_platform, "shopify");
assert.strictEqual(generatedConfiguration.commerce_integration_status, "requested");
assert.match(generatedConfiguration.system_prompt, /empresa-completa\.myshopify\.com/);
assert.match(generatedConfiguration.system_prompt, /No gestiones citas/);
assert.match(generatedConfiguration.system_prompt, /Empresa Completa/);
assert.match(generatedConfiguration.deployment_instructions, /Venta con y sin envío/);
assert.match(generatedConfiguration.deployment_instructions, /setup_goal = both/);
assert.doesNotMatch(generatedConfiguration.deployment_instructions, /RAV Toys/);
assert.match(generatedConfiguration.system_prompt, /DESPLIEGUE Y QA/);
assert.match(generatedConfiguration.system_prompt, /Crear respaldo de la base de datos/);
assert.strictEqual(CUSTOMER_SERVICE_DEPLOYMENT_INSTRUCTIONS, generatedConfiguration.deployment_instructions);
assert.doesNotMatch(JSON.stringify(generatedConfiguration), /APPOINTMENT-SECRET-MARKER/);
assert.doesNotMatch(JSON.stringify(generatedConfiguration), /APPOINTMENT-ONLY-RULE/);
const dercoAppointmentAnswers = cloneDefaults();
dercoAppointmentAnswers.setup_goal = "appointments";
dercoAppointmentAnswers.business.brand_name = "Grupo Derco";
dercoAppointmentAnswers.operations.monthly_customer_volume = "300";
dercoAppointmentAnswers.operations.bot_instructions = "No prometer resultados jurídicos.";
dercoAppointmentAnswers.customer_service_setup.business_offer_description = "CUSTOMER-SERVICE-ONLY-MARKER";
dercoAppointmentAnswers.appointment_setup.business_name = "Grupo Derco";
dercoAppointmentAnswers.appointment_setup.business_category = "legal";
dercoAppointmentAnswers.appointment_setup.target_customer = "Clientes que necesitan asesoría jurídica.";
dercoAppointmentAnswers.appointment_setup.business_description = "Firma jurídica para consultas.";
dercoAppointmentAnswers.appointment_setup.assistant_tone = "Profesional y cálido";
dercoAppointmentAnswers.appointment_setup.bot_display_name = "Luciana";
dercoAppointmentAnswers.appointment_setup.allowed_topics = "Agendar consultas jurídicas.";
dercoAppointmentAnswers.appointment_setup.forbidden_topics = "No dar asesoría legal definitiva.";
dercoAppointmentAnswers.appointment_setup.escalation_triggers = "Casos urgentes o riesgosos.";
dercoAppointmentAnswers.appointment_setup.escalation_contact = "Coordinación DERCO";
dercoAppointmentAnswers.appointment_setup.services = "Consulta inicial, revisión documental.";
dercoAppointmentAnswers.appointment_setup.appointment_services = [{ id: "consulta_inicial", name: "Consulta inicial", duration_minutes: 45, price_cop: 0, modality: "in_person", address: "Sede principal" }];
dercoAppointmentAnswers.appointment_setup.business_hours = "Lunes a viernes 8am a 5pm.";
dercoAppointmentAnswers.appointment_setup.staff_mode = "Por especialista asignado.";
dercoAppointmentAnswers.appointment_setup.appointment_locations = "Virtual y presencial.";
dercoAppointmentAnswers.appointment_setup.availability_rules = "Agenda según Google Calendar.";
dercoAppointmentAnswers.appointment_setup.required_booking_fields = "Nombre, teléfono, correo, motivo.";
dercoAppointmentAnswers.appointment_setup.booking_requirements = [
  { id: "full_name", type: "full_name", label: "Nombre completo", active: true, required: true },
  { id: "case_reference", type: "custom", label: "Número de caso", question: "¿Cuál es tu número de caso?", active: true, required: false }
];
dercoAppointmentAnswers.appointment_setup.booking_confirmation_mode = "Confirmar con el cliente antes de crear la cita.";
dercoAppointmentAnswers.appointment_setup.cancellation_policy = "Reprogramar con 24 horas.";
dercoAppointmentAnswers.appointment_setup.calendar_provider = "google";
dercoAppointmentAnswers.appointment_setup.calendar_email = "agenda@derco.example";
dercoAppointmentAnswers.appointment_setup.reminder_channel = "whatsapp";
dercoAppointmentAnswers.appointment_setup.reminder_timing = "both";
dercoAppointmentAnswers.appointment_setup.survey_enabled = "yes";
dercoAppointmentAnswers.appointment_setup.channel_email = "citas@derco.example";
dercoAppointmentAnswers.appointment_setup.data_consent = true;
dercoAppointmentAnswers.meta.whatsapp_number = "+57 300 000 0000";
dercoAppointmentAnswers.channels.phone_calls = true;
const dercoAppointmentConfiguration = generateAppointmentConfiguration(dercoAppointmentAnswers, {
  actor: "root@nextforia.com",
  now: "2026-07-25T13:00:00.000Z"
});
assert.strictEqual(dercoAppointmentConfiguration.bot_type, "appointments");
assert.strictEqual(dercoAppointmentConfiguration.lifecycle, "draft");
assert.strictEqual(dercoAppointmentConfiguration.calendar_provider, "google");
assert.strictEqual(dercoAppointmentConfiguration.calendar_email, "agenda@derco.example");
assert.strictEqual(dercoAppointmentConfiguration.phone_calls_enabled, true);
assert.match(dercoAppointmentConfiguration.reminder_timing, /24 horas antes y 6 horas antes/);
assert.match(dercoAppointmentConfiguration.rescheduling_policy, /reprogramar/i);
assert.match(dercoAppointmentConfiguration.system_prompt, /CONFIGURACIÓN DE APPOINTMENT BOT/);
assert.match(dercoAppointmentConfiguration.system_prompt, /Google Calendar|google/i);
assert(dercoAppointmentConfiguration.booking_requirements.some(function (row) {
  return row.id === "case_reference" && row.required === false;
}));
assert.match(dercoAppointmentConfiguration.system_prompt, /Número de caso \[case_reference\]: opcional/);
assert.match(dercoAppointmentConfiguration.system_prompt, /Nunca vuelvas a pedir un dato conocido/);
assert.match(dercoAppointmentConfiguration.deployment_instructions, /post-call/);
assert.strictEqual(APPOINTMENT_DEPLOYMENT_INSTRUCTIONS, dercoAppointmentConfiguration.deployment_instructions);
assert.doesNotMatch(JSON.stringify(dercoAppointmentConfiguration), /CUSTOMER-SERVICE-ONLY-MARKER/);
const appointmentTestingConfiguration = normalizeAppointmentConfiguration(dercoAppointmentConfiguration, {
  actor: "root@nextforia.com",
  lifecycle: "approved_for_testing",
  now: "2026-07-25T13:30:00.000Z"
});
assert.strictEqual(appointmentTestingConfiguration.lifecycle, "approved_for_testing");
assert.strictEqual(appointmentTestingConfiguration.approved_for_testing_by, "root@nextforia.com");
assert.match(buildAppointmentSystemPrompt(appointmentTestingConfiguration), /RECORDATORIOS/);
const appointmentBuildingRecord = createOnboardingRecord(dercoAppointmentAnswers, {
  tenant_id: "grupo-derco",
  status: "completed",
  review_status: "building",
  review_actor: "root@nextforia.com",
  appointment_configuration: dercoAppointmentConfiguration,
  appointment_configuration_lifecycle: "draft"
});
assert.strictEqual(appointmentBuildingRecord.appointment_configuration.bot_type, "appointments");
assert.strictEqual(appointmentBuildingRecord.appointment_configuration.lifecycle, "draft");
assert.strictEqual(appointmentBuildingRecord.customer_service_configuration, null);
const editedConfiguration = normalizeCustomerServiceConfiguration(Object.assign({}, generatedConfiguration, {
  objective: "Resolver dudas y convertir oportunidades calificadas."
}), {
  actor: "root@nextforia.com",
  lifecycle: "approved_for_testing",
  now: "2026-07-25T12:30:00.000Z"
});
assert.strictEqual(editedConfiguration.lifecycle, "approved_for_testing");
assert.strictEqual(editedConfiguration.approved_for_testing_by, "root@nextforia.com");
assert.match(buildCustomerServiceSystemPrompt(editedConfiguration), /Resolver dudas y convertir oportunidades calificadas/);
const buildingRecord = createOnboardingRecord(approvedRecord.answers, {
  tenant_id: "completa",
  status: "completed",
  previous: approvedRecord,
  review_status: "building",
  review_actor: "root@nextforia.com",
  customer_service_configuration: generatedConfiguration,
  configuration_lifecycle: "draft"
});
assert.strictEqual(buildingRecord.setup_review.status, "building");
assert.strictEqual(buildingRecord.customer_service_configuration.bot_type, "customer_service");
assert.strictEqual(buildingRecord.customer_service_configuration.lifecycle, "draft");
const wordpressAnswers = JSON.parse(JSON.stringify(completedAnswers));
wordpressAnswers.commerce.platform = "woocommerce";
wordpressAnswers.commerce.store_url = "https://tienda-wordpress.example";
wordpressAnswers.commerce.integration_intent = "later";
assert.strictEqual(onboardingCompletion(wordpressAnswers), 100);
const wordpressConfiguration = generateCustomerServiceConfiguration(wordpressAnswers, {
  actor: "root@nextforia.com",
  now: "2026-07-25T12:45:00.000Z"
});
assert.strictEqual(wordpressConfiguration.commerce_platform, "woocommerce");
assert.strictEqual(wordpressConfiguration.commerce_integration_status, "pending_customer");
assert.match(wordpressConfiguration.system_prompt, /tienda-wordpress\.example/);
const liveRecord = createOnboardingRecord(approvedRecord.answers, {
  tenant_id: "completa",
  status: "completed",
  previous: approvedRecord,
  review_status: "live",
  review_actor: "ventas@ravtoys.com",
  review_event: { action: "mark_live", note: "Bot activo." }
});
assert.strictEqual(liveRecord.setup_review.status, "live");
assert.strictEqual(liveRecord.answers.customer_service_setup.setup_status, "active");
const editedRecord = createOnboardingRecord(completedAnswers, { tenant_id: "completa", status: "draft", previous: completedRecord });
assert.strictEqual(editedRecord.setup_completed, true);
assert.strictEqual(editedRecord.setup_completed_at, completedRecord.setup_completed_at);

const customQuestionnaire = normalizeCustomerSetupQuestionnaire({
  questions: CUSTOMER_SETUP_QUESTIONS.concat([{
    id: "custom_como_medir_exito",
    label: "¿Cómo vamos a medir éxito?",
    section: "business",
    order: 85,
    type: "textarea",
    required: true,
    active: true
  }])
}, "Root", "2026-07-25T00:00:00.000Z");
const customQuestion = customQuestionnaire.questions.find(function (question) { return question.id === "custom_como_medir_exito"; });
assert.strictEqual(customQuestion.path, "custom.como_medir_exito");
assert.strictEqual(customQuestion.custom, true);
assert.strictEqual(customQuestionnaire.updated_by, "Root");
assert.ok(onboardingCompletion(completedAnswers, customQuestionnaire) < 100);
const pendingCustom = pendingQuestionnaireItems(completedAnswers, customQuestionnaire, { includeOptionalCustom: true });
assert.strictEqual(pendingCustom.length, 1);
assert.strictEqual(pendingCustom[0].label, "¿Cómo vamos a medir éxito?");
assert.strictEqual(pendingCustom[0].custom, true);
assert.strictEqual(pendingCustom[0].required, true);
const completedWithCustom = cloneDefaults();
Object.assign(completedWithCustom, completedAnswers);
completedWithCustom.custom.como_medir_exito = "Retención, citas confirmadas y ventas recuperadas.";
assert.strictEqual(onboardingCompletion(completedWithCustom, customQuestionnaire), 100);
assert.strictEqual(pendingQuestionnaireItems(completedWithCustom, customQuestionnaire, { includeOptionalCustom: true }).length, 0);

const oldQuestionnaireWithCustom = normalizeCustomerSetupQuestionnaire({
  questions: CUSTOMER_SETUP_QUESTIONS.concat([{
    id: "custom_pregunta_restaurada",
    label: "Pregunta restaurada desde historial",
    section: "business",
    order: 87,
    type: "textarea",
    required: false,
    active: true
  }])
}, "Root", "2026-07-27T10:00:00.000Z");
const latestQuestionnaireWithoutCustom = normalizeCustomerSetupQuestionnaire({
  questions: CUSTOMER_SETUP_QUESTIONS
}, "Root", "2026-07-28T10:00:00.000Z");
const restoredQuestionnaire = mergeCustomerSetupQuestionnaireHistory([
  latestQuestionnaireWithoutCustom,
  oldQuestionnaireWithCustom
], "Root", "2026-07-28T10:00:00.000Z");
assert(restoredQuestionnaire.questions.some(function (question) {
  return question.id === "custom_pregunta_restaurada" &&
    question.path === "custom.pregunta_restaurada" &&
    question.label === "Pregunta restaurada desde historial";
}), "custom questions from older questionnaire records must be restored");

const appointmentAnswers = cloneDefaults();
appointmentAnswers.setup_goal = "appointments";
appointmentAnswers.appointment_setup.business_name = "Clínica Agenda";
appointmentAnswers.appointment_setup.business_category = "salud_bienestar";
appointmentAnswers.operations.monthly_customer_volume = "180";
appointmentAnswers.appointment_setup.target_customer = "Pacientes que quieren reservar consulta";
appointmentAnswers.appointment_setup.business_description = "Atención clara antes de confirmar cada cita";
appointmentAnswers.appointment_setup.assistant_tone = "calido_empatico";
appointmentAnswers.appointment_setup.bot_display_name = "Nextfor de Clínica Agenda";
appointmentAnswers.appointment_setup.allowed_topics = "Servicios, horarios y disponibilidad";
appointmentAnswers.appointment_setup.forbidden_topics = "Diagnósticos y promesas de resultado";
appointmentAnswers.appointment_setup.escalation_triggers = "Urgencias y quejas";
appointmentAnswers.appointment_setup.escalation_contact = "Recepción +57 300";
appointmentAnswers.appointment_setup.services = "Consulta inicial · 45 minutos";
appointmentAnswers.appointment_setup.appointment_services = [{ id: "consulta_inicial", name: "Consulta inicial", duration_minutes: 45, price_cop: 0, modality: "in_person", address: "Sede principal" }];
appointmentAnswers.appointment_setup.business_hours = "Lunes a viernes";
appointmentAnswers.appointment_setup.staff_mode = "one";
appointmentAnswers.appointment_setup.appointment_locations = "Sede principal";
appointmentAnswers.appointment_setup.availability_rules = "Lunes a viernes de 8 a 5";
appointmentAnswers.appointment_setup.required_booking_fields = "Nombre, teléfono y servicio";
appointmentAnswers.appointment_setup.booking_confirmation_mode = "manual_approval";
appointmentAnswers.appointment_setup.cancellation_policy = "Cancelar mínimo 12 horas antes";
appointmentAnswers.appointment_setup.calendar_provider = "google";
appointmentAnswers.appointment_setup.reminder_channel = "whatsapp";
appointmentAnswers.appointment_setup.reminder_timing = "24h";
appointmentAnswers.appointment_setup.survey_enabled = "yes";
appointmentAnswers.meta.whatsapp_number = "+57 300 111 2222";
appointmentAnswers.appointment_setup.operational_channels = "WhatsApp";
appointmentAnswers.appointment_setup.data_consent = true;
assert.strictEqual(onboardingCompletion(appointmentAnswers), 100, "agendamiento no exige preguntas del ChatBot de atención");
const appointmentRecord = createOnboardingRecord(appointmentAnswers, { tenant_id: "clinica-agenda", status: "completed" });
assert.strictEqual(appointmentRecord.answers.setup_goal, "appointments");
assert.strictEqual(appointmentRecord.answers.appointment_setup.setup_status, "pending_review");
assert.strictEqual(appointmentRecord.setup_completed, true);

const bothAnswers = JSON.parse(JSON.stringify(completedAnswers));
bothAnswers.setup_goal = "both";
bothAnswers.appointment_setup = JSON.parse(JSON.stringify(appointmentAnswers.appointment_setup));
assert.strictEqual(onboardingCompletion(bothAnswers), 100, "ambos bots exige y acepta ambos bloques visibles");
const bothRecord = createOnboardingRecord(bothAnswers, { tenant_id: "ambos-bots", status: "completed" });
assert.strictEqual(bothRecord.answers.setup_goal, "both");
assert.strictEqual(bothRecord.answers.customer_service_setup.setup_status, "pending_review");
assert.strictEqual(bothRecord.answers.appointment_setup.setup_status, "pending_review");
assert.strictEqual(bothRecord.setup_completed, true);

const coverageAnswers = cloneDefaults();
coverageAnswers.operations.primary_country = "Colombia";
coverageAnswers.operations.countries_served = "Colombia y Panamá";
const coverageRecord = createOnboardingRecord(coverageAnswers, { tenant_id: "pilot-2", status: "submitted" });
assert.match(buildCoverageConversationContext(coverageRecord), /Países o territorios atendidos: Colombia y Panamá/);
assert.doesNotMatch(buildCoverageConversationContext(coverageRecord), /no parece colombiano/);

console.log("client onboarding tests passed");
