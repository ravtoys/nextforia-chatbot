"use strict";

const CUSTOMER_NOTIFICATION_EMAIL_FROM = "Nextfor IA <info@nextforia.com>";
const CUSTOMER_NOTIFICATION_EMAIL_TEMPLATES = Object.freeze([
  "payment_pending",
  "shipping_pending",
  "sales_opportunity",
  "product_update",
  "human_attention"
]);

function text(value, limit) {
  return String(value == null ? "" : value).trim().slice(0, limit || 500);
}

function escapeHtml(value, limit) {
  return text(value, limit || 10000).replace(/[&<>"']/g, function (character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
  });
}

function safePanelUrl(value, baseUrl, fallbackPath) {
  try {
    const base = new URL(String(baseUrl || "https://nextforia.com"));
    if (base.protocol !== "https:") throw new Error("invalid_base");
    const resolved = new URL(String(value || fallbackPath || "/admin/panel"), base.origin);
    if (resolved.protocol !== "https:" || resolved.origin !== base.origin) return new URL(fallbackPath || "/admin/panel", base.origin).toString();
    return resolved.toString();
  } catch (_) {
    return "https://nextforia.com/admin/panel";
  }
}

function money(value, currency) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Por confirmar";
  return "$ " + Math.round(amount).toLocaleString("es-CO") + (currency && currency !== "COP" ? " " + text(currency, 8) : "");
}

function plural(count, singular, pluralValue) {
  return Number(count) === 1 ? singular : pluralValue;
}

function header(contextLabel) {
  return '<tr><td style="background-color:#0A1836;border-radius:16px 16px 0 0;padding:22px 32px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>' +
    '<td align="left" style="vertical-align:middle;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td style="width:34px;height:34px;background-color:#00A0F0;border-radius:9px;text-align:center;vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:bold;color:#0A1836;">N</td>' +
    '<td style="padding-left:11px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;letter-spacing:1px;color:#FFFFFF;">NEXFOR&nbsp;<span style="color:#57C2F3;">IA</span></td>' +
    '</tr></table></td><td align="right" style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.5px;color:#94A3BC;text-transform:uppercase;">' + escapeHtml(contextLabel, 50) + '</td>' +
    '</tr></table></td></tr>';
}

function button(label, url) {
  return '<tr><td class="px" style="background-color:#FFFFFF;padding:26px 40px 10px 40px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#00A0F0" align="center" style="border-radius:12px;">' +
    '<a href="' + escapeHtml(url, 2000) + '" style="display:inline-block;padding:16px 34px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:12px;">' + escapeHtml(label, 80) + '&nbsp;&rarr;</a>' +
    '</td></tr></table></td></tr>';
}

function footer(reason, panelUrl) {
  return '<tr><td style="background-color:#FFFFFF;border-radius:0 0 16px 16px;padding:0 40px 34px 40px;">' +
    '<div style="border-top:1px solid #EDF1F7;line-height:1px;font-size:0;margin-bottom:18px;">&nbsp;</div>' +
    '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#94A3BC;">' + escapeHtml(reason, 300) + '</p>' +
    '<p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#94A3BC;">Nexfor IA · Inteligencia corporativa al servicio de las personas · <a href="' + escapeHtml(panelUrl, 2000) + '" style="color:#0587CC;">Ir al panel</a></p>' +
    '</td></tr>';
}

function frame(input) {
  return '<!DOCTYPE html><html lang="es" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head>' +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge">' +
    '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>' + escapeHtml(input.subject, 180) + '</title>' +
    '<!--[if mso]><style>*{font-family:Arial,sans-serif!important;}</style><![endif]--><style>' +
    'body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse}a{text-decoration:none}' +
    '@media only screen and (max-width:600px){.container{width:100%!important}.px{padding-left:24px!important;padding-right:24px!important}.h1{font-size:26px!important;line-height:32px!important}}' +
    '</style></head><body style="margin:0;padding:0;background-color:#F6F8FB;">' +
    '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;height:0;width:0;">' + escapeHtml(input.preheader, 240) + '&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F6F8FB;"><tr><td align="center" style="padding:32px 16px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px;max-width:600px;">' +
    input.content + '</table></td></tr></table></body></html>';
}

