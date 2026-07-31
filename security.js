"use strict";

const crypto = require("crypto");

function safeEqualText(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || ""));
  const right = Buffer.from(String(rightValue || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function safeInlineJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function parseEncryptionKey(value) {
  if (!value) return null;
  try {
    const key = Buffer.from(String(value), "base64url");
    return key.length === 32 ? key : null;
  } catch (_) {
    return null;
  }
}

function encryptStoredText(value, key) {
  const text = String(value == null ? "" : value);
  if (!key || !text) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["enc", "v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

function decryptStoredText(value, key) {
  const text = String(value == null ? "" : value);
  if (!text.startsWith("enc:v1:")) return text;
  if (!key) throw new Error("data_encryption_key_missing");
  const parts = text.split(":");
  if (parts.length !== 5) throw new Error("encrypted_value_invalid");
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(parts[2], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[3], "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(parts[4], "base64url")), decipher.final()]).toString("utf8");
  } catch (_) {
    throw new Error("encrypted_value_authentication_failed");
  }
}

function validMetaSignature(rawBody, suppliedSignature, appSecret, allowUnsigned) {
  if (!appSecret) return allowUnsigned === true;
  if (!Buffer.isBuffer(rawBody)) return false;
  const supplied = String(suppliedSignature || "");
  if (!/^sha256=[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqualText(supplied.toLowerCase(), expected.toLowerCase());
}

function firstForwardedValue(value) {
  return String(value || "").split(",")[0].trim();
}

function normalizeOrigin(value) {
  try {
    return new URL(String(value || "")).origin;
  } catch (_) {
    return "";
  }
}

function targetOrigin(req, configuredOrigin) {
  const configured = normalizeOrigin(configuredOrigin);
  if (configured) return configured;
  const protocol = firstForwardedValue(req.get("x-forwarded-proto")) || req.protocol || "https";
  const host = firstForwardedValue(req.get("x-forwarded-host")) || req.get("host");
  return normalizeOrigin(protocol + "://" + host);
}

function isSameOriginRequest(req, configuredOrigin) {
  const source = normalizeOrigin(req.get("origin")) || normalizeOrigin(req.get("referer"));
  const target = targetOrigin(req, configuredOrigin);
  return !!source && !!target && source === target;
}

function createRateLimiter(options) {
  const windowMs = Math.max(1000, Number(options && options.windowMs) || 60000);
  const max = Math.max(1, Number(options && options.max) || 60);
  const keyGenerator = options && options.keyGenerator;
  const maxEntries = Math.max(100, Number(options && options.maxEntries) || 10000);
  const buckets = new Map();

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const rawKey = keyGenerator ? keyGenerator(req) : (req.ip || req.socket && req.socket.remoteAddress || "unknown");
    const key = String(rawKey || "unknown").slice(0, 300);
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
    bucket.count++;
    buckets.set(key, bucket);

    if (buckets.size > maxEntries) {
      for (const [entryKey, entry] of buckets) {
        if (entry.resetAt <= now || buckets.size > maxEntries) buckets.delete(entryKey);
        if (buckets.size <= maxEntries) break;
      }
    }

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      res.status(429).json({ ok: false, error: "rate_limited" });
      return;
    }
    next();
  };
}

function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  const panelCanRequestMicrophone = req.path === "/admin/panel" || req.path === "/admin/panel/";
  res.setHeader("Permissions-Policy", "camera=(), microphone=" + (panelCanRequestMicrophone ? "(self)" : "()") + ", geolocation=(), payment=(), usb=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "upgrade-insecure-requests"
  ].join("; "));
  if (req.secure || firstForwardedValue(req.get("x-forwarded-proto")) === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  if (String(req.originalUrl || "").startsWith("/admin")) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
  }
  next();
}

function validateProductionConfig(config) {
  if (!config || config.nodeEnv !== "production") return [];
  const errors = [];
  const required = [
    ["VERIFY_TOKEN", config.verifyToken, 8],
    ["DASHBOARD_KEY", config.dashboardKey, 32],
    ["DASHBOARD_SESSION_SECRET", config.dashboardSessionSecret, 32]
  ];
  for (const [name, value, minLength] of required) {
    if (!value || String(value).length < minLength) errors.push(name + " must be set to at least " + minLength + " characters");
  }
  if (config.metaAppSecret && String(config.metaAppSecret).length < 24) {
    errors.push("META_APP_SECRET must be at least 24 characters when configured");
  }
  if (!config.publicBaseUrl) errors.push("PUBLIC_BASE_URL must be set in production");
  if (config.allowUnsignedWebhooks) errors.push("ALLOW_UNSIGNED_WEBHOOKS must not be enabled in production");
  if (config.publicBaseUrl && !/^https:\/\//i.test(String(config.publicBaseUrl))) errors.push("PUBLIC_BASE_URL must use https in production");
  return errors;
}

module.exports = {
  createRateLimiter,
  decryptStoredText,
  encryptStoredText,
  isSameOriginRequest,
  parseEncryptionKey,
  safeEqualText,
  safeInlineJson,
  securityHeaders,
  targetOrigin,
  validMetaSignature,
  validateProductionConfig
};
