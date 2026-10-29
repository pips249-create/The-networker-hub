const fs = require('fs');
const path = require('path');

const BOOKING_REMINDER_SUBJECT = 'Your event is happening soon – {{event_name}}';

let cachedCanonicalHtml = null;

function getCanonicalBookingReminderHtml() {
  if (cachedCanonicalHtml) return cachedCanonicalHtml;
  const filePath = path.join(__dirname, '../../email-templates/booking-reminder-24hr.html');
  cachedCanonicalHtml = fs.readFileSync(filePath, 'utf8');
  return cachedCanonicalHtml;
}

function isStaleBookingReminderTemplate(bodyHtml) {
  const body = String(bodyHtml || '');
  // Fresh copy uses timing-agnostic "happening soon" (covers 24h + catch-up sends).
  if (!body.includes('happening soon') && !body.includes('Happening soon')) return true;
  if (!body.includes('{{meeting_link_row}}') && body.includes('meeting_link_section')) return true;
  if (body.startsWith('<p>Hi {{user_name}}')) return true;
  const sponsorMatches = body.match(/\{\{sponsor_row\}\}/g);
  if (sponsorMatches && sponsorMatches.length > 1) return true;
  const sponsorAt = body.indexOf('{{sponsor_row}}');
  const keepBuildingAt = body.indexOf('Keep building');
  const waveAt = body.indexOf('viewBox="0 0 600 40"');
  if (sponsorAt === -1) return true;
  if (waveAt !== -1 && sponsorAt > waveAt) return true;
  if (sponsorAt !== -1 && keepBuildingAt !== -1 && sponsorAt > keepBuildingAt) return true;
  const headerLogoAt = body.indexOf('alt="The Networker UK" width="180"');
  if (
    sponsorAt !== -1 &&
    headerLogoAt !== -1 &&
    sponsorAt < headerLogoAt
  ) {
    return true;
  }
  if (body.includes('hi@thenetworkeruk.com')) return true;
  if (body.includes('{{logo_url}}" alt="The Networker UK" width="200"')) return true;
  if (body.includes('The Networker UK</p>') && body.includes('background:#f5f0e8;padding:28px')) return true;
  if (!body.includes('hub-email-layout-v3-purple')) return true;
  if (body.includes('background:#4a4446')) return true;
  if (!body.includes('{{logo_footer_url}}')) return true;
  if (!body.includes('{{privacy_url}}')) return true;
  // Reply-To / help contact is hi@ (support_email), not the mail.* From address.
  if (!body.includes('Questions about this event? Email')) return true;
  if (!body.includes('mailto:{{support_email}}')) return true;
  // Legacy "tomorrow" / exact-24h wording is stale even if other markers match.
  if (/\btomorrow\b/i.test(body) || body.includes('24&nbsp;hours') || body.includes('24 hours')) {
    return true;
  }
  return false;
}

function isStaleBookingReminderSubject(subject) {
  const text = String(subject || '').trim();
  if (!text) return true;
  if (/\btomorrow\b/i.test(text)) return true;
  if (!/happening soon/i.test(text)) return true;
  return false;
}

function resolveBookingReminderBody(dbBodyHtml) {
  if (isStaleBookingReminderTemplate(dbBodyHtml)) {
    return {
      bodyHtml: getCanonicalBookingReminderHtml(),
      source: 'file',
    };
  }
  return {
    bodyHtml: String(dbBodyHtml || ''),
    source: 'database',
  };
}

function resolveBookingReminderSubject(dbSubject) {
  if (isStaleBookingReminderSubject(dbSubject)) {
    return {
      subject: BOOKING_REMINDER_SUBJECT,
      source: 'file',
    };
  }
  return {
    subject: String(dbSubject || BOOKING_REMINDER_SUBJECT),
    source: 'database',
  };
}

module.exports = {
  BOOKING_REMINDER_SUBJECT,
  getCanonicalBookingReminderHtml,
  isStaleBookingReminderTemplate,
  isStaleBookingReminderSubject,
  resolveBookingReminderBody,
  resolveBookingReminderSubject,
};
