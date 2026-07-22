const { getOrganiserApi } = require('../organiser-provider');
const { normalizeTicketVisibility, isMembersOnlyTicket } = require('../ticket-visibility');
const { assertOrganiserEmailVerified, isPublishIntent } = require('../organiser-access-guard');
const { validateRefundPublishPayload } = require('../event-refund-policy');
const { tiersHavePaidPrice } = require('../supabase-events');
const { getSupabaseAdmin, isSupabaseConfigured } = require('../supabase');
const { countActiveRosterMembers } = require('../organiser-member-roster');

function requestHasPaidTickets(tiers, alumniFastPass) {
  if (alumniFastPass?.enabled && Number(alumniFastPass.price) > 0) return true;
  return tiersHavePaidPrice(tiers);
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

module.exports = async function handler(req, res) {
  const api = getOrganiserApi();
  const {
    json,
    setCors,
    requireOrganiserSession,
    listGroupsForSession,
    listEventsForSession,
    listTicketsForSession,
    isPlatformAdmin,
    createTicket,
    createTicketsForEvents,
    filterOwnedEventIds,
    enableTicketSalesForEvent,
    airtableSetupHint,
  } = api;

  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireOrganiserSession(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  if (req.method === 'POST') {
    const bodyEarly = parseBody(req);
    if (isPublishIntent(bodyEarly)) {
      const verified = await assertOrganiserEmailVerified(auth.session);
      if (!verified.ok) {
        return json(res, verified.status, {
          error: verified.error,
          message: verified.message,
        });
      }
    }
  }

  async function ownedEventIds() {
    const groups = await listGroupsForSession(auth.session);
    const { organiserPersonalScopeFromRequest } = require('../auth');
    const adminView =
      isPlatformAdmin(auth.session) && !organiserPersonalScopeFromRequest(req);
    const events = await listEventsForSession(
      auth.session,
      groups.map((g) => g.id),
      [],
      adminView
    );
    return { groups, groupIds: groups.map((g) => g.id), adminView, allowed: new Set(events.map((e) => e.id)) };
  }

  if (req.method === 'GET') {
    const eventId = String(req.query?.eventId || '').trim();
    try {
      if (eventId) {
        const { groups, groupIds, adminView } = await ownedEventIds();
        const ids = await filterOwnedEventIds([eventId], groupIds, adminView);
        if (!ids.length) return json(res, 403, { error: 'event_not_owned' });
        const tickets = await listTicketsForSession(auth.session, ids);
        return json(res, 200, { ok: true, tickets });
      }
      const { allowed } = await ownedEventIds();
      const tickets = await listTicketsForSession(auth.session, [...allowed]);
      return json(res, 200, { ok: true, tickets });
    } catch (e) {
      return json(res, e.status || 500, {
        error: 'tickets_fetch_failed',
        message: e.message,
        airtable: airtableSetupHint('tickets'),
      });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const eventIds = Array.isArray(body.eventIds)
      ? body.eventIds.map((id) => String(id).trim()).filter(Boolean)
      : [];
    const tickets = Array.isArray(body.tickets) ? body.tickets : [];

    if (eventIds.length && tickets.length) {
      try {
        const groups = await listGroupsForSession(auth.session);
        const groupIds = groups.map((g) => g.id);
        const { organiserPersonalScopeFromRequest } = require('../auth');
        const adminView =
          isPlatformAdmin(auth.session) && !organiserPersonalScopeFromRequest(req);
        const ids = await filterOwnedEventIds(eventIds, groupIds, adminView);
        if (!ids.length) return json(res, 403, { error: 'event_not_owned' });
        const tiers = tickets
          .map((t, idx) => ({
            name: String(t.name || '').trim(),
            price: t.price,
            description: String(t.description || '').trim(),
            status: String(t.status || 'Available').trim(),
            quantityAvailable: t.quantityAvailable,
            saleEnd: t.saleEnd || null,
            saleEndOption: t.saleEndOption || null,
            saleEndCustom: t.saleEndCustom || null,
            saleStart: t.saleStart || null,
            categoryExclusivity: Boolean(t.categoryExclusivity),
            ticketType: t.ticketType || (t.categoryExclusivity ? 'Application-based' : 'Standard'),
            displayOrder: t.displayOrder != null ? t.displayOrder : idx,
            visibility: normalizeTicketVisibility(t.visibility),
          }))
          .filter((t) => t.name);
        if (!tiers.length) return json(res, 400, { error: 'missing_ticket_types' });

        const publish = Boolean(body.publish);
        const publicTiers = tiers.filter((t) => !isMembersOnlyTicket(t));
        const memberTiers = tiers.filter((t) => isMembersOnlyTicket(t));
        const membersOnlyEvent = memberTiers.length > 0 && publicTiers.length === 0;

        if (publish && membersOnlyEvent && isSupabaseConfigured()) {
          const sb = getSupabaseAdmin();
          const { data: eventRow, error: eventErr } = await sb
            .from('events')
            .select('organiser_id')
            .eq('id', ids[0])
            .maybeSingle();
          if (eventErr) throw new Error(eventErr.message);
          const organiserId = String(eventRow?.organiser_id || '').trim();
          if (!organiserId) {
            return json(res, 400, {
              error: 'member_list_required',
              message: 'Link this event to an organiser page before publishing a members-only event.',
            });
          }
          const activeMembers = await countActiveRosterMembers(organiserId);
          if (activeMembers < 1) {
            return json(res, 400, {
              error: 'member_list_required',
              message: 'Add at least one person to your member list before publishing a members-only event.',
            });
          }
        }

        const alumniRaw = body.alumniFastPass || body.alumni_fast_pass;
        const alumniFastPass =
          alumniRaw && typeof alumniRaw === 'object'
            ? {
                enabled: Boolean(alumniRaw.enabled),
                price: alumniRaw.price,
                quantityAvailable: alumniRaw.quantityAvailable ?? alumniRaw.quantity_available,
                saleEnd: alumniRaw.saleEnd || alumniRaw.sale_end || null,
                description: alumniRaw.description || '',
                sourceEventId: alumniRaw.sourceEventId || alumniRaw.source_event_id || null,
              }
            : null;

        const hasPaidTickets = requestHasPaidTickets(tiers, alumniFastPass);

        if (publish && hasPaidTickets) {
          const refundCheck = validateRefundPublishPayload({
            refundPolicy: body.refundPolicy,
            refundPolicyDetails: body.refundPolicyDetails || '',
            refundTermsAgreed: body.refundTermsAgreed,
          });
          if (!refundCheck.ok) {
            return json(res, 400, { error: refundCheck.code, message: refundCheck.message });
          }
        }

        const vatTreatment = String(body.vatTreatment || '').trim();
        if (vatTreatment && !['included', 'added'].includes(vatTreatment)) {
          return json(res, 400, { error: 'invalid_vat_treatment' });
        }
        if (publish && hasPaidTickets && !vatTreatment) {
          return json(res, 400, { error: 'vat_treatment_required' });
        }

        const refundPayload = hasPaidTickets
          ? {
              refundPolicy: body.refundPolicy,
              refundPolicyDetails: body.refundPolicyDetails || '',
              refundCutoffDays: body.refundCutoffDays,
              refundTermsAgreed: body.refundTermsAgreed,
              vatTreatment: vatTreatment || null,
            }
          : null;

        const result = await createTicketsForEvents({
          eventIds: ids,
          tickets: tiers,
          publish,
          vatTreatment: vatTreatment || null,
          attendanceMode: String(body.attendanceMode || body.attendance_mode || 'tickets').trim(),
          alumniFastPass,
          guestPassesDisabled: Boolean(
            body.guestPassesDisabled ?? body.guest_passes_disabled ?? false
          ),
          attendeeExtras:
            body.attendeeExtras != null && typeof body.attendeeExtras === 'object'
              ? body.attendeeExtras
              : null,
          refund: publish ? refundPayload || {} : refundPayload,
        });
        return json(res, 201, { ok: true, published: publish, ...result });
      } catch (e) {
        return json(res, e.status || 500, {
          error: e.code || 'tickets_bulk_failed',
          message: e.message,
          airtable: airtableSetupHint('tickets'),
        });
      }
    }

    const eventId = String(body.eventId || '').trim();
    const name = String(body.name || '').trim();
    const price = body.price;
    const description = String(body.description || '').trim();
    const status = String(body.status || 'Available').trim();
    const quantityAvailable = body.quantityAvailable;

    if (!eventId) return json(res, 400, { error: 'missing_event' });
    if (!name) return json(res, 400, { error: 'missing_name' });

    try {
      const allowed = await ownedEventIds();
      if (!isPlatformAdmin(auth.session) && !allowed.has(eventId)) {
        return json(res, 403, { error: 'event_not_owned' });
      }
      const ticket = await createTicket({
        eventId,
        name,
        price,
        description,
        status,
        quantityAvailable,
      });
      return json(res, 201, { ok: true, ticket });
    } catch (e) {
      return json(res, e.status || 500, {
        error: e.code || 'ticket_create_failed',
        message: e.message,
        airtable: airtableSetupHint('tickets'),
      });
    }
  }

  if (req.method === 'PATCH') {
    const body = parseBody(req);
    const action = String(body.action || '').trim().toLowerCase();
    const eventId = String(body.eventId || body.event_id || '').trim();
    if (action !== 'enable_sales') {
      return json(res, 400, { error: 'invalid_action' });
    }
    if (!eventId) return json(res, 400, { error: 'missing_event' });
    if (!enableTicketSalesForEvent) {
      return json(res, 503, { error: 'enable_sales_unavailable' });
    }
    try {
      const groups = await listGroupsForSession(auth.session);
      const groupIds = groups.map((g) => g.id);
      const event = await enableTicketSalesForEvent(auth.session, eventId, groupIds);
      return json(res, 200, {
        ok: true,
        event,
        message: 'Ticket sales are now live on your public event page.',
      });
    } catch (e) {
      return json(res, e.status || 500, {
        error: e.code || 'enable_sales_failed',
        message: e.message,
      });
    }
  }

  return json(res, 405, { error: 'method_not_allowed' });
};
