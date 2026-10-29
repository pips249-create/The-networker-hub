/**
 * Unit checks for Eventbrite OAuth helpers + token resolution + event webhook ids.
 * Run: node scripts/test-eventbrite-oauth.js
 */
const assert = require('assert');
const {
  eventbriteOAuthConfigured,
  eventbriteOAuthRedirectUri,
  signEventbriteOAuthState,
  verifyEventbriteOAuthState,
  buildEventbriteAuthorizeUrl,
  safeReturnPath,
} = require('../api/_lib/eventbrite-oauth');
const {
  eventbritePrivateTokenFromConfig,
  eventbriteAuthMethodFromConfig,
  stripEventbriteAuthFromConfig,
  eventbriteEventIdFromApiUrl,
  eventbriteWebhookActionList,
} = require('../api/_lib/connected-booking-providers/adapters/eventbrite-api');
const { parseIntegrationRoute } = require('../api/_lib/integration-route-path');

function withEnv(patch, fn) {
  const prev = {};
  Object.keys(patch).forEach(function (key) {
    prev[key] = process.env[key];
    if (patch[key] == null) delete process.env[key];
    else process.env[key] = patch[key];
  });
  try {
    return fn();
  } finally {
    Object.keys(patch).forEach(function (key) {
      if (prev[key] == null) delete process.env[key];
      else process.env[key] = prev[key];
    });
  }
}

function testConfiguredAndRedirect() {
  withEnv(
    {
      EVENTBRITE_CLIENT_ID: 'eb_client',
      EVENTBRITE_CLIENT_SECRET: 'eb_secret',
      SITE_URL: 'https://www.thenetworkeruk.com',
      EVENTBRITE_OAUTH_REDIRECT_URI: '',
    },
    function () {
      assert.strictEqual(eventbriteOAuthConfigured(), true);
      assert.strictEqual(
        eventbriteOAuthRedirectUri(),
        'https://www.thenetworkeruk.com/api/integrations/eventbrite/oauth/callback'
      );
    }
  );
  withEnv(
    {
      EVENTBRITE_CLIENT_ID: '',
      EVENTBRITE_CLIENT_SECRET: '',
      EVENTBRITE_API_KEY: '',
    },
    function () {
      assert.strictEqual(eventbriteOAuthConfigured(), false);
    }
  );
  console.log('ok oauth configured/redirect');
}

function testStateRoundTrip() {
  withEnv({ SESSION_SECRET: 'test-session-secret-at-least-32-chars!!' }, function () {
    const state = signEventbriteOAuthState({
      accountId: 'acc-1',
      groupId: 'grp-1',
      returnPath: '/organiser/group-edit?id=grp-1',
      email: 'org@example.com',
    });
    const payload = verifyEventbriteOAuthState(state);
    assert.ok(payload);
    assert.strictEqual(payload.accountId, 'acc-1');
    assert.strictEqual(payload.groupId, 'grp-1');
    assert.strictEqual(payload.purpose, 'eventbrite_oauth');
    assert.strictEqual(verifyEventbriteOAuthState('not-a-token'), null);
  });
  console.log('ok oauth state round-trip');
}

function testAuthorizeUrl() {
  withEnv(
    {
      EVENTBRITE_CLIENT_ID: 'eb_client',
      EVENTBRITE_CLIENT_SECRET: 'eb_secret',
      SITE_URL: 'https://www.thenetworkeruk.com',
      SESSION_SECRET: 'test-session-secret-at-least-32-chars!!',
    },
    function () {
      const url = buildEventbriteAuthorizeUrl('state-token');
      assert.ok(url.startsWith('https://www.eventbrite.com/oauth/authorize?'));
      assert.ok(url.includes('client_id=eb_client'));
      assert.ok(url.includes('response_type=code'));
      assert.ok(url.includes('state=state-token'));
      assert.ok(url.includes(encodeURIComponent('/api/integrations/eventbrite/oauth/callback')));
    }
  );
  console.log('ok authorize url');
}

function testTokenFromConfig() {
  assert.strictEqual(
    eventbritePrivateTokenFromConfig({ eventbriteAccessToken: 'oauth-tok' }),
    'oauth-tok'
  );
  assert.strictEqual(
    eventbritePrivateTokenFromConfig({ eventbritePrivateToken: 'priv-tok' }),
    'priv-tok'
  );
  assert.strictEqual(
    eventbritePrivateTokenFromConfig({
      eventbriteAccessToken: 'oauth-tok',
      eventbritePrivateToken: 'priv-tok',
    }),
    'oauth-tok'
  );
  assert.strictEqual(
    eventbritePrivateTokenFromConfig({
      eventbriteAuthMethod: 'private_token',
      eventbriteAccessToken: 'oauth-tok',
      eventbritePrivateToken: 'priv-tok',
    }),
    'priv-tok'
  );
  assert.strictEqual(eventbriteAuthMethodFromConfig({ eventbriteAuthMethod: 'oauth' }), 'oauth');
  assert.strictEqual(
    eventbriteAuthMethodFromConfig({ eventbritePrivateToken: 'x' }),
    'private_token'
  );
  const cleared = stripEventbriteAuthFromConfig({
    eventbriteAccessToken: 'oauth-tok',
    eventbritePrivateToken: 'priv-tok',
    eventbriteAuthMethod: 'oauth',
    eventbriteOAuthConnectedAt: '2026-01-01T00:00:00.000Z',
    defaultImportGroupId: 'group-1',
  });
  assert.strictEqual(eventbritePrivateTokenFromConfig(cleared), '');
  assert.strictEqual(eventbriteAuthMethodFromConfig(cleared), '');
  assert.strictEqual(cleared.defaultImportGroupId, 'group-1');
  console.log('ok token preference + disconnect strip');
}

function testEventIdFromApiUrl() {
  assert.strictEqual(
    eventbriteEventIdFromApiUrl('https://www.eventbriteapi.com/v3/events/123456789/'),
    '123456789'
  );
  assert.strictEqual(
    eventbriteEventIdFromApiUrl(
      'https://www.eventbriteapi.com/v3/events/123456789/attendees/999/'
    ),
    ''
  );
  assert.strictEqual(
    eventbriteEventIdFromApiUrl('https://www.eventbriteapi.com/v3/orders/12826552624/'),
    ''
  );
  assert.deepStrictEqual(eventbriteWebhookActionList({ actions: 'event.published' }), [
    'event.published',
  ]);
  console.log('ok event webhook id');
}

function testRouteParse() {
  const route = parseIntegrationRoute({
    url: '/api/integrations/eventbrite/oauth/callback?code=abc&state=xyz',
  });
  assert.strictEqual(route.type, 'eventbrite_oauth_callback');
  console.log('ok integration route parse');
}

function testSafeReturnPath() {
  assert.strictEqual(safeReturnPath('/organiser/group-edit?id=1'), '/organiser/group-edit?id=1');
  assert.strictEqual(
    safeReturnPath('https://evil.example/phish'),
    '/organiser/#connected-booking'
  );
  assert.strictEqual(safeReturnPath('//evil.example'), '/organiser/#connected-booking');
  console.log('ok safe return path');
}

testConfiguredAndRedirect();
testStateRoundTrip();
testAuthorizeUrl();
testTokenFromConfig();
testEventIdFromApiUrl();
testRouteParse();
testSafeReturnPath();
console.log('All Eventbrite OAuth tests passed.');
