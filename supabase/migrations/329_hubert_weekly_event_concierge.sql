-- Convert Hubert Event Concierge from monthly to weekly popular-events digest.
-- Adds meet_rosie_html / week_label placeholders for The MarTech Summit promo.

comment on column public.attendees.hubert_event_concierge_sent_at is
  'When the weekly Hubert Event Concierge recommendation email was last sent.';

update public.email_templates
set
  name = 'Hubert Event Concierge (weekly)',
  description =
    'Weekly digest from Hubert with nearby and popular upcoming events, alternating Meet Rosie (MarTech Summit) and Meet Catherine (Business Show London) while those shows are upcoming. Marketing opt-in only.',
  subject = 'Hubert''s weekly event picks — week of {{week_label}}',
  placeholders = array[
    'user_name',
    'week_label',
    'month_label',
    'nearby_events_html',
    'popular_events_html',
    'meet_rosie_html',
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
  updated_at = now()
where slug = 'attendee_hubert_event_concierge';
