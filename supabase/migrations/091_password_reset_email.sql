-- Branded password reset email template

insert into public.email_templates (slug, name, description, subject, body_html, placeholders, category)
values (
  'password_reset',
  'Password reset',
  'Sent when a member requests a password reset link.',
  'Reset your Networker Hub password',
  '<p>stub</p>',
  array[
    'user_name', 'reset_url',
    'site_url', 'logo_url', 'logo_footer_url',
    'privacy_url', 'terms_url', 'contact_url'
  ],
  'auth'
)
on conflict (slug) do nothing;
