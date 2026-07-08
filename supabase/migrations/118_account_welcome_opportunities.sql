-- Account welcome: business opportunities section, no sponsor banner

update public.email_templates
set
  body_html = '<!DOCTYPE html>
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
',
  placeholders = array[
    'user_name', 'user_email', 'hub_account_url', 'browse_events_url', 'opportunities_url',
    'welcome_url', 'contact_url', 'privacy_url', 'terms_url', 'refunds_url',
    'site_url', 'logo_url', 'logo_footer_url', 'support_email'
  ],
  updated_at = now()
where slug = 'account_welcome';
