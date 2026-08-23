const { setCors, json, sessionFromRequest } = require('../auth');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { isUuid } = require('../uuid');
const {
  isStripeCheckoutConfigured,
  createMembershipCheckoutSession,
  siteBaseUrl,
} = require('../stripe-checkout');
const {
  connectRequiredForPaidCheckout,
  getOrganiserConnectById,
  buildConnectSubscriptionParams,
} = require('../stripe-connect');
const {
  getMembershipPlanForOrganiser,
  amountPenceForInterval,
  normalizeInterval,
  calculateMembershipTotals,
  poundsFromPence,
  MEMBERSHIP_FEE_LABEL,
  MEMBERSHIP_FEE_EXPLANATION,
} = require('../membership-billing');

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

/** POST /api/auth/membership-checkout — start monthly/annual membership subscription. */
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
  if (!isStripeCheckoutConfigured()) {
    return json(res, 503, { ok: false, error: 'stripe_not_configured' });
  }

  const session = sessionFromRequest(req);
  const body = parseBody(req);
  const sessionEmail = String(session?.email || '')
    .trim()
    .toLowerCase();
  const submittedEmail = String(body.email || '')
    .trim()
    .toLowerCase();
  const checkoutEmail = sessionEmail || submittedEmail;
  const checkoutName = String(body.name || session?.name || '').trim();

  if (!checkoutEmail) {
    return json(res, 400, {
      ok: false,
      error: 'missing_email',
      message: 'Sign in or enter your email to join.',
    });
  }
  if (!checkoutName) {
    return json(res, 400, {
      ok: false,
      error: 'missing_name',
      message: 'Enter your name to continue.',
    });
  }

  const organiserId = String(body.organiserId || body.organiser_id || body.groupId || '').trim();
  if (!isUuid(organiserId)) {
    return json(res, 400, { ok: false, error: 'invalid_organiser_id' });
  }

  const interval = normalizeInterval(body.interval || body.billingInterval || body.billing_interval);
  if (!interval) {
    return json(res, 400, {
      ok: false,
      error: 'invalid_interval',
      message: 'Choose monthly or annually.',
    });
  }

  try {
    const sb = getSupabaseAdmin();
    const { data: organiser, error: orgError } = await sb
      .from('organisers')
      .select('id, name, slug, listing_status')
      .eq('id', organiserId)
      .maybeSingle();
    if (orgError) throw new Error(orgError.message);
    if (!organiser) {
      return json(res, 404, { ok: false, error: 'organiser_not_found' });
    }

    // Block a second Hub-billed subscription while one is already live.
    const {
      getActiveRosterMembership,
      rosterRowHasLiveHubSubscription,
    } = require('../organiser-member-roster');
    const existingMembership = await getActiveRosterMembership(sb, {
      organiserId,
      email: checkoutEmail,
      userId: session?.sub || null,
    });
    if (
      existingMembership.active &&
      rosterRowHasLiveHubSubscription(existingMembership.row)
    ) {
      return json(res, 409, {
        ok: false,
        error: 'already_member',
        message:
          'You already have an active membership with this group. Manage billing from My account → Memberships.',
      });
    }

    const plan = await getMembershipPlanForOrganiser(organiserId);
    const amountPence = amountPenceForInterval(plan, interval);
    if (!amountPence) {
      return json(res, 400, {
        ok: false,
        error: 'membership_not_offered',
        message: 'This group is not offering that membership option right now.',
      });
    }

    const vatTreatment = plan.vatTreatment || 'included';
    const totals = calculateMembershipTotals(poundsFromPence(amountPence), vatTreatment);
    const membershipVatPence = Math.round(totals.membershipVat * 100);
    const feePence = Math.round(totals.fee * 100);
    const organiserPence = amountPence + membershipVatPence;
    const hubPence = feePence;

    let subscriptionData = null;
    if (connectRequiredForPaidCheckout()) {
      const connect = await getOrganiserConnectById(sb, organiserId);
      if (!connect?.ready) {
        return json(res, 400, {
          ok: false,
          error: 'stripe_connect_required',
          message:
            'This organiser has not finished payment setup. Membership checkout is temporarily unavailable.',
        });
      }
      const connectParams = buildConnectSubscriptionParams({
        connect,
        organiserPence,
        hubPence,
        metadata: {
          checkout_type: 'organiser_membership',
          organiser_id: organiserId,
          attendee_email: checkoutEmail,
          attendee_name: checkoutName,
          billing_interval: interval,
          membership_amount_pence: String(amountPence),
          vat_treatment: vatTreatment,
        },
      });
      subscriptionData = connectParams?.subscriptionData || null;
    }

    let attendeeId = '';
    if (session?.attendeeId || session?.attendee_id) {
      attendeeId = String(session.attendeeId || session.attendee_id).trim();
    } else if (sessionEmail) {
      const { data: attendee } = await sb
        .from('attendees')
        .select('id')
        .ilike('email', checkoutEmail)
        .maybeSingle();
      attendeeId = attendee?.id ? String(attendee.id) : '';
    }

    const siteUrl = siteBaseUrl();
    const slug = String(organiser.slug || '').trim();
    const cancelPath = slug
      ? `/organisers/${encodeURIComponent(slug)}`
      : `/events/organiser?id=${encodeURIComponent(organiserId)}`;
    const successPath = `/account/?membership=success&organiserId=${encodeURIComponent(organiserId)}#memberships`;

    const checkoutSession = await createMembershipCheckoutSession({
      email: checkoutEmail,
      name: checkoutName,
      attendeeId,
      organiserId,
      organiserName: organiser.name,
      membershipAmountPence: amountPence,
      interval,
      vatTreatment,
      subscriptionData,
      successUrl: `${siteUrl}${successPath}`,
      cancelUrl: `${siteUrl}${cancelPath}?membership=cancelled`,
      clientReferenceId: `membership-${organiserId}-${interval}-${checkoutEmail}`.slice(0, 200),
    });

    return json(res, 200, {
      ok: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
      totals: {
        amount: totals.amount,
        membershipVat: totals.membershipVat,
        fee: totals.fee,
        total: totals.total,
        interval,
        vatTreatment,
        feeLabel: MEMBERSHIP_FEE_LABEL,
        feeExplanation: MEMBERSHIP_FEE_EXPLANATION,
      },
    });
  } catch (e) {
    return json(res, e.status || 500, {
      ok: false,
      error: e.code || e.message || 'membership_checkout_failed',
      message: e.message || String(e),
    });
  }
};
