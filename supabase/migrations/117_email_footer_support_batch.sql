-- Email footer branding + support email (hello@thenetworkerhub.com)

update public.email_templates
set body_html = '<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Welcome to The Networker Hub</title>
  <style>
    @import url(''https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap'');
    body, table, td, p, a { margin:0; padding:0; border:0; font-size:100%; font:inherit; vertical-align:top; }
    img { border:0; display:block; max-width:100%; }
    body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background-color:#faf7f2; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    @media only screen and (max-width:600px) {
      .email-wrapper { width:100% !important; }
      .hero-title { font-size:24px !important; }
      .mobile-pad { padding-left:20px !important; padding-right:20px !important; }
      .feature-cell { display:block !important; width:100% !important; padding:14px 0 !important; border-top:1px solid rgba(194,153,209,0.35) !important; }
      .feature-cell:first-child { border-top:none !important; padding-top:0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#faf7f2;font-family:''DM Sans'',system-ui,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#faf7f2;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table class="email-wrapper" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(74,68,70,0.10);">

        <tr>
          <td style="background:#f5f0e8;padding:32px 48px 0;text-align:center;">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_url}}" alt="The Networker Hub" width="240" style="height:auto;display:inline-block;margin:0 auto;border:0;max-width:240px;">
            </a>
          </td>
        </tr>

        <tr>
          <td style="background:#f5f0e8;padding:0;text-align:center;border-bottom:1px solid rgba(194,153,209,0.35);">
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
                <td style="width:52px;height:52px;background:#ebe0f0;border-radius:50%;text-align:center;vertical-align:middle;font-size:24px;color:#9a7aa8;line-height:52px;">&#9733;</td>
              </tr>
            </table>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Welcome</p>
            <h1 class="hero-title" style="font-family:''DM Sans'',system-ui,sans-serif;font-size:28px;font-weight:600;color:#4a4446;letter-spacing:-0.03em;line-height:1.15;margin:0 0 10px;">Your Hub account is ready</h1>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:400;color:#635c5e;line-height:1.7;margin:0;">
              Hi {{user_name}}, welcome to <strong style="color:#9a7aa8;font-weight:600;">The Networker Hub</strong>. Browse events, book tickets, explore business opportunities, and keep everything in one place.
            </p>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:0 48px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;border:1px solid #d9c4e0;">
              <tr>
                <td style="padding:22px 24px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">What you can do in My Hub</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td class="feature-cell" style="padding:0 0 12px;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 4px;">Upcoming events &amp; tickets</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.6;margin:0;">See what you&rsquo;ve booked and open event details any time.</p>
                      </td>
                    </tr>
                    <tr>
                      <td class="feature-cell" style="padding:12px 0;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 4px;">Payments &amp; receipts</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.6;margin:0;">Booking references and payment history in one dashboard.</p>
                      </td>
                    </tr>
                    <tr>
                      <td class="feature-cell" style="padding:12px 0;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 4px;">Saved events &amp; reviews</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.6;margin:0;">Favourite events to watch and leave feedback after you attend.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:0 48px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#452d5c;border-radius:14px;">
              <tr>
                <td style="padding:22px 24px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#d9c4e0;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Business opportunities</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0 0 8px;line-height:1.35;">More than events</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:rgba(255,255,255,0.82);line-height:1.65;margin:0 0 14px;">Explore franchises, partnerships, side hustles and other listings on our <strong style="color:#ffffff;font-weight:600;">Business opportunities</strong> page — free to browse, and you can enquire straight from your Hub account.</p>
                  <a href="{{opportunities_url}}" style="display:inline-block;padding:14px 28px;background:#9a7aa8;border-radius:999px;color:#ffffff;font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;text-decoration:none;">Browse business opportunities &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:0 48px 24px;text-align:center;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 12px;">
              <tr>
                <td style="background:#4a4446;border-radius:999px;">
                  <a href="{{hub_account_url}}" style="display:inline-block;padding:14px 32px;font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Go to My Hub &rarr;</a>
                </td>
              </tr>
            </table>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
              <tr>
                <td style="background:#ffffff;border:1px solid #d9c4e0;border-radius:999px;">
                  <a href="{{browse_events_url}}" style="display:inline-block;padding:14px 28px;font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;text-decoration:none;">Browse upcoming events</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="background:#1c2040;padding:28px 48px 32px;text-align:center;border-radius:0 0 20px 20px;">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_footer_url}}" alt="The Networker Hub" width="200" style="height:auto;display:inline-block;margin:0 auto 16px;border:0;max-width:200px;">
            </a>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:rgba(255,255,255,0.55);line-height:1.7;margin:0 0 10px;">
              Operated by The Networker Group Ltd &nbsp;&middot;&nbsp; Company No. 15252227<br>
              <a href="mailto:{{support_email}}" style="color:#4aa8f0;text-decoration:none;">{{support_email}}</a>
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:rgba(255,255,255,0.55);margin:0;">
              <a href="{{privacy_url}}" style="color:#4aa8f0;text-decoration:none;">Privacy</a>
              &nbsp;&middot;&nbsp;
              <a href="{{terms_url}}" style="color:#4aa8f0;text-decoration:none;">Terms</a>
              &nbsp;&middot;&nbsp;
              <a href="{{refunds_url}}" style="color:#4aa8f0;text-decoration:none;">Refunds</a>
              &nbsp;&middot;&nbsp;
              <a href="{{contact_url}}" style="color:#4aa8f0;text-decoration:none;">Contact</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
', updated_at = now()
where slug = 'account_welcome';

