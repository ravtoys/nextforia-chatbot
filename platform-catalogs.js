"use strict";

// Catálogo editable de planes y bots + ciclo de vida del cliente.
//
// Contrato CONGELADO (el agente de Panel de Cliente construye contra esto):
//   plan: id, nombre, descripcion, bot_id, precio_setup, precio_mensual,
//         chats_incluidos, beneficios[], etiqueta, activo, orden
//   bot:  id, nombre, descripcion, activo, orden
//
// Precios en pesos colombianos, ENTEROS, sin decimales. El formateo ($990.000)
// se hace al mostrar, nunca al guardar.

const crypto = require("crypto");

class CatalogError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status || 400;
  }
}

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const TENANT_STATUSES = ["setup", "activo", "suspendido", "archivado"];
// Estados heredados de la migración anterior. Se leen, no se escriben.
const LEGACY_STATUS_ALIASES = { live: "activo", paused: "suspendido", pilot: "setup" };
const NEXTFOR_PRICING_JULY_2026 = [
  {
    id: "nextfor-uno",
    nombre: "Nextfor Uno",
    descripcion: "El primer paso para dejar de hacerlo todo tú: atención automática por WhatsApp 24/7.",
    bot_id: "atencion-cliente",
    precio_setup: 0,
    precio_mensual: 49900,
    chats_incluidos: null,
    beneficios: ["Atención automática por WhatsApp", "Respuestas sobre productos, horarios y ubicación", "Captura de interesados", "Panel básico de conversaciones"],
    etiqueta: "Desde $49.900",
    activo: true,
    orden: 1
  },
  {
    id: "nextfor-aura",
    nombre: "Nextfor Aura",
    descripcion: "Tu negocio siempre presente: atiende, orienta y vende por tus canales 24/7.",
    bot_id: "atencion-cliente",
    precio_setup: 0,
    precio_mensual: 299900,
    chats_incluidos: null,
    beneficios: ["Atiende como tu mejor colaborador", "Convierte conversaciones en ventas", "Conecta tienda, productos y pedidos", "Métricas desde el panel"],
    etiqueta: "Atención + ventas",
    activo: true,
    orden: 2
  },
  {
    id: "nextfor-tempo",
    nombre: "Nextfor Tempo",
    descripcion: "Más citas y reservas, menos tiempo coordinando: agenda y confirma 24/7.",
    bot_id: "agendamiento",
    precio_setup: 0,
    precio_mensual: 299900,
    chats_incluidos: null,
    beneficios: ["Agenda 24/7", "Reprograma, cancela y confirma", "Recordatorios", "Conexión con calendario"],
    etiqueta: "Agendamiento",
    activo: true,
    orden: 3
  },
  {
    id: "nextfor-atlas",
    nombre: "Nextfor Atlas",
    descripcion: "Atiende, vende y agenda en un solo lugar.",
    bot_id: null,
    precio_setup: 0,
    precio_mensual: 499900,
    chats_incluidos: null,
    beneficios: ["Atiende y vende 24/7", "Gestiona citas o reservas", "Integra tienda y calendarios", "Reportes de ventas, citas y conversaciones"],
    etiqueta: "Todo en uno",
    activo: true,
    orden: 4
  },
  {
    id: "nextfor-signature",
    nombre: "Nextfor Signature",
    descripcion: "Solución a la medida de cada empresa, con procesos, canales e integraciones personalizados.",
    bot_id: null,
    precio_setup: 0,
    precio_mensual: 0,
    chats_incluidos: null,
    beneficios: ["Propuesta personalizada", "Integraciones a medida", "Alcance definido con el cliente"],
    etiqueta: "A definir",
    activo: true,
    orden: 5
  }
];

function text(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max || 500);
}

function slugify(value) {
  return String(value == null ? "" : value)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 63);
}

