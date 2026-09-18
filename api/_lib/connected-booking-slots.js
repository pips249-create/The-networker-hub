const { groupLimitForPlan } = require('./connected-booking-util');

function isConnectedPlanActive(account) {
  if (!account) return false;
  return String(account.connected_booking_status || '').trim() === 'active';
}

function isMissingSlotColumnError(err) {
  const msg = [err?.message, err?.details, err?.code].filter(Boolean).join(' ');
  return /connected_booking_slot_assigned_at|does not exist|PGRST204|schema cache/i.test(msg);
}

async function listAccountOrganisersForSlots(sb, accountId) {
  const account = String(accountId || '').trim();
  if (!account) return { organisers: [], schemaMissing: false };

  const { data, error } = await sb
    .from('organisers')
    .select('id, name, listing_status, connected_booking_slot_assigned_at')
    .eq('organiser_account_id', account)
    .order('name', { ascending: true });

  if (error) {
    if (isMissingSlotColumnError(error)) {
      const { data: fallback, error: fbErr } = await sb
        .from('organisers')
        .select('id, name, listing_status')
        .eq('organiser_account_id', account)
        .order('name', { ascending: true });
      if (fbErr) throw new Error(fbErr.message);
      return {
        organisers: (fallback || []).map((row) => ({
          id: row.id,
          name: row.name || 'Organiser page',
          listingStatus: row.listing_status || null,
          slotAssigned: false,
        })),
        schemaMissing: true,
      };
    }
    throw new Error(error.message);
  }

  return {
    organisers: (data || []).map((row) => ({
      id: row.id,
      name: row.name || 'Organiser page',
      listingStatus: row.listing_status || null,
      slotAssigned: Boolean(row.connected_booking_slot_assigned_at),
    })),
    schemaMissing: false,
  };
}

async function listAssignedSlotOrganiserIds(sb, accountId) {
  const { organisers, schemaMissing } = await listAccountOrganisersForSlots(sb, accountId);
  if (schemaMissing) return [];
  return organisers.filter((o) => o.slotAssigned).map((o) => o.id);
}

async function assignConnectedBookingSlots(sb, account, organiserIds) {
  if (!account?.id || !isConnectedPlanActive(account)) {
    const e = new Error('Connected booking is not active.');
    e.status = 403;
    e.code = 'connected_booking_inactive';
    throw e;
  }

  const accountId = String(account.id).trim();
  const limit = groupLimitForPlan(account.connected_booking_plan);
  const maxSlots = limit == null ? 999 : limit;

  const rawIds = Array.isArray(organiserIds) ? organiserIds : [];
  const ids = [...new Set(rawIds.map((id) => String(id || '').trim()).filter(Boolean))];

  if (ids.length > maxSlots) {
    const e = new Error(
      `Your plan allows ${maxSlots} organiser page${maxSlots === 1 ? '' : 's'} on Connected booking. Remove ${
        ids.length - maxSlots
      } selection(s).`
    );
    e.status = 400;
    e.code = 'connected_booking_slot_limit';
    throw e;
  }

  const { data: owned, error: ownErr } = await sb
    .from('organisers')
    .select('id')
    .eq('organiser_account_id', accountId);
  if (ownErr) throw new Error(ownErr.message);
  const ownedSet = new Set((owned || []).map((r) => r.id));
  for (const id of ids) {
    if (!ownedSet.has(id)) {
      const e = new Error('One or more organiser pages are not on your account.');
      e.status = 403;
      e.code = 'organiser_not_on_account';
      throw e;
    }
  }

  const now = new Date().toISOString();

  const { error: clearErr } = await sb
    .from('organisers')
    .update({ connected_booking_slot_assigned_at: null })
    .eq('organiser_account_id', accountId);
  if (clearErr) {
    if (isMissingSlotColumnError(clearErr)) {
      const e = new Error('Run Supabase migration 297_connected_booking_organiser_slots.sql.');
      e.status = 503;
      e.code = 'connected_booking_schema_missing';
      throw e;
    }
    throw new Error(clearErr.message);
  }

  if (ids.length) {
    const { error: setErr } = await sb
      .from('organisers')
      .update({ connected_booking_slot_assigned_at: now })
      .eq('organiser_account_id', accountId)
      .in('id', ids);
    if (setErr) {
      if (isMissingSlotColumnError(setErr)) {
        const e = new Error('Run Supabase migration 297_connected_booking_organiser_slots.sql.');
        e.status = 503;
        e.code = 'connected_booking_schema_missing';
        throw e;
      }
      throw new Error(setErr.message);
    }
  }

  return { assignedOrganiserIds: ids, assignedAt: now };
}

async function isOrganiserOnConnectedSlot(sb, organiserId) {
  const orgId = String(organiserId || '').trim();
  if (!orgId) return false;

  const { data, error } = await sb
    .from('organisers')
    .select('connected_booking_slot_assigned_at')
    .eq('id', orgId)
    .maybeSingle();

  if (error) {
    if (isMissingSlotColumnError(error)) return false;
    throw new Error(error.message);
  }
  return Boolean(data?.connected_booking_slot_assigned_at);
}

async function assertOrganiserConnectedSlot(sb, organiserId, account) {
  if (!isConnectedPlanActive(account)) {
    const e = new Error('Connected booking is not active on your account.');
    e.status = 403;
    e.code = 'connected_booking_inactive';
    throw e;
  }

  const onSlot = await isOrganiserOnConnectedSlot(sb, organiserId);
  if (onSlot) return;

  const limit = groupLimitForPlan(account.connected_booking_plan);
  if (limit == null) return;

  const e = new Error(
    'This organiser page is not assigned to your Connected plan. On Organiser pages in your workspace, tick the page(s) and click Save assignment.'
  );
  e.status = 403;
  e.code = 'connected_booking_slot_not_assigned';
  throw e;
}

/** Auto-assign when exactly one organiser page and plan allows one slot. */
async function maybeAutoAssignSingleStarterSlot(sb, account) {
  if (!account?.id || !isConnectedPlanActive(account)) return null;
  const limit = groupLimitForPlan(account.connected_booking_plan);
  if (limit !== 1) return null;

  const assigned = await listAssignedSlotOrganiserIds(sb, account.id);
  if (assigned.length) return { assignedOrganiserIds: assigned, auto: false };

  const { organisers, schemaMissing } = await listAccountOrganisersForSlots(sb, account.id);
  if (schemaMissing || organisers.length !== 1) return null;

  return assignConnectedBookingSlots(sb, account, [organisers[0].id]).then((r) =>
    Object.assign({ auto: true }, r)
  );
}

function connectedBookingSlotsMeta(account, slotOrganisers) {
  const organisers = slotOrganisers?.organisers || [];
  const schemaMissing = Boolean(slotOrganisers?.schemaMissing);
  const assignedOrganiserIds = organisers.filter((o) => o.slotAssigned).map((o) => o.id);
  const limit = groupLimitForPlan(account?.connected_booking_plan);
  const needsAssignment =
    isConnectedPlanActive(account) &&
    limit != null &&
    assignedOrganiserIds.length === 0 &&
    organisers.length > 0 &&
    !schemaMissing;

  return {
    assignedOrganiserIds,
    accountOrganisers: organisers,
    schemaMissing,
    needsAssignment,
  };
}

module.exports = {
  listAccountOrganisersForSlots,
  listAssignedSlotOrganiserIds,
  assignConnectedBookingSlots,
  isOrganiserOnConnectedSlot,
  assertOrganiserConnectedSlot,
  maybeAutoAssignSingleStarterSlot,
  connectedBookingSlotsMeta,
};