update public.email_templates
set body_html = '<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Tickets on sale – The Networker Hub</title>
  <style>
    @import url(''https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap'');
    body, table, td, p, a { margin:0; padding:0; border:0; font-size:100%; font:inherit; vertical-align:top; }
    img { border:0; display:block; max-width:100%; }
    body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background-color:#faf7f2; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    @media only screen and (max-width:600px) {
      .email-wrapper { width:100% !important; }
      .hero-title { font-size:24px !important; }
      .mobile-pad { padding-left:20px !important; padding-right:20px !important; }
      .detail-cell { display:block !important; width:100% !important; padding:12px 0 !important; border-top:1px solid rgba(255,255,255,0.12) !important; }
      .detail-cell:first-child { border-top:none !important; padding-top:0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#faf7f2;font-family:''DM Sans'',system-ui,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#faf7f2;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table class="email-wrapper" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(74,68,70,0.10);">

        <tr>
          <td style="background:#f5f0e8;padding:32px 48px 0;text-align:center;">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_url}}" alt="The Networker Hub" width="240" style="height:auto;display:inline-block;margin:0 auto;border:0;max-width:240px;">
            </a>
          </td>
        </tr>

        {{sponsor_row}}

        <tr>
          <td style="background:#f5f0e8;padding:0;text-align:center;border-bottom:1px solid rgba(194,153,209,0.35);">
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
                <td style="width:52px;height:52px;background:#ebe0f0;border-radius:50%;text-align:center;vertical-align:middle;font-size:24px;color:#9a7aa8;line-height:52px;">&#9733;</td>
              </tr>
            </table>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Saved event</p>
            <h1 class="hero-title" style="font-family:''DM Sans'',system-ui,sans-serif;font-size:28px;font-weight:600;color:#4a4446;letter-spacing:-0.03em;line-height:1.15;margin:0 0 10px;">Tickets are on sale</h1>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:400;color:#635c5e;line-height:1.7;margin:0;">
              Hi {{user_name}}, you saved <strong style="color:#9a7aa8;font-weight:600;">{{event_name}}</strong> &mdash; ticket sales are open. Book before they sell out.
            </p>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:0 48px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#4a4446;border-radius:16px;">
              <tr>
                <td style="padding:24px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Your saved event</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:19px;font-weight:600;color:#ffffff;margin:0 0 16px;line-height:1.3;">{{event_name}}</p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td class="detail-cell" style="padding:0 0 10px;font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.5;">
                        <span style="color:rgba(255,255,255,0.55);">Date</span><br>
                        <span style="color:#ffffff;font-weight:600;">{{event_date}}</span>
                      </td>
                    </tr>
                    <tr>
                      <td class="detail-cell" style="padding:0 0 10px;font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.5;">
                        <span style="color:rgba(255,255,255,0.55);">Time</span><br>
                        <span style="color:#ffffff;font-weight:600;">{{event_time}}</span>
                      </td>
                    </tr>
                    <tr>
                      <td class="detail-cell" style="padding:0;font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.5;">
                        <span style="color:rgba(255,255,255,0.55);">Location</span><br>
                        <span style="color:#ffffff;font-weight:600;">{{event_location}}</span>
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:18px;">
                    <tr>
                      <td style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:999px;">
                        <a href="{{event_url}}" style="display:inline-block;padding:14px 28px;font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">Book your ticket &rarr;</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:0 48px 24px;text-align:center;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
              <tr>
                <td style="background:#ffffff;border:1px solid #d9c4e0;border-radius:999px;">
                  <a href="{{hub_account_url}}#saved" style="display:inline-block;padding:14px 28px;font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;text-decoration:none;">View saved events in My Hub</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        {{mini_sponsors_row}}
        <tr>
          <td style="background:#f5f0e8;padding:28px 48px 30px;text-align:center;border-radius:0 0 20px 20px;border-top:1px solid rgba(194,153,209,0.35);">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_footer_url}}" alt="The Networker Hub" width="200" style="height:auto;display:inline-block;margin:0 auto 16px;border:0;max-width:200px;">
            </a>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.8;margin:0 0 10px;">
              Operated by <strong style="font-weight:600;color:#4a4446;">The Networker Group Ltd</strong><br>
              Registered in England &amp; Wales &nbsp;&middot;&nbsp; Company No. 15252227 &nbsp;&middot;&nbsp; VAT No. 454 4092 94<br>
              Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;margin:0 0 14px;">
              <a href="mailto:{{support_email}}" style="color:#9a7aa8;text-decoration:none;font-weight:600;">{{support_email}}</a>
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#7a7274;margin:0;">
              <a href="{{privacy_url}}" style="color:#9a7aa8;text-decoration:none;">Privacy</a>
              &nbsp;&middot;&nbsp;
              <a href="{{terms_url}}" style="color:#9a7aa8;text-decoration:none;">Terms</a>
              &nbsp;&middot;&nbsp;
              <a href="{{refunds_url}}" style="color:#9a7aa8;text-decoration:none;">Refunds</a>
              &nbsp;&middot;&nbsp;
              <a href="{{contact_url}}" style="color:#9a7aa8;text-decoration:none;">Contact</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
', updated_at = now()
where slug = 'saved_event_tickets_open';

