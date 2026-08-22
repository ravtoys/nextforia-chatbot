"use strict";

const {
  compileBookingRequirements,
  compileDepositPolicy,
  normalizeBookingRequirements,
  normalizeDepositPolicy
} = require("./appointment-operations");

const DEFAULT_ONBOARDING = Object.freeze({
  setup_goal: "unknown",
  business: {
    brand_name: "",
    legal_name: "",
    tax_id: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    website: "",
    privacy_policy_url: "",
    logo_data_url: ""
  },
  meta: {
    business_portfolio_ready: "unknown",
    admin_available: "unknown",
    whatsapp_number: "",
    whatsapp_integration_intent: "unknown",
    whatsapp_integration_status: "not_requested",
    number_status: "unknown",
    desired_number_strategy: "review",
    facebook_page: "",
    instagram_account: ""
  },
  channels: {
    whatsapp: true,
    instagram: false,
    messenger: false,
    web_chat: false,
    email: false,
    phone_calls: false,
    other: false,
    service_email: "",
    web_chat_url: "",
    other_details: "",
    integration_notes: ""
  },
  commerce: {
    platform: "unknown",
    other_platform: "",
    store_url: "",
    catalog_ready: "unknown",
    orders_required: true,
    access_owner: "",
    integration_intent: "unknown",
    integration_status: "not_requested"
  },
  operations: {
    primary_country: "Colombia",
    primary_city: "",
    monthly_customer_volume: "",
    countries_served: "Colombia",
    foreign_number_location_check: true,
    business_hours: "",
    services_products: "",
    support_hours: "",
    payments: "",
    shipping: "",
    warranties: "",
    important_policies: "",
    frequent_questions: "",
    handoff_cases: "",
    bot_instructions: ""
  },
  team: {
    admin_name: "",
    admin_email: "",
    agents: "",
    notification_phone: "",
    human_support_contact: "",
    pilot_start: ""
  },
  confirmations: {
    owns_information: false,
    accepts_guided_setup: false,
    understands_meta_dependency: false
  },
  customer_service_setup: {
    business_offer_type: "",
    business_offer_description: "",
    ideal_customer: "",
    value_proposition: "",
    bot_display_name: "",
    tone: "",
    custom_tone_description: "",
    brand_restrictions: "",
    company_logo: "",
    data_consent: false,
    data_consent_version: "",
    data_consent_accepted_at: "",
    setup_status: "draft"
  },
  appointment_setup: {
    business_name: "",
    business_category: "",
    business_category_other: "",
    target_customer: "",
    business_description: "",
    business_differentiator: "",
    assistant_tone: "",
    bot_display_name: "",
    bot_image: "",
    bot_logo: "",
    allowed_topics: "",
    forbidden_topics: "",
    escalation_triggers: "",
    escalation_contact: "",
    human_support_hours: "",
    services: "",
    business_hours: "",
    payment_methods: "",
    faqs: "",
    knowledge_documents: "",
    staff_mode: "",
    appointment_staff: "",
    appointment_locations: "",
    availability_rules: "",
    required_booking_fields: "",
    booking_requirements: [],
    deposit_policy: { required: false, appointment_value_cop: 0, deposit_amount_cop: 0, payment_methods: [] },
    minimum_booking_notice: "",
    maximum_booking_window: "",
    booking_confirmation_mode: "",
    cancellation_policy: "",
    no_show_policy: "",
    booking_payment_required: "",
    booking_payment_details: "",
    calendar_provider: "",
    calendar_email: "",
    reminder_channel: "",
    reminder_timing: "",
    survey_enabled: "unknown",
    survey_scale: "",
    high_rating_action: "",
    low_rating_action: "",
    operational_channels: "",
    instagram_username: "",
    channel_email: "",
    calls_enabled: "unknown",
    other_channels: "",
    social_accounts: "",
    data_consent: false,
    data_consent_version: "",
    data_consent_accepted_at: "",
    setup_status: "draft"
  },
  custom: {}
});

