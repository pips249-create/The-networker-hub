/**
 * Full-page mobile filter sheet — shared by events and opportunities browse.
 */
(function (global) {
  function initMobileFilterSheet(options) {
    options = options || {};
    var shell =
      typeof options.shell === 'string'
        ? document.querySelector(options.shell)
        : options.shell || document.querySelector('.events-filter-shell');
    var toggle =
      typeof options.toggle === 'string'
        ? document.getElementById(options.toggle)
        : options.toggle || document.getElementById('filter-mobile-toggle');
    var badge =
      typeof options.badge === 'string'
        ? document.getElementById(options.badge)
        : options.badge || document.getElementById('filter-mobile-toggle-badge');
    var sheet =
      typeof options.sheet === 'string'
        ? document.getElementById(options.sheet)
        : options.sheet || document.getElementById('filter-mobile-sheet');
    var sheetBody =
      typeof options.sheetBody === 'string'
        ? document.getElementById(options.sheetBody)
        : options.sheetBody || document.getElementById('filter-mobile-sheet-body');
    var sheetBackdrop =
      typeof options.sheetBackdrop === 'string'
        ? document.getElementById(options.sheetBackdrop)
        : options.sheetBackdrop || document.getElementById('filter-mobile-sheet-backdrop');
    var sheetClose =
      typeof options.sheetClose === 'string'
        ? document.getElementById(options.sheetClose)
        : options.sheetClose || document.getElementById('filter-mobile-sheet-close');
    var sheetClear =
      typeof options.sheetClear === 'string'
        ? document.getElementById(options.sheetClear)
        : options.sheetClear || document.getElementById('filter-mobile-sheet-clear');
    var sheetApply =
      typeof options.sheetApply === 'string'
        ? document.getElementById(options.sheetApply)
        : options.sheetApply || document.getElementById('filter-mobile-sheet-apply');
    var sheetTitle =
      typeof options.sheetTitleEl === 'string'
        ? document.getElementById(options.sheetTitleEl)
        : options.sheetTitleEl || document.getElementById('filter-mobile-sheet-title');
    var filterBar =
      typeof options.filterBar === 'string'
        ? document.querySelector(options.filterBar)
        : options.filterBar || document.querySelector('.events-filter-bar');
    var rowTop =
      typeof options.rowTop === 'string'
        ? document.querySelector(options.rowTop)
        : options.rowTop || document.querySelector('.filter-bar-row-top');
    var locationGroup =
      typeof options.locationGroup === 'string'
        ? document.querySelector(options.locationGroup)
        : options.locationGroup || document.querySelector('.filter-bar-location-group');
    var advanced =
      typeof options.advanced === 'string'
        ? document.getElementById(options.advanced)
        : options.advanced || document.getElementById('filter-bar-advanced');
    var inboxTitle =
      typeof options.inboxTitle === 'string'
        ? document.getElementById(options.inboxTitle)
        : options.inboxTitle || document.getElementById('events-filter-inbox-heading');

    if (!shell || !toggle || !sheet || !sheetBody || !filterBar || !advanced || toggle.dataset.bound) {
      return null;
    }
    toggle.dataset.bound = '1';

    var mq = window.matchMedia(options.mediaQuery || '(max-width: 900px)');
    var sheetOpen = false;
    var lastFocus = null;
    var bodyClass = options.bodyClass || 'events-filter-sheet-open';

    var desktopAnchors = {
      locationParent: rowTop,
      locationNext: toggle,
      advancedParent: filterBar,
      inboxParent: filterBar,
      inboxNext: rowTop,
    };

    var getTitle =
      typeof options.getTitle === 'function'
        ? options.getTitle
        : function () {
            return options.title || 'Filters';
          };

    var hasActive =
      typeof options.hasActiveFilters === 'function'
        ? options.hasActiveFilters
        : function () {
            return false;
          };

    var onApply =
      typeof options.onApply === 'function'
        ? options.onApply
        : function () {};

    var onClear =
      typeof options.onClear === 'function'
        ? options.onClear
        : function () {};

    function syncSheetTitle() {
      if (!sheetTitle) return;
      sheetTitle.textContent = getTitle();
    }

    function mountSheetContent() {
      syncSheetTitle();
      if (inboxTitle && inboxTitle.parentNode !== sheetBody) {
        sheetBody.appendChild(inboxTitle);
      }
      if (locationGroup && locationGroup.parentNode !== sheetBody) {
        sheetBody.appendChild(locationGroup);
      }
      if (advanced && advanced.parentNode !== sheetBody) {
        sheetBody.appendChild(advanced);
      }
    }

    function restoreDesktopContent() {
      if (inboxTitle && desktopAnchors.inboxParent) {
        desktopAnchors.inboxParent.insertBefore(inboxTitle, desktopAnchors.inboxNext);
      }
      if (locationGroup && desktopAnchors.locationParent) {
        desktopAnchors.locationParent.insertBefore(locationGroup, desktopAnchors.locationNext);
      }
      if (advanced && desktopAnchors.advancedParent) {
        desktopAnchors.advancedParent.appendChild(advanced);
      }
    }

    function setSheetOpen(open) {
      sheetOpen = open;
      shell.classList.toggle('is-filter-sheet-open', open);
      document.body.classList.toggle(bodyClass, open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      sheet.hidden = !open;
      sheet.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (open) {
        lastFocus = document.activeElement;
        mountSheetContent();
        if (sheetClose) sheetClose.focus();
      } else if (lastFocus && typeof lastFocus.focus === 'function') {
        lastFocus.focus();
        lastFocus = null;
      }
    }

    function openSheet() {
      if (!mq.matches) return;
      mountSheetContent();
      setSheetOpen(true);
    }

    function closeSheet() {
      setSheetOpen(false);
    }

    function syncMobileFilterToggle() {
      var mobile = mq.matches;
      toggle.hidden = !mobile;
      if (!mobile) {
        closeSheet();
        restoreDesktopContent();
        toggle.classList.remove('is-active-hint');
        if (badge) badge.hidden = true;
        return;
      }

      mountSheetContent();
      var active = hasActive();
      toggle.classList.toggle('is-active-hint', active);
      if (badge) {
        badge.hidden = !active;
        badge.textContent = active ? '•' : '';
      }
      if (sheetOpen) syncSheetTitle();
    }

    toggle.addEventListener('click', function () {
      if (sheetOpen) closeSheet();
      else openSheet();
    });

    if (sheetBackdrop) sheetBackdrop.addEventListener('click', closeSheet);
    if (sheetClose) sheetClose.addEventListener('click', closeSheet);
    if (sheetApply) {
      sheetApply.addEventListener('click', function () {
        onApply();
        closeSheet();
      });
    }
    if (sheetClear) {
      sheetClear.addEventListener('click', function () {
        onClear();
        syncMobileFilterToggle();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheetOpen) {
        e.preventDefault();
        closeSheet();
      }
    });

    if (mq.addEventListener) mq.addEventListener('change', syncMobileFilterToggle);
    else if (mq.addListener) mq.addListener(syncMobileFilterToggle);

    syncMobileFilterToggle();

    return {
      sync: syncMobileFilterToggle,
      open: openSheet,
      close: closeSheet,
    };
  }

  global.HUB_initMobileFilterSheet = initMobileFilterSheet;
})(typeof window !== 'undefined' ? window : globalThis);
