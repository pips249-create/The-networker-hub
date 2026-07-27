/**
 * Smoke test for entity activity log helpers (no DB required).
 */
const assert = require('assert');
const {
  actorFromSession,
  mapActorRole,
  changedKeys,
} = require('../api/_lib/entity-activity-log');

assert.strictEqual(mapActorRole({ email: 'a@b.com' }, { role: 'owner' }), 'owner');
assert.strictEqual(mapActorRole({ email: 'a@b.com' }, { role: 'editor' }), 'team');
assert.strictEqual(mapActorRole({ email: 'a@b.com' }, null), 'unknown');

const actor = actorFromSession({ sub: 'u1', email: 'owner@example.com' }, { role: 'owner' });
assert.strictEqual(actor.actor_email, 'owner@example.com');
assert.strictEqual(actor.actor_role, 'owner');
assert.strictEqual(actor.actor_user_id, 'u1');

assert.deepStrictEqual(
  changedKeys({ title: 'A', city: 'London' }, { title: 'B', city: 'London' }, ['title', 'city']),
  ['title']
);

console.log('test-entity-activity-log: ok');