function bodyIntro(eyebrow, heading, subtitle, color) {
  return '<tr><td class="px" style="background-color:#FFFFFF;padding:40px 40px 8px 40px;">' +
    '<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1.5px;color:' + color + ';text-transform:uppercase;">' + escapeHtml(eyebrow, 100) + '</p>' +
    '<h1 class="h1" style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:30px;line-height:37px;font-weight:bold;color:#0A1836;letter-spacing:-0.5px;">' + escapeHtml(heading, 180) + '</h1>' +
    '<p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#313C50;">' + subtitle + '</p></td></tr>';
}

function reinforcement(copy, emphasis) {
  return '<tr><td class="px" style="background-color:#FFFFFF;padding:22px 40px 40px 40px;"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#647289;">' + escapeHtml(copy, 200) + ' <strong style="color:#313C50;">' + escapeHtml(emphasis, 120) + '</strong></p></td></tr>';
}

function buildPaymentPending(input, panelUrl) {
  const order = input.order || input;
  const orderUrl = safePanelUrl(input.action_url, input.base_url, "/admin/panel?tab=orders&order=" + encodeURIComponent(text(order.id || order.order_id, 120)));
  const items = (Array.isArray(order.items) ? order.items : []).slice(0, 12);
  const itemRows = items.length ? items.map(function (item, index) {
    return (index ? '<tr><td style="padding:0 22px;"><div style="border-top:1px solid #DFE6F0;line-height:1px;font-size:0;">&nbsp;</div></td></tr>' : '') +
      '<tr><td style="padding:14px 22px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>' +
      '<td style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#313C50;">' + escapeHtml((Number(item.qty) || 1) + " × " + text(item.name || item.title, 180), 220) + '</td>' +
      '<td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#0A1836;white-space:nowrap;">' + money((Number(item.price) || 0) * (Number(item.qty) || 1), order.currency) + '</td>' +
      '</tr></table></td></tr>';
  }).join("") : '<tr><td style="padding:18px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#647289;">Abre el pedido para revisar sus productos y valores.</td></tr>';
  const paymentReported = input.payment_reported === true || order.payment_reported === true;
  const customer = escapeHtml(order.name || order.customer_label || input.customer_label || "Un cliente", 160);
  const subtitle = paymentReported
    ? '<strong style="color:#0A1836;">' + customer + '</strong> reportó el pago. Confírmalo y Nexfor sigue solo.'
    : '<strong style="color:#0A1836;">' + customer + '</strong> creó un pedido. Confirma el pago solo cuando esté comprobado.';
  const content = header("Customer Panel") + '<tr><td style="height:4px;background-color:#F5A524;line-height:4px;font-size:0;">&nbsp;</td></tr>' +
    bodyIntro("Pedido nuevo · Acción rápida", "Un pedido espera tu confirmación", subtitle, "#B87309") +
    '<tr><td class="px" style="background-color:#FFFFFF;padding:24px 40px 8px 40px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F6F8FB;border:1px solid #DFE6F0;border-radius:14px;">' +
    '<tr><td style="padding:20px 22px 14px;"><table role="presentation" width="100%"><tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#647289;">Pedido <strong style="color:#0A1836;">#' + escapeHtml(order.order_number || order.id || order.order_id, 120) + '</strong></td><td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#647289;">' + escapeHtml(input.date_label || "Recién recibido", 80) + '</td></tr></table></td></tr>' +
    '<tr><td style="padding:0 22px;"><div style="border-top:1px solid #DFE6F0;line-height:1px;font-size:0;">&nbsp;</div></td></tr>' + itemRows +
    '<tr><td style="padding:0 22px;"><div style="border-top:1px solid #DFE6F0;line-height:1px;font-size:0;">&nbsp;</div></td></tr><tr><td style="padding:14px 22px 18px;"><table role="presentation" width="100%"><tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#647289;">Total · <span style="color:#0A1836;">' + escapeHtml(order.payment || "Por confirmar", 80) + '</span></td><td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#0A1836;">' + money(order.total, order.currency) + '</td></tr></table></td></tr></table></td></tr>' +
    '<tr><td class="px" style="background-color:#FFFFFF;padding:16px 40px 4px;"><table role="presentation"><tr><td style="background-color:#FDF3E1;border-radius:999px;padding:8px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#B87309;">● ' + (paymentReported ? "Pago reportado — pendiente de tu confirmación" : "Pedido recibido — pago pendiente de verificación") + '</td></tr></table></td></tr>' +
    button("Confirmar pago", orderUrl) + reinforcement("Lo recibimos y ordenamos por ti —", "tú solo confirmas cuando esté verificado.") +
    footer("Recibiste este correo porque administras una empresa en Nexfor IA. Es una notificación operativa de tu Customer Panel.", panelUrl);
  return { subject: "Tienes un pedido nuevo por confirmar", preheader: "Un pedido nuevo espera tu revisión en el Customer Panel.", content, text: "Un pedido espera tu confirmación.\n\nAbrir pedido: " + orderUrl };
}

