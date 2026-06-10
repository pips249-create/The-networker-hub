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
  return STALE_BOOKING_MARKERS.some(function (marker) {
    return body.includes(marker);
  });
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
