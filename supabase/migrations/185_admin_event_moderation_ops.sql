-- Admin moderation: reinstate cancelled events + organiser unpublish notification email.

alter table public.event_cancellations
  add column if not exists reinstated_at timestamptz,
  add column if not exists reinstated_by uuid references auth.users(id) on delete set null;

comment on column public.event_cancellations.reinstated_at is
  'When Command Centre reinstated a cancelled event (mistaken removal).';
comment on column public.event_cancellations.reinstated_by is
  'Admin user who reinstated the event listing.';

insert into public.email_templates (slug, name, description, subject, body_html, placeholders)
values (
  'event_unpublished_by_hub',
  'Event unpublished by The Hub',
  'Sent to the organiser when Command Centre unpublishes an event listing (bookings kept).',
  'Your event {{event_name}} has been unpublished on The Networker Hub',
  '<p>Hi {{organiser_name}}, your event {{event_name}} was unpublished on The Networker Hub.</p>',
  array[
    'organiser_name',
    'event_name',
    'event_date',
    'event_time',
    'removal_reason',
    'removal_details',
    'removal_details_row',
    'dashboard_url',
    'site_url',
    'logo_url',
    'logo_footer_url',
    'privacy_url',
    'terms_url',
    'refunds_url',
    'sponsor_row'
  ]
)
on conflict (slug) do nothing;
