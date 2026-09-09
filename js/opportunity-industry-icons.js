/**
 * Cute line-art icons for Opportunities “Browse by industry” chips.
 * Same stroke language as region landmark chips (80×80, currentColor).
 */
(function () {
  function chipSvg(paths) {
    return (
      '<svg class="region-landmark-chip industry-chip-icon" viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      paths +
      '</svg>'
    );
  }

  var INDUSTRY_ICONS = {
    cleaning: {
      accent: '#4a8fb8',
      label: 'Spray bottle',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<path d="M34 72V38h12v34" stroke-width="1.5"/>' +
          '<path d="M32 38h16v6H32z" stroke-width="1.4"/>' +
          '<path d="M36 38V28h8v10" stroke-width="1.35"/>' +
          '<path d="M38 28c0-6 2-10 5-12M43 16l3-6M40 14l-4-5" stroke-width="1.25"/>' +
          '<path d="M36 48h8M36 56h8M36 64h8" opacity=".45" stroke-width="1"/>' +
          '<circle cx="54" cy="34" r="3" opacity=".5" stroke-width="1.1"/>' +
          '<circle cx="60" cy="28" r="2" opacity=".4" stroke-width="1"/>' +
          '<circle cx="58" cy="40" r="1.6" opacity=".35" stroke-width="1"/>'
      ),
    },
    'home-services': {
      accent: '#c47a4a',
      label: 'House and tools',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<path d="M16 72V40l24-18 24 18v32" stroke-width="1.5"/>' +
          '<path d="M34 72V52h12v20" stroke-width="1.4"/>' +
          '<path d="M26 48h6v6h-6zM48 48h6v6h-6z" opacity=".5" stroke-width="1.1"/>' +
          '<path d="M52 28l10 4M58 24l6 10" stroke-width="1.3"/>' +
          '<circle cx="62" cy="22" r="3.5" stroke-width="1.2"/>'
      ),
    },
    food: {
      accent: '#c45c5c',
      label: 'Coffee and fork',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<path d="M22 56c0 10 8 16 18 16s18-6 18-16V34H22v22z" stroke-width="1.5"/>' +
          '<path d="M58 40h6c4 0 6 3 6 7s-2 7-6 7h-6" stroke-width="1.35"/>' +
          '<path d="M26 34V28c0-6 6-10 14-10s14 4 14 10v6" opacity=".55" stroke-width="1.2"/>' +
          '<path d="M18 24v-8M18 20h4M14 16v-4" stroke-width="1.2"/>' +
          '<path d="M14 28v20M14 32h3M14 40h3" opacity=".7" stroke-width="1.15"/>'
      ),
    },
    retail: {
      accent: '#7a6bb8',
      label: 'Shopping bag',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<path d="M22 72V34h36v38" stroke-width="1.5"/>' +
          '<path d="M22 34c0-12 8-20 18-20s18 8 18 20" stroke-width="1.45"/>' +
          '<path d="M30 34c0-6 4-10 10-10s10 4 10 10" opacity=".5" stroke-width="1.15"/>' +
          '<path d="M28 46h24M28 56h24" opacity=".4" stroke-width="1"/>'
      ),
    },
    tech: {
      accent: '#3d7ea6',
      label: 'Laptop',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<path d="M18 48V24h44v24" stroke-width="1.5"/>' +
          '<path d="M14 48h52l4 12H10z" stroke-width="1.45"/>' +
          '<path d="M34 54h12" stroke-width="1.3"/>' +
          '<path d="M26 32h28M26 38h20" opacity=".4" stroke-width="1"/>' +
          '<circle cx="52" cy="38" r="2" opacity=".5" stroke-width="1"/>'
      ),
    },
    health: {
      accent: '#4f9a78',
      label: 'Heart and pulse',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<path d="M40 62C22 48 16 36 24 26c6-8 14-6 16 0 2-6 10-8 16 0 8 10 2 22-16 36z" stroke-width="1.55"/>' +
          '<path d="M18 44h10l4-8 6 14 4-10 4 4h16" opacity=".7" stroke-width="1.3"/>'
      ),
    },
    medical: {
      accent: '#3d8a9a',
      label: 'Medical cross',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<circle cx="40" cy="40" r="22" stroke-width="1.5"/>' +
          '<path d="M40 24v32M24 40h32" stroke-width="2"/>' +
          '<path d="M34 24h12M34 56h12M24 34v12M56 34v12" opacity=".45" stroke-width="1.1"/>'
      ),
    },
    beauty: {
      accent: '#b86b8c',
      label: 'Flower',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<circle cx="40" cy="34" r="6" stroke-width="1.4"/>' +
          '<path d="M40 28c-8-10-18-8-18 0s10 10 18 6M40 28c8-10 18-8 18 0s-10 10-18 6" stroke-width="1.35"/>' +
          '<path d="M34 38c-12 2-14 12-6 16 8 4 12-4 10-12M46 38c12 2 14 12 6 16-8 4-12-4-10-12" stroke-width="1.35"/>' +
          '<path d="M40 40v28M40 56c-8 2-12 8-10 12M40 58c8 2 12 8 10 12" stroke-width="1.3"/>'
      ),
    },
    property: {
      accent: '#6b7fb8',
      label: 'House key',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<path d="M14 66V38l22-16 22 16v28" stroke-width="1.5"/>' +
          '<path d="M34 66V50h12v16" stroke-width="1.35"/>' +
          '<circle cx="58" cy="24" r="8" stroke-width="1.4"/>' +
          '<circle cx="58" cy="24" r="3" opacity=".55" stroke-width="1.1"/>' +
          '<path d="M64 30l8 10M68 36h4M70 40h3" stroke-width="1.25"/>'
      ),
    },
    automotive: {
      accent: '#5a6f8c',
      label: 'Car',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<path d="M12 50l8-16h28l10 16H12z" stroke-width="1.5"/>' +
          '<path d="M10 50h60v10H10z" stroke-width="1.45"/>' +
          '<circle cx="24" cy="60" r="6" stroke-width="1.4"/>' +
          '<circle cx="56" cy="60" r="6" stroke-width="1.4"/>' +
          '<path d="M22 42h8M38 38h12" opacity=".45" stroke-width="1.1"/>' +
          '<path d="M48 50l6-4" opacity=".4" stroke-width="1"/>'
      ),
    },
    education: {
      accent: '#8b6bb8',
      label: 'Open book',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<path d="M40 28v36" stroke-width="1.4"/>' +
          '<path d="M40 28C28 22 16 24 14 36v28c8-8 18-8 26-2 8-6 18-6 26 2V36c-2-12-14-14-26-8z" stroke-width="1.5"/>' +
          '<path d="M22 40h12M22 48h12M46 40h12M46 48h12" opacity=".4" stroke-width="1"/>' +
          '<path d="M40 18l4-8 4 3-4 6" stroke-width="1.2"/>'
      ),
    },
    childcare: {
      accent: '#d4a04a',
      label: 'Building blocks',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<rect x="18" y="44" width="20" height="20" rx="2" stroke-width="1.45"/>' +
          '<rect x="42" y="44" width="20" height="20" rx="2" stroke-width="1.45"/>' +
          '<rect x="30" y="22" width="20" height="20" rx="2" stroke-width="1.45"/>' +
          '<circle cx="28" cy="54" r="2.2" opacity=".5" stroke-width="1"/>' +
          '<circle cx="52" cy="54" r="2.2" opacity=".5" stroke-width="1"/>' +
          '<path d="M36 30h8M40 28v8" opacity=".55" stroke-width="1.15"/>' +
          '<path d="M40 16c4-6 10-4 8 2" stroke-width="1.2"/>'
      ),
    },
    care: {
      accent: '#5a9a8c',
      label: 'Helping hands',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<path d="M18 48c0-10 6-16 14-16 4 0 6 2 8 5 2-3 4-5 8-5 8 0 14 6 14 16 0 14-14 24-22 28-8-4-22-14-22-28z" stroke-width="1.5"/>' +
          '<path d="M32 40c2 6 6 10 8 12 2-2 6-6 8-12" opacity=".5" stroke-width="1.2"/>' +
          '<path d="M28 28c-4-6-2-12 2-12M52 28c4-6 2-12-2-12" opacity=".45" stroke-width="1.15"/>'
      ),
    },
    finance: {
      accent: '#3f7d6a',
      label: 'Coins',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<ellipse cx="34" cy="48" rx="16" ry="14" stroke-width="1.5"/>' +
          '<ellipse cx="34" cy="44" rx="16" ry="14" stroke-width="1.5"/>' +
          '<path d="M34 36v16M28 40h12M28 48h12" opacity=".45" stroke-width="1.1"/>' +
          '<ellipse cx="52" cy="36" rx="12" ry="10" stroke-width="1.4"/>' +
          '<ellipse cx="52" cy="33" rx="12" ry="10" stroke-width="1.4"/>' +
          '<path d="M52 27v12M48 30h8" opacity=".45" stroke-width="1.05"/>'
      ),
    },
    recruitment: {
      accent: '#6b6fb8',
      label: 'People',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<circle cx="28" cy="28" r="8" stroke-width="1.4"/>' +
          '<path d="M14 58c2-12 8-18 14-18s12 6 14 18" stroke-width="1.45"/>' +
          '<circle cx="54" cy="30" r="7" stroke-width="1.35"/>' +
          '<path d="M42 58c2-10 7-15 12-15s10 5 12 15" stroke-width="1.4"/>' +
          '<path d="M36 36c4-2 8-2 12 0" opacity=".4" stroke-width="1.1"/>'
      ),
    },
    pets: {
      accent: '#b87a4a',
      label: 'Paw print',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<ellipse cx="40" cy="48" rx="12" ry="14" stroke-width="1.5"/>' +
          '<circle cx="24" cy="30" r="6" stroke-width="1.35"/>' +
          '<circle cx="40" cy="22" r="6" stroke-width="1.35"/>' +
          '<circle cx="56" cy="30" r="6" stroke-width="1.35"/>' +
          '<circle cx="28" cy="44" r="4.5" opacity=".55" stroke-width="1.15"/>' +
          '<circle cx="52" cy="44" r="4.5" opacity=".55" stroke-width="1.15"/>'
      ),
    },
    leisure: {
      accent: '#4a9ab8',
      label: 'Suitcase',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<path d="M16 66V34h48v32" stroke-width="1.5"/>' +
          '<path d="M30 34V24h20v10" stroke-width="1.4"/>' +
          '<path d="M16 46h48" opacity=".45" stroke-width="1.15"/>' +
          '<path d="M36 48v8M44 48v8" opacity=".5" stroke-width="1.15"/>' +
          '<path d="M22 38h6M52 38h6" opacity=".4" stroke-width="1"/>' +
          '<path d="M58 20c6 2 10 8 8 14" opacity=".55" stroke-width="1.2"/>'
      ),
    },
    networking: {
      accent: '#493f95',
      label: 'Connected people',
      chip: chipSvg(
        '<path d="M8 72h64" opacity=".35" stroke-width="1.1"/>' +
          '<circle cx="40" cy="28" r="8" stroke-width="1.45"/>' +
          '<circle cx="20" cy="54" r="7" stroke-width="1.35"/>' +
          '<circle cx="60" cy="54" r="7" stroke-width="1.35"/>' +
          '<path d="M34 34L24 48M46 34l10 14" stroke-width="1.35"/>' +
          '<path d="M27 54h26" opacity=".5" stroke-width="1.2"/>' +
          '<path d="M40 18v-6M37 14h6" stroke-width="1.15"/>'
      ),
    },
  };

  function initIndustryIcons() {
    document.querySelectorAll('.home-location-chip--industry[data-category]').forEach(function (chip) {
      var id = chip.getAttribute('data-category') || '';
      var meta = INDUSTRY_ICONS[id];
      if (!meta) return;
      if (meta.accent) chip.style.setProperty('--chip-accent', meta.accent);
      var host = chip.querySelector('.home-location-chip-icon');
      if (!host) {
        host = document.createElement('span');
        host.className = 'home-location-chip-icon';
        host.setAttribute('aria-hidden', 'true');
        chip.insertBefore(host, chip.firstChild);
      }
      host.innerHTML = meta.chip;
      if (meta.label) host.setAttribute('title', meta.label);
    });
  }

  window.HUB_INDUSTRY_ICONS = INDUSTRY_ICONS;
  window.HUB_initIndustryIcons = initIndustryIcons;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIndustryIcons);
  } else {
    initIndustryIcons();
  }
})();
