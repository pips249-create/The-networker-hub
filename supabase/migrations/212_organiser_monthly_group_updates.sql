-- Monthly group updates: organiser → Hub attendees email (modular template).
-- Free allowance: 1 send per organiser group per calendar month.
-- Paid extras: organisers.group_update_extra_credits (redeemed on send after free used).
-- Hard cap: 4 sends per group per calendar month (even with credits).

alter table public.organisers
  add column if not exists group_update_extra_credits integer not null default 0;

comment on column public.organisers.group_update_extra_credits is
  'Purchased extra monthly group-update sends. Consumed after the free monthly allowance.';

create table if not exists public.organiser_group_updates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organiser_id uuid not null references public.organisers(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'sending', 'sent', 'failed', 'cancelled')),
  period_key text not null default '',
  subject text not null default '',
  content jsonb not null default '{}'::jsonb,
  audience text not null default 'hub_attendees'
    check (audience in ('hub_attendees', 'roster', 'both')),
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  used_free_allowance boolean not null default false,
  used_extra_credit boolean not null default false,
  queued_at timestamptz,
  sent_at timestamptz,
  last_error text
);

create index if not exists idx_organiser_group_updates_organiser
  on public.organiser_group_updates (organiser_id, created_at desc);

create index if not exists idx_organiser_group_updates_period
  on public.organiser_group_updates (organiser_id, period_key, status);

create table if not exists public.organiser_group_update_queue (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  last_error text,
  update_id uuid not null references public.organiser_group_updates(id) on delete cascade,
  organiser_id uuid not null references public.organisers(id) on delete cascade,
  email text not null,
  recipient_name text not null default ''
);

create unique index if not exists organiser_group_update_queue_pending_uniq
  on public.organiser_group_update_queue (update_id, lower(email))
  where sent_at is null and failed_at is null;

create index if not exists idx_organiser_group_update_queue_due
  on public.organiser_group_update_queue (scheduled_for)
  where sent_at is null and failed_at is null;

alter table public.organiser_group_updates enable row level security;
alter table public.organiser_group_update_queue enable row level security;

grant select, insert, update, delete on public.organiser_group_updates to service_role;
grant select, insert, update, delete on public.organiser_group_update_queue to service_role;

insert into public.email_templates (
  slug,
  name,
  description,
  subject,
  body_html,
  placeholders,
  category
)
values (
  'organiser_monthly_group_update',
  'Organiser monthly group update',
  'Modular monthly email from an organiser to people who booked their Hub events.',
  '{{email_subject}}',
  '<p>stub — see email-templates/organiser-monthly-group-update.html</p>',
  array[
    'user_name', 'user_email', 'email_subject', 'organiser_name', 'organiser_url',
    'period_label', 'organiser_note_html', 'month_recap_html', 'events_html',
    'spotlight_html', 'ask_html', 'volunteer_html', 'social_html',
    'cta_url', 'cta_label', 'hub_account_url', 'browse_events_url',
    'contact_url', 'privacy_url', 'terms_url', 'site_url', 'logo_url',
    'logo_footer_url', 'unsubscribe_url', 'sponsor_row', 'mini_sponsors_row'
  ],
  'attendees'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
