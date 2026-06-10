/**
 * POST /api/contact-chat — Hubert, AI assistant for the Contact us page.
 * Body: { messages: [{ role: 'user'|'assistant', content: string }] }
 */
const { json, setCors } = require('./_lib/auth');
const { SYSTEM_PROMPT, fallbackReply } = require('./_lib/hubert-knowledge');
const {
  wantsEventSearch,
  searchEventsForHubert,
  buildEventContextBlock,
  formatEventFallbackReply,
} = require('./_lib/hubert-events');
const {
  wantsOpportunitySearch,
  searchOpportunitiesForHubert,
  buildOpportunityContextBlock,
  formatOpportunityFallbackReply,
} = require('./_lib/hubert-opportunities');

function buildLiveContext(eventLookup, opportunityLookup) {
  return [
    buildEventContextBlock(eventLookup || { events: [], query: null }),
    buildOpportunityContextBlock(opportunityLookup || { opportunities: [], query: null }),
  ].join('\n\n');
}

function pickLiveFallbackReply(eventLookup, opportunityLookup) {
  const events = eventLookup && eventLookup.events;
  const opportunities = opportunityLookup && opportunityLookup.opportunities;
  const eventCount = events ? events.length : 0;
  const opportunityCount = opportunities ? opportunities.length : 0;

  if (opportunityCount && (!eventCount || opportunityCount >= eventCount)) {
    return formatOpportunityFallbackReply(opportunityLookup);
  }
  if (eventCount) {
    return formatEventFallbackReply(eventLookup);
  }
  return null;
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
  if (!key) return null;

  const payload = {
    model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 600,
    messages: [{ role: 'system', content: systemPrompt || SYSTEM_PROMPT }].concat(messages),
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

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed' });
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

  const messages = sanitizeMessages(body.messages);
  const latestUser = messages.filter(function (m) {
    return m.role === 'user';
  }).pop();

  if (!latestUser) {
    return json(res, 400, { error: 'message_required' });
  }

  let eventLookup = null;
  let opportunityLookup = null;
  try {
    const lookups = [];
    if (wantsEventSearch(latestUser.content)) {
      lookups.push(searchEventsForHubert(latestUser.content).then(function (result) {
        eventLookup = result;
      }));
    }
    if (wantsOpportunitySearch(latestUser.content)) {
      lookups.push(searchOpportunitiesForHubert(latestUser.content).then(function (result) {
        opportunityLookup = result;
      }));
    }
    if (lookups.length) await Promise.all(lookups);

    const systemPrompt = SYSTEM_PROMPT + '\n\n' + buildLiveContext(eventLookup, opportunityLookup);

    let reply = await openAiReply(messages, systemPrompt);
    let mode = 'ai';

    if (!reply) {
      reply = pickLiveFallbackReply(eventLookup, opportunityLookup) || fallbackReply(latestUser.content);
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
    let degradedReply = fallbackReply(latestUser.content);
    try {
      const lookups = [];
      if (!eventLookup && wantsEventSearch(latestUser.content)) {
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
      degradedReply = pickLiveFallbackReply(eventLookup, opportunityLookup) || degradedReply;
    } catch (lookupErr) {
      /* keep generic fallback */
    }
    return json(res, 200, {
      ok: true,
      reply: degradedReply,
      mode: 'fallback',
      warning: 'assistant_degraded',
    });
  }
};
