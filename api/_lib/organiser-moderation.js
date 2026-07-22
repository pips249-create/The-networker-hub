/**
 * Organiser conduct warnings and hub suspension after repeated breaches.
 */
const { getSupabaseAdmin } = require('./supabase');
const { sendTemplatedEmail } = require('./send-template-email');
const { resolveOrganiserNotificationEmail } = require('./organiser-notification-email');
const {
  enrichOrganiserHubWarningVars,
  enrichOrganiserHubSuspendedVars,
} = require('./organiser-hub-moderation-sections');

const CONDUCT_WARNING_LIMIT = 3;

const CONDUCT_REMOVAL_REASONS = new Set([
  'Breach of Hub rules',
  'Misleading listing',
  'Quality issue',
]);

const MANUAL_WARNING_REASONS = [
  'Breach of Hub rules',
  'Misleading listing',
  'Quality issue',
  'Spam or prohibited content',
  'Other',
];

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || '')
  );
}

function isConductRemovalReason(reason) {
  return CONDUCT_REMOVAL_REASONS.has(String(reason || '').trim());
}

async function countConductWarnings(sb, organiserId) {
  const { count, error } = await sb
    .from('organiser_moderation_actions')
    .select('id', { count: 'exact', head: true })
    .eq('organiser_id', organiserId)
    .eq('action_type', 'warning');
  if (error) throw new Error(error.message);
  return count || 0;
}

async function isOrganiserHubSuspended(sb, organiserId) {
  const { data, error } = await sb
    .from('organiser_moderation_actions')
    .select('action_type')
    .eq('organiser_id', organiserId)
    .in('action_type', ['suspension', 'reinstatement'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return String(data?.action_type || '') === 'suspension';
}

async function listModerationActions(sb, organiserId, limit = 10) {
  const { data, error } = await sb
    .from('organiser_moderation_actions')
    .select('id, created_at, action_type, reason, details, event_id')
    .eq('organiser_id', organiserId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 10, 1), 50));
  if (error) throw new Error(error.message);
  return data || [];
}

async function moderationSummariesForOrganisers(sb, organiserIds) {
  const ids = [...new Set((organiserIds || []).filter(Boolean))];
  const summaryById = new Map(
    ids.map((id) => [
      id,
      {
        warning_count: 0,
        warning_limit: CONDUCT_WARNING_LIMIT,
        hub_suspended: false,
        recent: [],
      },
    ])
  );
  if (!ids.length) return summaryById;

  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const { data, error } = await sb
      .from('organiser_moderation_actions')
      .select('id, organiser_id, created_at, action_type, reason, details, event_id')
      .in('organiser_id', chunk)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const grouped = new Map();
    for (const row of data || []) {
      if (!grouped.has(row.organiser_id)) grouped.set(row.organiser_id, []);
      grouped.get(row.organiser_id).push(row);
    }

    for (const organiserId of chunk) {
      const rows = grouped.get(organiserId) || [];
      const warningCount = rows.filter((r) => r.action_type === 'warning').length;
      const latestStatus = rows.find((r) =>
        ['suspension', 'reinstatement'].includes(String(r.action_type || ''))
      );
      summaryById.set(organiserId, {
        warning_count: warningCount,
        warning_limit: CONDUCT_WARNING_LIMIT,
        hub_suspended: String(latestStatus?.action_type || '') === 'suspension',
        recent: rows.slice(0, 5).map((row) => ({
          id: row.id,
          created_at: row.created_at,
          action_type: row.action_type,
          reason: row.reason,
          details: row.details || '',
          event_id: row.event_id || null,
        })),
      });
    }
  }

  return summaryById;
}

async function sendOrganiserHubWarningEmail(sb, organiserId, options = {}) {
  const contact = await resolveOrganiserNotificationEmail(sb, organiserId);
  if (!contact.email) return { skipped: true, reason: 'missing_organiser_email' };

  const warningCount = Math.max(1, Number(options.warningCount) || 1);
  const vars = enrichOrganiserHubWarningVars(
    {
      organiser_name: contact.name || 'there',
      warning_count: String(warningCount),
      warning_limit: String(CONDUCT_WARNING_LIMIT),
      warning_reason: String(options.reason || '').trim() || 'Breach of Hub rules',
      warning_details: String(options.details || '').trim(),
      will_suspend: warningCount >= CONDUCT_WARNING_LIMIT ? '1' : '',
    },
    ''
  );

  try {
    await sendTemplatedEmail({
      slug: 'organiser_hub_warning',
      to: contact.email,
      variables: vars,
    });
    return { sent: true, to: contact.email };
  } catch (e) {
    return { sent: false, error: e.message || String(e) };
  }
}

