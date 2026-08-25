"use strict";

const assert = require("assert");
const vm = require("vm");
const {
  clientScript,
  customerAppointmentSnapshot,
  demoAppointmentSnapshot,
  markup,
  styles
} = require("./customer-appointments");

const demo = demoAppointmentSnapshot(new Date("2026-07-15T12:00:00-05:00"));
assert.strictEqual(demo.tenant_id, "demo-clinica-sonrie");
assert.strictEqual(demo.appointments.length, 11);
assert.strictEqual(demo.appointments.every(function (row) { return row.tenant_id === demo.tenant_id; }), true);
assert.strictEqual(demo.reminders.some(function (row) { return row.status === "confirmed"; }), true);
assert.strictEqual(demo.reminders.some(function (row) { return row.status === "no_response"; }), true);
assert.strictEqual(demo.capabilities.manage_settings, true);
assert.strictEqual(demo.settings.rules.length, 3);
assert.strictEqual(demo.settings.exceptions[0].mode, "partial");
assert.deepStrictEqual(demo.settings.booking_policy, { default_duration_minutes: 60, buffer_minutes: 15 });
assert.strictEqual(demo.settings.reminder_policy.channel, "whatsapp");
assert.strictEqual(demo.appointments.some(function (row) {
  return row.virtual_link_source === "google_meet" && row.virtual_meeting_link;
}), true);

const shaped = customerAppointmentSnapshot({
  tenant_id: "tenant-a",
  metrics: { booked: 1, pending: 1 },
  appointments: [
    { tenant_id: "tenant-a", conversation_id: "one", status: "booked", customer_name: "Ana Pérez", starts_at: "2030-07-21T14:00:00.000Z" },
    { tenant_id: "tenant-a", conversation_id: "two", status: "failed", customer_name: "Luis Díaz", starts_at: "2030-07-21T15:00:00.000Z" }
  ]
}, { id: "tenant-a", name: "Negocio A" });

