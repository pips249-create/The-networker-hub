/**
 * POST /api/contact-chat — Hubert, AI assistant for the Contact us page.
 * Body: { messages: [{ role: 'user'|'assistant', content: string }] }
 */
const { json, setCors } = require('./_lib/auth');
const { wrapHandler } = require('./_lib/sentry');
const { enforceRateLimitAsync, clientIp } = require('./_lib/rate-limit');
const { verifyTurnstileToken } = require('./_lib/turnstile');
const {
  SYSTEM_PROMPT,
  buildPageContextAddendum,
  ORGANISER_PAGE_KEYS,
} = require('./_lib/hubert-knowledge');
const {
  wantsEventSearch,
  searchEventsForHubert,
  buildEventContextBlock,
} = require('./_lib/hubert-events');
const {
  wantsOpportunitySearch,
  searchOpportunitiesForHubert,
  buildOpportunityContextBlock,
} = require('./_lib/hubert-opportunities');
const { resolveHubertReply } = require('./_lib/hubert-reply');
const { redactMessages } = require('./_lib/hubert-pii');

function openAiEnabled() {
  return (
    Boolean(process.env.OPENAI_API_KEY) &&
    String(process.env.HUBERT_OPENAI_ENABLED || '').trim().toLowerCase() === 'true'
  );
}

function buildLiveContext(eventLookup, opportunityLookup) {
  return [
    buildEventContextBlock(eventLookup || { events: [], query: null }),
    buildOpportunityContextBlock(opportunityLookup || { opportunities: [], query: null }),
  ].join('\n\n');
}

function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(function (m) {
      return m && (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim();
    })
    .slice(-12)
    .map(function (m) {
      return {
        role: m.role,
        content: String(m.content).trim().slice(0, 2000),
      };
    });
}

async function openAiReply(messages, systemPrompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !openAiEnabled()) return null;

  const payload = {
    model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 600,
    messages: [{ role: 'system', content: systemPrompt || SYSTEM_PROMPT }].concat(
      redactMessages(messages)
    ),
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(function () {
      return '';
    });
    throw new Error('openai_' + res.status + ':' + errText.slice(0, 200));
  }

  const data = await res.json();
  const reply = data && data.choices && data.choices[0] && data.choices[0].message;
  return reply && reply.content ? String(reply.content).trim() : null;
}

module.exports = wrapHandler(async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
  }

  const limited = await enforceRateLimitAsync(req, res, 'contact_chat', { max: 20, windowMs: 300_000 });
  if (!limited.allowed) {
    return json(res, 429, {
      error: 'rate_limited',
      message: 'Too many messages. Please wait a few minutes and try again.',
      retryAfterSec: limited.retryAfterSec,
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  body = body || {};

  // Optional when Turnstile keys are set and the client sends a token (fail-open if absent
  // so existing Hubert widgets keep working without a captcha UI).
  const turnstileToken = body.turnstileToken || body['cf-turnstile-response'];
  if (turnstileToken) {
    const captcha = await verifyTurnstileToken(turnstileToken, clientIp(req));
    if (!captcha.ok) {
      return json(res, 400, {
        error: captcha.error || 'captcha_failed',
        message: 'Please complete the security check and try again.',
      });
    }
  }

  const messages = sanitizeMessages(body.messages);
  const latestUser = messages.filter(function (m) {
    return m.role === 'user';
  }).pop();

  if (!latestUser) {
    return json(res, 400, { error: 'message_required' });
  }

  const pageContext = String(body.context || body.pageContext || '').trim();
  const isOrganiserPage = ORGANISER_PAGE_KEYS.indexOf(pageContext) !== -1;
  const lookupOptions = {
    skipEventSearch: isOrganiserPage,
    skipOpportunitySearch: isOrganiserPage,
  };

  let eventLookup = null;
  let opportunityLookup = null;
  try {
    const lookups = [];
    if (wantsEventSearch(latestUser.content, lookupOptions)) {
      lookups.push(searchEventsForHubert(latestUser.content).then(function (result) {
        eventLookup = result;
      }));
    }
    if (wantsOpportunitySearch(latestUser.content, lookupOptions)) {
      lookups.push(searchOpportunitiesForHubert(latestUser.content).then(function (result) {
        opportunityLookup = result;
      }));
    }
    if (lookups.length) await Promise.all(lookups);

    const systemPrompt =
      SYSTEM_PROMPT +
      buildPageContextAddendum(pageContext) +
      '\n\n' +
      buildLiveContext(eventLookup, opportunityLookup);

    let reply = await openAiReply(messages, systemPrompt);
    let mode = 'ai';

    if (!reply) {
      reply = resolveHubertReply(latestUser.content, eventLookup, opportunityLookup);
      mode = 'fallback';
    }

    return json(res, 200, {
      ok: true,
      reply: reply,
      mode: mode,
      eventsFound: eventLookup && eventLookup.events ? eventLookup.events.length : 0,
      opportunitiesFound:
        opportunityLookup && opportunityLookup.opportunities ? opportunityLookup.opportunities.length : 0,
    });
  } catch (err) {
    let degradedReply = null;
    try {
      const lookups = [];
      if (!eventLookup && wantsEventSearch(latestUser.content, lookupOptions)) {
        lookups.push(searchEventsForHubert(latestUser.content).then(function (result) {
          eventLookup = result;
        }));
      }
      if (!opportunityLookup && wantsOpportunitySearch(latestUser.content)) {
        lookups.push(searchOpportunitiesForHubert(latestUser.content).then(function (result) {
          opportunityLookup = result;
        }));
      }
      if (lookups.length) await Promise.all(lookups);
      degradedReply = resolveHubertReply(latestUser.content, eventLookup, opportunityLookup);
    } catch (lookupErr) {
      /* keep generic fallback */
    }
    if (!degradedReply) {
      degradedReply = resolveHubertReply(latestUser.content, null, null);
    }
    return json(res, 200, {
      ok: true,
      reply: degradedReply,
      mode: 'fallback',
      warning: 'assistant_degraded',
    });
  }
});