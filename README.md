# NextforIA Chatbot

Security requirements, key rotation, automated checks, and incident response are documented in [`SECURITY.md`](SECURITY.md).

Plataforma multi-tenant de NextforIA para atención al cliente y agendamiento por WhatsApp, Instagram y Facebook Messenger. RAV Toys es el primer tenant productivo y conserva su personalidad, catálogo y reglas comerciales dentro de su configuración aislada.

---

## 🎯 Qué hace

- 🔍 **Búsqueda de productos** en Shopify storefront — devuelve los mismos resultados que ve el cliente en la web
- 🛒 **Carrito y cierre de venta** — el cliente pega links de productos y el bot toma el pedido
- ✨ **Recomendaciones inteligentes** — 3 opciones + link al catálogo filtrado por la búsqueda del cliente
- 🛡️ **Garantías** — flujo guiado con factura, cédula, fecha, motivo + handoff a humano
- 🚚 **Envíos** — info de transportadoras + same-day para Medellín con handoff opcional
- 📦 **Estado de pedidos** — consulta Shopify Admin por número de pedido + nombre y devuelve guía/rastreo si coincide
- **Presupuesto adaptativo de IA** — amplía respuesta e historial cuando detecta intención comercial fuerte, checkout activo o un cliente recurrente
- **Memoria comercial persistente** — recuerda nombre preferido, productos de interés, etapa de compra y pedidos verificados sin guardar datos sensibles del checkout
- ⭐ **Calificaciones** — pide rating 1-5 al cierre o post-handoff; rating bajo escala a humano
- 🤝 **Handoff a humano** — Eliana (asesora comercial) recibe alertas en su WhatsApp
- **Entradas multimodales** — entiende notas de voz e imágenes en WhatsApp y las integra a la conversación normal del bot

---

## 🏗️ Stack

- **Runtime:** Node.js en [Render](https://render.com) (free tier — duerme tras 15 min sin tráfico, ~50s spin-up)
- **Webhook:** Meta WhatsApp Business Cloud API
- **IA:** Anthropic Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)
- **Catálogo:** Shopify storefront search JSON endpoint (`ravtoys.com/search?q=X&view=json`)
- **Memoria:** Supabase para logs y memoria comercial persistente + Maps en memoria para carritos/estado activo

---

## ⚙️ Variables de entorno (Render)

