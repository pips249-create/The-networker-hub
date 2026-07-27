const { getSupabaseAdmin, isSupabaseConfigured } = require('./supabase');
const { publicOrganiserSlug } = require('./organiser-slug');
const { sendTemplatedEmail } = require('./send-template-email');

const MIN_REVIEWS_FOR_RANKING = 3;

const TIER_ORDER = { top10: 1, top25: 2, top50: 3 };

function rankingLabel(rank) {
  if (rank <= 10) return 'Top 10 networking group on the Hub';
  if (rank <= 25) return 'Top 25 networking group on the Hub';
  if (rank <= 50) return 'Top 50 networking group on the Hub';
  return null;
}

function rankingTier(rank) {
  if (rank <= 10) return 'top10';
  if (rank <= 25) return 'top25';
  if (rank <= 50) return 'top50';
  return null;
}

function publicBadgeLabel(label) {
  return String(label || '').replace(' on the Hub', '');
}

function formatBadgeWithPeriod(label, periodLabel) {
  const base = publicBadgeLabel(label);
  return periodLabel ? `${base} · ${periodLabel}` : base;
}

function formatCardBadge(label, periodLabel) {
  const tier = publicBadgeLabel(label).replace(' networking group', '');
  return periodLabel ? `${tier} · ${periodLabel}` : tier;
}

function currentPeriodKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function currentPeriodLabel(date = new Date()) {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function reviewRate(reviewCount, eligibleAttendees) {
  const reviews = Number(reviewCount) || 0;
  const eligible = Number(eligibleAttendees) || 0;
  if (eligible <= 0) return 0;
  return Math.min(1, reviews / eligible);
}

function eventHasEndedForRanking(ev, nowMs) {
  const endRaw = ev?.ends_at || ev?.starts_at || null;
  if (!endRaw) return false;
  const end = new Date(endRaw).getTime();
  return !Number.isNaN(end) && end < nowMs;
}

function isEligibleRegistrationForRanking(reg) {
  if (!reg) return false;
  const payment = String(reg.payment_status || '');
  if (payment !== 'Paid' && payment !== 'Free') return false;
  if (reg.cancelled_at) return false;
  if (reg.application_status && reg.application_status !== 'Approved') return false;
  return true;
}

/** Paid/free approved ticket quantity on past events — denominator for review rate. */
async function loadEligibleAttendeeCountsByOrganiser(sb) {
  const counts = new Map();
  const pageSize = 1000;
  let from = 0;
  const nowMs = Date.now();

  while (true) {
    const { data, error } = await sb
      .from('registrations')
      .select(
        'organiser_id, quantity, payment_status, application_status, cancelled_at, events!inner(organiser_id, starts_at, ends_at)'
      )
      .in('payment_status', ['Paid', 'Free'])
      .is('cancelled_at', null)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || !data.length) break;

    data.forEach((row) => {
      if (!isEligibleRegistrationForRanking(row)) return;
      if (!eventHasEndedForRanking(row.events, nowMs)) return;
      const oid = row.organiser_id || row.events?.organiser_id;
      if (!oid) return;
      const qty = Math.max(1, Number(row.quantity) || 1);
      counts.set(oid, (counts.get(oid) || 0) + qty);
    });

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return counts;
}

function entryToRanking(row, snapshot) {
  if (!row) return null;
  const label = row.label || rankingLabel(row.rank);
  const periodLabel = snapshot?.period_label || '';
  const reviewCount = Number(row.review_count) || 0;
  const eligibleAttendees = Number(row.eligible_attendees) || 0;
  const rate =
    row.review_rate != null && row.review_rate !== ''
      ? Number(row.review_rate)
      : reviewRate(reviewCount, eligibleAttendees);
  return {
    rank: Number(row.rank),
    totalRanked: Number(snapshot?.total_ranked) || 0,
    tier: row.tier,
    label,
    rating: Number(row.rating),
    reviewCount,
    eligibleAttendees,
    reviewRate: Number.isFinite(rate) ? rate : 0,
    periodKey: snapshot?.period_key || '',
    periodLabel,
    displayLabel: formatBadgeWithPeriod(label, periodLabel),
    shortLabel: formatBadgeWithPeriod(label, periodLabel),
    cardLabel: formatCardBadge(label, periodLabel),
  };
}

async function computeLiveRankingIndex(sb) {
  const [{ data, error }, eligibleByOrganiser] = await Promise.all([
    sb
      .from('organisers')
      .select(
        'id, average_rating, review_count, verification_status, listing_status, name, email, contact_email, slug'
      ),
    loadEligibleAttendeeCountsByOrganiser(sb),
  ]);
  if (error) throw new Error(error.message);

  const ranked = (data || [])
    .filter((row) => {
      const status = String(row.listing_status || 'draft').toLowerCase();
      if (status === 'unpublished') return false;
      const published = status === 'published';
      const verified = row.verification_status === 'Verified';
      if (!published && !verified) return false;
      const reviews = Number(row.review_count) || 0;
      const rating = Number(row.average_rating);
      return reviews >= MIN_REVIEWS_FOR_RANKING && Number.isFinite(rating) && rating > 0;
    })
    .map((row) => {
      const reviewCount = Number(row.review_count) || 0;
      const eligibleAttendees = eligibleByOrganiser.get(row.id) || 0;
      return {
        ...row,
        eligibleAttendees,
        reviewRate: reviewRate(reviewCount, eligibleAttendees),
      };
    })
    .sort((a, b) => {
      const ratingDiff = Number(b.average_rating) - Number(a.average_rating);
      if (ratingDiff !== 0) return ratingDiff;
      const rateDiff = Number(b.reviewRate) - Number(a.reviewRate);
      if (rateDiff !== 0) return rateDiff;
      return String(a.id).localeCompare(String(b.id));
    });

  const byId = new Map();
  ranked.forEach((row, index) => {
    const rank = index + 1;
    const tier = rankingTier(rank);
    const label = rankingLabel(rank);
    if (!tier || !label) return;
    byId.set(row.id, {
      organiserId: row.id,
      organiserRow: row,
      rank,
      totalRanked: ranked.length,
      tier,
      label,
      rating: Number(row.average_rating),
      reviewCount: Number(row.review_count) || 0,
      eligibleAttendees: Number(row.eligibleAttendees) || 0,
      reviewRate: Number(row.reviewRate) || 0,
    });
  });
  return byId;
}

async function getLatestSnapshot(sb) {
  const { data, error } = await sb
    .from('organiser_ranking_snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function getPreviousSnapshot(sb, excludeId) {
  let query = sb
    .from('organiser_ranking_snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function loadEntriesForSnapshot(sb, snapshotId) {
  const { data, error } = await sb
    .from('organiser_ranking_entries')
    .select('*')
    .eq('snapshot_id', snapshotId);
  if (error) throw new Error(error.message);
  const byOrganiser = new Map();
  (data || []).forEach((row) => byOrganiser.set(row.organiser_id, row));
  return byOrganiser;
}

const RANKING_ID_CHUNK = 80;

function isMissingRankingTableError(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('schema cache') ||
    msg.includes('could not find')
  );
}

async function loadCurrentRankingsByOrganiserId(organiserIds) {
  if (!isSupabaseConfigured()) return {};
  const ids = (organiserIds || []).filter(Boolean);
  if (!ids.length) return {};

  const sb = getSupabaseAdmin();
  let snapshot = null;
  try {
    snapshot = await getLatestSnapshot(sb);
  } catch (error) {
    if (!isMissingRankingTableError(error)) throw error;
    snapshot = null;
  }

  if (!snapshot) {
    try {
      const index = await computeLiveRankingIndex(sb);
      const out = {};
      ids.forEach((id) => {
        const row = index.get(id);
        if (!row) return;
        const periodLabel = currentPeriodLabel();
        out[id] = {
          rank: row.rank,
          totalRanked: row.totalRanked,
          tier: row.tier,
          label: row.label,
          rating: row.rating,
          reviewCount: row.reviewCount,
          eligibleAttendees: row.eligibleAttendees || 0,
          reviewRate: row.reviewRate || 0,
          periodKey: currentPeriodKey(),
          periodLabel,
          displayLabel: formatBadgeWithPeriod(row.label, periodLabel),
          shortLabel: formatBadgeWithPeriod(row.label, periodLabel),
          cardLabel: formatCardBadge(row.label, periodLabel),
        };
      });
      return out;
    } catch (error) {
      if (isMissingRankingTableError(error)) return {};
      throw error;
    }
  }

  const out = {};
  for (let i = 0; i < ids.length; i += RANKING_ID_CHUNK) {
    const chunk = ids.slice(i, i + RANKING_ID_CHUNK);
    const { data, error } = await sb
      .from('organiser_ranking_entries')
      .select('*')
      .eq('snapshot_id', snapshot.id)
      .in('organiser_id', chunk);
    if (error) {
      if (isMissingRankingTableError(error)) return out;
      throw new Error(error.message);
    }
    (data || []).forEach((row) => {
      out[row.organiser_id] = entryToRanking(row, snapshot);
    });
  }
  return out;
}

async function getGroupRankingsForOrganiser(groupIds) {
  const rankings = await loadCurrentRankingsByOrganiserId(groupIds);
  return rankings;
}

function organiserRecipientEmail(row) {
  return String(row?.email || row?.contact_email || '')
    .trim()
    .toLowerCase();
}

function profileUrlForOrganiser(row, siteUrl) {
  const slug = publicOrganiserSlug(row);
  if (slug) return `${siteUrl}/organisers/${encodeURIComponent(slug)}`;
  return `${siteUrl}/events/organiser?id=${encodeURIComponent(row.id)}`;
}

function shouldSendRankingEmail(prevTier, newTier) {
  if (!newTier) return false;
  if (!prevTier) return true;
  const prev = TIER_ORDER[prevTier] || 99;
  const next = TIER_ORDER[newTier] || 99;
  return next < prev;
}

async function runMonthlyOrganiserRankingSnapshot(options) {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'supabase_not_configured' };
  }

  const opts = options || {};
  const sb = getSupabaseAdmin();
  const periodKey = opts.periodKey || currentPeriodKey();
  const periodLabel = opts.periodLabel || currentPeriodLabel();
  const triggeredBy = opts.triggeredBy || 'cron';
  const sendEmails = opts.sendEmails !== false;

  const index = await computeLiveRankingIndex(sb);
  const rankedEntries = [...index.values()].sort((a, b) => a.rank - b.rank);
  const totalRanked = rankedEntries.length;

  const previousSnapshot = await getLatestSnapshot(sb);
  const previousEntries = previousSnapshot
    ? await loadEntriesForSnapshot(sb, previousSnapshot.id)
    : new Map();

  const { data: snapshot, error: snapErr } = await sb
    .from('organiser_ranking_snapshots')
    .upsert(
      {
        period_key: periodKey,
        period_label: periodLabel,
        total_ranked: totalRanked,
        triggered_by: triggeredBy,
      },
      { onConflict: 'period_key' }
    )
    .select('*')
    .single();
  if (snapErr) throw new Error(snapErr.message);

  await sb.from('organiser_ranking_entries').delete().eq('snapshot_id', snapshot.id);

  const entryRows = rankedEntries.map((row) => ({
    snapshot_id: snapshot.id,
    organiser_id: row.organiserId,
    rank: row.rank,
    tier: row.tier,
    label: row.label,
    rating: row.rating,
    review_count: row.reviewCount,
    eligible_attendees: row.eligibleAttendees || 0,
    review_rate: Number((row.reviewRate || 0).toFixed(4)),
  }));

  if (entryRows.length) {
    const { error: insErr } = await sb.from('organiser_ranking_entries').insert(entryRows);
    if (insErr) throw new Error(insErr.message);
  }

  const siteUrl = (process.env.SITE_URL || 'https://the-networker-hub.vercel.app').replace(/\/$/, '');
  const emailsSent = [];
  const emailSkipped = [];

  if (sendEmails) {
    for (const row of rankedEntries) {
      const prev = previousEntries.get(row.organiserId);
      const prevTier = prev?.tier || null;
      if (!shouldSendRankingEmail(prevTier, row.tier)) {
        emailSkipped.push({ organiserId: row.organiserId, reason: 'no_change' });
        continue;
      }

      const orgRow = row.organiserRow || {};
      const to = organiserRecipientEmail(orgRow);
      if (!to) {
        emailSkipped.push({ organiserId: row.organiserId, reason: 'no_email' });
        continue;
      }

      const profileUrl = profileUrlForOrganiser(orgRow, siteUrl);
      const badgeShort = publicBadgeLabel(row.label);
      const socialShareText = `Proud to share that ${orgRow.name || 'our group'} is a ${badgeShort} on The Networker Hub for ${periodLabel}. ⭐ ${profileUrl}`;

      try {
        await sendTemplatedEmail({
          slug: 'organiser_ranking_badge',
          to,
          variables: {
            organiser_name: String(orgRow.name || 'there').split(' ')[0] || 'there',
            group_name: orgRow.name || 'Your group',
            badge_label: badgeShort,
            period_label: periodLabel,
            rank: String(row.rank),
            total_ranked: String(totalRanked),
            average_rating: Number(row.rating).toFixed(1),
            review_count: String(row.reviewCount),
            profile_url: profileUrl,
            dashboard_url: `${siteUrl}/organiser/`,
            social_share_text: socialShareText,
          },
        });

        await sb.from('organiser_ranking_emails').insert({
          organiser_id: row.organiserId,
          snapshot_id: snapshot.id,
          email_to: to,
          tier: row.tier,
          period_label: periodLabel,
          reason: prevTier ? 'upgrade' : 'new',
        });

        emailsSent.push({ organiserId: row.organiserId, email: to, tier: row.tier });
      } catch (e) {
        emailSkipped.push({
          organiserId: row.organiserId,
          reason: e.code || e.message || 'send_failed',
        });
      }
    }
  }

  return {
    ok: true,
    snapshot,
    periodKey,
    periodLabel,
    totalRanked,
    badgeCount: entryRows.length,
    emailsSent: emailsSent.length,
    emailsSentDetail: emailsSent,
    emailsSkipped: emailSkipped.length,
    emailsSkippedDetail: emailSkipped,
  };
}

