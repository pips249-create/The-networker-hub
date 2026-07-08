const fs = require('fs');
const path = require('path');

const STALE_BOOKING_MARKERS = [
  '{{refund_policy_section}}',
  '{{event_location_row}}',
  '{{event_online_row}}',
  '{{meeting_link_section}}',
  '{{sponsor_section}}',
];

let cachedCanonicalHtml = null;

function getCanonicalBookingConfirmationHtml() {
  if (cachedCanonicalHtml) return cachedCanonicalHtml;
  const filePath = path.join(__dirname, '../../email-templates/booking-confirmation.html');
  cachedCanonicalHtml = fs.readFileSync(filePath, 'utf8');
  return cachedCanonicalHtml;
}

function isStaleBookingTemplate(bodyHtml) {
  const body = String(bodyHtml || '');
  if (!body.includes('{{event_meta_rows}}')) return true;
  if (STALE_BOOKING_MARKERS.some(function (marker) {
    return body.includes(marker);
  })) {
    return true;
  }
  // Sponsor should sit directly under the header logo (before "You're booked!").
  var sponsorAt = body.indexOf('{{sponsor_row}}');
  var bookedAt = body.indexOf('You&rsquo;re booked!');
  if (sponsorAt !== -1 && bookedAt !== -1 && sponsorAt > bookedAt) {
    return true;
  }
  var infoBandAt = body.indexOf('info-cell');
  if (sponsorAt !== -1 && infoBandAt !== -1 && sponsorAt > infoBandAt) {
    return true;
  }
  if (!body.includes('{{payment_summary_row}}')) {
    return true;
  }
  const sponsorMatches = body.match(/\{\{sponsor_row\}\}/g);
  if (sponsorMatches && sponsorMatches.length > 1) {
    return true;
  }
  if (!body.includes('{{browse_events_url}}')) {
    return true;
  }
  if (!body.includes('{{hub_payment_url}}')) {
    return true;
  }
  if (!body.includes('{{privacy_url}}')) {
    return true;
  }
  if (body.includes('{{site_url}}/events/')) {
    return true;
  }
  if (body.includes('hello@the-networker.co.uk')) return true;
  if (body.includes('{{logo_url}}" alt="The Networker Hub" width="200"')) return true;
  if (body.includes('The Networker Hub</p>') && body.includes('background:#f5f0e8;padding:28px')) return true;
  return false;
}

function resolveBookingConfirmationBody(dbBodyHtml) {
  if (isStaleBookingTemplate(dbBodyHtml)) {
    return {
      bodyHtml: getCanonicalBookingConfirmationHtml(),
      source: 'file',
    };
  }
  return {
    bodyHtml: String(dbBodyHtml || ''),
    source: 'database',
  };
}

module.exports = {
  getCanonicalBookingConfirmationHtml,
  isStaleBookingTemplate,
  resolveBookingConfirmationBody,
  STALE_BOOKING_MARKERS,
};