| Variable | Descripción |
|---|---|
| `DEFAULT_TENANT_ID` | Identificador interno del comercio; `rav-toys` se mantiene como valor inicial |
| `TENANT_BRAND_NAME` | Nombre visible del comercio en el panel |
| `TENANT_CUSTOMER_NUMBER` | Número interno consecutivo del cliente |
| `TENANT_STATUS` | Estado operativo del tenant, por ejemplo `active` o `pilot` |
| `TENANT_SERVICE_COUNTRY_CODE` | Código ISO de dos letras del país atendido; `CO` por defecto |
| `TENANT_SERVICE_COUNTRY_NAME` | Nombre que el bot usa al confirmar ubicación; `Colombia` por defecto |
| `TENANT_FOREIGN_NUMBER_CHECK_ENABLED` | Confirma el país atendido cuando un número extranjero aún no tiene respuesta; usa `0` para desactivar |
| `WA_TOKEN` | Token permanente de Meta WhatsApp |
| `PHONE_NUMBER_ID` | ID del número WhatsApp registrado en Meta |
| `TENANT_DISPLAY_PHONE` | Número visible que debe quedar conectado al tenant; RAV usa `+57 301 587 2708` |
| `META_APP_REVIEW_STATUS` | Estado público de App Review para el panel; RAV está en `approved` |
| `META_APP_REVIEW_APPROVED_AT` | Fecha de aprobación mostrada por la integración, sin consultar secretos |
| `WA_LIVE_ENABLED` | Gate explícito del número real; mantener `0` hasta completar verificación y prueba end-to-end |
| `VERIFY_TOKEN` | Token aleatorio de verificación del webhook (requerido en producción, mínimo 24 caracteres) |
| `IG_ACCESS_TOKEN` | Token del Instagram Professional account autorizado en Meta |
| `IG_USER_ID` | ID del Instagram Professional account que enviará respuestas |
| `IG_SEND_ID` | ID usado en `/messages`; usa `IG_USER_ID` por defecto. Con Facebook Login, usa el ID de la página vinculada |
| `IG_GRAPH_BASE_URL` | Host de Graph API. Usa `https://graph.instagram.com` por defecto o `https://graph.facebook.com` con Facebook Login |
| `IG_VERIFY_TOKEN` | Token para verificar `/instagram/webhook`; usa `VERIFY_TOKEN` si se omite |
| `MESSENGER_PAGE_ACCESS_TOKEN` | Page Access Token de la Página de Facebook conectada a Messenger |
| `MESSENGER_PAGE_ID` | ID de la Página de Facebook que enviará las respuestas |
| `MESSENGER_VERIFY_TOKEN` | Token para verificar `/messenger/webhook`; usa `VERIFY_TOKEN` si se omite |
| `META_APP_SECRET` | App Secret de Meta para validar la firma `X-Hub-Signature-256` de WhatsApp, Instagram y Messenger |
| `META_APP_ID` | App ID usada por los flujos oficiales de autorización Meta del Customer Panel |
| `META_CONNECTION_HUB_SERVICE_SECRET` | Secreto exclusivo para que otros bots Nextfor soliciten mensajes permitidos al Meta Connection Hub; no reutiliza credenciales de panel ni tokens Meta |
| `META_WHATSAPP_CONFIG_ID` | Configuration ID de WhatsApp Embedded Signup creado para NextforIA |
| `META_WHATSAPP_COEXISTENCE_CONFIG_ID` | Configuration ID de Embedded Signup con coexistencia para conservar WhatsApp Business App; usa `META_WHATSAPP_CONFIG_ID` si se omite |
| `MESSENGER_APP_SECRET` | Alias heredado de `META_APP_SECRET` |
| `MESSENGER_GRAPH_BASE_URL` | Host de Graph API para Messenger (default: `https://graph.facebook.com`) |
| `META_GRAPH_VERSION` | Versión de Graph API para WhatsApp, Instagram y Messenger (default: `v26.0`) |
| `ANTHROPIC_API_KEY` | API key de Anthropic (Claude) |
| `OPENAI_API_KEY` | API key usada por el agente multimodal cuando se activan voz o imagen |
| `OPENAI_TRANSCRIPTION_MODEL` | Modelo de transcripción multimodal (default: `gpt-4o-mini-transcribe`) |
| `OPENAI_VISION_MODEL` | Modelo de análisis de imágenes (default: `gpt-4.1-mini`) |
| `MULTIMODAL_AGENT_ENABLED` | Gate maestro del agente de audio/imagen |
| `MULTIMODAL_AGENT_TENANT_IDS` | Alcance de la función multimodal; usa `*` para todos los bots Nextfor o una lista CSV para una activación limitada |
| `MULTIMODAL_VOICE_INPUT_ENABLED` | Permite transcribir notas de voz de WhatsApp y pasarlas al bot como texto controlado |
| `MULTIMODAL_IMAGE_INPUT_ENABLED` | Permite analizar imágenes de WhatsApp y pasar hallazgos al bot |
| `MULTIMODAL_VOICE_REPLIES_ENABLED` | Reservado para respuestas de voz con ElevenLabs; mantener `0` hasta validar envío de audio |
| `VOICE_RESPONSES_ENABLED` | Activa respuestas de voz compartidas para todos los bots; usa la conexión Meta aislada de cada tenant |
| `VOICE_RESPONSE_PROVIDER` | Proveedor de TTS compartido; actualmente `openai` |
| `OPENAI_TTS_MODEL` / `OPENAI_TTS_VOICE` | Modelo y voz base de TTS; se entrega como OGG/Opus reproducible en WhatsApp |
| `VOICE_RESPONSE_MAX_CHARS` | Máximo de texto que se transforma a voz por respuesta (default: `2400`) |
| `AI_STANDARD_MAX_TOKENS` | Máximo de salida para conversaciones normales (default: `1000`) |
| `AI_STANDARD_HISTORY_MESSAGES` | Historial usado en conversaciones normales (default: `8`) |
| `AI_ENGAGED_MAX_TOKENS` | Máximo de salida para consultas comerciales (default: `1400`) |
| `AI_ENGAGED_HISTORY_MESSAGES` | Historial usado en consultas comerciales (default: `12`) |
| `AI_HIGH_INTENT_MAX_TOKENS` | Máximo de salida para intención alta, checkout o cliente recurrente (default: `1800`) |
| `AI_HIGH_INTENT_HISTORY_MESSAGES` | Historial usado en intención alta (default: `18`) |
| `CUSTOMER_MEMORY_CACHE_TTL_MS` | Duración del caché local de memoria antes de releer Supabase (default: `300000`) |
| `CONVERSATION_SESSION_TIMEOUT_MS` | Inactividad necesaria para iniciar una sesión nueva y permitir un saludo personalizado (default: `21600000`, 6 horas) |
| `SHOPIFY_STORE_DOMAIN` | Dominio Shopify; requerido si se configura `SHOPIFY_ADMIN_TOKEN` |
| `SHOPIFY_STOREFRONT_DOMAIN` | Dominio público HTTPS usado para búsquedas y enlaces de producto; usa `SHOPIFY_STORE_DOMAIN` si se omite |
| `SHOPIFY_ADMIN_TOKEN` | Token Admin de Shopify (`shpat_...`) con permisos para leer pedidos y fulfillments |
| `SHOPIFY_ADMIN_API_VERSION` | Versión Admin API para pedidos (default: `2026-04`) |
| `SHOPIFY_ORDER_PREFIXES` | Prefijos de pedidos separados por coma para validar entradas cortas como `1154` contra `RAV-1154` |
| `SUPABASE_URL` | URL del proyecto Supabase para logs persistentes |
| `SUPABASE_KEY` | Service key de Supabase para `conversation_logs` |
| `DATA_ENCRYPTION_KEY` | Clave independiente de 32 bytes en base64url; cifra cuerpos de conversación y registros internos antes de Supabase |
| `SUPABASE_TENANT_COLUMNS_ENABLED` | Debe ser `1` fuera de desarrollo; producción fuerza escritura y filtrado por `tenant_id` para evitar mezclar clientes |
| `CUSTOMER_ACCESS_V2_ENABLED` | Gate del alta multi-cliente; debe permanecer `0` en producción hasta aprobación explícita |
| `CHANNEL_CONNECTIONS_V1_ENABLED` | Gate de la pantalla simple de conexiones: WhatsApp primero, Instagram opcional; solo Staging hasta aprobación explícita |
| `PWA_V1_ENABLED` | Habilita manifest, instalación y modo standalone del Customer Panel; con `0` el panel normal no ofrece la PWA |
| `CHANNEL_CONNECTIONS_DEDICATED_STORE_ENABLED` | Habilita el almacén Supabase atómico exigido por WhatsApp; solo usar tras la migración v2, drenado del fleet anterior y preflight de propietarios |
| `CUSTOMER_PANEL_BASE_URL` | Origen HTTPS de Staging usado únicamente dentro del correo de invitación |
| `CUSTOMER_INVITE_TTL_HOURS` | Vigencia de la invitación privada (default `24`, máximo `168`) |
| `CUSTOMER_ACCESS_EMAIL_PROVIDER` | Proveedor del correo de invitación; v2 requiere `resend` fuera de tests |
| `CUSTOMER_INVITE_REPLY_TO` | Dirección de respuesta; por defecto `info@nextforia.com` |
| `RESEND_API_KEY` | API key exclusiva de Staging para entregar invitaciones; nunca se registra ni se devuelve |
| `SETUP_EMAIL_JOURNEY_ENABLED` | Activa los cinco correos del setup después de aplicar `20260815_setup_email_journey_up.sql` |
| `SETUP_EMAIL_INCOMPLETE_DELAY_MINUTES` | Espera antes de recordar un entrenamiento incompleto (default `120`) |
| `SETUP_EMAIL_PAYMENT_DELAY_MINUTES` | Espera antes de recordar un pago pendiente (default `120`) |
| `CUSTOMER_NOTIFICATION_EMAIL_ENABLED` | Permite que cada usuario active desde Customer Panel sus correos operativos; exige Customer Access v2, Supabase, Resend y la migración `20260820_customer_notification_emails_up.sql` |
| `CUSTOMER_ALL_PLANS_ENABLED` | Expone Uno, Aura, Tempo y Atlas en el setup de clientes; activo por defecto, `0` sirve como rollback |
| `APPOINTMENT_SETUP_ENABLED` | Gate heredado para pilotos de Appointment cuando `CUSTOMER_ALL_PLANS_ENABLED=0` |
| `ELEVENLABS_WEBHOOK_SECRET` | Secreto HMAC del webhook post-conversación de ElevenLabs |
| `ELEVENLABS_DERCO_AGENT_ID` | ID del agente de DERCO; lo vincula al tenant `grupo-derco` |
| `ELEVENLABS_AGENT_TENANT_MAP` | Mapa JSON opcional `agent_id -> tenant_id` para más clientes |
| `ELEVENLABS_DERCO_PHONE_NUMBER_ID` | ID del número importado en ElevenLabs para llamadas DERCO |
| `ELEVENLABS_PHONE_NUMBER_TENANT_MAP` | Mapa JSON opcional `phone_number_id -> tenant_id` para llamadas reales por cliente |
| `ELEVENLABS_APPOINTMENT_AGENT_WRITE_ENABLED` | Permite que Super Admin aplique el prompt aprobado al agente real de ElevenLabs; dejar en `0` hasta validar mapa/webhook |
| `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET` | OAuth de Google Calendar para que el cliente conecte su calendario desde el panel |
| `APPOINTMENT_CALENDAR_TENANT_MAP` | Mapa temporal por tenant con calendario conectado hasta guardar OAuth por cliente |
| `SUPABASE_APPOINTMENTS_ENABLED` | Activa persistencia de citas después de aplicar la migración correspondiente |
| `DASHBOARD_KEY` | Clave maestra aleatoria (mínimo 32 caracteres); los clientes automatizados la envían solo en `X-Dashboard-Key` |
| `DASHBOARD_USERS` | Usuarios del panel en CSV o JSON; el JSON puede incluir `email` como identificador alternativo de acceso |
| `DASHBOARD_SESSION_SECRET` | Secreto independiente para firmar cookies del panel (mínimo 32 caracteres) |
| `DASHBOARD_SESSION_TTL_HOURS` | Duración de sesión del panel (default: `8`, máximo: `24`) |
| `NOTIFICATION_PHONES` | Números autorizados a notificar (CSV sin `+`); no tiene destinatario por defecto |

