/**
 * Inject landmark icons and accent colours into homepage chips and directory links.
 */
(function () {
  var applyAccent = window.HUB_applyRegionAccentVars;

  function injectIcon(host, theme, slug) {
    if (!host) return;
    if (theme && theme.landmarkChip) {
      host.innerHTML = theme.landmarkChip;
      if (theme.landmarkLabel) {
        host.setAttribute('title', theme.landmarkLabel);
      }
      host.classList.remove('home-location-chip-icon--mark');
      return;
    }

    var letter = String(slug || '')
      .trim()
      .replace(/-/g, ' ')
      .split(/\s+/)
      .map(function (part) {
        return part.charAt(0).toUpperCase();
      })
      .join('')
      .slice(0, 2);
    if (!letter) letter = '?';
    host.innerHTML = '<span class="home-location-chip-letter">' + letter + '</span>';
    host.classList.add('home-location-chip-icon--mark');
  }

  function syncCompactLabel(chip) {
    if (!chip || chip.classList.contains('home-location-chip--compact-label')) return;
    var nameEl = chip.querySelector('.home-location-chip-name');
    if (!nameEl || nameEl.classList.contains('home-location-chip-name--stacked')) return;
    var text = String(nameEl.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length > 9) {
      chip.classList.add('home-location-chip--compact-label');
    }
  }

  function initLocationLandmarkIcons() {
    var themes = window.HUB_NETWORKING_REGION_THEMES || {};

    document.querySelectorAll('.home-location-chip[data-region]').forEach(function (chip) {
      var slug = chip.getAttribute('data-region');
      var theme = themes[slug];
      if (applyAccent) applyAccent(chip, theme);
      var icon = chip.querySelector('.home-location-chip-icon');
      injectIcon(icon, theme, slug);
      syncCompactLabel(chip);
    });

    document.querySelectorAll('.networking-location-links a[data-region]').forEach(function (link) {
      var slug = link.getAttribute('data-region');
      var theme = themes[slug];
      if (applyAccent) applyAccent(link, theme);
      if (!theme || !theme.landmarkChip) return;

      var icon = link.querySelector('.networking-location-icon');
      if (!icon) {
        icon = document.createElement('span');
        icon.className = 'networking-location-icon';
        icon.setAttribute('aria-hidden', 'true');
        link.insertBefore(icon, link.firstChild);
      }
      injectIcon(icon, theme, slug);
      link.classList.add('has-landmark-icon');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLocationLandmarkIcons);
  } else {
    initLocationLandmarkIcons();
  }
})();
