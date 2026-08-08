"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const net = require("net");
const path = require("path");

function availablePort() {
  return new Promise(function (resolve, reject) {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", function () {
      const port = server.address().port;
      server.close(function () { resolve(port); });
    });
  });
}

function waitForServer(child, port) {
  return new Promise(function (resolve, reject) {
    let output = "";
    const timer = setTimeout(function () { reject(new Error("server_start_timeout\n" + output)); }, 30000);
    function inspect(chunk) {
      output += String(chunk || "");
      if (output.includes("running on port " + port)) {
        clearTimeout(timer);
        resolve();
      }
    }
    child.stdout.on("data", inspect);
    child.stderr.on("data", inspect);
    child.once("exit", function (code) {
      clearTimeout(timer);
      reject(new Error("server_exited_" + code + "\n" + output));
    });
  });
}

function signedSessionCookie(secret) {
  const payload = Buffer.from(JSON.stringify({
    v: 2,
    rst: "customer-access-membership-only-2026-08-08",
    uid: "11111111-1111-4111-8111-111111111111",
    e: "logout@example.com",
    n: "logout@example.com",
    r: "admin",
    t: "tenant-logout",
    mv: 1,
    exp: Date.now() + 60 * 60 * 1000
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return "nextforia_dashboard_session=" + encodeURIComponent(payload + "." + signature);
}

(async function run() {
  const port = await availablePort();
  const base = "http://127.0.0.1:" + port;
  const sessionSecret = "customer-panel-logout-session-secret";
  const child = childProcess.spawn(process.execPath, [path.join(__dirname, "index.js")], {
    cwd: __dirname,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      NODE_ENV: "test",
      DASHBOARD_KEY: "customer-panel-logout-key",
      DASHBOARD_SESSION_SECRET: sessionSecret,
      DASHBOARD_USERS: "[]",
      VERIFY_TOKEN: "customer-panel-logout-verify",
      WA_TOKEN: "customer-panel-logout-wa-dummy",
      ANTHROPIC_API_KEY: "customer-panel-logout-anthropic-dummy",
      CUSTOMER_ACCESS_V2_ENABLED: "1",
      CUSTOMER_ACCESS_TEST_MODE: "0",
      SUPABASE_URL: "http://127.0.0.1:1",
      SUPABASE_KEY: "unavailable-store-key"
    }),
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer(child, port);
    const response = await fetch(base + "/admin/logout", {
      method: "POST",
      headers: { origin: base, cookie: signedSessionCookie(sessionSecret) }
    });
    assert.strictEqual(response.status, 200, "logout must not depend on membership-store availability");
    assert.deepStrictEqual(await response.json(), { ok: true });
    assert.match(String(response.headers.get("set-cookie") || ""), /nextforia_dashboard_session=.*Max-Age=0/);
    console.log("customer panel logout e2e tests passed");
  } finally {
    child.kill("SIGTERM");
    await new Promise(function (resolve) { child.once("exit", resolve); });
  }
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