update public.email_templates
set body_html = '<!DOCTYPE html>
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
    body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background-color:#faf7f2; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    @media only screen and (max-width:600px) {
      .email-wrapper { width:100% !important; }
      .hero-title { font-size:24px !important; }
      .mobile-pad { padding-left:20px !important; padding-right:20px !important; }
      .detail-cell { display:block !important; width:100% !important; padding:12px 0 !important; border-top:1px solid rgba(255,255,255,0.12) !important; }
      .detail-cell:first-child { border-top:none !important; padding-top:0 !important; }
      .info-cell { display:block !important; width:100% !important; padding-bottom:14px !important; border-left:none !important; border-right:none !important; border-top:1px solid rgba(255,255,255,0.12) !important; }
      .info-cell:first-child { border-top:none !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#faf7f2;font-family:''DM Sans'',system-ui,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#faf7f2;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table class="email-wrapper" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(74,68,70,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:#f5f0e8;padding:32px 48px 0;text-align:center;border-bottom:1px solid rgba(194,153,209,0.35);">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_url}}" alt="The Networker Hub" width="240" style="height:auto;display:inline-block;margin:0 auto;border:0;max-width:240px;">
            </a>
            <div style="line-height:0;font-size:0;margin-top:24px;">
              <svg viewBox="0 0 600 40" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:40px;">
                <path d="M0,24 C150,46 450,4 600,24 L600,40 L0,40 Z" fill="#ffffff"/>
              </svg>
            </div>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td class="mobile-pad" style="padding:28px 48px 20px;text-align:center;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 16px;">
              <tr>
                <td style="width:52px;height:52px;background:#f1f5f9;border-radius:50%;text-align:center;vertical-align:middle;font-size:24px;line-height:52px;">&#10005;</td>
              </tr>
            </table>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Booking cancelled</p>
            <h1 class="hero-title" style="font-family:''DM Sans'',system-ui,sans-serif;font-size:28px;font-weight:600;color:#4a4446;letter-spacing:-0.03em;line-height:1.15;margin:0 0 10px;">Your booking has been cancelled</h1>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:400;color:#635c5e;line-height:1.7;margin:0;">
              Hi {{user_name}}, your booking for <strong style="color:#4a4446;">{{event_name}}</strong> has been cancelled. We''ve confirmed this below and noted what happens next.
            </p>
          </td>
        </tr>

        <!-- Cancelled booking card -->
        <tr>
          <td class="mobile-pad" style="padding:0 48px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#4a4446;border-radius:16px;">
              <tr>
                <td style="padding:24px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Cancelled booking</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:19px;font-weight:600;color:#ffffff;margin:0 0 16px;line-height:1.3;">{{event_name}}</p>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="padding:0 0 10px;font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;line-height:1.5;">
                        <span style="color:rgba(255,255,255,0.55);">Event date</span><br>
                        <span style="color:#ffffff;font-weight:600;">{{event_date}} &nbsp;&middot;&nbsp; {{event_time}}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0;font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;line-height:1.5;">
                        <span style="color:rgba(255,255,255,0.55);">Organised by</span><br>
                        <span style="color:#ffffff;font-weight:600;">{{organiser_name}}</span>
                      </td>
                    </tr>
                  </table>

                  <!-- Ticket + refund status row -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid rgba(255,255,255,0.14);margin:16px 0 0;">
                    <tr>
                      <td class="detail-cell" style="padding:14px 12px 0 0;width:33.33%;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Ticket</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.4;">{{ticket_name}}</p>
                      </td>
                      <td class="detail-cell" style="padding:14px 12px 0 0;width:33.33%;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Paid</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;">{{amount_paid}}</p>
                      </td>
                      <td class="detail-cell" style="padding:14px 0 0;width:33.33%;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Refund</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.4;">{{refund_status}}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Refund outcome — conditional blocks via template -->
        <!-- SCENARIO A: Refund eligible -->
        {{refund_eligible_row}}

        <!-- SCENARIO B: Outside refund window / no refund -->
        {{no_refund_row}}

        <!-- Browse events CTA -->
        <tr>
          <td class="mobile-pad" style="padding:0 48px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;border:1px solid rgba(194,153,209,0.35);">
              <tr>
                <td style="padding:22px 24px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Keep networking</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 10px;line-height:1.35;">There are plenty more events to discover</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.65;margin:0 0 16px;">Browse upcoming events across the UK and find your next opportunity.</p>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="background:#4a4446;border-radius:999px;">
                        <a href="{{site_url}}/events/" style="display:inline-block;padding:14px 32px;font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Browse upcoming events &rarr;</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        {{sponsor_row}}

        <!-- Footer info bar -->
        <tr>
          <td style="background:#4a4446;padding:22px 48px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td class="info-cell" style="text-align:center;width:33.33%;padding:0 10px;vertical-align:top;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;">Your ticket has been deactivated</p>
                </td>
                <td class="info-cell" style="text-align:center;width:33.33%;padding:0 10px;border-left:1px solid rgba(255,255,255,0.12);border-right:1px solid rgba(255,255,255,0.12);vertical-align:top;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;">Refund terms are set by the organiser</p>
                </td>
                <td class="info-cell" style="text-align:center;width:33.33%;padding:0 10px;vertical-align:top;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;">Questions? <a href="mailto:{{support_email}}" style="color:#ebe0f0;text-decoration:none;">{{support_email}}</a></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        {{mini_sponsors_row}}
        <tr>
          <td style="background:#f5f0e8;padding:28px 48px 30px;text-align:center;border-radius:0 0 20px 20px;border-top:1px solid rgba(194,153,209,0.35);">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_footer_url}}" alt="The Networker Hub" width="200" style="height:auto;display:inline-block;margin:0 auto 16px;border:0;max-width:200px;">
            </a>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.8;margin:0 0 10px;">
              Operated by <strong style="font-weight:600;color:#4a4446;">The Networker Group Ltd</strong><br>
              Registered in England &amp; Wales &nbsp;&middot;&nbsp; Company No. 15252227 &nbsp;&middot;&nbsp; VAT No. 454 4092 94<br>
              Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;margin:0 0 14px;">
              <a href="mailto:{{support_email}}" style="color:#9a7aa8;text-decoration:none;font-weight:600;">{{support_email}}</a>
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#7a7274;margin:0;">
              <a href="{{site_url}}/legal-policies.html#privacy" style="color:#9a7aa8;text-decoration:none;">Privacy</a>
              &nbsp;&middot;&nbsp;
              <a href="{{site_url}}/legal-policies.html#terms" style="color:#9a7aa8;text-decoration:none;">Terms</a>
              &nbsp;&middot;&nbsp;
              <a href="{{site_url}}/legal-policies.html#refunds" style="color:#9a7aa8;text-decoration:none;">Refunds</a>
              &nbsp;&middot;&nbsp;
              <a href="{{site_url}}/contact.html" style="color:#9a7aa8;text-decoration:none;">Contact</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
', updated_at = now()
where slug = 'booking_cancelled';

