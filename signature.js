"use strict";

const crypto = require("crypto");

const SIGNATURE_TOOL = "nextfor_signature";
const SIGNATURE_PREFIX = "nextfor-signature:";
const SIGNATURE_INDEX_ID = SIGNATURE_PREFIX + "index";
const SIGNATURE_CONFIG_ID = SIGNATURE_PREFIX + "config";
const MAX_TEXT_LENGTH = 12000;

const DEFAULT_SECTIONS = [
  { id: "company", eyebrow: "Sobre ti y tu empresa", title: "Conozcámonos", intro: "Empecemos por lo básico para poder acompañarte.", questions: [1, 2, 3, 4, 5, 6, 7, 8] },
  { id: "pain", eyebrow: "Tus dolores de cabeza", title: "Dónde te duele hoy", intro: "Queremos entender qué te está costando y por qué.", questions: [9, 10, 11, 12, 13, 14, 15] },
  { id: "solution", eyebrow: "Qué debería hacer Nextfor", title: "Lo que Nextfor haría por ti", intro: "Imagina a Nextfor de tu lado, trabajando 24/7.", questions: [16, 17, 18, 19] },
  { id: "technology", eyebrow: "Sistemas y herramientas", title: "Tu tecnología actual", intro: "Así entendemos con qué ya cuentas y qué conviene conectar.", questions: [20, 21, 22] },
  { id: "outcome", eyebrow: "Tu resultado esperado", title: "El resultado que buscas", intro: "Cerremos con lo que de verdad quieres lograr.", questions: [23, 24, 25, 26, 27, 28] }
];

