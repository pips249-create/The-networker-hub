#!/usr/bin/env node
/**
 * Listing language moderation: block slurs, allow ordinary menu copy.
 * "spices" must not match the slur "spic" via a blanket -es plural.
 */
const assert = require('assert');
const { scanListingLanguage } = require('../api/_lib/listing-language-moderation');

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

console.log('listing language moderation tests passed');