update public.email_templates
set body_html = '<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Event cancelled – The Networker Hub</title>
  <style>
    @import url(''https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap'');
    body, table, td, p, a { margin:0; padding:0; border:0; font-size:100%; font:inherit; vertical-align:top; }
    img { border:0; display:block; max-width:100%; }
    body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background-color:#faf7f2; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    @media only screen and (max-width:600px) {
      .email-wrapper { width:100% !important; }
      .hero-title { font-size:24px !important; }
      .mobile-pad { padding-left:20px !important; padding-right:20px !important; }
      .detail-cell { display:block !important; width:100% !important; padding:12px 0 !important; border-top:1px solid rgba(255,255,255,0.12) !important; }
      .detail-cell:first-child { border-top:none !important; padding-top:0 !important; }
      .info-cell { display:block !important; width:100% !important; padding-bottom:14px !important; border-left:none !important; border-right:none !important; border-top:1px solid rgba(255,255,255,0.12) !important; }
      .info-cell:first-child { border-top:none !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#faf7f2;font-family:''DM Sans'',system-ui,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#faf7f2;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table class="email-wrapper" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(74,68,70,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:#f5f0e8;padding:32px 48px 0;text-align:center;border-bottom:1px solid rgba(194,153,209,0.35);">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_url}}" alt="The Networker Hub" width="240" style="height:auto;display:inline-block;margin:0 auto;border:0;max-width:240px;">
            </a>
            <div style="line-height:0;font-size:0;margin-top:24px;">
              <svg viewBox="0 0 600 40" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:40px;">
                <path d="M0,24 C150,46 450,4 600,24 L600,40 L0,40 Z" fill="#ffffff"/>
              </svg>
            </div>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td class="mobile-pad" style="padding:28px 48px 20px;text-align:center;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 16px;">
              <tr>
                <td style="width:52px;height:52px;background:#fef3cd;border-radius:50%;text-align:center;vertical-align:middle;font-size:24px;line-height:52px;">&#9888;&#65039;</td>
              </tr>
            </table>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Event cancelled</p>
            <h1 class="hero-title" style="font-family:''DM Sans'',system-ui,sans-serif;font-size:28px;font-weight:600;color:#4a4446;letter-spacing:-0.03em;line-height:1.15;margin:0 0 10px;">This event has been cancelled</h1>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:400;color:#635c5e;line-height:1.7;margin:0;">
              Hi {{user_name}}, we''re sorry to let you know that <strong style="color:#4a4446;">{{event_name}}</strong> has been cancelled by the organiser. We know this is disappointing &mdash; here''s everything you need to know.
            </p>
          </td>
        </tr>

        <!-- Cancelled event card -->
        <tr>
          <td class="mobile-pad" style="padding:0 48px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#4a4446;border-radius:16px;">
              <tr>
                <td style="padding:24px;">
                  <!-- Cancelled badge -->
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:14px;">
                    <tr>
                      <td style="background:rgba(180,83,9,0.25);border:1px solid rgba(251,191,36,0.4);border-radius:999px;padding:5px 14px;">
                        <span style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:1px;">&#9888; Cancelled</span>
                      </td>
                    </tr>
                  </table>

                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:19px;font-weight:600;color:#ffffff;margin:0 0 16px;line-height:1.3;">{{event_name}}</p>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="padding:0 0 10px;font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;line-height:1.5;">
                        <span style="color:rgba(255,255,255,0.55);">Was scheduled for</span><br>
                        <span style="color:#ffffff;font-weight:600;text-decoration:line-through;opacity:0.7;">{{event_date}} &nbsp;&middot;&nbsp; {{event_time}}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 0;font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;line-height:1.5;">
                        <span style="color:rgba(255,255,255,0.55);">Organised by</span><br>
                        <span style="color:#ffffff;font-weight:600;">{{organiser_name}}</span>
                      </td>
                    </tr>
                  </table>

                  <!-- Ticket + paid row -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid rgba(255,255,255,0.14);margin:16px 0 0;">
                    <tr>
                      <td class="detail-cell" style="padding:14px 12px 0 0;width:50%;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Your ticket</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.4;">{{ticket_name}}</p>
                      </td>
                      <td class="detail-cell" style="padding:14px 0 0;width:50%;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Amount paid</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;">{{amount_paid}}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Refund info -->
        <tr>
          <td class="mobile-pad" style="padding:0 48px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fffbeb;border-radius:14px;border:1px solid #fcd34d;">
              <tr>
                <td style="padding:22px 24px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">About your refund</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 10px;line-height:1.35;">{{refund_headline}}</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.65;margin:0 0 16px;">{{refund_details}}</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:500;color:#92400e;line-height:1.6;margin:0;background:#fef3cd;border-radius:8px;padding:12px 14px;">
                    If you paid by card, your refund will appear within <strong>5&ndash;10 business days</strong> depending on your bank. No action is needed from you.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Organiser message (conditional) -->
        {{organiser_message_row}}

        <!-- What next -->
        <tr>
          <td class="mobile-pad" style="padding:0 48px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;border:1px solid rgba(194,153,209,0.35);">
              <tr>
                <td style="padding:22px 24px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Keep going</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 10px;line-height:1.35;">There are plenty more events to discover</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.65;margin:0 0 16px;">Browse upcoming events and find your next opportunity to connect.</p>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="background:#4a4446;border-radius:999px;">
                        <a href="{{site_url}}/events/" style="display:inline-block;padding:14px 32px;font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Browse upcoming events &rarr;</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        {{sponsor_row}}

        <!-- Footer info bar -->
        <tr>
          <td style="background:#4a4446;padding:22px 48px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td class="info-cell" style="text-align:center;width:33.33%;padding:0 10px;vertical-align:top;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;">Refunds are processed automatically</p>
                </td>
                <td class="info-cell" style="text-align:center;width:33.33%;padding:0 10px;border-left:1px solid rgba(255,255,255,0.12);border-right:1px solid rgba(255,255,255,0.12);vertical-align:top;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;">No action needed from you</p>
                </td>
                <td class="info-cell" style="text-align:center;width:33.33%;padding:0 10px;vertical-align:top;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;">Questions? <a href="mailto:{{support_email}}" style="color:#ebe0f0;text-decoration:none;">{{support_email}}</a></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        {{mini_sponsors_row}}
        <tr>
          <td style="background:#f5f0e8;padding:28px 48px 30px;text-align:center;border-radius:0 0 20px 20px;border-top:1px solid rgba(194,153,209,0.35);">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_footer_url}}" alt="The Networker Hub" width="200" style="height:auto;display:inline-block;margin:0 auto 16px;border:0;max-width:200px;">
            </a>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.8;margin:0 0 10px;">
              Operated by <strong style="font-weight:600;color:#4a4446;">The Networker Group Ltd</strong><br>
              Registered in England &amp; Wales &nbsp;&middot;&nbsp; Company No. 15252227 &nbsp;&middot;&nbsp; VAT No. 454 4092 94<br>
              Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;margin:0 0 14px;">
              <a href="mailto:{{support_email}}" style="color:#9a7aa8;text-decoration:none;font-weight:600;">{{support_email}}</a>
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#7a7274;margin:0;">
              <a href="{{site_url}}/legal-policies.html#privacy" style="color:#9a7aa8;text-decoration:none;">Privacy</a>
              &nbsp;&middot;&nbsp;
              <a href="{{site_url}}/legal-policies.html#terms" style="color:#9a7aa8;text-decoration:none;">Terms</a>
              &nbsp;&middot;&nbsp;
              <a href="{{site_url}}/legal-policies.html#refunds" style="color:#9a7aa8;text-decoration:none;">Refunds</a>
              &nbsp;&middot;&nbsp;
              <a href="{{site_url}}/contact.html" style="color:#9a7aa8;text-decoration:none;">Contact</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
', updated_at = now()
where slug = 'event_cancelled';

