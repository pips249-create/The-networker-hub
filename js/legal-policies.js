/**
 * Legal & policies — sidebar panel switching with hash URLs.
 */
(function () {
  var panels = [
    'overview',
    'privacy',
    'terms',
    'refunds',
    'organisers',
    'hub-rules',
    'cookies',
    'acceptable-use',
    'copyright',
    'advertising',
    'accessibility',
    'legal',
  ];

  var heroCopy = {
    overview: {
      kicker: 'Legal',
      title: 'Legal & policies',
      lede:
        'Plain-English policies for The Networker UK. Select a topic from the menu or read the overview below.',
    },
    privacy: {
      kicker: 'Legal · Privacy policy',
      title: 'Privacy policy',
      lede: 'How we collect, use and protect personal data under UK GDPR.',
    },
    terms: {
      kicker: 'Legal · Terms & conditions',
      title: 'Terms & conditions',
      lede: 'Rules for using the platform, accounts, listings and bookings.',
    },
    refunds: {
      kicker: 'Legal · Refunds & cancellations',
      title: 'Refunds & cancellations',
      lede: 'Ticket refunds, event cancellations and your consumer rights.',
    },
    organisers: {
      kicker: 'Legal · Organiser terms',
      title: 'Organiser terms',
      lede: 'Obligations for hosts listing events and opportunities.',
    },
    'hub-rules': {
      kicker: 'Legal · Platform rules',
      title: 'Platform rules',
      lede: 'Plain-English standards for organisers — listings, conduct, and enforcement.',
    },
    cookies: {
      kicker: 'Legal · Cookie policy',
      title: 'Cookie policy',
      lede: 'Cookies we use and how to manage your preferences.',
    },
    'acceptable-use': {
      kicker: 'Legal · Acceptable use',
      title: 'Acceptable use',
      lede: 'Community standards, reviews and prohibited conduct.',
    },
    copyright: {
      kicker: 'Legal · Copyright & content',
      title: 'Copyright & content',
      lede: 'How content on The Networker UK is owned, used and reported.',
    },
    advertising: {
      kicker: 'Legal · Advertising & sponsorship',
      title: 'Advertising & sponsorship',
      lede: 'Terms for paid placements and sponsored content on The Networker UK.',
    },
    accessibility: {
      kicker: 'Legal · Accessibility',
      title: 'Accessibility statement',
      lede: 'How we aim to make the platform usable for everyone.',
    },
    legal: {
      kicker: 'Legal · Legal information',
      title: 'Legal information',
      lede: 'Company details, complaints procedure and policy updates.',
    },
  };

  var defaultTitle = 'Legal & policies – The Networker UK';

  function updateHero(id) {
    var copy = heroCopy[id] || heroCopy.overview;
    var kicker = document.getElementById('legal-hero-kicker');
    var title = document.getElementById('legal-hero-title');
    var lede = document.getElementById('legal-hero-lede');
    if (kicker) kicker.textContent = copy.kicker;
    if (title) title.textContent = copy.title;
    if (lede) lede.textContent = copy.lede;
    document.title = id === 'overview' ? defaultTitle : copy.title + ' – The Networker UK';
  }

  function updateFooterNav(id) {
    document.querySelectorAll('[data-footer-policy]').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-footer-policy') === id);
    });
  }

  function showPolicy(id, options) {
    var opts = options || {};
    if (panels.indexOf(id) === -1) id = 'overview';

    panels.forEach(function (p) {
      var panel = document.getElementById('panel-' + p);
      var nav = document.getElementById('nav-' + p);
      if (panel) panel.classList.toggle('is-active', p === id);
      if (nav) nav.classList.toggle('is-active', p === id);
    });

    updateHero(id);
    updateFooterNav(id);

    if (opts.updateHash !== false) {
      var hash = id === 'overview' ? '' : '#' + id;
      if (location.hash !== hash) {
        history.replaceState(null, '', location.pathname + location.search + hash);
      }
    }

    if (!opts.skipScroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function bindNav() {
    document.querySelectorAll('[data-policy]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        var id = el.getAttribute('data-policy');
        if (!id) return;
        if (el.tagName === 'A' && el.getAttribute('href') && el.getAttribute('href').indexOf('#') === 0) {
          e.preventDefault();
        }
        showPolicy(id);
      });
    });
  }

  function initFromHash() {
    var hash = (location.hash || '').replace(/^#/, '');
    if (hash && panels.indexOf(hash) !== -1) {
      showPolicy(hash, { updateHash: false, skipScroll: true });
    } else {
      showPolicy('overview', { updateHash: false, skipScroll: true });
    }
  }

  window.showPolicy = showPolicy;
  bindNav();
  initFromHash();
  window.addEventListener('hashchange', initFromHash);
})();
