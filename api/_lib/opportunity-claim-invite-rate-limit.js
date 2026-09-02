/**
 * Rate-limit opportunity / franchise / affiliate claim invites:
 * at most one send of the same template to the same email within 24 hours.
 * Stops double-clicks on Assign & send and accidental campaign re-sends.
 */
const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');

const CLAIM_INVITE_SLUGS = new Set([
  'franchise_claim_invite',
  'affiliate_claim_invite',
  'opportunity_claim_invite',
]);

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Fixed subjects we can match in Resend history when the log table is not migrated yet. */
const FIXED_SUBJECTS = {
  franchise_claim_invite: 'Franchise Listing Invitation',
  opportunity_claim_invite: 'Business Opportunity Listing Invitation',
};

function isOpportunityClaimInviteSlug(slug) {
  return CLAIM_INVITE_SLUGS.has(String(slug || '').trim());
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function hoursRemainingFrom(lastSentAt) {
  const lastMs = new Date(lastSentAt).getTime();
  return Math.max(1, Math.ceil((lastMs + WINDOW_MS - Date.now()) / (60 * 60 * 1000)));
}

async function checkClaimInviteLogTable(email, slug) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = getSupabaseAdmin();
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { data, error } = await sb
      .from('claim_invite_send_log')
      .select('id, created_at')
      .eq('email', email)
      .eq('slug', slug)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) {
      if (/claim_invite_send_log|does not exist|schema cache/i.test(error.message || '')) {
        return null;
      }
      console.warn('[claim-invite-rate]', error.message);
      return null;
    }
    const last = data && data[0];
    return last ? last.created_at : false;
  } catch (e) {
    console.warn('[claim-invite-rate]', e && e.message ? e.message : e);
    return null;
  }
}

/** Fallback when log table is missing — scan recent Resend sends for fixed-subject templates. */
async function checkResendRecentClaimInvite(email, slug) {
  const subject = FIXED_SUBJECTS[slug];
  const resendKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!subject || !resendKey) return null;
  try {
    const sinceMs = Date.now() - WINDOW_MS;
    let after = '';
    for (let page = 0; page < 5; page += 1) {
      const url =
        'https://api.resend.com/emails?limit=100' + (after ? '&after=' + encodeURIComponent(after) : '');
      const response = await fetch(url, {
        headers: { Authorization: 'Bearer ' + resendKey },
      });
      if (!response.ok) return null;
      const payload = await response.json();
      const rows = Array.isArray(payload && payload.data) ? payload.data : [];
      if (!rows.length) return false;
      for (const row of rows) {
        const createdMs = new Date(row.created_at || 0).getTime();
        if (!Number.isFinite(createdMs) || createdMs < sinceMs) {
          return false;
        }
        const toList = Array.isArray(row.to) ? row.to : [row.to];
        const hitTo = toList.some(function (t) {
          return normalizeEmail(t) === email;
        });
        if (hitTo && String(row.subject || '').trim() === subject) {
          return row.created_at;
        }
      }
      if (!payload.has_more) return false;
      after = String(rows[rows.length - 1].id || '').trim();
      if (!after) return false;
    }
    return false;
  } catch (e) {
    console.warn('[claim-invite-rate-resend]', e && e.message ? e.message : e);
    return null;
  }
}

/**
 * @returns {{ allowed: true } | { allowed: false, lastSentAt: string, hoursRemaining: number }}
 */
async function checkOpportunityClaimInviteAllowed(opts) {
  const options = opts || {};
  if (options.force || options.skipClaimInviteRateLimit) {
    return { allowed: true };
  }
  const slug = String(options.slug || '').trim();
  const email = normalizeEmail(options.email || options.to);
  if (!isOpportunityClaimInviteSlug(slug) || !email || !email.includes('@')) {
    return { allowed: true };
  }

  const fromTable = await checkClaimInviteLogTable(email, slug);
  if (fromTable) {
    return {
      allowed: false,
      lastSentAt: fromTable,
      hoursRemaining: hoursRemainingFrom(fromTable),
    };
  }

  // Table missing or empty — Resend history covers franchise fixed subject today.
  const fromResend = await checkResendRecentClaimInvite(email, slug);
  if (fromResend) {
    return {
      allowed: false,
      lastSentAt: fromResend,
      hoursRemaining: hoursRemainingFrom(fromResend),
    };
  }

  return { allowed: true };
}

async function assertOpportunityClaimInviteAllowed(opts) {
  const check = await checkOpportunityClaimInviteAllowed(opts);
  if (check.allowed) return check;
  const err = new Error(
    'A claim invite was already emailed to this address in the last 24 hours. Wait before sending again.'
  );
  err.code = 'claim_invite_rate_limited';
  err.lastSentAt = check.lastSentAt;
  err.hoursRemaining = check.hoursRemaining;
  throw err;
}

async function logOpportunityClaimInviteSent(opts) {
  const options = opts || {};
  try {
    if (!isSupabaseConfigured()) return null;
    const slug = String(options.slug || '').trim();
    const email = normalizeEmail(options.email || options.to);
    if (!isOpportunityClaimInviteSlug(slug) || !email) return null;
    const sb = getSupabaseAdmin();
    const opportunityId = String(options.opportunityId || '').trim() || null;
    const { data, error } = await sb
      .from('claim_invite_send_log')
      .insert({
        email,
        slug,
        opportunity_id: opportunityId,
        resend_id: options.resendId || null,
        source: options.source || null,
        metadata: {
          opportunityTitle: options.opportunityTitle || null,
        },
      })
      .select('id, created_at')
      .single();
    if (error) {
      if (/claim_invite_send_log|does not exist|schema cache/i.test(error.message || '')) {
        return null;
      }
      console.warn('[claim-invite-rate-log]', error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('[claim-invite-rate-log]', e && e.message ? e.message : e);
    return null;
  }
}

module.exports = {
  CLAIM_INVITE_SLUGS,
  WINDOW_MS,
  isOpportunityClaimInviteSlug,
  checkOpportunityClaimInviteAllowed,
  assertOpportunityClaimInviteAllowed,
  logOpportunityClaimInviteSent,
};
