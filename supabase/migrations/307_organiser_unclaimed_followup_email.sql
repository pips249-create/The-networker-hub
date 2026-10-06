-- Reminder for networking groups that have not claimed their page.

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
  'organiser_unclaimed_followup',
  'Unclaimed group reminder',
  'Sent from admin to a networking group that has not claimed their page yet.',
  '{{group_name}} is still unclaimed — The Networker UK',
  '<p>stub — see email-templates/organiser-unclaimed-followup.html</p>',
  array[
    'group_name',
    'organiser_name',
    'page_url',
    'organiser_url',
    'claim_url',
    'events_url',
    'add_event_url',
    'contact_url',
    'site_url',
    'logo_url',
    'logo_footer_url',
    'privacy_url',
    'terms_url',
    'refunds_url',
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
