"use strict";

// La PWA del Customer Panel (v412).
//
// La regla que mas importa proteger: con la bandera APAGADA, el panel tiene que
// salir byte por byte como antes. Es la valvula de escape si algo sale mal en
// produccion, asi que hay un test dedicado a que "apagado == invisible".
//
// La segunda: no se crea un service worker nuevo. El de notificaciones ya
// existe y ya tiene la suscripcion push que el cliente acepto; registrar otro
// en el mismo scope la borraria. El test verifica que se reusa /admin/customer-
// notification-sw.js y no se inventa una ruta nueva.

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const renderCustomerPanel = require("./customer-panel");

function render(pwaEnabled) {
  let html = "";
  const res = {
    status: function () { return this; },
    setHeader: function () { return this; },
    send: function (value) { html = String(value); return this; }
  };
  renderCustomerPanel(res, {
    auth: { name: "QA", role: "admin" },
    capabilities: {},
    initialTab: "conversations",
    tenantContext: {
      id: "tenant-a", company_name: "Negocio A", plan_id: "nextfor-aura",
      plan_name: "Nextfor Aura", assigned_bot_id: "customer-service",
      assigned_bot_name: "Atención al cliente", support: true, appointments: false
    },
    channelConnectionsV1Enabled: true,
    pwaEnabled: pwaEnabled,
    botVersion: "v412-customer-panel-pwa"
  });
  return html;
}

// ─── Apagado: el panel no cambia ──────────────────────────────────────────

const off = render(false);
assert(!/rel="manifest"/.test(off), "sin bandera no debe haber manifest");
assert(!/apple-mobile-web-app-capable/.test(off), "sin bandera no van las metas de iOS");
assert(!/viewport-fit=cover/.test(off), "sin bandera no cambia el viewport legado");
assert(!/id="pwaInstall"/.test(off), "sin bandera no va el cartel de instalar");
assert(!/id="pwaOffline"/.test(off), "sin bandera no va el aviso de offline");
assert(/PWA_ENABLED=false/.test(off), "la bandera de cliente refleja apagado");
new vm.Script((off.match(/<script>([\s\S]*?)<\/script>/g) || []).join("\n").replace(/<\/?script>/g, ""));

// ─── Encendido: aparece todo, sin romper nada ─────────────────────────────

const on = render(true);
assert(/<link rel="manifest" href="\/admin\/panel\/manifest.webmanifest\?pwa=1">/.test(on), "falta el manifest");
assert(/name="theme-color" content="#0A1836"/.test(on), "falta el theme-color de marca");

// iOS ignora el manifest: sin estas tres, en iPhone no hay icono, ni standalone,
// ni push. Son el prerrequisito, no un extra.
assert(/apple-mobile-web-app-capable" content="yes"/.test(on), "falta apple-mobile-web-app-capable");
assert(/apple-mobile-web-app-title" content="Nextfor"/.test(on), "falta el titulo de la app en iOS");
assert(/rel="apple-touch-icon" href="\/admin\/assets\/pwa-icon-apple-180.png"/.test(on), "falta el apple-touch-icon");

assert(/viewport-fit=cover/.test(on), "en standalone hay que cubrir el notch");
assert(/id="pwaInstall"/.test(on) && /id="pwaInstallCta"/.test(on), "falta el cartel de instalacion");
assert(/id="pwaOffline"/.test(on), "falta el aviso de sin conexion");
assert(/id="pwaUpdate"/.test(on), "falta el aviso de version nueva");
assert(/PWA_ENABLED=true/.test(on), "la bandera de cliente refleja encendido");

// El JS del cliente tiene que seguir parseando con todo lo nuevo adentro.
const clientScript = (on.match(/<script>([\s\S]*?)<\/script>/g) || [])
  .map(function (b) { return b.replace(/<\/?script>/g, ""); }).join("\n;\n");
new vm.Script(clientScript);

// No se registra un worker nuevo: se reusa el de notificaciones.
const setup = /function setupPwa\(\)[\s\S]*?\n(?=function |var )/.exec(clientScript + "\nfunction ");
assert(setup, "no encontre setupPwa");
assert(/customer-notification-sw\.js/.test(setup[0]),
  "la PWA debe reusar el service worker de notificaciones, no crear otro");
assert(/customer-notification-sw\.js\?pwa=1/.test(setup[0]),
  "el worker debe incluir el modo PWA incluso en la vista demo opt-in");
assert(!/register\("\/admin\/pwa-sw|register\("\/sw\.js/.test(clientScript),
  "no puede haber un segundo service worker: se pisaria con el de push");

// Actualizacion segura: no se auto-recarga, se espera al usuario.
assert(/registration\.waiting/.test(setup[0]) && /NEXTFOR_APPLY_UPDATE/.test(clientScript),
  "la version nueva se aplica cuando el usuario toca Actualizar, no sola");

// iOS: como no hay boton de instalar, hay que instruir el paso de Compartir.
assert(/pwaIsIos/.test(clientScript) && /Compartir/.test(clientScript),
  "en iPhone hay que guiar el 'Añadir a pantalla de inicio'");

// La prueba opt-in funciona aun con la bandera global apagada y el worker no
// conserva HTML autenticado entre sesiones o tenants del mismo dispositivo.
const serverSource = fs.readFileSync(require.resolve("./index"), "utf8");
assert(/req\.query\.pwa === "demo"/.test(serverSource), "el manifest demo debe poder servirse con la bandera global apagada");
assert(/req\.query\.pwa === "1"/.test(serverSource), "el service worker demo debe activar la cascara PWA");
assert(!/cache\.put\(request/.test(serverSource), "no se puede cachear el HTML autenticado del tenant");

console.log("customer-panel-pwa.test.js: ok");
