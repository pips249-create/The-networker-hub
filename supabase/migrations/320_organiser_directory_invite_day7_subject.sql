-- Day 7 subject should stand on its own, not look like a second copy of the first invite.

update public.email_templates
set
  subject = 'Your next guests are already looking for {{group_name}}',
  updated_at = now()
where slug = 'organiser_directory_invite_day7';
