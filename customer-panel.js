const customerAppointments = require("./customer-appointments");
const customerBotConfiguration = require("./customer-bot-configuration");

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function customerPanelInitials(value) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map(function (word) { return word.charAt(0); }).join("") || "NX").toUpperCase().slice(0, 3);
}

function customerPanelContext(options) {
  const tenant = options.tenantContext && typeof options.tenantContext === "object" ? options.tenantContext : null;
  if (!tenant) {
    return {
      v2: false,
      businessName: "Tu empresa",
      initials: "NX",
      avatarInitials: "NX",
      planId: "",
      planName: "Asignado",
      assignedBotId: "",
      assignedBotName: "Bot asignado",
      customerSetupCompleted: false,
      support: false,
      appointments: false,
      referralCode: "NEXTFORIA"
    };
  }
  const businessName = String(tenant.company_name || tenant.name || tenant.id || "Tu empresa").trim();
  const planId = String(tenant.plan_id || "").trim().toLowerCase();
  const rawAssignedBotId = String(tenant.assigned_bot_id || "").trim().toLowerCase();
  const supportOnlyPlans = ["nextfor-uno", "nextfor-aura"];
  const appointmentOnlyPlans = ["nextfor-tempo"];
  const combinedPlans = ["nextfor-atlas"];
  const assignedBotId = supportOnlyPlans.includes(planId)
    ? "atencion-cliente"
    : (appointmentOnlyPlans.includes(planId) ? "agendamiento" : (combinedPlans.includes(planId) ? "both" : rawAssignedBotId));
  const planNames = { starter: "Starter", growth: "Growth", scale: "Scale", "nextfor-uno": "Nextfor Uno", "nextfor-aura": "Nextfor Aura", "nextfor-tempo": "Nextfor Tempo", "nextfor-atlas": "Nextfor Atlas" };
  const botNames = { "atencion-cliente": "Atención al cliente", agendamiento: "Agendamiento", commerce: "Commerce", duo: "Atención al cliente + Agendamiento", both: "Atención al cliente + Agendamiento" };
  const supportBots = ["atencion-cliente", "commerce", "duo", "both"];
  const appointmentBots = ["agendamiento", "duo", "both"];
  const referralCode = businessName.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 14) || "NEXTFORIA";
  return {
    v2: true,
    businessName,
    initials: customerPanelInitials(businessName),
    avatarInitials: customerPanelInitials(businessName),
    planId,
    planName: planNames[planId] || planId || "Asignado",
    assignedBotId,
    assignedBotName: botNames[assignedBotId] || assignedBotId || "Bot asignado",
    customerSetupCompleted: !!options.customerSetupCompleted,
    support: supportBots.includes(assignedBotId),
    appointments: appointmentBots.includes(assignedBotId),
    referralCode
  };
}

const PANEL_ICONS = {
  resumen: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>',
  conversaciones: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path></svg>',
  calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg>',
  bot: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>',
  edit: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>',
  intervencion: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>',
  plan: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>',
  channels: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12h8"></path><path d="M12 8v8"></path><circle cx="5" cy="12" r="3"></circle><circle cx="19" cy="12" r="3"></circle><circle cx="12" cy="5" r="3"></circle><circle cx="12" cy="19" r="3"></circle></svg>',
  package: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"></path><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="M3.3 7 12 12l8.7-5"></path><path d="M12 22V12"></path></svg>',
  gift: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"></rect><path d="M12 8v13"></path><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"></path><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"></path></svg>',
  logout: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" x2="9" y1="12" y2="12"></line></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  sparkles: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"></path></svg>',
  settings: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"></path><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88L4.2 6.56a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.14.38.37.72.68 1 .3.26.7.4 1.1.4H21a2 2 0 1 1 0 4h-.09c-.4 0-.8.14-1.1.4-.2.18-.34.38-.41.6Z"></path></svg>',
  clock: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
  instagram: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line></svg>',
  bell: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 21a2 2 0 0 0 3.4 0"></path><path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 9h18c0-2-3-2-3-9"></path></svg>'
};

module.exports = function renderCustomerPanel(res, options) {
  const auth = options.auth || { name: "Panel", role: "viewer" };
  const capabilities = options.capabilities || {};
  const dataPath = options.dataPath || "/admin/panel/data?limit=500";
  const healthPath = options.healthPath === null ? "" : (options.healthPath || "/admin/panel/health");
  const setupPath = options.setupPath === null ? "" : (options.setupPath || "/admin/bot-setup");
  const retargetingPath = options.retargetingPath || "/admin/retargeting";
  const appointmentsPath = options.appointmentsPath || "/admin/panel/appointments-data";
  const loginPath = options.loginPath === null ? "" : (options.loginPath || "/admin/panel");
  const demoMode = !!options.demoMode;
  const panelContext = customerPanelContext(options);
  const botVersion = options.botVersion || "dev";
  const paymentGateRequired = !!options.paymentGateRequired;
  const channelConnectionsV1Enabled = !!options.channelConnectionsV1Enabled && !paymentGateRequired;
  const channelConnectionsDemo = options.channelConnectionsDemo || null;
  const requestedTab = ["summary", "conversations", "human", "appointments", "plan", "channels", "setup", "notifications", "retargeting", "tests"].includes(options.initialTab)
    ? options.initialTab
    : "summary";
  const requestedInitialTab = paymentGateRequired ? "plan" : (requestedTab === "human" ? "conversations" : requestedTab);
  const initialTab = panelContext.v2 && panelContext.appointments && ["summary", "conversations", "retargeting"].includes(requestedInitialTab)
    ? "appointments"
    : (panelContext.v2 && panelContext.support && requestedInitialTab === "appointments" ? "summary" : requestedInitialTab);
  // El primer pintado del servidor debe coincidir con lo que showTab(INITIAL_TAB)
  // dejaría: si no, el header y el módulo saltan al cargar (el "parpadeo").
  // Estos mapas son un espejo exacto de los del script de cliente (showTab).
  const summarySubtitle = "Resultados de " + (panelContext.v2 ? panelContext.assignedBotName : "tu bot de atención") + " · Últimos 7 días";
  const PAGE_TITLES = { summary: "Resumen", conversations: "Conversaciones", appointments: "Citas", plan: "Mi plan", channels: "Finaliza el entrenamiento", setup: "Configuración de tu Nextfor IA", notifications: "Notificaciones Nextfor", retargeting: "Seguimientos comerciales", tests: "Pruebas" };
  const PAGE_SUBTITLES = { summary: summarySubtitle, conversations: "La IA atiende y te deja solo lo que necesita de ti.", appointments: "Tu agenda llenándose, sin perseguir confirmaciones.", plan: "Plan, módulos y consumo", channels: "Dile a tu Nextfor dónde debe atender", setup: "Tu negocio, tu voz y tus reglas en un solo lugar", notifications: "Mejoras, solicitudes y avisos importantes para tu empresa.", retargeting: "Cola segura, aprobaciones, cancelaciones y auditoría", tests: "Herramientas seguras para validar el bot." };
  const initialTitle = PAGE_TITLES[initialTab] || "Conversaciones";
  const initialSubtitle = PAGE_SUBTITLES[initialTab] || PAGE_SUBTITLES.conversations;
  const SECTION_BY_TAB = { summary: "panel-summary", conversations: "panel-inbox", appointments: "panel-appointments", plan: "panel-plan", channels: "panel-channels", setup: "panel-setup", notifications: "panel-notifications", retargeting: "panel-retargeting", tests: "panel-tests" };
  const initialSection = SECTION_BY_TAB[initialTab] || "panel-inbox";
  const viewClass = function (id) { return "view" + (id === initialSection ? " active" : ""); };
  const toolbarHidden = ["plan", "appointments", "channels", "setup", "notifications", "retargeting"].includes(initialTab);
  const initialChannel = "all";
  const canRunTests = !!capabilities.run_tests;
  const planNav = "<button class=\"navItem\" id=\"nav-plan\" type=\"button\" onclick=\"showTab('plan')\"><span class=\"navIcon\">" + PANEL_ICONS.plan + "</span><span>Mi plan</span></button>";
  const planMobileNav = "<button id=\"mnav-plan\" data-bot=\"account\" type=\"button\" onclick=\"showTab('plan')\"><span class=\"mobileNavIcon\">" + PANEL_ICONS.plan + "</span><span>Mi plan</span></button>";
  const channelsNav = channelConnectionsV1Enabled ? "<button class=\"navItem\" id=\"nav-channels\" type=\"button\" onclick=\"showTab('channels')\"><span class=\"navIcon\">" + PANEL_ICONS.channels + "</span><span>Conectar canales</span></button>" : "";
  const channelsMobileNav = channelConnectionsV1Enabled ? "<button id=\"mnav-channels\" data-bot=\"account\" type=\"button\" onclick=\"showTab('channels')\"><span class=\"mobileNavIcon\">" + PANEL_ICONS.channels + "</span><span>Canales</span></button>" : "";
  const notificationsNav = "<button class=\"navItem\" id=\"nav-notifications\" type=\"button\" onclick=\"showTab('notifications')\"><span class=\"navIcon\">" + PANEL_ICONS.bell + "</span><span>Notificaciones</span><span class=\"navBadge hot\" id=\"navNotificationCount\" style=\"display:none\"></span></button>";
  const notificationsMobileNav = "<button id=\"mnav-notifications\" data-bot=\"account\" type=\"button\" onclick=\"showTab('notifications')\"><span class=\"mobileNavIcon\">" + PANEL_ICONS.bell + "</span><span>Avisos</span><span class=\"navBadge hot\" id=\"mnavNotificationCount\" style=\"display:none\"></span></button>";
  const emojiButtons = ["😀", "😂", "🥰", "😍", "😊", "😉", "😄", "🙌", "👍", "👌", "👏", "🙏", "🎉", "❤️", "💙", "💚", "🔥", "✨", "⭐", "✅", "🤝", "💬", "🛍️", "🎁", "📦", "🚚", "💳", "💰", "📍", "⏰", "☎️", "👋"].map(function (emoji) {
    return '<button type="button" data-emoji="' + emoji + '" onclick="insertEmoji(this.dataset.emoji)" aria-label="Insertar ' + emoji + '">' + emoji + '</button>';
  }).join("");
  const supportBotName = panelContext.v2 ? panelContext.assignedBotName : "Atención al cliente";
  const appointmentBotName = panelContext.v2 ? panelContext.assignedBotName : "Agendamiento";
  const supportBotButton = !paymentGateRequired && panelContext.support ? '<button class="botCard active" id="bot-support" type="button" onclick="selectBot(\'support\')"><span class="botIcon">' + PANEL_ICONS.bot + '</span><span class="botMeta"><strong>' + escapeHtml(supportBotName) + '</strong><span>Chatbot 24/7</span></span><span class="botDot"></span></button>' : "";
  const appointmentBotButton = !paymentGateRequired && panelContext.appointments ? '<button class="botCard" id="bot-appointments" type="button" onclick="selectBot(\'appointments\')"><span class="botIcon">' + PANEL_ICONS.calendar + '</span><span class="botMeta"><strong>' + escapeHtml(appointmentBotName) + '</strong><span>Citas y recordatorios</span></span><span class="botDot"></span></button>' : "";
  const mobileSupportBotButton = !paymentGateRequired && panelContext.support ? '<button class="active" id="mobile-bot-support" type="button" onclick="selectBot(\'support\')"><span class="botDot"></span><span>' + escapeHtml(supportBotName) + '</span></button>' : "";
  const mobileAppointmentBotButton = !paymentGateRequired && panelContext.appointments ? '<button' + (panelContext.v2 ? ' class="active"' : "") + ' id="mobile-bot-appointments" type="button" onclick="selectBot(\'appointments\')"><span class="botDot"></span><span>' + escapeHtml(appointmentBotName) + '</span></button>' : "";
  const mobileAppointmentTabs = panelContext.appointments && !paymentGateRequired
    ? '<button id="mnav-appointments" data-bot="appointments" data-appt-mobile="agenda" type="button" onclick="showTab(\'appointments\');showAppointmentSection(\'agenda\')"><span class="mobileNavIcon">' + PANEL_ICONS.calendar + '</span><span>Agenda</span></button><button id="mnav-appointment-chats" data-bot="appointments" data-appt-mobile="chats" type="button" onclick="showTab(\'appointments\');showAppointmentSection(\'chats\')"><span class="mobileNavIcon">' + PANEL_ICONS.conversaciones + '</span><span>Chats</span><span class="navBadge hot" id="mnavApptChatCount"></span></button>'
    : "";
  const appointmentNav = panelContext.appointments && !paymentGateRequired
    ? '<nav class="nav" id="navAppointments" style="display:' + (initialTab === "appointments" ? "grid" : "none") + '" aria-label="Secciones de Agendamiento"><button class="navItem active" id="nav-appointments" data-appt-nav="agenda" type="button" onclick="showTab(\'appointments\');showAppointmentSection(\'agenda\')"><span class="navIcon">' + PANEL_ICONS.calendar + '</span><span>Citas</span></button><button class="navItem" data-appt-nav="chats" type="button" onclick="showTab(\'appointments\');showAppointmentSection(\'chats\')"><span class="navIcon">' + PANEL_ICONS.conversaciones + '</span><span>Conversaciones</span><span class="navBadge hot" id="navApptChatCount"></span></button><button class="navItem" data-appt-nav="reminders" type="button" onclick="showTab(\'appointments\');showAppointmentSection(\'reminders\')"><span class="navIcon">' + PANEL_ICONS.clock + '</span><span>Recordatorios</span></button></nav>'
    : "";
  const appointmentPanelSection = panelContext.appointments && !paymentGateRequired
    ? '<section class="' + viewClass("panel-appointments") + '" id="panel-appointments">' + customerAppointments.markup + '</section>'
    : "";
  const appointmentClientScript = panelContext.appointments && !paymentGateRequired ? customerAppointments.clientScript : "";
  const activeBotCount = (panelContext.support ? 1 : 0) + (panelContext.appointments ? 1 : 0);
  const assignedModuleDescription = panelContext.appointments
    ? "Gestiona citas, confirmaciones y recordatorios desde un único módulo."
    : "Centraliza resultados y conversaciones de los canales conectados en una sola bandeja.";
  const assignedModuleAction = panelContext.appointments ? "showTab('appointments')" : "showChannel('all')";
  const assignedModuleCard = '<article class="serviceCard active"><span class="serviceState">Activo</span><h4>Bot de ' + escapeHtml(panelContext.assignedBotName) + '</h4><p>' + escapeHtml(assignedModuleDescription) + '</p><button class="ghostBtn" type="button" onclick="' + assignedModuleAction + '">Ver módulo</button></article>';
  const planModuleCards = panelContext.v2 ? assignedModuleCard : '<article class="serviceCard active"><span class="serviceState">Activo</span><h4>Bot de atención al cliente</h4><p>Un solo módulo con resultados y conversaciones de WhatsApp, Instagram y Messenger, diferenciadas por canal dentro de la bandeja.</p><button class="ghostBtn" type="button" onclick="showChannel(\'all\')">Ver módulo</button></article><article class="serviceCard"><span class="serviceState off">No activo</span><h4>Agendamiento de citas</h4><p>Se activará como módulo independiente cuando el bot de citas esté contratado y funcionando.</p><button class="ghostBtn" type="button" onclick="showTab(\'appointments\')">Ver estructura</button></article>';
  const assignedPlanCard = '<article class="planOption"><span class="planBadge">Tu plan actual</span><h4>Bot ' + escapeHtml(panelContext.assignedBotName) + '</h4><p>' + escapeHtml(assignedModuleDescription) + '</p><div class="priceLine"><strong>Plan ' + escapeHtml(panelContext.planName) + '</strong><span>Configuración administrada por NextforIA</span></div><ul class="benefits"><li><span class="benefitIcon">' + PANEL_ICONS.check + '</span>Módulo asignado a tu empresa</li><li><span class="benefitIcon">' + PANEL_ICONS.check + '</span>Datos aislados de otros clientes</li><li><span class="benefitIcon">' + PANEL_ICONS.check + '</span>Acceso seguro para tu equipo</li></ul><div class="planActions"><button class="primaryBtn" type="button" disabled>Plan activo</button></div></article>';
  const planData = panelContext.v2 ? {
    nombre: "Bot " + panelContext.assignedBotName,
    estado: "Activo",
    mensualidad: "Plan " + panelContext.planName,
    renovacion: "Servicio activo",
    chatsIncluidos: 0,
    chatsConsumidos: 0,
    rescatesFrecuentes: false,
    referidos: { codigo: panelContext.referralCode, count: 0, mesesGanados: 0 }
  } : {
    nombre: "Bot Atención al cliente",
    estado: "Activo",
    mensualidad: "$299.900/mes",
    renovacion: "Renueva el 1 de agosto",
    chatsIncluidos: 500,
    chatsConsumidos: 410,
    rescatesFrecuentes: true,
    referidos: { codigo: panelContext.referralCode, count: 0, mesesGanados: 0 }
  };

  res.status(200).setHeader("content-type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nextfor IA · ${escapeHtml(panelContext.businessName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap" rel="stylesheet">
<style>
:root{
  --font-display:"Sora",sans-serif;
  --font-body:"Plus Jakarta Sans",sans-serif;
  --navy-950:#061226;
  --navy-900:#071832;
  --navy-800:#0B2145;
  --navy-700:#123466;
  --cyan-500:#12A8F4;
  --cyan-400:#25BFFF;
  --cyan-100:#E9F8FF;
  --cyan-050:#F3FBFF;
  --green-500:#16A76A;
  --green-100:#E7F8F0;
  --amber-500:#F5A524;
  --amber-100:#FFF1D6;
  --slate-900:#081634;
  --slate-700:#33425E;
  --slate-500:#78869F;
  --slate-300:#CBD5E1;
  --slate-200:#E2E8F0;
  --slate-100:#F1F5F9;
  --bg:#F6F8FC;
  --card:#FFFFFF;
  --line:#DCE5F1;
  --shadow:0 12px 30px rgba(8,22,52,.08);
  --shadow-soft:0 8px 22px rgba(8,22,52,.06);
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-body),-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--slate-900);line-height:1.4}
button,input,textarea{font:inherit}
button{cursor:pointer}
.app{min-height:100vh;display:grid;grid-template-columns:250px minmax(0,1fr)}
.mobileTop,.mobileModuleBar,.mobileBotSwitch,.mobileTabbar,.mobileBack,.mobilePeriodShell{display:none}
.sidebar{height:100vh;position:sticky;top:0;background:linear-gradient(180deg,var(--navy-950),var(--navy-900));color:#fff;padding:24px 18px;display:flex;flex-direction:column;gap:24px;overflow-y:auto;scrollbar-width:thin}
.ravLogo{width:48px;height:48px;border-radius:13px;background:linear-gradient(145deg,var(--cyan-400),var(--cyan-500));display:grid;place-items:center;font-size:19px;font-weight:800;letter-spacing:-.04em;box-shadow:0 10px 22px rgba(18,168,244,.22);flex:0 0 auto;overflow:hidden}.ravLogo img{width:100%;height:100%;object-fit:cover}
.brand{width:100%;border:0;background:transparent;color:#fff;cursor:pointer;text-align:left;display:flex;align-items:center;gap:13px;padding:8px;border-radius:14px;transition:background .15s}
.brand:hover{background:rgba(255,255,255,.05)}
.brand h1{color:#fff;font-family:var(--font-display);font-size:22px;line-height:1.08;font-weight:800;letter-spacing:-.035em}
.brand p{margin-top:4px;color:#96A7C4;font-size:11.5px;font-weight:600}
.brand p span{color:var(--cyan-400)}
.brandInfo{flex:1;min-width:0}
.brandEdit{opacity:0;color:#93A4C2;display:inline-flex;flex:0 0 auto;transition:opacity .15s}
.brand:hover .brandEdit{opacity:1}
.brandEdit svg{width:17px;height:17px}
.botSwitch{display:grid;gap:8px}
.botSwitchTitle,.footTitle{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:#6F819F;font-weight:800;padding:0 6px}
.botCard{display:flex;align-items:center;gap:11px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:inherit;border-radius:14px;padding:11px 12px;cursor:pointer;text-align:left;transition:border-color .15s,background .15s}
.botCard:hover{background:rgba(255,255,255,.06)}
.botCard.active{background:rgba(18,168,244,.14);border-color:rgba(37,191,255,.35)}
.botIcon{width:34px;height:34px;flex:0 0 auto;border-radius:10px;background:rgba(255,255,255,.06);color:#CFE0F5;display:grid;place-items:center}
.botCard.active .botIcon{background:linear-gradient(145deg,var(--cyan-400),var(--cyan-500));color:#fff}
.botIcon svg{width:18px;height:18px}
.botMeta{flex:1;min-width:0;display:grid;gap:2px}
.botMeta strong{font-size:13.5px;color:#fff;font-weight:800;line-height:1.15}
.botMeta span{font-size:11px;color:#8FA1BE;font-weight:700}
.botDot{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:#22C778;box-shadow:0 0 0 3px rgba(34,199,120,.16)}
.nav{display:grid;gap:8px}
.navItem{height:46px;border:0;border-radius:14px;background:transparent;color:#AAB8D0;padding:0 16px;display:grid;grid-template-columns:26px 1fr auto;align-items:center;gap:12px;text-align:left;font-weight:800;font-size:15px}
.navItem:hover{background:rgba(255,255,255,.06);color:#fff}
.navItem.active{background:linear-gradient(135deg,var(--cyan-400),var(--cyan-500));color:#fff;box-shadow:0 10px 22px rgba(18,168,244,.22)}
.navItem.logoutItem{color:#DDE8F8}
.navItem.logoutItem:hover{background:rgba(239,78,78,.12);color:#fff}
.navIcon{font-size:22px;line-height:1;opacity:.92;display:inline-flex;align-items:center;justify-content:center}
.navIcon svg{width:20px;height:20px;display:block}
.navBadge{min-width:26px;height:22px;border-radius:999px;background:rgba(148,163,184,.35);color:#fff;display:grid;place-items:center;font-size:12px;padding:0 7px}
.navBadge.hot{background:var(--amber-500);color:#3C2600}
.sidebarFoot{margin-top:auto;display:flex;flex-direction:column;gap:6px;padding-top:14px;border-top:1px solid rgba(255,255,255,.09)}
.footTitle{padding-bottom:4px}
.sidebarFoot .whatsappCard{margin-top:10px}
.panelVersion{margin-top:8px;color:rgba(221,232,248,.54);font-size:10.5px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;text-align:center}
.panelVersionFixed{position:fixed;right:18px;bottom:10px;z-index:30;border:1px solid rgba(220,229,241,.8);border-radius:999px;background:rgba(255,255,255,.86);backdrop-filter:blur(10px);color:#74839C;font-size:10px;font-weight:850;letter-spacing:.05em;padding:6px 10px;box-shadow:0 8px 18px rgba(8,22,52,.08)}
.botsActive{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;color:#9DF0C8;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.08)}
.whatsappCard{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);border-radius:16px;padding:18px 16px;color:#EAF2FF}
.whatsappCard strong{display:flex;align-items:center;gap:9px;font-size:15px}
.whatsappCard p{margin-top:8px;color:#92A2BE;font-size:13px;font-weight:600}
.statusDot{width:9px;height:9px;border-radius:50%;background:#22C778;box-shadow:0 0 0 4px rgba(34,199,120,.14)}
.profileModal{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;padding:20px}
.profileModal.open{display:flex}
.profileScrim{position:absolute;inset:0;background:rgba(6,15,34,.55);backdrop-filter:blur(4px)}
.profileModal .profileCard{position:relative;width:min(650px,100%);max-height:calc(100vh - 36px);overflow:auto;background:#fff;border:0;border-radius:24px;padding:28px;box-shadow:0 40px 90px -25px rgba(6,15,34,.5)}
.profileHead{display:flex;align-items:center;justify-content:space-between}
.profileHead h3{font-family:var(--font-display);font-size:24px;font-weight:900;color:var(--navy-900)}
.profileClose{border:0;background:var(--slate-100);width:40px;height:40px;border-radius:12px;font-size:22px;color:var(--slate-700);cursor:pointer}
.profileHint{margin-top:4px;color:var(--slate-700);font-size:13px;font-weight:600}
.profileLogoRow{display:flex;align-items:center;gap:16px;margin:18px 0}
.profileLogo{width:88px;height:88px;flex:0 0 auto;border-radius:20px;background:linear-gradient(145deg,var(--cyan-400),var(--cyan-500));display:grid;place-items:center;color:#fff;font-size:24px;font-weight:900;overflow:hidden}.profileLogo img{width:100%;height:100%;object-fit:cover}
.profileUpload{min-height:88px;flex:1;display:flex;align-items:center;gap:12px;border:1.5px dashed #9FDDF8;background:#F4FBFF;border-radius:16px;padding:14px 16px;font-size:13px;font-weight:800;color:var(--navy-900);cursor:pointer;transition:.16s}
.profileUpload:hover,.profileUpload.drag{border-color:var(--cyan-500);background:#EAF8FF;box-shadow:0 0 0 3px rgba(0,160,240,.12)}.profileUpload svg{width:20px;height:20px;color:var(--cyan-600)}.profileUpload span small{display:block;margin-top:4px;color:var(--slate-500);font-size:11px;font-weight:650}
.profileGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.profileField{display:grid;gap:6px;margin-bottom:0}.profileField.wide{grid-column:1/-1}
.profileField span{font-size:13px;font-weight:700;color:var(--slate-700)}
.profileField input{height:46px;border:1.5px solid var(--line);border-radius:12px;padding:0 14px;font-size:15px;font-family:inherit;color:var(--navy-900)}
.profileField input[readonly]{background:var(--slate-100);color:var(--slate-500);cursor:not-allowed}
.profileField input:focus{outline:3px solid rgba(18,168,244,.28);border-color:var(--cyan-500)}
.profileStatus{min-height:20px;margin-top:12px;color:var(--green-600);font-size:12px;font-weight:800}.profileStatus.error{color:#BE3F24}
.profileActions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}
.profileBtn{height:44px;padding:0 18px;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;border:0}
.profileBtn.ghost{background:var(--slate-100);color:var(--slate-700)}
.profileBtn.primary{background:linear-gradient(135deg,var(--cyan-400),var(--cyan-500));color:#fff}
.profileBtn:disabled{opacity:.55;cursor:not-allowed}
.profileSecurity{margin-top:20px;padding-top:18px;border-top:1px solid var(--line)}.profileSecurityHead{display:flex;align-items:center;justify-content:space-between;gap:14px}.profileSecurityHead strong{display:block;color:var(--navy-900);font-size:15px}.profileSecurityHead p{margin-top:3px;color:var(--slate-500);font-size:11.5px}.profilePassword{display:none;margin-top:14px}.profilePassword.open{display:block}.profilePassword .profileActions{margin-top:14px}
@media(max-width:640px){.profileModal{padding:10px;align-items:flex-end}.profileModal .profileCard{width:100%;max-height:92vh;border-radius:24px 24px 0 0;padding:22px}.profileHead h3{font-size:21px}.profileGrid{grid-template-columns:1fr}.profileField.wide{grid-column:auto}.profileLogoRow{align-items:stretch}.profileLogo{width:78px;height:78px}.profileUpload{min-height:78px;padding:12px}.profileUpload span small{display:none}.profileActions{display:grid;grid-template-columns:1fr 1fr}.profileActions .profileBtn{padding:0 10px}.profileSecurityHead{align-items:flex-start}}
.main{min-width:0}
.topbar{height:72px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:18px;padding:0 28px;position:sticky;top:0;z-index:4}
.pageTitle h2{font-size:30px;line-height:1;font-weight:900;letter-spacing:-.05em}
.pageTitle p{margin-top:8px;color:var(--slate-500);font-size:15px;font-weight:600}
.toolbar{display:flex;align-items:center;gap:16px}
.periods{display:flex;background:#EDF2F8;border-radius:18px;padding:4px}
.periods button{height:42px;border:0;border-radius:14px;background:transparent;color:#71809B;padding:0 18px;font-size:16px;font-weight:800}
.periods button.active{background:#fff;color:var(--slate-900);box-shadow:var(--shadow-soft)}
.avatar{width:48px;height:48px;border-radius:999px;background:var(--navy-900);color:#fff;display:grid;place-items:center;font-size:17px;font-weight:900}
.content{padding:28px;max-width:1320px}
.view{display:none}
.view.active{display:block}
.summary{display:grid;grid-template-columns:1.7fr 1fr;gap:22px}
.iaBanner{grid-column:1/-1;border:1px solid #AEE4FF;background:var(--cyan-100);border-radius:20px;padding:20px 26px;display:flex;align-items:center;gap:20px;box-shadow:0 10px 35px rgba(18,168,244,.08)}
.iaIcon{width:54px;height:54px;border-radius:14px;background:linear-gradient(145deg,var(--cyan-400),var(--cyan-500));color:#fff;display:grid;place-items:center;font-size:26px;font-weight:900;flex:0 0 auto}
.iaBanner p{font-size:20px;line-height:1.35;color:var(--navy-900);font-weight:500}
.iaBanner strong{font-weight:900}
.setupReminder{grid-column:1/-1;border:1px solid #BEE6FB;background:linear-gradient(135deg,#F3FBFF,#E8F7FF);border-radius:20px;padding:18px 22px;display:grid;grid-template-columns:auto minmax(0,1fr) minmax(180px,240px) auto;align-items:center;gap:18px;box-shadow:0 10px 28px rgba(18,168,244,.08)}
.setupReminder[hidden]{display:none}
.setupReminderIcon{width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,var(--cyan-400),var(--cyan-500));color:#fff;display:grid;place-items:center;box-shadow:0 10px 22px rgba(18,168,244,.22)}
.setupReminderIcon svg{width:22px;height:22px}
.setupReminder h3{font-size:16px;font-weight:950;color:var(--navy-900)}
.setupReminder p{font-size:12.5px;line-height:1.45;color:var(--slate-500);margin-top:3px}
.setupReminderProgress{display:grid;grid-template-columns:1fr auto;align-items:center;gap:9px}
.setupReminderProgress strong{font-size:13px;color:#057BB6}
.setupReminderTrack{grid-column:1/-1;height:8px;border-radius:999px;background:#CFEAF8;overflow:hidden}
.setupReminderTrack span{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--cyan-400),var(--cyan-500));border-radius:inherit;transition:width .25s ease}
.setupReminder .primaryBtn{min-height:42px;padding:0 16px;white-space:nowrap}
.setupReminder.complete{border-color:#BDE7D3;background:linear-gradient(135deg,#F2FBF7,#E7F8F0)}
.setupReminder.complete .setupReminderIcon{background:var(--green-500)}
.setupReminder.complete .setupReminderProgress strong{color:#087E50}
.setupReminder.complete .setupReminderTrack{background:#CFECDD}
.setupReminder.complete .setupReminderTrack span{background:var(--green-500)}
.notificationsView{display:grid;gap:18px;max-width:980px}
.notificationsHero{background:linear-gradient(135deg,#071632,#0D3767);color:#fff;border-radius:24px;padding:26px;box-shadow:0 18px 45px rgba(7,22,50,.16)}
.notificationsHero small{display:inline-flex;align-items:center;gap:8px;color:#66D5FF;font-size:12px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}
.notificationsHero h3{margin-top:10px;font-size:30px;line-height:1.05;font-weight:950;letter-spacing:-.05em}
.notificationsHero p{margin-top:10px;color:#C9D8EA;line-height:1.55;font-weight:700}
.notificationList{display:grid;gap:14px}
.notificationCard{background:#fff;border:1px solid var(--line);border-radius:20px;padding:20px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:16px;align-items:start;box-shadow:var(--shadow)}
.notificationCard.clickable{cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
.notificationCard.clickable:hover{transform:translateY(-1px);border-color:#9DDEFC;box-shadow:0 16px 35px rgba(8,22,52,.12)}
.notificationCard.clickable:focus-visible{outline:3px solid rgba(18,168,244,.2);outline-offset:3px}
.notificationCard.high{border-color:#BCEBFF;background:linear-gradient(135deg,#FFFFFF,#F1FBFF)}
.notificationIcon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:#E7F7FF;color:#0697DD}
.notificationCopy h4{font-size:17px;font-weight:950;color:var(--navy-900)}
.notificationCopy p{margin-top:5px;color:var(--slate-500);font-size:13.5px;line-height:1.5;font-weight:700}
.pendingQuestionList{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.pendingQuestionList span{border:1px solid #DCE7F3;background:#F7FAFD;border-radius:999px;padding:7px 10px;color:#63728A;font-size:11.5px;font-weight:900}
.notificationEmpty{background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px;color:var(--slate-500);font-weight:800;box-shadow:var(--shadow)}
.metricRow{grid-column:1/-1;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}
.card{background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow)}
.metric{min-height:190px;padding:26px 24px;display:flex;flex-direction:column;justify-content:space-between}
.metricTop{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}
.metricLabel{font-size:17px;line-height:1.08;color:#66738D;font-weight:900}
.metricIcon{width:46px;height:46px;border-radius:14px;background:#EAF8FF;color:var(--cyan-500);display:grid;place-items:center;font-size:22px;font-weight:900}
.metricIcon.amber{background:var(--amber-100);color:#9F690E}
.closingMetric{border-color:#F1D5A1;background:linear-gradient(145deg,#FFFFFF,#FFFBF3)}
.closingMetric .metricValue{color:#9A6410}
.closingMetric .metricSub{color:#7E6A48}
.metricValue{font-size:44px;line-height:1;font-weight:950;letter-spacing:-.06em;color:var(--slate-900)}
.metricSub{display:flex;align-items:center;gap:12px;color:#94A3BA;font-size:16px;font-weight:700}
.delta{border-radius:999px;background:var(--green-100);color:#087E50;padding:5px 10px;font-size:14px;font-weight:900}
.solvedCard{background:radial-gradient(circle at 80% 18%,rgba(18,168,244,.28),transparent 36%),linear-gradient(145deg,var(--navy-900),var(--navy-700));color:#fff;border:0}
.solvedCard .metricLabel,.solvedCard .metricSub{color:#C7D3E6}
.solvedCard .metricValue{color:#fff}
.progress{height:9px;border-radius:999px;background:rgba(255,255,255,.18);overflow:hidden;margin-top:14px}
.progress span{display:block;height:100%;width:0;border-radius:999px;background:var(--cyan-500)}
.chartCard{min-height:340px;padding:26px 26px 22px}
.chartHead{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.chartHead h3,.sectionTitle{font-size:21px;line-height:1.06;font-weight:950;letter-spacing:-.04em}
.chartHead p,.muted{color:#71809B;font-size:16px;font-weight:600}
.periodBadge{border-radius:999px;background:var(--cyan-100);color:#057BB6;padding:10px 18px;font-size:15px;font-weight:900;display:inline-flex;align-items:center;gap:9px}
.periodBadge:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--cyan-500)}
.areaChart{height:240px;margin-top:18px}
.areaChart svg{width:100%;height:100%;overflow:visible}
.sideStack{display:grid;gap:22px}
.satCard{min-height:150px;padding:24px;display:flex;align-items:center;gap:24px}
.ring{width:122px;height:122px;border-radius:50%;background:conic-gradient(var(--cyan-500) var(--satDeg,0deg),#EAF0F7 0);display:grid;place-items:center;flex:0 0 auto}
.ringInner{width:84px;height:84px;border-radius:50%;background:#fff;display:grid;place-items:center;text-align:center}
.ringInner strong{font-size:30px;line-height:1;font-weight:950;letter-spacing:-.05em}
.ringInner span{font-size:12px;color:#9AA8BE;font-weight:800}
.satCard h3{font-size:21px;font-weight:950;letter-spacing:-.04em}
.satCard p{margin-top:6px;color:#71809B;font-size:16px;font-weight:600}
.positive{margin-top:12px;background:var(--green-100);color:#087E50;border-radius:999px;padding:7px 12px;font-weight:900;display:inline-flex}
.darkInsight{background:radial-gradient(circle at 80% 15%,rgba(18,168,244,.26),transparent 38%),linear-gradient(145deg,var(--navy-900),var(--navy-700));border:0;color:#fff;padding:28px;min-height:214px}
.darkInsight h3{font-size:20px;font-weight:950;letter-spacing:-.04em;display:flex;align-items:center;gap:12px}
.darkInsight p{margin-top:22px;color:#C8D3E4;font-size:17px;line-height:1.5;font-weight:600}
.darkInsight strong,.darkInsight em{color:#5FD2FF;font-style:normal;font-weight:950}
.bottomGrid{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px}
.listCard{padding:26px;min-height:270px}
.listCard h3{font-size:21px;line-height:1.08;font-weight:950;letter-spacing:-.04em}
.listCard>p{margin-top:8px;color:#71809B;font-size:16px;font-weight:600}
.requestList,.outcomeList{display:grid;margin-top:22px}
.requestRow{display:grid;grid-template-columns:40px 1fr auto;gap:14px;align-items:center;border-top:1px solid var(--line);padding:13px 0}
.requestRow:first-child{border-top:0}
.zap{width:34px;height:34px;border-radius:11px;background:var(--amber-100);color:#A96C08;display:grid;place-items:center;font-size:19px}
.requestRow strong{font-size:16px;line-height:1.14;color:#34425C}
.countPill{border-radius:999px;background:#EEF2F7;color:#738198;padding:4px 10px;font-weight:900}
.outcomeRow{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;margin-top:20px}
.outcomeRow:first-child{margin-top:18px}
.outcomeRow label{color:#4A5870;font-size:16px;font-weight:700}
.outcomeRow strong{font-size:16px;font-weight:950}
.track{grid-column:1/-1;height:9px;border-radius:999px;background:#EAF0F7;overflow:hidden}
.track span{display:block;height:100%;width:0;border-radius:999px;background:var(--cyan-500)}
.track.green span{background:var(--green-500)}
.track.amber span{background:var(--amber-500)}
.nextCard{position:relative;padding:28px 26px;border-top:5px solid var(--cyan-500);min-height:270px;display:flex;flex-direction:column}
.nextCard h3{color:#057BB6;font-size:15px;letter-spacing:.18em;font-weight:950;text-transform:uppercase}
.nextCard p{margin-top:22px;font-size:18px;line-height:1.45;color:#24314B;font-weight:700}
.nextCard strong{font-weight:950}
.nextCard button{margin-top:auto;height:48px;border:0;border-radius:12px;background:linear-gradient(135deg,var(--cyan-400),var(--cyan-500));color:#fff;font-size:17px;font-weight:950}
.inboxShell{display:grid;grid-template-columns:320px minmax(360px,1fr) 310px;min-height:calc(100vh - 124px);background:#fff;border:1px solid var(--line);border-radius:20px;overflow:hidden;box-shadow:var(--shadow)}
.column{min-width:0;border-right:1px solid var(--line);display:flex;flex-direction:column}
.column:last-child{border-right:0}
.columnHead{padding:18px;border-bottom:1px solid var(--line)}
.columnHead h3{font-size:18px;font-weight:950}
.columnHead p{font-size:13px;color:var(--slate-500);margin-top:3px;font-weight:600}
.filters{display:flex;gap:6px;margin-top:14px;overflow:auto}
.filters button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 10px;color:var(--slate-500);font-size:12px;font-weight:800}
.filters button.active{border-color:var(--cyan-500);background:var(--cyan-100);color:#057BB6}
.searchBox{padding:12px;border-bottom:1px solid var(--line)}
input,textarea{width:100%;border:1px solid var(--line);border-radius:12px;background:#fff;padding:10px 12px;color:var(--slate-900);font-size:13px}
textarea{resize:vertical;min-height:72px}
input:focus,textarea:focus{outline:3px solid rgba(18,168,244,.16);border-color:var(--cyan-500)}
.threads{overflow:auto;padding:8px;display:grid;align-content:start;gap:7px}
.thread{border:1px solid transparent;background:transparent;border-radius:14px;padding:12px;text-align:left;color:inherit}
.thread:hover{background:var(--slate-100)}
.thread.active{background:var(--cyan-050);border-color:#BDEBFF}
.thread.pending{border-color:#FFE0A3;background:#FFF9ED}
.threadTop{display:flex;justify-content:space-between;gap:10px}
.thread strong{font-size:13px}
.thread time{font-size:11px;color:var(--slate-500)}
.thread p{font-size:12px;color:var(--slate-500);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:5px}
.handoffGuide,.quickReplies,.contextBlock,.threadReason,.typingLine{display:none}
.tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}
.tag{font-size:10px;color:var(--slate-700);background:var(--slate-100);border-radius:999px;padding:3px 7px}
.statusTag{font-weight:950}
.status-ai_active{color:#057BB6;background:#E3F6FF}
.status-needs_attention{color:#98640E;background:#FFF1D8}
.status-team_active{color:#5941A9;background:#EFEAFF}
.status-resolved{color:#087E50;background:#E7F8F0}
.chatHead{padding:16px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}
.chatHead h3{font-size:18px;font-weight:950}
.chatHead p{font-size:13px;color:var(--slate-500);margin-top:2px}
.chatActions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
.ghostBtn,.primaryBtn{border-radius:12px;border:1px solid var(--line);background:#fff;color:var(--slate-700);min-height:38px;padding:0 12px;font-size:13px;font-weight:800}
.primaryBtn{border:0;color:#fff;background:linear-gradient(135deg,var(--cyan-400),var(--cyan-500))}
.messages{flex:1;overflow:auto;background:#F8FAFC;padding:18px;display:flex;flex-direction:column;gap:10px}
.bubble{max-width:78%;border-radius:16px;padding:10px 12px;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}
.bubble.customer{align-self:flex-start;background:#fff;border:1px solid var(--line)}
.bubble.bot{align-self:flex-start;background:#EAF8FF;border:1px solid #C8ECFF}
.bubble.human{align-self:flex-end;background:var(--navy-700);color:#fff}
.bubble.system{align-self:center;border-radius:999px;background:var(--slate-100);color:var(--slate-500);font-size:11px;padding:6px 10px}
.bubble.deliveryFailed{border-color:#F0A58B!important;background:#FFF2ED!important;color:#9B3218!important}
.bubbleMeta{font-size:10px;color:var(--slate-500);margin-top:5px}
.bubble.human .bubbleMeta{color:#C8D3E6}
.composer{padding:14px;border-top:1px solid var(--line);display:grid;gap:9px}
.composerRow{display:block}
.composerTool,.sendCircle{width:40px;height:40px;border:0;border-radius:999px;background:var(--slate-100);color:var(--slate-700);font-size:18px;font-weight:900;display:none;place-items:center;flex:0 0 auto}
.sendCircle{background:linear-gradient(135deg,var(--cyan-400),var(--cyan-500));color:#fff}
.composerActions{display:flex;justify-content:space-between;align-items:center;gap:10px}
.composerActions small{color:var(--slate-500)}
.profile{padding:16px;overflow:auto;display:grid;align-content:start;gap:14px}
.profileCard{border:1px solid var(--line);border-radius:16px;padding:14px}
.profileCard h4{font-size:14px;font-weight:950}
.hint{background:linear-gradient(135deg,#F7FBFF,#EEF9FF);border-color:#C9EEFF}
.hint p{font-size:13px;color:var(--slate-700);margin-top:8px}
.tagBtn{border:1px solid var(--line);background:#fff;color:var(--slate-700);border-radius:999px;padding:6px 9px;font-size:11px;font-weight:800}
.tagBtn.active{background:var(--navy-700);border-color:var(--navy-700);color:#fff}
.tagBtn:disabled{opacity:.55;cursor:default}
.switchRow{display:flex;align-items:center;justify-content:space-between;gap:12px}
.switch{width:46px;height:26px;border-radius:999px;border:0;background:var(--slate-300);padding:3px}
.switch span{display:block;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .18s}
.switch.on{background:linear-gradient(135deg,var(--cyan-400),var(--cyan-500))}
.switch.on span{transform:translateX(20px)}
.humanMode .inboxShell{grid-template-columns:340px minmax(390px,1fr) 330px;background:#F8FAFC}
.humanMode .handoffGuide{display:flex;margin-top:14px;gap:10px;align-items:flex-start;border:1px solid #BDEBFF;background:var(--cyan-100);border-radius:16px;padding:12px;color:var(--navy-900)}
.humanMode .handoffGuide strong{font-size:13px;font-weight:950}
.humanMode .handoffGuide p{margin-top:3px;font-size:12px;color:#38506F}
.humanMode .thread{border-color:var(--line);background:#fff;box-shadow:0 6px 18px rgba(8,22,52,.04)}
.humanMode .thread.pending{border-color:#F4B750;background:#FFF8EA}
.humanMode .thread.active{border-color:var(--cyan-500);background:#F2FBFF}
.humanMode .threadReason{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px;color:#33425E;font-size:11px;font-weight:900}
.waitPill{border-radius:999px;background:#EEF2F7;color:#64748B;padding:4px 8px;font-size:10px;font-weight:950;white-space:nowrap}
.waitPill.hot{background:#FFE8E8;color:#B42323}
.humanMode .chatHead{background:#F7FBFF}
.humanMode .messages{background-color:#E9E1D7;background-image:radial-gradient(rgba(6,18,38,.07) 1px, transparent 1px);background-size:18px 18px;padding:22px}
.humanMode .bubble{position:relative;max-width:82%;border:0;box-shadow:0 2px 5px rgba(8,22,52,.08);padding:10px 12px 8px;border-radius:18px;font-size:13px}
.humanMode .bubble.customer{background:#fff;border-top-left-radius:5px}
.humanMode .bubble.bot{background:#DCF7FF;border-top-left-radius:5px}
.humanMode .bubble.human{background:#D9FDD3;color:#10291B;border-top-right-radius:5px}
.humanMode .bubble.system{box-shadow:none;background:rgba(255,255,255,.75);color:#526074}
.humanMode .bubbleMeta{display:flex;justify-content:flex-end;gap:5px;color:#667085;font-size:10px;margin-top:4px}
.humanMode .bubble.human .bubbleMeta{color:#557667}
.checks{letter-spacing:-.15em;color:#8A96A8}
.checks.read{color:var(--cyan-500)}
.typingLine{align-items:center;gap:7px;font-size:12px;color:#667085;padding:0 18px 10px}
.humanMode .typingLine{display:flex}
.typingDots{display:inline-flex;gap:3px}
.typingDots span{width:5px;height:5px;border-radius:50%;background:#94A3B8}
.humanMode .quickReplies{display:flex;gap:8px;overflow:auto;padding-bottom:2px}
.quickReplies button{border:1px solid #C8ECFF;background:#F2FBFF;color:#056A9B;border-radius:999px;padding:8px 10px;font-size:12px;font-weight:900;white-space:nowrap}
.humanMode .composer{background:#F7F8FA}
.humanMode .composerRow{display:grid;grid-template-columns:40px 40px 1fr auto;gap:8px;align-items:end}
.humanMode .composerTool,.humanMode .sendCircle{display:grid}
.humanMode .composer textarea{min-height:42px;max-height:120px;border-radius:999px;padding:12px 14px;background:#fff}
.humanMode .composerActions{display:none}
.humanMode .profileCard.handoffContext{background:#fff}
.humanMode .contextBlock{display:grid;gap:10px}
.contextLine{border-top:1px solid var(--line);padding-top:10px}
.contextLine:first-child{border-top:0;padding-top:0}
.contextLine span{display:block;color:var(--slate-500);font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
.contextLine strong{display:block;margin-top:3px;color:var(--slate-900);font-size:13px}
.contextActions{display:grid;gap:8px;margin-top:12px}
.contextActions button{width:100%}
.empty{color:var(--slate-500);font-size:13px;padding:18px 0}
.planView{display:grid;gap:20px}
.moduleHero{display:grid;grid-template-columns:1.35fr .65fr;gap:20px;align-items:stretch;border-radius:24px;background:radial-gradient(circle at 80% 12%,rgba(18,168,244,.28),transparent 34%),linear-gradient(145deg,var(--navy-950),var(--navy-700));color:#fff;padding:28px;box-shadow:var(--shadow)}
.moduleHero h3{font-size:34px;line-height:1;font-weight:950;letter-spacing:-.05em}
.moduleHero p{margin-top:12px;color:#C8D3E6;font-size:16px;font-weight:700;max-width:680px}
.moduleHeroCard{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:20px;padding:18px}
.moduleHeroCard strong{display:block;font-size:13px;color:#fff;font-weight:950}
.moduleHeroCard p{font-size:13px;margin-top:8px}
.moduleBadge{display:inline-flex;border-radius:999px;background:rgba(245,165,36,.18);color:#FFD28A;padding:7px 10px;font-size:12px;font-weight:950;margin-bottom:16px}
.appointmentGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.appointmentMetric{padding:20px;min-height:150px}
.appointmentMetric span{color:var(--slate-500);font-size:13px;font-weight:900}
.appointmentMetric strong{display:block;margin-top:18px;font-size:34px;line-height:1;font-weight:950;letter-spacing:-.05em}
.appointmentMetric p{margin-top:8px;color:var(--slate-500);font-size:12px;font-weight:700}
.moduleInfoGrid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.moduleList{display:grid;gap:12px;margin-top:18px}
.moduleList li{list-style:none;display:flex;gap:10px;align-items:flex-start;color:#34425C;font-size:14px;font-weight:750}
.moduleList .benefitIcon{margin-top:2px}
.serviceGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:18px}
.serviceCard{border:1px solid var(--line);border-radius:20px;padding:18px;background:#FAFCFF;display:grid;gap:12px}
.serviceCard.active{background:var(--cyan-050);border-color:#BDEBFF}
.serviceCard h4{font-size:17px;font-weight:950}
.serviceCard p{color:var(--slate-500);font-size:13px;font-weight:700}
.serviceState{display:inline-flex;width:max-content;border-radius:999px;background:var(--green-100);color:#087E50;padding:6px 10px;font-size:11px;font-weight:950}
.serviceState.off{background:var(--amber-100);color:#98640E}
.planHero{display:grid;grid-template-columns:1.2fr .8fr;gap:20px;border-radius:24px;background:radial-gradient(circle at 82% 12%,rgba(18,168,244,.30),transparent 34%),linear-gradient(145deg,var(--navy-950),var(--navy-700));color:#fff;padding:26px;box-shadow:var(--shadow)}
.planHero h3{font-size:30px;line-height:1;font-weight:950;letter-spacing:-.05em}
.planHero p{margin-top:10px;color:#C8D3E6;font-weight:700}
.planMeta{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
.planPill{border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.16);padding:8px 12px;font-size:12px;font-weight:900}
.planPill.ok{background:rgba(20,169,113,.16);color:#9DF0C8;border-color:rgba(20,169,113,.28)}
.usageCard{background:#fff;border:1px solid rgba(255,255,255,.14);border-radius:20px;padding:20px;color:var(--slate-900);box-shadow:0 20px 45px rgba(0,0,0,.14)}
.usageTop{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
.usageTop h4{font-size:16px;font-weight:950}
.usageTop strong{font-size:34px;line-height:1;font-weight:950;letter-spacing:-.05em}
.usageTop span{display:block;margin-top:4px;color:var(--slate-500);font-size:12px;font-weight:800}
.usageBar{height:12px;border-radius:999px;background:#EAF0F7;overflow:hidden;margin-top:18px}
.usageFill{height:100%;width:0;border-radius:999px;background:var(--cyan-500)}
.usageFill.warn{background:var(--amber-500)}
.usageFill.limit{background:#EF4E4E}
.usageMsg{margin-top:12px;color:var(--slate-700);font-size:13px;font-weight:800}
.planBlock{background:#fff;border:1px solid var(--line);border-radius:22px;padding:22px;box-shadow:var(--shadow)}
.planBlock h3{font-size:22px;line-height:1.08;font-weight:950;letter-spacing:-.04em}
.planBlock>p{margin-top:7px;color:var(--slate-500);font-size:14px;font-weight:700}
.billingGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:16px}.billingMetric{padding:13px;border:1px solid var(--line);border-radius:14px;background:var(--slate-50)}.billingMetric small{display:block;color:var(--slate-500);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.billingMetric strong{display:block;margin-top:6px;color:var(--navy-900);font-size:13px}.billingHistory{display:grid;gap:8px;margin-top:16px}.billingHistoryRow{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:11px 12px;border:1px solid var(--line);border-radius:12px}.billingHistoryRow strong{font-size:12px}.billingHistoryRow span,.billingHistoryRow small{color:var(--slate-500);font-size:10px}.billingFeeLabel{font-size:9px!important;font-weight:900;text-transform:uppercase;color:var(--cyan-700)!important}
.recommendation{display:flex;align-items:center;justify-content:space-between;gap:18px;background:linear-gradient(135deg,#F3FBFF,#fff);border-color:#BDEBFF}
.recommendationIcon{width:50px;height:50px;border-radius:16px;background:linear-gradient(135deg,var(--cyan-400),var(--cyan-500));color:#fff;display:grid;place-items:center;font-size:24px;flex:0 0 auto}
.recommendationText{display:flex;align-items:flex-start;gap:16px}
.recommendationActions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.planGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:18px}
.planOption{position:relative;border:1px solid var(--line);border-radius:20px;padding:20px;display:flex;flex-direction:column;gap:16px;min-height:360px;background:#fff}
.planOption.dark{background:radial-gradient(circle at 80% 12%,rgba(18,168,244,.32),transparent 36%),linear-gradient(145deg,var(--navy-900),var(--navy-700));border:0;color:#fff;box-shadow:0 20px 50px rgba(6,18,38,.22)}
.planOption h4{font-size:18px;font-weight:950;line-height:1.1}
.planOption p{color:var(--slate-500);font-size:13px;font-weight:700}
.planOption.dark p{color:#C8D3E6}
.priceLine strong{font-size:22px;font-weight:950;display:block}
.priceLine span{color:var(--slate-500);font-size:12px;font-weight:800}
.planOption.dark .priceLine span{color:#BFD0E8}
.planBadge{position:absolute;top:14px;right:14px;border-radius:999px;background:var(--cyan-100);color:#057BB6;padding:6px 9px;font-size:11px;font-weight:950}
.planOption.dark .planBadge{background:var(--amber-500);color:#3C2600}
.benefits{display:grid;gap:9px;margin-top:2px}
.benefits li{list-style:none;font-size:13px;color:#34425C;font-weight:750;display:flex;align-items:flex-start;gap:8px}
.benefitIcon{color:var(--green-500);display:inline-flex;align-items:center;justify-content:center;margin-top:1px;flex:0 0 auto}
.benefitIcon svg{width:15px;height:15px;display:block}
.planOption.dark .benefits li{color:#EEF6FF}
.sectionIcon{display:inline-flex;align-items:center;justify-content:center;color:var(--cyan-500);vertical-align:-4px;margin-right:8px}
.promoCard .sectionIcon{color:#5FD2FF}
.sectionIcon svg{width:20px;height:20px;display:block}
.planActions{display:grid;gap:8px;margin-top:auto}
.planActions button:disabled{opacity:.55;cursor:default}
.channelsView{max-width:980px;margin:0 auto;display:grid;gap:18px}
.channelsHero{border-radius:24px;padding:28px;background:radial-gradient(circle at 88% 12%,rgba(37,191,255,.28),transparent 38%),linear-gradient(145deg,var(--navy-950),var(--navy-700));color:#fff;box-shadow:var(--shadow)}
.channelsHero h3{font-size:30px;line-height:1.08;font-weight:950;letter-spacing:-.045em}
.channelsHero p{max-width:680px;margin-top:10px;color:#C8D3E6;font-size:14px;line-height:1.6;font-weight:650}
.metaConnectionSteps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:18px}
.metaConnectionStep{border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(255,255,255,.08);padding:12px;display:grid;gap:6px}
.metaConnectionStep b{width:26px;height:26px;border-radius:9px;background:#fff;color:var(--navy-800);display:grid;place-items:center;font-size:12px;font-weight:950}
.metaConnectionStep strong{font-size:13px;font-weight:950;color:#fff}
.metaConnectionStep span{font-size:11.5px;line-height:1.35;color:#BFD0E8;font-weight:700}
.connectionHubGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.connectionHubCard{border:1px solid var(--line);border-radius:18px;background:#fff;padding:16px;box-shadow:var(--shadow-soft)}
.connectionHubCard small{display:block;color:var(--slate-500);font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
.connectionHubCard strong{display:block;margin-top:7px;color:var(--navy-900);font-size:15px;font-weight:950;line-height:1.25}
.connectionHubCard p{margin-top:6px;color:var(--slate-500);font-size:11.5px;line-height:1.45}
.channelsList{display:grid;gap:14px}
.commerceConnections{display:grid;gap:12px;margin-top:4px}
.commerceConnections .sectionHead h3{font-size:20px;color:var(--navy-900);font-weight:950;letter-spacing:-.025em}
.commerceConnections .sectionHead p{margin-top:4px;color:var(--slate-500);font-size:12.5px;line-height:1.5}
.channelConnectCard{display:grid;grid-template-columns:58px minmax(0,1fr) auto;align-items:center;gap:17px;border:1px solid var(--line);border-radius:20px;background:#fff;padding:20px;box-shadow:var(--shadow-soft)}
.channelConnectCard.comingSoon{opacity:.72;background:#F8FAFC}
.channelConnectCard.recommended{border-color:#8FDDFB;box-shadow:0 0 0 3px rgba(0,160,240,.08),var(--shadow-soft)}
.channelConnectIcon{width:58px;height:58px;border-radius:17px;display:grid;place-items:center;color:#fff;font-weight:950;font-size:19px;background:linear-gradient(145deg,var(--navy-800),var(--navy-700))}
.channelConnectIcon.whatsapp{background:#16A76A}.channelConnectIcon.instagram{background:linear-gradient(145deg,#7C3AED,#E11D78,#F59E0B)}.channelConnectIcon.messenger{background:#168AFF}
.channelConnectCopy h4{font-size:17px;color:var(--navy-900);font-weight:950}
.channelConnectCopy p{font-size:12.5px;color:var(--slate-500);line-height:1.5;margin-top:4px}
.channelAccount{font-size:11.5px;color:var(--slate-700);font-weight:850;margin-top:7px}
.channelConnectActions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;max-width:330px}
.channelState{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;font-size:10.5px;font-weight:950;background:var(--slate-100);color:var(--slate-700)}
.channelState.connected{background:var(--green-100);color:#087E50}.channelState.connecting{background:var(--cyan-100);color:#057BB6}.channelState.needs_attention{background:var(--amber-100);color:#9C650C}.channelState.disconnected{background:#FDECEC;color:#B73535}
.channelAssetSelect{height:40px;max-width:260px;border:1px solid var(--line);border-radius:10px;background:#fff;padding:0 10px;font:750 11.5px var(--font-body);color:var(--navy-900)}
.whatsappPinField{display:grid;gap:4px;text-align:left}.whatsappPinField span{font-size:10px;font-weight:850;color:var(--slate-600)}.whatsappPinField input{height:40px;width:108px;border:1px solid var(--line);border-radius:10px;background:#fff;padding:0 10px;font:800 13px var(--font-body);letter-spacing:.18em;color:var(--navy-900)}
.channelsMessage{min-height:20px;font-size:12.5px;color:var(--slate-500);text-align:center}
.channelsMessage.success{color:#087E50}.channelsMessage.error{color:#B73535}
.channelsLater{justify-self:center;border:0;background:transparent;color:var(--slate-500);font-weight:850;font-size:12px;padding:8px;cursor:pointer}
.connectorSection{display:grid;gap:12px}
.connectorSection h4{font-size:17px;color:var(--navy-900);font-weight:950}
.connectorSection p{margin-top:3px;color:var(--slate-500);font-size:12.5px;line-height:1.5}
.rescueGrid,.refPromoGrid,.transparencyGrid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}
.rescueCard{border:1px solid var(--line);border-radius:18px;padding:18px;background:#FAFCFF}
.rescueCard strong{font-size:28px;font-weight:950;display:block}
.rescueCard span{display:block;margin-top:4px;color:var(--slate-500);font-size:13px;font-weight:800}
.refCode{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px dashed #9DDCFA;background:var(--cyan-050);border-radius:16px;padding:14px;margin-top:14px}
.refCode code{font-size:22px;color:var(--navy-900);font-weight:950;letter-spacing:.08em}
.promoCard{background:linear-gradient(135deg,var(--navy-900),var(--navy-700));color:#fff;border:0}
.promoCard p{color:#D4E1F5}
.transparencyGrid{grid-template-columns:repeat(4,minmax(0,1fr))}
.transparencyBox{border:1px solid var(--line);border-radius:18px;padding:16px;background:#FAFCFF}
.transparencyBox h4{font-size:14px;font-weight:950;margin-bottom:10px}
.transparencyBox li{list-style:none;color:#4A5870;font-size:12px;font-weight:700;padding:6px 0;border-top:1px solid #E9EEF5}
.transparencyBox li:first-child{border-top:0}
.testGrid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.testCard{padding:22px}
.formStack{display:grid;gap:10px;margin-top:14px}
.resultBox{border-top:1px solid var(--line);padding-top:12px;margin-top:12px;color:var(--slate-500);font-size:13px}
.resultItem{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--slate-100);border-radius:12px;padding:10px;margin-top:7px}
.resultItem a{color:var(--navy-700);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.statusLine{min-height:28px;color:var(--slate-500);font-size:12px;padding:0 14px 12px}
@media(max-width:1120px){
  .app{grid-template-columns:1fr}
  .sidebar{position:relative;height:auto;flex-direction:row;align-items:center;flex-wrap:wrap}
  .nav{display:flex;overflow:auto;width:100%}
  .navItem{min-width:max-content}
  .whatsappCard{display:none}
  .summary,.bottomGrid,.metricRow,.testGrid,.planHero,.planGrid,.rescueGrid,.refPromoGrid,.moduleHero,.appointmentGrid,.moduleInfoGrid{grid-template-columns:1fr 1fr}
  .transparencyGrid{grid-template-columns:1fr 1fr}
  .inboxShell{grid-template-columns:300px 1fr}
  .profileColumn{display:none}
}
@media(max-width:760px){
  .setupReminder{grid-template-columns:auto 1fr;padding:16px;gap:12px}.setupReminderProgress,.setupReminder .primaryBtn{grid-column:1/-1;width:100%}.notificationCard{grid-template-columns:1fr}.notificationIcon{width:40px;height:40px}.notificationsHero{padding:22px}.notificationsHero h3{font-size:25px}
  body{background:#F5F7FB}
  .app{display:block;min-height:100vh;padding-bottom:86px}
  .sidebar{display:none}
  .main{min-width:0}
  .topbar{display:none}
.mobileTop{display:flex;position:sticky;top:0;z-index:8;background:linear-gradient(135deg,var(--navy-950),var(--navy-800));border-bottom:1px solid rgba(255,255,255,.08);padding:12px 16px;align-items:center;justify-content:space-between;gap:12px;color:#fff}
.mobileTopActions{display:flex;align-items:center;gap:10px}
.mobileLogout{height:34px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.08);color:#fff;padding:0 12px;font-size:12px;font-weight:900}
.mobileBrand{display:flex;align-items:center;gap:10px;min-width:0}
  .mobileBrand .ravLogo{width:42px;height:42px;border-radius:13px;font-size:17px}
  .mobileBrand h1{font-family:var(--font-display);font-size:18px;line-height:1.08;font-weight:800;letter-spacing:-.03em;color:#fff}
  .mobileBrand p{font-size:11px;color:#9FB0CA;font-weight:700;margin-top:3px}
  .mobileBrand p span{color:var(--cyan-400)}
  .mobileAvatar{width:40px;height:40px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.15);color:#fff;display:grid;place-items:center;font-weight:950}
  .mobileModuleBar{display:none}
  .mobileBotSwitch{display:grid;grid-template-columns:1fr 1fr;gap:7px;position:sticky;top:67px;z-index:7;padding:10px 14px;background:#fff;border-bottom:1px solid var(--line)}
  .mobileBotSwitch button{min-height:46px;border:1.5px solid var(--line);border-radius:14px;background:#fff;color:var(--slate-700);padding:7px 10px;display:flex;align-items:center;justify-content:center;gap:7px;font-size:11.5px;font-weight:900;line-height:1.15;text-align:center}
  .mobileBotSwitch button.active{border-color:var(--cyan-500);background:var(--cyan-100);color:#057BB6;box-shadow:0 7px 18px rgba(18,168,244,.10)}
  .mobileBotSwitch .botDot{width:7px;height:7px;box-shadow:0 0 0 3px rgba(34,199,120,.12)}
  .content{padding:14px}
  .summary{display:block}
  .iaBanner{border-radius:22px;padding:18px;align-items:flex-start;margin-bottom:14px}
  .iaIcon{width:46px;height:46px;border-radius:14px;font-size:23px}
  .iaBanner p{font-size:17px;line-height:1.38}
  .metricRow{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
  .metric{min-height:132px;border-radius:18px;padding:16px}
  .metricLabel{font-size:13px;line-height:1.12}
  .metricIcon{width:38px;height:38px;border-radius:12px;font-size:18px}
  .metricValue{font-size:31px}
  .metricSub{font-size:12px;gap:7px;align-items:flex-start;flex-wrap:wrap}
  .delta{font-size:11px;padding:4px 7px}
  .solvedCard{grid-column:1/-1;min-height:154px}
  .progress{height:8px}
  .chartCard{min-height:250px;border-radius:20px;padding:18px;margin-bottom:12px}
  .chartHead{display:block}
  .chartHead h3,.sectionTitle{font-size:20px}
  .chartHead p,.muted{font-size:14px;margin-top:5px}
  .periodBadge{margin-top:12px;padding:8px 12px;font-size:13px}
  .areaChart{height:168px;margin-top:8px}
  .sideStack{display:block}
  .satCard{padding:18px;border-radius:20px;margin-bottom:12px;min-height:130px}
  .ring{width:98px;height:98px}
  .ringInner{width:68px;height:68px}
  .ringInner strong{font-size:24px}
  .satCard h3{font-size:19px}
  .satCard p{font-size:14px}
  .positive{font-size:13px;padding:6px 10px}
  .darkInsight{border-radius:20px;padding:20px;min-height:170px;margin-bottom:12px}
  .darkInsight p{font-size:16px;margin-top:14px}
  .bottomGrid{display:grid;grid-template-columns:1fr;gap:12px}
  .listCard,.nextCard{border-radius:20px;padding:20px;min-height:auto}
  .requestRow{grid-template-columns:36px 1fr auto;padding:12px 0}
  .requestRow strong{font-size:15px}
  .nextCard p{font-size:17px}
  .nextCard button{height:50px;width:100%;margin-top:24px}
  .inboxShell{display:block;border:0;border-radius:0;box-shadow:none;background:transparent;min-height:auto}
  .column{border:0;background:#fff;border-radius:20px;box-shadow:var(--shadow);overflow:hidden}
  .listColumn{display:flex;min-height:calc(100vh - 178px)}
  .chatColumn{display:none;min-height:calc(100vh - 108px)}
  .profileColumn{display:none}
  body.chat-open .listColumn{display:none}
  body.chat-open .chatColumn{display:flex}
  body.chat-open .mobileTabbar{display:none}
  body.chat-open .mobileTop,body.chat-open .mobileBotSwitch{display:none}
  body.chat-open .app{padding-bottom:0}
  .mobileBack{display:inline-flex;align-items:center;gap:7px;border:0;background:var(--slate-100);border-radius:999px;padding:8px 12px;color:var(--slate-700);font-weight:900;margin-bottom:12px}
  .columnHead{padding:18px}
  .columnHead h3{font-size:22px}
  .columnHead p{font-size:14px}
  .filters{gap:7px}
  .filters button{min-height:38px;padding:8px 12px;font-size:12px}
  .searchBox{padding:0 18px 14px;border-bottom:1px solid var(--line)}
  input,textarea{font-size:16px}
  .threads{padding:10px;gap:9px}
  .thread{background:#fff;border:1px solid var(--line);box-shadow:0 6px 18px rgba(8,22,52,.04);padding:14px}
  .thread strong{font-size:15px}
  .thread p{font-size:13px;margin-top:7px}
  .tag{font-size:11px;padding:4px 8px}
  .chatHead{padding:14px;display:block}
  .chatHead h3{font-size:18px}
  .chatHead p{font-size:13px}
  .chatActions{margin-top:12px;justify-content:flex-start}
  .ghostBtn,.primaryBtn{min-height:44px}
  .messages{padding:14px;min-height:calc(100vh - 312px)}
  .bubble{max-width:92%;font-size:14px;border-radius:18px}
  .composer{padding:12px}
  .composerActions{align-items:center}
  .mobilePeriodShell{display:flex;margin-bottom:14px}
  .mobilePeriodShell .periods{width:100%;justify-content:space-between;border-radius:18px}
  .mobilePeriodShell .periods button{flex:1;height:42px;font-size:14px;padding:0}
  .mobileTabbar{display:grid;position:fixed;left:0;right:0;bottom:0;z-index:12;grid-template-columns:repeat(var(--mobile-tabs,4),1fr);gap:4px;padding:8px 10px calc(8px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);border-top:1px solid var(--line);box-shadow:0 -12px 30px rgba(8,22,52,.08);backdrop-filter:blur(12px)}
  .mobileTabbar button{position:relative;min-height:54px;border:0;border-radius:16px;background:transparent;color:#74839D;font-size:11px;font-weight:900;display:grid;place-items:center;gap:2px}
.mobileTabbar button span:first-child{font-size:20px;line-height:1}
.mobileNavIcon{display:inline-flex;align-items:center;justify-content:center}
.mobileNavIcon svg{width:20px;height:20px;display:block}
  .mobileTabbar button.active{background:var(--cyan-100);color:#057BB6}
  .mobileBadge{position:absolute;top:5px;right:18px;min-width:18px;height:18px;border-radius:999px;background:var(--amber-500);color:#3C2600;font-size:10px;display:grid;place-items:center;padding:0 5px}
  .planView{gap:12px}
  .moduleHero{grid-template-columns:1fr;border-radius:22px;padding:20px}
  .moduleHero h3{font-size:28px}
  .moduleHero p{font-size:15px}
  .appointmentGrid,.moduleInfoGrid{grid-template-columns:1fr}
  .appointmentMetric{min-height:auto;border-radius:18px;padding:18px}
  .planHero{grid-template-columns:1fr;border-radius:22px;padding:20px}
  .planHero h3{font-size:26px}
  .usageCard{padding:16px}
  .recommendation{display:block}
  .recommendationText{gap:12px}
  .recommendationActions{justify-content:stretch;margin-top:16px}
  .recommendationActions button{width:100%}
  .planBlock{border-radius:20px;padding:18px}.billingGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.billingHistoryRow{grid-template-columns:1fr}
  .planGrid,.rescueGrid,.refPromoGrid,.transparencyGrid,.serviceGrid{grid-template-columns:1fr}
  .planOption{min-height:auto}
  .channelsHero{padding:22px 20px;border-radius:20px}.channelsHero h3{font-size:25px}.metaConnectionSteps,.connectionHubGrid{grid-template-columns:1fr}.channelConnectCard{grid-template-columns:48px 1fr;padding:16px}.channelConnectIcon{width:48px;height:48px;border-radius:14px}.channelConnectActions{grid-column:1/-1;justify-content:stretch;max-width:none}.channelConnectActions .primaryBtn,.channelConnectActions .ghostBtn,.channelAssetSelect{flex:1;max-width:none}
  .refCode{display:grid}
  .testGrid{grid-template-columns:1fr}
}

/* Conversaciones v2 · handoff Nextfor IA */
.convImpact{display:none;align-items:center;gap:7px;border-radius:999px;background:var(--green-100);color:#087E50;padding:9px 14px;font-size:13px;font-weight:900;white-space:nowrap}
body.conversations-view .pageTitle h2,.guidedTitle strong,.profileIdentity h3,.relationshipCard strong{font-family:var(--font-display)}
body.conversations-view .topbar{height:108px;align-items:flex-start;padding:15px 28px}
body.conversations-view .pageTitle h2{font-size:24px;letter-spacing:-.03em}
body.conversations-view .pageTitle p{font-size:13.5px;margin-top:5px}
.omnichannelStrip{display:none;align-items:center;gap:8px;margin-top:8px;color:var(--slate-500);font-size:12px;font-weight:750}
body.conversations-view .omnichannelStrip{display:flex}
.omnichannelStrip>i{width:1px;height:13px;background:var(--line)}
.channelStripBadges{display:inline-flex;align-items:center;gap:6px}
.mobileOmnichannelStrip{display:none;align-items:center;gap:8px;color:var(--slate-500);font-size:11.5px;font-weight:750}
body.conversations-view .toolbar .periods{display:none}
body.conversations-view .convImpact{display:inline-flex}
body.conversations-view .content{padding:0;max-width:none}
body.conversations-view .inboxShell{height:calc(100vh - 108px);min-height:600px;grid-template-columns:372px minmax(440px,1fr) 296px;border:0;border-radius:0;box-shadow:none}
body.conversations-view .listColumn,body.conversations-view .chatColumn,body.conversations-view .profileColumn{min-width:0;overflow:hidden}
.convListControls{padding:16px 16px 12px;display:grid;gap:12px;border-bottom:1px solid var(--line)}
.convListControls .searchBox{height:44px;padding:0 13px;border:1.5px solid var(--slate-300);border-radius:12px;background:#F8FAFC;display:flex;align-items:center;gap:9px}
.convListControls .searchBox input{border:0;background:transparent;padding:0;font-size:14px;min-width:0}
.convListControls .searchBox input:focus{outline:0}
.searchIcon{font-size:23px;line-height:1;color:var(--slate-500);transform:rotate(-20deg)}
.convListControls .filters{margin:0;gap:8px;overflow:visible}
.convListControls .filters button{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:7px 10px;border-color:var(--line);font-size:12px;white-space:nowrap}
.convListControls .filters button span{min-width:18px;border-radius:999px;background:var(--slate-100);padding:1px 5px;font-size:10px;font-weight:950}
.convListControls .filters button.active{background:var(--navy-800);border-color:var(--navy-800);color:#fff}
.convListControls .filters button.active span{background:rgba(255,255,255,.2);color:inherit}
.convListControls .filters #filter-you.active{background:var(--amber-500);border-color:var(--amber-500);color:#3A2708}
.convListControls .filters #filter-resolved.active{background:var(--green-500);border-color:var(--green-500);color:#fff}
.threads{padding:8px 12px 16px;gap:8px}
.filterIntro{display:flex;gap:12px;align-items:flex-start;padding:14px 15px;border-radius:14px;margin-bottom:4px;text-align:left}
.filterIntro.you{background:#FFF7E8;border:1px solid #F3DEB4;color:#7A4E08}
.filterIntro.ok{background:var(--green-100);border:1px solid #C3EAD7;color:#0B7A50}
.filterIntro span{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:0 0 auto;background:currentColor;color:#fff}
.filterIntro strong{display:block;font-size:14px;font-weight:950}
.filterIntro p{white-space:normal;margin-top:3px;color:inherit;font-size:12px;line-height:1.45}
.thread{position:relative;border:1px solid var(--line);border-left-width:3px;background:#fff;border-radius:14px;padding:12px 12px 12px 13px;box-shadow:none;transition:background .16s ease,box-shadow .16s ease,transform .16s ease}
.thread:hover{background:#F8FBFF;box-shadow:var(--shadow-soft);transform:translateY(-1px)}
.thread.active{background:var(--cyan-050);border-color:#71D3FF;box-shadow:var(--shadow-soft)}
.thread.status-you{border-left-color:var(--amber-500)}
.thread.status-ia{border-left-color:var(--cyan-500)}
.thread.status-ok{border-left-color:var(--green-500)}
.threadMain{display:flex;align-items:center;gap:11px}
.avatarChannelWrap{position:relative;display:inline-flex;flex:0 0 auto}
.contactAvatar{width:44px;height:44px;border-radius:13px;background:linear-gradient(135deg,var(--navy-700),var(--cyan-500));color:#fff;display:grid;place-items:center;flex:0 0 auto;font-weight:900;font-size:14px;letter-spacing:-.02em}
.contactAvatar.big{width:64px;height:64px;border-radius:18px;font-size:20px}
.threadIdentity{min-width:0;flex:1}
.threadTop strong{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.threadTop time{flex:0 0 auto}
.thread p{font-size:12.5px;margin-top:2px}
.threadStatus{display:flex;align-items:center;gap:8px;margin-top:10px;padding-left:55px;min-width:0}
.threadStatus small{color:var(--slate-500);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.statusPill,.chatStatusPill{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:900;white-space:nowrap}
.statusPill.you,.chatStatusPill.you{background:#FFF1D8;color:#9A6410}
.statusPill.ia,.chatStatusPill.ia{background:#E3F6FF;color:#057BB6}
.statusPill.ok,.chatStatusPill.ok{background:var(--green-100);color:#087E50}
.channelBadge{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;color:#fff}
.channelBadge.floating{position:absolute;right:-4px;bottom:-4px;width:18px;height:18px;border:2px solid #fff;box-shadow:0 1px 4px rgba(6,15,34,.3)}
.channelBadge.floating.large{width:26px;height:26px;right:-5px;bottom:-5px}
.channelBadge svg{width:58%;height:58%;display:block}
.channelBadge.whatsapp{background:#25D366}
.channelBadge.instagram{background:linear-gradient(135deg,#FEDA75,#FA7E1E,#D62976 55%,#962FBF,#4F5BD5)}
.channelBadge.messenger{background:linear-gradient(135deg,#00B2FF,#006AFF)}
.channelBadge.email{background:#5A6A87}
.liveDot{width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px rgba(18,168,244,.18)}
.chatHead{padding:15px 22px;background:#fff;gap:13px;flex-wrap:nowrap}
.chatIdentity{flex:1;min-width:0}
.chatIdentity h3{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chatIdentity p{display:flex;align-items:center;gap:6px;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.chatIdentity p:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--green-500)}
.chatStatusPill{font-size:12px;padding:5px 12px;flex:0 0 auto}
.chatCloseButton{width:38px;height:38px;display:grid;place-items:center;flex:0 0 auto;border:1px solid var(--line);border-radius:11px;background:#fff;color:var(--slate-500);font-size:22px;line-height:1;cursor:pointer;transition:background .16s ease,color .16s ease,border-color .16s ease}
.chatCloseButton:hover{background:var(--slate-100);border-color:var(--slate-300);color:var(--navy-800)}
.chatCloseButton:focus-visible{outline:3px solid rgba(18,168,244,.2);outline-offset:2px}
.messages{padding:22px;background:#F8FAFC;gap:14px;min-width:0}
.bubble{max-width:74%;padding:11px 15px;font-size:14px;line-height:1.5;border-radius:16px;box-shadow:0 3px 10px rgba(8,22,52,.04);white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}
.bubble.customer{align-self:flex-start;background:#fff;border:1px solid var(--line);border-bottom-left-radius:4px}
.bubble.bot{align-self:flex-end;background:var(--cyan-100);border:1px solid #CDEBFB;border-bottom-right-radius:4px;color:var(--navy-800)}
.bubble.human{align-self:flex-end;background:linear-gradient(135deg,var(--navy-700),var(--cyan-500));border-bottom-right-radius:4px;color:#fff}
.bubbleMeta{text-align:right;font-size:10.5px}
.conversationAction{flex:0 0 auto;background:#fff;border-top:1px solid var(--line);padding:14px 22px 12px}
.guidedAction{display:none;padding:16px 17px;margin-bottom:4px;background:var(--cyan-050);border:1px solid #BEE6FB;border-radius:16px}
.guidedTitle{display:flex;align-items:center;gap:9px;color:var(--navy-800)}
.guidedTitle span{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,var(--cyan-400),var(--cyan-500));color:#fff;display:grid;place-items:center;box-shadow:0 8px 20px rgba(18,168,244,.22)}
.guidedTitle strong{font-size:14.5px;font-weight:950}
.guidedAction>p{font-size:13px;line-height:1.5;color:var(--navy-700);margin:9px 0 11px}
.guidedAction textarea{min-height:76px;resize:none;padding:13px 15px;border:1.5px solid #BEE6FB;border-radius:13px;font-size:14px;line-height:1.55}
.guidedReplyRow{display:grid;grid-template-columns:minmax(0,1fr) 44px;align-items:end;gap:9px}
.guidedReplyRow textarea{width:100%}
.guidedFooter{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px}
.guidedFooter>span{font-size:12px;color:#057BB6;margin-left:auto}
.confirmBtn{border:0;border-radius:12px;background:linear-gradient(135deg,var(--cyan-400),var(--cyan-500));color:#fff;min-height:44px;padding:0 20px;font-weight:950;box-shadow:0 10px 22px -8px rgba(0,160,240,.6)}
.textBtn{border:0;background:transparent;color:var(--slate-500);min-height:40px;font-size:13px;font-weight:900;padding:0 4px}
.stateBand{display:none;align-items:center;gap:11px;padding:13px 15px;margin-bottom:12px;border-radius:14px;font-size:13px;font-weight:750}
.stateBand.ia{display:flex;background:var(--cyan-100);border:1px solid #CDEBFB;color:#075985}
.stateBand.ok{display:flex;background:var(--green-100);color:#0B7A50}
.stateBand .bandIcon{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;flex:0 0 auto;background:currentColor;color:#fff}
.humanControl{display:none;align-items:center;justify-content:space-between;gap:14px;padding:12px 14px;margin-bottom:12px;border:1px solid #CDEBFB;border-radius:14px;background:#F6FCFF}
.humanControl.visible{display:flex}
.humanControl.active{border-color:#BFE9D6;background:var(--green-100)}
.humanControlCopy{display:grid;gap:2px;min-width:0}
.humanControlCopy strong{font-size:13px;font-weight:950;color:var(--navy-800)}
.humanControlCopy span{font-size:11.5px;line-height:1.4;color:var(--slate-500)}
.humanControlActions{display:flex;gap:8px;flex:0 0 auto}
.controlBtn{min-height:40px;border:0;border-radius:11px;padding:0 14px;background:linear-gradient(135deg,var(--cyan-400),var(--cyan-500));color:#fff;font-size:12px;font-weight:950;white-space:nowrap}
.controlBtn.release{border:1px solid #B7DFC9;background:#fff;color:#087E50}
.controlBtn:disabled{opacity:.55;cursor:default}
.composer{padding:0;border:0;display:grid;gap:5px}
.composerRow{display:flex;align-items:center;gap:12px}
.composerRow input{height:48px;min-width:0;flex:1;border-radius:999px;padding:0 18px;font-size:14px}
.emojiControl{position:relative;flex:0 0 auto}
.emojiButton{width:44px;height:44px;display:grid;place-items:center;border:1px solid var(--line);border-radius:50%;background:#fff;color:var(--slate-700);font-size:21px;line-height:1;cursor:pointer;transition:background .16s ease,border-color .16s ease,transform .16s ease}
.composerRow .emojiButton{width:48px;height:48px;background:var(--slate-100);border-color:transparent}
.emojiButton:hover,.emojiButton[aria-expanded="true"]{background:var(--cyan-100);border-color:#9DDEFC;transform:translateY(-1px)}
.emojiButton:disabled{opacity:.5;cursor:default;transform:none}
.emojiButton:focus-visible{outline:3px solid rgba(18,168,244,.2);outline-offset:2px}
.emojiPicker{position:absolute;z-index:40;bottom:calc(100% + 10px);left:0;width:292px;padding:12px;display:grid;grid-template-columns:repeat(8,1fr);gap:5px;background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:0 18px 45px rgba(8,22,52,.2)}
.guidedReplyRow .emojiPicker{left:auto;right:0}
.emojiPicker[hidden]{display:none}
.emojiPicker button{width:29px;height:29px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;font-size:20px;line-height:1;cursor:pointer}
.emojiPicker button:hover,.emojiPicker button:focus-visible{background:var(--cyan-100);outline:none}
.sendCircle{display:grid;width:48px;height:48px;background:linear-gradient(135deg,var(--cyan-400),var(--cyan-500));color:#fff;box-shadow:0 8px 20px rgba(18,168,244,.24)}
.composerActions{display:none}
.statusLine{padding:6px 0 0;min-height:20px}
.profile{padding:22px 20px;gap:20px}
.profileIdentity{display:flex;flex-direction:column;align-items:center;text-align:center;gap:7px}
.profileIdentity h3{font-size:17px;font-weight:950;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.profileIdentity p{color:var(--slate-500);font-size:12.5px;max-width:100%;overflow-wrap:anywhere}
.copyContact{border:1px solid var(--slate-300);background:#fff;border-radius:999px;color:var(--navy-700);padding:6px 13px;font-size:12.5px;font-weight:800}
.relationshipCard{padding:15px 16px;border-radius:16px;background:linear-gradient(135deg,var(--cyan-050),#EAF7FE);border:1px solid #CDEBFB}
.relationshipCard>span,.aiUnderstood>span{display:block;font-size:11px;font-weight:950;letter-spacing:.06em;text-transform:uppercase;color:#057BB6;margin-bottom:7px}
.relationshipCard div{display:flex;align-items:baseline;gap:8px}
.relationshipCard strong{font-size:24px;font-weight:950;color:var(--navy-800);letter-spacing:-.03em}
.relationshipCard small{font-size:12px;font-weight:800;color:var(--navy-700)}
.relationshipCard p{font-size:12.5px;line-height:1.45;color:var(--navy-700);margin-top:7px}
.customerFacts{display:grid}
.customerFact{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line);font-size:12.5px;color:var(--slate-500)}
.customerFact strong{color:var(--slate-900);font-size:13px}
.aiUnderstood{padding:15px 16px;border-radius:16px;background:#F8FAFC;border:1px solid var(--line)}
.aiUnderstood strong{display:block;color:var(--navy-800);font-size:13px;line-height:1.4}
.aiChips{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.aiChips span{border-radius:999px;background:var(--cyan-100);color:#057BB6;padding:5px 8px;font-size:10.5px;font-weight:850}
.nameCard{padding:15px 16px;border-radius:16px;background:#fff;border:1px solid var(--line)}
.nameCard h4,.noteCard h4{font-size:14px;font-weight:950}
.nameCard input{width:100%;margin-top:9px;min-height:44px;border:1px solid var(--slate-300);border-radius:12px;padding:0 12px;color:var(--navy-800);font:inherit;font-size:13px;font-weight:750;background:#fff}
.nameCard input:focus{outline:3px solid rgba(18,168,244,.16);border-color:var(--cyan-400)}
.nameSuggestion{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;margin-top:9px;padding:9px 10px;border-radius:12px;background:var(--cyan-050);border:1px solid #CDEBFB}
.nameSuggestion[hidden]{display:none}
.nameSuggestion span{font-size:11.5px;line-height:1.35;color:var(--navy-700)}
.nameSuggestion strong{display:block;color:#057BB6;font-size:13px}
.nameSuggestion button{border:0;border-radius:9px;padding:7px 9px;background:#fff;color:#057BB6;font-size:11px;font-weight:950;white-space:nowrap}
.nameCard>p{font-size:11px;color:var(--slate-500);line-height:1.4;margin-top:7px}
.mobileCustomerNameCard{display:none;padding:12px;margin-bottom:12px;border:1px solid #CDEBFB;border-radius:14px;background:var(--cyan-050)}
.mobileCustomerNameCard h4{font-size:13px;font-weight:950;color:var(--navy-800)}
.mobileCustomerNameCard input{width:100%;height:42px;margin-top:8px;border:1px solid var(--slate-300);border-radius:11px;padding:0 12px;background:#fff;color:var(--navy-800);font:inherit;font-size:13px}
.mobileCustomerNameCard .nameSuggestion{background:#fff}
.mobileCustomerNameActions{display:flex;align-items:center;gap:8px;margin-top:8px}
.mobileCustomerNameActions button{margin-left:auto;min-height:36px;padding:0 11px}
.mobileCustomerNameActions small{color:var(--slate-500);font-size:10.5px;line-height:1.3}
.noteCard h4{font-size:14px;font-weight:950}
.noteCard textarea{margin-top:9px;min-height:76px}
.noteCard button{margin-top:9px;width:100%}
.noteCard p{font-size:11px;color:var(--slate-500);margin-top:6px}
.setupView{display:flex;flex-direction:column;gap:20px;max-width:1120px;margin:0 auto}
.setupSummaryPanel{background:#fff;border:1px solid var(--line);border-radius:22px;padding:24px;box-shadow:var(--shadow-soft);display:grid;gap:18px}
.setupSummaryHead{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
.setupSummaryHead h3{font-size:23px;font-weight:950;letter-spacing:-.04em;color:var(--navy-900)}
.setupSummaryHead p{margin-top:5px;color:var(--slate-500);font-size:13.5px;line-height:1.5;font-weight:650;max-width:680px}
.setupFlowSteps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.setupFlowStep{border:1px solid var(--line);border-radius:16px;background:#F8FAFC;padding:14px;display:grid;gap:6px}
.setupFlowStep b{width:28px;height:28px;border-radius:10px;background:var(--cyan-100);color:#057BB6;display:grid;place-items:center;font-size:12px}
.setupFlowStep strong{font-size:13px;color:var(--navy-900)}
.setupFlowStep span{font-size:11px;color:var(--slate-500);font-weight:650;line-height:1.35}
.setupFlowStep.next{border-color:#9DDCF8;background:linear-gradient(135deg,#F3FBFF,#E7F7FF)}
.setupConfigGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.setupConfigCard{border:1px solid var(--line);border-radius:16px;background:#fff;padding:16px}
.setupConfigCard small{display:block;color:#057BB6;font-size:10px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}
.setupConfigCard strong{display:block;margin-top:7px;color:var(--navy-900);font-size:17px;font-weight:950;line-height:1.2}
.setupConfigCard p{margin-top:7px;color:var(--slate-500);font-size:12.5px;line-height:1.45;font-weight:650}
.personalityStudio{border:1px solid #CDEAF9;border-radius:22px;background:#fff;box-shadow:var(--shadow);overflow:hidden}
.personalityHead{padding:22px 24px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;justify-content:space-between;gap:18px}
.personalityHead small{display:block;color:#057BB6;font-size:10px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}
.personalityHead h3{margin-top:5px;color:var(--navy-900);font-size:23px;font-weight:950;letter-spacing:-.035em}
.personalityHead p{margin-top:5px;color:var(--slate-500);font-size:13px;line-height:1.5;max-width:690px}
.personalityStatus{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;border-radius:999px;padding:8px 11px;background:var(--slate-100);color:var(--slate-600);font-size:11px;font-weight:900}
.personalityStatus:before{content:"";width:7px;height:7px;border-radius:50%;background:#94A3B8}
.personalityStatus.live{background:var(--green-100);color:#087E50}
.personalityStatus.live:before{background:var(--green-500)}
.personalityWorkspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(330px,.82fr);gap:0}
.personalityControls{padding:22px 24px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;border-right:1px solid var(--line)}
.personalityControls .wide{grid-column:1/-1}
.personalityField{display:grid;gap:7px}
.personalityField>span{color:var(--slate-700);font-size:12px;font-weight:900}
.personalityField small{color:var(--slate-500);font-size:10.5px;line-height:1.4}
.personalityField input,.personalityField textarea,.personalityField select{width:100%;border:1px solid var(--line);border-radius:12px;background:#fff;padding:12px 13px;color:var(--slate-900);font:inherit;font-size:13px}
.personalityField textarea{min-height:82px;line-height:1.5;resize:vertical}
.personalityField input:focus,.personalityField textarea:focus,.personalityField select:focus{outline:3px solid rgba(18,168,244,.16);border-color:var(--cyan-500)}
.personalityLength{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.personalityLength label{position:relative;cursor:pointer}
.personalityLength input{position:absolute;opacity:0;pointer-events:none}
.personalityLength span{min-height:44px;border:1.5px solid var(--line);border-radius:11px;display:grid;place-items:center;text-align:center;padding:7px;color:var(--slate-600);font-size:11px;font-weight:900}
.personalityLength input:checked+span{border-color:var(--cyan-500);background:var(--cyan-050);color:#057BB6;box-shadow:0 0 0 3px rgba(18,168,244,.10)}
.personalityActions{grid-column:1/-1;display:flex;align-items:center;gap:10px;padding-top:2px}
.personalityActions p{margin-right:auto;color:var(--slate-500);font-size:11px}
.personalityPreview{padding:22px;background:#F3F8FC;display:grid;align-content:start;gap:13px}
.personalityPreviewHead{display:flex;align-items:center;gap:10px}
.personalityBotAvatar{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,var(--navy-700),var(--cyan-500));color:#fff;display:grid;place-items:center;font-weight:950}
.personalityPreviewHead strong{display:block;font-size:13px;font-weight:950}
.personalityPreviewHead span{display:block;color:var(--green-600);font-size:10.5px;font-weight:800;margin-top:2px}
.personalityChat{min-height:220px;border:1px solid var(--line);border-radius:16px;background:#EAF2F8;padding:15px;display:flex;flex-direction:column;gap:10px}
.personalityBubble{max-width:88%;border-radius:14px;padding:11px 13px;font-size:12.5px;line-height:1.5;white-space:pre-wrap}
.personalityBubble.user{align-self:flex-start;background:#fff;color:var(--slate-800);border-bottom-left-radius:4px}
.personalityBubble.bot{align-self:flex-end;background:linear-gradient(135deg,#20B4F3,#0798DC);color:#fff;border-bottom-right-radius:4px}
.personalityTestRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
.personalityTestRow input{min-width:0;height:44px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:0 12px;color:var(--slate-900);font:inherit;font-size:12px}
.personalityTestRow button{min-height:44px;padding:0 15px}
.personalitySamples{display:flex;gap:6px;flex-wrap:wrap}
.personalitySamples button{border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--slate-600);padding:6px 9px;font-size:10px;font-weight:850;cursor:pointer}
.personalitySamples button:hover{border-color:#8DDAFC;color:#057BB6}
.personalitySafety{color:var(--slate-500);font-size:10px;line-height:1.4}
.personalityStudio,.setupSummaryPanel{display:none!important}
.channelPlan{border-top:1px solid var(--line);padding-top:18px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center}
.channelPlan h4{font-size:17px;font-weight:950;color:var(--navy-900)}
.channelPlan p{margin-top:4px;color:var(--slate-500);font-size:13px;font-weight:650;line-height:1.45}
.setupDetailsToggle{min-height:42px;border:1px solid var(--line);background:#fff;border-radius:12px;color:var(--navy-900);font-size:13px;font-weight:900;padding:0 14px}
.onboardingDetails{display:none;border:1px solid var(--line);border-radius:18px;background:#F8FAFC;padding:16px}
.onboardingDetails.open{display:grid;gap:10px}
.questionnaireList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.questionnaireItem{border:1px solid var(--line);border-radius:14px;background:#fff;padding:12px}
.questionnaireItem small{display:block;color:#74839C;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
.questionnaireItem strong{display:block;margin-top:5px;color:var(--navy-900);font-size:13px;line-height:1.35}
.setupProgressPanel{flex:0 0 auto;position:relative;overflow:hidden;border-radius:20px;padding:26px 30px;background:radial-gradient(circle at 86% 12%,rgba(0,160,240,.30),transparent 34%),linear-gradient(145deg,var(--navy-950),var(--navy-700));color:#fff;box-shadow:var(--shadow)}
.setupProgressBody{position:relative;display:flex;align-items:center;gap:26px}
.setupProgressCopy{flex:1;min-width:0}
.setupEyebrow{font-size:11px;font-weight:850;letter-spacing:.14em;color:#8EDCFF;text-transform:uppercase;margin-bottom:8px}
.setupStory{max-width:680px;margin:0;color:#fff;font-family:var(--font-display);font-size:18px;font-weight:800;line-height:1.4;letter-spacing:-.01em}
.setupStatus{position:absolute;right:180px;top:0;display:inline-flex;align-items:center;border-radius:999px;padding:6px 11px;background:rgba(255,255,255,.10);color:#D7E6F8;font-size:11px;font-weight:850}
.setupStatus.live{background:rgba(22,167,106,.22);color:#9DF0C8}
.setupStepper{display:flex;align-items:center;margin-top:20px;max-width:560px}
.setupStepLink{display:flex;align-items:center;flex:1;min-width:0}
.setupStepLink:first-child{flex:0 0 auto}
.setupStepLine{height:2px;flex:1;min-width:8px;margin:0 4px;border-radius:999px;background:rgba(255,255,255,.16)}
.setupStepLink.done .setupStepLine,.setupStepLink.current .setupStepLine{background:var(--cyan-400)}
.setupStepDot{width:30px;height:30px;flex:0 0 auto;border:0;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.10);color:rgba(255,255,255,.72);font:850 12px var(--font-display);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}
.setupStepDot:hover{transform:translateY(-1px)}
.setupStepLink.done .setupStepDot{background:var(--cyan-500);color:#fff}
.setupStepLink.current .setupStepDot{background:linear-gradient(135deg,var(--cyan-400),var(--cyan-500));color:#fff;border:2px solid rgba(255,255,255,.52);box-shadow:0 0 0 5px rgba(18,168,244,.13),0 8px 18px rgba(0,160,240,.26)}
.setupProgressRing{--wizard-progress:14%;width:118px;height:118px;flex:0 0 auto;border-radius:50%;padding:7px;background:conic-gradient(var(--cyan-400) var(--wizard-progress),rgba(255,255,255,.14) 0);transform:rotate(-90deg);display:grid;place-items:center}
.setupProgressRing>div{width:100%;height:100%;border-radius:50%;background:var(--navy-900);transform:rotate(90deg);display:grid;place-items:center;text-align:center}
.setupProgressRing strong{display:block;color:#fff;font-size:25px;line-height:1;font-weight:950}
.setupProgressRing span{display:block;color:#9BB0CC;font-size:8.5px;margin-top:5px;text-transform:uppercase;letter-spacing:.12em;font-weight:900}
.setupNotice{display:flex;align-items:flex-start;gap:11px;border-radius:14px;background:var(--cyan-050);border:1px solid #BEE6FB;padding:14px 18px;color:#075985;font-size:13px;line-height:1.55}
.setupNotice strong{font-weight:950;color:var(--navy-900)}
.setupNotice a{margin-left:auto;white-space:nowrap;color:#057BB6;font-weight:900;text-decoration:none;border:1px solid #9DDCF8;background:#fff;border-radius:10px;padding:8px 11px}
.setupNoticeIcon{font-size:18px;line-height:1.2;color:var(--cyan-600)}
.setupForm{display:block}
.setupStep{display:none;background:#fff;border:1px solid var(--line);border-radius:20px;padding:26px 28px;box-shadow:var(--shadow-soft);animation:setupRise .24s ease-out}
.setupStep.active{display:block}
@keyframes setupRise{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
.setupStepHead{display:grid;grid-template-columns:44px 1fr;gap:14px;align-items:start;margin-bottom:22px}
.setupStepNumber{width:44px;height:44px;border-radius:13px;background:var(--cyan-100);color:#057BB6;display:grid;place-items:center;font:950 18px var(--font-display)}
.setupStepHead h4{font-size:19px;font-weight:950;letter-spacing:-.02em}
.setupStepHead p{color:var(--slate-500);font-size:13.5px;margin-top:3px;line-height:1.45}
.setupGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.setupGrid .wide{grid-column:1/-1}
.setupField{display:grid;gap:7px;align-content:start}
.setupField>span{font-size:12px;color:var(--slate-700);font-weight:900}
.setupField small{color:var(--slate-500);font-size:10.5px;line-height:1.4}
.setupField input,.setupField textarea,.setupField select{width:100%;border:1px solid var(--line);border-radius:12px;background:#fff;padding:12px 13px;color:var(--slate-900);font:inherit;font-size:13px}
.setupField textarea{min-height:104px;line-height:1.5;resize:vertical}
.setupField select{height:46px}
.setupField input:focus,.setupField textarea:focus,.setupField select:focus{outline:3px solid rgba(18,168,244,.16);border-color:var(--cyan-500)}
.channelChoices{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.channelChoice{position:relative;border:1.5px solid var(--line);border-radius:14px;padding:14px 12px;display:flex;align-items:center;gap:9px;color:var(--slate-700);font-size:12px;font-weight:900;cursor:pointer}
.channelChoice input{width:18px;height:18px;accent-color:var(--cyan-500)}
.channelChoice:has(input:checked){border-color:#83D8FF;background:var(--cyan-050);color:#057BB6}
.industryQuestions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.setupAccounts{grid-column:1/-1;border:1px solid var(--line);border-radius:16px;background:#F8FAFC;padding:18px}
.setupAccounts h5{font:950 15px var(--font-display);color:var(--navy-900)}
.setupAccounts p{margin:4px 0 14px;color:var(--slate-500);font-size:11.5px;line-height:1.45}
.setupAccountsGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.setupActions{position:sticky;bottom:10px;z-index:4;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.97);backdrop-filter:blur(12px);box-shadow:0 16px 40px rgba(8,22,52,.16);padding:14px 16px;display:flex;align-items:center;gap:10px}
.setupActions p{margin-right:auto;color:var(--slate-500);font-size:12px}
.setupActions .primaryBtn,.setupActions .ghostBtn{min-height:44px;padding:0 18px}
.setupBackBtn.hidden{display:none}
.retargetingPolicy{grid-column:1/-1;border-top:1px solid var(--line);padding-top:18px;margin-top:2px}
.retargetingPolicy h5{font-size:13px;font-weight:950;color:var(--navy-800);margin-bottom:10px}
.policyGuardrails{list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px}
.policyGuardrails li{display:flex;align-items:flex-start;gap:8px;color:var(--slate-700);font-size:11.5px;line-height:1.45}
.policyGuardrails li:before{content:"✓";width:18px;height:18px;border-radius:6px;background:var(--green-100);color:#087E50;display:grid;place-items:center;flex:0 0 auto;font-size:10px;font-weight:950}
.retargetingView{display:grid;gap:18px}
.rtgHero{border-radius:24px;padding:28px;background:radial-gradient(circle at 82% 10%,rgba(37,191,255,.30),transparent 34%),linear-gradient(145deg,var(--navy-950),var(--navy-700));color:#fff;display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;align-items:stretch;box-shadow:var(--shadow)}
.rtgHero h3{font-family:var(--font-display);font-size:30px;line-height:1.13;letter-spacing:-.04em;margin-top:12px}
.rtgHero p{color:#C6D4E8;max-width:720px;margin-top:10px;font-size:15px;line-height:1.6}
.rtgSafeBadge,.rtgStatusChip{display:inline-flex;align-items:center;width:max-content;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:950}
.rtgSafeBadge{background:rgba(20,169,113,.17);border:1px solid rgba(157,240,200,.22);color:#9DF0C8}
.rtgSafeBadge:before{content:"";width:7px;height:7px;border-radius:50%;background:#45D997;margin-right:7px;box-shadow:0 0 0 4px rgba(69,217,151,.12)}
.rtgHeroActions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
.rtgHeroActions .ghostBtn{background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.20);color:#fff}
.rtgSafetyCard{border:1px solid rgba(255,255,255,.15);border-radius:20px;background:rgba(255,255,255,.08);padding:20px;display:grid;align-content:start;gap:12px}
.rtgSafetyCard h4{font-size:15px;font-weight:950}
.rtgSafetyRow{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:flex-start;color:#D7E4F6;font-size:12px;font-weight:750}
.rtgSafetyRow i{width:22px;height:22px;border-radius:8px;background:rgba(20,169,113,.18);color:#9DF0C8;display:grid;place-items:center;font-style:normal;font-weight:950}
.rtgSafetyRow.block i{background:rgba(245,165,36,.16);color:#FFD28A}
.rtgMetrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}
.rtgMetric{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px;box-shadow:var(--shadow-soft)}
.rtgMetric span{display:block;color:var(--slate-500);font-size:12px;font-weight:850}
.rtgMetric strong{display:block;margin-top:8px;font-size:32px;line-height:1;font-weight:950;letter-spacing:-.05em}
.rtgMainGrid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(290px,.75fr);gap:18px;align-items:start}
.rtgPanel{background:#fff;border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow);overflow:hidden}
.rtgPanelHead{padding:20px 22px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
.rtgPanelHead h4{font-size:19px;font-weight:950;letter-spacing:-.03em}
.rtgPanelHead p{color:var(--slate-500);font-size:12px;font-weight:700;margin-top:4px}
.rtgQueue{display:grid}
.rtgJob{padding:18px 22px;border-top:1px solid var(--line);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px}
.rtgJob:first-child{border-top:0}
.rtgJobTop{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.rtgJobTop strong{font-size:14px;font-weight:950}
.rtgJob p{color:var(--slate-500);font-size:12px;line-height:1.5;margin-top:7px}
.rtgJobPreview{border-left:3px solid #BDEBFF;padding-left:10px;color:var(--slate-700)!important}
.rtgJobActions{display:flex;gap:7px;align-items:flex-start;flex-wrap:wrap;justify-content:flex-end}
.rtgJobActions button{min-height:34px;padding:0 10px}
.rtgStatusChip.pending_approval,.rtgStatusChip.simulation_pending{background:var(--amber-100);color:#98640E}
.rtgStatusChip.approved{background:#EFEAFF;color:#5941A9}
.rtgStatusChip.simulated{background:var(--cyan-100);color:#057BB6}
.rtgStatusChip.cancelled{background:var(--slate-100);color:var(--slate-700)}
.rtgStatusChip.blocked{background:#FFE8E8;color:#B22E2E}
.rtgStatusChip.sent{background:var(--green-100);color:#087E50}
.rtgSide{display:grid;gap:18px}
.rtgPolicyList,.rtgBlockerList,.rtgHistory{display:grid}
.rtgPolicyRow,.rtgBlocker,.rtgHistoryRow{padding:13px 18px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;align-items:flex-start;font-size:12px}
.rtgPolicyRow:first-child,.rtgBlocker:first-child,.rtgHistoryRow:first-child{border-top:0}
.rtgPolicyRow span,.rtgHistoryRow span{color:var(--slate-500);font-weight:700}
.rtgPolicyRow strong,.rtgBlocker strong{font-weight:950;text-align:right}
.rtgBlocker{align-items:center}.rtgBlocker strong{color:#B22E2E}.rtgBlocker span{color:var(--slate-700);font-weight:800}
.rtgHistoryRow{display:grid;grid-template-columns:1fr auto}.rtgHistoryRow small{grid-column:1/-1;color:var(--slate-500)}
.rtgEmpty{padding:30px 22px;text-align:center;color:var(--slate-500);font-size:13px;font-weight:700}
.rtgPaused{background:#FFF7E8;border-color:#F4D69E}.rtgPaused .rtgPanelHead{border-color:#F4D69E}

@media(max-width:1450px) and (min-width:1181px){
  body.conversations-view .inboxShell{grid-template-columns:320px minmax(380px,1fr) 270px}
  .profile{padding:18px 16px}
}
@media(max-width:1180px) and (min-width:761px){
  body.conversations-view .inboxShell{grid-template-columns:330px minmax(420px,1fr)}
  body.conversations-view .profileColumn{display:none}
}
body.conversations-view:not(.chat-open) .inboxShell{display:block}
body.conversations-view:not(.chat-open) .chatColumn,body.conversations-view:not(.chat-open) .profileColumn{display:none}
body.conversations-view:not(.chat-open) .listColumn{height:100%;border-right:0}
body.conversations-view:not(.chat-open) .threads{grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;padding:16px;overflow:auto}
body.conversations-view:not(.chat-open) .filterIntro{grid-column:1/-1}
body.conversations-view:not(.chat-open) .thread{height:100%;padding:15px}
@media(max-width:1450px) and (min-width:981px){
  body.conversations-view.chat-open .inboxShell{grid-template-columns:minmax(520px,1fr) 300px}
  body.conversations-view.chat-open .listColumn{display:none}
  body.conversations-view.chat-open .profileColumn{display:flex}
}
@media(max-width:980px) and (min-width:761px){
  body.conversations-view.chat-open .inboxShell{display:block}
  body.conversations-view.chat-open .listColumn,body.conversations-view.chat-open .profileColumn{display:none}
  body.conversations-view.chat-open .chatColumn{display:flex;height:100%}
  body.conversations-view.chat-open .mobileCustomerNameCard{display:block}
}
@media(max-width:760px){
  .panelVersionFixed{display:none}.setupView{gap:14px}.setupSummaryPanel{padding:18px 16px;border-radius:17px}.setupSummaryHead{display:grid}.setupFlowSteps,.setupConfigGrid,.questionnaireList{grid-template-columns:1fr}.channelPlan{grid-template-columns:1fr}.setupDetailsToggle{width:100%}.setupProgressPanel{padding:18px 16px;border-radius:17px}.setupProgressBody{gap:12px;align-items:flex-start}.setupStory{font-size:15px;line-height:1.42;padding-right:2px}.setupEyebrow{font-size:9.5px;margin-bottom:6px}.setupStatus{position:static;width:max-content;margin-bottom:8px;padding:5px 9px}.setupProgressRing{width:72px;height:72px;padding:5px}.setupProgressRing strong{font-size:18px}.setupProgressRing span{font-size:6.5px;letter-spacing:.08em}.setupStepper{grid-column:1/-1;margin-top:15px;max-width:none}.setupStepLine{min-width:4px;margin:0 2px}.setupStepDot{width:26px;height:26px;font-size:10.5px}.setupNotice{padding:12px 14px;font-size:12px}.setupGrid,.industryQuestions,.setupAccountsGrid{grid-template-columns:1fr}.setupGrid .wide,.setupAccounts{grid-column:auto}.channelChoices{grid-template-columns:1fr 1fr}.setupStep{padding:18px 16px;border-radius:16px}.setupStepHead{grid-template-columns:38px 1fr;gap:11px;margin-bottom:18px}.setupStepNumber{width:38px;height:38px;font-size:16px}.setupStepHead h4{font-size:17px}.setupStepHead p{font-size:12px}.setupAccounts{padding:15px}.setupActions{display:grid;grid-template-columns:auto 1fr;bottom:76px;padding:12px}.setupActions p{grid-column:1/-1;order:-1;margin:0}.setupActions .setupSaveBtn{display:none}.setupActions .primaryBtn{width:100%}.setupActions.firstStep .primaryBtn{grid-column:1/-1}.setupActions .setupBackBtn{width:44px;padding:0}.retargetingPolicy{grid-column:auto}.policyGuardrails{grid-template-columns:1fr}.rtgHero,.rtgMainGrid{grid-template-columns:1fr}.rtgHero{padding:22px}.rtgSafetyCard{padding:16px}.rtgMetrics{grid-template-columns:1fr 1fr}.rtgJob{grid-template-columns:1fr}.rtgJobActions{justify-content:flex-start}
  .personalityHead{display:grid;padding:18px 16px}.personalityHead h3{font-size:20px}.personalityStatus{width:max-content}.personalityWorkspace{grid-template-columns:1fr}.personalityControls{grid-template-columns:1fr;padding:18px 16px;border-right:0;border-bottom:1px solid var(--line)}.personalityControls .wide,.personalityActions{grid-column:auto}.personalityActions{display:grid;grid-template-columns:1fr}.personalityActions p{margin:0}.personalityActions button{width:100%}.personalityPreview{padding:16px}.personalityChat{min-height:190px}.personalityTestRow{grid-template-columns:1fr}.personalityTestRow button{width:100%}
  body.conversations-view .content{padding:0}
  body.conversations-view .inboxShell{height:auto;min-height:calc(100vh - 174px);display:block}
  body.conversations-view .listColumn,body.conversations-view .chatColumn{border-radius:0;box-shadow:none;min-height:calc(100vh - 174px)}
  .convListControls{padding:14px 14px 10px}
  .mobileOmnichannelStrip{display:flex}
  .convListControls .filters{overflow-x:auto;padding-bottom:2px}
  .convListControls .filters button{min-height:38px}
  .threads{padding:8px 10px 18px}
  .thread{padding:13px}
  .threadStatus{padding-left:51px}
  .chatHead{display:grid;grid-template-columns:auto minmax(0,1fr) auto;padding:12px 14px}
  .chatHead .mobileBack{grid-column:1/-1;width:max-content;margin-bottom:2px}
  .chatHead>.avatarChannelWrap{grid-column:1;grid-row:2}
  .chatIdentity{grid-column:2;grid-row:2}
  .chatCloseButton{grid-column:3;grid-row:2}
  .chatStatusPill{grid-column:2/-1;grid-row:3;width:max-content;margin-left:0}
  .messages{padding:16px 14px;min-height:calc(100vh - 420px)}
  .bubble{max-width:90%;font-size:13.5px}
  .conversationAction{padding:12px 14px 10px}
  body.conversations-view.chat-open .mobileCustomerNameCard{display:block}
  .humanControl{align-items:stretch;display:none;flex-direction:column;padding:12px}
  .humanControl.visible{display:flex}
  .humanControlActions{width:100%}
  .humanControlActions .controlBtn{flex:1;min-height:44px}
  .emojiPicker{width:min(292px,calc(100vw - 42px));grid-template-columns:repeat(8,1fr);padding:10px;gap:4px}
  .emojiPicker button{width:100%;height:31px}
  .guidedAction{padding:14px}
  .guidedFooter{display:grid;grid-template-columns:1fr 1fr}
  .guidedFooter>span{grid-column:1/-1;margin:0;text-align:center}
  .confirmBtn{width:100%;padding:0 12px}
  .stateBand{align-items:flex-start}
  .profileColumn{display:none}
}
${customerAppointments.styles}
${customerBotConfiguration.styles}
</style>
</head>
<body>
<div class="app">
  <header class="mobileTop">
    <div class="mobileBrand" onclick="openProfile()" style="cursor:pointer"><div class="ravLogo">${escapeHtml(panelContext.initials)}</div><div><h1><span id="mobileBrandBusinessName">${escapeHtml(panelContext.businessName)}</span></h1><p>con <span>Nextfor IA</span></p></div></div>
    <div class="mobileTopActions"><button class="mobileLogout" type="button" onclick="logoutCustomerPanel()">Salir</button><div class="mobileAvatar">${escapeHtml(panelContext.avatarInitials)}</div></div>
  </header>
  <div class="mobileBotSwitch" aria-label="Tus bots">
    ${mobileSupportBotButton}
    ${mobileAppointmentBotButton}
  </div>
  <aside class="sidebar">
    <button class="brand" type="button" onclick="openProfile()" aria-label="Editar perfil del negocio">
      <span class="brandAvatar"><span class="ravLogo" id="brandLogo">${escapeHtml(panelContext.initials)}</span></span>
      <span class="brandInfo"><h1><span id="brandBusinessName">${escapeHtml(panelContext.businessName)}</span></h1><p>con <span>Nextfor IA</span></p></span>
      <span class="brandEdit" aria-hidden="true">${PANEL_ICONS.edit}</span>
    </button>
    <div class="botSwitch" aria-label="Tus bots">
      <div class="botSwitchTitle">Tus bots</div>
      ${supportBotButton}
      ${appointmentBotButton}
    </div>
    <nav class="nav" id="navSupport"${panelContext.support && !paymentGateRequired ? "" : ' style="display:none"'} aria-label="Secciones de Atención al cliente">
      <button class="navItem" id="nav-summary" type="button" onclick="showTab('summary')"><span class="navIcon">${PANEL_ICONS.resumen}</span><span>Resumen</span></button>
      <button class="navItem" id="nav-conversations" type="button" onclick="showTab('conversations')"><span class="navIcon">${PANEL_ICONS.conversaciones}</span><span>Conversaciones</span><span class="navBadge" id="navConvCount"></span></button>
      <button class="navItem" id="nav-retargeting" type="button" onclick="showTab('retargeting')"><span class="navIcon">${PANEL_ICONS.gift}</span><span>Seguimientos</span><span class="navBadge" id="navRtgCount"></span></button>
    </nav>
    ${appointmentNav}
    <div class="sidebarFoot">
      <div class="footTitle">Cuenta</div>
      ${planNav}
      ${channelsNav}
      ${paymentGateRequired ? "" : `<button class="navItem" id="nav-setup" type="button" onclick="showTab('setup')"><span class="navIcon">${PANEL_ICONS.settings}</span><span>Configuración</span></button>`}
      ${paymentGateRequired ? "" : notificationsNav}
      ${auth.role === "super_admin" ? `<a class="navItem" href="/admin/super-admin?view=channels"><span class="navIcon">${PANEL_ICONS.settings}</span><span>Volver a Super Admin</span></a>` : ""}
      <button class="navItem logoutItem" id="nav-logout" type="button" onclick="logoutCustomerPanel()"><span class="navIcon">${PANEL_ICONS.logout}</span><span>Cerrar Sesión</span></button>
      <div class="whatsappCard">
        <div class="botsActive"><span class="statusDot"></span><span>${activeBotCount} ${activeBotCount === 1 ? "bot activo" : "bots activos"}</span></div>
        <strong><span class="statusDot" id="channelStatusDot"></span><span id="channelStatusTitle">${panelContext.v2 ? "Bot conectado" : "Bot de atención conectado"}</span></strong>
        <p id="channelStatusDetail">${escapeHtml(panelContext.assignedBotName) + " · Plan " + escapeHtml(panelContext.planName)}</p>
      </div>
      <div class="panelVersion">Versión ${escapeHtml(botVersion)}</div>
    </div>
  </aside>
  <main class="main">
    <header class="topbar">
      <div class="pageTitle"><h2 id="pageTitle">${escapeHtml(initialTitle)}</h2><p id="pageSubtitle">${escapeHtml(initialSubtitle)}</p><div class="omnichannelStrip"><span>Todo en una bandeja</span><i></i><span class="channelStripBadges" data-channel-strip></span></div></div>
      <div class="toolbar"${toolbarHidden ? ' style="display:none"' : ""}><div class="periods"><button type="button">Hoy</button><button class="active" type="button">7 días</button><button type="button">30 días</button></div><span class="convImpact" id="conversationImpact">0% resuelto por la IA</span><div class="avatar">${escapeHtml(panelContext.avatarInitials)}</div></div>
    </header>
    <div class="content">
      <section class="${viewClass('panel-summary')}" id="panel-summary">
        <div class="mobilePeriodShell"><div class="periods"><button type="button">Hoy</button><button class="active" type="button">7 días</button><button type="button">30 días</button></div></div>
        <div class="summary">
          <div class="iaBanner"><div class="iaIcon">✧</div><p id="heroLine">Esta semana atendiste a <strong>0 clientes</strong> entre WhatsApp, Instagram y Messenger — tu equipo se ahorró trabajo repetitivo, sin dejar un solo mensaje sin responder.</p></div>
          <section class="setupReminder" id="setupHomeCard"${panelContext.customerSetupCompleted ? " hidden" : ""}>
            <span class="setupReminderIcon">${PANEL_ICONS.settings}</span>
            <div><h3 id="setupHomeTitle">Termina de configurar tu Nextfor IA</h3><p id="setupHomeCopy">Completa la información de tu negocio para que el bot responda con tu voz, políticas y objetivos.</p></div>
            <div class="setupReminderProgress"><span>Progreso</span><strong id="setupHomeProgress">0%</strong><div class="setupReminderTrack"><span id="setupHomeProgressBar"></span></div></div>
            <button class="primaryBtn" id="setupHomeButton" type="button" onclick="showTab('setup')">Continuar configuración</button>
          </section>
          <div class="metricRow">
            <article class="card metric"><div class="metricTop"><span class="metricLabel">Ventas asistidas</span><span class="metricIcon">▣</span></div><div><strong class="metricValue" id="kSales">-</strong><p class="metricSub"><span class="delta" id="kSalesDelta">↗ +0</span><span id="kSalesSub">ventas asistidas</span></p></div></article>
            <article class="card metric"><div class="metricTop"><span class="metricLabel">Clientes<br>atendidos</span><span class="metricIcon">♙</span></div><div><strong class="metricValue" id="kClients">-</strong><p class="metricSub"><span class="delta">↗ +0%</span><span>personas únicas</span></p></div></article>
            <article class="card metric solvedCard"><div class="metricTop"><span class="metricLabel">✧ Resueltas por el bot</span></div><div><strong class="metricValue" id="kResolved">-</strong><p class="metricSub" id="kResolvedSub">soluciones sin ayuda humana</p><div class="progress"><span id="resolvedProgress"></span></div></div></article>
            <article class="card metric closingMetric"><div class="metricTop"><span class="metricLabel">Cierres por<br>confirmar</span><span class="metricIcon amber">${PANEL_ICONS.intervencion}</span></div><div><strong class="metricValue" id="kClosings">-</strong><p class="metricSub"><span id="kClosingsSub">chats listos para cerrar la venta</span></p></div></article>
            <article class="card metric"><div class="metricTop"><span class="metricLabel">Tiempo de<br>respuesta</span><span class="metricIcon amber">◷</span></div><div><strong class="metricValue" id="kResponse">24/7</strong><p class="metricSub">promedio · responde siempre</p></div></article>
          </div>
          <section class="card chartCard"><div class="chartHead"><div><h3>Clientes atendidos por día</h3><p>Volumen que absorbió el bot · Últimos 7 días</p></div><span class="periodBadge" id="activityRange">Sin datos</span></div><div class="areaChart" id="activityChart"></div></section>
          <aside class="sideStack">
            <section class="card satCard"><div class="ring" id="satRing"><div class="ringInner"><strong id="satValue">-</strong><span>de 5</span></div></div><div><h3>Satisfacción</h3><p id="satCopy">Sin calificaciones suficientes</p><span class="positive" id="satPositive">0 % positivas</span></div></section>
            <section class="card darkInsight"><h3>✧ Resumen IA</h3><p id="iaSummary">El bot está listo para mostrar aprendizajes cuando tenga más conversaciones.</p></section>
          </aside>
          <div class="bottomGrid">
            <section class="card listCard"><h3>Lo que te pidieron y no tenías</h3><p>Cada búsqueda es tu próximo pedido.</p><div class="requestList" id="gapList"></div></section>
            <section class="card listCard"><h3>Qué logró el bot</h3><p>Resolvió, vendió y derivó cuando hacía falta.</p><div class="outcomeList" id="outcomeList"></div></section>
            <section class="card nextCard"><h3>Tu próximo paso</h3><p id="nextStep">Cuando haya conversaciones pendientes, aquí verás qué atender primero.</p><button type="button" onclick="showNeedsYou()">Atender ahora</button></section>
          </div>
        </div>
      </section>

      <section class="${viewClass('panel-inbox')}" id="panel-inbox">
        <div class="inboxShell">
          <section class="column listColumn">
            <div class="convListControls"><div class="searchBox"><span class="searchIcon" aria-hidden="true">⌕</span><input id="conversationSearch" aria-label="Buscar conversaciones" placeholder="Buscar por nombre, teléfono, correo o mensaje" oninput="renderThreads()"></div><div class="mobileOmnichannelStrip"><span>Todo en una bandeja</span><i></i><span class="channelStripBadges" data-channel-strip></span></div><div class="filters"><button id="filter-all" type="button" onclick="setConversationFilter('all')">Todas <span>0</span></button><button id="filter-you" type="button" onclick="setConversationFilter('you')">Necesitan de ti <span>0</span></button><button id="filter-resolved" type="button" onclick="setConversationFilter('resolved')">Resueltas <span>0</span></button></div></div>
            <div class="threads" id="threadList"><div class="empty">Cargando conversaciones...</div></div>
          </section>
          <section class="column chatColumn">
            <div class="chatHead"><button class="mobileBack" type="button" onclick="closeConversation()">← Chats</button><span class="avatarChannelWrap"><span class="contactAvatar" id="chatAvatar">—</span><span class="channelBadge floating" id="chatChannelBadge" hidden></span></span><div class="chatIdentity"><h3 id="chatTitle">Selecciona una conversación</h3><p id="chatSubtitle">Elige un cliente para ver el historial.</p></div><span class="chatStatusPill" id="chatStatusPill">—</span><button class="chatCloseButton" id="chatCloseButton" type="button" onclick="closeConversation()" aria-label="Cerrar conversación" title="Cerrar conversación">×</button></div>
            <div class="messages" id="messages"><div class="empty">Sin conversación seleccionada.</div></div>
            <div class="conversationAction">
              <section class="mobileCustomerNameCard"><h4>Nombre del cliente</h4><input id="mobileCustomerProfileName" maxlength="80" autocomplete="off" placeholder="Escribe el nombre" oninput="markMetaDirty()"><div class="nameSuggestion" id="mobileNameSuggestion" hidden><span>✦ Nextfor sugiere<strong id="mobileSuggestedCustomerName"></strong></span><button type="button" onclick="useSuggestedCustomerName(true)">Usar nombre</button></div><div class="mobileCustomerNameActions"><small id="mobileMetaHint">Confírmalo para recordarlo.</small><button class="ghostBtn" id="mobileSaveMetaBtn" type="button" onclick="saveCustomerMeta()">Guardar</button></div></section>
              <section class="humanControl" id="humanControl" aria-live="polite"><div class="humanControlCopy"><strong id="humanControlTitle">La IA está atendiendo</strong><span id="humanControlCopy">Toma el control para escribirle al cliente.</span></div><div class="humanControlActions"><button class="controlBtn" id="takeControlBtn" type="button" onclick="takeControl()">Tomar control</button><button class="controlBtn release" id="releaseControlBtn" type="button" onclick="releaseControl()">Devolver a la IA</button></div></section>
              <section class="guidedAction" id="guidedAction"><div class="guidedTitle"><span>✦</span><strong>La IA ya redactó la respuesta por ti</strong></div><p id="guidedContext">Un mensaje tuyo puede cerrar esta conversación.</p><div class="guidedReplyRow"><textarea id="guidedReply" maxlength="1200" placeholder="La respuesta sugerida aparece aquí…" oninput="updateGuidedCount()"></textarea><div class="emojiControl"><button class="emojiButton" id="guidedEmojiButton" type="button" onclick="toggleEmojiPicker('guidedReply','guidedEmojiPicker',this,event)" aria-label="Agregar emoji" aria-controls="guidedEmojiPicker" aria-expanded="false">😊</button><div class="emojiPicker" id="guidedEmojiPicker" role="dialog" aria-label="Emojis" hidden>${emojiButtons}</div></div></div><div class="guidedFooter"><button class="confirmBtn" id="confirmSendBtn" type="button" onclick="confirmAndSend()">Confirmar y enviar →</button><button class="textBtn" id="alreadyResolvedBtn" type="button" onclick="resolveConversation()">Ya está resuelta</button><span>Solo revisas y envías — la IA hizo lo difícil.</span></div></section>
              <div class="stateBand" id="stateBand"></div>
              <div class="composer" id="composer"><div class="composerRow"><div class="emojiControl"><button class="emojiButton" id="replyEmojiButton" type="button" onclick="toggleEmojiPicker('replyText','replyEmojiPicker',this,event)" aria-label="Agregar emoji" aria-controls="replyEmojiPicker" aria-expanded="false">😊</button><div class="emojiPicker" id="replyEmojiPicker" role="dialog" aria-label="Emojis" hidden>${emojiButtons}</div></div><input id="replyText" maxlength="1200" placeholder="Escribe para responder tú mismo…" oninput="updateReplyCount()"><button class="sendCircle" type="button" id="sendCircleBtn" onclick="sendReply()" aria-label="Enviar mensaje">➤</button></div><div class="composerActions"><small id="replyCount">0/1200</small><button class="primaryBtn" type="button" id="sendBtn" onclick="sendReply()">Enviar</button></div></div>
              <div class="statusLine" id="chatStatus" aria-live="polite">Listo.</div>
            </div>
          </section>
          <aside class="column profileColumn"><div class="profile"><div class="profileIdentity"><span class="avatarChannelWrap"><span class="contactAvatar big" id="profileAvatar">—</span><span class="channelBadge floating large" id="profileChannelBadge" hidden></span></span><h3 id="profileName">Selecciona un cliente</h3><p id="profileContact">—</p><button class="copyContact" id="copyBtn" type="button" onclick="copyPhone()">Copiar número</button></div><section class="relationshipCard"><span id="relationshipEyebrow">Relación</span><div><strong id="relationshipValue">—</strong><small id="relationshipLabel"></small></div><p id="relationshipCopy">Selecciona una conversación para ver el valor que la IA está ayudando a construir.</p></section><div class="customerFacts" id="customerFacts"></div><section class="aiUnderstood"><span>✦ Lo que la IA entendió</span><strong id="aiIntent">Selecciona una conversación.</strong><div class="aiChips" id="aiChips"></div></section><section class="nameCard"><h4>Nombre del cliente</h4><input id="customerProfileName" maxlength="80" autocomplete="off" placeholder="Escribe el nombre" oninput="markMetaDirty()"><div class="nameSuggestion" id="nameSuggestion" hidden><span>✦ Nextfor sugiere<strong id="suggestedCustomerName"></strong></span><button type="button" onclick="useSuggestedCustomerName()">Usar nombre</button></div><p>Confírmalo o corrígelo. Nextfor lo recordará en futuras conversaciones.</p></section><section class="noteCard"><h4>Nota interna</h4><textarea id="customerNote" placeholder="Agrega contexto útil para tu equipo…" oninput="markMetaDirty()"></textarea><button class="ghostBtn" id="saveMetaBtn" type="button" onclick="saveCustomerMeta()">Guardar perfil</button><p id="metaHint">Selecciona una conversación.</p></section></div></aside>
        </div>
      </section>

      ${appointmentPanelSection}

      <section class="${viewClass('panel-plan')}" id="panel-plan">
        <div class="planView">
          ${paymentGateRequired ? `<section class="planBlock">
            <h3>Completa Wompi para activar tu panel</h3>
            <p>Tu entrenamiento ya quedó guardado. El panel operativo se desbloquea cuando Wompi confirma el pago o tu contrato queda listo para crear el bot.</p>
            <div class="planCatalogNotice">Estás en el paso correcto: revisa la facturación y usa el botón de Wompi cuando esté disponible.</div>
          </section>` : ""}

          <section class="planHero">
            <div>
              <span class="planPill ok">Activo</span>
              <h3 id="planName">Bot ${escapeHtml(panelContext.v2 ? panelContext.assignedBotName : "Atención al cliente")}</h3>
              <p>Tu asistente de Nextfor IA está atendiendo clientes 24/7. Aquí ves tu plan, consumo y caminos para crecer sin sorpresas.</p>
              <div class="planMeta"><span class="planPill" id="planMonthly">${panelContext.v2 ? "Plan " + escapeHtml(panelContext.planName) : "$299.900/mes"}</span><span class="planPill" id="planRenewal">${panelContext.v2 ? "Servicio activo" : "Renueva el 1 de agosto"}</span><span class="planPill">${escapeHtml(panelContext.businessName)}</span></div>
            </div>
            <article class="usageCard">
              <div class="usageTop"><div><h4>Consumo de chats</h4><span id="usageMessage">Calculando consumo…</span></div><div><strong id="usagePct">0%</strong><span id="usageState">Vas al día</span></div></div>
              <div class="usageBar"><div class="usageFill" id="usageFill"></div></div>
              <p class="usageMsg"><strong id="chatsConsumed">0</strong> consumidos · <strong id="chatsIncluded">0</strong> incluidos · <strong id="chatsAvailable">0</strong> disponibles</p>
            </article>
          </section>

          ${panelContext.v2 ? "" : `<section class="planBlock recommendation">
            <div class="recommendationText"><div class="recommendationIcon">${PANEL_ICONS.sparkles}</div><div><h3>Te recomiendo mirar esto</h3><p id="planRecommendation">Tu plan actual sigue siendo el adecuado para este ritmo de consumo.</p></div></div>
            <div class="recommendationActions"><button class="primaryBtn" type="button" onclick="scrollToPlan('duo')">Ver plan recomendado</button><button class="ghostBtn" type="button">Mantener plan actual</button></div>
          </section>`}

          ${options.paymentsV1Enabled ? `<section class="planBlock" id="billingBlock">
            <h3>Facturación de mi plan</h3>
            <p>El pago se confirma por webhook de Wompi. La respuesta del navegador por sí sola nunca activa tu suscripción.</p>
            <div id="billingSummary"><div class="planCatalogNotice">Cargando facturación…</div></div>
          </section>` : ""}

          <section class="planBlock">
            <h3>Módulos del panel</h3>
            <p>Cada bot tiene sus propias métricas y se activa cuando el servicio está funcionando.</p>
            <div class="serviceGrid">
              ${planModuleCards}
            </div>
          </section>

          <section class="planBlock">
            <h3>Planes disponibles</h3>
            <p>Elige el bot que mejor acompaña la operación de tu negocio.</p>
            <div class="planGrid" id="planCatalogGrid" data-state="loading">
              <div class="planCatalogNotice">Cargando planes…</div>
            </div>
          </section>

          <section class="planBlock">
            <h3>Paquetes de rescate</h3>
            <p>Si te acercas al límite, puedes sumar chats extra sin cambiar de plan.</p>
            <div class="rescueGrid"><article class="rescueCard"><strong><span class="sectionIcon">${PANEL_ICONS.package}</span>20 chats</strong><span>Precio disponible próximamente</span><button class="primaryBtn" type="button" style="margin-top:14px">Comprar chats adicionales</button></article><article class="rescueCard"><strong><span class="sectionIcon">${PANEL_ICONS.package}</span>50 chats</strong><span>Precio disponible próximamente</span><button class="primaryBtn" type="button" style="margin-top:14px">Comprar chats adicionales</button></article></div>
          </section>

          <div class="refPromoGrid">
            <section class="planBlock"><h3><span class="sectionIcon">${PANEL_ICONS.gift}</span>Programa de referidos</h3><p>Refiere un nuevo cliente y recibe un mes gratis de tu plan actual.</p><div class="refCode"><code id="refCode">${escapeHtml(panelContext.referralCode)}</code><button class="ghostBtn" type="button" onclick="copyReferral()">Copiar</button></div><p id="refHint" style="margin-top:12px">0 referidos activos · Se activa cuando tu referido esté activo y realice su primer pago a Nextfor IA.</p><button class="primaryBtn" type="button" onclick="shareReferral()" style="margin-top:14px">Compartir</button></section>
            ${panelContext.v2 ? "" : `<section class="planBlock promoCard"><h3><span class="sectionIcon">${PANEL_ICONS.sparkles}</span>Promoción activa</h3><p><strong>50% off en el setup de Nextfor Dúo</strong></p><p>Si decides subir de plan este mes, puedes ahorrar en la implementación inicial.</p><button class="primaryBtn" type="button" style="margin-top:16px">Ver promoción</button></section>`}
          </div>

          <section class="planBlock">
            <h3>Transparencia del plan</h3>
            <p>Claro desde el principio: qué incluye, qué no incluye y cuándo habría costos adicionales.</p>
            <div class="transparencyGrid">
              <div class="transparencyBox"><h4>Qué incluye</h4><ul><li>WhatsApp, Instagram y Messenger</li><li>Panel de control unificado</li><li>Respuestas humanas asistidas</li><li>Soporte base</li></ul></div>
              <div class="transparencyBox"><h4>Qué no incluye</h4><ul><li>Campañas pagas</li><li>Diseño de piezas externas</li><li>Integraciones nuevas no pactadas</li></ul></div>
              <div class="transparencyBox"><h4>Límites</h4><ul><li>Chats incluidos por definir</li><li>Uso justo del servicio</li><li>Una marca por panel</li></ul></div>
              <div class="transparencyBox"><h4>Condiciones</h4><ul><li>Facturación mensual</li><li>Cancela cuando quieras</li><li>Sin permanencia</li><li>Costos extra se aprueban antes</li></ul></div>
            </div>
          </section>
        </div>
      </section>

      ${channelConnectionsV1Enabled ? `<section class="${viewClass('panel-channels')}" id="panel-channels">
        <div class="channelsView">
          <section class="channelsHero">
            <h3>Finaliza el entrenamiento de tu Nextfor</h3>
            <p>Ya le enseñaste cómo debe atender. Ahora solo falta decirle dónde recibirá a tus clientes. Empieza con WhatsApp y suma Instagram o Facebook si tus clientes también te escriben por ahí.</p>
            <div class="metaConnectionSteps" aria-label="Pasos finales con Meta">
              <article class="metaConnectionStep"><b>1</b><strong>Continúa con Meta</strong><span>Entrarás con la cuenta de tu negocio.</span></article>
              <article class="metaConnectionStep"><b>2</b><strong>Elige dónde atenderá</strong><span>Selecciona el WhatsApp, Instagram o Facebook correcto.</span></article>
              <article class="metaConnectionStep"><b>3</b><strong>Tu Nextfor queda listo</strong><span>Nosotros revisamos que todo esté bien antes de activarlo.</span></article>
            </div>
          </section>
          <div class="connectionHubGrid" id="connectionHubSummary">
            <article class="connectionHubCard"><small>Cuestionario</small><strong>Cargando…</strong><p>Estamos leyendo tu configuración.</p></article>
          </div>
          <div class="channelsList" id="channelConnectionCards">
            <div class="planCatalogNotice">Cargando tus canales…</div>
          </div>
          <section class="commerceConnections">
            <div class="sectionHead">
              <div>
                <h3>Conecta tu tienda</h3>
                <p>Shopify es opcional. Puedes conectarlo ahora o terminarlo después desde este mismo panel.</p>
              </div>
            </div>
            <div class="channelsList" id="commerceConnectorCards">
              <div class="planCatalogNotice">Cargando tu conector de comercio…</div>
            </div>
          </section>
          <p class="channelsMessage" id="channelConnectionMessage" role="status" aria-live="polite"></p>
          <button class="channelsLater" type="button" onclick="showTab('summary')">Hacer esto más tarde</button>
        </div>
      </section>` : ""}

      <section class="${viewClass('panel-setup')}" id="panel-setup">
        <div class="setupView">
          ${customerBotConfiguration.markup}
          <section class="personalityStudio" id="personalityStudio">
            <div class="personalityHead">
              <div>
                <small>✧ Personalidad del bot</small>
                <h3>Haz que responda como tu equipo.</h3>
                <p>Controla qué tan corto responde, su tono, los emojis y el saludo. Pruébalo aquí antes de aplicarlo a conversaciones nuevas.</p>
              </div>
              <span class="personalityStatus" id="personalityStatus">Cargando configuración</span>
            </div>
            <div class="personalityWorkspace">
              <div class="personalityControls" id="personalityControls">
                <div class="personalityField wide">
                  <span>¿Qué tan largas deben ser las respuestas?</span>
                  <div class="personalityLength">
                    <label><input type="radio" name="personalityLength" value="muy_breve" checked onchange="markPersonalityDirty()"><span>Muy cortas</span></label>
                    <label><input type="radio" name="personalityLength" value="breve" onchange="markPersonalityDirty()"><span>Equilibradas</span></label>
                    <label><input type="radio" name="personalityLength" value="detallada" onchange="markPersonalityDirty()"><span>Detalladas</span></label>
                  </div>
                  <small>“Muy cortas” responde normalmente en una o dos frases y evita menús innecesarios.</small>
                </div>
                <label class="personalityField">
                  <span>Tono</span>
                  <select id="personalityTone" onchange="markPersonalityDirty()">
                    <option value="cercano_directo">Cercano y directo</option>
                    <option value="calido">Cálido y empático</option>
                    <option value="profesional">Profesional</option>
                    <option value="energetico">Ágil y entusiasta</option>
                    <option value="personalizado">Personalizado</option>
                  </select>
                </label>
                <label class="personalityField">
                  <span>Emojis</span>
                  <select id="personalityEmojis" onchange="markPersonalityDirty()">
                    <option value="ninguno">Sin emojis</option>
                    <option value="pocos">Pocos</option>
                    <option value="moderados">Moderados</option>
                  </select>
                </label>
                <label class="personalityField wide" id="personalityCustomToneField" hidden>
                  <span>Describe el tono</span>
                  <input id="personalityCustomTone" maxlength="1200" placeholder="Ej. como un asesor experto, amable y colombiano." oninput="markPersonalityDirty()">
                </label>
                <label class="personalityField wide">
                  <span>Saludo</span>
                  <textarea id="personalityGreeting" maxlength="500" placeholder="Ej. ¡Hola! Soy tu asistente 😊 ¿En qué puedo ayudarte hoy?" oninput="markPersonalityDirty();previewPersonalityGreeting()"></textarea>
                  <small>Úsalo solo al iniciar una conversación. Recomendamos una frase y una pregunta.</small>
                </label>
                <label class="personalityField">
                  <span>Palabras que sí debe usar</span>
                  <textarea id="personalityPreferredWords" maxlength="1200" placeholder="Ej. regalo, juguete ideal, con gusto" oninput="markPersonalityDirty()"></textarea>
                </label>
                <label class="personalityField">
                  <span>Palabras que debe evitar</span>
                  <textarea id="personalityAvoidedWords" maxlength="1200" placeholder="Ej. barato, garantizado, estimado usuario" oninput="markPersonalityDirty()"></textarea>
                </label>
                <label class="personalityField wide">
                  <span>Instrucciones adicionales</span>
                  <textarea id="personalityInstructions" maxlength="3000" placeholder="Ej. responde primero y luego haz una sola pregunta; no repitas el nombre de la marca." oninput="markPersonalityDirty()"></textarea>
                </label>
                <div class="personalityActions">
                  <p id="personalityMessage">Los cambios se aplican únicamente cuando presionas guardar.</p>
                  <button class="primaryBtn" id="savePersonalityBtn" type="button" onclick="saveBotPersonality()">Guardar y aplicar</button>
                </div>
              </div>
              <aside class="personalityPreview">
                <div class="personalityPreviewHead"><span class="personalityBotAvatar">${escapeHtml(panelContext.initials)}</span><div><strong>Prueba privada</strong><span>no se envía al cliente</span></div></div>
                <div class="personalityChat" aria-live="polite">
                  <div class="personalityBubble user" id="personalityUserBubble">Hola</div>
                  <div class="personalityBubble bot" id="personalityBotBubble">Cargando tu saludo…</div>
                </div>
                <div class="personalitySamples">
                  <button type="button" onclick="setPersonalitySample('Hola')">Saludo</button>
                  <button type="button" onclick="setPersonalitySample('Busco un regalo para una niña de 7 años')">Recomendación</button>
                  <button type="button" onclick="setPersonalitySample('¿Cuánto tarda el envío?')">Envíos</button>
                </div>
                <div class="personalityTestRow">
                  <input id="personalityTestInput" maxlength="800" value="Hola" placeholder="Escribe como si fueras un cliente" onkeydown="if(event.key==='Enter'){event.preventDefault();testBotPersonality()}">
                  <button class="primaryBtn" id="testPersonalityBtn" type="button" onclick="testBotPersonality()">Probar respuesta</button>
                </div>
                <p class="personalitySafety">La prueba usa la información real de tu empresa, pero no crea una conversación ni envía mensajes por WhatsApp o Instagram.</p>
              </aside>
            </div>
          </section>
          <section class="setupSummaryPanel">
            <div class="setupSummaryHead">
              <div><h3>Configuración de tu bot</h3><p>Este es el resumen práctico de lo que entrenaste. Los detalles completos quedan guardados en el mismo registro de tu empresa para el Customer Panel y Super Admin.</p></div>
              <button class="setupDetailsToggle" id="setupDetailsToggle" type="button" onclick="toggleSetupDetails()">Ver cuestionario completo</button>
            </div>
            <div class="setupFlowSteps">
              <article class="setupFlowStep"><b>1</b><strong>Cuestionario</strong><span>Información guardada por empresa.</span></article>
              <article class="setupFlowStep"><b>2</b><strong>Resumen</strong><span>Revisión rápida de negocio, bot y reglas.</span></article>
              <article class="setupFlowStep next"><b>3</b><strong>Finalizar entrenamiento</strong><span>Elige dónde atenderá tu Nextfor.</span></article>
              <article class="setupFlowStep"><b>4</b><strong>Administrar</strong><span>Todo queda visible desde este panel.</span></article>
            </div>
            <div class="setupConfigGrid" id="setupConfigSummary"><article class="setupConfigCard"><small>Estado</small><strong>Cargando…</strong><p>Estamos leyendo la configuración guardada.</p></article></div>
            <div class="channelPlan"><div><h4>Último paso: dile dónde atender</h4><p id="channelConnectionSummary">${channelConnectionsV1Enabled ? "Empieza con WhatsApp. Instagram y Facebook pueden esperar si todavía no los necesitas." : "Este paso todavía no está disponible para esta cuenta."}</p></div>${channelConnectionsV1Enabled ? '<button class="primaryBtn" type="button" onclick="showTab(\'channels\')">Finalizar entrenamiento</button>' : '<button class="primaryBtn" type="button" disabled>Pendiente</button>'}</div>
            <div class="onboardingDetails" id="onboardingDetails"><div class="questionnaireList" id="onboardingQuestionnaireList"><article class="questionnaireItem"><small>Cuestionario</small><strong>Cargando respuestas…</strong></article></div></div>
          </section>
          <div class="setupDetailsPanel" id="setupDetailsPanel" hidden>
          <section class="setupProgressPanel">
            <div class="setupProgressBody">
              <div class="setupProgressCopy">
                <span class="setupStatus" id="setupPublishedStatus">No activa</span>
                <div class="setupEyebrow" id="setupEyebrow">Paso 1 de 7 · Tu negocio</div>
                <p class="setupStory" id="setupStory">Nadie conoce tu negocio como tú. Empieza por lo esencial y tu bot aprenderá a presentarlo igual de bien.</p>
                <div class="setupStepper" id="setupStepper" aria-label="Progreso de configuración"></div>
              </div>
              <div class="setupProgressRing" id="setupCompletion"><div><span><strong id="setupCompletionValue">14%</strong>completado</span></div></div>
            </div>
          </section>

          <div class="setupNotice" id="setupNotice"><span class="setupNoticeIcon">ⓘ</span><span><strong>Simple y seguro:</strong> avanza paso a paso y guarda cuando quieras. Solo “Activar en el bot” publica la configuración y la aplica a los mensajes nuevos.</span><a href="/admin/client-onboarding">Abrir alta inicial</a></div>

          <form class="setupForm" id="botSetupForm" oninput="markSetupDirty()">
            <section class="setupStep active" data-setup-step="0">
              <div class="setupStepHead"><span class="setupStepNumber">1</span><div><h4>Empecemos por tu negocio</h4><p>Esto permite que el bot se presente bien y recomiende con contexto.</p></div></div>
              <div class="setupGrid">
                <label class="setupField"><span>¿Cómo se llama tu negocio?</span><input data-setup="business.name" maxlength="120" placeholder="Ej. ${escapeHtml(panelContext.businessName)}"></label>
                <label class="setupField"><span>¿Cómo quieres llamar a tu bot?</span><input data-setup="business.bot_name" maxlength="80" placeholder="Ej. ${escapeHtml(panelContext.v2 ? "Asistente " + panelContext.initials : "Tu bot")}"></label>
                <label class="setupField"><span>¿A qué industria pertenece?</span><select data-setup="business.industry" id="setupIndustry" onchange="renderIndustryQuestions()"></select></label>
                <label class="setupField"><span>Sitio web o catálogo</span><input data-setup="business.website" maxlength="500" placeholder="https://..."></label>
                <label class="setupField"><span>¿Con qué plataforma está hecha tu web?</span><select data-setup="business.web_platform"><option value="">Selecciona una opción</option><option value="shopify">Shopify</option><option value="woocommerce">WooCommerce (WordPress)</option><option value="wix">Wix</option><option value="squarespace">Squarespace</option><option value="social_shop">Tienda en Instagram/Facebook</option><option value="other">Otra</option><option value="none">Aún no tengo</option></select></label>
                <div></div>
                <label class="setupField wide"><span>En una frase, ¿qué hace tu negocio?</span><textarea data-setup="business.description" placeholder="Qué vendes u ofreces y por qué te buscan tus clientes."></textarea></label>
                <label class="setupField"><span>¿Quién es tu cliente ideal?</span><textarea data-setup="business.audience" placeholder="Personas, empresas, edades, necesidades…"></textarea></label>
                <label class="setupField"><span>¿Qué te hace diferente?</span><textarea data-setup="business.differentiators" placeholder="Servicio, rapidez, experiencia, precio, calidad…"></textarea></label>
              </div>
            </section>

            <section class="setupStep" data-setup-step="1">
              <div class="setupStepHead"><span class="setupStepNumber">2</span><div><h4>Sedes, horarios y cómo llegar</h4><p>Incluye cada punto físico o virtual que tus clientes puedan necesitar.</p></div></div>
              <div class="setupGrid">
                <label class="setupField"><span>¿Qué sedes o puntos tienes?</span><textarea data-setup="presence.locations" placeholder="Nombre, dirección y ciudad de cada sede."></textarea></label>
                <label class="setupField"><span>¿Cómo llega una persona?</span><textarea data-setup="presence.how_to_arrive" placeholder="Referencias, parqueadero, piso, local o enlace de Maps."></textarea></label>
                <label class="setupField"><span>¿Cuáles son tus horarios?</span><textarea data-setup="presence.hours" placeholder="Días, horas, festivos y diferencias por sede."></textarea></label>
                <label class="setupField"><span>¿En qué zonas atiendes?</span><textarea data-setup="presence.coverage" placeholder="Ciudades, países, zonas de entrega o atención virtual."></textarea></label>
                <label class="setupField"><span>País principal de atención</span><input data-setup="presence.service_country_name" maxlength="80" placeholder="Ej. Colombia"></label>
                <label class="setupField"><span>Código ISO del país</span><input data-setup="presence.service_country_code" maxlength="2" placeholder="Ej. CO" autocapitalize="characters"></label>
                <div class="setupField wide"><span>Validación de ubicación</span><div class="channelChoices"><label class="channelChoice"><input type="checkbox" data-setup="presence.foreign_number_check_enabled">Preguntar a los números extranjeros si están en el país atendido</label></div></div>
              </div>
            </section>

            <section class="setupStep" data-setup-step="2">
              <div class="setupStepHead"><span class="setupStepNumber">3</span><div><h4>Lo que ofreces y tus condiciones</h4><p>La información que más evita respuestas equivocadas y trabajo repetitivo.</p></div></div>
              <div class="setupGrid">
                <label class="setupField"><span>¿Qué productos o servicios debe conocer?</span><textarea data-setup="service.main_offering" placeholder="Categorías principales, servicios estrella y enlaces útiles."></textarea></label>
                <label class="setupField"><span>¿Qué preguntan con mayor frecuencia?</span><textarea data-setup="service.frequent_questions" placeholder="Escribe preguntas y la respuesta ideal."></textarea></label>
                <label class="setupField wide"><span>¿Cuáles son tus condiciones de servicio al cliente?</span><textarea data-setup="service.conditions" placeholder="Cambios, garantías, cancelaciones, privacidad, requisitos y excepciones."></textarea></label>
                <label class="setupField"><span>¿Cómo pueden pagar?</span><textarea data-setup="service.payments" placeholder="Medios de pago, anticipos, financiación y restricciones."></textarea></label>
                <label class="setupField"><span>¿Cómo entregas o prestas el servicio?</span><textarea data-setup="service.delivery" placeholder="Tiempos, costos, cobertura y proceso."></textarea></label>
              </div>
            </section>

            <section class="setupStep" data-setup-step="3">
              <div class="setupStepHead"><span class="setupStepNumber">4</span><div><h4>Preguntas especiales para tu industria</h4><p id="industryHelp">Estas preguntas cambian automáticamente según el tipo de negocio.</p></div></div>
              <div class="industryQuestions" id="industryQuestions"></div>
            </section>

            <section class="setupStep" data-setup-step="4">
              <div class="setupStepHead"><span class="setupStepNumber">5</span><div><h4>Personalidad y canales</h4><p>Haz que suene como una extensión natural de tu equipo.</p></div></div>
              <div class="setupGrid">
                <label class="setupField wide"><span>¿Cómo quieres que suene?</span><textarea data-setup="voice.tone" placeholder="Ej. cercano, experto, alegre y directo; nunca insistente."></textarea></label>
                <label class="setupField"><span>Nivel de formalidad</span><select data-setup="voice.formality"><option value="cercano">Cercano</option><option value="neutral">Neutral</option><option value="formal">Formal</option></select></label>
                <label class="setupField"><span>Uso de emojis</span><select data-setup="voice.emojis"><option value="ninguno">Ninguno</option><option value="pocos">Pocos</option><option value="moderados">Moderados</option><option value="frecuentes">Frecuentes</option></select></label>
                <label class="setupField"><span>Palabras o expresiones que sí debe usar</span><textarea data-setup="voice.preferred_words" placeholder="Nombres, términos de marca, expresiones locales…"></textarea></label>
                <label class="setupField"><span>Palabras o expresiones que debe evitar</span><textarea data-setup="voice.avoided_words" placeholder="Promesas, tecnicismos o tonos que no representan tu marca."></textarea></label>
                <label class="setupField wide"><span>¿Cómo debería saludar?</span><input data-setup="voice.greeting" maxlength="1000" placeholder="Puedes escribir un saludo o dejar que Nextfor IA lo cree con tu tono."></label>
                <div class="setupField wide"><span>¿En qué canales atenderá?</span><div class="channelChoices"><label class="channelChoice"><input type="checkbox" data-setup="channels.instagram">Instagram</label><label class="channelChoice"><input type="checkbox" data-setup="channels.messenger">Messenger</label><label class="channelChoice"><input type="checkbox" data-setup="channels.whatsapp">WhatsApp</label><label class="channelChoice"><input type="checkbox" data-setup="channels.web">Web</label></div></div>
                <section class="setupAccounts">
                  <h5>Cuentas y números que usará</h5>
                  <p>Estos datos ayudan a ubicar los canales del negocio. No compartas contraseñas ni accesos privados.</p>
                  <div class="setupAccountsGrid">
                    <label class="setupField"><span>Número de WhatsApp</span><input data-setup="channels.whatsapp_number" maxlength="80" placeholder="Ej. +57 300 123 4567"></label>
                    <label class="setupField"><span>Usuario de Instagram</span><input data-setup="channels.instagram_handle" maxlength="120" placeholder="Ej. @tuempresa"></label>
                    <label class="setupField"><span>Página de Facebook / Messenger</span><input data-setup="channels.messenger_page" maxlength="160" placeholder="Nombre o enlace de la página"></label>
                    <label class="setupField"><span>Usuario de TikTok</span><input data-setup="channels.tiktok_handle" maxlength="120" placeholder="Ej. @tuempresa"></label>
                  </div>
                </section>
                <label class="setupField wide"><span>¿Hay alguna diferencia importante entre canales?</span><textarea data-setup="channels.notes" placeholder="Ej. en Instagram priorizar consultas de producto y pasar ventas al equipo."></textarea></label>
              </div>
            </section>

            <section class="setupStep" data-setup-step="5">
              <div class="setupStepHead"><span class="setupStepNumber">6</span><div><h4>Qué puede resolver y cuándo pedir ayuda</h4><p>Aquí defines la autonomía del bot y proteges la experiencia del cliente.</p></div></div>
              <div class="setupGrid">
                <label class="setupField"><span>¿Qué puede responder o gestionar por sí mismo?</span><textarea data-setup="automation.can_answer" placeholder="Preguntas, recomendaciones, captura de datos, reservas…"></textarea></label>
                <label class="setupField"><span>¿Qué nunca debe responder, prometer o decidir?</span><textarea data-setup="automation.must_not_answer" placeholder="Descuentos, diagnósticos, información privada, decisiones especiales…"></textarea></label>
              </div>
            </section>

            <section class="setupStep" data-setup-step="6">
              <div class="setupStepHead"><span class="setupStepNumber">7</span><div><h4>¿Qué resultado esperas de Nextfor IA?</h4><p>Esto nos permite medir valor real y recomendar mejoras con intención.</p></div></div>
              <div class="setupGrid">
                <label class="setupField"><span>¿Cuál es el objetivo principal del bot?</span><textarea data-setup="outcomes.primary_goal" placeholder="Ej. responder más rápido, vender, captar prospectos o reducir carga."></textarea></label>
                <label class="setupField"><span>¿Cómo sabremos que está funcionando?</span><textarea data-setup="outcomes.success_metrics" placeholder="Indicadores y metas: ventas, tiempo, citas, satisfacción…"></textarea></label>
                <label class="setupField"><span>¿Qué esperas lograr en los primeros 90 días?</span><textarea data-setup="outcomes.expected_results" placeholder="Resultados concretos o cambios esperados."></textarea></label>
                <label class="setupField"><span>¿Qué recomendación tienes para Nextfor IA?</span><textarea data-setup="outcomes.recommendations" placeholder="Qué te gustaría que mejoráramos, construyéramos o entendiéramos mejor."></textarea></label>
              </div>
            </section>
          </form>

          <div class="setupActions"><button class="ghostBtn setupBackBtn hidden" id="setupBackBtn" type="button" onclick="backSetupStep()">← Atrás</button><p id="setupMessage">Guarda cuando quieras. “Activar en el bot” aplica los cambios a los mensajes nuevos.</p><button class="ghostBtn setupSaveBtn" id="saveSetupBtn" type="button" onclick="saveBotSetup()">Guardar avance</button><button class="primaryBtn" id="publishSetupBtn" type="button" onclick="setupPrimaryAction()">Continuar →</button></div>
          </div>
        </div>
      </section>

      <section class="${viewClass('panel-notifications')}" id="panel-notifications">
        <div class="notificationsView">
          <section class="notificationsHero">
            <small>✧ Notificaciones Nextfor</small>
            <h3>Mejoras y mensajes importantes, sin perderlos entre chats.</h3>
            <p>Cuando agreguemos una pregunta nueva, una recomendación o un paso pendiente para tu empresa, aparecerá aquí y podrás completarlo sin repetir todo el proceso.</p>
          </section>
          <div class="notificationList" id="nextforNotifications">
            <article class="notificationEmpty">Cargando notificaciones de Nextfor…</article>
          </div>
        </div>
      </section>

      <section class="${viewClass('panel-retargeting')}" id="panel-retargeting">
        <div class="retargetingView">
          <section class="rtgHero">
            <div>
              <span class="rtgSafeBadge" id="rtgModeBadge">Simulación segura</span>
              <h3>Retoma oportunidades sin perder el control</h3>
              <p>Nextfor IA organiza cada seguimiento, valida consentimiento y aplica tus límites antes de ponerlo en cola. Por ahora, todo se simula o requiere aprobación: ningún mensaje comercial sale desde este módulo.</p>
              <div class="rtgHeroActions"><button class="ghostBtn" type="button" onclick="showTab('setup')">Editar reglas</button><button class="ghostBtn" id="rtgRefreshBtn" type="button" onclick="loadRetargeting(true)">Actualizar cola</button></div>
            </div>
            <aside class="rtgSafetyCard">
              <h4>Protecciones activas</h4>
              <div class="rtgSafetyRow"><i>✓</i><span>Consentimiento verificable y máximo 2 mensajes comerciales por 7 días.</span></div>
              <div class="rtgSafetyRow"><i>✓</i><span>Horario 09:00–19:00, hora de Colombia.</span></div>
              <div class="rtgSafetyRow"><i>✓</i><span>Respuesta, compra, handoff o STOP cancelan la cola.</span></div>
              <div class="rtgSafetyRow block"><i>!</i><span>Envío real y modo automático bloqueados hasta validación E2E y autorización operativa.</span></div>
            </aside>
          </section>

          <section class="rtgMetrics" aria-label="Estado de seguimientos">
            <article class="rtgMetric"><span>Por revisar</span><strong id="rtgPending">0</strong></article>
            <article class="rtgMetric"><span>Aprobados</span><strong id="rtgApproved">0</strong></article>
            <article class="rtgMetric"><span>Simulados</span><strong id="rtgSimulated">0</strong></article>
            <article class="rtgMetric"><span>Cancelados</span><strong id="rtgCancelled">0</strong></article>
            <article class="rtgMetric"><span>Bloqueados</span><strong id="rtgBlocked">0</strong></article>
          </section>

          <div class="rtgMainGrid">
            <section class="rtgPanel" id="rtgQueuePanel">
              <header class="rtgPanelHead"><div><h4>Cola de seguimientos</h4><p>Decisiones por cliente, canal y evento. Aprobar nunca envía: solo deja la decisión lista para la simulación.</p></div><span class="rtgStatusChip simulation_pending" id="rtgQueueState">Cargando</span></header>
              <div class="rtgQueue" id="rtgQueue"><div class="rtgEmpty">Cargando la cola segura…</div></div>
            </section>
            <aside class="rtgSide">
              <section class="rtgPanel" id="rtgPausePanel">
                <header class="rtgPanelHead"><div><h4>Control global</h4><p>Pausa todo el tenant inmediatamente.</p></div><button class="ghostBtn" id="rtgPauseBtn" type="button" onclick="toggleRetargetingPause()" disabled>Pausar</button></header>
                <div class="rtgPolicyList" id="rtgPolicyList"></div>
              </section>
              <section class="rtgPanel"><header class="rtgPanelHead"><div><h4>Bloqueos</h4><p>Qué impide programar o aprobar.</p></div></header><div class="rtgBlockerList" id="rtgBlockers"><div class="rtgEmpty">Sin bloqueos registrados.</div></div></section>
              <section class="rtgPanel"><header class="rtgPanelHead"><div><h4>Historial de auditoría</h4><p>Creaciones, aprobaciones y cancelaciones.</p></div></header><div class="rtgHistory" id="rtgHistory"><div class="rtgEmpty">Aún no hay movimientos.</div></div></section>
            </aside>
          </div>
          <p class="statusLine" id="rtgMessage" aria-live="polite">Módulo en estado seguro.</p>
        </div>
      </section>

      <section class="${viewClass('panel-tests')}" id="panel-tests">
        <div class="testGrid">
          <article class="card testCard"><h3 class="sectionTitle">Buscar producto</h3><p class="muted">Consulta el catálogo visible para clientes.</p><form id="searchTestForm" class="formStack"><input id="testQuery" name="q" maxlength="80" placeholder="Ej. carro control remoto" required><button class="primaryBtn" id="searchTestBtn" type="submit">Probar búsqueda</button></form><div class="resultBox" id="searchTestResult">Aún no se ha ejecutado una búsqueda.</div></article>
          <article class="card testCard"><h3 class="sectionTitle">Consultar pedido</h3><p class="muted">Valida número y nombre sin mostrar datos sensibles.</p><form id="orderTestForm" class="formStack"><input id="orderNumber" maxlength="80" placeholder="Número de pedido" required><input id="customerName" maxlength="120" placeholder="Nombre completo" required><input id="phoneOrEmail" maxlength="160" placeholder="Teléfono o correo opcional"><button class="primaryBtn" id="orderTestBtn" type="submit">Consultar estado</button></form><div class="resultBox" id="orderTestResult">Aún no se ha consultado un pedido.</div></article>
        </div>
      </section>
    </div>
  </main>
  <nav class="mobileTabbar" id="mobileTabbar" aria-label="Navegación móvil" style="--mobile-tabs:5">
    <button id="mnav-summary" data-bot="support" type="button" onclick="showTab('summary')"><span class="mobileNavIcon">${PANEL_ICONS.resumen}</span><span>Resumen</span></button>
    <button id="mnav-conversations" data-bot="support" type="button" onclick="showTab('conversations')"><span class="mobileNavIcon">${PANEL_ICONS.conversaciones}</span><span>Chats</span></button>
    <button id="mnav-retargeting" data-bot="support" type="button" onclick="showTab('retargeting')"><span class="mobileNavIcon">${PANEL_ICONS.gift}</span><span>Seguim.</span></button>
    ${mobileAppointmentTabs}
    ${planMobileNav}
    ${channelsMobileNav}
    <button id="mnav-setup" data-bot="account" type="button" onclick="showTab('setup')"><span class="mobileNavIcon">${PANEL_ICONS.settings}</span><span>Config.</span></button>
    ${paymentGateRequired ? "" : notificationsMobileNav}
  </nav>
  <div class="profileModal" id="profileModal" role="dialog" aria-modal="true" aria-label="Perfil de la cuenta">
    <div class="profileScrim" onclick="closeProfile()"></div>
    <div class="profileCard">
      <div class="profileHead"><h3>Perfil de tu cuenta</h3><button class="profileClose" type="button" onclick="closeProfile()" aria-label="Cerrar">×</button></div>
      <p class="profileHint">Administra los datos de contacto y la seguridad de tu acceso.</p>
      <div class="profileLogoRow">
        <div class="profileLogo" id="profileLogoPreview">${escapeHtml(panelContext.initials)}</div>
        <label class="profileUpload" id="profileUploadDrop" ondragover="profileLogoDrag(event,true)" ondragleave="profileLogoDrag(event,false)" ondrop="profileLogoDrop(event)">${PANEL_ICONS.edit}<span>Arrastra tu logo o selecciónalo<small>PNG, JPG o WebP · se ajusta automáticamente</small></span><input id="profileLogoInput" type="file" accept="image/png,image/jpeg,image/webp" onchange="handleLogoFile(this)" hidden></label>
      </div>
      <div class="profileGrid">
        <label class="profileField wide"><span>Nombre del negocio</span><input id="profileNameInput" type="text" maxlength="120" value="${escapeHtml(panelContext.businessName)}"></label>
        <label class="profileField"><span>Administrador de la cuenta</span><input id="profileAdminName" type="text" maxlength="120" autocomplete="name"></label>
        <label class="profileField"><span>Celular de contacto</span><input id="profilePhone" type="tel" maxlength="40" autocomplete="tel"></label>
        <label class="profileField wide"><span>Correo de acceso</span><input id="profileEmail" type="email" readonly></label>
      </div>
      <p class="profileStatus" id="profileStatus" role="status" aria-live="polite"></p>
      <div class="profileActions"><button class="profileBtn ghost" type="button" onclick="closeProfile()">Cancelar</button><button class="profileBtn primary" id="profileSaveBtn" type="button" onclick="saveProfile()">Guardar cambios</button></div>
      <section class="profileSecurity">
        <div class="profileSecurityHead"><div><strong>Contraseña</strong><p>Actualiza la clave con la que ingresas al panel.</p></div><button class="profileBtn ghost" type="button" onclick="togglePasswordForm()">Cambiar contraseña</button></div>
        <div class="profilePassword" id="profilePasswordForm">
          <div class="profileGrid">
            <label class="profileField wide"><span>Contraseña actual</span><input id="profileCurrentPassword" type="password" autocomplete="current-password"></label>
            <label class="profileField"><span>Nueva contraseña</span><input id="profileNewPassword" type="password" autocomplete="new-password"></label>
            <label class="profileField"><span>Confirma la nueva contraseña</span><input id="profileConfirmPassword" type="password" autocomplete="new-password"></label>
          </div>
          <p class="profileHint">Mínimo 12 caracteres, una letra y un número.</p>
          <div class="profileActions"><button class="profileBtn primary" id="profilePasswordBtn" type="button" onclick="changeAccountPassword()">Guardar contraseña</button></div>
        </div>
      </section>
    </div>
  </div>
</div>
<div class="panelVersionFixed" aria-label="Versión del Customer Panel">Versión ${escapeHtml(botVersion)}</div>
<script>
var INITIAL_TAB=${safeJson(initialTab)},INITIAL_CHANNEL=${safeJson(initialChannel)},SERVER_ROLE=${safeJson(auth.role)},SERVER_CAPABILITIES=${safeJson(capabilities)},PANEL_DATA_PATH=${safeJson(dataPath)},PANEL_HEALTH_PATH=${safeJson(healthPath)},PANEL_SETUP_PATH=${safeJson(setupPath)},PANEL_ONBOARDING_PATH="/admin/client-onboarding/data",PANEL_PERSONALITY_PATH="/admin/panel/bot-personality",PANEL_ACCOUNT_PATH="/admin/panel/account-profile",PANEL_PASSWORD_PATH="/admin/panel/account-password",PANEL_RETARGETING_PATH=${safeJson(retargetingPath)},PANEL_APPOINTMENTS_PATH=${safeJson(appointmentsPath)},PANEL_LOGIN_PATH=${safeJson(loginPath)},DEMO_MODE=${safeJson(demoMode)},PANEL_CONTEXT=${safeJson(panelContext)},PANEL_CHECK_ICON=${safeJson(PANEL_ICONS.check)},PANEL_PAYMENTS_ENABLED=${options.paymentsV1Enabled ? "true" : "false"},PANEL_CHANNEL_CONNECTIONS_ENABLED=${channelConnectionsV1Enabled ? "true" : "false"},PANEL_CHANNEL_CONNECTIONS_DEMO=${safeJson(channelConnectionsDemo)};
var PLAN_DATA=${safeJson(planData)};
var state={tab:INITIAL_TAB,channel:INITIAL_CHANNEL,filter:"all",bot:PANEL_CONTEXT.appointments&&!PANEL_CONTEXT.support?"appointments":"support",data:null,health:null,billing:null,billingLoading:false,channelConnections:null,channelConnectionsLoading:false,whatsappEmbedded:null,externalIntegrationPending:false,allConversations:[],conversations:[],selected:null,metaDirty:false,draftTags:[],loading:false,guidedDraft:"",guidedFor:null,setup:null,setupDirty:false,setupLoading:false,setupStep:0,setupActivated:false,onboarding:null,onboardingLoading:false,setupDetailsOpen:false,personality:null,personalityDirty:false,personalityLoading:false,personalityCanEdit:false,accountProfile:null,accountProfileLoading:false,accountLogo:"",notifications:null,retargeting:null,retargetingLoading:false,appointments:null,appointmentsLoading:false,appointmentMode:"week",appointmentSection:"agenda",appointmentFilter:"all",selectedAppointment:null,reprogramDay:0};
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function attr(v){return esc(v).replace(/"/g,"&quot;");}
function text(id,value){var el=document.getElementById(id);if(el)el.textContent=value;}
function syncBotSidebar(){if(PANEL_CONTEXT.v2&&!PANEL_CONTEXT.appointments&&state.bot==="appointments")state.bot=PANEL_CONTEXT.support?"support":"account";var support=state.bot==="support",appointments=state.bot==="appointments"&&(!PANEL_CONTEXT.v2||PANEL_CONTEXT.appointments),s=document.getElementById("navSupport"),a=document.getElementById("navAppointments"),bs=document.getElementById("bot-support"),ba=document.getElementById("bot-appointments"),mbs=document.getElementById("mobile-bot-support"),mba=document.getElementById("mobile-bot-appointments"),bar=document.getElementById("mobileTabbar");if(s)s.style.display=support?"grid":"none";if(a)a.style.display=appointments?"grid":"none";[[bs,support],[ba,appointments],[mbs,support],[mba,appointments]].forEach(function(row){if(!row[0])return;row[0].classList.toggle("active",row[1]);row[0].setAttribute("aria-pressed",row[1]?"true":"false");});document.querySelectorAll("#mobileTabbar [data-bot]").forEach(function(button){var scope=button.getAttribute("data-bot");var allowed=scope==="account"||scope===state.bot;if(PANEL_CONTEXT.v2&&scope==="appointments"&&!PANEL_CONTEXT.appointments)allowed=false;if(PANEL_CONTEXT.v2&&scope==="support"&&!PANEL_CONTEXT.support)allowed=false;button.style.display=allowed?"grid":"none";});if(bar)bar.style.setProperty("--mobile-tabs",String((support?5:appointments?4:3)+(PANEL_CHANNEL_CONNECTIONS_ENABLED?1:0)));}
function selectBot(bot){var next=bot==="appointments"?"appointments":"support";if(PANEL_CONTEXT.v2&&!PANEL_CONTEXT[next])return;state.bot=next;syncBotSidebar();showTab(state.bot==="support"?"summary":"appointments");}
function profileStatus(message,error){var node=document.getElementById("profileStatus");if(!node)return;node.textContent=message||"";node.classList.toggle("error",!!error);}
function panelInitialsFromName(name){return String(name||"NX").trim().split(/\\s+/).filter(Boolean).slice(0,2).map(function(part){return part.charAt(0).toUpperCase();}).join("")||"NX";}
function applyPanelLogo(image,name){var initials=panelInitialsFromName(name||PANEL_CONTEXT.businessName),targets=[document.getElementById("profileLogoPreview"),document.getElementById("brandLogo")];document.querySelectorAll(".mobileBrand .ravLogo").forEach(function(el){targets.push(el);});targets.forEach(function(el){if(!el)return;el.innerHTML=image?'<img src="'+attr(image)+'" alt="">':esc(initials);});}
function preparePanelImage(file){return new Promise(function(resolve,reject){if(!file)return reject(new Error("Selecciona una imagen."));if(!/^image\\/(png|jpeg|webp)$/i.test(file.type||""))return reject(new Error("Usa una imagen PNG, JPG o WebP."));if(file.size>8*1024*1024)return reject(new Error("La imagen pesa más de 8 MB."));var url=URL.createObjectURL(file),image=new Image();function cleanup(){URL.revokeObjectURL(url);}function encode(size,quality){var canvas=document.createElement("canvas"),side=Math.min(image.naturalWidth,image.naturalHeight),sx=Math.max(0,(image.naturalWidth-side)/2),sy=Math.max(0,(image.naturalHeight-side)/2);canvas.width=size;canvas.height=size;canvas.getContext("2d").drawImage(image,sx,sy,side,side,0,0,size,size);var result=canvas.toDataURL("image/webp",quality);if(result.indexOf("data:image/webp")!==0)result=canvas.toDataURL("image/jpeg",quality);return result;}image.onload=function(){try{var first=encode(360,.82),result=first.length<=90000?first:encode(240,.66);cleanup();if(result.length>90000)return reject(new Error("No pudimos reducir la imagen. Usa una más sencilla."));resolve(result);}catch(error){cleanup();reject(new Error("No pudimos procesar esa imagen."));}};image.onerror=function(){cleanup();reject(new Error("No pudimos abrir esa imagen."));};image.src=url;});}
function fillAccountProfile(payload){var profile=payload&&payload.profile||{},canEdit=payload&&payload.can_edit!==false;state.accountProfile=profile;state.accountLogo=profile.logo_data_url||"";var fields={profileNameInput:profile.business_name||PANEL_CONTEXT.businessName,profileAdminName:profile.administrator_name||"",profilePhone:profile.contact_phone||"",profileEmail:profile.administrator_email||""};Object.keys(fields).forEach(function(id){var field=document.getElementById(id);if(field){field.value=fields[id];if(id!=="profileEmail")field.disabled=!canEdit;}});var upload=document.getElementById("profileUploadDrop"),save=document.getElementById("profileSaveBtn");if(upload){upload.style.pointerEvents=canEdit?"auto":"none";upload.style.opacity=canEdit?"1":".6";}if(save)save.disabled=!canEdit;applyPanelLogo(state.accountLogo,fields.profileNameInput);profileStatus(canEdit?"":"Tu rol tiene acceso de solo lectura.",false);}
function loadAccountProfile(force){if(state.accountProfileLoading||(!force&&state.accountProfile))return;state.accountProfileLoading=true;profileStatus("Cargando tu información…",false);api(PANEL_ACCOUNT_PATH,{redirectOnAuth:true}).then(fillAccountProfile).catch(function(error){profileStatus(error.body&&error.body.message||"No pudimos cargar tu perfil.",true);}).finally(function(){state.accountProfileLoading=false;});}
function openProfile(){var modal=document.getElementById("profileModal");if(!modal)return;modal.classList.add("open");loadAccountProfile(true);}
function closeProfile(){var modal=document.getElementById("profileModal");if(modal)modal.classList.remove("open");}
function profileLogoDrag(event,active){if(event){event.preventDefault();event.stopPropagation();}var drop=document.getElementById("profileUploadDrop");if(drop)drop.classList.toggle("drag",!!active);}
function profileLogoDrop(event){profileLogoDrag(event,false);var file=event&&event.dataTransfer&&event.dataTransfer.files&&event.dataTransfer.files[0];if(file)processProfileLogo(file);}
function processProfileLogo(file){preparePanelImage(file).then(function(image){state.accountLogo=image;var name=document.getElementById("profileNameInput");applyPanelLogo(image,name&&name.value);profileStatus("Imagen lista. Guarda los cambios para aplicarla.",false);}).catch(function(error){profileStatus(error.message||"No pudimos procesar la imagen.",true);});}
function handleLogoFile(input){var file=input.files&&input.files[0];if(file)processProfileLogo(file);input.value="";}
function saveProfile(){var button=document.getElementById("profileSaveBtn"),name=document.getElementById("profileNameInput"),admin=document.getElementById("profileAdminName"),phone=document.getElementById("profilePhone"),value=name&&(name.value||"").trim();if(!value){profileStatus("Escribe el nombre del negocio.",true);if(name)name.focus();return;}if(button){button.disabled=true;button.textContent="Guardando…";}profileStatus("Guardando cambios…",false);api(PANEL_ACCOUNT_PATH,{method:"PUT",body:JSON.stringify({business_name:value,administrator_name:admin&&(admin.value||"").trim(),contact_phone:phone&&(phone.value||"").trim(),logo_data_url:state.accountLogo||""})}).then(function(payload){fillAccountProfile(payload);PANEL_CONTEXT.businessName=value;text("brandBusinessName",value);text("mobileBrandBusinessName",value);applyPanelLogo(state.accountLogo,value);profileStatus("Perfil actualizado.",false);}).catch(function(error){profileStatus(error.body&&error.body.message||"No pudimos guardar el perfil.",true);}).finally(function(){if(button){button.disabled=false;button.textContent="Guardar cambios";}});}
function togglePasswordForm(){var form=document.getElementById("profilePasswordForm");if(!form)return;form.classList.toggle("open");if(form.classList.contains("open")){var field=document.getElementById("profileCurrentPassword");if(field)field.focus();}}
function changeAccountPassword(){var current=document.getElementById("profileCurrentPassword"),password=document.getElementById("profileNewPassword"),confirmation=document.getElementById("profileConfirmPassword"),button=document.getElementById("profilePasswordBtn"),currentValue=current&&current.value||"",nextValue=password&&password.value||"",confirmationValue=confirmation&&confirmation.value||"";if(nextValue.length<12||!/[A-Za-z]/.test(nextValue)||!/[0-9]/.test(nextValue)){profileStatus("La nueva contraseña necesita 12 caracteres, una letra y un número.",true);return;}if(nextValue!==confirmationValue){profileStatus("Las contraseñas nuevas no coinciden.",true);return;}if(button){button.disabled=true;button.textContent="Actualizando…";}profileStatus("Actualizando contraseña…",false);api(PANEL_PASSWORD_PATH,{method:"POST",body:JSON.stringify({current_password:currentValue,password:nextValue,password_confirmation:confirmationValue})}).then(function(){[current,password,confirmation].forEach(function(field){if(field)field.value="";});profileStatus("Contraseña actualizada correctamente.",false);var form=document.getElementById("profilePasswordForm");if(form)form.classList.remove("open");}).catch(function(error){profileStatus(error.body&&error.body.message||"No pudimos cambiar la contraseña.",true);}).finally(function(){if(button){button.disabled=false;button.textContent="Guardar contraseña";}});}
function api(url,opts){opts=opts||{};opts.headers=Object.assign({accept:"application/json","x-nextforia-panel-origin":location.origin},opts.headers||{});if(opts.body&&!opts.headers["content-type"])opts.headers["content-type"]="application/json";var redirectOnAuth=opts.redirectOnAuth;return fetch(url,opts).then(function(response){return response.json().catch(function(){return {};}).then(function(body){if(response.status===401){if(redirectOnAuth&&PANEL_LOGIN_PATH)location.href=PANEL_LOGIN_PATH;var authError=new Error("Sesión vencida");authError.status=401;throw authError;}if(!response.ok){var error=new Error(body.message||body.error||("HTTP "+response.status));error.status=response.status;error.body=body;throw error;}return body;});});}
function when(ts){if(!ts)return "";var d=new Date(ts);if(isNaN(d.getTime()))return "";return d.toLocaleString("es-CO",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});}
function setBusy(id,busy,busyText,normalText){var b=document.getElementById(id);if(!b)return;b.disabled=!!busy;b.textContent=busy?busyText:normalText;}
function prepareExternalIntegrationTab(label){
  var tab=null;
  try{tab=window.open("about:blank","_blank");}catch(_){}
  if(!tab)return null;
  try{
    tab.document.title="Conectando "+String(label||"servicio")+" · Nextfor IA";
    tab.document.body.style.cssText="margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f7fb;color:#0b1d3a;font:600 18px Arial,sans-serif";
    tab.document.body.textContent="Abriendo "+String(label||"el servicio")+" de forma segura…";
  }catch(_){}
  return tab;
}
function closeExternalIntegrationTab(tab){if(!tab)return;try{if(!tab.closed)tab.close();}catch(_){}}
function navigateExternalIntegrationTab(tab,url){
  if(!tab||!url)return false;
  try{tab.opener=null;}catch(_){}
  try{tab.location.replace(String(url));}catch(error){try{tab.location.href=String(url);}catch(_){return false;}}
  state.externalIntegrationPending=true;
  return true;
}
function refreshExternalIntegrationState(payload){
  if(!payload||payload.type!=="nextfor-integration-result")return;
  state.externalIntegrationPending=false;
  if(state.tab==="channels"){
    state.channelConnections=null;
    loadChannelConnections(true);
    loadClientOnboardingSummary();
    if(payload.status==="success")setChannelConnectionMessage("Listo. La conexión quedó guardada y el canal se está actualizando.","success");
    else if(payload.status==="select")setChannelConnectionMessage("Autorización lista. Elige la cuenta correcta para terminar.");
    else setChannelConnectionMessage(payload.error==="channel_asset_already_assigned"?"Esta cuenta ya está conectada a otra empresa. Desconéctala allí antes de asignarla de nuevo.":"No pudimos completar la conexión. Intenta nuevamente.","error");
  }
  if(state.tab==="plan")loadBilling(true);
}
try{
  var externalIntegrationChannel=new BroadcastChannel("nextfor-integrations");
  externalIntegrationChannel.onmessage=function(event){refreshExternalIntegrationState(event&&event.data);};
}catch(_){}
window.addEventListener("storage",function(event){
  if(event.key!=="nextfor-integration-result"||!event.newValue)return;
  try{refreshExternalIntegrationState(JSON.parse(event.newValue));}catch(_){}
});
function openShopifyConnection(){
  var tab=prepareExternalIntegrationTab("Shopify");
  if(!tab){setChannelConnectionMessage("Tu navegador bloqueó la nueva pestaña. Permite ventanas emergentes para Nextfor y vuelve a intentar.","error");return;}
  navigateExternalIntegrationTab(tab,"/admin/integrations/shopify/connect");
  setChannelConnectionMessage("Shopify se abrió en una pestaña nueva. Este panel permanecerá abierto.","success");
}
function channelLabel(){return "WhatsApp, Instagram y Messenger";}
function conversationKey(item){return item&&(item.id||item.phone)||"";}
function customerDisplay(item){if(!item)return "—";var channel=channelType(item);if(item.display_name)return item.display_name;if(channel==="instagram")return "Instagram · …"+String(item.phone||"").slice(-6);if(channel==="messenger")return "Messenger · …"+String(item.phone||"").slice(-6);if(channel==="email")return item.email||item.copy_value||item.phone||"Cliente por correo";return item.phone?("+"+String(item.phone).replace(/^\\+/,"")):"Cliente";}
function combineSummaries(first,second){first=first||{};second=second||{};var salesA=first.sales_assisted||{},salesB=second.sales_assisted||{},solA=first.solutions_provided||{},solB=second.solutions_provided||{},ratingA=first.rating||{},ratingB=second.rating||{},ratingCount=(ratingA.count||0)+(ratingB.count||0),resolved=(solA.count||0)+(solB.count||0),resolvedTotal=(solA.total||0)+(solB.total||0);var dayRows={};[first.messages_by_day||[],second.messages_by_day||[]].forEach(function(list){list.forEach(function(item){var day=item.day||"";if(day)dayRows[day]=(dayRows[day]||0)+(item.messages||0);});});var gapRows={};[first.search_gaps||[],second.search_gaps||[]].forEach(function(list){list.forEach(function(item){var query=item.query||"";if(query)gapRows[query]=(gapRows[query]||0)+(item.count||0);});});return {clients_attended:(first.clients_attended||0)+(second.clients_attended||0),messages:(first.messages||0)+(second.messages||0),active_handoffs:(first.active_handoffs||0)+(second.active_handoffs||0),handoffs_to_human:(first.handoffs_to_human||0)+(second.handoffs_to_human||0),pending_human_replies:(first.pending_human_replies||0)+(second.pending_human_replies||0),zero_result_searches:(first.zero_result_searches||0)+(second.zero_result_searches||0),opportunities_detected:(first.opportunities_detected||0)+(second.opportunities_detected||0),sales_assisted:{count:(salesA.count||0)+(salesB.count||0),label:"ventas asistidas",confidence:"combined"},solutions_provided:{count:resolved,by_human:(solA.by_human||0)+(solB.by_human||0),total:resolvedTotal,partial:(solA.partial||0)+(solB.partial||0),evaluated:(solA.evaluated||0)+(solB.evaluated||0),rate:resolvedTotal?Math.round(resolved/resolvedTotal*100):null},rating:{average:ratingCount?Math.round((((ratingA.average||0)*(ratingA.count||0))+((ratingB.average||0)*(ratingB.count||0)))/ratingCount*10)/10:null,count:ratingCount},messages_by_day:Object.keys(dayRows).sort().map(function(day){return {day:day,messages:dayRows[day]};}),search_gaps:Object.keys(gapRows).map(function(query){return {query:query,count:gapRows[query]};}).sort(function(a,b){return b.count-a.count;})};}
function activeSummary(){var summaries=state.data&&state.data.summaries||{};return combineSummaries(combineSummaries(summaries.whatsapp,summaries.instagram),summaries.messenger);}
function applyChannelData(){state.channel="all";state.conversations=state.allConversations.slice();if(state.selected&&!findConversation(state.selected))state.selected=null;}
function showChannel(){state.channel="all";state.selected=null;state.metaDirty=false;applyChannelData();showTab("summary");renderChannelState();renderHeader();renderSummary();renderInbox();}
function channelConnectionStatusLabel(status){return({not_connected:"Pendiente",connecting:"En proceso",connected:"Listo",needs_attention:"Revisar",disconnected:"Desconectado"})[status]||"Pendiente";}
function calendarConnectionStatusLabel(status){return({not_connected:"Pendiente",connecting:"En proceso",connected:"Listo",needs_attention:"Revisar",disconnected:"Desconectado"})[status]||"Pendiente";}
function channelConnectionInitial(channel){return({whatsapp:"WA",instagram:"IG",messenger:"MS",telegram:"TG",calendar:"GC","google-calendar":"GC","microsoft-calendar":"OL"})[channel]||"NX";}
function commercePlatformLabel(platform){platform=String(platform||"unknown");return({shopify:"Shopify",woocommerce:"WooCommerce",wordpress:"WordPress",api:"API / conector personalizado",csv:"Catálogo CSV",other:"Otra plataforma",none:"Sin tienda conectada",unknown:"Por definir"})[platform]||platform;}
function commerceStatusLabel(status){status=String(status||"not_requested");return({not_requested:"No solicitado",requested:"Solicitado",pending_customer:"Opcional para después",connected:"Listo",needs_review:"Necesita revisión",failed:"Falló la conexión"})[status]||"Pendiente";}
function commerceDisplayStatus(commerce){commerce=commerce||{};if(commerce.integration_status==="connected"||commerce.shopify_connected_at)return "connected";return commerce.integration_status||"not_requested";}
function commerceDisplayStore(commerce){commerce=commerce||{};return commerce.shopify_shop||commerce.store_url||"";}
function onboardingAnswers(){return state.onboarding&&state.onboarding.onboarding&&state.onboarding.onboarding.answers||{};}
function selectedChannelHints(answers){answers=answers||{};var appt=answers.appointment_setup||{},hints=[];if(setupPathGet(answers,"meta.whatsapp_number"))hints.push("whatsapp");if(appt.instagram_username||setupPathGet(answers,"meta.instagram_account"))hints.push("instagram");if(appt.messenger_page||setupPathGet(answers,"meta.facebook_page"))hints.push("messenger");return hints;}
function renderConnectionHub(){
  var root=document.getElementById("connectionHubSummary"),commerceRoot=document.getElementById("commerceConnectorCards");
  if(!root&&!commerceRoot)return;
  var payload=state.onboarding||{},onboarding=payload.onboarding||{},answers=onboarding.answers||{},goal=answers.setup_goal,commerce=answers.commerce||{},hints=selectedChannelHints(answers),connections=state.channelConnections&&state.channelConnections.channels||[],connected=connections.filter(function(row){return row.status==="connected";}).length,commercePlatform=commerce.platform||"unknown",commerceStatus=commerceDisplayStatus(commerce),commerceStore=commerceDisplayStore(commerce),commerceRequested=commercePlatform&&commercePlatform!=="none"&&commercePlatform!=="unknown"&&(commerce.integration_intent==="yes"||commerce.integration_intent==="later"||commerceStatus!=="not_requested");
  if(root){
    var cards=[
      ["Cuestionario",onboarding.setup_completed?"Completo":"En progreso",onboarding.setup_completed?"Tu información quedó guardada en el registro compartido.":"Puedes terminarlo sin empezar de cero."],
      ["Bot",setupGoalLabel(goal)||PANEL_CONTEXT.assignedBotName,onboarding.setup_completed?"Borrador generado automáticamente; queda pendiente la aprobación final de NextforIA.":"Se define al cerrar el cuestionario."],
      ["Canales",connected?connected+" conectado(s)":hints.length?hints.map(function(item){return channelConnectionInitial(item);}).join(" · ")+" pendiente(s)":"Por elegir","Conecta solo los canales que vas a usar ahora; los demás pueden esperar."],
      ["Comercio",commerceRequested?commercePlatformLabel(commercePlatform):"Opcional",commerceRequested?commerceStatusLabel(commerceStatus)+" · "+setupShort(commerceStore,"sin URL"):"Si vendes online, puedes solicitar Shopify o WooCommerce aquí."]
    ];
    root.innerHTML=cards.map(function(item){return '<article class="connectionHubCard"><small>'+esc(item[0])+'</small><strong>'+esc(setupShort(item[1]))+'</strong><p>'+esc(item[2])+'</p></article>';}).join("");
  }
  if(commerceRoot){
    if(!commerceRequested){
      var canRequest=SERVER_ROLE==="admin"||SERVER_ROLE==="super_admin";
      commerceRoot.innerHTML='<article class="channelConnectCard comingSoon"><span class="channelConnectIcon">NX</span><div class="channelConnectCopy"><h4>¿También vendes online?</h4><p>Si se te pasó en el setup, puedes activar Shopify desde aquí. WooCommerce queda solicitado para cuando el conector esté disponible.</p><div class="channelAccount">Opcional · puedes seguir sin tienda conectada</div></div><div class="channelConnectActions"><span class="channelState">Opcional</span>'+(canRequest?'<button class="primaryBtn" type="button" data-platform="shopify" onclick="requestCommerceConnector(this.dataset.platform,true)">Conectar Shopify</button><button class="ghostBtn" type="button" data-platform="woocommerce" onclick="requestCommerceConnector(this.dataset.platform)">Solicitar WooCommerce</button>':'<span class="channelAccount">Pide a un administrador que lo active.</span>')+'</div></article>';
      return;
    }
    var icon=commercePlatform==="shopify"?"SH":commercePlatform==="woocommerce"?"WC":"EC",title=commercePlatformLabel(commercePlatform),connectedCommerce=commerceStatus==="connected",description=connectedCommerce&&commercePlatform==="shopify"?"Shopify ya quedó conectado. Nextfor puede consultar catálogo, productos y datos comerciales.":commercePlatform==="shopify"?"Conecta la app segura de Shopify para catálogo, productos y datos comerciales.":commercePlatform==="woocommerce"?"Conector opcional para WordPress + WooCommerce. Queda preparado para el equipo de Commerce Connectors.":"Conector opcional según la plataforma indicada en el setup.",connectAction=commercePlatform==="shopify"&&!connectedCommerce?'<button class="primaryBtn" type="button" onclick="openShopifyConnection()">Conectar Shopify</button>':"",changeAction=connectedCommerce?'<button class="textBtn" type="button" onclick="showTab(&quot;setup&quot;)">Cambiar e-commerce</button>':"";
    commerceRoot.innerHTML='<article class="channelConnectCard recommended"><span class="channelConnectIcon">'+esc(icon)+'</span><div class="channelConnectCopy"><h4>'+esc(title)+'</h4><p>'+esc(description)+'</p><div class="channelAccount">'+esc(setupShort(commerceStore,"URL pendiente"))+'</div></div><div class="channelConnectActions"><span class="channelState '+attr(connectedCommerce?"connected":commerceStatus==="failed"?"needs_attention":"connecting")+'">'+esc(commerceStatusLabel(commerceStatus))+'</span>'+connectAction+'<button class="ghostBtn" type="button" onclick="showTab(&quot;setup&quot;)">Ver datos guardados</button>'+changeAction+'</div></article>';
  }
}
function requestCommerceConnector(platform,connectNow){
  platform=String(platform||"").toLowerCase();
  if(["shopify","woocommerce"].indexOf(platform)<0)return;
  var externalTab=connectNow&&platform==="shopify"&&!DEMO_MODE?prepareExternalIntegrationTab("Shopify"):null;
  if(connectNow&&platform==="shopify"&&!DEMO_MODE&&!externalTab){setChannelConnectionMessage("Tu navegador bloqueó la nueva pestaña. Permite ventanas emergentes para Nextfor y vuelve a intentar.","error");return;}
  setChannelConnectionMessage("Guardando solicitud de "+commercePlatformLabel(platform)+"…");
  if(DEMO_MODE){
    var payload=state.onboarding||{onboarding:{answers:{}}};
    payload.onboarding=payload.onboarding||{answers:{}};
    payload.onboarding.answers=payload.onboarding.answers||{};
    payload.onboarding.answers.commerce=Object.assign({},payload.onboarding.answers.commerce||{},{platform:platform,integration_intent:"yes",integration_status:"requested",requested_from:"customer_panel"});
    state.onboarding=payload;
    renderOnboardingSummary(payload);
    setChannelConnectionMessage("Listo. Dejamos "+commercePlatformLabel(platform)+" solicitado para continuar después.","success");
    return;
  }
  api("/admin/panel/commerce-connector",{method:"POST",body:JSON.stringify({platform:platform})}).then(function(body){
    state.onboarding=Object.assign({},state.onboarding||{}, {onboarding:body.onboarding});
    renderOnboardingSummary(state.onboarding);
    setChannelConnectionMessage(connectNow&&platform==="shopify"?"Shopify se abrió en una pestaña nueva. Este panel permanecerá abierto.":"Listo. Dejamos "+commercePlatformLabel(platform)+" solicitado para Commerce Connectors.","success");
    if(externalTab)navigateExternalIntegrationTab(externalTab,"/admin/integrations/shopify/connect");
  }).catch(function(error){
    closeExternalIntegrationTab(externalTab);
    setChannelConnectionMessage(error.body&&error.body.message||"No pudimos guardar el conector. Intenta de nuevo.","error");
  });
}
function setChannelConnectionMessage(message,tone){var root=document.getElementById("channelConnectionMessage");if(!root)return;root.textContent=message||"";root.className="channelsMessage"+(tone?" "+tone:"");}
function renderAppointmentCalendarGroup(calendars,canManage){calendars=(calendars||[]).filter(Boolean);if(!calendars.length)return"";var active=calendars.find(function(calendar){return calendar.active&&calendar.status==="connected";})||calendars.find(function(calendar){return calendar.active;}),connected=!!(active&&active.status==="connected"),account=active&&(active.calendar_summary||active.account_label||active.account_email)||"",actions='<span class="channelState '+attr(connected?"connected":"not_connected")+'">'+esc(connected?"Listo":"No conectado")+'</span>';if(canManage){actions+=calendars.map(function(calendar){var provider=calendar.provider==="microsoft"?"microsoft":"google",providerName=calendar.name||(provider==="microsoft"?"Microsoft Outlook":"Google Calendar"),providerConnected=calendar.active&&calendar.status==="connected";if(calendar.authorization_available===false)return '<span class="channelAccount">'+esc(providerName)+" · Próximamente"+'</span>';return '<button class="'+(providerConnected?"ghostBtn":"primaryBtn")+'" type="button" data-provider="'+attr(provider)+'" onclick="connectAppointmentCalendar(this.dataset.provider)">'+esc((providerConnected?"✓ ":"")+providerName)+'</button>';}).join("");if(connected)actions+='<button class="ghostBtn" type="button" onclick="disconnectAppointmentCalendar()">Desconectar</button>';}var accountText=connected?"Conectado: "+(account||(active&&active.name)||"calendario del negocio"):"Elige una opción. Solo mantendremos un calendario activo para las citas.";return '<article class="channelConnectCard'+(connected?' recommended':'')+'"><span class="channelConnectIcon calendar">CA</span><div class="channelConnectCopy"><h4>¿Qué calendario usa tu negocio?</h4><p>Conecta la agenda donde Nextfor revisará disponibilidad y creará Citas NextforIA.</p><div class="channelAccount">'+esc(accountText)+'</div></div><div class="channelConnectActions">'+actions+'</div></article>';}
function renderChannelConnections(){var root=document.getElementById("channelConnectionCards"),payload=state.channelConnections;if(!root||!payload)return;var canManage=SERVER_ROLE==="admin"||SERVER_ROLE==="super_admin",available=payload.meta_authorization_available||{},hints=selectedChannelHints(onboardingAnswers()),cards=(payload.channels||[]).map(function(item){var channel=item.channel||item.id,status=item.status||"not_connected",soon=item.coming_soon||item.available===false,recommended=hints.includes(channel),account=item.account_label?'<div class="channelAccount">'+esc(item.account_label)+'</div>':recommended?'<div class="channelAccount">Sugerido por tu cuestionario</div>':"",activation=item.activation_message?'<div class="channelAccount">'+esc(item.activation_message)+'</div>':"",primary=channel==="whatsapp",actions='<span class="channelState '+attr(status)+'">'+esc(soon?"Próximamente":channelConnectionStatusLabel(status))+'</span>';if(!soon&&canManage){if(item.requires_selection){var options=(item.pending_assets||[]).map(function(asset){return '<option value="'+attr(asset.id)+'">'+esc(asset.label+(asset.detail?" · "+asset.detail:""))+'</option>';}).join("");actions+='<select class="channelAssetSelect" id="channelAsset-'+attr(channel)+'" aria-label="Elige una cuenta">'+options+'</select><button class="primaryBtn" type="button" data-channel="'+attr(channel)+'" onclick="selectChannelAsset(this.dataset.channel)">Elegir esta cuenta</button>';}else if(item.activation_available){actions+='<label class="whatsappPinField"><span>PIN de Meta</span><input id="whatsappRegistrationPin" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" placeholder="6 dígitos" aria-label="PIN de verificación en dos pasos de WhatsApp"></label><button class="primaryBtn" type="button" onclick="activateWhatsApp(this)">Confirmar PIN y activar</button>';if(item.reconnect_available)actions+='<button class="ghostBtn" type="button" data-channel="whatsapp" onclick="connectChannel(this.dataset.channel)">Volver a autorizar</button>';}else if(item.activation_rate_limited){actions+='<button class="primaryBtn" type="button" disabled>Bloqueado por Meta</button>';}else if(item.connect_available){actions+='<button class="'+(primary?"primaryBtn":"ghostBtn")+'" type="button" data-channel="'+attr(channel)+'" onclick="connectChannel(this.dataset.channel)">'+(available[channel]===false?"Estamos preparando este paso":"Continuar con Meta")+'</button>';}else if(item.reconnect_available){actions+='<button class="'+(primary?"primaryBtn":"ghostBtn")+'" type="button" data-channel="'+attr(channel)+'" onclick="connectChannel(this.dataset.channel)">Volver a conectar</button>';}if(item.disconnect_available){actions+='<button class="ghostBtn" type="button" data-channel="'+attr(channel)+'" data-name="'+attr(item.name||channel)+'" onclick="disconnectChannel(this.dataset.channel,this.dataset.name)">Desconectar</button>';}}return '<article class="channelConnectCard'+(soon?" comingSoon":"")+(primary?" primaryChannel":"")+(recommended&&!soon?" recommended":"")+'"><span class="channelConnectIcon '+attr(channel)+'">'+esc(channelConnectionInitial(channel))+'</span><div class="channelConnectCopy"><h4>'+esc(item.name||channel)+'</h4><p>'+esc(item.description||"")+'</p>'+account+activation+'</div><div class="channelConnectActions">'+actions+'</div></article>';});var calendars=payload.appointment_calendar_providers||[payload.appointment_calendar];cards.push(renderAppointmentCalendarGroup(calendars,canManage));root.innerHTML=cards.join("");renderConnectionHub();}
function fallbackChannelConnections(){return{ok:false,storage_ready:false,meta_authorization_available:{whatsapp:false,instagram:false,messenger:false},channels:[{id:"whatsapp",channel:"whatsapp",name:"WhatsApp",description:"Recomendado. Aquí es donde tu Nextfor empezará a atender primero.",status:"needs_attention",connect_available:false},{id:"instagram",channel:"instagram",name:"Instagram",description:"Opcional. Súmalo si también recibes clientes por mensajes de Instagram.",status:"needs_attention",connect_available:false},{id:"messenger",channel:"messenger",name:"Facebook Messenger",description:"Opcional. Súmalo si tus clientes también te escriben por Facebook.",status:"needs_attention",connect_available:false}]};}
function loadChannelConnections(force){if(!PANEL_CHANNEL_CONNECTIONS_ENABLED||state.channelConnectionsLoading||(!force&&state.channelConnections))return;if(DEMO_MODE&&PANEL_CHANNEL_CONNECTIONS_DEMO){state.channelConnections=PANEL_CHANNEL_CONNECTIONS_DEMO;renderChannelConnections();return;}state.channelConnectionsLoading=true;api("/admin/panel/channel-connections",{redirectOnAuth:true}).then(function(body){state.channelConnections=body;renderChannelConnections();try{var url=new URL(location.href),result=url.searchParams.get("connection"),connectionError=url.searchParams.get("connection_error"),calendarResult=url.searchParams.get("calendar");if(result==="success")setChannelConnectionMessage("Listo. Tu Nextfor ya sabe dónde atender.","success");else if(result==="select")setChannelConnectionMessage("Elige la cuenta correcta para terminar.");else if(result==="error")setChannelConnectionMessage(connectionError==="channel_asset_already_assigned"?"Esta cuenta ya está conectada a otra empresa. Desconéctala allí antes de asignarla de nuevo.":"No pudimos terminar este paso. Intenta de nuevo o habla con NextforIA.","error");if(calendarResult==="success")setChannelConnectionMessage("Listo. Creamos Citas NextforIA en tu calendario.","success");else if(calendarResult==="cancelled")setChannelConnectionMessage("No conectamos el calendario porque cerraste o cancelaste el permiso. Puedes intentarlo nuevamente.","error");else if(calendarResult==="error")setChannelConnectionMessage("No pudimos completar la conexión. Intenta nuevamente; si persiste, habla con NextforIA.","error");url.searchParams.delete("connection");url.searchParams.delete("connection_error");url.searchParams.delete("calendar");history.replaceState(null,"",url.pathname+url.search+url.hash);}catch(e){}}).catch(function(error){state.channelConnections=fallbackChannelConnections();renderChannelConnections();setChannelConnectionMessage(error&&error.status===401?"Tu sesión venció. Vuelve a ingresar para conectar tus canales.":"Tus datos están guardados. Estamos reactivando la conexión con Meta; Shopify sigue disponible abajo.","error");}).finally(function(){state.channelConnectionsLoading=false;});}
var metaSdkPromise=null;
function loadMetaSdk(config){
  if(window.FB){window.FB.init({appId:config.app_id,cookie:false,xfbml:false,version:config.graph_version||"v25.0"});return Promise.resolve(window.FB);}
  if(metaSdkPromise)return metaSdkPromise;
  metaSdkPromise=new Promise(function(resolve,reject){
    var timer=setTimeout(function(){reject(new Error("meta_sdk_timeout"));},15000);
    window.fbAsyncInit=function(){clearTimeout(timer);window.FB.init({appId:config.app_id,cookie:false,xfbml:false,version:config.graph_version||"v25.0"});resolve(window.FB);};
    var script=document.createElement("script");script.id="facebook-jssdk";script.async=true;script.defer=true;script.crossOrigin="anonymous";script.src="https://connect.facebook.net/es_LA/sdk.js";script.onerror=function(){clearTimeout(timer);reject(new Error("meta_sdk_unavailable"));};document.head.appendChild(script);
  });
  return metaSdkPromise;
}
function completeWhatsAppEmbeddedSignup(){
  var pending=state.whatsappEmbedded;
  if(!pending||pending.completing||!pending.code||!pending.session)return;
  pending.completing=true;
  setChannelConnectionMessage("Verificando tu WhatsApp con Meta…");
  api("/admin/panel/channel-connections/whatsapp/complete",{method:"POST",body:JSON.stringify({state:pending.config.oauth_state,code:pending.code,session:pending.session})}).then(function(body){
    state.whatsappEmbedded=null;state.channelConnections=null;if(body.connection&&body.connection.status==="connecting")setChannelConnectionMessage("Meta aceptó el número. Puedes terminar la activación aquí sin repetir la conexión.","success");else setChannelConnectionMessage("Listo. WhatsApp quedó conectado a tu Nextfor.","success");loadChannelConnections(true);
  }).catch(function(error){
    state.whatsappEmbedded=null;setChannelConnectionMessage(error.body&&error.body.message||"Meta no pudo terminar la conexión. Intenta de nuevo.","error");loadChannelConnections(true);
  });
}
function whatsappEmbeddedErrorMessage(payload){
  var detail=String(payload&&payload.data&&(payload.data.error_message||payload.data.message)||"").toLowerCase();
  if(/already|registered|another business|otro negocio|portfolio|portafolio|linked|vinculad/.test(detail))return"Este número ya está vinculado a otro portafolio de Meta. Desconéctalo allí o pide a soporte que lo mueva antes de volver a intentarlo.";
  return"La conexión con Meta quedó incompleta. Puedes retomarla cuando quieras.";
}
function launchWhatsAppEmbeddedSignup(config){
  state.whatsappEmbedded={config:config,code:null,session:null,completing:false};
  loadMetaSdk(config).then(function(FB){
    FB.login(function(response){
      var pending=state.whatsappEmbedded,code=response&&response.authResponse&&response.authResponse.code;
      if(!pending)return;
      if(!code){state.whatsappEmbedded=null;setChannelConnectionMessage("La autorización de Meta no se completó. Puedes intentarlo de nuevo.","error");return;}
      pending.code=code;setChannelConnectionMessage("Meta autorizó la cuenta. Terminando la conexión…");completeWhatsAppEmbeddedSignup();
    },{
      config_id:config.configuration_id,
      response_type:"code",
      override_default_response_type:true,
      extras:{setup:{},featureType:"whatsapp_business_app_onboarding",sessionInfoVersion:"3"}
    });
  }).catch(function(){
    state.whatsappEmbedded=null;setChannelConnectionMessage("No pudimos abrir la conexión segura de Meta. Recarga e intenta de nuevo.","error");
  });
}
window.addEventListener("message",function(event){
  if(event.origin!=="https://www.facebook.com"&&event.origin!=="https://web.facebook.com")return;
  var payload=event.data;
  if(typeof payload==="string"){try{payload=JSON.parse(payload);}catch(_){return;}}
  if(!payload||payload.type!=="WA_EMBEDDED_SIGNUP"||!state.whatsappEmbedded)return;
  if(payload.event==="FINISH"){
    var session=payload.data||{};
    if(!session.waba_id||!session.phone_number_id){setChannelConnectionMessage("Meta no devolvió el número seleccionado. Intenta de nuevo.","error");return;}
    state.whatsappEmbedded.session={waba_id:String(session.waba_id),phone_number_id:String(session.phone_number_id),business_id:session.business_id?String(session.business_id):""};
    completeWhatsAppEmbeddedSignup();
  }else if(payload.event==="CANCEL"||payload.event==="ERROR"){
    state.whatsappEmbedded=null;setChannelConnectionMessage(whatsappEmbeddedErrorMessage(payload),"error");
  }
});
function connectChannel(channel){if(DEMO_MODE){setChannelConnectionMessage("Demo: aquí continuarías con Meta para elegir la cuenta de tu negocio.","success");return;}var externalTab=channel==="whatsapp"?null:prepareExternalIntegrationTab("Meta");if(channel!=="whatsapp"&&!externalTab){setChannelConnectionMessage("Tu navegador bloqueó la nueva pestaña. Permite ventanas emergentes para Nextfor y vuelve a intentar.","error");return;}setChannelConnectionMessage(channel==="whatsapp"?"Abriendo la conexión segura de WhatsApp…":"Meta se abrirá en una pestaña nueva…");api("/admin/panel/channel-connections/"+encodeURIComponent(channel)+"/connect",{method:"POST",body:"{}"}).then(function(body){if(channel==="whatsapp"&&body.embedded_signup){launchWhatsAppEmbeddedSignup(body.embedded_signup);return;}if(!body.authorization_url)throw new Error("authorization_unavailable");if(!navigateExternalIntegrationTab(externalTab,body.authorization_url))throw new Error("popup_navigation_failed");setChannelConnectionMessage("Meta se abrió en una pestaña nueva. Termina allí y luego vuelve a este panel.","success");}).catch(function(error){closeExternalIntegrationTab(externalTab);setChannelConnectionMessage(error.body&&error.body.message||"No pudimos terminar este paso. Intenta de nuevo o habla con NextforIA.","error");loadChannelConnections(true);});}
function activateWhatsApp(button){if(state.whatsappActivating)return;var input=document.getElementById("whatsappRegistrationPin"),pin=String(input&&input.value||"").trim();if(!/^\d{6}$/.test(pin)){setChannelConnectionMessage("Ingresa el PIN actual de seis dígitos de la verificación en dos pasos de WhatsApp.","error");if(input)input.focus();return;}if(DEMO_MODE){setChannelConnectionMessage("Demo: WhatsApp quedaría activo con un PIN válido.","success");return;}state.whatsappActivating=true;if(button){button.disabled=true;button.textContent="Activando…";}var requestBody=JSON.stringify({pin:pin});if(input)input.value="";pin="";setChannelConnectionMessage("Activando el número en WhatsApp Cloud API…");api("/admin/panel/channel-connections/whatsapp/activate",{method:"POST",body:requestBody}).then(function(body){state.channelConnections=null;if(body.connection&&body.connection.status==="connected")setChannelConnectionMessage("Listo. WhatsApp quedó conectado y preparado para recibir mensajes.","success");else setChannelConnectionMessage("Meta recibió la activación y todavía está terminando el registro.","success");loadChannelConnections(true);}).catch(function(error){setChannelConnectionMessage(error.body&&error.body.message||"Meta no aceptó la activación. Verifica el PIN antes de volver a enviarlo.","error");state.channelConnections=null;loadChannelConnections(true);}).finally(function(){requestBody="";state.whatsappActivating=false;if(button&&button.isConnected){button.disabled=false;button.textContent="Confirmar PIN y activar";}});}
function connectAppointmentCalendar(provider){provider=provider==="microsoft"?"microsoft":"google";var name=provider==="microsoft"?"Microsoft":"Google";if(DEMO_MODE){setChannelConnectionMessage("Demo: aquí abriríamos "+name+" para conectar el calendario de tu negocio.","success");return;}var externalTab=prepareExternalIntegrationTab(name+" Calendar");if(!externalTab){setChannelConnectionMessage("Tu navegador bloqueó la nueva pestaña. Permite ventanas emergentes para Nextfor y vuelve a intentar.","error");return;}setChannelConnectionMessage(name+" se abrirá en una pestaña nueva…");api("/admin/panel/appointment-calendar/"+provider+"/connect",{method:"POST",body:JSON.stringify({return_to:"channels"})}).then(function(body){if(!body.authorization_url)throw new Error("authorization_unavailable");if(!navigateExternalIntegrationTab(externalTab,body.authorization_url))throw new Error("popup_navigation_failed");setChannelConnectionMessage(name+" se abrió en una pestaña nueva. Termina allí y luego vuelve a este panel.","success");}).catch(function(error){closeExternalIntegrationTab(externalTab);setChannelConnectionMessage(error.body&&error.body.message||"No pudimos abrir el calendario. Intenta de nuevo o habla con NextforIA.","error");loadChannelConnections(true);});}
function selectChannelAsset(channel){var select=document.getElementById("channelAsset-"+channel),assetId=select&&select.value;if(!assetId)return;setChannelConnectionMessage("Revisando que sea la cuenta correcta…");api("/admin/panel/channel-connections/"+encodeURIComponent(channel)+"/select",{method:"POST",body:JSON.stringify({asset_id:assetId})}).then(function(){state.channelConnections=null;setChannelConnectionMessage("Listo. Tu Nextfor ya sabe dónde atender.","success");loadChannelConnections(true);}).catch(function(error){setChannelConnectionMessage(error.body&&error.body.message||"No pudimos terminar este paso. Intenta de nuevo o habla con NextforIA.","error");});}
function disconnectChannel(channel,name){if(!confirm("¿Desconectar "+name+"? Tu Nextfor dejará de recibir nuevos mensajes de este canal."))return;setChannelConnectionMessage("Desconectando el canal…");api("/admin/panel/channel-connections/"+encodeURIComponent(channel)+"/disconnect",{method:"POST",body:"{}"}).then(function(){state.channelConnections=null;setChannelConnectionMessage("Canal desconectado.","success");loadChannelConnections(true);}).catch(function(error){setChannelConnectionMessage(error.body&&error.body.message||"No pudimos desconectar el canal. Habla con NextforIA.","error");});}
function disconnectAppointmentCalendar(){if(!confirm("¿Desconectar el calendario? Nextfor dejará de crear o sincronizar citas allí."))return;setChannelConnectionMessage("Desconectando calendario…");api("/admin/panel/appointment-calendar/disconnect",{method:"POST",body:"{}"}).then(function(){state.channelConnections=null;setChannelConnectionMessage("Calendario desconectado.","success");loadChannelConnections(true);}).catch(function(error){setChannelConnectionMessage(error.body&&error.body.message||"No pudimos desconectar el calendario. Habla con NextforIA.","error");});}
function showTab(name){
  if(name==="human")name="conversations";
  if(name==="tests"&&!SERVER_CAPABILITIES.run_tests)name="plan";
  if(PANEL_CONTEXT.v2&&name==="appointments"&&!PANEL_CONTEXT.appointments)name="summary";
  if(PANEL_CONTEXT.v2&&["summary","conversations","retargeting"].includes(name)&&!PANEL_CONTEXT.support)name="appointments";
  state.tab=name;
  if(name==="appointments")state.bot="appointments";
  if(name==="summary"||name==="conversations"||name==="retargeting")state.bot="support";
  syncBotSidebar();
  document.body.classList.remove("chat-open");
  document.body.classList.toggle("conversations-view",name==="conversations");
  document.body.classList.toggle("appointment-view",name==="appointments");
  var supportModule=name==="summary"||name==="conversations",setupModule=name==="setup"||name==="notifications",retargetingModule=name==="retargeting",appointmentsModule=name==="appointments";
  ["summary","conversations","appointments","plan","channels","setup","notifications","retargeting","tests"].forEach(function(tab){var nav=document.getElementById("nav-"+tab),mnav=document.getElementById("mnav-"+tab);if(nav)nav.classList.toggle("active",tab===name);if(mnav)mnav.classList.toggle("active",tab===name);});
  ["module-support","mobileModule-support"].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.toggle("active",supportModule);});
  ["module-setup","mobileModule-setup"].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.toggle("active",setupModule);});
  ["module-retargeting","mobileModule-retargeting"].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.toggle("active",retargetingModule);});
  ["module-appointments","mobileModule-appointments"].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.toggle("active",appointmentsModule);});
  var summary=document.getElementById("panel-summary"),inbox=document.getElementById("panel-inbox"),appointments=document.getElementById("panel-appointments"),plan=document.getElementById("panel-plan"),channels=document.getElementById("panel-channels"),setup=document.getElementById("panel-setup"),notifications=document.getElementById("panel-notifications"),retargeting=document.getElementById("panel-retargeting"),tests=document.getElementById("panel-tests"),toolbar=document.querySelector(".toolbar");
  if(summary)summary.classList.toggle("active",name==="summary");
  if(inbox)inbox.classList.toggle("active",name==="conversations");
  if(appointments)appointments.classList.toggle("active",name==="appointments");
  if(plan)plan.classList.toggle("active",name==="plan");
  if(name==="plan"){loadPlanCatalog(false);loadBilling(false);}
  if(channels)channels.classList.toggle("active",name==="channels");
  if(setup)setup.classList.toggle("active",name==="setup");
  if(notifications)notifications.classList.toggle("active",name==="notifications");
  if(retargeting)retargeting.classList.toggle("active",name==="retargeting");
  if(tests)tests.classList.toggle("active",name==="tests");
  if(toolbar)toolbar.style.display=(name==="plan"||name==="appointments"||name==="channels"||name==="setup"||name==="notifications"||name==="retargeting")?"none":"flex";
  var pageTitle=name==="summary"?"Resumen":name==="tests"?"Pruebas":name==="plan"?"Mi plan":name==="channels"?"Finaliza el entrenamiento":name==="setup"?"Configuración de tu Nextfor IA":name==="notifications"?"Notificaciones Nextfor":name==="retargeting"?"Seguimientos comerciales":name==="appointments"?"Citas":"Conversaciones";
  var pageSubtitle=name==="summary"?("Resultados de "+(PANEL_CONTEXT.v2?PANEL_CONTEXT.assignedBotName:"tu bot de atención")+" · Últimos 7 días"):name==="tests"?"Herramientas seguras para validar el bot.":name==="plan"?"Plan, módulos y consumo":name==="channels"?"Dile a tu Nextfor dónde debe atender":name==="setup"?"Tu negocio, tu voz y tus reglas en un solo lugar":name==="notifications"?"Mejoras, solicitudes y avisos importantes para tu empresa.":name==="retargeting"?"Cola segura, aprobaciones, cancelaciones y auditoría":name==="appointments"?"Tu agenda llenándose, sin perseguir confirmaciones.":"La IA atiende y te deja solo lo que necesita de ti.";
  text("pageTitle",pageTitle);
  text("pageSubtitle",pageSubtitle);
  if(window.innerWidth<=760&&name!=="appointments"){var activeMobileModule=document.getElementById("mobileModule-"+name);if(activeMobileModule)activeMobileModule.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});}
  try{var url=new URL(location.href);url.searchParams.set("tab",name);url.searchParams.delete("channel");url.searchParams.delete("key");history.replaceState(null,"",url.pathname+url.search+url.hash);}catch(e){}
  if(name==="channels")loadChannelConnections(false);if(name==="setup"){loadBotSetup();loadBotPersonality(false);}if(name==="notifications")renderNextforNotifications();if(name==="retargeting")loadRetargeting(false);if(name==="appointments")loadAppointments();renderInbox();renderPlan();window.scrollTo(0,0);
}
function loadPanelData(manual){if(state.loading)return;state.loading=true;if(manual)text("chatStatus","Actualizando datos...");api(PANEL_DATA_PATH,{redirectOnAuth:true}).then(function(data){state.data=data;state.notifications=data.nextfor_notifications||state.notifications;state.allConversations=data.conversations||[];applyChannelData();if(!DEMO_MODE)SERVER_CAPABILITIES=data.user&&data.user.capabilities||SERVER_CAPABILITIES;renderBusinessContext(data.business);renderChannelState();renderHeader();renderSummary();renderInbox();renderNextforNotifications();if(manual)text("chatStatus","Datos actualizados.");}).catch(function(error){text("chatStatus","No se pudieron actualizar los datos: "+error.message);}).finally(function(){state.loading=false;});}
function loadPanelHealth(){if(!PANEL_HEALTH_PATH)return;api(PANEL_HEALTH_PATH).then(function(health){state.health=health;renderChannelState();}).catch(function(){});}
function panelMoney(value){var n=(value===null||value===undefined||value==="")?null:Number(value);if(n===null||!isFinite(n)||n<=0)return null;return "$"+String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,".");}
function panelChats(value){var n=(value===null||value===undefined||value==="")?null:Number(value);if(n===null||!isFinite(n)||n<0)return "chats incluidos por definir";return n+" chats incluidos";}
function planPriceLine(plan){var custom=!!(plan&&(String(plan.id||"").indexOf("signature")>=0||String(plan.etiqueta||"").toLowerCase().indexOf("definir")>=0)&&Number(plan.precio_mensual||0)===0),mensual=panelMoney(plan.precio_mensual);var head=custom?"Precio a definir con NextforIA":(mensual?(mensual+"/mes"):"Mensualidad por definir");var sub="Sin setup cost · "+panelChats(plan.chats_incluidos);return '<div class="priceLine"><strong>'+esc(head)+'</strong><span>'+esc(sub)+'</span></div>';}
function planCatalogNotice(message,retry){return '<div class="planCatalogNotice">'+esc(message)+(retry?' <button class="ghostBtn" type="button" onclick="loadPlanCatalog(true)">Reintentar</button>':"")+'</div>';}
function renderPlanCatalog(payload){var grid=document.getElementById("planCatalogGrid");if(!grid)return;var plans=((payload&&payload.plans)||[]).filter(function(plan){return plan&&plan.activo!==false;});var assigned=PANEL_CONTEXT.v2?String(PANEL_CONTEXT.assignedBotId||"").toLowerCase():"";if(assigned)plans=plans.filter(function(plan){var bot=(plan.bot_id===null||plan.bot_id===undefined)?"":String(plan.bot_id).toLowerCase();return !bot||bot===assigned;});plans=plans.slice().sort(function(a,b){return (Number(a.orden)||0)-(Number(b.orden)||0);});if(!plans.length){grid.setAttribute("data-state","empty");grid.innerHTML=planCatalogNotice("Todavía no hay planes publicados para tu cuenta.",true);return;}var current=String(PANEL_CONTEXT.planId||"").toLowerCase();grid.setAttribute("data-state","ready");grid.innerHTML=plans.map(function(plan){var mine=String(plan.id||"").toLowerCase()===current;var badge=mine?'<span class="planBadge">Tu plan actual</span>':(plan.etiqueta?'<span class="planBadge">'+esc(plan.etiqueta)+'</span>':"");var benefits=(plan.beneficios||[]).map(function(item){return '<li><span class="benefitIcon">'+PANEL_CHECK_ICON+'</span>'+esc(item)+'</li>';}).join("");var action=mine?'<button class="primaryBtn" type="button" disabled>Plan activo</button>':'<button class="primaryBtn" type="button">Elegir plan</button>';return '<article class="planOption'+(mine?" current":"")+'">'+badge+'<h4>'+esc(plan.nombre||plan.name||plan.id||"Plan")+'</h4><p>'+esc(plan.descripcion||"")+'</p>'+planPriceLine(plan)+(benefits?'<ul class="benefits">'+benefits+'</ul>':"")+'<div class="planActions">'+action+'</div></article>';}).join("");}
function loadPlanCatalog(force){var grid=document.getElementById("planCatalogGrid");if(!grid)return;if(!force&&grid.getAttribute("data-state")==="ready")return;grid.setAttribute("data-state","loading");grid.innerHTML=planCatalogNotice("Cargando planes…",false);api("/admin/panel/catalogs").then(renderPlanCatalog).catch(function(){grid.setAttribute("data-state","error");grid.innerHTML=planCatalogNotice("No pudimos cargar los planes en este momento.",true);});}
function billingMoney(value){var number=Number(value);if(!isFinite(number)||number<0)return"—";return"$"+String(Math.round(number)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,".");}
function billingDate(value){if(!value)return"—";var date=new Date(value);return isNaN(date.getTime())?"—":date.toLocaleDateString("es-CO",{year:"numeric",month:"short",day:"numeric"});}
function billingStatus(value){return({pending:"Pendiente",paid:"Pagado",failed:"Fallido",refunded:"Reembolsado",trial:"Trial",active:"Activa",past_due:"Vencida",suspended:"Suspendida",cancelled:"Cancelada",pilot:"Piloto"})[value]||"Sin iniciar";}
function renderBilling(){var root=document.getElementById("billingSummary"),billing=state.billing;if(!root)return;if(!billing){root.innerHTML='<div class="planCatalogNotice">La facturación se preparará al confirmar tu plan.</div>';return;}var history=billing.history||[],canPay=["pending","failed"].includes(billing.payment_status)&&!["trial","pilot","active"].includes(billing.subscription_status),button=canPay?'<button class="primaryBtn" id="billingPayButton" type="button" onclick="startBillingCheckout()">Pagar en Wompi · Sandbox</button>':"",rows=history.length?history.map(function(item){return '<div class="billingHistoryRow"><strong>'+esc(billingStatus(item.payment_status))+' · '+esc(billingMoney(item.amount_charged))+'</strong><span>'+esc(billingDate(item.payment_date||item.created_at))+'</span><small>Comisión '+esc(billingMoney(item.provider_fee))+' <span class="billingFeeLabel">'+esc(item.provider_fee_type==="real"?"Real":"Estimada")+'</span> · Neto '+esc(billingMoney(item.net_amount))+'</small></div>';}).join(""):'<div class="planCatalogNotice">Aún no hay movimientos de pago.</div>';root.innerHTML='<div class="billingGrid"><div class="billingMetric"><small>Bot y plan</small><strong>'+esc((billing.bot_name||billing.bot_id)+" · "+(billing.plan_name||billing.plan_id))+'</strong></div><div class="billingMetric"><small>Precio contratado</small><strong>'+esc(billingMoney(billing.contracted_setup_price))+' setup · '+esc(billingMoney(billing.contracted_monthly_price))+'/mes</strong></div><div class="billingMetric"><small>Estado</small><strong>'+esc(billingStatus(billing.payment_status))+' · '+esc(billingStatus(billing.subscription_status))+'</strong></div><div class="billingMetric"><small>Próximo pago</small><strong>'+esc(billingDate(billing.next_payment_date))+'</strong></div></div><div style="margin-top:14px">'+button+'</div><div class="billingHistory"><strong>Historial de pagos</strong>'+rows+'</div>';}
function loadBilling(force){if(!PANEL_PAYMENTS_ENABLED||state.billingLoading||(!force&&state.billing))return;state.billingLoading=true;api("/admin/panel/billing").then(function(body){state.billing=body.billing||null;renderBilling();}).catch(function(error){var root=document.getElementById("billingSummary");if(root)root.innerHTML='<div class="planCatalogNotice">'+esc("No pudimos cargar la facturación: "+error.message)+' <button class="ghostBtn" type="button" onclick="loadBilling(true)">Reintentar</button></div>';}).finally(function(){state.billingLoading=false;});}
function startBillingCheckout(){var button=document.getElementById("billingPayButton"),externalTab=prepareExternalIntegrationTab("Wompi");if(!externalTab){var blocked=document.getElementById("billingSummary");if(blocked)blocked.insertAdjacentHTML("afterbegin",'<div class="planCatalogNotice">Tu navegador bloqueó la nueva pestaña. Permite ventanas emergentes para Nextfor y vuelve a intentar.</div>');return;}if(button){button.disabled=true;button.textContent="Preparando checkout…";}api("/admin/panel/billing/checkout",{method:"POST",body:JSON.stringify({plan_id:PANEL_CONTEXT.planId,bot_id:PANEL_CONTEXT.assignedBotId})}).then(function(body){if(!body.checkout||!body.checkout.checkout_url)throw new Error("checkout_unavailable");if(!navigateExternalIntegrationTab(externalTab,body.checkout.checkout_url))throw new Error("popup_navigation_failed");if(button){button.disabled=false;button.textContent="Abrir Wompi de nuevo";}}).catch(function(error){closeExternalIntegrationTab(externalTab);if(button){button.disabled=false;button.textContent="Pagar en Wompi · Sandbox";}var root=document.getElementById("billingSummary");if(root)root.insertAdjacentHTML("afterbegin",'<div class="planCatalogNotice">'+esc("No pudimos abrir Wompi: "+error.message)+'</div>');});}
function panelInitials(value){var words=String(value||"").trim().split(/\\s+/).filter(Boolean);return (words.slice(0,2).map(function(word){return word.charAt(0);}).join("")||"NX").toUpperCase().slice(0,3);}
function panelBusinessName(business){return String((business&&(business.company_name||business.name))||PANEL_CONTEXT.businessName).trim();}
function renderBusinessContext(business){if(!PANEL_CONTEXT.v2||!business)return;var name=panelBusinessName(business),initials=panelInitials(name),logo=business.logo_data_url||"";PANEL_CONTEXT.businessName=name;text("brandBusinessName",name);text("mobileBrandBusinessName",name);applyPanelLogo(logo,name);var mobileAvatar=document.querySelector(".mobileAvatar");if(mobileAvatar)mobileAvatar.textContent=initials;document.title="Nextfor IA · "+name;}
function renderChannelState(){if(!state.data)return;var channels=state.data.business&&state.data.business.channels||{},rows=Object.keys(channels).map(function(key){return channels[key]||{};}),readyCount=rows.filter(function(row){return row.status==="ready";}).length,channelReady=readyCount>0,total=rows.reduce(function(sum,row){return sum+(row.conversations_count||0);},0),whatsapp=state.health&&state.health.whatsapp_setup||null,activationPending=!!(whatsapp&&whatsapp.app_review_approved&&!whatsapp.real_number_active),ready=channelReady&&!activationPending,status=document.getElementById("moduleStatus-support");text("moduleStatus-support",activationPending?"Numero real pendiente":readyCount+" canales activos");if(status)status.classList.toggle("off",!ready);if(activationPending){text("mobileModule-support","Atención al cliente · Activación pendiente");text("channelStatusTitle","Meta aprobada · falta activar WhatsApp");text("channelStatusDetail",(whatsapp.target_display_phone||"Número real")+" · Panel e intervención listos");}else if(PANEL_CONTEXT.v2){text("mobileModule-support",PANEL_CONTEXT.assignedBotName+" · "+(ready?"Activo":"Pendiente"));text("channelStatusTitle",ready?"Bot conectado":"Configuración pendiente");text("channelStatusDetail",PANEL_CONTEXT.assignedBotName+" · Plan "+PANEL_CONTEXT.planName);}else{text("mobileModule-support","Atención al cliente · "+(ready?"Activo":"Pendiente"));text("channelStatusTitle",ready?"Bot de atención conectado":"Configuración pendiente");text("channelStatusDetail",readyCount+" canales · "+total+" conversaciones visibles");}var search=document.getElementById("conversationSearch");if(search)search.placeholder="Buscar por nombre, @usuario, teléfono, correo o mensaje";var dot=document.getElementById("channelStatusDot");if(dot)dot.style.background=ready?"#22C778":"#F5A524";}
function renderPlan(){var p=PLAN_DATA,included=Math.max(0,Number(p.chatsIncluidos)||0),used=Math.max(0,Number(p.chatsConsumidos)||0),available=Math.max(0,included-used),pct=included?Math.min(100,Math.round(used/included*100)):0,status=pct>=100&&included?"limit":(pct>=80?"warn":"normal"),fill=document.getElementById("usageFill");text("planName",p.nombre);text("planMonthly",p.mensualidad);text("planRenewal",p.renovacion);text("usagePct",pct+"%");text("chatsConsumed",used);text("chatsIncluded",included||"—");text("chatsAvailable",included?available:"—");text("usageState",included?(status==="limit"?"Límite alcanzado":(status==="warn"?"Atención":"Vas al día")):"Por configurar");text("usageMessage",included?(status==="limit"?"Alcanzaste el 100% de tus chats. Suma un paquete de rescate para seguir atendiendo.":(status==="warn"?"Has utilizado el "+pct+"% de tus chats disponibles.":"Vas al día con tu consumo de chats.")):"El consumo aparecerá cuando se configure el límite de tu plan.");if(fill){fill.className="usageFill"+(status==="warn"?" warn":(status==="limit"?" limit":""));fill.style.width=pct+"%";}text("planRecommendation",p.rescatesFrecuentes?"Estás cerca del límite. Si compras rescates seguido, cambiar a Nextfor Dúo podría salirte más económico y darte más margen para crecer.":"Tu consumo adicional es ocasional. Tu plan actual sigue siendo el adecuado.");text("refCode",p.referidos.codigo);text("refHint",(p.referidos.count||0)+" referidos activos · Se activa cuando tu referido esté activo y realice su primer pago a Nextfor IA.");}
function notificationActionUrl(url){
  url=String(url||"").trim();
  if(!url)return"";
  try{
    var target=new URL(url,location.origin);
    if(target.origin!==location.origin||target.pathname.indexOf("/admin/")!==0)return"";
    if(target.pathname==="/admin/client-onboarding"){
      target.searchParams.set("edit","1");
      target.searchParams.set("return_to","/admin/panel?tab=notifications");
    }
    return target.pathname+target.search+target.hash;
  }catch(_){return"";}
}
function notificationAction(url){var target=notificationActionUrl(url);if(!target)return;location.assign(target);}
function notificationCardKey(event,card){if(event.key==="Enter"||event.key===" "){event.preventDefault();notificationAction(card&&card.dataset&&card.dataset.actionUrl);}}
function renderNextforNotifications(){var root=document.getElementById("nextforNotifications"),notifications=state.notifications||{},items=notifications.items||[],pending=Number(notifications.pending_count)||0;["navNotificationCount","mnavNotificationCount"].forEach(function(id){var el=document.getElementById(id);if(el){el.textContent=pending||"";el.style.display=pending?"grid":"none";}});if(!root)return;if(!items.length){root.innerHTML='<article class="notificationEmpty">No tienes notificaciones pendientes. Si Nextfor agrega mejoras o pide datos nuevos, aparecerán aquí.</article>';return;}root.innerHTML=items.map(function(item){var questions=(item.pending_questions||[]).slice(0,6).map(function(question){return '<span>'+esc(question.label||question.path)+'</span>';}).join(""),actionUrl=String(item.action_url||""),action=actionUrl?'<button class="primaryBtn" type="button" data-action-url="'+attr(actionUrl)+'" onclick="event.stopPropagation();notificationAction(this.dataset.actionUrl)">'+esc(item.action_label||"Abrir")+'</button>':'',high=item.priority==="high",clickAttrs=actionUrl?' clickable" role="button" tabindex="0" data-action-url="'+attr(actionUrl)+'" onclick="notificationAction(this.dataset.actionUrl)" onkeydown="notificationCardKey(event,this)':'"';return '<article class="notificationCard '+(high?"high":"")+clickAttrs+'><span class="notificationIcon">'+(high?PANEL_CHECK_ICON:"✧")+'</span><div class="notificationCopy"><h4>'+esc(item.title||"Notificación")+'</h4><p>'+esc(item.message||"")+'</p>'+(questions?'<div class="pendingQuestionList">'+questions+'</div>':"")+'</div><div>'+action+'</div></article>';}).join("");if(pending)renderPendingSetupReminder(pending);}
function renderPendingSetupReminder(pending){var card=document.getElementById("setupHomeCard");if(!card)return;card.hidden=false;card.classList.remove("complete");text("setupHomeTitle","Nextfor tiene una mejora pendiente");text("setupHomeCopy","Agregamos "+pending+" dato"+(pending===1?"":"s")+" para entrenar mejor tu bot. Complétalo sin repetir todo el setup.");text("setupHomeProgress","Pendiente");var bar=document.getElementById("setupHomeProgressBar");if(bar)bar.style.width="100%";text("setupHomeButton","Completar información");var button=document.getElementById("setupHomeButton");if(button)button.onclick=function(){notificationAction("/admin/client-onboarding?edit=1&focus=pending");};}
function scrollToPlan(id){var el=document.getElementById("plan-"+id);if(el)el.scrollIntoView({behavior:"smooth",block:"center"});}
function copyReferral(){var code=(PLAN_DATA.referidos&&PLAN_DATA.referidos.codigo)||"NEXTFORIA",msg="Código copiado: "+code;if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(code).then(function(){text("refHint","¡Copiado! Comparte "+code+" con tu referido.");}).catch(function(){text("refHint",msg);});}else{text("refHint",msg);}}
function shareReferral(){var code=(PLAN_DATA.referidos&&PLAN_DATA.referidos.codigo)||"NEXTFORIA",message="Te comparto Nextfor IA. Usa mi código "+code+" y cuéntales que vienes referido por "+PANEL_CONTEXT.businessName+".";if(navigator.share){navigator.share({title:"Nextfor IA",text:message}).catch(function(){copyReferral();});}else if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(message).then(function(){text("refHint","Mensaje de referido copiado. Pégalo en WhatsApp.");});}else{text("refHint",message);}}
function renderHeader(){if(!state.data)return;var pending=state.conversations.filter(function(item){return uiStatus(item)==="you";}).length;text("navConvCount",pending||"");}
function pendingSalesClosings(){return state.conversations.filter(function(item){if(uiStatus(item)!=="you")return false;var tags=item.tags||[],memory=item.memory||{},stage=memory.purchase_stage||"",textValue=String(item.last_text||"").toLowerCase();return !!(item.business_signals&&item.business_signals.sales_assisted)||tags.includes("venta")||tags.includes("pendiente_pago")||["payment_pending","order_handoff"].includes(stage)||/comprar|quiero|me interesa|disponible|confirmar (el )?pago|cerrar la compra/.test(textValue);}).length;}
function renderSummary(){if(!state.data)return;var s=activeSummary(),sales=s.sales_assisted||{},sol=s.solutions_provided||{},rating=s.rating||{},closings=pendingSalesClosings();var clients=s.clients_attended||0,saved=estimateHours(clients),rate=sol.rate==null?null:sol.rate,solvedValue=rate==null?(sol.count||0):(rate+"%");text("heroLine","Esta semana atendiste a "+clients+" clientes entre WhatsApp, Instagram y Messenger — tu equipo se ahorró ≈ "+saved+" de trabajo repetitivo, sin dejar un solo mensaje sin responder.");text("kSales",sales.count||0);text("kSalesSub",(sales.count||0)+(sales.count===1?" venta asistida":" ventas asistidas"));text("kSalesDelta","↗ +"+(sales.count||0));text("kClients",clients);text("kResolved",solvedValue);text("kResolvedSub",(sol.count||0)?((sol.count||0)+" soluciones sin ayuda humana"):"Aún no hay conversaciones resueltas");text("kClosings",closings);text("kClosingsSub",closings===1?"chat listo para cerrar la venta":"chats listos para cerrar la venta");var progress=rate==null?0:Math.max(0,Math.min(100,rate));var bar=document.getElementById("resolvedProgress");if(bar)bar.style.width=progress+"%";text("kResponse",clients?"4 s":"24/7");text("satValue",rating.average==null?"-":rating.average);text("satCopy",(rating.count||0)+" calificaciones");text("satPositive",rating.count?"94 % positivas":"0 % positivas");var deg=rating.average==null?0:Math.max(0,Math.min(360,Math.round(rating.average/5*360)));var ring=document.getElementById("satRing");if(ring)ring.style.setProperty("--satDeg",deg+"deg");renderActivity(s.messages_by_day||[]);renderGaps(s.search_gaps||[]);renderOutcomes(s);renderNextStep(s);renderInsight(s,solvedValue);}
function estimateHours(clients){if(!clients)return "0 h";var hours=Math.max(1,Math.round(clients*8/60));return hours+" h";}
function renderActivity(items){var box=document.getElementById("activityChart");if(!box)return;if(!items.length){box.innerHTML='<svg viewBox="0 0 700 220" preserveAspectRatio="none"><path d="M0 140 C90 120 150 118 230 80 C310 42 360 160 440 80 C520 0 610 10 700 92" fill="none" stroke="#12A8F4" stroke-width="5"/><path d="M0 220 L0 140 C90 120 150 118 230 80 C310 42 360 160 440 80 C520 0 610 10 700 92 L700 220 Z" fill="rgba(18,168,244,.14)"/></svg>';text("activityRange","vs. período anterior");return;}var max=Math.max.apply(null,items.map(function(i){return i.messages||0;}))||1;var pts=items.map(function(i,idx){var x=items.length===1?350:idx*(700/(items.length-1));var y=190-((i.messages||0)/max*150);return [x,y];});var d=pts.map(function(p,i){return (i?"L":"M")+p[0]+" "+p[1];}).join(" ");box.innerHTML='<svg viewBox="0 0 700 220" preserveAspectRatio="none"><path d="'+d+'" fill="none" stroke="#12A8F4" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="'+d+' L700 220 L0 220 Z" fill="rgba(18,168,244,.14)"/></svg>';text("activityRange","+18% vs. período anterior");}
function renderGaps(gaps){var box=document.getElementById("gapList");if(!box)return;box.innerHTML=gaps.length?gaps.slice(0,4).map(function(item){return '<div class="requestRow"><span class="zap">⚡</span><strong>'+esc(item.query)+'</strong><span class="countPill">'+esc(item.count)+'×</span></div>';}).join(""):'<div class="empty">No hay búsquedas sin resultado en este período.</div>';}
function renderOutcomes(s){var sol=s.solutions_provided||{},sales=s.sales_assisted||{};var max=Math.max(sol.count||0,sales.count||0,s.pending_human_replies||0,1);var rows=[["Soluciones del bot",sol.count||0,""],["Ventas asistidas",sales.count||0,"green"],["Pendientes del equipo",s.pending_human_replies||0,"amber"]];var box=document.getElementById("outcomeList");if(box)box.innerHTML=rows.map(function(row){var pct=Math.round(row[1]/max*100);return '<div class="outcomeRow"><label>'+esc(row[0])+'</label><strong>'+esc(row[1])+'</strong><div class="track '+row[2]+'"><span style="width:'+pct+'%"></span></div></div>';}).join("");}
function renderNextStep(s){var msg="Cuando aparezcan conversaciones pendientes, retómalas antes de que se enfríen.";if((s.pending_human_replies||0)>0)msg="<strong>"+s.pending_human_replies+" conversaciones</strong> esperan tu toque humano. Retómalas antes de que se enfríen.";else if((s.opportunities_detected||0)>0)msg="<strong>"+s.opportunities_detected+" oportunidades</strong> muestran productos que tus clientes están pidiendo.";document.getElementById("nextStep").innerHTML=msg;}
function renderInsight(s,solvedValue){var opportunities=s.opportunities_detected||0,pending=s.handoffs_to_human||0;document.getElementById("iaSummary").innerHTML="El bot resolvió <strong>"+esc(solvedValue)+"</strong> solo. Detectó <em>"+opportunities+" oportunidades</em> de venta y derivó "+pending+" casos a tu equipo cuando hacía falta. Vas por buen camino.";}
function findConversation(key){return state.conversations.find(function(item){return conversationKey(item)===key;})||null;}
function tagLabel(id){var tags=state.data&&state.data.tags||[],tag=tags.find(function(item){return item.id===id;});return tag?tag.label:id;}
function matchesConversation(item,query){if(!query)return true;var memory=item.memory||{},messages=(item.messages||[]).map(function(m){return m.text||"";}).join(" "),tags=(item.tags||[]).map(tagLabel).join(" "),haystack=[item.phone,item.email,item.id,item.instagram_username,item.messenger_username,item.channel,item.channel_label,item.display_name,item.note,item.last_text,messages,tags,memory.preferred_name,memory.purchase_stage,(memory.interests||[]).join(" ")].join(" ").toLowerCase();return haystack.indexOf(query)>=0;}
function setConversationFilter(filter){state.filter=filter;renderInbox();}
function filteredConversations(){var input=document.getElementById("conversationSearch"),query=input?input.value.trim().toLowerCase():"";return state.conversations.filter(function(item){var status=item.conversation_status||(item.mode==="human"?(item.needs_reply?"needs_attention":"team_active"):"ai_active");if(state.tab==="human"&&status!=="needs_attention"&&status!=="team_active")return false;if(state.filter!=="all"&&status!==state.filter)return false;return matchesConversation(item,query);});}
function isHumanTab(){return state.tab==="human";}
function waitMinutes(item){var ts=Date.parse(item&&item.last_ts||"");if(!ts)return 0;return Math.max(1,Math.round((Date.now()-ts)/60000));}
function handoffReason(item){var tags=item&&item.tags||[],text=((item&&item.last_text)||"").toLowerCase();if(tags.indexOf("garantia")>=0||/garant|reclamo|dañado|malo/.test(text))return "😟 Reclamo o garantía";if(tags.indexOf("pendiente_pago")>=0||/precio|descuento|pago|negoci/.test(text))return "💸 Negociación o pago";if(tags.indexOf("envio")>=0||/env[ií]o|domicilio|pedido|gu[ií]a/.test(text))return "📦 Pedido o envío";if(tags.indexOf("venta")>=0||/compr|quiero|disponible|stock/.test(text))return "🧸 Oportunidad de venta";if(item&&item.needs_reply)return "🙋 Pidió hablar con alguien";return "✅ En seguimiento";}
function handoffStatus(item){if(!item)return "Sin caso seleccionado";if(item.conversation_status==="resolved")return item.resolution_label||"✓ Resuelta";if(item.conversation_status==="needs_attention")return "🙋 Necesita tu atención · "+waitMinutes(item)+" min";if(item.conversation_status==="team_active")return "👤 Tu equipo está atendiendo";return "✦ La IA está atendiendo";}
function setFilterLabels(human){var visible=human?state.conversations.filter(function(item){return item.conversation_status==="needs_attention"||item.conversation_status==="team_active";}):state.conversations,counts={ai_active:0,needs_attention:0,team_active:0,resolved:0};visible.forEach(function(item){if(counts[item.conversation_status]!=null)counts[item.conversation_status]++;});var labels={all:"Todas "+visible.length,ai:"IA atendiendo "+counts.ai_active,attention:"Te necesitan "+counts.needs_attention,team:"Con tu equipo "+counts.team_active,resolved:"Resueltas "+counts.resolved};Object.keys(labels).forEach(function(key){var b=document.getElementById("filter-"+key);if(b){b.textContent=labels[key];b.style.display=human&&(key==="ai"||key==="resolved")?"none":"";}});}
function renderInbox(){var panel=document.getElementById("panel-inbox"),human=isHumanTab();if(panel)panel.classList.toggle("humanMode",human);setFilterLabels(human);text("inboxTitle",human?"Intervención humana":"Conversaciones");text("inboxSubtitle",human?"Solo los casos donde tu equipo puede aportar valor.":"Ve qué está haciendo la IA y qué ya quedó resuelto.");[{id:"all",value:"all"},{id:"ai",value:"ai_active"},{id:"attention",value:"needs_attention"},{id:"team",value:"team_active"},{id:"resolved",value:"resolved"}].forEach(function(filter){var b=document.getElementById("filter-"+filter.id);if(b)b.classList.toggle("active",state.filter===filter.value);});renderThreads();renderChat();}
function renderThreads(){var box=document.getElementById("threadList");if(!box)return;var human=isHumanTab(),items=filteredConversations();box.innerHTML=items.length?items.map(function(item){var key=conversationKey(item),status=item.conversation_status||"ai_active",classes="thread"+(key===state.selected?" active":"")+(status==="needs_attention"?" pending":"");var tags=(item.tags||[]).slice(0,2).map(function(tag){return '<span class="tag">'+esc(tagLabel(tag))+'</span>';}).join("");var wait=waitMinutes(item),hot=wait>=6,reason=human?'<div class="threadReason"><span>'+esc(handoffReason(item))+'</span>'+(status==="needs_attention"?'<span class="waitPill'+(hot?' hot':'')+'">⏱️ '+wait+' min</span>':'')+'</div>':"",resolution=item.resolution_label?'<span class="tag statusTag status-resolved">'+esc(item.resolution_label)+'</span>':'<span class="tag statusTag status-'+attr(status)+'">'+esc(item.status_label||handoffStatus(item))+'</span>';return '<button type="button" class="'+classes+'" data-key="'+attr(key)+'" onclick="selectConversation(this.dataset.key)"><div class="threadTop"><strong>'+esc(customerDisplay(item))+'</strong><time>'+esc(when(item.last_ts))+'</time></div><p>'+esc(item.last_text||"Sin mensajes")+'</p>'+reason+'<div class="tags">'+resolution+'<span class="tag">'+esc(item.channel_label||channelLabel())+'</span>'+tags+'</div></button>';}).join(""):'<div class="empty">'+(human?"No hay casos esperando intervención. La IA lo tiene bajo control 👌":"No hay conversaciones en este estado.")+'</div>';}
function selectConversation(key){state.selected=key;state.metaDirty=false;var item=findConversation(key);state.draftTags=item?(item.tags||[]).slice():[];renderThreads();renderChat();document.body.classList.add("chat-open");window.scrollTo(0,0);}
function closeMobileChat(){document.body.classList.remove("chat-open");}
function renderQuickReplies(item){var box=document.getElementById("quickReplies");if(!box)return;if(!isHumanTab()||!item){box.innerHTML="";return;}var replies=["🙌 ¡Hola! Ya te ayudo","🙏 Lamento mucho eso","📦 Reviso tu pedido","✅ Te confirmo disponibilidad"];box.innerHTML=replies.map(function(reply){return '<button type="button" data-reply="'+attr(reply)+'" onclick="applyQuickReply(this.dataset.reply)">'+esc(reply)+'</button>';}).join("");}
function applyQuickReply(reply){var input=document.getElementById("replyText");if(input){input.value=reply;updateReplyCount();input.focus();}}
function renderHandoffContext(item){text("handoffReason",item?handoffReason(item):"Selecciona una conversación.");text("contextCustomer",item?customerDisplay(item):"—");text("contextStatus",item?handoffStatus(item):"—");}
function renderChat(){var item=findConversation(state.selected),canWrite=!!SERVER_CAPABILITIES.intervene,canMeta=!!SERVER_CAPABILITIES.manage_notes_tags,human=isHumanTab();["copyBtn","takeBtn","resolveTopBtn","resolveBtn","releaseBtn","sendBtn","sendCircleBtn"].forEach(function(id){var el=document.getElementById(id);if(el)el.disabled=!item;});var send=document.getElementById("sendBtn"),sendCircle=document.getElementById("sendCircleBtn");if(send)send.disabled=!item||!canWrite;if(sendCircle)sendCircle.disabled=!item||!canWrite;var take=document.getElementById("takeBtn"),release=document.getElementById("releaseBtn"),resolveTop=document.getElementById("resolveTopBtn"),resolveSide=document.getElementById("resolveBtn"),composer=document.getElementById("composer"),note=document.getElementById("customerNote"),copy=document.getElementById("copyBtn");if(copy)copy.textContent=item&&item.channel==="instagram"?(item.instagram_username?"Copiar @usuario":"Copiar ID de Instagram"):"Copiar teléfono";if(take){take.textContent=human?"Atender ahora 🙌":"Tomar control";take.disabled=!item||!canWrite||item.conversation_status==="team_active"||item.conversation_status==="resolved";}if(release){release.textContent="Devolver a la IA";release.disabled=!item||!canWrite||!["needs_attention","team_active"].includes(item.conversation_status);}var canResolve=!!item&&canWrite&&["needs_attention","team_active"].includes(item.conversation_status);if(resolveTop)resolveTop.disabled=!canResolve;if(resolveSide)resolveSide.disabled=!canResolve;if(composer)composer.style.display=(!item||!canWrite||item.conversation_status==="resolved")?"none":"grid";text("hintTitle",human?"✧ Te recomiendo mirar":"✧ Sugerencia IA");if(!item){text("chatTitle",human?"Selecciona un caso":"Selecciona una conversación");text("chatSubtitle",human?("Elige una alerta para responder en "+channelLabel()+"."):"Elige un cliente para ver su historial.");document.getElementById("messages").innerHTML='<div class="empty">'+(human?"No hay caso seleccionado.":"Sin conversación seleccionada.")+'</div>';renderTags(null,canMeta);renderQuickReplies(null);renderHandoffContext(null);if(note){note.value="";note.disabled=true;}text("aiHint",human?"Cuando elijas un caso, te dejo una respuesta lista para usar.":"El bot lo tiene bajo control.");text("autopilotCopy","El bot responde mientras no tomes control.");text("metaHint","Selecciona una conversación.");return;}text("chatTitle",customerDisplay(item));text("chatSubtitle",handoffStatus(item));if(!state.metaDirty)state.draftTags=(item.tags||[]).slice();renderTags(item,canMeta);renderQuickReplies(item);renderHandoffContext(item);if(note&&!state.metaDirty)note.value=item.note||"";if(note)note.disabled=!canMeta;var save=document.getElementById("saveMetaBtn");if(save)save.disabled=!canMeta||!state.metaDirty;text("metaHint",!canMeta?"Tu rol es de solo lectura.":(state.metaDirty?"Cambios sin guardar.":(item.meta_updated_at?"Guardado "+when(item.meta_updated_at):"Sin nota guardada")));text("autopilotCopy",item.conversation_status==="resolved"?"Conversación cerrada.":(["needs_attention","team_active"].includes(item.conversation_status)?"Autopiloto en pausa mientras intervienes.":"La IA responde y mantiene el caso bajo control."));renderSuggestion(item);var messages=document.getElementById("messages");messages.innerHTML=(item.messages||[]).length?item.messages.map(function(m){var author=m.author||"bot",failed=m.delivery_status==="failed",label=author==="customer"?"Cliente":(author==="human"?"Agente":(author==="system"?"Evento":"🤖 Autopiloto IA"));if(failed)label+=" · No enviado";var checks=failed?'<span class="checks">⚠</span>':(author==="human"?'<span class="checks read">✓✓</span>':(author==="bot"?'<span class="checks">✓✓</span>':""));return '<div class="bubble '+attr(author)+(failed?" deliveryFailed":"")+'">'+esc(m.text)+'<div class="bubbleMeta"><span>'+esc(label)+(m.ts?" · "+esc(when(m.ts)):"")+'</span>'+checks+'</div></div>';}).join(""):'<div class="empty">No hay mensajes para este cliente.</div>';messages.scrollTop=messages.scrollHeight;updateReplyCount();}
function renderSuggestion(item){var textValue="El bot lo tiene bajo control.",reply="";if(item.needs_reply){textValue=isHumanTab()?"🙌 Un mensaje tuyo puede destrabar esta conversación. Te dejo una respuesta lista para usar.":"Te recomiendo responder: este cliente está esperando una acción del equipo.";reply="🙌 ¡Hola! Soy del equipo de "+PANEL_CONTEXT.businessName+". Ya revisé tu caso y te ayudo con mucho gusto.";}else if((item.tags||[]).includes("venta")){textValue="Hay señal de venta. Confirmar disponibilidad o envío puede cerrar esta conversación.";reply="✅ Te confirmo disponibilidad y opciones de envío para que puedas completar tu compra.";}state.suggestion=reply;text("aiHint",textValue);}
function useSuggestion(){var input=document.getElementById("replyText");if(input&&state.suggestion){input.value=state.suggestion;updateReplyCount();input.focus();}}
function toggleAutopilot(){state.autopilot=!state.autopilot;var sw=document.getElementById("autopilotSwitch");if(sw)sw.classList.toggle("on",state.autopilot);text("autopilotCopy",state.autopilot?"El bot responde mientras no tomes control.":"El equipo humano está priorizado.");}
function renderTags(item,canEdit){var box=document.getElementById("tagRow"),tags=state.data&&state.data.tags||[];if(!box)return;box.innerHTML=tags.map(function(tag){var active=state.draftTags.indexOf(tag.id)>=0;return '<button type="button" class="tagBtn'+(active?" active":"")+'" data-tag="'+attr(tag.id)+'" onclick="toggleTag(this.dataset.tag)" '+(!item||!canEdit?"disabled":"")+'>'+esc(tag.label)+'</button>';}).join("");}
function markMetaDirty(){if(!state.selected||!SERVER_CAPABILITIES.manage_notes_tags)return;state.metaDirty=true;var save=document.getElementById("saveMetaBtn");if(save)save.disabled=false;text("metaHint","Cambios sin guardar.");}
function toggleTag(tag){if(!state.selected||!SERVER_CAPABILITIES.manage_notes_tags)return;var index=state.draftTags.indexOf(tag);if(index>=0)state.draftTags.splice(index,1);else state.draftTags.push(tag);markMetaDirty();renderTags(findConversation(state.selected),true);}
function saveCustomerMeta(){var item=findConversation(state.selected),note=document.getElementById("customerNote"),name=document.getElementById("customerProfileName");if(!item||!SERVER_CAPABILITIES.manage_notes_tags)return;var button=document.getElementById("saveMetaBtn");if(button)button.disabled=true;text("metaHint","Guardando...");api("/admin/customer-meta/"+encodeURIComponent(conversationKey(item)),{method:"POST",body:JSON.stringify({tags:state.draftTags,note:note?note.value.trim():"",name:name?name.value.trim():""})}).then(function(response){item.tags=(response.meta&&response.meta.tags)||state.draftTags.slice();item.note=(response.meta&&response.meta.note)||"";item.customer_name=(response.meta&&response.meta.name)||null;item.display_name=item.customer_name||item.suggested_name||item.display_name;item.meta_updated_at=response.meta&&response.meta.updated_at;state.metaDirty=false;renderInbox();text("chatStatus","Perfil del cliente guardado.");loadPanelData(false);}).catch(function(error){text("metaHint","No se pudo guardar: "+error.message);if(button)button.disabled=false;});}
function copyPhone(){var item=findConversation(state.selected);if(!item)return;var channel=channelType(item),value=contactValue(item),label=channel==="instagram"?(item.instagram_username?"@usuario copiado.":"ID de Instagram copiado."):(channel==="email"?"Correo copiado.":(channel==="messenger"?"Contacto de Messenger copiado.":"Teléfono copiado."));if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(value).then(function(){text("chatStatus",label);}).catch(function(){text("chatStatus",value);});}else{text("chatStatus",value);}}
function activateHumanControl(item){item.conversation_status="team_active";item.mode="human";item.needs_reply=false;state.guidedDraft="";renderInbox();text("chatStatus","✓ Tienes el control. Ya puedes escribirle al cliente.");var input=document.getElementById("replyText");if(input)input.focus();}
function takeControl(){var item=findConversation(state.selected),button=document.getElementById("takeControlBtn");if(!item||!SERVER_CAPABILITIES.intervene)return;if(button){button.disabled=true;button.textContent="Tomando control…";}text("chatStatus","Tomando control...");if(DEMO_MODE){activateHumanControl(item);return;}api("/admin/takeover/"+encodeURIComponent(conversationKey(item)),{method:"POST",body:"{}"}).then(function(){activateHumanControl(item);}).catch(function(error){text("chatStatus","No se pudo tomar control: "+error.message);renderChat();});}
function resolveConversation(){var item=findConversation(state.selected);if(!item||!SERVER_CAPABILITIES.intervene||!["needs_attention","team_active"].includes(item.conversation_status))return;text("chatStatus","Marcando como resuelta...");api("/admin/resolve/"+encodeURIComponent(conversationKey(item)),{method:"POST",body:"{}"}).then(function(){text("chatStatus","✓ Conversación resuelta por tu equipo.");loadPanelData(false);}).catch(function(error){text("chatStatus","No se pudo marcar como resuelta: "+error.message);});}
function releaseControl(){var item=findConversation(state.selected),button=document.getElementById("releaseControlBtn");if(!item||!SERVER_CAPABILITIES.intervene)return;if(button){button.disabled=true;button.textContent="Devolviendo…";}text("chatStatus","Devolviendo a la IA...");var released=function(){item.conversation_status="ai_active";item.mode="bot";renderInbox();text("chatStatus","✦ La IA volvió a atender esta conversación.");};if(DEMO_MODE){released();return;}api("/admin/release/"+encodeURIComponent(conversationKey(item)),{method:"POST",body:"{}"}).then(released).catch(function(error){text("chatStatus","No se pudo devolver a la IA: "+error.message);renderChat();});}
function updateReplyCount(){var input=document.getElementById("replyText");text("replyCount",((input&&input.value)||"").length+"/1200");}
function setSendBusy(busy){var normal=document.getElementById("sendBtn"),circle=document.getElementById("sendCircleBtn");if(normal){normal.disabled=!!busy;normal.textContent=busy?"Enviando...":"Enviar";}if(circle){circle.disabled=!!busy;circle.textContent=busy?"…":"➤";}}
function sendReply(){var item=findConversation(state.selected),input=document.getElementById("replyText"),message=input?input.value.trim():"";if(!item||!SERVER_CAPABILITIES.respond)return;if(!message){text("chatStatus","Escribe un mensaje antes de enviar.");return;}setSendBusy(true);if(DEMO_MODE){var ts=new Date().toISOString();item.messages=(item.messages||[]).concat([{ts:ts,author:"human",text:message}]);item.last_text=message;item.last_ts=ts;item.conversation_status="team_active";item.mode="human";if(input)input.value="";renderInbox();updateReplyCount();text("chatStatus","✓ Mensaje simulado. El demo no envía nada real.");setSendBusy(false);return;}api("/admin/send-message",{method:"POST",body:JSON.stringify({userId:conversationKey(item),text:message})}).then(function(){if(input)input.value="";updateReplyCount();text("chatStatus","✓ Mensaje entregado por "+channelLabelFor(item)+".");loadPanelData(false);}).catch(function(error){text("chatStatus",(error.body&&error.body.message)||("No se pudo enviar: "+error.message));}).finally(function(){setSendBusy(false);});}
function uiStatus(item){var status=item&&item.conversation_status||(item&&item.mode==="human"?"needs_attention":"ai_active");if(status==="resolved")return "ok";if(status==="needs_attention"||status==="team_active")return "you";return "ia";}
function statusMeta(status){if(status==="you")return {label:"Necesita de ti",icon:'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 21a6 6 0 0 0-12 0"></path><circle cx="12" cy="8" r="4"></circle></svg>'};if(status==="ok")return {label:"Resuelta por la IA",icon:'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>'};return {label:"La IA está atendiendo",icon:'<span class="liveDot"></span>'};}
function initialsFor(item){var value=customerDisplay(item).replace(/^@/,"").replace(/^\\+?57/,"").trim();if(/^\\d+$/.test(value))return "CL";var parts=value.split(/[\\s._-]+/).filter(Boolean);return ((parts[0]||"C").charAt(0)+(parts[1]||parts[0]||"L").charAt(0)).toUpperCase();}
function conversationNudge(item){var tags=item&&item.tags||[],memory=item&&item.memory||{},value=((item&&item.last_text)||"").toLowerCase();if(tags.indexOf("garantia")>=0||/garant|reclamo|dañad|incomplet/.test(value))return "Reclamo en curso";if(memory.purchase_stage==="confirmed_customer")return "Cliente recurrente";if(memory.purchase_stage==="payment_pending"||memory.purchase_stage==="order_handoff")return "Cierre prioritario";if(item&&item.priority==="high")return "Cliente prioritario";if(tags.indexOf("venta")>=0||/compr|quiero|interesa|disponible/.test(value))return "Lista para comprar";if(tags.indexOf("envio")>=0||/env[ií]o|pedido|entrega/.test(value))return "Confirmar envío";if(tags.indexOf("pendiente_pago")>=0||/pago|precio|descuento/.test(value))return "Confirmar pago";return uiStatus(item)==="you"?"Lista para revisar":"";}
function conversationCounts(){return state.conversations.reduce(function(counts,item){counts[uiStatus(item)]++;return counts;},{you:0,ia:0,ok:0});}
function setConversationFilter(filter){state.filter=["all","you","resolved"].includes(filter)?filter:"all";renderInbox();}
function filteredConversations(){var input=document.getElementById("conversationSearch"),query=input?input.value.trim().toLowerCase():"";return state.conversations.filter(function(item){var status=uiStatus(item);if(state.filter==="you"&&status!=="you")return false;if(state.filter==="resolved"&&status!=="ok")return false;return matchesConversation(item,query);});}
function renderConversationHeader(){var counts=conversationCounts(),total=state.conversations.length,handled=counts.ia+counts.ok,pct=total?Math.round(counts.ok/total*100):0,hero=counts.you===0?"La IA está atendiendo las "+total+" conversaciones. Nada requiere tu atención 👌":"La IA atendió "+handled+" de "+total+" esta semana — solo "+counts.you+(counts.you===1?" necesita":" necesitan")+" de ti.";if(state.tab==="conversations")text("pageSubtitle",hero);text("conversationImpact","✦ "+pct+"% resuelto por la IA");text("navConvCount",counts.you||"");return {counts:counts,total:total,pct:pct};}
function renderFilterIntro(counts,pct){if(state.filter==="you")return counts.you?'<div class="filterIntro you"><span>☝</span><div><strong>'+counts.you+(counts.you===1?' cliente te necesita ahora':' clientes te necesitan ahora')+'</strong><p>Son las únicas que dependen de ti — un mensaje tuyo cierra la venta o resuelve el caso.</p></div></div>':'<div class="filterIntro ok"><span>✓</span><div><strong>Nada pendiente 👌</strong><p>La IA está atendiendo todo. Ningún cliente está esperando por ti.</p></div></div>';if(state.filter==="resolved")return '<div class="filterIntro ok"><span>✓</span><div><strong>'+counts.ok+(counts.ok===1?' conversación resuelta por la IA':' conversaciones resueltas por la IA')+'</strong><p>El '+pct+'% de tu servicio quedó resuelto solo.</p></div></div>';return "";}
function renderInbox(){var info=renderConversationHeader();[{id:"all",filter:"all",count:info.total},{id:"you",filter:"you",count:info.counts.you},{id:"resolved",filter:"resolved",count:info.counts.ok}].forEach(function(row){var button=document.getElementById("filter-"+row.id);if(!button)return;button.classList.toggle("active",state.filter===row.filter);var badge=button.querySelector("span");if(badge)badge.textContent=row.count;});renderThreads(info);renderChat();document.body.classList.toggle("chat-open",state.tab==="conversations"&&!!findConversation(state.selected));}
function channelType(item){var value=String(item&&item.channel||"whatsapp").toLowerCase();return ["whatsapp","instagram","messenger","email"].includes(value)?value:"whatsapp";}
function channelLabelFor(item){var channel=channelType(item),labels={whatsapp:"WhatsApp",instagram:"Instagram",messenger:"Messenger",email:"Correo"};return item&&item.channel_label||labels[channel];}
function channelGlyph(channel){if(channel==="instagram")return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>';if(channel==="messenger")return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 3 4 14h6l-1 7 9-11h-6z"></path></svg>';if(channel==="email")return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path></svg>';return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"></path></svg>';}
function channelBadge(item,floating,large){var channel=channelType(item),label=channelLabelFor(item),classes="channelBadge "+channel+(floating?" floating":"")+(large?" large":"");return '<span class="'+classes+'" title="'+attr(label)+'" aria-label="'+attr(label)+'">'+channelGlyph(channel)+'</span>';}
function paintChannelBadge(id,item,large){var badge=document.getElementById(id);if(!badge)return;if(!item){badge.hidden=true;badge.innerHTML="";return;}var channel=channelType(item),label=channelLabelFor(item);badge.hidden=false;badge.className="channelBadge floating "+channel+(large?" large":"");badge.title=label;badge.setAttribute("aria-label",label);badge.innerHTML=channelGlyph(channel);}
function renderChannelStrips(){document.querySelectorAll("[data-channel-strip]").forEach(function(strip){strip.innerHTML=["whatsapp","instagram","messenger","email"].map(function(channel){return channelBadge({channel:channel},false,false);}).join("");});}
function contactValue(item){var channel=channelType(item);if(item&&item.copy_value)return item.copy_value;if(channel==="email")return item&&item.email||item&&item.phone||"";if(channel==="instagram")return item&&item.instagram_username||item&&item.phone||"";if(channel==="messenger")return item&&item.messenger_username||item&&item.phone||"";return item&&item.phone?("+"+String(item.phone).replace(/^\\+/,"")):"";}
function copyActionLabel(item){var channel=channelType(item);if(channel==="instagram")return item&&item.instagram_username?"Copiar @usuario":"Copiar ID";if(channel==="email")return "Copiar correo";if(channel==="messenger")return "Copiar contacto";return "Copiar número";}
function renderThreads(info){var box=document.getElementById("threadList");if(!box)return;info=info||renderConversationHeader();var items=filteredConversations(),intro=renderFilterIntro(info.counts,info.pct);var cards=items.map(function(item){var key=conversationKey(item),status=uiStatus(item),meta=statusMeta(status),nudge=conversationNudge(item),icon=meta.icon,preview=item.last_text||"Sin mensajes",failed=item.last_delivery_status==="failed";return '<button type="button" class="thread status-'+status+(key===state.selected?' active':'')+(failed?' deliveryFailed':'')+'" data-key="'+attr(key)+'" onclick="selectConversation(this.dataset.key)"><div class="threadMain"><span class="avatarChannelWrap"><span class="contactAvatar">'+esc(initialsFor(item))+'</span>'+channelBadge(item,true,false)+'</span><div class="threadIdentity"><div class="threadTop"><strong>'+esc(customerDisplay(item))+'</strong><time>'+esc(when(item.last_ts))+'</time></div><p>'+esc(preview)+'</p></div></div><div class="threadStatus"><span class="statusPill '+status+'">'+icon+esc(meta.label)+'</span>'+(failed?'<small>Meta rechazó el envío</small>':(nudge?'<small>'+esc(nudge)+'</small>':''))+'</div></button>';}).join("");box.innerHTML=intro+(cards||'<div class="empty">No hay conversaciones en este estado.</div>');}
function suggestedReply(item){var tags=item&&item.tags||[],value=((item&&item.last_text)||"").toLowerCase();if(tags.indexOf("garantia")>=0||/garant|reclamo|dañad|incomplet/.test(value))return "Hola, ya revisé tu caso y voy a ayudarte a resolverlo. ¿Me confirmas por favor el número del pedido y una foto del producto?";if(tags.indexOf("envio")>=0||/env[ií]o|pedido|entrega/.test(value))return "¡Hola! Ya revisé tu solicitud 🙌 Te confirmo la opción de envío para que podamos dejar todo listo hoy.";if(tags.indexOf("venta")>=0||/compr|quiero|interesa|disponible/.test(value))return "¡Hola! Ya revisé lo que buscas 🙌 Te confirmo disponibilidad y te ayudo a dejar la compra lista.";return "¡Hola! Soy del equipo de "+PANEL_CONTEXT.businessName+". Ya revisé tu conversación y te ayudo con mucho gusto.";}
function selectConversation(key){state.selected=key;state.metaDirty=false;var item=findConversation(key);state.draftTags=item?(item.tags||[]).slice():[];state.guidedFor=key;state.guidedDraft=item&&uiStatus(item)==="you"?suggestedReply(item):"";renderThreads();renderChat();document.body.classList.add("chat-open");window.scrollTo(0,0);}
function showNeedsYou(){state.filter="you";showTab("conversations");var item=state.conversations.find(function(row){return uiStatus(row)==="you";});if(item)selectConversation(conversationKey(item));}
function closeConversation(){closeEmojiPickers();state.selected=null;state.metaDirty=false;state.guidedFor=null;state.guidedDraft="";document.body.classList.remove("chat-open");renderThreads();renderChat();window.scrollTo(0,0);}
function closeMobileChat(){closeConversation();}
function aiUnderstanding(item){var tags=item&&item.tags||[],memory=item&&item.memory||{},value=((item&&item.last_text)||"").toLowerCase(),chips=[];if(tags.indexOf("garantia")>=0||/garant|reclamo|dañad|incomplet/.test(value))return {intent:"Reclamo o garantía — necesita seguimiento",chips:["Garantía","Prioridad"]};if(memory.purchase_stage==="confirmed_customer"){chips=["Cliente recurrente","Prioridad"];if((memory.interests||[])[0])chips.push(memory.interests[0]);return {intent:"Cliente con compra verificada — atender con contexto previo",chips:chips};}if(memory.purchase_stage==="payment_pending"||memory.purchase_stage==="order_handoff"){chips=["Cierre prioritario","Seguimiento"];if((memory.interests||[])[0])chips.push(memory.interests[0]);return {intent:"Proceso de compra avanzado — conviene dar seguimiento",chips:chips};}if(item&&item.priority==="high"){chips=["Prioridad","Intención de compra"];if((memory.interests||[])[0])chips.push(memory.interests[0]);return {intent:"Intención clara de compra detectada por la IA",chips:chips};}if(tags.indexOf("pendiente_pago")>=0||/pago|precio|descuento/.test(value))return {intent:"Consulta sobre pago o cierre de compra",chips:["Forma de pago","Seguimiento"]};if(tags.indexOf("envio")>=0||/env[ií]o|pedido|entrega/.test(value))return {intent:"Quiere confirmar envío o estado de pedido",chips:["Envío",channelLabelFor(item)]};if(tags.indexOf("venta")>=0||/compr|quiero|interesa|disponible|regalo/.test(value))return {intent:"Quiere comprar — la IA detectó una oportunidad",chips:["Oportunidad de venta",channelLabelFor(item)]};if(tags.indexOf("revisar")>=0)chips.push("Revisar");chips.push(channelLabelFor(item));return {intent:"Consulta general atendida por la IA",chips:chips};}
function relationshipData(item){var memory=item&&item.memory||{},messages=(item.messages||[]).filter(function(message){return message.author!=="system";}).length,hasSale=(item.tags||[]).indexOf("venta")>=0;if(memory.purchase_stage==="confirmed_customer")return {eyebrow:"Cliente prioritario",value:"Recurrente",label:"compra verificada",copy:"La IA recuerda su contexto comercial para atenderlo de forma más personal."};if(item&&item.priority==="high")return {eyebrow:"Oportunidad prioritaria",value:"Alta",label:"intención de compra",copy:"La IA conservará el contexto útil y acompañará el proceso con mayor profundidad."};return hasSale?{eyebrow:"Oportunidad de relación",value:"Venta",label:"asistida por la IA",copy:"La IA entendió lo que busca y dejó el contexto listo para que tú cierres 🙌"}:{eyebrow:"Relación en construcción",value:messages,label:messages===1?"mensaje atendido":"mensajes atendidos",copy:"La IA conserva el contexto para que tu equipo no empiece desde cero."};}
function customerNameInputs(){return [document.getElementById("customerProfileName"),document.getElementById("mobileCustomerProfileName")].filter(Boolean);}
function customerNameValue(){var active=document.activeElement,inputs=customerNameInputs();if(active&&inputs.indexOf(active)>=0)return active.value.trim();var visible=inputs.find(function(input){return input.getBoundingClientRect().width>0;});return (visible||inputs[0])?(visible||inputs[0]).value.trim():"";}
function setMetaHint(value){text("metaHint",value);text("mobileMetaHint",value);}
function setMetaSaveDisabled(disabled){["saveMetaBtn","mobileSaveMetaBtn"].forEach(function(id){var button=document.getElementById(id);if(button)button.disabled=disabled;});}
function renderProfile(item,canMeta){
  var note=document.getElementById("customerNote"),names=customerNameInputs(),suggestions=[document.getElementById("nameSuggestion"),document.getElementById("mobileNameSuggestion")].filter(Boolean),chips=document.getElementById("aiChips"),facts=document.getElementById("customerFacts"),copy=document.getElementById("copyBtn");
  paintChannelBadge("profileChannelBadge",item,true);
  if(!item){
    text("profileAvatar","—");text("profileName","Selecciona un cliente");text("profileContact","—");text("relationshipEyebrow","Relación");text("relationshipValue","—");text("relationshipLabel","");text("relationshipCopy","Selecciona una conversación para ver el valor que la IA está ayudando a construir.");text("aiIntent","Selecciona una conversación.");
    if(chips)chips.innerHTML="";if(facts)facts.innerHTML="";if(note){note.value="";note.disabled=true;}names.forEach(function(name){name.value="";name.disabled=true;});suggestions.forEach(function(suggestion){suggestion.hidden=true;});setMetaSaveDisabled(true);if(copy)copy.disabled=true;setMetaHint("Selecciona una conversación.");return;
  }
  var memory=item.memory||{},relation=relationshipData(item),understanding=aiUnderstanding(item),first=(item.messages||[]).map(function(message){return message.ts;}).filter(Boolean).sort()[0],contact=contactValue(item),rows=[["Canal",channelLabelFor(item)],["Mensajes",(item.messages||[]).filter(function(message){return message.author!=="system";}).length],["Cliente desde",first?new Date(first).toLocaleDateString("es-CO",{day:"numeric",month:"short"}):"—"]];
  if(item.priority==="high")rows.push(["Prioridad","Alta"]);if((memory.interests||[]).length)rows.push(["Intereses",memory.interests.slice(0,3).join(", ")]);
  text("profileAvatar",initialsFor(item));text("profileName",customerDisplay(item));text("profileContact",contact);text("relationshipEyebrow",relation.eyebrow);text("relationshipValue",relation.value);text("relationshipLabel",relation.label);text("relationshipCopy",relation.copy);text("aiIntent",understanding.intent);
  if(chips)chips.innerHTML=understanding.chips.map(function(chip){return '<span>'+esc(chip)+'</span>';}).join("");if(facts)facts.innerHTML=rows.map(function(row){return '<div class="customerFact"><span>'+esc(row[0])+'</span><strong>'+esc(row[1])+'</strong></div>';}).join("");
  if(!state.metaDirty){if(note)note.value=item.note||"";names.forEach(function(name){name.value=item.customer_name||"";});}
  if(note)note.disabled=!canMeta;names.forEach(function(name){name.disabled=!canMeta;});
  var suggested=String(item.suggested_name||"").trim(),showSuggestion=!!suggested&&suggested!==String(item.customer_name||"").trim();
  suggestions.forEach(function(suggestion){suggestion.hidden=!showSuggestion;});text("suggestedCustomerName",showSuggestion?suggested:"");text("mobileSuggestedCustomerName",showSuggestion?suggested:"");
  setMetaSaveDisabled(!canMeta||!state.metaDirty);setMetaHint(!canMeta?"Tu rol es de solo lectura.":(state.metaDirty?"Cambios sin guardar.":(item.meta_updated_at?"Perfil guardado "+when(item.meta_updated_at):"Sin cambios guardados")));if(copy){copy.disabled=false;copy.textContent=copyActionLabel(item);}
}
function useSuggestedCustomerName(preferMobile){var item=findConversation(state.selected),input=document.getElementById(preferMobile?"mobileCustomerProfileName":"customerProfileName");if(!item||!input||!item.suggested_name)return;customerNameInputs().forEach(function(field){field.value=item.suggested_name;});markMetaDirty();input.focus();}
function renderChat(){
  var item=findConversation(state.selected),canWrite=!!SERVER_CAPABILITIES.respond,canTake=!!SERVER_CAPABILITIES.intervene,canMeta=!!SERVER_CAPABILITIES.manage_notes_tags,guided=document.getElementById("guidedAction"),composer=document.getElementById("composer"),band=document.getElementById("stateBand"),control=document.getElementById("humanControl"),take=document.getElementById("takeControlBtn"),release=document.getElementById("releaseControlBtn"),reply=document.getElementById("replyText"),guidedReply=document.getElementById("guidedReply"),confirm=document.getElementById("confirmSendBtn"),already=document.getElementById("alreadyResolvedBtn"),pill=document.getElementById("chatStatusPill");
  document.querySelectorAll(".emojiButton").forEach(function(button){button.disabled=!item||!canWrite;});
  if(!item||!canWrite)closeEmojiPickers();
  renderProfile(item,canMeta);paintChannelBadge("chatChannelBadge",item,false);
  if(!item){text("chatAvatar","—");text("chatTitle","Selecciona una conversación");text("chatSubtitle","Elige un cliente para ver el historial.");if(pill){pill.className="chatStatusPill";pill.textContent="—";}document.getElementById("messages").innerHTML='<div class="empty">Sin conversación seleccionada.</div>';if(guided)guided.style.display="none";if(composer)composer.style.display="none";if(band)band.style.display="none";if(control)control.className="humanControl";return;}
  var status=uiStatus(item),rawStatus=item.conversation_status||(item.mode==="human"?"team_active":"ai_active"),humanActive=rawStatus==="team_active",guidedActive=status==="you"&&!humanActive,meta=statusMeta(status),contact=contactValue(item),presence=channelType(item)==="email"?"por correo":"en línea";
  text("chatAvatar",initialsFor(item));text("chatTitle",customerDisplay(item));text("chatSubtitle",contact+" · "+channelLabelFor(item)+" · "+presence);
  if(pill){pill.className="chatStatusPill "+status;pill.innerHTML=meta.icon+esc(humanActive?"Tú tienes el control":meta.label);}
  var messages=document.getElementById("messages");messages.innerHTML='<div style="text-align:center"><span class="tag">Hoy</span></div>'+((item.messages||[]).length?item.messages.map(function(message){var author=message.author||"bot",label=author==="customer"?"":(author==="human"?"Tú":(author==="system"?"Evento":"IA"));return '<div class="bubble '+attr(author)+'">'+esc(message.text)+'<div class="bubbleMeta">'+esc((label?label+" · ":"")+(message.ts?when(message.ts):""))+'</div></div>';}).join(""):'<div class="empty">No hay mensajes para este cliente.</div>');messages.scrollTop=messages.scrollHeight;
  if(state.guidedFor!==conversationKey(item)){state.guidedFor=conversationKey(item);state.guidedDraft=guidedActive?suggestedReply(item):"";}
  if(guided)guided.style.display=guidedActive?"block":"none";
  if(guidedReply){guidedReply.value=state.guidedDraft;guidedReply.disabled=!canWrite;}
  if(confirm)confirm.disabled=!canWrite;if(already)already.disabled=!canTake;
  text("guidedContext",conversationNudge(item)+". Un mensaje tuyo puede cerrar esta conversación.");
  if(control){control.className="humanControl"+(canTake?" visible":"")+(humanActive?" active":"");}
  if(take){take.style.display=humanActive?"none":"inline-flex";take.disabled=!canTake;take.textContent=status==="ok"?"Reabrir y responder":"Tomar control";}
  if(release){release.style.display=humanActive?"inline-flex":"none";release.disabled=!canTake;release.textContent="Devolver a la IA";}
  text("humanControlTitle",humanActive?"Tú tienes el control":"¿Quieres responder tú?");
  text("humanControlCopy",humanActive?"Escribe abajo; la IA permanecerá en pausa.":"Toma el control para pausar la IA y escribirle al cliente.");
  if(band){band.className="stateBand "+(humanActive?"":status);if(!humanActive&&status==="ia")band.innerHTML='<span class="liveDot"></span><span>La IA está atendiendo esta conversación por ti.</span>';else if(!humanActive&&status==="ok")band.innerHTML='<span class="bandIcon">✓</span><span>La IA resolvió esta conversación sin ayuda humana. Todo bajo control 👌</span>';else band.innerHTML="";}
  if(composer)composer.style.display=humanActive&&canWrite?"grid":"none";
  if(reply)reply.disabled=!canWrite||!humanActive;var send=document.getElementById("sendCircleBtn"),sendFull=document.getElementById("sendBtn");if(send)send.disabled=!canWrite||!humanActive;if(sendFull)sendFull.disabled=!canWrite||!humanActive;updateReplyCount();
}
function markMetaDirty(){if(!state.selected||!SERVER_CAPABILITIES.manage_notes_tags)return;var active=document.activeElement;if(active&&["customerProfileName","mobileCustomerProfileName"].includes(active.id)){customerNameInputs().forEach(function(input){if(input!==active)input.value=active.value;});}state.metaDirty=true;setMetaSaveDisabled(false);setMetaHint("Cambios sin guardar.");}
function saveCustomerMeta(){var item=findConversation(state.selected),note=document.getElementById("customerNote");if(!item||!SERVER_CAPABILITIES.manage_notes_tags)return;setMetaSaveDisabled(true);setMetaHint("Guardando...");api("/admin/customer-meta/"+encodeURIComponent(conversationKey(item)),{method:"POST",body:JSON.stringify({tags:(item.tags||[]),note:note?note.value.trim():"",name:customerNameValue()})}).then(function(response){item.tags=(response.meta&&response.meta.tags)||item.tags||[];item.note=(response.meta&&response.meta.note)||"";item.customer_name=(response.meta&&response.meta.name)||null;item.display_name=item.customer_name||item.suggested_name||item.display_name;item.meta_updated_at=response.meta&&response.meta.updated_at;state.metaDirty=false;renderInbox();text("chatStatus","Perfil del cliente guardado.");loadPanelData(false);}).catch(function(error){setMetaHint("No se pudo guardar: "+error.message);setMetaSaveDisabled(false);});}
function resolveConversation(){var item=findConversation(state.selected);if(!item||!SERVER_CAPABILITIES.intervene||uiStatus(item)!=="you")return;text("chatStatus","Marcando como resuelta...");if(DEMO_MODE){item.conversation_status="resolved";item.mode="bot";renderInbox();text("chatStatus","✓ Conversación resuelta en el demo.");return;}api("/admin/resolve/"+encodeURIComponent(conversationKey(item)),{method:"POST",body:"{}"}).then(function(){text("chatStatus","✓ Conversación resuelta.");loadPanelData(false);}).catch(function(error){text("chatStatus","No se pudo marcar como resuelta: "+error.message);});}
function updateGuidedCount(){var input=document.getElementById("guidedReply");state.guidedDraft=input?input.value:"";}
function closeEmojiPickers(){document.querySelectorAll(".emojiPicker").forEach(function(picker){picker.hidden=true;});document.querySelectorAll(".emojiButton").forEach(function(button){button.setAttribute("aria-expanded","false");});state.emojiTarget=null;}
function toggleEmojiPicker(targetId,pickerId,button,event){if(event)event.stopPropagation();var picker=document.getElementById(pickerId),opening=picker&&picker.hidden;closeEmojiPickers();if(!picker||!opening)return;state.emojiTarget=targetId;picker.hidden=false;if(button)button.setAttribute("aria-expanded","true");}
function insertEmoji(emoji){var input=document.getElementById(state.emojiTarget||"replyText");if(!input||input.disabled)return;var start=typeof input.selectionStart==="number"?input.selectionStart:input.value.length,end=typeof input.selectionEnd==="number"?input.selectionEnd:start,max=Number(input.maxLength)||1200,next=input.value.slice(0,start)+emoji+input.value.slice(end);if(next.length>max)return;input.value=next;var cursor=start+emoji.length;if(input.setSelectionRange)input.setSelectionRange(cursor,cursor);if(input.id==="guidedReply")updateGuidedCount();else updateReplyCount();input.focus();}
function setConfirmBusy(busy){var button=document.getElementById("confirmSendBtn");if(button){button.disabled=!!busy;button.textContent=busy?"Enviando…":"Confirmar y enviar →";}}
function confirmAndSend(){var item=findConversation(state.selected),input=document.getElementById("guidedReply"),message=input?input.value.trim():"";if(!item||!SERVER_CAPABILITIES.respond||uiStatus(item)!=="you")return;if(!message){text("chatStatus","Revisa la respuesta antes de enviarla.");return;}setConfirmBusy(true);text("chatStatus","Enviando tu confirmación...");if(DEMO_MODE){var ts=new Date().toISOString();item.messages=(item.messages||[]).concat([{ts:ts,author:"human",text:message}]);item.last_text=message;item.last_ts=ts;item.conversation_status="resolved";item.mode="bot";state.guidedDraft="";renderInbox();text("chatStatus","✓ Enviada y resuelta en el demo. Nada salió a un cliente real.");setConfirmBusy(false);return;}api("/admin/send-message",{method:"POST",body:JSON.stringify({userId:conversationKey(item),text:message})}).then(function(){return api("/admin/resolve/"+encodeURIComponent(conversationKey(item)),{method:"POST",body:"{}"});}).then(function(){state.guidedDraft="";text("chatStatus","✓ Entregada y resuelta. La IA hizo lo difícil.");loadPanelData(false);}).catch(function(error){text("chatStatus",(error.body&&error.body.message)||("No se pudo completar: "+error.message));}).finally(function(){setConfirmBusy(false);});}
function renderProductResults(result){var box=document.getElementById("searchTestResult");if(!box)return;var products=result.products||[];box.innerHTML=products.length?products.map(function(p){return '<div class="resultItem"><a href="'+attr(p.product_url)+'" target="_blank" rel="noreferrer">'+esc(p.title)+'</a><span>'+esc(p.price||"")+'</span></div>';}).join(""):'La búsqueda no devolvió productos.';}
function runProductTest(event){event.preventDefault();var q=document.getElementById("testQuery").value.trim();if(!q)return;setBusy("searchTestBtn",true,"Buscando...","Probar búsqueda");text("searchTestResult","Consultando catálogo...");api("/admin/panel/test-search?q="+encodeURIComponent(q)).then(renderProductResults).catch(function(error){text("searchTestResult","No se pudo completar: "+error.message);}).finally(function(){setBusy("searchTestBtn",false,"Buscando...","Probar búsqueda");});}
function runOrderTest(event){event.preventDefault();var payload={order_number:document.getElementById("orderNumber").value.trim(),customer_name:document.getElementById("customerName").value.trim(),phone_or_email:document.getElementById("phoneOrEmail").value.trim()};setBusy("orderTestBtn",true,"Consultando...","Consultar estado");text("orderTestResult","Validando pedido...");api("/admin/panel/order-status-test",{method:"POST",body:JSON.stringify(payload)}).then(function(result){text("orderTestResult",result.message||"Consulta completada.");}).catch(function(error){text("orderTestResult",(error.body&&error.body.message)||("No se pudo completar: "+error.message));}).finally(function(){setBusy("orderTestBtn",false,"Consultando...","Consultar estado");});}
var RTG_STATUS_LABELS={simulation_pending:"Lista para simular",pending_approval:"Requiere aprobación",approved:"Aprobada · envío bloqueado",simulated:"Simulada",cancelled:"Cancelada",blocked:"Bloqueada",sent:"Enviada"};
var RTG_EVENT_LABELS={high_intent:"Alta intención",abandoned_cart:"Carrito pendiente",post_purchase:"Postcompra",back_in_stock:"Volvió a inventario",recommendation:"Recomendación"};
var RTG_REASON_LABELS={tenant_paused:"Tenant pausado",verified_consent_required:"Falta consentimiento verificable",consent_proof_missing:"Falta evidencia del consentimiento",consent_revoked:"Consentimiento revocado",consent_expired:"Consentimiento vencido",consent_category_mismatch:"Consentimiento no cubre esta categoría",approved_template_missing:"Falta plantilla aprobada",template_not_approved_or_active:"Plantilla no aprobada o inactiva",template_quality_blocked:"Calidad de plantilla bloqueada",marketing_frequency_limit_7d:"Alcanzó el máximo de 2 mensajes en 7 días",customer_replied:"El cliente respondió",purchase_confirmed:"Compra confirmada",handoff:"Conversación en manos del equipo",stop:"El cliente pidió no recibir más mensajes",real_sends_disabled:"Envío real bloqueado",simulation_only_no_message_sent:"Simulación completada; no se envió ningún mensaje",automatic_mode_not_enabled:"Modo automático bloqueado",channel_not_supported_for_commercial_scheduler:"Canal aún no habilitado para seguimiento comercial",channel_tenant_mismatch:"El canal no pertenece a este tenant"};
function rtgReason(value){value=String(value||"");if(value.indexOf("template_degraded:")===0)return "Plantilla degradada o pausada";if(value.indexOf("customer_event_")===0)return rtgReason(value.replace("customer_event_",""));return RTG_REASON_LABELS[value]||value.replace(/_/g," ")||"—";}
function rtgStatus(value){return RTG_STATUS_LABELS[value]||value||"—";}
function renderRetargeting(){var data=state.retargeting;if(!data||!data.snapshot)return;var snap=data.snapshot,counts=snap.counts||{},policy=data.policy||{},canManage=!!data.can_manage,jobs=snap.jobs||[];text("rtgPending",counts.pending||0);text("rtgApproved",counts.approved||0);text("rtgSimulated",counts.simulated||0);text("rtgCancelled",counts.cancelled||0);text("rtgBlocked",counts.blocked||0);text("navRtgCount",counts.pending||"");text("moduleStatus-retargeting",snap.paused?"Pausado":(policy.mode==="manual"?"Aprobación manual":policy.mode==="simulation"?"Simulación segura":policy.mode==="disabled"?"Apagado":"Automático bloqueado"));text("mobileModule-retargeting","Seguimientos · "+(snap.paused?"Pausado":policy.mode==="manual"?"Manual":policy.mode==="simulation"?"Simulación":"Apagado"));text("rtgModeBadge",snap.paused?"Tenant pausado":policy.mode==="manual"?"Aprobación manual":policy.mode==="simulation"?"Simulación segura":policy.mode==="disabled"?"Módulo apagado":"Automático bloqueado");text("rtgQueueState",snap.paused?"Pausado":jobs.length?jobs.length+" decisiones":"Cola vacía");var pause=document.getElementById("rtgPauseBtn"),pausePanel=document.getElementById("rtgPausePanel");if(pause){pause.disabled=!canManage;pause.textContent=snap.paused?"Reanudar":"Pausar";}if(pausePanel)pausePanel.classList.toggle("rtgPaused",!!snap.paused);var queue=document.getElementById("rtgQueue");if(queue)queue.innerHTML=jobs.length?jobs.slice(0,60).map(function(job){var open=["simulation_pending","pending_approval","approved"].includes(job.status),approve=canManage&&job.status==="pending_approval"?'<button class="primaryBtn" type="button" data-id="'+attr(job.id)+'" onclick="approveRetargetingJob(this.dataset.id)">Aprobar decisión</button>':"",cancel=canManage&&open?'<button class="ghostBtn" type="button" data-id="'+attr(job.id)+'" onclick="cancelRetargetingJob(this.dataset.id)">Cancelar</button>':"",reason=job.reason?'<p><strong>Motivo:</strong> '+esc(rtgReason(job.reason))+'</p>':"";return '<article class="rtgJob"><div><div class="rtgJobTop"><strong>'+esc(job.context&&job.context.preferred_name||job.customer_id)+'</strong><span class="rtgStatusChip '+attr(job.status)+'">'+esc(rtgStatus(job.status))+'</span></div><p>'+esc(RTG_EVENT_LABELS[job.event_type]||job.event_type)+' · '+esc(job.channel)+' · programado '+esc(when(job.scheduled_for))+'</p><p class="rtgJobPreview">'+esc(job.preview||"Vista previa no disponible")+'</p>'+reason+'</div><div class="rtgJobActions">'+approve+cancel+'</div></article>';}).join(""):'<div class="rtgEmpty">No hay seguimientos en cola. Cuando el bot detecte una oportunidad, aquí verás la decisión y sus protecciones.</div>';var policies=[["Modo",policy.mode==="manual"?"Aprobación manual":policy.mode==="simulation"?"Simulación":policy.mode==="disabled"?"Apagado":"Automático bloqueado"],["Horario",(policy.send_window_start||"09:00")+"–"+(policy.send_window_end||"19:00")],["Zona horaria",snap.timezone||"America/Bogota"],["Límite",(snap.hard_max_marketing_messages_7d||2)+" mensajes / 7 días"],["Envío real",snap.real_sends_enabled?"Habilitado":"Bloqueado"]],policyBox=document.getElementById("rtgPolicyList");if(policyBox)policyBox.innerHTML=policies.map(function(row){return '<div class="rtgPolicyRow"><span>'+esc(row[0])+'</span><strong>'+esc(row[1])+'</strong></div>';}).join("");var blockers=document.getElementById("rtgBlockers"),blockerRows=snap.blockers||[];if(blockers)blockers.innerHTML=blockerRows.length?blockerRows.slice(0,8).map(function(item){return '<div class="rtgBlocker"><span>'+esc(rtgReason(item.reason))+'</span><strong>'+esc(item.count)+'</strong></div>';}).join(""):'<div class="rtgEmpty">Sin bloqueos registrados.</div>';var history=document.getElementById("rtgHistory"),events=snap.history||[];if(history)history.innerHTML=events.length?events.slice(0,20).map(function(event){var labels={job_created:"Seguimiento creado",job_transition:"Estado actualizado",customer_signal:"Señal del cliente",consent_recorded:"Consentimiento registrado",consent_revoked:"Consentimiento revocado",tenant_paused:"Tenant pausado",tenant_resumed:"Tenant reanudado",template_status:"Plantilla verificada"},detail=event.payload&&event.payload.signal||event.payload&&event.payload.patch&&event.payload.patch.transition_reason||"";return '<div class="rtgHistoryRow"><strong>'+esc(labels[event.type]||event.type)+'</strong><span>'+esc(when(event.created_at))+'</span><small>'+esc(event.actor||"system")+(detail?" · "+esc(rtgReason(detail)):"")+'</small></div>';}).join(""):'<div class="rtgEmpty">Aún no hay movimientos.</div>';}
function loadRetargeting(manual){if(state.retargetingLoading)return;state.retargetingLoading=true;if(manual)text("rtgMessage","Actualizando cola…");api(PANEL_RETARGETING_PATH).then(function(data){state.retargeting=data;renderRetargeting();text("rtgMessage","✓ Cola actualizada. Ningún mensaje real fue enviado.");}).catch(function(error){text("rtgMessage","No se pudo cargar el módulo: "+error.message);}).finally(function(){state.retargetingLoading=false;});}
function approveRetargetingJob(id){if(!state.retargeting||!state.retargeting.can_manage)return;text("rtgMessage","Validando aprobación…");api("/admin/retargeting/jobs/"+encodeURIComponent(id)+"/approve",{method:"POST",body:"{}"}).then(function(){text("rtgMessage","✓ Decisión aprobada. El envío real continúa bloqueado.");state.retargeting=null;loadRetargeting(false);}).catch(function(error){text("rtgMessage","No se pudo aprobar: "+error.message);});}
function cancelRetargetingJob(id){if(!state.retargeting||!state.retargeting.can_manage)return;if(!window.confirm("¿Cancelar este seguimiento? No se enviará ningún mensaje."))return;text("rtgMessage","Cancelando seguimiento…");api("/admin/retargeting/jobs/"+encodeURIComponent(id)+"/cancel",{method:"POST",body:JSON.stringify({reason:"manual_cancel_from_customer_panel"})}).then(function(){state.retargeting=null;loadRetargeting(false);}).catch(function(error){text("rtgMessage","No se pudo cancelar: "+error.message);});}
function toggleRetargetingPause(){if(!state.retargeting||!state.retargeting.can_manage)return;var paused=!!state.retargeting.snapshot.paused,route=paused?"/admin/retargeting/resume":"/admin/retargeting/pause";text("rtgMessage",paused?"Reanudando tenant…":"Pausando tenant…");api(route,{method:"POST",body:paused?"{}":JSON.stringify({reason:"manual_pause_from_customer_panel"})}).then(function(){state.retargeting=null;loadRetargeting(false);}).catch(function(error){text("rtgMessage","No se pudo cambiar la pausa: "+error.message);});}
function setupPathGet(source,path){return String(path||"").split(".").reduce(function(value,key){return value&&value[key]!=null?value[key]:undefined;},source);}
function setupPathSet(target,path,value){var parts=String(path||"").split("."),cursor=target;parts.forEach(function(key,index){if(index===parts.length-1)cursor[key]=value;else{if(!cursor[key]||typeof cursor[key]!=="object")cursor[key]={};cursor=cursor[key];}});}
function cloneSetup(value){return JSON.parse(JSON.stringify(value||{}));}
function readableSetupValue(value){if(value===true)return "Sí";if(value===false)return "No";if(Array.isArray(value))return value.join(", ");if(value&&typeof value==="object")return Object.keys(value).map(function(key){return key+": "+value[key];}).join(" · ");return String(value==null?"":value).replace(/\\s+/g," ").trim();}
function setupShort(value,fallback){var textValue=readableSetupValue(value);return textValue?textValue.slice(0,220)+(textValue.length>220?"…":""):(fallback||"Pendiente");}
function setupGoalLabel(goal){goal=String(goal||"unknown");if(goal==="both")return "Atención al cliente + Agendamiento";if(goal==="appointments")return "Agendamiento";if(goal==="customer_service")return "Atención al cliente";return "Por definir";}
function renderOnboardingSummary(payload){var box=document.getElementById("setupConfigSummary"),details=document.getElementById("onboardingQuestionnaireList");if(!box)return;var onboarding=payload&&payload.onboarding||{},answers=onboarding.answers||{},appt=answers.appointment_setup||{},svc=answers.customer_service_setup||{},goal=answers.setup_goal,business=setupPathGet(answers,"business.brand_name")||appt.business_name||PANEL_CONTEXT.businessName,clients=setupPathGet(answers,"operations.monthly_customer_volume"),tone=svc.tone||appt.assistant_tone||setupPathGet(answers,"voice.formality"),whatsapp=setupPathGet(answers,"meta.whatsapp_number"),instagram=appt.instagram_username||setupPathGet(answers,"meta.instagram_account"),email=appt.channel_email||setupPathGet(answers,"business.contact_email"),other=appt.other_channels,commerce=answers.commerce||{},channels=[whatsapp?("WhatsApp "+whatsapp):"",instagram?("Instagram "+instagram):"",email?("Correo "+email):"",other].filter(Boolean).join(" · "),commerceLabel=commerce.platform&&commerce.platform!=="unknown"&&commerce.platform!=="none"?commercePlatformLabel(commerce.platform)+" · "+commerceStatusLabel(commerce.integration_status):"Opcional",updated=onboarding.last_updated_at||onboarding.updated_at||"",status=onboarding.setup_completed?"Cuestionario completo":"En progreso";var cards=[["Empresa",business,"Marca y cuenta asociada al tenant."],["Bot contratado",setupGoalLabel(goal)||PANEL_CONTEXT.assignedBotName,"Plan: "+(PANEL_CONTEXT.planName||"Asignado")],["Clientes al mes",clients,"Aproximado para dimensionar plan y consumo."],["Cómo debe hablar",tone,"Voz base para responder como tu equipo."],["Canales recopilados",channels,"Datos guardados; se conectan desde el hub."],["Commerce connector",commerceLabel,"Shopify/WooCommerce queda como conector opcional."],["Estado",status,updated?("Última actualización: "+when(updated)):"Se actualizará al guardar."]];box.innerHTML=cards.map(function(item){return '<article class="setupConfigCard"><small>'+esc(item[0])+'</small><strong>'+esc(setupShort(item[1]))+'</strong><p>'+esc(item[2])+'</p></article>';}).join("");text("channelConnectionSummary",PANEL_CHANNEL_CONNECTIONS_ENABLED?"Conecta "+(channels||"los canales elegidos")+" con la autorización oficial de Meta. Si algo queda pendiente, lo terminarás desde el panel sin repetir el cuestionario.":"La conexión de canales todavía no está disponible para esta cuenta.");if(details){var questions=payload&&payload.questionnaire&&payload.questionnaire.questions||[],rows=[];questions.filter(function(question){return question&&question.active!==false&&question.path;}).sort(function(a,b){return(Number(a.order)||0)-(Number(b.order)||0);}).forEach(function(question){var value=setupPathGet(answers,question.path);var readable=readableSetupValue(value);if(!readable||readable==="unknown")return;rows.push([question.section||"general",question.label||question.path,readable]);});["meta.whatsapp_number","appointment_setup.instagram_username","appointment_setup.channel_email","appointment_setup.other_channels","commerce.platform","commerce.store_url","commerce.integration_intent"].forEach(function(path){var exists=rows.some(function(row){return row[1]===path;}),value=setupPathGet(answers,path);if(!exists&&readableSetupValue(value))rows.push(["pendientes",path,readableSetupValue(value)]);});details.innerHTML=rows.length?rows.map(function(row){return '<article class="questionnaireItem"><small>'+esc(row[0])+'</small><strong>'+esc(row[1])+'</strong><p>'+esc(setupShort(row[2]))+'</p></article>';}).join(""):'<article class="questionnaireItem"><small>Cuestionario</small><strong>Aún no hay respuestas guardadas.</strong></article>';}if(state.channelConnections)renderChannelConnections();else renderConnectionHub();}
function loadClientOnboardingSummary(){if(state.onboardingLoading)return;state.onboardingLoading=true;api(PANEL_ONBOARDING_PATH).then(function(payload){state.onboarding=payload;if(payload&&payload.pending_questions&&(!state.notifications||!state.notifications.pending_questions)){state.notifications={pending_count:payload.pending_questions.length,pending_questions:payload.pending_questions,items:payload.pending_questions.length?[{id:"setup-questionnaire-pending",type:"setup_improvement",priority:"high",title:"Nextfor tiene una mejora para tu bot",message:"Agregamos "+payload.pending_questions.length+" dato"+(payload.pending_questions.length===1?"":"s")+" para entrenarlo mejor. Puedes completarlo sin repetir todo el setup.",action_label:"Completar información",action_url:"/admin/client-onboarding?edit=1&focus=pending",pending_questions:payload.pending_questions}]:[]};renderNextforNotifications();}renderOnboardingSummary(payload);}).catch(function(error){var box=document.getElementById("setupConfigSummary");if(box)box.innerHTML='<article class="setupConfigCard"><small>Configuración</small><strong>No se pudo cargar</strong><p>'+esc(error.message||"Intenta de nuevo en unos minutos.")+'</p></article>';}).finally(function(){state.onboardingLoading=false;});}
function toggleSetupDetails(){state.setupDetailsOpen=!state.setupDetailsOpen;var panel=document.getElementById("setupDetailsPanel"),details=document.getElementById("onboardingDetails"),button=document.getElementById("setupDetailsToggle");if(panel)panel.hidden=!state.setupDetailsOpen;if(details)details.classList.toggle("open",state.setupDetailsOpen);if(button)button.textContent=state.setupDetailsOpen?"Ocultar detalles":"Ver cuestionario completo";}
${customerBotConfiguration.clientScript}
var SETUP_STEP_TITLES=["Tu negocio","Sedes y horarios","Oferta y condiciones","Tu industria","Personalidad y canales","Autonomía del bot","Resultados"];
var SETUP_DEFAULT_BOT_NAME="tu bot";
var SETUP_STEP_MESSAGES=[
  "Nadie conoce tu negocio como tú. Empieza por lo esencial y "+SETUP_DEFAULT_BOT_NAME+" aprenderá a presentarlo igual de bien.",
  "Tú sabes dónde y cuándo te buscan. Enséñaselo para que oriente a cada cliente tan bien como lo harías tú.",
  "Estas condiciones son tu experiencia hecha reglas. Compártelas y "+SETUP_DEFAULT_BOT_NAME+" responderá con tu mismo criterio.",
  "Tú dominas los detalles de tu sector. Pásaselos y resolverá hasta las dudas más específicas como un experto.",
  "Tu trato es lo que te distingue. Dale tu voz y tus canales para que suene como uno más de tu equipo.",
  "Tú decides hasta dónde llega. Marca sus límites y sabrá cuándo brillar solo y cuándo dejártelo a ti.",
  "Ya casi es tan bueno como tú. Cuéntale qué esperas lograr y actívalo cuando sientas que está listo."
];
function collectSetupAnswers(){var base=state.setup&&state.setup.current&&state.setup.current.answers?cloneSetup(state.setup.current.answers):{};document.querySelectorAll("[data-setup]").forEach(function(field){var value=field.type==="checkbox"?field.checked:field.value;setupPathSet(base,field.getAttribute("data-setup"),value);});return base;}
function setupCompletionEstimate(answers){var paths=["business.name","business.description","business.audience","presence.locations","presence.hours","service.main_offering","service.conditions","voice.tone","automation.can_answer","automation.must_not_answer","outcomes.primary_goal","outcomes.success_metrics"],filled=paths.filter(function(path){return String(setupPathGet(answers,path)||"").trim();}).length,channels=answers.channels||{};if(["instagram","messenger","whatsapp","web"].some(function(key){return channels[key];}))filled++;return Math.round(filled/13*100);}
function setupBotName(){var field=document.querySelector('[data-setup="business.bot_name"]'),value=field?field.value:setupPathGet(state.setup&&state.setup.current&&state.setup.current.answers,"business.bot_name");return String(value||SETUP_DEFAULT_BOT_NAME).trim()||SETUP_DEFAULT_BOT_NAME;}
function renderSetupWizard(){var step=Math.max(0,Math.min(6,Number(state.setupStep)||0)),live=!!state.setupActivated,botName=setupBotName(),pct=live?100:Math.round((step+1)/7*100),story=live&&!state.setupDirty?"¡Listo! "+botName+" ya está activo y atendiendo con tu configuración. Tú diriges, él ejecuta. 👌":SETUP_STEP_MESSAGES[step].replace(SETUP_DEFAULT_BOT_NAME,botName);state.setupStep=step;text("setupEyebrow","Paso "+(step+1)+" de 7 · "+SETUP_STEP_TITLES[step]);text("setupStory",story);text("setupCompletionValue",pct+"%");var ring=document.getElementById("setupCompletion");if(ring)ring.style.setProperty("--wizard-progress",pct+"%");var status=document.getElementById("setupPublishedStatus");if(status){status.textContent=live?"Activa en el bot":"No activa";status.classList.toggle("live",live);}var stepper=document.getElementById("setupStepper");if(stepper)stepper.innerHTML=SETUP_STEP_TITLES.map(function(title,index){var mode=index<step?"done":index===step?"current":"pending",line=index?'<span class="setupStepLine"></span>':"",label=index<step?"✓":String(index+1);return '<span class="setupStepLink '+mode+'">'+line+'<button class="setupStepDot" type="button" aria-label="Ir al paso '+(index+1)+': '+attr(title)+'" title="'+attr(title)+'" onclick="goSetupStep('+index+')">'+label+'</button></span>';}).join("");document.querySelectorAll("[data-setup-step]").forEach(function(section){section.classList.toggle("active",Number(section.getAttribute("data-setup-step"))===step);});var notice=document.getElementById("setupNotice");if(notice)notice.style.display=step===0&&!live?"flex":"none";var back=document.getElementById("setupBackBtn");if(back)back.classList.toggle("hidden",step===0);var actions=document.querySelector(".setupActions");if(actions)actions.classList.toggle("firstStep",step===0);var primary=document.getElementById("publishSetupBtn");if(primary){primary.textContent=step<6?"Continuar →":live&&!state.setupDirty?"Bot activo ✓":"Activar en el bot";primary.disabled=!(state.setup&&state.setup.can_edit)||(step===6&&live&&!state.setupDirty);}var canEdit=!!(state.setup&&state.setup.can_edit),message=!canEdit?"Tu rol permite consultar esta configuración, pero no editarla.":step===6?"Revisa y activa. Puedes editar y volver a activar cuando quieras.":"Guarda cuando quieras. “Activar en el bot” aplica los cambios a los mensajes nuevos.";text("setupMessage",message);}
function goSetupStep(index){state.setupStep=Math.max(0,Math.min(6,Number(index)||0));renderSetupWizard();var content=document.querySelector(".content");if(content)content.scrollTop=0;window.scrollTo(0,0);}
function backSetupStep(){goSetupStep(state.setupStep-1);}
function setupPrimaryAction(){if(state.setupStep<6){goSetupStep(state.setupStep+1);return;}publishBotSetup();}
function renderSetupHome(completion,live){completion=Math.max(0,Math.min(100,Number(completion)||0));var pending=Number(state.notifications&&state.notifications.pending_count)||0;if(pending){renderPendingSetupReminder(pending);return;}var card=document.getElementById("setupHomeCard"),bar=document.getElementById("setupHomeProgressBar"),button=document.getElementById("setupHomeButton"),complete=completion>=100; if(button)button.onclick=function(){showTab("setup")};text("setupHomeProgress",completion+"%");if(bar)bar.style.width=completion+"%";if(card)card.classList.toggle("complete",complete&&live);if(complete&&live){text("setupHomeTitle","Tu Nextfor IA está configurada y activa");text("setupHomeCopy","Puedes revisar o actualizar su conocimiento, personalidad y reglas cuando lo necesites.");text("setupHomeButton","Revisar configuración");}else if(complete){text("setupHomeTitle","Tu configuración está lista para activar");text("setupHomeCopy","Revisa la información y publícala para aplicarla a los mensajes nuevos.");text("setupHomeButton","Revisar y activar");}else if(live){text("setupHomeTitle","Tu Nextfor IA está activa, pero puedes completarla mejor");text("setupHomeCopy","Añade la información pendiente para darle más contexto y precisión en cada conversación.");text("setupHomeButton","Continuar configuración");}else{text("setupHomeTitle","Termina de configurar tu Nextfor IA");text("setupHomeCopy","Completa la información de tu negocio para que el bot responda con tu voz, políticas y objetivos.");text("setupHomeButton","Continuar configuración");}}
function renderIndustryQuestions(){if(!state.setup)return;var answers=collectSetupAnswers(),industry=setupPathGet(answers,"business.industry")||"other",profile=state.setup.industries&&state.setup.industries[industry],box=document.getElementById("industryQuestions");if(!profile||!box)return;state.setup.current.answers=answers;text("industryHelp","Preguntas para "+profile.label+". Cambian automáticamente si eliges otra industria.");box.innerHTML=(profile.questions||[]).map(function(question){var value=setupPathGet(answers,"industry_answers."+question.id)||"";return '<label class="setupField"><span>'+esc(question.label)+'</span><textarea data-setup="industry_answers.'+attr(question.id)+'" placeholder="'+attr(question.placeholder||"")+'">'+esc(value)+'</textarea></label>';}).join("");}
function fillSetupForm(){if(!state.setup)return;var current=state.setup.current||{},answers=current.answers||{},industry=document.getElementById("setupIndustry"),industries=state.setup.industries||{},industryOrder=["commerce","professional_services","health","restaurants","education","real_estate","beauty","other"];if(industry){industry.innerHTML=industryOrder.filter(function(key){return industries[key];}).map(function(key){return '<option value="'+attr(key)+'">'+esc(industries[key].label)+'</option>';}).join("");}document.querySelectorAll("[data-setup]").forEach(function(field){var value=setupPathGet(answers,field.getAttribute("data-setup"));if(field.type==="checkbox")field.checked=!!value;else if(value!=null)field.value=value;});renderIndustryQuestions();var canEdit=!!state.setup.can_edit;document.querySelectorAll("#botSetupForm input,#botSetupForm textarea,#botSetupForm select").forEach(function(field){field.disabled=!canEdit;});var save=document.getElementById("saveSetupBtn"),completion=current.completion==null?setupCompletionEstimate(answers):current.completion;if(save)save.disabled=!canEdit;var live=!!state.setup.published,moduleStatus=document.getElementById("moduleStatus-setup");state.setupActivated=live;if(moduleStatus){moduleStatus.textContent=live?"Activo":completion+"% completo";moduleStatus.classList.toggle("off",!live);}text("mobileModule-setup","Configuración de tu Nextfor IA · "+(live?"Activa":completion+"%"));renderSetupHome(completion,live);state.setupDirty=false;renderSetupWizard();}
function loadBotSetup(){if(!PANEL_SETUP_PATH||state.setupLoading)return;if(state.setup&&!state.setupDirty){fillSetupForm();return;}state.setupLoading=true;text("setupMessage","Cargando configuración…");api(PANEL_SETUP_PATH).then(function(data){state.setup=data;fillSetupForm();}).catch(function(error){text("setupMessage",error&&error.status===401?"La configuración guiada del bot todavía no está disponible para tu cuenta.":"No se pudo cargar la configuración: "+error.message);}).finally(function(){state.setupLoading=false;});}
function markSetupDirty(){if(!state.setup||!state.setup.can_edit)return;state.setupDirty=true;var answers=collectSetupAnswers(),completion=setupCompletionEstimate(answers);state.setup.current.answers=answers;renderSetupHome(completion,!!state.setup.published);renderSetupWizard();text("setupMessage","Tienes cambios sin guardar.");}
function setSetupBusy(busy,action){var save=document.getElementById("saveSetupBtn"),publish=document.getElementById("publishSetupBtn"),back=document.getElementById("setupBackBtn");if(save){save.disabled=busy;save.textContent=busy&&action==="save"?"Guardando…":"Guardar avance";}if(publish){publish.disabled=busy;if(busy&&action==="publish")publish.textContent="Activando…";}if(back)back.disabled=busy;if(!busy)renderSetupWizard();}
function saveBotSetup(){if(!state.setup||!state.setup.can_edit)return;var answers=collectSetupAnswers(),save=document.getElementById("saveSetupBtn"),feedback="";setSetupBusy(true,"save");text("setupMessage","Guardando tu avance…");api("/admin/bot-setup",{method:"PUT",body:JSON.stringify({answers:answers})}).then(function(result){state.setup.current=result.setup;state.setupDirty=false;fillSetupForm();feedback="✓ Avance guardado. El bot activo todavía no cambió.";}).catch(function(error){feedback="No se pudo guardar: "+error.message;}).finally(function(){setSetupBusy(false,"save");text("setupMessage",feedback||"Completa la información a tu ritmo.");if(feedback.indexOf("✓")===0&&save){save.textContent="Avance guardado ✓";setTimeout(function(){save.textContent="Guardar avance";},2000);}});}
function publishBotSetup(){if(!state.setup||!state.setup.can_edit)return;var answers=collectSetupAnswers(),feedback="";setSetupBusy(true,"publish");text("setupMessage","Validando y personalizando tu bot…");api("/admin/bot-setup/publish",{method:"POST",body:JSON.stringify({answers:answers})}).then(function(result){state.setup.current=result.setup;state.setup.published={status:"published",completion:result.setup.completion,updated_at:result.setup.updated_at,published_at:result.setup.published_at};state.setupDirty=false;state.setupActivated=true;fillSetupForm();feedback="✓ Configuración activa. Se aplicará a los mensajes nuevos.";}).catch(function(error){var detail=error.body&&error.body.completion!=null?" Vas en "+error.body.completion+"%.":"";feedback=(error.body&&error.body.message||"No se pudo activar la configuración.")+detail;}).finally(function(){setSetupBusy(false,"publish");text("setupMessage",feedback||"Revisa la configuración e intenta nuevamente.");});}
var customerPanelLogoutInProgress=false;
function logoutCustomerPanel(){
  if(customerPanelLogoutInProgress)return false;
  customerPanelLogoutInProgress=true;
  document.querySelectorAll("#nav-logout,.mobileLogout").forEach(function(button){button.disabled=true;button.setAttribute("aria-busy","true");});
  try{["rav_dashboard_key","rav_dashboard_tab","rav_logo","nextfor-integration-result","nextforia_tenant_id","tenant_id","rav_tenant_id"].forEach(function(key){localStorage.removeItem(key);sessionStorage.removeItem(key);});}catch(e){}
  fetch("/admin/logout",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{accept:"application/json"}}).catch(function(){}).finally(function(){location.replace("/admin/login?logged_out=1");});
  return false;
}
function restorePanelLayoutFromHistory(){
  var tab=state.tab;
  try{var requested=new URL(location.href).searchParams.get("tab");if(["summary","conversations","appointments","plan","channels","setup","notifications","retargeting","tests"].includes(requested))tab=requested;}catch(_){}
  document.body.classList.remove("chat-open","conversations-view","appointment-view");
  showTab(tab||"summary");
}
window.addEventListener("pageshow",function(event){if(event.persisted)restorePanelLayoutFromHistory();});
window.addEventListener("popstate",restorePanelLayoutFromHistory);
window.addEventListener("focus",function(){
  if(!state.externalIntegrationPending)return;
  state.externalIntegrationPending=false;
  setTimeout(function(){
    if(state.tab==="channels"){
      state.channelConnections=null;
      loadChannelConnections(true);
      loadClientOnboardingSummary();
    }
    if(state.tab==="plan")loadBilling(true);
  },350);
});
${appointmentClientScript}
var reply=document.getElementById("replyText");if(reply)reply.addEventListener("keydown",function(event){if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();sendReply();}});document.addEventListener("click",function(event){if(!event.target.closest(".emojiControl"))closeEmojiPickers();});document.addEventListener("keydown",function(event){if(event.key==="Escape")closeEmojiPickers();});var searchForm=document.getElementById("searchTestForm");if(searchForm)searchForm.addEventListener("submit",runProductTest);var orderForm=document.getElementById("orderTestForm");if(orderForm)orderForm.addEventListener("submit",runOrderTest);
try{var initialView=new URL(location.href).searchParams.get("view");if(["agenda","chats","reminders"].includes(initialView))state.appointmentSection=initialView;}catch(e){}
renderChannelStrips();showTab(INITIAL_TAB);loadBotSetup();loadClientOnboardingSummary();loadPanelData(false);loadPanelHealth();if(INITIAL_TAB==="plan")loadBilling(false);setInterval(function(){if(!DEMO_MODE&&!state.metaDirty)loadPanelData(false);},30000);setInterval(loadPanelHealth,120000);
</script>
</body>
</html>`);
};