const DEFAULT_QUESTIONS = [
  q(1, "¿Cómo se llama tu empresa?", "short", true),
  q(2, "¿Cuál es tu nombre y tu rol en la empresa?", "short", true),
  q(3, "¿A qué correo te enviamos tu diagnóstico?", "short", true, "", [], { input_type: "email" }),
  q(4, "¿A qué número te escribimos por WhatsApp?", "short", true, "", [], { input_type: "tel" }),
  q(5, "¿Desde qué ciudad y país operas?", "short", true),
  q(6, "¿Dónde podemos conocerte mejor?", "short", false, "Tu página web o redes sociales", [], { input_type: "url" }),
  q(7, "En pocas líneas, ¿a qué se dedica tu empresa y qué vendes?", "long", true),
  q(8, "¿Qué tan grande es hoy tu operación?", "short", false, "Empleados, sedes, bodegas o puntos de venta — un aproximado está bien"),
  q(9, "¿Qué está pasando en tu negocio que te hizo buscar una solución justo ahora?", "long", true),
  q(10, "¿En qué áreas se concentran hoy los mayores problemas?", "multiple", true, "", [
    "Atención al cliente", "Ventas y seguimiento comercial", "Cotizaciones y pedidos", "Facturación", "Cartera y cobros",
    "Inventario", "Despachos y logística", "Citas o reservas", "Comunicación interna", "Reportes e información",
    "Documentos y almacenamiento", "Sistemas que no se conectan", "Infraestructura tecnológica o servidores", "Otro"
  ], { max: 5 }),
  q(11, "En tus palabras, ¿cuáles son los tres dolores de cabeza que más te quitan el sueño?", "long", true),
  q(12, "Si pudieras resolver solo uno primero, ¿cuál sería y por qué?", "long", true),
  q(13, "¿Qué te está costando hoy no resolver esto?", "multiple", true, "", [
    "Pérdida de tiempo", "Pérdida de ventas", "Demoras en la atención", "Clientes insatisfechos", "Errores humanos",
    "Trabajo duplicado", "Sobrecarga del equipo", "Facturas sin cobrar", "Problemas de inventario",
    "Retrasos en pedidos o despachos", "Falta de información para tomar decisiones", "Dependencia de una sola persona", "Otro"
  ]),
  q(14, "Cuando puedas, compártenos cifras que ayuden a dimensionarlo.", "long", false, "Conversaciones al día, pedidos al mes, facturas, horas invertidas, personas involucradas o casos con errores"),
  q(15, "Cuéntanos cómo funciona hoy el proceso detrás de tu problema principal.", "long", true, "Cómo empieza, quién participa, qué herramientas usan, qué pasos son manuales y dónde aparecen errores o demoras."),
  q(16, "¿Qué te gustaría que Nextfor hiciera por ti?", "multiple", true, "", [
    "Responder preguntas de clientes", "Identificar y clasificar solicitudes", "Capturar y organizar información",
    "Registrar o actualizar datos de clientes", "Realizar seguimiento a clientes o prospectos", "Recomendar productos o servicios",
    "Crear cotizaciones", "Tomar pedidos", "Consultar precios o inventario", "Consultar el estado de pedidos",
    "Generar o enviar facturas", "Enviar recordatorios de pago", "Cobrar facturas vencidas", "Recibir comprobantes de pago",
    "Generar guías o apoyar los despachos", "Agendar citas o reservas", "Traducir conversaciones", "Enviar alertas al equipo",
    "Actualizar información en otros sistemas", "Generar reportes", "Automatizar tareas internas", "Otro"
  ]),
  q(17, "¿Por cuáles canales y en qué idiomas debería atender?", "short", true, "Ej.: WhatsApp y correo electrónico, en español e inglés"),
  q(18, "¿Qué información o sistemas necesitaría consultar para hacer bien su trabajo?", "long", true, "Catálogo, precios, inventario, facturas, cartera, información de clientes, pedidos, políticas o archivos internos"),
  q(19, "¿Qué decisiones deberían pasar siempre por una persona, y cuándo debería pasarte el caso a ti o a tu equipo?", "long", true),
  q(20, "¿Con qué sistemas y herramientas trabajas hoy?", "long", true, "Incluye nombres cuando los conozcas: POS, facturación, inventario, software contable, CRM, ERP, e-commerce, WhatsApp Business, Excel, servidor propio o nube"),
  q(21, "¿Qué sistemas deberían “hablarse” entre sí para que todo fluya?", "long", true, "Si alguno no se puede integrar, dinos si estarías dispuesto a evaluarlo o cambiarlo"),
  q(22, "¿Dónde guardas hoy tu información y documentos?", "long", false, "Cuéntanos si hay reglas importantes de seguridad, acceso o confidencialidad"),
  q(23, "Si esto funciona, ¿cuáles serían los tres resultados que más te cambiarían la operación?", "multiple", true, "", [
    "Responder más rápido", "Atender fuera del horario laboral", "Aumentar las ventas", "Mejorar el seguimiento comercial",
    "Reducir tareas manuales", "Disminuir errores", "Cobrar más rápido", "Reducir la cartera vencida",
    "Mejorar el control del inventario", "Agilizar pedidos y despachos", "Centralizar la información",
    "Reducir la carga del equipo", "Mejorar la experiencia del cliente", "Obtener mejores reportes", "Otro"
  ], { max: 3 }),
  q(24, "¿Cuándo te gustaría empezar?", "single", true, "", [
    "Lo antes posible", "Durante el próximo mes", "En los próximos tres meses", "En los próximos seis meses", "Todavía estamos evaluando alternativas"
  ]),
  q(25, "¿Tienes un presupuesto o rango de inversión en mente?", "short", false, "Puedes indicar la moneda"),
  q(26, "¿Ya intentaste automatizar algo de esto antes? ¿Qué funcionó y qué no?", "long", false),
  q(27, "¿Tienes documentos que nos ayuden a entenderte mejor?", "files", false, "Diagramas, formatos, facturas, reportes, capturas de sistemas o preguntas frecuentes"),
  q(28, "¿Hay algo importante que no te hayamos preguntado y quieras contarnos?", "long", false)
];

