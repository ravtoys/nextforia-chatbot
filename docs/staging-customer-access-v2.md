# Customer Access v2 — activación de Staging

Fecha: 22 de julio de 2026

Alcance: `ravtoys/nextforia-chatbot`, únicamente Staging

Contrato: [`customer-access-contract.md`](customer-access-contract.md)

## Estado de entrega

- El código queda detrás de `CUSTOMER_ACCESS_V2_ENABLED=1`; ausente o `0` conserva el flujo de producción.
- La prueba local usa almacenamiento y correo en memoria solo con `NODE_ENV=test` y `CUSTOMER_ACCESS_TEST_MODE=1`.
- No se aplicó ninguna migración ni variable a producción.
- La URL pública de Staging solo puede publicarse después de disponer de un proyecto Supabase, remitente Resend, secretos de sesión y dominio aislados de producción.

## Preparación del entorno aislado

1. Crear o seleccionar un proyecto Supabase exclusivo de Staging.
2. Ejecutar `docs/migrations/20260721_customer_access_v2_up.sql` en ese proyecto.
3. Verificar que los catálogos `starter`, `growth`, `scale` y los bots activos corresponden a Staging.
4. Verificar un dominio/remitente de correo exclusivo de Staging en Resend.
5. Configurar en el servicio de Staging, nunca en producción:

```text
NODE_ENV=production
CUSTOMER_ACCESS_V2_ENABLED=1
CUSTOMER_PANEL_BASE_URL=https://URL-REAL-DE-STAGING
CUSTOMER_INVITE_TTL_HOURS=24
CUSTOMER_ACCESS_EMAIL_PROVIDER=resend
# El remitente está fijado en código como Nextfor IA <info@nextforia.com>.
CUSTOMER_INVITE_REPLY_TO=info@nextforia.com
RESEND_API_KEY=SECRETO-STAGING
SUPABASE_URL=URL-SUPABASE-STAGING
SUPABASE_KEY=SERVICE-ROLE-STAGING
DASHBOARD_SESSION_SECRET=SECRETO-INDEPENDIENTE-STAGING
```

Las variables normales del bot (`WA_TOKEN`, `ANTHROPIC_API_KEY`, etc.) deben ser fixtures o credenciales propias de Staging. No se copian secretos de producción.

## Orden de despliegue

1. Aplicar la migración `up` en Supabase Staging.
2. Desplegar la rama de Staging con el gate todavía en `0` y comprobar `/admin/health`.
3. Configurar correo, URL y persistencia de Staging.
4. Activar `CUSTOMER_ACCESS_V2_ENABLED=1` únicamente en el servicio Staging.
5. Validar como `super_admin`:
   - `GET /admin/customer-access/catalogs`;
   - `POST /admin/customer-invite` con exactamente los cuatro campos;
   - recepción en el correo exacto;
   - estados en `GET /admin/customer-invitations`;
   - consumo único desde `/admin/setup/:tenantId`;
   - login con email y aislamiento de tenant.
6. Validar que `admin`, `agent`, `viewer` y anónimos no pueden crear clientes ni consultar invitaciones.

## Rollback

Rollback de aplicación, preferido:

1. Cambiar `CUSTOMER_ACCESS_V2_ENABLED=0` en Staging.
2. Desplegar de nuevo y confirmar que el flujo legado continúa operativo.
3. Conservar las tablas para análisis si ya existen registros.

Rollback de datos, solo si se decidió eliminar todo Customer Access v2 de Staging:

1. Exportar los IDs y estados necesarios para auditoría, sin tokens/hashes.
2. Confirmar que ningún acceso Staging depende de estas tablas.
3. Ejecutar `docs/migrations/20260721_customer_access_v2_down.sql`.

El `down` elimina exclusivamente las funciones y tablas aditivas de v2. No debe ejecutarse en producción.

## Evidencia local requerida

```text
node --check index.js
node super-admin-panel.test.js
node customer-access-v2.test.js
node customer-access-v2.e2e.test.js
pnpm test
```

La prueba integrada cubre autorización exacta, campos obligatorios, duplicados, catálogos, ausencia de signup público, respuesta sin secretos, lista de estados, revocación y salud. La prueba unitaria cubre token alterado, tenant distinto, vencido, revocado, usado, consumo concurrente atómico, entrega correcta/error y auditoría sin secretos.
