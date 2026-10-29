-- Hubert Matchmaker: intro requests (double opt-in) + Hub intro thread messages.
-- Contact details are never shared via Matchmaker — Accept opens a Hub-mediated thread.

create table if not exists public.hubert_intro_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  requester_attendee_id uuid not null references public.attendees (id) on delete cascade,
  target_attendee_id uuid references public.attendees (id) on delete set null,
  target_seed_id uuid references public.hubert_match_seed (id) on delete set null,
  target_email text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'blocked')),
  topic text not null,
  source text not null default 'search'
    check (source in ('search', 'nominate', 'overview', 'staff')),
  event_id uuid references public.events (id) on delete set null,
  event_title text,
  emailed_at timestamptz,
  responded_at timestamptz,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  reminder_sent_at timestamptz,
  thread_opened_at timestamptz,
  decline_reason text
);

alter table public.hubert_intro_requests drop constraint if exists hubert_intro_requests_target_check;
alter table public.hubert_intro_requests
  add constraint hubert_intro_requests_target_check
  check (target_attendee_id is not null or target_seed_id is not null);

create unique index if not exists hubert_intro_requests_open_member_idx
  on public.hubert_intro_requests (requester_attendee_id, target_attendee_id)
  where status = 'pending' and target_attendee_id is not null;

create unique index if not exists hubert_intro_requests_open_seed_idx
  on public.hubert_intro_requests (requester_attendee_id, target_seed_id)
  where status = 'pending' and target_seed_id is not null;

create index if not exists hubert_intro_requests_requester_created_idx
  on public.hubert_intro_requests (requester_attendee_id, created_at desc);

create index if not exists hubert_intro_requests_target_member_idx
  on public.hubert_intro_requests (target_attendee_id, status, created_at desc)
  where target_attendee_id is not null;

create index if not exists hubert_intro_requests_target_email_idx
  on public.hubert_intro_requests (lower(target_email), status)
  where target_email is not null;

create index if not exists hubert_intro_requests_expires_idx
  on public.hubert_intro_requests (expires_at)
  where status = 'pending';

comment on table public.hubert_intro_requests is
  'Hubert Matchmaker intro requests. Double opt-in; no contact details exchanged.';

create table if not exists public.hubert_intro_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  intro_request_id uuid not null references public.hubert_intro_requests (id) on delete cascade,
  sender_attendee_id uuid references public.attendees (id) on delete set null,
  sender_kind text not null default 'member'
    check (sender_kind in ('hubert', 'member')),
  body text not null
);

create index if not exists hubert_intro_messages_intro_idx
  on public.hubert_intro_messages (intro_request_id, created_at asc);

comment on table public.hubert_intro_messages is
  'Hubert-mediated intro thread messages (no email/phone/LinkedIn).';

alter table public.hubert_intro_requests enable row level security;
alter table public.hubert_intro_messages enable row level security;

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
  'hubert_intro_request',
  'Hubert intro request',
  'Hubert emails B when a member requests an introduction via Matchmaker.',
  'Hubert: {{requester_name}} would like to connect',
  '<p>stub — see email-templates/hubert-intro-request.html</p>',
  array[
    'user_name',
    'requester_name',
    'topic',
    'event_context',
    'accept_url',
    'decline_url',
    'dashboard_url',
    'site_url',
    'logo_url',
    'logo_footer_url',
    'privacy_url',
    'terms_url',
    'refunds_url',
    'contact_url',
    'support_email',
    'sponsor_row',
    'unsubscribe_url'
  ],
  'attendees'
),
(
  'hubert_intro_accepted',
  'Hubert intro accepted',
  'Hubert notifies A when B accepts an introduction.',
  'Hubert: {{counterpart_name}} accepted your introduction',
  '<p>stub — see email-templates/hubert-intro-accepted.html</p>',
  array[
    'user_name',
    'counterpart_name',
    'topic',
    'thread_url',
    'dashboard_url',
    'site_url',
    'logo_url',
    'logo_footer_url',
    'privacy_url',
    'terms_url',
    'refunds_url',
    'contact_url',
    'support_email',
    'sponsor_row',
    'unsubscribe_url'
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
