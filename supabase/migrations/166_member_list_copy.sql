-- Prefer British English "member list" wording in email template metadata.
-- Branded HTML subjects already come from api/_lib/branded-email-templates.js.

update public.email_templates
set
  name = 'Member list invite (attendee)',
  description = 'Sent when an organiser adds someone to their member list.',
  subject = '{{organiser_name}} added you to their member list on The Networker Hub',
  updated_at = now()
where slug = 'member_roster_invite';

update public.email_templates
set
  name = 'Member list welcome (existing account)',
  description = 'Sent when an organiser adds someone who already has a Hub account to their member list.',
  subject = '{{organiser_name}} added you to their member list',
  updated_at = now()
where slug = 'member_roster_existing';
