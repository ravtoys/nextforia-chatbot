"use strict";

const { parsePhoneNumberFromString } = require("libphonenumber-js/min");

const COUNTRY_NAME_TO_CODE = {
  colombia: "CO",
  mexico: "MX",
  peru: "PE",
  chile: "CL",
  argentina: "AR",
  ecuador: "EC",
  panama: "PA",
  "estados unidos": "US",
  espana: "ES"
};

// Señales de ubicación dentro del país atendido: ciudades y departamentos.
const COUNTRY_LOCATION_HINTS = {
  CO: [
    "bogota", "medellin", "cali", "barranquilla", "cartagena", "cucuta", "bucaramanga",
    "pereira", "santa marta", "ibague", "manizales", "villavicencio", "neiva", "armenia",
    "popayan", "sincelejo", "monteria", "valledupar", "pasto", "tunja", "riohacha",
    "florencia", "quibdo", "yopal", "mocoa", "arauca", "leticia", "san andres",
    "envigado", "itagui", "bello", "sabaneta", "rionegro", "caldas", "la estrella",
    "copacabana", "girardota", "barbosa", "apartado", "turbo",
    "soacha", "chia", "zipaquira", "cajica", "mosquera", "madrid", "funza", "facatativa",
    "fusagasuga", "girardot", "palmira", "buenaventura", "tulua", "cartago", "buga",
    "jamundi", "yumbo", "dosquebradas", "santa rosa de cabal", "sogamoso", "duitama",
    "barrancabermeja", "floridablanca", "piedecuesta", "giron", "malambo", "soledad",
    "magangue", "turbaco", "maicao", "uribia", "ipiales", "tumaco", "espinal",
    "antioquia", "cundinamarca", "valle del cauca", "atlantico", "santander", "bolivar",
    "narino", "boyaca", "tolima", "huila", "risaralda", "quindio", "cesar", "cordoba",
    "magdalena", "meta", "sucre", "casanare", "choco", "guajira", "la guajira",
    "putumayo", "caqueta", "guaviare", "vichada", "vaupes", "guainia", "amazonas",
    "norte de santander", "san andres y providencia"
  ]
};

// Forma de dirección: indicador de vía + al menos un número.
const ADDRESS_PATTERN = new RegExp(
  "\\b(calle|cll|cl|carrera|cra|kra|krra|kr|avenida|autopista|diagonal|dg|" +
  "transversal|trans|tv|circunvalar|manzana|mz|barrio|urbanizacion|conjunto|" +
  "apartamento|apto|apt|torre|bloque|vereda|corregimiento|direccion|direc)\\b"
);

