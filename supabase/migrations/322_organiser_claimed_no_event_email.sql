-- One note after a page is claimed, when the group still has not added an event.

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
  'organiser_claimed_no_event',
  'Claimed page, no event yet',
  'Sent three days after a group claims their page, if they still have not added an event. One note only.',
  'Add a meeting for {{group_name}}',
  '<p>stub — see email-templates/organiser-claimed-no-event.html</p>',
  array[
    'group_name',
    'organiser_name',
    'page_url',
    'organiser_url',
    'claim_url',
    'events_url',
    'list_event_url',
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
    'groups_html',
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
