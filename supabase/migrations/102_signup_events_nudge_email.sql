-- Signup events nudge email for members who have not booked yet

alter table public.attendees
  add column if not exists signup_events_nudge_sent_at timestamptz;

comment on column public.attendees.signup_events_nudge_sent_at is
  'When the first-booking events recommendation email was sent after signup.';

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values
  (
    'attendee_signup_events_nudge',
    'Signup events nudge (member)',
    'Sent a few days after signup when the member has not booked a ticket yet — nearby and popular events.',
    'Events picked for you on The Networker Hub',
    '<p>stub</p>',
    array[
      'user_name',
      'nearby_events_html',
      'popular_events_html',
      'browse_events_url',
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
