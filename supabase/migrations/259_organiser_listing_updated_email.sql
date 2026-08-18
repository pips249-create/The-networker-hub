-- Admin-to-organiser note when Command Centre edits a live listing.

insert into public.email_templates (slug, name, description, subject, body_html, placeholders)
values (
  'organiser_listing_updated_by_hub',
  'Listing updated by The Hub',
  'Sent when Command Centre emails a networking group about a change on their event or organiser listing.',
  'We''ve updated {{listing_label}} on The Networker Hub',
  '<p>Hi {{organiser_name}}, we have updated {{listing_kind}} {{listing_label}}.</p>',
  array[
    'organiser_name',
    'listing_label',
    'listing_kind',
    'change_reason',
    'admin_message_row',
    'listing_url',
    'cta_label',
    'dashboard_url',
    'site_url',
    'logo_url',
    'logo_footer_url',
    'privacy_url',
    'terms_url',
    'refunds_url',
    'contact_url',
    'unsubscribe_url',
    'support_email',
    'sponsor_row'
  ]
)
on conflict (slug) do nothing;
