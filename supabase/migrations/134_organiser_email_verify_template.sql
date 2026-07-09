-- Branded organiser email verification template

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values (
  'organiser_email_verify',
  'Organiser email verification',
  'Sent when a member enables organiser access and must confirm their email.',
  'Confirm your email for organiser access',
  '<p>stub</p>',
  array[
    'user_name', 'user_email', 'verify_url',
    'site_url', 'logo_url', 'logo_footer_url',
    'privacy_url', 'terms_url', 'refunds_url', 'contact_url', 'support_email'
  ],
  'organiser'
)
on conflict (slug) do nothing;
