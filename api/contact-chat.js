/**
 * POST /api/contact-chat — Hubert, AI assistant for the Contact us page.
 * Body: { messages: [{ role: 'user'|'assistant', content: string }] }
 */
const { json, setCors } = require('./_lib/auth');
const { SYSTEM_PROMPT, fallbackReply } = require('./_lib/hubert-knowledge');

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
    temperature: 0.3,
    max_tokens: 600,
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
