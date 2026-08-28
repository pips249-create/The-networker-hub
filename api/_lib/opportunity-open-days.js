/**
 * Opportunity open days — dated visit sessions on a listing (not Hub events).
 */
const { getSupabaseAdmin } = require('./supabase');

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || '')
  );
}

function isMissingOpenDaysTableError(error) {
  const msg = String((error && error.message) || error || '').toLowerCase();
  if (!msg.includes('opportunity_open_day')) return false;
  return (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find') ||
    msg.includes('undefined table')
  );
}

function trimText(value, max) {
  const s = String(value || '').trim();
  if (!s) return '';
  return max && s.length > max ? s.slice(0, max) : s;
}

function openDayRowToDto(row, options) {
  if (!row) return null;
  const opts = options || {};
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    venueName: trimText(row.venue_name, 120) || null,
    addressLine: trimText(row.address_line, 200),
    city: trimText(row.city, 80) || null,
    postcode: trimText(row.postcode, 20) || null,
    notes: trimText(row.notes, 400) || null,
    sortOrder: Number(row.sort_order) || 0,
    interestCount: opts.interestCount != null ? Number(opts.interestCount) || 0 : undefined,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function formatOpenDayAddress(day) {
  return [day.venueName, day.addressLine, day.city, day.postcode]
    .map((p) => trimText(p))
    .filter(Boolean)
    .join(', ');
}

function formatOpenDayWhen(day) {
  if (!day || !day.startsAt) return '';
  try {
    const start = new Date(day.startsAt);
    if (Number.isNaN(start.getTime())) return String(day.startsAt);
    const datePart = start.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Europe/London',
    });
    const timePart = start.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London',
    });
    let out = datePart + ' · ' + timePart;
    if (day.endsAt) {
      const end = new Date(day.endsAt);
      if (!Number.isNaN(end.getTime())) {
        out +=
          '–' +
          end.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/London',
          });
      }
    }
    return out;
  } catch {
    return String(day.startsAt);
  }
}

function interestRowToDto(row, extras) {
  if (!row) return null;
  const day = extras && extras.openDay ? extras.openDay : null;
  const opportunity = extras && extras.opportunity ? extras.opportunity : null;
  return {
    id: row.id,
    openDayId: row.open_day_id,
    opportunityId: row.opportunity_id,
    opportunityTitle:
      (opportunity && opportunity.title) || row.opportunity_title || '',
    ownerEmail: String(row.owner_email || '').toLowerCase(),
    registrantName: trimText(row.registrant_name, 120),
    registrantEmail: String(row.registrant_email || '')
      .trim()
      .toLowerCase(),
    registrantPhone: trimText(row.registrant_phone, 40) || null,
    status: String(row.status || 'new').trim().toLowerCase(),
    createdAt: row.created_at || null,
    readAt: row.read_at || null,
    respondedAt: row.responded_at || null,
    openDayStartsAt: day ? day.startsAt : row.open_day_starts_at || null,
    openDayAddress: day
      ? formatOpenDayAddress(day)
      : trimText(row.open_day_address, 240) || '',
    openDaySummary: day
      ? formatOpenDayWhen(day) + (formatOpenDayAddress(day) ? ' · ' + formatOpenDayAddress(day) : '')
      : trimText(row.open_day_summary, 280) || '',
  };
}

function parseOpenDayInput(raw, index) {
  const startsAt = String(raw.startsAt || raw.starts_at || raw.date || '').trim();
  const endsAt = String(raw.endsAt || raw.ends_at || '').trim() || null;
  const addressLine = trimText(raw.addressLine || raw.address_line || raw.address, 200);
  if (!startsAt) throw new Error('missing_open_day_starts_at');
  const startMs = Date.parse(startsAt);
  if (!Number.isFinite(startMs)) throw new Error('invalid_open_day_starts_at');
  if (!addressLine) throw new Error('missing_open_day_address');

  let endIso = null;
  if (endsAt) {
    const endMs = Date.parse(endsAt);
    if (!Number.isFinite(endMs)) throw new Error('invalid_open_day_ends_at');
    if (endMs < startMs) throw new Error('open_day_ends_before_start');
    endIso = new Date(endMs).toISOString();
  }

  return {
    id: isUuid(raw.id) ? String(raw.id) : null,
    starts_at: new Date(startMs).toISOString(),
    ends_at: endIso,
    venue_name: trimText(raw.venueName || raw.venue_name, 120) || null,
    address_line: addressLine,
    city: trimText(raw.city, 80) || null,
    postcode: trimText(raw.postcode || raw.postCode, 20) || null,
    notes: trimText(raw.notes, 400) || null,
    sort_order: Number.isFinite(Number(raw.sortOrder))
      ? Number(raw.sortOrder)
      : index,
  };
}

