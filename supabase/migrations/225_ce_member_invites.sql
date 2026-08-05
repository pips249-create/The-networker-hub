-- Category Exclusivity: organiser can invite Membership list people to book
-- without applying (open applications remain for non-members).

create table if not exists public.ce_member_invites (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  organiser_id uuid not null references public.organisers(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  roster_member_id uuid references public.organiser_member_roster(id) on delete set null,
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

create index if not exists ce_member_invites_event_email_idx
  on public.ce_member_invites (event_id, lower(email));

create index if not exists ce_member_invites_token_idx
  on public.ce_member_invites (invite_token);

grant select, insert, update, delete on public.ce_member_invites to service_role;
alter table public.ce_member_invites enable row level security;

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values (
  'ce_member_invite',
  'Category Exclusivity member invite',
  'Sent when an organiser invites Membership list people to book a Category Exclusivity event without applying.',
  'You''re invited to book {{event_name}}',
  '<p>stub — see email-templates/ce-member-invite.html</p>',
  array[
    'user_name', 'organiser_name', 'event_name', 'event_date', 'event_time', 'event_location',
    'ticket_price', 'invite_url', 'event_url', 'cta_label',
    'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'
  ],
  'events'
)
on conflict (slug) do nothing;
