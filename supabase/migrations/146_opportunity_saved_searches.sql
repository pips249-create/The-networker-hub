-- Saved opportunity search alerts (criteria match when new listings publish).

create table if not exists public.opportunity_saved_searches (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  attendee_id      uuid not null references public.attendees(id) on delete cascade,
  label            text,
  criteria         jsonb not null default '{}'::jsonb,
  notify_email     boolean not null default true,
  last_notified_at timestamptz
);

create index if not exists opportunity_saved_searches_attendee_idx
  on public.opportunity_saved_searches (attendee_id);

create table if not exists public.opportunity_saved_search_hits (
  search_id        uuid not null references public.opportunity_saved_searches(id) on delete cascade,
  opportunity_id   uuid not null references public.business_opportunities(id) on delete cascade,
  notified_at      timestamptz not null default now(),
  primary key (search_id, opportunity_id)
);

alter table public.opportunity_saved_searches enable row level security;
alter table public.opportunity_saved_search_hits enable row level security;

grant select, insert, update, delete on public.opportunity_saved_searches to service_role;
grant select, insert, update, delete on public.opportunity_saved_search_hits to service_role;

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values (
  'opportunity_saved_search_match',
  'Saved search — new matching opportunity',
  'Sent when a newly published opportunity matches a saved search alert.',
  'New opportunity matching your saved search',
  '<p>stub — see email-templates/opportunity-saved-search-match.html</p>',
  array[
    'user_name', 'user_email', 'search_label', 'match_count', 'opportunity_title',
    'opportunity_url', 'browse_opportunities_url', 'hub_account_url',
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
