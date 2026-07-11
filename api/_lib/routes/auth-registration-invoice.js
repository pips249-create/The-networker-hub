const { setCors, json, sessionFromRequest } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const {
  loadRegistrationForAttendee,
  invoiceAvailable,
  buildHubInvoiceHtml,
  retrieveStripeReceiptUrl,
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
    const { sb, registration, context } = await loadRegistrationForAttendee(session, registrationId);
    if (!invoiceAvailable(registration, context.booked)) {
      return json(res, 400, {
        error: 'invoice_not_available',
        message: 'An invoice is available once payment has been completed.',
      });
    }

    const stripeReceiptUrl = await retrieveStripeReceiptUrl(sb, registration);
    if (stripeReceiptUrl) {
      res.statusCode = 302;
      res.setHeader('Location', stripeReceiptUrl);
      return res.end();
    }

    const html = buildHubInvoiceHtml(context);
    const filename =
      'invoice-' + context.bookingReference.replace(/[^a-z0-9-]+/gi, '-').toLowerCase() + '.html';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    res.end(html);
  } catch (e) {
    return json(res, e.status || 500, {
      error: 'invoice_failed',
      message: e.message || String(e),
    });
  }
};
