/**
 * Lightweight networker recognition for leaving a review after each event.
 * One review per event already; this celebrates cumulative reviews (not unique groups).
 */

const REVIEWER_TIERS = [
  { min: 1, id: 'reviewer', label: 'Reviewer', shortLabel: 'Reviewer' },
  { min: 5, id: 'trusted', label: 'Trusted Reviewer', shortLabel: 'Trusted' },
  { min: 10, id: 'super', label: 'Super Reviewer', shortLabel: 'Super' },
  { min: 25, id: 'champion', label: 'Champion Reviewer', shortLabel: 'Champion' },
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
  const justUnlocked = Boolean(
    n > 0 && tier && (!previousTier || previousTier.id !== tier.id)
  );

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
    if (r.count === 1) {
      return 'First review in — you\'re a Reviewer. Leave one after each event you attend.';
    }
    return (
      'Badge unlocked: ' +
      r.tier.label +
      ' (' +
      r.count +
      ' event reviews). Keep reviewing after each event.'
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
      ' more to unlock ' +
      r.nextTier.label +
      '.'
    );
  }
  return (
    'Thanks — ' +
    r.count +
    ' event reviews. You\'re a ' +
    (r.tier && r.tier.label ? r.tier.label : 'Champion Reviewer') +
    '.'
  );
}

function reviewerRewardStatMeta(reward, pendingCount) {
  const pending = Math.max(0, Number(pendingCount) || 0);
  const r = reward && typeof reward === 'object' ? reward : null;
  const parts = [];
  if (r && r.tier && r.tier.shortLabel) {
    parts.push(r.tier.shortLabel);
  } else if (pending) {
    parts.push('Review after each event');
  }
  if (pending) {
    parts.push('⭐ ' + pending + ' pending');
  } else if (r && r.nextTier && r.nextTier.remaining) {
    parts.push(r.nextTier.remaining + ' to ' + r.nextTier.shortLabel);
  } else if (r && r.count && !pending) {
    parts.push('Every event counts');
  }
  return parts.length ? parts.join(' · ') : '—';
}

module.exports = {
  REVIEWER_TIERS,
  buildReviewerReward,
  reviewerRewardToastMessage,
  reviewerRewardStatMeta,
  tierForCount,
  nextTierForCount,
};
