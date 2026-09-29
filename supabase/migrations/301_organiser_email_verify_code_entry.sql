-- Confirmation email is file-backed. The message shows the 6-digit code.
-- The link opens the form and does not contain the code.

update public.email_templates
set
  placeholders = array[
    'user_name', 'user_email', 'verify_code', 'verify_url',
    'site_url', 'logo_url', 'logo_footer_url',
    'privacy_url', 'terms_url', 'refunds_url', 'contact_url', 'support_email'
  ],
  body_html = '<p>stub — see email-templates/organiser-email-verify.html</p>',
  updated_at = now()
where slug = 'organiser_email_verify';
