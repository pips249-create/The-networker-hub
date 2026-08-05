const Stripe = require('stripe');
const { BOOKING_FEE_NON_REFUNDABLE_NOTE } = require('./booking-fees');
const {
  calculateOpportunityListingTotals,
  normalizeListingMonths,
} = require('./opportunity-listing-pricing');
const { getCatalogPriceId } = require('./hub-stripe-catalog');

function getStripeSecretKey() {
  return String(process.env.STRIPE_SECRET_KEY || '').trim();
}

function isStripeCheckoutConfigured() {
  return Boolean(getStripeSecretKey());
}

let client = null;

function getStripeClient() {
  const key = getStripeSecretKey();
  if (!key) throw new Error('stripe_not_configured');
  if (!client) client = new Stripe(key);
  return client;
}

/**
 * Checkout with ticket line item(s) plus a separate booking-fee line item.
 */
async function createPaidCheckoutSession(opts) {
  const stripe = getStripeClient();
  const qty = opts.qty || 1;
  const unitAmount = Math.round((Number(opts.unitPricePounds) || 0) * 100);
  if (unitAmount <= 0) throw new Error('invalid_ticket_price');

  const lineItems = [
    {
      price_data: {
        currency: 'gbp',
        product_data: {
          name: `${opts.eventTitle || 'Event'} — ${opts.ticketName || 'Ticket'}`,
        },
        unit_amount: unitAmount,
      },
      quantity: qty,
    },
  ];

  const feePence = Math.round((Number(opts.bookingFeePounds) || 0) * 100);
  if (feePence > 0) {
    lineItems.push({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: 'Booking fee',
          description: BOOKING_FEE_NON_REFUNDABLE_NOTE,
        },
        unit_amount: feePence,
      },
      quantity: 1,
    });
  }

  const sessionParams = {
    mode: 'payment',
    customer_email: opts.email,
    client_reference_id: opts.clientReferenceId,
    metadata: {
      checkout_type: opts.checkoutType || 'event_ticket',
      event_id: opts.eventId,
      ticket_id: opts.ticketId || '',
      registration_id: opts.registrationId || '',
      attendee_email: opts.email || '',
      attendee_name: opts.name || '',
      guest_names: JSON.stringify(opts.guestNames || []).slice(0, 500),
      dietary_requirements: String(opts.dietaryRequirements || '').trim().slice(0, 500),
      accessibility_requirements: String(opts.accessibilityRequirements || '').trim().slice(0, 500),
      alumni_invite_token: String(opts.alumniInviteToken || '').trim().slice(0, 120),
      ce_member_token: String(opts.ceMemberToken || '').trim().slice(0, 120),
      ce_member_direct_book: opts.ceMemberDirectBook ? '1' : '',
      quantity: String(opts.qty || 1),
      bundle_event_ids: String(opts.bundleEventIds || '').slice(0, 500),
      bundle_ticket_ids: String(opts.bundleTicketIds || '').slice(0, 500),
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: lineItems,
  };

  if (opts.paymentIntentData && typeof opts.paymentIntentData === 'object') {
    sessionParams.payment_intent_data = opts.paymentIntentData;
  }

  const stripeAccountId = String(opts.stripeAccountId || '').trim();
  if (stripeAccountId) {
    return stripe.checkout.sessions.create(sessionParams, { stripeAccount: stripeAccountId });
  }

  return stripe.checkout.sessions.create(sessionParams);
}

function siteBaseUrl() {
  return String(process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
}

function lineItemFromCatalog(catalogKey, fallbackPriceData) {
  const priceId = getCatalogPriceId(catalogKey);
  if (priceId) return { price: priceId, quantity: 1 };
  return { price_data: fallbackPriceData, quantity: 1 };
}

/**
 * Prepaid business opportunity listing (£25/month ex VAT, minimum 3 months).
 */
async function createOpportunityListingCheckoutSession(opts) {
  const stripe = getStripeClient();
  const opportunityId = String(opts.opportunityId || '').trim();
  const months = normalizeListingMonths(opts.months);
  if (!opportunityId) throw new Error('missing_opportunity_id');

  const totals = calculateOpportunityListingTotals(months);
  const title = String(opts.opportunityTitle || 'Business opportunity').trim();

  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: opts.email,
    client_reference_id: 'opp-listing-' + opportunityId + '-' + months + 'm',
    metadata: {
      opportunity_id: opportunityId,
      checkout_type: 'opportunity_listing',
      listing_months: String(months),
      owner_email: String(opts.email || '').toLowerCase(),
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: [
      {
        price_data: {
          currency: 'gbp',
          product_data: {
            name: 'Business opportunity listing — ' + months + ' months',
            description:
              'Directory listing for "' +
              title +
              '" on The Networker Hub (£25/month ex VAT)',
          },
          unit_amount: totals.subtotalExVatPence,
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: 'gbp',
          product_data: {
            name: 'VAT (20%)',
            description: months + ' months listing VAT',
          },
          unit_amount: totals.vatPence,
        },
        quantity: 1,
      },
    ],
  });
}

