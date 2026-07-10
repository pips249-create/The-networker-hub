#!/usr/bin/env node
/**
 * Generates branded lifecycle / engagement email HTML templates.
 * Run: node scripts/generate-lifecycle-email-templates.js
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../email-templates');

const shell = (pageTitle, bodyRows) => `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
    body, table, td, p, a { margin:0; padding:0; border:0; font-size:100%; font:inherit; vertical-align:top; }
    img { border:0; display:block; max-width:100%; height:auto; }
    body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background-color:#e8ecf5; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    @media only screen and (max-width:600px) {
      .email-wrapper { width:100% !important; }
      .hero-title { font-size:24px !important; line-height:1.2 !important; }
      .mobile-pad { padding-left:20px !important; padding-right:20px !important; }
      .mobile-header-pad { padding-left:20px !important; padding-right:20px !important; }
      .email-cta a { display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; margin-bottom:10px !important; padding:14px 24px !important; font-size:16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#e8ecf5;font-family:'DM Sans',system-ui,sans-serif;">
<!-- hub-email-layout-v2 -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#e8ecf5;">
  <tr>
    <td align="center" style="padding:32px 16px 56px;">
      <table class="email-wrapper" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(28,32,64,0.12);">
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
        ${bodyRows}
        <tr>
          <td class="mobile-pad" style="background:#1c2040;padding:28px 40px 40px;text-align:center;border-radius:0 0 20px 20px;">
            <a href="{{site_url}}/" style="text-decoration:none;display:inline-block;">
              <img src="{{logo_footer_url}}" alt="The Networker Hub" width="200" style="height:auto;display:inline-block;margin:0 auto 16px;border:0;max-width:200px;">
            </a>
            <p style="font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:400;color:rgba(255,255,255,0.55);margin:0;">
              <a href="{{privacy_url}}" style="color:#4aa8f0;text-decoration:none;">Privacy</a>
              &nbsp;&middot;&nbsp;
              <a href="{{terms_url}}" style="color:#4aa8f0;text-decoration:none;">Terms</a>
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
</html>`;

function hero(icon, iconBg, iconColor, eyebrow, eyebrowColor, title, intro) {
  return `<tr>
          <td class="mobile-pad" style="padding:28px 40px 16px;text-align:center;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 16px;">
              <tr><td style="width:52px;height:52px;background:${iconBg};border-radius:50%;text-align:center;vertical-align:middle;font-size:22px;color:${iconColor};line-height:52px;">${icon}</td></tr>
            </table>
            <p style="font-family:'DM Sans',system-ui,sans-serif;font-size:13px;font-weight:700;color:${eyebrowColor};text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;">${eyebrow}</p>
            <h1 class="hero-title" style="font-family:'DM Sans',system-ui,sans-serif;font-size:28px;font-weight:600;color:#1c2040;margin:0 0 10px;line-height:1.15;">${title}</h1>
            <p style="font-family:'DM Sans',system-ui,sans-serif;font-size:16px;line-height:1.7;color:#635c5e;margin:0;">${intro}</p>
          </td>
        </tr>`;
}

function ctaRow(buttons) {
  return `<tr><td class="mobile-pad email-cta" style="padding:0 40px 28px;text-align:center;">${buttons}</td></tr>`;
}

function btn(href, label, bg) {
  return `<a href="${href}" style="display:inline-block;text-align:center;padding:14px 32px;background:${bg};border-radius:999px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;margin:0 6px 10px;">${label}</a>`;
}

function cardBlock(inner) {
  return `<tr><td class="mobile-pad" style="padding:0 40px 20px;">${inner}</td></tr>`;
}

function navyCard(content) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#1c2040;border-radius:16px;"><tr><td style="padding:24px;">${content}</td></tr></table>`;
}

const templates = [
  ['opportunity-listing-expired.html', 'Listing expired', hero('&#9203;', '#fde8e6', '#c0392b', 'Listing offline', '#c0392b', 'Your listing has expired',
    'Hi {{owner_name}}, your opportunity <strong style="color:#1c2040;">{{opportunity_title}}</strong> is no longer visible on the directory.') +
    ctaRow(btn('{{renew_url}}', 'Renew listing &rarr;', '#1c2040'))],
  ['opportunity-premium-expired.html', 'Premium expired', hero('&#9733;', '#fde8e6', '#c0392b', 'Premium ended', '#c0392b', 'Premium placement has ended',
    'Hi {{owner_name}}, the premium spotlight for <strong style="color:#1c2040;">{{opportunity_title}}</strong> has ended. Your standard listing remains unless that has also expired.') +
    ctaRow(btn('{{renew_url}}', 'Upgrade again &rarr;', '#1c2040'))],
  ['opportunity-listing-rejected.html', 'Listing not approved', hero('&#10005;', '#fde8e6', '#c0392b', 'Listing update', '#c0392b', 'Your listing was not approved',
    'Hi {{owner_name}}, we could not approve <strong style="color:#1c2040;">{{opportunity_title}}</strong> for the business opportunities directory at this time.') +
    cardBlock(navyCard('<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.65;color:#ffffff;margin:0;">{{rejection_note}}</p>')) +
    ctaRow(btn('{{edit_url}}', 'Edit and resubmit &rarr;', '#1c2040'))],
  ['payout-requested.html', 'Payout requested', hero('&#163;', '#daeeff', '#4aa8f0', 'Payout', '#4aa8f0', 'Payout request received',
    'Hi {{organiser_name}}, we received your payout request for <strong style="color:#1c2040;">{{event_name}}</strong>. Net amount: <strong>{{amount_net}}</strong>.') +
    cardBlock(navyCard('<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.65;color:rgba(255,255,255,0.85);margin:0;">We will review your request and email you when it is approved and paid.</p>')) +
    ctaRow(btn('{{dashboard_url}}', 'View revenue &rarr;', '#1c2040'))],
  ['payout-approved.html', 'Payout approved', hero('&#10003;', '#ebe0f0', '#9a7aa8', 'Payout approved', '#9a7aa8', 'Your payout was approved',
    'Hi {{organiser_name}}, your payout for <strong style="color:#1c2040;">{{event_name}}</strong> has been approved. We will transfer <strong>{{amount_net}}</strong> shortly.') +
    ctaRow(btn('{{dashboard_url}}', 'View revenue &rarr;', '#1c2040'))],
  ['payout-paid.html', 'Payout paid', hero('&#10003;', '#daeeff', '#4aa8f0', 'Payout sent', '#4aa8f0', 'Your payout has been sent',
    'Hi {{organiser_name}}, <strong>{{amount_net}}</strong> for <strong style="color:#1c2040;">{{event_name}}</strong> has been marked as paid.') +
    ctaRow(btn('{{dashboard_url}}', 'View revenue &rarr;', '#1c2040'))],
  ['stripe-connect-nudge.html', 'Add bank details', hero('&#127974;', '#fff4d6', '#b8860b', 'Get paid', '#b8860b', 'Add your bank details',
    'Hi {{organiser_name}}, you have paid tickets on sale but your bank details are not set up yet. Connect Stripe to receive payouts when attendees book.') +
    ctaRow(btn('{{connect_url}}', 'Add bank details &rarr;', '#1c2040'))],
  ['meeting-link-added.html', 'Join link added', hero('&#128279;', '#daeeff', '#4aa8f0', 'Online event', '#4aa8f0', 'Your join link is ready',
    'Hi {{user_name}}, the organiser added an online join link for <strong style="color:#1c2040;">{{event_name}}</strong>.') +
    cardBlock(navyCard('<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:16px;line-height:1.65;color:#ffffff;margin:0 0 14px;">{{meeting_link_section}}</p>')) +
    ctaRow(btn('{{event_url}}', 'View event &rarr;', '#4aa8f0'))],
  ['post-event-review-request.html', 'Leave a review', hero('&#9733;', '#fff4d6', '#b8860b', 'How was it?', '#b8860b', 'Share your experience',
    'Hi {{user_name}}, we hope you enjoyed <strong style="color:#1c2040;">{{event_name}}</strong>. A quick review helps other networkers discover great groups.') +
    ctaRow(btn('{{review_url}}', 'Leave a review &rarr;', '#1c2040'))],
  ['category-exclusivity-payment-reminder.html', 'Complete payment', hero('&#9203;', '#fff4d6', '#b8860b', 'Payment due', '#b8860b', 'Complete your booking',
    'Hi {{user_name}}, you were approved for <strong style="color:#1c2040;">{{event_name}}</strong> but have not completed payment yet. Your seat is not secured until you pay.') +
    ctaRow(btn('{{hub_payment_url}}', 'Complete payment &rarr;', '#9a7aa8'))],
  ['event-almost-full.html', 'Almost full', hero('&#9888;', '#fff4d6', '#b8860b', 'Capacity alert', '#b8860b', 'Your event is almost full',
    'Hi {{organiser_name}}, <strong style="color:#1c2040;">{{event_name}}</strong> has only <strong>{{tickets_remaining}}</strong> places left ({{tickets_sold}} sold).') +
    ctaRow(btn('{{dashboard_url}}', 'Manage attendees &rarr;', '#1c2040'))],
  ['attendee-reengagement.html', 'Events for you', hero('&#128075;', '#ebe0f0', '#9a7aa8', 'We miss you', '#9a7aa8', 'Ready to network again?',
    'Hi {{user_name}}, it has been a while since your last booking on The Networker Hub. Here are some popular organisers and upcoming events you might like.') +
    cardBlock('{{recommendations_html}}') +
    ctaRow(btn('{{browse_events_url}}', 'Browse all events &rarr;', '#1c2040'))],
  ['organiser-low-upcoming-events.html', 'Add more events', hero('&#128197;', '#daeeff', '#4aa8f0', 'Your calendar', '#4aa8f0', 'Only {{upcoming_count}} events left on your calendar',
    'Hi {{organiser_name}}, you have <strong>{{upcoming_count}}</strong> upcoming events listed. Keeping a fuller calendar helps members discover your group.') +
    ctaRow(btn('{{create_event_url}}', 'Add another event &rarr;', '#1c2040') + btn('{{dashboard_url}}', 'Open dashboard', '#4aa8f0'))],
  ['saved-organiser-new-listing.html', 'New listing alert', hero('&#9733;', '#ebe0f0', '#9a7aa8', 'New listing', '#9a7aa8', '{{organiser_name}} has a new event',
    'Hi {{user_name}}, <strong style="color:#1c2040;">{{organiser_name}}</strong> just published a new listing you might like.') +
    cardBlock(navyCard('<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:17px;font-weight:600;color:#ffffff;margin:0 0 8px;line-height:1.35;">{{event_name}}</p><p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;color:rgba(255,255,255,0.75);margin:0;">{{event_date}}{{event_time}} &middot; {{event_location}}</p>')) +
    ctaRow(btn('{{event_url}}', 'View event &rarr;', '#4aa8f0'))],
];

for (const [file, title, body] of templates) {
  fs.writeFileSync(path.join(dir, file), shell(title, body));
  console.log('wrote', file);
}
