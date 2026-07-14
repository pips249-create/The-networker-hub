const { setCors, json, sessionFromRequest } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const {
  loadRegistrationForAttendee,
  invoiceAvailable,
  buildHubInvoiceHtml,
  buildTaxInvoicePdf,
  retrieveStripeReceiptUrl,
} = require('../registration-documents');

function registrationIdFromRequest(req) {
  const q = req.query || {};
  return String(q.registrationId || q.registration_id || q.id || '').trim();
}

function formatFromRequest(req) {
  const q = req.query || {};
  return String(q.format || q.f || '').trim().toLowerCase();
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
        message: 'A tax invoice is available once payment has been completed.',
      });
    }

    const wantPdf = formatFromRequest(req) === 'pdf';
    if (wantPdf) {
      const pdf = buildTaxInvoicePdf(context);
      const filename =
        'tax-invoice-' + context.bookingReference.replace(/[^a-z0-9-]+/gi, '-').toLowerCase() + '.pdf';
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
      return res.end(pdf);
    }

    let stripeReceiptUrl = null;
    try {
      stripeReceiptUrl = await retrieveStripeReceiptUrl(sb, registration);
    } catch {
      /* Hub receipt still available */
    }

    const html = buildHubInvoiceHtml(context, { stripeReceiptUrl });
    const filename =
      'tax-invoice-' + context.bookingReference.replace(/[^a-z0-9-]+/gi, '-').toLowerCase() + '.html';
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