/**
 * Monthly premium business opportunity listing (£55/month subscription).
 */
async function createOpportunityPremiumCheckoutSession(opts) {
  const stripe = getStripeClient();
  const opportunityId = String(opts.opportunityId || '').trim();
  if (!opportunityId) throw new Error('missing_opportunity_id');

  const priceId = getCatalogPriceId('opportunity_premium');
  const lineItems = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        lineItemFromCatalog('opportunity_premium', {
          currency: 'gbp',
          product_data: {
            name: 'Premium business opportunity listing',
            description: 'Featured placement in the opportunities directory',
          },
          unit_amount: 5500,
          recurring: { interval: 'month' },
        }),
      ];

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: opts.email,
    client_reference_id: 'opp-premium-' + opportunityId,
    metadata: {
      opportunity_id: opportunityId,
      checkout_type: 'opportunity_premium',
      owner_email: String(opts.email || '').toLowerCase(),
    },
    subscription_data: {
      metadata: {
        opportunity_id: opportunityId,
        checkout_type: 'opportunity_premium',
      },
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: lineItems,
  });
}

async function retrieveCheckoutSession(sessionId, options = {}) {
  const stripe = getStripeClient();
  const id = String(sessionId || '').trim();
  const params = { expand: ['subscription'] };
  const stripeAccountId = String(options.stripeAccountId || '').trim();
  if (stripeAccountId) {
    return stripe.checkout.sessions.retrieve(id, params, { stripeAccount: stripeAccountId });
  }
  return stripe.checkout.sessions.retrieve(id, params);
}

const { FEATURED_PLANS, normalizePlanId } = require('./event-featured-plans');

/**
 * One-off featured event listing (£55/month).
 */
async function createEventFeaturedCheckoutSession(opts) {
  const stripe = getStripeClient();
  const eventId = String(opts.eventId || '').trim();
  const planId = normalizePlanId(opts.planId);
  if (!eventId) throw new Error('missing_event_id');
  if (!planId) throw new Error('invalid_plan');

  const plan = FEATURED_PLANS[planId];
  const eventTitle = String(opts.eventTitle || 'Event').trim();
  const amountPence =
    opts.amountPence != null && Number.isFinite(Number(opts.amountPence))
      ? Math.max(0, Math.round(Number(opts.amountPence)))
      : plan.amountPence;
  const lineDescription =
    String(opts.lineItemDescription || '').trim() ||
    'Premium spotlight placement for "' + eventTitle + '"';

  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: opts.email,
    client_reference_id: 'event-featured-' + eventId + '-' + planId,
    metadata: {
      event_id: eventId,
      featured_plan: planId,
      featured_amount_pence: String(amountPence),
      checkout_type: 'event_featured',
      owner_email: String(opts.email || '').toLowerCase(),
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: [
      amountPence > 0 && planId === '1month' && plan.amountPence > 0 && amountPence === plan.amountPence
        ? lineItemFromCatalog('event_featured_1month', {
            currency: 'gbp',
            product_data: {
              name: 'Featured event listing — ' + plan.label,
              description: lineDescription,
            },
            unit_amount: amountPence,
          })
        : {
            price_data: {
              currency: 'gbp',
              product_data: {
                name: 'Featured event listing — ' + plan.label,
                description: lineDescription,
              },
              unit_amount: amountPence,
            },
            quantity: 1,
          },
    ],
  });
}

/**
 * Extra monthly group-update send credits (platform one-time payment).
 */
async function createGroupUpdateCreditsCheckoutSession(opts) {
  const stripe = getStripeClient();
  const { getCreditPack } = require('./group-update-credits');
  const organiserId = String(opts.organiserId || '').trim();
  const pack = getCreditPack(opts.packId);
  if (!organiserId) throw new Error('missing_organiser_id');
  if (!pack) throw new Error('invalid_pack');

  const groupName = String(opts.groupName || 'Your group').trim() || 'Your group';
  const amountPence = pack.amountPence;

  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: opts.email,
    client_reference_id: 'ogu-credits-' + organiserId + '-' + pack.id,
    metadata: {
      checkout_type: 'group_update_credits',
      organiser_id: organiserId,
      credit_pack: pack.id,
      credit_quantity: String(pack.credits),
      amount_pence: String(amountPence),
      owner_email: String(opts.email || '').toLowerCase(),
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: [
      lineItemFromCatalog(pack.catalogKey, {
        currency: 'gbp',
        product_data: {
          name: 'Monthly group update — ' + pack.label,
          description: pack.blurb + ' · ' + groupName,
        },
        unit_amount: amountPence,
      }),
    ],
  });
}