---

## 📡 Endpoints admin

| Endpoint | Para qué |
|---|---|
| `GET /admin` | Entrada genérica Nextfor IA para RAV Toys y futuros clientes |
| `POST /admin/login` | Crea sesión del dashboard por usuario/clave o clave maestra |
| `POST /admin/logout` | Cierra la sesión del dashboard |
| `GET /admin/session` | Devuelve usuario/rol activo del dashboard |
| `GET /admin/super-admin/login` | Entrada independiente de plataforma por correo/usuario; incluye recuperación mediante la clave maestra de Render |
| `POST /admin/customer-invite` | Super admin: crea tenant, membresía admin pendiente y envía la invitación privada |
| `GET /admin/customer-access/catalogs` | Super admin: catálogos activos de planes y bots para el alta |
| `GET /admin/customer-invitations` | Super admin: estados de entrega, vencimiento, uso y revocación sin tokens |
| `POST /admin/customer-invitations/:id/revoke` | Super admin: revoca una invitación no consumida |
| `GET/POST /admin/setup/:tenantId` | Validación y consumo atómico de la invitación; el cliente crea su contraseña sin username |
| `GET /admin/access-model` | Modelo futuro de acceso: `super_admin` NexforIA y roles Admin del cliente |
| `GET /admin/super-admin` | Panel de plataforma NexforIA; acceso exclusivo para `super_admin` |
| `GET /admin/super-admin/login` | Entrada interna y separada para usuarios Super Admin de NexforIA |
| `GET /admin/super-admin/signature` | Consola Nextfor Signature: enlaces únicos, respuestas en vivo, resúmenes y editor del formulario |
| `GET /admin/signature/client/:token` | Diagnóstico privado y reutilizable de un prospecto; autoguarda y permite continuar después |
| `GET /admin/integrations/rav/test` | Super admin: prueba segura de la integración #1 sin enviar mensajes reales |
| `GET /admin/health` | Estado mínimo público; con sesión o `X-Dashboard-Key` incluye Shopify/Meta/Supabase y readiness |
| `GET /admin/stats` | Snapshot protegido del estado: handoffs activos, ratings pendientes, carritos en curso |
| `GET /admin/conversations?limit=N` | Conversaciones recientes protegidas desde Supabase si está disponible |
| `GET /admin/dashboard` | Panel operativo con tabs para métricas e intervención humana |
| `GET /admin/panel?tab=summary` | Panel de control del cliente con KPIs y conversaciones unificados para WhatsApp, Instagram y Messenger |
| `GET /admin/panel-demo?tab=summary` | Demo pública de solo lectura con datos sanitizados de los canales conectados |
| `GET /admin/client-onboarding` | Formulario protegido para recopilar y revisar el alta inicial del comercio |
| `GET/PUT /admin/client-onboarding/data` | Consulta o guarda el avance del onboarding por tenant |
| `GET /admin/client-onboarding-demo` | Vista previa segura del recorrido de onboarding sin guardar datos reales |
| `GET /admin/panel/data` | Datos protegidos del panel, con resúmenes por canal y conversaciones identificadas como WhatsApp, Instagram o Messenger |
| `GET /admin/inbox` | Acceso directo opcional a la bandeja operativa |
| `GET /admin/customer-meta` | Etiquetas y notas internas por cliente para el panel |
| `POST /admin/customer-meta/:userId` | Guarda etiquetas/notas internas del cliente seleccionado |
| `GET /admin/templates` | Lista protegida de plantillas WhatsApp configuradas localmente |
| `GET /admin/commercial-readiness` | Checklist comercial/multi-cliente protegido |
| `POST /admin/template-test` | Genera payload de plantilla o envia con `send: true` si ya fue aprobada |
| `GET /admin/meta-message-hub/templates` | Sincroniza y muestra al tenant autenticado los estados reales de sus plantillas WhatsApp |
| `POST /admin/meta-message-hub/templates/ensure` | Crea para el WABA del tenant las plantillas compartidas faltantes; quedan pendientes hasta la aprobación de Meta |
| `POST /admin/meta-message-hub/send` | Solicita desde el Customer Panel un envío permitido fuera de ventana, sin aceptar un `tenant_id` aportado por el cliente |
| `POST /internal/meta-message-hub/send` | Contrato server-to-server para Customer Service, Appointment y Core Platform con secreto dedicado e idempotencia obligatoria |
| `POST /admin/smoke-check` | Simula búsqueda, selección, checkout y total sin enviar WhatsApps |
| `POST /admin/order-status-test` | Prueba consulta de pedido Shopify con `order_number`, `customer_name`, `phone_or_email` opcional |
| `POST /admin/alert` | Envía alerta interna protegida por `DASHBOARD_KEY` |
| `GET /admin/test-search?q=XXXX` | Prueba protegida de búsqueda sin afectar a clientes reales |
| `POST /admin/release/:userId` | Libera un handoff manual (vuelve el bot a atender) y marca para pedir rating |
| `GET /admin/pilots/derco` | Panel aislado del cliente #1 para revisar citas del piloto DERCO |
| `GET /admin/pilots/derco/data` | Datos y métricas de citas, limitados al tenant DERCO |
| `POST /webhooks/elevenlabs/post-call` | Recibe eventos firmados de ElevenLabs y sincroniza citas con Nextfor |

