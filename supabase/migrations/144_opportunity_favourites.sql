-- Saved business opportunities (browse hearts + My Hub). Expiry nudge emails via cron.

create table if not exists public.opportunity_favourites (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  attendee_id      uuid not null references public.attendees(id) on delete cascade,
  opportunity_id   uuid not null references public.business_opportunities(id) on delete cascade,
  notify_email     boolean not null default true,
  expiry_reminded_at timestamptz,
  unique (attendee_id, opportunity_id)
);

create index if not exists opportunity_favourites_attendee_idx
  on public.opportunity_favourites (attendee_id);

create index if not exists opportunity_favourites_opportunity_idx
  on public.opportunity_favourites (opportunity_id);

alter table public.opportunity_favourites enable row level security;

grant select, insert, update, delete on public.opportunity_favourites to service_role;

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values (
  'saved_opportunity_closing_soon',
  'Saved opportunity — closing soon',
  'Sent when a saved business opportunity listing is nearing its expiry date.',
  'An opportunity you saved is closing soon — {{opportunity_title}}',
  '<p>stub — run scripts/patch-email-sponsor-placeholders.js or deploy email-templates/saved-opportunity-closing-soon.html</p>',
  array[
    'user_name', 'user_email', 'opportunity_title', 'opportunity_host', 'expiry_date',
    'opportunity_url', 'hub_account_url', 'browse_opportunities_url',
    'contact_url', 'privacy_url', 'terms_url', 'refunds_url',
    'sponsor_row', 'site_url', 'logo_url'
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