// Stable, versioned question contract for the first-login setup. Super Admin can
// later persist and manage these same IDs (label/order/active) without changing
// the answer paths already stored for each tenant.
const CUSTOMER_SETUP_QUESTIONS = Object.freeze([
  { id: "setup_goal", path: "setup_goal", section: "goal", order: 10, active: true, required: true, type: "choice", label: "¿Qué quieres que NextforIA impulse primero?" },
  { id: "company_name", path: "business.brand_name", section: "business", order: 20, active: true, required: true, type: "text", label: "¿Cómo se llama tu empresa?" },
  { id: "administrator_email", path: "team.admin_email", section: "business", order: 30, active: true, required: true, type: "email_readonly", label: "Correo del administrador" },
  { id: "contact_email", path: "business.contact_email", section: "business", order: 40, active: true, required: true, type: "email", label: "Correo de contacto" },
  { id: "phone", path: "business.contact_phone", section: "business", order: 50, active: true, required: true, type: "tel", label: "Teléfono" },
  { id: "whatsapp", path: "meta.whatsapp_number", section: "business", order: 60, active: true, required: true, type: "tel", label: "WhatsApp" },
  { id: "whatsapp_integration_intent", path: "meta.whatsapp_integration_intent", section: "business", order: 70, active: false, required: false, type: "choice", label: "Conexión de WhatsApp con Meta" },
  { id: "business_hours", path: "operations.support_hours", section: "business", order: 80, active: true, required: true, type: "textarea", label: "Horario de atención humana" },
  { id: "primary_country", path: "operations.primary_country", section: "business", order: 82, active: true, required: true, type: "text", label: "País principal" },
  { id: "primary_city", path: "operations.primary_city", section: "business", order: 84, active: true, required: true, type: "text", label: "Ciudad principal" },
  { id: "monthly_customer_volume", path: "operations.monthly_customer_volume", section: "business", order: 85, active: true, required: true, type: "number", label: "Clientes atendidos al mes" },
  { id: "customer_service_offer_type", path: "customer_service_setup.business_offer_type", section: "business", order: 86, active: true, required: true, type: "choice", label: "¿Qué vende tu empresa?" },
  { id: "customer_service_offer_description", path: "customer_service_setup.business_offer_description", section: "business", order: 88, active: true, required: true, type: "textarea", label: "Qué ofreces" },
  { id: "customer_service_ideal_customer", path: "customer_service_setup.ideal_customer", section: "business", order: 89, active: true, required: true, type: "textarea", label: "Cliente ideal" },
  { id: "customer_service_value_proposition", path: "customer_service_setup.value_proposition", section: "business", order: 90, active: true, required: true, type: "textarea", label: "Por qué deberían comprarte" },
  { id: "customer_service_bot_name", path: "customer_service_setup.bot_display_name", section: "business", order: 91, active: true, required: true, type: "text", label: "Nombre de Nextfor" },
  { id: "customer_service_tone", path: "customer_service_setup.tone", section: "business", order: 92, active: true, required: true, type: "choice", label: "Tono comercial" },
  { id: "customer_service_brand_restrictions", path: "customer_service_setup.brand_restrictions", section: "business", order: 93, active: true, required: true, type: "textarea", label: "Restricciones de marca" },
  { id: "customer_service_company_logo", path: "customer_service_setup.company_logo", section: "business", order: 94, active: false, required: false, type: "file", label: "Logo de la empresa" },
  { id: "services_products", path: "operations.services_products", section: "offering", order: 95, active: true, required: true, type: "textarea", label: "Servicios o productos" },
  { id: "commerce_platform", path: "commerce.platform", section: "commerce", order: 96, active: true, required: true, type: "choice", label: "Plataforma de comercio" },
  { id: "commerce_store_url", path: "commerce.store_url", section: "commerce", order: 97, active: true, required: false, type: "text", label: "URL de la tienda o sitio" },
  { id: "commerce_integration_intent", path: "commerce.integration_intent", section: "commerce", order: 98, active: true, required: true, type: "choice", label: "¿Quieres conectar la tienda con NextforIA?" },
  { id: "commerce_catalog_ready", path: "commerce.catalog_ready", section: "commerce", order: 99, active: true, required: false, type: "choice", label: "¿El catálogo está actualizado?" },
  { id: "commerce_orders_required", path: "commerce.orders_required", section: "commerce", order: 100, active: true, required: false, type: "checkbox", label: "El bot debe consultar pedidos" },
  { id: "commerce_access_owner", path: "commerce.access_owner", section: "commerce", order: 101, active: true, required: false, type: "text", label: "Responsable de autorizar la conexión" },
  { id: "frequently_asked_questions", path: "operations.frequent_questions", section: "offering", order: 110, active: true, required: true, type: "textarea", label: "Preguntas frecuentes" },
  { id: "important_policies", path: "operations.important_policies", section: "offering", order: 120, active: true, required: true, type: "textarea", label: "Políticas importantes" },
  { id: "human_support_contact", path: "team.human_support_contact", section: "voice", order: 130, active: true, required: true, type: "text", label: "Contacto de soporte humano" },
  { id: "bot_communication_instructions", path: "operations.bot_instructions", section: "voice", order: 140, active: true, required: true, type: "textarea", label: "Instrucciones de comunicación del bot" },
  { id: "customer_service_data_consent", path: "customer_service_setup.data_consent", section: "voice", order: 150, active: true, required: true, type: "checkbox", label: "Consentimiento de tratamiento de datos" },
  { id: "appointment_business_name", path: "appointment_setup.business_name", section: "appointments_business", order: 200, active: true, required: true, type: "text", label: "¿Cómo se llama tu negocio?" },
  { id: "appointment_business_category", path: "appointment_setup.business_category", section: "appointments_business", order: 210, active: true, required: true, type: "choice", label: "¿A qué se dedica?" },
  { id: "appointment_target_customer", path: "appointment_setup.target_customer", section: "appointments_business", order: 220, active: true, required: true, type: "textarea", label: "¿A quién atiendes principalmente?" },
  { id: "appointment_business_description", path: "appointment_setup.business_description", section: "appointments_business", order: 230, active: true, required: true, type: "textarea", label: "¿Qué hace tu negocio?" },
  { id: "appointment_business_differentiator", path: "appointment_setup.business_differentiator", section: "appointments_business", order: 235, active: true, required: false, type: "textarea", label: "¿Qué hace especial tu forma de atender?" },
  { id: "appointment_assistant_tone", path: "appointment_setup.assistant_tone", section: "appointments_business", order: 240, active: true, required: true, type: "choice", label: "Agendamiento: tono para hablar con tus clientes" },
  { id: "appointment_display_name", path: "appointment_setup.bot_display_name", section: "appointments_business", order: 250, active: true, required: true, type: "text", label: "¿Cómo quieres que NextforIA se presente?" },
  { id: "appointment_bot_image", path: "appointment_setup.bot_image", section: "appointments_business", order: 260, active: false, required: false, type: "file", label: "Logo o imagen" },
  { id: "appointment_allowed_topics", path: "appointment_setup.allowed_topics", section: "appointments_rules", order: 300, active: true, required: true, type: "textarea", label: "Temas que puede responder" },
  { id: "appointment_forbidden_topics", path: "appointment_setup.forbidden_topics", section: "appointments_rules", order: 310, active: true, required: true, type: "textarea", label: "Temas que debe evitar" },
  { id: "appointment_escalation_triggers", path: "appointment_setup.escalation_triggers", section: "appointments_rules", order: 320, active: true, required: true, type: "textarea", label: "Cuándo debe pedir ayuda" },
  { id: "appointment_escalation_contact", path: "appointment_setup.escalation_contact", section: "appointments_rules", order: 330, active: true, required: true, type: "text", label: "Responsable de apoyo humano" },
  { id: "appointment_services", path: "appointment_setup.services", section: "appointments_knowledge", order: 400, active: true, required: true, type: "textarea", label: "Servicios que se pueden reservar" },
  { id: "appointment_business_hours", path: "appointment_setup.business_hours", section: "appointments_knowledge", order: 410, active: true, required: true, type: "textarea", label: "Horario general de atención" },
  { id: "appointment_payment_methods", path: "appointment_setup.payment_methods", section: "appointments_knowledge", order: 420, active: true, required: false, type: "textarea", label: "Métodos de pago" },
  { id: "appointment_faqs", path: "appointment_setup.faqs", section: "appointments_knowledge", order: 430, active: true, required: false, type: "textarea", label: "Preguntas frecuentes" },
  { id: "appointment_staff_mode", path: "appointment_setup.staff_mode", section: "appointments_schedule", order: 500, active: true, required: true, type: "choice", label: "Quién atiende las citas" },
  { id: "appointment_locations", path: "appointment_setup.appointment_locations", section: "appointments_schedule", order: 510, active: true, required: true, type: "textarea", label: "Dónde se realizan las citas" },
  { id: "appointment_availability_rules", path: "appointment_setup.availability_rules", section: "appointments_schedule", order: 520, active: true, required: true, type: "textarea", label: "Disponibilidad para citas" },
  { id: "appointment_required_booking_fields", path: "appointment_setup.required_booking_fields", section: "appointments_schedule", order: 530, active: true, required: true, type: "textarea", label: "Datos necesarios para reservar" },
  { id: "appointment_booking_confirmation_mode", path: "appointment_setup.booking_confirmation_mode", section: "appointments_schedule", order: 540, active: true, required: true, type: "choice", label: "Confirmación de citas" },
  { id: "appointment_cancellation_policy", path: "appointment_setup.cancellation_policy", section: "appointments_schedule", order: 550, active: true, required: true, type: "textarea", label: "Cancelaciones y cambios" },
  { id: "appointment_calendar_provider", path: "appointment_setup.calendar_provider", section: "appointments_schedule", order: 560, active: true, required: true, type: "choice", label: "Calendario actual" },
  { id: "appointment_reminder_channel", path: "appointment_setup.reminder_channel", section: "appointments_followup", order: 600, active: true, required: true, type: "choice", label: "Canal de recordatorios" },
  { id: "appointment_reminder_timing", path: "appointment_setup.reminder_timing", section: "appointments_followup", order: 610, active: true, required: true, type: "choice", label: "Momento de recordatorio" },
  { id: "appointment_survey_enabled", path: "appointment_setup.survey_enabled", section: "appointments_followup", order: 620, active: true, required: true, type: "choice", label: "Encuesta posterior" },
  { id: "appointment_operational_channels", path: "appointment_setup.operational_channels", section: "appointments_channels", order: 700, active: false, required: false, type: "textarea", label: "Resumen interno de canales" },
  { id: "appointment_channel_whatsapp", path: "meta.whatsapp_number", section: "appointments_channels", order: 701, active: true, required: true, type: "tel", label: "WhatsApp + número" },
  { id: "appointment_instagram_username", path: "appointment_setup.instagram_username", section: "appointments_channels", order: 702, active: true, required: false, type: "text", label: "Instagram + usuario" },
  { id: "appointment_channel_email", path: "appointment_setup.channel_email", section: "appointments_channels", order: 703, active: true, required: false, type: "email", label: "Correo electrónico" },
  { id: "appointment_calls_enabled", path: "appointment_setup.calls_enabled", section: "appointments_channels", order: 704, active: true, required: false, type: "choice", label: "¿Quieres que tus clientes puedan llamar al bot?" },
  { id: "appointment_other_channels", path: "appointment_setup.other_channels", section: "appointments_channels", order: 705, active: true, required: false, type: "textarea", label: "Otros canales" },
  { id: "appointment_social_accounts", path: "appointment_setup.social_accounts", section: "appointments_channels", order: 710, active: false, required: false, type: "textarea", label: "Redes del negocio" },
  { id: "appointment_data_consent", path: "appointment_setup.data_consent", section: "appointments_review", order: 800, active: true, required: true, type: "checkbox", label: "Consentimiento de tratamiento de datos" }
]);

const QUESTION_TYPES = Object.freeze(["text", "number", "email", "email_readonly", "tel", "textarea", "choice", "checkbox", "file"]);
const SETUP_REVIEW_STATUSES = Object.freeze(["incomplete", "ready", "building", "testing", "live"]);
const CUSTOMER_SERVICE_CONFIGURATION_VERSION = 1;
const APPOINTMENT_CONFIGURATION_VERSION = 2;
const CUSTOMER_SERVICE_DEPLOYMENT_INSTRUCTIONS = [
  "14. Despliegue a Staging y Producción",
  "",
  "Implementar primero en Staging para validar que los cambios funcionan correctamente y no afectan el onboarding existente.",
  "",
  "Pruebas obligatorias en Staging:",
  "- Venta con y sin envío.",
  "- Diferentes medios de pago.",
  "- Recepción de comprobantes pendientes de validación.",
  "- Producto agotado.",
  "- Pedido no encontrado.",
  "- Cliente fuera de cobertura.",
  "- Escalamiento sin humano disponible.",
  "- Flujo setup_goal = both.",
  "- Ausencia de preguntas duplicadas.",
  "- Guardado automático y recuperación del progreso.",
  "- Consentimiento de datos.",
  "- Edición del resumen final.",
  "- Compatibilidad con datos existentes.",
  "",
  "Paso a Producción:",
  "1. Crear respaldo de la base de datos y configuración actual.",
  "2. Ejecutar las migraciones necesarias de forma segura.",
  "3. Desplegar el onboarding actualizado a Producción.",
  "4. Probar nuevamente el recorrido completo en Producción.",
  "5. Confirmar que el Customer Panel y los flujos existentes siguen funcionando.",
  "6. Mantener un procedimiento de rollback disponible.",
  "",
  "Esta instrucción autoriza el despliegue a Producción una vez superadas las pruebas de Staging.",
  "",
  "Entrega final:",
  "- URL de Staging.",
  "- URL de Producción.",
  "- Cambios realizados.",
  "- Variables creadas o modificadas.",
  "- Migraciones ejecutadas.",
  "- Pruebas realizadas.",
  "- Riesgos, limitaciones o pendientes encontrados."
].join("\n");
const APPOINTMENT_DEPLOYMENT_INSTRUCTIONS = [
  "- Usar solo la configuración de Appointment; Customer Service vive en su propia configuración.",
  "- No activar públicamente sin aprobación explícita de Super Admin.",
  "- Confirmar que el agente ElevenLabs real esté mapeado al tenant correcto.",
  "- Confirmar webhook post-call de ElevenLabs hacia NextforIA.",
  "- Confirmar calendario real conectado y aislado por tenant.",
  "- Confirmar WhatsApp real conectado desde Meta para el tenant.",
  "- Si el cliente activa llamadas, probar llamada real controlada antes de Live.",
  "- Probar crear, confirmar, reprogramar y cancelar una cita.",
  "- Probar recordatorios 24 horas y 6 horas cuando estén activados.",
  "- Probar bloqueo de agenda interno y reprogramación automática con mensaje de disculpa.",
  "- Verificar que la cita y la conversación aparezcan en Customer Panel y Super Admin."
].join("\n");
const QUESTION_SECTIONS = Object.freeze([
  "goal",
  "business",
  "offering",
  "commerce",
  "voice",
  "appointments_business",
  "appointments_rules",
  "appointments_knowledge",
  "appointments_schedule",
  "appointments_followup",
  "appointments_channels",
  "appointments_review"
]);
const BASE_QUESTION_BY_ID = CUSTOMER_SETUP_QUESTIONS.reduce(function (acc, question) {
  acc[question.id] = question;
  return acc;
}, {});

