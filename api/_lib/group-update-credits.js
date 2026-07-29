/**
 * Extra monthly group-update send credits (Hub platform Checkout).
 * Free: 1/group/month. Hard cap: 4/group/month. Credits roll over.
 */
const { getSupabaseAdmin } = require('./supabase');

/** VAT-inclusive GBP — same style as featured event listings. */
const CREDIT_PACKS = {
  '1': {
    id: '1',
    credits: 1,
    amountPence: 900,
    label: '1 extra send',
    catalogKey: 'group_update_credits_1',
    blurb: 'One more branded Hub round-up — stats, event cards & booking links',
  },
  '3': {
    id: '3',
    credits: 3,
    amountPence: 2200,
    label: '3 extra sends',
    catalogKey: 'group_update_credits_3',
    blurb: 'Best value — enough to reach this month’s send cap after your free update',
  },
};

function normalizePackId(raw) {
  const id = String(raw || '').trim();
  if (CREDIT_PACKS[id]) return id;
  const asNum = String(parseInt(id, 10) || '');
  if (CREDIT_PACKS[asNum]) return asNum;
  return '';
}

function getCreditPack(packId) {
  const id = normalizePackId(packId);
  return id ? CREDIT_PACKS[id] : null;
}

function listCreditPacks() {
  return Object.values(CREDIT_PACKS).map((p) => ({
    id: p.id,
    credits: p.credits,
    amountPence: p.amountPence,
    amountLabel: '£' + (p.amountPence / 100).toFixed(2).replace(/\.00$/, ''),
    label: p.label,
    blurb: p.blurb,
  }));
}

async function addGroupUpdateCredits(organiserId, credits, { sessionId, amountPence, packId } = {}) {
  const sb = getSupabaseAdmin();
  const orgId = String(organiserId || '').trim();
  const qty = Math.max(0, Math.floor(Number(credits) || 0));
  const sid = String(sessionId || '').trim();
  if (!orgId || !qty) {
    return { skipped: true, reason: 'missing_args' };
  }

  if (sid) {
    const { data: existing, error: existingErr } = await sb
      .from('organiser_group_update_credit_purchases')
      .select('id, credits')
      .eq('stripe_checkout_session_id', sid)
      .maybeSingle();
    if (!existingErr && existing) {
      return {
        ok: true,
        alreadyApplied: true,
        organiserId: orgId,
        creditsAdded: Number(existing.credits) || qty,
      };
    }
  }

  const { data: org, error: readErr } = await sb
    .from('organisers')
    .select('id, group_update_extra_credits')
    .eq('id', orgId)
    .maybeSingle();
  if (readErr) {
    if (/group_update_extra_credits/i.test(String(readErr.message || ''))) {
      const err = new Error('Extra credits are not available yet. Please try again shortly.');
      err.status = 503;
      err.code = 'credits_not_ready';
      throw err;
    }
    throw new Error(readErr.message);
  }
  if (!org) {
    const err = new Error('organiser_not_found');
    err.status = 404;
    throw err;
  }

  const next = Math.max(0, (Number(org.group_update_extra_credits) || 0) + qty);
  const { error: upErr } = await sb
    .from('organisers')
    .update({ group_update_extra_credits: next })
    .eq('id', orgId);
  if (upErr) throw new Error(upErr.message);

  if (sid) {
    const { error: logErr } = await sb.from('organiser_group_update_credit_purchases').insert({
      stripe_checkout_session_id: sid,
      organiser_id: orgId,
      credits: qty,
      amount_pence: Math.max(0, Math.round(Number(amountPence) || 0)),
      pack_id: String(packId || '').slice(0, 16),
    });
    if (logErr && !/duplicate|unique|does not exist|schema cache/i.test(String(logErr.message || ''))) {
      console.error('group_update_credit_purchase_log_failed', logErr.message);
    }
  }

  return {
    ok: true,
    organiserId: orgId,
    creditsAdded: qty,
    extraCredits: next,
  };
}

async function handleGroupUpdateCreditsCheckout(session) {
  const metadata = session?.metadata || {};
  if (metadata.checkout_type !== 'group_update_credits') {
    return { skipped: true, reason: 'not_group_update_credits' };
  }

  const organiserId = String(metadata.organiser_id || '').trim();
  const pack = getCreditPack(metadata.credit_pack || metadata.pack_id);
  const credits =
    Math.max(0, Math.floor(Number(metadata.credit_quantity) || 0)) || (pack && pack.credits) || 0;
  if (!organiserId || !credits) {
    return { skipped: true, reason: 'missing_metadata' };
  }

  const paid =
    session.payment_status === 'paid' ||
    session.payment_status === 'no_payment_required' ||
    session.status === 'complete';
  if (!paid) return { skipped: true, reason: 'payment_not_complete' };

  const amountPence =
    Number(metadata.amount_pence) ||
    (Number.isFinite(Number(session.amount_total)) ? Number(session.amount_total) : 0);

  return addGroupUpdateCredits(organiserId, credits, {
    sessionId: session.id,
    amountPence,
    packId: pack ? pack.id : String(metadata.credit_pack || ''),
  });
}

module.exports = {
  CREDIT_PACKS,
  normalizePackId,
  getCreditPack,
  listCreditPacks,
  addGroupUpdateCredits,
  handleGroupUpdateCreditsCheckout,
};
