"use strict";

const assert = require("assert");
const {
  CatalogError,
  InMemoryCatalogStore,
  SupabaseCatalogStore,
  contractedPriceSnapshot,
  createCatalogService,
  formatCop,
  normalizeStatus,
  slugify,
  validateBotInput,
  validatePlanInput
} = require("./platform-catalogs");

// ─── Normalización de entrada ───────────────────────────────────────────────

assert.strictEqual(slugify("Bot Agendamiento de Citas"), "bot-agendamiento-de-citas");
assert.strictEqual(slugify("Atención al Cliente"), "atencion-al-cliente");

// Setup cost fue eliminado comercialmente. El campo sigue en el contrato, pero
// siempre se normaliza a 0 para no revivir cobros viejos desde el formulario.
["990000", "990.000", "$990.000", " 990,000 "].forEach(function (input) {
  assert.strictEqual(validatePlanInput({ nombre: "Plan", precio_setup: input }).precio_setup, 0, "precio: " + input);
});

// Precios en enteros, sin decimales: es el contrato congelado.
const plan = validatePlanInput({
  nombre: "Bot Agendamiento de citas",
  precio_setup: "$990.000",
  precio_mensual: "299.900",
  beneficios: "Atención 24/7\nReportes\n\n  \nConfirmación automática",
  chats_incluidos: "",
  etiqueta: "Mejor valor"
});
assert.strictEqual(plan.id, "bot-agendamiento-de-citas");
assert.strictEqual(plan.precio_setup, 0);
assert.strictEqual(plan.precio_mensual, 299900);
assert.strictEqual(plan.chats_incluidos, null, "vacío significa 'por definir', no cero");
assert.deepStrictEqual(plan.beneficios, ["Atención 24/7", "Reportes", "Confirmación automática"]);
assert.strictEqual(plan.etiqueta, "Mejor valor");

assert.throws(function () { validatePlanInput({ nombre: "X" }); }, function (error) {
  return error instanceof CatalogError && error.code === "plan_name_required";
}, "un nombre de una sola letra no alcanza");
assert.throws(function () { validatePlanInput({ nombre: "Plan", id: "MAYÚSCULAS!" }); }, /invalid_plan_id/);
assert.throws(function () { validatePlanInput({ nombre: "Plan", precio_mensual: "-500" }); }, /invalid_price/);
assert.throws(function () { validateBotInput({ nombre: "" }); }, /bot_name_required/);

// Formateo de presentación: nunca se guarda formateado.
assert.strictEqual(formatCop(990000), "$990.000");
assert.strictEqual(formatCop(299900), "$299.900");
assert.strictEqual(formatCop(null), "—");

// Estados heredados de la migración anterior se leen como los nuevos.
assert.strictEqual(normalizeStatus("live"), "activo");
assert.strictEqual(normalizeStatus("paused"), "suspendido");
assert.strictEqual(normalizeStatus("suspendido"), "suspendido");
assert.strictEqual(normalizeStatus("cualquier-cosa"), null);

// ─── Snapshot de precio contratado ──────────────────────────────────────────

const snapshot = contractedPriceSnapshot({ precio_setup: 990000, precio_mensual: 299900 }, new Date("2026-07-22T10:00:00Z"));
assert.strictEqual(snapshot.precio_setup_contratado, 0);
assert.strictEqual(snapshot.precio_mensual_contratado, 299900);
assert.strictEqual(snapshot.plan_contratado_en, "2026-07-22T10:00:00.000Z");

// ─── Servicio ───────────────────────────────────────────────────────────────

