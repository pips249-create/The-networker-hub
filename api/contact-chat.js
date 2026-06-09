/**
 * POST /api/contact-chat — AI assistant for the Contact us page.
 * Body: { messages: [{ role: 'user'|'assistant', content: string }] }
 */
const { json, setCors } = require('./_lib/auth');

const SYSTEM_PROMPT =
  'You are the helpful assistant for The Networker Hub (the-networker.co.uk), a UK platform for discovering networking events, exhibitions, business opportunities, and professional training. ' +
  'Answer clearly and briefly in British English. ' +
  'Key facts: browsing listings is free; tickets use secure Stripe checkout; organisers can list events and opportunities from the organiser dashboard; ' +
  'The Academy (training) is launching soon; the hub is run by Rosie and Catherine (Pip) at The Networker Group Ltd. ' +
  'For account issues, refunds, or anything you cannot resolve, direct people to hello@the-networker.co.uk or the FAQ at /faq.html. ' +
  'Do not invent event dates, prices, or policies. If unsure, say so and suggest emailing hello@the-networker.co.uk.';

const FALLBACK_REPLIES = [
  {
    match: /book|ticket|checkout|stripe/i,
    reply:
      'To book a ticket, open an event from the listings, choose your ticket type, and complete secure Stripe checkout. You can manage bookings in My tickets. Need help with a specific booking? Email hello@the-networker.co.uk.',
  },
  {
    match: /organiser|list an event|dashboard/i,
    reply:
      'Organisers can sign in and open the organiser dashboard to create events, manage attendees, and list business opportunities. Email hello@the-networker.co.uk if you need help getting started.',
  },
  {
    match: /opportunit/i,
    reply:
      'Business opportunities are listed on the hub — browse franchises, partnerships, and referral deals, then send a direct enquiry from any listing page.',
  },
  {
    match: /account|register|sign up|login/i,
    reply:
      'You can browse without an account. A free account lets you save favourites, manage tickets, and leave reviews. Create one from the Register page or sign in if you already have one.',
  },
  {
    match: /refund|cancel/i,
    reply:
      'Refund rules depend on the event organiser. Check the event page and our Refunds policy in Legal & policies. For a specific booking, email hello@the-networker.co.uk with your order details.',
  },
];

function fallbackReply(latestUser) {
  const text = String(latestUser || '').trim();
  if (!text) {
    return 'How can I help you with The Networker Hub today? You can ask about events, tickets, organiser listings, or business opportunities.';
  }
  for (var i = 0; i < FALLBACK_REPLIES.length; i++) {
    if (FALLBACK_REPLIES[i].match.test(text)) return FALLBACK_REPLIES[i].reply;
  }
  return (
    'Thanks for your message. For detailed help, email hello@the-networker.co.uk or read our FAQ. ' +
    'I can also help with finding events, booking tickets, organiser listings, and business opportunities.'
  );
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

async function openAiReply(messages) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const payload = {
    model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    temperature: 0.4,
    max_tokens: 500,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }].concat(messages),
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

  try {
    let reply = await openAiReply(messages);
    let mode = 'ai';

    if (!reply) {
      reply = fallbackReply(latestUser.content);
      mode = 'fallback';
    }

    return json(res, 200, { ok: true, reply: reply, mode: mode });
  } catch (err) {
    return json(res, 200, {
      ok: true,
      reply: fallbackReply(latestUser.content),
      mode: 'fallback',
      warning: 'assistant_degraded',
    });
  }
};
