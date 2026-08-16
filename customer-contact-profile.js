"use strict";

const PROFILE_FIELDS = Object.freeze([
  "name",
  "phone",
  "email",
  "address",
  "address_line_2",
  "neighborhood",
  "city",
  "state",
  "postal_code",
  "country",
  "id_number",
  "delivery_instructions"
]);

const FIELD_LIMITS = Object.freeze({
  name: 160,
  phone: 80,
  email: 200,
  address: 500,
  address_line_2: 300,
  neighborhood: 160,
  city: 200,
  state: 200,
  postal_code: 40,
  country: 120,
  id_number: 80,
  delivery_instructions: 500
});

function cleanText(value, maximum) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum || 500);
}

function normalizeEmail(value) {
  const email = cleanText(value, FIELD_LIMITS.email).toLowerCase();
  if (!email) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizePhone(value) {
  const raw = cleanText(value, FIELD_LIMITS.phone);
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return (raw.startsWith("+") ? "+" : "") + digits;
}

function normalizeField(field, value) {
  if (field === "email") return normalizeEmail(value);
  if (field === "phone") return normalizePhone(value);
  return cleanText(value, FIELD_LIMITS[field]);
}

function emptyCustomerContactProfile() {
  const profile = { version: 1 };
  PROFILE_FIELDS.forEach(function (field) { profile[field] = ""; });
  return profile;
}

function normalizeCustomerContactProfile(value) {
  const input = value && typeof value === "object" ? value : {};
  const profile = emptyCustomerContactProfile();
  PROFILE_FIELDS.forEach(function (field) {
    const normalized = normalizeField(field, input[field]);
    profile[field] = normalized == null ? "" : normalized;
  });
  return profile;
}

function mergeCustomerContactProfile(current, patch, options) {
  const settings = options || {};
  const existing = normalizeCustomerContactProfile(current);
  const input = patch && typeof patch === "object" ? patch : {};
  const next = Object.assign({}, existing);
  const changedFields = [];
  const invalidFields = [];

  PROFILE_FIELDS.forEach(function (field) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) return;
    const normalized = normalizeField(field, input[field]);
    if (normalized == null) {
      invalidFields.push(field);
      return;
    }
    if (!normalized && settings.allowClear !== true) return;
    if (next[field] === normalized) return;
    next[field] = normalized;
    changedFields.push(field);
  });

  return {
    profile: next,
    changed: changedFields.length > 0,
    changed_fields: changedFields,
    invalid_fields: invalidFields
  };
}

function profilePatchFromCheckoutField(field, value) {
  const mapping = {
    nombre: "name",
    telefono: "phone",
    direccion: "address",
    cedula: "id_number"
  };
  const target = mapping[String(field || "")];
  return target ? { [target]: value } : {};
}

function profilePatchFromOrder(order) {
  const value = order && typeof order === "object" ? order : {};
  return {
    name: value.name,
    phone: value.phone,
    email: value.email,
    id_number: value.id_number,
    address: value.address,
    city: value.city,
    state: value.state || value.location,
    postal_code: value.postal_code,
    country: value.country,
    delivery_instructions: value.delivery_instructions
  };
}

function profilePatchFromAppointment(appointment) {
  const value = appointment && typeof appointment === "object" ? appointment : {};
  return {
    name: value.customer_name,
    phone: value.customer_phone,
    email: value.customer_email
  };
}

function buildCustomerContactContext(value, options) {
  const profile = normalizeCustomerContactProfile(value);
  const input = options && typeof options === "object" ? options : {};
  const appointmentMode = input.appointmentMode === true;
  const fields = ["name", "phone", "email"];
  const labels = {
    name: "Nombre",
    phone: "Teléfono",
    email: "Correo"
  };
  const known = fields.filter(function (field) { return !!profile[field]; });
  if (!known.length) return "";
  const lines = [
    "DATOS DE CONTACTO YA CONFIRMADOS PARA ESTE CLIENTE:",
    ...known.map(function (field) { return "- " + labels[field] + ": " + profile[field]; }),
    "REGLAS PARA EVITAR PREGUNTAS REPETIDAS:",
    "- Los campos listados arriba ya fueron entregados y confirmados. No vuelvas a pedirlos.",
    "- Antes de hacer una pregunta, revisa estos datos y toda la conversación actual; pregunta únicamente un campo obligatorio que aún falte.",
    "- Si el cliente corrige un dato, usa save_customer_profile y reemplaza el valor anterior.",
    "- No menciones que existe una base de datos ni enumeres datos personales salvo en el resumen final solicitado por el cliente."
  ];
  if (appointmentMode && input.channel === "whatsapp" && profile.phone) {
    lines.push("- El teléfono de WhatsApp ya sirve como número de contacto. Solo pide otro si el cliente solicita usar uno diferente.");
  }
  return lines.join("\n");
}

module.exports = {
  PROFILE_FIELDS,
  buildCustomerContactContext,
  emptyCustomerContactProfile,
  mergeCustomerContactProfile,
  normalizeCustomerContactProfile,
  profilePatchFromAppointment,
  profilePatchFromCheckoutField,
  profilePatchFromOrder
};
