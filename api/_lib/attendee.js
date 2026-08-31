/**
 * Attendee dashboard helpers (stats). Registration data comes from Supabase.
 */
const { buildReviewerReward } = require('./reviewer-reward');

function buildStats(registrations) {
  const now = new Date();
  const upcoming = registrations.filter((r) => {
    const d = r.date ? new Date(r.date) : null;
    return d && !Number.isNaN(d.getTime()) && d >= now;
  });
  const past = registrations.filter((r) => {
    const d = r.date ? new Date(r.date) : null;
    return d && !Number.isNaN(d.getTime()) && d < now;
  });
  const reviewsLeft = past.filter((r) => r.reviewStatus === 'reviewed').length;
  const reviewsPending = past.filter((r) => r.reviewStatus === 'pending').length;
  const next = upcoming
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  return {
    upcomingCount: upcoming.length,
    reviewsLeft,
    reviewsPending,
    nextEventDate: next ? next.date : '',
    reviewerReward: buildReviewerReward(reviewsLeft),
  };
}

module.exports = {
  buildStats,
};
