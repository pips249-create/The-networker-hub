-- Organiser claim-profile invite template (admin campaigns)

insert into public.email_templates (slug, name, description, subject, body_html, placeholders)
values (
  'organiser_claim_invite',
  'Claim your organiser profile',
  'Invite existing organisers to create an account and manage their Hub listing.',
  'Claim your profile on The Networker Hub',
  '<p>Hi {{organiser_name}},</p><p>Your group is listed on <strong>The Networker Hub</strong>. Create your free account to manage events, ticket types, and your public organiser page.</p><p><a href="{{claim_url}}">Claim your profile</a></p><p>If you did not expect this email, you can ignore it.</p><p>— The Networker Hub team</p>',
  array['organiser_name', 'claim_url', 'site_url']
)
on conflict (slug) do nothing;