update public.email_templates
set body_html = '<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Your refund is on its way – The Networker Hub</title>
  <style>
    @import url(''https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap'');
    body, table, td, p, a { margin:0; padding:0; border:0; font-size:100%; font:inherit; vertical-align:top; }
    img { border:0; display:block; max-width:100%; }
    body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background-color:#faf7f2; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    @media only screen and (max-width:600px) {
      .email-wrapper { width:100% !important; }
      .hero-title { font-size:24px !important; }
      .mobile-pad { padding-left:20px !important; padding-right:20px !important; }
      .detail-cell { display:block !important; width:100% !important; padding:12px 0 !important; border-top:1px solid rgba(255,255,255,0.12) !important; }
      .detail-cell:first-child { border-top:none !important; padding-top:0 !important; }
      .info-cell { display:block !important; width:100% !important; padding-bottom:14px !important; border-left:none !important; border-right:none !important; border-top:1px solid rgba(255,255,255,0.12) !important; }
      .info-cell:first-child { border-top:none !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#faf7f2;font-family:''DM Sans'',system-ui,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#faf7f2;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table class="email-wrapper" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(74,68,70,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:#f5f0e8;padding:32px 48px 0;text-align:center;border-bottom:1px solid rgba(194,153,209,0.35);">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_url}}" alt="The Networker Hub" width="240" style="height:auto;display:inline-block;margin:0 auto;border:0;max-width:240px;">
            </a>
            <div style="line-height:0;font-size:0;margin-top:24px;">
              <svg viewBox="0 0 600 40" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:40px;">
                <path d="M0,24 C150,46 450,4 600,24 L600,40 L0,40 Z" fill="#ffffff"/>
              </svg>
            </div>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td class="mobile-pad" style="padding:28px 48px 20px;text-align:center;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 16px;">
              <tr>
                <td style="width:52px;height:52px;background:#dcfce7;border-radius:50%;text-align:center;vertical-align:middle;font-size:24px;line-height:52px;">&#10003;</td>
              </tr>
            </table>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Refund processed</p>
            <h1 class="hero-title" style="font-family:''DM Sans'',system-ui,sans-serif;font-size:28px;font-weight:600;color:#4a4446;letter-spacing:-0.03em;line-height:1.15;margin:0 0 10px;">Your refund is on its way</h1>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:400;color:#635c5e;line-height:1.7;margin:0;">
              Hi {{user_name}}, your refund for <strong style="color:#4a4446;">{{event_name}}</strong> has been processed. Here are the details.
            </p>
          </td>
        </tr>

        <!-- Refund amount — hero number -->
        <tr>
          <td class="mobile-pad" style="padding:0 48px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#4a4446;border-radius:16px;">
              <tr>
                <td style="padding:24px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Refund summary</p>

                  <!-- Big refund amount -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:20px;">
                    <tr>
                      <td style="vertical-align:middle;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:38px;font-weight:700;color:#ffffff;margin:0;letter-spacing:-0.04em;line-height:1;">{{refund_amount}}</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:rgba(255,255,255,0.6);margin:6px 0 0;">returning to your original payment method</p>
                      </td>
                      <td style="text-align:right;vertical-align:middle;width:60px;">
                        <div style="width:44px;height:44px;background:#16a34a;border-radius:50%;text-align:center;line-height:44px;font-size:20px;margin-left:auto;">&#10003;</div>
                      </td>
                    </tr>
                  </table>

                  <!-- Details grid -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid rgba(255,255,255,0.14);">
                    <tr>
                      <td class="detail-cell" style="padding:14px 12px 0 0;width:33.33%;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Event</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.4;">{{event_name}}</p>
                      </td>
                      <td class="detail-cell" style="padding:14px 12px 0 0;width:33.33%;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Ticket</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.4;">{{ticket_name}}</p>
                      </td>
                      <td class="detail-cell" style="padding:14px 0 0;width:33.33%;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Processed</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;">{{refund_date}}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Timeline / what to expect -->
        <tr>
          <td class="mobile-pad" style="padding:0 48px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0fdf4;border-radius:14px;border:1px solid #86efac;">
              <tr>
                <td style="padding:22px 24px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">What to expect</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 16px;line-height:1.35;">When will I see the money?</p>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="padding:0 0 12px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="width:30px;vertical-align:top;padding-top:2px;">
                              <div style="width:8px;height:8px;background:#16a34a;border-radius:50%;margin-top:4px;"></div>
                            </td>
                            <td style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;color:#4a4446;line-height:1.55;">
                              <strong style="font-weight:600;">Today</strong> &mdash; the refund has been issued from our end
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 12px;border-top:1px solid rgba(22,163,74,0.15);">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding-top:12px;">
                          <tr>
                            <td style="width:30px;vertical-align:top;padding-top:2px;">
                              <div style="width:8px;height:8px;background:#86efac;border-radius:50%;margin-top:4px;"></div>
                            </td>
                            <td style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;color:#4a4446;line-height:1.55;">
                              <strong style="font-weight:600;">3&ndash;5 business days</strong> &mdash; most cards show the credit by now
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="border-top:1px solid rgba(22,163,74,0.15);">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding-top:12px;">
                          <tr>
                            <td style="width:30px;vertical-align:top;padding-top:2px;">
                              <div style="width:8px;height:8px;background:#bbf7d0;border-radius:50%;margin-top:4px;"></div>
                            </td>
                            <td style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;color:#4a4446;line-height:1.55;">
                              <strong style="font-weight:600;">Up to 10 business days</strong> &mdash; the latest some banks process it. If nothing arrives after this, contact us.
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Browse events CTA -->
        <tr>
          <td class="mobile-pad" style="padding:0 48px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;border:1px solid rgba(194,153,209,0.35);">
              <tr>
                <td style="padding:22px 24px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">While you&rsquo;re here</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#4a4446;margin:0 0 10px;line-height:1.35;">Your next event is out there</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.65;margin:0 0 16px;">Browse upcoming events across the UK and keep building your network.</p>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="background:#4a4446;border-radius:999px;">
                        <a href="{{site_url}}/events/" style="display:inline-block;padding:14px 32px;font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Browse upcoming events &rarr;</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        {{sponsor_row}}

        <!-- Footer info bar -->
        <tr>
          <td style="background:#4a4446;padding:22px 48px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td class="info-cell" style="text-align:center;width:33.33%;padding:0 10px;vertical-align:top;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;">Refund sent to your original payment method</p>
                </td>
                <td class="info-cell" style="text-align:center;width:33.33%;padding:0 10px;border-left:1px solid rgba(255,255,255,0.12);border-right:1px solid rgba(255,255,255,0.12);vertical-align:top;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;">Allow up to 10 business days to appear</p>
                </td>
                <td class="info-cell" style="text-align:center;width:33.33%;padding:0 10px;vertical-align:top;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;">Questions? <a href="mailto:{{support_email}}" style="color:#ebe0f0;text-decoration:none;">{{support_email}}</a></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        {{mini_sponsors_row}}
        <tr>
          <td style="background:#f5f0e8;padding:28px 48px 30px;text-align:center;border-radius:0 0 20px 20px;border-top:1px solid rgba(194,153,209,0.35);">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_footer_url}}" alt="The Networker Hub" width="200" style="height:auto;display:inline-block;margin:0 auto 16px;border:0;max-width:200px;">
            </a>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.8;margin:0 0 10px;">
              Operated by <strong style="font-weight:600;color:#4a4446;">The Networker Group Ltd</strong><br>
              Registered in England &amp; Wales &nbsp;&middot;&nbsp; Company No. 15252227 &nbsp;&middot;&nbsp; VAT No. 454 4092 94<br>
              Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;margin:0 0 14px;">
              <a href="mailto:{{support_email}}" style="color:#9a7aa8;text-decoration:none;font-weight:600;">{{support_email}}</a>
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#7a7274;margin:0;">
              <a href="{{site_url}}/legal-policies.html#privacy" style="color:#9a7aa8;text-decoration:none;">Privacy</a>
              &nbsp;&middot;&nbsp;
              <a href="{{site_url}}/legal-policies.html#terms" style="color:#9a7aa8;text-decoration:none;">Terms</a>
              &nbsp;&middot;&nbsp;
              <a href="{{site_url}}/legal-policies.html#refunds" style="color:#9a7aa8;text-decoration:none;">Refunds</a>
              &nbsp;&middot;&nbsp;
              <a href="{{site_url}}/contact.html" style="color:#9a7aa8;text-decoration:none;">Contact</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
', updated_at = now()
where slug = 'refund_processed';

