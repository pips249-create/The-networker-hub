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

function isStripeLiveMode() {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  return key.startsWith('sk_live_');
}

/** Stripe live mode rejects http:// return/refresh URLs — use a public HTTPS site. */
function connectCallbackBaseUrl() {
  const site = siteBaseUrl();
  if (/^https:\/\//i.test(site)) return site;
  if (isStripeLiveMode()) {
    const fallback = String(
      process.env.STRIPE_CONNECT_CALLBACK_URL ||
        process.env.PUBLIC_SITE_URL ||
        'https://the-networker-hub.vercel.app'
    ).replace(/\/$/, '');
    if (/^https:\/\//i.test(fallback)) return fallback;
  }
  return site;
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
      currentlyDue: [],
      pastDue: [],
      disabledReason: null,
    };
  }
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const detailsSubmitted = Boolean(account.details_submitted);
  const currentlyDue = Array.isArray(account.requirements?.currently_due)
    ? account.requirements.currently_due
    : [];
  const pastDue = Array.isArray(account.requirements?.past_due)
    ? account.requirements.past_due
    : [];
  return {
    connected: true,
    accountId: account.id,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    ready: chargesEnabled && detailsSubmitted,
    currentlyDue,
    pastDue,
    disabledReason: account.requirements?.disabled_reason || null,
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
  const businessName = String(organiser.name || 'Event organiser').trim() || 'Event organiser';
  const site = connectCallbackBaseUrl();
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'GB',
    email: email || undefined,
    business_type: 'individual',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: {
      name: businessName,
      url: site,
      mcc: '8699',
      product_description: 'Networking events and ticket sales via The Networker Hub',
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
  } else {
    // Keep business profile populated — helps Express onboarding render reliably.
    try {
      const stripe = getStripeClient();
      const site = connectCallbackBaseUrl();
      await stripe.accounts.update(accountId, {
        business_profile: {
          name: String(organiser.name || 'Event organiser').trim() || undefined,
          url: site,
          mcc: '8699',
          product_description: 'Networking events and ticket sales via The Networker Hub',
        },
      });
    } catch {
      /* non-fatal */
    }
  }

  const site = connectCallbackBaseUrl();
  const safeReturn = String(returnPath || '/organiser/#events-revenue');
  const returnUrl = site + safeReturn;
  // Account Links are single-use; refreshing Stripe should reopen our launcher for a new link.
  const refreshUrl =
    site +
    '/organiser/payment-setup?groupId=' +
    encodeURIComponent(organiserId) +
    '&returnPath=' +
    encodeURIComponent(safeReturn);

  const stripe = getStripeClient();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
    collection_options: {
      fields: 'eventually_due',
    },
  });

  return {
    url: link.url,
    accountId,
    expiresAt: link.expires_at,
  };
}

async function createExpressDashboardLink(stripeAccountId) {
  const accountId = String(stripeAccountId || '').trim();
  if (!accountId || !isStripeCheckoutConfigured()) {
    const e = new Error('Stripe Connect is not configured for this group.');
    e.status = 503;
    throw e;
  }
  const stripe = getStripeClient();
  const link = await stripe.accounts.createLoginLink(accountId);
  return {
    url: link.url,
    accountId,
  };
}