function slugifyQuestionId(value) {
  const clean = text(value, 90).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return clean || "pregunta";
}

function normalizeQuestionType(value, fallback) {
  const clean = text(value, 40).toLowerCase();
  return QUESTION_TYPES.includes(clean) ? clean : (fallback || "text");
}

function normalizeQuestionSection(value, fallback) {
  const clean = text(value, 60).toLowerCase();
  return QUESTION_SECTIONS.includes(clean) ? clean : (fallback || "business");
}

function normalizeCustomQuestionId(input, label, used) {
  const raw = text(input, 80).toLowerCase();
  const base = raw.indexOf("custom_") === 0 ? raw.slice(7) : raw;
  let id = "custom_" + slugifyQuestionId(base || label);
  let suffix = 2;
  while (used.has(id) || BASE_QUESTION_BY_ID[id]) {
    id = "custom_" + slugifyQuestionId(base || label) + "_" + suffix;
    suffix += 1;
  }
  used.add(id);
  return id;
}

function customQuestionPath(id) {
  return "custom." + slugifyQuestionId(String(id || "").replace(/^custom_/, ""));
}

function normalizeCustomerSetupQuestionnaire(input, actor, now) {
  const source = input && typeof input === "object" ? input : {};
  const incoming = Array.isArray(source.questions) ? source.questions : [];
  const incomingById = incoming.reduce(function (acc, question) {
    if (question && question.id) acc[String(question.id)] = question;
    return acc;
  }, {});
  const normalizedAt = now || new Date().toISOString();
  const usedCustomIds = new Set();
  const questions = CUSTOMER_SETUP_QUESTIONS.map(function (base) {
    const patch = incomingById[base.id] || {};
    return Object.assign({}, base, {
      active: patch.active === false ? false : true,
      required: patch.required === false ? false : true,
      order: Number.isFinite(Number(patch.order)) ? Number(patch.order) : base.order,
      type: normalizeQuestionType(patch.type, base.type),
      label: text(patch.label, 220) || base.label,
      placeholder: text(patch.placeholder, 500)
    });
  });
  incoming.forEach(function (question) {
    if (!question || BASE_QUESTION_BY_ID[question.id]) return;
    const label = text(question.label, 220) || "Nueva pregunta";
    const id = normalizeCustomQuestionId(question.id, label, usedCustomIds);
    questions.push({
      id,
      path: customQuestionPath(id),
      section: normalizeQuestionSection(question.section, "business"),
      order: Number.isFinite(Number(question.order)) ? Number(question.order) : 900 + questions.length,
      active: question.active !== false,
      required: question.required === true,
      type: normalizeQuestionType(question.type, "text"),
      label,
      placeholder: text(question.placeholder, 500),
      custom: true
    });
  });
  questions.sort(function (a, b) {
    return (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.id).localeCompare(String(b.id));
  });
  return {
    version: 1,
    updated_at: normalizedAt,
    updated_by: text(actor, 120),
    questions
  };
}

function mergeCustomerSetupQuestionnaireHistory(snapshots, actor, now) {
  const normalized = (Array.isArray(snapshots) ? snapshots : [])
    .filter(function (snapshot) { return snapshot && typeof snapshot === "object"; })
    .map(function (snapshot) {
      return normalizeCustomerSetupQuestionnaire(snapshot, snapshot.updated_by || actor || "", snapshot.updated_at || now || null);
    });
  const latest = normalized[0] || normalizeCustomerSetupQuestionnaire({ questions: CUSTOMER_SETUP_QUESTIONS }, actor || "", now || null);
  const questions = latest.questions.slice();
  const seen = new Set(questions.map(function (question) { return String(question && question.id || ""); }));
  normalized.slice(1).forEach(function (snapshot) {
    (snapshot.questions || []).forEach(function (question) {
      const id = String(question && question.id || "");
      if (!question || !question.custom || !id || seen.has(id)) return;
      seen.add(id);
      questions.push(question);
    });
  });
  return normalizeCustomerSetupQuestionnaire(
    { version: 1, questions },
    latest.updated_by || actor || "",
    latest.updated_at || now || null
  );
}

function questionAppliesToAnswers(question, answers) {
  const goal = answers && answers.setup_goal || "unknown";
  if (question.path === "setup_goal") return true;
  if (question.path === "operations.monthly_customer_volume") return goal === "customer_service" || goal === "appointments" || goal === "both";
  if (question.section === "business") return goal === "customer_service" || goal === "both";
  const appointmentQuestion = String(question.section || "").indexOf("appointments_") === 0 || String(question.path || "").indexOf("appointment_setup.") === 0;
  if (appointmentQuestion) return goal === "appointments" || goal === "both";
  return goal === "customer_service" || goal === "both";
}

function requiredPathsForQuestionnaire(answers, questionnaire) {
  if (!questionnaire || !Array.isArray(questionnaire.questions)) return null;
  return questionnaire.questions.filter(function (question) {
    return question && question.active !== false && question.required === true && question.path && questionAppliesToAnswers(question, answers);
  }).map(function (question) { return question.path; });
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_ONBOARDING));
}

function text(value, max) {
  return String(value == null ? "" : value).replace(/\u0000/g, "").trim().slice(0, max || 2000);
}

function imageDataUrl(value) {
  const clean = String(value == null ? "" : value).trim();
  if (!clean) return "";
  return /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(clean) && clean.length <= 90000
    ? clean
    : "";
}

function choice(value, allowed, fallback) {
  const clean = text(value, 60).toLowerCase();
  return allowed.includes(clean) ? clean : fallback;
}