function q(number, label, type, required, help, options, extra) {
  return Object.assign({ id: "q" + number, number, label, type, required, help: help || "", options: options || [], active: true }, extra || {});
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function signatureConfigDefaults() {
  return {
    version: 1,
    updated_at: null,
    updated_by: "",
    sections: clone(DEFAULT_SECTIONS),
    questions: clone(DEFAULT_QUESTIONS)
  };
}

function cleanText(value, maxLength) {
  return String(value == null ? "" : value).trim().slice(0, maxLength || MAX_TEXT_LENGTH);
}

function cleanToken(value) {
  const token = String(value || "");
  return /^[A-Za-z0-9_-]{32,96}$/.test(token) ? token : "";
}

function recordIdForToken(token) {
  const valid = cleanToken(token);
  if (!valid) return "";
  return SIGNATURE_PREFIX + crypto.createHash("sha256").update(valid).digest("hex");
}

function hasAnswer(value) {
  if (Array.isArray(value)) return value.length > 0;
  return cleanText(value).length > 0;
}

function normalizeFiles(files) {
  return (Array.isArray(files) ? files : []).slice(0, 5).map(function (file) {
    return {
      id: cleanText(file && file.id, 80),
      name: cleanText(file && file.name, 180),
      size: Math.max(0, Math.min(10 * 1024 * 1024, Number(file && file.size) || 0)),
      type: cleanText(file && file.type, 120),
      object_key: cleanText(file && file.object_key, 500),
      uploaded_at: cleanText(file && file.uploaded_at, 40)
    };
  }).filter(function (file) { return file.id && file.name && file.object_key; });
}

function normalizeAnswer(question, value) {
  if (!question) return "";
  if (question.type === "multiple") {
    const allowed = new Set(question.options || []);
    const max = Number(question.max) || 50;
    return [...new Set((Array.isArray(value) ? value : []).map(function (item) { return cleanText(item, 180); }).filter(function (item) {
      return allowed.has(item);
    }))].slice(0, max);
  }
  if (question.type === "files") return "";
  if (question.type === "single") {
    const candidate = cleanText(value, 180);
    return (question.options || []).includes(candidate) ? candidate : "";
  }
  return cleanText(value);
}

function normalizedConfig(input, actor) {
  const defaults = signatureConfigDefaults();
  const provided = input && Array.isArray(input.questions) ? input.questions : [];
  const byId = new Map(provided.map(function (item) { return [cleanText(item && item.id, 8), item]; }));
  const questions = defaults.questions.map(function (base) {
    const item = byId.get(base.id) || {};
    const options = ["multiple", "single"].includes(base.type) && Array.isArray(item.options)
      ? item.options.map(function (option) { return cleanText(option, 180); }).filter(Boolean).slice(0, 30)
      : base.options;
    return Object.assign({}, base, {
      label: cleanText(item.label || base.label, 500),
      help: cleanText(item.help == null ? base.help : item.help, 800),
      required: typeof item.required === "boolean" ? item.required : base.required,
      active: typeof item.active === "boolean" ? item.active : base.active,
      options: options.length ? options : base.options
    });
  });
  return {
    version: Math.max(1, Number(input && input.version) || 1),
    updated_at: new Date().toISOString(),
    updated_by: cleanText(actor, 120),
    sections: defaults.sections,
    questions
  };
}

function answeredCount(state, config) {
  return config.questions.filter(function (question) {
    return question.active && (question.type === "files" ? state.files.length > 0 : hasAnswer(state.answers[question.id]));
  }).length;
}

function requiredMissing(state, config) {
  return config.questions.filter(function (question) {
    return question.active && question.required && !(question.type === "files" ? state.files.length > 0 : hasAnswer(state.answers[question.id]));
  }).map(function (question) { return question.id; });
}

function derivedState(state, config) {
  const next = Object.assign({}, state);
  next.files = normalizeFiles(next.files);
  next.answers = next.answers && typeof next.answers === "object" ? next.answers : {};
  const activeCount = config.questions.filter(function (question) { return question.active; }).length || 1;
  const count = answeredCount(next, config);
  next.progress = Math.round(count / activeCount * 100);
  next.answered_count = count;
  next.total_questions = activeCount;
  next.empresa = cleanText(next.answers.q1, 240);
  next.contacto = cleanText(next.answers.q2, 240);
  next.email = cleanText(next.answers.q3, 240);
  if (next.status !== "completado") next.status = count ? "en_progreso" : "iniciado";
  return next;
}

function createEmptyState(token, actor) {
  const now = new Date().toISOString();
  return {
    schema_version: 1,
    token,
    answers: {},
    files: [],
    consent: false,
    step: 0,
    progress: 0,
    answered_count: 0,
    total_questions: 28,
    status: "iniciado",
    empresa: "",
    contacto: "",
    email: "",
    created_at: now,
    updated_at: now,
    submitted_at: null,
    revision: 1,
    created_by: cleanText(actor, 120)
  };
}

function publicState(state) {
  const result = clone(state);
  delete result.token;
  result.files = (result.files || []).map(function (file) {
    const visible = Object.assign({}, file);
    delete visible.object_key;
    return visible;
  });
  result.record_id = recordIdForToken(state.token).slice(SIGNATURE_PREFIX.length);
  return result;
}

function prospectSummary(state) {
  return {
    record_id: recordIdForToken(state.token).slice(SIGNATURE_PREFIX.length),
    token: state.token,
    empresa: state.empresa || "Prospecto sin nombre",
    contacto: state.contacto || "Sin contacto",
    email: state.email || "",
    status: state.status,
    progress: state.progress,
    answered_count: state.answered_count,
    total_questions: state.total_questions,
    updated_at: state.updated_at,
    submitted_at: state.submitted_at,
    revision: state.revision
  };
}

function prioritiesFor(state) {
  return {
    areas: Array.isArray(state.answers.q10) ? state.answers.q10.slice(0, 5) : [],
    main_problem: cleanText(state.answers.q12, 1200),
    desired_results: Array.isArray(state.answers.q23) ? state.answers.q23.slice(0, 3) : [],
    timeline: cleanText(state.answers.q24, 180),
    budget: cleanText(state.answers.q25, 300) || "Se define tras el diagnóstico"
  };
}

function parseStoredPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.kind === "snapshot" && payload.state && cleanToken(payload.state.token)) return payload;
  if (payload.kind === "index" && Array.isArray(payload.prospects)) return payload;
  if (payload.kind === "config" && payload.config) return payload;
  return null;
}

