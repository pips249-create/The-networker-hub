#!/usr/bin/env node
/**
 * Pause £0 “First Meeting”-style tickets next to a paid ticket, and turn on
 * complimentary visits instead.
 *
 * Usage:
 *   node scripts/convert-first-visit-tickets.js
 *   node scripts/convert-first-visit-tickets.js --execute
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
if (fs.existsSync(path.join(root, 'local.env'))) dotenv.config({ path: path.join(root, 'local.env') });
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

const { getSupabaseAdmin, isSupabaseConfigured } = require('../api/_lib/supabase');
const {
  publicFreeTicketIsFirstVisitStandIn,
  looksLikeComplimentaryVisitTicketName,
  isGuestVisitTicket,
  isPublicSaleTicket,
  guestVisitTierPayload,
  GUEST_VISIT_TIER_NAME,
} = require('../api/_lib/guest-visits');

const CHUNK = 200;
const execute = process.argv.includes('--execute');

function ticketPriceAmount(ticket) {
  const n = Number(ticket && ticket.price);
  return Number.isFinite(n) ? n : 0;
}

function rewriteListingCopy(text) {
  const original = String(text || '');
  if (!original.trim()) return { text: original, changed: false };
  let next = original;
  const pairs = [
    [/first meetings? are free/gi, 'first visits are complimentary'],
    [/the first meeting is free/gi, 'the first visit is complimentary'],
    [/your first meeting'?s free/gi, 'your first visit is complimentary'],
    [/first meeting'?s free/gi, 'first visit complimentary'],
    [/first meeting is free/gi, 'first visit is complimentary'],
    [/first meeting free/gi, 'first visit complimentary'],
    [/first visits? are free/gi, 'first visits are complimentary'],
    [/the first visit is free/gi, 'the first visit is complimentary'],
    [/your first visit is free/gi, 'your first visit is complimentary'],
    [/first visit is free/gi, 'first visit is complimentary'],
  ];
  pairs.forEach(([from, to]) => {
    next = next.replace(from, to);
  });
  return { text: next, changed: next !== original };
}

async function fetchAll(sb, table, columns, apply) {
  const rows = [];
  let from = 0;
  for (;;) {
    let q = sb.from(table).select(columns).range(from, from + CHUNK - 1);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error) throw new Error(table + ': ' + error.message);
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < CHUNK) break;
    from += CHUNK;
  }
  return rows;
}

function summariseEvent(ev, tickets, org) {
  const publicTiers = tickets.filter(isPublicSaleTicket);
  const standIns = publicTiers.filter(
    (t) =>
      String(t.status || 'Active').trim() === 'Active' &&
      ticketPriceAmount(t) <= 0 &&
      looksLikeComplimentaryVisitTicketName(t.name)
  );
  const paid = publicTiers.filter((t) => ticketPriceAmount(t) > 0);
  const guest = tickets.filter(isGuestVisitTicket);
  return {
    eventId: ev.id,
    title: ev.title,
    startsAt: ev.starts_at,
    status: ev.status,
    attendanceMode: ev.attendance_mode,
    locked: Boolean(ev.locked),
    guestPassesDisabled: Boolean(ev.guest_passes_disabled),
    seriesGroupId: ev.series_group_id || null,
    slug: ev.slug,
    organiserId: org && org.id,
    organiserName: org && org.name,
    complimentaryVisitsAllowed: org ? Number(org.complimentary_visits_allowed) || 0 : 0,
    standInTickets: standIns.map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price,
      status: t.status,
      seriesScope: t.series_scope,
    })),
    paidTickets: paid.map((t) => t.name + ' £' + t.price),
    hasGuestVisitTicket: guest.some((t) => String(t.status || 'Active') === 'Active'),
    descriptionChanged: rewriteListingCopy(ev.description).changed,
  };
}

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const events = await fetchAll(
    sb,
    'events',
    'id, title, slug, organiser_id, starts_at, status, attendance_mode, description, guest_passes_disabled, locked, series_group_id',
    (q) => q.in('status', ['published', 'draft']).gte('starts_at', nowIso)
  );
  const eventById = new Map(events.map((e) => [e.id, e]));
  const eventIds = events.map((e) => e.id);
  if (!eventIds.length) {
    console.log('No upcoming draft/published events.');
    return;
  }

  const tickets = [];
  for (let i = 0; i < eventIds.length; i += CHUNK) {
    const chunk = eventIds.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from('tickets')
      .select(
        'id, event_id, name, price, status, ticket_type, visibility, series_scope, description, display_order, quantity, sale_starts_at, sale_ends_at'
      )
      .in('event_id', chunk);
    if (error) throw new Error(error.message);
    tickets.push(...(data || []));
  }

  const ticketsByEvent = new Map();
  tickets.forEach((t) => {
    const list = ticketsByEvent.get(t.event_id) || [];
    list.push(t);
    ticketsByEvent.set(t.event_id, list);
  });

  const matchEventIds = events
    .filter((ev) => {
      const list = ticketsByEvent.get(ev.id) || [];
      const active = list.filter((t) => String(t.status || 'Active').trim() === 'Active');
      return publicFreeTicketIsFirstVisitStandIn(active);
    })
    .map((ev) => ev.id);

  const orgIds = [
    ...new Set(matchEventIds.map((id) => eventById.get(id)?.organiser_id).filter(Boolean)),
  ];
  const orgs = [];
  for (let i = 0; i < orgIds.length; i += CHUNK) {
    const { data, error } = await sb
      .from('organisers')
      .select('id, name, complimentary_visits_allowed')
      .in('id', orgIds.slice(i, i + CHUNK));
    if (error) throw new Error(error.message);
    orgs.push(...(data || []));
  }
  const orgById = new Map(orgs.map((o) => [o.id, o]));

  const matches = matchEventIds.map((id) => {
    const ev = eventById.get(id);
    return summariseEvent(ev, ticketsByEvent.get(id) || [], orgById.get(ev.organiser_id));
  });

  console.log(
    (execute ? 'APPLY' : 'DRY RUN') + ': ' + matches.length + ' upcoming listing(s) with a first-visit free ticket next to a paid ticket'
  );
  matches.forEach((row) => {
    console.log(
      [
        row.startsAt,
        row.status,
        row.organiserName,
        row.title,
        'stand-in: ' + row.standInTickets.map((t) => t.name + ' [' + t.status + ']').join(', '),
        'paid: ' + row.paidTickets.join(', '),
        'mode=' + row.attendanceMode,
        'visits=' + row.complimentaryVisitsAllowed,
        row.hasGuestVisitTicket ? 'guest-ticket=yes' : 'guest-ticket=no',
        row.descriptionChanged ? 'copy=needs rewrite' : '',
      ]
        .filter(Boolean)
        .join(' | ')
    );
  });

  if (!execute || !matches.length) return;

  const orgPatchIds = [...new Set(matches.map((m) => m.organiserId).filter(Boolean))];
  for (const orgId of orgPatchIds) {
    const org = orgById.get(orgId);
    const allowed = Number(org && org.complimentary_visits_allowed) || 0;
    if (allowed >= 1) continue;
    const { error } = await sb.from('organisers').update({ complimentary_visits_allowed: 1 }).eq('id', orgId);
    if (error) throw new Error('organiser visits: ' + error.message);
    console.log('Set complimentary_visits_allowed=1 for', org && org.name);
  }

  const standInIds = [...new Set(matches.flatMap((m) => m.standInTickets.map((t) => t.id)))];
  for (let i = 0; i < standInIds.length; i += CHUNK) {
    const { error } = await sb
      .from('tickets')
      .update({ status: 'Paused' })
      .in('id', standInIds.slice(i, i + CHUNK));
    if (error) throw new Error('pause tickets: ' + error.message);
  }
  console.log('Paused', standInIds.length, 'first-visit ticket row(s)');

  const guestPayload = guestVisitTierPayload();
  const insertRows = [];
  const eventPatchIds = [];
  for (const row of matches) {
    const ev = eventById.get(row.eventId);
    const mode = String(ev.attendance_mode || 'tickets').trim();
    if (mode !== 'category_exclusivity' && mode !== 'membership_meeting' && mode !== 'guest_programme') {
      eventPatchIds.push(ev.id);
    }
    if (!row.hasGuestVisitTicket) {
      insertRows.push({
        event_id: ev.id,
        name: guestPayload.name || GUEST_VISIT_TIER_NAME,
        description: guestPayload.description,
        price: 0,
        quantity: null,
        status: 'Active',
        ticket_type: guestPayload.ticketType,
        display_order: -1,
        visibility: 'public',
        series_scope: 'date',
      });
    }
    const copy = rewriteListingCopy(ev.description);
    if (copy.changed) {
      const { error } = await sb.from('events').update({ description: copy.text }).eq('id', ev.id);
      if (error) throw new Error('description: ' + error.message);
    }
  }

  for (let i = 0; i < eventPatchIds.length; i += CHUNK) {
    const { error } = await sb
      .from('events')
      .update({ attendance_mode: 'guest_programme', guest_passes_disabled: false })
      .in('id', eventPatchIds.slice(i, i + CHUNK));
    if (error) throw new Error('event mode: ' + error.message);
  }
  console.log('Set guest_programme on', eventPatchIds.length, 'event(s)');

  if (insertRows.length) {
    const { error } = await sb.from('tickets').insert(insertRows);
    if (error) throw new Error('guest tickets: ' + error.message);
    console.log('Added Guest visit ticket on', insertRows.length, 'event(s)');
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
