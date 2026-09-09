/**
 * Answer blocks + FAQs for /opportunities/industry/:slug (SEO + AEO).
 */
const { getOpportunityIndustry } = require('./opportunity-industries');

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildOpportunityIndustryAnswer(industry, listingCount) {
  const label = industry && industry.label ? String(industry.label) : 'this sector';
  const count = Number(listingCount) || 0;
  const lead =
    count > 0
      ? 'Find ' +
        label +
        ' franchises, side hustles and partnerships on The Networker UK — browse ' +
        count +
        ' live listings in this sector.'
      : 'Find ' +
        label +
        ' franchises, side hustles and partnerships on The Networker UK. Browse live business opportunities in this sector.';
  return lead + ' Filter by investment and location, then enquire directly with providers.';
}

function buildOpportunityIndustryFaqs(industry, listingCount) {
  const label = industry.label;
  const path = industry.path || '/opportunities/industry/' + industry.id;
  const count = Number(listingCount) || 0;

  return [
    {
      question: 'Where can I find ' + label + ' business opportunities?',
      answer:
        'Browse franchises, side hustles and partnerships in ' +
        label +
        ' on The Networker UK at ' +
        path +
        '.' +
        (count > 0 ? ' There are currently ' + count + ' live listings.' : '') +
        ' Open a listing to enquire directly with the provider.',
    },
    {
      question: 'How do I enquire about a ' + label + ' franchise or partnership?',
      answer:
        'Open any listing on this page, then send an enquiry from the opportunity page. Browsing is free — you only need a free account to enquire.',
    },
    {
      question: 'How do I list a ' + label + ' opportunity on The Networker UK?',
      answer:
        'Create a free organiser account, then publish your franchise, partnership or side hustle from the organiser dashboard. Listings can appear in the ' +
        label +
        ' industry directory so buyers can find and enquire. Start at /for-organisers.',
    },
    {
      question: 'What types of ' + label + ' opportunities are listed?',
      answer:
        'Franchises, side hustles, partnerships, affiliates and other business opportunities in ' +
        label +
        '. Use the filters on this page to narrow by investment level, commitment and location.',
    },
  ];
}

function buildOpportunityIndustryFaqSchema(faqs, canonical) {
  if (!faqs || !faqs.length) return null;
  return {
    '@type': 'FAQPage',
    '@id': canonical + '#faq',
    mainEntity: faqs.map(function (item) {
      return {
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      };
    }),
  };
}

function buildOpportunityIndustryFaqHtml(faqs, industry) {
  if (!faqs || !faqs.length) return '';
  const label = escapeHtml(industry.label);
  const items = faqs
    .map(function (item) {
      return (
        '<details class="networking-region-faq-item">' +
        '<summary class="networking-region-faq-q">' +
        escapeHtml(item.question) +
        '</summary>' +
        '<p class="networking-region-faq-a">' +
        escapeHtml(item.answer) +
        '</p>' +
        '</details>'
      );
    })
    .join('');

  return (
    '<section class="networking-region-faq" id="networking-region-faq" data-hub-ssr-faq="1" aria-labelledby="networking-region-faq-heading">' +
    '<div class="networking-region-faq-inner">' +
    '<h2 id="networking-region-faq-heading">' +
    label +
    ' opportunities — FAQ</h2>' +
    '<div class="networking-region-faq-list" id="networking-region-faq-list">' +
    items +
    '</div>' +
    '</div>' +
    '</section>'
  );
}

function buildOpportunityIndustrySeoCopy(industry, listingCount) {
  const resolved = industry && industry.id ? industry : getOpportunityIndustry(industry);
  if (!resolved) {
    return { answerText: '', faqs: [], faqHtml: '' };
  }
  const answerText = buildOpportunityIndustryAnswer(resolved, listingCount);
  const faqs = buildOpportunityIndustryFaqs(resolved, listingCount);
  return {
    answerText: answerText,
    faqs: faqs,
    faqHtml: buildOpportunityIndustryFaqHtml(faqs, resolved),
  };
}

module.exports = {
  buildOpportunityIndustryAnswer,
  buildOpportunityIndustryFaqs,
  buildOpportunityIndustryFaqSchema,
  buildOpportunityIndustryFaqHtml,
  buildOpportunityIndustrySeoCopy,
};
