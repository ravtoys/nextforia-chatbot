"use strict";

const crypto = require("crypto");

const APPOINTMENT_SETTINGS_VERSION = 3;
const APPOINTMENT_REMINDER_VERSION = 1;
const BOOKING_REQUIREMENT_TYPES = new Set(["appointment_type", "full_name", "phone", "email", "id", "address", "custom"]);
const STANDARD_BOOKING_REQUIREMENTS = Object.freeze([
  { id: "appointment_type", type: "appointment_type", label: "Tipo de cita", question: "¿Qué tipo de cita necesitas?", active: true, required: true },
  { id: "full_name", type: "full_name", label: "Nombre completo", question: "¿Cuál es tu nombre completo?", active: true, required: true },
  { id: "phone", type: "phone", label: "Teléfono", question: "¿Cuál es tu número de teléfono?", active: true, required: true },
  { id: "email", type: "email", label: "Correo electrónico", question: "¿Cuál es tu correo electrónico?", active: true, required: false },
  { id: "id", type: "id", label: "Documento de identidad", question: "¿Cuál es tu número de documento?", active: false, required: false },
  { id: "address", type: "address", label: "Dirección", question: "¿Cuál es tu dirección?", active: false, required: false }
]);
const REMINDER_CHANNELS = new Set(["whatsapp", "email", "sms"]);
const DEPOSIT_PAYMENT_METHOD_TYPES = new Set(["bank_transfer", "payment_link", "cash", "custom"]);
const DEPOSIT_PAYMENT_METHOD_LABELS = Object.freeze({
  bank_transfer: "Transferencia bancaria",
  payment_link: "Link de pago",
  cash: "Efectivo"
});
const APPOINTMENT_SERVICE_MODALITIES = new Set(["in_person", "virtual", "both"]);
const REMINDER_STATUSES = new Set([
  "scheduled", "paused", "sending", "sent", "delivered", "read", "confirmed",
  "retrying", "no_response", "failed", "cancelled"
]);
const REMINDER_ACTIVE_STATUSES = new Set(["scheduled", "paused", "sending", "retrying", "failed"]);
const REMINDER_TERMINAL_STATUSES = new Set(["sent", "delivered", "read", "confirmed", "no_response", "cancelled"]);
const REMINDER_ACTIONS = new Set(["pause", "resume", "send_now", "retry"]);

class AppointmentOperationsError extends Error {
  constructor(code, status, details) {
    super(String(code || "appointment_operation_failed"));
    this.name = "AppointmentOperationsError";
    this.code = String(code || "appointment_operation_failed");
    this.status = Number(status) || 422;
    this.details = details || null;
  }
}

function text(value, max) {
  return String(value == null ? "" : value).replace(/\u0000/g, "").trim().slice(0, max || 1000);
}

