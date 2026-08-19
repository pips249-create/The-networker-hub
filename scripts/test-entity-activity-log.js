/**
 * Smoke test for entity activity log helpers (no DB required).
 */
const assert = require('assert');
const {
  actorFromSession,
  mapActorRole,
  changedKeys,
  fetchAccountActivity,
} = require('../api/_lib/entity-activity-log');

assert.strictEqual(mapActorRole({ email: 'a@b.com' }, { role: 'owner' }), 'owner');
assert.strictEqual(mapActorRole({ email: 'a@b.com' }, { role: 'editor' }), 'team');
assert.strictEqual(mapActorRole({ email: 'a@b.com' }, null), 'unknown');
assert.strictEqual(
  mapActorRole(
    { email: 'glenn@example.com', impersonator: { email: 'pips249@gmail.com' } },
    { role: 'owner' }
  ),
  'admin'
);

const actor = actorFromSession({ sub: 'u1', email: 'owner@example.com' }, { role: 'owner' });
assert.strictEqual(actor.actor_email, 'owner@example.com');
assert.strictEqual(actor.actor_role, 'owner');
assert.strictEqual(actor.actor_user_id, 'u1');

const impersonated = actorFromSession(
  {
    sub: 'glenn-id',
    email: 'glenn@business-network.co.uk',
    impersonator: {
      sub: 'catherine-id',
      email: 'pips249@gmail.com',
      name: 'Catherine Hancher',
      role: 'admin',
    },
  },
  { role: 'owner' }
);
assert.strictEqual(impersonated.actor_role, 'admin');
assert.strictEqual(impersonated.actor_email, 'pips249@gmail.com');
assert.strictEqual(impersonated.actor_user_id, 'catherine-id');
assert.strictEqual(impersonated.metadata.impersonatedEmail, 'glenn@business-network.co.uk');
assert.strictEqual(impersonated.metadata.actorName, 'Catherine Hancher');

assert.deepStrictEqual(
  changedKeys({ title: 'A', city: 'London' }, { title: 'B', city: 'London' }, ['title', 'city']),
  ['title']
);

assert.strictEqual(typeof fetchAccountActivity, 'function');

console.log('test-entity-activity-log: ok');
