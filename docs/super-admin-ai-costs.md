# Costos de IA en Super Admin

La vista `IA · costos` de `/admin/super-admin?view=aiCosts` permite supervisar el consumo de Anthropic y OpenAI sin exponer conversaciones, claves ni datos personales.

## Qué muestra

- Consumo por proveedor, cliente, bot y conversación protegida.
- Tokens de entrada, caché y salida informados por cada API.
- Costo estimado de cada llamada usando la tabla versionada en `ai-usage.js`.
- Facturación oficial del período cuando está configurada la clave administrativa del proveedor.
- Motivos de consumo: respuestas al cliente, vista previa, evaluación, imágenes y transcripción de audio.
- Estado operativo basado en llamadas reales: activo, sin créditos, error de credenciales, limitado o sin actividad observada.

La identidad de conversación se guarda como un hash corto. No se guardan prompts, respuestas, correos, teléfonos, contraseñas, tokens ni claves API en la telemetría.

## Conexión con proveedores

Configurar en el entorno del servidor, nunca en código ni en el navegador:

```text
AI_COSTS_ENABLED=1
ANTHROPIC_ADMIN_API_KEY=...
OPENAI_ADMIN_API_KEY=...
AI_COSTS_PROVIDER_CACHE_MS=600000
```

Las claves administrativas son diferentes de `ANTHROPIC_API_KEY` y `OPENAI_API_KEY`, que continúan ejecutando los bots. El backend consulta:

- Anthropic: `/v1/organizations/cost_report`
- OpenAI: `/v1/organization/costs`

Si una clave administrativa no está configurada, la medición por llamada sigue funcionando y el panel indica que el total oficial no está conectado.

## Créditos y recargas

Los proveedores facturan saldo monetario, no un número fijo de tokens. Sus APIs de reportes no garantizan un saldo prepago disponible. Por esa razón el panel:

- nunca inventa un saldo;
- detecta `sin créditos` solo después de un rechazo real de facturación/cuota;
- ofrece enlaces directos a los portales oficiales de uso y recarga;
- no ejecuta llamadas artificiales que consuman dinero para comprobar el estado.

Portales oficiales:

- Anthropic: `https://platform.claude.com/usage` y `https://platform.claude.com/settings/billing`
- OpenAI: `https://platform.openai.com/usage` y `https://platform.openai.com/settings/organization/billing/overview`

## Persistencia y aislamiento

Los eventos se escriben cifrados en `conversation_logs` como registros internos `ai_usage_v1`, reutilizando el almacenamiento multi-tenant existente. Esos registros están excluidos de las bandejas de conversación del cliente y se agrupan por `tenant_id`. Solo una sesión `super_admin` puede consultar `GET /admin/ai-costs`.

No requiere migración. Los eventos anteriores al despliegue no pueden reconstruirse por conversación; el total oficial sí puede cubrir el período histórico informado por cada proveedor.

## Despliegue y rollback

1. Desplegar el código con `AI_COSTS_ENABLED=1`.
2. Validar que `/admin/ai-costs?days=7` rechace roles distintos de `super_admin`.
3. Añadir las claves administrativas en el gestor de secretos del entorno.
4. Hacer una llamada real controlada de cada proveedor y confirmar su aparición.

Rollback: establecer `AI_COSTS_ENABLED=0` y desplegar la versión anterior. Los registros internos existentes son inocuos y pueden conservarse.
