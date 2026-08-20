# Correos automáticos del setup

Los correos dirigidos al cliente durante el setup usan siempre este remitente:

`Nextfor IA <info@nextforia.com>`

Cada versión HTML y texto incluye un acceso directo a `https://nextforia.com`.

| Correo | Evento | Envío |
| --- | --- | --- |
| Bienvenida | Creación de cuenta o aceptación de invitación | Inmediato, una vez por cliente |
| Entrenamiento incompleto | El cliente guarda avance sin terminar | 2 horas después, máximo una vez al día |
| Pago pendiente | Se crea un checkout que no termina pagado | 2 horas después; se cancela si el pago se completa |
| En preparación | El setup entra en verificación | Inmediato, una vez por cliente |
| Bot activo | El setup pasa a estado activo | Inmediato, una vez por cliente |

## Activación

1. Verificar `nextforia.com` y `info@nextforia.com` como remitente en Resend.
2. Aplicar `docs/migrations/20260815_setup_email_journey_up.sql` en Supabase.
3. Configurar `RESEND_API_KEY` y `CUSTOMER_INVITE_REPLY_TO=info@nextforia.com`.
4. Activar `SETUP_EMAIL_JOURNEY_ENABLED=1` primero en Staging.

La cola persiste en Supabase, evita duplicados, reintenta hasta tres veces y vuelve a comprobar que el correo siga siendo pertinente antes de enviarlo.
