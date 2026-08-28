"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

assert(!source.includes("function acceptInboundMessageRate("),
  "customer conversations must not stop responding because of message counts");
assert(!source.includes('await recordTurn(userId, userMessage, "", "rate_limited"'),
  "rate limits must never record and silently abandon a customer message");
assert(source.includes('const unavailableReply = "En este momento necesito que una persona del equipo revise la configuración antes de responderte con seguridad.'),
  "a configuration problem must produce a visible customer response");
assert(source.includes('const finalReply = reply || "No logré generar una respuesta útil en este intento.'),
  "an empty provider response must use a visible fallback");

console.log("conversation-response-guarantee.test.js: all tests passed");
