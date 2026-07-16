-- Admin event removal: track hub-initiated cancellations and organiser notification email.

alter table public.event_cancellations
  add column if not exists removed_by_admin boolean not null default false;

comment on column public.event_cancellations.removed_by_admin is
  'True when Command Centre removed the event (not organiser self-cancellation).';

insert into public.email_templates (slug, name, description, subject, body_html, placeholders)
values (
  'event_removed_by_hub',
  'Event removed by The Hub',
  'Sent to the organiser when Command Centre force-removes an event with registrations or ticket sales.',
  'Your event {{event_name}} has been removed from The Networker Hub',
  '<p>Hi {{organiser_name}}, your event {{event_name}} was removed by The Networker Hub.</p>',
  array[
    'organiser_name',
    'event_name',
    'event_date',
    'event_time',
    'removal_reason',
    'removal_details',
    'removal_details_row',
    'refund_notice_row',
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
