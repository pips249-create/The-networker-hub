-- Replace "only N events left" organiser nudge with "no event added in 4 months".

comment on column public.organisers.low_upcoming_events_nudge_sent_at is
  'When the organiser was last emailed about not adding an event for ~4 months (reused from the retired low-upcoming-events nudge).';

update public.email_templates
set
  name = 'Organiser no recent event (4 months)',
  description = 'Sent when a claimed organiser has not created an event for about 4 months. Reminds them to list their next date.',
  subject = 'It''s been a while — add your next event',
  placeholders = array[
    'organiser_name',
    'inactive_months',
    'create_event_url',
    'dashboard_url',
    'site_url',
    'logo_url',
    'logo_footer_url',
    'privacy_url',
    'terms_url',
    'contact_url'
  ],
  updated_at = now()
where slug = 'organiser_low_upcoming_events';