### Webhook de Instagram

Configura en Meta el callback `https://TU-DOMINIO/instagram/webhook` con el valor de
`IG_VERIFY_TOKEN` y suscribe el campo de mensajes. El endpoint acepta eventos de texto y
archivos del objeto `instagram`; las conversaciones quedan identificadas como `ig:<IGSID>`
en el panel para evitar mezclarlas con números de WhatsApp.

Para desarrollo, agrega la cuenta profesional y las cuentas que harán pruebas como roles
de la app. Para atender cuentas externas, solicita acceso avanzado a
`instagram_business_manage_messages` mediante Meta App Review.

El Panel de Control muestra un solo módulo de **Atención al cliente**. Sus KPIs,
conversaciones y casos que necesitan al equipo combinan WhatsApp, Instagram y Messenger; cada chat
conserva una identificación visual clara de su canal. El panel nunca expone tokens ni IDs
internos de configuración.
La bandeja está preparada para crecer a correo: el canal aparece como un
distintivo sobre el avatar y la cabecera comunica que todo llega a una sola bandeja. La UI
mantiene únicamente tres estados: **Necesita de ti**, **La IA está atendiendo** y
**Resuelta por la IA**.
Cuando un usuario escribe por Instagram, el bot consulta y guarda su `@username` con la
API oficial de perfiles. El panel muestra ese usuario y permite buscarlo; si Meta no lo
entrega, conserva como respaldo el identificador abreviado de la conversación.

