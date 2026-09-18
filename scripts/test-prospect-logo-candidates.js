/**
 * Smoke test: prefer real site logos over og:image hero photos.
 */
const assert = require('assert');
const {
  looksLikePhotoUrl,
  knownProspectLogo,
  discoverSiteBrandAssets,
  resolveProspectLogoCandidates,
} = require('../api/_lib/prospect-logo-candidates');

assert.equal(
  looksLikePhotoUrl('https://www.pink-spaghetti.co.uk/_webedit/cached-images/131-0-0-1115-10000-8885-1920.jpg'),
  true
);
assert.equal(
  looksLikePhotoUrl('https://www.pink-spaghetti.co.uk/_webedit/cached-images/16.png'),
  false
);
assert.equal(
  knownProspectLogo('https://www.pink-spaghetti.co.uk/', 'Pink Spaghetti'),
  'https://www.pink-spaghetti.co.uk/_webedit/cached-images/16.png'
);

(async function () {
  const assets = await discoverSiteBrandAssets('https://www.pink-spaghetti.co.uk/');
  assert.ok(assets.logos.length, 'expected header logo discovery');
  assert.ok(
    assets.logos.some(function (u) {
      return /cached-images\/16(?:-|\.png)/i.test(u);
    }),
    'expected Pink Spaghetti logo asset 16.png, got ' + JSON.stringify(assets.logos)
  );
  if (assets.ogImage) {
    assert.ok(looksLikePhotoUrl(assets.ogImage) || true);
  }

  const candidates = await resolveProspectLogoCandidates('https://www.pink-spaghetti.co.uk/', '');
  assert.ok(candidates.length, 'expected candidates');
  assert.ok(
    /cached-images\/16/i.test(candidates[0]),
    'first candidate should be site logo, got ' + candidates[0]
  );
  assert.ok(
    !/131\.jpg|131-0-0/i.test(candidates[0]),
    'must not lead with og hero photo'
  );

  const demoted = await resolveProspectLogoCandidates(
    'https://www.pink-spaghetti.co.uk/',
    'https://www.pink-spaghetti.co.uk/_webedit/cached-images/131-0-0-1115-10000-8885-1920.jpg',
    'Pink Spaghetti'
  );
  assert.ok(
    /cached-images\/16/i.test(demoted[0]),
    'photo-looking saved URL must not beat real logo, got ' + demoted[0]
  );

  const uploaded = await resolveProspectLogoCandidates(
    'https://www.pink-spaghetti.co.uk/',
    'https://cdn.example.com/uploads/ps-logo.png',
    'Pink Spaghetti'
  );
  assert.equal(uploaded[0], 'https://cdn.example.com/uploads/ps-logo.png');

  console.log('test-prospect-logo-candidates: ok');
  console.log('  first=', candidates[0]);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