update public.email_templates
set body_html = '<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Application received – The Networker Hub</title>
  <style>
    @import url(''https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap'');
    body, table, td, p, a { margin:0; padding:0; border:0; font-size:100%; font:inherit; vertical-align:top; }
    img { border:0; display:block; max-width:100%; }
    body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background-color:#e8ecf5; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    @media only screen and (max-width:600px) {
      .email-wrapper { width:100% !important; }
      .hero-title { font-size:24px !important; }
      .mobile-pad { padding-left:20px !important; padding-right:20px !important; }
      .stat-cell { display:block !important; width:100% !important; padding:14px 0 !important; border-left:none !important; border-top:1px solid rgba(74,168,240,0.2) !important; text-align:center !important; }
      .stat-cell:first-child { border-top:none !important; }
      .detail-cell { display:block !important; width:100% !important; padding:12px 0 !important; border-top:1px solid rgba(255,255,255,0.12) !important; }
      .detail-cell:first-child { border-top:none !important; padding-top:0 !important; }
      .info-cell { display:block !important; width:100% !important; padding-bottom:14px !important; border-left:none !important; border-right:none !important; border-top:1px solid rgba(255,255,255,0.12) !important; }
      .info-cell:first-child { border-top:none !important; }
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
              <img src="{{logo_url}}" alt="The Networker Hub" width="240" style="height:auto;display:inline-block;margin:0 auto;border:0;max-width:240px;">
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

        {{sponsor_row}}

        <tr>
          <td class="mobile-pad" style="padding:28px 48px 20px;text-align:center;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 16px;">
              <tr>
                <td style="width:52px;height:52px;background:#daeeff;border-radius:50%;text-align:center;vertical-align:middle;font-size:24px;color:#4aa8f0;line-height:52px;">&#9733;</td>
              </tr>
            </table>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#4aa8f0;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Application received</p>
            <h1 class="hero-title" style="font-family:''DM Sans'',system-ui,sans-serif;font-size:28px;font-weight:600;color:#1c2040;letter-spacing:-0.03em;line-height:1.15;margin:0 0 10px;">Your application has been received</h1>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:400;color:#635c5e;line-height:1.7;margin:0;">
              Hi {{user_name}}, thanks for applying to <strong style="color:#4aa8f0;font-weight:600;">{{event_name}}</strong>. The organiser will review your application and email you if you are approved.
            </p>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:0 48px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:16px;">
              <tr>
                <td style="padding:24px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Your details</p>

                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:18px;">
                    <tr>
                      <td style="width:40px;height:40px;background:#4aa8f0;border-radius:50%;text-align:center;vertical-align:middle;font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#ffffff;line-height:40px;">{{attendee_initial}}</td>
                      <td style="padding-left:12px;vertical-align:middle;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:17px;font-weight:600;color:#ffffff;margin:0;line-height:1.2;">{{user_name}}</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:400;color:rgba(255,255,255,0.6);margin:0;">{{user_email}}</p>
                      </td>
                    </tr>
                  </table>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid rgba(255,255,255,0.14);">
                    <tr>
                      <td class="detail-cell" style="padding:14px 12px 14px 0;width:33.33%;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">When</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.4;">{{event_date}}</p>
                      </td>
                      <td class="detail-cell" style="padding:14px 12px 14px 0;width:33.33%;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Time</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;">{{event_time}}</p>
                      </td>
                      <td class="detail-cell" style="padding:14px 0;width:33.33%;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">If approved</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;">{{price_if_approved}}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:0 48px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0f4ff;border-radius:14px;border:1px solid #b8d4f5;">
              <tr>
                <td style="padding:22px 24px 16px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#4aa8f0;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">What happens next</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;line-height:1.65;color:#1c2040;margin:0 0 14px;">
                    The organiser will review your application and email you if you are approved. You can check the status any time in My Hub.
                  </p>
                  <a href="{{hub_account_url}}" style="display:inline-block;padding:14px 28px;font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;background:#4aa8f0;border-radius:999px;">Open My Hub</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#1c2040;padding:22px 48px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td class="info-cell" style="text-align:center;width:33.33%;padding:0 10px;vertical-align:top;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;">Payouts are processed after your event</p>
                </td>
                <td class="info-cell" style="text-align:center;width:33.33%;padding:0 10px;border-left:1px solid rgba(255,255,255,0.12);border-right:1px solid rgba(255,255,255,0.12);vertical-align:top;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;">Refund requests are managed in My Hub</p>
                </td>
                <td class="info-cell" style="text-align:center;width:33.33%;padding:0 10px;vertical-align:top;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;">Need help? <a href="mailto:{{support_email}}" style="color:#4aa8f0;text-decoration:none;">{{support_email}}</a></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        {{mini_sponsors_row}}

        <tr>
          <td style="background:#1c2040;padding:28px 48px 30px;text-align:center;border-radius:0 0 20px 20px;border-top:1px solid rgba(74,168,240,0.2);">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_url}}" alt="The Networker Hub" width="200" style="height:auto;display:inline-block;margin:0 auto 16px;border:0;max-width:200px;">
            </a>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:rgba(255,255,255,0.55);line-height:1.8;margin:0 0 10px;">
              Operated by <strong style="font-weight:600;color:rgba(255,255,255,0.8);">The Networker Group Ltd</strong><br>
              Registered in England &amp; Wales &nbsp;&middot;&nbsp; Company No. 15252227 &nbsp;&middot;&nbsp; VAT No. 454 4092 94<br>
              Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:rgba(255,255,255,0.55);margin:0 0 14px;">
              <a href="mailto:{{support_email}}" style="color:#4aa8f0;text-decoration:none;font-weight:600;">{{support_email}}</a>
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:rgba(255,255,255,0.4);margin:0;">
              <a href="{{privacy_url}}" style="color:#4aa8f0;text-decoration:none;">Privacy</a>
              &nbsp;&middot;&nbsp;
              <a href="{{terms_url}}" style="color:#4aa8f0;text-decoration:none;">Terms</a>
              &nbsp;&middot;&nbsp;
              <a href="{{refunds_url}}" style="color:#4aa8f0;text-decoration:none;">Refunds</a>
              &nbsp;&middot;&nbsp;
              <a href="{{contact_url}}" style="color:#4aa8f0;text-decoration:none;">Contact</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
', updated_at = now()
where slug = 'application_received';

