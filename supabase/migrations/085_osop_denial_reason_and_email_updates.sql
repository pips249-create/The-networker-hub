-- Optional organiser note when denying OSOP applications + refreshed email templates

alter table public.registrations
  add column if not exists application_denial_reason text;

comment on column public.registrations.application_denial_reason is
  'Optional note from the organiser when denying an OSOP application; included in the attendee email when set.';

update public.email_templates
set
  placeholders = array[
    'user_name',
    'user_email',
    'event_name',
    'event_url',
    'browse_events_url',
    'organiser_name',
    'site_url',
    'logo_url',
    'logo_footer_url',
    'denial_closing',
    'denial_reason_block'
  ],
  updated_at = now()
where slug = 'application_denied';