function normalizeOnboarding(input) {
  input = input && typeof input === "object" ? input : {};
  const business = input.business || {};
  const meta = input.meta || {};
  const channels = input.channels || {};
  const commerce = input.commerce || {};
  const operations = input.operations || {};
  const team = input.team || {};
  const confirmations = input.confirmations || {};
  const customerServiceSetup = input.customer_service_setup || {};
  const appointmentSetup = input.appointment_setup || {};
  const custom = input.custom && typeof input.custom === "object" ? input.custom : {};
  const normalizedCustom = {};
  Object.keys(custom).slice(0, 120).forEach(function (key) {
    const cleanKey = slugifyQuestionId(key);
    if (cleanKey) normalizedCustom[cleanKey] = text(custom[key], 8000);
  });
  const yesNoUnknown = ["yes", "no", "unknown"];
  const whatsappIntent = choice(meta.whatsapp_integration_intent, ["yes", "later", "no", "unknown"], "unknown");
  const commerceIntent = choice(commerce.integration_intent, ["yes", "later", "no", "unknown"], "unknown");
  const commerceStoredStatus = choice(
    commerce.integration_status,
    ["not_requested", "requested", "pending_customer", "connected", "needs_review", "failed"],
    "not_requested"
  );
  const commerceIntegrationStatus = commerceStoredStatus !== "not_requested"
    ? commerceStoredStatus
    : commerceIntent === "yes"
      ? "requested"
      : commerceIntent === "later"
        ? "pending_customer"
        : "not_requested";
  const setupGoal = choice(input.setup_goal, ["customer_service", "appointments", "both", "unknown"], "unknown");
  const appointmentCallsEnabled = choice(
    appointmentSetup.calls_enabled,
    ["yes", "no", "unknown"],
    "unknown"
  ) === "unknown" && channels.phone_calls === true
    ? "yes"
    : choice(appointmentSetup.calls_enabled, ["yes", "no", "unknown"], "unknown");
  return {
    setup_goal: setupGoal,
    business: {
      brand_name: text(business.brand_name, 120),
      legal_name: text(business.legal_name, 180),
      tax_id: text(business.tax_id, 80),
      contact_name: text(business.contact_name, 120),
      contact_email: text(business.contact_email, 180).toLowerCase(),
      contact_phone: text(business.contact_phone, 40),
      website: text(business.website, 500),
      privacy_policy_url: text(business.privacy_policy_url, 500),
      logo_data_url: imageDataUrl(business.logo_data_url)
    },
    meta: {
      business_portfolio_ready: choice(meta.business_portfolio_ready, yesNoUnknown, "unknown"),
      admin_available: choice(meta.admin_available, yesNoUnknown, "unknown"),
      whatsapp_number: text(meta.whatsapp_number, 40),
      whatsapp_integration_intent: whatsappIntent,
      whatsapp_integration_status: choice(
        meta.whatsapp_integration_status,
        ["not_requested", "requested", "pending_customer", "connected", "needs_review", "failed"],
        whatsappIntent === "yes" ? "requested" : whatsappIntent === "later" ? "pending_customer" : "not_requested"
      ),
      number_status: choice(meta.number_status, ["new", "business_app", "cloud_api", "unknown"], "unknown"),
      desired_number_strategy: choice(meta.desired_number_strategy, ["new", "migrate", "coexistence", "review"], "review"),
      facebook_page: text(meta.facebook_page, 300),
      instagram_account: text(meta.instagram_account, 160)
    },
    channels: {
      whatsapp: channels.whatsapp !== false,
      instagram: !!channels.instagram,
      messenger: !!channels.messenger,
      web_chat: !!channels.web_chat,
      email: !!channels.email,
      phone_calls: appointmentCallsEnabled === "yes",
      other: !!channels.other,
      service_email: text(channels.service_email, 180).toLowerCase(),
      web_chat_url: text(channels.web_chat_url, 500),
      other_details: text(channels.other_details, 800),
      integration_notes: text(channels.integration_notes, 1600)
    },
    commerce: {
      platform: choice(commerce.platform, ["shopify", "woocommerce", "wordpress", "csv", "api", "other", "none", "unknown"], "unknown"),
      other_platform: text(commerce.other_platform, 160),
      store_url: text(commerce.store_url, 500),
      catalog_ready: choice(commerce.catalog_ready, yesNoUnknown, "unknown"),
      orders_required: commerce.orders_required !== false,
      access_owner: text(commerce.access_owner, 120),
      integration_intent: commerceIntent,
      integration_status: commerceIntegrationStatus,
      requested_from: choice(commerce.requested_from, ["onboarding", "customer_panel", "super_admin"], ""),
      requested_at: text(commerce.requested_at, 80),
      last_requested_at: text(commerce.last_requested_at, 80),
      shopify_shop: text(commerce.shopify_shop, 180),
      shopify_pairing_started_at: text(commerce.shopify_pairing_started_at, 80),
      shopify_pairing_expires_at: text(commerce.shopify_pairing_expires_at, 80),
      shopify_pairing_bot_id: text(commerce.shopify_pairing_bot_id, 80),
      shopify_connected_at: text(commerce.shopify_connected_at, 80)
    },
    operations: {
      primary_country: text(operations.primary_country, 120) || "Colombia",
      primary_city: text(operations.primary_city, 120),
      monthly_customer_volume: text(operations.monthly_customer_volume, 80),
      countries_served: text(operations.countries_served, 1200),
      foreign_number_location_check: operations.foreign_number_location_check !== false,
      business_hours: text(operations.business_hours, 1200),
      services_products: text(operations.services_products, 5000),
      support_hours: text(operations.support_hours, 1200),
      payments: text(operations.payments, 2500),
      shipping: text(operations.shipping, 2500),
      warranties: text(operations.warranties, 2500),
      important_policies: text(operations.important_policies, 5000),
      frequent_questions: text(operations.frequent_questions, 4000),
      handoff_cases: text(operations.handoff_cases, 3000),
      bot_instructions: text(operations.bot_instructions, 5000)
    },
    team: {
      admin_name: text(team.admin_name, 120),
      admin_email: text(team.admin_email, 180).toLowerCase(),
      agents: text(team.agents, 1500),
      notification_phone: text(team.notification_phone, 40),
      human_support_contact: text(team.human_support_contact, 1000),
      pilot_start: text(team.pilot_start, 20)
    },
    confirmations: {
      owns_information: !!confirmations.owns_information,
      accepts_guided_setup: !!confirmations.accepts_guided_setup,
      understands_meta_dependency: !!confirmations.understands_meta_dependency
    },
    customer_service_setup: {
      business_offer_type: choice(customerServiceSetup.business_offer_type, ["products", "services", "both", ""], ""),
      business_offer_description: text(customerServiceSetup.business_offer_description, 1800),
      ideal_customer: text(customerServiceSetup.ideal_customer, 1800),
      value_proposition: text(customerServiceSetup.value_proposition, 1800),
      bot_display_name: text(customerServiceSetup.bot_display_name, 120),
      tone: choice(customerServiceSetup.tone, [
        "cercano_profesional", "vendedor_dinamico", "calido_empatico",
        "formal_corporativo", "premium", "juvenil_casual", "personalizado", ""
      ], ""),
      custom_tone_description: text(customerServiceSetup.custom_tone_description, 1200),
      brand_restrictions: text(customerServiceSetup.brand_restrictions, 3000),
      company_logo: text(customerServiceSetup.company_logo, 800000),
      data_consent: !!customerServiceSetup.data_consent,
      data_consent_version: text(customerServiceSetup.data_consent_version, 80),
      data_consent_accepted_at: text(customerServiceSetup.data_consent_accepted_at, 40),
      setup_status: choice(customerServiceSetup.setup_status, ["draft", "pending_review", "changes_requested", "approved", "active", "ready"], "draft")
    },
    appointment_setup: {
      business_name: text(appointmentSetup.business_name, 120),
      business_category: choice(appointmentSetup.business_category, [
        "salud_bienestar", "belleza_estetica", "servicios_profesionales", "legal",
        "inmobiliaria", "restaurantes", "educacion", "automotriz", "otro"
      ], ""),
      business_category_other: text(appointmentSetup.business_category_other, 160),
      target_customer: text(appointmentSetup.target_customer, 1200),
      business_description: text(appointmentSetup.business_description, 1800),
      business_differentiator: text(appointmentSetup.business_differentiator, 1800),
      assistant_tone: choice(appointmentSetup.assistant_tone, [
        "cercano_profesional", "formal_corporativo", "calido_empatico",
        "directo_sencillo", "alegre_casual"
      ], ""),
      bot_display_name: text(appointmentSetup.bot_display_name, 120),
      bot_image: text(appointmentSetup.bot_image, 800000),
      bot_logo: text(appointmentSetup.bot_logo, 800000),
      allowed_topics: text(appointmentSetup.allowed_topics, 2500),
      forbidden_topics: text(appointmentSetup.forbidden_topics, 2500),
      escalation_triggers: text(appointmentSetup.escalation_triggers, 2500),
      escalation_contact: text(appointmentSetup.escalation_contact, 1000),
      human_support_hours: text(appointmentSetup.human_support_hours, 1200),
      services: text(appointmentSetup.services, 7000),
      business_hours: text(appointmentSetup.business_hours, 2000),
      payment_methods: text(appointmentSetup.payment_methods, 2000),
      faqs: text(appointmentSetup.faqs, 5000),
      knowledge_documents: text(appointmentSetup.knowledge_documents, 5000),
      staff_mode: choice(appointmentSetup.staff_mode, ["one", "multiple", "depends", ""], ""),
      appointment_staff: text(appointmentSetup.appointment_staff, 5000),
      appointment_locations: text(appointmentSetup.appointment_locations, 5000),
      availability_rules: text(appointmentSetup.availability_rules, 5000),
      scheduling_rules: Array.isArray(appointmentSetup.scheduling_rules) ? appointmentSetup.scheduling_rules.slice(0, 100) : [],
      schedule_exceptions: Array.isArray(appointmentSetup.schedule_exceptions) ? appointmentSetup.schedule_exceptions.slice(0, 500) : [],
      reminder_policy: appointmentSetup.reminder_policy && typeof appointmentSetup.reminder_policy === "object"
        ? Object.assign({}, appointmentSetup.reminder_policy)
        : null,
      booking_policy: appointmentSetup.booking_policy && typeof appointmentSetup.booking_policy === "object"
        ? {
            default_duration_minutes: Math.max(5, Math.min(1440, Math.round(Number(appointmentSetup.booking_policy.default_duration_minutes) || 60))),
            buffer_minutes: Math.max(0, Math.min(480, Math.round(Number(appointmentSetup.booking_policy.buffer_minutes) || 0)))
          }
        : null,
      default_duration_minutes: Math.max(5, Math.min(1440, Math.round(Number(appointmentSetup.default_duration_minutes) || 60))),
      buffer_minutes: Math.max(0, Math.min(480, Math.round(Number(appointmentSetup.buffer_minutes) || 0))),
      revision: Math.max(0, Math.floor(Number(appointmentSetup.revision) || 0)),
      required_booking_fields: text(appointmentSetup.required_booking_fields, 2500),
      booking_requirements: normalizeBookingRequirements(
        appointmentSetup.booking_requirements,
        appointmentSetup.required_booking_fields
      ),
      deposit_policy: normalizeDepositPolicy(appointmentSetup.deposit_policy),
      minimum_booking_notice: text(appointmentSetup.minimum_booking_notice, 500),
      maximum_booking_window: text(appointmentSetup.maximum_booking_window, 500),
      booking_confirmation_mode: choice(appointmentSetup.booking_confirmation_mode, ["automatic", "manual_approval", "depends", ""], ""),
      cancellation_policy: text(appointmentSetup.cancellation_policy, 3000),
      no_show_policy: text(appointmentSetup.no_show_policy, 2500),
      booking_payment_required: choice(appointmentSetup.booking_payment_required, ["no", "full", "deposit", "depends", ""], ""),
      booking_payment_details: text(appointmentSetup.booking_payment_details, 2500),
      calendar_provider: choice(appointmentSetup.calendar_provider, ["google", "outlook", "calendly", "other", "none", ""], ""),
      calendar_email: text(appointmentSetup.calendar_email, 180).toLowerCase(),
      reminder_channel: choice(appointmentSetup.reminder_channel, ["whatsapp", "email", "sms", "none", ""], ""),
      reminder_timing: choice(appointmentSetup.reminder_timing, ["24h", "6h", "2h", "both", "custom", "none", ""], ""),
      survey_enabled: choice(appointmentSetup.survey_enabled, ["yes", "no", "unknown"], "unknown"),
      survey_scale: choice(appointmentSetup.survey_scale, ["1_5", "1_10", "nps", ""], ""),
      high_rating_action: text(appointmentSetup.high_rating_action, 2000),
      low_rating_action: text(appointmentSetup.low_rating_action, 2000),
      operational_channels: text(appointmentSetup.operational_channels, 2500),
      instagram_username: text(appointmentSetup.instagram_username, 120),
      channel_email: text(appointmentSetup.channel_email, 180).toLowerCase(),
      calls_enabled: appointmentCallsEnabled,
      other_channels: text(appointmentSetup.other_channels, 2500),
      social_accounts: text(appointmentSetup.social_accounts, 2500),
      data_consent: !!appointmentSetup.data_consent,
      data_consent_version: text(appointmentSetup.data_consent_version, 80),
      data_consent_accepted_at: text(appointmentSetup.data_consent_accepted_at, 40),
      setup_status: choice(appointmentSetup.setup_status, ["draft", "pending_review", "changes_requested", "approved", "active", "ready"], "draft")
    },
    custom: normalizedCustom
  };
}