function buildShippingPending(input, panelUrl) {
  const orders = (Array.isArray(input.orders) ? input.orders : []).slice(0, 20);
  const count = orders.length;
  const actionUrl = safePanelUrl(input.action_url, input.base_url, "/admin/panel?tab=orders");
  const rows = orders.map(function (order, index) {
    const days = Math.max(0, Number(order.wait_days) || 0);
    return (index ? '<tr><td style="padding:0 22px;"><div style="border-top:1px solid #DFE6F0;line-height:1px;font-size:0;">&nbsp;</div></td></tr>' : '') +
      '<tr><td style="padding:16px 22px;"><table role="presentation" width="100%"><tr><td><p style="margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0A1836;">' + escapeHtml(order.name || "Cliente", 160) + '</p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#647289;">#' + escapeHtml(order.order_number || order.id, 100) + ' · ' + escapeHtml(String(Number(order.item_count) || (order.items || []).length || 1), 20) + ' ' + plural(Number(order.item_count) || (order.items || []).length || 1, "artículo", "artículos") + (order.city ? " · " + escapeHtml(order.city, 100) : "") + '</p></td><td align="right"><span style="display:inline-block;background-color:' + (days ? "#FDF3E1" : "#E7F7F0") + ';border-radius:999px;padding:6px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:' + (days ? "#B87309" : "#0E7A4F") + ';">' + (days ? "Espera " + days + " " + plural(days, "día", "días") : "Pagado") + '</span></td></tr></table></td></tr>';
  }).join("") || '<tr><td style="padding:18px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#647289;">Abre Pedidos para revisar los envíos pendientes.</td></tr>';
  const heading = count + " " + plural(count, "pedido listo", "pedidos listos") + " para enviar";
  const content = header("Customer Panel") + '<tr><td style="height:4px;background-color:#00A0F0;line-height:4px;font-size:0;">&nbsp;</td></tr>' +
    bodyIntro("Pagos confirmados · Listos para enviar", heading, "Ya te pagaron y esperan. Prográmalos en un toque.", "#0587CC") +
    '<tr><td class="px" style="background-color:#FFFFFF;padding:24px 40px 8px;"><table role="presentation" width="100%" style="background-color:#F6F8FB;border:1px solid #DFE6F0;border-radius:14px;">' + rows + '</table></td></tr>' +
    button("Programar envío", actionUrl) + reinforcement("Nexfor agrupó los pedidos confirmados —", "tú solo eliges cuándo salen.") + footer("Recibiste este correo porque administras una empresa en Nexfor IA. Es una notificación operativa de tu Customer Panel.", panelUrl);
  return { subject: "Tienes " + count + " " + plural(count, "pedido listo", "pedidos listos") + " para enviar", preheader: heading + ".", content, text: heading + ".\n\nProgramar envío: " + actionUrl };
}

