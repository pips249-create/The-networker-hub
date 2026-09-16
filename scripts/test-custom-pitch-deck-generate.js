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
  assert.match(sponsorDeck.hero.headline, /Advertising on The Networker UK/);

  console.log('test-custom-pitch-deck-generate: ok');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
