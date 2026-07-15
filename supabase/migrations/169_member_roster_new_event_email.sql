-- Member list: notify members when their organiser publishes a new event.
-- Dedup table + email template metadata.

create table if not exists public.organiser_roster_listing_alerts (
  id                 uuid primary key default uuid_generate_v4(),
  created_at         timestamptz not null default now(),
  roster_member_id   uuid not null references public.organiser_member_roster(id) on delete cascade,
  event_id           uuid not null references public.events(id) on delete cascade,
  unique (roster_member_id, event_id)
);

create index if not exists organiser_roster_listing_alerts_event_idx
  on public.organiser_roster_listing_alerts(event_id);

create index if not exists organiser_roster_listing_alerts_member_idx
  on public.organiser_roster_listing_alerts(roster_member_id);

alter table public.organiser_roster_listing_alerts enable row level security;

grant select, insert, update, delete on public.organiser_roster_listing_alerts to service_role;

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
  'member_roster_new_event',
  'Member list — new event',
  'Sent to people on an organiser’s member list when that group publishes a new event.',
  '{{organiser_name}} has a new event for members',
  '<p>stub — see email-templates/member-roster-new-event.html</p>',
  array[
    'user_name', 'user_email', 'organiser_name', 'organiser_url', 'event_name', 'event_date',
    'event_time', 'event_location', 'event_url', 'cta_url', 'cta_label', 'hub_account_url',
    'browse_events_url', 'contact_url', 'privacy_url', 'terms_url', 'site_url', 'logo_url',
    'logo_footer_url', 'sponsor_row', 'mini_sponsors_row'
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