function createSignatureService(options) {
  const store = options && options.store;
  const onUpdate = options && options.onUpdate || function () {};
  const persistent = options && options.persistent;
  let configCache = null;
  let indexCache = null;
  const locks = new Map();

  if (!store || typeof store.append !== "function" || typeof store.latest !== "function") {
    throw new Error("signature_store_required");
  }

  function runLocked(key, task) {
    const previous = locks.get(key) || Promise.resolve();
    const current = previous.catch(function () {}).then(task);
    locks.set(key, current);
    return current.finally(function () {
      if (locks.get(key) === current) locks.delete(key);
    });
  }

  async function loadPayload(userId) {
    const value = await store.latest(userId);
    return parseStoredPayload(value);
  }

  async function loadConfig(force) {
    if (!force && configCache) return clone(configCache);
    const payload = await loadPayload(SIGNATURE_CONFIG_ID);
    configCache = payload && payload.kind === "config" ? normalizedConfig(payload.config, payload.config.updated_by) : signatureConfigDefaults();
    return clone(configCache);
  }

  async function saveConfig(input, actor) {
    return runLocked(SIGNATURE_CONFIG_ID, async function () {
      const current = await loadConfig(true);
      const next = normalizedConfig(Object.assign({}, input, { version: current.version + 1 }), actor);
      await store.append(SIGNATURE_CONFIG_ID, { kind: "config", saved_at: next.updated_at, config: next });
      configCache = next;
      onUpdate({ type: "config", config: clone(next) });
      return clone(next);
    });
  }

  async function loadIndex(force) {
    if (!force && indexCache) return clone(indexCache);
    const payload = await loadPayload(SIGNATURE_INDEX_ID);
    indexCache = payload && payload.kind === "index" ? payload.prospects : [];
    return clone(indexCache);
  }

  async function saveIndex(summary) {
    return runLocked(SIGNATURE_INDEX_ID, async function () {
      const prospects = await loadIndex(true);
      const next = prospects.filter(function (item) { return item.record_id !== summary.record_id; });
      next.unshift(summary);
      next.sort(function (a, b) { return String(b.updated_at).localeCompare(String(a.updated_at)); });
      await store.append(SIGNATURE_INDEX_ID, { kind: "index", saved_at: new Date().toISOString(), prospects: next });
      indexCache = next;
      return clone(next);
    });
  }

  async function saveState(state, eventType) {
    const recordId = recordIdForToken(state.token);
    await store.append(recordId, { kind: "snapshot", saved_at: state.updated_at, state });
    await saveIndex(prospectSummary(state));
    onUpdate({ type: eventType || "updated", prospect: prospectSummary(state), state: publicState(state), priorities: prioritiesFor(state) });
    return clone(state);
  }

  async function loadState(token) {
    const recordId = recordIdForToken(token);
    if (!recordId) return null;
    const payload = await loadPayload(recordId);
    return payload && payload.kind === "snapshot" ? clone(payload.state) : null;
  }

  async function create(actor) {
    if (!persistent) {
      const error = new Error("signature_persistence_required");
      error.code = "signature_persistence_required";
      throw error;
    }
    return runLocked("create", async function () {
      const config = await loadConfig(false);
      const token = crypto.randomBytes(32).toString("base64url");
      const state = derivedState(createEmptyState(token, actor), config);
      await saveState(state, "created");
      return state;
    });
  }

  async function update(token, patch, options) {
    const recordId = recordIdForToken(token);
    if (!recordId) return null;
    return runLocked(recordId, async function () {
      const current = await loadState(token);
      if (!current) return null;
      const config = await loadConfig(false);
      const byId = new Map(config.questions.map(function (question) { return [question.id, question]; }));
      const next = clone(current);
      const answerPatch = patch && patch.answers && typeof patch.answers === "object" ? patch.answers : {};
      Object.keys(answerPatch).forEach(function (id) {
        const question = byId.get(id);
        if (question && question.active) next.answers[id] = normalizeAnswer(question, answerPatch[id]);
      });
      if (patch && Number.isInteger(patch.step)) next.step = Math.max(0, Math.min(4, patch.step));
      if (patch && typeof patch.consent === "boolean") next.consent = patch.consent;
      if (options && options.addFile) next.files = normalizeFiles(next.files.concat(options.addFile));
      if (options && options.removeFileId) next.files = next.files.filter(function (file) { return file.id !== options.removeFileId; });
      if (patch && patch.reopen === true && next.status === "completado") next.status = "en_progreso";
      next.revision = Math.max(1, Number(current.revision) || 1) + 1;
      next.updated_at = new Date().toISOString();
      const derived = derivedState(next, config);
      await saveState(derived, "updated");
      return derived;
    });
  }

  async function submit(token, patch) {
    const recordId = recordIdForToken(token);
    if (!recordId) return null;
    return runLocked(recordId, async function () {
      let current = await loadState(token);
      if (!current) return null;
      const config = await loadConfig(false);
      if (patch) {
        const byId = new Map(config.questions.map(function (question) { return [question.id, question]; }));
        const answerPatch = patch.answers && typeof patch.answers === "object" ? patch.answers : {};
        Object.keys(answerPatch).forEach(function (id) {
          const question = byId.get(id);
          if (question && question.active) current.answers[id] = normalizeAnswer(question, answerPatch[id]);
        });
        if (typeof patch.consent === "boolean") current.consent = patch.consent;
      }
      current = derivedState(current, config);
      const missing = requiredMissing(current, config);
      if (missing.length || !current.consent) {
        const error = new Error("signature_incomplete");
        error.code = "signature_incomplete";
        error.missing = missing;
        error.consent_required = !current.consent;
        throw error;
      }
      current.status = "completado";
      current.progress = 100;
      current.step = 4;
      current.submitted_at = current.submitted_at || new Date().toISOString();
      current.updated_at = new Date().toISOString();
      current.revision = Math.max(1, Number(current.revision) || 1) + 1;
      await saveState(current, "submitted");
      return current;
    });
  }

  async function list() {
    const prospects = await loadIndex(true);
    return prospects.sort(function (a, b) { return String(b.updated_at).localeCompare(String(a.updated_at)); });
  }

  async function adminDetail(recordId) {
    const prospects = await list();
    const summary = prospects.find(function (item) { return item.record_id === cleanText(recordId, 80); });
    if (!summary || !cleanToken(summary.token)) return null;
    const state = await loadState(summary.token);
    if (!state) return null;
    return { prospect: prospectSummary(state), state: publicState(state), priorities: prioritiesFor(state) };
  }

  async function removeFile(token, fileId) {
    return update(token, {}, { removeFileId: cleanText(fileId, 80) });
  }

  async function addFile(token, file) {
    return update(token, {}, { addFile: file });
  }

  return {
    addFile,
    adminDetail,
    adminFile: async function (recordId, fileId) {
      const prospects = await list();
      const summary = prospects.find(function (item) { return item.record_id === cleanText(recordId, 80); });
      if (!summary || !cleanToken(summary.token)) return null;
      const state = await loadState(summary.token);
      return state && (state.files || []).find(function (file) { return file.id === cleanText(fileId, 80); }) || null;
    },
    create,
    get: async function (token) {
      const state = await loadState(token);
      if (!state) return null;
      const config = await loadConfig(false);
      return { state: publicState(derivedState(state, config)), config, priorities: prioritiesFor(state) };
    },
    getConfig: loadConfig,
    list,
    removeFile,
    saveConfig,
    submit,
    update
  };
}

class InMemorySignatureStore {
  constructor() {
    this.rows = new Map();
  }
  async append(userId, payload) {
    const rows = this.rows.get(userId) || [];
    rows.unshift(clone(payload));
    this.rows.set(userId, rows);
  }
  async latest(userId) {
    const rows = this.rows.get(userId) || [];
    return rows.length ? clone(rows[0]) : null;
  }
}

module.exports = {
  DEFAULT_QUESTIONS,
  DEFAULT_SECTIONS,
  InMemorySignatureStore,
  SIGNATURE_CONFIG_ID,
  SIGNATURE_INDEX_ID,
  SIGNATURE_PREFIX,
  SIGNATURE_TOOL,
  createSignatureService,
  prioritiesFor,
  recordIdForToken,
  requiredMissing,
  signatureConfigDefaults
};
