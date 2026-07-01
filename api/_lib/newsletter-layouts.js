/**
 * Newsletter layout registry — kept dependency-free for template resolution.
 */
const NEWSLETTER_LAYOUTS = {
  magazine: {
    id: 'magazine',
    label: 'Magazine',
    file: 'hub-newsletter.html',
    marker: 'hub-newsletter-magazine',
  },
  classic: {
    id: 'classic',
    label: 'Classic',
    file: 'hub-newsletter-classic.html',
    marker: 'hub-newsletter-classic',
  },
  editorial: {
    id: 'editorial',
    label: 'Editorial',
    file: 'hub-newsletter-editorial.html',
    marker: 'hub-newsletter-editorial',
  },
};

function normalizeNewsletterLayout(layout) {
  const key = String(layout || 'magazine')
    .trim()
    .toLowerCase();
  return NEWSLETTER_LAYOUTS[key] ? key : 'magazine';
}

function getNewsletterLayoutConfig(layout) {
  return NEWSLETTER_LAYOUTS[normalizeNewsletterLayout(layout)];
}

module.exports = {
  NEWSLETTER_LAYOUTS,
  normalizeNewsletterLayout,
  getNewsletterLayoutConfig,
};