/**
 * City Partner — monthly subscription or prepaid 1 / 3 / 6 months.
 */
async function createCityPartnerCheckoutSession(opts) {
  const stripe = getStripeClient();
  const cities = Array.isArray(opts.cities) ? opts.cities : [];
  if (!cities.length) throw new Error('missing_cities');

  const {
    normalizeCityPartnerTerm,
    calculateCityPartnerQuote,
    listCityPartnerRegions,
  } = require('./networking-city-partners');

  const term = normalizeCityPartnerTerm(opts.termMonths != null ? opts.termMonths : opts.term);
  const quote = calculateCityPartnerQuote(cities.length, new Date(), term.termMonths || 'monthly');
  const prepaid = quote.billingMode === 'prepaid';
  const cityNames = cities
    .map((slug) => {
      const match = listCityPartnerRegions().find((r) => r.slug === slug);
      return match ? match.name : slug;
    })
    .join(', ');

  const lineItems = [];
  const pricing = quote.pricing;
  const launchNote = quote.isLaunch ? ' Launch rate until 1 Dec 2026.' : '';
  const termLabel = prepaid
    ? quote.termMonths === 12
      ? '1 year prepaid'
      : quote.termMonths + ' month' + (quote.termMonths === 1 ? '' : 's') + ' prepaid'
    : 'monthly';
  const discountNote =
    prepaid && quote.discountPercent > 0
      ? ' Includes ' + quote.discountPercent + '% prepaid discount.'
      : '';

  if (prepaid) {
    lineItems.push({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: 'City Partner — ' + cityNames + ' (' + termLabel + ')',
          description:
            'Logo + CTA on regional networking pages. Website only — not in hub emails.' +
            launchNote +
            discountNote,
        },
        unit_amount: quote.subtotalExVatPence,
      },
      quantity: 1,
    });
  } else {
    if (quote.bundles > 0) {
      lineItems.push({
        price_data: {
          currency: 'gbp',
          product_data: {
            name: 'City Partner — 3-city pack',
            description:
              'Logo + CTA on three regional networking pages. Website only — not in hub emails.' +
              launchNote,
          },
          unit_amount: pricing.bundle3MonthlyPence,
          recurring: { interval: 'month' },
        },
        quantity: quote.bundles,
      });
    }

    if (quote.singles > 0) {
      lineItems.push({
        price_data: {
          currency: 'gbp',
          product_data: {
            name: 'City Partner — single city',
            description:
              'Logo + CTA on one regional networking page. Website only — not in hub emails.' +
              launchNote,
          },
          unit_amount: pricing.singleMonthlyPence,
          recurring: { interval: 'month' },
        },
        quantity: quote.singles,
      });
    }
  }

  if (quote.vatPence > 0) {
    lineItems.push({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: 'VAT (20%)',
          description: prepaid
            ? 'VAT on City Partner (' + termLabel + ')'
            : 'VAT on City Partner (monthly)',
        },
        unit_amount: quote.vatPence,
        ...(prepaid ? {} : { recurring: { interval: 'month' } }),
      },
      quantity: 1,
    });
  }

  const metadata = {
    checkout_type: 'hub_sponsorship',
    revenue_category: 'events',
    placement: 'city_partner',
    networking_cities: cities.join(','),
    package_name: 'City Partner — ' + cityNames,
    city_partner_bundles: String(quote.bundles),
    city_partner_singles: String(quote.singles),
    billing_mode: quote.billingMode,
    term_months: prepaid ? String(quote.termMonths) : 'monthly',
    discount_percent: String(quote.discountPercent || 0),
  };

  const sessionParams = {
    mode: prepaid ? 'payment' : 'subscription',
    customer_email: opts.email,
    client_reference_id: 'city-partner-' + cities.join('-').slice(0, 100),
    metadata,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: lineItems,
  };

  if (!prepaid) {
    sessionParams.subscription_data = { metadata };
  }

  return stripe.checkout.sessions.create(sessionParams);
}