async function listOpenDaysForOpportunity(opportunityId, options) {
  const id = String(opportunityId || '').trim();
  if (!isUuid(id)) return [];
  const upcomingOnly = Boolean(options && options.upcomingOnly);
  const includeInterestCounts = Boolean(options && options.includeInterestCounts);
  const sb = getSupabaseAdmin();
  let query = sb
    .from('opportunity_open_days')
    .select('*')
    .eq('opportunity_id', id)
    .order('starts_at', { ascending: true });
  if (upcomingOnly) {
    query = query.gte('starts_at', new Date().toISOString());
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingOpenDaysTableError(error)) {
      console.warn(
        '[open-days] tables missing — apply migration 269_opportunity_open_days.sql'
      );
      return [];
    }
    throw new Error(error.message);
  }
  const rows = data || [];
  let counts = {};
  if (includeInterestCounts && rows.length) {
    const dayIds = rows.map((r) => r.id);
    const { data: interests, error: iErr } = await sb
      .from('opportunity_open_day_interests')
      .select('open_day_id')
      .in('open_day_id', dayIds);
    if (iErr) throw new Error(iErr.message);
    (interests || []).forEach((row) => {
      const key = row.open_day_id;
      counts[key] = (counts[key] || 0) + 1;
    });
  }
  return rows.map((row) =>
    openDayRowToDto(row, {
      interestCount: includeInterestCounts ? counts[row.id] || 0 : undefined,
    })
  );
}

async function listUpcomingOpenDaysForOpportunity(opportunityId) {
  return listOpenDaysForOpportunity(opportunityId, { upcomingOnly: true });
}

/** Mark browse listings that have at least one upcoming open day. */
async function attachOpenDayFlagsToListings(listings) {
  const list = Array.isArray(listings) ? listings : [];
  if (!list.length) return list;
  const ids = list.map((l) => String((l && l.id) || '').trim()).filter((id) => isUuid(id));
  if (!ids.length) {
    list.forEach((listing) => {
      if (listing && typeof listing === 'object') listing.hasOpenDay = false;
    });
    return list;
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('opportunity_open_days')
    .select('opportunity_id')
    .in('opportunity_id', ids)
    .gte('starts_at', new Date().toISOString());
  if (error) {
    if (isMissingOpenDaysTableError(error)) {
      list.forEach((listing) => {
        if (listing && typeof listing === 'object') listing.hasOpenDay = false;
      });
      return list;
    }
    throw new Error(error.message);
  }

  const withOpenDay = new Set(
    (data || []).map((row) => String(row.opportunity_id || '').trim()).filter(Boolean)
  );
  list.forEach((listing) => {
    if (!listing || typeof listing !== 'object') return;
    listing.hasOpenDay = withOpenDay.has(String(listing.id || '').trim());
  });
  return list;
}

async function getOpenDayById(openDayId) {
  const id = String(openDayId || '').trim();
  if (!isUuid(id)) return null;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('opportunity_open_days')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    if (isMissingOpenDaysTableError(error)) return null;
    throw new Error(error.message);
  }
  return openDayRowToDto(data);
}