function getPath(source, path) {
  return path.split(".").reduce(function (value, key) { return value && value[key]; }, source);
}

function normalizeSetupReview(input, fallbackStatus) {
  const source = input && typeof input === "object" ? input : {};
  const status = choice(source.status, SETUP_REVIEW_STATUSES, fallbackStatus || "incomplete");
  const history = Array.isArray(source.history) ? source.history.slice(-50).map(function (event) {
    event = event && typeof event === "object" ? event : {};
    return {
      status: choice(event.status, SETUP_REVIEW_STATUSES, status),
      action: text(event.action, 80),
      note: text(event.note, 1200),
      actor: text(event.actor, 160),
      at: text(event.at, 40)
    };
  }) : [];
  return {
    status,
    note: text(source.note, 1200),
    requested_changes: text(source.requested_changes, 2000),
    updated_by: text(source.updated_by, 160),
    updated_at: text(source.updated_at, 40),
    history
  };
}

function customerServiceToneLabel(value, customDescription) {
  if (value === "personalizado") return text(customDescription, 1200) || "Personalizado";
  return {
    cercano_profesional: "Cercano y profesional",
    vendedor_dinamico: "Vendedor y dinámico",
    calido_empatico: "Cálido y empático",
    formal_corporativo: "Formal y corporativo",
    premium: "Premium",
    juvenil_casual: "Juvenil y casual"
  }[value] || text(value, 1200);
}

function addConfigurationSection(lines, title, entries) {
  const present = entries.filter(function (entry) { return text(entry[1], 10000); });
  if (!present.length) return;
  lines.push("", title + ":");
  present.forEach(function (entry) {
    lines.push("- " + entry[0] + ": " + text(entry[1], 10000));
  });
}

function buildCustomerServiceSystemPrompt(configuration) {
  const config = configuration && typeof configuration === "object" ? configuration : {};
  const active = config.lifecycle === "approved_for_testing";
  const lines = [
    active ? "CONFIGURACIÓN ACTIVA DE CUSTOMER SERVICE." : "CONFIGURACIÓN DE CUSTOMER SERVICE EN REVISIÓN INTERNA.",
    active
      ? "Esta es la configuración vigente de esta empresa. Úsala en esta respuesta y no la sustituyas por valores predeterminados o de otro tenant."
      : "Esta configuración proviene del setup compartido y todavía requiere aprobación.",
    "No inventes información ausente, precios, disponibilidad, descuentos ni promesas.",
    "No gestiones citas ni uses reglas del bot de agendamiento.",
    "",
    "IDENTIDAD:",
    "- Empresa: " + (text(config.business_name, 120) || "No definida"),
    "- Nombre del asistente: " + (text(config.assistant_name, 120) || "Nextfor"),
    "- Objetivo: " + (text(config.objective, 1800) || "Atender clientes y apoyar procesos de compra.")
  ];
  addConfigurationSection(lines, "NEGOCIO Y CLIENTE", [
    ["Qué ofrece", config.business_summary],
    ["Cliente ideal", config.ideal_customer],
    ["Propuesta de valor", config.value_proposition],
    ["País principal", config.primary_country],
    ["Países atendidos", config.countries_served]
  ]);
  addConfigurationSection(lines, "CONOCIMIENTO DE CUSTOMER SERVICE", [
    ["Productos o servicios", config.products_services],
    ["Preguntas frecuentes", config.frequent_questions],
    ["Políticas importantes", config.important_policies],
    ["Pagos", config.payments],
    ["Envíos", config.shipping],
    ["Garantías", config.warranties]
  ]);
  addConfigurationSection(lines, "VOZ Y LÍMITES", [
    ["Tono", config.tone],
    ["Restricciones de marca", config.brand_restrictions],
    ["Instrucciones adicionales", config.bot_instructions],
    ["Confirmar ubicación de números extranjeros", config.foreign_number_location_check ? "Sí" : "No"]
  ]);
  addConfigurationSection(lines, "ESCALAMIENTO HUMANO", [
    ["Escalar cuando", config.handoff_cases],
    ["Contacto humano", config.handoff_contact],
    ["Horario humano", config.support_hours]
  ]);
  addConfigurationSection(lines, "INTEGRACIONES AUTORIZADAS", [
    ["Plataforma de comercio", config.commerce_platform],
    ["Tienda", config.store_url],
    ["Estado del catálogo", config.catalog_ready],
    ["Intención de conexión", config.commerce_integration_intent],
    ["Estado de conexión", config.commerce_integration_status],
    ["Responsable de autorización", config.commerce_access_owner],
    ["Consulta de pedidos solicitada", config.orders_required ? "Sí" : "No"],
    ["Canales", Array.isArray(config.channels) ? config.channels.join(", ") : ""]
  ]);
  addConfigurationSection(lines, "DESPLIEGUE Y QA", [
    ["Instrucciones", config.deployment_instructions]
  ]);
  return lines.join("\n");
}

function normalizeCustomerServiceConfiguration(input, meta) {
  const source = input && typeof input === "object" ? input : {};
  const now = meta && meta.now || new Date().toISOString();
  const lifecycle = choice(
    meta && meta.lifecycle != null ? meta.lifecycle : source.lifecycle,
    ["draft", "approved_for_testing"],
    "draft"
  );
  const channels = Array.isArray(source.channels)
    ? source.channels.map(function (channel) { return text(channel, 40).toLowerCase(); })
      .filter(function (channel, index, values) { return channel && values.indexOf(channel) === index; })
      .slice(0, 12)
    : [];
  const normalized = {
    version: CUSTOMER_SERVICE_CONFIGURATION_VERSION,
    bot_type: "customer_service",
    lifecycle,
    source_record: "client-onboarding",
    source_setup_updated_at: text(source.source_setup_updated_at, 40),
    business_name: text(source.business_name, 120),
    assistant_name: text(source.assistant_name, 120),
    objective: text(source.objective, 1800),
    business_summary: text(source.business_summary, 5000),
    ideal_customer: text(source.ideal_customer, 3000),
    value_proposition: text(source.value_proposition, 3000),
    products_services: text(source.products_services, 8000),
    frequent_questions: text(source.frequent_questions, 8000),
    important_policies: text(source.important_policies, 8000),
    payments: text(source.payments, 4000),
    shipping: text(source.shipping, 4000),
    warranties: text(source.warranties, 4000),
    primary_country: text(source.primary_country, 120),
    countries_served: text(source.countries_served, 1200),
    foreign_number_location_check: source.foreign_number_location_check !== false,
    tone: text(source.tone, 1200),
    brand_restrictions: text(source.brand_restrictions, 5000),
    bot_instructions: text(source.bot_instructions, 8000),
    handoff_cases: text(source.handoff_cases, 5000),
    handoff_contact: text(source.handoff_contact, 1500),
    support_hours: text(source.support_hours, 1500),
    commerce_platform: text(source.commerce_platform, 120),
    store_url: text(source.store_url, 500),
    catalog_ready: text(source.catalog_ready, 80),
    commerce_integration_intent: text(source.commerce_integration_intent, 80),
    commerce_integration_status: text(source.commerce_integration_status, 80),
    commerce_access_owner: text(source.commerce_access_owner, 160),
    orders_required: source.orders_required !== false,
    channels,
    deployment_instructions: text(source.deployment_instructions, 10000) || CUSTOMER_SERVICE_DEPLOYMENT_INSTRUCTIONS,
    generated_at: text(source.generated_at, 40) || now,
    updated_at: now,
    updated_by: text(meta && meta.actor != null ? meta.actor : source.updated_by, 160),
    approved_for_testing_at: lifecycle === "approved_for_testing"
      ? (text(source.approved_for_testing_at, 40) || now)
      : null,
    approved_for_testing_by: lifecycle === "approved_for_testing"
      ? text(meta && meta.actor != null ? meta.actor : source.approved_for_testing_by, 160)
      : ""
  };
  normalized.system_prompt = buildCustomerServiceSystemPrompt(normalized);
  return normalized;
}

