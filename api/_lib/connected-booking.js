const { getSupabaseAdmin } = require('./supabase');
const {
  PLAN_GROUP_LIMITS,
  CHECKOUT_EXTERNAL,
  CHECKOUT_HUB,
  connectedBookingFeatureEnabled,
  isExternalConnectedEvent,
  normalizeExternalPriceLabel,
  normalizeExternalBookingUrl,
  parseExternalPriceLabelToDisplay,
  newWebhookSecret,
  signWebhookPayload,
  verifyWebhookSignature,
  groupLimitForPlan,
} = require('./connected-booking-util');

async function loadOrganiserAccountForOrganiserId(sb, organiserId) {
  const orgId = String(organiserId || '').trim();
  if (!orgId) return null;
  const { data: org, error: orgErr } = await sb
    .from('organisers')
    .select('id, organiser_account_id')
    .eq('id', orgId)
    .maybeSingle();
  if (orgErr) throw new Error(orgErr.message);
  const accountId = String(org?.organiser_account_id || '').trim();
  if (!accountId) return null;
  const { data: account, error: accErr } = await sb
    .from('organiser_accounts')
    .select(
      'id, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret, connected_booking_stripe_subscription_id'
    )
    .eq('id', accountId)
    .maybeSingle();
  if (accErr) throw new Error(accErr.message);
  return account ? { ...account, organiser_id: orgId } : null;
}

function isConnectedPlanActive(account) {
  if (!account) return false;
  return String(account.connected_booking_status || '').trim() === 'active';
}

async function countPublishedGroupsForAccount(sb, organiserAccountId) {
  const accountId = String(organiserAccountId || '').trim();
  if (!accountId) return 0;
  const { count, error } = await sb
    .from('organisers')
    .select('id', { count: 'exact', head: true })
    .eq('organiser_account_id', accountId)
    .neq('listing_status', 'unpublished');
  if (error) throw new Error(error.message);
  return Number(count) || 0;
}

async function assertConnectedBookingEntitlement(sb, organiserId, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const account = await loadOrganiserAccountForOrganiserId(sb, organiserId);
  if (!account) {
    const e = new Error('connected_booking_no_account');
    e.status = 403;
    e.code = 'connected_booking_no_account';
    throw e;
  }
  if (!opts.skipPlanCheck && !isConnectedPlanActive(account)) {
    const e = new Error('connected_booking_inactive');
    e.status = 403;
    e.code = 'connected_booking_inactive';
    e.message =
      'Connected booking is not active on your account. Subscribe or contact us to enable it.';
    throw e;
  }
  const limit = groupLimitForPlan(account.connected_booking_plan);
  if (limit != null && !opts.skipGroupLimit) {
    const used = await countPublishedGroupsForAccount(sb, account.id);
    if (used > limit) {
      const e = new Error('connected_booking_group_limit');
      e.status = 403;
      e.code = 'connected_booking_group_limit';
      e.message = `Your plan allows up to ${limit} group profile(s). Upgrade to add more.`;
      throw e;
    }
  }
  return account;
}

async function logExternalSync(sb, row) {
  try {
    await sb.from('external_booking_sync_log').insert(row);
  } catch (e) {
    console.warn('[external-booking] sync log failed', e?.message || e);
  }
}

module.exports = {
  PLAN_GROUP_LIMITS,
  CHECKOUT_EXTERNAL,
  CHECKOUT_HUB,
  connectedBookingFeatureEnabled,
  isExternalConnectedEvent,
  normalizeExternalPriceLabel,
  normalizeExternalBookingUrl,
  parseExternalPriceLabelToDisplay,
  newWebhookSecret,
  signWebhookPayload,
  verifyWebhookSignature,
  loadOrganiserAccountForOrganiserId,
  isConnectedPlanActive,
  countPublishedGroupsForAccount,
  groupLimitForPlan,
  assertConnectedBookingEntitlement,
  logExternalSync,
};