### Webhook de Facebook Messenger

1. En Meta for Developers, agrega Messenger a la misma app y conecta la Página de Facebook.
2. Genera el Page Access Token y configura `MESSENGER_PAGE_ACCESS_TOKEN` y `MESSENGER_PAGE_ID` en Render.
3. Registra `https://TU-DOMINIO/messenger/webhook` como callback y usa `MESSENGER_VERIFY_TOKEN` como token de verificación.
4. Suscribe la Página, como mínimo, a los campos `messages` y `messaging_postbacks`.
5. Configura también `MESSENGER_APP_SECRET` para rechazar eventos que no estén firmados por Meta.
6. Prueba desde una cuenta con rol en la app. Para atender al público, solicita los permisos requeridos por Meta (`pages_messaging`, `pages_manage_metadata` y `pages_read_engagement`) y completa App Review cuando aplique.

Los usuarios de Messenger quedan identificados internamente como `ms:<PSID>`. El prefijo
evita mezclar sus conversaciones con números de WhatsApp o IDs de Instagram. Texto,
imágenes, handoff humano, notas, métricas e historial usan la misma bandeja omnicanal.
Las respuestas normales usan `messaging_type: RESPONSE` y deben respetar la ventana estándar
de mensajería de 24 horas de Messenger; fuera de ella Meta exige una modalidad permitida.

