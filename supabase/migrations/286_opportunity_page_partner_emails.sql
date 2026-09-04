-- Opportunity Page Partner payment welcome email template.

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values
  (
    'opportunity_page_partner_payment_welcome',
    'Opportunity Page Partner payment welcome',
    'Sent after Opportunity Page Partner Stripe checkout completes — logo and link instructions.',
    'Opportunity Page Partner confirmed — send your logo & link',
    '<p>stub</p>',
    array['contact_name', 'advertising_url', 'creative_email', 'monthly_note', 'site_url', 'logo_url', 'logo_footer_url', 'privacy_url', 'terms_url', 'contact_url'],
    'advertising'
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  placeholders = excluded.placeholders,
  category = excluded.category;
