begin;
drop function if exists public.claim_due_customer_notification_emails(integer);
drop table if exists public.customer_notification_email_deliveries;
drop table if exists public.customer_notification_email_preferences;
commit;
