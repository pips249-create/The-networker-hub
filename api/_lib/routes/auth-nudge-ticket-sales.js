const { setCors, json, sessionFromRequest } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const { nudgeOrganiserForTicketSales } = require('../ticket-sales-nudge-emails');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  const body = parseBody(req);
  const eventId = String(body.eventId || body.event_id || '').trim();
  if (!isUuid(eventId)) {
    return json(res, 400, { ok: false, error: 'invalid_event_id' });
  }

  const session = sessionFromRequest(req);
  const nudgerEmail = String(body.email || session?.email || '')
    .trim()
    .toLowerCase();
  const nudgerName = String(body.name || session?.name || '').trim();
  const message = String(body.message || '').trim();

  if (!nudgerEmail) {
    return json(res, 400, {
      ok: false,
      error: 'missing_email',
      message: 'Enter your email so we can record your interest.',
    });
  }

  try {
    const result = await nudgeOrganiserForTicketSales({
      eventId,
      nudgerEmail,
      nudgerName,
      message,
    });
    return json(res, 200, {
      ok: true,
      message:
        'Thanks — we have emailed the organiser to let them know you want tickets. They can switch sales on from their dashboard.',
      nudgeId: result.nudgeId,
    });
  } catch (e) {
    const msg = e.message || String(e);
    if (msg === 'nudge_rate_limited') {
      return json(res, 429, {
        ok: false,
        error: 'nudge_rate_limited',
        message: 'You already nudged the organiser about this event today. Please check back soon.',
      });
    }
    if (msg === 'ticket_sales_platform_closed') {
      return json(res, 403, {
        ok: false,
        error: 'ticket_sales_platform_closed',
        message:
          e.publicMessage ||
          'Ticket interest alerts open when ticket buying starts at 9am on 1 September 2026.',
      });
    }
    if (msg === 'ticket_sales_scheduled') {
      return json(res, 400, {
        ok: false,
        error: 'ticket_sales_scheduled',
        message: 'Tickets are scheduled to open soon — save this event and we will email you when sales start.',
      });
    }
    if (msg === 'ticket_sales_already_enabled') {
      return json(res, 400, {
        ok: false,
        error: 'ticket_sales_already_enabled',
        message: 'Ticket sales are now open for this event — refresh the page to book.',
      });
    }
    return json(res, e.status || 500, {
      ok: false,
      error: 'nudge_failed',
      message:
        msg === 'organiser_email_missing'
          ? 'We could not reach the organiser by email yet. Please try again later.'
          : msg,
    });
  }
};
