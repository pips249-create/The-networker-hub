/**
 * Inject landmark icons into homepage chips and directory location links.
 */
(function () {
  function injectIcon(host, theme) {
    if (!host || !theme || !theme.landmarkChip) return;
    host.innerHTML = theme.landmarkChip;
    if (theme.landmarkLabel) {
      host.setAttribute('title', theme.landmarkLabel);
    }
  }

  function initLocationLandmarkIcons() {
    var themes = window.HUB_NETWORKING_REGION_THEMES || {};

    document.querySelectorAll('.home-location-chip[data-region]').forEach(function (chip) {
      var slug = chip.getAttribute('data-region');
      var theme = themes[slug];
      var icon = chip.querySelector('.home-location-chip-icon');
      if (!icon) return;
      icon.classList.remove('home-location-chip-icon--mark');
      injectIcon(icon, theme);
    });

    document.querySelectorAll('.networking-location-links a[data-region]').forEach(function (link) {
      var slug = link.getAttribute('data-region');
      var theme = themes[slug];
      if (!theme || !theme.landmarkChip) return;

      var icon = link.querySelector('.networking-location-icon');
      if (!icon) {
        icon = document.createElement('span');
        icon.className = 'networking-location-icon';
        icon.setAttribute('aria-hidden', 'true');
        link.insertBefore(icon, link.firstChild);
      }
      injectIcon(icon, theme);
      link.classList.add('has-landmark-icon');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLocationLandmarkIcons);
  } else {
    initLocationLandmarkIcons();
  }
})();
