-- Organiser booking-cancelled alert + Stripe Connect organiser columns

alter table public.organisers
  add column if not exists stripe_charges_enabled boolean default false,
  add column if not exists stripe_payouts_enabled boolean default false,
  add column if not exists stripe_connect_details_submitted boolean default false,
  add column if not exists stripe_connect_onboarded_at timestamptz;

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
  'organiser_booking_cancelled',
  'Booking cancelled (organiser)',
  'Notifies the organiser when an attendee cancels their booking, including refund action when required.',
  'Booking cancelled: {{attendee_name}} — {{event_name}}',
  '<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Booking cancelled – The Networker Hub</title>
  <style>
    @import url(''https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap'');
    body, table, td, p, a { margin:0; padding:0; border:0; font-size:100%; font:inherit; vertical-align:top; }
    img { border:0; display:block; max-width:100%; }
    body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background-color:#e8ecf5; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    @media only screen and (max-width:600px) {
      .email-wrapper { width:100% !important; }
      .hero-title { font-size:22px !important; }
      .mobile-pad { padding-left:20px !important; padding-right:20px !important; }
      .detail-cell { display:block !important; width:100% !important; padding:12px 0 !important; border-top:1px solid rgba(255,255,255,0.12) !important; }
      .detail-cell:first-child { border-top:none !important; padding-top:0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#e8ecf5;font-family:''DM Sans'',system-ui,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#e8ecf5;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table class="email-wrapper" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(28,32,64,0.18);">

        <tr>
          <td style="background:#1c2040;padding:32px 48px 0;text-align:center;">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_url}}" alt="The Networker Hub" width="180" style="height:auto;display:inline-block;margin:0 auto;border:0;">
            </a>
          </td>
        </tr>

        <tr>
          <td style="background:#1c2040;padding:0;text-align:center;border-bottom:1px solid rgba(74,168,240,0.25);">
            <div style="line-height:0;font-size:0;margin-top:8px;">
              <svg viewBox="0 0 600 40" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:40px;">
                <path d="M0,24 C150,46 450,4 600,24 L600,40 L0,40 Z" fill="#ffffff"/>
              </svg>
            </div>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:28px 48px 20px;text-align:center;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 16px;">
              <tr>
                <td style="width:52px;height:52px;background:#fde8e6;border-radius:50%;text-align:center;vertical-align:middle;font-size:22px;color:#c0392b;line-height:52px;">&#10005;</td>
              </tr>
            </table>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:10px;font-weight:700;color:#c0392b;text-transform:uppercase;letter-spacing:3px;margin:0 0 8px;">Booking cancelled</p>
            <h1 class="hero-title" style="font-family:''DM Sans'',system-ui,sans-serif;font-size:26px;font-weight:600;color:#1c2040;letter-spacing:-0.03em;line-height:1.15;margin:0 0 10px;">An attendee cancelled their booking</h1>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:14px;font-weight:400;color:#736b6e;line-height:1.7;margin:0;">
              Hi {{organiser_name}}, <strong style="color:#1c2040;font-weight:600;">{{attendee_name}}</strong> has cancelled their ticket for <strong style="color:#4aa8f0;font-weight:600;">{{event_name}}</strong>.
            </p>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:0 48px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:16px;">
              <tr>
                <td style="padding:24px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">Cancelled booking</p>

                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:18px;">
                    <tr>
                      <td style="width:40px;height:40px;background:#c0392b;border-radius:50%;text-align:center;vertical-align:middle;font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#ffffff;line-height:40px;">{{attendee_initial}}</td>
                      <td style="padding-left:12px;vertical-align:middle;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:17px;font-weight:600;color:#ffffff;margin:0;line-height:1.2;">{{attendee_name}}</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:12px;font-weight:400;color:rgba(255,255,255,0.6);margin:0;">{{attendee_email}}</p>
                      </td>
                    </tr>
                  </table>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid rgba(255,255,255,0.14);">
                    <tr>
                      <td class="detail-cell" style="padding:14px 12px 14px 0;width:33.33%;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:10px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px;">Ticket</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:13px;font-weight:600;color:#ffffff;margin:0;line-height:1.4;">{{ticket_name}}</p>
                      </td>
                      <td class="detail-cell" style="padding:14px 12px 14px 0;width:33.33%;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:10px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px;">Amount paid</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:13px;font-weight:600;color:#ffffff;margin:0;">{{amount_paid}}</p>
                      </td>
                      <td class="detail-cell" style="padding:14px 0;width:33.33%;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:10px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px;">Cancelled at</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:13px;font-weight:600;color:#ffffff;margin:0;">{{cancellation_time}}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        {{refund_action_row}}

        <tr>
          <td class="mobile-pad" style="padding:0 48px 24px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="background:#1c2040;border-radius:999px;">
                  <a href="{{dashboard_url}}" style="display:inline-block;padding:10px 28px;font-family:''DM Sans'',system-ui,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;">View attendees &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        {{sponsor_row}}

        <tr>
          <td style="background:#1c2040;padding:28px 48px 30px;text-align:center;border-radius:0 0 20px 20px;border-top:1px solid rgba(74,168,240,0.2);">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_url}}" alt="The Networker Hub" width="140" style="height:auto;display:inline-block;margin:0 auto 16px;border:0;">
            </a>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:12px;font-weight:600;color:#ffffff;margin:0 0 8px;">The Networker Hub</p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:11px;font-weight:400;color:rgba(255,255,255,0.55);line-height:1.8;margin:0 0 10px;">
              Operated by <strong style="font-weight:600;color:rgba(255,255,255,0.8);">The Networker Group Ltd</strong>
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:11px;font-weight:400;color:rgba(255,255,255,0.4);margin:0;">
              <a href="{{privacy_url}}" style="color:#4aa8f0;text-decoration:none;">Privacy</a>
              &nbsp;&middot;&nbsp;
              <a href="{{terms_url}}" style="color:#4aa8f0;text-decoration:none;">Terms</a>
              &nbsp;&middot;&nbsp;
              <a href="{{refunds_url}}" style="color:#4aa8f0;text-decoration:none;">Refunds</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
',
  array[
    'organiser_name', 'event_name', 'event_date', 'event_time',
    'attendee_name', 'attendee_email', 'attendee_initial',
    'ticket_name', 'amount_paid', 'cancellation_time', 'booking_time',
    'refund_action_row', 'dashboard_url', 'sponsor_row',
    'site_url', 'logo_url', 'privacy_url', 'terms_url', 'refunds_url'
  ],
  'events'
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  subject = excluded.subject,
  body_html = excluded.body_html,
  placeholders = excluded.placeholders,
  category = excluded.category,
  updated_at = now();
