/**
 * Single-landmark SVG marks for UK networking regions (chip + hero sizes).
 * Keep in sync with api/_lib/region-landmark-icons.js
 */
(function (global) {
  function chipSvg(paths) {
    return (
      '<svg class="region-landmark-chip" viewBox="0 0 48 22" fill="currentColor" aria-hidden="true">' +
      paths +
      '</svg>'
    );
  }

  function heroSvg(paths) {
    return (
      '<svg class="networking-region-landmark-svg" viewBox="0 0 200 72" fill="currentColor" aria-hidden="true">' +
      paths +
      '</svg>'
    );
  }

  var LANDMARKS = {
    'big-ben': {
      label: 'Big Ben',
      chip:
        '<path d="M20 20V5h8v15H20z"/><path d="M22 5V2.5h4V5"/><path d="M23 7h2v6h-2z" opacity=".45"/><path d="M24 1.2v1.3M23 2.5h2"/>',
      hero:
        '<path d="M78 68V14h44v54H78z"/><path d="M86 14V4h28v10"/><path d="M92 24h20v22H92z" opacity=".45"/><path d="M100 2v8M94 10h12"/>',
    },
    'st-pauls': {
      label: "St Paul's Cathedral",
      chip:
        '<path d="M24 20V12"/><ellipse cx="24" cy="10" rx="9" ry="5"/><path d="M15 12h18"/><path d="M21 20V14h6v6"/>',
      hero:
        '<path d="M100 68V34"/><ellipse cx="100" cy="26" rx="38" ry="18"/><path d="M62 34h76"/><path d="M84 68V42h32v26"/>',
    },
    'london-eye': {
      label: 'London Eye',
      chip:
        '<path d="M8 20h32" stroke="currentColor" stroke-width=".8" opacity=".35"/><path d="M17 20V13l7-11 7 11v7"/><circle cx="24" cy="8.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="24" cy="8.5" r="1"/><path d="M24 2v13M18.2 8.5h11.6M19.8 4.2l8.4 8.6M28.2 4.2L19.8 12.8" fill="none" stroke="currentColor" stroke-width=".7" opacity=".55"/>',
      hero:
        '<path d="M24 66h152" stroke="currentColor" stroke-width="2" opacity=".35"/><path d="M68 66V38l32-50 32 50v28"/><circle cx="100" cy="30" r="26" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="100" cy="30" r="4"/><path d="M100 4v52M74 30h52M80 12l40 36M120 12L80 48" fill="none" stroke="currentColor" stroke-width="2.2" opacity=".55"/>',
    },
    'tower-bridge': {
      label: 'Tower Bridge',
      chip:
        '<path d="M6 20h36" opacity=".35"/><path d="M10 20V11h5v9M33 20V11h5v9"/><path d="M8 11h8v3H8zm24 0h8v3H32z"/><path d="M15 14h18v2H15z"/><path d="M18 11V7h3v4M27 11V7h3v4"/>',
      hero:
        '<path d="M20 66h160" opacity=".35"/><path d="M36 66V28h24v38M140 66V28h24v38"/><path d="M28 28h40v12H28zm104 0h40v12H132z"/><path d="M56 40h88v8H56z"/><path d="M64 28V12h12v16M124 28V12h12v16"/>',
    },
    battersea: {
      label: 'Battersea Power Station',
      chip:
        '<path d="M8 20h32" opacity=".35"/><path d="M10 20V8h6v12M18 20V6h4v14M26 20V8h6v12M34 20V10h4v10"/>',
      hero:
        '<path d="M24 66h152" opacity=".35"/><path d="M36 66V18h28v48M72 66V8h18v58M108 66V18h28v48M144 66V26h24v40"/>',
    },
    manchester: {
      label: 'Beetham Tower',
      chip:
        '<path d="M8 20h32" opacity=".35"/><path d="M28 20L20 4 12 20z"/><path d="M20 4v16" opacity=".25"/>',
      hero:
        '<path d="M24 66h152" opacity=".35"/><path d="M128 66L100 8 72 66z"/><path d="M100 8v58" opacity=".25"/>',
    },
    birmingham: {
      label: 'Library of Birmingham',
      chip:
        '<circle cx="24" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="11" r="4.5" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".6"/><path d="M12 20h24" opacity=".35"/>',
      hero:
        '<circle cx="100" cy="30" r="34" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="100" cy="30" r="18" fill="none" stroke="currentColor" stroke-width="3.5" opacity=".6"/><path d="M40 66h120" opacity=".35"/>',
    },
    glasgow: {
      label: 'Finnieston Crane',
      chip:
        '<path d="M6 20h36" opacity=".35"/><path d="M14 20V9h2v11"/><path d="M8 9h24v2H8z"/><path d="M28 11v9"/><path d="M26 20h4"/>',
      hero:
        '<path d="M16 66h168" opacity=".35"/><path d="M52 66V22h10v44"/><path d="M28 22h96v8H28z"/><path d="M112 30v36"/><path d="M104 66h16"/>',
    },
    edinburgh: {
      label: 'Edinburgh Castle',
      chip:
        '<path d="M6 20h36" opacity=".35"/><path d="M10 20c4-8 10-12 14-12s10 4 14 12"/><path d="M14 16h4v4h-4zm8-4h4v8h-4zm8 0h4v4h-4z"/><path d="M22 8l-2 2h4l-2-2z"/>',
      hero:
        '<path d="M16 66h168" opacity=".35"/><path d="M32 66c16-28 40-42 68-42s52 14 68 42"/><path d="M52 52h16v14H52zm32-18h16v32H84zm32 6h16v26h-16z"/><path d="M84 18l-8 10h16l-8-10z"/>',
    },
    leeds: {
      label: 'Leeds Town Hall',
      chip:
        '<path d="M20 20V8h8v12"/><path d="M22 8V4h4v4"/><path d="M23 10h2v3h-2z" opacity=".45"/><path d="M24 2.5v1.5"/>',
      hero:
        '<path d="M72 66V18h56v48"/><path d="M80 18V6h40v12"/><path d="M88 28h24v18H88z" opacity=".45"/><path d="M100 4v10"/>',
    },
    bristol: {
      label: 'Clifton Suspension Bridge',
      chip:
        '<path d="M4 14c10-8 20-8 30 0" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 20V10h4v10M38 20V10h4v10"/><path d="M4 20h40" opacity=".35"/>',
      hero:
        '<path d="M16 38c56-36 112-36 168 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M24 66V22h20v44M156 66V22h20v44"/><path d="M16 66h168" opacity=".35"/>',
    },
    chester: {
      label: 'Eastgate Clock',
      chip:
        '<path d="M4 20h40" opacity=".35"/><path d="M16 20V10h16v10"/><path d="M18 10h12v3H18z"/><circle cx="24" cy="14" r="2.5" fill="none" stroke="currentColor" stroke-width="1"/><path d="M22 20V17h4v3"/>',
      hero:
        '<path d="M16 66h168" opacity=".35"/><path d="M64 66V24h72v42"/><path d="M72 24h56v14H72z"/><circle cx="100" cy="40" r="10" fill="none" stroke="currentColor" stroke-width="3"/><path d="M88 66V52h24v14"/>',
    },
  liverpool: {
    label: 'Royal Albert Dock',
    chip:
      '<path d="M4 18h40" opacity=".35"/><path d="M8 18V10h10v8M30 18V6h10v12"/><path d="M9 10h8v2H9zm22 0h8v3h-8z"/><path d="M18 12h12v2H18z"/><path d="M10 7l3-3 3 3M28 5l2-2 2 2" opacity=".7"/>',
    hero:
      '<path d="M16 58h168" opacity=".35"/><path d="M28 58V24h48v34M124 58V10h48v48"/><path d="M32 24h40v10H32zm88 0h40v16h-40z"/><path d="M72 34h56v8H72z"/><path d="M36 14l12-10 12 10M116 8l10-8 10 8" opacity=".7"/>',
  },
  newcastle: {
    label: 'Tyne Bridge',
    chip:
      '<path d="M4 20h40" opacity=".35"/><path d="M8 20V12h6v8M34 20V12h6v8"/><path d="M6 12c12-8 24-8 36 0" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M14 16h20v2H14z"/>',
    hero:
      '<path d="M16 66h168" opacity=".35"/><path d="M28 66V34h32v32M140 66V34h32v32"/><path d="M20 34c60-40 120-40 180 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M52 48h96v8H52z"/>',
  },
  sheffield: {
    label: 'Park Hill',
    chip:
      '<path d="M6 20h36" opacity=".35"/><path d="M8 20V9h5v11M16 20V6h4v14M24 20V10h5v10M32 20V7h5v13"/>',
    hero:
      '<path d="M16 66h168" opacity=".35"/><path d="M24 66V24h28v42M72 66V12h24v54M120 66V28h28v38M164 66V18h24v48"/>',
  },
  nottingham: {
    label: 'Nottingham Castle',
    chip:
      '<path d="M6 20h36" opacity=".35"/><path d="M10 20c4-7 10-11 14-11s10 4 14 11"/><path d="M14 16h4v4h-4zm8-3h4v7h-4zm8 0h4v4h-4z"/><path d="M22 7l-2 2h4l-2-2z"/>',
    hero:
      '<path d="M16 66h168" opacity=".35"/><path d="M32 66c16-26 40-38 68-38s52 12 68 38"/><path d="M52 52h16v14H52zm32-16h16v30H84zm32 4h16v26h-16z"/><path d="M84 16l-8 10h16l-8-10z"/>',
  },
  cardiff: {
    label: 'Principality Stadium',
    chip:
      '<path d="M6 20h36" opacity=".35"/><ellipse cx="24" cy="13" rx="14" ry="7"/><path d="M10 13h28"/><path d="M12 20V13M36 20V13"/>',
    hero:
      '<path d="M16 66h168" opacity=".35"/><ellipse cx="100" cy="32" rx="58" ry="24"/><path d="M42 32h116"/><path d="M48 66V32M152 66V32"/>',
  },
  brighton: {
    label: 'Royal Pavilion',
    chip:
      '<path d="M8 20h32" opacity=".35"/><path d="M14 20V12c2-6 6-9 10-9s8 3 10 9v8"/><path d="M16 12h16" opacity=".5"/><path d="M20 8c0-2 2-4 4-4s4 2 4 4"/>',
    hero:
      '<path d="M24 66h152" opacity=".35"/><path d="M48 66V28c8-24 24-36 52-36s44 12 52 36v38"/><path d="M56 28h88" opacity=".5"/><path d="M68 14c0-10 12-18 32-18s32 8 32 18"/>',
  },
  cambridge: {
    label: "King's College Chapel",
    chip:
      '<path d="M10 20h28" opacity=".35"/><path d="M14 20V10h20v10"/><path d="M16 10V6h6v4M26 10V6h6v4"/><path d="M22 4v2"/><path d="M18 14h12v2H18z" opacity=".45"/>',
    hero:
      '<path d="M32 66h136" opacity=".35"/><path d="M48 66V18h104v48"/><path d="M56 18V8h24v10M120 18V8h24v10"/><path d="M100 2v12"/><path d="M68 36h64v10H68z" opacity=".45"/>',
  },
  oxford: {
    label: 'Radcliffe Camera',
    chip:
      '<path d="M10 20h28" opacity=".35"/><circle cx="24" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M16 20V14h16v6"/><path d="M24 4v2"/>',
    hero:
      '<path d="M32 66h136" opacity=".35"/><circle cx="100" cy="30" r="34" fill="none" stroke="currentColor" stroke-width="5"/><path d="M66 66V38h68v28"/><path d="M100 4v10"/>',
  },
};

  var LANDMARK_BY_REGION = {
    'central-london': 'big-ben',
    'north-london': 'st-pauls',
    'south-london': 'london-eye',
    'east-london': 'tower-bridge',
    'west-london': 'battersea',
    manchester: 'manchester',
    birmingham: 'birmingham',
    glasgow: 'glasgow',
    edinburgh: 'edinburgh',
    leeds: 'leeds',
    bristol: 'bristol',
    chester: 'chester',
    liverpool: 'liverpool',
    newcastle: 'newcastle',
    sheffield: 'sheffield',
    nottingham: 'nottingham',
    cardiff: 'cardiff',
    brighton: 'brighton',
    cambridge: 'cambridge',
    oxford: 'oxford',
  };

  function landmarkKeyForRegion(slug) {
    return LANDMARK_BY_REGION[String(slug || '').trim().toLowerCase()] || null;
  }

  function landmarkChip(key) {
    var item = LANDMARKS[key];
    return item ? chipSvg(item.chip) : '';
  }

  function landmarkHero(key) {
    var item = LANDMARKS[key];
    return item ? heroSvg(item.hero) : '';
  }

  function landmarkForRegion(slug) {
    var key = landmarkKeyForRegion(slug);
    if (!key) return { key: null, chip: '', hero: '', label: '' };
    var item = LANDMARKS[key];
    return {
      key: key,
      chip: landmarkChip(key),
      hero: landmarkHero(key),
      label: item ? item.label : '',
    };
  }

  global.HUB_REGION_LANDMARKS = {
    LANDMARKS: LANDMARKS,
    LANDMARK_BY_REGION: LANDMARK_BY_REGION,
    landmarkKeyForRegion: landmarkKeyForRegion,
    landmarkChip: landmarkChip,
    landmarkHero: landmarkHero,
    landmarkForRegion: landmarkForRegion,
  };
})(typeof window !== 'undefined' ? window : globalThis);
