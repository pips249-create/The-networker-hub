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
      'With Stripe Connect, paid ticket revenue goes to your connected account at checkout — open Stripe Express for balance and bank payouts. Legacy manual Hub payouts (if Connect is off) require archiving the event and a 7-day settlement before requesting payout from Revenue.',
    llmsSummary:
      'Organisers receive the full ticket price they set. With Stripe Connect enabled, that revenue is collected in the organiser connected Stripe account when attendees pay; use Stripe Express for refunds, balance, and bank payouts. Legacy mode (Connect off): archive the event in /organiser/, wait 7 days after the event ends, then request payout from Revenue — requests are reviewed before transfer.',
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
