-- Organiser conduct warnings and hub suspensions (Command Centre moderation).

create table if not exists public.organiser_moderation_actions (
  id                      uuid primary key default uuid_generate_v4(),
  created_at              timestamptz not null default now(),
  organiser_id            uuid not null references public.organisers(id) on delete cascade,
  action_type             text not null
    check (action_type in ('warning', 'suspension', 'reinstatement')),
  reason                  text not null,
  details                 text,
  event_id                uuid references public.events(id) on delete set null,
  event_cancellation_id   uuid references public.event_cancellations(id) on delete set null,
  created_by              uuid references auth.users(id) on delete set null
);

create index if not exists organiser_moderation_actions_organiser_id_idx
  on public.organiser_moderation_actions(organiser_id, created_at desc);

create unique index if not exists organiser_moderation_actions_event_cancellation_uidx
  on public.organiser_moderation_actions(event_cancellation_id)
  where event_cancellation_id is not null;

comment on table public.organiser_moderation_actions is
  'Hub conduct warnings, suspensions, and reinstatements for organiser profiles.';

grant select, insert, update, delete on public.organiser_moderation_actions to service_role;
alter table public.organiser_moderation_actions enable row level security;

insert into public.email_templates (slug, name, description, subject, body_html, placeholders)
values
  (
    'organiser_hub_warning',
    'Organiser Hub conduct warning',
    'Sent when an organiser receives a conduct warning from Command Centre.',
    'Warning {{warning_count}} of {{warning_limit}} — The Networker Hub',
    '<p>Hi {{organiser_name}}, you have received a conduct warning from The Networker Hub.</p>',
    array[
      'organiser_name',
      'warning_count',
      'warning_limit',
      'warning_reason',
      'warning_details_row',
      'suspension_notice_row',
      'site_url',
      'logo_url',
      'logo_footer_url',
      'privacy_url',
      'terms_url',
      'contact_url',
      'sponsor_row'
    ]
  ),
  (
    'organiser_hub_suspended',
    'Organiser Hub account suspended',
    'Sent when an organiser profile is suspended after repeated conduct warnings.',
    'Your organiser account has been suspended — The Networker Hub',
    '<p>Hi {{organiser_name}}, your organiser account on The Networker Hub has been suspended.</p>',
    array[
      'organiser_name',
      'warning_count',
      'suspension_reason',
      'suspension_details_row',
      'site_url',
      'logo_url',
      'logo_footer_url',
      'privacy_url',
      'terms_url',
      'contact_url',
      'sponsor_row'
    ]
  )
on conflict (slug) do nothing;
