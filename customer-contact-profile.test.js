"use strict";

const assert = require("assert");
const {
  buildCustomerContactContext,
  mergeCustomerContactProfile,
  normalizeCustomerContactProfile,
  profilePatchFromAppointment,
  profilePatchFromCheckoutField,
  profilePatchFromOrder
} = require("./customer-contact-profile");

(function normalizesContactData() {
  const profile = normalizeCustomerContactProfile({
    name: "  Ana   Pérez  ",
    phone: "+57 (301) 555-0101",
    email: " ANA@EXAMPLE.COM "
  });
  assert.strictEqual(profile.name, "Ana Pérez");
  assert.strictEqual(profile.phone, "+573015550101");
  assert.strictEqual(profile.email, "ana@example.com");
})();

(function mergesOnlyProvidedFields() {
  const result = mergeCustomerContactProfile({
    name: "Ana Pérez",
    phone: "+573015550101",
    city: "Medellín"
  }, { email: "ana@example.com" });
  assert.strictEqual(result.profile.name, "Ana Pérez");
  assert.strictEqual(result.profile.phone, "+573015550101");
  assert.strictEqual(result.profile.city, "Medellín");
  assert.strictEqual(result.profile.email, "ana@example.com");
  assert.deepStrictEqual(result.changed_fields, ["email"]);
})();

(function rejectsInvalidContactValuesWithoutDeletingCurrentData() {
  const result = mergeCustomerContactProfile({ email: "ana@example.com", phone: "+573015550101" }, {
    email: "no-es-correo",
    phone: "12"
  });
  assert.strictEqual(result.profile.email, "ana@example.com");
  assert.strictEqual(result.profile.phone, "+573015550101");
  assert.deepStrictEqual(result.invalid_fields, ["phone", "email"]);
})();

(function allowsIntentionalPanelClears() {
  const result = mergeCustomerContactProfile({ address: "Calle 1", city: "Bogotá" }, { address: "" }, { allowClear: true });
  assert.strictEqual(result.profile.address, "");
  assert.strictEqual(result.profile.city, "Bogotá");
})();

(function mapsOperationalSources() {
  assert.deepStrictEqual(profilePatchFromCheckoutField("direccion", "Calle 10"), { address: "Calle 10" });
  assert.strictEqual(profilePatchFromOrder({ name: "Lina", city: "Cali" }).city, "Cali");
  assert.strictEqual(profilePatchFromAppointment({ customer_email: "lina@example.com" }).email, "lina@example.com");
})();

(function buildsNoRepeatAppointmentContext() {
  const context = buildCustomerContactContext({
    name: "Santiago",
    phone: "+573000000000",
    email: "santiago@example.com"
  }, { appointmentMode: true, channel: "whatsapp" });
  assert.ok(context.includes("Nombre: Santiago"));
  assert.ok(context.includes("Correo: santiago@example.com"));
  assert.ok(context.includes("No vuelvas a pedirlos"));
  assert.ok(context.includes("El teléfono de WhatsApp ya sirve como número de contacto"));
})();

console.log("customer-contact-profile tests passed");