async function replaceOpenDaysForOpportunity(opportunityId, openDaysInput, sessionContext) {
  const id = String(opportunityId || '').trim();
  if (!isUuid(id)) throw new Error('invalid_opportunity_id');

  const {
    getOpportunityById,
    opportunityOwnedBySession,
  } = require('./supabase-opportunities');
  const { isPlatformAdmin } = require('./organiser');

  const opportunity = await getOpportunityById(id);
  if (!opportunity) throw new Error('not_found');
  if (
    sessionContext &&
    !isPlatformAdmin(sessionContext) &&
    !opportunityOwnedBySession(sessionContext, opportunity)
  ) {
    throw new Error('opportunity_not_owned');
  }

  const list = Array.isArray(openDaysInput) ? openDaysInput : [];
  if (list.length > 40) throw new Error('too_many_open_days');
  const parsed = list.map((row, i) => parseOpenDayInput(row, i));

  const sb = getSupabaseAdmin();
  const { data: existing, error: loadErr } = await sb
    .from('opportunity_open_days')
    .select('id')
    .eq('opportunity_id', id);
  if (loadErr) {
    if (isMissingOpenDaysTableError(loadErr)) {
      if (!parsed.length) return [];
      const err = new Error('open_days_unavailable');
      err.code = 'open_days_unavailable';
      throw err;
    }
    throw new Error(loadErr.message);
  }

  const keepIds = new Set(parsed.map((p) => p.id).filter(Boolean));
  const toDelete = (existing || []).map((r) => r.id).filter((dayId) => !keepIds.has(dayId));
  if (toDelete.length) {
    const { error: delErr } = await sb.from('opportunity_open_days').delete().in('id', toDelete);
    if (delErr) throw new Error(delErr.message);
  }

  const now = new Date().toISOString();
  const newOpenDayIds = [];
  for (const row of parsed) {
    if (row.id) {
      const { error } = await sb
        .from('opportunity_open_days')
        .update({
          starts_at: row.starts_at,
          ends_at: row.ends_at,
          venue_name: row.venue_name,
          address_line: row.address_line,
          city: row.city,
          postcode: row.postcode,
          notes: row.notes,
          sort_order: row.sort_order,
          updated_at: now,
        })
        .eq('id', row.id)
        .eq('opportunity_id', id);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await sb.from('opportunity_open_days').insert({
        opportunity_id: id,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        venue_name: row.venue_name,
        address_line: row.address_line,
        city: row.city,
        postcode: row.postcode,
        notes: row.notes,
        sort_order: row.sort_order,
        created_at: now,
        updated_at: now,
      }).select('id');
      if (error) throw new Error(error.message);
      if (inserted && inserted[0] && inserted[0].id) newOpenDayIds.push(inserted[0].id);
    }
  }

  if (newOpenDayIds.length) {
    Promise.resolve()
      .then(function () {
        const { sendOpenDaySavedSearchMatchEmails } = require('./opportunity-saved-search-emails');
        return sendOpenDaySavedSearchMatchEmails(sb, { openDayIds: newOpenDayIds });
      })
      .catch(function (err) {
        console.warn(
          '[open-days] saved search open day notify failed:',
          err && err.message ? err.message : err
        );
      });
  }

  return listOpenDaysForOpportunity(id, { includeInterestCounts: true });
}

async function createOpenDayInterest(input) {
  const { areOpenDayRegistrationsOpen } = require('./soft-launch');
  if (!areOpenDayRegistrationsOpen()) {
    const err = new Error('open_day_registrations_closed');
    err.code = 'open_day_registrations_closed';
    throw err;
  }

  const openDayId = String(input.openDayId || input.open_day_id || '').trim();
  if (!isUuid(openDayId)) throw new Error('invalid_open_day_id');

  const name = trimText(input.name || input.registrantName, 120);
  const email = String(input.email || input.registrantEmail || '')
    .trim()
    .toLowerCase();
  const phone = trimText(input.phone || input.registrantPhone, 40) || null;
  if (!name) throw new Error('missing_name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid_email');

  const openDay = await getOpenDayById(openDayId);
  if (!openDay) throw new Error('not_found');
  if (openDay.startsAt && Date.parse(openDay.startsAt) < Date.now() - 60 * 60 * 1000) {
    throw new Error('open_day_passed');
  }

  const { getPublishedOpportunityById } = require('./supabase-opportunities');
  const opportunity = await getPublishedOpportunityById(openDay.opportunityId);
  if (!opportunity) throw new Error('not_found');

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('opportunity_open_day_interests')
    .insert({
      open_day_id: openDayId,
      opportunity_id: openDay.opportunityId,
      owner_email:
        String(opportunity.ownerEmail || opportunity.contactEmail || '')
          .toLowerCase()
          .trim() || null,
      registrant_name: name,
      registrant_email: email,
      registrant_phone: phone,
      status: 'new',
    })
    .select('*')
    .single();
  if (error) {
    if (isMissingOpenDaysTableError(error)) {
      const err = new Error('open_days_unavailable');
      err.code = 'open_days_unavailable';
      throw err;
    }
    throw new Error(error.message);
  }

  const dto = interestRowToDto(data, { openDay, opportunity });

  try {
    const { sendOpportunityOpenDayInterestEmails } = require('./opportunity-emails');
    await sendOpportunityOpenDayInterestEmails(opportunity, openDay, dto);
  } catch {
    /* email failure must not block registration */
  }

  return dto;
}

