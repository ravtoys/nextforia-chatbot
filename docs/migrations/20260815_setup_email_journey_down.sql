begin;
drop function if exists public.claim_due_setup_emails(integer);
drop table if exists public.setup_email_deliveries;
commit;
