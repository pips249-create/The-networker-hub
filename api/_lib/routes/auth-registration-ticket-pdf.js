const { setCors, json, sessionFromRequest } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const {
  loadRegistrationForAttendee,
  bookingIsComplete,
  buildTicketPdf,
} = require('../registration-documents');

function registrationIdFromRequest(req) {
  const q = req.query || {};
  return String(q.registrationId || q.registration_id || q.id || '').trim();
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'private, no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  if (!session?.email) return json(res, 401, { error: 'not_authenticated' });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { error: 'supabase_not_configured' });
  }

  const registrationId = registrationIdFromRequest(req);
  if (!registrationId) return json(res, 400, { error: 'missing_registration_id' });

  try {
    const { registration, context } = await loadRegistrationForAttendee(session, registrationId);
    if (!bookingIsComplete(registration, context.booked)) {
      return json(res, 400, {
        error: 'ticket_not_available',
        message: 'Your ticket is available once your booking is confirmed.',
      });
    }

    const pdf = buildTicketPdf(context);
    const filename = 'ticket-' + context.bookingReference.replace(/[^a-z0-9-]+/gi, '-').toLowerCase() + '.pdf';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    res.end(pdf);
  } catch (e) {
    return json(res, e.status || 500, {
      error: 'ticket_pdf_failed',
      message: e.message || String(e),
    });
  }
};
