const fs = require('fs');
const path = require('path');

let cachedCanonicalHtml = null;

function getCanonicalOrganiserNewBookingHtml() {
  if (cachedCanonicalHtml) return cachedCanonicalHtml;
  const filePath = path.join(__dirname, '../../email-templates/organiser-new-booking.html');
  cachedCanonicalHtml = fs.readFileSync(filePath, 'utf8');
  return cachedCanonicalHtml;
}

function isStaleOrganiserNewBookingTemplate(bodyHtml) {
  const body = String(bodyHtml || '');
  if (!body.includes('Someone just booked your event')) return true;
  if (!body.includes('{{attendee_initial}}')) return true;
  if (!body.includes('organiser-email-layout-v2')) return true;
  if (body.startsWith('<p>Hi {{organiser_name}}')) return true;
  if (body.includes('hello@the-networker.co.uk')) return true;
  if (body.includes('Need help?') && !body.includes('{{support_email}}')) return true;
  return false;
}

function resolveOrganiserNewBookingBody(dbBodyHtml) {
  if (isStaleOrganiserNewBookingTemplate(dbBodyHtml)) {
    return {
      bodyHtml: getCanonicalOrganiserNewBookingHtml(),
      source: 'file',
    };
  }
  return {
    bodyHtml: String(dbBodyHtml || ''),
    source: 'database',
  };
}

module.exports = {
  getCanonicalOrganiserNewBookingHtml,
  isStaleOrganiserNewBookingTemplate,
  resolveOrganiserNewBookingBody,
};
