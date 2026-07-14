const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { isSupabaseConfigured } = require('../supabase');
const { sendTemplatedEmail } = require('../send-template-email');
const { parseCsv } = require('../admin-csv-import');
const { resolveOrganiserClaimUrl } = require('../organiser-claim-url');
const {
  campaignSiteVars,
  legacyCampaignFrom,
  isRebrandCampaignSlug,
  LEGACY_REPLY_EMAIL,
} = require('../organiser-campaign-defaults');

const MAX_BULK = 50;

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

function siteUrl() {
  return process.env.SITE_URL || 'https://the-networker-hub.vercel.app';
}

function normalizeEmails(raw) {
  const list = [];
  if (Array.isArray(raw)) {
    raw.forEach((e) => {
      const em = String(e || '')
        .trim()
        .toLowerCase();
      if (em && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) list.push(em);
    });
  }
  return [...new Set(list)];
}

function organiserDisplayName(email, baseVars) {
  if (baseVars.organiser_name) return baseVars.organiser_name;
  return String(email)
    .split('@')[0]
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const session = sessionFromRequest(req);
  const gate = requireAdmin(session);
  if (!gate.ok) return json(res, gate.status, { error: gate.error });

  if (!isSupabaseConfigured()) {
    return json(res, 503, { ok: false, error: 'supabase_not_configured' });
  }

  const body = parseBody(req);
  const action = String(body.action || 'bulk_send').trim();

  if (action !== 'bulk_send') {
    return json(res, 400, { ok: false, error: 'unknown_action' });
  }

  const slug = String(body.slug || 'organiser_rebrand_announcement').trim();
  let emails = normalizeEmails(body.emails);

  if (body.csv) {
    try {
      const rows = parseCsv(String(body.csv));
      emails = normalizeEmails([...emails, ...rows.map((r) => r.email)]);
    } catch (e) {
      return json(res, 400, { ok: false, error: 'invalid_csv', message: e.message });
    }
  }

  if (!emails.length) {
    return json(res, 400, { ok: false, error: 'no_recipients' });
  }
  if (emails.length > MAX_BULK) {
    return json(res, 400, {
      ok: false,
      error: 'too_many_recipients',
      message: 'Send up to ' + MAX_BULK + ' emails per batch.',
      limit: MAX_BULK,
    });
  }

  const host = siteUrl();
  const baseVars =
    body.variables && typeof body.variables === 'object' ? { ...body.variables } : {};
  const siteVars = campaignSiteVars(host);
  const rebrand = isRebrandCampaignSlug(slug);
  const sent = [];
  const failed = [];

  for (const email of emails) {
    const organiserName = organiserDisplayName(email, baseVars);
    const variables = {
      ...siteVars,
      organiser_name: organiserName,
      ...baseVars,
    };

    if (!rebrand) {
      let claimUrl = baseVars.claim_url;
      if (!claimUrl) {
        try {
          claimUrl = await resolveOrganiserClaimUrl(email, host);
        } catch {
          claimUrl =
            host +
            '/register?email=' +
            encodeURIComponent(email) +
            '&next=' +
            encodeURIComponent('/organiser/?onboard=claim') +
            '&intent=organiser-claim';
        }
      }
      variables.claim_url = claimUrl;
    }

    const sendOpts = {
      slug,
      to: email,
      variables,
      skipEmailCheck: true,
    };

    if (rebrand) {
      sendOpts.from = baseVars.resend_from || legacyCampaignFrom();
      sendOpts.replyTo = baseVars.reply_to || LEGACY_REPLY_EMAIL;
    }

    try {
      await sendTemplatedEmail(sendOpts);
      sent.push(email);
    } catch (e) {
      failed.push({ email, message: e.message || String(e.code || 'send_failed') });
    }
  }

  return json(res, 200, {
    ok: true,
    slug,
    sent: sent.length,
    failed: failed.length,
    sentTo: sent,
    failures: failed,
    message:
      sent.length +
      ' sent' +
      (failed.length ? ', ' + failed.length + ' failed' : '') +
      (emails.length >= MAX_BULK ? ' (batch limit ' + MAX_BULK + ')' : '') +
      '.',
  });
};
