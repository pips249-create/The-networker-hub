/**
 * Hidden ticket tiers unlocked by access codes at checkout.
 */

const VISIBILITY_PUBLIC = 'public';
const VISIBILITY_HIDDEN = 'hidden';
const VISIBILITY_MEMBERS_ONLY = 'members_only';
const MIN_CODE_LENGTH = 4;
const MAX_CODE_LENGTH = 32;

function normalizeAccessCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function isValidAccessCodeFormat(code) {
  const normalized = normalizeAccessCode(code);
  return (
    normalized.length >= MIN_CODE_LENGTH && normalized.length <= MAX_CODE_LENGTH
  );
}

function normalizeTicketVisibility(raw) {
  const v = String(raw || VISIBILITY_PUBLIC).toLowerCase();
  if (v === VISIBILITY_HIDDEN) return VISIBILITY_HIDDEN;
  if (v === VISIBILITY_MEMBERS_ONLY) return VISIBILITY_MEMBERS_ONLY;
  return VISIBILITY_PUBLIC;
}

function isHiddenTicket(ticket) {
  if (!ticket) return false;
  return normalizeTicketVisibility(ticket.visibility || ticket.ticketVisibility) === VISIBILITY_HIDDEN;
}

function isMembersOnlyTicket(ticket) {
  if (!ticket) return false;
  return (
    normalizeTicketVisibility(ticket.visibility || ticket.ticketVisibility) === VISIBILITY_MEMBERS_ONLY
  );
}

function accessCodeRowIsActive(row, now = new Date()) {
  if (!row) return false;
  if (row.expires_at) {
    const expires = new Date(row.expires_at);
    if (!Number.isNaN(expires.getTime()) && expires.getTime() <= now.getTime()) return false;
  }
  if (row.max_uses != null) {
    const max = Number(row.max_uses);
    const used = Number(row.uses_count) || 0;
    if (Number.isFinite(max) && used >= max) return false;
  }
  return true;
}

async function loadAccessCodesByTicketIds(sb, ticketIds) {
  const ids = (ticketIds || []).filter(Boolean);
  const map = new Map();
  if (!ids.length) return map;

  const { data, error } = await sb
    .from('ticket_access_codes')
    .select('id, event_id, ticket_id, code, max_uses, uses_count, expires_at')
    .in('ticket_id', ids);
  if (error) throw new Error(error.message);
  (data || []).forEach((row) => {
    if (row.ticket_id) map.set(row.ticket_id, row);
  });
  return map;
}

async function lookupAccessCode(sb, { eventId, code }) {
  const normalized = normalizeAccessCode(code);
  if (!normalized || !eventId) {
    return { valid: false, error: 'invalid_access_code' };
  }

  const { data, error } = await sb
    .from('ticket_access_codes')
    .select('id, event_id, ticket_id, code, max_uses, uses_count, expires_at')
    .eq('event_id', eventId)
    .ilike('code', normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { valid: false, error: 'access_code_not_found' };
  if (!accessCodeRowIsActive(data)) {
    return { valid: false, error: 'access_code_expired' };
  }

  const ticketRes = await sb
    .from('tickets')
    .select('*')
    .eq('id', data.ticket_id)
    .eq('event_id', eventId)
    .maybeSingle();
  if (ticketRes.error) throw new Error(ticketRes.error.message);
  if (!ticketRes.data || !isHiddenTicket(ticketRes.data)) {
    return { valid: false, error: 'access_code_not_found' };
  }

  return { valid: true, codeRow: data, ticket: ticketRes.data };
}

async function assertAccessCodeBookingAllowed(sb, { eventId, ticketId, code, accessCodeId }) {
  if (!ticketId) {
    const err = new Error('access_code_required');
    err.status = 403;
    throw err;
  }

  const ticketRes = await sb.from('tickets').select('*').eq('id', ticketId).maybeSingle();
  if (ticketRes.error) throw new Error(ticketRes.error.message);
  const ticket = ticketRes.data;
  if (!ticket || ticket.event_id !== eventId) {
    const err = new Error('ticket_not_found');
    err.status = 404;
    throw err;
  }
  if (!isHiddenTicket(ticket)) return null;

  const codeId = String(accessCodeId || '').trim();
  if (codeId) {
    const { data, error } = await sb
      .from('ticket_access_codes')
      .select('id, event_id, ticket_id, code, max_uses, uses_count, expires_at')
      .eq('id', codeId)
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || data.ticket_id !== ticketId || !accessCodeRowIsActive(data)) {
      const err = new Error('access_code_invalid');
      err.status = 403;
      throw err;
    }
    return { valid: true, codeRow: data, ticket };
  }

  const normalized = normalizeAccessCode(code);
  if (!normalized) {
    const err = new Error('access_code_required');
    err.status = 403;
    throw err;
  }

  const lookup = await lookupAccessCode(sb, { eventId, code: normalized });
  if (!lookup.valid) {
    const err = new Error(lookup.error || 'access_code_invalid');
    err.status = 403;
    throw err;
  }
  if (lookup.codeRow.ticket_id !== ticketId) {
    const err = new Error('access_code_ticket_mismatch');
    err.status = 403;
    throw err;
  }

  return lookup;
}

