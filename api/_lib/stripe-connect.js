/**
 * Stripe Connect — organiser onboarding and checkout destination charges.
 */
const { getSupabaseAdmin } = require('./supabase');
const { getStripeClient, isStripeCheckoutConfigured, siteBaseUrl } = require('./stripe-checkout');
const { calculatePlatformApplicationFeePence } = require('./stripe-refunds');

function isStripeConnectEnabled() {
  if (!isStripeCheckoutConfigured()) return false;
  const flag = String(process.env.STRIPE_CONNECT_ENABLED || '').trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

function connectRequiredForPaidCheckout() {
  return isStripeConnectEnabled();
}

async function retrieveConnectAccount(accountId) {
  if (!accountId || !isStripeCheckoutConfigured()) return null;
  const stripe = getStripeClient();
  return stripe.accounts.retrieve(String(accountId));
}

function mapConnectStatus(account) {
  if (!account) {
    return {
      connected: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      ready: false,
    };
  }
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const detailsSubmitted = Boolean(account.details_submitted);
  return {
    connected: true,
    accountId: account.id,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    ready: chargesEnabled && detailsSubmitted,
  };
}

async function syncOrganiserConnectStatus(organiserId) {
  const sb = getSupabaseAdmin();
  const { data: row, error } = await sb
    .from('organisers')
    .select('id, stripe_account_id, stripe_connect_onboarded_at')
    .eq('id', organiserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row?.stripe_account_id) {
    return {
      organiserId,
      ...mapConnectStatus(null),
    };
  }

  const account = await retrieveConnectAccount(row.stripe_account_id);
  const status = mapConnectStatus(account);

  await sb
    .from('organisers')
    .update({
      stripe_charges_enabled: status.chargesEnabled,
      stripe_payouts_enabled: status.payoutsEnabled,
      stripe_connect_details_submitted: status.detailsSubmitted,
      stripe_connect_onboarded_at: status.ready
        ? row.stripe_connect_onboarded_at || new Date().toISOString()
        : null,
    })
    .eq('id', organiserId);

  return { organiserId, ...status };
}

async function createConnectAccountForOrganiser(organiser) {
  const stripe = getStripeClient();
  const email = String(organiser.email || organiser.contact_email || '').trim().toLowerCase();
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'GB',
    email: email || undefined,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: {
      name: String(organiser.name || 'Event organiser').trim() || undefined,
    },
    metadata: {
      organiser_id: String(organiser.id),
      hub: 'the-networker-hub',
    },
  });

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('organisers')
    .update({
      stripe_account_id: account.id,
      stripe_charges_enabled: Boolean(account.charges_enabled),
      stripe_payouts_enabled: Boolean(account.payouts_enabled),
      stripe_connect_details_submitted: Boolean(account.details_submitted),
    })
    .eq('id', organiser.id);
  if (error) throw new Error(error.message);

  return account;
}

async function createConnectOnboardingLink(organiserId, returnPath) {
  const sb = getSupabaseAdmin();
  const { data: organiser, error } = await sb
    .from('organisers')
    .select('id, name, email, contact_email, stripe_account_id')
    .eq('id', organiserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!organiser) {
    const e = new Error('Organiser not found');
    e.status = 404;
    throw e;
  }

  let accountId = String(organiser.stripe_account_id || '').trim();
  if (!accountId) {
    const account = await createConnectAccountForOrganiser(organiser);
    accountId = account.id;
  }

  const site = siteBaseUrl();
  const returnUrl = site + String(returnPath || '/organiser/index.html#events-revenue');
  const refreshUrl = site + '/organiser/index.html?stripe_connect=refresh';

  const stripe = getStripeClient();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  return {
    url: link.url,
    accountId,
    expiresAt: link.expires_at,
  };
}

async function getOrganiserConnectForEvent(sb, eventId) {
  const { data: eventRow, error: eventError } = await sb
    .from('events')
    .select('id, organiser_id')
    .eq('id', eventId)
    .maybeSingle();
  if (eventError) throw new Error(eventError.message);
  if (!eventRow?.organiser_id) return null;

  const { data: organiser, error: orgError } = await sb
    .from('organisers')
    .select(
      'id, name, email, contact_email, stripe_account_id, stripe_charges_enabled, stripe_connect_details_submitted'
    )
    .eq('id', eventRow.organiser_id)
    .maybeSingle();
  if (orgError) throw new Error(orgError.message);
  if (!organiser) return null;

  if (organiser.stripe_account_id && isStripeConnectEnabled()) {
    try {
      await syncOrganiserConnectStatus(organiser.id);
    } catch {
      /* use cached flags */
    }
  }

  const { data: refreshed } = await sb
    .from('organisers')
    .select(
      'id, stripe_account_id, stripe_charges_enabled, stripe_connect_details_submitted, stripe_payouts_enabled'
    )
    .eq('id', organiser.id)
    .maybeSingle();

  const row = refreshed || organiser;
  return {
    organiserId: row.id,
    stripeAccountId: String(row.stripe_account_id || '').trim() || null,
    chargesEnabled: Boolean(row.stripe_charges_enabled),
    detailsSubmitted: Boolean(row.stripe_connect_details_submitted),
    ready:
      Boolean(row.stripe_account_id) &&
      Boolean(row.stripe_charges_enabled) &&
      Boolean(row.stripe_connect_details_submitted),
  };
}

async function assertOrganiserReadyForPaidPublish(sb, organiserIds, tickets) {
  if (!connectRequiredForPaidCheckout()) return { ok: true };

  const hasPaidTier = (tickets || []).some((t) => {
    const price = Number(String(t.price || '').replace(/[£,\s]/g, ''));
    return Number.isFinite(price) && price > 0;
  });
  if (!hasPaidTier) return { ok: true };

  const ids = [...new Set((organiserIds || []).filter(Boolean))];
  const blocked = [];

  for (const organiserId of ids) {
    const status = await syncOrganiserConnectStatus(organiserId);
    if (!status.ready) blocked.push({ organiserId, status });
  }

  if (blocked.length) {
    const e = new Error(
      'Connect your Stripe account before publishing paid tickets. Open Revenue → Connect Stripe.'
    );
    e.status = 400;
    e.code = 'stripe_connect_required';
    e.blocked = blocked;
    throw e;
  }

  return { ok: true };
}

function buildConnectCheckoutParams({ connect, ticketSubtotalPence, bookingFeePence }) {
  if (!connect?.ready || !connect.stripeAccountId) return null;
  const applicationFeeAmount = calculatePlatformApplicationFeePence(
    ticketSubtotalPence,
    bookingFeePence
  );
  if (applicationFeeAmount <= 0) return null;

  return {
    payment_intent_data: {
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: connect.stripeAccountId,
      },
      metadata: {
        organiser_id: connect.organiserId,
        hub_checkout: 'connect_destination',
      },
    },
  };
}

module.exports = {
  isStripeConnectEnabled,
  connectRequiredForPaidCheckout,
  retrieveConnectAccount,
  mapConnectStatus,
  syncOrganiserConnectStatus,
  createConnectOnboardingLink,
  getOrganiserConnectForEvent,
  assertOrganiserReadyForPaidPublish,
  buildConnectCheckoutParams,
};