function generateCustomerServiceConfiguration(input, meta) {
  const answers = normalizeOnboarding(input);
  if (answers.setup_goal !== "customer_service" && answers.setup_goal !== "both") return null;
  const service = answers.customer_service_setup;
  const enabledChannels = Object.keys(answers.channels).filter(function (channel) {
    return typeof answers.channels[channel] === "boolean" && answers.channels[channel];
  });
  return normalizeCustomerServiceConfiguration({
    source_setup_updated_at: text(meta && meta.source_setup_updated_at, 40),
    business_name: answers.business.brand_name,
    assistant_name: service.bot_display_name,
    objective: "Atender consultas, orientar al cliente y apoyar procesos de compra exitosos.",
    business_summary: service.business_offer_description,
    ideal_customer: service.ideal_customer,
    value_proposition: service.value_proposition,
    products_services: answers.operations.services_products,
    frequent_questions: answers.operations.frequent_questions,
    important_policies: answers.operations.important_policies,
    payments: answers.operations.payments,
    shipping: answers.operations.shipping,
    warranties: answers.operations.warranties,
    primary_country: answers.operations.primary_country,
    countries_served: answers.operations.countries_served,
    foreign_number_location_check: answers.operations.foreign_number_location_check,
    tone: customerServiceToneLabel(service.tone, service.custom_tone_description),
    brand_restrictions: service.brand_restrictions,
    bot_instructions: answers.operations.bot_instructions,
    handoff_cases: answers.operations.handoff_cases,
    handoff_contact: answers.team.human_support_contact,
    support_hours: answers.operations.support_hours,
    commerce_platform: answers.commerce.platform,
    store_url: answers.commerce.store_url,
    catalog_ready: answers.commerce.catalog_ready,
    commerce_integration_intent: answers.commerce.integration_intent,
    commerce_integration_status: answers.commerce.integration_status,
    commerce_access_owner: answers.commerce.access_owner,
    orders_required: answers.commerce.orders_required,
    channels: enabledChannels,
    deployment_instructions: CUSTOMER_SERVICE_DEPLOYMENT_INSTRUCTIONS
  }, {
    actor: meta && meta.actor,
    lifecycle: "draft",
    now: meta && meta.now
  });
}

function reminderTimingLabel(value) {
  const raw = Array.isArray(value) ? value.join(",") : String(value || "");
  const normalized = raw.toLowerCase();
  if (normalized === "both") return "24 horas antes y 6 horas antes";
  if (normalized.indexOf("24") >= 0 && normalized.indexOf("6") >= 0) return "24 horas antes y 6 horas antes";
  if (normalized.indexOf("24") >= 0) return "24 horas antes";
  if (normalized === "2h") return "6 horas antes";
  if (normalized.indexOf("6") >= 0) return "6 horas antes";
  if (normalized === "none" || normalized === "no") return "Sin recordatorios automáticos";
  return text(value, 800);
}

function buildAppointmentSystemPrompt(configuration) {
  const config = configuration && typeof configuration === "object" ? configuration : {};
  const lines = [
    "CONFIGURACIÓN DE APPOINTMENT BOT EN REVISIÓN INTERNA.",
    "Esta configuración proviene del setup compartido aprobado por el cliente y Super Admin.",
    "No inventes disponibilidad, precios, sedes, políticas ni confirmaciones.",
    "No respondas temas de Customer Service fuera del alcance de agendamiento; deriva cuando aplique.",
    "Durante la reserva conserva los datos ya entregados y pide únicamente los campos activos que todavía falten.",
    "Nunca vuelvas a pedir un dato conocido. Los campos opcionales no bloquean la cita y los obligatorios sí.",
    "Envía las respuestas de requisitos en booking_fields usando exactamente los IDs indicados en esta configuración.",
    "",
    "IDENTIDAD:",
    "- Empresa: " + (text(config.business_name, 120) || "No definida"),
    "- Nombre del asistente: " + (text(config.assistant_name, 120) || "Nextfor"),
    "- Objetivo: " + (text(config.objective, 1800) || "Gestionar citas de forma segura.")
  ];
  addConfigurationSection(lines, "NEGOCIO Y ALCANCE", [
    ["Categoría", config.business_category],
    ["Cliente objetivo", config.target_customer],
    ["Descripción", config.business_summary],
    ["Diferenciador", config.business_differentiator],
    ["Tono", config.tone],
    ["Temas permitidos", config.allowed_topics],
    ["Temas prohibidos", config.forbidden_topics]
  ]);
  addConfigurationSection(lines, "AGENDA Y SERVICIOS", [
    ["Servicios agendables", config.services],
    ["Horario general", config.business_hours],
    ["Quién atiende", config.staff_mode],
    ["Ubicaciones/modalidad", config.appointment_locations],
    ["Reglas de disponibilidad", config.availability_rules],
    ["Duración predeterminada de cada cita", config.default_duration_minutes ? config.default_duration_minutes + " minutos" : ""],
    ["Separación mínima entre citas", config.buffer_minutes != null ? config.buffer_minutes + " minutos" : ""],
    ["Datos antes de confirmar", compileBookingRequirements(config.booking_requirements)],
    ["Anticipo para confirmar", compileDepositPolicy(config.deposit_policy)],
    ["Confirmación de reserva", config.booking_confirmation_mode],
    ["Cancelaciones y cambios", config.cancellation_policy],
    ["No-show", config.no_show_policy],
    ["Pagos para reservar", config.booking_payment_details]
  ]);
  addConfigurationSection(lines, "CALENDARIO Y CANALES", [
    ["Zona horaria del negocio", config.time_zone],
    ["Proveedor de calendario", config.calendar_provider],
    ["Correo/calendario", config.calendar_email],
    ["WhatsApp", config.whatsapp_number],
    ["Correo de citas", config.channel_email],
    ["Llamadas activadas", config.phone_calls_enabled ? "Sí" : "No"],
    ["Otros canales", config.other_channels],
    ["Canales operativos", Array.isArray(config.channels) ? config.channels.join(", ") : ""]
  ]);
  addConfigurationSection(lines, "RECORDATORIOS Y REPROGRAMACIÓN", [
    ["Canal de recordatorio", config.reminder_channel],
    ["Momentos de recordatorio", config.reminder_timing],
    ["Encuesta posterior", config.survey_enabled],
    ["Reprogramación por cambios internos", config.rescheduling_policy]
  ]);
  addConfigurationSection(lines, "ESCALAMIENTO Y CUMPLIMIENTO", [
    ["Escalar cuando", config.escalation_triggers],
    ["Contacto humano", config.escalation_contact],
    ["Consentimiento de datos", config.data_consent ? "Aceptado" : "Pendiente"],
    ["Instrucciones adicionales", config.bot_instructions]
  ]);
  addConfigurationSection(lines, "DESPLIEGUE Y QA", [
    ["Instrucciones", config.deployment_instructions]
  ]);
  return lines.join("\n");
}

function normalizeAppointmentConfiguration(input, meta) {
  const source = input && typeof input === "object" ? input : {};
  const now = meta && meta.now || new Date().toISOString();
  const lifecycle = choice(
    meta && meta.lifecycle != null ? meta.lifecycle : source.lifecycle,
    ["draft", "approved_for_testing"],
    "draft"
  );
  const channels = Array.isArray(source.channels)
    ? source.channels.map(function (channel) { return text(channel, 40).toLowerCase(); })
      .filter(function (channel, index, values) { return channel && values.indexOf(channel) === index; })
      .slice(0, 12)
    : [];
  const normalized = {
    version: APPOINTMENT_CONFIGURATION_VERSION,
    bot_type: "appointments",
    lifecycle,
    source_record: "client-onboarding",
    source_setup_updated_at: text(source.source_setup_updated_at, 40),
    business_name: text(source.business_name, 120),
    assistant_name: text(source.assistant_name, 120),
    objective: text(source.objective, 1800),
    business_category: text(source.business_category, 120),
    target_customer: text(source.target_customer, 3000),
    business_summary: text(source.business_summary, 5000),
    business_differentiator: text(source.business_differentiator, 3000),
    tone: text(source.tone, 1200),
    allowed_topics: text(source.allowed_topics, 5000),
    forbidden_topics: text(source.forbidden_topics, 5000),
    services: text(source.services, 8000),
    business_hours: text(source.business_hours, 3000),
    staff_mode: text(source.staff_mode, 1200),
    appointment_locations: text(source.appointment_locations, 5000),
    availability_rules: text(source.availability_rules, 8000),
    scheduling_rules: Array.isArray(source.scheduling_rules) ? source.scheduling_rules.slice(0, 100) : [],
    schedule_exceptions: Array.isArray(source.schedule_exceptions) ? source.schedule_exceptions.slice(0, 500) : [],
    reminder_policy: source.reminder_policy && typeof source.reminder_policy === "object"
      ? Object.assign({}, source.reminder_policy)
      : null,
    booking_policy: source.booking_policy && typeof source.booking_policy === "object"
      ? Object.assign({}, source.booking_policy)
      : null,
    default_duration_minutes: Math.max(5, Math.min(1440, Math.round(Number(source.default_duration_minutes) || 60))),
    buffer_minutes: Math.max(0, Math.min(480, Math.round(Number(source.buffer_minutes) || 0))),
    revision: Math.max(0, Math.floor(Number(source.revision) || 0)),
    settings_sync_status: choice(source.settings_sync_status, ["", "applied", "pending_external_apply", "failed"], ""),
    settings_synced_at: text(source.settings_synced_at, 40),
    settings_last_error: text(source.settings_last_error, 500),
    required_booking_fields: text(source.required_booking_fields, 4000),
    booking_requirements: normalizeBookingRequirements(source.booking_requirements, source.required_booking_fields),
    deposit_policy: normalizeDepositPolicy(source.deposit_policy),
    minimum_booking_notice: text(source.minimum_booking_notice, 1200),
    maximum_booking_window: text(source.maximum_booking_window, 1200),
    booking_confirmation_mode: text(source.booking_confirmation_mode, 1200),
    cancellation_policy: text(source.cancellation_policy, 5000),
    no_show_policy: text(source.no_show_policy, 3000),
    booking_payment_details: text(source.booking_payment_details, 3000),
    time_zone: text(source.time_zone, 120) || "America/Bogota",
    calendar_provider: text(source.calendar_provider, 80),
    calendar_email: text(source.calendar_email, 180).toLowerCase(),
    whatsapp_number: text(source.whatsapp_number, 80),
    channel_email: text(source.channel_email, 180).toLowerCase(),
    phone_calls_enabled: source.phone_calls_enabled === true,
    other_channels: text(source.other_channels, 2500),
    channels,
    reminder_channel: text(source.reminder_channel, 120),
    reminder_timing: text(source.reminder_timing, 800),
    survey_enabled: text(source.survey_enabled, 120),
    rescheduling_policy: text(source.rescheduling_policy, 5000) ||
      "Si NextforIA o el usuario del panel bloquea agenda, el bot debe contactar a los clientes afectados, pedir disculpas y reprogramar ofreciendo nuevas opciones.",
    escalation_triggers: text(source.escalation_triggers, 5000),
    escalation_contact: text(source.escalation_contact, 1500),
    data_consent: source.data_consent === true,
    bot_instructions: text(source.bot_instructions, 8000),
    deployment_instructions: text(source.deployment_instructions, 10000) || APPOINTMENT_DEPLOYMENT_INSTRUCTIONS,
    external_provider: choice(source.external_provider, ["", "elevenlabs"], ""),
    external_status: choice(source.external_status, ["", "draft", "configured", "failed"], ""),
    external_agent_id: text(source.external_agent_id, 160),
    external_prompt_hash: text(source.external_prompt_hash, 80),
    external_configured_at: text(source.external_configured_at, 40),
    external_configured_by: text(source.external_configured_by, 160),
    external_last_error: text(source.external_last_error, 500),
    external_phone_status: choice(source.external_phone_status, ["", "configured", "failed"], ""),
    external_phone_number_id: text(source.external_phone_number_id, 160),
    external_phone_number: text(source.external_phone_number, 40),
    external_phone_provider: text(source.external_phone_provider, 40),
    external_phone_agent_id: text(source.external_phone_agent_id, 160),
    external_phone_configured_at: text(source.external_phone_configured_at, 40),
    external_phone_configured_by: text(source.external_phone_configured_by, 160),
    external_phone_last_error: text(source.external_phone_last_error, 500),
    generated_at: text(source.generated_at, 40) || now,
    updated_at: now,
    updated_by: text(meta && meta.actor != null ? meta.actor : source.updated_by, 160),
    approved_for_testing_at: lifecycle === "approved_for_testing"
      ? (text(source.approved_for_testing_at, 40) || now)
      : null,
    approved_for_testing_by: lifecycle === "approved_for_testing"
      ? text(meta && meta.actor != null ? meta.actor : source.approved_for_testing_by, 160)
      : ""
  };
  normalized.system_prompt = buildAppointmentSystemPrompt(normalized);
  return normalized;
}

