/**
 * Email a brand their sponsor performance pack summary.
 * POST { company, from?, to?, toEmail? }
 */
const { requireAdmin, json, setCors, sessionFromRequest } = require('../auth');
const { isSupabaseConfigured, getSupabaseAdmin } = require('../supabase');
const { getSponsorClicksReport } = require('../sponsor-clicks');
const { sendViaResend } = require('../send-template-email');
const {
  EVENTS_BROWSE_CAROUSEL_SLOT,
  parseCarouselBody,
  normalizeCarouselAdsList,
} = require('../event-page-carousel');

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

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function resolveContactEmail(company) {
  const needle = String(company || '').trim().toLowerCase();
  if (!needle || !isSupabaseConfigured()) return '';
  const sb = getSupabaseAdmin();
  const res = await sb
    .from('cms_blocks')
    .select('body')
    .eq('slot', EVENTS_BROWSE_CAROUSEL_SLOT)
    .maybeSingle();
  if (res.error || !res.data) return '';
  const ads = normalizeCarouselAdsList(parseCarouselBody(res.data.body), EVENTS_BROWSE_CAROUSEL_SLOT);
  const match = ads.find(function (ad) {
    return String(ad.company_name || '').trim().toLowerCase() === needle && ad.contact_email;
  });
  return match ? String(match.contact_email || '').trim() : '';
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  const body = parseBody(req);
  const company = String(body.company || '').trim();
  if (!company) {
    return json(res, 400, { ok: false, error: 'missing_company', message: 'Select a brand first.' });
  }

  let toEmail = String(body.toEmail || body.to_email || '').trim().toLowerCase();
  if (!toEmail) toEmail = await resolveContactEmail(company);
  if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    return json(res, 400, {
      ok: false,
      error: 'missing_email',
      message:
        'No contact email on file for this brand. Add a contact email on their directory carousel slot, or pass toEmail.',
    });
  }

  try {
    const report = await getSponsorClicksReport({
      company,
      from: body.from || '',
      to: body.to || '',
      placement: body.placement || 'events_browse_carousel',
    });

    const summary = report.summary || {};
    const impressions = (report.impressions && report.impressions.total) || 0;
    const clicks = report.total || 0;
    const from = report.from || body.from || '';
    const to = report.to || body.to || '';

    const html =
      '<div style="font-family:Georgia,serif;color:#2d2636;line-height:1.5;max-width:560px">' +
      '<p style="margin:0 0 12px">Hi,</p>' +
      '<p style="margin:0 0 12px">Here is your Sponsored performance summary for <strong>' +
      esc(company) +
      '</strong> on The Networker UK' +
      (from || to ? ' (' + esc(from) + ' to ' + esc(to) + ')' : '') +
      '.</p>' +
      '<table style="border-collapse:collapse;width:100%;margin:16px 0">' +
      '<tr><td style="padding:10px 12px;border:1px solid #e7e2ea;background:#faf8fc"><strong>Logo views</strong></td>' +
      '<td style="padding:10px 12px;border:1px solid #e7e2ea;text-align:right">' +
      esc(impressions) +
      '</td></tr>' +
      '<tr><td style="padding:10px 12px;border:1px solid #e7e2ea;background:#faf8fc"><strong>Logo clicks</strong></td>' +
      '<td style="padding:10px 12px;border:1px solid #e7e2ea;text-align:right">' +
      esc(clicks) +
      '</td></tr>' +
      '</table>' +
      '<p style="margin:0 0 12px;font-size:14px;color:#635c5e">Figures are first-party counts from the events directory Sponsored carousel and other placements where your brand appeared.</p>' +
      '<p style="margin:0">Questions? Reply to this email or write to rosie@thenetworkeruk.com.</p>' +
      '<p style="margin:16px 0 0;font-size:13px;color:#635c5e">— The Networker UK</p>' +
      '</div>';

    await sendViaResend({
      to: toEmail,
      subject: 'Your Sponsored performance — ' + company,
      html,
      replyTo: 'rosie@thenetworkeruk.com',
      tags: [{ name: 'category', value: 'sponsor_pack' }],
    });

    return json(res, 200, {
      ok: true,
      emailed: toEmail,
      company,
      impressions,
      clicks,
      summary,
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: e.code || 'sponsor_pack_email_failed',
      message: e.message || 'Could not email the pack.',
    });
  }
};
