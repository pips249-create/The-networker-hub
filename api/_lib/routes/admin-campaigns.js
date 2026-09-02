const { sessionFromRequest, requireAdmin, json, setCors } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { sendTemplatedEmail } = require('../send-template-email');
const { parseCsv } = require('../admin-csv-import');
const { resolveOrganiserClaimUrl } = require('../organiser-claim-url');
const { isClaimInviteSlug, logClaimInviteSent } = require('../organiser-claim-invite-log');
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

function organiserDisplayName(email, baseVars, nameByEmail) {
  if (baseVars.organiser_name) return baseVars.organiser_name;
  if (baseVars.group_name) return baseVars.group_name;
  const fromDb = nameByEmail && nameByEmail.get(String(email || '').trim().toLowerCase());
  if (fromDb) return fromDb;
  return String(email)
    .split('@')[0]
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Prefer the public group listing name over the email local-part for claim/launch campaigns.
 */
async function fetchOrganiserNamesByEmail(emails) {
  const map = new Map();
  const list = [
    ...new Set((emails || []).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean)),
  ];
  if (!list.length || !isSupabaseConfigured()) return map;

  const sb = getSupabaseAdmin();
  const chunkSize = 80;
  for (let i = 0; i < list.length; i += chunkSize) {
    const chunk = list.slice(i, i + chunkSize);
    const [byContact, byEmail] = await Promise.all([
      sb.from('organisers').select('name, contact_email, email').in('contact_email', chunk),
      sb.from('organisers').select('name, contact_email, email').in('email', chunk),
    ]);
    const rows = []
      .concat(byContact.error ? [] : byContact.data || [])
      .concat(byEmail.error ? [] : byEmail.data || []);
    rows.forEach((row) => {
      const name = String(row.name || '').trim();
      if (!name) return;
      [row.contact_email, row.email].forEach((raw) => {
        const em = String(raw || '')
          .trim()
          .toLowerCase();
        if (!em || !list.includes(em)) return;
        if (!map.has(em)) map.set(em, name);
      });
    });
  }
  return map;
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
  const nameByEmail = await fetchOrganiserNamesByEmail(emails);
  const sent = [];
  const failed = [];

  for (const email of emails) {
    const organiserName = organiserDisplayName(email, baseVars, nameByEmail);
    const variables = {
      ...siteVars,
      organiser_name: organiserName,
      group_name: organiserName,
      ...baseVars,
    };
    // Keep DB/group name when caller did not pass an explicit organiser_name.
    if (!baseVars.organiser_name && !baseVars.group_name) {
      variables.organiser_name = organiserName;
      variables.group_name = organiserName;
    }

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
    } else if (slug === 'organiser_claim_invite' || slug === 'organiser_launch_invite') {
      sendOpts.replyTo = baseVars.reply_to || 'catherine@thenetworkeruk.com';
    }

    try {
      await sendTemplatedEmail(sendOpts);
      sent.push(email);
      if (isClaimInviteSlug(slug)) {
        await logClaimInviteSent({
          email,
          organiserName,
          slug,
          source: 'admin_campaign',
          campaign: slug,
          actorEmail: session && session.email,
        });
      }
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