La bandeja traduce la operación a tres estados visibles: **Necesita de ti**, **La IA está
atendiendo** y **Resuelta por la IA**. Cuando el dueño hace falta, la IA deja una respuesta
editable lista para **Confirmar y enviar**. La evolución de personalización está definida en
[`docs/customer-memory-roadmap.md`](docs/customer-memory-roadmap.md).

La primera fase de memoria comercial está activa desde `v72`: una consulta general usa el
presupuesto estándar, una consulta de precio o disponibilidad usa el nivel interesado y
una intención explícita de compra, un checkout activo o un cliente recurrente usa el nivel
alto. El panel muestra prioridad, intereses y condición recurrente cuando existen. La
memoria solo se crea con una señal comercial fuerte o un hito de compra; no conserva
cédula, dirección, teléfono de checkout ni método de pago.

### Alta privada de clientes

RAV Toys sigue siendo el tenant legado default `rav-toys`. Con
`CUSTOMER_ACCESS_V2_ENABLED=1` únicamente en Staging, el Super Admin usa **Crear cliente**
e ingresa empresa, correo administrador, plan y bot. El servidor crea tenant y membresía
pendiente en una transacción, guarda solo el hash de un token aleatorio y envía el enlace
exclusivamente al correo indicado. El cliente no elige username ni se registra públicamente:
acepta la invitación y define una contraseña que se almacena con `scrypt` y salt. El gate
apagado conserva sin cambios el flujo legado de producción.

Contrato compartido: [`docs/customer-access-contract.md`](docs/customer-access-contract.md).
Activación y rollback de Staging: [`docs/staging-customer-access-v2.md`](docs/staging-customer-access-v2.md).

**Uso típico antes de un cambio:** abrir `/admin/health` para ver que todo está OK, después `/admin/test-search?q=carros+montables` para verificar búsquedas.

---

## 🧭 Operación y próximos pasos

- Plantillas WhatsApp iniciales: [`docs/whatsapp-templates.md`](docs/whatsapp-templates.md)
- Playbook comercial para asesoras: [`docs/commercial-playbook.md`](docs/commercial-playbook.md)
- Onboarding comercial para futuros clientes: [`docs/commercial-onboarding.md`](docs/commercial-onboarding.md)
- Setup operativo de clientes piloto: [`docs/pilot-client-setup.md`](docs/pilot-client-setup.md)
- Roadmap multi-cliente: [`docs/multi-tenant-roadmap.md`](docs/multi-tenant-roadmap.md)
- División Admin/Super admin: [`docs/admin-super-admin-split.md`](docs/admin-super-admin-split.md)
- Política de retargeting: [`docs/retargeting-policy.md`](docs/retargeting-policy.md)
- Operación segura del worker: [`docs/retargeting-operations.md`](docs/retargeting-operations.md)
- Prompt para NextforIA Configuration: [`docs/nextforia-retargeting-configuration-prompt.md`](docs/nextforia-retargeting-configuration-prompt.md)
- Informe ejecutivo para socios: [`docs/informe-socios-rav-whatsapp-bot.md`](docs/informe-socios-rav-whatsapp-bot.md)
- Backlog priorizado: [`TODO.md`](TODO.md)

---

## 🛡️ Red de seguridad y monitoreo

Los scripts usan por defecto producción (`https://api.nextforia.com`) y leen secretos desde variables de entorno. No pegues llaves en el código.

### Conversaciones guiadas

Antes de migrar un número real a WhatsApp Cloud API, valida la bandeja de Conversaciones dentro del dashboard:

```text
https://api.nextforia.com/admin
```

La intervención humana vive dentro de la conversación, sin una sección separada. El estado
operativo se registra en Supabase y el panel lo reconstruye desde el historial para
sobrevivir reinicios de Render.

Flujo operativo recomendado:

1. Abre `/admin` y entra a **Conversaciones**.
2. Usa **Necesitan de ti** para ver únicamente los casos que dependen del equipo.
3. Revisa la intención y los chips de solo lectura en **Lo que la IA entendió**.
4. Ajusta, si hace falta, la respuesta preparada y usa **Confirmar y enviar**.
5. Si el caso ya se cerró por otro medio, usa **Ya está resuelta**.
6. Guarda una nota interna solo cuando el equipo necesite contexto adicional.

