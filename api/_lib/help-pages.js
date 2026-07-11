/**
 * Public help articles — SEO/AEO landing pages for high-intent organiser queries.
 */
const HELP_PAGES = {
  'organiser-payouts': {
    path: '/help/organiser-payouts',
    title: 'Organiser payouts – The Networker Hub',
    description:
      'When organisers receive ticket payouts on The Networker Hub — 7-day settlement, Stripe Connect, archiving events, and requesting payouts from your dashboard.',
    image: '/assets/logo.png',
    ogType: 'article',
    faqQuestion: 'When do organisers receive payouts for ticket sales?',
    faqAnswer:
      'Payouts are not instant. A 7-day settlement period applies after the event ends. Archive the event, then request a payout from the organiser dashboard when eligible. Stripe Connect onboarding is required.',
    llmsSummary:
      'Organisers receive the full ticket price they set. After an event ends, a 7-day settlement period applies before a payout can be requested. Archive the event in /organiser/, complete Stripe Connect onboarding, then request payout from Revenue when eligible. Payouts are reviewed before transfer to the organiser bank account.',
  },
  'pricing-fees': {
    path: '/help/pricing-fees',
    title: 'Ticket pricing & fees – The Networker Hub',
    description:
      'How The Networker Hub ticket fees work — 4.5% + 20p booking fee paid by attendees, organisers receive the full ticket price, with worked examples.',
    image: '/assets/logo.png',
    ogType: 'article',
    faqQuestion: 'What fees does The Networker Hub charge on tickets?',
    faqAnswer:
      'Attendees pay one booking fee at checkout (4.5% + 20p per ticket, shown before payment), which covers platform and payment processing. Organisers receive the full ticket price.',
    llmsSummary:
      'There is no monthly subscription to list events. For paid tickets, attendees pay one booking fee at checkout: 4.5% + 20p per ticket, shown before payment. Organisers receive the full ticket price they set. Free events do not require Stripe.',
  },
};

function getHelpPageKeys() {
  return Object.keys(HELP_PAGES);
}

function getHelpPageConfig(key) {
  return HELP_PAGES[String(key || '')] || null;
}

module.exports = {
  HELP_PAGES,
  getHelpPageKeys,
  getHelpPageConfig,
};
