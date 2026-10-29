-- Hubert Matchmaker: member "Introduce someone to The Networker UK & Hubert" invites.
-- Platform join invite (not a contact reveal). Soft cap: 5 / week for members.

create table if not exists public.hubert_hub_invites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  inviter_user_id uuid,
  inviter_attendee_id uuid references public.attendees (id) on delete set null,
  inviter_email text,
  invitee_name text not null,
  invitee_email text not null,
  note text,
  status text not null default 'sent'
    check (status in ('sent', 'failed', 'suppressed')),
  resend_id text,
  error_message text
);

create index if not exists hubert_hub_invites_inviter_week_idx
  on public.hubert_hub_invites (inviter_user_id, created_at desc);

create index if not exists hubert_hub_invites_invitee_email_idx
  on public.hubert_hub_invites (lower(invitee_email), created_at desc);

comment on table public.hubert_hub_invites is
  'Member Hub invites via Hubert Matchmaker Introduce someone CTA. Not intro-to-meet requests.';

alter table public.hubert_hub_invites enable row level security;

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
  'hubert_hub_invite',
  'Hubert Hub invite',
  'Member introduces someone to The Networker UK via Hubert (join invite — no contact reveal).',
  '{{inviter_first_name}} thought of you on The Networker UK',
  '<p>stub — see email-templates/hubert-hub-invite.html</p>',
  array[
    'invitee_name',
    'invitee_first_name',
    'inviter_name',
    'inviter_first_name',
    'invite_note',
    'invite_note_section',
    'register_url',
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
  'member'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