async function sendOrganiserHubSuspendedEmail(sb, organiserId, options = {}) {
  const contact = await resolveOrganiserNotificationEmail(sb, organiserId);
  if (!contact.email) return { skipped: true, reason: 'missing_organiser_email' };

  const vars = enrichOrganiserHubSuspendedVars(
    {
      organiser_name: contact.name || 'there',
      warning_count: String(options.warningCount || CONDUCT_WARNING_LIMIT),
      suspension_reason:
        String(options.reason || '').trim() ||
        'Repeated breaches of The Networker Hub organiser terms',
      suspension_details: String(options.details || '').trim(),
    },
    ''
  );

  try {
    await sendTemplatedEmail({
      slug: 'organiser_hub_suspended',
      to: contact.email,
      variables: vars,
    });
    return { sent: true, to: contact.email };
  } catch (e) {
    return { sent: false, error: e.message || String(e) };
  }
}

async function suspendOrganiserFromHub(sb, opts) {
  const organiserId = String(opts.organiserId || '').trim();
  const reason = String(opts.reason || '').trim() || 'Repeated conduct warnings';
  const details = String(opts.details || '').trim();
  const adminUserId = isUuid(opts.adminUserId) ? opts.adminUserId : null;
  const warningCount = Number(opts.warningCount) || CONDUCT_WARNING_LIMIT;

  if (!organiserId) {
    const e = new Error('Organiser id is required');
    e.status = 400;
    throw e;
  }

  const alreadySuspended = await isOrganiserHubSuspended(sb, organiserId);
  if (alreadySuspended) {
    return { suspended: true, alreadySuspended: true, warningCount };
  }

  const { error: orgErr } = await sb
    .from('organisers')
    .update({ listing_status: 'unpublished' })
    .eq('id', organiserId);
  if (orgErr) throw new Error(orgErr.message);

  const { error: evErr } = await sb
    .from('events')
    .update({ status: 'unpublished', ticket_sales_enabled: false })
    .eq('organiser_id', organiserId)
    .eq('status', 'published');
  if (evErr) throw new Error(evErr.message);

  const { data: action, error: insertErr } = await sb
    .from('organiser_moderation_actions')
    .insert({
      organiser_id: organiserId,
      action_type: 'suspension',
      reason,
      details: details || null,
      event_id: opts.eventId || null,
      event_cancellation_id: opts.eventCancellationId || null,
      created_by: adminUserId,
    })
    .select('*')
    .single();
  if (insertErr) throw new Error(insertErr.message);

  let emailResult = null;
  try {
    emailResult = await sendOrganiserHubSuspendedEmail(sb, organiserId, {
      reason,
      details,
      warningCount,
    });
  } catch (e) {
    emailResult = { sent: false, error: e.message || String(e) };
  }

  return { suspended: true, action, emailResult, warningCount };
}

function mapListingReportReasonToConductReason(reportReason) {
  const key = String(reportReason || '').trim().toLowerCase();
  if (key === 'misleading' || key === 'wrong_details') return 'Misleading listing';
  if (key === 'duplicate') return 'Quality issue';
  return 'Breach of Hub rules';
}

async function recordConductWarning(sb, opts) {
  const organiserId = String(opts.organiserId || '').trim();
  const reason = String(opts.reason || '').trim();
  const details = String(opts.details || '').trim();
  const adminUserId = isUuid(opts.adminUserId) ? opts.adminUserId : null;
  const eventId = opts.eventId || null;
  const eventCancellationId = opts.eventCancellationId || null;
  const listingReportId = opts.listingReportId || null;

  if (!organiserId) {
    const e = new Error('Organiser id is required');
    e.status = 400;
    throw e;
  }
  if (!reason) {
    const e = new Error('A warning reason is required');
    e.status = 400;
    throw e;
  }

  if (eventCancellationId) {
    const { data: existing, error: findErr } = await sb
      .from('organiser_moderation_actions')
      .select('id')
      .eq('event_cancellation_id', eventCancellationId)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (existing) {
      const warningCount = await countConductWarnings(sb, organiserId);
      return {
        skipped: true,
        reason: 'already_recorded',
        warningCount,
        hubSuspended: await isOrganiserHubSuspended(sb, organiserId),
      };
    }
  }

  if (listingReportId) {
    const { data: existingReport, error: reportFindErr } = await sb
      .from('organiser_moderation_actions')
      .select('id')
      .eq('listing_report_id', listingReportId)
      .maybeSingle();
    if (reportFindErr) throw new Error(reportFindErr.message);
    if (existingReport) {
      const warningCount = await countConductWarnings(sb, organiserId);
      return {
        skipped: true,
        reason: 'already_recorded',
        warningCount,
        hubSuspended: await isOrganiserHubSuspended(sb, organiserId),
      };
    }
  }

  const { data: action, error: insertErr } = await sb
    .from('organiser_moderation_actions')
    .insert({
      organiser_id: organiserId,
      action_type: 'warning',
      reason,
      details: details || null,
      event_id: eventId,
      event_cancellation_id: eventCancellationId,
      listing_report_id: listingReportId,
      created_by: adminUserId,
    })
    .select('*')
    .single();
  if (insertErr) throw new Error(insertErr.message);

  const warningCount = await countConductWarnings(sb, organiserId);

  let warningEmailResult = null;
  try {
    warningEmailResult = await sendOrganiserHubWarningEmail(sb, organiserId, {
      reason,
      details,
      warningCount,
    });
  } catch (e) {
    warningEmailResult = { sent: false, error: e.message || String(e) };
  }

  let suspensionResult = null;
  if (warningCount >= CONDUCT_WARNING_LIMIT) {
    suspensionResult = await suspendOrganiserFromHub(sb, {
      organiserId,
      reason: 'Repeated conduct warnings (' + warningCount + ' of ' + CONDUCT_WARNING_LIMIT + ')',
      details:
        details ||
        'Your organiser profile has received ' +
          warningCount +
          ' conduct warnings, including: ' +
          reason +
          '.',
      adminUserId,
      eventId,
      eventCancellationId,
      warningCount,
    });
  }

  return {
    action,
    warningCount,
    warningLimit: CONDUCT_WARNING_LIMIT,
    hubSuspended: Boolean(suspensionResult?.suspended),
    warningEmailResult,
    suspensionResult,
  };
}

