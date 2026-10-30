-- Organiser co-marketing: pre-event “Who do you want to meet?” email (Hubert Matchmaker).

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
  'hubert_organiser_pre_event',
  'Hubert organiser pre-event',
  'Copy organisers can send ~48h before an event so guests ask Hubert who to meet. Soft-launch only when Matchmaker is on for members.',
  'Who do you want to meet at {{event_name}}?',
  '<p>stub — see email-templates/hubert-organiser-pre-event.html</p>',
  array[
    'organiser_name',
    'attendee_first_name',
    'event_name',
    'event_when_phrase',
    'meet_people_url',
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
  'organisers'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
