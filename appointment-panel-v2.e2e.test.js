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
    const timer = setTimeout(function () { reject(new Error("server_start_timeout\n" + output)); }, 15000);
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

function signature(body, secret, timestamp) {
  return "t=" + timestamp + ",v0=" + crypto.createHmac("sha256", secret).update(timestamp + "." + body).digest("hex");
}

async function login(base, email, password) {
  const response = await fetch(base + "/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ email, password })
  });
  assert.strictEqual(response.status, 200, "login should succeed for " + email);
  return String(response.headers.get("set-cookie") || "").split(";")[0];
}

async function seedAppointment(base, secret, agentId, customerName) {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({
    type: "post_call_transcription",
    event_timestamp: timestamp,
    data: {
      agent_id: agentId,
      conversation_id: "voice-thread-" + agentId,
      analysis: {
        transcript_summary: "Cita creada para prueba de aislamiento",
        data_collection_results: {
          appointment_id: { value: "shared-appointment-id" },
          appointment_status: { value: "booked" },
          appointment_datetime: { value: "2030-07-21T09:00:00-05:00" },
          client_name: { value: customerName },
          consultation_reason: { value: "Consulta de prueba" },
          data_processing_consent: { value: "authorized" }
        }
      }
    }
  });
  const response = await fetch(base + "/webhooks/elevenlabs/post-call", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "elevenlabs-signature": signature(body, secret, timestamp)
    },
    body
  });
  assert.strictEqual(response.status, 200);
}

