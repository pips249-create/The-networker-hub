-- Newsletter send tracking + Resend open/click analytics

create table if not exists public.newsletter_sends (
  id uuid primary key default uuid_generate_v4(),
  edition_id uuid not null references public.newsletter_editions(id) on delete cascade,
  recipient_email text not null,
  resend_email_id text,
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  first_opened_at timestamptz,
  first_clicked_at timestamptz,
  open_count integer not null default 0,
  click_count integer not null default 0,
  bounced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (edition_id, recipient_email)
);

create index if not exists newsletter_sends_edition_id_idx
  on public.newsletter_sends (edition_id);

create index if not exists newsletter_sends_resend_email_id_idx
  on public.newsletter_sends (resend_email_id)
  where resend_email_id is not null;

create table if not exists public.newsletter_link_clicks (
  id uuid primary key default uuid_generate_v4(),
  edition_id uuid not null references public.newsletter_editions(id) on delete cascade,
  url text not null,
  click_count integer not null default 0,
  unique (edition_id, url)
);

create index if not exists newsletter_link_clicks_edition_id_idx
  on public.newsletter_link_clicks (edition_id);

create table if not exists public.newsletter_webhook_events (
  id text primary key,
  event_type text not null,
  resend_email_id text,
  edition_id uuid references public.newsletter_editions(id) on delete set null,
  processed_at timestamptz not null default now()
);

grant select, insert, update, delete on public.newsletter_sends to service_role;
grant select, insert, update, delete on public.newsletter_link_clicks to service_role;
grant select, insert, update, delete on public.newsletter_webhook_events to service_role;

comment on table public.newsletter_sends is
  'Per-recipient newsletter sends — linked to Resend email_id for open/click webhooks.';
comment on table public.newsletter_link_clicks is
  'Aggregated click counts per URL for each newsletter edition.';
comment on table public.newsletter_webhook_events is
  'Processed Resend webhook event ids (Svix) for idempotency.';