function buildSalesOpportunity(input, panelUrl) {
  const opportunity = input.opportunity || input;
  const actionUrl = safePanelUrl(input.action_url, input.base_url, "/admin/panel?tab=retargeting");
  const score = Math.max(0, Math.min(100, Number(opportunity.score) || 0));
  const scoreLabel = score ? score + "% de cierre" : "Lista para revisar";
  const content = header("Oportunidades de Venta") +
    '<tr><td style="background-color:#0E2148;padding:30px 40px;"><table role="presentation"><tr><td style="background-color:#12305F;border:1px solid #1E4488;border-radius:999px;padding:7px 15px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1px;color:#57C2F3;text-transform:uppercase;">✦&nbsp;&nbsp;Detectado por tu IA</td></tr></table><h1 class="h1" style="margin:18px 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:30px;line-height:37px;font-weight:bold;color:#FFFFFF;letter-spacing:-.5px;">Encontré una venta lista para cerrar</h1><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#C9ECFC;">La preparé por ti. Tú solo decides el momento.</p></td></tr>' +
    '<tr><td class="px" style="background-color:#FFFFFF;padding:28px 40px 8px;"><table role="presentation" width="100%" style="background-color:#F6F8FB;border:1px solid #DFE6F0;border-radius:14px;"><tr><td style="padding:20px 22px 8px;"><table role="presentation" width="100%"><tr><td><p style="margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#0A1836;">' + escapeHtml(opportunity.customer_name || "Cliente", 160) + '</p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#647289;">' + (Number(opportunity.purchase_count) > 0 ? "Cliente recurrente · " + escapeHtml(String(Number(opportunity.purchase_count)), 20) + " compras" : "Oportunidad detectada en una conversación") + '</p></td><td align="right"><span style="display:inline-block;background-color:#E8F7FE;border-radius:999px;padding:7px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#0587CC;">' + scoreLabel + '</span></td></tr></table></td></tr><tr><td style="padding:8px 22px;"><div style="border-top:1px solid #DFE6F0;line-height:1px;font-size:0;">&nbsp;</div></td></tr><tr><td style="padding:8px 22px 4px;"><p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:.6px;color:#94A3BC;text-transform:uppercase;">La señal</p><p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:#313C50;">' + escapeHtml(opportunity.signal || "La IA detectó una conversación con intención de compra.", 600) + '</p><p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:.6px;color:#94A3BC;text-transform:uppercase;">Mi sugerencia</p><p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:#313C50;">' + escapeHtml(opportunity.suggestion || "Revisa el contexto y decide el siguiente paso.", 600) + (Number.isFinite(Number(opportunity.potential_value)) && Number(opportunity.potential_value) > 0 ? ' Venta potencial <strong style="color:#0A1836;">' + money(opportunity.potential_value, opportunity.currency) + '</strong>.' : '') + '</p></td></tr></table></td></tr>' +
    button("Ver oportunidad", actionUrl) + reinforcement("Habría pasado de largo —", "tu IA te la dejó servida.") + footer("Recibiste este correo porque tienes activo el módulo Oportunidades de Venta en Nexfor IA.", panelUrl);
  return { subject: "Tu IA encontró una venta lista para cerrar", preheader: "Tu asistente detectó una oportunidad de venta lista para revisar.", content, text: "Tu IA encontró una oportunidad de venta.\n\nVer oportunidad: " + actionUrl };
}

function buildProductUpdate(input, panelUrl) {
  const actionUrl = safePanelUrl(input.action_url, input.base_url, "/admin/panel?tab=notifications");
  const benefits = (Array.isArray(input.benefits) ? input.benefits : []).slice(0, 6);
  const rows = benefits.map(function (benefit, index) {
    return (index ? '<div style="border-top:1px solid #DFE6F0;line-height:1px;font-size:0;">&nbsp;</div>' : '') + '<table role="presentation" width="100%"><tr><td style="width:38px;vertical-align:top;padding:16px 0;"><div style="width:30px;height:30px;background-color:#E8F7FE;border-radius:8px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#0587CC;line-height:30px;">✓</div></td><td style="vertical-align:top;padding:16px 0 16px 14px;"><p style="margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0A1836;">' + escapeHtml(benefit.title, 160) + '</p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#647289;">' + escapeHtml(benefit.description, 400) + '</p></td></tr></table>';
  }).join("") || '<table role="presentation" width="100%"><tr><td style="padding:18px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#647289;">La mejora ya está disponible en tu cuenta.</td></tr></table>';
  const content = header("Novedades") + '<tr><td style="height:4px;background-color:#00A0F0;line-height:4px;font-size:0;">&nbsp;</td></tr>' +
    bodyIntro("Novedad en tu plan", input.title || "Tienes una novedad en Nextfor", escapeHtml(input.subtitle || "Ya está disponible en tu cuenta.", 400), "#0587CC") +
    '<tr><td class="px" style="background-color:#FFFFFF;padding:24px 40px 8px;"><table role="presentation" width="100%" style="background-color:#F6F8FB;border:1px solid #DFE6F0;border-radius:14px;"><tr><td style="padding:6px 22px;">' + rows + '</td></tr></table></td></tr>' +
    button("Ver novedad", actionUrl) + reinforcement("Cada mejora llega lista y encendida —", "tú solo ganas tiempo.") + footer("Recibiste este correo porque tienes un plan activo en Nexfor IA. Es una novedad de producto de tu cuenta.", panelUrl);
  return { subject: text(input.subject || "Novedad en tu plan Nexfor", 180), preheader: text(input.preheader || input.subtitle || "Tienes una novedad disponible en Nextfor.", 240), content, text: text(input.title || "Tienes una novedad en Nextfor", 180) + "\n\nVer novedad: " + actionUrl };
}

