const {
  summarizeRegistrationSales,
  calculatePayoutBreakdown,
} = require('./supabase-organiser-payouts');

function formatGbp(amount) {
  const n = Number(amount) || 0;
  if (n <= 0) return '£0.00';
  return n % 1 === 0 ? '£' + n.toFixed(0) : '£' + n.toFixed(2);
}

function computeEventTicketStats(registrations, tickets) {
  const { ticketsSold } = summarizeRegistrationSales(registrations);
  const breakdown = calculatePayoutBreakdown(registrations);

  let capacity = 0;
  let hasUnlimited = false;
  (tickets || []).forEach(function (t) {
    if (t.quantity == null) hasUnlimited = true;
    else capacity += Number(t.quantity) || 0;
  });

  const ticketsRemaining =
    hasUnlimited || capacity <= 0 ? 'Unlimited' : String(Math.max(0, capacity - ticketsSold));

  return {
    tickets_sold: String(ticketsSold),
    tickets_remaining: ticketsRemaining,
    total_revenue: formatGbp(breakdown.amount_gross),
  };
}

module.exports = {
  computeEventTicketStats,
  formatGbp,
};