async function issueManualConductWarning(sb, opts) {
  const reason = String(opts.reason || '').trim();
  if (!MANUAL_WARNING_REASONS.includes(reason)) {
    const e = new Error('Select a warning reason');
    e.status = 400;
    throw e;
  }
  return recordConductWarning(sb, opts);
}

async function reinstateOrganiser(sb, opts) {
  const organiserId = String(opts.organiserId || '').trim();
  const details = String(opts.details || '').trim();
  const adminUserId = isUuid(opts.adminUserId) ? opts.adminUserId : null;

  if (!organiserId) {
    const e = new Error('Organiser id is required');
    e.status = 400;
    throw e;
  }

  const { data: organiser, error: loadErr } = await sb
    .from('organisers')
    .select('id, listing_status')
    .eq('id', organiserId)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!organiser) {
    const e = new Error('Organiser not found');
    e.status = 404;
    throw e;
  }

  const { error: orgErr } = await sb
    .from('organisers')
    .update({ listing_status: 'published' })
    .eq('id', organiserId);
  if (orgErr) throw new Error(orgErr.message);

  const { data: action, error: insertErr } = await sb
    .from('organiser_moderation_actions')
    .insert({
      organiser_id: organiserId,
      action_type: 'reinstatement',
      reason: 'Reinstated by The Networker Hub',
      details: details || null,
      created_by: adminUserId,
    })
    .select('*')
    .single();
  if (insertErr) throw new Error(insertErr.message);

  return {
    reinstated: true,
    action,
    listing_status: 'published',
    warningCount: await countConductWarnings(sb, organiserId),
  };
}

async function recordConductWarningFromAdminRemoval(sb, opts) {
  const reason = String(opts.reason || '').trim();
  if (!isConductRemovalReason(reason)) {
    return { skipped: true, reason: 'not_conduct_removal' };
  }
  if (!opts.organiserId) {
    return { skipped: true, reason: 'missing_organiser' };
  }
  return recordConductWarning(sb, opts);
}

async function recordConductWarningFromListingReport(sb, opts) {
  const organiserId = String(opts.organiserId || '').trim();
  const report = opts.report || {};
  const reportId = report.id || opts.listingReportId || null;
  const reportReason = String(report.reason || opts.reportReason || '').trim();
  const conductReason = mapListingReportReasonToConductReason(reportReason);

  if (!organiserId) {
    return { skipped: true, reason: 'missing_organiser' };
  }
  if (!reportId) {
    return { skipped: true, reason: 'missing_report' };
  }

  const listingTitle = String(report.listing_title || 'Listing').trim() || 'Listing';
  const details =
    'Uphold listing report: ' +
    listingTitle +
    ' (' +
    String(report.listing_type || 'listing') +
    ', ' +
    reportReason +
    ').';

  return recordConductWarning(sb, {
    organiserId,
    reason: conductReason,
    details,
    eventId: opts.eventId || report.event_id || null,
    listingReportId: reportId,
    adminUserId: opts.adminUserId || null,
  });
}

module.exports = {
  CONDUCT_WARNING_LIMIT,
  CONDUCT_REMOVAL_REASONS: [...CONDUCT_REMOVAL_REASONS],
  MANUAL_WARNING_REASONS,
  isConductRemovalReason,
  countConductWarnings,
  isOrganiserHubSuspended,
  listModerationActions,
  moderationSummariesForOrganisers,
  recordConductWarning,
  recordConductWarningFromAdminRemoval,
  recordConductWarningFromListingReport,
  mapListingReportReasonToConductReason,
  issueManualConductWarning,
  suspendOrganiserFromHub,
  reinstateOrganiser,
};
