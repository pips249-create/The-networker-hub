-- Booking confirmation email — Hub branding, hosted logo, DM Sans palette

update public.email_templates
set
  subject = 'You''re booked for {{event_name}}',
  body_html = '<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Booking confirmed – The Networker Hub</title>
  <style>
    @import url(''https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap'');
    body, table, td, p, a { margin:0; padding:0; border:0; font-size:100%; font:inherit; vertical-align:baseline; }
    img { border:0; display:block; max-width:100%; }
    body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background-color:#faf7f2; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    @media only screen and (max-width:600px) {
      .email-wrapper { width:100% !important; }
      .hero-title { font-size:26px !important; }
      .benefit-cell { display:block !important; width:100% !important; padding-bottom:12px !important; }
      .mobile-pad { padding-left:20px !important; padding-right:20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#faf7f2;font-family:''DM Sans'',system-ui,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#faf7f2;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table class="email-wrapper" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(194,153,209,0.12);">

        <tr>
          <td style="background:#f5f0e8;padding:36px 48px 0;text-align:center;border-bottom:1px solid rgba(194,153,209,0.35);">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="text-align:center;padding-bottom:24px;">
                  <img src="{{logo_url}}" alt="The Networker Hub" width="200" style="height:auto;display:inline-block;margin:0 auto;">
                  <p style="margin:10px 0 0;font-size:11px;font-weight:600;color:#736b6e;letter-spacing:3px;text-transform:uppercase;font-family:''DM Sans'',system-ui,sans-serif;">Stronger Together</p>
                </td>
              </tr>
            </table>
            <div style="line-height:0;font-size:0;">
              <svg viewBox="0 0 600 50" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:50px;">
                <path d="M0,30 C150,55 450,5 600,30 L600,50 L0,50 Z" fill="#ffffff"/>
              </svg>
            </div>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:8px 48px 24px;text-align:center;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 20px;">
              <tr>
                <td style="width:64px;height:64px;background:#ebe0f0;border-radius:50%;text-align:center;line-height:64px;font-size:28px;color:#9a7aa8;">&#10003;</td>
              </tr>
            </table>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:11px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:3px;margin:0 0 10px;">Booking confirmed</p>
            <h1 class="hero-title" style="font-family:''DM Sans'',system-ui,sans-serif;font-size:30px;font-weight:700;color:#4a4446;letter-spacing:-0.03em;line-height:1.15;margin:0 0 12px;">You&rsquo;re booked!</h1>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#736b6e;line-height:1.7;margin:0;">
              Hi {{user_name}}, thanks for booking with <strong style="color:#9a7aa8;font-weight:700;">The Networker Hub</strong>. Your ticket is confirmed &mdash; we&rsquo;ve saved the details below.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:0 48px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr><td style="border-top:1px solid #d9c4e0;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:24px 48px 0;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:linear-gradient(135deg,#4a4446 0%,#9a7aa8 100%);border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:24px 28px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:10px;font-weight:700;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:2.5px;margin:0 0 8px;">Your event</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:20px;font-weight:700;color:#ffffff;margin:0 0 6px;line-height:1.2;">{{event_name}}</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:12px;font-weight:400;color:rgba(255,255,255,0.75);margin:0 0 6px;">{{event_date}} &nbsp;&middot;&nbsp; {{event_time}}</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:12px;font-weight:400;color:rgba(255,255,255,0.75);margin:0 0 16px;">{{event_location}}</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:16px;">
                    <tr>
                      <td style="padding:10px 0;border-top:1px solid rgba(255,255,255,0.15);">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:11px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px;">Ticket</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:14px;font-weight:600;color:#ffffff;margin:0;">{{ticket_name}} &nbsp;&middot;&nbsp; {{amount_paid}}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0;border-top:1px solid rgba(255,255,255,0.15);">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:11px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1.5px;margin:0 0 4px;">Organiser</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:14px;font-weight:600;color:#ffffff;margin:0;">{{organiser_name}}</p>
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.25);border-radius:999px;">
                        <a href="{{event_url}}" style="display:inline-block;padding:8px 20px;font-family:''DM Sans'',system-ui,sans-serif;font-size:11px;font-weight:600;color:#ffffff;text-decoration:none;">View event details</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        {{meeting_link_section}}

        <tr>
          <td class="mobile-pad" style="padding:28px 48px 8px;text-align:center;">
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:14px;font-weight:400;color:#736b6e;line-height:1.7;margin:0 0 20px;">
              Add the date to your calendar and check the event page for any last-minute updates or online joining instructions.
            </p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
              <tr>
                <td style="background:#9a7aa8;border-radius:999px;text-align:center;">
                  <a href="{{event_url}}" style="display:inline-block;padding:14px 40px;font-family:''DM Sans'',system-ui,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">View your event &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 48px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr><td style="border-top:1px solid #d9c4e0;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:24px 48px 28px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;border:1px solid #d9c4e0;">
              <tr>
                <td style="padding:22px 24px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:11px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 8px;">While you&rsquo;re here</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:700;color:#4a4446;margin:0 0 8px;line-height:1.4;">Discover more events across the UK</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:13px;font-weight:400;color:#736b6e;line-height:1.65;margin:0 0 16px;">From weekly networking breakfasts to national expos &mdash; browse what&rsquo;s on near you and keep building your network.</p>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="background:#4a4446;border-radius:999px;">
                        <a href="{{site_url}}/events/" style="display:inline-block;padding:10px 28px;font-family:''DM Sans'',system-ui,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;">Browse upcoming events</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#4a4446;padding:24px 48px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td class="benefit-cell" style="text-align:center;width:33.33%;padding:0 8px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:22px;font-weight:700;color:#ffffff;margin:0;line-height:1;">27,000+</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:10px;font-weight:400;color:rgba(255,255,255,0.55);margin:4px 0 0;text-transform:uppercase;letter-spacing:1.5px;">meetings annually</p>
                </td>
                <td class="benefit-cell" style="text-align:center;width:33.33%;padding:0 8px;border-left:1px solid rgba(255,255,255,0.12);border-right:1px solid rgba(255,255,255,0.12);">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:22px;font-weight:700;color:#ffffff;margin:0;line-height:1;">50+</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:10px;font-weight:400;color:rgba(255,255,255,0.55);margin:4px 0 0;text-transform:uppercase;letter-spacing:1.5px;">events every month</p>
                </td>
                <td class="benefit-cell" style="text-align:center;width:33.33%;padding:0 8px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:22px;font-weight:700;color:#ffffff;margin:0;line-height:1;">14</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:10px;font-weight:400;color:rgba(255,255,255,0.55);margin:4px 0 0;text-transform:uppercase;letter-spacing:1.5px;">UK regions covered</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#f5f0e8;padding:28px 48px;text-align:center;border-radius:0 0 20px 20px;border-top:1px solid rgba(194,153,209,0.35);">
            <img src="{{logo_url}}" alt="The Networker Hub" width="140" style="height:auto;display:inline-block;margin:0 auto 14px;">
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:11px;font-weight:400;color:#736b6e;line-height:1.8;margin:0 0 10px;">
              The Networker Group Ltd &nbsp;&middot;&nbsp; Registered in England &amp; Wales<br>
              Magpas HQ, Barnwell Road, Huntingdon PE28 4YF &nbsp;&middot;&nbsp; Company No: 15252227
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:11px;font-weight:400;color:#9a9092;margin:0;">
              <a href="https://the-networker.co.uk/privacy-policy" style="color:#9a7aa8;text-decoration:none;">Privacy Policy</a>
              &nbsp;&middot;&nbsp;
              <a href="{{site_url}}/events/" style="color:#9a7aa8;text-decoration:none;">The Networker Hub</a>
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
  placeholders = array[
    'user_name', 'user_email', 'event_name', 'event_date', 'event_time',
    'event_location', 'event_url', 'ticket_name', 'amount_paid', 'organiser_name',
    'meeting_link', 'meeting_link_section', 'site_url', 'logo_url'
  ],
  updated_at = now()
where slug = 'booking_confirmation';
