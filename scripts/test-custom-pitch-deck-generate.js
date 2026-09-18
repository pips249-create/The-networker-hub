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
  assert.match(sponsorDeck.hero.headline, /Advertising on The Networker UK|Complimentary launch partnership/);
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
  assert.match(launchDeck.hero.headline, /Complimentary launch partnership/i);
  assert.match(launchDeck.hero.lede, /£465/i);
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
  assert.ok(
    opening &&
      (opening.bullets || []).some(function (b) {
        return /Step 1 \(immediate, zero-risk\)/i.test(b);
      })
  );
  assert.ok(
    (opening.bullets || []).some(function (b) {
      return /aspiring entrepreneurs|career returners|flexible franchise/i.test(b);
    })
  );
  var nextSteps = launchDeck.sections.find(function (s) {
    return s.id === 'sponsor_next_steps';
  });
  assert.ok(
    nextSteps &&
      (nextSteps.bullets || []).some(function (b) {
        return /Lead email/i.test(b);
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