assert.strictEqual(shaped.tenant_id, "tenant-a");
assert.strictEqual(shaped.appointments[0].ui_status, "confirmed");
assert.strictEqual(shaped.appointments[0].sync, "pending");
assert.strictEqual(shaped.appointments[1].ui_status, "needs_you");
assert.strictEqual(shaped.appointments.every(function (row) { return row.tenant_id === "tenant-a"; }), true);
assert.strictEqual(shaped.appointments[0].appointment_id, "one");
new vm.Script(clientScript);
assert(clientScript.includes("Conectar Meta"));
assert(clientScript.includes("Número público de citas."));
assert(clientScript.includes("Probar llamada"));
assert(clientScript.includes("No requiere extensión."));
assert(clientScript.includes("copyAppointmentCallNumber"));
assert(styles.includes("apptGatePhone"));
assert(styles.includes("auto-fit"));
assert(markup.includes('id="apptRulesView"'));
assert(markup.includes('class="apptRulesV3"'));
assert(markup.includes('id="apptExceptionMode" hidden'));
assert(markup.includes('id="apptSettingsSave"'));
assert(markup.includes('id="apptDefaultDuration"'));
assert(markup.includes('<option value="480">8 horas</option>'));
assert(markup.includes('id="apptBufferMinutes"'));
assert(markup.includes('data-appt-exception-mode="partial"'));
assert(markup.includes('class="apptExceptionModeIcon"'));
assert(markup.includes('id="apptExceptionOutsideAction"'));
assert(markup.includes('id="apptMobilePanelView"'));
assert(markup.includes('id="apptMonthView"'));
assert(markup.includes('id="apptYearView"'));
assert(markup.includes('data-appt-mode="inbox"'));
assert(markup.includes('id="apptTrayRows"'));
assert(markup.includes('id="apptDetailDrawer"'));
assert(markup.includes('id="remAttention"'));
assert(markup.includes('class="remHeroV3"'));
assert(markup.includes('id="remUpcoming"'));
assert(markup.includes('id="remSentList"'));
assert(!markup.includes('id="apptChatsView"'));
assert(clientScript.includes('/admin/panel/appointment-settings'));
assert(clientScript.includes('toggleAppointmentRule'));
assert(clientScript.includes('setAppointmentExceptionMode'));
assert(clientScript.includes('editAppointmentRule'));
assert(clientScript.includes('/admin/panel/appointment-reminders/'));
assert(clientScript.includes('customer_conversation_id'));
assert(clientScript.includes('appointmentRowsInWeek'));
assert(clientScript.includes('renderAppointmentMonth'));
assert(clientScript.includes('renderAppointmentYear'));
assert(clientScript.includes('moveAppointmentPeriod'));
assert(clientScript.includes('appointmentInboxDate'));
assert(clientScript.includes('La IA agendó '));
assert(clientScript.includes('reminderCardMarkupV3'));
assert(clientScript.includes('appointmentReminderAction(this.dataset.id,this.dataset.action)'));
assert(clientScript.includes('openAppointmentReminderConversation'));
assert(clientScript.includes('openAppointmentConversations'));
assert(clientScript.includes('reminder_policy'));
assert(clientScript.includes('booking_policy'));
assert(clientScript.includes('updateAppointmentBookingPolicy'));
assert(clientScript.includes('booking_requirements'));
assert(clientScript.includes('virtual_meeting_link'));
assert(clientScript.includes('virtual_link_source'));
assert(clientScript.includes('appointment_readiness'));
assert(clientScript.includes('/virtual-link'));
assert(clientScript.includes('Reemplazar enlace'));
assert(clientScript.includes('/admin/panel/appointments-data'));
assert(clientScript.includes('<textarea id="apptMeetingUrlInput"'));
assert(clientScript.includes('name="appointment_meeting_link_text"'));
assert(clientScript.includes('autocomplete="off"'));
assert(clientScript.includes('aria-autocomplete="none"'));
assert(clientScript.includes('data-form-type="other"'));
assert(!clientScript.includes('calendar_event_link'));
assert(styles.includes('apptMeetingCard'));
assert(styles.includes('.apptMeetingEditor textarea'));
assert(styles.includes('position:fixed;right:0;bottom:0;width:min(620px,100vw)'));
assert(styles.includes('.apptMobileAgendaV454'));
assert(styles.includes('.apptMobilePanelV455'));
assert(styles.includes('@media(max-width:760px)'));
assert(styles.includes('grid-template-columns:repeat(7,minmax(0,1fr))'));
assert(styles.includes('.amSheet'));
assert(markup.includes('id="apptMobileAgendaV454"'));
assert(markup.includes('id="apptMobilePanelV455"'));
assert(markup.includes('id="amPanelNext"'));
assert(markup.includes('id="amPanelReminderSummary"'));
assert(markup.includes('data-am-mode="list"'));
assert(markup.includes('data-am-mode="week"'));
assert(markup.includes('data-am-mode="month"'));
assert(markup.includes('id="amAppointmentSheet"'));
assert(clientScript.includes('appointmentMobileWeekV454'));
assert(clientScript.includes('appointmentMobileMonthV454'));
assert(clientScript.includes('renderAppointmentMobilePanelV455'));
assert(clientScript.includes('openAppointmentMobilePanelAgendaV455'));
assert(clientScript.includes('openAppointmentMobileDateV454'));
assert(clientScript.includes('name="appointment_meeting_link_text"'));
assert(clientScript.includes('aria-autocomplete="none"'));
assert(clientScript.includes('/admin/panel/appointments/'));
assert(clientScript.includes('/admin/panel/appointment-reminders/'));
assert(!markup.includes('id="apptRequirementList"'));
assert(!markup.includes('Datos para confirmar la cita'));

console.log("customer appointment panel tests: ok");