function tenant(value) {
  return text(value, 120).toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function iso(value, fallback) {
  const parsed = new Date(value || fallback || Date.now());
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function optionalIso(value) {
  const raw = text(value, 80);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function validDateOnly(value) {
  const raw = text(value, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const parts = raw.split("-").map(Number);
  const parsed = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return parsed.getUTCFullYear() === parts[0] &&
    parsed.getUTCMonth() === parts[1] - 1 &&
    parsed.getUTCDate() === parts[2];
}

function integer(value, fallback, min, max) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function timeOfDay(value, fallback) {
  const raw = text(value, 8);
  if (!raw) return fallback || "";
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback || "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback || "";
  return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
}

function normalizeBookingPolicy(input, fallback) {
  const source = input && typeof input === "object" ? input : {};
  const previous = fallback && typeof fallback === "object" ? fallback : {};
  return {
    default_duration_minutes: integer(
      Object.prototype.hasOwnProperty.call(source, "default_duration_minutes")
        ? source.default_duration_minutes
        : previous.default_duration_minutes,
      60,
      5,
      24 * 60
    ),
    buffer_minutes: integer(
      Object.prototype.hasOwnProperty.call(source, "buffer_minutes")
        ? source.buffer_minutes
        : previous.buffer_minutes,
      0,
      0,
      8 * 60
    )
  };
}

function amountCop(value, fallback) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback == null ? 0 : fallback;
  return Math.max(0, Math.min(parsed, 1000000000000));
}

function normalizeDepositPaymentMethod(input, index) {
  const source = input && typeof input === "object" ? input : { type: input };
  const type = text(source.type, 40).toLowerCase();
  if (!DEPOSIT_PAYMENT_METHOD_TYPES.has(type)) return null;
  const label = text(source.label || DEPOSIT_PAYMENT_METHOD_LABELS[type], 120);
  if (!label) return null;
  return {
    id: text(source.id, 120).replace(/[^a-zA-Z0-9_-]/g, "") || type + "_" + (index + 1),
    type,
    label,
    instructions: text(source.instructions, 1000),
    active: source.active !== false,
    order: integer(source.order, index, 0, 100)
  };
}

function serviceId(value, fallback) {
  return bookingRequirementId(value, fallback || "service").slice(0, 80);
}

function normalizeServiceDeposit(input) {
  const source = input && typeof input === "object" ? input : {};
  const mode = source.mode === "percentage" ? "percentage" : "fixed";
  return {
    required: source.required === true,
    mode,
    amount: mode === "percentage"
      ? Math.max(0, Math.min(100, Number(source.amount) || 0))
      : amountCop(source.amount, 0)
  };
}

function normalizeAppointmentService(input, index) {
  const source = input && typeof input === "object" ? input : {};
  const name = text(source.name, 160);
  if (!name) return null;
  const modality = APPOINTMENT_SERVICE_MODALITIES.has(source.modality) ? source.modality : "in_person";
  const methods = (Array.isArray(source.payment_methods) ? source.payment_methods : [])
    .map(normalizeDepositPaymentMethod).filter(Boolean).slice(0, 8)
    .map(function (method, methodIndex) { return Object.assign({}, method, { order: methodIndex }); });
  return {
    id: serviceId(source.id || name, "service_" + (index + 1)),
    name,
    // Customer-facing benefit copy. This stays with the tenant service so
    // Tempo/Atlas can explain the service without inventing its value.
    description: text(source.description, 1600),
    duration_minutes: integer(source.duration_minutes, 0, 0, 24 * 60),
    price_cop: amountCop(source.price_cop, 0),
    payment_methods: methods,
    deposit: normalizeServiceDeposit(source.deposit),
    modality,
    address: text(source.address, 1000),
    directions: text(source.directions, 2000),
    maps_link: text(source.maps_link, 1000),
    virtual_link: text(source.virtual_link, 1000),
    active: source.active !== false,
    order: integer(source.order, index, 0, 1000)
  };
}

function appointmentServiceRows(value) {
  if (Array.isArray(value)) return value;
  // The setup page serializes its dynamic service editor as JSON.  Accept the
  // serialized form only at this boundary; persistence always receives an
  // array, so a legacy free-text field can never silently become live rules.
  if (typeof value === "string" && value.trim().charAt(0) === "[") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {}
  }
  return [];
}

function normalizeAppointmentServices(value) {
  const source = appointmentServiceRows(value);
  const seen = new Set();
  return source.map(normalizeAppointmentService).filter(Boolean).sort(function (a, b) { return a.order - b.order; })
    .filter(function (service) { if (seen.has(service.id)) return false; seen.add(service.id); return true; })
    .slice(0, 30).map(function (service, index) { return Object.assign({}, service, { order: index }); });
}

function validateAppointmentService(serviceInput) {
  const service = normalizeAppointmentService(serviceInput, 0);
  if (!service) return { ok: false, error: "appointment_service_name_required" };
  if (service.duration_minutes < 5) return { ok: false, error: "appointment_service_duration_required", service };
  if (service.modality === "in_person" && !service.address) return { ok: false, error: "appointment_service_address_required", service };
  // A virtual link is a fallback, never a prerequisite: Google Meet is
  // generated per appointment when Calendar is connected. A missing fallback
  // remains a safe, actionable appointment rather than blocking booking.
  if (service.modality === "both" && !service.address) return { ok: false, error: "appointment_service_both_address_required", service };
  const methods = service.payment_methods.filter(function (method) { return method.active; });
  if (service.price_cop > 0 && !methods.length) return { ok: false, error: "appointment_service_payment_method_required", service };
  if (methods.some(function (method) { return !method.instructions; })) {
    return { ok: false, error: "appointment_service_payment_instructions_required", service };
  }
  if (service.deposit.required) {
    if (service.deposit.amount <= 0) return { ok: false, error: "appointment_service_deposit_amount_required", service };
    if (service.deposit.mode === "fixed" && service.deposit.amount > service.price_cop) {
      return { ok: false, error: "appointment_service_deposit_exceeds_price", service };
    }
  }
  return { ok: true, service };
}

function compileAppointmentServices(servicesInput) {
  const services = normalizeAppointmentServices(servicesInput).filter(function (service) { return service.active; });
  if (!services.length) return "No hay servicios estructurados todavía. No inventes precio, duración, modalidad ni reglas de pago.";
  const lines = ["SERVICIOS Y REGLAS ACTIVAS DEL TENANT:", "- Pide al cliente elegir un servicio antes de consultar o confirmar una cita. Usa su ID exacto en service_id."];
  services.forEach(function (service) {
    const fallback = service.virtual_link ? " · Respaldo virtual: configurado" : " · Sin respaldo virtual";
    const modality = service.modality === "in_person" ? "Presencial: " + service.address : service.modality === "virtual" ? "Virtual" + fallback : "Presencial: " + service.address + " · Virtual" + fallback + " (el cliente elige)";
    lines.push("- " + service.name + " [" + service.id + "]: " + service.duration_minutes + " minutos · " + formatCop(service.price_cop) + " · " + modality + ".");
    if (service.description) lines.push("  Descripción aprobada por el negocio: " + service.description + " Úsala para explicar con claridad el beneficio para el cliente; no inventes promesas, alcance ni resultados.");
    if (service.deposit.required) {
      const deposit = service.deposit.mode === "percentage" ? service.deposit.amount + "% del valor de la cita" : formatCop(service.deposit.amount);
      lines.push("  Anticipo obligatorio: " + deposit + ". Métodos: " + service.payment_methods.filter(function (method) { return method.active; }).map(function (method) { return method.label + " — " + method.instructions; }).join(" | ") + ". No confirmar sin pago verificado.");
    } else lines.push("  No exige anticipo para confirmar.");
  });
  return lines.join("\n").slice(0, 14000);
}

function findAppointmentService(servicesInput, requestedId, requestedName) {
  const services = normalizeAppointmentServices(servicesInput).filter(function (service) { return service.active; });
  if (!services.length) return { ok: true, service: null, services };
  const requested = serviceId(requestedId || requestedName, "");
  const service = services.find(function (row) { return row.id === requested || serviceId(row.name, "") === requested; });
  return service ? { ok: true, service, services } : { ok: false, error: "appointment_service_required", services };
}

function normalizeDepositPolicy(input, fallback) {
  const source = input && typeof input === "object" ? input : {};
  const previous = fallback && typeof fallback === "object" ? fallback : {};
  const methodsInput = Object.prototype.hasOwnProperty.call(source, "payment_methods")
    ? source.payment_methods
    : previous.payment_methods;
  const seen = new Set();
  const paymentMethods = (Array.isArray(methodsInput) ? methodsInput : []).map(normalizeDepositPaymentMethod)
    .filter(Boolean).sort(function (a, b) { return a.order - b.order; }).filter(function (method) {
      const key = method.type === "custom" ? method.id : method.type;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8).map(function (method, index) { return Object.assign({}, method, { order: index }); });
  return {
    required: Object.prototype.hasOwnProperty.call(source, "required") ? source.required === true : previous.required === true,
    appointment_value_cop: amountCop(
      Object.prototype.hasOwnProperty.call(source, "appointment_value_cop") ? source.appointment_value_cop : previous.appointment_value_cop,
      0
    ),
    deposit_amount_cop: amountCop(
      Object.prototype.hasOwnProperty.call(source, "deposit_amount_cop") ? source.deposit_amount_cop : previous.deposit_amount_cop,
      0
    ),
    payment_methods: paymentMethods
  };
}

function validateDepositPolicy(value) {
  const policy = normalizeDepositPolicy(value);
  if (!policy.required) return { ok: true, policy };
  const methods = policy.payment_methods.filter(function (method) { return method.active; });
  if (policy.appointment_value_cop <= 0) return { ok: false, error: "appointment_value_required", policy };
  if (policy.deposit_amount_cop <= 0) return { ok: false, error: "deposit_amount_required", policy };
  if (policy.deposit_amount_cop > policy.appointment_value_cop) return { ok: false, error: "deposit_exceeds_appointment_value", policy };
  if (!methods.length) return { ok: false, error: "deposit_payment_method_required", policy };
  return { ok: true, policy };
}

function formatCop(amount) {
  return "$" + amountCop(amount).toLocaleString("es-CO") + " COP";
}

function compileDepositPolicy(policyInput) {
  const checked = validateDepositPolicy(policyInput);
  const policy = checked.policy;
  if (!policy.required) return "No se requiere anticipo para confirmar una cita.";
  const methods = policy.payment_methods.filter(function (method) { return method.active; }).map(function (method) { return method.label; });
  return [
    "ANTICIPO OBLIGATORIO ANTES DE CONFIRMAR:",
    "- Valor de la cita: " + formatCop(policy.appointment_value_cop) + ".",
    "- Anticipo requerido: " + formatCop(policy.deposit_amount_cop) + ".",
    "- Métodos aceptados: " + (methods.join(", ") || "sin método configurado") + ".",
    "- Informa estos datos antes de pedir el pago. No inventes cuentas, enlaces ni instrucciones no configuradas.",
    "- No confirmes la cita hasta que el pago esté verificado por el flujo autorizado."
  ].join("\n");
}

function bookingRequirementId(value, fallback) {
  const normalized = text(value, 120).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (normalized || fallback || "field").slice(0, 80);
}

function normalizeBookingRequirement(input, index) {
  const source = input && typeof input === "object" ? input : {};
  const requestedType = text(source.type, 40).toLowerCase();
  const type = BOOKING_REQUIREMENT_TYPES.has(requestedType) ? requestedType : "custom";
  const standard = STANDARD_BOOKING_REQUIREMENTS.find(function (row) { return row.type === type; });
  const label = text(source.label || standard && standard.label, 160);
  if (!label) return null;
  const fallbackId = type === "custom" ? "custom_" + String(index + 1) : type;
  const id = type === "custom" ? bookingRequirementId(source.id || label, fallbackId) : type;
  return {
    id,
    type,
    label,
    question: text(source.question || standard && standard.question || label, 300),
    active: source.active !== false,
    required: source.required === true,
    order: integer(source.order, index, 0, 1000)
  };
}

function legacyBookingRequirements(value) {
  const raw = text(value, 4000);
  if (!raw) return STANDARD_BOOKING_REQUIREMENTS.map(function (row, index) {
    return normalizeBookingRequirement(row, index);
  });
  const lower = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const detected = [];
  const aliases = [
    ["appointment_type", /\b(tipo de cita|tipo de consulta|servicio|motivo)\b/],
    ["full_name", /\b(nombre|nombre completo|paciente|cliente)\b/],
    ["phone", /\b(telefono|celular|movil|whatsapp)\b/],
    ["email", /\b(correo|email|e-mail)\b/],
    ["id", /\b(documento|cedula|identificacion|nit|pasaporte)\b/],
    ["address", /\b(direccion|domicilio|ubicacion)\b/]
  ];
  aliases.forEach(function (entry) {
    if (!entry[1].test(lower)) return;
    const standard = STANDARD_BOOKING_REQUIREMENTS.find(function (row) { return row.type === entry[0]; });
    detected.push(Object.assign({}, standard, { active: true, required: true }));
  });
  raw.split(/[\n,;]+/).map(function (part) { return text(part, 160); }).filter(Boolean).forEach(function (part) {
    const comparable = part.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (/\b(fecha|hora|horario|consentimiento)\b/.test(comparable)) return;
    if (aliases.some(function (entry) { return entry[1].test(comparable); })) return;
    detected.push({ type: "custom", id: bookingRequirementId(part), label: part, question: part, active: true, required: true });
  });
  if (!detected.length) detected.push(Object.assign({}, STANDARD_BOOKING_REQUIREMENTS[0]));
  STANDARD_BOOKING_REQUIREMENTS.forEach(function (standard) {
    if (detected.some(function (row) { return row.type === standard.type; })) return;
    detected.push(Object.assign({}, standard, { active: false, required: false }));
  });
  return detected.map(normalizeBookingRequirement).filter(Boolean);
}

function normalizeBookingRequirements(value, legacyValue) {
  const input = Array.isArray(value) && value.length ? value : legacyBookingRequirements(legacyValue);
  const seen = new Set();
  return input.map(normalizeBookingRequirement).filter(Boolean).sort(function (a, b) {
    return a.order - b.order;
  }).filter(function (row) {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).slice(0, 30).map(function (row, index) {
    return Object.assign({}, row, { order: index });
  });
}

function compileBookingRequirements(requirements) {
  const active = normalizeBookingRequirements(requirements).filter(function (row) { return row.active; });
  if (!active.length) return "No pedir datos personales adicionales. Fecha, hora y consentimiento siguen siendo necesarios para reservar.";
  const lines = ["Datos que el negocio decidió recopilar antes de confirmar:"];
  active.forEach(function (row) {
    lines.push("- " + row.label + " [" + row.id + "]: " + (row.required ? "OBLIGATORIO" : "opcional") + ". Pregunta sugerida: " + row.question);
  });
  lines.push("Los campos opcionales nunca bloquean la reserva si el cliente no desea responder.");
  return lines.join("\n").slice(0, 8000);
}

function bookingFieldValues(input, context) {
  const source = input && typeof input === "object" ? input : {};
  const profile = context && context.profile && typeof context.profile === "object" ? context.profile : {};
  const custom = source.booking_fields && typeof source.booking_fields === "object" && !Array.isArray(source.booking_fields)
    ? source.booking_fields
    : {};
  const result = {};
  Object.keys(custom).slice(0, 60).forEach(function (key) {
    const cleanKey = bookingRequirementId(key);
    const value = text(custom[key], 2000);
    if (cleanKey && value) result[cleanKey] = value;
  });
  const known = {
    appointment_type: source.consultation_reason,
    full_name: source.customer_name || profile.name,
    phone: source.customer_phone || context && context.channelPhone || profile.phone,
    email: source.customer_email || profile.email,
    id: custom.id || custom.id_number || profile.id_number,
    address: custom.address || profile.address
  };
  Object.keys(known).forEach(function (key) {
    const value = text(known[key], key === "address" ? 1000 : 300);
    if (value) result[key] = value;
  });
  return result;
}

function validateBookingRequirements(requirements, input, context) {
  const normalized = normalizeBookingRequirements(requirements);
  const values = bookingFieldValues(input, context);
  const missing = normalized.filter(function (row) {
    return row.active && row.required && !text(values[row.id] || values[row.type], 2000);
  }).map(function (row) {
    return { id: row.id, type: row.type, label: row.label, question: row.question };
  });
  return { ok: missing.length === 0, missing, values, requirements: normalized };
}

function stableId(prefix, parts) {
  return prefix + crypto.createHash("sha256").update(parts.map(function (part) {
    return String(part == null ? "" : part);
  }).join("\u0000"), "utf8").digest("hex").slice(0, 32);
}

function normalizeRule(input, index, now) {
  const source = input && typeof input === "object" ? input : { text: input };
  const value = text(source.text, 2000);
  if (!value) return null;
  const id = text(source.id, 120).replace(/[^a-zA-Z0-9_-]/g, "") ||
    stableId("rule_", [value.toLowerCase()]);
  const createdAt = iso(source.created_at, now);
  return {
    id,
    text: value,
    active: source.active !== false,
    order: integer(source.order, index, 0, 10000),
    created_at: createdAt,
    updated_at: iso(source.updated_at, createdAt)
  };
}

function normalizeException(input, index, now) {
  const source = input && typeof input === "object" ? input : {};
  const date = text(source.date, 20);
  if (!validDateOnly(date)) return null;
  const requestedMode = text(source.mode, 30).toLowerCase();
  const mode = requestedMode === "partial" || requestedMode === "parcial"
    ? "partial"
    : (requestedMode === "reschedule" || requestedMode === "reagendar" ? "reschedule" : "close");
  const availableFrom = mode === "partial" ? timeOfDay(source.available_from || source.start_time) : "";
  const availableUntil = mode === "partial" ? timeOfDay(source.available_until || source.end_time) : "";
  if (mode === "partial" && (!availableFrom || !availableUntil || availableFrom >= availableUntil)) return null;
  const outsideAction = source.outside_action === "cancel" || source.outside_action === "cancelar"
    ? "cancel"
    : "reschedule";
  const note = text(source.note, 1000);
  const id = text(source.id, 120).replace(/[^a-zA-Z0-9_-]/g, "") ||
    stableId("exception_", [date, mode, availableFrom, availableUntil, outsideAction, note.toLowerCase()]);
  const createdAt = iso(source.created_at, now);
  return {
    id,
    date,
    mode,
    available_from: availableFrom,
    available_until: availableUntil,
    outside_action: outsideAction,
    note,
    active: source.active !== false,
    order: integer(source.order, index, 0, 10000),
    created_at: createdAt,
    updated_at: iso(source.updated_at, createdAt)
  };
}

function uniqueById(rows, max) {
  const seen = new Set();
  return rows.filter(Boolean).filter(function (row) {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).slice(0, max);
}

function timingOffsets(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(function (item) {
      return integer(item, 0, 1, 60 * 24 * 30);
    }).filter(Boolean))).sort(function (a, b) { return b - a; }).slice(0, 8);
  }
  const raw = text(value, 800).toLowerCase();
  if (!raw || raw === "none" || raw.indexOf("sin recordatorio") >= 0) return [];
  if (raw === "both" || raw.indexOf("24") >= 0 && raw.indexOf("6") >= 0) return [1440, 360];
  if (raw === "24h" || raw.indexOf("24") >= 0) return [1440];
  if (raw === "6h" || raw.indexOf("6 hora") >= 0) return [360];
  if (raw === "2h" || raw.indexOf("2 hora") >= 0) return [120];
  const matches = raw.match(/\d+/g) || [];
  return Array.from(new Set(matches.map(function (hours) {
    return integer(Number(hours) * 60, 0, 1, 60 * 24 * 30);
  }).filter(Boolean))).sort(function (a, b) { return b - a; }).slice(0, 8);
}

function normalizeReminderPolicy(input, fallback, now) {
  const source = input && typeof input === "object" ? input : {};
  const previous = fallback && typeof fallback === "object" ? fallback : {};
  const rawChannel = text(
    Object.prototype.hasOwnProperty.call(source, "channel") ? source.channel : previous.channel,
    40
  ).toLowerCase();
  const channel = REMINDER_CHANNELS.has(rawChannel) ? rawChannel : "";
  const offsetsInput = Object.prototype.hasOwnProperty.call(source, "offsets_minutes")
    ? source.offsets_minutes
    : previous.offsets_minutes;
  const offsets = timingOffsets(offsetsInput);
  const enabledInput = Object.prototype.hasOwnProperty.call(source, "enabled") ? source.enabled : previous.enabled;
  return {
    enabled: enabledInput !== false && !!channel && offsets.length > 0,
    channel,
    offsets_minutes: offsets,
    retry_after_minutes: integer(
      Object.prototype.hasOwnProperty.call(source, "retry_after_minutes")
        ? source.retry_after_minutes
        : previous.retry_after_minutes,
      120,
      5,
      7 * 24 * 60
    ),
    max_attempts: integer(
      Object.prototype.hasOwnProperty.call(source, "max_attempts") ? source.max_attempts : previous.max_attempts,
      2,
      1,
      5
    ),
    handoff_on_no_response: Object.prototype.hasOwnProperty.call(source, "handoff_on_no_response")
      ? source.handoff_on_no_response !== false
      : previous.handoff_on_no_response !== false,
    updated_at: iso(source.updated_at || previous.updated_at, now)
  };
}

function compileAvailabilityRules(rules, exceptions, bookingPolicy) {
  const activeRules = (rules || []).filter(function (row) { return row.active !== false && text(row.text, 2000); })
    .sort(function (a, b) { return Number(a.order) - Number(b.order); });
  const activeExceptions = (exceptions || []).filter(function (row) { return row.active !== false; })
    .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  const lines = [];
  const policy = normalizeBookingPolicy(bookingPolicy);
  lines.push("Política operativa de citas:");
  lines.push("- Duración predeterminada: " + policy.default_duration_minutes + " minutos.");
  lines.push("- Separación mínima después de cada cita: " + policy.buffer_minutes + " minutos.");
  if (activeRules.length) {
    lines.push("");
    lines.push("Reglas activas de disponibilidad:");
    activeRules.forEach(function (row) { lines.push("- " + row.text); });
  }
  if (activeExceptions.length) {
    if (lines.length) lines.push("");
    lines.push("Excepciones (siempre tienen prioridad sobre las reglas generales):");
    activeExceptions.forEach(function (row) {
      const action = row.outside_action === "cancel" ? "cancelar" : "reagendar";
      lines.push("- " + row.date + ": " +
        (row.mode === "partial"
          ? "dar citas únicamente de " + row.available_from + " a " + row.available_until + "; fuera de ese horario " + action + " las citas"
          : (row.mode === "reschedule" ? "reagendar las citas" : "no dar citas")) +
        (row.note ? " — " + row.note : ""));
    });
  }
  return lines.join("\n").slice(0, 8000);
}

function appointmentLocalParts(value, timeZone) {
  const parsed = new Date(value || "");
  if (!Number.isFinite(parsed.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: text(timeZone, 120) || "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(parsed).reduce(function (result, part) {
      result[part.type] = part.value;
      return result;
    }, {});
    return {
      date: [parts.year, parts.month, parts.day].join("-"),
      minutes: Number(parts.hour) * 60 + Number(parts.minute)
    };
  } catch (_) {
    return {
      date: parsed.toISOString().slice(0, 10),
      minutes: parsed.getUTCHours() * 60 + parsed.getUTCMinutes()
    };
  }
}

function evaluateScheduleException(settingsInput, startsAt, durationMinutes, timeZone) {
  const settings = normalizeAppointmentSettings(settingsInput);
  const local = appointmentLocalParts(startsAt, timeZone);
  if (!local) return null;
  const exception = settings.schedule_exceptions.find(function (row) {
    return row.active !== false && row.date === local.date;
  });
  if (!exception) return null;
  if (exception.mode !== "partial") {
    return {
      blocked: true,
      date: local.date,
      mode: exception.mode,
      outside_action: exception.mode === "reschedule" ? "reschedule" : "cancel",
      reason: exception.note || "Este día no está disponible según las reglas del negocio."
    };
  }
  const fromParts = exception.available_from.split(":").map(Number);
  const untilParts = exception.available_until.split(":").map(Number);
  const availableFrom = fromParts[0] * 60 + fromParts[1];
  const availableUntil = untilParts[0] * 60 + untilParts[1];
  const requestedUntil = local.minutes + integer(durationMinutes, settings.booking_policy.default_duration_minutes, 5, 24 * 60);
  if (local.minutes >= availableFrom && requestedUntil <= availableUntil) return null;
  return {
    blocked: true,
    date: local.date,
    mode: "partial",
    available_from: exception.available_from,
    available_until: exception.available_until,
    outside_action: exception.outside_action,
    reason: exception.note || "Ese día solo hay citas de " + exception.available_from + " a " + exception.available_until + "."
  };
}

function legacyRule(availabilityRules, now) {
  const value = text(availabilityRules, 8000);
  return value ? normalizeRule({ id: stableId("rule_legacy_", [value]), text: value, active: true }, 0, now) : null;
}

function normalizeAppointmentSettings(input, options) {
  const source = input && typeof input === "object" ? input : {};
  const now = iso(options && options.now) || new Date().toISOString();
  let rulesInput = Array.isArray(source.scheduling_rules) ? source.scheduling_rules : [];
  if (!rulesInput.length) {
    const fallback = legacyRule(source.availability_rules, now);
    if (fallback) rulesInput = [fallback];
  }
  const rules = uniqueById(rulesInput.map(function (row, index) {
    return normalizeRule(row, index, now);
  }), 100);
  const exceptions = uniqueById((Array.isArray(source.schedule_exceptions) ? source.schedule_exceptions : [])
    .map(function (row, index) { return normalizeException(row, index, now); }), 500);
  const reminderPolicy = normalizeReminderPolicy(source.reminder_policy, null, now);
  const bookingPolicy = normalizeBookingPolicy(source.booking_policy || {
    default_duration_minutes: source.default_duration_minutes,
    buffer_minutes: source.buffer_minutes
  });
  const bookingRequirements = normalizeBookingRequirements(source.booking_requirements, source.required_booking_fields);
  const appointmentServices = normalizeAppointmentServices(source.appointment_services);
  return {
    version: APPOINTMENT_SETTINGS_VERSION,
    revision: integer(source.revision, 0, 0, Number.MAX_SAFE_INTEGER),
    scheduling_rules: rules,
    schedule_exceptions: exceptions,
    reminder_policy: reminderPolicy,
    booking_policy: bookingPolicy,
    booking_requirements: bookingRequirements,
    appointment_services: appointmentServices,
    required_booking_fields: compileBookingRequirements(bookingRequirements),
    default_duration_minutes: bookingPolicy.default_duration_minutes,
    buffer_minutes: bookingPolicy.buffer_minutes,
    availability_rules: compileAvailabilityRules(rules, exceptions, bookingPolicy),
    updated_at: iso(source.updated_at, now),
    updated_by: text(source.updated_by, 160)
  };
}

function appointmentSettingsFromOnboarding(onboarding, options) {
  const record = onboarding && typeof onboarding === "object" ? onboarding : {};
  const answers = record.answers && typeof record.answers === "object" ? record.answers : {};
  const answerSetup = answers.appointment_setup && typeof answers.appointment_setup === "object"
    ? answers.appointment_setup
    : {};
  const configuration = record.appointment_configuration && typeof record.appointment_configuration === "object"
    ? record.appointment_configuration
    : {};
  const source = Object.assign({}, configuration);
  if (!source.availability_rules) source.availability_rules = answerSetup.availability_rules;
  if (!Array.isArray(source.scheduling_rules) && Array.isArray(answerSetup.scheduling_rules)) {
    source.scheduling_rules = answerSetup.scheduling_rules;
  }
  if (!Array.isArray(source.schedule_exceptions) && Array.isArray(answerSetup.schedule_exceptions)) {
    source.schedule_exceptions = answerSetup.schedule_exceptions;
  }
  if (!source.booking_policy) {
    source.booking_policy = answerSetup.booking_policy || {
      default_duration_minutes: configuration.default_duration_minutes || answerSetup.default_duration_minutes,
      buffer_minutes: configuration.buffer_minutes || answerSetup.buffer_minutes
    };
  }
  if (!Array.isArray(source.booking_requirements)) source.booking_requirements = answerSetup.booking_requirements;
  if (!Array.isArray(source.appointment_services)) source.appointment_services = answerSetup.appointment_services;
  if (!source.required_booking_fields) source.required_booking_fields = answerSetup.required_booking_fields;
  if (!source.reminder_policy) {
    const channel = text(configuration.reminder_channel || answerSetup.reminder_channel, 40).toLowerCase();
    const timing = configuration.reminder_timing || answerSetup.reminder_timing;
    source.reminder_policy = {
      enabled: !!channel && channel !== "none",
      channel,
      offsets_minutes: timingOffsets(timing),
      retry_after_minutes: 120,
      max_attempts: 2,
      handoff_on_no_response: true
    };
  }
  return normalizeAppointmentSettings(source, options);
}

function updateAppointmentSettings(currentInput, patchInput, options) {
  const optionsValue = options || {};
  const current = normalizeAppointmentSettings(currentInput, optionsValue);
  const expected = optionsValue.expectedRevision == null
    ? current.revision
    : integer(optionsValue.expectedRevision, -1, -1, Number.MAX_SAFE_INTEGER);
  if (expected !== current.revision) {
    throw new AppointmentOperationsError("appointment_settings_revision_conflict", 409, {
      expected_revision: expected,
      current_revision: current.revision
    });
  }
  const patch = patchInput && typeof patchInput === "object" ? patchInput : {};
  const now = iso(optionsValue.now) || new Date().toISOString();
  const merged = {
    revision: current.revision + 1,
    scheduling_rules: Object.prototype.hasOwnProperty.call(patch, "scheduling_rules")
      ? patch.scheduling_rules
      : current.scheduling_rules,
    schedule_exceptions: Object.prototype.hasOwnProperty.call(patch, "schedule_exceptions")
      ? patch.schedule_exceptions
      : current.schedule_exceptions,
    booking_policy: normalizeBookingPolicy(patch.booking_policy, current.booking_policy),
    booking_requirements: Object.prototype.hasOwnProperty.call(patch, "booking_requirements")
      ? patch.booking_requirements
      : current.booking_requirements,
    appointment_services: Object.prototype.hasOwnProperty.call(patch, "appointment_services")
      ? patch.appointment_services
      : current.appointment_services,
    reminder_policy: normalizeReminderPolicy(patch.reminder_policy, current.reminder_policy, now),
    updated_at: now,
    updated_by: text(optionsValue.actor, 160)
  };
  const updated = normalizeAppointmentSettings(merged, { now });
  const invalidService = updated.appointment_services.map(validateAppointmentService).find(function (result) { return !result.ok; });
  if (invalidService) throw new AppointmentOperationsError(invalidService.error, 422, { appointment_service: invalidService.service || null });
  return updated;
}

function appointmentIdentity(appointment) {
  const source = appointment && typeof appointment === "object" ? appointment : {};
  return text(source.appointment_id || source.id || source.conversation_id, 160);
}

function customerConversationIdentity(appointment) {
  const source = appointment && typeof appointment === "object" ? appointment : {};
  const explicit = text(source.customer_conversation_id || source.conversation_user_id, 500);
  if (explicit) return explicit;
  const channel = text(source.channel, 40).toLowerCase();
  return ["whatsapp", "instagram", "messenger", "facebook"].includes(channel)
    ? text(source.conversation_id, 500)
    : "";
}

function reminderId(tenantId, appointmentId, startsAt, offsetMinutes) {
  return stableId("rem_", [tenantId, appointmentId, startsAt, offsetMinutes]);
}

function normalizeReminder(input) {
  const source = input && typeof input === "object" ? input : {};
  const normalizedStatus = text(source.status, 40).toLowerCase().replace(/[\s-]+/g, "_");
  const status = REMINDER_STATUSES.has(normalizedStatus) ? normalizedStatus : "scheduled";
  return Object.assign({}, source, {
    version: APPOINTMENT_REMINDER_VERSION,
    id: text(source.id, 120),
    tenant_id: tenant(source.tenant_id),
    appointment_id: text(source.appointment_id, 160),
    reminder_key: text(source.reminder_key || source.dedupe_key || source.id, 500),
    conversation_id: text(source.conversation_id || source.customer_conversation_id, 500),
    channel: REMINDER_CHANNELS.has(text(source.channel, 40).toLowerCase())
      ? text(source.channel, 40).toLowerCase()
      : "",
    offset_minutes: integer(source.offset_minutes, 0, 0, 60 * 24 * 30),
    scheduled_for: optionalIso(source.scheduled_for),
    status,
    attempts: integer(source.attempts, 0, 0, 100),
    created_at: iso(source.created_at) || new Date().toISOString(),
    updated_at: iso(source.updated_at) || new Date().toISOString()
  });
}

function materializeAppointmentReminders(appointmentInput, settingsInput, existingInput, options) {
  const appointment = appointmentInput && typeof appointmentInput === "object" ? appointmentInput : {};
  const settings = normalizeAppointmentSettings(settingsInput, options);
  const tenantId = tenant(appointment.tenant_id);
  const appointmentId = appointmentIdentity(appointment);
  const conversationId = customerConversationIdentity(appointment);
  const startsAt = iso(appointment.starts_at);
  if (!tenantId || !appointmentId) {
    throw new AppointmentOperationsError("appointment_reminder_scope_required", 422);
  }
  const now = iso(options && options.now) || new Date().toISOString();
  const existing = (Array.isArray(existingInput) ? existingInput : []).map(normalizeReminder).filter(function (row) {
    return row.tenant_id === tenantId && row.appointment_id === appointmentId;
  });
  const existingById = new Map(existing.map(function (row) { return [row.id, row]; }));
  const existingByKey = new Map(existing.map(function (row) { return [row.reminder_key, row]; }));
  const booked = ["booked", "rescheduled"].includes(text(appointment.status, 40));
  const policy = settings.reminder_policy;
  const expected = [];
  if (booked && startsAt && policy.enabled) {
    policy.offsets_minutes.forEach(function (offsetMinutes) {
      const id = reminderId(tenantId, appointmentId, startsAt, offsetMinutes);
      const key = [tenantId, appointmentId, startsAt, offsetMinutes].join(":");
      const previous = existingByKey.get(key) || existingById.get(id);
      const scheduledFor = new Date(new Date(startsAt).getTime() - offsetMinutes * 60 * 1000).toISOString();
      expected.push(normalizeReminder(Object.assign({}, previous || {}, {
        id,
        tenant_id: tenantId,
        appointment_id: appointmentId,
        conversation_id: conversationId,
        channel: policy.channel,
        offset_minutes: offsetMinutes,
        scheduled_for: scheduledFor,
        status: previous && previous.status || "scheduled",
        attempts: previous && previous.attempts || 0,
        reminder_key: key,
        created_at: previous && previous.created_at || now,
        updated_at: previous && previous.updated_at || now
      })));
    });
  }
  const expectedIds = new Set(expected.map(function (row) { return row.id; }));
  const expectedKeys = new Set(expected.map(function (row) { return row.reminder_key; }));
  const obsolete = existing.filter(function (row) {
    return !expectedIds.has(row.id) && !expectedKeys.has(row.reminder_key);
  }).map(function (row) {
    if (!REMINDER_ACTIVE_STATUSES.has(row.status)) return row;
    return normalizeReminder(Object.assign({}, row, {
      status: "cancelled",
      last_action: booked ? "appointment_rescheduled" : "appointment_cancelled",
      updated_at: now
    }));
  });
  return expected.concat(obsolete).sort(function (left, right) {
    return String(left.scheduled_for || "").localeCompare(String(right.scheduled_for || ""));
  });
}

function reminderTimingLabel(row, now) {
  const when = new Date(row && row.scheduled_for).getTime();
  const current = new Date(now || Date.now()).getTime();
  if (!Number.isFinite(when) || !Number.isFinite(current)) return "";
  const minutes = Math.round((when - current) / 60000);
  if (minutes > 24 * 60) return "En " + Math.ceil(minutes / (24 * 60)) + " días";
  if (minutes > 60) return "En " + Math.ceil(minutes / 60) + " h";
  if (minutes > 0) return "En " + minutes + " min";
  const ago = Math.abs(minutes);
  if (ago < 60) return "Hace " + ago + " min";
  if (ago < 24 * 60) return "Hace " + Math.floor(ago / 60) + " h";
  return "Hace " + Math.floor(ago / (24 * 60)) + " días";
}

function reminderSnapshot(recordsInput, options) {
  const now = iso(options && options.now) || new Date().toISOString();
  const tenantId = tenant(options && options.tenantId);
  const records = (Array.isArray(recordsInput) ? recordsInput : []).map(normalizeReminder).filter(function (row) {
    return !tenantId || row.tenant_id === tenantId;
  }).map(function (row) {
    const due = ["scheduled", "retrying", "failed"].includes(row.status) &&
      new Date(row.scheduled_for).getTime() <= new Date(now).getTime();
    return Object.assign({}, row, {
      due,
      group: REMINDER_ACTIVE_STATUSES.has(row.status) ? "upcoming" : "sent",
      timing: reminderTimingLabel(row, now)
    });
  }).sort(function (left, right) {
    return String(left.scheduled_for || "").localeCompare(String(right.scheduled_for || ""));
  });
  return {
    tenant_id: tenantId || null,
    count: records.length,
    due_count: records.filter(function (row) { return row.due; }).length,
    scheduled_count: records.filter(function (row) { return REMINDER_ACTIVE_STATUSES.has(row.status); }).length,
    sent_count: records.filter(function (row) { return REMINDER_TERMINAL_STATUSES.has(row.status) && row.status !== "cancelled"; }).length,
    needs_attention_count: records.filter(function (row) { return ["failed", "no_response"].includes(row.status); }).length,
    items: records
  };
}

function deriveAppointmentReminderStatus(recordsInput, options) {
  const snapshot = reminderSnapshot(recordsInput, options);
  const statuses = snapshot.items.map(function (row) { return row.status; });
  const precedence = [
    "sending", "retrying", "failed", "scheduled", "paused",
    "confirmed", "read", "delivered", "sent", "no_response", "cancelled"
  ];
  const rawStatus = precedence.find(function (status) { return statuses.includes(status); });
  const panelStatus = rawStatus === "scheduled" ? "programmed" : (rawStatus || "not_scheduled");
  const next = snapshot.items.find(function (row) {
    return ["scheduled", "retrying", "failed", "paused"].includes(row.status);
  });
  const activityTimes = snapshot.items.map(function (row) {
    return optionalIso(row.updated_at || row.last_action_at || row.scheduled_for);
  }).filter(Boolean).sort();
  return {
    status: panelStatus,
    next_scheduled_at: next && next.scheduled_for || null,
    last_activity_at: activityTimes.length ? activityTimes[activityTimes.length - 1] : null,
    due_count: snapshot.due_count,
    needs_attention: snapshot.needs_attention_count > 0,
    deliveries: snapshot.items
  };
}

function applyReminderAction(recordInput, actionInput, options) {
  const record = normalizeReminder(recordInput);
  const action = text(actionInput, 40).toLowerCase().replace(/[\s-]+/g, "_");
  const scopedTenant = tenant(options && options.tenantId);
  if (!record.id || !record.tenant_id || !record.appointment_id) {
    throw new AppointmentOperationsError("appointment_reminder_not_found", 404);
  }
  if (scopedTenant && scopedTenant !== record.tenant_id) {
    throw new AppointmentOperationsError("appointment_reminder_not_found", 404);
  }
  if (!REMINDER_ACTIONS.has(action)) {
    throw new AppointmentOperationsError("invalid_appointment_reminder_action", 400);
  }
  const allowed = {
    pause: ["scheduled", "retrying"],
    resume: ["paused"],
    send_now: ["scheduled", "paused", "retrying", "failed"],
    retry: ["failed", "no_response"]
  };
  if (!allowed[action].includes(record.status)) {
    throw new AppointmentOperationsError("appointment_reminder_action_not_allowed", 409, {
      action,
      status: record.status
    });
  }
  const now = iso(options && options.now) || new Date().toISOString();
  const status = action === "pause" ? "paused" : "scheduled";
  return normalizeReminder(Object.assign({}, record, {
    status,
    scheduled_for: action === "send_now" || action === "retry" ? now : record.scheduled_for,
    force_send: action === "send_now" || action === "retry",
    last_action: action,
    last_action_by: text(options && options.actor, 160),
    last_action_at: now,
    updated_at: now
  }));
}

module.exports = {
  APPOINTMENT_REMINDER_VERSION,
  APPOINTMENT_SETTINGS_VERSION,
  BOOKING_REQUIREMENT_TYPES,
  STANDARD_BOOKING_REQUIREMENTS,
  REMINDER_ACTIONS,
  REMINDER_ACTIVE_STATUSES,
  REMINDER_STATUSES,
  AppointmentOperationsError,
  applyReminderAction,
  appointmentSettingsFromOnboarding,
  compileAvailabilityRules,
  compileBookingRequirements,
  compileDepositPolicy,
  compileAppointmentServices,
  deriveAppointmentReminderStatus,
  evaluateScheduleException,
  materializeAppointmentReminders,
  normalizeAppointmentSettings,
  normalizeAppointmentServices,
  normalizeBookingPolicy,
  normalizeBookingRequirements,
  normalizeDepositPolicy,
  normalizeReminder,
  normalizeReminderPolicy,
  reminderId,
  reminderSnapshot,
  timingOffsets,
  updateAppointmentSettings,
  findAppointmentService,
  validateAppointmentService,
  validateDepositPolicy,
  validateBookingRequirements
};
