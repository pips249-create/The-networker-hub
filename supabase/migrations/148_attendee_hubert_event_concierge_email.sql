-- Monthly Hubert Event Concierge digest for marketing-opted-in members.

alter table public.attendees
  add column if not exists hubert_event_concierge_sent_at timestamptz;

comment on column public.attendees.hubert_event_concierge_sent_at is
  'When the monthly Hubert Event Concierge recommendation email was last sent.';

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values
  (
    'attendee_hubert_event_concierge',
    'Hubert Event Concierge (monthly)',
    'Monthly digest from Hubert with nearby and popular upcoming events. Marketing opt-in only.',
    'Hubert''s event picks for {{month_label}}',
    '<p>stub</p>',
    array[
      'user_name',
      'month_label',
      'nearby_events_html',
      'popular_events_html',
      'browse_events_url',
      'account_settings_url',
      'site_url',
      'logo_url',
      'logo_footer_url',
      'privacy_url',
      'terms_url',
      'contact_url',
      'sponsor_row',
      'mini_sponsors_row'
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
