const ORGANISER_CONFIRMED_WEIGHT = 0.5;
const MAX_ORGANISER_CONFIRMED_SHARE = 0.5;

function provenanceWeight(provenance) {
  return String(provenance || 'verified') === 'organiser_confirmed'
    ? ORGANISER_CONFIRMED_WEIGHT
    : 1;
}

function computeWeightedReviewStats(reviews) {
  const rows = Array.isArray(reviews) ? reviews : [];
  let verifiedUnits = 0;
  let confirmedUnits = 0;

  rows.forEach((row) => {
    const rating = Number(row.rating);
    if (!Number.isFinite(rating) || rating <= 0) return;
    const w = provenanceWeight(row.provenance);
    if (w < 1) confirmedUnits += w;
    else verifiedUnits += w;
  });

  // Cap organiser-confirmed share at ≤50% when verified reviews exist (confirmed ≤ verified).
  // If only organiser-confirmed reviews, keep full half-weight — ticket floor still gates badges.
  let cappedConfirmed = confirmedUnits;
  if (verifiedUnits > 0) {
    const shareCap = (verifiedUnits + confirmedUnits) * MAX_ORGANISER_CONFIRMED_SHARE;
    cappedConfirmed = Math.min(confirmedUnits, shareCap, verifiedUnits);
  }

  const scale =
    confirmedUnits > 0 && cappedConfirmed < confirmedUnits
      ? cappedConfirmed / confirmedUnits
      : 1;

  let cappedSum = 0;
  let cappedCount = 0;
  rows.forEach((row) => {
    const rating = Number(row.rating);
    if (!Number.isFinite(rating) || rating <= 0) return;
    let w = provenanceWeight(row.provenance);
    if (w < 1) w *= scale;
    cappedSum += rating * w;
    cappedCount += w;
  });

  return {
    weightedReviewCount: Number(cappedCount.toFixed(4)),
    weightedAverageRating: cappedCount > 0 ? Number((cappedSum / cappedCount).toFixed(4)) : 0,
    rawReviewCount: rows.filter((r) => Number(r.rating) > 0).length,
    verifiedUnits: Number(verifiedUnits.toFixed(4)),
    confirmedUnits: Number(confirmedUnits.toFixed(4)),
    cappedConfirmedUnits: Number(cappedConfirmed.toFixed(4)),
  };
}

module.exports = {
  ORGANISER_CONFIRMED_WEIGHT,
  MAX_ORGANISER_CONFIRMED_SHARE,
  provenanceWeight,
  computeWeightedReviewStats,
};
