"use strict";

const assert = require("assert");
const crypto = require("crypto");
const {
  decryptStoredText,
  encryptStoredText,
  isSameOriginRequest,
  parseEncryptionKey,
  safeInlineJson,
  securityHeaders,
  validMetaSignature,
  validateProductionConfig
} = require("./security");

const encryptionKey = crypto.randomBytes(32);
const encodedKey = encryptionKey.toString("base64url");
assert.deepStrictEqual(parseEncryptionKey(encodedKey), encryptionKey);
assert.strictEqual(parseEncryptionKey("too-short"), null);
const encrypted = encryptStoredText("private customer message", encryptionKey);
assert(encrypted.startsWith("enc:v1:"));
assert.strictEqual(decryptStoredText(encrypted, encryptionKey), "private customer message");
assert.throws(function () { decryptStoredText(encrypted, crypto.randomBytes(32)); }, /authentication_failed/);
assert.strictEqual(decryptStoredText("legacy plaintext", encryptionKey), "legacy plaintext");

const secret = "a-secure-meta-app-secret-value";
const body = Buffer.from('{"object":"whatsapp_business_account"}');
const signature = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
assert.strictEqual(validMetaSignature(body, signature, secret, false), true);
assert.strictEqual(validMetaSignature(Buffer.from("tampered"), signature, secret, false), false);
assert.strictEqual(validMetaSignature(body, "sha256=bad", secret, false), false);
assert.strictEqual(validMetaSignature(body, "", "", false), false);
assert.strictEqual(validMetaSignature(body, "", "", true), true);

assert(!safeInlineJson("</script><script>alert(1)</script>").includes("</script>"));

function responseHeadersFor(path) {
  const headers = {};
  securityHeaders({ path, originalUrl: path, secure: true, get: function () { return ""; } }, {
    setHeader(name, value) { headers[name] = value; }
  }, function () {});
  return headers;
}
assert(responseHeadersFor("/admin/panel")["Permissions-Policy"].includes("microphone=(self)"));
assert(responseHeadersFor("/")["Permissions-Policy"].includes("microphone=()"));

function request(headers, protocol) {
  return {
    protocol: protocol || "https",
    get(name) { return headers[String(name).toLowerCase()] || ""; }
  };
}
assert.strictEqual(isSameOriginRequest(request({ origin: "https://app.example.com", host: "app.example.com" }), ""), true);
assert.strictEqual(isSameOriginRequest(request({ origin: "https://evil.example", host: "app.example.com" }), ""), false);
assert.strictEqual(isSameOriginRequest(request({ host: "app.example.com" }), ""), false);

assert.deepStrictEqual(validateProductionConfig({ nodeEnv: "test" }), []);
assert(validateProductionConfig({ nodeEnv: "production" }).length >= 4);
assert.deepStrictEqual(validateProductionConfig({
  nodeEnv: "production",
  verifyToken: "v".repeat(24),
  dashboardKey: "d".repeat(32),
  dashboardSessionSecret: "s".repeat(32),
  metaAppSecret: "m".repeat(24),
  publicBaseUrl: "https://app.example.com",
  allowUnsignedWebhooks: false
}), []);
assert.deepStrictEqual(validateProductionConfig({
  nodeEnv: "production",
  verifyToken: "legacy-token",
  dashboardKey: "d".repeat(32),
  dashboardSessionSecret: "s".repeat(32),
  metaAppSecret: "",
  publicBaseUrl: "https://app.example.com",
  allowUnsignedWebhooks: false
}), []);

console.log("security tests passed");
