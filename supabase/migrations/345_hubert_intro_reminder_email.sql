-- Hubert Matchmaker: seed intro reminder email template (day 5–7 follow-up).
-- Cron pauses unresponsive seed contacts after day 7 (status paused / intro_no_response).

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
  'hubert_intro_reminder',
  'Hubert intro reminder',
  'One polite reminder when a seed intro is still unanswered after 5–7 days. Then seed is paused in BOH.',
  'Hubert: gentle reminder about {{requester_name}}',
  '<p>stub — see email-templates/hubert-intro-reminder.html</p>',
  array[
    'user_name',
    'requester_name',
    'requester_title_company',
    'requester_label',
    'requester_about',
    'topic',
    'event_context',
    'accept_url',
    'decline_url',
    'dashboard_url',
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
  'attendees'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