Variables útiles:

| Variable | Default | Para qué sirve |
|---|---:|---|
| `BOT_BASE_URL` | `https://api.nextforia.com` | URL del bot a verificar |
| `DASHBOARD_KEY` | *(requerida para smoke/alertas)* | Autoriza `/admin/smoke-check` y `/admin/alert` |
| `EXPECTED_BOT_VERSION` | lee `BOT_VERSION` local en `verify-deploy.js` | Versión esperada post-deploy |
| `SMOKE_QUERY` | `juguete` | Término real para la prueba de búsqueda |
| `ALERT_ON_FAILURE` | `1` | Usa `0` para no alertar por WhatsApp |
| `COLD_START_RETRIES` | `2` | Reintentos para Render free tier |
| `COLD_START_DELAY_MS` | `60000` | Espera entre reintentos por cold start |
| `MONITOR_PENDING_HANDOFF_MINUTES` | `10` | Minutos máximos para chats en humano pendientes de respuesta |
| `ALERT_COOLDOWN_MINUTES` | `30` | Ventana anti-spam para no repetir la misma alerta operativa |

### Prueba de humo post-deploy

Valida: health OK, versión esperada opcional, búsqueda real con resultados, selección desde resultados reales, datos de checkout completos, total distinto de `$0`, y lectura de conversaciones desde Supabase.

```bash
DASHBOARD_KEY=... EXPECTED_BOT_VERSION=v60 npm run smoke
```

También puedes apuntar a staging:

```bash
BOT_BASE_URL=https://nextforia-staging.onrender.com DASHBOARD_KEY=... npm run smoke
```

### Verificación de deploy

Espera hasta 5 minutos a que Render tenga la versión esperada y falla si el auto-deploy quedó atrás.

```bash
DASHBOARD_KEY=... EXPECTED_BOT_VERSION=v60 npm run verify-deploy
```

Si se ejecuta desde el repo, `verify-deploy.js` puede leer `BOT_VERSION` directamente de `index.js`, así que `EXPECTED_BOT_VERSION` es opcional.

### Monitoreo de salud

Revisa `/admin/health`, `/admin/stats` y `/admin/conversations?limit=100`. Alerta si hay errores, Supabase no responde, Meta/Shopify fallan, handoff alto, búsquedas sin resultados repetidas, saldo Anthropic agotado, o chats en intervención humana pendientes por más de `MONITOR_PENDING_HANDOFF_MINUTES`.

```bash
DASHBOARD_KEY=... npm run monitor
```

Umbrales configurables:

```bash
MONITOR_MAX_HANDOFF_RATE=0.4 \
MONITOR_MAX_ZERO_RESULT_RATE=0.35 \
MONITOR_REPEATED_ZERO_QUERY_COUNT=3 \
MONITOR_PENDING_HANDOFF_MINUTES=10 \
DASHBOARD_KEY=... npm run monitor
```

Para correrlo como proceso continuo:

```bash
DASHBOARD_KEY=... MONITOR_INTERVAL_MS=300000 node monitor.js --loop
```

### Cron sugerido

```cron
*/5 * * * * cd /ruta/nextforia-chatbot && DASHBOARD_KEY=... npm run monitor >> monitor.log 2>&1
```

### GitHub Action

El workflow listo para activar `.github/workflows/rav-bot-safety-checks.yml` corre `npm run monitor` cada 10 minutos, en pushes a `main` y manualmente con `workflow_dispatch`. Requiere un token/sesion de GitHub con permiso `workflow` para poder subirlo al repo, y el secret `DASHBOARD_KEY` en GitHub Actions. Si detecta fallas o chats humanos pendientes por encima del umbral, envia alerta por WhatsApp al equipo usando `/admin/alert`, con cooldown anti-spam de 30 minutos por tipo de alerta.

La copia en `docs/github-actions-safety-checks.yml` queda como referencia editable.

---

## 🌊 Flujo de conversación

```
Cliente → Webhook Meta → Bot (Claude)
                         ├── search_products       → Shopify storefront
                         ├── send_product_card     → Meta WhatsApp API
                         ├── select_product        → Estado interno (carrito)
                         ├── save_warranty_field   → Estado interno (garantías)
                         ├── send_shipping_info    → Texto plano
                         ├── send_rating_request   → Texto plano
                         ├── save_rating           → Notificación a Boss
                         └── request_human_handoff → Notificación a Eliana
```