async function linkOrganiserConnectFromPeer(targetOrganiserId, sourceOrganiserId) {
  const sb = getSupabaseAdmin();
  const { data: source, error: sourceError } = await sb
    .from('organisers')
    .select(
      'id, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_connect_details_submitted, stripe_connect_onboarded_at'
    )
    .eq('id', sourceOrganiserId)
    .maybeSingle();
  if (sourceError) throw new Error(sourceError.message);
  if (!source?.stripe_account_id) {
    const e = new Error('The selected organiser page does not have bank details yet.');
    e.status = 400;
    e.code = 'stripe_connect_required';
    throw e;
  }

  const sourceStatus = await syncOrganiserConnectStatus(sourceOrganiserId);
  if (!sourceStatus.ready) {
    const e = new Error(
      'Finish bank details on the source organiser page before reusing them elsewhere.'
    );
    e.status = 400;
    e.code = 'stripe_connect_incomplete';
    throw e;
  }

  const { data: target, error: targetError } = await sb
    .from('organisers')
    .select('id')
    .eq('id', targetOrganiserId)
    .maybeSingle();
  if (targetError) throw new Error(targetError.message);
  if (!target) {
    const e = new Error('Organiser not found');
    e.status = 404;
    throw e;
  }

  const { error: updateError } = await sb
    .from('organisers')
    .update({
      stripe_account_id: source.stripe_account_id,
      stripe_charges_enabled: source.stripe_charges_enabled,
      stripe_payouts_enabled: source.stripe_payouts_enabled,
      stripe_connect_details_submitted: source.stripe_connect_details_submitted,
      stripe_connect_onboarded_at: source.stripe_connect_onboarded_at,
    })
    .eq('id', targetOrganiserId);
  if (updateError) throw new Error(updateError.message);

  return syncOrganiserConnectStatus(targetOrganiserId);
}

async function createExpressDashboardLinkForOrganiser(organiserId) {
  const sb = getSupabaseAdmin();
  const { data: organiser, error } = await sb
    .from('organisers')
    .select('id, stripe_account_id, stripe_charges_enabled, stripe_connect_details_submitted')
    .eq('id', organiserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!organiser) {
    const e = new Error('Organiser not found');
    e.status = 404;
    throw e;
  }
  if (!organiser.stripe_account_id) {
    const e = new Error('Add bank details before opening the Stripe dashboard.');
    e.status = 400;
    e.code = 'stripe_connect_required';
    throw e;
  }
  return createExpressDashboardLink(organiser.stripe_account_id);
}

async function getOrganiserConnectById(sb, organiserId) {
  const orgId = String(organiserId || '').trim();
  if (!orgId) return null;

  const { data: organiser, error: orgError } = await sb
    .from('organisers')
    .select(
      'id, name, email, contact_email, stripe_account_id, stripe_charges_enabled, stripe_connect_details_submitted'
    )
    .eq('id', orgId)
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

async function getOrganiserConnectForEvent(sb, eventId) {
  const { data: eventRow, error: eventError } = await sb
    .from('events')
    .select('id, organiser_id')
    .eq('id', eventId)
    .maybeSingle();
  if (eventError) throw new Error(eventError.message);
  if (!eventRow?.organiser_id) return null;
  return getOrganiserConnectById(sb, eventRow.organiser_id);
}

/**
 * Destination-charge subscription params — organiser receives membership (+ membership VAT);
 * Hub keeps the booking fee (4.5% + 20p) via application_fee_percent.
 */
function buildConnectSubscriptionParams({ connect, organiserPence, hubPence, membershipPence, feePence, metadata }) {
  if (!connect?.ready || !connect.stripeAccountId) return null;
  const { applicationFeePercentFromPence } = require('./membership-billing');
  const org = Math.max(
    0,
    Math.round(Number(organiserPence != null ? organiserPence : membershipPence) || 0)
  );
  const hub = Math.max(0, Math.round(Number(hubPence != null ? hubPence : feePence) || 0));
  const applicationFeePercent = applicationFeePercentFromPence(org, hub);
  if (applicationFeePercent <= 0) return null;

  return {
    subscriptionData: {
      application_fee_percent: applicationFeePercent,
      transfer_data: {
        destination: connect.stripeAccountId,
      },
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    },
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
      'Add your bank details before publishing paid tickets. Use the “Add bank details” button on the tickets page or open Revenue in your dashboard.'
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

  // Destination charge on the platform account — organiser receives the full ticket subtotal;
  // Hub keeps the booking fee; Stripe processing is absorbed from the booking fee.
  return {
    paymentIntentData: {
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
  linkOrganiserConnectFromPeer,
  createConnectOnboardingLink,
  createExpressDashboardLink,
  createExpressDashboardLinkForOrganiser,
  getOrganiserConnectById,
  getOrganiserConnectForEvent,
  assertOrganiserReadyForPaidPublish,
  buildConnectCheckoutParams,
  buildConnectSubscriptionParams,
};
