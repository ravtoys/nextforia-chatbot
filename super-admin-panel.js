"use strict";

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function icon(name, size) {
  const paths = {
    overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    lead: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    alert: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    spark: '<path d="m12 3-1.9 5.1L5 10l5.1 1.9L12 17l1.9-5.1L19 10l-5.1-1.9L12 3Z"/><path d="M5 3v4M3 5h4M19 17v4M17 19h4"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    refresh: '<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/>',
    logout: '<path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    bot: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 4v4M8 13h.01M16 13h.01M8 17h8"/>',
    building: '<path d="M3 21h18M6 21V5l6-2v18M18 21V9l-6-2M9 9h.01M9 13h.01M9 17h.01M15 13h.01M15 17h.01"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z"/><path d="m9 12 2 2 4-4"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    headset: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3ZM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3Z"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
    webhook: '<path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/><path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    dollar: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    receipt: '<path d="M4 2v20l2-1.5L8 22l2-1.5L12 22l2-1.5L16 22l2-1.5L20 22V2l-2 1.5L16 2l-2 1.5L12 2l-2 1.5L8 2 6 3.5 4 2Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'
  };
  return '<svg aria-hidden="true" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || paths.activity) + '</svg>';
}

// Formato de moneda base de la plataforma: COP.
function money(value, currency) {
  if (value == null || !isFinite(Number(value))) return "—";
  const amount = Number(value);
  const abs = Math.abs(amount);
  const compact = abs >= 1000000
    ? "$" + (amount / 1000000).toFixed(abs >= 10000000 ? 0 : 1).replace(".", ",") + "M"
    : abs >= 1000
      ? "$" + Math.round(amount / 1000) + "k"
      : "$" + Math.round(amount);
  return compact + " " + (currency || "COP");
}

