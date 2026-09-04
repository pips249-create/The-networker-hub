/**
 * Industry category line-drawing chip icons (80×80).
 * Same stroke style as region landmark chips.
 * Keep browser copy in sync: js/industry-line-icons.js
 */

function chipSvg(paths) {
  return (
    '<svg class="industry-line-chip region-landmark-chip" viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    paths +
    '</svg>'
  );
}

const GROUND = '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>';

/** @type {Record<string, { label: string, chip: string }>} */
const ICONS = {
  cleaning: {
    label: 'Cleaning',
    chip: chipSvg(
      GROUND +
        // mop handle + head
        '<path d="M40 14v38" stroke-width="1.5"/>' +
        '<path d="M34 14h12" stroke-width="1.4"/>' +
        '<path d="M28 52h24" stroke-width="1.5"/>' +
        '<path d="M30 52v12M36 52v14M44 52v14M50 52v12" stroke-width="1.25"/>' +
        // bucket
        '<path d="M18 44l4 20h12l4-20" stroke-width="1.4"/>' +
        '<path d="M18 44h20" stroke-width="1.3"/>' +
        '<path d="M24 44c0-6 4-8 6-8s6 2 6 8" opacity=".55" stroke-width="1.1"/>'
    ),
  },
  'home-services': {
    label: 'Home services',
    chip: chipSvg(
      GROUND +
        // house
        '<path d="M18 40l22-18 22 18" stroke-width="1.5"/>' +
        '<path d="M24 38v26h32V38" stroke-width="1.45"/>' +
        '<path d="M34 64V48h12v16" opacity=".55" stroke-width="1.2"/>' +
        // wrench
        '<path d="M52 22c4-4 10-4 12-2l-6 6 4 4 6-6c2 2 2 8-2 12-3 3-7 3-10 1l-14 14-6-6 14-14c-2-3-2-7 2-9z" stroke-width="1.35"/>'
    ),
  },
  food: {
    label: 'Food',
    chip: chipSvg(
      GROUND +
        // plate
        '<ellipse cx="40" cy="52" rx="26" ry="10" stroke-width="1.5"/>' +
        '<ellipse cx="40" cy="50" rx="18" ry="6" opacity=".45" stroke-width="1.1"/>' +
        // fork
        '<path d="M22 14v22" stroke-width="1.4"/>' +
        '<path d="M18 14v10M22 14v10M26 14v10" stroke-width="1.25"/>' +
        '<path d="M18 24h8" opacity=".5" stroke-width="1"/>' +
        // knife
        '<path d="M54 14v28" stroke-width="1.45"/>' +
        '<path d="M54 14c6 4 8 12 6 22" stroke-width="1.35"/>' +
        // steam
        '<path d="M36 34c0-4 2-6 0-8M44 34c0-4 2-6 0-8" opacity=".4" stroke-width="1.1"/>'
    ),
  },
  retail: {
    label: 'Retail',
    chip: chipSvg(
      GROUND +
        // shopping bag
        '<path d="M22 30h36l-4 34H26z" stroke-width="1.5"/>' +
        '<path d="M30 30V24c0-6 4-10 10-10s10 4 10 10v6" stroke-width="1.45"/>' +
        '<path d="M28 42h24" opacity=".4" stroke-width="1.1"/>' +
        '<path d="M32 50h16M34 58h12" opacity=".35" stroke-width="1"/>' +
        // tag
        '<circle cx="48" cy="48" r="3" opacity=".55" stroke-width="1.15"/>'
    ),
  },
  tech: {
    label: 'Tech',
    chip: chipSvg(
      GROUND +
        // monitor
        '<rect x="14" y="16" width="52" height="36" rx="2" stroke-width="1.5"/>' +
        '<path d="M18 20h44v28H18z" opacity=".4" stroke-width="1.1"/>' +
        '<path d="M32 52v8M48 52v8M28 64h24" stroke-width="1.4"/>' +
        // code brackets
        '<path d="M30 28l-6 6 6 6M50 28l6 6-6 6" stroke-width="1.35"/>' +
        '<path d="M42 26l-4 20" opacity=".5" stroke-width="1.15"/>'
    ),
  },
  health: {
    label: 'Health',
    chip: chipSvg(
      GROUND +
        // heart
        '<path d="M40 62C22 48 14 38 14 28c0-8 6-14 14-14 6 0 10 3 12 8 2-5 6-8 12-8 8 0 14 6 14 14 0 10-8 20-26 34z" stroke-width="1.55"/>' +
        // pulse
        '<path d="M22 36h10l4-8 6 16 4-8h12" stroke-width="1.4"/>'
    ),
  },
  medical: {
    label: 'Medical',
    chip: chipSvg(
      GROUND +
        // cross
        '<path d="M32 18h16v12h12v16H48v12H32V46H20V30h12z" stroke-width="1.55"/>' +
        // bowl / serpent hint
        '<path d="M18 58c4-8 10-10 14-6" opacity=".5" stroke-width="1.15"/>' +
        '<circle cx="40" cy="34" r="3" opacity=".45" stroke-width="1.1"/>'
    ),
  },
  beauty: {
    label: 'Beauty',
    chip: chipSvg(
      GROUND +
        // scissors
        '<circle cx="26" cy="24" r="8" stroke-width="1.4"/>' +
        '<circle cx="26" cy="48" r="8" stroke-width="1.4"/>' +
        '<path d="M32 28l30 28M32 44l30-28" stroke-width="1.5"/>' +
        '<path d="M58 20l6 6M58 54l6-6" opacity=".45" stroke-width="1.1"/>' +
        // sparkle
        '<path d="M56 36h6M59 33v6" opacity=".4" stroke-width="1.05"/>'
    ),
  },
  property: {
    label: 'Property',
    chip: chipSvg(
      GROUND +
        // house
        '<path d="M12 40l28-24 28 24" stroke-width="1.55"/>' +
        '<path d="M20 36v28h40V36" stroke-width="1.5"/>' +
        // door
        '<path d="M34 64V46h12v18" stroke-width="1.35"/>' +
        '<circle cx="43" cy="56" r="1.2" stroke-width="1.1"/>' +
        // chimney + windows
        '<path d="M48 24v-8h8v14" stroke-width="1.3"/>' +
        '<rect x="24" y="44" width="8" height="8" opacity=".5" stroke-width="1.1"/>' +
        '<rect x="48" y="44" width="8" height="8" opacity=".5" stroke-width="1.1"/>'
    ),
  },
  automotive: {
    label: 'Automotive',
    chip: chipSvg(
      GROUND +
        // car body
        '<path d="M12 46h56l-4 12H16z" stroke-width="1.5"/>' +
        '<path d="M18 46l8-16h28l8 16" stroke-width="1.5"/>' +
        '<path d="M28 30h24" opacity=".4" stroke-width="1.1"/>' +
        // wheels
        '<circle cx="26" cy="58" r="7" stroke-width="1.45"/>' +
        '<circle cx="54" cy="58" r="7" stroke-width="1.45"/>' +
        '<circle cx="26" cy="58" r="2.5" opacity=".5" stroke-width="1.1"/>' +
        '<circle cx="54" cy="58" r="2.5" opacity=".5" stroke-width="1.1"/>' +
        // windows
        '<path d="M28 44l4-10h8M44 34h8l4 10" opacity=".45" stroke-width="1.1"/>'
    ),
  },
  education: {
    label: 'Education',
    chip: chipSvg(
      GROUND +
        // open book
        '<path d="M40 28v34" stroke-width="1.35"/>' +
        '<path d="M40 28C28 22 16 24 12 26v32c6-2 18-4 28 2" stroke-width="1.5"/>' +
        '<path d="M40 28c12-6 24-4 28-2v32c-6-2-18-4-28 2" stroke-width="1.5"/>' +
        '<path d="M20 36h12M20 44h12M48 36h12M48 44h12" opacity=".4" stroke-width="1.05"/>' +
        // mortarboard
        '<path d="M28 16l12-6 12 6-12 6z" stroke-width="1.4"/>' +
        '<path d="M48 18v8l-4 2" opacity=".55" stroke-width="1.15"/>'
    ),
  },
  childcare: {
    label: 'Childcare',
    chip: chipSvg(
      GROUND +
        // blocks
        '<rect x="14" y="44" width="20" height="20" stroke-width="1.45"/>' +
        '<rect x="34" y="36" width="18" height="28" stroke-width="1.45"/>' +
        '<rect x="52" y="48" width="14" height="16" stroke-width="1.4"/>' +
        // letters / faces
        '<circle cx="24" cy="54" r="4" opacity=".5" stroke-width="1.1"/>' +
        '<path d="M40 46h6M40 54h6" opacity=".4" stroke-width="1.05"/>' +
        // star
        '<path d="M58 22l2 6h6l-5 4 2 6-5-3-5 3 2-6-5-4h6z" stroke-width="1.25"/>'
    ),
  },
  care: {
    label: 'Care',
    chip: chipSvg(
      GROUND +
        // hands cupping heart
        '<path d="M16 48c0-8 6-14 14-12 4 1 6 4 8 8" stroke-width="1.45"/>' +
        '<path d="M64 48c0-8-6-14-14-12-4 1-6 4-8 8" stroke-width="1.45"/>' +
        '<path d="M18 50c4 12 14 18 22 18s18-6 22-18" stroke-width="1.5"/>' +
        '<path d="M40 42c-8-8-14-4-14 2 0 4 4 8 14 16 10-8 14-12 14-16 0-6-6-10-14-2z" stroke-width="1.45"/>'
    ),
  },
  finance: {
    label: 'Finance',
    chip: chipSvg(
      GROUND +
        // coin stack
        '<ellipse cx="28" cy="56" rx="14" ry="6" stroke-width="1.4"/>' +
        '<path d="M14 56v-6c0-3 6-6 14-6s14 3 14 6v6" stroke-width="1.35"/>' +
        '<path d="M14 50v-6c0-3 6-6 14-6s14 3 14 6v6" stroke-width="1.35"/>' +
        '<path d="M14 44v-6c0-3 6-6 14-6s14 3 14 6v6" stroke-width="1.35"/>' +
        // pound
        '<path d="M54 22v28M48 30h14M48 42c4 6 10 8 16 4" stroke-width="1.5"/>' +
        '<path d="M50 22c4-4 10-4 12 0" stroke-width="1.3"/>'
    ),
  },
  recruitment: {
    label: 'Recruitment',
    chip: chipSvg(
      GROUND +
        // two people
        '<circle cx="28" cy="24" r="8" stroke-width="1.4"/>' +
        '<path d="M14 58c2-14 8-20 14-20s12 6 14 20" stroke-width="1.45"/>' +
        '<circle cx="54" cy="26" r="7" stroke-width="1.35"/>' +
        '<path d="M42 58c2-12 6-18 12-18s10 6 12 18" stroke-width="1.4"/>' +
        // link / handshake hint
        '<path d="M34 44h12" stroke-width="1.35"/>' +
        '<path d="M36 40l4 4-4 4M44 40l-4 4 4 4" opacity=".5" stroke-width="1.1"/>'
    ),
  },
  pets: {
    label: 'Pets',
    chip: chipSvg(
      GROUND +
        // paw pad
        '<ellipse cx="40" cy="50" rx="12" ry="10" stroke-width="1.5"/>' +
        // toes
        '<circle cx="24" cy="32" r="6" stroke-width="1.35"/>' +
        '<circle cx="36" cy="24" r="6.5" stroke-width="1.35"/>' +
        '<circle cx="50" cy="24" r="6.5" stroke-width="1.35"/>' +
        '<circle cx="58" cy="34" r="6" stroke-width="1.35"/>' +
        '<path d="M36 48c2 4 6 4 8 0" opacity=".4" stroke-width="1.1"/>'
    ),
  },
  leisure: {
    label: 'Leisure',
    chip: chipSvg(
      GROUND +
        // suitcase
        '<rect x="16" y="32" width="48" height="30" rx="3" stroke-width="1.5"/>' +
        '<path d="M28 32V24c0-4 4-8 12-8s12 4 12 8v8" stroke-width="1.4"/>' +
        '<path d="M40 40v14" stroke-width="1.3"/>' +
        '<circle cx="40" cy="48" r="3" opacity=".55" stroke-width="1.1"/>' +
        // plane trail
        '<path d="M52 18l10 4-4 2 6 4" stroke-width="1.3"/>' +
        '<path d="M18 22h16" opacity=".4" stroke-width="1.05"/>'
    ),
  },
  networking: {
    label: 'Networking',
    chip: chipSvg(
      GROUND +
        // nodes
        '<circle cx="40" cy="22" r="7" stroke-width="1.45"/>' +
        '<circle cx="18" cy="48" r="7" stroke-width="1.4"/>' +
        '<circle cx="62" cy="48" r="7" stroke-width="1.4"/>' +
        '<circle cx="40" cy="62" r="6" stroke-width="1.35"/>' +
        // links
        '<path d="M35 28L23 42M45 28l12 14M24 52l12 8M56 52l-12 8" stroke-width="1.35"/>' +
        '<path d="M25 48h30" opacity=".4" stroke-width="1.1"/>'
    ),
  },
};

function iconForIndustry(slug) {
  const key = String(slug || '')
    .trim()
    .toLowerCase();
  return ICONS[key] || null;
}

module.exports = { ICONS, iconForIndustry, chipSvg };
