-- Team editor invite email template

insert into public.email_templates (slug, name, description, subject, body_html, placeholders)
values (
  'organiser_team_invite',
  'Organiser team editor invite',
  'Invite a colleague to help manage events as an editor on an organiser account.',
  '{{inviter_name}} invited you to help manage {{account_name}}',
  '<p>Hi there,</p><p><strong>{{inviter_name}}</strong> has invited you as an editor on <strong>{{account_name}}</strong>.</p><p><a href="{{accept_url}}">Accept invite and sign in</a></p><p>Editors can create and edit events, manage attendees, and view revenue. They cannot invite team members or delete events.</p>',
  array['inviter_name', 'account_name', 'accept_url', 'workspace_url', 'site_url']
)
on conflict (slug) do nothing;