update public.email_templates
set body_html = '<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>New booking – The Networker Hub</title>
  <style>
    @import url(''https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap'');
    body, table, td, p, a { margin:0; padding:0; border:0; font-size:100%; font:inherit; vertical-align:top; }
    img { border:0; display:block; max-width:100%; height:auto; }
    body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background-color:#e8ecf5; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    @media only screen and (max-width:600px) {
      .email-wrapper { width:100% !important; }
      .hero-title { font-size:24px !important; line-height:1.2 !important; }
      .mobile-pad { padding-left:20px !important; padding-right:20px !important; }
      .mobile-header-pad { padding-left:20px !important; padding-right:20px !important; }
      .email-cta a { display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#e8ecf5;font-family:''DM Sans'',system-ui,sans-serif;">
<!-- organiser-email-layout-v2 -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#e8ecf5;">
  <tr>
    <td align="center" style="padding:32px 16px 56px;">
      <table class="email-wrapper" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(28,32,64,0.18);">

        <tr>
          <td class="mobile-header-pad" style="background:#f5f0e8;padding:28px 40px 0;text-align:center;">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_url}}" alt="The Networker Hub" width="240" style="height:auto;display:inline-block;margin:0 auto;border:0;max-width:240px;width:100%;">
            </a>
          </td>
        </tr>

        <tr>
          <td style="background:#f5f0e8;padding:0;text-align:center;">
            <div style="line-height:0;font-size:0;margin-top:8px;">
              <svg viewBox="0 0 600 40" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:40px;">
                <path d="M0,24 C150,46 450,4 600,24 L600,40 L0,40 Z" fill="#ffffff"/>
              </svg>
            </div>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:28px 40px 20px;text-align:center;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 16px;">
              <tr>
                <td style="width:52px;height:52px;background:#daeeff;border-radius:50%;text-align:center;vertical-align:middle;font-size:24px;color:#4aa8f0;line-height:52px;">&#9733;</td>
              </tr>
            </table>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#4aa8f0;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">New booking</p>
            <h1 class="hero-title" style="font-family:''DM Sans'',system-ui,sans-serif;font-size:28px;font-weight:600;color:#1c2040;letter-spacing:-0.03em;line-height:1.15;margin:0 0 10px;">Someone just booked your event</h1>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:400;color:#635c5e;line-height:1.7;margin:0;">
              Hi {{organiser_name}}, a new ticket has been purchased for <strong style="color:#4aa8f0;font-weight:600;">{{event_name}}</strong>. Here are the details.
            </p>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:0 40px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:16px;">
              <tr>
                <td style="padding:24px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">New attendee</p>

                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:18px;">
                    <tr>
                      <td style="width:40px;height:40px;background:#4aa8f0;border-radius:50%;text-align:center;vertical-align:middle;font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#ffffff;line-height:40px;">{{attendee_initial}}</td>
                      <td style="padding-left:12px;vertical-align:middle;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:17px;font-weight:600;color:#ffffff;margin:0;line-height:1.2;">{{attendee_name}}</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:400;color:rgba(255,255,255,0.6);margin:0;word-break:break-word;">{{attendee_email}}</p>
                      </td>
                    </tr>
                  </table>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid rgba(255,255,255,0.14);">
                    <tr>
                      <td style="padding:14px 0 0;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Ticket</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;word-break:break-word;">{{ticket_name}}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:14px 0 0;border-top:1px solid rgba(255,255,255,0.14);vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Amount paid</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;">{{amount_paid}}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:14px 0 0;border-top:1px solid rgba(255,255,255,0.14);vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Booked at</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;">{{booking_time}}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:0 40px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0f4ff;border-radius:14px;border:1px solid #b8d4f5;">
              <tr>
                <td style="padding:22px 24px 16px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#4aa8f0;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Your event</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#1c2040;margin:0 0 4px;line-height:1.35;">{{event_name}}</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.55;margin:0 0 16px;">{{event_date}} &nbsp;&middot;&nbsp; {{event_time}}</p>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:10px;border:1px solid rgba(74,168,240,0.25);">
                    <tr>
                      <td style="padding:16px 20px;text-align:center;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:24px;font-weight:700;color:#1c2040;margin:0;letter-spacing:-0.03em;">{{tickets_sold}}</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:600;color:#4aa8f0;text-transform:uppercase;letter-spacing:0.5px;margin:4px 0 0;">Tickets sold</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:14px 20px;text-align:center;border-top:1px solid rgba(74,168,240,0.25);">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:24px;font-weight:700;color:#1c2040;margin:0;letter-spacing:-0.03em;">{{tickets_remaining}}</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:600;color:#4aa8f0;text-transform:uppercase;letter-spacing:0.5px;margin:4px 0 0;">Remaining</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:14px 20px;text-align:center;border-top:1px solid rgba(74,168,240,0.25);">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:24px;font-weight:700;color:#1c2040;margin:0;letter-spacing:-0.03em;">{{total_revenue}}</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:600;color:#4aa8f0;text-transform:uppercase;letter-spacing:0.5px;margin:4px 0 0;">Total revenue</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td class="mobile-pad email-cta" style="padding:0 24px 22px;">
                  <a href="{{dashboard_url}}" style="display:block;text-align:center;padding:14px 32px;font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;background:#1c2040;border-radius:999px;">Manage attendees &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        {{sponsor_row}}

        <tr>
          <td class="mobile-pad" style="background:#1c2040;padding:22px 40px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="padding:0 0 14px;text-align:center;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.5;">Payouts are processed after your event</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;text-align:center;border-top:1px solid rgba(255,255,255,0.12);">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.5;">Refund requests are managed in My Hub</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 0;text-align:center;border-top:1px solid rgba(255,255,255,0.12);">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.5;">Need help? <a href="mailto:{{support_email}}" style="color:#4aa8f0;text-decoration:none;">{{support_email}}</a></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="background:#1c2040;padding:28px 40px 40px;text-align:center;border-radius:0 0 20px 20px;border-top:1px solid rgba(74,168,240,0.2);">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_footer_url}}" alt="The Networker Hub" width="200" style="height:auto;display:inline-block;margin:0 auto 16px;border:0;max-width:200px;">
            </a>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:rgba(255,255,255,0.55);line-height:1.8;margin:0 0 10px;">
              Operated by <strong style="font-weight:600;color:rgba(255,255,255,0.8);">The Networker Group Ltd</strong><br>
              Registered in England &amp; Wales &nbsp;&middot;&nbsp; Company No. 15252227 &nbsp;&middot;&nbsp; VAT No. 454 4092 94<br>
              Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:rgba(255,255,255,0.55);margin:0 0 14px;">
              <a href="mailto:{{support_email}}" style="color:#4aa8f0;text-decoration:none;font-weight:600;">{{support_email}}</a>
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:rgba(255,255,255,0.4);margin:0;">
              <a href="{{privacy_url}}" style="color:#4aa8f0;text-decoration:none;">Privacy</a>
              &nbsp;&middot;&nbsp;
              <a href="{{terms_url}}" style="color:#4aa8f0;text-decoration:none;">Terms</a>
              &nbsp;&middot;&nbsp;
              <a href="{{refunds_url}}" style="color:#4aa8f0;text-decoration:none;">Refunds</a>
              &nbsp;&middot;&nbsp;
              <a href="{{contact_url}}" style="color:#4aa8f0;text-decoration:none;">Contact</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
', updated_at = now()
where slug = 'organiser_new_registration';

