function formatTicketsSoldLabel(sold, capacity) {
  const n = Math.max(0, Number(sold) || 0);
  const cap = Number(capacity);
  if (Number.isFinite(cap) && cap > 0) return `${n} / ${cap}`;
  if (n > 0) return `${n} sold`;
  return '0 / —';
}

module.exports = {
  formatTicketsSoldLabel,
};
