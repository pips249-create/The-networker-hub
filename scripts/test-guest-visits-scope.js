#!/usr/bin/env node
/**
 * Unit checks for complimentary guest visits across sister organiser pages.
 * Run: node scripts/test-guest-visits-scope.js
 */
const {
  normalizeComplimentaryVisitsScope,
  clampComplimentaryVisitsAllowed,
  resolveSiblingOrganiserIds,
  loadOrganiserGuestVisitSettings,
  countUsedGuestVisits,
  getGuestVisitEligibility,
  looksLikeComplimentaryVisitTicketName,
  publicTicketsMixFreeAndPaid,
  publicFreeTicketIsFirstVisitStandIn,
  GUEST_VISIT_SCOPE_PER_GROUP,
  GUEST_VISIT_SCOPE_ACROSS_GROUPS,
} = require('../api/_lib/guest-visits');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL', label);
    failed += 1;
    return;
  }
  console.log('OK  ', label);
}

assert(
  'first meeting looks like complimentary visit',
  looksLikeComplimentaryVisitTicketName('First Meeting')
);
assert(
  'complimentary visit name matches',
  looksLikeComplimentaryVisitTicketName('Complimentary visit')
);
assert(
  'general admission is not a complimentary visit name',
  !looksLikeComplimentaryVisitTicketName('General admission')
);
assert(
  'free + paid public tickets is a mix',
  publicTicketsMixFreeAndPaid([
    { name: 'Online', price: 0, ticketType: 'Standard' },
    { name: 'In person', price: 18, ticketType: 'Standard' },
  ])
);
assert(
  'ordinary free + paid is not a first-visit stand-in',
  !publicFreeTicketIsFirstVisitStandIn([
    { name: 'Online', price: 0, ticketType: 'Standard' },
    { name: 'In person', price: 18, ticketType: 'Standard' },
  ])
);
assert(
  'first meeting + paid is a first-visit stand-in',
  publicFreeTicketIsFirstVisitStandIn([
    { name: 'First Meeting', price: 0, ticketType: 'Standard' },
    { name: 'General Attendance', price: 18, ticketType: 'Standard' },
  ])
);
assert(
  'guest visit + paid ticket is not a first-visit stand-in',
  !publicFreeTicketIsFirstVisitStandIn([
    { name: 'Guest visit', price: 0, ticketType: 'Guest-visit' },
    { name: 'General Attendance', price: 18, ticketType: 'Standard' },
  ])
);
assert(
  'member-only £0 + public paid is not a first-visit stand-in',
  !publicFreeTicketIsFirstVisitStandIn([
    { name: 'Member ticket', price: 0, visibility: 'members_only' },
    { name: 'General Attendance', price: 18, ticketType: 'Standard' },
  ])
);
assert(
  'all-free event is not a first-visit stand-in',
  !publicFreeTicketIsFirstVisitStandIn([{ name: 'General admission', price: 0, ticketType: 'Standard' }])
);

function makeSb(handlers) {
  return {
    from(table) {
      const state = { table, filters: {}, inFilters: {}, orFilter: null, neq: [], is: [] };
      const chain = {
        select() {
          return chain;
        },
        eq(col, val) {
          state.filters[col] = val;
          return chain;
        },
        in(col, vals) {
          state.inFilters[col] = vals;
          return chain;
        },
        or(expr) {
          state.orFilter = expr;
          return chain;
        },
        neq(col, val) {
          state.neq.push([col, val]);
          return chain;
        },
        is(col, val) {
          state.is.push([col, val]);
          return chain;
        },
        maybeSingle() {
          return handlers.maybeSingle(state);
        },
        then(resolve, reject) {
          Promise.resolve(handlers.list(state)).then(resolve, reject);
        },
      };
      return chain;
    },
  };
}

assert('normalize defaults to per_group', normalizeComplimentaryVisitsScope('') === GUEST_VISIT_SCOPE_PER_GROUP);
assert(
  'normalize accepts across_groups',
  normalizeComplimentaryVisitsScope('across_groups') === GUEST_VISIT_SCOPE_ACROSS_GROUPS
);
assert('normalize accepts shared alias', normalizeComplimentaryVisitsScope('shared') === GUEST_VISIT_SCOPE_ACROSS_GROUPS);
assert('clamp allows 2', clampComplimentaryVisitsAllowed(2) === 2);
assert('clamp caps at 3', clampComplimentaryVisitsAllowed(9) === 3);

