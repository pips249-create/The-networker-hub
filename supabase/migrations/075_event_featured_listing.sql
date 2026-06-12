-- Paid featured event listings with expiry and reminder emails.

alter table public.events
  add column if not exists featured_until timestamptz,
  add column if not exists featured_expiry_reminder_sent_at timestamptz;

comment on column public.events.featured_until is
  'When paid featured placement ends; null means no expiry (e.g. admin-set).';

comment on column public.events.featured_expiry_reminder_sent_at is
  'Set when the 2-day-before-expiry reminder email was sent.';

create index if not exists idx_events_featured_until
  on public.events(featured_until)
  where featured = true and featured_until is not null;

insert into public.email_templates (
  slug,
  name,
  description,
  subject,
  body_html,
  placeholders,
  category
)
values (
  'organiser_featured_expiry_reminder',
  'Featured listing expiry reminder',
  'Sent to organisers 2 days before their paid featured event listing expires.',
  'Your featured listing for {{event_name}} expires soon',
  '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Featured listing expiring</title>
</head>
<body style="margin:0;padding:0;background:#faf7f2;font-family:system-ui,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf7f2;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px 40px 8px;text-align:center;">
              <img src="{{logo_url}}" alt="The Networker Hub" width="160" style="height:auto;display:inline-block;">
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 24px;text-align:center;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#c9961f;text-transform:uppercase;letter-spacing:0.08em;">Featured listing</p>
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:600;color:#0d1f3c;">Your featured placement is ending soon</h1>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#4a5568;">
                Hi {{organiser_name}}, your featured listing for <strong>{{event_name}}</strong> expires on <strong>{{expiry_date}}</strong>.
                Would you like to extend it and keep premium visibility on the hub?
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;text-align:center;">
              <a href="{{extend_url}}" style="display:inline-block;padding:14px 28px;background:#c9961f;color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;">Extend featured listing</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;text-align:center;font-size:13px;color:#718096;line-height:1.5;">
              <p style="margin:0;">Choose 1 week (£15), 4 weeks (£55), or 2 months (£100) when you extend.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  array['organiser_name','event_name','expiry_date','extend_url','site_url','logo_url'],
  'organiser'
)
on conflict (slug) do nothing;
