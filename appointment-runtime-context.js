"use strict";

const DEFAULT_TIME_ZONE = "America/Bogota";
const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeTimeZone(value) {
  const candidate = String(value || "").trim() || DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("es-CO", { timeZone: candidate }).format(new Date(0));
    return candidate;
  } catch (_) {
    return DEFAULT_TIME_ZONE;
  }
}

function validDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value || Date.now());
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function dateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("es-CO", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date).reduce(function (result, part) {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return {
    isoDate: [parts.year, parts.month, parts.day].join("-"),
    weekday: String(parts.weekday || "").toLowerCase(),
    localTime: [parts.hour, parts.minute, parts.second].join(":")
  };
}

function buildAppointmentDateContext(options) {
  const input = options && typeof options === "object" ? options : {};
  const now = validDate(input.now);
  const timeZone = normalizeTimeZone(input.timeZone);
  const current = dateParts(now, timeZone);
  const calendar = [];
  for (let offset = -1; offset <= 14; offset++) {
    const day = dateParts(new Date(now.getTime() + offset * DAY_MS), timeZone);
    calendar.push("- " + day.isoDate + " — " + day.weekday);
  }
  return [
    "CONTEXTO TEMPORAL AUTORITATIVO DEL SISTEMA:",
    "- Ahora en " + timeZone + ": " + current.isoDate + " (" + current.weekday + ") a las " + current.localTime + ".",
    "- Hora UTC de referencia: " + now.toISOString() + ".",
    "- Este contexto reemplaza cualquier fecha vieja o contradictoria del historial, la configuración o mensajes anteriores del asistente.",
    "- Nunca adivines la fecha, el mes ni el día de la semana. Para fechas relativas usa la zona horaria indicada y este calendario:",
    calendar.join("\n"),
    "REGLAS TEMPORALES:",
    "- No ofrezcas ni consultes horarios anteriores al momento actual.",
    "- Si el cliente combina una fecha con un día de la semana que no coinciden, señala la diferencia y pide que elija una sola opción.",
    "- Antes de afirmar disponibilidad usa check_appointment_availability y conserva exactamente la fecha normalizada por la herramienta."
  ].join("\n");
}

module.exports = {
  DEFAULT_TIME_ZONE,
  buildAppointmentDateContext,
  normalizeTimeZone
};