function num(value) {
  if (value == null || !isFinite(Number(value))) return "—";
  return String(Math.round(Number(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function emptyBlock(iconName, title, body) {
  return '<div class="empty"><div class="empty-icon">' + icon(iconName, 23) + '</div><h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(body) + '</p></div>';
}

function renderSuperAdminPanel(res, options) {
  const auth = options.auth || {};
  const customerAccessV2Enabled = !!options.customerAccessV2Enabled;
  const paymentsV1Enabled = !!options.paymentsV1Enabled;
  const channelConnectionsV1Enabled = !!options.channelConnectionsV1Enabled;
  const hiddenLegacyClientIds = new Set((options.hiddenLegacyClientIds || []).map(function (id) { return String(id || "").trim().toLowerCase(); }).filter(Boolean));
  const readiness = options.commercialReadiness || {};
  const accessModel = options.accessModel || {};
  const tenant = options.tenant || { id: "rav-toys", name: "RAV Toys", status: "active" };
  const integration = options.integration || {
    integration_number: 1,
    status: "activation_pending",
    label: "Activacion pendiente",
    target_display_phone: "+57 301 587 2708",
    next_action: "Conectar el numero real de WhatsApp.",
    app_review: { approved: true, status: "approved" },
    connection: { mode: "test", real_number_active: false, graph_api_ready: false }
  };
  const integrationLive = integration.status === "live";
  const integrationTone = integrationLive ? "success" : (integration.status === "needs_review" ? "danger" : "warning");
  const integrationStateLabel = integrationLive ? "En funcionamiento" : "Activacion pendiente";
  // Fuente económica de la plataforma. Mientras no exista un origen financiero
  // de confianza se deja en null y el panel muestra estados vacíos honestos.
  // Contrato esperado (ver README de handoff):
  //   { currency, totals:{mrr,users,costs}, bots:[{id,name,clients,mrr,users,usersUnit,costs}],
  //     pareto:[{name,revenue,botId}], attention:{webhooks,pendingAppointments,queues,overdue} }
  const finance = options.finance || null;
  // Pipeline comercial. Mismo criterio: null hasta que onboarding persista leads.
  //   { kpis:{active,won,demos,conversion}, sources:[{name,paid,leads,won}], rows:[...] }
  const leadsData = options.leads || null;
  const platformGoals = Array.isArray(options.platformGoals) ? options.platformGoals : [];
  const customerGoal = platformGoals.find(function (goal) { return goal && goal.id === "customers"; }) || {
    id: "customers",
    type: "counter",
    label: "Clientes",
    unit: "clientes",
    target: 340,
    active: true
  };
  const currency = (finance && finance.currency) || "COP";
  const registeredClients = (options.registeredClients || []).filter(function (client) {
    return client && client.tenant_id && client.tenant_id !== tenant.id;
  }).map(function (client) {
    return Object.assign({}, client, {
      panel_path: client.tenant_id === "grupo-derco" ? "/admin/pilots/derco" : ""
    });
  });
  const legacyPlatformAccounts = [{
    tenant_id: tenant.id,
    brand_name: tenant.name,
    short_name: "RAV Toys",
    status: tenant.status || "active",
    industry: "ecommerce",
    panel_path: "/admin/panel?tab=summary"
  }].concat(registeredClients);
  const platformAccounts = customerAccessV2Enabled ? [] : legacyPlatformAccounts.filter(function (client) {
    return !hiddenLegacyClientIds.has(String(client.tenant_id || "").trim().toLowerCase());
  });
  const stages = readiness.stages || [];
  const readyCount = stages.filter(function (stage) { return stage.status === "ready"; }).length;
  const waitingCount = stages.filter(function (stage) { return stage.status === "waiting_meta"; }).length;
  const draftCount = stages.filter(function (stage) { return stage.status === "draft"; }).length;
  const tenantFields = readiness.requiredTenantFields || [];
  const targetClients = Math.max(1, Number(customerGoal.target) || 340);
  // La tarjeta del sidebar acompaña el camino a la meta. El tono es directo y en
  // segunda persona: el que construye esto es Santiago, no el panel. El panel solo
  // le muestra dónde está parado. Nada de porcentajes vacíos ni felicitaciones
  // genéricas: cada etapa nombra lo que ya logró y lo que sigue.
  function goalCopy(count) {
    const remaining = Math.max(0, targetClients - count);
    if (count <= 0) return { titular: "Tu primer cliente", frase: "Todo empieza con uno. Ese es el que enseña el camino." };
    if (count >= targetClients) return { titular: "Meta cumplida", frase: targetClients + " negocios atendidos por NextforIA. Lo lograste." };
    if (count === 1) return { titular: "Faltan " + remaining, frase: "Ya no estás en cero. Esa era la parte difícil." };
    if (count < targetClients * 0.1) return { titular: "Faltan " + remaining, frase: "Los primeros son los que prueban que funciona." };
    if (count < targetClients * 0.34) return { titular: "Faltan " + remaining, frase: "El camino ya tiene forma. Seguí firme." };
    if (count < targetClients * 0.67) return { titular: "Faltan " + remaining, frase: "Pasaste el tercio. Ya sabés cómo se hace." };
    if (count < targetClients * 0.9) return { titular: "Faltan " + remaining, frase: "Más de la mitad atrás. La meta ya se ve." };
    return { titular: "Faltan " + remaining, frase: "Estás a un empujón. No aflojes ahora." };
  }
  const currentClients = platformAccounts.length;
  const firstClient = platformAccounts[0] || null;
  const goalPercent = Math.max(1, Math.round(currentClients / targetClients * 100));
  const goalInitial = goalCopy(currentClients);
  const goalClientState = JSON.stringify({
    id: "customers",
    type: "counter",
    label: customerGoal.label || "Clientes",
    unit: customerGoal.unit || "clientes",
    target: targetClients,
    active: true
  }).replace(/</g, "\\u003c");
  const leadsClientState = JSON.stringify(leadsData || { kpis: { active: 0, won: 0, demos: 0, conversion: 0 }, sources: [], rows: [], customers: [] }).replace(/</g, "\\u003c");
  const statusLabels = { ready: "Listo", draft: "Pendiente", waiting_meta: "Esperando Meta" };
  const statusVariants = { ready: "success", draft: "neutral", waiting_meta: "warning" };

  // ---------- Economía consolidada ----------
  const financeBots = (finance && Array.isArray(finance.bots) ? finance.bots : []).map(function (bot) {
    const mrr = Number(bot.mrr) || 0;
    const costs = Number(bot.costs) || 0;
    return Object.assign({}, bot, { mrr: mrr, costs: costs, margin: mrr - costs, marginPct: mrr > 0 ? Math.round((mrr - costs) / mrr * 100) : 0 });
  });
  const totalMrr = finance ? financeBots.reduce(function (sum, bot) { return sum + bot.mrr; }, 0) : null;
  const totalCosts = finance ? financeBots.reduce(function (sum, bot) { return sum + bot.costs; }, 0) : null;
  const totalUsers = finance ? financeBots.reduce(function (sum, bot) { return sum + (Number(bot.users) || 0); }, 0) : null;
  const totalMargin = finance ? totalMrr - totalCosts : null;
  const marginPct = finance && totalMrr > 0 ? Math.round(totalMargin / totalMrr * 100) : null;
  const botIcons = { agendamiento: "calendar", atencion: "headset", voz: "mic" };

  const kpiCards = [
    { label: "Ingresos", value: finance ? money(totalMrr, currency) : "—", sub: finance ? "MRR consolidado" : "sin fuente financiera conectada", ic: "dollar", tone: "cyan" },
    { label: "Usuarios atendidos", value: finance ? num(totalUsers) : "—", sub: finance ? "en el mes" : "sin fuente de uso conectada", ic: "users", tone: "cyan" },
    { label: "Costos operativos", value: finance ? money(totalCosts, currency) : "—", sub: finance ? "infraestructura y modelos" : "sin fuente de costos conectada", ic: "receipt", tone: "amber" },
    { label: "Margen", value: finance && marginPct != null ? money(totalMargin, currency) : "—", sub: finance && marginPct != null ? marginPct + "% sobre ingresos" : "se calcula con ingresos y costos", ic: "percent", tone: "cyan" }
  ].map(function (kpi) {
    return '<article class="stat-card"><div class="stat-top"><span>' + escapeHtml(kpi.label) + '</span><span class="icon-chip ' + kpi.tone + '">' + icon(kpi.ic, 17) + '</span></div><div class="stat-value">' + escapeHtml(kpi.value) + '</div><div class="stat-sub">' + escapeHtml(kpi.sub) + '</div></article>';
  }).join("");

  const botBreakdown = financeBots.length
    ? '<div class="bot-grid">' + financeBots.map(function (bot) {
        const accent = bot.id === "agendamiento" ? "cyan" : "navy";
        return '<article class="card bot-card"><div class="bot-head"><span class="icon-chip ' + accent + '">' + icon(botIcons[bot.id] || "bot", 18) + '</span><div><strong>' + escapeHtml(bot.name) + '</strong><span>' + num(bot.clients) + ' clientes activos</span></div><button class="link-button" type="button" data-go="' + escapeHtml(bot.id) + '">Ver módulo →</button></div>'
          + '<div class="bot-metrics"><div><span>Ingresos</span><strong>' + escapeHtml(money(bot.mrr, currency)) + '</strong><small>MRR</small></div>'
          + '<div><span>Usuarios</span><strong>' + num(bot.users) + '</strong><small>' + escapeHtml(bot.usersUnit || "en el mes") + '</small></div>'
          + '<div><span>Costos</span><strong>' + escapeHtml(money(bot.costs, currency)) + '</strong><small>operativo</small></div></div>'
          + '<div class="bot-margin"><div class="bot-margin-top"><span>Margen</span><strong>' + escapeHtml(money(bot.margin, currency)) + ' · ' + bot.marginPct + '%</strong></div><div class="bar"><span class="' + accent + '" style="width:' + Math.max(0, Math.min(100, bot.marginPct)) + '%"></span></div></div></article>';
      }).join("") + '</div>'
    : '<section class="card">' + emptyBlock("layers", "El desglose por bot se activa con la fuente financiera", "Cada bot mostrará ingresos MRR, usuarios atendidos, costos operativos y margen en cuanto exista un origen de facturación y costos por producto. No se muestran cifras de ejemplo como si fueran producción.") + '</section>';

  const compareRows = financeBots.length
    ? financeBots.map(function (bot) {
        return '<div class="compare-row"><span class="compare-name">' + icon(botIcons[bot.id] || "bot", 16) + escapeHtml(bot.name) + '</span><span class="mono">' + num(bot.clients) + '</span><span class="mono right">' + num(bot.users) + '</span><span class="mono right strong">' + escapeHtml(money(bot.mrr, currency)) + '</span><span class="mono right">' + escapeHtml(money(bot.costs, currency)) + '</span><span class="mono right margin">' + escapeHtml(money(bot.margin, currency)) + '</span></div>';
      }).join("") + '<div class="compare-row total"><span class="compare-name">' + icon("layers", 16) + 'Consolidado</span><span class="mono">' + num(currentClients) + '</span><span class="mono right">' + num(totalUsers) + '</span><span class="mono right strong">' + escapeHtml(money(totalMrr, currency)) + '</span><span class="mono right">' + escapeHtml(money(totalCosts, currency)) + '</span><span class="mono right margin">' + escapeHtml(money(totalMargin, currency)) + '</span></div>'
    : '';

  const compareTable = financeBots.length
    ? '<section class="card table-card"><div class="compare-head"><span>Bot</span><span>Clientes</span><span class="right">Usuarios</span><span class="right">Ingresos</span><span class="right">Costos</span><span class="right">Margen</span></div>' + compareRows + '</section>'
    : '';

  const paretoSource = (finance && Array.isArray(finance.pareto) ? finance.pareto : []).slice().sort(function (a, b) { return (Number(b.revenue) || 0) - (Number(a.revenue) || 0); });
  const paretoTotal = paretoSource.reduce(function (sum, row) { return sum + (Number(row.revenue) || 0); }, 0);
  let paretoAccum = 0;
  const paretoRows = paretoSource.map(function (row, index) {
    const share = paretoTotal > 0 ? (Number(row.revenue) || 0) / paretoTotal * 100 : 0;
    paretoAccum += share;
    return '<div class="pareto-row"><div class="pareto-top"><span class="mono rank">' + (index + 1) + '</span><span class="icon-chip ' + (index === 0 ? "cyan" : "navy") + ' sm">' + icon(botIcons[row.botId] || "bot", 15) + '</span><span class="pareto-name">' + escapeHtml(row.name) + '</span><span class="mono">' + escapeHtml(money(row.revenue, currency)) + '</span><span class="pareto-pct">' + share.toFixed(0) + '%</span></div><div class="bar"><span class="' + (index === 0 ? "cyan" : "navy") + '" style="width:' + share.toFixed(1) + '%"></span></div><div class="pareto-accum">acumulado ' + paretoAccum.toFixed(0) + '%</div></div>';
  }).join("");
  const paretoLeaders = (function () {
    let accum = 0;
    let count = 0;
    for (let i = 0; i < paretoSource.length; i++) {
      accum += paretoTotal > 0 ? (Number(paretoSource[i].revenue) || 0) / paretoTotal * 100 : 0;
      count++;
      if (accum >= 60) break;
    }
    return { count: count, share: Math.round(accum) };
  })();
  const paretoCard = paretoSource.length
    ? '<section class="card pareto-card"><div class="pareto-head"><span class="icon-chip cyan">' + icon("trend", 18) + '</span><div><strong>Pareto de ingresos</strong><span>qué producto pesa más en las ventas</span></div><span class="insight-chip">' + icon("spark", 13) + ' ' + paretoLeaders.count + ' de ' + paretoSource.length + ' productos = ' + paretoLeaders.share + '%</span></div><div class="pareto-body">' + paretoRows + '</div></section>'
    : '<section class="card">' + emptyBlock("trend", "El Pareto de ingresos aparece con ventas reales", "Ordena los productos por participación en las ventas y muestra el porcentaje acumulado. Se habilita cuando la facturación por producto esté conectada.") + '</section>';

  const attentionSource = (finance && finance.attention) || null;
  const attentionItems = [
    { key: "webhooks", label: "Webhooks con fallas", go: "incidents", tone: "red", ic: "webhook" },
    { key: "pendingAppointments", label: "Citas por confirmar", go: "agendamiento", tone: "amber", ic: "calendar" },
    { key: "queues", label: "Colas de atención altas", go: "atencion", tone: "amber", ic: "headset" },
    { key: "overdue", label: "Pagos vencidos", go: "billing", tone: "red", ic: "receipt" }
  ].map(function (item) {
    const value = attentionSource && attentionSource[item.key] != null ? num(attentionSource[item.key]) : "—";
    return '<button class="attention-card" type="button" data-go="' + item.go + '"><span class="attention-icon ' + item.tone + '">' + icon(item.ic, 20) + '</span><div><div class="attention-value">' + escapeHtml(value) + '</div><p>' + escapeHtml(item.label) + '</p></div></button>';
  }).join("");

  // ---------- Bloques heredados (readiness, acceso, clientes) ----------
  const readinessRows = stages.map(function (stage) {
    return '<div class="readiness-row"><div><strong>' + escapeHtml(stage.label) + '</strong><span>' + escapeHtml(stage.owner) + '</span></div><span class="badge ' + (statusVariants[stage.status] || "neutral") + ' dot">' + escapeHtml(statusLabels[stage.status] || stage.status) + '</span></div>';
  }).join("");
  const roleRows = (accessModel.roles || []).map(function (role) {
    return '<article class="role-card"><div class="role-top"><code>' + escapeHtml(role.role) + '</code><span>Nivel ' + escapeHtml(role.level) + '</span></div><strong>' + escapeHtml(role.owner) + ' · ' + escapeHtml(role.scope) + '</strong><p>' + escapeHtml(role.purpose) + '</p></article>';
  }).join("");
  const panelRows = (accessModel.future_panels || []).map(function (panel) {
    return '<article class="split-card"><div class="split-icon">' + icon(panel.id === "platform_super_admin" ? "shield" : "building", 20) + '</div><div><div class="split-title"><strong>' + escapeHtml(panel.label) + '</strong><span>' + escapeHtml(panel.owner) + '</span></div><p>' + escapeHtml(panel.purpose) + '</p><div class="role-pills">' + (panel.roles || []).map(function (role) { return '<code>' + escapeHtml(role) + '</code>'; }).join("") + '</div></div></article>';
  }).join("");
  const fields = tenantFields.map(function (field) { return '<code>' + escapeHtml(field) + '</code>'; }).join("");
  const nextSteps = [
    ["tenant_id default", "Aplicar el tenant inicial a cada registro nuevo."],
    ["tenant config", "Aislar la configuración operativa por comercio."],
    ["users per tenant", "Separar usuarios, roles y sesiones por cliente."],
    ["health per tenant", "Medir integraciones y alertas por comercio."],
    ["WhatsApp/Shopify config per tenant", "Resolver credenciales aisladas sin mostrar sus valores."]
  ].map(function (step, index) {
    return '<li><span class="step-number">' + (index + 1) + '</span><div><strong>' + escapeHtml(step[0]) + '</strong><p>' + escapeHtml(step[1]) + '</p></div><span class="badge neutral">Próxima fase</span></li>';
  }).join("");
  const clientSummaryRows = platformAccounts.map(function (client) {
    const isDefault = client.tenant_id === tenant.id;
    const initials = String(client.short_name || client.brand_name || "CL").split(/\s+/).map(function (word) { return word.charAt(0); }).join("").slice(0, 2).toUpperCase();
    const content = '<span class="avatar sm">' + escapeHtml(initials) + '</span><span class="client-main"><strong>' + escapeHtml(client.brand_name) + '</strong><span>' + escapeHtml(client.tenant_id) + ' · ' + (isDefault ? 'Integracion #1' : 'Piloto #' + escapeHtml(client.customer_number || '—')) + '</span></span><span class="badge ' + (isDefault ? 'info' : 'neutral') + ' dot">' + (isDefault ? 'Piloto Nextfor' : 'Piloto') + '</span>' + (isDefault ? '<span class="badge ' + integrationTone + ' dot">' + escapeHtml(integrationStateLabel) + '</span>' : '<span class="badge neutral">Voz · citas</span>') + '<span class="chevron">' + icon("chevron", 18) + '</span>';
    return isDefault ? '<button class="client-row" type="button" onclick="openTenant()">' + content + '</button>' : '<a class="client-row" href="' + escapeHtml(client.panel_path || "#") + '">' + content + '</a>';
  }).join("");
  const clientTableRows = platformAccounts.map(function (client) {
    const isDefault = client.tenant_id === tenant.id;
    const initials = String(client.short_name || client.brand_name || "CL").split(/\s+/).map(function (word) { return word.charAt(0); }).join("").slice(0, 2).toUpperCase();
    const sector = isDefault ? "Comercio electronico" : "Servicios profesionales";
    const plan = isDefault ? "Growth · piloto" : "Piloto citas";
    const integrations = isDefault ? "WhatsApp · Shopify" : "ElevenLabs · Calendar";
    const search = [client.brand_name, client.short_name, client.tenant_id, sector].join(" ").toLowerCase();
    const clientLink = isDefault
      ? '<button class="table-client-link" type="button" onclick="openTenant()"><span class="avatar sm">' + escapeHtml(initials) + '</span><span><strong>' + escapeHtml(client.brand_name) + '</strong><span>' + escapeHtml(client.tenant_id) + '</span></span></button>'
      : '<a class="table-client-link" href="' + escapeHtml(client.panel_path || "#") + '"><span class="avatar sm">' + escapeHtml(initials) + '</span><span><strong>' + escapeHtml(client.brand_name) + '</strong><span>' + escapeHtml(client.tenant_id) + '</span></span></a>';
    const content = '<span class="tenant-cell">' + clientLink + '</span><span class="cell-text">' + escapeHtml(sector) + '</span><span class="badge neutral">' + escapeHtml(plan) + '</span><span class="cell-text">' + escapeHtml(integrations) + '</span><span class="badge ' + (isDefault ? integrationTone : 'info') + ' dot">' + (isDefault ? escapeHtml(integrationStateLabel) : 'Piloto') + '</span><span><button class="legacy-delete" type="button" onclick="hideLegacyClient(event,' + escapeHtml(JSON.stringify(client.tenant_id)) + ',' + escapeHtml(JSON.stringify(client.brand_name)) + ')">Eliminar</button></span>';
    return '<div class="tenant-row" data-search="' + escapeHtml(search) + '">' + content + '</div>';
  }).join("");

  // ---------- Leads ----------
  const leadKpis = [
    { label: "Leads activos", key: "active", ic: "lead" },
    { label: "Ganados del mes", key: "won", ic: "check" },
    { label: "Demos agendadas", key: "demos", ic: "calendar" },
    { label: "Conversión lead→cliente", key: "conversion", ic: "percent", suffix: "%" }
  ].map(function (kpi) {
    const raw = leadsData && leadsData.kpis ? leadsData.kpis[kpi.key] : null;
    const value = raw == null ? "—" : num(raw) + (kpi.suffix || "");
    return '<article class="stat-card"><div class="stat-top"><span>' + escapeHtml(kpi.label) + '</span><span class="icon-chip cyan">' + icon(kpi.ic, 17) + '</span></div><div class="stat-value" id="leadKpi_' + escapeHtml(kpi.key) + '">' + escapeHtml(value) + '</div><div class="stat-sub">pipeline comercial</div></article>';
  }).join("");
  const leadSourceCards = (leadsData && Array.isArray(leadsData.sources) ? leadsData.sources : []).map(function (source) {
    const leads = Number(source.leads) || 0;
    const won = Number(source.won) || 0;
    const rate = leads > 0 ? Math.round(won / leads * 100) : 0;
    return '<article class="card source-card"><div class="source-head"><strong>' + escapeHtml(source.name) + '</strong><span class="badge ' + (source.paid ? "warning" : "success") + ' dot">' + (source.paid ? "Pago" : "Orgánico") + '</span></div><div class="source-metrics"><div><span>Leads</span><strong>' + num(leads) + '</strong></div><div><span>Ganados</span><strong>' + num(won) + '</strong></div><div><span>Conversión</span><strong>' + rate + '%</strong></div></div><div class="bar"><span class="cyan" style="width:' + rate + '%"></span></div></article>';
  }).join("");
  function leadBadge(stage) {
    const tone = stage === "setup_completed" ? "warning" : stage === "setup_started" ? "info" : "neutral";
    return tone;
  }
  function leadDisplayDate(row) {
    const raw = row && (row.updated_at || row.created_at) || "";
    return String(raw).slice(0, 10) || "Sin fecha";
  }
  function renderLeadRows(rows) {
    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) return '<div class="invite-loading">No hay leads activos. Cuando alguien cree cuenta con email y clave, aparecerá aquí.</div>';
    return rows.map(function (row) {
      const tenantIdJson = escapeHtml(JSON.stringify(row.tenant_id || ""));
      const companyJson = escapeHtml(JSON.stringify(row.company_name || row.tenant_id || "Lead"));
      const suspendedJson = escapeHtml(JSON.stringify("suspendido"));
      const setupStatusJson = escapeHtml(JSON.stringify("lead"));
      return '<div class="lead-row"><div><strong>' + escapeHtml(row.company_name || row.tenant_id) + '</strong><small>' + escapeHtml(row.tenant_id || "—") + '</small></div><div><strong>' + escapeHtml(row.admin_email || "—") + '</strong><small>' + escapeHtml(row.contact_phone || "Sin teléfono") + '</small></div><div><span class="badge ' + leadBadge(row.stage) + ' dot">' + escapeHtml(row.stage_label || "Lead") + '</span><small>' + num(row.completion || 0) + '% setup</small></div><div><strong>' + escapeHtml(row.plan_id || "Plan inicial") + '</strong><small>' + escapeHtml(row.assigned_bot_id || "Bot inicial") + '</small></div><div><strong>' + escapeHtml(leadDisplayDate(row)) + '</strong><small>' + (row.updated_at ? 'actualizado' : 'creado') + '</small></div><div class="catalog-actions"><button class="button" type="button" onclick="openTenantSetup(' + tenantIdJson + ')">Ver ficha/setup</button><button class="button" type="button" onclick="setTenantStatus(' + tenantIdJson + ',' + suspendedJson + ',' + companyJson + ').then(refreshTenantViews)">Suspender</button><button class="button danger" type="button" onclick="openTenantDelete(' + tenantIdJson + ',' + companyJson + ',' + setupStatusJson + ')">Eliminar</button></div></div>';
    }).join("");
  }
  const leadRows = renderLeadRows(leadsData && leadsData.rows);
  const setupClientRows = (function () {
    const seen = new Set();
    const source = []
      .concat(leadsData && Array.isArray(leadsData.customers) ? leadsData.customers : [])
      .concat(leadsData && Array.isArray(leadsData.rows) ? leadsData.rows : []);
    return source.filter(function (row) {
      const id = String(row && row.tenant_id || row && row.admin_email || "").trim().toLowerCase();
      if (!id || seen.has(id)) return false;
      const completed = row && (row.setup_completed === true || Number(row.completion) >= 100 || row.stage === "customer");
      if (!completed) return false;
      seen.add(id);
      return true;
    });
  })();
  const setupClientSection = setupClientRows.length ? `
  <section class="card table-card"><div class="list-head lead-list-head"><div><h2>Cuentas nuevas del setup</h2><span class="badge success">${setupClientRows.length}</span></div></div><div class="table-scroll"><div class="invite-head lead-table-head" aria-hidden="true"><span>Empresa</span><span>Contacto</span><span>Estado</span><span>Plan / bot</span><span>Fecha</span><span>Acciones</span></div>${setupClientRows.map(function (row) {
    const tenantIdJson = escapeHtml(JSON.stringify(row.tenant_id || ""));
    const companyJson = escapeHtml(JSON.stringify(row.company_name || row.tenant_id || "Cliente"));
    const suspendedJson = escapeHtml(JSON.stringify("suspendido"));
    const setupStatusJson = escapeHtml(JSON.stringify("setup"));
    return '<div class="lead-row"><div><strong>' + escapeHtml(row.company_name || row.tenant_id) + '</strong><small>' + escapeHtml(row.tenant_id || "—") + '</small></div><div><strong>' + escapeHtml(row.admin_email || "—") + '</strong><small>' + escapeHtml(row.contact_phone || "Sin teléfono") + '</small></div><div><span class="badge ' + (row.stage === "customer" ? "success" : "warning") + ' dot">' + escapeHtml(row.stage_label || "Setup completo") + '</span><small>' + num(row.completion || 0) + '% setup</small></div><div><strong>' + escapeHtml(row.plan_id || "Plan inicial") + '</strong><small>' + escapeHtml(row.assigned_bot_id || "Bot inicial") + '</small></div><div><strong>' + escapeHtml(leadDisplayDate(row)) + '</strong><small>' + (row.updated_at ? 'actualizado' : 'creado') + '</small></div><div class="catalog-actions"><button class="button" type="button" onclick="openTenantSetup(' + tenantIdJson + ')">Ver ficha/setup</button><button class="button" type="button" onclick="setTenantStatus(' + tenantIdJson + ',' + suspendedJson + ',' + companyJson + ').then(refreshTenantViews)">Suspender</button><button class="button danger" type="button" onclick="openTenantDelete(' + tenantIdJson + ',' + companyJson + ',' + setupStatusJson + ')">Eliminar</button></div></div>';
  }).join("")}</div></section>` : "";

  const customerAccessPanel = customerAccessV2Enabled ? `
  <section class="card access-card" aria-labelledby="customerAccessTitle"><div class="card-head"><div><h2 id="customerAccessTitle">Altas e invitaciones</h2><p>Clientes creados por Nextfor IA. El enlace privado se envía únicamente al correo administrador.</p></div><button class="button" type="button" onclick="loadCustomerInvitations()">${icon("refresh", 15)} Actualizar</button></div>
  <div class="invite-head" aria-hidden="true"><span>Cliente</span><span>Plan / bot</span><span>Entrega</span><span>Vencimiento</span><span>Acción</span></div><div id="customerInvitationRows"><div class="invite-loading">Cargando invitaciones…</div></div>
  </section>` : "";

  // Ciclo de vida: suspender corta el acceso y conserva los datos. Eliminar es
  // irreversible, descarga respaldo y suspende automáticamente antes de borrar.
  const tenantLifecyclePanel = customerAccessV2Enabled ? `
  <section class="card access-card" aria-labelledby="tenantLifecycleTitle"><div class="card-head"><div><h2 id="tenantLifecycleTitle">Clientes reales</h2><p>Estos son los clientes creados por el flujo nuevo. Desde aquí podés suspender, reactivar o eliminar con respaldo.</p></div><button class="button" type="button" onclick="loadTenants()">${icon("refresh", 15)} Actualizar</button></div>
  <div class="invite-head" aria-hidden="true"><span>Cliente</span><span>Plan contratado</span><span>Estado</span><span>Usuarios</span><span>Acciones</span></div><div id="tenantLifecycleRows"><div class="invite-loading">Cargando clientes…</div></div>
  </section>` : "";
  const legacyRegistrySection = !customerAccessV2Enabled ? `<div><div class="toolbar"><div class="search">${icon("search", 18)}<label class="sr-only" for="clientSearch">Buscar cliente</label><input id="clientSearch" placeholder="Buscar cliente o vertical…" autocomplete="off"></div><div class="filter-chips"><button class="chip active" type="button">Todos <span>${currentClients}</span></button><button class="chip" type="button">Nuevos <span>0</span></button><button class="chip" type="button">Pilotos <span>${registeredClients.length}</span></button></div></div><section class="card table-card"><div class="table-scroll"><div class="table-head"><span>Cliente</span><span>Sector</span><span>Plan</span><span>Integraciones</span><span>Estado</span><span></span></div>${clientTableRows}<div class="empty" id="clientEmpty" hidden><div class="empty-icon">${icon("search", 23)}</div><h2>Sin resultados</h2><p>No hay clientes que coincidan con esta búsqueda.</p></div></div></section></div>` : "";

  const customerAccessModal = customerAccessV2Enabled ? `
  <div class="modal-layer" id="customerCreateModal" aria-hidden="true"><button class="modal-scrim" type="button" aria-label="Cerrar alta de cliente" onclick="closeCustomerCreate()"></button><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="customerCreateTitle"><div class="modal-head"><div><span class="eyebrow">ACCESO PRIVADO</span><h2 id="customerCreateTitle">Crear cliente</h2><p>La persona invitada definirá su propia contraseña. No existe registro público.</p></div><button class="close-button" type="button" onclick="closeCustomerCreate()" aria-label="Cerrar">${icon("close", 19)}</button></div><form id="customerCreateForm" class="customer-form" novalidate>
    <label for="companyName">Empresa</label><input id="companyName" name="company_name" maxlength="120" autocomplete="organization" required>
    <label for="adminEmail">Correo administrador</label><input id="adminEmail" name="admin_email" type="email" maxlength="254" autocomplete="email" required>
    <div class="form-grid"><div><label for="planId">Plan</label><select id="planId" name="plan_id" required><option value="">Cargando…</option></select></div><div><label for="assignedBotId">Bot asignado</label><select id="assignedBotId" name="assigned_bot_id" required><option value="">Cargando…</option></select></div></div>
    <div class="form-note">La invitación es aleatoria, vence, funciona una sola vez y puede revocarse. Nextfor IA no recibe la contraseña.</div><div class="form-error" id="customerCreateError" role="alert" aria-live="assertive"></div><div class="modal-actions"><button class="button" type="button" onclick="closeCustomerCreate()">Cancelar</button><button class="button primary" id="customerCreateSubmit" type="submit">Crear y enviar invitación</button></div>
  </form></section></div>` : "";

  const superAdminInviteModal = `
  <div class="modal-layer" id="superAdminInviteModal" aria-hidden="true"><button class="modal-scrim" type="button" aria-label="Cerrar invitación interna" onclick="closeSuperAdminInvite()"></button><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="superAdminInviteTitle"><div class="modal-head"><div><span class="eyebrow">ACCESO INTERNO</span><h2 id="superAdminInviteTitle">Invitar Super Admin</h2><p>Usa esto solo para socios o equipo interno de NexforIA. El invitado creará su propia contraseña.</p></div><button class="close-button" type="button" onclick="closeSuperAdminInvite()" aria-label="Cerrar">${icon("close", 19)}</button></div><form id="superAdminInviteForm" class="customer-form" novalidate>
    <label for="superAdminInviteEmail">Correo del socio</label><input id="superAdminInviteEmail" name="email" type="email" maxlength="254" autocomplete="email" required>
    <label for="superAdminInviteName">Nombre</label><input id="superAdminInviteName" name="name" maxlength="100" autocomplete="name" placeholder="Opcional">
    <div class="form-note">El enlace vence, funciona una sola vez y no muestra ni guarda contraseñas en claro.</div>
    <label for="superAdminInviteLink">Link generado</label><input id="superAdminInviteLink" readonly placeholder="Aún no creado">
    <div class="form-error" id="superAdminInviteError" role="alert" aria-live="assertive"></div><div class="modal-actions"><button class="button" type="button" onclick="closeSuperAdminInvite()">Cerrar</button><button class="button" id="superAdminInviteCopy" type="button" onclick="copySuperAdminInvite()" disabled>Copiar link</button><button class="button primary" id="superAdminInviteSubmit" type="submit">Crear link</button></div>
  </form></section></div>`;

  // ─── Planes y bots ────────────────────────────────────────────────────
  // El catálogo es la fuente de verdad de precios. El Panel de Cliente lo lee
  // desde /admin/panel/catalogs en vez de tener los planes escritos a mano.
  const catalogView = customerAccessV2Enabled ? `
  <section class="view" data-panel="catalogs"><div class="stack">
    <div class="callout info-callout" style="margin-top:0"><div><strong>Esta pantalla define lo que ven tus clientes</strong><p>Los precios que cargues aquí aparecen en el Panel de Cliente. NextforIA ya no cobra setup cost: todos los planes se guardan con instalación $0. Signature se muestra como precio a definir con el cliente.</p></div><span class="badge info">Catálogo</span></div>
    <div>
      <div class="section-title"><h2>Planes</h2><span>lo que se vende y a qué precio</span><button class="button primary" type="button" onclick="openPlanEditor()" style="margin-left:auto">Nuevo plan</button></div>
      <section class="card table-card"><div id="planRows"><div class="invite-loading">Cargando catálogo…</div></div></section>
    </div>
    <div>
      <div class="section-title"><h2>Bots</h2><span>los productos que se asignan a cada plan</span><button class="button" type="button" onclick="openBotEditor()" style="margin-left:auto">Nuevo bot</button></div>
      <section class="card table-card"><div id="botRows"><div class="invite-loading">Cargando catálogo…</div></div></section>
    </div>
  </div></section>` : "";

  const catalogModals = customerAccessV2Enabled ? `
  <div class="modal-layer" id="planEditorModal" aria-hidden="true"><button class="modal-scrim" type="button" aria-label="Cerrar plan" onclick="closePlanEditor()"></button><section class="modal-card wide" role="dialog" aria-modal="true" aria-labelledby="planEditorTitle"><div class="modal-head"><div><span class="eyebrow">CATÁLOGO</span><h2 id="planEditorTitle">Nuevo plan</h2><p>Escribe el mensual en COP. Si el precio se define con el cliente, deja el mensual en blanco o 0 y usa la etiqueta “A definir”.</p></div><button class="close-button" type="button" onclick="closePlanEditor()" aria-label="Cerrar">${icon("close", 19)}</button></div><form id="planEditorForm" class="customer-form" novalidate>
    <input type="hidden" id="planEditorOriginalId" value="">
    <div class="form-grid"><div><label for="planNombre">Nombre del plan</label><input id="planNombre" name="nombre" maxlength="120" placeholder="Bot Agendamiento de citas" required></div><div><label for="planIdField">Identificador</label><input id="planIdField" name="id" maxlength="64" placeholder="se genera solo"></div></div>
    <label for="planDescripcion">Descripción de la tarjeta</label><input id="planDescripcion" name="descripcion" maxlength="400" placeholder="Agenda, confirma y reprograma citas por WhatsApp.">
    <div class="form-grid"><div><label for="planBotId">Bot incluido</label><select id="planBotId" name="bot_id"><option value="">Sin bot asignado</option></select></div><div><label for="planEtiqueta">Etiqueta</label><input id="planEtiqueta" name="etiqueta" maxlength="40" placeholder="Mejor valor"></div></div>
    <div class="form-grid three"><div><label for="planPrecioMensual">Precio mensual (COP)</label><input id="planPrecioMensual" name="precio_mensual" inputmode="numeric" placeholder="299900 o 0 si es a definir"></div><div><label for="planChats">Chats incluidos</label><input id="planChats" name="chats_incluidos" inputmode="numeric" placeholder="dejar vacío = por definir"></div><div><label>Setup cost</label><div class="form-note">Eliminado para todos los planes: $0.</div></div></div>
    <label for="planBeneficios">Beneficios <span class="label-hint">uno por línea</span></label><textarea id="planBeneficios" name="beneficios" rows="4" maxlength="3200" placeholder="Atención 24/7&#10;Respuestas en menos de 5 segundos&#10;Reportes mensuales"></textarea>
    <div class="form-grid"><div><label for="planOrden">Orden</label><input id="planOrden" name="orden" inputmode="numeric" value="0"></div><div></div></div>
    <div class="form-error" id="planEditorError" role="alert" aria-live="assertive"></div><div class="modal-actions"><button class="button" type="button" onclick="closePlanEditor()">Cancelar</button><button class="button primary" id="planEditorSubmit" type="submit">Guardar plan</button></div>
  </form></section></div>
  <div class="modal-layer" id="botEditorModal" aria-hidden="true"><button class="modal-scrim" type="button" aria-label="Cerrar bot" onclick="closeBotEditor()"></button><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="botEditorTitle"><div class="modal-head"><div><span class="eyebrow">CATÁLOGO</span><h2 id="botEditorTitle">Nuevo bot</h2><p>Un bot es el producto; el plan es cómo se cobra.</p></div><button class="close-button" type="button" onclick="closeBotEditor()" aria-label="Cerrar">${icon("close", 19)}</button></div><form id="botEditorForm" class="customer-form" novalidate>
    <div class="form-grid"><div><label for="botNombre">Nombre del bot</label><input id="botNombre" name="nombre" maxlength="120" placeholder="Atención al cliente" required></div><div><label for="botIdField">Identificador</label><input id="botIdField" name="id" maxlength="64" placeholder="se genera solo"></div></div>
    <label for="botDescripcion">Descripción</label><input id="botDescripcion" name="descripcion" maxlength="400" placeholder="Responde preguntas y atiende clientes 24/7.">
    <div class="form-grid"><div><label for="botOrden">Orden</label><input id="botOrden" name="orden" inputmode="numeric" value="0"></div><div></div></div>
    <div class="form-error" id="botEditorError" role="alert" aria-live="assertive"></div><div class="modal-actions"><button class="button" type="button" onclick="closeBotEditor()">Cancelar</button><button class="button primary" id="botEditorSubmit" type="submit">Guardar bot</button></div>
  </form></section></div>
  <div class="modal-layer" id="tenantDeleteModal" aria-hidden="true"><button class="modal-scrim" type="button" aria-label="Cerrar" onclick="closeTenantDelete()"></button><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="tenantDeleteTitle"><div class="modal-head"><div><span class="eyebrow danger-eyebrow">IRREVERSIBLE</span><h2 id="tenantDeleteTitle">Eliminar cliente</h2><p id="tenantDeleteLead">Esta acción no se puede deshacer.</p></div><button class="close-button" type="button" onclick="closeTenantDelete()" aria-label="Cerrar">${icon("close", 19)}</button></div><form id="tenantDeleteForm" class="customer-form" novalidate>
    <input type="hidden" id="tenantDeleteId" value="">
    <div class="danger-steps"><div class="danger-step"><span class="step-number">1</span><div><strong>Se descarga un respaldo antes de borrar</strong><p>Incluye cliente, usuarios, invitaciones y auditoría.</p></div></div><div class="danger-step"><span class="step-number">2</span><div><strong>Escribe el nombre exacto de la empresa</strong><p>Así confirmás que sabés cuál estás eliminando.</p></div></div><div class="danger-step"><span class="step-number">3</span><div><strong>El acceso se corta automáticamente</strong><p id="tenantDeleteStatusNote">El cliente se suspende antes del borrado definitivo.</p></div></div></div>
    <label for="tenantDeleteConfirm">Nombre de la empresa</label><input id="tenantDeleteConfirm" name="company_name_confirmacion" maxlength="120" autocomplete="off" required>
    <label class="checkbox-row"><input type="checkbox" id="tenantDeleteFinal"> Entiendo que esto es irreversible y que los datos no se pueden recuperar.</label>
    <div class="form-error" id="tenantDeleteError" role="alert" aria-live="assertive"></div><div class="modal-actions"><button class="button" type="button" onclick="closeTenantDelete()">Cancelar</button><button class="button danger-solid" id="tenantDeleteSubmit" type="submit" disabled>Eliminar definitivamente</button></div>
  </form></section></div>` : "";

  res.setHeader("content-type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Panel Super Admin · NexforIA</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap');
:root{
--navy-950:#060F22;--navy-900:#0A1836;--navy-800:#0E2148;--navy-700:#122A5C;--navy-600:#1B3A78;--navy-500:#254B95;
--cyan-50:#EDF9FF;--cyan-100:#D7F1FE;--cyan-300:#57C2F3;--cyan-400:#29B1F5;--cyan-500:#00A0F0;--cyan-600:#0587CC;--cyan-700:#0A6BA1;
--slate-50:#F6F8FB;--slate-100:#EDF1F7;--slate-200:#DFE6F0;--slate-300:#C6D1E0;--slate-400:#94A3BC;--slate-500:#647289;--slate-600:#49576E;--slate-700:#313C50;
--green-500:#14A971;--green-50:#E9F8F2;--amber-500:#F5A524;--amber-50:#FFF7E7;--red-500:#EF4E4E;--red-50:#FFF0F0;
--surface-page:#F4F7FB;--surface-card:#FFFFFF;
--text-strong:#0A1836;--text-body:#313C50;--text-muted:#647289;--text-subtle:#94A3BC;
--border-subtle:#DFE6F0;--border-default:#C6D1E0;--border-brand:#00A0F0;
--gradient-cyan:linear-gradient(135deg,#00A0F0,#087FC3);--gradient-brand:linear-gradient(135deg,#122A5C,#00A0F0);--gradient-hero:linear-gradient(145deg,#122A5C,#060F22);
--radius-sm:8px;--radius-md:12px;--radius-lg:16px;--radius-xl:22px;--radius-2xl:32px;
--font-display:"Sora","Avenir Next",sans-serif;--font-body:"Plus Jakarta Sans","Avenir Next",sans-serif;--font-mono:"JetBrains Mono",monospace;
--shadow-xs:0 1px 2px rgba(10,24,54,.05);--shadow-sm:0 3px 12px rgba(10,24,54,.055);--shadow-md:0 12px 30px rgba(10,24,54,.08);--shadow-lg:0 22px 48px rgba(10,24,54,.14);--shadow-glow:0 10px 28px rgba(0,160,240,.28);
--focus-ring:0 0 0 3px rgba(0,160,240,.25);--ease:cubic-bezier(.22,.61,.36,1);
/* alias heredados */
--surface:var(--surface-page);--card:var(--surface-card);--border:var(--border-subtle);--display:var(--font-display);--body:var(--font-body);--mono:var(--font-mono);--green:var(--green-500);--amber:var(--amber-500);--red:var(--red-500);--focus:var(--focus-ring)}
*{box-sizing:border-box}html,body{height:100%}body{margin:0;background:var(--surface-page);color:var(--text-body);font-family:var(--font-body);font-size:14px}
.app{height:100vh;display:flex;overflow:hidden}
.sidebar{width:242px;flex:0 0 242px;background:var(--navy-950);color:#fff;padding:18px 13px;display:flex;flex-direction:column;gap:2px;overflow-y:auto;border-right:1px solid rgba(255,255,255,.06)}
.brand{display:flex;align-items:center;gap:10px;padding:4px 8px 14px}
.brand-mark{height:28px;width:auto;object-fit:contain}
.brand-lumen{display:none}
.brand-name{font-family:var(--font-display);font-weight:800;font-size:15px;letter-spacing:-.01em;line-height:1}.brand-name span{color:var(--cyan-400)}
.brand-role{margin-top:3px;font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.42)}
.nav-group{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.32);font-weight:700;padding:14px 9px 5px}
.nav-group:first-of-type{padding-top:8px}
.nav-button{width:100%;min-height:40px;padding:0 11px;border:0;border-radius:var(--radius-md);background:transparent;color:rgba(255,255,255,.68);display:flex;align-items:center;gap:10px;font:700 13px var(--font-body);cursor:pointer;transition:160ms var(--ease);text-align:left}
.nav-button:hover:not(:disabled){color:#fff;background:rgba(255,255,255,.06)}
.nav-button.active{color:#fff;background:var(--gradient-cyan);box-shadow:var(--shadow-glow)}
.nav-button:disabled{opacity:.45;cursor:not-allowed}
.nav-button>span:nth-child(2){flex:1}
.nav-badge{min-width:22px;padding:3px 6px;border-radius:999px;background:rgba(255,255,255,.12);font:600 10px var(--font-mono);text-align:center}
.nav-button.active .nav-badge{background:rgba(6,15,34,.28);color:#fff}
.nav-soon{font-size:8.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:rgba(255,255,255,.4);border:1px solid rgba(255,255,255,.16);border-radius:5px;padding:2px 5px}
.sidebar-bottom{margin-top:auto;display:flex;flex-direction:column;gap:11px;padding-top:14px}
.goal-card{position:relative;width:100%;padding:14px 13px 13px 15px;background:linear-gradient(150deg,rgba(0,160,240,.18),rgba(255,255,255,.03));border-radius:var(--radius-lg);border:1px solid rgba(255,255,255,.1);overflow:hidden;color:#fff;text-align:left;font:inherit;cursor:pointer;transition:160ms var(--ease)}
.goal-card:hover{border-color:rgba(84,199,255,.5);background:linear-gradient(150deg,rgba(0,160,240,.25),rgba(255,255,255,.05));transform:translateY(-1px)}
.goal-card img{position:absolute;right:-17px;bottom:-9px;height:76px;width:auto;opacity:.9;pointer-events:none}
.goal-body{position:relative;display:block;max-width:154px}
.goal-label{display:block;font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.5);font-weight:800;margin-bottom:5px}
.goal-value{display:block;font:800 16px var(--font-display);letter-spacing:-.02em;color:#fff;line-height:1.15}
.goal-count{display:flex;align-items:baseline;gap:5px;margin-top:7px}
.goal-count strong{font-family:var(--font-display);font-weight:800;font-size:15px;color:#fff;line-height:1}
.goal-count span{font-size:10px;color:rgba(255,255,255,.5)}
.goal-track{height:5px;border-radius:999px;background:rgba(255,255,255,.14);overflow:hidden;margin-top:8px}
.goal-track>span{display:block;height:100%;border-radius:inherit;min-width:4px;background:linear-gradient(90deg,#00A0F0,#57C2F3);transition:width .5s var(--ease)}
.goal-phrase{font-size:10.5px;color:rgba(255,255,255,.62);line-height:1.35;margin:9px 0 0;max-width:118px}
.goal-edit{display:inline-flex;align-items:center;gap:4px;margin-top:7px;color:var(--cyan-300);font-size:9px;font-weight:800}
.mobile-goal-shell{display:none}
.user-card{display:flex;align-items:center;gap:10px;padding:4px 8px}
.avatar{display:inline-grid;place-items:center;border-radius:50%;background:var(--gradient-cyan);color:#fff;font:800 12px var(--font-display);flex:0 0 auto}
.avatar.sm{width:32px;height:32px}.avatar.lg{width:50px;height:50px;font-size:15px}
.user-card strong{display:block;font-size:12.5px;color:#fff}.user-card span{display:block;font-size:10.5px;color:rgba(255,255,255,.5);margin-top:2px}
.workspace{min-width:0;flex:1;display:flex;flex-direction:column;overflow:hidden}
.topbar{flex:0 0 auto;padding:16px 24px;background:var(--surface-card);border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;gap:16px}
.page-heading{flex:1;min-width:0}
.page-heading h1{font:700 20px var(--font-display);letter-spacing:-.02em;color:var(--text-strong);margin:0}
.page-heading p{font-size:12.5px;color:var(--text-muted);margin:3px 0 0}
.top-actions{display:flex;align-items:center;gap:8px}
.button{min-height:40px;border:1px solid var(--border-default);border-radius:var(--radius-md);padding:0 13px;background:var(--surface-card);color:var(--text-body);font:700 12px var(--font-body);display:inline-flex;align-items:center;justify-content:center;gap:7px;text-decoration:none;cursor:pointer;transition:150ms var(--ease)}
.button:hover{border-color:var(--border-brand);color:var(--cyan-700);background:var(--cyan-50)}
.button.primary{border-color:transparent;background:var(--gradient-cyan);color:#fff;box-shadow:var(--shadow-glow)}
.button.danger{color:#B73535;border-color:#F5CACA}
.button.icon-only{width:40px;padding:0}.button:disabled{opacity:.55;cursor:wait}
.link-button{border:0;background:none;color:var(--cyan-600);font:700 12.5px var(--font-body);cursor:pointer;white-space:nowrap;padding:0}
.content{flex:1;overflow:auto}
.view{display:none;padding:22px 24px 34px;max-width:1088px;animation:rise .28s var(--ease)}
.view.active{display:block}
.section-title{display:flex;align-items:baseline;gap:9px;margin:22px 0 13px}
.section-title h2{font:700 16px var(--font-display);color:var(--text-strong);margin:0}
.section-title span{font-size:12.5px;color:var(--text-muted)}
.grid-4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.stat-card,.card{background:var(--surface-card);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);box-shadow:var(--shadow-md)}
.stat-card{padding:17px 19px}
.stat-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;color:var(--text-muted);font-size:12px;font-weight:600}
.icon-chip{width:30px;height:30px;flex:0 0 auto;border-radius:9px;background:var(--cyan-50);color:var(--cyan-600);display:grid;place-items:center}
.icon-chip.amber{background:var(--amber-50);color:#B77509}
.icon-chip.navy{background:var(--slate-100);color:var(--navy-600)}
.icon-chip.sm{width:24px;height:24px;border-radius:7px}
.stat-value{font:800 29px var(--font-display);letter-spacing:-.03em;line-height:1;color:var(--text-strong)}
.stat-sub{font-size:11.5px;color:var(--text-subtle);margin-top:6px}
.bot-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.bot-card{overflow:hidden;padding:0}
.bot-head{display:flex;align-items:center;gap:11px;padding:15px 18px;border-bottom:1px solid var(--border-subtle)}
.bot-head strong{display:block;font:700 15px var(--font-display);color:var(--text-strong)}
.bot-head span{display:block;font-size:11.5px;color:var(--text-muted)}
.bot-head>div{flex:1;min-width:0}
.bot-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--slate-100)}
.bot-metrics>div{background:var(--surface-card);padding:14px 16px}
.bot-metrics span{font-size:11px;color:var(--text-muted);font-weight:600}
.bot-metrics strong{display:block;font:800 20px var(--font-display);color:var(--text-strong);margin-top:4px}
.bot-metrics small{font-size:10.5px;color:var(--text-subtle)}
.bot-margin{padding:13px 18px}
.bot-margin-top{display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px}
.bot-margin-top span{color:var(--text-muted);font-weight:600}
.bot-margin-top strong{font-family:var(--font-mono);font-weight:800;color:var(--green-500)}
.bar{height:7px;background:var(--slate-100);border-radius:999px;overflow:hidden}
.bar>span{display:block;height:100%;border-radius:inherit;min-width:4px}
.bar>span.cyan{background:var(--gradient-cyan)}.bar>span.navy{background:var(--navy-500)}
.compare-head,.compare-row{display:grid;grid-template-columns:1.4fr 90px 1fr 1fr 1fr 96px;gap:12px;align-items:center;min-width:760px}
.compare-head{padding:12px 20px;border-bottom:1px solid var(--border-subtle);background:var(--slate-50);font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;font-weight:700;color:var(--text-subtle)}
.compare-row{padding:14px 20px;border-top:1px solid var(--slate-100)}
.compare-row.total{background:var(--slate-50);font-weight:800}
.compare-name{display:flex;align-items:center;gap:9px;font-weight:700;font-size:13.5px;color:var(--text-strong)}
.compare-name svg{color:var(--cyan-600);flex:0 0 auto}
.mono{font-family:var(--font-mono);font-size:13px;color:var(--text-body);font-weight:600}
.mono.right{text-align:right}.mono.strong{color:var(--text-strong);font-weight:700}.mono.margin{color:var(--green-500);font-weight:800}
.pareto-card{padding:0;overflow:hidden}
.pareto-head{display:flex;align-items:center;gap:11px;padding:16px 20px 14px;border-bottom:1px solid var(--border-subtle)}
.pareto-head>div{flex:1;min-width:0}
.pareto-head strong{display:block;font:700 15px var(--font-display);color:var(--text-strong)}
.pareto-head span{font-size:12px;color:var(--text-muted)}
.insight-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;background:var(--navy-800);color:#fff;font-size:11.5px;font-weight:700;white-space:nowrap}
.pareto-body{padding:8px 20px 18px}
.pareto-row{padding:12px 0;border-bottom:1px solid var(--slate-100);display:flex;flex-direction:column;gap:8px}
.pareto-row:last-child{border-bottom:0}
.pareto-top{display:flex;align-items:center;gap:10px}
.rank{width:16px;flex:0 0 auto;color:var(--text-subtle);font-weight:700}
.pareto-name{flex:1;font-weight:700;font-size:13.5px;color:var(--text-strong)}
.pareto-pct{font:800 16px var(--font-display);color:var(--text-strong);min-width:44px;text-align:right}
.pareto-accum{font-size:11px;color:var(--text-subtle)}
.attention{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.attention-card{border:1px solid var(--border-subtle);border-radius:var(--radius-lg);background:var(--surface-card);padding:16px;text-align:left;display:flex;align-items:center;gap:12px;box-shadow:var(--shadow-sm);cursor:pointer;font:inherit;transition:160ms var(--ease)}
.attention-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}
.attention-icon{width:42px;height:42px;flex:0 0 auto;border-radius:var(--radius-md);display:grid;place-items:center}
.attention-icon.red{background:var(--red-50);color:#C83F3F}
.attention-icon.amber{background:var(--amber-50);color:#B77509}
.attention-icon.warning{background:var(--amber-50);color:#B77509}
.attention-icon.neutral{background:var(--slate-100);color:var(--slate-600)}
.attention-icon.info{background:var(--cyan-50);color:var(--cyan-600)}
.attention-value{font:800 25px var(--font-display);letter-spacing:-.02em;color:var(--text-strong);line-height:1}
.attention-card p{font-size:11.5px;color:var(--text-muted);margin:4px 0 0}
.attention-card strong{display:block;color:var(--text-strong);font-size:13px}
.source-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.source-card{padding:16px 18px}
.source-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
.source-head strong{font:700 14px var(--font-display);color:var(--text-strong)}
.source-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:11px}
.source-metrics span{display:block;font-size:10.5px;color:var(--text-muted)}
.source-metrics strong{display:block;font:800 17px var(--font-display);color:var(--text-strong);margin-top:2px}
.two-col{display:grid;grid-template-columns:1.05fr .95fr;gap:14px;margin-top:18px}
.stack{display:flex;flex-direction:column;gap:20px}
.card{padding:20px}
.card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:15px}
.card-head h2{font:700 15px var(--font-display);color:var(--text-strong);margin:0}
.card-head p{font-size:11px;color:var(--text-muted);margin:4px 0 0}
.badge{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:800}
.badge.dot:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.badge.success{background:var(--green-50);color:#087E54}
.badge.warning{background:var(--amber-50);color:#9C650C}
.badge.danger{background:var(--red-50);color:#C83F3F}
.badge.info{background:var(--cyan-50);color:var(--cyan-700)}
.badge.neutral{background:var(--slate-100);color:var(--slate-600)}
.readiness-list,.health-list{display:grid}
.readiness-row,.health-row{min-height:45px;border-top:1px solid var(--slate-100);display:flex;align-items:center;justify-content:space-between;gap:12px}
.readiness-row:first-child,.health-row:first-child{border-top:0}
.readiness-row strong{display:block;color:var(--text-body);font-size:12px}
.readiness-row div span{display:block;color:var(--text-muted);font-size:10px;margin-top:2px}
.health-row span:first-child{font-size:12px;color:var(--text-muted)}
.health-value{font-size:11px;font-weight:800}
.health-value.ok{color:#087E54}.health-value.warn{color:#9C650C}.health-value.err{color:#C83F3F}
.callout{margin-top:18px;padding:15px 17px;border:1px solid #F0D29C;border-radius:15px;background:var(--amber-50);display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.callout strong{display:block;color:#80510A;font-size:12px}
.callout p{margin:4px 0 0;color:#9C650C;font-size:11px;line-height:1.55}
.client-list{margin-top:18px;overflow:hidden;padding:0}
.list-head{padding:16px 19px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between}
.list-head h2{font:700 14px var(--font-display);color:var(--text-strong);margin:0}
.lead-list-head{align-items:flex-start;gap:12px;flex-wrap:wrap}
.lead-list-head>div:first-child{display:flex;align-items:center;gap:9px}
.lead-tools{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.lead-search{width:min(260px,52vw)}
.lead-sort{height:38px;border:1.5px solid var(--border-default);border-radius:var(--radius-md);padding:0 10px;background:#fff;color:var(--text-strong);font:700 11px var(--font-body)}
.client-row{width:100%;border:0;background:var(--surface-card);padding:14px 19px;display:flex;align-items:center;gap:13px;text-align:left;cursor:pointer}
.client-row:hover{background:var(--slate-50)}
.client-main{flex:1;min-width:0}
.client-main strong{display:block;color:var(--text-strong);font-size:13px}
.client-main span{display:block;color:var(--text-muted);font-size:10.5px;margin-top:2px}
.client-row .chevron{color:var(--text-subtle)}
.version-card{border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 12px;color:rgba(255,255,255,.55);font:600 10px var(--font-mono);line-height:1.45;background:rgba(255,255,255,.03)}
.version-card strong{display:block;color:rgba(255,255,255,.86);font:800 10.5px var(--font-body);margin-bottom:2px}
.toolbar{display:flex;align-items:center;gap:12px;margin-bottom:15px}
.search{position:relative;width:min(360px,100%)}
.search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-subtle)}
.search input{width:100%;height:40px;border:1.5px solid var(--border-default);border-radius:var(--radius-md);padding:0 14px 0 38px;font:500 13.5px var(--font-body);color:var(--text-strong);background:var(--surface-card);outline:0}
.search input:focus{border-color:var(--border-brand);box-shadow:var(--focus-ring)}
.filter-chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{border:1px solid var(--border-subtle);border-radius:999px;background:var(--surface-card);padding:7px 11px;color:var(--text-muted);font:700 11px var(--font-body)}
.chip.active{background:var(--navy-900);border-color:var(--navy-900);color:#fff}
.chip span{font:600 9px var(--font-mono);margin-left:5px;color:var(--cyan-500)}
.table-card{overflow:hidden;padding:0}
.table-head,.tenant-row{min-width:900px;display:grid;grid-template-columns:2fr 1.1fr .75fr 1.1fr .9fr 100px;gap:14px;align-items:center}
.table-head{padding:12px 18px;background:var(--slate-50);border-bottom:1px solid var(--border-subtle);font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--text-subtle)}
.table-scroll{overflow:auto}
.tenant-row{width:100%;padding:15px 18px;border:0;background:var(--surface-card);text-align:left;font:inherit;cursor:pointer}
.tenant-row:hover{background:var(--slate-50)}
.tenant-cell{display:flex;align-items:center;gap:10px}
.tenant-cell strong{display:block;font-size:12px;color:var(--text-strong)}
.tenant-cell span{font-size:10px;color:var(--text-muted)}
.table-client-link{display:flex;align-items:center;gap:10px;border:0;background:transparent;padding:0;color:inherit;text-align:left;font:inherit;cursor:pointer;text-decoration:none}
.table-client-link:hover strong{text-decoration:underline}
.legacy-delete{border:1px solid rgba(220,38,38,.28);border-radius:999px;background:#fff;color:#b91c1c;padding:8px 12px;font:800 11px var(--font-body);cursor:pointer}
.legacy-delete:hover{background:#fee2e2;border-color:#ef4444}
.legacy-delete:disabled{opacity:.55;cursor:not-allowed}
.cell-text{font-size:11px;color:var(--text-muted)}
.empty{padding:48px 24px;text-align:center}
.empty-icon{width:54px;height:54px;border-radius:17px;background:var(--cyan-50);color:var(--cyan-600);display:grid;place-items:center;margin:0 auto 15px}
.empty h2{font:700 16px var(--font-display);color:var(--text-strong);margin:0}
.empty p{max-width:520px;margin:7px auto 0;font-size:12px;line-height:1.6;color:var(--text-muted)}
.empty-lumen{height:74px;width:auto;margin:0 auto 12px;display:block;opacity:.95}
.role-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.role-card{border:1px solid var(--border-subtle);border-radius:13px;padding:13px;background:var(--slate-50)}
.role-top,.split-title{display:flex;align-items:center;justify-content:space-between;gap:8px}
.role-card code,.role-pills code,.fields code{font:600 10px var(--font-mono);color:var(--cyan-700);background:var(--cyan-50);border:1px solid var(--cyan-100);padding:4px 7px;border-radius:7px}
.role-top span,.split-title span{font-size:9.5px;color:var(--text-muted)}
.role-card>strong{display:block;font-size:11px;margin-top:9px;color:var(--text-strong)}
.role-card p,.split-card p{font-size:10.5px;line-height:1.55;color:var(--text-muted);margin:4px 0 0}
.split-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
.split-card{display:grid;grid-template-columns:auto 1fr;gap:11px;border:1px solid var(--border-subtle);border-radius:14px;padding:14px}
.split-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:11px;background:var(--cyan-50);color:var(--cyan-600)}
.split-title strong{font:700 13px var(--font-display);color:var(--text-strong)}
.role-pills,.fields{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.steps{list-style:none;padding:0;margin:0}
.steps li{min-height:62px;border-top:1px solid var(--slate-100);display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:11px}
.steps li:first-child{border-top:0}
.step-number{width:28px;height:28px;border-radius:9px;background:var(--slate-100);display:grid;place-items:center;font:700 10px var(--font-mono);color:var(--text-muted)}
.steps strong{font-size:11.5px;color:var(--text-strong)}
.steps p{font-size:10px;color:var(--text-muted);margin:3px 0 0}
.drawer-layer{position:fixed;inset:0;z-index:30;display:none}
.drawer-layer.open{display:block}
.scrim{position:absolute;inset:0;background:rgba(6,15,34,.55);backdrop-filter:blur(3px);animation:fade .2s var(--ease);border:0;width:100%}
.drawer{position:absolute;right:0;top:0;height:100%;width:min(468px,94vw);background:var(--surface-card);box-shadow:-24px 0 60px rgba(10,24,54,.28);display:flex;flex-direction:column;animation:drawer .28s var(--ease)}
.drawer-head{padding:21px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:flex-start;gap:12px}
.drawer-title{flex:1}
.drawer-title h2{font:700 17px var(--font-display);color:var(--text-strong);margin:2px 0 4px}
.drawer-title p{font-size:11px;color:var(--text-muted);margin:0}
.drawer-badges{display:flex;gap:6px;margin-top:9px}
.close-button{width:38px;height:38px;border:0;border-radius:11px;background:var(--slate-50);color:var(--text-muted);display:grid;place-items:center;cursor:pointer}
.drawer-body{padding:20px;overflow:auto;display:grid;gap:15px}
.next-card{padding:15px;border:1px solid var(--cyan-100);border-radius:14px;background:var(--cyan-50);display:grid;grid-template-columns:auto 1fr;gap:10px}
.next-card svg{color:var(--cyan-600)}
.next-card strong{font-size:11px;color:var(--text-strong)}
.next-card p{font-size:10.5px;line-height:1.55;color:var(--text-muted);margin:4px 0 0}
.mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mini-card{padding:13px;border:1px solid var(--border-subtle);border-radius:12px}
.mini-card span{display:block;font-size:9.5px;color:var(--text-muted)}
.mini-card strong{display:block;font:700 14px var(--font-display);color:var(--text-strong);margin-top:4px}
.drawer-section{padding:15px;border:1px solid var(--border-subtle);border-radius:14px}
.drawer-section h3{font:700 12px var(--font-display);color:var(--text-strong);margin:0 0 11px}
.integration{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-top:1px solid var(--slate-100);font-size:11px}
.integration:first-of-type{border-top:0}
.drawer-foot{padding:16px 20px;border-top:1px solid var(--border-subtle);display:grid;grid-template-columns:1fr 1fr;gap:9px}
.toast{position:fixed;right:22px;bottom:22px;z-index:60;max-width:330px;padding:12px 15px;border-radius:12px;background:var(--navy-900);color:#fff;font-size:11px;box-shadow:var(--shadow-lg);opacity:0;pointer-events:none;transform:translateY(8px);transition:.2s var(--ease)}
.toast.show{opacity:1;transform:none}
.access-card{padding:0;overflow:hidden}.invite-head,.invite-row{display:grid;grid-template-columns:1.45fr 1fr .85fr .9fr auto;gap:12px;align-items:center}.invite-head{padding:10px 18px;background:var(--slate-50);border-top:1px solid var(--border-subtle);border-bottom:1px solid var(--border-subtle);color:var(--text-subtle);font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.invite-row,.lead-row{min-height:65px;padding:12px 18px;border-top:1px solid var(--slate-100)}.invite-row{display:grid;grid-template-columns:1.45fr 1fr .85fr .9fr auto;gap:12px;align-items:center}.lead-row,.lead-table-head{display:grid;grid-template-columns:1.12fr 1.12fr .75fr .78fr .75fr 1.25fr;gap:12px;align-items:center}.invite-row:first-child,.lead-row:first-child{border-top:0}.invite-row strong,.lead-row strong{display:block;color:var(--text-strong);font-size:11.5px}.invite-row small,.lead-row small{display:block;margin-top:3px;color:var(--text-muted);font-size:9.5px;line-height:1.45}.invite-loading{padding:28px;text-align:center;color:var(--text-muted);font-size:11px}.modal-layer{position:fixed;inset:0;z-index:70;display:none;place-items:center;padding:20px}.modal-layer.open{display:grid}.modal-scrim{position:absolute;inset:0;width:100%;border:0;background:rgba(6,15,34,.62);backdrop-filter:blur(4px)}.modal-card{position:relative;width:min(590px,96vw);max-height:94vh;overflow:auto;border:1px solid var(--border-subtle);border-radius:20px;background:var(--surface-card);box-shadow:var(--shadow-lg);animation:rise .2s var(--ease)}.modal-head{display:flex;align-items:flex-start;gap:15px;padding:22px 24px 17px;border-bottom:1px solid var(--border-subtle)}.modal-head>div{flex:1}.modal-head h2{font:800 20px var(--font-display);margin:2px 0 5px;color:var(--text-strong)}.modal-head p{margin:0;color:var(--text-muted);font-size:11px;line-height:1.55}.eyebrow{color:var(--cyan-700);font-size:9px;font-weight:800;letter-spacing:.13em}.customer-form{padding:21px 24px}.customer-form label{display:block;margin:13px 0 6px;color:var(--text-strong);font-size:10.5px;font-weight:800}.customer-form>label:first-child{margin-top:0}.customer-form input,.customer-form select{width:100%;height:43px;border:1.5px solid var(--border-default);border-radius:10px;padding:0 11px;background:#fff;color:var(--text-strong);font:600 12px var(--font-body);outline:0}.customer-form input:focus,.customer-form select:focus{border-color:var(--border-brand);box-shadow:var(--focus-ring)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.form-note{margin-top:16px;padding:11px 12px;border-radius:10px;background:var(--cyan-50);color:var(--cyan-700);font-size:10px;line-height:1.5}.form-error{min-height:17px;margin-top:9px;color:#C83F3F;font-size:10.5px}.modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:9px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.section-title .button{margin-left:auto}
.info-callout{border-color:var(--cyan-100);background:var(--cyan-50)}
.info-callout strong{color:var(--cyan-700)}
.info-callout p{color:var(--text-muted)}
.catalog-row{display:grid;grid-template-columns:minmax(0,1.6fr) 1fr 1fr .8fr auto;gap:14px;align-items:center;padding:14px 18px;border-top:1px solid var(--slate-100)}
.catalog-row:first-child{border-top:0}
.catalog-row.inactive{opacity:.55}
.catalog-main strong{display:block;font-size:13px;color:var(--text-strong)}
.catalog-main span{display:block;font-size:10.5px;color:var(--text-muted);margin-top:2px}
.catalog-main code{font:600 9.5px var(--font-mono);color:var(--cyan-700);background:var(--cyan-50);border:1px solid var(--cyan-100);padding:2px 5px;border-radius:6px;margin-top:5px;display:inline-block}
.catalog-price{font-family:var(--font-mono);font-size:12.5px;color:var(--text-strong);font-weight:700}
.catalog-price small{display:block;font:500 10px var(--font-body);color:var(--text-subtle);margin-top:2px}
.catalog-actions{display:flex;gap:6px;align-items:center;justify-content:flex-end}
.catalog-actions .button{min-height:32px;padding:0 10px;font-size:11px}
.catalog-benefits{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}
.catalog-benefits span{font-size:10px;color:var(--text-muted);background:var(--slate-50);border:1px solid var(--border-subtle);border-radius:6px;padding:2px 6px}
.billing-list{display:grid;gap:14px}.billing-card{border:1px solid var(--border-subtle);border-radius:14px;background:#fff;overflow:hidden}.billing-card-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:14px 16px;border-bottom:1px solid var(--border-subtle)}.billing-card-head strong{display:block;color:var(--text-strong);font-size:14px}.billing-card-head small{display:block;margin-top:3px;color:var(--text-muted);font-size:10px}.billing-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr))}.billing-metric{padding:12px 14px;border-right:1px solid var(--border-subtle);border-bottom:1px solid var(--border-subtle)}.billing-metric:nth-child(5n){border-right:0}.billing-metric small{display:block;color:var(--text-subtle);font-size:9px;text-transform:uppercase;letter-spacing:.06em}.billing-metric strong{display:block;margin-top:5px;color:var(--text-strong);font-size:11px}.billing-history{padding:12px 16px}.billing-history-row{display:grid;grid-template-columns:1.2fr .8fr .8fr .8fr;gap:10px;padding:8px 0;border-top:1px solid var(--border-subtle);font-size:10px}.billing-history-row:first-child{border-top:0}.billing-history-row span{color:var(--text-muted)}.billing-bypass{display:flex;gap:7px;flex-wrap:wrap}.fee-kind{font-size:8px;font-weight:800;text-transform:uppercase;color:var(--cyan-700)}
.modal-card.wide{max-width:660px}
.form-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
.label-hint{font-weight:500;color:var(--text-subtle);font-size:10.5px}
.customer-form textarea{width:100%;border:1.5px solid var(--border-default);border-radius:var(--radius-md);padding:10px 12px;font:500 13px var(--font-body);color:var(--text-strong);background:var(--surface-card);outline:0;resize:vertical}
.customer-form textarea:focus{border-color:var(--border-brand);box-shadow:var(--focus-ring)}
.danger-eyebrow{color:#C83F3F!important}
.danger-steps{display:grid;gap:10px;margin:4px 0 14px;padding:14px;border:1px solid #F5CACA;border-radius:var(--radius-md);background:var(--red-50)}
.danger-step{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start}
.danger-step strong{font-size:11.5px;color:#8B2C2C}
.danger-step p{font-size:10.5px;color:#A34545;margin:2px 0 0}
.danger-step .step-number{background:#fff;color:#C83F3F}
.checkbox-row{display:flex;gap:9px;align-items:flex-start;font-size:11.5px;color:var(--text-body);line-height:1.5;margin-top:4px}
.checkbox-row input{width:16px;height:16px;flex:0 0 auto;margin-top:1px}
.button.danger-solid{background:#C83F3F;border-color:#C83F3F;color:#fff}
.button.danger-solid:hover:not(:disabled){background:#B23636;border-color:#B23636;color:#fff}
.button.danger-solid:disabled{opacity:.45;cursor:not-allowed}
.status-pill{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:800;border-radius:999px;padding:4px 9px}
.status-pill.activo{background:var(--green-50);color:#087E54}
.status-pill.suspendido{background:var(--amber-50);color:#9C650C}
.status-pill.archivado{background:var(--slate-100);color:var(--slate-600)}
.status-pill.setup{background:var(--cyan-50);color:var(--cyan-700)}
.setup-review-layout{display:grid;grid-template-columns:minmax(280px,.9fr) minmax(0,1.4fr);gap:14px;align-items:start}
.setup-review-list{display:grid;gap:10px}
.setup-review-row{width:100%;border:1px solid var(--border-subtle);border-radius:16px;background:#fff;padding:13px;text-align:left;color:var(--text-body);cursor:pointer}
.setup-review-row.active{border-color:var(--cyan-500);box-shadow:0 0 0 3px rgba(0,160,240,.1)}
.setup-review-row strong{display:block;color:var(--text-strong);font-size:13px;margin-bottom:4px}
.setup-review-row small{display:block;color:var(--text-muted);font-size:10.5px;line-height:1.45}
[data-panel="botOps"] .setup-review-row{cursor:default;display:grid;grid-template-columns:minmax(160px,1fr) minmax(130px,.65fr) minmax(180px,1.2fr);gap:12px;align-items:start}
@media(max-width:760px){[data-panel="botOps"] .setup-review-row{grid-template-columns:1fr}}
.setup-status{display:inline-flex;align-items:center;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:900;margin-top:8px}
.setup-status.incomplete{background:var(--red-50);color:#B73535}
.setup-status.ready{background:var(--green-50);color:#087E54}
.setup-status.building{background:var(--cyan-50);color:var(--cyan-700)}
.setup-status.testing{background:var(--amber-50);color:#9C650C}
.setup-status.live{background:var(--green-50);color:#087E54}
.setup-review-detail{display:grid;gap:14px}
.setup-review-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.setup-review-field{display:grid;gap:5px}
.setup-review-field.wide{grid-column:1/-1}
.setup-review-field label{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted)}
.setup-review-field input,.setup-review-field textarea,.setup-review-field select{width:100%;border:1px solid var(--border-default);border-radius:10px;padding:10px 11px;background:#fff;color:var(--text-strong);font:600 12px var(--font-body)}
.setup-review-field textarea{min-height:82px;resize:vertical;line-height:1.45}
.setup-review-field textarea[readonly]{min-height:260px;background:var(--slate-50);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;font-weight:500}
.setup-config-editor{display:grid;gap:14px;padding-top:18px;border-top:1px solid var(--border-subtle)}
.setup-config-editor .question-toolbar{margin-bottom:0}
.setup-channel-summary{display:grid;gap:12px;padding:15px;border:1px solid #BEE6FB;background:#F1FAFF;border-radius:16px}
.setup-channel-summary .question-toolbar{margin-bottom:0}
.setup-channel-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.setup-channel-card{display:grid;gap:6px;padding:13px;border:1px solid var(--border-subtle);border-radius:14px;background:#fff}
.setup-channel-card strong{color:var(--text-strong);font-size:13px}
.setup-channel-card small{color:var(--text-muted);font-size:10.5px;word-break:break-word}
.setup-channel-card p{margin:0;color:var(--text-muted);font-size:11px;line-height:1.45}
.launch-checklist{display:grid;gap:8px;margin-top:12px}
.launch-check{display:flex;align-items:flex-start;gap:9px;border:1px solid var(--border-subtle);background:#fff;border-radius:12px;padding:10px 11px}
.launch-dot{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;flex:0 0 auto;font-size:12px;font-weight:900}
.launch-check.ok .launch-dot{background:var(--green-50);color:#087E54}
.launch-check.warning .launch-dot{background:var(--amber-50);color:#9C650C}
.launch-check.blocker .launch-dot{background:var(--red-50);color:#C83F3F}
.launch-check strong{display:block;color:var(--text-strong);font-size:11.5px}
.launch-check span{display:block;color:var(--text-muted);font-size:10.5px;line-height:1.4;margin-top:2px}
.setup-review-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.setup-review-history{display:grid;gap:8px}
.setup-review-history div{padding:9px 10px;border:1px solid var(--border-subtle);border-radius:12px;background:var(--slate-50);font-size:11px;color:var(--text-muted);line-height:1.45}
.channel-admin-list{display:grid;gap:10px}
.channel-admin-row{display:grid;grid-template-columns:minmax(180px,1.15fr) 140px minmax(170px,1fr) minmax(160px,1fr) auto;gap:12px;align-items:center;padding:14px;border:1px solid var(--border-subtle);border-radius:15px;background:#fff}
.channel-admin-row strong{display:block;color:var(--text-strong);font-size:12.5px}
.channel-admin-row small{display:block;color:var(--text-muted);font-size:10px;line-height:1.45;margin-top:3px;word-break:break-word}
.channel-admin-actions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap}
.channel-admin-error{color:#B73535!important;max-width:260px}
@media(max-width:1100px){.channel-admin-row{grid-template-columns:1fr 1fr}.channel-admin-actions{justify-content:flex-start;grid-column:1/-1}}
@media(max-width:620px){.channel-admin-row{grid-template-columns:1fr}}
@media(max-width:980px){.setup-review-layout{grid-template-columns:1fr}.setup-review-fields,.setup-channel-grid{grid-template-columns:1fr}}
.question-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.question-toolbar p{margin:0;color:var(--text-muted);font-size:11.5px;line-height:1.55}
.question-bot-picker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:14px}
.question-bot-card{border:1.5px solid var(--border-subtle);background:#fff;border-radius:18px;padding:16px;text-align:left;color:var(--text-body);transition:.16s}
.question-bot-card strong{display:block;color:var(--text-strong);font:700 15px var(--font-display);margin-bottom:5px}
.question-bot-card span{display:block;color:var(--text-muted);font-size:11.5px;line-height:1.5}
.question-bot-card.active{border-color:var(--cyan-500);background:linear-gradient(180deg,#F1FAFF,#fff);box-shadow:0 0 0 3px rgba(0,160,240,.1)}
.question-simple-note{padding:13px 14px;border:1px solid #BEE6FB;background:var(--cyan-50);border-radius:14px;color:#075985;font-size:11.5px;line-height:1.55;margin-bottom:14px}
.question-list{display:grid;gap:10px}
.question-row{display:grid;grid-template-columns:70px minmax(180px,1.2fr) minmax(130px,.75fr) minmax(120px,.7fr) 88px 88px 92px;gap:9px;align-items:end;padding:12px;border:1px solid var(--border-subtle);border-radius:16px;background:#fff}
.question-row.inactive{opacity:.62;background:var(--slate-50)}
.question-field{display:grid;gap:5px}
.question-field label{font-size:9.5px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted)}
.question-field input,.question-field select{width:100%;height:38px;border:1px solid var(--border-default);border-radius:10px;padding:0 10px;background:#fff;color:var(--text-strong);font:600 11.5px var(--font-body)}
.question-field.checkbox{align-items:center;justify-items:center;gap:7px}
.question-field.checkbox input{width:18px;height:18px}
.question-meta{font-size:10px;color:var(--text-muted);word-break:break-word;margin-top:4px}
.question-actions{display:flex;gap:6px;justify-content:flex-end}
.question-empty{padding:18px;border:1px dashed var(--border-default);border-radius:15px;color:var(--text-muted);font-size:12px;text-align:center}
@media(max-width:1160px){.question-row{grid-template-columns:70px 1fr 1fr}.question-actions{justify-content:flex-start}.question-field.checkbox{justify-items:start}}
@media(max-width:760px){.question-bot-picker{grid-template-columns:1fr}}
.goal-modal-layer{position:fixed;inset:0;z-index:75;display:none;align-items:center;justify-content:center;padding:20px}
.goal-modal-layer.open{display:flex}
.goal-modal{position:relative;width:min(460px,100%);background:var(--surface-card);border-radius:var(--radius-xl);box-shadow:var(--shadow-lg);animation:rise .22s var(--ease);overflow:hidden}
.goal-modal-head{padding:21px 22px 17px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:flex-start;gap:12px}
.goal-modal-head>div{flex:1}
.goal-modal-head h2{font:700 17px var(--font-display);color:var(--text-strong);margin:0}
.goal-modal-head p{font-size:11px;line-height:1.55;color:var(--text-muted);margin:5px 0 0}
.goal-form{padding:20px 22px 22px;display:grid;gap:15px}
.goal-field{display:grid;gap:6px}
.goal-field label{font-size:11px;font-weight:800;color:var(--text-body)}
.goal-field small{font-size:10px;line-height:1.5;color:var(--text-muted)}
.goal-field input,.goal-field select{width:100%;height:43px;border:1.5px solid var(--border-default);border-radius:var(--radius-md);padding:0 12px;background:#fff;color:var(--text-strong);font:600 13px var(--font-body);outline:0}
.goal-field input:focus,.goal-field select:focus{border-color:var(--border-brand);box-shadow:var(--focus-ring)}
.goal-field select:disabled{background:var(--slate-50);color:var(--text-muted);opacity:1}
.goal-form-error{min-height:16px;color:#B73535;font-size:10.5px}
.goal-modal-actions{display:flex;justify-content:flex-end;gap:8px}
@media(max-width:820px){.catalog-row{grid-template-columns:1fr;gap:8px}.catalog-actions{justify-content:flex-start}.form-grid.three{grid-template-columns:1fr}.billing-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.billing-history-row{grid-template-columns:1fr}}
:focus-visible{outline:0;box-shadow:var(--focus-ring)}
@keyframes rise{from{opacity:0;transform:translateY(8px)}}
@keyframes fade{from{opacity:0}}
@keyframes drawer{from{opacity:.5;transform:translateX(28px)}}
@media(max-width:1080px){.grid-4{grid-template-columns:repeat(2,1fr)}.attention{grid-template-columns:repeat(2,1fr)}.bot-grid,.two-col,.source-grid{grid-template-columns:1fr}.top-actions .optional{display:none}}
@media(max-width:820px){.app{height:auto;min-height:100%;display:block;overflow:visible}.sidebar{width:100%;height:auto;position:sticky;top:0;z-index:20;padding:12px 14px;flex-direction:row;align-items:center;gap:6px;overflow-x:auto}.brand{padding:0 8px 0 0}.brand-role,.sidebar-bottom,.nav-group,.nav-badge{display:none}.brand-lumen{display:block;height:34px;width:auto;margin-left:6px}.nav-button{width:auto;min-width:max-content;height:38px}.workspace{overflow:visible}.topbar{position:sticky;top:62px;z-index:15}.content{overflow:visible}.view{padding:18px}.mobile-goal-shell{display:block}.mobile-goal-shell .goal-card{min-height:148px;background:linear-gradient(150deg,var(--navy-800),var(--navy-950));box-shadow:var(--shadow)}.mobile-goal-shell .goal-body{max-width:210px}.mobile-goal-shell .goal-value{font-size:31px;color:var(--cyan-300)}.mobile-goal-shell .goal-card img{height:96px;right:-12px}.mobile-goal-shell .goal-phrase{max-width:210px;font-size:12px}.split-grid,.role-grid{grid-template-columns:1fr}}
@media(max-width:560px){.topbar{align-items:flex-start;flex-wrap:wrap}.top-actions{width:100%}.top-actions .button{flex:1}.top-actions .button.icon-only{flex:0 0 40px}.page-heading h1{font-size:18px}.grid-4,.attention{grid-template-columns:1fr 1fr;gap:10px}.stat-card{padding:14px}.stat-value{font-size:22px}.toolbar{display:block}.filter-chips{margin-top:10px}.steps li{grid-template-columns:auto 1fr}.steps li>.badge{grid-column:2;justify-self:start;margin-bottom:9px}.mini-grid,.drawer-foot,.form-grid{grid-template-columns:1fr}.callout{display:block}.callout>.badge{margin-top:10px}.invite-head{display:none}.invite-row{grid-template-columns:1fr 1fr}.invite-row>div:first-child{grid-column:1/-1}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:0ms!important;transition-duration:0ms!important;scroll-behavior:auto!important}}
</style></head>
<body><div class="app">
<aside class="sidebar" aria-label="Navegación Super Admin">
<div class="brand"><img class="brand-mark" src="/admin/assets/nexfor-mark-light.png" alt="Nextfor IA"><div><div class="brand-name">Nextfor <span>IA</span></div><div class="brand-role">Super Admin</div></div><img class="brand-lumen" src="/admin/assets/lumen.png" alt="" aria-hidden="true"></div>
<div class="nav-group">Consolidado</div>
<nav aria-label="Consolidado"><button class="nav-button active" data-view="overview" aria-current="page">${icon("overview", 18)}<span>Resumen</span></button><button class="nav-button" data-view="leads">${icon("lead", 18)}<span>Leads</span><span class="nav-badge" id="leadNavCount">${leadsData && leadsData.kpis ? num(leadsData.kpis.active) : 0}</span></button><button class="nav-button" data-view="clients">${icon("users", 18)}<span>Clientes</span><span class="nav-badge" id="clientNavCount">${currentClients}</span></button></nav>
<div class="nav-group">Bots</div>
<nav aria-label="Bots"><button class="nav-button" data-view="agendamiento">${icon("calendar", 18)}<span>Agendamiento</span></button><button class="nav-button" data-view="atencion">${icon("headset", 18)}<span>Atención al cliente</span></button><button class="nav-button" type="button" disabled aria-disabled="true">${icon("mic", 18)}<span>Voz saliente</span><span class="nav-soon">Pronto</span></button></nav>
<div class="nav-group">Operación</div>
<nav aria-label="Operación"><button class="nav-button" data-view="incidents">${icon("inbox", 18)}<span>Bandeja de operación</span><span class="nav-badge" id="incidentNavCount">…</span></button><button class="nav-button" data-view="botOps">${icon("activity", 18)}<span>Bot Ops &amp; Improvement</span><span class="nav-badge" id="botOpsNavCount">…</span></button><a class="nav-button" href="/admin/super-admin/signature">${icon("spark", 18)}<span>Signature</span></a>${channelConnectionsV1Enabled ? `<button class="nav-button" data-view="channels">${icon("webhook", 18)}<span>Canales</span></button>` : ""}<button class="nav-button" data-view="setupReview">${icon("check", 18)}<span>Revisión setups</span></button><button class="nav-button" data-view="questionnaire">${icon("message", 18)}<span>Cuestionario</span></button>${customerAccessV2Enabled ? `<button class="nav-button" data-view="catalogs">${icon("layers", 18)}<span>Planes y bots</span></button>` : ""}<button class="nav-button" data-view="billing">${icon("card", 18)}<span>Facturación</span><span class="nav-badge" id="billingNavCount">0</span></button></nav>
<div class="sidebar-bottom">
<button class="goal-card" type="button" onclick="openGoalEditor()" aria-label="Editar meta de clientes"><img src="/admin/assets/lumen.png" alt="" aria-hidden="true"><span class="goal-body"><span class="goal-label" id="goalLabel" data-goal-label>Camino a ${targetClients}</span><span class="goal-value" id="goalHeadline" data-goal-headline>${escapeHtml(goalInitial.titular)}</span><span class="goal-count"><strong id="goalCount" data-goal-count>${currentClients}</strong><span id="goalCountText" data-goal-count-text>de ${targetClients} ${escapeHtml(customerGoal.unit || "clientes")}</span></span><span class="goal-track"><span id="goalBar" data-goal-bar style="width:${Math.max(2, Math.min(100, Math.round(currentClients / targetClients * 100)))}%"></span></span><span class="goal-phrase" id="goalPhrase" data-goal-phrase>${escapeHtml(goalInitial.frase)}</span><span class="goal-edit">${icon("spark", 11)} Editar meta</span></span></button>
<div class="user-card"><span class="avatar sm">SA</span><div><strong>${escapeHtml(auth.name || auth.username || "Super Admin")}</strong><span>Nextfor IA · interno</span></div></div>
<div class="version-card"><strong>Versión del panel</strong><span>${escapeHtml(options.botVersion || "sin versión")}</span></div>
</div></aside>
<main class="workspace"><header class="topbar"><div class="page-heading"><h1 id="pageTitle">Resumen</h1><p id="pageSubtitle">La operación completa de Nextfor IA de un vistazo</p></div><div class="top-actions"><button class="button optional" id="customerInviteButton" type="button" onclick="createCustomerInvite()">${customerAccessV2Enabled ? "Crear cliente" : "Crear acceso RAV"}</button><button class="button optional" type="button" onclick="openSuperAdminInvite()">Invitar Super Admin</button><a class="button optional" href="/admin/super-admin/signature">Signature</a><a class="button optional" href="/admin/client-onboarding">Onboarding</a><a class="button optional" href="/admin/panel?tab=summary">Admin RAV</a><button class="button icon-only" type="button" onclick="loadHealth()" aria-label="Actualizar salud" title="Actualizar salud">${icon("refresh", 18)}</button><button class="button icon-only danger" type="button" onclick="logoutSuperAdmin()" aria-label="Cerrar sesión" title="Cerrar sesión">${icon("logout", 18)}</button></div></header>
<div class="content">

<section class="view active" data-panel="overview"><div class="stack">
  <div class="mobile-goal-shell"><button class="goal-card" type="button" onclick="openGoalEditor()" aria-label="Editar meta de clientes"><img src="/admin/assets/lumen.png" alt="" aria-hidden="true"><span class="goal-body"><span class="goal-label" data-goal-label>Camino a ${targetClients}</span><span class="goal-value" data-goal-headline>${escapeHtml(goalInitial.titular)}</span><span class="goal-count"><strong data-goal-count>${currentClients}</strong><span data-goal-count-text>de ${targetClients} ${escapeHtml(customerGoal.unit || "clientes")}</span></span><span class="goal-track"><span data-goal-bar style="width:${Math.max(2, Math.min(100, Math.round(currentClients / targetClients * 100)))}%"></span></span><span class="goal-phrase" data-goal-phrase>${escapeHtml(goalInitial.frase)}</span><span class="goal-edit">${icon("spark", 11)} Editar meta</span></span></button></div>
  <div class="grid-4" aria-label="Indicadores económicos consolidados">${kpiCards}</div>
  <div><div class="section-title"><h2>Desglose por bot</h2><span>cuánto aporta y cuánto cuesta cada uno</span></div>${botBreakdown}</div>
  ${compareTable}
  ${paretoCard}
  <div><div class="section-title"><h2>Requiere atención</h2><span>señales operativas de toda la flota</span></div><div class="attention">${attentionItems}</div></div>
  <div><div class="section-title"><h2>Estado de la plataforma</h2><span>meta comercial y salud técnica</span></div>
  <div class="grid-4"><article class="stat-card"><div class="stat-top"><span>Clientes registrados</span><span class="icon-chip">${icon("users", 17)}</span></div><div class="stat-value" id="clientStatValue">${currentClients}</div><div class="stat-sub" id="clientStatSub">${firstClient ? 'Cliente #1 · ' + escapeHtml(firstClient.brand_name) : 'Registro comercial vacío'}</div></article><article class="stat-card"><div class="stat-top"><span>Meta del año</span><span class="icon-chip">${icon("trend", 17)}</span></div><div class="stat-value" id="goalPercentValue">${goalPercent}%</div><div class="stat-sub" id="goalPercentSub">${currentClients} de ${targetClients} clientes</div></article><article class="stat-card"><div class="stat-top"><span>Readiness comercial</span><span class="icon-chip">${icon("check", 17)}</span></div><div class="stat-value">${readyCount}/${stages.length}</div><div class="stat-sub">etapas listas · ${draftCount} pendientes</div></article><article class="stat-card"><div class="stat-top"><span>Infraestructura</span><span class="icon-chip">${icon("activity", 17)}</span></div><div class="stat-value" id="infraValue" style="font-size:20px">Verificando</div><div class="stat-sub" id="infraSubtitle">Consultando salud global</div></article></div></div>
  <div class="callout" style="margin-top:0"><div><strong>Bloqueador externo actual</strong><p>La infraestructura puede estar operativa, pero la aprobación de permisos de WhatsApp continúa siendo requisito antes de operar clientes reales a escala.</p></div><span class="badge warning dot">Esperando Meta</span></div>
  <div class="two-col" style="margin-top:0"><section class="card"><div class="card-head"><div><h2>Salud de infraestructura</h2><p>Estados normalizados; nunca muestra tokens ni identificadores.</p></div><span class="badge neutral" id="healthBadge">Verificando</span></div><div class="health-list"><div class="health-row"><span>Uptime</span><span class="health-value" id="healthUptime">—</span></div><div class="health-row"><span>Shopify storefront</span><span class="health-value" id="healthShopify">—</span></div><div class="health-row"><span>Meta WhatsApp API</span><span class="health-value" id="healthMeta">—</span></div><div class="health-row"><span>Supabase</span><span class="health-value" id="healthSupabase">—</span></div><div class="health-row"><span>Anthropic</span><span class="health-value" id="healthAnthropic">—</span></div></div></section><section class="card"><div class="card-head"><div><h2>Readiness comercial</h2><p>Resumen de COMMERCIAL_READINESS.</p></div><span class="badge warning">${waitingCount} esperando Meta</span></div><div class="readiness-list">${readinessRows}</div></section></div>
  <section class="card client-list" style="margin-top:0"><div class="list-head"><h2>Cuentas de la plataforma</h2><button class="button" type="button" data-go="clients">Ver clientes ${icon("arrow", 15)}</button></div>${clientSummaryRows}</section>
  <div><div class="section-title"><h2>Preparación de plataforma</h2><span>responsabilidades y acceso</span></div><div class="two-col" style="margin-top:0"><section class="card"><div class="card-head"><div><h2>División de paneles</h2><p>Cliente y plataforma conservan alcances separados.</p></div></div><div class="split-grid">${panelRows}</div></section><section class="card"><div class="card-head"><div><h2>Modelo de acceso</h2><p>Modelo ${escapeHtml(accessModel.version || "actual")}</p></div></div><div class="role-grid">${roleRows}</div></section></div></div>
  <div class="two-col" style="margin-top:0"><section class="card"><div class="card-head"><div><h2>Campos requeridos para onboarding</h2><p>Solo nombres de campos; los valores sensibles viven en almacenamiento seguro.</p></div><span class="badge neutral">${tenantFields.length} campos</span></div><div class="fields">${fields}</div></section><section class="card"><div class="card-head"><div><h2>Siguientes pasos multi-cliente</h2><p>Checklist técnico para activar nuevos clientes.</p></div></div><ol class="steps">${nextSteps}</ol></section></div>
</div></section>

<section class="view" data-panel="leads"><div class="stack">
  <div class="callout info-callout" style="margin-top:0"><div><strong>Lead = cuenta creada</strong><p>Cuando alguien escribe empresa, email, teléfono y crea su clave, NextforIA ya lo considera lead. Sale de esta pestaña y pasa a Cliente cuando termina setup y queda pago, trial o piloto aprobado.</p></div><button class="button" type="button" onclick="loadLeadPipeline()">${icon("refresh", 15)} Actualizar</button></div>
  <div class="grid-4" aria-label="Indicadores de pipeline">${leadKpis}</div>
  ${leadSourceCards
    ? '<div><div class="section-title"><h2>Por vendedor / canal</h2><span>de dónde vienen los prospectos</span></div><div class="source-grid">' + leadSourceCards + '</div></div>'
    : '<section class="card">' + emptyBlock("lead", "Aún no se registran leads en la plataforma", "Aparecerán aquí inmediatamente después de que una persona cree cuenta con email y clave. No se muestran datos de ejemplo como si fueran producción.") + '</section>'}
  <section class="card table-card"><div class="list-head lead-list-head"><div><h2>Leads activos</h2><span class="badge info" id="leadRowsCount">${leadsData && leadsData.rows ? num(leadsData.rows.length) : 0}</span></div><div class="lead-tools"><div class="search lead-search">${icon("search", 16)}<label class="sr-only" for="leadSearchInput">Buscar prospecto</label><input id="leadSearchInput" placeholder="Buscar prospecto…" autocomplete="off" onkeydown="if(event.key==='Enter')applyLeadSearch()"></div><button class="button" type="button" onclick="applyLeadSearch()">Buscar</button><select id="leadSortOrder" class="lead-sort" aria-label="Ordenar leads por fecha" onchange="applyLeadSort()"><option value="desc">Más recientes primero</option><option value="asc">Más antiguos primero</option></select></div></div><div class="table-scroll"><div class="invite-head lead-table-head" aria-hidden="true"><span>Empresa</span><span>Contacto</span><span>Etapa</span><span>Plan / bot</span><span>Fecha</span><span>Acciones</span></div><div id="leadPipelineRows">${leadRows}</div></div></section>
  <div class="two-col" style="margin-top:0"><section class="card"><div class="card-head"><div><h2>Embudo real</h2><p>Estados actuales del alta automática.</p></div></div><ol class="steps"><li><span class="step-number">1</span><div><strong>Cuenta creada</strong><p>Email + clave guardados. Ya es lead.</p></div></li><li><span class="step-number">2</span><div><strong>Setup iniciado</strong><p>El cliente empieza a llenar su información.</p></div></li><li><span class="step-number">3</span><div><strong>Setup completo</strong><p>NextforIA revisa y activa pago, trial o piloto.</p></div></li><li><span class="step-number">4</span><div><strong>Cliente</strong><p>Setup completo + pago/trial/piloto listo.</p></div></li></ol></section><section class="card"><div class="card-head"><div><h2>Datos guardados hoy</h2><p>Sin secretos, solo información útil para venta y seguimiento.</p></div></div><div class="fields"><code>company_name</code><code>admin_email</code><code>contact_phone</code><code>tenant_id</code><code>setup_completion</code><code>plan_id</code><code>assigned_bot_id</code><code>stage</code></div></section></div>
</div></section>

<section class="view" data-panel="clients"><div class="stack">${setupClientSection}${legacyRegistrySection}${tenantLifecyclePanel}${customerAccessPanel}<div class="callout"><div><strong>Clientes visibles</strong><p>Los clientes nuevos tienen acciones directas para ver ficha, suspender acceso o eliminar con doble confirmación. Los registros heredados solo se ocultan de esta vista.</p></div><span class="badge info">${currentClients + setupClientRows.length} visibles</span></div></div></section>

<section class="view" data-panel="agendamiento"><div class="stack">
  <div class="callout info-callout" style="margin-top:0"><div><strong>Supervisión real de Appointment</strong><p>Consolida citas, readiness e integraciones por tenant. La operación diaria sigue en el panel del cliente; Super Admin supervisa y destraba.</p></div><button class="button" type="button" onclick="loadAppointmentOverview()">${icon("refresh", 15)} Actualizar</button></div>
  <div class="grid-4"><article class="stat-card"><div class="stat-top"><span>Clientes Appointment</span><span class="icon-chip">${icon("users", 17)}</span></div><div class="stat-value" id="apptFleetClients">—</div><div class="stat-sub" id="apptFleetReady">Cargando readiness</div></article><article class="stat-card"><div class="stat-top"><span>Citas solicitadas</span><span class="icon-chip">${icon("calendar", 17)}</span></div><div class="stat-value" id="apptFleetRequested">—</div><div class="stat-sub" id="apptFleetBooked">Confirmadas: —</div></article><article class="stat-card"><div class="stat-top"><span>Por confirmar</span><span class="icon-chip">${icon("inbox", 17)}</span></div><div class="stat-value" id="apptFleetPending">—</div><div class="stat-sub" id="apptFleetFailed">Fallidas: —</div></article><article class="stat-card"><div class="stat-top"><span>Tasa confirmación</span><span class="icon-chip">${icon("trend", 17)}</span></div><div class="stat-value" id="apptFleetRate">—</div><div class="stat-sub" id="apptFleetUpcoming">Próximas: —</div></article></div>
  <section class="card table-card"><div class="list-head"><div><h2>Clientes de agendamiento</h2><span class="badge info" id="apptFleetCount">0</span></div><button class="button" type="button" onclick="showView('setupReview')">Ver setups</button></div><div id="appointmentOverviewRows" class="setup-review-list"><div class="invite-loading">Cargando clientes de agendamiento…</div></div></section>
</div></section>

<section class="view" data-panel="atencion"><div class="stack">
  <section class="card"><div class="empty"><img class="empty-lumen" src="/admin/assets/lumen.png" alt="" aria-hidden="true"><h2>El módulo de Atención al cliente se activa con datos del bot</h2><p>Mostrará conversaciones del mes, tasa de resolución automática, tiempo de respuesta, CSAT y conversaciones abiertas por cliente. La operación individual sigue en el panel de cada comercio.</p></div></section>
  <div class="two-col" style="margin-top:0"><section class="card"><div class="card-head"><div><h2>Métricas previstas</h2><p>Por cliente con el bot activo.</p></div></div><div class="fields"><code>conversaciones_mes</code><code>tasa_resolucion</code><code>tiempo_respuesta</code><code>csat</code><code>conversaciones_abiertas</code><code>costo_operativo</code></div></section><section class="card"><div class="card-head"><div><h2>Separación de alcance</h2><p>Una sola fuente de verdad.</p></div></div><p style="font-size:12px;line-height:1.7;color:var(--text-muted);margin:0">El Super Admin consolida y compara. La intervención humana, las conversaciones y la operación diaria permanecen exclusivamente en el panel Admin de cada comercio.</p></section></div>
</div></section>

<section class="view" data-panel="incidents"><div class="stack">
  <div class="callout" style="margin-top:0"><div><strong>${integrationLive ? "WhatsApp RAV configurado en plataforma" : "Activacion del numero real pendiente"}</strong><p>${integrationLive ? "Esto confirma salud global de la plataforma. La conexión real de cada cliente se valida en Canales y en su ficha de setup." : "Meta ya aprobo la app. Falta conectar y verificar " + escapeHtml(integration.target_display_phone) + " antes de iniciar conversaciones reales."}</p></div><span class="badge ${integrationTone} dot">${integrationLive ? "Global OK" : "Abierto"}</span></div>
  <div class="two-col" style="margin-top:0"><section class="card"><div class="card-head"><div><h2>Servicios globales, no conexión del cliente</h2><p>/admin/health dice si NextforIA puede operar. Para saber si RAV Toys, Meta o Shopify están conectados, revisa Canales o la ficha del cliente.</p></div><button class="button" type="button" onclick="loadHealth()">${icon("refresh", 16)} Actualizar</button></div><div class="health-list"><div class="health-row"><span>Shopify storefront</span><span class="health-value" id="incidentShopify">Verificando</span></div><div class="health-row"><span>Meta WhatsApp API</span><span class="health-value" id="incidentMeta">Verificando</span></div><div class="health-row"><span>Supabase</span><span class="health-value" id="incidentSupabase">Verificando</span></div><div class="health-row"><span>Anthropic</span><span class="health-value" id="incidentAnthropic">Verificando</span></div></div></section><section class="card"><div class="empty" style="padding:30px 18px"><img class="empty-lumen" src="/admin/assets/lumen.png" alt="" aria-hidden="true"><h2>La operación real vive por cliente</h2><p>Si un cliente no tiene Meta o Shopify conectado en su Customer Panel, aquí no debe aparecer como conectado. Usa Canales para estados técnicos y Revisión setups para ver lo solicitado.</p><button class="button" type="button" onclick="showView('channels')">Ver canales reales</button></div></section></div>
</div></section>

<section class="view" data-panel="botOps"><div class="stack">
  <div class="callout info-callout" style="margin-top:0"><div><strong>Bot Operations &amp; Improvement</strong><p>Revisa solo actividad nueva y mantiene incidentes, oportunidades y aprobaciones en registros dedicados por empresa. Las protecciones automáticas se limitan a reintentos seguros y atención humana.</p></div><button class="button" type="button" onclick="loadBotOps()">${icon("refresh", 15)} Actualizar</button></div>
  <div class="grid-4" aria-label="Estado de Bot Operations"><article class="stat-card"><div class="stat-top"><span>Estado general</span><span class="icon-chip">${icon("activity", 17)}</span></div><div class="stat-value" id="botOpsOverall" style="font-size:22px">Verificando</div><div class="stat-sub" id="botOpsUpdated">Última actualización: —</div></article><article class="stat-card"><div class="stat-top"><span>Última revisión diaria</span><span class="icon-chip">${icon("clock", 17)}</span></div><div class="stat-value" id="botOpsDaily" style="font-size:18px">—</div><div class="stat-sub">Solo actividad nueva desde el cursor anterior</div></article><article class="stat-card"><div class="stat-top"><span>Última revisión semanal</span><span class="icon-chip">${icon("calendar", 17)}</span></div><div class="stat-value" id="botOpsWeekly" style="font-size:18px">—</div><div class="stat-sub">Patrones por bot, empresa y canal</div></article><article class="stat-card"><div class="stat-top"><span>Alertas independientes</span><span class="icon-chip">${icon("message", 17)}</span></div><div class="stat-value" id="botOpsEmail" style="font-size:18px">Verificando</div><div class="stat-sub">Email para incidentes críticos</div></article></div>
  <div class="grid-4"><article class="stat-card"><div class="stat-top"><span>Incidentes abiertos</span></div><div class="stat-value" id="botOpsIncidents">0</div></article><article class="stat-card"><div class="stat-top"><span>Oportunidades</span></div><div class="stat-value" id="botOpsOpportunities">0</div></article><article class="stat-card"><div class="stat-top"><span>Aprobaciones pendientes</span></div><div class="stat-value" id="botOpsApprovals">0</div></article><article class="stat-card"><div class="stat-top"><span>Almacenamiento dedicado</span></div><div class="stat-value" id="botOpsStorage" style="font-size:18px">Verificando</div></article></div>
  <div class="two-col" style="margin-top:0"><section class="card"><div class="card-head"><div><h2>Incidentes abiertos</h2><p>Separados por empresa, bot y canal.</p></div></div><div id="botOpsIncidentRows" class="setup-review-list"><div class="invite-loading">Cargando incidentes…</div></div></section><section class="card"><div class="card-head"><div><h2>Oportunidades y aprobaciones</h2><p>Ninguna mejora cambia el comportamiento sin aprobación.</p></div></div><div id="botOpsImprovementRows" class="setup-review-list"><div class="invite-loading">Cargando oportunidades…</div></div></section></div>
  <section class="card"><div class="card-head"><div><h2>Último reporte semanal</h2><p>Recurrencia, impacto, prioridad y resolución de problemas anteriores.</p></div></div><div id="botOpsWeeklyRows" class="setup-review-list"><div class="invite-loading">Aún no se ha cargado el reporte.</div></div></section>
  <div class="callout"><div><strong>Guardrails activos</strong><p>Bot Ops no modifica prompts, configuración de bots, código de Producción, ownership de tenants ni datos de clientes. Un cambio permanente urgente queda pendiente de aprobación mientras retry, fallback o handoff protegen al cliente.</p></div><span class="badge success dot">Solo acciones seguras</span></div>
</div></section>

${channelConnectionsV1Enabled ? `<section class="view" data-panel="channels"><div class="stack">
  <div class="callout info-callout" style="margin-top:0"><div><strong>Conexiones por tenant</strong><p>Estados, activos conectados, verificación y errores internos. Los tokens nunca salen del almacenamiento cifrado ni aparecen en esta pantalla.</p></div><button class="button" type="button" onclick="loadAdminChannels()">${icon("refresh", 15)} Actualizar</button></div>
  <section class="card" style="padding:16px"><div class="channel-admin-list" id="adminChannelRows"><div class="invite-loading">Cargando canales…</div></div></section>
</div></section>` : ""}

<section class="view" data-panel="setupReview"><div class="stack">
  <div class="callout info-callout" style="margin-top:0"><div><strong>Revisión antes de activar bots</strong><p>Esta vista lee y guarda el mismo setup que usa Customer Panel. NextforIA puede corregir información, pedir cambios, aprobar y mover el setup por Incomplete, Ready, Building, Testing y Live.</p></div><span class="badge info">Mismo record</span></div>
  <div class="setup-review-layout">
    <section class="card" style="padding:16px"><div class="question-toolbar"><div><h2 style="margin:0;color:var(--text-strong);font:700 16px var(--font-display)">Clientes</h2><p>Selecciona un tenant para revisar su setup.</p></div><button class="button" type="button" onclick="loadSetupReviews()">${icon("refresh", 15)} Actualizar</button></div><div class="setup-review-actions" style="margin-bottom:12px"><div class="search lead-search">${icon("search", 16)}<label class="sr-only" for="setupReviewSearchInput">Buscar setup</label><input id="setupReviewSearchInput" placeholder="Buscar setup…" autocomplete="off" onkeydown="if(event.key==='Enter')applySetupReviewSearch()"></div><button class="button" type="button" onclick="applySetupReviewSearch()">Buscar</button><select id="setupReviewSortOrder" class="lead-sort" aria-label="Ordenar setups por fecha" onchange="applySetupReviewSort()"><option value="desc">Más recientes primero</option><option value="asc">Más antiguos primero</option></select></div><div id="setupReviewRows" class="setup-review-list"><div class="invite-loading">Cargando setups…</div></div></section>
    <section class="card setup-review-detail" id="setupReviewDetail" style="padding:16px"><div class="empty"><div class="empty-icon">${icon("check", 23)}</div><h2>Elige un cliente</h2><p>Verás exactamente el setup guardado para ese tenant y podrás intervenir antes de activar el bot.</p></div></section>
  </div>
</div></section>

<section class="view" data-panel="questionnaire"><div class="stack">
  <div class="callout info-callout" style="margin-top:0"><div><strong>Editor simple del Customer Setup</strong><p>Primero eliges el bot. Luego editas solo las preguntas de ese bot. El cliente también empieza eligiendo Atención, Agendamiento o ambos; si elige ambos, completa los dos cuestionarios. No se borran preguntas ni respuestas: se ocultan cuando ya no deben aparecer.</p></div><span class="badge info">Staging</span></div>
  <section class="card">
    <div class="question-simple-note"><strong>Paso 1 del cliente:</strong> elegir qué bot quiere configurar. Esta pregunta siempre va primero para decidir si verá el cuestionario de Atención, el de Agendamiento o ambos.</div>
    <div class="question-bot-picker" aria-label="Elegir cuestionario por bot">
      <button class="question-bot-card active" type="button" data-question-bot="customer_service"><strong>Bot Atención / Ventas 24/7</strong><span>Preguntas sobre empresa, WhatsApp, productos, políticas y soporte humano. Las preguntas creadas aquí quedan asignadas a este bot.</span></button>
      <button class="question-bot-card" type="button" data-question-bot="appointments"><strong>Bot Agendamiento</strong><span>Preguntas sobre negocio, reglas, servicios, disponibilidad, recordatorios y consentimiento. Las preguntas creadas aquí quedan asignadas a este bot.</span></button>
    </div>
    <div class="question-toolbar"><div><h2 id="questionnaireBotTitle" style="margin:0;color:var(--text-strong);font:700 17px var(--font-display)">Bot Atención / Ventas 24/7</h2><p id="questionnaireBotHelp">Edita este cuestionario como lo leería un cliente. Sin rutas técnicas ni campos raros.</p></div><div class="question-actions"><button class="button" type="button" onclick="loadQuestionnaire()">${icon("refresh", 15)} Actualizar</button><button class="button" type="button" onclick="addQuestion()">Nueva pregunta</button><button class="button primary" id="questionnaireSaveButton" type="button" onclick="saveQuestionnaire()">Guardar cuestionario</button></div></div>
    <div class="question-simple-note">Puedes agregar, editar, ordenar, marcar obligatoria/opcional y activar/desactivar. Si una pregunta ya no aplica, déjala como <strong>No visible</strong>; las respuestas anteriores siguen guardadas.</div>
    <div id="questionnaireRows" class="question-list"><div class="invite-loading">Cargando cuestionario…</div></div>
  </section>
</div></section>

${catalogView}

<section class="view" data-panel="billing"><div class="stack">
  ${paymentsV1Enabled ? '<div class="callout info-callout" style="margin-top:0"><div><strong>Payments v1 · Wompi Sandbox</strong><p>Los cobros se activan únicamente por webhook firmado. Trials y pilotos se aprueban aquí y quedan auditados.</p></div><span class="badge info">Staging</span></div><section class="card"><div class="card-head"><div><h2>Contratos y pagos</h2><p>Precios congelados, comisión real o estimada y neto recibido.</p></div><button class="button" type="button" onclick="loadBillingAdmin()">' + icon("refresh", 15) + ' Actualizar</button></div><div id="billingAdminRows" class="billing-list"><div class="invite-loading">Cargando facturación…</div></div></section>' : '<section class="card">' + emptyBlock("card", "Facturación desactivada", "Payments v1 solo se habilita en Staging con credenciales Sandbox de Wompi.") + "</section>"}
</div></section>

</div></main></div>
${customerAccessModal}
${superAdminInviteModal}
${catalogModals}
<div class="drawer-layer" id="tenantDrawer" aria-hidden="true"><button class="scrim" type="button" aria-label="Cerrar detalle" onclick="closeTenant()"></button><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="tenantTitle"><div class="drawer-head"><span class="avatar lg">RT</span><div class="drawer-title"><h2 id="tenantTitle">${escapeHtml(tenant.name)}</h2><p>Comercio electronico · Integracion piloto #1</p><div class="drawer-badges"><span class="badge info dot">Piloto Nextfor</span><span class="badge success dot">Meta aprobada</span><span class="badge ${integrationTone} dot">${escapeHtml(integrationStateLabel)}</span></div></div><button class="close-button" id="drawerClose" type="button" onclick="closeTenant()" aria-label="Cerrar">${icon("close", 19)}</button></div><div class="drawer-body"><div class="next-card">${icon("spark", 20)}<div><strong>Siguiente paso</strong><p>${escapeHtml(integration.next_action)}</p></div></div><div class="mini-grid"><div class="mini-card"><span>Integracion</span><strong style="font-size:12px">#${escapeHtml(integration.integration_number)}</strong></div><div class="mini-card"><span>Tenant ID</span><strong style="font-size:12px">${escapeHtml(tenant.id)}</strong></div><div class="mini-card"><span>Numero objetivo</span><strong style="font-size:12px">${escapeHtml(integration.target_display_phone)}</strong></div><div class="mini-card"><span>Estado</span><strong style="font-size:12px">${escapeHtml(integrationStateLabel)}</strong></div></div><section class="drawer-section"><h3>Integraciones</h3><div class="integration"><span>Meta App Review</span><span class="badge success">Aprobada</span></div><div class="integration"><span>WhatsApp Graph API</span><span class="badge neutral" id="drawerMetaApi">Verificando</span></div><div class="integration"><span>Numero real</span><span class="badge ${integrationLive ? "success" : "warning"}">${integrationLive ? "Activo" : "Pendiente"}</span></div><div class="integration"><span>Shopify Storefront</span><span class="badge neutral" id="drawerShopify">Verificando</span></div><div class="integration"><span>Supabase</span><span class="badge neutral" id="drawerSupabase">Verificando</span></div></section><section class="drawer-section"><h3>Prueba de integracion</h3><p id="integrationTestResult" style="font-size:10.5px;line-height:1.6;color:var(--text-muted);margin:0 0 10px">Valida Meta, Shopify, historial, panel e intervencion sin enviar mensajes reales.</p><button class="button" id="integrationTestButton" type="button" onclick="testRavIntegration()">${icon("activity", 15)} Ejecutar prueba segura</button></section><section class="drawer-section"><h3>Operacion permitida</h3><p style="font-size:10.5px;line-height:1.6;color:var(--text-muted);margin:0">La operacion diaria, conversaciones e intervencion humana permanecen exclusivamente en el Panel de Control del comercio.</p></section></div><div class="drawer-foot"><a class="button" href="/admin/client-onboarding">Ver onboarding</a><a class="button primary" href="/admin/panel?tab=summary">Abrir Panel de Control</a></div></aside></div>
<div class="goal-modal-layer" id="goalModal" aria-hidden="true"><button class="scrim" type="button" aria-label="Cerrar editor de meta" onclick="closeGoalEditor()"></button><section class="goal-modal" role="dialog" aria-modal="true" aria-labelledby="goalEditorTitle"><div class="goal-modal-head"><div><h2 id="goalEditorTitle">Editar meta de Lumen</h2><p>Este cambio se guarda para todo el Super Admin. La estructura permite sumar otras metas tipo contador más adelante.</p></div><button class="close-button" type="button" onclick="closeGoalEditor()" aria-label="Cerrar">${icon("close", 19)}</button></div><form class="goal-form" id="goalEditorForm"><div class="goal-field"><label for="goalTypeInput">Tipo de meta</label><select id="goalTypeInput" disabled><option value="counter">Contador</option></select><small>Clientes es la primera meta. Próximamente se podrán activar otros indicadores.</small></div><div class="goal-field"><label for="goalNameInput">Nombre</label><input id="goalNameInput" maxlength="60" required autocomplete="off"></div><div class="goal-field"><label for="goalTargetInput">Meta</label><input id="goalTargetInput" type="number" min="1" max="1000000000" step="1" inputmode="numeric" required><small>Usa un número entero mayor que cero.</small></div><div class="goal-form-error" id="goalEditorError" role="alert"></div><div class="goal-modal-actions"><button class="button" type="button" onclick="closeGoalEditor()">Cancelar</button><button class="button primary" id="goalSaveButton" type="submit">Guardar meta</button></div></form></section></div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>
var customerAccessV2Enabled=${customerAccessV2Enabled ? "true" : "false"},paymentsV1Enabled=${paymentsV1Enabled ? "true" : "false"},channelConnectionsV1Enabled=${channelConnectionsV1Enabled ? "true" : "false"},leadsPipeline=${leadsClientState},titles={overview:["Resumen","La operación completa de Nextfor IA de un vistazo"],leads:["Leads","Prospectos por vendedor y canal antes de volverse clientes"],clients:["Clientes","Cuentas y tenants administrados por Nextfor IA"],agendamiento:["Agendamiento","Módulo de citas consolidado de toda la flota"],atencion:["Atención al cliente","Módulo de conversaciones consolidado de toda la flota"],incidents:["Bandeja de operación","Incidencias de todos los bots ordenadas por prioridad"],botOps:["Bot Ops & Improvement","Salud, calidad e incidentes de todos los bots por empresa"],channels:["Canales","Conexiones Meta por cliente, sin exponer credenciales"],setupReview:["Revisión de setups","Supervisión y aprobación antes de activar cada bot"],questionnaire:["Cuestionario","Preguntas que ve el cliente durante el Customer Setup"],catalogs:["Planes y bots","Lo que se vende, a qué precio y con qué incluido"],billing:["Facturación","Planes y pagos de los clientes de la plataforma"]};
var currentView="overview",lastFocus=null,toastTimer;
function showView(name){if(!titles[name])return;currentView=name;document.querySelectorAll(".nav-button").forEach(function(el){var active=el.dataset.view===name;el.classList.toggle("active",active);el.setAttribute("aria-current",active?"page":"false");});document.querySelectorAll(".view").forEach(function(el){el.classList.toggle("active",el.dataset.panel===name);});document.getElementById("pageTitle").textContent=titles[name][0];document.getElementById("pageSubtitle").textContent=titles[name][1];try{history.replaceState(null,"","/admin/super-admin"+(name==="overview"?"":"?view="+encodeURIComponent(name)));}catch(e){}if(name==="agendamiento")loadAppointmentOverview();if(name==="botOps")loadBotOps();document.querySelector(".content").scrollTop=0;}
document.querySelectorAll("[data-view]").forEach(function(el){el.addEventListener("click",function(){showView(el.dataset.view);});});document.querySelectorAll("[data-go]").forEach(function(el){el.addEventListener("click",function(){showView(el.dataset.go);});});
function showToast(message){var el=document.getElementById("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.classList.remove("show");},3200);}
function adminChannelName(value){return({whatsapp:"WhatsApp",instagram:"Instagram",messenger:"Facebook Messenger"})[value]||value||"Canal";}
function adminChannelStatus(value){return({not_connected:["No conectado","neutral"],connecting:["Conectando","info"],connected:["Conectado","success"],needs_attention:["Necesita atención","warning"],disconnected:["Desconectado","danger"]})[value]||[value||"No conectado","neutral"];}
function adminChannelDate(value){if(!value)return"Sin verificar";var date=new Date(value);return isNaN(date.getTime())?"Sin verificar":date.toLocaleString("es-CO",{dateStyle:"short",timeStyle:"short"});}
function renderAdminChannels(rows){var root=document.getElementById("adminChannelRows");if(!root)return;root.textContent="";if(!rows||!rows.length){root.appendChild(el("div","invite-loading","Todavía no hay tenants con canales disponibles."));return;}rows.forEach(function(row){var line=el("article","channel-admin-row"),client=el("div");client.appendChild(el("strong",null,row.company_name||row.tenant_id));client.appendChild(el("small",null,row.tenant_id));var channel=el("div");channel.appendChild(el("strong",null,adminChannelName(row.channel)));var status=adminChannelStatus(row.status);channel.appendChild(el("span","badge "+status[1]+" dot",status[0]));var account=el("div");account.appendChild(el("strong",null,row.account_label||"Sin cuenta conectada"));account.appendChild(el("small",null,row.account_id||"—"));var detail=el("div");detail.appendChild(el("strong",null,adminChannelDate(row.last_verified_at)));detail.appendChild(el("small",null,"Conectó: "+(row.connected_by||"—")+" · Desconectó: "+(row.disconnected_by||"—")));if(row.last_error)detail.appendChild(el("small","channel-admin-error","Último error: "+row.last_error));var actions=el("div","channel-admin-actions");if(!row.protected_legacy&&["connected","needs_attention"].includes(row.status)){var verify=el("button","button","Verificar");verify.type="button";verify.addEventListener("click",function(){adminChannelAction(row,"verify",false);});actions.appendChild(verify);}if(!row.protected_legacy&&["connected","needs_attention","connecting","disconnected","not_connected"].includes(row.status)){var reconnectLabel=row.status==="connected"?"Renovar acceso":row.status==="connecting"?"Continuar conexión":"Ayudar a reconectar",reconnect=el("button","button",reconnectLabel);reconnect.type="button";reconnect.addEventListener("click",function(){startSetupChannelConnection(row.tenant_id,row.channel);});actions.appendChild(reconnect);}if(!row.protected_legacy&&["connected","needs_attention","connecting"].includes(row.status)){var disconnect=el("button","button danger","Desconectar");disconnect.type="button";disconnect.addEventListener("click",function(){adminChannelAction(row,"disconnect",true);});actions.appendChild(disconnect);}if(row.protected_legacy)actions.appendChild(el("span","badge neutral","Conexión RAV protegida"));line.append(client,channel,account,detail,actions);root.appendChild(line);});}
function loadAdminChannels(){if(!channelConnectionsV1Enabled)return Promise.resolve();var root=document.getElementById("adminChannelRows");if(root){root.textContent="";root.appendChild(el("div","invite-loading","Cargando canales…"));}return fetch("/admin/channel-connections",{headers:{accept:"application/json"}}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.error||"channel_connection_unavailable");return body;});}).then(function(body){renderAdminChannels(body.channels||[]);}).catch(function(){if(root){root.textContent="";root.appendChild(el("div","invite-loading","No se pudieron cargar las conexiones."));}showToast("No se pudieron cargar las conexiones.");});}
function adminChannelAction(row,action,confirmation){if(confirmation&&!confirm("¿Desconectar "+adminChannelName(row.channel)+" de "+row.company_name+"? Esta acción detendrá nuevos mensajes de ese canal."))return;var path="/admin/channel-connections/"+encodeURIComponent(row.tenant_id)+"/"+encodeURIComponent(row.channel)+"/"+action;postJson(path,{}).then(function(){showToast(action==="verify"?"Conexión verificada.":action==="disconnect"?"Canal desconectado.":"Solicitud de reconexión registrada.");return loadAdminChannels();}).catch(function(error){showToast(error.message==="legacy_connection_protected"?"La conexión RAV está protegida.":"No se pudo completar la acción.");});}
function setAppointmentText(id,value){var node=document.getElementById(id);if(node)node.textContent=value;}
function appointmentReadinessTone(row){return row&&row.ready_for_live?"success":row&&row.ready_for_testing?"info":"warning";}
function appointmentReadinessLabel(row){return row&&row.ready_for_live?"Live ready":row&&row.ready_for_testing?"Testing":"Bloqueado";}
function appointmentOverviewLine(row){var metrics=row.metrics||{},line=el("div","lead-row"),company=el("div");company.appendChild(el("strong",null,row.company_name||row.tenant_id));company.appendChild(el("small",null,row.tenant_id+" · "+(row.status||"setup")+" · "+(row.review_status||"sin review")));line.appendChild(company);var volume=el("div");volume.appendChild(el("strong",null,fmtNum(metrics.requested||0)+" solicitadas"));volume.appendChild(el("small",null,"Confirmadas "+fmtNum(metrics.booked||0)+" · próximas "+fmtNum(row.upcoming_count||0)));line.appendChild(volume);var queue=el("div");queue.appendChild(el("strong",null,fmtNum(metrics.pending||0)+" por confirmar"));queue.appendChild(el("small",null,"Canceladas "+fmtNum(metrics.cancelled||0)+" · fallidas "+fmtNum(metrics.failed||0)));line.appendChild(queue);var integrations=row.integrations||{},tech=el("div");tech.appendChild(el("strong",null,"Bot "+appointmentGateLabel(integrations.bot)));tech.appendChild(el("small",null,"Cal "+appointmentGateLabel(integrations.calendar)+" · WA "+appointmentGateLabel(integrations.whatsapp)+" · Voz "+appointmentGateLabel(integrations.calls)));line.appendChild(tech);var ready=el("div");ready.appendChild(el("span","badge "+appointmentReadinessTone(row)+" dot",appointmentReadinessLabel(row)));ready.appendChild(el("small",null,(row.blockers||[]).slice(0,3).join(", ")||"Sin bloqueos"));line.appendChild(ready);var actions=el("div","catalog-actions");if(row.panel_path){var panel=el("a","button","Abrir panel");panel.href=row.panel_path;actions.appendChild(panel);}var setup=el("button","button","Ver setup");setup.type="button";setup.addEventListener("click",function(){openTenantSetup(row.tenant_id);});actions.appendChild(setup);line.appendChild(actions);return line;}
function renderAppointmentOverview(body){var totals=body&&body.totals||{},rows=body&&body.clients||[];setAppointmentText("apptFleetClients",fmtNum(totals.appointment_clients||0));setAppointmentText("apptFleetReady",fmtNum(totals.live_ready||0)+" listos para Live");setAppointmentText("apptFleetRequested",fmtNum(totals.requested||0));setAppointmentText("apptFleetBooked","Confirmadas: "+fmtNum(totals.booked||0));setAppointmentText("apptFleetPending",fmtNum(totals.pending||0));setAppointmentText("apptFleetFailed","Fallidas: "+fmtNum(totals.failed||0));setAppointmentText("apptFleetRate",fmtNum(totals.confirmation_rate||0)+"%");setAppointmentText("apptFleetUpcoming","Próximas: "+fmtNum(totals.upcoming||0));setAppointmentText("apptFleetCount",fmtNum(rows.length));var root=document.getElementById("appointmentOverviewRows");if(!root)return;root.textContent="";if(!rows.length){root.appendChild(el("div","invite-loading","Todavía no hay clientes con Appointment Bot en setup, plan o piloto."));return;}rows.forEach(function(row){root.appendChild(appointmentOverviewLine(row));});}
function loadAppointmentOverview(){var root=document.getElementById("appointmentOverviewRows");if(root){root.textContent="";root.appendChild(el("div","invite-loading","Cargando citas y readiness…"));}return fetch("/admin/appointments-overview",{headers:{accept:"application/json"}}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.error||"appointment_overview_unavailable");return body;});}).then(renderAppointmentOverview).catch(function(){if(root){root.textContent="";root.appendChild(el("div","invite-loading","No se pudo cargar la supervisión de citas."));}showToast("No se pudo cargar Agendamiento.");});}
var platformGoal=${goalClientState},baseClientCount=${currentClients},currentClientCount=baseClientCount,META_CLIENTES=Math.max(1,Number(platformGoal.target)||${targetClients});
function setAllGoalText(selector,value){document.querySelectorAll(selector).forEach(function(el){el.textContent=value;});}
function platformGoalCopy(count,target){var faltan=Math.max(0,target-count);
if(count<=0)return{titular:"Tu primer cliente",frase:"Todo empieza con uno. Ese es el que enseña el camino."};
if(count>=target)return{titular:"Meta cumplida",frase:target+" negocios atendidos por NextforIA. Lo lograste."};
if(count===1)return{titular:"Faltan "+faltan,frase:"Ya no estás en cero. Esa era la parte difícil."};
if(count<target*0.1)return{titular:"Faltan "+faltan,frase:"Los primeros son los que prueban que funciona."};
if(count<target*0.34)return{titular:"Faltan "+faltan,frase:"El camino ya tiene forma. Seguí firme."};
if(count<target*0.67)return{titular:"Faltan "+faltan,frase:"Pasaste el tercio. Ya sabés cómo se hace."};
if(count<target*0.9)return{titular:"Faltan "+faltan,frase:"Más de la mitad atrás. La meta ya se ve."};
return{titular:"Faltan "+faltan,frase:"Estás a un empujón. No aflojes ahora."};}
function refreshGoalCards(){var target=Math.max(1,Number(platformGoal.target)||META_CLIENTES||340),unit=platformGoal.unit||"clientes",copy=platformGoalCopy(currentClientCount,target);
META_CLIENTES=target;setAllGoalText("[data-goal-label]","Camino a "+target);setAllGoalText("[data-goal-headline]",copy.titular);setAllGoalText("[data-goal-count]",String(currentClientCount));setAllGoalText("[data-goal-count-text]","de "+target+" "+unit);setAllGoalText("[data-goal-phrase]",copy.frase);document.querySelectorAll("[data-goal-bar]").forEach(function(el){el.style.width=Math.max(2,Math.min(100,Math.round(currentClientCount/target*100)))+"%";});
var pct=document.getElementById("goalPercentValue");if(pct)pct.textContent=Math.round(currentClientCount/target*100)+"%";var pctSub=document.getElementById("goalPercentSub");if(pctSub)pctSub.textContent=currentClientCount+" de "+target+" "+unit;}
function paintPlatformGoal(goal){if(!goal||goal.id!=="customers")return;platformGoal=goal;refreshGoalCards();}
function openGoalEditor(){lastFocus=document.activeElement;document.getElementById("goalNameInput").value=platformGoal.label||"Clientes";document.getElementById("goalTargetInput").value=String(platformGoal.target||META_CLIENTES||340);document.getElementById("goalEditorError").textContent="";var layer=document.getElementById("goalModal");layer.classList.add("open");layer.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";document.getElementById("goalNameInput").focus();}
function closeGoalEditor(){var layer=document.getElementById("goalModal");layer.classList.remove("open");layer.setAttribute("aria-hidden","true");document.body.style.overflow="";if(lastFocus&&lastFocus.focus)lastFocus.focus();}
function loadPlatformGoals(){return fetch("/admin/platform-goals",{headers:{accept:"application/json"}}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.error||"goal_load_failed");return body;});}).then(function(body){var goal=(body.goals||[]).find(function(item){return item.id==="customers";});if(goal)paintPlatformGoal(goal);});}
document.getElementById("goalEditorForm").addEventListener("submit",function(event){event.preventDefault();var target=Number(document.getElementById("goalTargetInput").value),label=document.getElementById("goalNameInput").value.trim(),errorBox=document.getElementById("goalEditorError"),button=document.getElementById("goalSaveButton");errorBox.textContent="";
if(label.length<2){errorBox.textContent="Escribe un nombre de al menos 2 caracteres.";return;}if(!Number.isSafeInteger(target)||target<1){errorBox.textContent="La meta debe ser un número entero mayor que cero.";return;}
button.disabled=true;button.textContent="Guardando…";fetch("/admin/platform-goals/customers",{method:"PUT",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({type:"counter",label:label,unit:"clientes",target:target,active:true})}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.error||"goal_save_failed");return body;});}).then(function(body){paintPlatformGoal(body.goal);closeGoalEditor();showToast("Meta actualizada para todo el Super Admin.");}).catch(function(error){errorBox.textContent=error.message==="invalid_goal_target"?"La meta debe ser un número entero válido.":"No se pudo guardar la meta. Intenta de nuevo.";}).finally(function(){button.disabled=false;button.textContent="Guardar meta";});});
function openTenant(){lastFocus=document.activeElement;var layer=document.getElementById("tenantDrawer");layer.classList.add("open");layer.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";document.getElementById("drawerClose").focus();}
function closeTenant(){var layer=document.getElementById("tenantDrawer");layer.classList.remove("open");layer.setAttribute("aria-hidden","true");document.body.style.overflow="";if(lastFocus&&lastFocus.focus)lastFocus.focus();}
function testRavIntegration(){var button=document.getElementById("integrationTestButton"),result=document.getElementById("integrationTestResult");if(!button||!result)return;button.disabled=true;button.textContent="Probando...";result.textContent="Validando la integracion sin enviar mensajes reales...";fetch("/admin/integrations/rav/test",{headers:{accept:"application/json"}}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.error||"integration_test_failed");return body;});}).then(function(body){var passed=Object.keys(body.checks||{}).filter(function(key){return body.checks[key]===true;}).length,total=Object.keys(body.checks||{}).length;result.textContent=body.message+" "+passed+" de "+total+" controles correctos.";showToast(body.live_ready?"Integracion RAV lista para prueba real.":"Prueba tecnica completada; numero real pendiente.");}).catch(function(){result.textContent="No se pudo completar la prueba. Revisa la bandeja de operacion.";showToast("La prueba de integracion necesita revision.");}).finally(function(){button.disabled=false;button.textContent="Ejecutar prueba segura";});}
document.addEventListener("keydown",function(event){if(event.key==="Escape"){closeGoalEditor();closeTenant();closeSuperAdminInvite();if(customerAccessV2Enabled)closeCustomerCreate();}});
function healthKind(value){value=String(value||"");if(value==="ok"||value.indexOf("key_present")===0)return "ok";if(value==="missing_env"||value==="missing_key"||value==="not_configured")return "warn";return "err";}
function healthLabel(value){var kind=healthKind(value);if(kind==="ok")return value==="ok"?"Configurado global":"Configurado global";if(kind==="warn")return "No configurado";return "Revisar";}
function paintHealth(ids,value){ids.forEach(function(id){var el=document.getElementById(id);if(!el)return;el.textContent=healthLabel(value);el.className=el.className.indexOf("badge")>=0?"badge "+(healthKind(value)==="ok"?"success":healthKind(value)==="warn"?"warning":"danger"):"health-value "+healthKind(value);});}
function uptimeLabel(seconds){seconds=Math.max(0,Number(seconds)||0);var days=Math.floor(seconds/86400),hours=Math.floor((seconds%86400)/3600),minutes=Math.floor((seconds%3600)/60);return(days?days+"d ":"")+hours+"h "+minutes+"m";}
function loadHealth(){document.getElementById("infraValue").textContent="Verificando";fetch("/admin/health",{headers:{accept:"application/json"}}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error("health_unavailable");return body;});}).then(function(health){var ready=!!(health.production_readiness&&health.production_readiness.infrastructure_ready),blockers=health.production_readiness&&health.production_readiness.blockers||[],badge=document.getElementById("healthBadge");document.getElementById("infraValue").textContent=ready?"Operativa":"Revisar";document.getElementById("infraSubtitle").textContent=ready?"Servicios base disponibles":blockers.length+" bloqueo"+(blockers.length===1?"":"s")+" técnico"+(blockers.length===1?"":"s");badge.textContent=ready?"Infra OK":"Requiere revisión";badge.className="badge "+(ready?"success":"danger");document.getElementById("healthUptime").textContent=uptimeLabel(health.bot&&health.bot.uptime_seconds);paintHealth(["healthShopify","incidentShopify","drawerShopify"],health.checks&&health.checks.shopify_storefront);paintHealth(["healthMeta","incidentMeta","drawerMetaApi"],health.checks&&health.checks.meta_whatsapp);paintHealth(["healthSupabase","incidentSupabase","drawerSupabase"],health.checks&&health.checks.supabase_conversation_logs);paintHealth(["healthAnthropic","incidentAnthropic"],health.checks&&health.checks.anthropic_api);document.getElementById("incidentNavCount").textContent=String(blockers.length);}).catch(function(){document.getElementById("infraValue").textContent="Sin respuesta";document.getElementById("infraSubtitle").textContent="No se pudo consultar salud";document.getElementById("healthBadge").textContent="Sin respuesta";document.getElementById("healthBadge").className="badge danger";["healthShopify","healthMeta","healthSupabase","healthAnthropic","incidentShopify","incidentMeta","incidentSupabase","incidentAnthropic","drawerMetaApi"].forEach(function(id){var el=document.getElementById(id);if(el){el.textContent="Sin respuesta";el.className="health-value err";}});showToast("No se pudo actualizar la salud de plataforma.");});}
function logoutSuperAdmin(){try{localStorage.removeItem("rav_dashboard_key");}catch(e){}fetch("/admin/logout",{method:"POST"}).finally(function(){location.href="/admin";});}
function platformInviteErrorLabel(code){return({invalid_email:"Escribe un correo válido.",super_admin_already_exists:"Ese correo ya tiene acceso Super Admin.",super_admin_invitation_already_open:"Ese correo ya tiene una invitación abierta.",persistent_user_store_unavailable:"No hay almacenamiento seguro disponible.",invalid_request_origin:"La sesión debe estar abierta desde nextforia.com.",unauthorized:"Tu sesión expiró. Entra de nuevo."})[code]||"No se pudo crear el link.";}
function openSuperAdminInvite(){var modal=document.getElementById("superAdminInviteModal");if(!modal)return;lastFocus=document.activeElement;modal.classList.add("open");modal.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";document.getElementById("superAdminInviteError").textContent="";document.getElementById("superAdminInviteLink").value="";document.getElementById("superAdminInviteCopy").disabled=true;document.getElementById("superAdminInviteEmail").focus();}
function closeSuperAdminInvite(){var modal=document.getElementById("superAdminInviteModal");if(!modal)return;modal.classList.remove("open");modal.setAttribute("aria-hidden","true");document.body.style.overflow="";if(lastFocus&&lastFocus.focus)lastFocus.focus();}
function copySuperAdminInvite(){var input=document.getElementById("superAdminInviteLink");if(!input||!input.value)return;input.select();if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(input.value).then(function(){showToast("Link Super Admin copiado.");});return;}document.execCommand("copy");showToast("Link Super Admin copiado.");}
function createCustomerInvite(){if(customerAccessV2Enabled){openCustomerCreate();return;}createLegacyCustomerInvite();}
function createLegacyCustomerInvite(){var button=document.getElementById("customerInviteButton");button.disabled=true;button.textContent="Generando…";fetch("/admin/customer-invite",{method:"POST",headers:{"content-type":"application/json"},body:"{}"}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.error||"invite_failed");return body;});}).then(function(body){if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(body.setup_url).then(function(){showToast("Enlace de acceso copiado · vence en 24 horas.");});showToast("Enlace generado. Ábrelo desde un navegador compatible para copiarlo.");}).catch(function(error){showToast(error.message==="customer_admin_already_configured"?"La cuenta administradora de RAV ya está configurada.":"No se pudo generar el acceso de RAV.");}).finally(function(){button.disabled=false;button.textContent="Crear acceso RAV";});}
function customerErrorLabel(code){return({invalid_request:"Completa exactamente los cuatro campos.",invalid_company_name:"Revisa el nombre de la empresa.",invalid_email:"Ingresa un correo válido.",invalid_plan:"Selecciona un plan vigente.",invalid_assigned_bot:"Selecciona un bot vigente.",customer_already_exists:"La empresa o el correo ya están registrados.",email_delivery_failed:"El cliente se creó, pero el correo no pudo entregarse. Revisa el estado y reintenta de forma controlada.",customer_access_unavailable:"El servicio de acceso no está disponible."})[code]||"No se pudo completar el alta.";}
function fillCatalog(selectId,rows,placeholder){var select=document.getElementById(selectId);if(!select)return;select.textContent="";var empty=document.createElement("option");empty.value="";empty.textContent=placeholder;select.appendChild(empty);rows.forEach(function(row){var option=document.createElement("option");option.value=row.id;option.textContent=row.name||row.nombre||row.id;select.appendChild(option);});}
var customerCreationCatalog={plans:[],bots:[]};
function syncCustomerCreateBotToPlan(){var planSelect=document.getElementById("planId"),botSelect=document.getElementById("assignedBotId");if(!planSelect||!botSelect)return;var plan=(customerCreationCatalog.plans||[]).filter(function(item){return item.id===planSelect.value;})[0],requiredBot=plan&&plan.bot_id||"";fillCatalog("assignedBotId",customerCreationCatalog.bots||[],"Selecciona un bot");if(requiredBot){botSelect.value=requiredBot;botSelect.disabled=true;}else{botSelect.disabled=false;}}
function loadCustomerCatalogs(){return fetch("/admin/customer-access/catalogs",{headers:{accept:"application/json"}}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.error||"customer_access_unavailable");return body;});}).then(function(body){customerCreationCatalog={plans:body.plans||[],bots:body.bots||[]};fillCatalog("planId",customerCreationCatalog.plans,"Selecciona un plan");syncCustomerCreateBotToPlan();});}
function openCustomerCreate(){var modal=document.getElementById("customerCreateModal");if(!modal)return;lastFocus=document.activeElement;modal.classList.add("open");modal.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";document.getElementById("customerCreateError").textContent="";loadCustomerCatalogs().catch(function(error){document.getElementById("customerCreateError").textContent=customerErrorLabel(error.message);});document.getElementById("companyName").focus();}
function closeCustomerCreate(){var modal=document.getElementById("customerCreateModal");if(!modal)return;modal.classList.remove("open");modal.setAttribute("aria-hidden","true");document.body.style.overflow="";if(lastFocus&&lastFocus.focus)lastFocus.focus();}
function invitationBadge(status){var labels={sent:"Enviada",pending_delivery:"Pendiente",delivery_failed:"Error de entrega",expired:"Vencida",used:"Consumida",revoked:"Revocada"},tones={sent:"success",pending_delivery:"neutral",delivery_failed:"danger",expired:"warning",used:"info",revoked:"neutral"};var badge=document.createElement("span");badge.className="badge "+(tones[status]||"neutral");badge.textContent=labels[status]||status;return badge;}
function renderCustomerInvitations(rows){var root=document.getElementById("customerInvitationRows");if(!root)return;root.textContent="";if(!rows.length){var empty=document.createElement("div");empty.className="invite-loading";empty.textContent="Aún no hay invitaciones de clientes.";root.appendChild(empty);return;}rows.forEach(function(row){var line=document.createElement("div");line.className="invite-row";var client=document.createElement("div"),name=document.createElement("strong"),email=document.createElement("small");name.textContent=row.company_name;email.textContent=row.admin_email;client.append(name,email);var config=document.createElement("div"),plan=document.createElement("strong"),bot=document.createElement("small");plan.textContent=row.plan_id;bot.textContent=row.assigned_bot_id;config.append(plan,bot);var delivery=document.createElement("div");delivery.appendChild(invitationBadge(row.status));if(row.delivery_error){var deliveryError=document.createElement("small");deliveryError.textContent=row.delivery_error;delivery.appendChild(deliveryError);}var expires=document.createElement("div"),date=document.createElement("strong");date.textContent=new Date(row.expires_at).toLocaleString("es-CO",{dateStyle:"short",timeStyle:"short"});expires.appendChild(date);var action=document.createElement("div");if(["sent","pending_delivery","delivery_failed"].includes(row.status)){var revoke=document.createElement("button");revoke.type="button";revoke.className="button";revoke.textContent="Revocar";revoke.addEventListener("click",function(){revokeInvitation(row.id,revoke);});action.appendChild(revoke);}else{action.textContent="—";}line.append(client,config,delivery,expires,action);root.appendChild(line);});}
function loadCustomerInvitations(){if(!customerAccessV2Enabled)return Promise.resolve();var root=document.getElementById("customerInvitationRows");if(root)root.innerHTML='<div class="invite-loading">Actualizando…</div>';return fetch("/admin/customer-invitations",{headers:{accept:"application/json"}}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.error||"customer_access_unavailable");return body;});}).then(function(body){renderCustomerInvitations(body.invitations||[]);}).catch(function(error){if(root){root.textContent="";var message=document.createElement("div");message.className="invite-loading";message.textContent=customerErrorLabel(error.message);root.appendChild(message);}});}
function revokeInvitation(id,button){button.disabled=true;fetch("/admin/customer-invitations/"+encodeURIComponent(id)+"/revoke",{method:"POST",headers:{"content-type":"application/json"},body:"{}"}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.error||"customer_access_unavailable");return body;});}).then(function(){showToast("Invitación revocada.");return loadCustomerInvitations();}).catch(function(error){button.disabled=false;showToast(customerErrorLabel(error.message));});}
var customerCreateForm=document.getElementById("customerCreateForm");if(customerCreateForm)customerCreateForm.addEventListener("submit",function(event){event.preventDefault();var submit=document.getElementById("customerCreateSubmit"),error=document.getElementById("customerCreateError"),payload={company_name:document.getElementById("companyName").value,admin_email:document.getElementById("adminEmail").value,plan_id:document.getElementById("planId").value,assigned_bot_id:document.getElementById("assignedBotId").value};error.textContent="";submit.disabled=true;submit.textContent="Creando…";fetch("/admin/customer-invite",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.error||"customer_access_unavailable");return body;});}).then(function(){customerCreateForm.reset();closeCustomerCreate();showView("clients");showToast("Cliente creado e invitación enviada al correo administrador.");return loadCustomerInvitations();}).catch(function(problem){error.textContent=customerErrorLabel(problem.message);if(problem.message==="email_delivery_failed")loadCustomerInvitations();}).finally(function(){submit.disabled=false;submit.textContent="Crear y enviar invitación";});});
var superAdminInviteForm=document.getElementById("superAdminInviteForm");if(superAdminInviteForm)superAdminInviteForm.addEventListener("submit",function(event){event.preventDefault();var submit=document.getElementById("superAdminInviteSubmit"),error=document.getElementById("superAdminInviteError"),link=document.getElementById("superAdminInviteLink"),copy=document.getElementById("superAdminInviteCopy"),payload={email:document.getElementById("superAdminInviteEmail").value,name:document.getElementById("superAdminInviteName").value};error.textContent="";link.value="";copy.disabled=true;submit.disabled=true;submit.textContent="Creando…";postJson("/admin/super-admin/invitations",payload).then(function(body){link.value=body.invitation&&body.invitation.setup_url||"";copy.disabled=!link.value;if(link.value&&navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(link.value).then(function(){showToast("Link Super Admin creado y copiado.");});showToast("Link Super Admin creado.");}).catch(function(problem){error.textContent=platformInviteErrorLabel(problem.message);}).finally(function(){submit.disabled=false;submit.textContent="Crear link";});});
var customerCreatePlan=document.getElementById("planId");if(customerCreatePlan)customerCreatePlan.addEventListener("change",syncCustomerCreateBotToPlan);
var search=document.getElementById("clientSearch");if(search)search.addEventListener("input",function(){var query=search.value.trim().toLowerCase(),shown=0;document.querySelectorAll(".tenant-row[data-search]").forEach(function(row){var match=row.dataset.search.indexOf(query)>=0;row.hidden=!match;if(match)shown++;});var empty=document.getElementById("clientEmpty");if(empty)empty.hidden=shown>0;});
function hideLegacyClient(event,tenantId,name){if(event){event.preventDefault();event.stopPropagation();}if(!tenantId)return;var typed=window.prompt('Filtro 1 de 2: escribe el nombre exacto para eliminarlo de esta vista:\\n\\n'+name);if(typed===null)return;if(String(typed).trim()!==String(name||"").trim()){showToast("El nombre no coincide. No se eliminó nada.");return;}var ok=window.confirm('Filtro 2 de 2: confirma eliminar "'+name+'" de esta lista.');if(!ok)return;var button=event&&event.currentTarget;if(button){button.disabled=true;button.textContent="Eliminando…";}fetch("/admin/legacy-clients/"+encodeURIComponent(tenantId)+"/hide",{method:"POST",headers:{accept:"application/json","content-type":"application/json"},body:JSON.stringify({company_name_confirmacion:typed,confirmacion_final:true})}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.error||"legacy_client_visibility_unavailable");return body;});}).then(function(){var row=button&&button.closest(".tenant-row");if(row)row.remove();showToast("Cliente eliminado de la lista.");}).catch(function(){showToast("No se pudo eliminar. Intenta otra vez.");if(button){button.disabled=false;button.textContent="Eliminar";}});}
/* ── Catálogo de planes y bots ─────────────────────────────────────── */
var catalogCache={plans:[],bots:[]};
function copMoney(value){if(value==null||value==="")return "—";var n=parseInt(String(value).replace(/[^\\d-]/g,""),10);if(!isFinite(n))return "—";return "$"+String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g,".");}
function customPricePlan(plan){return !!(plan&&(String(plan.id||"").indexOf("signature")>=0||String(plan.etiqueta||"").toLowerCase().indexOf("definir")>=0)&&Number(plan.precio_mensual||0)===0);}
function planMonthlyLabel(plan){return customPricePlan(plan)?"A definir":copMoney(plan&&plan.precio_mensual);}
function planDisplayName(planId){var plan=catalogCache.plans.filter(function(item){return item.id===planId;})[0];return plan?(plan.nombre||plan.name||plan.id):(planId||"Sin plan");}
function planDisplayLine(planId,monthlyValue){var plan=catalogCache.plans.filter(function(item){return item.id===planId;})[0];if(plan)return planMonthlyLabel(plan)+" /mes";return monthlyValue==null?"Precio no definido":copMoney(monthlyValue)+" /mes";}
function catalogErrorLabel(code){var map={plan_name_required:"El plan necesita un nombre.",bot_name_required:"El bot necesita un nombre.",invalid_plan_id:"El identificador solo admite minúsculas, números, guion y guion bajo.",invalid_bot_id:"Ese bot no existe en el catálogo.",invalid_price:"Los precios no pueden ser negativos.",invalid_included_chats:"Los chats incluidos no pueden ser negativos.",plan_not_found:"Ese plan ya no existe.",tenant_not_found:"Ese cliente ya no existe.",tenant_not_suspended:"Primero hay que suspender al cliente.",company_name_mismatch:"El nombre de la empresa no coincide.",invalid_status:"Ese estado no es válido.",final_confirmation_required:"Falta marcar la confirmación final.",unauthorized:"Tu sesión expiró. Volvé a entrar.",catalog_unavailable:"No se pudo conectar con el catálogo."};return map[code]||"No se pudo completar la operación.";}
function el(tag,cls,txt){var node=document.createElement(tag);if(cls)node.className=cls;if(txt!=null)node.textContent=txt;return node;}
function fmtNum(value){if(value==null||!isFinite(Number(value)))return"—";return String(Math.round(Number(value))).replace(/\\B(?=(\\d{3})+(?!\\d))/g,".");}
function botOpsWhen(value){var parsed=Date.parse(value||"");if(!isFinite(parsed))return"—";return new Date(parsed).toLocaleString("es-CO",{timeZone:"America/Bogota",dateStyle:"short",timeStyle:"short"});}
function botOpsLabel(value){return({healthy:"Healthy",attention:"Atención",critical:"Critical",customer_service:"Customer Service",appointments:"Appointments",platform:"Plataforma",whatsapp:"WhatsApp",instagram:"Instagram",messenger:"Messenger",voice:"Voz",opportunity:"Oportunidad",open:"Abierto",approval_pending:"Pendiente aprobación",resolved:"Resuelto"})[value]||String(value||"—").replace(/_/g," ");}
function botOpsTone(value){return value==="critical"?"danger":value==="healthy"||value==="resolved"?"success":value==="opportunity"?"info":"warning";}
function botOpsFindingRow(row){var line=el("div","setup-review-row");var main=el("div");var title=el("strong",null,row.title||botOpsLabel(row.category));var company=row.company_name||row.tenant_id||"Empresa desconocida";var meta=el("small",null,company+" ("+(row.tenant_id||"sin tenant")+") · "+botOpsLabel(row.bot_id)+" · "+botOpsLabel(row.channel));main.append(title,meta);var status=el("div");status.appendChild(el("span","badge "+botOpsTone(row.severity),botOpsLabel(row.severity)));status.appendChild(el("small",null,"Último: "+botOpsWhen(row.last_seen_at)+" · "+fmtNum(row.occurrence_count||1)+" vez/veces"));var reported=row.category==="customer_reported";var recommendation=el("div");recommendation.appendChild(el("strong",null,reported?"Reportado por el cliente":(row.requires_approval?"Requiere aprobación":"Acción operativa")));recommendation.appendChild(el("small",null,(reported?(row.detail||row.recommendation):(row.recommendation||row.detail))||"Revisar el hallazgo."));line.append(main,status,recommendation);return line;}
function renderBotOpsFindings(rootId,rows,emptyText){var root=document.getElementById(rootId);if(!root)return;root.textContent="";if(!rows.length){root.appendChild(el("div","invite-loading",emptyText));return;}rows.forEach(function(row){root.appendChild(botOpsFindingRow(row));});}
function renderBotOpsWeekly(report){var root=document.getElementById("botOpsWeeklyRows");if(!root)return;root.textContent="";var patterns=report&&report.patterns||[];if(!patterns.length){root.appendChild(el("div","invite-loading","La revisión semanal aún no encontró patrones recurrentes."));return;}patterns.forEach(function(pattern){var line=el("div","setup-review-row");var main=el("div");var company=pattern.company_name||pattern.tenant_id||"Empresa desconocida";main.append(el("strong",null,botOpsLabel(pattern.category)),el("small",null,company+" ("+(pattern.tenant_id||"sin tenant")+") · "+botOpsLabel(pattern.bot_id)+" · "+botOpsLabel(pattern.channel)));var impact=el("div");impact.append(el("span","badge "+botOpsTone(pattern.severity),"Prioridad "+botOpsLabel(pattern.priority)),el("small",null,fmtNum(pattern.occurrences)+" ocurrencias · "+(pattern.repeated?"Repetido":"No repetido")));var resolution=el("div");resolution.append(el("strong",null,botOpsLabel(pattern.resolution)),el("small",null,pattern.recommendation||"Revisar y priorizar."));line.append(main,impact,resolution);root.appendChild(line);});}
function renderBotOps(body){var labels={healthy:"Healthy",attention:"Attention",critical:"Critical"},overall=document.getElementById("botOpsOverall"),status=body.overall_status||"attention";overall.textContent=labels[status]||"Attention";overall.style.color=status==="critical"?"#B73535":status==="healthy"?"#087A55":"#A15C00";document.getElementById("botOpsUpdated").textContent="Última actualización: "+botOpsWhen(body.last_updated);document.getElementById("botOpsDaily").textContent=botOpsWhen(body.last_daily_review);document.getElementById("botOpsWeekly").textContent=botOpsWhen(body.last_weekly_review);document.getElementById("botOpsEmail").textContent=body.independent_email_alerts_ready?"Operativas":"Revisar";document.getElementById("botOpsStorage").textContent=body.storage_ready?"Listo":"No disponible";var counts=body.counts||{};document.getElementById("botOpsIncidents").textContent=fmtNum(counts.open_incidents||0);document.getElementById("botOpsOpportunities").textContent=fmtNum(counts.improvement_opportunities||0);document.getElementById("botOpsApprovals").textContent=fmtNum(counts.pending_approvals||0);document.getElementById("botOpsNavCount").textContent=fmtNum((counts.open_incidents||0)+(counts.pending_approvals||0));renderBotOpsFindings("botOpsIncidentRows",body.open_incidents||[],"No hay incidentes abiertos.");var merged=[],seen={};(body.improvement_opportunities||[]).concat(body.pending_approvals||[]).forEach(function(row){var key=row.id||[row.tenant_id,row.category,row.last_seen_at].join(":");if(!seen[key]){seen[key]=true;merged.push(row);}});renderBotOpsFindings("botOpsImprovementRows",merged,"No hay oportunidades o aprobaciones pendientes.");renderBotOpsWeekly(body.weekly_report);}
function loadBotOps(){var overall=document.getElementById("botOpsOverall");if(overall)overall.textContent="Verificando";return fetch("/admin/bot-ops/summary",{headers:{accept:"application/json"}}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.error||"bot_ops_unavailable");return body;});}).then(renderBotOps).catch(function(){if(overall)overall.textContent="No disponible";var nav=document.getElementById("botOpsNavCount");if(nav)nav.textContent="!";renderBotOpsFindings("botOpsIncidentRows",[],"Bot Ops no pudo leer el almacenamiento dedicado.");showToast("Bot Ops necesita revisión de almacenamiento o permisos.");});}
function leadStageClass(stage){return stage==="setup_completed"?"warning":stage==="setup_started"?"info":"neutral";}
function pipelineCustomerCount(){var done=(leadsPipeline&&leadsPipeline.rows||[]).filter(function(row){return row&& (row.setup_completed===true||Number(row.completion)>=100);}).length;return baseClientCount+((leadsPipeline&&leadsPipeline.customers)||[]).length+done;}
function leadSearchText(row){return[String(row.company_name||""),String(row.admin_email||""),String(row.contact_phone||""),String(row.tenant_id||""),String(row.plan_id||""),String(row.assigned_bot_id||""),String(row.stage_label||"")].join(" ").toLowerCase();}
function leadDateValue(row){var raw=row&&(row.updated_at||row.created_at);var time=Date.parse(raw||"");return isNaN(time)?0:time;}
function leadDateText(row){var raw=row&&(row.updated_at||row.created_at)||"";return String(raw).slice(0,10)||"Sin fecha";}
function currentLeadRows(){var rows=(leadsPipeline&&leadsPipeline.rows||[]).slice(),query=(document.getElementById("leadSearchInput")&&document.getElementById("leadSearchInput").value||"").trim().toLowerCase(),order=(document.getElementById("leadSortOrder")&&document.getElementById("leadSortOrder").value||"desc");if(query)rows=rows.filter(function(row){return leadSearchText(row).indexOf(query)>=0;});rows.sort(function(a,b){return order==="asc"?leadDateValue(a)-leadDateValue(b):leadDateValue(b)-leadDateValue(a);});return rows;}
function renderLeadPipeline(data){leadsPipeline=data||{kpis:{active:0,won:0,demos:0,conversion:0},rows:[]};var kpis=leadsPipeline.kpis||{},rows=leadsPipeline.rows||[];
["active","won","demos","conversion"].forEach(function(key){var node=document.getElementById("leadKpi_"+key);if(node)node.textContent=fmtNum(kpis[key])+(key==="conversion"?"%":"");});
var nav=document.getElementById("leadNavCount");if(nav)nav.textContent=fmtNum(kpis.active||0);rows=currentLeadRows();var count=document.getElementById("leadRowsCount");if(count)count.textContent=fmtNum(rows.length);
if(typeof paintClientCount==="function")paintClientCount(pipelineCustomerCount(),(leadsPipeline&&leadsPipeline.customers)||[]);
var root=document.getElementById("leadPipelineRows");if(!root)return;root.textContent="";if(!rows.length){var hasSearch=(document.getElementById("leadSearchInput")&&document.getElementById("leadSearchInput").value||"").trim();root.appendChild(el("div","invite-loading",hasSearch?"No encontré ese prospecto. Prueba con empresa, correo, teléfono o tenant.":"No hay leads activos. Cuando alguien cree cuenta con email y clave, aparecerá aquí."));return;}
rows.forEach(function(row){var line=el("div","lead-row");var company=el("div");company.appendChild(el("strong",null,row.company_name||row.tenant_id||"Lead"));company.appendChild(el("small",null,row.tenant_id||"—"));line.appendChild(company);
var contact=el("div");contact.appendChild(el("strong",null,row.admin_email||"—"));contact.appendChild(el("small",null,row.contact_phone||"Sin teléfono"));line.appendChild(contact);
var stage=el("div");stage.appendChild(el("span","badge "+leadStageClass(row.stage)+" dot",row.stage_label||"Lead"));stage.appendChild(el("small",null,fmtNum(row.completion||0)+"% setup"));line.appendChild(stage);
var plan=el("div");plan.appendChild(el("strong",null,row.plan_id||"Plan inicial"));plan.appendChild(el("small",null,row.assigned_bot_id||"Bot inicial"));line.appendChild(plan);
var date=el("div");date.appendChild(el("strong",null,leadDateText(row)));date.appendChild(el("small",null,row.updated_at?"actualizado":"creado"));line.appendChild(date);
var actions=el("div","catalog-actions");var view=el("button","button","Ver ficha/setup");view.type="button";view.addEventListener("click",function(){openTenantSetup(row.tenant_id);});actions.appendChild(view);
var suspend=el("button","button","Suspender");suspend.type="button";suspend.addEventListener("click",function(){setTenantStatus(row.tenant_id,"suspendido",row.company_name||row.tenant_id).then(refreshTenantViews);});actions.appendChild(suspend);
var remove=el("button","button danger","Eliminar");remove.type="button";remove.addEventListener("click",function(){openTenantDelete(row.tenant_id,row.company_name||row.tenant_id||"Lead","lead");});actions.appendChild(remove);
line.appendChild(actions);root.appendChild(line);});}
function applyLeadSearch(){renderLeadPipeline(leadsPipeline);}
function applyLeadSort(){renderLeadPipeline(leadsPipeline);}
function loadLeadPipeline(){var root=document.getElementById("leadPipelineRows");if(root){root.textContent="";root.appendChild(el("div","invite-loading","Actualizando leads…"));}return fetch("/admin/leads",{headers:{accept:"application/json"}}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.error||"leads_unavailable");return body;});}).then(function(body){renderLeadPipeline(body.leads);}).catch(function(){if(root){root.textContent="";root.appendChild(el("div","invite-loading","No se pudo cargar Leads."));}showToast("No se pudo actualizar Leads.");});}
function billingDate(value){if(!value)return"—";var date=new Date(value);return isNaN(date.getTime())?"—":date.toLocaleDateString("es-CO",{year:"numeric",month:"short",day:"numeric"});}
function billingStatus(value){return({pending:"Pendiente",paid:"Pagado",failed:"Fallido",refunded:"Reembolsado",trial:"Trial",active:"Activa",past_due:"Vencida",suspended:"Suspendida",cancelled:"Cancelada",pilot:"Piloto"})[value]||"Sin iniciar";}
function billingMetric(label,value){var box=el("div","billing-metric");box.appendChild(el("small",null,label));box.appendChild(el("strong",null,value));return box;}
function renderBillingAdmin(rows){var root=document.getElementById("billingAdminRows"),badge=document.getElementById("billingNavCount");if(badge)badge.textContent=String((rows||[]).filter(function(row){return row.payment_status==="pending"||row.payment_status==="failed";}).length);if(!root)return;root.textContent="";if(!rows.length){root.appendChild(el("div","invite-loading","Aún no hay contratos preparados. Aparecerán cuando un cliente elija bot y plan."));return;}rows.forEach(function(row){var card=el("article","billing-card"),head=el("div","billing-card-head"),who=el("div");who.appendChild(el("strong",null,row.customer||row.tenant_id));who.appendChild(el("small",null,row.tenant_id+" · "+(row.bot_name||row.bot_id)+" · "+(row.plan_name||row.plan_id)));head.appendChild(who);var actions=el("div","billing-bypass");if(!["active","trial","pilot"].includes(row.subscription_status)){var trial=el("button","button","Aprobar trial");trial.type="button";trial.addEventListener("click",function(){approveBillingBypass(row.tenant_id,"trial");});var pilot=el("button","button","Aprobar piloto");pilot.type="button";pilot.addEventListener("click",function(){approveBillingBypass(row.tenant_id,"pilot");});actions.append(trial,pilot);}else actions.appendChild(el("span","badge success",row.ready_for_bot_creation?"Listo para crear bot":"No listo"));head.appendChild(actions);card.appendChild(head);var metrics=el("div","billing-metrics");metrics.append(
billingMetric("Plan",row.plan_name||row.plan_id||"—"),
billingMetric("Mensual contratado",copMoney(row.contracted_monthly_price)),
billingMetric("Proveedor",row.payment_provider||"—"),
billingMetric("Pago",billingStatus(row.payment_status)),
billingMetric("Suscripción",billingStatus(row.subscription_status)),
billingMetric("Cobrado",copMoney((row.history&&row.history[0]&&row.history[0].amount_charged)||0)),
billingMetric("Comisión",copMoney(row.provider_fee)+" · "+(row.provider_fee_type==="real"?"Real":"Estimada")),
billingMetric("Neto recibido",copMoney(row.net_amount)),
billingMetric("Fecha de pago",billingDate(row.history&&row.history[0]&&row.history[0].payment_date)),
billingMetric("Próximo pago",billingDate(row.next_payment_date))
);card.appendChild(metrics);var history=el("div","billing-history");history.appendChild(el("strong",null,"Historial de pagos"));(row.history||[]).forEach(function(item){var line=el("div","billing-history-row");line.appendChild(el("strong",null,billingStatus(item.payment_status)+" · "+copMoney(item.amount_charged)));line.appendChild(el("span",null,billingDate(item.payment_date||item.created_at)));line.appendChild(el("span",null,"Comisión "+copMoney(item.provider_fee)+" · "+(item.provider_fee_type==="real"?"Real":"Estimada")));line.appendChild(el("span",null,"Neto "+copMoney(item.net_amount)));history.appendChild(line);});if(!(row.history||[]).length)history.appendChild(el("div","invite-loading","Sin transacciones todavía."));if(row.bypass_reason)history.appendChild(el("small",null,"Bypass auditado: "+row.bypass_reason+" · "+(row.bypass_approved_by||"super_admin")+" · "+billingDate(row.bypass_approved_at)));card.appendChild(history);root.appendChild(card);});}
function loadBillingAdmin(){if(!paymentsV1Enabled)return Promise.resolve();var root=document.getElementById("billingAdminRows");if(root)root.innerHTML='<div class="invite-loading">Actualizando facturación…</div>';return fetch("/admin/billing",{headers:{accept:"application/json"}}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.error||"billing_unavailable");return body;});}).then(function(body){renderBillingAdmin(body.billing||[]);}).catch(function(error){if(root){root.textContent="";root.appendChild(el("div","invite-loading","No se pudo cargar la facturación: "+error.message));}});}
function approveBillingBypass(tenantId,status){var reason=window.prompt(status==="trial"?"Motivo de aprobación del trial:":"Motivo de aprobación del piloto:");if(!reason||reason.trim().length<4)return;var payload={subscription_status:status,reason:reason.trim()};if(status==="trial"){var days=Number(window.prompt("Duración del trial en días:","14"));if(!isFinite(days)||days<1||days>90){showToast("La duración debe estar entre 1 y 90 días.");return;}var start=new Date(),end=new Date(start.getTime()+Math.round(days)*86400000);payload.trial_start=start.toISOString();payload.trial_end=end.toISOString();}postJson("/admin/billing/"+encodeURIComponent(tenantId)+"/bypass",payload).then(function(){showToast(status==="trial"?"Trial aprobado y auditado.":"Piloto aprobado y auditado.");return loadBillingAdmin();}).catch(function(error){showToast("No se pudo aprobar: "+error.message);});}
function refreshTenantViews(){return Promise.all([loadLeadPipeline(),loadSetupReviews(),customerAccessV2Enabled?loadTenants():Promise.resolve()]);}
function renderCatalog(){var planRoot=document.getElementById("planRows"),botRoot=document.getElementById("botRows");if(!planRoot||!botRoot)return;
planRoot.textContent="";botRoot.textContent="";
if(!catalogCache.plans.length)planRoot.appendChild(el("div","invite-loading","Todavía no hay planes. Creá el primero."));
catalogCache.plans.forEach(function(plan){var planActive=plan.activo!==false&&plan.active!==false,row=el("div","catalog-row"+(planActive?"":" inactive"));
var main=el("div","catalog-main");main.appendChild(el("strong",null,plan.nombre||plan.name||plan.id));
if(plan.descripcion)main.appendChild(el("span",null,plan.descripcion));
main.appendChild(el("code",null,plan.id));
if(plan.beneficios&&plan.beneficios.length){var bl=el("div","catalog-benefits");plan.beneficios.slice(0,4).forEach(function(b){bl.appendChild(el("span",null,b));});main.appendChild(bl);}
row.appendChild(main);
var mensual=el("div","catalog-price",planMonthlyLabel(plan));mensual.appendChild(el("small",null,customPricePlan(plan)?"mensual personalizado":"mensual"));row.appendChild(mensual);
var setup=el("div","catalog-price","$0");setup.appendChild(el("small",null,"sin setup"));row.appendChild(setup);
var chats=el("div","catalog-price",plan.chats_incluidos==null?"—":String(plan.chats_incluidos));chats.appendChild(el("small",null,plan.chats_incluidos==null?"por definir":"chats"));row.appendChild(chats);
var actions=el("div","catalog-actions");
var badge=el("span","badge "+(planActive?"success":"neutral")+" dot",planActive?"Activo":"Inactivo");actions.appendChild(badge);
var edit=el("button","button","Editar");edit.type="button";edit.addEventListener("click",function(){openPlanEditor(plan.id);});actions.appendChild(edit);
var toggle=el("button","button",planActive?"Desactivar":"Activar");toggle.type="button";toggle.addEventListener("click",function(){togglePlan(plan.id,!planActive);});actions.appendChild(toggle);
row.appendChild(actions);planRoot.appendChild(row);});
if(!catalogCache.bots.length)botRoot.appendChild(el("div","invite-loading","Todavía no hay bots."));
catalogCache.bots.forEach(function(bot){var botActive=bot.activo!==false&&bot.active!==false,row=el("div","catalog-row"+(botActive?"":" inactive"));
var main=el("div","catalog-main");main.appendChild(el("strong",null,bot.nombre||bot.name||bot.id));
if(bot.descripcion)main.appendChild(el("span",null,bot.descripcion));
main.appendChild(el("code",null,bot.id));row.appendChild(main);
row.appendChild(el("div","catalog-price","—"));row.appendChild(el("div","catalog-price","—"));
row.appendChild(el("div","catalog-price","#"+(bot.orden==null?0:bot.orden)));
var actions=el("div","catalog-actions");
actions.appendChild(el("span","badge "+(botActive?"success":"neutral")+" dot",botActive?"Activo":"Inactivo"));
var edit=el("button","button","Editar");edit.type="button";edit.addEventListener("click",function(){openBotEditor(bot.id);});actions.appendChild(edit);
row.appendChild(actions);botRoot.appendChild(row);});
var select=document.getElementById("planBotId");if(select){var current=select.value;select.textContent="";var blank=document.createElement("option");blank.value="";blank.textContent="Sin bot asignado";select.appendChild(blank);
catalogCache.bots.forEach(function(bot){var opt=document.createElement("option");opt.value=bot.id;opt.textContent=bot.nombre||bot.name||bot.id;select.appendChild(opt);});select.value=current;}}
function loadCatalog(){if(!customerAccessV2Enabled)return Promise.resolve();return fetch("/admin/catalogs",{headers:{accept:"application/json"}}).then(function(r){return r.json().then(function(b){if(!r.ok)throw new Error(b.error||"catalog_unavailable");return b;});}).then(function(body){catalogCache={plans:body.plans||[],bots:body.bots||[]};renderCatalog();if(body.warning||body.fallback_catalog)showToast("Mostrando catálogo oficial de respaldo. La base dinámica necesita revisión.");if(typeof renderTenants==="function"&&tenantCache&&tenantCache.length)renderTenants();}).catch(function(error){var root=document.getElementById("planRows"),botRoot=document.getElementById("botRows");if(root){root.textContent="";root.appendChild(el("div","invite-loading",catalogErrorLabel(error.message)));}if(botRoot){botRoot.textContent="";botRoot.appendChild(el("div","invite-loading",catalogErrorLabel(error.message)));}});}
function openPlanEditor(planId){var plan=planId?catalogCache.plans.filter(function(p){return p.id===planId;})[0]:null;
document.getElementById("planEditorTitle").textContent=plan?"Editar plan":"Nuevo plan";
document.getElementById("planEditorOriginalId").value=plan?plan.id:"";
document.getElementById("planNombre").value=plan?(plan.nombre||plan.name||""):"";
document.getElementById("planIdField").value=plan?plan.id:"";
document.getElementById("planIdField").readOnly=!!plan;
document.getElementById("planDescripcion").value=plan?(plan.descripcion||""):"";
document.getElementById("planEtiqueta").value=plan?(plan.etiqueta||""):"";
document.getElementById("planPrecioMensual").value=plan?(plan.precio_mensual==null?"":plan.precio_mensual):"";
document.getElementById("planChats").value=plan&&plan.chats_incluidos!=null?plan.chats_incluidos:"";
document.getElementById("planBeneficios").value=plan&&plan.beneficios?plan.beneficios.join("\\n"):"";
document.getElementById("planOrden").value=plan?(plan.orden==null?0:plan.orden):catalogCache.plans.length+1;
document.getElementById("planEditorError").textContent="";
renderCatalog();document.getElementById("planBotId").value=plan&&plan.bot_id?plan.bot_id:"";
openModal("planEditorModal","planNombre");}
function closePlanEditor(){closeModal("planEditorModal");}
function openBotEditor(botId){var bot=botId?catalogCache.bots.filter(function(b){return b.id===botId;})[0]:null;
document.getElementById("botEditorTitle").textContent=bot?"Editar bot":"Nuevo bot";
document.getElementById("botNombre").value=bot?(bot.nombre||bot.name||""):"";
document.getElementById("botIdField").value=bot?bot.id:"";
document.getElementById("botIdField").readOnly=!!bot;
document.getElementById("botDescripcion").value=bot?(bot.descripcion||""):"";
document.getElementById("botOrden").value=bot?(bot.orden==null?0:bot.orden):catalogCache.bots.length+1;
document.getElementById("botEditorError").textContent="";
openModal("botEditorModal","botNombre");}
function closeBotEditor(){closeModal("botEditorModal");}
function openModal(id,focusId){var layer=document.getElementById(id);if(!layer)return;lastFocus=document.activeElement;layer.classList.add("open");layer.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";var target=document.getElementById(focusId);if(target)target.focus();}
function closeModal(id){var layer=document.getElementById(id);if(!layer)return;layer.classList.remove("open");layer.setAttribute("aria-hidden","true");document.body.style.overflow="";if(lastFocus&&lastFocus.focus)lastFocus.focus();}
function postJson(url,payload){return fetch(url,{method:"POST",headers:{"content-type":"application/json",accept:"application/json","x-nextforia-panel-origin":location.origin},body:JSON.stringify(payload)}).then(function(r){return r.json().then(function(b){if(!r.ok)throw new Error(b.error||"catalog_unavailable");return b;});});}
/* ── Cuestionario de Customer Setup ─────────────────────────────────── */
var questionnaireCache={version:1,questions:[]},currentQuestionBot="customer_service";
var QUESTION_TYPES=[["text","Respuesta corta"],["email","Correo"],["tel","Teléfono"],["textarea","Respuesta larga"],["choice","Sí / No / No sé"],["checkbox","Casilla"]];
var BOT_QUESTIONNAIRES={
  customer_service:{title:"Bot Atención / Ventas 24/7",help:"Preguntas para que el bot entienda la empresa, productos, integraciones, políticas y soporte humano.",defaultSection:"offering",sections:[["business","Datos del negocio"],["offering","Productos y políticas"],["commerce","Shopify y WordPress"],["voice","Atención humana y tono"]]},
  appointments:{title:"Bot Agendamiento",help:"Preguntas para que el bot pueda explicar servicios, ofrecer horarios, confirmar citas y escalar casos.",defaultSection:"appointments_business",sections:[["appointments_business","Negocio"],["appointments_rules","Reglas de conversación"],["appointments_knowledge","Servicios y conocimiento"],["appointments_schedule","Agenda y disponibilidad"],["appointments_followup","Recordatorios"],["appointments_channels","Canales"],["appointments_review","Consentimiento"]]}
};
function optionList(items,current){return items.map(function(item){var value=Array.isArray(item)?item[0]:item,label=Array.isArray(item)?item[1]:item;return '<option value="'+value+'" '+(value===current?"selected":"")+'>'+label+'</option>';}).join("");}
function questionBot(question){var section=String(question&&question.section||""),path=String(question&&question.path||"");if(path==="setup_goal"||section==="goal")return"selector";if(section.indexOf("appointments_")===0||path.indexOf("appointment_setup.")===0)return"appointments";return"customer_service";}
function currentBotConfig(){return BOT_QUESTIONNAIRES[currentQuestionBot]||BOT_QUESTIONNAIRES.customer_service;}
function questionInput(row,key,labelText,value,type){var wrap=el("div","question-field");var label=el("label",null,labelText);var input=document.createElement("input");input.value=value==null?"":String(value);input.dataset.q=key;if(type)input.type=type;wrap.appendChild(label);wrap.appendChild(input);row.appendChild(wrap);return input;}
function questionSelect(row,key,labelText,value,items){var wrap=el("div","question-field");var label=el("label",null,labelText);var select=document.createElement("select");select.dataset.q=key;select.innerHTML=optionList(items,value);wrap.appendChild(label);wrap.appendChild(select);row.appendChild(wrap);return select;}
function questionCheckbox(row,key,labelText,checked){var wrap=el("div","question-field checkbox");var label=el("label",null,labelText);var input=document.createElement("input");input.type="checkbox";input.checked=!!checked;input.dataset.q=key;wrap.appendChild(label);wrap.appendChild(input);row.appendChild(wrap);return input;}
function setQuestionBot(bot){if(!BOT_QUESTIONNAIRES[bot])return;currentQuestionBot=bot;document.querySelectorAll("[data-question-bot]").forEach(function(button){button.classList.toggle("active",button.dataset.questionBot===bot);});renderQuestionnaire();}
function renderQuestionnaire(){var root=document.getElementById("questionnaireRows");if(!root)return;var config=currentBotConfig();document.getElementById("questionnaireBotTitle").textContent=config.title;document.getElementById("questionnaireBotHelp").textContent=config.help;root.textContent="";var questions=(questionnaireCache.questions||[]).filter(function(q){return questionBot(q)===currentQuestionBot;}).sort(function(a,b){return (Number(a.order)||0)-(Number(b.order)||0);});if(!questions.length){root.appendChild(el("div","question-empty","Este bot todavía no tiene preguntas configuradas."));return;}
questions.forEach(function(question,index){var row=el("div","question-row"+(question.active===false?" inactive":""));row.dataset.id=question.id;row.dataset.path=question.path||"";row.dataset.custom=question.custom||String(question.id||"").indexOf("custom_")===0?"1":"";
questionInput(row,"order","Orden",question.order==null?(index+1)*10:question.order,"number");
var labelInput=questionInput(row,"label","Pregunta",question.label||"","text");labelInput.maxLength=220;
var placeholderInput=questionInput(row,"placeholder","Texto de ayuda",question.placeholder||"","text");placeholderInput.maxLength=500;
questionSelect(row,"section","Bloque",question.section||config.defaultSection,config.sections);
questionSelect(row,"type","Tipo",question.type||"text",QUESTION_TYPES);
questionCheckbox(row,"required","Obligatoria",question.required!==false);
questionCheckbox(row,"active","Visible",question.active!==false).addEventListener("change",function(event){row.classList.toggle("inactive",!event.target.checked);});
var actions=el("div","question-actions");var remove=el("button","button danger","Ocultar");remove.type="button";remove.addEventListener("click",function(){var active=row.querySelector('[data-q="active"]');if(active)active.checked=false;row.classList.add("inactive");showToast("Pregunta oculta. Guarda para aplicar el cambio. Las respuestas anteriores siguen guardadas.");});actions.appendChild(remove);row.appendChild(actions);
var meta=el("div","question-meta",(row.dataset.custom==="1"?"Pregunta creada por Super Admin":"Pregunta base del sistema")+" · No se borra; puedes ocultarla para clientes nuevos.");meta.style.gridColumn="1 / -1";row.appendChild(meta);root.appendChild(row);});}
function loadQuestionnaire(){var root=document.getElementById("questionnaireRows");if(root){root.textContent="";root.appendChild(el("div","invite-loading","Cargando cuestionario…"));}return fetch("/admin/customer-setup-questionnaire",{headers:{accept:"application/json"}}).then(function(r){return r.json().then(function(b){if(!r.ok)throw new Error(b.error||"questionnaire_unavailable");return b;});}).then(function(body){questionnaireCache=body.questionnaire||{version:1,questions:[]};renderQuestionnaire();}).catch(function(){if(root){root.textContent="";root.appendChild(el("div","question-empty","No se pudo cargar el cuestionario."));}showToast("No se pudo cargar el cuestionario.");});}
function addQuestion(){var config=currentBotConfig(),id="custom_"+currentQuestionBot+"_"+Date.now();var sameBot=(questionnaireCache.questions||[]).filter(function(q){return questionBot(q)===currentQuestionBot;});var maxOrder=sameBot.reduce(function(max,q){return Math.max(max,Number(q.order)||0);},currentQuestionBot==="appointments"?200:80);questionnaireCache.questions=(questionnaireCache.questions||[]).concat([{id:id,path:"custom."+id.replace(/^custom_/,""),section:config.defaultSection,order:maxOrder+10,active:true,required:false,type:"text",label:"Nueva pregunta para "+config.title,placeholder:"",custom:true}]);renderQuestionnaire();showToast("Pregunta nueva agregada en "+config.title+". Escribe el texto y pulsa Guardar cuestionario para publicarla.");}
function collectVisibleQuestionUpdates(){var updates={};document.querySelectorAll("#questionnaireRows .question-row").forEach(function(row){function value(name){var field=row.querySelector('[data-q="'+name+'"]');return field&&field.type==="checkbox"?field.checked:field?field.value:"";}updates[row.dataset.id]={id:row.dataset.id,path:row.dataset.path,custom:row.dataset.custom==="1",order:value("order"),label:value("label"),placeholder:value("placeholder"),section:value("section"),type:value("type"),required:value("required"),active:value("active")};});return updates;}
function collectQuestionnaire(){var updates=collectVisibleQuestionUpdates(),seen={};var questions=(questionnaireCache.questions||[]).map(function(question){if(updates[question.id]){seen[question.id]=true;return updates[question.id];}return question;});Object.keys(updates).forEach(function(id){if(!seen[id])questions.push(updates[id]);});return{version:1,questions:questions};}
function saveQuestionnaire(){var button=document.getElementById("questionnaireSaveButton"),config=currentBotConfig();if(button){button.disabled=true;button.textContent="Guardando…";}fetch("/admin/customer-setup-questionnaire",{method:"PUT",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({questionnaire:collectQuestionnaire()})}).then(function(r){return r.json().then(function(b){if(!r.ok)throw new Error(b.error||"questionnaire_unavailable");return b;});}).then(function(body){questionnaireCache=body.questionnaire;renderQuestionnaire();showToast("Cuestionario de "+config.title+" guardado.");}).catch(function(){showToast("No se pudo guardar el cuestionario.");}).finally(function(){if(button){button.disabled=false;button.textContent="Guardar cuestionario";}});}
document.querySelectorAll("[data-question-bot]").forEach(function(button){button.addEventListener("click",function(){setQuestionBot(button.dataset.questionBot);});});
/* ── Revisión de setups por cliente ────────────────────────────────── */
var setupReviewCache=[],setupReviewCurrent=null;
var SETUP_REVIEW_STATUSES=[["incomplete","Incomplete"],["ready","Ready"],["building","Building"],["testing","Testing"],["live","Live"]];
function setupStatusLabel(status){var found=SETUP_REVIEW_STATUSES.filter(function(item){return item[0]===status;})[0];return found?found[1]:"Incomplete";}
function setupStatusHelp(status,answersApproved){if(status==="ready"&&!answersApproved)return"El setup está completo y espera aprobación de Super Admin.";return({incomplete:"Falta información o NextforIA pidió cambios al cliente.",ready:"El setup está aprobado para construir.",building:"El bot está en construcción interna.",testing:"El bot está en pruebas antes de activarse.",live:"El bot está activo para el cliente."})[status]||"Estado de revisión pendiente.";}
function setupGoalLabel(goal){return({customer_service:"Bot Atención / Ventas 24/7",appointments:"Bot Agendamiento",both:"Atención + Agendamiento",unknown:"Sin elegir todavía"})[goal]||goal||"Sin elegir todavía";}
function setupAnswersApproved(answers){var goal=answers&&answers.setup_goal,status=answers&&answers.customer_service_setup&&answers.customer_service_setup.setup_status,appointmentStatus=answers&&answers.appointment_setup&&answers.appointment_setup.setup_status;if(goal==="customer_service")return status==="approved"||status==="active";if(goal==="appointments")return appointmentStatus==="approved"||appointmentStatus==="active";if(goal==="both")return(status==="approved"||status==="active")&&(appointmentStatus==="approved"||appointmentStatus==="active");return false;}
function setupStatusPill(status){return el("span","setup-status "+(status||"incomplete"),setupStatusLabel(status));}
function answerByPath(answers,path){if(!path)return"";return String(path).split(".").reduce(function(value,key){return value&&value[key];},answers)||"";}
function setAnswerByPath(target,path,value){if(!path)return;var keys=String(path).split("."),cursor=target;keys.forEach(function(key,index){if(index===keys.length-1){cursor[key]=value;return;}if(!cursor[key]||typeof cursor[key]!=="object")cursor[key]={};cursor=cursor[key];});}
function cloneSetupAnswers(source){try{return JSON.parse(JSON.stringify(source||{}));}catch(e){return{};}}
function setupReviewQuestionApplies(question,answers){var bot=questionBot(question),goal=answers&&answers.setup_goal||"unknown";if(bot==="selector")return true;if(goal==="both")return bot==="customer_service"||bot==="appointments";if(goal==="appointments")return bot==="appointments";if(goal==="customer_service")return bot==="customer_service";return question.active!==false;}
function setupReviewQuestions(detail){var answers=detail&&detail.onboarding&&detail.onboarding.answers||{},questions=detail&&detail.questionnaire&&detail.questionnaire.questions||[];return questions.filter(function(question){var hasValue=answerByPath(answers,question.path)!=="";return question.path&&setupReviewQuestionApplies(question,answers)&&(question.active!==false||hasValue);}).sort(function(a,b){return(Number(a.order)||0)-(Number(b.order)||0);});}
function setupChannelConnection(detail,channel){var rows=detail&&Array.isArray(detail.channels)?detail.channels:[];return rows.filter(function(row){return row&&row.channel===channel;})[0]||null;}
function phoneDigits(value){return String(value||"").replace(/\D/g,"");}
function phoneNumbersSame(a,b){var left=phoneDigits(a),right=phoneDigits(b);if(!left||!right)return false;if(left===right)return true;return left.slice(-10)===right.slice(-10);}
function phoneInternationalOk(value){var clean=String(value||"").replace(/[\\s().-]/g,"");return /^\\+\\d{10,15}$/.test(clean);}
function setupLaunchCheck(detail,code){var checks=detail&&detail.launch&&Array.isArray(detail.launch.checks)?detail.launch.checks:[];return checks.filter(function(check){return check&&check.code===code&&check.ok;})[0]||null;}
function setupChannelStatus(detail,channel,requested,setupValue){var connection=setupChannelConnection(detail,channel),status=connection&&connection.status;if(channel==="whatsapp"&&setupLaunchCheck(detail,"whatsapp_connected"))return{label:"Conectado",tone:"success",detail:connection&&connection.account_label||"Validado técnicamente."};if(channel==="whatsapp"&&setupValue){if(!phoneInternationalOk(setupValue))return{label:"Corregir número",tone:"danger",detail:"El número del setup debe tener código de país. Ejemplo: +573015872708."};if(status==="connected"&&connection.account_label&&phoneDigits(connection.account_label)&&!phoneNumbersSame(setupValue,connection.account_label))return{label:"No coincide",tone:"danger",detail:"Setup: "+setupValue+" · Conexión real: "+connection.account_label+". Corrige antes de Live."};}
if(status==="connected")return{label:"Conectado",tone:"success",detail:connection.account_label||"Validado técnicamente."};if(status==="connecting")return{label:"Pendiente de conexión",tone:"warning",detail:"Autorización iniciada; falta terminar la conexión."};if(status==="needs_attention")return{label:"Requiere revisión",tone:"danger",detail:connection.last_error||"La conexión necesita atención técnica."};if(requested)return{label:"Pendiente de conexión",tone:"warning",detail:"El cliente lo informó durante el setup. Falta activarlo técnicamente."};return{label:"No solicitado",tone:"neutral",detail:"El cliente no dejó datos para este canal en el setup."};}
function requestedSetupChannels(detail){var answers=detail&&detail.onboarding&&detail.onboarding.answers||{},items=[];function add(channel,label,value,requested){var state=setupChannelStatus(detail,channel,requested,value);items.push({channel:channel,label:label,value:value||"—",state:state});}
var whatsapp=answers.meta&&answers.meta.whatsapp_number||"";add("whatsapp","WhatsApp informado en setup",whatsapp,!!whatsapp||answers.meta&&answers.meta.whatsapp_integration_intent==="yes");
var instagram=answers.appointment_setup&&answers.appointment_setup.instagram_username||answers.meta&&answers.meta.instagram_username||"";add("instagram","Instagram",instagram,!!instagram);
var commerce=answers.commerce&&answers.commerce.platform||"";var commerceRequested=commerce&&commerce!=="none"&&commerce!=="unknown"||answers.commerce&&answers.commerce.integration_intent==="yes";var commerceConnected=!!setupLaunchCheck(detail,"shopify_connected");items.push({channel:"commerce",label:"Commerce",value:commerceRequested?((commerce||"Tienda")+" "+(answers.commerce&&answers.commerce.store_url?("· "+answers.commerce.store_url):"")):"—",state:commerceConnected?{label:"Conectado",tone:"success",detail:"La tienda ya está emparejada con NextforIA."}:(commerceRequested?{label:"Pendiente de conexión",tone:"warning",detail:"El cliente informó una tienda o intención de integración. Falta validar acceso técnico."}:{label:"No solicitado",tone:"neutral",detail:"El cliente no solicitó integración de tienda."})});
return items;}
function renderSetupChannels(root,detail){var section=el("section","setup-channel-summary");var head=el("div","question-toolbar");var title=el("div");title.appendChild(el("h2",null,"Canales solicitados por el cliente"));title.appendChild(el("p",null,"El cliente informó estos canales durante el setup. Esto no significa que ya estén conectados. La conexión real se confirma cuando NextforIA active cada canal."));head.appendChild(title);section.appendChild(head);var grid=el("div","setup-channel-grid");requestedSetupChannels(detail).forEach(function(item){var card=el("article","setup-channel-card");card.appendChild(el("strong",null,item.label));card.appendChild(el("small",null,item.value));card.appendChild(el("span","badge "+item.state.tone,item.state.label));card.appendChild(el("p",null,item.state.detail));grid.appendChild(card);});section.appendChild(grid);root.appendChild(section);}
function appointmentGateLabel(status){return({ready:"Listo",needs_agent:"Falta agente",needs_webhook:"Falta webhook",needs_configuration:"Falta configurar agente",needs_phone_number:"Falta número ElevenLabs",needs_phone_assignment:"Falta asignar número",needs_provider:"Falta calendario",needs_customer_connection:"Debe conectar cuenta",oauth_not_configured:"Falta OAuth",manual_connection_required:"Conexión manual",needs_number:"Falta número",needs_email:"Falta correo",not_configured:"No configurado",not_requested:"No solicitado",optional:"Opcional",disabled:"Desactivado",blocked:"Bloqueado"}[status]||status||"Pendiente");}
function renderAppointmentIntegrationSummary(root,detail){var gate=detail&&detail.appointment_integrations;if(!gate||!gate.selected)return;var section=el("section","setup-channel-summary");var head=el("div","question-toolbar");var title=el("div");title.appendChild(el("h2",null,"Readiness técnico de Appointment"));title.appendChild(el("p",null,gate.ready_for_live?"Listo para aprobación final.":"No se puede activar públicamente hasta cerrar estos estados reales."));head.appendChild(title);head.appendChild(el("span","badge "+(gate.ready_for_live?"success":"warning"),gate.ready_for_live?"Live ready":"Bloqueado"));section.appendChild(head);var grid=el("div","setup-channel-grid");[["Bot real",gate.bot&&gate.bot.status],["Calendario",gate.calendar&&gate.calendar.status],["WhatsApp",gate.whatsapp&&gate.whatsapp.status],["Llamadas",gate.calls&&gate.calls.status],["Persistencia",gate.persistence&&gate.persistence.status],["Gate live",gate.ready_for_live?"ready":"blocked"]].forEach(function(row){var card=el("article","setup-channel-card");card.appendChild(el("strong",null,row[0]));card.appendChild(el("small",null,appointmentGateLabel(row[1])));grid.appendChild(card);});section.appendChild(grid);var tenantId=detail&&detail.tenant&&detail.tenant.id;if(tenantId&&gate.calendar&&gate.calendar.status!=="ready"){var actions=el("div","setup-review-actions");var google=el("button","button","Conectar Google");google.type="button";google.addEventListener("click",function(){startSetupAppointmentCalendarConnection(tenantId,"google");});var microsoft=el("button","button","Conectar Microsoft");microsoft.type="button";microsoft.addEventListener("click",function(){startSetupAppointmentCalendarConnection(tenantId,"microsoft");});actions.append(google,microsoft);section.appendChild(actions);}if(gate.blockers&&gate.blockers.length)section.appendChild(el("p",null,"Bloqueos: "+gate.blockers.slice(0,8).join(", ")));root.appendChild(section);}
function setupReviewActionForCheck(check,tenantId){if(!check||!tenantId)return null;if(check.code==="whatsapp_connection_required")return{label:"Conectar WhatsApp",run:function(){startSetupChannelConnection(tenantId,"whatsapp");}};if(check.code==="whatsapp_connected")return{label:"Verificar WhatsApp",run:function(){verifySetupChannel(tenantId,"whatsapp");}};if(check.code==="appointment_calendar_not_connected")return{label:"Conectar calendario",run:function(){startSetupAppointmentCalendarConnection(tenantId);}};if(check.code==="appointment_integrations_ready")return{label:"Verificar calendario",run:function(){verifySetupAppointmentCalendar(tenantId);}};if(check.code==="elevenlabs_agent_not_configured"||check.code==="appointment_elevenlabs_agent_not_configured"||check.code==="calls_not_ready"||check.code==="appointment_calls_not_ready")return{label:"Configurar agente",run:function(){saveSetupReview("configure_appointment_agent","appointments");}};if(check.code==="shopify_connection_required")return{label:"Conectar Shopify",run:function(){location.href="/admin/integrations/shopify/connect/"+encodeURIComponent(tenantId);}};if(check.code==="shopify_connected")return{label:"Abrir Shopify",run:function(){location.href="/admin/integrations/shopify/connect/"+encodeURIComponent(tenantId);}};if(check.code==="required_setup_answers_missing"||check.code==="setup_not_completed"||check.code==="setup_changes_requested"||check.code==="whatsapp_number_invalid"||check.code==="whatsapp_number_mismatch")return{label:"Editar setup",run:function(){var input=document.querySelector('#setupReviewDetail [data-review-path=\"meta.whatsapp_number\"]')||document.querySelector("#setupReviewDetail [data-review-path]");if(input)input.focus();}};return null;}
function renderLaunchReadiness(root,detail){var launch=detail&&detail.launch||{},review=detail&&detail.review||{},isLive=review.status==="live",automatic=launch.automation_ready===true,canLaunch=launch.ready||automatic,tenantId=launch.tenant_id||detail&&detail.tenant&&detail.tenant.id,section=el("section","callout "+(canLaunch?"info-callout":""));section.style.marginTop="0";var wrap=el("div");wrap.appendChild(el("strong",null,isLive?"Cliente Live":(canLaunch?"Listo para aprobación final":"Antes de activar Live")));wrap.appendChild(el("p",null,isLive?"El cliente ya está activo con la configuración aprobada y los canales validados.":(automatic?"Al aprobar, Nextfor genera la configuración, crea o actualiza el agente ElevenLabs y asigna el número disponible sin exponer ElevenLabs al cliente.":(launch.ready?"Las conexiones están verificadas. La aprobación final activará el cliente.":"El sistema revisa las conexiones reales. Corrige estos puntos y luego podrás aprobar."))));var list=el("div","launch-checklist");(launch.checks||[]).forEach(function(check){var item=el("div","launch-check "+(check.type||"ok"));item.appendChild(el("span","launch-dot",check.type==="blocker"?"!":check.type==="warning"?"?":"✓"));var text=el("div");text.appendChild(el("strong",null,check.label||check.code));text.appendChild(el("span",null,check.detail||""));var action=isLive?null:setupReviewActionForCheck(check,tenantId);if(action){var btn=el("button","button",action.label);btn.type="button";btn.addEventListener("click",action.run);text.appendChild(btn);}item.appendChild(text);list.appendChild(item);});if(!(launch.checks||[]).length){var empty=el("div","launch-check warning");empty.appendChild(el("span","launch-dot","?"));var emptyText=el("div");emptyText.appendChild(el("strong",null,"Sin validación todavía"));emptyText.appendChild(el("span",null,"Abre de nuevo este setup para recalcular la checklist."));empty.appendChild(emptyText);list.appendChild(empty);}wrap.appendChild(list);section.appendChild(wrap);section.appendChild(el("span","badge "+(canLaunch?"success":"warning"),isLive?"Live":(automatic?"Automatización lista":(launch.ready?"Puede ir Live":"Faltan pasos"))));root.appendChild(section);}
function renderTestingGuide(root,detail){var review=detail&&detail.review||{};if(review.status!=="testing")return;var section=el("section","callout info-callout");section.style.marginTop="0";var wrap=el("div");wrap.appendChild(el("strong",null,"Cómo probar antes de Live"));wrap.appendChild(el("p",null,"Puede probar NextforIA o el cliente. Usen el WhatsApp/teléfono de prueba y validen conversación real antes de activar."));var list=el("ol","steps");["Enviar saludo y pregunta frecuente.","Pedir producto/servicio con precio, envío y pago.","Probar producto agotado, pedido no encontrado y fuera de cobertura.","Probar escalamiento humano cuando no haya humano disponible.","Confirmar que WhatsApp y tienda conectados son los correctos."].forEach(function(text,index){var li=el("li");li.appendChild(el("span","step-number",String(index+1)));var body=el("div");body.appendChild(el("strong",null,text));li.appendChild(body);list.appendChild(li);});wrap.appendChild(list);section.appendChild(wrap);section.appendChild(el("span","badge info","Testing"));root.appendChild(section);}
function tenantLifecycleActive(tenant){var status=String(tenant&&tenant.status||"").toLowerCase();return status==="activo"||status==="active"||status==="live";}
function renderCustomerOperations(root,detail){var tenant=detail&&detail.tenant||{},review=detail&&detail.review||{},isLive=review.status==="live",accessActive=tenantLifecycleActive(tenant),section=el("section","setup-channel-summary");var head=el("div","question-toolbar");var title=el("div");title.appendChild(el("h2",null,"Operación del cliente"));title.appendChild(el("p",null,"Desde aquí puedes corregir el setup, validar servicios, conectar canales y activar o suspender al cliente. Cada acción queda registrada."));head.appendChild(title);head.appendChild(el("span","badge "+(isLive&&accessActive?"success":isLive?"warning":"info"),isLive&&accessActive?"Live sincronizado":isLive?"Live · falta sincronizar acceso":"En preparación"));section.appendChild(head);var result=el("div","callout info-callout");result.id="setupOperationTestResult";result.style.marginTop="0";var resultText=el("div");resultText.appendChild(el("strong",null,"Prueba segura por cliente"));resultText.appendChild(el("p",null,"Revisa setup, programación, WhatsApp, Shopify e infraestructura sin enviar mensajes reales."));result.appendChild(resultText);var controls=el("div","setup-review-actions");var save=el("button","button","Guardar cambios");save.type="button";save.addEventListener("click",function(){saveSetupReview("update");});var test=el("button","button primary","Ejecutar prueba segura");test.type="button";test.addEventListener("click",function(){runSetupOperationalTest(tenant.id);});var refresh=el("button","button","Recalcular estado");refresh.type="button";refresh.addEventListener("click",function(){openSetupReview(tenant.id);});controls.append(save,test,refresh);if(isLive&&!accessActive){var sync=el("button","button primary","Sincronizar acceso Live");sync.type="button";sync.addEventListener("click",function(){syncSetupLiveAccess(tenant.id);});controls.appendChild(sync);}result.appendChild(controls);section.appendChild(result);root.appendChild(section);}
function renderSetupOperationalTest(result){var root=document.getElementById("setupOperationTestResult");if(!root)return;root.textContent="";var wrap=el("div");wrap.appendChild(el("strong",null,result.message||"Prueba terminada."));wrap.appendChild(el("p",null,String(result.passed||0)+" de "+String(result.total||0)+" controles correctos. No se enviaron mensajes reales."));var list=el("div","launch-checklist");(result.checks||[]).forEach(function(check){var item=el("div","launch-check "+(check.ok?"ok":"blocker"));item.appendChild(el("span","launch-dot",check.ok?"✓":"!"));var text=el("div");text.appendChild(el("strong",null,check.label));text.appendChild(el("span",null,check.detail||""));item.appendChild(text);list.appendChild(item);});wrap.appendChild(list);root.appendChild(wrap);root.appendChild(el("span","badge "+(result.ok?"success":"warning"),result.ok?"Operativo":"Requiere atención"));}
function runSetupOperationalTest(tenantId){var root=document.getElementById("setupOperationTestResult");if(root){root.textContent="";root.appendChild(el("div","invite-loading","Probando la operación sin enviar mensajes…"));}var testedResult=null;postJson("/admin/customer-setups/"+encodeURIComponent(tenantId)+"/test",{}).then(function(body){testedResult=body.result||{};if(setupReviewCurrent){setupReviewCurrent.onboarding=body.onboarding;setupReviewCurrent.review=body.review;setupReviewCurrent.launch=body.launch;}showToast(testedResult.ok?"Cliente operativo.":"La prueba encontró puntos por corregir.");return loadSetupReviews();}).then(function(){renderSetupOperationalTest(testedResult||{});}).catch(function(error){var current=document.getElementById("setupOperationTestResult");if(current){current.textContent="";current.appendChild(el("div","invite-loading",setupReviewErrorLabel(error.message)));}showToast(setupReviewErrorLabel(error.message));});}
function syncSetupLiveAccess(tenantId){if(!window.confirm("¿Sincronizar el acceso del cliente con su estado Live?"))return;postJson("/admin/customer-setups/"+encodeURIComponent(tenantId)+"/sync-live",{}).then(function(){showToast("Acceso Live sincronizado.");return openSetupReview(tenantId);}).then(loadSetupReviews).catch(function(error){showToast(setupReviewErrorLabel(error.message));});}
function setupReviewSearchText(row){return[String(row.company_name||""),String(row.tenant_id||""),String(row.tenant&&row.tenant.admin_email||""),String(row.setup_goal||""),String(row.review&&row.review.label||""),String(row.review&&row.review.status||"")].join(" ").toLowerCase();}
function setupReviewDateValue(row){var raw=row&&(row.updated_at||row.review&&row.review.updated_at);var time=Date.parse(raw||"");return isNaN(time)?0:time;}
function setupReviewDateText(row){var raw=row&&(row.updated_at||row.review&&row.review.updated_at)||"";return String(raw).slice(0,10)||"Sin fecha";}
function currentSetupReviewRows(){var rows=(setupReviewCache||[]).slice(),query=(document.getElementById("setupReviewSearchInput")&&document.getElementById("setupReviewSearchInput").value||"").trim().toLowerCase(),order=(document.getElementById("setupReviewSortOrder")&&document.getElementById("setupReviewSortOrder").value||"desc");if(query)rows=rows.filter(function(row){return setupReviewSearchText(row).indexOf(query)>=0;});rows.sort(function(a,b){return order==="asc"?setupReviewDateValue(a)-setupReviewDateValue(b):setupReviewDateValue(b)-setupReviewDateValue(a);});return rows;}
function setupReviewInput(question,value){var field=el("div","setup-review-field "+(question.type==="textarea"||question.type==="file"?"wide":""));var label=el("label",null,(question.label||question.id)+(question.required?" · requerido":""));var input;if(question.type==="textarea"||question.type==="file"){input=document.createElement("textarea");input.placeholder=question.type==="file"?"Pega aquí el enlace del archivo o logo entregado por el cliente.":(question.placeholder||"");}else if(question.type==="checkbox"){input=document.createElement("input");input.type="checkbox";input.checked=!!value;}else{input=document.createElement("input");input.type=question.type==="email"||question.type==="email_readonly"?"email":question.type==="tel"?"tel":question.type==="number"?"number":"text";input.value=value==null?"":String(value);input.placeholder=question.placeholder||"";}
if(question.type!=="checkbox")input.value=value==null?"":String(value);input.dataset.reviewPath=question.path;field.append(label,input);return field;}
var CUSTOMER_SERVICE_CONFIG_FIELDS=[
["business_name","Empresa","text"],["assistant_name","Nombre del asistente","text"],["objective","Objetivo","textarea"],
["business_summary","Qué ofrece","textarea"],["ideal_customer","Cliente ideal","textarea"],["value_proposition","Propuesta de valor","textarea"],
["products_services","Productos o servicios","textarea"],["frequent_questions","Preguntas frecuentes","textarea"],["important_policies","Políticas importantes","textarea"],
["payments","Pagos","textarea"],["shipping","Envíos","textarea"],["warranties","Garantías","textarea"],
["primary_country","País principal","text"],["countries_served","Países atendidos","textarea"],["tone","Tono","textarea"],
["brand_restrictions","Restricciones de marca","textarea"],["bot_instructions","Instrucciones adicionales","textarea"],
["handoff_cases","Cuándo escalar","textarea"],["handoff_contact","Contacto humano","textarea"],["support_hours","Horario humano","textarea"],
["commerce_platform","Plataforma de comercio","text"],["store_url","Tienda o sitio","text"],["catalog_ready","Estado del catálogo","text"],
["commerce_integration_intent","Intención de conexión","text"],["commerce_integration_status","Estado de conexión","text"],["commerce_access_owner","Responsable de autorización","text"],["channels","Canales","text"],
["deployment_instructions","Despliegue y QA","textarea"],
["foreign_number_location_check","Confirmar ubicación de números extranjeros","checkbox"],["orders_required","Consultar pedidos cuando aplique","checkbox"]
];
function setupConfigurationInput(definition,configuration){var key=definition[0],labelText=definition[1],type=definition[2],field=el("div","setup-review-field "+(type==="textarea"?"wide":""));field.appendChild(el("label",null,labelText));var input=document.createElement(type==="textarea"?"textarea":"input");if(type==="checkbox"){input.type="checkbox";input.checked=configuration[key]!==false;}else{input.type="text";input.value=key==="channels"?(configuration.channels||[]).join(", "):(configuration[key]==null?"":String(configuration[key]));}input.dataset.configField=key;field.appendChild(input);return field;}
function collectCustomerServiceConfiguration(){var current=cloneSetupAnswers(setupReviewCurrent&&setupReviewCurrent.onboarding&&setupReviewCurrent.onboarding.customer_service_configuration);document.querySelectorAll("#setupReviewDetail [data-config-field]").forEach(function(input){var key=input.dataset.configField;if(input.type==="checkbox")current[key]=input.checked;else if(key==="channels")current[key]=input.value.split(",").map(function(value){return value.trim().toLowerCase();}).filter(Boolean);else current[key]=input.value;});return current;}
function renderCustomerServiceConfiguration(root,configuration,review){var section=el("section","setup-config-editor");var head=el("div","question-toolbar");var title=el("div");title.appendChild(el("h2",null,"Borrador de Customer Service"));title.appendChild(el("p",null,"Generado desde el setup compartido. Appointment Setup queda reservado exclusivamente para el bot de agendamiento."));head.appendChild(title);head.appendChild(el("span","badge "+(configuration.lifecycle==="approved_for_testing"?"success":"warning"),configuration.lifecycle==="approved_for_testing"?"Aprobado para Testing":"Borrador interno"));section.appendChild(head);var fields=el("div","setup-review-fields");CUSTOMER_SERVICE_CONFIG_FIELDS.forEach(function(definition){fields.appendChild(setupConfigurationInput(definition,configuration));});section.appendChild(fields);var promptField=el("div","setup-review-field wide");promptField.appendChild(el("label",null,"Vista previa del prompt generado"));var prompt=document.createElement("textarea");prompt.readOnly=true;prompt.rows=18;prompt.value=configuration.system_prompt||"";promptField.appendChild(prompt);section.appendChild(promptField);var note=el("div","callout info-callout");note.appendChild(el("p",null,review.status==="testing"?"Esta versión ya fue aprobada para pruebas internas. Si todo está conectado, puedes activarla con Aceptar y activar Live.":"Guardar cambios mantiene el bot en Building. Aprobar lo mueve a Testing; Live requiere el botón de aceptación final."));section.appendChild(note);root.appendChild(section);}
var APPOINTMENT_CONFIG_FIELDS=[
["business_name","Empresa","text"],["assistant_name","Nombre del asistente","text"],["objective","Objetivo","textarea"],
["business_category","Categoría","text"],["target_customer","Cliente objetivo","textarea"],["business_summary","Qué hace el negocio","textarea"],["business_differentiator","Diferenciador","textarea"],
["tone","Tono","textarea"],["allowed_topics","Temas permitidos","textarea"],["forbidden_topics","Temas prohibidos","textarea"],
["services","Servicios agendables","textarea"],["business_hours","Horario general","textarea"],["staff_mode","Quién atiende","text"],["appointment_locations","Ubicaciones/modalidad","textarea"],
["availability_rules","Reglas de disponibilidad","textarea"],["required_booking_fields","Datos requeridos","textarea"],["booking_confirmation_mode","Confirmación","textarea"],
["cancellation_policy","Cancelaciones y cambios","textarea"],["no_show_policy","No-show","textarea"],["booking_payment_details","Pago de reserva","textarea"],
["calendar_provider","Proveedor calendario","text"],["calendar_email","Correo/calendario","text"],["whatsapp_number","WhatsApp","text"],["channel_email","Correo de citas","text"],["channels","Canales","text"],
["reminder_channel","Canal recordatorios","text"],["reminder_timing","Recordatorios","text"],["survey_enabled","Encuesta posterior","text"],["rescheduling_policy","Reprogramación por cambios internos","textarea"],
["escalation_triggers","Cuándo escalar","textarea"],["escalation_contact","Contacto humano","textarea"],["deployment_instructions","Despliegue y QA","textarea"],
["phone_calls_enabled","Llamadas activadas","checkbox"],["data_consent","Consentimiento de datos","checkbox"]
];
function setupAppointmentConfigurationInput(definition,configuration){var key=definition[0],labelText=definition[1],type=definition[2],field=el("div","setup-review-field "+(type==="textarea"?"wide":""));field.appendChild(el("label",null,labelText));var input=document.createElement(type==="textarea"?"textarea":"input");if(type==="checkbox"){input.type="checkbox";input.checked=configuration[key]===true;}else{input.type="text";input.value=key==="channels"?(configuration.channels||[]).join(", "):(configuration[key]==null?"":String(configuration[key]));}input.dataset.appointmentConfigField=key;field.appendChild(input);return field;}
function collectAppointmentConfiguration(){var current=cloneSetupAnswers(setupReviewCurrent&&setupReviewCurrent.onboarding&&setupReviewCurrent.onboarding.appointment_configuration);document.querySelectorAll("#setupReviewDetail [data-appointment-config-field]").forEach(function(input){var key=input.dataset.appointmentConfigField;if(input.type==="checkbox")current[key]=input.checked;else if(key==="channels")current[key]=input.value.split(",").map(function(value){return value.trim().toLowerCase();}).filter(Boolean);else current[key]=input.value;});return current;}
function renderAppointmentConfiguration(root,configuration,review){var section=el("section","setup-config-editor");var head=el("div","question-toolbar");var title=el("div");title.appendChild(el("h2",null,"Borrador de Appointment Bot"));title.appendChild(el("p",null,"Generado desde el setup de citas. No modifica Customer Service ni el bot base Luciana."));head.appendChild(title);head.appendChild(el("span","badge "+(configuration.lifecycle==="approved_for_testing"?"success":"warning"),configuration.lifecycle==="approved_for_testing"?"Aprobado para Testing":"Borrador interno"));section.appendChild(head);var ext=el("div","callout info-callout");ext.appendChild(el("p",null,"ElevenLabs: "+(configuration.external_status==="configured"?"configurado en agente real":"pendiente de configurar en agente real")+(configuration.external_agent_id?" · agent_id "+configuration.external_agent_id:"")+(configuration.external_phone_status==="configured"?" · llamadas "+configuration.external_phone_number_id:configuration.external_phone_last_error?" · llamadas pendientes":"")));if(configuration.external_last_error)ext.appendChild(el("small",null,"Último error agente: "+configuration.external_last_error));if(configuration.external_phone_last_error)ext.appendChild(el("small",null,"Último error llamadas: "+configuration.external_phone_last_error));section.appendChild(ext);var fields=el("div","setup-review-fields");APPOINTMENT_CONFIG_FIELDS.forEach(function(definition){fields.appendChild(setupAppointmentConfigurationInput(definition,configuration));});section.appendChild(fields);var promptField=el("div","setup-review-field wide");promptField.appendChild(el("label",null,"Vista previa del prompt generado"));var prompt=document.createElement("textarea");prompt.readOnly=true;prompt.rows=18;prompt.value=configuration.system_prompt||"";promptField.appendChild(prompt);section.appendChild(promptField);var note=el("div","callout info-callout");note.appendChild(el("p",null,review.status==="testing"?"Appointment está aprobado para pruebas internas. Live depende del gate real: ElevenLabs, calendario, WhatsApp, llamadas si aplica y Supabase.":"Guardar cambios mantiene Appointment en Building. Aprobar lo mueve a Testing; Live requiere aprobación final."));section.appendChild(note);root.appendChild(section);}
function setupReviewErrorLabel(code){return({unauthorized:"Tu sesión expiró. Vuelve a entrar.",tenant_not_found:"Ese cliente ya no existe.",setup_not_completed:"El cliente todavía no ha terminado el setup.",setup_must_be_approved:"Primero aprueba el setup antes de construir.",customer_service_not_selected:"Este setup no incluye Customer Service. Las citas pertenecen al bot de agendamiento.",appointment_not_selected:"Este setup no incluye Appointment Bot.",appointment_not_in_testing:"Primero aprueba Appointment para Testing.",configuration_not_building:"Primero genera el borrador del bot.",configuration_required:"La configuración está incompleta.",elevenlabs_agent_not_mapped:"Falta mapear el agent_id de ElevenLabs al tenant.",elevenlabs_template_agent_missing:"Falta configurar Luciana como plantilla de Appointment.",elevenlabs_agent_create_failed:"ElevenLabs no devolvió el nuevo agente.",elevenlabs_appointment_tool_secret_missing:"Falta el secreto de herramientas Appointment.",elevenlabs_appointment_tool_url_missing:"Falta la URL pública de herramientas Appointment.",elevenlabs_tool_create_failed:"ElevenLabs no creó las herramientas del calendario.",elevenlabs_phone_not_mapped:"Falta mapear el phone_number_id de ElevenLabs al tenant.",elevenlabs_phone_unavailable:"No hay un número libre en ElevenLabs. Importa o libera uno y vuelve a intentar.",elevenlabs_api_key_missing:"Falta ELEVENLABS_API_KEY.",elevenlabs_write_disabled:"La escritura real a ElevenLabs está apagada.",elevenlabs_client_unavailable:"No se pudo usar el cliente de ElevenLabs.",launch_confirmation_required:"Confirma la activación Live antes de continuar.",launch_blocked:"Todavía faltan pasos reales antes de activar Live.",customer_not_live:"Primero activa el cliente en Live.",catalog_unavailable:"No se pudo sincronizar el acceso del cliente.",live_sync_unavailable:"No se pudo sincronizar el acceso Live.",setup_operation_test_unavailable:"No se pudo ejecutar la prueba segura.",setup_review_unavailable:"No se pudo cargar o guardar la revisión."})[code]||"No se pudo completar la revisión.";}
function renderSetupReviewRows(){var root=document.getElementById("setupReviewRows");if(!root)return;root.textContent="";var rows=currentSetupReviewRows();if(!rows.length){var hasSearch=(document.getElementById("setupReviewSearchInput")&&document.getElementById("setupReviewSearchInput").value||"").trim();root.appendChild(el("div","invite-loading",hasSearch?"No encontré ese setup. Prueba con empresa, correo, tenant o estado.":"Todavía no hay setups de clientes."));return;}rows.forEach(function(row){var button=el("button","setup-review-row"+(setupReviewCurrent&&setupReviewCurrent.tenant&&setupReviewCurrent.tenant.id===row.tenant_id?" active":""),"");button.type="button";button.dataset.tenantId=row.tenant_id;button.appendChild(el("strong",null,row.company_name||row.tenant_id));button.appendChild(el("small",null,(row.tenant&&row.tenant.admin_email?row.tenant.admin_email+" · ":"")+setupGoalLabel(row.setup_goal)+" · "+(row.completion||0)+"% completo"));button.appendChild(el("small",null,"Fecha: "+setupReviewDateText(row)));button.appendChild(setupStatusPill(row.review&&row.review.status));button.addEventListener("click",function(){openSetupReview(row.tenant_id);});root.appendChild(button);});}
function applySetupReviewSearch(){renderSetupReviewRows();}
function applySetupReviewSort(){renderSetupReviewRows();}
function loadSetupReviews(){var root=document.getElementById("setupReviewRows");if(root){root.textContent="";root.appendChild(el("div","invite-loading","Cargando setups…"));}return fetch("/admin/customer-setups",{headers:{accept:"application/json"}}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.error||"setup_review_unavailable");return body;});}).then(function(body){setupReviewCache=body.setups||[];renderSetupReviewRows();var currentId=setupReviewCurrent&&setupReviewCurrent.tenant&&setupReviewCurrent.tenant.id;if(currentId&&setupReviewCache.some(function(row){return row.tenant_id===currentId;}))return openSetupReview(currentId);if(setupReviewCache[0])return openSetupReview(setupReviewCache[0].tenant_id);}).catch(function(error){if(root){root.textContent="";root.appendChild(el("div","invite-loading",setupReviewErrorLabel(error.message)));}showToast(setupReviewErrorLabel(error.message));});}
function openSetupReview(tenantId){var detail=document.getElementById("setupReviewDetail");if(detail){detail.textContent="";detail.appendChild(el("div","invite-loading","Abriendo setup…"));}return fetch("/admin/customer-setups/"+encodeURIComponent(tenantId),{headers:{accept:"application/json"}}).then(function(response){return response.json().then(function(body){if(!response.ok)throw new Error(body.error||"setup_review_unavailable");return body;});}).then(function(body){setupReviewCurrent=body;renderSetupReviewRows();renderSetupReviewDetail(body);}).catch(function(error){if(detail){detail.textContent="";detail.appendChild(el("div","invite-loading",setupReviewErrorLabel(error.message)));}showToast(setupReviewErrorLabel(error.message));});}
function startSetupChannelConnection(tenantId,channel){postJson("/admin/channel-connections/"+encodeURIComponent(tenantId)+"/"+encodeURIComponent(channel)+"/connect",{}).then(function(body){if(body.authorization_url)location.href=body.authorization_url;else showToast("No llegó URL de conexión.");}).catch(function(error){showToast(error.message==="channel_oauth_not_configured"?"Falta configurar OAuth de Meta.":"No se pudo iniciar la conexión.");});}
function startSetupAppointmentCalendarConnection(tenantId,provider){provider=provider==="microsoft"?"microsoft":"google";postJson("/admin/appointment-calendar-connections/"+encodeURIComponent(tenantId)+"/connect",{provider:provider}).then(function(body){if(body.authorization_url)location.href=body.authorization_url;else showToast("No llegó URL del calendario.");}).catch(function(error){showToast(error.message==="calendar_oauth_not_configured"?"Falta configurar OAuth de este calendario.":"No se pudo iniciar el calendario.");});}
function verifySetupAppointmentCalendar(tenantId){postJson("/admin/appointment-calendar-connections/"+encodeURIComponent(tenantId)+"/verify",{}).then(function(){showToast("Calendario verificado.");return openSetupReview(tenantId);}).catch(function(){showToast("No se pudo verificar el calendario.");});}
function verifySetupChannel(tenantId,channel){postJson("/admin/channel-connections/"+encodeURIComponent(tenantId)+"/"+encodeURIComponent(channel)+"/verify",{}).then(function(){showToast("Canal verificado.");return openSetupReview(tenantId);}).catch(function(error){showToast(error.message==="connection_not_found"?"Ese canal todavía no está conectado.":"No se pudo verificar el canal.");});}
function renderSetupReviewDetail(body){var root=document.getElementById("setupReviewDetail");if(!root)return;var tenant=body.tenant||{},record=body.onboarding||{},answers=record.answers||{},review=body.review||{},questions=setupReviewQuestions(body),answersApproved=setupAnswersApproved(answers),hasAppointments=answers.setup_goal==="appointments"||answers.setup_goal==="both";root.textContent="";
var head=el("div","question-toolbar");var title=el("div");title.appendChild(el("h2",null,tenant.company_name||tenant.name||tenant.id||"Cliente"));title.appendChild(el("p",null,(tenant.admin_email?tenant.admin_email+" · ":"")+"Tenant "+(tenant.id||record.tenant_id||"—")+" · "+setupGoalLabel(answers.setup_goal)));var headActions=el("div","setup-review-actions");headActions.appendChild(setupStatusPill(review.status));head.append(title,headActions);root.appendChild(head);
var quick=el("div","callout info-callout");quick.style.marginTop="0";var quickText=el("div");quickText.appendChild(el("strong",null,setupStatusHelp(review.status,answersApproved)));quickText.appendChild(el("p",null,"Edita aquí el mismo setup que ve Customer Panel. Al guardar, queda una nueva versión auditada del record del tenant."));quick.appendChild(quickText);quick.appendChild(el("span","badge info",String(record.completion||0)+"% completo"));root.appendChild(quick);
renderCustomerOperations(root,body);
renderSetupChannels(root,body);
renderAppointmentIntegrationSummary(root,body);
renderLaunchReadiness(root,body);
renderTestingGuide(root,body);
var controls=el("div","setup-review-fields");
var noteField=el("div","setup-review-field wide");noteField.appendChild(el("label",null,"Nota interna de NextforIA"));var note=document.createElement("textarea");note.id="setupReviewNote";note.placeholder="Ej: Validado por Santiago. Falta conectar calendario.";note.value=review.note||"";noteField.appendChild(note);controls.appendChild(noteField);
var changesField=el("div","setup-review-field wide");changesField.appendChild(el("label",null,"Cambios solicitados al cliente"));var changes=document.createElement("textarea");changes.id="setupReviewChanges";changes.placeholder="Escribe claro qué debe corregir el cliente. Si presionas Pedir cambios, esto es obligatorio.";changes.value=review.requested_changes||"";changesField.appendChild(changes);controls.appendChild(changesField);root.appendChild(controls);
var fields=el("div","setup-review-fields");questions.forEach(function(question){fields.appendChild(setupReviewInput(question,answerByPath(answers,question.path)));});if(!questions.length)fields.appendChild(el("div","invite-loading","El cliente aún no tiene respuestas guardadas."));root.appendChild(fields);
if(record.customer_service_configuration)renderCustomerServiceConfiguration(root,record.customer_service_configuration,review);
if(record.appointment_configuration)renderAppointmentConfiguration(root,record.appointment_configuration,review);
var actions=el("div","setup-review-actions");var save=el("button","button","Guardar revisión");save.type="button";save.addEventListener("click",function(){saveSetupReview("update");});actions.appendChild(save);
if(tenant.id){var suspendTenant=el("button","button","Suspender cliente");suspendTenant.type="button";suspendTenant.addEventListener("click",function(){setTenantStatus(tenant.id,"suspendido",tenant.company_name||tenant.name||tenant.id).then(refreshTenantViews);});var deleteTenant=el("button","button danger","Eliminar cliente");deleteTenant.type="button";deleteTenant.addEventListener("click",function(){openTenantDelete(tenant.id,tenant.company_name||tenant.name||tenant.id,review.status||tenant.status||"setup");});actions.append(suspendTenant,deleteTenant);}
if(review.status==="incomplete"||(review.status==="ready"&&!answersApproved)){var request=el("button","button","Pedir cambios");request.type="button";request.addEventListener("click",function(){saveSetupReview("request_changes");});actions.appendChild(request);if(!hasAppointments){var approve=el("button","button primary","Aprobar setup");approve.type="button";approve.addEventListener("click",function(){saveSetupReview("approve");});actions.appendChild(approve);}}
if(review.status==="ready"&&answersApproved&&(answers.setup_goal==="customer_service"||answers.setup_goal==="both")&&!record.customer_service_configuration){var build=el("button","button primary","Construir configuración Customer Service");build.type="button";build.addEventListener("click",function(){saveSetupReview("build_configuration","customer_service");});actions.appendChild(build);}
if(!hasAppointments&&review.status==="building"&&(record.customer_service_configuration||record.appointment_configuration)){var saveConfig=el("button","button primary","Guardar configuración");saveConfig.type="button";saveConfig.addEventListener("click",function(){saveSetupReview("save_configuration");});var approveConfig=el("button","button","Aprobar para Testing");approveConfig.type="button";approveConfig.addEventListener("click",function(){saveSetupReview("approve_configuration");});actions.append(saveConfig,approveConfig);}
if(!hasAppointments&&review.status==="testing"&&(record.customer_service_configuration||record.appointment_configuration)){var editConfig=el("button","button","Guardar cambios y volver a Building");editConfig.type="button";editConfig.addEventListener("click",function(){saveSetupReview("save_configuration");});actions.appendChild(editConfig);}
if(record.setup_completed&&["customer_service","appointments","both"].includes(answers.setup_goal)&&review.status!=="live"){var launchReady=body.launch&&(body.launch.ready||body.launch.automation_ready),launchLabel=body.launch&&body.launch.automation_ready?"Aprobar y activar automáticamente":(body.launch&&body.launch.ready?"Aceptar y activar Live":"No se puede activar aún"),launch=el("button","button primary",launchLabel);launch.type="button";launch.disabled=!launchReady;launch.addEventListener("click",function(){saveSetupReview("launch_live");});actions.appendChild(launch);}
root.appendChild(actions);
var history=el("div","setup-review-history");history.appendChild(el("strong",null,"Historial"));(review.history||[]).slice().reverse().forEach(function(event){history.appendChild(el("div",null,setupStatusLabel(event.status)+" · "+(event.action||"update")+" · "+(event.actor||"super_admin")+" · "+(event.at||"sin fecha")+(event.note?"\\n"+event.note:"")));});if(!(review.history||[]).length)history.appendChild(el("div",null,"Sin cambios de revisión todavía."));root.appendChild(history);}
function collectSetupReviewPayload(action,configurationBotType){if(!setupReviewCurrent)return null;var answers=cloneSetupAnswers(setupReviewCurrent.onboarding&&setupReviewCurrent.onboarding.answers);document.querySelectorAll("#setupReviewDetail [data-review-path]").forEach(function(input){setAnswerByPath(answers,input.dataset.reviewPath,input.type==="checkbox"?input.checked:input.value);});var payload={answers:answers,review_note:document.getElementById("setupReviewNote").value,requested_changes:document.getElementById("setupReviewChanges").value,action:action||"update"};if(configurationBotType)payload.configuration_bot_type=configurationBotType;if(setupReviewCurrent.onboarding&&setupReviewCurrent.onboarding.customer_service_configuration)payload.customer_service_configuration=collectCustomerServiceConfiguration();if(setupReviewCurrent.onboarding&&setupReviewCurrent.onboarding.appointment_configuration)payload.appointment_configuration=collectAppointmentConfiguration();return payload;}
function saveSetupReview(action,configurationBotType){if(!setupReviewCurrent||!setupReviewCurrent.tenant)return;var payload=collectSetupReviewPayload(action,configurationBotType);if(action==="request_changes"&&!String(payload.requested_changes||"").trim()){document.getElementById("setupReviewChanges").focus();showToast("Escribe primero qué cambios debe hacer el cliente.");return;}if(action==="launch_live"){var ok=window.confirm("¿Activar este cliente en Live? El bot quedará aprobado para operar con los canales conectados.");if(!ok)return;payload.launch_confirmed=true;payload.review_note=payload.review_note||"Aprobado para Live por Super Admin.";}var buttons=document.querySelectorAll("#setupReviewDetail button");buttons.forEach(function(button){button.disabled=true;});fetch("/admin/customer-setups/"+encodeURIComponent(setupReviewCurrent.tenant.id),{method:"PUT",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify(payload)}).then(function(response){return response.json().then(function(body){if(!response.ok){var e=new Error(body.error||"setup_review_unavailable");e.details=body.details;throw e;}return body;});}).then(function(body){setupReviewCurrent.onboarding=body.onboarding;setupReviewCurrent.review=body.review;setupReviewCurrent.launch=body.launch;setupReviewCurrent.appointment_integrations=body.appointment_integrations;renderSetupReviewDetail(setupReviewCurrent);var messages={request_changes:"Cambios solicitados. El cliente podrá volver al setup.",approve:"Setup aprobado.",build_configuration:"Borrador creado. Estado: Building.",save_configuration:"Configuración guardada. Estado: Building.",approve_configuration:"Configuración aprobada. Estado: Testing.",launch_live:"Cliente activado Live."};showToast(messages[action]||"Revisión guardada.");return loadSetupReviews();}).catch(function(error){var blockers=error.details&&error.details.blockers||[];showToast(blockers.length?("Falta: "+blockers[0].label):setupReviewErrorLabel(error.message));}).finally(function(){document.querySelectorAll("#setupReviewDetail button").forEach(function(button){button.disabled=false;});});}
function togglePlan(id,activo){postJson("/admin/catalogs/plans/"+encodeURIComponent(id)+"/toggle",{activo:activo}).then(function(){showToast(activo?"Plan activado.":"Plan desactivado. Los clientes que ya lo tienen no se ven afectados.");return loadCatalog();}).catch(function(error){showToast(catalogErrorLabel(error.message));});}
function bindCatalogForms(){var planForm=document.getElementById("planEditorForm");
if(planForm)planForm.addEventListener("submit",function(event){event.preventDefault();var button=document.getElementById("planEditorSubmit"),errorBox=document.getElementById("planEditorError");errorBox.textContent="";button.disabled=true;button.textContent="Guardando…";
postJson("/admin/catalogs/plans",{id:document.getElementById("planIdField").value||document.getElementById("planEditorOriginalId").value,nombre:document.getElementById("planNombre").value,descripcion:document.getElementById("planDescripcion").value,bot_id:document.getElementById("planBotId").value,precio_setup:0,precio_mensual:document.getElementById("planPrecioMensual").value,chats_incluidos:document.getElementById("planChats").value,beneficios:document.getElementById("planBeneficios").value,etiqueta:document.getElementById("planEtiqueta").value,orden:document.getElementById("planOrden").value})
.then(function(){closePlanEditor();showToast("Plan guardado. Ya se refleja en el Panel de Cliente.");return loadCatalog();})
.catch(function(error){errorBox.textContent=catalogErrorLabel(error.message);})
.finally(function(){button.disabled=false;button.textContent="Guardar plan";});});
var botForm=document.getElementById("botEditorForm");
if(botForm)botForm.addEventListener("submit",function(event){event.preventDefault();var button=document.getElementById("botEditorSubmit"),errorBox=document.getElementById("botEditorError");errorBox.textContent="";button.disabled=true;button.textContent="Guardando…";
postJson("/admin/catalogs/bots",{id:document.getElementById("botIdField").value,nombre:document.getElementById("botNombre").value,descripcion:document.getElementById("botDescripcion").value,orden:document.getElementById("botOrden").value})
.then(function(){closeBotEditor();showToast("Bot guardado.");return loadCatalog();})
.catch(function(error){errorBox.textContent=catalogErrorLabel(error.message);})
.finally(function(){button.disabled=false;button.textContent="Guardar bot";});});}
/* ── Suspender y eliminar clientes ─────────────────────────────────── */
var tenantCache=[];
function statusPill(status){var label={activo:"Activo",suspendido:"Suspendido",archivado:"Archivado",setup:"En configuración"}[status]||status||"—";return el("span","status-pill "+(status||"setup"),label);}
function renderTenants(){var root=document.getElementById("tenantLifecycleRows");if(!root)return;root.textContent="";
if(!tenantCache.length){root.appendChild(el("div","invite-loading","Todavía no hay clientes creados."));return;}
tenantCache.forEach(function(tenant){var line=el("div","invite-row");
var who=el("div");who.appendChild(el("strong",null,tenant.company_name));who.appendChild(el("small",null,tenant.id));line.appendChild(who);
var plan=el("div");plan.appendChild(el("strong",null,planDisplayName(tenant.plan_id)));plan.appendChild(el("small",null,planDisplayLine(tenant.plan_id,tenant.precio_mensual_contratado)+" · "+(tenant.assigned_bot_id||"sin bot")));line.appendChild(plan);
var state=el("div");state.appendChild(statusPill(tenant.status));line.appendChild(state);
var users=el("div");users.appendChild(el("strong",null,String(tenant.usuarios_activos==null?"—":tenant.usuarios_activos)));users.appendChild(el("small",null,"con acceso"));line.appendChild(users);
var actions=el("div","catalog-actions");
var view=el("button","button","Ver ficha/setup");view.type="button";view.addEventListener("click",function(){openTenantSetup(tenant.id);});actions.appendChild(view);
if(tenant.status==="suspendido"||tenant.status==="archivado"){var reactivate=el("button","button","Reactivar");reactivate.type="button";reactivate.addEventListener("click",function(){setTenantStatus(tenant.id,"activo").then(loadTenants);});actions.appendChild(reactivate);}
else{var suspend=el("button","button","Suspender");suspend.type="button";suspend.addEventListener("click",function(){setTenantStatus(tenant.id,"suspendido",tenant.company_name).then(loadTenants);});actions.appendChild(suspend);}
var remove=el("button","button danger","Eliminar");remove.type="button";remove.addEventListener("click",function(){openTenantDelete(tenant.id,tenant.company_name,tenant.status);});actions.appendChild(remove);
line.appendChild(actions);root.appendChild(line);});}
/* La tarjeta de meta se actualiza con los clientes reales, no con el registro fijo. */
var META_CLIENTES=${targetClients};
function goalCopy(count){var faltan=Math.max(0,META_CLIENTES-count);
if(count<=0)return{titular:"Tu primer cliente",frase:"Todo empieza con uno. Ese es el que enseña el camino."};
if(count>=META_CLIENTES)return{titular:"Meta cumplida",frase:"340 negocios que ya no pierden ventas de noche. Lo lograste."};
if(count===1)return{titular:"Faltan "+faltan,frase:"Ya no estás en cero. Esa era la parte difícil."};
if(count<META_CLIENTES*0.1)return{titular:"Faltan "+faltan,frase:"Los primeros son los que prueban que funciona."};
if(count<META_CLIENTES*0.34)return{titular:"Faltan "+faltan,frase:"El camino ya tiene forma. Seguí firme."};
if(count<META_CLIENTES*0.67)return{titular:"Faltan "+faltan,frase:"Pasaste el tercio. Ya sabés cómo se hace."};
if(count<META_CLIENTES*0.9)return{titular:"Faltan "+faltan,frase:"Más de la mitad atrás. La meta ya se ve."};
return{titular:"Faltan "+faltan,frase:"Estás a un empujón. No aflojes ahora."};}
/* Una sola fuente de verdad para "cuántos clientes tengo": la base de datos.
   Antes el badge del menú contaba el registro fijo del código y la tarjeta de
   meta contaba los tenants reales, así que la misma pantalla mostraba dos
   números distintos. Ahora todo se pinta desde /admin/tenants. */