update public.email_templates
set body_html = '<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>New application – The Networker Hub</title>
  <style>
    @import url(''https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap'');
    body, table, td, p, a { margin:0; padding:0; border:0; font-size:100%; font:inherit; vertical-align:top; }
    img { border:0; display:block; max-width:100%; height:auto; }
    body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background-color:#e8ecf5; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    @media only screen and (max-width:600px) {
      .email-wrapper { width:100% !important; }
      .hero-title { font-size:24px !important; line-height:1.2 !important; }
      .mobile-pad { padding-left:20px !important; padding-right:20px !important; }
      .mobile-header-pad { padding-left:20px !important; padding-right:20px !important; }
      .email-cta a { display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#e8ecf5;font-family:''DM Sans'',system-ui,sans-serif;">
<!-- organiser-email-layout-v2 -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#e8ecf5;">
  <tr>
    <td align="center" style="padding:32px 16px 56px;">
      <table class="email-wrapper" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(28,32,64,0.18);">

        <tr>
          <td class="mobile-header-pad" style="background:#f5f0e8;padding:28px 40px 0;text-align:center;">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_url}}" alt="The Networker Hub" width="240" style="height:auto;display:inline-block;margin:0 auto;border:0;max-width:240px;width:100%;">
            </a>
          </td>
        </tr>

        <tr>
          <td style="background:#f5f0e8;padding:0;text-align:center;">
            <div style="line-height:0;font-size:0;margin-top:8px;">
              <svg viewBox="0 0 600 40" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:40px;">
                <path d="M0,24 C150,46 450,4 600,24 L600,40 L0,40 Z" fill="#ffffff"/>
              </svg>
            </div>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:28px 40px 20px;text-align:center;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 16px;">
              <tr>
                <td style="width:52px;height:52px;background:#daeeff;border-radius:50%;text-align:center;vertical-align:middle;font-size:24px;color:#4aa8f0;line-height:52px;">&#9733;</td>
              </tr>
            </table>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#4aa8f0;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">New application</p>
            <h1 class="hero-title" style="font-family:''DM Sans'',system-ui,sans-serif;font-size:28px;font-weight:600;color:#1c2040;letter-spacing:-0.03em;line-height:1.15;margin:0 0 10px;">Someone applied to attend</h1>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:400;color:#635c5e;line-height:1.7;margin:0;">
              Hi {{organiser_name}}, a new application has been submitted for <strong style="color:#4aa8f0;font-weight:600;">{{event_name}}</strong>. Here are the details.
            </p>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:0 40px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:16px;">
              <tr>
                <td style="padding:24px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">New attendee</p>

                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:18px;">
                    <tr>
                      <td style="width:40px;height:40px;background:#4aa8f0;border-radius:50%;text-align:center;vertical-align:middle;font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#ffffff;line-height:40px;">{{attendee_initial}}</td>
                      <td style="padding-left:12px;vertical-align:middle;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:17px;font-weight:600;color:#ffffff;margin:0;line-height:1.2;">{{attendee_name}}</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:400;color:rgba(255,255,255,0.6);margin:0;word-break:break-word;">{{attendee_email}}</p>
                      </td>
                    </tr>
                  </table>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid rgba(255,255,255,0.14);">
                    <tr>
                      <td style="padding:14px 0 0;vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Ticket</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;word-break:break-word;">{{ticket_name}}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:14px 0 0;border-top:1px solid rgba(255,255,255,0.14);vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Industry</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;word-break:break-word;">{{screening_industry}}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:14px 0 0;border-top:1px solid rgba(255,255,255,0.14);vertical-align:top;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 4px;">Job title</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.45;word-break:break-word;">{{screening_job_title}}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="padding:0 40px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0f4ff;border-radius:14px;border:1px solid #b8d4f5;">
              <tr>
                <td style="padding:22px 24px 16px;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#4aa8f0;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Your event</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#1c2040;margin:0 0 4px;line-height:1.35;">{{event_name}}</p>
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:#635c5e;line-height:1.55;margin:0 0 16px;">{{event_date}} &nbsp;&middot;&nbsp; {{event_time}}</p>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:10px;border:1px solid rgba(74,168,240,0.25);">
                    <tr>
                      <td style="padding:16px 20px;text-align:center;">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:24px;font-weight:700;color:#1c2040;margin:0;letter-spacing:-0.03em;">{{tickets_sold}}</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:600;color:#4aa8f0;text-transform:uppercase;letter-spacing:0.5px;margin:4px 0 0;">Tickets sold</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:14px 20px;text-align:center;border-top:1px solid rgba(74,168,240,0.25);">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:24px;font-weight:700;color:#1c2040;margin:0;letter-spacing:-0.03em;">{{tickets_remaining}}</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:600;color:#4aa8f0;text-transform:uppercase;letter-spacing:0.5px;margin:4px 0 0;">Remaining</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:14px 20px;text-align:center;border-top:1px solid rgba(74,168,240,0.25);">
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:24px;font-weight:700;color:#1c2040;margin:0;letter-spacing:-0.03em;">{{total_revenue}}</p>
                        <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:600;color:#4aa8f0;text-transform:uppercase;letter-spacing:0.5px;margin:4px 0 0;">Total revenue</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td class="mobile-pad email-cta" style="padding:0 24px 22px;">
                  <a href="{{dashboard_url}}" style="display:block;text-align:center;padding:14px 32px;font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;background:#1c2040;border-radius:999px;">Review applications &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        {{sponsor_row}}

        <tr>
          <td class="mobile-pad" style="background:#1c2040;padding:22px 40px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="padding:0 0 14px;text-align:center;">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.5;">Payouts are processed after your event</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;text-align:center;border-top:1px solid rgba(255,255,255,0.12);">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.5;">Refund requests are managed in My Hub</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 0;text-align:center;border-top:1px solid rgba(255,255,255,0.12);">
                  <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:16px;font-weight:600;color:#ffffff;margin:0;line-height:1.5;">Need help? <a href="mailto:{{support_email}}" style="color:#4aa8f0;text-decoration:none;">{{support_email}}</a></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="mobile-pad" style="background:#1c2040;padding:28px 40px 40px;text-align:center;border-radius:0 0 20px 20px;border-top:1px solid rgba(74,168,240,0.2);">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_footer_url}}" alt="The Networker Hub" width="200" style="height:auto;display:inline-block;margin:0 auto 16px;border:0;max-width:200px;">
            </a>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:rgba(255,255,255,0.55);line-height:1.8;margin:0 0 10px;">
              Operated by <strong style="font-weight:600;color:rgba(255,255,255,0.8);">The Networker Group Ltd</strong><br>
              Registered in England &amp; Wales &nbsp;&middot;&nbsp; Company No. 15252227 &nbsp;&middot;&nbsp; VAT No. 454 4092 94<br>
              Magpas HQ, Barnwell Road, Alconbury Weald, Huntingdon, Cambridgeshire PE28 4YF
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:rgba(255,255,255,0.55);margin:0 0 14px;">
              <a href="mailto:{{support_email}}" style="color:#4aa8f0;text-decoration:none;font-weight:600;">{{support_email}}</a>
            </p>
            <p style="font-family:''DM Sans'',system-ui,sans-serif;font-size:15px;font-weight:400;color:rgba(255,255,255,0.4);margin:0;">
              <a href="{{privacy_url}}" style="color:#4aa8f0;text-decoration:none;">Privacy</a>
              &nbsp;&middot;&nbsp;
              <a href="{{terms_url}}" style="color:#4aa8f0;text-decoration:none;">Terms</a>
              &nbsp;&middot;&nbsp;
              <a href="{{refunds_url}}" style="color:#4aa8f0;text-decoration:none;">Refunds</a>
              &nbsp;&middot;&nbsp;
              <a href="{{contact_url}}" style="color:#4aa8f0;text-decoration:none;">Contact</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
', updated_at = now()
where slug = 'organiser_new_application';

