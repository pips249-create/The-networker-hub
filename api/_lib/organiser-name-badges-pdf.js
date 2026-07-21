/**
 * Avery-compatible name badge PDFs (UK A4 sticker sheets).
 * Populates name, company, and job title / industry when available.
 */
const { buildPositionedPdf } = require('./simple-pdf');

const MM = 2.834645669;
const PAGE_W = 210 * MM;
const PAGE_H = 297 * MM;

/** Avery L7160 — standard address labels (63.5 × 38.1 mm, 21 per sheet). */
const LABEL_L7160 = {
  id: 'l7160',
  code: 'L7160',
  name: 'Standard Address Label',
  cols: 3,
  rows: 7,
  width: 63.5 * MM,
  height: 38.1 * MM,
  left: 7.25 * MM,
  top: 15.1 * MM,
  hPitch: 66.0 * MM,
  vPitch: 38.1 * MM,
  perPage: 21,
  textLimits: { name: 26, company: 30, detail: 32, event: 36, guestOf: 28 },
};

/** Avery L7163 — large address labels (99.1 × 38.1 mm, 14 per sheet, UK). */
const LABEL_L7163 = {
  id: 'l7163',
  code: 'L7163',
  name: 'Large Address Label',
  cols: 2,
  rows: 7,
  width: 99.1 * MM,
  height: 38.1 * MM,
  left: 4.65 * MM,
  top: 15.15 * MM,
  hPitch: 101.6 * MM,
  vPitch: 38.1 * MM,
  perPage: 14,
  textLimits: { name: 40, company: 48, detail: 50, event: 52, guestOf: 40 },
};

const LABEL_FORMATS = {
  l7160: LABEL_L7160,
  l7163: LABEL_L7163,
  /** @deprecated UK large labels are L7163; kept for early API callers. */
  l7161: LABEL_L7163,
};

/** Vertical typography on each sticker (PDF points, measured from label top/bottom). */
const BADGE_LAYOUT = {
  padX: 6,
  nameSize: 14,
  nameFromTop: 10,
  companySize: 7,
  nameToCompanyGap: 9,
  detailSize: 7,
  companyToDetailGap: 8,
  eventSize: 6,
  eventFromBottom: 8,
};

/** @deprecated Use LABEL_FORMATS.l7160 */
const LABEL = LABEL_L7160;

function resolveLabelFormat(value) {
  const key = String(value || 'l7160')
    .trim()
    .toLowerCase();
  return LABEL_FORMATS[key] || LABEL_L7160;
}

function splitName(fullName) {
  const raw = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (!raw) return { first: 'Guest', last: '' };
  const parts = raw.split(' ');
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function clampLine(text, max) {
  const s = String(text || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, Math.max(1, max - 1)).trim() + '…';
}

function attendeeConfirmedForRegister(a) {
  const applicationStatus = String(a.applicationStatus || 'Approved').trim();
  if (applicationStatus === 'Pending' || applicationStatus === 'Denied') return false;
  if (a.needsPayment) return false;
  const paymentStatus = String(a.paymentStatus || '').trim();
  if (paymentStatus === 'Refunded' || paymentStatus === 'Pending') return false;
  return true;
}

function badgeEntriesFromAttendees(attendees, labelFormat) {
  const limits = labelFormat.textLimits;
  const entries = [];
  (attendees || []).forEach((a) => {
    if (!attendeeConfirmedForRegister(a)) return;

    const company = String(a.company || '').trim();
    const jobTitle =
      String(a.jobTitle || '').trim() ||
      String(a.screeningJobTitle || '').trim() ||
      '';
    const industry =
      String(a.screeningIndustry || '').trim() ||
      String(a.businessSector || '').trim() ||
      '';
    const detail = jobTitle || industry;

    entries.push({
      name: String(a.name || '').trim() || 'Attendee',
      company,
      detail,
    });

    (a.guestNames || []).forEach((guest) => {
      const g = String(guest || '').trim();
      if (!g) return;
      entries.push({
        name: g,
        company: 'Guest of ' + clampLine(a.name || 'attendee', limits.guestOf),
        detail: company || '',
      });
    });
  });
  return entries;
}

function buildNameBadgesPdf(attendees, options) {
  const opts = options || {};
  const labelFormat = resolveLabelFormat(opts.labelFormat);
  const limits = labelFormat.textLimits;
  const eventTitle = clampLine(opts.eventTitle || 'Event attendees', limits.event);
  const entries = badgeEntriesFromAttendees(attendees, labelFormat);
  if (!entries.length) {
    const err = new Error('No confirmed attendees to print');
    err.status = 400;
    throw err;
  }

  const pages = [];
  for (let i = 0; i < entries.length; i += labelFormat.perPage) {
    const chunk = entries.slice(i, i + labelFormat.perPage);
    const items = [];
    chunk.forEach((entry, idx) => {
      const col = idx % labelFormat.cols;
      const row = Math.floor(idx / labelFormat.cols);
      const left = labelFormat.left + col * labelFormat.hPitch;
      const topFromBottom =
        PAGE_H - labelFormat.top - row * labelFormat.vPitch - labelFormat.height;
      const padX = BADGE_LAYOUT.padX;
      const { first, last } = splitName(entry.name);
      const nameLine = clampLine([first, last].filter(Boolean).join(' '), limits.name);
      const company = clampLine(entry.company, limits.company);
      const detail = clampLine(entry.detail, limits.detail);
      const fromTop = (offset) => topFromBottom + labelFormat.height - offset;

      let lineFromTop = BADGE_LAYOUT.nameFromTop;
      items.push({
        x: left + padX,
        y: fromTop(lineFromTop),
        size: BADGE_LAYOUT.nameSize,
        font: 'F2',
        text: nameLine,
      });
      if (company) {
        lineFromTop += BADGE_LAYOUT.nameToCompanyGap;
        items.push({
          x: left + padX,
          y: fromTop(lineFromTop),
          size: BADGE_LAYOUT.companySize,
          font: 'F1',
          text: company,
        });
      }
      if (detail) {
        lineFromTop += company ? BADGE_LAYOUT.companyToDetailGap : BADGE_LAYOUT.nameToCompanyGap;
        items.push({
          x: left + padX,
          y: fromTop(lineFromTop),
          size: BADGE_LAYOUT.detailSize,
          font: 'F1',
          text: detail,
        });
      }
      items.push({
        x: left + padX,
        y: topFromBottom + BADGE_LAYOUT.eventFromBottom,
        size: BADGE_LAYOUT.eventSize,
        font: 'F1',
        text: eventTitle,
      });
    });
    pages.push({ width: PAGE_W, height: PAGE_H, items });
  }

  return buildPositionedPdf(pages);
}

module.exports = {
  LABEL,
  LABEL_FORMATS,
  LABEL_L7160,
  LABEL_L7163,
  resolveLabelFormat,
  splitName,
  attendeeConfirmedForRegister,
  badgeEntriesFromAttendees,
  buildNameBadgesPdf,
};
