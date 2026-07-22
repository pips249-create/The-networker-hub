-- City Partner subscription tracking on cms_blocks + per-city waitlist.

alter table public.cms_blocks
  add column if not exists sponsor_subscription_id text,
  add column if not exists sponsor_email text,
  add column if not exists sponsor_available_from timestamptz;

comment on column public.cms_blocks.sponsor_subscription_id is
  'Stripe subscription id for City Partner slot — set on checkout, cleared when subscription ends.';
comment on column public.cms_blocks.sponsor_email is
  'Billing email from City Partner checkout.';
comment on column public.cms_blocks.sponsor_available_from is
  'When this City Partner slot opens for a new sponsor (Stripe current_period_end when cancel_at_period_end).';

create index if not exists cms_blocks_sponsor_subscription_idx
  on public.cms_blocks (sponsor_subscription_id)
  where sponsor_subscription_id is not null;

create table if not exists public.city_partner_waitlist (
  id uuid primary key default gen_random_uuid(),
  city_slug text not null,
  email text not null,
  company_name text,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists city_partner_waitlist_email_city_key
  on public.city_partner_waitlist (lower(email), city_slug)
  where notified_at is null;

create index if not exists city_partner_waitlist_pending_idx
  on public.city_partner_waitlist (city_slug, created_at)
  where notified_at is null;

comment on table public.city_partner_waitlist is
  'Advertisers waiting for a City Partner slot — notified when the city becomes available.';

alter table public.city_partner_waitlist enable row level security;

revoke all on table public.city_partner_waitlist from anon, authenticated;
grant select, insert, update, delete on table public.city_partner_waitlist to service_role;

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values
  (
    'city_partner_slot_open',
    'City Partner slot open (waitlist)',
    'Sent when a City Partner city slot becomes available for a waitlisted advertiser.',
    '{{city_name}} City Partner — slot now available',
    '<p>stub</p>',
    array['contact_name', 'city_name', 'advertising_url', 'available_from', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'advertising'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category;
