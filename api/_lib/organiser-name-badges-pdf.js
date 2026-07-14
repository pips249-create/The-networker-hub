/**
 * Avery 7160-compatible name badge PDF (A4, 3×7 sticky labels).
 * Populates name, company, and job title / industry when available.
 */
const { buildPositionedPdf } = require('./simple-pdf');

const MM = 2.834645669;
const PAGE_W = 210 * MM;
const PAGE_H = 297 * MM;

/** Avery L7160 / 7160 approximate layout (UK A4). */
const LABEL = {
  cols: 3,
  rows: 7,
  width: 63.5 * MM,
  height: 38.1 * MM,
  left: 7.25 * MM,
  top: 15.1 * MM,
  hPitch: 66.0 * MM,
  vPitch: 38.1 * MM,
  perPage: 21,
};

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

function badgeEntriesFromAttendees(attendees) {
  const entries = [];
  (attendees || []).forEach((a) => {
    const applicationStatus = String(a.applicationStatus || 'Approved').trim();
    if (applicationStatus === 'Pending' || applicationStatus === 'Denied') return;

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
        company: 'Guest of ' + clampLine(a.name || 'attendee', 28),
        detail: company || '',
      });
    });
  });
  return entries;
}

function buildNameBadgesPdf(attendees, options) {
  const opts = options || {};
  const eventTitle = clampLine(opts.eventTitle || 'Event attendees', 42);
  const entries = badgeEntriesFromAttendees(attendees);
  if (!entries.length) {
    const err = new Error('No confirmed attendees to print');
    err.status = 400;
    throw err;
  }

  const pages = [];
  for (let i = 0; i < entries.length; i += LABEL.perPage) {
    const chunk = entries.slice(i, i + LABEL.perPage);
    const items = [];
    chunk.forEach((entry, idx) => {
      const col = idx % LABEL.cols;
      const row = Math.floor(idx / LABEL.cols);
      const left = LABEL.left + col * LABEL.hPitch;
      const topFromBottom = PAGE_H - LABEL.top - row * LABEL.vPitch - LABEL.height;
      const padX = 6;
      const { first, last } = splitName(entry.name);
      const nameLine = clampLine([first, last].filter(Boolean).join(' '), 26);
      const company = clampLine(entry.company, 30);
      const detail = clampLine(entry.detail, 32);

      items.push({
        x: left + padX,
        y: topFromBottom + LABEL.height - 16,
        size: 12,
        font: 'F2',
        text: nameLine,
      });
      if (company) {
        items.push({
          x: left + padX,
          y: topFromBottom + LABEL.height - 30,
          size: 9,
          font: 'F1',
          text: company,
        });
      }
      if (detail) {
        items.push({
          x: left + padX,
          y: topFromBottom + LABEL.height - (company ? 42 : 30),
          size: company ? 8 : 9,
          font: 'F1',
          text: detail,
        });
      }
      items.push({
        x: left + padX,
        y: topFromBottom + 8,
        size: 6,
        font: 'F1',
        text: clampLine(eventTitle, 36),
      });
    });
    pages.push({ width: PAGE_W, height: PAGE_H, items });
  }

  return buildPositionedPdf(pages);
}

module.exports = {
  LABEL,
  splitName,
  badgeEntriesFromAttendees,
  buildNameBadgesPdf,
};
