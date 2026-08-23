# Meta Connection Hub: mensajes fuera de ventana

## Contrato compartido

Los bots no eligen tokens, WABA, Page ID, etiquetas Meta ni nombres de
plantilla. Solicitan un caso de uso al Hub:

```json
{
  "tenant_id": "tenant-slug",
  "channel": "whatsapp",
  "source": "customer_service",
  "use_case": "customer_service_followup",
  "recipient": "573001112233",
  "parameters": {
    "customer_name": "María",
    "business_name": "Empresa",
    "case_reference": "caso 1048"
  },
  "idempotency_key": "case-1048-followup-1"
}
```

Endpoint interno: `POST /internal/meta-message-hub/send` con
`X-Nextfor-Service-Key`. El secreto es exclusivo del Hub y la llamada se
rechaza si `META_CONNECTION_HUB_SERVICE_SECRET` no está configurado.

El Customer Panel usa `POST /admin/meta-message-hub/send`. En este caso el
servidor toma el tenant de la sesión y nunca del body.

## Casos de uso iniciales

| Caso | Fuente | Mecanismo |
|---|---|---|
| `customer_service_followup` | `customer_service` | Plantilla WhatsApp Utility aprobada |
| `appointment_reminder` | `appointment` | Plantilla WhatsApp Utility aprobada; en Messenger solo `CONFIRMED_EVENT_UPDATE` para una cita confirmada |

Las plantillas compartidas usan variables de negocio, por lo que el mismo
contrato sirve para todos los WABA sin incluir nombres de tenants en código.
Cada WABA conserva su propia copia y su propio estado Meta.

## Estados y seguridad

- Antes de cada envío WhatsApp el Hub consulta `/{WABA_ID}/message_templates`.
- Solo `APPROVED` puede enviarse. `PENDING`, `REJECTED`, `PAUSED` y `DISABLED`
  fallan cerrados con un estado explícito.
- Los snapshots y recibos de entrega se guardan cifrados y filtrados por
  `tenant_id` en `conversation_logs`.
- Una `idempotency_key` es obligatoria; la combinación tenant/canal/fuente no
  puede entregar dos veces el mismo pedido.
- El runtime se obtiene únicamente de la conexión cifrada del tenant. Nunca se
  usa una credencial ambiental como respaldo para otro tenant.

## Política por canal

- WhatsApp: fuera de las 24 horas se usa una Message Template aprobada.
- Messenger: el Hub solo permite `CONFIRMED_EVENT_UPDATE` para recordatorios de
  una cita que ya fue confirmada. Otros casos se rechazan.
- Instagram: `HUMAN_AGENT` es únicamente para una persona atendiendo un asunto
  iniciado por el usuario. Los bots se rechazan fuera de ventana; no se usa esa
  etiqueta para automatización.

## Alta de un tenant

Después de conectar WhatsApp, un administrador llama
`POST /admin/meta-message-hub/templates/ensure`. El Hub primero importa todas
las plantillas existentes. Si reconoce una plantilla de recordatorio existente
y puede demostrar el orden de sus variables, la reutiliza. Solo crea el
blueprint faltante. Las plantillas nuevas se mantienen bloqueadas hasta que
Meta devuelva `APPROVED`.
