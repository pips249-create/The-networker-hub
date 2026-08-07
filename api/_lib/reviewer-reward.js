/**
 * Quiet networker recognition for reviewing after events.
 * Milestone: Top contributor at 5+ event reviews (one review per event).
 */

const TOP_CONTRIBUTOR_MIN = 5;

const REVIEWER_TIERS = [
  {
    min: TOP_CONTRIBUTOR_MIN,
    id: 'top_contributor',
    label: 'Top contributor',
    shortLabel: 'Top contributor',
  },
];

function tierForCount(count) {
  const n = Math.max(0, Number(count) || 0);
  let current = null;
  for (let i = 0; i < REVIEWER_TIERS.length; i++) {
    if (n >= REVIEWER_TIERS[i].min) current = REVIEWER_TIERS[i];
  }
  return current;
}

function nextTierForCount(count) {
  const n = Math.max(0, Number(count) || 0);
  for (let i = 0; i < REVIEWER_TIERS.length; i++) {
    if (n < REVIEWER_TIERS[i].min) {
      return {
        ...REVIEWER_TIERS[i],
        remaining: REVIEWER_TIERS[i].min - n,
      };
    }
  }
  return null;
}

/**
 * @param {number} count total event reviews submitted by this networker
 * @param {{ previousCount?: number }} [options]
 */
function buildReviewerReward(count, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const n = Math.max(0, Number(count) || 0);
  const previous = Math.max(0, Number(opts.previousCount != null ? opts.previousCount : n - 1) || 0);
  const tier = tierForCount(n);
  const nextTier = nextTierForCount(n);
  const previousTier = tierForCount(previous);
  const justUnlocked = Boolean(n > 0 && tier && (!previousTier || previousTier.id !== tier.id));

  return {
    count: n,
    tier: tier
      ? { id: tier.id, label: tier.label, shortLabel: tier.shortLabel, min: tier.min }
      : null,
    nextTier: nextTier
      ? {
          id: nextTier.id,
          label: nextTier.label,
          shortLabel: nextTier.shortLabel,
          min: nextTier.min,
          remaining: nextTier.remaining,
        }
      : null,
    justUnlocked,
  };
}

function reviewerRewardToastMessage(reward) {
  const r = reward && typeof reward === 'object' ? reward : null;
  if (!r || !r.count) {
    return 'Thanks — your review helps this group on the Hub.';
  }
  if (r.justUnlocked && r.tier) {
    return (
      'Thanks — you\'re a Top contributor (' +
      r.count +
      ' event reviews). Keep leaving one after each event.'
    );
  }
  if (r.nextTier && r.nextTier.remaining) {
    const need = r.nextTier.remaining;
    return (
      'Thanks — ' +
      r.count +
      ' event review' +
      (r.count === 1 ? '' : 's') +
      '. ' +
      need +
      ' more to become a Top contributor.'
    );
  }
  return (
    'Thanks — ' +
    r.count +
    ' event reviews. You\'re a Top contributor.'
  );
}

function reviewerRewardStatMeta(reward, pendingCount) {
  const pending = Math.max(0, Number(pendingCount) || 0);
  const r = reward && typeof reward === 'object' ? reward : null;
  const parts = [];
  if (pending) {
    parts.push('⭐ ' + pending + ' pending');
    return parts.join(' · ');
  }
  if (r && r.tier && r.tier.shortLabel) {
    parts.push(r.tier.shortLabel);
  } else if (r && r.nextTier && r.nextTier.remaining) {
    parts.push(r.nextTier.remaining + ' to Top contributor');
  } else if (r && r.count) {
    parts.push(r.count + ' submitted');
  } else {
    parts.push('Review after each event');
  }
  return parts.length ? parts.join(' · ') : '—';
}

module.exports = {
  TOP_CONTRIBUTOR_MIN,
  REVIEWER_TIERS,
  buildReviewerReward,
  reviewerRewardToastMessage,
  reviewerRewardStatMeta,
  tierForCount,
  nextTierForCount,
};