function buildHumanAttention(input, panelUrl) {
  const actionUrl = safePanelUrl(input.action_url, input.base_url, "/admin/panel?tab=conversations&conversation=" + encodeURIComponent(text(input.conversation_id, 500)));
  const channel = text(input.channel_label || input.channel || "WhatsApp", 40);
  const message = text(input.message_preview || input.message || "El cliente está esperando que tu equipo continúe la conversación.", 500);
  const content = header("Bandeja") + '<tr><td style="height:4px;background-color:#14A971;line-height:4px;font-size:0;">&nbsp;</td></tr>' +
    bodyIntro("Conversación · Te necesita", "Un cliente quiere hablar contigo", "Tu IA lo atendió y llegó justo hasta donde te toca a ti. Una respuesta y cierras.", "#0E7A4F") +
    '<tr><td class="px" style="background-color:#FFFFFF;padding:24px 40px 8px;"><table role="presentation" width="100%" style="background-color:#F6F8FB;border:1px solid #DFE6F0;border-radius:14px;"><tr><td style="padding:18px 22px 8px;"><table role="presentation" width="100%"><tr><td><p style="margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0A1836;">' + escapeHtml(input.customer_label || "Un cliente", 160) + '</p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#647289;">' + escapeHtml(channel, 40) + ' · hace poco</p></td><td align="right"><span style="display:inline-block;background-color:#E7F7F0;border-radius:999px;padding:6px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:#0E7A4F;">Espera respuesta</span></td></tr></table></td></tr><tr><td style="padding:6px 22px 18px;"><table role="presentation" width="100%"><tr><td style="background-color:#FFFFFF;border:1px solid #DFE6F0;border-radius:12px 12px 12px 4px;padding:12px 15px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#313C50;">' + escapeHtml(message, 500) + '</td></tr></table></td></tr></table></td></tr>' +
    button("Responder ahora", actionUrl) + reinforcement("La IA hizo lo repetitivo —", "tú llegas justo al momento que importa.") + footer("Recibiste este correo porque tu agente de Nexfor IA marcó una conversación para ti.", panelUrl);
  return { subject: "Una conversación necesita de ti", preheader: "Tu IA atendió, pero este cliente necesita a tu equipo.", content, text: "Un cliente necesita de ti.\n\nResponder ahora: " + actionUrl };
}

function buildCustomerNotificationEmail(template, input) {
  input = input || {};
  if (!CUSTOMER_NOTIFICATION_EMAIL_TEMPLATES.includes(template)) throw new Error("customer_notification_email_template_invalid");
  const panelUrl = safePanelUrl(input.panel_url, input.base_url, "/admin/panel");
  const result = template === "payment_pending" ? buildPaymentPending(input, panelUrl)
    : template === "shipping_pending" ? buildShippingPending(input, panelUrl)
      : template === "sales_opportunity" ? buildSalesOpportunity(input, panelUrl)
        : template === "product_update" ? buildProductUpdate(input, panelUrl)
          : buildHumanAttention(input, panelUrl);
  return {
    template,
    from: CUSTOMER_NOTIFICATION_EMAIL_FROM,
    subject: result.subject,
    text: result.text + "\n\nCustomer Panel: " + panelUrl,
    html: frame(result)
  };
}

function createResendCustomerNotificationEmailSender(options) {
  options = options || {};
  const apiKey = text(options.apiKey, 500);
  const replyTo = text(options.replyTo, 254);
  const axiosClient = options.axiosClient;
  return {
    async send(message) {
      if (!axiosClient || typeof axiosClient.post !== "function" || !apiKey) throw new Error("customer_notification_email_sender_unavailable");
      const recipient = text(message && message.to, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error("customer_notification_email_recipient_invalid");
      const email = buildCustomerNotificationEmail(message.template, message);
      const response = await axiosClient.post("https://api.resend.com/emails", {
        from: CUSTOMER_NOTIFICATION_EMAIL_FROM,
        to: [recipient],
        reply_to: replyTo || undefined,
        subject: email.subject,
        text: email.text,
        html: email.html
      }, {
        headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
        timeout: 8000
      });
      return { id: response.data && response.data.id || null, email };
    }
  };
}

module.exports = {
  CUSTOMER_NOTIFICATION_EMAIL_FROM,
  CUSTOMER_NOTIFICATION_EMAIL_TEMPLATES,
  buildCustomerNotificationEmail,
  createResendCustomerNotificationEmailSender,
  safePanelUrl
};
