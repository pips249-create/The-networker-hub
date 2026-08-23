/**
 * Side effects when Command Centre upholds a listing report (unpublish listing).
 */
const { sendOrganiserEventUnpublishedEmail } = require('./admin-event-unpublish-emails');
const { sendOrganiserListingUnpublishedEmail } = require('./admin-organiser-unpublish-emails');
const { sendOpportunityRejectedEmail } = require('./lifecycle-emails');
const { sendListingReportUpholdReporterEmail } = require('./listing-report-reporter-email');
const { recordConductWarningFromListingReport } = require('./organiser-moderation');

const REPORT_REASON_LABELS = {
  misleading: 'Misleading or inaccurate',
  spam: 'Spam or scam',
  wrong_details: 'Wrong date, location, or price',
  offensive: 'Offensive or inappropriate',
  duplicate: 'Duplicate listing',
  other: 'Other',
};

function mapReportReasonToRemovalReason(reason) {
  const key = String(reason || '').trim().toLowerCase();
  return REPORT_REASON_LABELS[key] || 'Community report upheld';
}

function buildRemovalDetails() {
  return (
    'We reviewed a community report about this listing and upheld it. ' +
    'Update the listing to meet our standards, then contact hello@thenetworkeruk.com if you need help republishing.'
  );
}

function buildOpportunityRejectionNote(reason) {
  return (
    'Following a community report, we reviewed this listing and found it did not meet our standards (' +
    mapReportReasonToRemovalReason(reason) +
    '). You can edit your listing and resubmit when you are ready.'
  );
}

async function resolveOrganiserId(sb, report, listingRow) {
  if (report.organiser_id) return report.organiser_id;
  if (report.listing_type === 'event') {
    if (listingRow?.organiser_id) return listingRow.organiser_id;
    if (!report.event_id) return null;
    const { data, error } = await sb
      .from('events')
      .select('organiser_id')
      .eq('id', report.event_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.organiser_id || null;
  }
  return null;
}

async function notifyListingReportUphold(sb, report, listingRow, adminUserId) {
  const removalReason = mapReportReasonToRemovalReason(report.reason);
  const removalDetails = buildRemovalDetails();
  const results = {
    posterEmail: null,
    reporterEmail: null,
    moderation: null,
  };

  if (report.listing_type === 'event' && listingRow) {
    results.posterEmail = await sendOrganiserEventUnpublishedEmail(sb, {
      eventId: report.event_id,
      eventRow: listingRow,
      reason: removalReason,
      details: removalDetails,
    });
  } else if (report.listing_type === 'organiser' && listingRow) {
    results.posterEmail = await sendOrganiserListingUnpublishedEmail(sb, {
      organiserId: report.organiser_id,
      organiserRow: listingRow,
      reason: removalReason,
      details: removalDetails,
    });
  } else if (report.listing_type === 'opportunity' && listingRow) {
    results.posterEmail = await sendOpportunityRejectedEmail(
      listingRow,
      buildOpportunityRejectionNote(report.reason)
    );
  }

  const organiserId = await resolveOrganiserId(sb, report, listingRow);
  if (organiserId) {
    try {
      results.moderation = await recordConductWarningFromListingReport(sb, {
        organiserId,
        report,
        adminUserId,
        eventId: report.event_id || null,
      });
    } catch (e) {
      results.moderation = { error: e.message || String(e) };
    }
  }

  if (report.reporter_email) {
    try {
      results.reporterEmail = await sendListingReportUpholdReporterEmail({
        to: report.reporter_email,
        listingTitle: report.listing_title,
      });
    } catch (e) {
      results.reporterEmail = { sent: false, error: e.message || String(e) };
    }
  }

  return results;
}

module.exports = {
  REPORT_REASON_LABELS,
  mapReportReasonToRemovalReason,
  buildRemovalDetails,
  notifyListingReportUphold,
};
