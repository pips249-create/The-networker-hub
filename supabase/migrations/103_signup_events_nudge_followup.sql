-- Day-10 signup events follow-up email

alter table public.attendees
  add column if not exists signup_events_nudge_followup_sent_at timestamptz;

comment on column public.attendees.signup_events_nudge_followup_sent_at is
  'When the second (day-10) signup events recommendation email was sent.';

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values
  (
    'attendee_signup_events_nudge_followup',
    'Signup events nudge follow-up (member)',
    'Sent about 10 days after signup if the member still has not booked — fresh event shortlist with a lighter layout.',
    'Still looking for your first event?',
    '<p>stub</p>',
    array[
      'user_name',
      'nearby_events_html',
      'popular_events_html',
      'browse_events_url',
      'opportunities_url',
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
