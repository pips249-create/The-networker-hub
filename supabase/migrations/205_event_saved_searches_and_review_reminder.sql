-- Event saved-search alerts (criteria match when new listings publish).

create table if not exists public.event_saved_searches (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  attendee_id      uuid not null references public.attendees(id) on delete cascade,
  label            text,
  criteria         jsonb not null default '{}'::jsonb,
  notify_email     boolean not null default true,
  last_notified_at timestamptz
);

create index if not exists event_saved_searches_attendee_idx
  on public.event_saved_searches (attendee_id);

create table if not exists public.event_saved_search_hits (
  search_id        uuid not null references public.event_saved_searches(id) on delete cascade,
  event_id         uuid not null references public.events(id) on delete cascade,
  notified_at      timestamptz not null default now(),
  primary key (search_id, event_id)
);

alter table public.event_saved_searches enable row level security;
alter table public.event_saved_search_hits enable row level security;

grant select, insert, update, delete on public.event_saved_searches to service_role;
grant select, insert, update, delete on public.event_saved_search_hits to service_role;

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values (
  'event_saved_search_match',
  'Saved search — new matching event',
  'Sent when a newly published event matches a saved browse search alert.',
  'New event matching your saved search',
  '<p>stub — see email-templates/event-saved-search-match.html</p>',
  array[
    'user_name', 'user_email', 'search_label', 'match_count', 'event_name',
    'event_url', 'browse_events_url', 'hub_account_url',
    'contact_url', 'privacy_url', 'terms_url', 'sponsor_row', 'site_url', 'logo_url'
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

-- Second post-event review nudge (after the first request).
alter table public.registrations
  add column if not exists post_event_review_reminder_sent_at timestamptz;

comment on column public.registrations.post_event_review_reminder_sent_at is
  'When the follow-up post-event review reminder was sent (after the first request).';

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values (
  'post_event_review_reminder',
  'Post-event review reminder',
  'Second nudge asking an attendee to leave a review after the first request.',
  'Quick reminder — how was {{event_name}}?',
  '<p>stub — see email-templates/post-event-review-reminder.html</p>',
  array[
    'user_name', 'user_email', 'event_name', 'review_url',
    'contact_url', 'privacy_url', 'terms_url', 'sponsor_row', 'site_url', 'logo_url'
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