async function listOpenDayInterestsForSession(session) {
  const { listOpportunitiesForSession } = require('./supabase-opportunities');
  const opportunities = await listOpportunitiesForSession(session);
  const oppIds = opportunities.map((o) => o.id).filter(Boolean);
  if (!oppIds.length) return [];

  const oppById = {};
  opportunities.forEach((o) => {
    oppById[o.id] = o;
  });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('opportunity_open_day_interests')
    .select('*')
    .in('opportunity_id', oppIds)
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingOpenDaysTableError(error)) return [];
    throw new Error(error.message);
  }

  const dayIds = [...new Set((data || []).map((r) => r.open_day_id).filter(Boolean))];
  let daysById = {};
  if (dayIds.length) {
    const { data: days, error: dErr } = await sb
      .from('opportunity_open_days')
      .select('*')
      .in('id', dayIds);
    if (dErr) throw new Error(dErr.message);
    (days || []).forEach((row) => {
      daysById[row.id] = openDayRowToDto(row);
    });
  }

  return (data || []).map((row) =>
    interestRowToDto(row, {
      openDay: daysById[row.open_day_id] || null,
      opportunity: oppById[row.opportunity_id] || null,
    })
  );
}

async function updateOpenDayInterestStatus(interestId, session, status) {
  const id = String(interestId || '').trim();
  const next = String(status || '').trim().toLowerCase();
  if (!isUuid(id)) throw new Error('not_found');
  if (next !== 'read' && next !== 'responded') throw new Error('invalid_status');

  const sb = getSupabaseAdmin();
  const { data: existing, error: loadErr } = await sb
    .from('opportunity_open_day_interests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!existing) throw new Error('not_found');

  const { getOpportunityById, opportunityOwnedBySession } = require('./supabase-opportunities');
  const { isPlatformAdmin } = require('./organiser');
  const opportunity = await getOpportunityById(existing.opportunity_id);
  if (!opportunity) throw new Error('not_found');
  if (!isPlatformAdmin(session) && !opportunityOwnedBySession(session, opportunity)) {
    throw new Error('not_found');
  }

  const patch = { status: next };
  if (next === 'read') patch.read_at = new Date().toISOString();
  if (next === 'responded') {
    patch.responded_at = new Date().toISOString();
    if (!existing.read_at) patch.read_at = patch.responded_at;
  }

  const { data, error } = await sb
    .from('opportunity_open_day_interests')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const openDay = await getOpenDayById(data.open_day_id);
  return interestRowToDto(data, { openDay, opportunity });
}

module.exports = {
  isMissingOpenDaysTableError,
  openDayRowToDto,
  interestRowToDto,
  formatOpenDayAddress,
  formatOpenDayWhen,
  listOpenDaysForOpportunity,
  listUpcomingOpenDaysForOpportunity,
  attachOpenDayFlagsToListings,
  getOpenDayById,
  replaceOpenDaysForOpportunity,
  createOpenDayInterest,
  listOpenDayInterestsForSession,
  updateOpenDayInterestStatus,
};