async function incrementAccessCodeUse(sb, accessCodeId) {
  const id = String(accessCodeId || '').trim();
  if (!id) return;

  const { data, error } = await sb
    .from('ticket_access_codes')
    .select('id, uses_count')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;

  const next = Math.max(0, Number(data.uses_count) || 0) + 1;
  const { error: updateErr } = await sb
    .from('ticket_access_codes')
    .update({ uses_count: next })
    .eq('id', id);
  if (updateErr) throw new Error(updateErr.message);
}

async function syncAccessCodesForEvent(sb, eventId, tierPairs) {
  const pairs = Array.isArray(tierPairs) ? tierPairs : [];
  const ticketIds = pairs.map((p) => p.ticket?.id).filter(Boolean);

  const { data: existingRows, error: loadErr } = await sb
    .from('ticket_access_codes')
    .select('id, ticket_id')
    .eq('event_id', eventId);
  if (loadErr) throw new Error(loadErr.message);
  const staleIds = (existingRows || [])
    .filter((row) => !ticketIds.includes(row.ticket_id))
    .map((row) => row.id);
  if (staleIds.length) {
    const { error: staleErr } = await sb.from('ticket_access_codes').delete().in('id', staleIds);
    if (staleErr) throw new Error(staleErr.message);
  }

  for (const pair of pairs) {
    const tier = pair.tier || {};
    const ticket = pair.ticket || {};
    const ticketId = ticket.id;
    if (!ticketId) continue;

    const visibility = String(tier.visibility || ticket.visibility || VISIBILITY_PUBLIC).toLowerCase();
    if (visibility !== VISIBILITY_HIDDEN) {
      await sb.from('ticket_access_codes').delete().eq('ticket_id', ticketId);
      continue;
    }

    const code = normalizeAccessCode(tier.accessCode || tier.access_code);
    if (!isValidAccessCodeFormat(code)) {
      const err = new Error('Hidden tickets require an access code of at least 4 letters or numbers.');
      err.status = 400;
      err.code = 'access_code_required';
      throw err;
    }

    const maxUsesRaw = tier.accessMaxUses ?? tier.access_max_uses;
    const maxUses =
      maxUsesRaw === '' || maxUsesRaw == null
        ? null
        : Math.max(1, Math.floor(Number(maxUsesRaw) || 0)) || null;

    const { data: existing, error: existingErr } = await sb
      .from('ticket_access_codes')
      .select('id')
      .eq('ticket_id', ticketId)
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);

    const row = {
      event_id: eventId,
      ticket_id: ticketId,
      code,
      max_uses: maxUses,
    };

    if (existing?.id) {
      const { error: updateErr } = await sb
        .from('ticket_access_codes')
        .update(row)
        .eq('id', existing.id);
      if (updateErr) throw new Error(updateErr.message);
    } else {
      const { error: insertErr } = await sb.from('ticket_access_codes').insert(row);
      if (insertErr) throw new Error(insertErr.message);
    }
  }
}

function validateTierAccessCodes(tiers) {
  const list = Array.isArray(tiers) ? tiers : [];
  const seen = new Set();
  for (const tier of list) {
    const visibility = String(tier.visibility || VISIBILITY_PUBLIC).toLowerCase();
    if (visibility !== VISIBILITY_HIDDEN) continue;
    const code = normalizeAccessCode(tier.accessCode || tier.access_code);
    if (!isValidAccessCodeFormat(code)) {
      const err = new Error(
        'Each hidden ticket needs an access code (at least 4 letters or numbers).'
      );
      err.status = 400;
      err.code = 'access_code_required';
      throw err;
    }
    if (seen.has(code)) {
      const err = new Error('Access codes must be unique within this event.');
      err.status = 400;
      err.code = 'access_code_duplicate';
      throw err;
    }
    seen.add(code);
  }
}

module.exports = {
  VISIBILITY_PUBLIC,
  VISIBILITY_HIDDEN,
  VISIBILITY_MEMBERS_ONLY,
  MIN_CODE_LENGTH,
  MAX_CODE_LENGTH,
  normalizeAccessCode,
  normalizeTicketVisibility,
  isValidAccessCodeFormat,
  isHiddenTicket,
  isMembersOnlyTicket,
  loadAccessCodesByTicketIds,
  lookupAccessCode,
  assertAccessCodeBookingAllowed,
  incrementAccessCodeUse,
  syncAccessCodesForEvent,
  validateTierAccessCodes,
};
