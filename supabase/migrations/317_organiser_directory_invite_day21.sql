-- Day 21 note after a directory invitation, when the page is still unclaimed.

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
  'organiser_directory_invite_day21',
  'Directory invite day-21 note',
  'Sent 21 days after the directory invitation when the group has not claimed their page.',
  'A quick update for {{group_name}}',
  '<p>stub — see email-templates/organiser-directory-invite-day21.html</p>',
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
    'unsubscribe_url',
    'hosts_line'
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