(async () => {
  const orgA = '11111111-1111-4111-8111-111111111111';
  const orgB = '22222222-2222-4222-8222-222222222222';
  const attendeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const accountId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const siblingSb = makeSb({
    maybeSingle(state) {
      if (state.table === 'organisers' && state.filters.id === orgA) {
        return {
          data: {
            id: orgA,
            organiser_account_id: accountId,
            email: 'owner@example.com',
            contact_email: 'owner@example.com',
          },
          error: null,
        };
      }
      if (state.table === 'attendees' && state.filters.id === attendeeId) {
        return { data: { id: attendeeId }, error: null };
      }
      return { data: null, error: null };
    },
    list(state) {
      if (state.table === 'organisers' && state.filters.organiser_account_id === accountId) {
        return { data: [{ id: orgA }, { id: orgB }], error: null };
      }
      if (state.table === 'organisers' && state.orFilter) {
        return { data: [{ id: orgA }, { id: orgB }], error: null };
      }
      if (state.table === 'registrations') {
        const ids = state.inFilters.organiser_id || (state.filters.organiser_id ? [state.filters.organiser_id] : []);
        const rows = [];
        if (ids.includes(orgA)) rows.push({ id: 'r1', quantity: 1 });
        if (ids.includes(orgB)) rows.push({ id: 'r2', quantity: 1 });
        return { data: rows, error: null };
      }
      return { data: [], error: null };
    },
  });

  const siblings = await resolveSiblingOrganiserIds(siblingSb, orgA);
  assert('siblings include both organiser pages', siblings.includes(orgA) && siblings.includes(orgB));

  const usedOne = await countUsedGuestVisits(siblingSb, {
    organiserId: orgA,
    organiserIds: [orgA],
    attendeeId,
  });
  assert('per-group count only uses group A (1 visit)', usedOne === 1);

  const usedShared = await countUsedGuestVisits(siblingSb, {
    organiserId: orgA,
    organiserIds: [orgA, orgB],
    attendeeId,
  });
  assert('across-groups count uses A + B (2 visits)', usedShared === 2);

  // Settings loader: across_groups
  const settingsSb = makeSb({
    maybeSingle(state) {
      if (state.table === 'organisers' && state.filters.id === orgA) {
        if (!state._asked) {
          // first select includes scope column path — simulate success
        }
        return {
          data: {
            id: orgA,
            complimentary_visits_allowed: 2,
            complimentary_visits_scope: 'across_groups',
            organiser_account_id: accountId,
            email: 'owner@example.com',
            contact_email: 'owner@example.com',
          },
          error: null,
        };
      }
      if (state.table === 'attendees') return { data: { id: attendeeId }, error: null };
      return { data: null, error: null };
    },
    list(state) {
      if (state.table === 'organisers') {
        return { data: [{ id: orgA }, { id: orgB }], error: null };
      }
      if (state.table === 'registrations') {
        return {
          data: [
            { id: 'r1', quantity: 1 },
            { id: 'r2', quantity: 1 },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    },
  });

  // Patch roster require to avoid real DB
  const Module = require('module');
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === './organiser-member-roster' || request.endsWith('/organiser-member-roster')) {
      return {
        getActiveRosterMembership: async () => ({ active: false }),
      };
    }
    return originalLoad(request, parent, isMain);
  };

  const settings = await loadOrganiserGuestVisitSettings(settingsSb, orgA);
  assert('settings scope is across_groups', settings.scope === GUEST_VISIT_SCOPE_ACROSS_GROUPS);
  assert('settings allowed is 2', settings.allowed === 2);
  assert('settings organiserIds includes siblings', settings.organiserIds.length === 2);

  const eligibility = await getGuestVisitEligibility(settingsSb, {
    organiserId: orgA,
    attendeeId,
    email: 'guest@example.com',
  });
  assert('shared pool exhausted after 2 sister visits', eligibility.eligible === false);
  assert('used count is 2 across sisters', eligibility.used === 2);
  assert('remaining is 0', eligibility.remaining === 0);

  // Fallback when complimentary_visits_scope column is missing
  let triedScopedSelect = false;
  const fallbackSb = makeSb({
    maybeSingle(state) {
      if (state.table === 'organisers' && state.filters.id === orgA) {
        if (!triedScopedSelect) {
          triedScopedSelect = true;
          return {
            data: null,
            error: { message: 'column organisers.complimentary_visits_scope does not exist' },
          };
        }
        return {
          data: { id: orgA, complimentary_visits_allowed: 2 },
          error: null,
        };
      }
      return { data: null, error: null };
    },
    list() {
      return { data: [], error: null };
    },
  });

  const fallback = await loadOrganiserGuestVisitSettings(fallbackSb, orgA);
  assert('missing scope column falls back to per_group', fallback.scope === GUEST_VISIT_SCOPE_PER_GROUP);
  assert('missing scope column still loads allowance', fallback.allowed === 2);
  assert('missing scope column only counts current page', fallback.organiserIds.length === 1);

  Module._load = originalLoad;

  if (failed) {
    console.error('\n' + failed + ' check(s) failed');
    process.exit(1);
  }
  console.log('\nAll sister-group complimentary visit checks passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