function paintClientCount(count,tenants){currentClientCount=count;refreshGoalCards();
var badge=document.getElementById("clientNavCount");if(badge)badge.textContent=String(count);
var stat=document.getElementById("clientStatValue");if(stat)stat.textContent=String(count);
var statSub=document.getElementById("clientStatSub");
if(statSub){var primero=(tenants||[]).slice().sort(function(a,b){return String(a.created_at||"").localeCompare(String(b.created_at||""));})[0];
statSub.textContent=primero?("Cliente #1 · "+primero.company_name):"Registro comercial vacío";}
}
function loadTenants(){if(!customerAccessV2Enabled)return Promise.resolve();return fetch("/admin/tenants",{headers:{accept:"application/json"}}).then(function(r){return r.json().then(function(b){if(!r.ok)throw new Error(b.error||"catalog_unavailable");return b;});}).then(function(body){tenantCache=body.tenants||[];renderTenants();paintClientCount(pipelineCustomerCount(),(leadsPipeline&&leadsPipeline.customers)||[]);}).catch(function(error){var root=document.getElementById("tenantLifecycleRows");if(root){root.textContent="";root.appendChild(el("div","invite-loading",catalogErrorLabel(error.message)));}});}
function openTenantSetup(tenantId){showView("setupReview");var run=function(){return openSetupReview(tenantId);};if(!setupReviewCache||!setupReviewCache.length)return loadSetupReviews().then(run);return run();}
function setTenantStatus(tenantId,status,companyName){if(status==="suspendido"){var ok=window.confirm('¿Suspender "'+(companyName||tenantId)+'"? Perderá acceso al panel, pero sus datos quedan guardados.');if(!ok)return Promise.resolve();}
var mensajes={activo:"Cliente reactivado. Ya puede entrar a su panel.",suspendido:"Cliente suspendido. Perdió el acceso, los datos quedan intactos.",archivado:"Cliente archivado."};
return postJson("/admin/tenants/"+encodeURIComponent(tenantId)+"/status",{status:status}).then(function(){showToast(mensajes[status]||"Estado actualizado.");}).catch(function(error){showToast(catalogErrorLabel(error.message));});}
function openTenantDelete(tenantId,companyName,status){document.getElementById("tenantDeleteId").value=tenantId;
document.getElementById("tenantDeleteLead").textContent='Vas a eliminar "'+companyName+'" y todos sus datos.';
document.getElementById("tenantDeleteStatusNote").textContent=status==="suspendido"||status==="archivado"?"El cliente ya está sin acceso. Se borrará después del respaldo.":"No necesitas suspenderlo manualmente: Super Admin lo hará antes de borrar.";
document.getElementById("tenantDeleteConfirm").value="";
document.getElementById("tenantDeleteFinal").checked=false;
document.getElementById("tenantDeleteError").textContent="";
document.getElementById("tenantDeleteSubmit").disabled=true;
document.getElementById("tenantDeleteForm").dataset.companyName=companyName;
openModal("tenantDeleteModal","tenantDeleteConfirm");}
function closeTenantDelete(){closeModal("tenantDeleteModal");}
function refreshTenantDeleteGate(){var form=document.getElementById("tenantDeleteForm");if(!form)return;
var nameOk=document.getElementById("tenantDeleteConfirm").value.trim()===String(form.dataset.companyName||"").trim();
var finalOk=document.getElementById("tenantDeleteFinal").checked;
document.getElementById("tenantDeleteSubmit").disabled=!(nameOk&&finalOk);}
function downloadBackup(payload,tenantId){try{var blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});var url=URL.createObjectURL(blob);var link=document.createElement("a");link.href=url;link.download="respaldo-"+tenantId+".json";document.body.appendChild(link);link.click();document.body.removeChild(link);setTimeout(function(){URL.revokeObjectURL(url);},1000);}catch(e){}}
function bindTenantDelete(){var form=document.getElementById("tenantDeleteForm");if(!form)return;
document.getElementById("tenantDeleteConfirm").addEventListener("input",refreshTenantDeleteGate);
document.getElementById("tenantDeleteFinal").addEventListener("change",refreshTenantDeleteGate);
form.addEventListener("submit",function(event){event.preventDefault();var tenantId=document.getElementById("tenantDeleteId").value,button=document.getElementById("tenantDeleteSubmit"),errorBox=document.getElementById("tenantDeleteError");errorBox.textContent="";button.disabled=true;button.textContent="Eliminando…";
postJson("/admin/tenants/"+encodeURIComponent(tenantId)+"/delete",{company_name_confirmacion:document.getElementById("tenantDeleteConfirm").value,confirmacion_final:true})
.then(function(body){if(body.backup)downloadBackup(body.backup,tenantId);closeTenantDelete();showToast("Cliente eliminado. Se descargó el respaldo.");return refreshTenantViews();})
.catch(function(error){errorBox.textContent=catalogErrorLabel(error.message);button.disabled=false;})
.finally(function(){button.textContent="Eliminar definitivamente";});});}
try{var url=new URL(location.href),requested=url.searchParams.get("view"),requestedTenant=url.searchParams.get("tenant_id");if(requested&&titles[requested])showView(requested);if(url.searchParams.has("key")){url.searchParams.delete("key");history.replaceState(null,"",url.pathname+url.search+url.hash);}}catch(e){}loadHealth();loadBotOps();loadPlatformGoals().catch(function(){});loadLeadPipeline();loadQuestionnaire();loadSetupReviews().then(function(){try{var u=new URL(location.href),tenant=u.searchParams.get("tenant_id");if(tenant)openSetupReview(tenant);}catch(e){}});if(channelConnectionsV1Enabled)loadAdminChannels();if(customerAccessV2Enabled){loadCustomerInvitations();bindCatalogForms();bindTenantDelete();loadCatalog();loadTenants();}if(paymentsV1Enabled)loadBillingAdmin();
</script></body></html>`);
}

module.exports = renderSuperAdminPanel;