(async function run() {
  const port = await availablePort();
  const base = "http://127.0.0.1:" + port;
  const secret = "appointment-panel-v2-webhook-secret";
  const password = "AppointmentPanelV2!";
  const fixtures = [
    {
      user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenant_id: "appointment-tenant-a",
      company_name: "Clínica A",
      email: "admin-a@example.test",
      password,
      role: "admin",
      plan_id: "nextfor-tempo",
      assigned_bot_id: "agendamiento",
      tenant_status: "active"
    },
    {
      user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenant_id: "appointment-tenant-b",
      company_name: "Clínica B",
      email: "admin-b@example.test",
      password,
      role: "admin",
      plan_id: "nextfor-tempo",
      assigned_bot_id: "agendamiento",
      tenant_status: "active"
    },
    {
      user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      tenant_id: "appointment-tenant-a",
      company_name: "Clínica A",
      email: "viewer-a@example.test",
      password,
      role: "viewer",
      plan_id: "nextfor-tempo",
      assigned_bot_id: "agendamiento",
      tenant_status: "active"
    }
  ];
  const child = childProcess.spawn(process.execPath, [path.join(__dirname, "index.js")], {
    cwd: __dirname,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      NODE_ENV: "test",
      DASHBOARD_SESSION_SECRET: "appointment-panel-v2-session-secret",
      DASHBOARD_KEY: "appointment-panel-v2-super-admin-key",
      VERIFY_TOKEN: "appointment-panel-v2-verify-token",
      WA_TOKEN: "appointment-panel-v2-not-used",
      ANTHROPIC_API_KEY: "appointment-panel-v2-not-used",
      ELEVENLABS_WEBHOOK_SECRET: secret,
      ELEVENLABS_AGENT_TENANT_MAP: JSON.stringify({ agent_a: "appointment-tenant-a", agent_b: "appointment-tenant-b" }),
      SUPABASE_URL: "",
      SUPABASE_KEY: "",
      CUSTOMER_ACCESS_TEST_MODE: "1",
      CUSTOMER_ACCESS_TEST_USERS: JSON.stringify(fixtures),
      CUSTOMER_PANEL_BASE_URL: "https://customer-panel-v2.example.test",
      APPOINTMENT_PANEL_V2_ENABLED: "1",
      APPOINTMENT_REMINDERS_V1_ENABLED: "1",
      APPOINTMENT_REMINDER_SENDS_ENABLED: "0"
    }),
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer(child, port);

    let response = await fetch(base + "/admin/panel-demo?tab=appointments");
    assert.strictEqual(response.status, 200);
    const appointmentDemoHtml = await response.text();
    assert(appointmentDemoHtml.includes('INITIAL_TAB="appointments"'),
      "the appointment demo entrypoint must open the appointment module");
    assert(appointmentDemoHtml.includes('"planId":"nextfor-tempo"'),
      "the appointment demo entrypoint must infer the Tempo entitlement");
    assert(appointmentDemoHtml.includes('id="nav-appointments"'));
    assert(appointmentDemoHtml.includes('data-appt-nav="reminders"'));
    assert(appointmentDemoHtml.includes('data-appt-nav="rules"'));

    await seedAppointment(base, secret, "agent_a", "Cliente A");
    await seedAppointment(base, secret, "agent_b", "Cliente B");

    const cookieA = await login(base, "admin-a@example.test", password);
    const cookieB = await login(base, "admin-b@example.test", password);
    const viewerCookie = await login(base, "viewer-a@example.test", password);

    response = await fetch(base + "/admin/panel/appointment-settings", { headers: { cookie: cookieA } });
    assert.strictEqual(response.status, 200);
    let payload = await response.json();
    const revisionA = payload.revision;

    response = await fetch(base + "/admin/panel/appointment-settings", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: cookieA, origin: base },
      body: JSON.stringify({
        revision: revisionA,
        settings: {
          services: "Valoración inicial · 45 minutos · Clínica A",
          minimum_booking_notice: "Reservar mínimo con 12 horas de anticipación.",
          maximum_booking_window: "Hasta 90 días adelante.",
          cancellation_policy: "Reprogramar con mínimo 6 horas de anticipación.",
          no_show_policy: "Después de dos inasistencias se requiere anticipo.",
          booking_payment_details: "La valoración inicial no requiere anticipo.",
          booking_requirements: [
            { id: "full_name", type: "full_name", label: "Nombre completo", active: true, required: true },
            { id: "primera_cita", type: "custom", label: "Primera cita", question: "¿Es tu primera cita?", active: true, required: true }
          ],
          appointment_services: [{
            id: "consulta_inicial",
            name: "Consulta inicial",
            description: "Recibe una ruta clara para cuidar tu sonrisa desde el primer paso.",
            duration_minutes: 45,
            price_cop: 250000,
            modality: "virtual",
            virtual_link: "https://meet.example/consulta",
            deposit: { required: true, mode: "fixed", amount: 50000 },
            payment_methods: [
              { type: "bank_transfer", active: true, instructions: "Transferir a la cuenta indicada por Clínica A." },
              { type: "payment_link", active: true, instructions: "Usar el enlace seguro enviado por Clínica A." }
            ]
          }],
          rules: [{ id: "rule-a", text: "Atender únicamente en horario de Clínica A.", active: true }],
          exceptions: [{ id: "closed-a", date: "2030-07-22", mode: "close", note: "Cierre Clínica A" }],
          reminder_policy: { enabled: true, channel: "whatsapp", offsets_minutes: [1440, 360] }
        }
      })
    });
    assert.strictEqual(response.status, 200);
    payload = await response.json();
    assert.strictEqual(payload.settings.rules[0].id, "rule-a");
    assert(payload.settings.booking_requirements.some(function (row) {
      return row.id === "primera_cita" && row.required === true;
    }), "tenant A must persist its custom appointment requirement");
    assert.strictEqual(payload.settings.services, "Valoración inicial · 45 minutos · Clínica A");
    assert.strictEqual(payload.settings.cancellation_policy, "Reprogramar con mínimo 6 horas de anticipación.");
    assert.strictEqual(payload.settings.appointment_services[0].deposit.amount, 50000);
    assert.strictEqual(payload.settings.appointment_services[0].payment_methods.filter(function (row) { return row.active; }).length, 2);
    assert.strictEqual(payload.settings.appointment_services[0].description, "Recibe una ruta clara para cuidar tu sonrisa desde el primer paso.");
    const revisionAfterFirstSave = payload.revision;

    response = await fetch(base + "/admin/customer-setups/appointment-tenant-a/configuration-verification", {
      headers: { "x-dashboard-key": "appointment-panel-v2-super-admin-key" }
    });
    assert.strictEqual(response.status, 200, "Super Admin must be able to verify the canonical tenant record");
    const verification = await response.json();
    assert.strictEqual(verification.verification.tenant_id, "appointment-tenant-a");
    assert.strictEqual(verification.verification.persistence, "memory_test_only");
    assert.strictEqual(verification.verification.service_count, 1);
    assert.strictEqual(verification.verification.services[0].name, "Consulta inicial");
    assert.strictEqual(verification.verification.services[0].description, "Recibe una ruta clara para cuidar tu sonrisa desde el primer paso.");
    assert.strictEqual(verification.verification.services[0].payment_methods[0].instructions_configured, true);
    assert(verification.verification.fingerprint, "verification must include a backend receipt fingerprint");

    response = await fetch(base + "/admin/customer-setups/appointment-tenant-a/configuration-verification", {
      headers: { cookie: cookieA }
    });
    assert.strictEqual(response.status, 401, "tenant sessions must not access platform verification");

    response = await fetch(base + "/admin/panel/appointment-settings", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: viewerCookie, origin: base },
      body: JSON.stringify({ revision: payload.revision, settings: { rules: [] } })
    });
    assert.strictEqual(response.status, 401, "viewer must not edit appointment settings");

    response = await fetch(base + "/admin/panel/appointment-settings", { headers: { cookie: cookieB } });
    assert.strictEqual(response.status, 200);
    const settingsB = await response.json();
    assert(!settingsB.settings.rules.some(function (row) { return row.id === "rule-a"; }), "tenant B must not see tenant A rules");
    assert(!settingsB.settings.booking_requirements.some(function (row) { return row.id === "primera_cita"; }),
      "tenant B must not see tenant A appointment requirements");
    assert.notStrictEqual(settingsB.settings.services, "Valoración inicial · 45 minutos · Clínica A",
      "tenant B must not see tenant A appointment services");
    assert.notStrictEqual(settingsB.settings.cancellation_policy, "Reprogramar con mínimo 6 horas de anticipación.",
      "tenant B must not see tenant A appointment rules");
    assert.strictEqual(settingsB.settings.appointment_services.length, 0,
      "tenant B must not inherit tenant A service rules");

    response = await fetch(base + "/admin/panel/appointments-data", { headers: { cookie: cookieA } });
    assert.strictEqual(response.status, 200);
    const appointmentsA = await response.json();
    assert.strictEqual(appointmentsA.appointments.length, 1);
    assert.strictEqual(appointmentsA.appointments[0].customer_name, "Cliente A");
    assert.strictEqual(appointmentsA.reminders.length, 2);
    const reminderA = appointmentsA.reminders[0];

    response = await fetch(base + "/admin/panel/appointments-data", { headers: { cookie: cookieB } });
    assert.strictEqual(response.status, 200);
    const appointmentsB = await response.json();
    assert.strictEqual(appointmentsB.appointments.length, 1);
    assert.strictEqual(appointmentsB.appointments[0].customer_name, "Cliente B");
    assert.strictEqual(appointmentsB.reminders.length, 0, "tenant B must keep its independent reminder policy");

    response = await fetch(base + "/admin/panel/appointment-reminders/" + encodeURIComponent(reminderA.id) + "/action", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieB, origin: base },
      body: JSON.stringify({ action: "pause" })
    });
    assert.strictEqual(response.status, 404, "tenant B must not mutate tenant A reminders");

    response = await fetch(base + "/admin/panel/appointment-reminders/" + encodeURIComponent(reminderA.id) + "/action", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieA, origin: base },
      body: JSON.stringify({ action: "pause" })
    });
    assert.strictEqual(response.status, 200);
    payload = await response.json();
    assert.strictEqual(payload.reminder.status, "paused");

    response = await fetch(base + "/admin/panel/appointment-settings", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: cookieA, origin: base },
      body: JSON.stringify({
        revision: revisionAfterFirstSave,
        settings: {
          rules: [{ id: "rule-a", text: "Atender únicamente en horario de Clínica A.", active: true }],
          exceptions: [{
            id: "partial-a",
            date: "2030-07-21",
            mode: "partial",
            available_from: "09:30",
            available_until: "12:00",
            outside_action: "reschedule",
            note: "Congreso médico"
          }],
          booking_policy: { default_duration_minutes: 45, buffer_minutes: 15 },
          reminder_policy: { enabled: true, channel: "whatsapp", offsets_minutes: [1440, 360] }
        }
      })
    });
    assert.strictEqual(response.status, 200);
    payload = await response.json();
    assert.deepStrictEqual(payload.settings.booking_policy, { default_duration_minutes: 45, buffer_minutes: 15 });
    assert.strictEqual(payload.settings.exceptions[0].mode, "partial");
    assert.deepStrictEqual(payload.affected_appointments, ["shared-appointment-id"],
      "a partial-day exception must create a real review workflow for appointments outside the allowed window");

    response = await fetch(base + "/admin/panel/appointments/action", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieA, origin: base },
      body: JSON.stringify({ action: "cancel", appointment_id: "shared-appointment-id" })
    });
    assert.strictEqual(response.status, 200);

    response = await fetch(base + "/admin/panel/appointments-data", { headers: { cookie: cookieB } });
    assert.strictEqual(response.status, 200);
    payload = await response.json();
    assert.notStrictEqual(payload.appointments[0].ui_status, "cancelled", "same appointment ID in tenant B must remain unchanged");

    console.log("appointment panel v2 e2e tests: ok");
  } finally {
    child.kill("SIGTERM");
  }
})().catch(function (error) {
  console.error(error.stack || error.message);
  process.exit(1);
});