function generateAppointmentConfiguration(input, meta) {
  const answers = normalizeOnboarding(input);
  if (answers.setup_goal !== "appointments" && answers.setup_goal !== "both") return null;
  const appointment = answers.appointment_setup;
  const channels = [];
  if (answers.channels.whatsapp || answers.meta.whatsapp_number) channels.push("whatsapp");
  if (answers.channels.email || appointment.channel_email) channels.push("email");
  if (answers.channels.phone_calls) channels.push("phone_calls");
  if (appointment.instagram_username) channels.push("instagram");
  return normalizeAppointmentConfiguration({
    source_setup_updated_at: text(meta && meta.source_setup_updated_at, 40),
    business_name: appointment.business_name || answers.business.brand_name,
    assistant_name: appointment.bot_display_name,
    objective: "Gestionar citas: consultar disponibilidad, agendar, confirmar, recordar, cancelar y reprogramar con aprobación del cliente.",
    business_category: appointment.business_category_other || appointment.business_category,
    target_customer: appointment.target_customer,
    business_summary: appointment.business_description,
    business_differentiator: appointment.business_differentiator,
    tone: appointment.assistant_tone,
    allowed_topics: appointment.allowed_topics,
    forbidden_topics: appointment.forbidden_topics,
    services: appointment.services,
    business_hours: appointment.business_hours,
    staff_mode: appointment.staff_mode,
    appointment_locations: appointment.appointment_locations,
    availability_rules: appointment.availability_rules,
    scheduling_rules: appointment.scheduling_rules,
    schedule_exceptions: appointment.schedule_exceptions,
    reminder_policy: appointment.reminder_policy,
    booking_policy: appointment.booking_policy,
    default_duration_minutes: appointment.default_duration_minutes,
    buffer_minutes: appointment.buffer_minutes,
    revision: appointment.revision,
    required_booking_fields: appointment.required_booking_fields,
    booking_requirements: appointment.booking_requirements,
    deposit_policy: appointment.deposit_policy,
    minimum_booking_notice: appointment.minimum_booking_notice,
    maximum_booking_window: appointment.maximum_booking_window,
    booking_confirmation_mode: appointment.booking_confirmation_mode,
    cancellation_policy: appointment.cancellation_policy,
    no_show_policy: appointment.no_show_policy,
    booking_payment_details: appointment.booking_payment_details || appointment.booking_payment_required,
    time_zone: appointment.time_zone || "America/Bogota",
    calendar_provider: appointment.calendar_provider,
    calendar_email: appointment.calendar_email,
    whatsapp_number: answers.meta.whatsapp_number,
    channel_email: appointment.channel_email || answers.channels.service_email,
    phone_calls_enabled: answers.channels.phone_calls === true,
    other_channels: appointment.other_channels || answers.channels.other_details,
    channels,
    reminder_channel: appointment.reminder_channel,
    reminder_timing: reminderTimingLabel(appointment.reminder_timing),
    survey_enabled: appointment.survey_enabled,
    escalation_triggers: appointment.escalation_triggers,
    escalation_contact: appointment.escalation_contact,
    data_consent: appointment.data_consent === true,
    bot_instructions: answers.operations.bot_instructions,
    deployment_instructions: APPOINTMENT_DEPLOYMENT_INSTRUCTIONS
  }, {
    actor: meta && meta.actor,
    lifecycle: "draft",
    now: meta && meta.now
  });
}

const CUSTOMER_SERVICE_REQUIRED_PATHS = [
  "setup_goal",
  "business.brand_name",
  "operations.primary_country",
  "operations.primary_city",
  "operations.monthly_customer_volume",
  "customer_service_setup.business_offer_type",
  "customer_service_setup.business_offer_description",
  "customer_service_setup.ideal_customer",
  "customer_service_setup.value_proposition",
  "customer_service_setup.bot_display_name",
  "customer_service_setup.tone",
  "customer_service_setup.brand_restrictions",
  "team.admin_email",
  "business.contact_email",
  "business.contact_phone",
  "meta.whatsapp_number",
  "operations.support_hours",
  "operations.services_products",
  "commerce.platform",
  "commerce.integration_intent",
  "operations.frequent_questions",
  "operations.important_policies",
  "team.human_support_contact",
  "operations.bot_instructions",
  "customer_service_setup.data_consent"
];

const APPOINTMENT_STAGE1_REQUIRED_PATHS = [
  "setup_goal",
  "appointment_setup.business_name",
  "appointment_setup.business_category",
  "operations.monthly_customer_volume",
  "appointment_setup.target_customer",
  "appointment_setup.business_description",
  "appointment_setup.assistant_tone",
  "appointment_setup.bot_display_name",
  "appointment_setup.allowed_topics",
  "appointment_setup.forbidden_topics",
  "appointment_setup.escalation_triggers",
  "appointment_setup.escalation_contact",
  "appointment_setup.services",
  "appointment_setup.business_hours",
  "appointment_setup.staff_mode",
  "appointment_setup.appointment_locations",
  "appointment_setup.availability_rules",
  "appointment_setup.required_booking_fields",
  "appointment_setup.booking_confirmation_mode",
  "appointment_setup.cancellation_policy",
  "appointment_setup.calendar_provider",
  "appointment_setup.reminder_channel",
  "appointment_setup.reminder_timing",
  "appointment_setup.survey_enabled",
  "meta.whatsapp_number",
  "appointment_setup.data_consent"
];

function requiredPathsForAnswers(input, questionnaire) {
  const answers = normalizeOnboarding(input);
  if (answers.setup_goal === "unknown") return ["setup_goal"];
  const questionnaireRequired = requiredPathsForQuestionnaire(answers, questionnaire);
  let required;
  if (questionnaireRequired && questionnaireRequired.length) {
    required = questionnaireRequired;
  } else if (answers.setup_goal === "both") {
    required = Array.from(new Set(CUSTOMER_SERVICE_REQUIRED_PATHS.concat(APPOINTMENT_STAGE1_REQUIRED_PATHS)));
  } else if (answers.setup_goal === "appointments") {
    required = APPOINTMENT_STAGE1_REQUIRED_PATHS;
  } else {
    required = CUSTOMER_SERVICE_REQUIRED_PATHS;
  }
  if (answers.setup_goal === "customer_service" || answers.setup_goal === "both") {
    if (["shopify", "woocommerce", "wordpress", "api", "other"].includes(answers.commerce.platform)) {
      required = required.concat(["commerce.store_url"]);
    }
    if (answers.commerce.platform === "other") required = required.concat(["commerce.other_platform"]);
  }
  return Array.from(new Set(required));
}

const REQUIRED_PATHS = CUSTOMER_SERVICE_REQUIRED_PATHS;