function normalizeCountryCode(value, fallback) {
  const code = String(value || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(code)) return code;
  const fallbackCode = String(fallback || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(fallbackCode) ? fallbackCode : "CO";
}

function detectPhoneCountry(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  try {
    const parsed = parsePhoneNumberFromString("+" + digits);
    return parsed && parsed.country ? parsed.country : null;
  } catch (_) {
    return null;
  }
}

function serviceAreaCheckForPhone(value, config) {
  config = config || {};
  const serviceCountryCode = normalizeCountryCode(config.countryCode, "CO");
  const phoneCountryCode = detectPhoneCountry(value);
  return {
    enabled: config.enabled !== false,
    serviceCountryCode,
    serviceCountryName: String(config.countryName || "Colombia").trim().slice(0, 80) || "Colombia",
    phoneCountryCode,
    shouldAsk: config.enabled !== false && !!phoneCountryCode && phoneCountryCode !== serviceCountryCode
  };
}

function normalizedReply(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Acepta un string (nombre de país, compatibilidad hacia atrás) o el config completo.
function resolveServiceCountry(input) {
  if (input && typeof input === "object") {
    const name = String(input.countryName || "Colombia").trim() || "Colombia";
    return { name, code: normalizeCountryCode(input.countryCode, COUNTRY_NAME_TO_CODE[normalizedReply(name)] || "CO") };
  }
  const name = String(input || "Colombia").trim() || "Colombia";
  return { name, code: COUNTRY_NAME_TO_CODE[normalizedReply(name)] || "CO" };
}

function hasAddressShape(text) {
  return ADDRESS_PATTERN.test(text) && /\d/.test(text);
}

function mentionsLocationInsideCountry(text, country) {
  const hints = COUNTRY_LOCATION_HINTS[country.code] || [];
  return hints.some(function (hint) {
    return new RegExp("\\b" + hint + "\\b").test(text);
  });
}

function classifyServiceAreaReply(value, countryNameOrConfig) {
  const punctuated = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const text = normalizedReply(value);
  const country = resolveServiceCountry(countryNameOrConfig);
  const countryToken = normalizedReply(country.name);
  if (!text) return "unclear";

  // El cliente nombró el país, una ciudad/departamento atendido, o dio una dirección.
  // Cualquiera de las tres cuenta como confirmación de que la entrega es dentro del país.
  const namesCountry = countryToken && text.includes(countryToken);
  const locationSignal = namesCountry
    || mentionsLocationInsideCountry(text, country)
    || hasAddressShape(text);

  if (locationSignal) {
    if (/^no\s*[,;]\s*(estoy|vivo|me encuentro)\s+en\b/.test(punctuated)) return "inside";
    if (/\b(no estoy|no vivo|no me encuentro|fuera de|outside)\b/.test(text)) return "outside";
    return "inside";
  }
  if (/^(si|yes|yep|claro|correcto|exacto|afirmativo|obvio|dale)(\s|$)/.test(text)) return "inside";
  if (/^(no|nope|not)(\s|$)/.test(text)) return "outside";
  if (/\b(estoy|vivo|me encuentro)\s+(fuera|en el exterior)\b/.test(text)) return "outside";
  if (/\b(envio internacional|entrega internacional|international shipping|outside the country)\b/.test(text)) return "outside";
  return "unclear";
}

function buildServiceAreaQuestion(config) {
  const countryName = String(config && config.countryName || "Colombia").trim().slice(0, 80) || "Colombia";
  return "¡Hola! 😊 Parece que tu número es de otro país. ¿Te encuentras en " + countryName + " o necesitas que la entrega sea dentro de " + countryName + "? Así puedo orientarte correctamente 💛";
}

function buildServiceAreaContext(state, config) {
  if (!state) return "";
  const countryName = String(config && config.countryName || "Colombia").trim().slice(0, 80) || "Colombia";
  const status = ["pending", "inside", "outside", "unclear"].includes(state.status) ? state.status : "unclear";
  const lines = [
    "VERIFICACION DE ZONA DE SERVICIO:",
    "- El numero del cliente parece pertenecer a otro pais. Esto no demuestra su ubicacion actual.",
    "- Pais o mercado atendido por este negocio: " + countryName + ".",
    "- Estado de la confirmacion: " + status + "."
  ];
  if (status === "inside") {
    lines.push("- El cliente confirmo que esta en " + countryName + " o que la entrega sera dentro del pais. La verificacion de zona quedo RESUELTA: no la menciones y no vuelvas a preguntarla.");
    lines.push("- Retoma su consulta original y avanza hacia el cierre de la venta con normalidad: confirma el producto, el total y los datos de envio como con cualquier cliente local.");
    lines.push("- El origen del numero es irrelevante a partir de aqui. No lo menciones ni lo uses para dudar del pedido.");
  } else if (status === "outside") {
    lines.push("- El cliente indico que esta fuera de " + countryName + ". Explica con amabilidad la cobertura disponible y pregunta si cuenta con una direccion de entrega dentro de " + countryName + ". No prometas envios internacionales.");
    lines.push("- Si el cliente entrega una direccion dentro de " + countryName + ", la venta puede continuar con normalidad hacia el cierre.");
  } else {
    lines.push("- El cliente no confirmo claramente la ubicacion o destino. No repitas la pregunta general: continua con su consulta y avanza hacia el cierre. Confirma la ciudad o direccion solo cuando sea necesario para coordinar la entrega. No asumas el pais por el numero.");
  }
  return lines.join("\n");
}

module.exports = {
  buildServiceAreaContext,
  buildServiceAreaQuestion,
  classifyServiceAreaReply,
  detectPhoneCountry,
  hasAddressShape,
  normalizeCountryCode,
  resolveServiceCountry,
  serviceAreaCheckForPhone
};
