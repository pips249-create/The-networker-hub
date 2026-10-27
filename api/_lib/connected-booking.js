const { getSupabaseAdmin } = require('./supabase');
const {
  PLAN_GROUP_LIMITS,
  CHECKOUT_EXTERNAL,
  CHECKOUT_LINK_OUT,
  CHECKOUT_HUB,
  connectedBookingFeatureEnabled,
  connectedBookingAllowedForEmail,
  connectedBookingAllowedForSession,
  connectedBookingOperationsEnabled,
  connectedBookingPreviewLocked,
  connectedBookingPilotGrantEligible,
  connectedBookingPilotGrantPlan,
  connectedBookingFreeEnabled,
  connectedBookingFreeDefaultPlan,
  normalizeConnectedBookingEmail,
  accountHasAdminConnectedGrant,
  accountHasLinkOutGrant,
  isExternalConnectedEvent,
  isExternalLinkOutEvent,
  isExternalCheckoutEvent,
  publicListingUsesExternalBooking,
  normalizeExternalPriceLabel,
  normalizeExternalBookingNote,
  normalizeExternalBookingUrl,
  parseExternalPriceLabelToDisplay,
  newWebhookSecret,
  signWebhookPayload,
  verifyWebhookSignature,
  groupLimitForPlan,
  isConnectedPlanActive,
} = require('./connected-booking-util');

const ACCOUNT_SELECT_BASE =
  'id, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret, connected_booking_stripe_subscription_id, connected_booking_granted_at, link_out_granted_at';

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
  let account = null;
  let accErr = null;
  ({ data: account, error: accErr } = await sb
    .from('organiser_accounts')
    .select(ACCOUNT_SELECT_BASE)
    .eq('id', accountId)
    .maybeSingle());
  if (accErr && /connected_booking_granted_at|link_out_granted_at/i.test(String(accErr.message || ''))) {
    ({ data: account, error: accErr } = await sb
      .from('organiser_accounts')
      .select(
        'id, connected_booking_plan, connected_booking_status, connected_booking_webhook_secret, connected_booking_stripe_subscription_id'
      )
      .eq('id', accountId)
      .maybeSingle());
  }
  if (accErr) throw new Error(accErr.message);
  return account ? { ...account, organiser_id: orgId } : null;
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
    e.message = connectedBookingFreeEnabled()
      ? 'Connected booking is not active on your account. Open Connected booking in your organiser workspace to activate it (free).'
      : 'Connected booking is not active on your account. Subscribe or contact us to enable it.';
    throw e;
  }
  const limit = groupLimitForPlan(account.connected_booking_plan);
  if (limit != null && !opts.skipGroupLimit) {
    const used = await countPublishedGroupsForAccount(sb, account.id);
    if (used > limit) {
      const e = new Error('connected_booking_group_limit');
      e.status = 403;
      e.code = 'connected_booking_group_limit';
      e.message = connectedBookingFreeEnabled()
        ? `Connected booking allows up to ${limit} group profile(s) on this account. Contact hi@thenetworkeruk.com if you need more.`
        : `Your plan allows up to ${limit} group profile(s). Upgrade to add more.`;
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

async function emailForOrganiserAccountId(sb, organiserAccountId) {
  const accountId = String(organiserAccountId || '').trim();
  if (!accountId) return '';
  const { data: account, error } = await sb
    .from('organiser_accounts')
    .select('supabase_user_id')
    .eq('id', accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const userId = String(account?.supabase_user_id || '').trim();
  if (!userId) return '';
  try {
    const { data: userData, error: userErr } = await sb.auth.admin.getUserById(userId);
    if (userErr) throw userErr;
    return normalizeConnectedBookingEmail(userData?.user?.email);
  } catch {
    return '';
  }
}

async function connectedBookingAllowedForOrganiserAccountId(sb, organiserAccountId) {
  const preview = connectedBookingPreviewLocked();
  if (!preview && !connectedBookingFeatureEnabled()) return false;
  if (!preview) return true;
  const email = await emailForOrganiserAccountId(sb, organiserAccountId);
  if (connectedBookingAllowedForEmail(email)) return true;
  const accountId = String(organiserAccountId || '').trim();
  if (!accountId) return false;
  const { data: account } = await sb
    .from('organiser_accounts')
    .select('id, connected_booking_status, connected_booking_granted_at')
    .eq('id', accountId)
    .maybeSingle();
  return isConnectedPlanActive(account) || accountHasAdminConnectedGrant(account);
}

async function assertLinkOutEntitlement(sb, organiserId) {
  const account = await loadOrganiserAccountForOrganiserId(sb, organiserId);
  if (!account) {
    const e = new Error('link_out_no_account');
    e.status = 403;
    e.code = 'link_out_no_account';
    throw e;
  }
  if (!accountHasLinkOutGrant(account) && !isConnectedPlanActive(account)) {
    const e = new Error('link_out_inactive');
    e.status = 403;
    e.code = 'link_out_inactive';
    e.message =
      'Link Out is not enabled on your account. Ask The Networker UK to allocate it, or use Connected booking.';
    throw e;
  }
  return account;
}

module.exports = {
  PLAN_GROUP_LIMITS,
  CHECKOUT_EXTERNAL,
  CHECKOUT_LINK_OUT,
  CHECKOUT_HUB,
  connectedBookingFeatureEnabled,
  connectedBookingAllowedForEmail,
  connectedBookingAllowedForSession,
  connectedBookingOperationsEnabled,
  connectedBookingPreviewLocked,
  connectedBookingPilotGrantEligible,
  connectedBookingPilotGrantPlan,
  connectedBookingFreeEnabled,
  connectedBookingFreeDefaultPlan,
  accountHasAdminConnectedGrant,
  accountHasLinkOutGrant,
  emailForOrganiserAccountId,
  connectedBookingAllowedForOrganiserAccountId,
  isExternalConnectedEvent,
  isExternalLinkOutEvent,
  isExternalCheckoutEvent,
  publicListingUsesExternalBooking,
  normalizeExternalPriceLabel,
  normalizeExternalBookingNote,
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
  assertLinkOutEntitlement,
  logExternalSync,
  ...require('./connected-booking-slots'),
};