function isAnsweredValue(value) {
  if (value === "" || value === "unknown" || value === false || value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return String(value).trim() !== "";
}

function pendingQuestionnaireItems(input, questionnaire, options) {
  options = options || {};
  const answers = normalizeOnboarding(input);
  const requiredPaths = requiredPathsForAnswers(answers, questionnaire);
  const byPath = {};
  const questions = questionnaire && Array.isArray(questionnaire.questions) ? questionnaire.questions : [];
  questions.forEach(function (question) {
    if (question && question.path && question.active !== false) byPath[question.path] = question;
  });
  let paths = requiredPaths.slice();
  if (options.includeOptionalCustom) {
    questions.forEach(function (question) {
      if (!question || question.active === false || !question.custom || !question.path) return;
      if (answers.setup_goal !== "unknown" && !questionAppliesToAnswers(question, answers)) return;
      if (!paths.includes(question.path)) paths.push(question.path);
    });
  }
  return paths.filter(function (path) {
    return !isAnsweredValue(getPath(answers, path));
  }).map(function (path) {
    const question = byPath[path] || {};
    return {
      id: question.id || path,
      path,
      label: question.label || path,
      section: question.section || "general",
      custom: !!question.custom,
      required: requiredPaths.includes(path),
      updated_at: questionnaire && questionnaire.updated_at || null
    };
  });
}

function onboardingCompletion(input, questionnaire) {
  const answers = normalizeOnboarding(input);
  const required = requiredPathsForAnswers(answers, questionnaire);
  const complete = required.filter(function (path) {
    return isAnsweredValue(getPath(answers, path));
  }).length;
  return Math.round(complete / required.length * 100);
}

function createOnboardingRecord(input, meta) {
  meta = meta || {};
  const answers = normalizeOnboarding(input);
  const now = text(meta.now, 40) || new Date().toISOString();
  const status = choice(meta.status, ["draft", "submitted", "completed", "in_review", "ready"], "draft");
  const previous = meta.previous && typeof meta.previous === "object" ? meta.previous : {};
  const previousReview = normalizeSetupReview(previous.setup_review, previous.setup_completed ? "ready" : "incomplete");
  const reviewFallback = previousReview.status === "live"
    ? "live"
    : (status === "completed" ? "ready" : previousReview.status || "incomplete");
  const reviewStatus = choice(meta.review_status, SETUP_REVIEW_STATUSES, reviewFallback);
  if (status === "completed" && (answers.setup_goal === "appointments" || answers.setup_goal === "both")) {
    const previousAppointmentStatus = previous.answers && previous.answers.appointment_setup && previous.answers.appointment_setup.setup_status;
    if (!previous.setup_completed || previousAppointmentStatus === "draft" || previousAppointmentStatus === "changes_requested") {
      answers.appointment_setup.setup_status = "pending_review";
    }
    if (answers.appointment_setup.data_consent && !answers.appointment_setup.data_consent_accepted_at) {
      answers.appointment_setup.data_consent_accepted_at = now;
    }
    if (answers.appointment_setup.data_consent && !answers.appointment_setup.data_consent_version) {
      answers.appointment_setup.data_consent_version = "nextforia-customer-setup-2026-07";
    }
  }
  if (status === "completed" && (answers.setup_goal === "customer_service" || answers.setup_goal === "both")) {
    const previousCustomerServiceStatus = previous.answers && previous.answers.customer_service_setup && previous.answers.customer_service_setup.setup_status;
    if (!previous.setup_completed || previousCustomerServiceStatus === "draft" || previousCustomerServiceStatus === "changes_requested") {
      answers.customer_service_setup.setup_status = "pending_review";
    }
    if (answers.customer_service_setup.data_consent && !answers.customer_service_setup.data_consent_accepted_at) {
      answers.customer_service_setup.data_consent_accepted_at = now;
    }
    if (answers.customer_service_setup.data_consent && !answers.customer_service_setup.data_consent_version) {
      answers.customer_service_setup.data_consent_version = "nextforia-customer-setup-2026-07";
    }
  }
  const setupCompleted = previous.setup_completed === true || status === "completed";
  const setupCompletedAt = setupCompleted
    ? (previous.setup_completed_at || meta.setup_completed_at || now)
    : null;
  if (meta.review_status === "incomplete") {
    if (answers.setup_goal === "appointments" || answers.setup_goal === "both") answers.appointment_setup.setup_status = "changes_requested";
    if (answers.setup_goal === "customer_service" || answers.setup_goal === "both") answers.customer_service_setup.setup_status = "changes_requested";
  } else if (meta.approve_setup === true) {
    if (answers.setup_goal === "appointments" || answers.setup_goal === "both") answers.appointment_setup.setup_status = "approved";
    if (answers.setup_goal === "customer_service" || answers.setup_goal === "both") answers.customer_service_setup.setup_status = "approved";
  } else if (meta.review_status === "live") {
    if (answers.setup_goal === "appointments" || answers.setup_goal === "both") answers.appointment_setup.setup_status = "active";
    if (answers.setup_goal === "customer_service" || answers.setup_goal === "both") answers.customer_service_setup.setup_status = "active";
  }
  const setupReview = normalizeSetupReview(Object.assign({}, previousReview, {
    status: reviewStatus,
    note: meta.review_note != null ? meta.review_note : previousReview.note,
    requested_changes: meta.requested_changes != null ? meta.requested_changes : previousReview.requested_changes,
    updated_by: meta.review_actor || previousReview.updated_by,
    updated_at: meta.review_actor || meta.review_status ? now : previousReview.updated_at,
    history: previousReview.history.concat(meta.review_event ? [Object.assign({}, meta.review_event, {
      status: reviewStatus,
      actor: meta.review_actor || meta.updated_by,
      at: now
    })] : [])
  }), setupCompleted ? "ready" : "incomplete");
  let customerServiceConfiguration = null;
  if (Object.prototype.hasOwnProperty.call(meta, "customer_service_configuration")) {
    customerServiceConfiguration = meta.customer_service_configuration
      ? normalizeCustomerServiceConfiguration(meta.customer_service_configuration, {
        actor: meta.review_actor || meta.updated_by,
        lifecycle: meta.configuration_lifecycle,
        now
      })
      : null;
  } else if (previous.customer_service_configuration) {
    customerServiceConfiguration = normalizeCustomerServiceConfiguration(previous.customer_service_configuration, {
      actor: previous.customer_service_configuration.updated_by,
      lifecycle: previous.customer_service_configuration.lifecycle,
      now: previous.customer_service_configuration.updated_at || now
    });
  }
  let appointmentConfiguration = null;
  if (Object.prototype.hasOwnProperty.call(meta, "appointment_configuration")) {
    appointmentConfiguration = meta.appointment_configuration
      ? normalizeAppointmentConfiguration(meta.appointment_configuration, {
        actor: meta.review_actor || meta.updated_by,
        lifecycle: meta.appointment_configuration_lifecycle,
        now
      })
      : null;
  } else if (previous.appointment_configuration) {
    appointmentConfiguration = normalizeAppointmentConfiguration(previous.appointment_configuration, {
      actor: previous.appointment_configuration.updated_by,
      lifecycle: previous.appointment_configuration.lifecycle,
      now: previous.appointment_configuration.updated_at || now
    });
  }
  return {
    version: 2,
    questionnaire_version: 1,
    tenant_id: text(meta.tenant_id, 80),
    status,
    completion: onboardingCompletion(answers, meta.questionnaire),
    setup_completed: setupCompleted,
    setup_completed_at: setupCompletedAt,
    setup_review: setupReview,
    customer_service_configuration: customerServiceConfiguration,
    appointment_configuration: appointmentConfiguration,
    bot_personality: previous.bot_personality && typeof previous.bot_personality === "object"
      ? JSON.parse(JSON.stringify(previous.bot_personality))
      : null,
    last_updated_at: now,
    answers,
    updated_at: now,
    updated_by: text(meta.updated_by, 120)
  };
}

function buildCoverageConversationContext(record) {
  if (!record || !["submitted", "completed", "in_review", "ready"].includes(record.status) || !record.answers) return "";
  const operations = record.answers.operations || {};
  const primaryCountry = text(operations.primary_country, 120);
  const countriesServed = text(operations.countries_served, 1200);
  const lines = [];
  if (primaryCountry) lines.push("País principal del negocio: " + primaryCountry + ".");
  if (countriesServed) lines.push("Países o territorios atendidos: " + countriesServed + ".");
  return lines.length ? "COBERTURA GEOGRÁFICA DEL CLIENTE:\n" + lines.join("\n") : "";
}

module.exports = {
  APPOINTMENT_CONFIGURATION_VERSION,
  APPOINTMENT_DEPLOYMENT_INSTRUCTIONS,
  CUSTOMER_SERVICE_CONFIGURATION_VERSION,
  CUSTOMER_SERVICE_DEPLOYMENT_INSTRUCTIONS,
  CUSTOMER_SETUP_QUESTIONS,
  DEFAULT_ONBOARDING,
  QUESTION_SECTIONS,
  QUESTION_TYPES,
  SETUP_REVIEW_STATUSES,
  APPOINTMENT_STAGE1_REQUIRED_PATHS,
  CUSTOMER_SERVICE_REQUIRED_PATHS,
  REQUIRED_PATHS,
  buildCoverageConversationContext,
  buildAppointmentSystemPrompt,
  buildCustomerServiceSystemPrompt,
  cloneDefaults,
  createOnboardingRecord,
  generateAppointmentConfiguration,
  generateCustomerServiceConfiguration,
  normalizeAppointmentConfiguration,
  normalizeCustomerServiceConfiguration,
  normalizeCustomerSetupQuestionnaire,
  mergeCustomerSetupQuestionnaireHistory,
  normalizeOnboarding,
  normalizeSetupReview,
  onboardingCompletion,
  pendingQuestionnaireItems
};
