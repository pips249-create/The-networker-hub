-- Weekly Hubert digest shows both November team event promos (not alternating).

update public.email_templates
set
  description =
    'Weekly digest from Hubert with nearby and popular upcoming events, plus Meet Rosie (MarTech Summit) and Meet Catherine (Business Show London) while those shows are upcoming. Marketing opt-in only.',
  updated_at = now()
where slug = 'attendee_hubert_event_concierge';