/**
 * Membership dues subscription — membership (+ optional organiser VAT) + booking fee (4.5% + 20p).
 */
async function createMembershipCheckoutSession(opts) {
  const stripe = getStripeClient();
  const {
    MEMBERSHIP_CHECKOUT_TYPE,
    MEMBERSHIP_FEE_LABEL,
    calculateMembershipTotals,
    applicationFeePercentFromPence,
    poundsFromPence,
    normalizeVatTreatment,
  } = require('./membership-billing');
  const { BOOKING_FEE_NON_REFUNDABLE_NOTE } = require('./booking-fees');

  const membershipPence = Math.round(Number(opts.membershipAmountPence) || 0);
  if (membershipPence < 100) throw new Error('invalid_membership_price');

  const interval = opts.interval === 'year' ? 'year' : 'month';
  const vatTreatment = normalizeVatTreatment(opts.vatTreatment);
  const totals = calculateMembershipTotals(poundsFromPence(membershipPence), vatTreatment);
  const membershipVatPence = Math.round(totals.membershipVat * 100);
  const feePence = Math.round(totals.fee * 100);
  const organiserPence = membershipPence + membershipVatPence;
  const hubPence = feePence;
  const orgName = String(opts.organiserName || 'Networking group').trim();
  const intervalLabel = interval === 'year' ? 'annual' : 'monthly';

  const metadata = {
    checkout_type: MEMBERSHIP_CHECKOUT_TYPE,
    organiser_id: String(opts.organiserId || '').trim(),
    attendee_email: String(opts.email || '').trim().toLowerCase(),
    attendee_name: String(opts.name || '').trim().slice(0, 200),
    attendee_id: String(opts.attendeeId || '').trim(),
    billing_interval: interval,
    membership_amount_pence: String(membershipPence),
    membership_vat_pence: String(membershipVatPence),
    hub_fee_pence: String(feePence),
    vat_treatment: vatTreatment,
  };

  const lineItems = [
    {
      price_data: {
        currency: 'gbp',
        product_data: {
          name: `${orgName} — ${intervalLabel} membership`,
        },
        unit_amount: membershipPence,
        recurring: { interval },
      },
      quantity: 1,
    },
  ];

  if (membershipVatPence > 0) {
    lineItems.push({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: 'VAT on membership (20%)',
        },
        unit_amount: membershipVatPence,
        recurring: { interval },
      },
      quantity: 1,
    });
  }

  if (feePence > 0) {
    lineItems.push({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: MEMBERSHIP_FEE_LABEL,
          description: BOOKING_FEE_NON_REFUNDABLE_NOTE,
        },
        unit_amount: feePence,
        recurring: { interval },
      },
      quantity: 1,
    });
  }

  const sessionParams = {
    mode: 'subscription',
    customer_email: opts.email,
    client_reference_id: String(opts.clientReferenceId || '').slice(0, 200),
    metadata,
    subscription_data: {
      metadata,
    },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    line_items: lineItems,
  };

  if (opts.subscriptionData && typeof opts.subscriptionData === 'object') {
    sessionParams.subscription_data = {
      ...sessionParams.subscription_data,
      ...opts.subscriptionData,
      metadata: {
        ...metadata,
        ...(opts.subscriptionData.metadata || {}),
      },
    };
  } else if (opts.stripeAccountId && hubPence > 0) {
    sessionParams.subscription_data.application_fee_percent = applicationFeePercentFromPence(
      organiserPence,
      hubPence
    );
    sessionParams.subscription_data.transfer_data = {
      destination: String(opts.stripeAccountId).trim(),
    };
  }

  return stripe.checkout.sessions.create(sessionParams);
}

/**
 * Member self-serve cancel / update card — Stripe Billing Portal on the platform customer.
 */
async function createMembershipBillingPortalSession(opts) {
  const stripe = getStripeClient();
  const customerId = String(opts.customerId || '').trim();
  if (!customerId) throw new Error('missing_customer');
  const returnUrl = String(opts.returnUrl || siteBaseUrl() + '/account/#memberships').trim();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

module.exports = {
  getStripeSecretKey,
  isStripeCheckoutConfigured,
  getStripeClient,
  createPaidCheckoutSession,
  createOpportunityListingCheckoutSession,
  createOpportunityPremiumCheckoutSession,
  createEventFeaturedCheckoutSession,
  createGroupUpdateCreditsCheckoutSession,
  createCityPartnerCheckoutSession,
  createMembershipCheckoutSession,
  createMembershipBillingPortalSession,
  retrieveCheckoutSession,
  siteBaseUrl,
};
