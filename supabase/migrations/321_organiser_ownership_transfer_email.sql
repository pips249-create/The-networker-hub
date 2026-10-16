-- Transactional email when staff approve a claim request or transfer a page.
-- Cold outreach keeps organiser_claim_invite ("It's FREE to claim").

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
  'organiser_ownership_transfer',
  'Organiser ownership transfer',
  'Sent when staff approve a claim request or transfer a page to a new owner who still needs to sign in.',
  'Your request to manage {{organiser_name}} is approved',
  '<p>stub — see email-templates/organiser-ownership-transfer.html</p>',
  array[
    'organiser_name',
    'claim_url',
    'lead',
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
  'organisers'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