async function getRankingAdminReport(options) {
  options = options || {};
  if (!isSupabaseConfigured()) return { configured: false };
  const sb = getSupabaseAdmin();
  const snapshotId = String(options.snapshotId || '').trim();

  let snapshot = null;
  if (snapshotId) {
    const { data, error } = await sb
      .from('organiser_ranking_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    snapshot = data;
  } else {
    snapshot = await getLatestSnapshot(sb);
  }

  if (!snapshot) {
    return {
      configured: true,
      snapshot: null,
      entries: [],
      recentEmails: [],
      snapshots: [],
    };
  }

  const { data: entries, error: entErr } = await sb
    .from('organiser_ranking_entries')
    .select(
      '*, organisers(id, name, email, contact_email, listing_status, verification_status, photo_url, slug)'
    )
    .eq('snapshot_id', snapshot.id)
    .order('rank', { ascending: true })
    .limit(50);
  if (entErr) throw new Error(entErr.message);

  const { data: recentEmails, error: mailErr } = await sb
    .from('organiser_ranking_emails')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (mailErr) throw new Error(mailErr.message);

  const { data: snapshots } = await sb
    .from('organiser_ranking_snapshots')
    .select('id, period_key, period_label, total_ranked, triggered_by, created_at')
    .order('created_at', { ascending: false })
    .limit(12);

  return {
    configured: true,
    snapshot,
    entries: entries || [],
    recentEmails: recentEmails || [],
    snapshots: snapshots || [],
    minReviews: MIN_REVIEWS_FOR_RANKING,
  };
}

async function getPublicRankingLeaderboard() {
  if (!isSupabaseConfigured()) {
    return { configured: false, snapshot: null, entries: [], minReviews: MIN_REVIEWS_FOR_RANKING };
  }

  const sb = getSupabaseAdmin();
  let snapshot = null;
  try {
    snapshot = await getLatestSnapshot(sb);
  } catch (error) {
    if (!isMissingRankingTableError(error)) throw error;
    snapshot = null;
  }

  const mapPublicEntry = (row, ranking, org) => {
    const slug = publicOrganiserSlug(org || {});
    const label = ranking.label || rankingLabel(ranking.rank);
    const periodLabel = ranking.periodLabel || snapshot?.period_label || '';
    const profilePath = slug
      ? `/organisers/${encodeURIComponent(slug)}`
      : ranking.organiserId
        ? `/events/organiser?id=${encodeURIComponent(ranking.organiserId)}`
        : null;
    return {
      rank: Number(ranking.rank),
      tier: ranking.tier,
      label,
      displayLabel: formatBadgeWithPeriod(label, periodLabel),
      cardLabel: formatCardBadge(label, periodLabel),
      rating: Number(ranking.rating),
      reviewCount: Number(ranking.reviewCount) || 0,
      eligibleAttendees: Number(ranking.eligibleAttendees) || 0,
      reviewRate: Number(ranking.reviewRate) || 0,
      periodLabel,
      organiser: {
        id: ranking.organiserId || org?.id || null,
        name: org?.name || 'Networking group',
        slug: slug || null,
        photoUrl: org?.photo_url || null,
        profilePath,
      },
    };
  };

  if (!snapshot) {
    try {
      const index = await computeLiveRankingIndex(sb);
      const ranked = [...index.values()].sort((a, b) => a.rank - b.rank).slice(0, 50);
      const periodLabel = currentPeriodLabel();
      const entries = ranked.map((row) =>
        mapPublicEntry(
          null,
          {
            rank: row.rank,
            tier: row.tier,
            label: row.label,
            rating: row.rating,
            reviewCount: row.reviewCount,
            eligibleAttendees: row.eligibleAttendees,
            reviewRate: row.reviewRate,
            periodLabel,
            organiserId: row.organiserId,
          },
          row.organiserRow
        )
      );
      return {
        configured: true,
        live: true,
        snapshot: {
          period_key: currentPeriodKey(),
          period_label: periodLabel,
          total_ranked: ranked[0]?.totalRanked || ranked.length,
        },
        entries,
        minReviews: MIN_REVIEWS_FOR_RANKING,
      };
    } catch (error) {
      if (isMissingRankingTableError(error)) {
        return {
          configured: true,
          snapshot: null,
          entries: [],
          minReviews: MIN_REVIEWS_FOR_RANKING,
        };
      }
      throw error;
    }
  }

  const entrySelectWithRate =
    'rank, tier, label, rating, review_count, eligible_attendees, review_rate, organiser_id, organisers(id, name, photo_url, slug, listing_status)';
  const entrySelectBasic =
    'rank, tier, label, rating, review_count, organiser_id, organisers(id, name, photo_url, slug, listing_status)';

  let entries = null;
  let entErr = null;
  {
    const first = await sb
      .from('organiser_ranking_entries')
      .select(entrySelectWithRate)
      .eq('snapshot_id', snapshot.id)
      .order('rank', { ascending: true })
      .limit(50);
    entries = first.data;
    entErr = first.error;
    if (entErr && /eligible_attendees|review_rate|column/i.test(String(entErr.message || ''))) {
      const second = await sb
        .from('organiser_ranking_entries')
        .select(entrySelectBasic)
        .eq('snapshot_id', snapshot.id)
        .order('rank', { ascending: true })
        .limit(50);
      entries = second.data;
      entErr = second.error;
    }
  }
  if (entErr) {
    if (isMissingRankingTableError(entErr)) {
      return {
        configured: true,
        snapshot: null,
        entries: [],
        minReviews: MIN_REVIEWS_FOR_RANKING,
      };
    }
    throw new Error(entErr.message);
  }

  const publicEntries = (entries || [])
    .filter((row) => {
      const status = String(row.organisers?.listing_status || 'draft').toLowerCase();
      return status !== 'unpublished';
    })
    .map((row) =>
      mapPublicEntry(
        row,
        {
          rank: row.rank,
          tier: row.tier,
          label: row.label,
          rating: row.rating,
          reviewCount: row.review_count,
          eligibleAttendees: row.eligible_attendees,
          reviewRate:
            row.review_rate != null
              ? row.review_rate
              : reviewRate(row.review_count, row.eligible_attendees),
          periodLabel: snapshot.period_label,
          organiserId: row.organiser_id,
        },
        row.organisers
      )
    );

  return {
    configured: true,
    live: false,
    snapshot: {
      period_key: snapshot.period_key,
      period_label: snapshot.period_label,
      total_ranked: snapshot.total_ranked,
      created_at: snapshot.created_at,
    },
    entries: publicEntries,
    minReviews: MIN_REVIEWS_FOR_RANKING,
  };
}

module.exports = {
  MIN_REVIEWS_FOR_RANKING,
  currentPeriodKey,
  currentPeriodLabel,
  publicBadgeLabel,
  formatCardBadge,
  reviewRate,
  computeLiveRankingIndex,
  loadCurrentRankingsByOrganiserId,
  getGroupRankingsForOrganiser,
  runMonthlyOrganiserRankingSnapshot,
  getRankingAdminReport,
  getPublicRankingLeaderboard,
};
