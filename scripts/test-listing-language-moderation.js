#!/usr/bin/env node
/**
 * Listing language moderation: block slurs, allow ordinary menu copy.
 * "spices" must not match the slur "spic" via a blanket -es plural.
 */
const assert = require('assert');
const {
  scanListingLanguage,
  scanEventListingLanguage,
  assertNoHateSpeechForPublish,
} = require('../api/_lib/listing-language-moderation');
const { publicErrorPayload } = require('../api/_lib/public-error');

function ok(name) {
  console.log('ok —', name);
}

const BREAKFAST_LISTING = [
  'Birmingham Private Clients are looking forward to welcoming you to our Birmingham Breakfast for a morning of good food and even better company. You can look forward to chai and juice with your delicious breakfast and lots of networking opportunities!',
  '',
  'Here is our morning schedule',
  '',
  '08:00 - Registration & Networking',
  '',
  '08.25  - Welcome',
  '',
  '08.30  - Breakfast',
  '',
  '09.30 - Depart',
  '',
  'Please choose from one of these mouth-watering breakfast options:',
  '',
  'KEJRIWAL - Two fried eggs on chilli cheese toast. A favourite of the well-to-do Willingdon Club, the first such Bombay institution to admit natives; the dish is reputedly named for the member who kept asking for it.',
  'PARSI OMELETTE- A crazy-paving three-egg omelette of chopped tomato, onion, coriander, green chilli and a little cheese. Served with grilled tomato and Fire Toast. (V)',
  'AKURI - An Irani cafe\u0301 staple. Three eggs, spiced, scrambled and piled up richly alongside plump, home-made buns and served with grilled tomato. (V) (S)',
  'THE VEGAN BOMBAY- Bountiful vegan repast. Abundant tofu akuri, vegan sausages, vegan black pudding, grilled field mushrooms, masala beans, grilled tomato and home-made vegan buns. (V)',
  'BACON NAAN ROLL- Ramsay of Carluke’s smoked streaky bacon is matured for two weeks and smoked overnight in the traditional fashion. A Dishoom signature dish, and deserving of all its accolades.',
  'VEGAN SAUSAGE NAAN ROLL- A delicious sausage developed with Chef Neil Rankin. Cleverly fermented vegetables and the best sausage spices will enhance your umami. (V)',
  'DATE & BANANA PORRIDGE - Organic porridge oats cooked with oat milk, banana and sweet Medjool dates. A never-ending portion.',
  'HOUSE GRANOLA- A Dishoom recipe, handmade with oats, seeds, cashews, almonds, pistachios and cinnamon, toasted in butter. Served with fresh seasonal fruits, creamy vanilla yoghurt and starflower honey. Dairy or coconut yoghurt. (V)',
  'We look forward to seeing you there.',
  '',
  'Charlie, Simon and Nadia',
].join('\n');

const breakfast = scanListingLanguage(BREAKFAST_LISTING);
assert.deepStrictEqual(breakfast.hate, []);
assert.deepStrictEqual(breakfast.profanity, []);
ok('Dishoom-style breakfast listing is not blocked');

assert.deepStrictEqual(scanListingLanguage('the best sausage spices').hate, []);
assert.deepStrictEqual(scanListingLanguage('Three eggs, spiced, scrambled').hate, []);
ok('spices and spiced are not treated as a slur');

assert.deepStrictEqual(scanListingLanguage('no spics allowed').hate, ['spic']);
assert.deepStrictEqual(scanListingLanguage('the spic').hate, ['spic']);
assert.ok(scanListingLanguage('a known rapist').hate.includes('rapist'));
assert.ok(scanListingLanguage('several rapists attended').hate.includes('rapist'));
ok('actual slurs and simple plurals still block');

assert.deepStrictEqual(scanListingLanguage('book a therapist').hate, []);
assert.deepStrictEqual(scanListingLanguage('our therapists').hate, []);
ok('therapist is not matched as rapist');

assert.deepStrictEqual(scanListingLanguage('n.i.g.g.e.r').hate, ['nigger']);
ok('obfuscated slurs still block');

const profanity = scanListingLanguage('what a bitch');
assert.deepStrictEqual(profanity.hate, []);
assert.ok(profanity.profanity.includes('bitch'));
const bitches = scanListingLanguage('bitches');
assert.ok(bitches.profanity.includes('bitch') || bitches.profanity.includes('bitches'));
ok('swearing still flags, including -es plurals such as bitches');

function rejectionFor(row) {
  try {
    assertNoHateSpeechForPublish(Object.assign({ status: 'published' }, row));
  } catch (err) {
    return err;
  }
  throw new Error('expected the listing to be blocked');
}

const descriptionHit = rejectionFor({
  title: 'Birmingham breakfast',
  description: 'Cleverly fermented vegetables and the best sausage spics will enhance your umami.',
});
assert.strictEqual(descriptionHit.code, 'listing_hate_speech_blocked');
assert.ok(descriptionHit.message.includes('description'), descriptionHit.message);
assert.ok(descriptionHit.message.includes('spics'), descriptionHit.message);
assert.ok(descriptionHit.message.length <= 270, descriptionHit.message);
assert.deepStrictEqual(descriptionHit.publicExtra.language.fields, [
  { field: 'description', excerpts: ['spics'] },
]);
const payload = publicErrorPayload(descriptionHit);
assert.strictEqual(payload.message, descriptionHit.message);
assert.strictEqual(payload.error, 'listing_hate_speech_blocked');
ok('rejection names the description and quotes spics');

const titleHit = rejectionFor({
  title: 'Meet the spic',
  description: 'A normal breakfast',
});
assert.ok(titleHit.message.includes('title'), titleHit.message);
assert.ok(titleHit.message.includes('spic'), titleHit.message);
assert.ok(!titleHit.message.includes('description'), titleHit.message);
assert.deepStrictEqual(titleHit.publicExtra.language.fields[0].field, 'title');
ok('rejection names the title when the title is the problem');

const both = rejectionFor({
  title: 'Meet the spic',
  description: 'Also rapists',
});
assert.ok(both.message.includes('title'), both.message);
assert.ok(both.message.includes('description'), both.message);
assert.ok(both.message.includes('spic'), both.message);
assert.ok(both.message.includes('rapists'), both.message);
assert.strictEqual(both.publicExtra.language.fields.length, 2);
ok('rejection lists each field that failed');

const obfuscated = scanEventListingLanguage({
  title: 'Hello',
  description: 'Please no n.i.g.g.e.r here',
});
assert.deepStrictEqual(obfuscated.fields[0].excerpts, ['n.i.g.g.e.r']);
const spaced = scanEventListingLanguage({
  title: 'Hello',
  description: 'Please no n i g g e r here',
});
assert.ok(spaced.fields[0].excerpts.some((item) => item.replace(/\s+/g, '') === 'nigger'));
const phrase = scanEventListingLanguage({
  title: 'Hello',
  description: 'They chanted white power at the door',
});
assert.deepStrictEqual(phrase.fields[0].excerpts, ['white power']);
ok('excerpts quote obfuscated and multi-word wording');

assert.strictEqual(
  assertNoHateSpeechForPublish({
    title: 'Birmingham breakfast',
    description: BREAKFAST_LISTING,
    status: 'published',
  }).hate.length,
  0
);
ok('allowed menu copy still publishes');

console.log('listing language moderation tests passed');
