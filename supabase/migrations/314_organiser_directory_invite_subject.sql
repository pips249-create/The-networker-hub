-- Invitation subject matches the headline: we love what you're doing at the group.

update public.email_templates
set
  subject = 'We love what you''re doing at {{group_name}}',
  updated_at = now()
where slug = 'organiser_directory_invite';
