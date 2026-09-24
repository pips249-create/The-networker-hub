/**
 * Smoke test for tailored pitch deck JSON generation (no OpenAI / DB).
 */
const assert = require('assert');
const {
  generateCustomPitchDeck,
  makeDeckSlug,
  normalizeSections,
  publicPathForSlug,
} = require('../api/_lib/custom-pitch-deck-generate');

(async function () {
  const slug = makeDeckSlug('Business Matching UK');
  assert.match(slug, /^custom-business-matching-uk-[a-f0-9]{6}$/);
  assert.equal(publicPathForSlug(slug), '/p-tnh-custom-deck?slug=' + encodeURIComponent(slug));

  const sections = normalizeSections(['pricing', 'opening', 'opening', 'nope']);
  assert.deepEqual(sections, ['pricing', 'opening']);

  const deck = await generateCustomPitchDeck({
    companyName: 'BMUK',
    website: 'business-matching.co.uk',
    brief: 'Leeds launch and occupation vetting',
    includeSections: ['opening', 'tools', 'next_steps'],
  });

  assert.equal(deck.hero.preparedFor, 'BMUK');
  assert.equal(deck.sections.length, 3);
  assert.equal(deck.sections[0].id, 'opening');
  assert.ok(deck.sections[1].tiles && deck.sections[1].tiles.length >= 3);

  const sponsorDeck = await generateCustomPitchDeck({
    companyName: 'Pink Spaghetti',
    website: 'https://www.pink-spaghetti.co.uk/',
    brief: 'Franchise opportunity listing plus Events Headline conversation',
    deckType: 'sponsorship',
    sponsorshipPlacements: ['headline_events', 'opportunity_directory_listing'],
  });
  assert.equal(sponsorDeck.deckType, 'sponsorship');
  assert.ok(sponsorDeck.sections.some(function (s) { return s.id === 'sponsor_headline_events'; }));
  assert.ok(sponsorDeck.sections.some(function (s) { return s.id === 'sponsor_opportunity_directory_listing'; }));
  assert.match(sponsorDeck.hero.headline, /Advertising on The Networker UK|Complimentary launch partnership|Launch partnership walkthrough/);
  var eventsHeadline = sponsorDeck.sections.find(function (s) {
    return s.id === 'sponsor_headline_events';
  });
  assert.ok(eventsHeadline && eventsHeadline.emailInventory);
  assert.equal(eventsHeadline.emailInventory.count, 21);
  assert.ok(
    (eventsHeadline.tiles || []).some(function (t) {
      return /21 emails/i.test(t.title || '');
    })
  );
  // Launch listing should appear before Headline upsell when both are selected.
  var listingIdx = sponsorDeck.sections.findIndex(function (s) {
    return s.id === 'sponsor_opportunity_directory_listing';
  });
  var headlineIdx = sponsorDeck.sections.findIndex(function (s) {
    return s.id === 'sponsor_headline_events';
  });
  assert.ok(listingIdx >= 0 && headlineIdx > listingIdx);
  assert.ok(/optional/i.test(eventsHeadline.kicker || '') || /optional upgrade/i.test(eventsHeadline.intro || ''));
  var emailTally = sponsorDeck.sections.find(function (s) {
    return s.id === 'sponsor_email_inventory';
  });
  assert.ok(emailTally);
  assert.equal(emailTally.emailInventory.total, 21);
  assert.ok(
    (eventsHeadline.bullets || []).some(function (b) {
      return /21 templates/i.test(b);
    })
  );

  const multiHeadline = await generateCustomPitchDeck({
    companyName: 'Multi Brand',
    deckType: 'sponsorship',
    sponsorshipPlacements: ['headline_events', 'headline_opportunities'],
  });
  var multiTally = multiHeadline.sections.find(function (s) {
    return s.id === 'sponsor_email_inventory';
  });
  assert.ok(multiTally);
  assert.equal(multiTally.emailInventory.total, 32);

  const { enrichDeckWithEmailInventory } = require('../api/_lib/sponsorship-pitch-catalog');
  const enriched = enrichDeckWithEmailInventory({
    sponsorshipPlacements: ['headline_opportunities'],
    hero: { preparedFor: 'Legacy Co' },
    sections: [
      {
        id: 'sponsor_headline_opportunities',
        title: 'Headline Sponsor — Business Opportunities Directory',
        bullets: ['Old bullet without count'],
        tiles: [],
      },
    ],
  });
  var oppSec = enriched.sections.find(function (s) {
    return s.id === 'sponsor_headline_opportunities';
  });
  assert.equal(oppSec.emailInventory.count, 11);
  assert.ok(enriched.sections.some(function (s) { return s.id === 'sponsor_email_inventory'; }));
  assert.equal(
    enriched.sections.find(function (s) { return s.id === 'sponsor_email_inventory'; }).emailInventory.total,
    11
  );

  const launchDeck = await generateCustomPitchDeck({
    companyName: 'Pink Spaghetti',
    deckType: 'sponsorship',
    sponsorshipPlacements: ['opportunity_directory_listing', 'featured_opportunity_boost'],
  });
  var listingSection = launchDeck.sections.find(function (s) {
    return s.id === 'sponsor_opportunity_directory_listing';
  });
  var spotlightSection = launchDeck.sections.find(function (s) {
    return s.id === 'sponsor_featured_opportunity_boost';
  });
  assert.ok(listingSection && /12 months/i.test(listingSection.price || ''));
  assert.ok(spotlightSection && /3 months/i.test(spotlightSection.price || ''));
  assert.ok((launchDeck.hero.chips || []).some(function (c) { return /12 months listing/i.test(c); }));
  assert.ok((launchDeck.hero.chips || []).some(function (c) { return /£465/i.test(c); }));
  assert.match(launchDeck.hero.headline, /Launch partnership walkthrough|Complimentary launch partnership/i);
  assert.match(launchDeck.hero.lede, /talk track|walkthrough|£465/i);
  assert.ok(
    (listingSection.bullets || []).some(function (b) {
      return /Dedicated profile page \+ full search visibility/i.test(b);
    })
  );
  assert.ok(
    (spotlightSection.bullets || []).some(function (b) {
      return /Premium Spotlight carousel placement/i.test(b);
    })
  );
  var opening = launchDeck.sections.find(function (s) {
    return s.id === 'sponsor_opening';
  });
  assert.ok(opening && Array.isArray(opening.sayNotes) && opening.sayNotes.length);
  assert.ok(
    opening &&
      (opening.bullets || []).some(function (b) {
        return /Ask:/i.test(b);
      })
  );
  assert.ok(
    (opening.bullets || []).some(function (b) {
      return /franchise|career returners|flexible|target buyer/i.test(b);
    })
  );
  var nextSteps = launchDeck.sections.find(function (s) {
    return s.id === 'sponsor_next_steps';
  });
  assert.ok(
    nextSteps &&
      (nextSteps.bullets || []).some(function (b) {
        return /Ask for:.*Lead email|lead email/i.test(b);
      })
  );
  assert.ok(Array.isArray(listingSection.sayNotes) && listingSection.sayNotes.length);

  const { enrichTalkTrackCopy, looksLikeLeaveBehindOpening } = require('../api/_lib/custom-pitch-deck-generate');
  const leaveBehindOpening = {
    id: 'sponsor_opening',
    title: 'Opening the conversation with Pink Spaghetti',
    intro:
      'Confirm who they want to reach (event bookers, group owners, opportunity seekers), budget, and timing — then map packages from /advertising. For this conversation we are leading with the launch partnership: 12 months business opportunity directory listing at no charge plus 3 months Premium Spotlight on /opportunities/ at no charge. Focus: Business opportunity directory listing for 12 months for free included, Featured Opportunity Boost for 3 months included',
    bullets: [
      'Agree the three Premium Spotlight months on /opportunities/ — included at no charge in this launch offer',
      'Confirm go-live date for the business opportunity listing — 12 months subscription included in this launch offer',
      'Who is the target buyer — business owners, franchisees, professionals booking events?',
      'Which parts of the site matter most — Events, Organisers, or Opportunities?',
      'Monthly vs prepaid commitment — most packages offer 1–12 month terms',
      'Any category exclusivity or geographic focus (city / county)?',
    ],
  };
  assert.equal(looksLikeLeaveBehindOpening(leaveBehindOpening), true);
  const rewritten = enrichTalkTrackCopy(
    {
      sponsorshipPlacements: ['opportunity_directory_listing', 'featured_opportunity_boost'],
      hero: { preparedFor: 'Pink Spaghetti', lede: 'Reach business owners across our directories.' },
      sections: [
        leaveBehindOpening,
        {
          id: 'sponsor_next_steps',
          title: 'What we need from you',
          intro: 'Send assets when ready.',
          bullets: ['Logo', 'URL'],
        },
      ],
    },
    { companyName: 'Pink Spaghetti', brief: 'Franchise leads' }
  );
  var rewrittenOpening = rewritten.sections.find(function (s) {
    return s.id === 'sponsor_opening';
  });
  assert.ok(rewrittenOpening);
  assert.match(rewrittenOpening.title, /Open the call with Pink Spaghetti/i);
  assert.match(rewrittenOpening.intro, /Coach notes/i);
  assert.ok(
    !(rewrittenOpening.bullets || []).some(function (b) {
      return /Confirm who they want|Monthly vs prepaid|Agree the three/i.test(b);
    })
  );
  assert.ok(
    (rewrittenOpening.bullets || []).every(function (b) {
      return /^(Ask|Confirm)\s*:/i.test(b);
    })
  );
  assert.match(rewritten.hero.lede, /talk track|walkthrough|not a leave-behind/i);
  var rewrittenClose = rewritten.sections.find(function (s) {
    return s.id === 'sponsor_next_steps';
  });
  assert.match(rewrittenClose.title, /Close — what to ask/i);
  assert.ok(
    (rewrittenClose.bullets || []).some(function (b) {
      return /Ask for:/i.test(b);
    })
  );

  const listingOnlyDeck = await generateCustomPitchDeck({
    companyName: 'Acme Franchise',
    deckType: 'sponsorship',
    sponsorshipPlacements: ['opportunity_directory_listing'],
  });
  assert.ok(
    listingOnlyDeck.sections.some(function (s) {
      return s.id === 'sponsor_featured_opportunity_boost';
    })
  );
  assert.ok(
    (listingOnlyDeck.hero.chips || []).some(function (c) {
      return /Premium Spotlight/i.test(c);
    })
  );

  console.log('test-custom-pitch-deck-generate: ok');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
