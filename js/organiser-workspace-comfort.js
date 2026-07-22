/**
 * Organiser workspace — larger text toggle and step-by-step page guides.
 */
(function () {
  var LARGE_TEXT_KEY = 'tnh_org_large_text_v1';

  try {
    if (localStorage.getItem(LARGE_TEXT_KEY) === '1') {
      document.body.classList.add('organiser-large-text');
    }
  } catch (e) {
    /* private mode */
  }

  var GUIDES = {
    dashboard: {
      title: 'How to use Overview',
      steps: [
        'Follow the setup checklist if you are just getting started.',
        'Use the sidebar for events, organiser pages, revenue, and business opportunities.',
        'Open Notifications when the badge shows something needs attention.',
        'Use + Add new to create an organiser page, event, or business opportunity listing.',
      ],
    },
    'events-list': {
      title: 'How to manage your events',
      steps: [
        'Click a row to open an event — edit details, tickets, or registrations.',
        'Use List event to create a new meeting, exhibition, or conference.',
        'Published events appear on the public Hub; drafts stay private until you publish.',
        'If you see Setup on the sidebar, finish bank details before selling paid tickets.',
      ],
    },
    'events-attendees': {
      title: 'How to manage attendees',
      steps: [
        'Filter by event to see who registered or applied.',
        'Approve or decline pending applications from the actions on each row.',
        'Export when you need a spreadsheet for your records.',
      ],
    },
    'events-revenue': {
      title: 'How to view revenue and payouts',
      steps: [
        'See ticket sales and expected payouts for each event.',
        'Connect bank details before you publish paid tickets.',
        'Request a payout after the event when funds are ready to transfer.',
      ],
    },
    'events-tickets': {
      title: 'How to manage tickets',
      steps: [
        'This tab summarises ticket types across your events.',
        'Open an event and go to Set up tickets for prices, members-only rates, and guest visits.',
      ],
    },
    groups: {
      title: 'How to manage your organiser page',
      steps: [
        'This is your public group profile on the Hub — add logo, description, and contact details.',
        'A complete page helps people trust your events before they book.',
        'Use Edit to update details, or view the public page to check how it looks.',
      ],
    },
    memberships: {
      title: 'How to manage memberships',
      steps: [
        'Create member lists for groups that offer members-only ticket rates.',
        'Invite people by email — they accept from their inbox.',
        'Link a list when setting up tickets on an event.',
      ],
    },
    'business-overview': {
      title: 'How to manage business opportunities',
      steps: [
        'Switch tabs to see your listings, enquiries, or performance.',
        'Approve new listings before they appear on the public site.',
        'Reply to enquiries promptly — you receive email when someone is interested.',
      ],
    },
    'business-listings': {
      title: 'How to manage business opportunities',
      steps: [
        'Switch tabs to see your listings, enquiries, or performance.',
        'Approve new listings before they appear on the public site.',
        'Reply to enquiries promptly — you receive email when someone is interested.',
      ],
    },
    'business-enquiries': {
      title: 'How to handle enquiries',
      steps: [
        'Each row is someone interested in your business opportunity listing.',
        'Open an enquiry to read their message and contact details.',
        'Reply directly from your email — the Hub notifies you when new enquiries arrive.',
      ],
    },
    'business-list': {
      title: 'How to list a business opportunity',
      steps: [
        'Fill in the title, description, and contact details clearly.',
        'Submit for review — the Hub team approves before it goes live.',
        'You can edit the listing later from My business opportunities.',
      ],
    },
    social: {
      title: 'How to share your event',
      steps: [
        'Pick an event or listing to build a social post draft.',
        'Edit the caption, then copy it or open LinkedIn, Facebook, or X to share.',
        'Featured upgrade options appear here if you want extra visibility.',
      ],
    },
    team: {
      title: 'How to manage your team',
      steps: [
        'Invite colleagues by email — they get access to this workspace.',
        'Pending invites show until they accept.',
        'Remove access when someone should no longer manage the group.',
      ],
    },
  };

  function esc(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function guideKeyFromLocation() {
    var hash = (location.hash || '').replace(/^#/, '').trim().toLowerCase();
    if (!hash || hash === 'dashboard') return 'dashboard';
    if (hash === 'promote' || hash === 'social') return 'social';
    if (
      hash === 'business-overview' ||
      hash === 'business-listings' ||
      hash === 'business-insights' ||
      hash === 'business-guide'
    ) {
      return 'business-overview';
    }
    if (hash === 'opportunity-enquiries' || hash === 'business-enquiries') return 'business-enquiries';
    if (hash === 'events' || hash === 'events-overview') return 'events-list';
    if (hash === 'tickets') return 'events-tickets';
    if (hash === 'member-lists') return 'memberships';
    return hash;
  }

  function readLargeTextPref() {
    try {
      return localStorage.getItem(LARGE_TEXT_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function applyLargeText(enabled) {
    document.body.classList.toggle('organiser-large-text', !!enabled);
    var btn = document.getElementById('org-large-text-toggle');
    if (!btn) return;
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    btn.textContent = enabled ? 'Normal text' : 'Larger text';
  }

  function setGuideOpen(open) {
    var wrap = document.getElementById('org-page-guide-wrap');
    var toggle = document.getElementById('org-guide-toggle');
    if (!wrap || !toggle) return;
    var show = !!open;
    wrap.classList.toggle('hidden', !show);
    wrap.hidden = !show;
    toggle.setAttribute('aria-expanded', show ? 'true' : 'false');
    toggle.textContent = show ? 'Hide guide' : 'How to use this page';
  }

  function syncPageGuide() {
    var guideKey = guideKeyFromLocation();
    var guide = GUIDES[guideKey];
    var toggle = document.getElementById('org-guide-toggle');
    var titleEl = document.getElementById('org-page-guide-title');
    var stepsEl = document.getElementById('org-page-guide-steps');
    if (!toggle || !titleEl || !stepsEl) return;

    setGuideOpen(false);

    if (!guide || !guide.steps || !guide.steps.length) {
      toggle.classList.add('hidden');
      toggle.hidden = true;
      stepsEl.innerHTML = '';
      return;
    }

    toggle.classList.remove('hidden');
    toggle.hidden = false;
    titleEl.textContent = guide.title || 'How to use this page';
    stepsEl.innerHTML = guide.steps
      .map(function (step) {
        return '<li>' + esc(step) + '</li>';
      })
      .join('');
  }

  function bindLargeTextToggle() {
    applyLargeText(readLargeTextPref());
    var btn = document.getElementById('org-large-text-toggle');
    if (!btn || btn.dataset.comfortBound) return;
    btn.dataset.comfortBound = '1';
    btn.addEventListener('click', function () {
      var next = !readLargeTextPref();
      try {
        localStorage.setItem(LARGE_TEXT_KEY, next ? '1' : '0');
      } catch (e) {
        /* private mode */
      }
      applyLargeText(next);
    });
  }

  function bindPageGuides() {
    var toggle = document.getElementById('org-guide-toggle');
    var closeBtn = document.getElementById('org-page-guide-close');
    if (toggle && !toggle.dataset.comfortBound) {
      toggle.dataset.comfortBound = '1';
      toggle.addEventListener('click', function () {
        var wrap = document.getElementById('org-page-guide-wrap');
        setGuideOpen(wrap && wrap.hidden);
      });
    }
    if (closeBtn && !closeBtn.dataset.comfortBound) {
      closeBtn.dataset.comfortBound = '1';
      closeBtn.addEventListener('click', function () {
        setGuideOpen(false);
      });
    }
  }

  function hookRouteChanges() {
    var orig = window.orgDashSetRoute;
    if (typeof orig !== 'function' || orig.__comfortHooked) return;
    function wrapped(route, options) {
      orig(route, options);
      syncPageGuide();
    }
    wrapped.__comfortHooked = true;
    window.orgDashSetRoute = wrapped;
  }

  function init() {
    bindLargeTextToggle();
    bindPageGuides();
    hookRouteChanges();
    syncPageGuide();
    window.addEventListener('hashchange', syncPageGuide);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
