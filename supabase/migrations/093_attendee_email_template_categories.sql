-- Reclassify attendee-facing lifecycle emails for Command Centre grouping

update public.email_templates
set category = 'attendees',
    updated_at = now()
where slug in (
  'post_event_review_request',
  'meeting_link_added',
  'osop_payment_reminder',
  'application_received',
  'application_approved',
  'application_denied',
  'attendee_reengagement',
  'saved_organiser_new_listing',
  'password_reset'
)
  and category is distinct from 'attendees';
