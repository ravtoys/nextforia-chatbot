# Correos operativos del Customer Panel

## Modelo de acceso

Los correos están apagados por defecto. Cada usuario los activa desde **Customer Panel → Notificaciones** y solo puede enviarlos a la dirección de su membresía activa en `tenant_users`.

El servidor deriva siempre:

`sesión autenticada → tenant_users activo → tenant_id → preferencia del mismo usuario`.

No se aceptan `tenant_id`, destinatarios ni remitentes desde el navegador. Antes de cada envío se revalida que el usuario siga activo y pertenezca al mismo tenant. Desactivar la preferencia o la membresía cancela cualquier correo que siga en cola.

## Plantillas

Las cinco plantillas provienen del handoff `Plantillas HTML para correos.zip`:

- `payment_pending`: pedidos o pagos por confirmar.
- `shipping_pending`: pedidos pagados pendientes de envío.
- `sales_opportunity`: oportunidad detectada por la IA.
- `product_update`: novedad de Nextfor para la cuenta.
- `human_attention`: conversación que requiere intervención humana.

Todas usan `Nextfor IA <info@nextforia.com>` mediante la integración existente de Resend. Los CTA solo aceptan URLs HTTPS del mismo origen configurado para el Customer Panel.

Los eventos actuales `customer_order_created` y `human_handoff_required` se conectan automáticamente. El correo de pedido no afirma que el pago fue recibido salvo que el evento incluya una señal explícita `payment_reported=true`.

Al confirmar un pago se agenda el recordatorio de envío para 24 horas después. Antes de entregarlo se comprueba que el pedido siga pagado o en preparación y que todavía no tenga guía. Las oportunidades de venta solo se notifican cuando el motor de retargeting crea realmente un trabajo pendiente de revisión. La plantilla de novedades queda disponible, pero no tiene un disparador automático hasta que exista un evento de producto comprobable; no se crean eventos aproximados ni datos ficticios.

## Persistencia y rollback

Aplicar primero en Staging:

- `docs/migrations/20260820_customer_notification_emails_up.sql`
- `CUSTOMER_NOTIFICATION_EMAIL_ENABLED=1`

La cola es idempotente por tenant, usuario, plantilla y evento. Reintenta hasta tres veces y conserva solo estado operativo y el ID del proveedor. La migración `20260820_customer_notification_emails_down.sql` elimina únicamente las tablas nuevas y debe ejecutarse solo con aprobación y respaldo.

Rollback de aplicación: `CUSTOMER_NOTIFICATION_EMAIL_ENABLED=0`. Esto oculta los controles y detiene programación/procesamiento sin borrar preferencias ni entregas.
