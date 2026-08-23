# Alta de clientes de agendamiento en Nextfor IA

## Regla comercial

- Grupo Jurídico DERCO S.A.S. es el cliente registrado #1 de Nextfor IA.
- RAV Toys se conserva como entorno legado/demostración y no ocupa un número del nuevo registro.
- Cada cliente recibe un `tenant_id`, usuarios propios, agente de ElevenLabs derivado de la plantilla y una integración de calendario independiente.
- El setup de Appointment debe seguir las lecciones del primer setup de Atención al Cliente: ver `docs/setup-lessons-customer-service-to-appointments.md`.

## Qué pasa con un cliente nuevo

1. Nextfor crea el tenant y asigna el siguiente número de cliente.
2. Se duplica la plantilla de ElevenLabs; nunca se modifica el agente base.
3. Se reemplazan identidad, voz, prompt, horarios y políticas.
4. El cliente conecta su propio calendario y canales.
5. Nextfor registra el `agent_id` contra el `tenant_id`.
6. Se prueba disponibilidad y creación en un calendario de pruebas.
7. El cliente recibe acceso únicamente a su panel.
8. Después de aprobación se activan llamadas, recordatorios y operación real.

## Flujo operativo de citas

1. Cliente llama, escribe o entra desde un canal conectado.
2. El bot conversa, valida intención y recoge datos mínimos.
3. El bot consulta disponibilidad según las reglas del cliente.
4. El bot agenda, solicita confirmación o deja la cita pendiente.
5. ElevenLabs envía el evento post-call a Nextfor.
6. Nextfor guarda la cita y la muestra en el panel del cliente.
7. El bot confirma la cita 24 horas antes y luego 6 horas antes, si el cliente activó esos recordatorios.
8. Si el usuario Nextfor modifica la agenda, el bot detecta las citas afectadas y busca reprogramarlas con el cliente, ofreciendo disculpas y nuevas opciones.

## Panel del cliente y futura consolidación

- El módulo vive en `/admin/panel?tab=appointments` y mantiene separadas las métricas de Atención al cliente.
- `GET /admin/panel/appointments-data` entrega una vista segura y aislada por `tenant_id`; no incluye tokens ni credenciales del proveedor de calendario.
- `POST /admin/panel/appointments/action` permite al usuario admin confirmar, cancelar o solicitar reprogramación de citas de su propio `tenant_id`; actualiza la fuente real (`AppointmentRegistry` y Supabase si está activo) y deja auditoría cifrada en el payload.
- La respuesta del panel incluye `integrations`, el semáforo real del bot de citas: ElevenLabs, calendario, WhatsApp, correo, llamadas, Supabase y bloqueadores antes de live.
- En Customer Panel, el cliente puede iniciar Google Calendar, Microsoft Outlook o Samsung Calendar y WhatsApp/Meta desde los conectores existentes. Samsung Calendar se conecta mediante la misma cuenta de Google u Outlook que el cliente ya sincroniza en su dispositivo; Nextfor no guarda una contraseña de Samsung ni duplica eventos. Las llamadas se muestran como solicitadas/pendientes cuando aplican, pero la asignación real del número ElevenLabs la ejecuta Nextfor desde Super Admin.
- Citas, conversaciones de agendamiento y recordatorios comparten el identificador de cita para reflejar confirmaciones y handoffs en una sola fuente de verdad.
- Super Admin ve el mismo gate en `GET /admin/customer-setups/:tenantId` como `appointment_integrations`, y la flota de agendamiento en `GET /admin/appointments-overview`; la pantalla global no debe leer el HTML del panel ni reconstruir métricas desde la interfaz.
- Las acciones del demo mutan únicamente el estado local de la vista. En Customer Panel real, confirmar/cancelar/reprogramar persiste en backend; el envío outbound y la sincronización Google Calendar deben mostrarse como pendientes hasta que el proveedor confirme la ejecución.

## Información necesaria del cliente

### Negocio y bot

- Razón social, marca, NIT y responsable operativo.
- Nombre del asistente, voz, idioma y tono.
- Canales que usará: teléfono, WhatsApp, web u otros.
- Horarios de atención humana y contactos de escalamiento.

### Agenda

- Proveedor: Google Calendar, Microsoft Outlook o Samsung Calendar (sincronizado mediante Google u Outlook).
- Cuenta y calendario autorizado.
- Zona horaria.
- Días y franjas disponibles.
- Duración por tipo de cita, descansos y capacidad simultánea.
- Anticipación mínima y máxima para reservar.
- Servicios que pueden agendarse.
- Modalidad: virtual, presencial o ambas; sedes y enlaces.
- Reglas para confirmar, reagendar, cancelar y no-show.
- Recordatorios configurables: activar/desactivar, 24 horas antes, 6 horas antes, canal y texto aprobado.
- Reprogramación por cambios internos: bloqueos de agenda, vacaciones, eventos, viajes, incapacidades y mensaje de disculpa aprobado.

### Datos y cumplimiento

- Texto de autorización de grabación y tratamiento de datos.
- Política de privacidad y tiempo de retención.
- Campos obligatorios: nombre, teléfono, correo, ciudad y motivo.
- Datos que el bot no debe solicitar.
- Casos que requieren intervención humana.

### Medición

- Cita solicitada, confirmada, reagendada, cancelada y fallida.
- Asistencia/no-show cuando el calendario o el equipo lo informe.
- Tiempo de respuesta y porcentaje de citas completadas por el bot.