// Los precios llegan del formulario como texto ("990.000", "990000", "$990.000").
// Se aceptan separadores de miles porque es lo que la gente escribe.
function intOrNull(value) {
  if (value == null || value === "") return null;
  const digits = String(value).replace(/[^\d-]/g, "");
  if (!digits || digits === "-") return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrZero(value) {
  const parsed = intOrNull(value);
  return parsed == null ? 0 : parsed;
}

function benefits(value) {
  const list = Array.isArray(value)
    ? value
    : String(value == null ? "" : value).split(/\r?\n/);
  return list.map(function (item) { return text(item, 160); })
    .filter(function (item) { return item.length > 0; })
    .slice(0, 20);
}

function validatePlanInput(input) {
  input = input || {};
  const nombre = text(input.nombre || input.name, 120);
  if (nombre.length < 2) throw new CatalogError("plan_name_required", 400);

  const id = text(input.id, 64).toLowerCase() || slugify(nombre);
  if (!ID_PATTERN.test(id)) throw new CatalogError("invalid_plan_id", 400);

  const botId = text(input.bot_id, 64).toLowerCase();
  if (botId && !ID_PATTERN.test(botId)) throw new CatalogError("invalid_bot_id", 400);

  // NextforIA ya no cobra setup cost. Conservamos el campo por compatibilidad
  // del contrato/API, pero siempre se guarda en 0.
  const precioSetup = 0;
  const precioMensual = intOrZero(input.precio_mensual);
  if (precioSetup < 0 || precioMensual < 0) throw new CatalogError("invalid_price", 400);

  const chats = intOrNull(input.chats_incluidos);
  if (chats != null && chats < 0) throw new CatalogError("invalid_included_chats", 400);

  return {
    id: id,
    nombre: nombre,
    descripcion: text(input.descripcion, 400),
    bot_id: botId || null,
    precio_setup: precioSetup,
    precio_mensual: precioMensual,
    chats_incluidos: chats,
    beneficios: benefits(input.beneficios),
    etiqueta: text(input.etiqueta, 40) || null,
    orden: intOrZero(input.orden)
  };
}

function validateBotInput(input) {
  input = input || {};
  const nombre = text(input.nombre || input.name, 120);
  if (nombre.length < 2) throw new CatalogError("bot_name_required", 400);

  const id = text(input.id, 64).toLowerCase() || slugify(nombre);
  if (!ID_PATTERN.test(id)) throw new CatalogError("invalid_bot_id", 400);

  return {
    id: id,
    nombre: nombre,
    descripcion: text(input.descripcion, 400),
    orden: intOrZero(input.orden)
  };
}

function normalizeStatus(value) {
  const clean = text(value, 32).toLowerCase();
  if (LEGACY_STATUS_ALIASES[clean]) return LEGACY_STATUS_ALIASES[clean];
  return TENANT_STATUSES.indexOf(clean) >= 0 ? clean : null;
}

function actorLabel(actor) {
  if (!actor) return "super_admin";
  return String(actor.user_id || actor.email || actor.username || "super_admin").slice(0, 160);
}

function mapStoreError(error) {
  if (error instanceof CatalogError) return error;
  const message = String(error && (error.message || error.code || error) || "");
  if (/PLAN_NOT_FOUND/.test(message)) return new CatalogError("plan_not_found", 404);
  if (/TENANT_NOT_FOUND/.test(message)) return new CatalogError("tenant_not_found", 404);
  if (/TENANT_NOT_SUSPENDED/.test(message)) return new CatalogError("tenant_not_suspended", 409);
  if (/COMPANY_NAME_MISMATCH/.test(message)) return new CatalogError("company_name_mismatch", 400);
  if (/INVALID_STATUS/.test(message)) return new CatalogError("invalid_status", 400);
  if (/INVALID_BOT/.test(message)) return new CatalogError("invalid_bot_id", 400);
  if (/INVALID_PLAN_FOR_BOT/.test(message)) return new CatalogError("invalid_plan_for_bot", 400);
  if (/PLATFORM_SERVICE_ROLE_REQUIRED/.test(message)) return new CatalogError("catalog_unavailable", 503);
  return new CatalogError("catalog_unavailable", 503);
}

// ─── Almacén Supabase ───────────────────────────────────────────────────────

class SupabaseCatalogStore {
  constructor(options) {
    this.url = String(options.url || "").replace(/\/$/, "");
    this.headers = Object.assign({}, options.headers || {});
    this.axios = options.axiosClient;
  }

  async rpc(name, payload) {
    try {
      const response = await this.axios.post(this.url + "/rest/v1/rpc/" + name, payload, {
        headers: Object.assign({ Prefer: "return=representation" }, this.headers),
        timeout: 8000
      });
      return Array.isArray(response.data) ? response.data : response.data == null ? [] : [response.data];
    } catch (error) {
      throw mapStoreError((error && error.response && error.response.data) || error);
    }
  }

  async adminCatalogs() {
    const rows = await this.rpc("platform_catalogs_admin_v1", {});
    const payload = rows[0] || {};
    return { plans: payload.plans || [], bots: payload.bots || [] };
  }

  async activeCatalogs() {
    const rows = await this.rpc("platform_customer_access_catalogs_v2", {});
    const payload = rows[0] || {};
    return { plans: payload.plans || [], bots: payload.bots || [] };
  }

  async upsertPlan(plan, actor) {
    const rows = await this.rpc("platform_upsert_plan_v1", {
      p_id: plan.id,
      p_nombre: plan.nombre,
      p_descripcion: plan.descripcion,
      p_bot_id: plan.bot_id,
      p_precio_setup: plan.precio_setup,
      p_precio_mensual: plan.precio_mensual,
      p_chats_incluidos: plan.chats_incluidos,
      p_beneficios: plan.beneficios,
      p_etiqueta: plan.etiqueta,
      p_orden: plan.orden,
      p_actor: actor
    });
    return rows[0] || null;
  }

  async upsertBot(bot, actor) {
    const rows = await this.rpc("platform_upsert_bot_v1", {
      p_id: bot.id,
      p_nombre: bot.nombre,
      p_descripcion: bot.descripcion,
      p_orden: bot.orden,
      p_actor: actor
    });
    return rows[0] || null;
  }

  async togglePlan(id, activo, actor) {
    const rows = await this.rpc("platform_toggle_plan_v1", { p_id: id, p_activo: activo, p_actor: actor });
    return rows[0] || null;
  }

  async listTenants() {
    const rows = await this.rpc("platform_list_tenants_v1", {});
    if (rows.length && rows.every(function (row) {
      return row && typeof row === "object" && !Array.isArray(row) && row.id;
    })) {
      return rows;
    }
    const payload = rows[0];
    return Array.isArray(payload) ? payload : [];
  }

  async setTenantStatus(tenantId, status, actor) {
    const rows = await this.rpc("platform_set_tenant_status_v1", {
      p_tenant_id: tenantId, p_status: status, p_actor: actor
    });
    return rows[0] || null;
  }

  async selectTenantPlan(tenantId, planId, assignedBotId) {
    try {
      const response = await this.axios.patch(this.url + "/rest/v1/tenants", {
        plan_id: planId,
        assigned_bot_id: assignedBotId,
        updated_at: new Date().toISOString()
      }, {
        params: { id: "eq." + tenantId, select: "id,company_name,plan_id,assigned_bot_id,status,updated_at" },
        headers: Object.assign({ Prefer: "return=representation" }, this.headers),
        timeout: 8000
      });
      let tenant = Array.isArray(response.data) ? response.data[0] : null;
      if (!tenant) tenant = await this.getTenant(tenantId);
      if (!tenant || tenant.id !== tenantId) throw new CatalogError("tenant_not_found", 404);
      return tenant;
    } catch (error) {
      throw mapStoreError((error && error.response && error.response.data) || error);
    }
  }

  async getTenant(tenantId) {
    try {
      const response = await this.axios.get(this.url + "/rest/v1/tenants", {
        params: {
          select: "id,company_name,plan_id,assigned_bot_id,status,updated_at",
          id: "eq." + tenantId,
          limit: 1
        },
        headers: this.headers,
        timeout: 8000
      });
      return Array.isArray(response.data) ? response.data[0] || null : null;
    } catch (error) {
      throw mapStoreError((error && error.response && error.response.data) || error);
    }
  }

  async tenantBackup(tenantId) {
    const rows = await this.rpc("platform_tenant_backup_v1", { p_tenant_id: tenantId });
    return rows[0] || null;
  }

  async deleteTenant(tenantId, companyNameConfirmation, actor) {
    const rows = await this.rpc("platform_delete_tenant_v1", {
      p_tenant_id: tenantId,
      p_company_name_confirmacion: companyNameConfirmation,
      p_actor: actor
    });
    return rows[0] || null;
  }
}

// ─── Almacén en memoria (pruebas y modo test) ───────────────────────────────

class InMemoryCatalogStore {
  constructor(options) {
    options = options || {};
    this.plans = options.plans || NEXTFOR_PRICING_JULY_2026.map(function (plan) {
      return Object.assign({}, plan);
    });
    this.bots = options.bots || [
      { id: "atencion-cliente", nombre: "Atención al cliente", descripcion: "", activo: true, orden: 1 },
      { id: "agendamiento", nombre: "Agendamiento", descripcion: "", activo: true, orden: 2 },
      { id: "commerce", nombre: "Commerce", descripcion: "", activo: true, orden: 3 }
    ];
    // En producción el catálogo y el acceso de clientes leen las mismas tablas de
    // Supabase. En modo test hay dos almacenes en memoria distintos, así que este
    // se apoya en el de customer access para que los clientes creados por una
    // invitación se vean acá también. Sin esto, el modo test mentiría.
    this.accessStore = options.accessStore || null;
    this.ownTenants = options.tenants || [];
    this.audit = [];
  }

  get tenants() {
    return this.accessStore && Array.isArray(this.accessStore.tenants)
      ? this.accessStore.tenants
      : this.ownTenants;
  }

  get users() {
    return this.accessStore && Array.isArray(this.accessStore.users) ? this.accessStore.users : [];
  }

  seedTenant(tenant) {
    (this.accessStore && Array.isArray(this.accessStore.tenants) ? this.accessStore.tenants : this.ownTenants).push(Object.assign({
      id: "demo", company_name: "Demo", plan_id: "growth", assigned_bot_id: "atencion-cliente",
      status: "setup", created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }, tenant || {}));
    return this.tenants[this.tenants.length - 1];
  }

  byOrder(list) {
    return list.slice().sort(function (a, b) { return (a.orden - b.orden) || String(a.id).localeCompare(String(b.id)); });
  }

  async adminCatalogs() {
    return { plans: this.byOrder(this.plans), bots: this.byOrder(this.bots) };
  }

  async activeCatalogs() {
    return {
      plans: this.byOrder(this.plans.filter(function (row) { return row.activo; })),
      bots: this.byOrder(this.bots.filter(function (row) { return row.activo; }))
    };
  }

  async upsertPlan(plan, actor) {
    if (plan.bot_id && !this.bots.some(function (row) { return row.id === plan.bot_id; })) {
      throw new CatalogError("invalid_bot_id", 400);
    }
    const existing = this.plans.find(function (row) { return row.id === plan.id; });
    const merged = Object.assign({ activo: existing ? existing.activo : true }, existing || {}, plan);
    if (existing) Object.assign(existing, merged); else this.plans.push(merged);
    this.audit.push({ actor: actor, action: "plan_upserted", plan_id: plan.id });
    return merged;
  }

  async upsertBot(bot, actor) {
    const existing = this.bots.find(function (row) { return row.id === bot.id; });
    const merged = Object.assign({ activo: existing ? existing.activo : true }, existing || {}, bot);
    if (existing) Object.assign(existing, merged); else this.bots.push(merged);
    this.audit.push({ actor: actor, action: "bot_upserted", bot_id: bot.id });
    return merged;
  }

  async togglePlan(id, activo, actor) {
    const plan = this.plans.find(function (row) { return row.id === id; });
    if (!plan) throw new CatalogError("plan_not_found", 404);
    plan.activo = !!activo;
    this.audit.push({ actor: actor, action: "plan_toggled", plan_id: id, activo: plan.activo });
    return plan;
  }

  async listTenants() {
    const users = this.users;
    return this.tenants.map(function (tenant) {
      return Object.assign({}, tenant, {
        usuarios_activos: users.filter(function (user) { return user.tenant_id === tenant.id && user.active; }).length
      });
    });
  }

  async setTenantStatus(tenantId, status, actor) {
    const tenant = this.tenants.find(function (row) { return row.id === tenantId; });
    if (!tenant) throw new CatalogError("tenant_not_found", 404);
    const previous = tenant.status;
    tenant.status = status;
    tenant.updated_at = new Date().toISOString();
    // Suspender corta el acceso; reactivar lo devuelve. Los datos nunca se tocan.
    this.users.forEach(function (user) {
      if (user.tenant_id !== tenantId) return;
      if (status === "suspendido" || status === "archivado") user.active = false;
      else if (status === "activo" && user.status === "active") user.active = true;
    });
    this.audit.push({ actor: actor, action: "tenant_status_changed", tenant_id: tenantId, anterior: previous, nuevo: status });
    return tenant;
  }

  async selectTenantPlan(tenantId, planId, assignedBotId, actor) {
    const tenant = this.tenants.find(function (row) { return row.id === tenantId; });
    if (!tenant) throw new CatalogError("tenant_not_found", 404);
    tenant.plan_id = planId;
    tenant.assigned_bot_id = assignedBotId;
    tenant.updated_at = new Date().toISOString();
    this.audit.push({
      actor: actor,
      action: "customer_plan_selected",
      tenant_id: tenantId,
      plan_id: planId,
      assigned_bot_id: assignedBotId
    });
    return tenant;
  }

  async tenantBackup(tenantId) {
    const tenant = this.tenants.find(function (row) { return row.id === tenantId; });
    if (!tenant) throw new CatalogError("tenant_not_found", 404);
    return { generado_en: new Date().toISOString(), tenant: tenant, usuarios: [], invitaciones: [], auditoria: [] };
  }

  async deleteTenant(tenantId, companyNameConfirmation, actor) {
    const index = this.tenants.findIndex(function (row) { return row.id === tenantId; });
    if (index < 0) throw new CatalogError("tenant_not_found", 404);
    const tenant = this.tenants[index];
    if (["suspendido", "archivado"].indexOf(tenant.status) < 0) throw new CatalogError("tenant_not_suspended", 409);
    if (String(companyNameConfirmation || "").trim() !== String(tenant.company_name).trim()) {
      throw new CatalogError("company_name_mismatch", 400);
    }
    this.tenants.splice(index, 1);
    if (this.accessStore) {
      ["users", "invitations"].forEach(function (key) {
        if (!Array.isArray(this.accessStore[key])) return;
        this.accessStore[key] = this.accessStore[key].filter(function (row) { return row.tenant_id !== tenantId; });
      }, this);
    }
    this.audit.push({ actor: actor, action: "tenant_deleted", tenant_id: tenantId, company_name: tenant.company_name });
    return { ok: true, tenant_id: tenantId, company_name: tenant.company_name };
  }
}

// ─── Servicio ───────────────────────────────────────────────────────────────

function createCatalogService(options) {
  const store = (options || {}).store;

  return {
    // Catálogo completo, incluye inactivos. Solo para la pantalla de administración.
    async adminCatalogs() {
      try { return await store.adminCatalogs(); }
      catch (error) { throw mapStoreError(error); }
    },

    // Solo activos. Es lo que consume el Panel de Cliente.
    async activeCatalogs() {
      try { return await store.activeCatalogs(); }
      catch (error) { throw mapStoreError(error); }
    },

    async upsertPlan(input, actor) {
      const clean = validatePlanInput(input);
      try { return await store.upsertPlan(clean, actorLabel(actor)); }
      catch (error) { throw mapStoreError(error); }
    },

    async upsertBot(input, actor) {
      const clean = validateBotInput(input);
      try { return await store.upsertBot(clean, actorLabel(actor)); }
      catch (error) { throw mapStoreError(error); }
    },

    async togglePlan(id, activo, actor) {
      const clean = text(id, 64).toLowerCase();
      if (!ID_PATTERN.test(clean)) throw new CatalogError("invalid_plan_id", 400);
      try { return await store.togglePlan(clean, !!activo, actorLabel(actor)); }
      catch (error) { throw mapStoreError(error); }
    },

    // Clientes con su estado y el precio que tienen contratado.
    async listTenants() {
      let rows;
      try { rows = await store.listTenants(); }
      catch (error) { throw mapStoreError(error); }
      return (rows || []).map(function (row) {
        return Object.assign({}, row, { status: normalizeStatus(row.status) || row.status });
      });
    },

    async setTenantStatus(tenantId, status, actor) {
      const cleanTenant = text(tenantId, 64).toLowerCase();
      if (!cleanTenant) throw new CatalogError("tenant_not_found", 404);
      const cleanStatus = normalizeStatus(status);
      if (!cleanStatus) throw new CatalogError("invalid_status", 400);
      try { return await store.setTenantStatus(cleanTenant, cleanStatus, actorLabel(actor)); }
      catch (error) { throw mapStoreError(error); }
    },

    async selectTenantPlan(tenantId, planId, assignedBotId, actor) {
      const cleanTenant = text(tenantId, 64).toLowerCase();
      const cleanPlan = text(planId, 64).toLowerCase();
      const cleanBot = text(assignedBotId, 64).toLowerCase();
      if (!cleanTenant) throw new CatalogError("tenant_not_found", 404);
      if (!ID_PATTERN.test(cleanPlan)) throw new CatalogError("invalid_plan_id", 400);
      if (!ID_PATTERN.test(cleanBot)) throw new CatalogError("invalid_bot_id", 400);
      const active = await this.activeCatalogs();
      const plan = (active.plans || []).find(function (row) { return row.id === cleanPlan; });
      const bot = (active.bots || []).find(function (row) { return row.id === cleanBot; });
      if (!plan) throw new CatalogError("plan_not_found", 404);
      if (!bot) throw new CatalogError("bot_not_found", 404);
      if (plan.bot_id && plan.bot_id !== cleanBot) throw new CatalogError("invalid_plan_for_bot", 400);
      try { return await store.selectTenantPlan(cleanTenant, cleanPlan, cleanBot, actorLabel(actor)); }
      catch (error) { throw mapStoreError(error); }
    },

    async tenantBackup(tenantId) {
      const cleanTenant = text(tenantId, 64).toLowerCase();
      if (!cleanTenant) throw new CatalogError("tenant_not_found", 404);
      try { return await store.tenantBackup(cleanTenant); }
      catch (error) { throw mapStoreError(error); }
    },

    // Borrado con las tres salvaguardas. El respaldo se genera antes, siempre.
    async deleteTenant(input, actor) {
      input = input || {};
      const cleanTenant = text(input.tenant_id, 64).toLowerCase();
      if (!cleanTenant) throw new CatalogError("tenant_not_found", 404);
      const confirmation = text(input.company_name_confirmacion, 120);
      if (!confirmation) throw new CatalogError("company_name_mismatch", 400);
      if (input.confirmacion_final !== true) throw new CatalogError("final_confirmation_required", 400);

      let backup;
      try { backup = await store.tenantBackup(cleanTenant); }
      catch (error) { throw mapStoreError(error); }

      const backedTenant = backup && backup.tenant || {};
      if (backedTenant.company_name && String(backedTenant.company_name).trim() !== confirmation) {
        throw new CatalogError("company_name_mismatch", 400);
      }

      try { await store.setTenantStatus(cleanTenant, "suspendido", actorLabel(actor)); }
      catch (error) { throw mapStoreError(error); }

      let result;
      try { result = await store.deleteTenant(cleanTenant, confirmation, actorLabel(actor)); }
      catch (error) { throw mapStoreError(error); }

      return { result: result, backup: backup };
    }
  };
}

// El precio del plan se congela en el tenant al momento de contratar. Si Santiago
// sube un precio después, los clientes ya firmados conservan el suyo.
function contractedPriceSnapshot(plan, now) {
  if (!plan) return {};
  return {
    precio_setup_contratado: 0,
    precio_mensual_contratado: intOrZero(plan.precio_mensual),
    plan_contratado_en: (now instanceof Date ? now : new Date()).toISOString()
  };
}

// Formateo de presentación: 990000 -> "$990.000". Nunca se guarda formateado.
function formatCop(value) {
  const amount = intOrNull(value);
  if (amount == null) return "—";
  return "$" + String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

module.exports = {
  CatalogError,
  InMemoryCatalogStore,
  SupabaseCatalogStore,
  TENANT_STATUSES,
  LEGACY_STATUS_ALIASES,
  NEXTFOR_PRICING_JULY_2026,
  contractedPriceSnapshot,
  createCatalogService,
  formatCop,
  normalizeStatus,
  slugify,
  validateBotInput,
  validatePlanInput
};
