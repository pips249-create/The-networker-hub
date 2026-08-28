/**
 * Strip revenue, registrations, and attendee data from workspace payloads for marketing role.
 */
function stripEventSalesFields(ev) {
  if (!ev || typeof ev !== 'object') return ev;
  const next = { ...ev };
  delete next.revenueNum;
  delete next.revenueDisplay;
  delete next.ticketsSold;
  delete next.ticketsSoldDisplay;
  delete next.canRequestPayout;
  delete next.payoutStatus;
  delete next.grossRevenue;
  delete next.netRevenue;
  return next;
}

function stripGroupSalesFields(group) {
  if (!group || typeof group !== 'object') return group;
  const next = { ...group };
  delete next.revenueNum;
  delete next.revenueDisplay;
  delete next.ticketsSold;
  delete next.ticketsSoldDisplay;
  delete next.memberCount;
  delete next.rosterCount;
  return next;
}

function stripTicketSalesFields(ticket) {
  if (!ticket || typeof ticket !== 'object') return ticket;
  const next = { ...ticket };
  delete next.sold;
  delete next.soldCount;
  delete next.revenueNum;
  delete next.revenueDisplay;
  return next;
}

function sanitizeWorkspaceForMarketing(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const next = { ...payload };

  if (Array.isArray(next.groups)) {
    next.groups = next.groups.map(stripGroupSalesFields);
  }
  if (Array.isArray(next.events)) {
    next.events = next.events.map(stripEventSalesFields);
  }
  if (Array.isArray(next.upcomingEvents)) {
    next.upcomingEvents = next.upcomingEvents.map(stripEventSalesFields);
  }
  if (Array.isArray(next.eventSummaries)) {
    next.eventSummaries = next.eventSummaries.map(stripEventSalesFields);
  }
  if (Array.isArray(next.tickets)) {
    next.tickets = next.tickets.map(stripTicketSalesFields);
  }

  next.workspaceSummary = null;
  next.pendingApplications = { count: 0, preview: [] };
  next.tickets = [];

  if (next.stats && typeof next.stats === 'object') {
    next.stats = {
      ...next.stats,
      ticketsSold: null,
      revenue: null,
    };
  }

  next.canManageTeam = false;
  next.canDeleteEvents = false;
  next.canManagePayments = false;
  next.canCreateGroups = false;
  next.canManageEvents = false;
  next.canViewRevenue = false;
  next.canViewRegistrations = false;
  next.canAccessPromote = true;
  next.canAccessCommunicate = false;
  next.isMarketing = true;

  return next;
}

function isMarketingAccess(access) {
  return Boolean(access && (access.isMarketing || access.role === 'marketing'));
}

module.exports = {
  sanitizeWorkspaceForMarketing,
  stripEventSalesFields,
  stripGroupSalesFields,
  isMarketingAccess,
};
