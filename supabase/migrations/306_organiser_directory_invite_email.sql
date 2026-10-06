-- Invitation emailed when an admin adds a networking group.

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
  'organiser_directory_invite',
  'New group directory invitation',
  'Sent when a networking group is added in admin — invites them to look at The Networker UK, their page, and the events directory. Listing is free.',
  'An invitation for {{group_name}} — The Networker UK',
  '<p>stub — see email-templates/organiser-directory-invite.html</p>',
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
