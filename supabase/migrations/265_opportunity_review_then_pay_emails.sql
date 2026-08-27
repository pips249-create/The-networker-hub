-- Review-then-pay opportunity listing emails (pending review + approved-awaiting-payment).

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values
  (
    'opportunity_listing_pending_review',
    'Opportunity listing pending review (lister)',
    'Sent when an organiser submits a business opportunity for admin review (before payment).',
    'Your listing is pending review — {{opportunity_title}}',
    '<p>stub</p>',
    array[
      'owner_name',
      'opportunity_title',
      'opportunity_edit_url',
      'dashboard_url',
      'opportunity_details_rows',
      'site_url',
      'logo_url',
      'logo_footer_url',
      'privacy_url',
      'terms_url',
      'contact_url',
      'unsubscribe_url',
      'support_email'
    ],
    'opportunities'
  ),
  (
    'opportunity_listing_approved_pay',
    'Opportunity listing approved — pay to go live (lister)',
    'Sent when admin approves a listing that still needs the monthly Stripe subscription to publish.',
    'Approved — pay to go live — {{opportunity_title}}',
    '<p>stub</p>',
    array[
      'owner_name',
      'opportunity_title',
      'pay_url',
      'checkout_url',
      'opportunity_edit_url',
      'dashboard_url',
      'opportunity_details_rows',
      'site_url',
      'logo_url',
      'logo_footer_url',
      'privacy_url',
      'terms_url',
      'contact_url',
      'unsubscribe_url',
      'support_email'
    ],
    'opportunities'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
