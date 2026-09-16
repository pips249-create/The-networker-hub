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
  assert.equal(publicPathForSlug(slug), '/p-tnh-' + slug);

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

  console.log('test-custom-pitch-deck-generate: ok');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
