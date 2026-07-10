-- Guest visit follow-up email: sent ~24 hours after a guest visit event ends.

alter table public.registrations
  add column if not exists guest_visit_followup_sent_at timestamptz;

comment on column public.registrations.guest_visit_followup_sent_at is
  'When the post-event guest visit follow-up email was sent.';

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values (
  'guest_visit_followup',
  'Guest visit follow-up (attendee)',
  'Sent ~24 hours after a guest visit event ends — warm follow-up with the organiser''s next event.',
  'Your guest visit with {{organiser_name}}',
  '<p>stub</p>',
  array[
    'user_name', 'event_name', 'organiser_name', 'organiser_url',
    'next_event_name', 'next_event_date', 'next_event_time', 'next_event_location',
    'next_event_url', 'next_event_section', 'cta_url', 'cta_label',
    'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'
  ],
  'events'
)
on conflict (slug) do nothing;