**Reglas clave del prompt:**
- LIMITE DURO: máximo 1 `search_products` por turno (anti rate-limit)
- 3 productos máximo por recomendación + link al catálogo de búsqueda
- Tono: empático, "peque" como gender-neutral
- IMÁGENES: bot no las ve; pide al cliente mandar el link del producto

---

## 🚀 Deploy

El servicio en Render auto-deploya cuando hay un push a la rama `main` de este repo.

1. `git push origin main` (o editar via web GitHub)
2. Render detecta el cambio y despliega automáticamente (~60-90s)
3. Verificar con `GET /admin/health` que el bot esté arriba

---

## 🐛 Troubleshooting

### El bot no responde
1. Abrir `/admin/health` — si muestra error, ver qué dependencia falla
2. Si `anthropic_key_present: true` pero el bot no responde, probable saldo agotado → recargar en https://platform.claude.com/settings/billing
3. Si `shopify_storefront` da error, ver si `ravtoys.com` responde

### El bot dice "no encontré" pero la web sí muestra productos
- Probar `/admin/test-search?q=lo+mismo` — si devuelve 0 resultados, hay bug
- Si devuelve resultados, posiblemente el modelo no los está pasando al cliente — revisar logs de Render

### Costos disparados
- Verificar token usage en https://platform.claude.com/settings/usage
- Ratio sano: input/output ~10:1 después del prompt caching (v30+)
- Si ratio >30:1, prompt caching no está funcionando — revisar que `cache_control` esté en system+tools

### Logs en Render
- Dashboard → `nextforia-chatbot` → `Logs` (free tier solo guarda 1h)
- Logs estructurados (v32+) en formato JSON: `{ts, level, event, ...data}`

---

## 📋 Histórico de versiones (resumido)

| Versión | Cambio principal |
|---|---|
| v9-v22 | Construcción base: tools, garantías, envíos, handoffs |
| v23 | Try/catch en notifyTeam (#131030 no crashea flujo) |
| v24-v25 | Sonnet 4.5 + envíos Medellín same-day |
| v26 | Sistema de calificación 1-5 con triggers natural y post-handoff |
| v27 | 3 opciones + link de búsqueda específico al catálogo |
| v27.1 | Hard cap 1 `search_products` por turno (anti rate-limit) |
| v28 | CTA "mándame el link y te tomo el pedido" + multimedia handling cálido |
| v29 | Búsqueda migrada a Shopify storefront JSON (cero falsos negativos) |
| v30 | Prompt caching + historial 12→8 (-85% input cost) |
| v31 | Endpoints admin: health, stats, test-search |
| v32 | Alerta de saldo bajo + cache de búsqueda 5min + logger estructurado |
| v32.1 | `BOT_VERSION` constante centralizada |
| v59 | Roles `super_admin`/Admin y endpoint del modelo de acceso |
| v60 | Panel Super admin v1 separado, protegido y enlazado por rol |
| v64 | RAV Toys como cliente #1 y creación segura de su acceso por invitación |
| v65 | `@username` real de los clientes de Instagram en conversaciones y búsqueda |
| v66 | Estados operativos y resolución separada entre IA y equipo humano |
| v67 | Conversaciones guiadas en tres estados, respuesta sugerida y ficha de inteligencia |
| v68 | Atención al cliente unificada con WhatsApp e Instagram diferenciados por conversación |
| v69 | Acceso genérico Nextfor IA para RAV Toys y futuros clientes, optimizado para escritorio y móvil |
| v70 | Conversaciones multicanal con distintivos en avatares, bandeja única y ficha de inteligencia |
| v71 | Facebook Messenger con webhook firmado, respuestas, métricas y handoff en la bandeja omnicanal |
| v72 | Bandeja de conversaciones más amplia y conversaciones cerrables |
| v73 | Configuración guiada de NexforIA y memoria comercial del cliente |
| v80 | Super Admin Panel rediseñado desde el handoff NexforIA: navegación de plataforma, clientes registrados, salud, readiness y estados futuros sin datos ficticios |
| v81 | Entrada Super Admin separada del acceso de clientes, con cambio seguro de sesión y validación estricta del rol de plataforma |
| v74 | Ventas asistidas y cierres por confirmar en el resumen del cliente |
| v308 | Aislamiento de activos Meta: Instagram no puede pertenecer a dos empresas y RAV conserva su conexión heredada |

---

## 👥 Contacto

- **Owner:** Santiago Velásquez (CEO RAV Toys)
- **Asesora comercial:** Eliana (responde handoffs)
- **Tienda física:** Planet Selva, CC El Tesoro, Local 3729 (Medellín)
- **E-commerce:** [ravtoys.com](https://ravtoys.com)
