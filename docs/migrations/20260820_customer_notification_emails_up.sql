begin;

create extension if not exists pgcrypto;

create table if not exists public.customer_notification_email_preferences (
  tenant_id text not null,
  actor_id text not null,
  recipient text not null,
  enabled boolean not null default false,
  types jsonb not null default '{"payment_pending":true,"shipping_pending":true,"sales_opportunity":true,"product_update":true,"human_attention":true}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, actor_id),
  check (actor_id = lower(actor_id)),
  check (recipient = actor_id),
  check (jsonb_typeof(types) = 'object')
);

create index if not exists customer_notification_email_preferences_enabled_idx
  on public.customer_notification_email_preferences (tenant_id, enabled)
  where enabled = true;

create table if not exists public.customer_notification_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  actor_id text not null,
  recipient text not null,
  notification_id text not null,
  template_key text not null check (template_key in ('payment_pending', 'shipping_pending', 'sales_opportunity', 'product_update', 'human_attention')),
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'scheduled' check (status in ('scheduled', 'sending', 'sent', 'failed', 'failed_permanently', 'cancelled')),
  send_after timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (actor_id = lower(actor_id)),
  check (recipient = actor_id)
);

create index if not exists customer_notification_email_deliveries_due_idx
  on public.customer_notification_email_deliveries (status, send_after);
create index if not exists customer_notification_email_deliveries_tenant_idx
  on public.customer_notification_email_deliveries (tenant_id, created_at desc);

alter table public.customer_notification_email_preferences enable row level security;
alter table public.customer_notification_email_deliveries enable row level security;
revoke all on table public.customer_notification_email_preferences from public, anon, authenticated;
revoke all on table public.customer_notification_email_deliveries from public, anon, authenticated;

create or replace function public.claim_due_customer_notification_emails(p_limit integer default 20)
returns setof public.customer_notification_email_deliveries
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select id
    from public.customer_notification_email_deliveries
    where status in ('scheduled', 'failed')
      and send_after <= now()
      and attempts < 3
    order by send_after asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update public.customer_notification_email_deliveries delivery
  set status = 'sending',
      attempts = delivery.attempts + 1,
      updated_at = now()
  from due
  where delivery.id = due.id
  returning delivery.*;
end;
$$;

revoke all on function public.claim_due_customer_notification_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_due_customer_notification_emails(integer) to service_role;

commit;
