-- Invitation subject: you haven't heard of us, but we've heard of you.

update public.email_templates
set
  subject = 'You haven''t heard of us, but we''ve heard of {{group_name}}',
  updated_at = now()
where slug = 'organiser_directory_invite';