## Piloto DERCO

- `tenant_id`: `grupo-derco`
- Número de cliente: `1`
- Estado: `pilot`
- Proveedor inicial: Google Calendar
- Zona horaria: `America/Bogota`
- Panel: `/admin/pilots/derco`
- Datos: `/admin/pilots/derco/data`
- Webhook de ElevenLabs: `/webhooks/elevenlabs/post-call`

## Activación técnica

1. Aplicar `docs/supabase-appointments-pilot.sql`.
2. Para piloto controlado, mantener `APPOINTMENT_SETUP_ENABLED=0` y configurar `APPOINTMENT_SETUP_TENANT_IDS=grupo-derco`. Usar `APPOINTMENT_SETUP_ENABLED=1` únicamente cuando Appointment vaya a quedar disponible para todos los clientes.
3. Configurar `ELEVENLABS_WEBHOOK_SECRET`.
4. Configurar `ELEVENLABS_DERCO_AGENT_ID` con el agente real de DERCO.
5. Configurar `ELEVENLABS_AGENT_TENANT_MAP` si hay más agentes reales.
6. Si el cliente pidió llamadas, configurar `ELEVENLABS_DERCO_PHONE_NUMBER_ID` o `ELEVENLABS_PHONE_NUMBER_TENANT_MAP` con el `phone_number_id` importado en ElevenLabs.
7. Mantener `ELEVENLABS_APPOINTMENT_AGENT_WRITE_ENABLED=0` hasta confirmar que los mapas `agent_id -> tenant_id`, `phone_number_id -> tenant_id` y el webhook son correctos.
   Para clientes nuevos, configurar `ELEVENLABS_APPOINTMENT_TEMPLATE_AGENT_ID` con la plantilla de Appointment y `ELEVENLABS_APPOINTMENT_TOOL_SECRET` con un secreto de 32+ caracteres. Nextfor lee voz/turnos de la plantilla, elimina herramientas y bases de conocimiento del cliente anterior, crea herramientas de calendario aisladas por tenant y genera un agente nuevo; no modifica la plantilla.
8. Cuando Appointment esté aprobado para Testing, activar `ELEVENLABS_APPOINTMENT_AGENT_WRITE_ENABLED=1` y usar Super Admin → `Configurar agente real`. Esta acción aplica el prompt al agente y, si el cliente pidió llamadas, asigna el `phone_number_id` al agente con la API de ElevenLabs.
9. Configurar `GOOGLE_CALENDAR_CLIENT_ID` y `GOOGLE_CALENDAR_CLIENT_SECRET`.
10. En Google Cloud, agregar redirect URI: `https://nextforia.com/admin/appointment-calendar/google/callback`.
11. Conectar Google Calendar, Microsoft Outlook o Samsung Calendar desde Customer Panel. Para Samsung, elegir la cuenta de Google u Outlook que ya está sincronizada en la app Samsung Calendar. `APPOINTMENT_CALENDAR_TENANT_MAP` queda solo como fallback temporal operativo.
12. Activar `SUPABASE_APPOINTMENTS_ENABLED=1`.
13. Crear un usuario DERCO en `DASHBOARD_USERS` con `tenant_id: "grupo-derco"`.
14. Conectar WhatsApp desde el panel de canales del cliente usando el flujo de Meta existente.
15. En Cloudflare, crear/verificar `api.nextforia.com` apuntando al servicio Render `nextforia-chatbot` y validar que `POST https://api.nextforia.com/webhooks/elevenlabs/post-call` responda `401` sin firma. Ese `401` confirma que el endpoint existe y está protegido.
16. En ElevenLabs, apuntar el post-call webhook a `https://api.nextforia.com/webhooks/elevenlabs/post-call`.
17. Ejecutar una llamada o conversación de prueba y confirmar que la cita aparezca en el panel.
18. Revisar `appointment_readiness` en `/admin/health`; solo activar `APPOINTMENTS_PUBLIC_ENABLED=1` cuando `production_can_be_enabled=true` y Super Admin apruebe.

Verificación operativa repetible:

```bash
BOT_BASE_URL=https://nextforia.com \
DASHBOARD_KEY=... \
EXPECTED_BOT_VERSION=v250-meta-whatsapp-cloud-registration \
pnpm verify:appointments --require-dashboard-key
```

Si `api.nextforia.com` todavía no resuelve, el mismo verifier debe fallar. Como diagnóstico aislado del backend, se puede probar temporalmente el origin directo:

```bash
BOT_BASE_URL=https://api.nextforia.com \
APPOINTMENT_API_HOST=api.nextforia.com \
ELEVENLABS_WEBHOOK_URL=https://api.nextforia.com/webhooks/elevenlabs/post-call \
pnpm verify:appointments
```

Ese origin solo sirve para comprobar que Render/Express responden; para piloto live debe quedar el dominio `api.nextforia.com`.

Para la aprobación final pública, ejecutar el mismo comando con `APPOINTMENT_VERIFY_REQUIRE_PUBLIC=1` después de activar `APPOINTMENTS_PUBLIC_ENABLED=1`.

Ejemplo de usuario aislado por tenant:

```json
[
  {
    "username": "admin-derco",
    "email": "administracion@cliente.example",
    "password": "GENERAR_CLAVE_SEGURA",
    "name": "Administrador DERCO",
    "role": "admin",
    "tenant_id": "grupo-derco"
  }
]
```
