-- Alumni Fast-Pass: locked alumni tickets for past confirmed attendees.

alter table public.events
  add column if not exists alumni_fast_pass_enabled boolean not null default false,
  add column if not exists alumni_source_event_id uuid references public.events(id) on delete set null;

comment on column public.events.alumni_fast_pass_enabled is
  'When true, this event offers a hidden Alumni ticket tier for invited past attendees.';
comment on column public.events.alumni_source_event_id is
  'Default source event for alumni invite campaigns (e.g. last year''s conference).';

alter table public.tickets
  drop constraint if exists tickets_ticket_type_check;

alter table public.tickets
  add constraint tickets_ticket_type_check
  check (ticket_type in ('Standard', 'Application-based', 'Guest-visit', 'Alumni'));

alter table public.registrations
  drop constraint if exists registrations_registration_kind_check;

alter table public.registrations
  add constraint registrations_registration_kind_check
  check (registration_kind in ('standard', 'guest_visit', 'application', 'alumni'));

create table if not exists public.alumni_invites (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  organiser_id uuid not null references public.organisers(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  source_event_id uuid references public.events(id) on delete set null,
  email text not null,
  attendee_id uuid references public.attendees(id) on delete set null,
  invited_by uuid,
  invite_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'redeemed', 'revoked', 'expired')),
  sent_at timestamptz,
  redeemed_at timestamptz,
  registration_id uuid references public.registrations(id) on delete set null,
  unique (event_id, email)
);

create index if not exists alumni_invites_event_email_idx
  on public.alumni_invites (event_id, lower(email));

create index if not exists alumni_invites_token_idx
  on public.alumni_invites (invite_token);

grant select, insert, update, delete on public.alumni_invites to service_role;
alter table public.alumni_invites enable row level security;

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values (
  'alumni_fast_pass_invite',
  'Alumni Fast-Pass invite (attendee)',
  'Sent when an organiser invites a past attendee to a locked alumni ticket on a new event.',
  'Your alumni rate for {{event_name}}',
  '<p>stub</p>',
  array[
    'user_name', 'organiser_name', 'event_name', 'event_date', 'event_time', 'event_location',
    'alumni_price', 'invite_url', 'event_url', 'source_event_name',
    'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'
  ],
  'events'
)
on conflict (slug) do nothing;