(async function () {
  const store = new InMemoryCatalogStore();
  const service = createCatalogService({ store: store });
  const actor = { username: "santiago", role: "super_admin" };

  // Crear y editar planes.
  await service.upsertPlan({
    nombre: "Nextfor Dúo", descripcion: "Atención y agendamiento juntos",
    bot_id: "agendamiento", precio_setup: "1.490.000", precio_mensual: "499900",
    beneficios: "Los dos bots\nUn solo número", etiqueta: "Mejor valor", orden: 4
  }, actor);

  let admin = await service.adminCatalogs();
  const duo = admin.plans.find(function (row) { return row.id === "nextfor-duo"; });
  assert.ok(duo, "el plan nuevo aparece en el catálogo de administración");
  assert.strictEqual(duo.precio_setup, 0);
  assert.strictEqual(duo.activo, true, "un plan nuevo nace activo");

  // Un bot inexistente se rechaza: el plan no puede apuntar al vacío.
  await assert.rejects(function () {
    return service.upsertPlan({ nombre: "Roto", bot_id: "no-existe" }, actor);
  }, /invalid_bot_id/);

  // Desactivar saca el plan de la oferta pero no lo borra.
  await service.togglePlan("nextfor-duo", false, actor);
  const activos = await service.activeCatalogs();
  assert.ok(!activos.plans.some(function (row) { return row.id === "nextfor-duo"; }), "un plan inactivo no se ofrece");
  admin = await service.adminCatalogs();
  assert.ok(admin.plans.some(function (row) { return row.id === "nextfor-duo"; }), "pero sigue visible para reactivarlo");

  await assert.rejects(function () { return service.togglePlan("fantasma", false, actor); }, /plan_not_found/);

  // El catálogo activo sale ordenado por 'orden'.
  const ordenados = (await service.activeCatalogs()).plans.map(function (row) { return row.orden; });
  assert.deepStrictEqual(ordenados.slice().sort(function (a, b) { return a - b; }), ordenados, "el catálogo respeta el orden");

  // ─── Ciclo de vida ────────────────────────────────────────────────────────

  store.seedTenant({ id: "panaderia-espiga", company_name: "Panadería La Espiga", status: "activo" });

  const tenants = await service.listTenants();
  assert.strictEqual(tenants.length, 1);
  assert.strictEqual(tenants[0].status, "activo");

  const selected = await service.selectTenantPlan("panaderia-espiga", "nextfor-atlas", "atencion-cliente", { username: "duenio@espiga.example" });
  assert.strictEqual(selected.plan_id, "nextfor-atlas", "el cliente puede elegir directamente un plan activo");

  // Supabase puede devolver 204/sin representación aunque el PATCH haya aplicado.
  // En ese caso la app lee el tenant actualizado antes de bloquear el onboarding.
  const calls = [];
  const supabaseStore = new SupabaseCatalogStore({
    url: "https://supabase.example",
    headers: { apikey: "service-role-test" },
    axiosClient: {
      patch: async function (url, body, options) {
        calls.push({ method: "patch", url: url, body: body, params: options.params });
        return { data: null };
      },
      get: async function (url, options) {
        calls.push({ method: "get", url: url, params: options.params });
        return { data: [{ id: "panaderia-espiga", company_name: "Panadería La Espiga", plan_id: "scale", assigned_bot_id: "atencion-cliente", status: "activo", updated_at: "2026-07-24T00:00:00.000Z" }] };
      }
    }
  });
  const persistedSelection = await supabaseStore.selectTenantPlan("panaderia-espiga", "scale", "duenio@espiga.example");
  assert.strictEqual(persistedSelection.plan_id, "scale");
  assert.deepStrictEqual(calls.map(function (call) { return call.method; }), ["patch", "get"]);

  await service.upsertPlan({ id: "solo-agenda", nombre: "Solo agenda", bot_id: "agendamiento" }, actor);
  await assert.rejects(function () {
    return service.selectTenantPlan("panaderia-espiga", "solo-agenda", "atencion-cliente", { username: "duenio@espiga.example" });
  }, /invalid_plan_for_bot/, "no se ofrecen planes de un bot diferente");

  await assert.rejects(function () {
    return service.setTenantStatus("panaderia-espiga", "borrado", actor);
  }, /invalid_status/, "solo se aceptan los cuatro estados del contrato");

  // El nombre de la empresa debe coincidir exactamente.
  await assert.rejects(function () {
    return service.deleteTenant({
      tenant_id: "panaderia-espiga",
      company_name_confirmacion: "Panaderia La Espiga",
      confirmacion_final: true
    }, actor);
  }, /company_name_mismatch/, "salvaguarda 1: el nombre debe coincidir");

  // Falta la confirmación final explícita.
  await assert.rejects(function () {
    return service.deleteTenant({
      tenant_id: "panaderia-espiga",
      company_name_confirmacion: "Panadería La Espiga"
    }, actor);
  }, /final_confirmation_required/, "salvaguarda 2: confirmación explícita");

  // Con las salvaguardas cumplidas: suspende automáticamente, borra y devuelve respaldo.
  const outcome = await service.deleteTenant({
    tenant_id: "panaderia-espiga",
    company_name_confirmacion: "Panadería La Espiga",
    confirmacion_final: true
  }, actor);
  assert.strictEqual(outcome.result.ok, true);
  assert.ok(outcome.backup, "el borrado siempre devuelve un respaldo");
  assert.strictEqual(outcome.backup.tenant.company_name, "Panadería La Espiga");
  assert.strictEqual((await service.listTenants()).length, 0);

  // La auditoría deja constancia de quién hizo qué.
  const acciones = store.audit.map(function (row) { return row.action; });
  ["plan_upserted", "plan_toggled", "tenant_status_changed", "tenant_deleted"].forEach(function (action) {
    assert.ok(acciones.indexOf(action) >= 0, "auditoría registra " + action);
  });
  assert.ok(store.audit.every(function (row) {
    return row.action === "customer_plan_selected"
      ? row.actor === "duenio@espiga.example"
      : row.actor === "santiago";
  }), "la auditoría guarda el actor de plataforma o cliente según la acción");

  await assert.rejects(function () { return service.tenantBackup("no-existe"); }, /tenant_not_found/);

  console.log("platform-catalogs.test.js: ok");
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
