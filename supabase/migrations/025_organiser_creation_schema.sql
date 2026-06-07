-- Organiser creation flow: columns referenced in API but missing from earlier migrations.
-- Run after 024_cms_sidebar_ad_slots.sql

-- Organiser ↔ account link + separate contact email
alter table public.organisers
  add column if not exists organiser_account_id uuid
    references public.organiser_accounts(id) on delete set null,
  add column if not exists contact_email text;

create index if not exists idx_organisers_account
  on public.organisers(organiser_account_id);

-- Event refund terms, capacity, and post-sale lock (cancellation flow)
alter table public.events
  add column if not exists refund_policy text,
  add column if not exists refund_policy_details text,
  add column if not exists refund_cutoff_days integer,
  add column if not exists refund_terms_agreed boolean default false,
  add column if not exists refund_terms_agreed_at timestamptz,
  add column if not exists max_attendees integer,
  add column if not exists locked boolean default false,
  add column if not exists locked_reason text,
  add column if not exists locked_at timestamptz;

-- Ticket tier ordering in checkout UI
alter table public.tickets
  add column if not exists display_order integer default 0;

-- Cancellation sets status = 'cancelled' (018 only allowed draft/published/unpublished/archived)
alter table public.events drop constraint if exists events_status_check;
alter table public.events
  add constraint events_status_check
  check (status in ('draft', 'published', 'unpublished', 'archived', 'cancelled'));

create index if not exists idx_events_status_starts
  on public.events(status, starts_at)
  where status = 'published';
