(function () {
  var DEMO_HUB_LOGO = '/assets/advertising-example-hub-logo.png';

  var LOREM_SHORT =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
  var LOREM_MEDIUM =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
  var LOREM_LONG =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

  var DEMO_SPONSOR = {
    active: true,
    logo_url: '/assets/advertising-example-everlasting-build.png',
    company_name: 'Everlasting Build',
    title: LOREM_SHORT,
    cta_label: 'Find out more →',
    cta_url: 'https://example.com',
  };

  var DEMO_OPPORTUNITIES_SPONSOR = {
    active: true,
    logo_url: DEMO_SPONSOR.logo_url,
    company_name: DEMO_SPONSOR.company_name,
    title: 'Renovations and construction for commercial premises across the North West.',
    cta_label: 'Find out more →',
    cta_url: DEMO_SPONSOR.cta_url,
  };

  var DEMO_MINI_SPONSORS = [
    DEMO_SPONSOR,
    {
      active: true,
      logo_url: '/assets/advertising-example-hub-logo.png',
      company_name: 'North West IT',
      cta_label: 'Find out more →',
      cta_url: 'https://example.com',
    },
  ];

  var EVENT_MAIN_EMAIL_PREVIEWS = {
    booking: {
      kicker: 'Booking confirmed',
      title: 'You\u2019re booked in',
      lede: 'Your place is reserved. We\u2019ve sent the details below. ' + LOREM_SHORT,
      detailHtml:
        '<div class="ad-full-email-event-wrap">' +
        '<div class="ad-full-email-event">' +
        '<p class="ad-full-email-event-kicker">Your event</p>' +
        '<p class="ad-full-email-event-name">Women in Business Breakfast</p>' +
        '<p class="ad-full-email-event-date"><span>When &amp; where</span><strong>Wed 14 Aug · Manchester · In person</strong></p>' +
        '<p class="ad-full-email-event-desc">' +
        LOREM_MEDIUM +
        '</p>' +
        '<div class="ad-full-email-event-meta">' +
        '<div><span>Ticket</span><strong>General admission</strong></div>' +
        '<div><span>Price</span><strong>Free</strong></div>' +
        '<div><span>Status</span><strong>Confirmed</strong></div>' +
        '</div>' +
        '<span class="ad-full-email-event-cta">View event details</span>' +
        '</div></div>',
    },
    reminder: {
      kicker: 'Event reminder',
      title: 'Your event is coming up',
      lede: 'A quick reminder about the event you booked on The Networker UK. ' + LOREM_SHORT,
      detailHtml:
        '<div class="ad-full-email-event-wrap">' +
        '<div class="ad-full-email-event">' +
        '<p class="ad-full-email-event-kicker">Coming up</p>' +
        '<p class="ad-full-email-event-name">Women in Business Breakfast</p>' +
        '<p class="ad-full-email-event-date"><span>When &amp; where</span><strong>Wed 14 Aug · 7:30am · Manchester</strong></p>' +
        '<span class="ad-full-email-event-cta">View event details</span>' +
        '</div></div>',
    },
    application: {
      kicker: 'Application approved',
      title: 'You\u2019re approved to attend',
      lede: 'The organiser has approved your application. Your place is confirmed. ' + LOREM_SHORT,
      detailHtml:
        '<div class="ad-full-email-event-wrap">' +
        '<div class="ad-full-email-event">' +
        '<p class="ad-full-email-event-kicker">Approved</p>' +
        '<p class="ad-full-email-event-name">Executive Roundtable — Manchester</p>' +
        '<p class="ad-full-email-event-date"><span>When &amp; where</span><strong>Thu 22 Aug · Manchester</strong></p>' +
        '<span class="ad-full-email-event-cta">View event details</span>' +
        '</div></div>',
    },
    refund: {
      kicker: 'Refund processed',
      title: 'Your refund is on its way',
      lede: 'We\u2019ve processed your refund for the booking below. ' + LOREM_SHORT,
      detailHtml:
        '<div class="ad-full-email-event-wrap">' +
        '<div class="ad-full-email-event">' +
        '<p class="ad-full-email-event-kicker">Refund summary</p>' +
        '<p class="ad-full-email-event-name">Women in Business Breakfast</p>' +
        '<p class="ad-full-email-event-date"><span>Amount</span><strong>£18.00</strong></p>' +
        '<div class="ad-full-email-event-meta">' +
        '<div><span>Status</span><strong>Processed</strong></div>' +
        '</div></div></div>',
    },
  };

  function demoSponsorBlock(block) {
    var source = block || DEMO_SPONSOR;
    return {
      active: source.active !== false,
      logo_url: source.logo_url,
      company_name: source.company_name,
      title: source.title || source.tagline,
      cta_label: source.cta_label,
      cta_url: source.cta_url,
    };
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function initHeroEntrance() {}

  function scrollToAnchor(id) {
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    window.setTimeout(function () {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }

  function initReveal() {
    var sections = document.querySelectorAll('.ad-reveal:not([hidden])');
    if (!sections.length) return;

    function revealAll() {
      sections.forEach(function (el) {
        el.classList.add('is-visible');
      });
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      revealAll();
      return;
    }

    if (!window.IntersectionObserver) {
      revealAll();
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      /* Generous margin so above-the-fold blocks reveal on mobile Safari */
      { rootMargin: '40px 0px 20% 0px', threshold: 0.01 }
    );

    sections.forEach(function (el) {
      io.observe(el);
    });

    /* Safety: never leave enquiry / packages stuck at opacity 0 */
    window.setTimeout(revealAll, 1200);
  }

  var PACKAGE_PANEL = {
    'ad-pkg-events-main': 'events',
    'ad-pkg-events-mini': 'events',
    'city-partner-package': 'events',
    'county-partner-package': 'events',
    'ad-pkg-events-spotlight': 'events',
    'ad-pkg-organisers-main': 'organisers',
    'ad-pkg-organisers-mini': 'organisers',
    'ad-pkg-organisers-spotlight': 'organisers',
    'ad-pkg-opportunities-main': 'opportunities',
    'ad-pkg-opportunities-mini': 'opportunities',
    'ad-pkg-opportunities-listing': 'opportunities',
    'ad-pkg-opportunities-spotlight': 'opportunities',
  };

  var ENQUIRY_SECTION_LABELS = {
    events: 'Events',
    organisers: 'Organisers',
    opportunities: 'Opportunities',
  };

  var STICKY_CTA_BY_SECTION = {
    events: { href: '#city-partner-package', text: 'City Sponsor · from £29/mo' },
    organisers: { href: '#ad-pkg-organisers-main', text: 'Headline · from £1,000/mo' },
    opportunities: { href: '#ad-pkg-opportunities-listing', text: 'List from £25/mo + VAT' },
  };

  var activeAdSection = 'events';

  var ENQUIRY_PACKAGES = {
    events: [
      'Headline Sponsor',
      'Event Page Partner',
      'City Sponsor',
      'County Sponsor',
      'Featured Event Boost',
      'Not sure yet',
    ],
    organisers: ['Headline Sponsor', 'Organiser Page Partner', 'Featured Organiser Boost', 'Not sure yet'],
    opportunities: [
      'Headline Sponsor',
      'Opportunity Page Partner',
      'Directory Listing',
      'Featured Opportunity Boost',
      'Not sure yet',
    ],
  };

  function packageLabelFromArticle(article) {
    var custom = article.getAttribute('data-ad-package-label');
    if (custom) return custom.trim();
    var badge = article.querySelector('.ad-package-badge');
    if (badge) return badge.textContent.trim();
    var title = article.querySelector('.ad-package-title');
    return title ? title.textContent.trim() : 'Package';
  }

  function packagePriceFromArticle(article) {
    var priceEl = article.querySelector('.ad-package-price');
    if (!priceEl) return '';
    var first = priceEl.childNodes[0];
    return first && first.nodeType === 3 ? first.textContent.trim() : priceEl.textContent.trim().split('\n')[0];
  }

  function syncStickyCta(section) {
    activeAdSection = section || activeAdSection || 'events';
    var cfg = STICKY_CTA_BY_SECTION[activeAdSection] || STICKY_CTA_BY_SECTION.events;
    var primary = document.getElementById('ad-sticky-cta-primary');
    if (!primary || !cfg) return;
    primary.href = cfg.href;
    primary.textContent = cfg.text;
  }

  function getActiveAdSection() {
    var active = document.querySelector('[data-ad-tab].is-active');
    return active ? active.getAttribute('data-ad-tab') || 'events' : activeAdSection || 'events';
  }

  function activatePackageInPanel(panel, packageId, options) {
    if (!panel || !packageId) return false;
    var browser = panel.querySelector('.ad-package-browser');
    if (!browser) return false;

    var tabs = browser.querySelectorAll('.ad-package-tab');
    var articles = browser.querySelectorAll('.ad-package');
    var found = false;

    articles.forEach(function (article) {
      var active = article.id === packageId;
      article.hidden = !active;
      article.classList.toggle('is-active-package', active);
      if (active) found = true;
    });

    tabs.forEach(function (tab) {
      var active = tab.getAttribute('data-ad-package-target') === packageId;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
    });

    if (found && options && options.scroll) {
      browser.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    return found;
  }

  function initPackageTabs() {
    document.querySelectorAll('.ad-tab-panel').forEach(function (panel) {
      var browser = panel.querySelector('.ad-package-browser');
      if (!browser) return;

      var packagesWrap = browser.querySelector('.ad-packages');
      if (!packagesWrap) return;

      var articles = packagesWrap.querySelectorAll('.ad-package');
      if (!articles.length) return;

      var nav = document.createElement('nav');
      nav.className = 'ad-package-tabs';
      nav.setAttribute('role', 'tablist');
      nav.setAttribute('aria-label', 'Packages');

      articles.forEach(function (article, index) {
        var id = article.id;
        if (!id) return;

        var label = packageLabelFromArticle(article);
        var price = packagePriceFromArticle(article);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ad-package-tab' + (index === 0 ? ' is-active' : '');
        btn.setAttribute('role', 'tab');
        btn.setAttribute('data-ad-package-target', id);
        btn.setAttribute('aria-controls', id);
        btn.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
        btn.tabIndex = index === 0 ? 0 : -1;
        btn.innerHTML =
          '<span class="ad-package-tab-label">' +
          esc(label) +
          '</span>' +
          (price ? '<span class="ad-package-tab-price">' + esc(price) + '</span>' : '');

        btn.addEventListener('click', function () {
          activatePackageInPanel(panel, id);
          if (history.replaceState) {
            history.replaceState(null, '', '#' + id);
          }
          window.dispatchEvent(new CustomEvent('ad-package-tab-change', { detail: { id: id } }));
        });

        nav.appendChild(btn);
        article.hidden = index !== 0;
        article.classList.toggle('is-active-package', index === 0);
      });

      browser.insertBefore(nav, packagesWrap);

      nav.addEventListener('keydown', function (e) {
        var tabs = Array.prototype.slice.call(nav.querySelectorAll('.ad-package-tab'));
        var current = document.activeElement;
        var idx = tabs.indexOf(current);
        if (idx < 0) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          var next = e.key === 'ArrowRight' ? idx + 1 : idx - 1;
          if (next < 0) next = tabs.length - 1;
          if (next >= tabs.length) next = 0;
          tabs[next].focus();
          tabs[next].click();
        }
      });
    });
  }

  function syncEnquiryFormSection(section) {
    var sectionEl = document.getElementById('ad-enquiry-section');
    var packageEl = document.getElementById('ad-enquiry-package');
    if (!sectionEl || !packageEl) return;

    var label = ENQUIRY_SECTION_LABELS[section] || 'Events';
    Array.prototype.forEach.call(sectionEl.options, function (opt) {
      opt.selected = opt.value === label;
    });

    var packages = ENQUIRY_PACKAGES[section] || ENQUIRY_PACKAGES.events;
    packageEl.innerHTML = packages
      .map(function (name) {
        return '<option value="' + esc(name) + '">' + esc(name) + '</option>';
      })
      .join('');
    packageEl.dispatchEvent(new Event('change'));
  }

  function prefillEnquiryForm(sectionLabel, packageName) {
    var sectionEl = document.getElementById('ad-enquiry-section');
    var packageEl = document.getElementById('ad-enquiry-package');
    if (!sectionEl || !packageEl) return;

    var sectionKey = 'events';
    if (sectionLabel === 'Organisers') sectionKey = 'organisers';
    if (sectionLabel === 'Opportunities') sectionKey = 'opportunities';

    if (sectionLabel) {
      Array.prototype.forEach.call(sectionEl.options, function (opt) {
        opt.selected = opt.value === sectionLabel;
      });
      syncEnquiryFormSection(sectionKey);
    }

    if (packageName) {
      var found = false;
      Array.prototype.forEach.call(packageEl.options, function (opt) {
        if (opt.value === packageName) found = true;
      });
      if (!found) {
        var extra = document.createElement('option');
        extra.value = packageName;
        extra.textContent = packageName;
        packageEl.appendChild(extra);
      }
      packageEl.value = packageName;
    }

    if (packageEl) {
      packageEl.dispatchEvent(new Event('change'));
    }
  }

  function setEnquiryStatus(message, type) {
    var statusEl = document.getElementById('ad-enquiry-status');
    if (!statusEl) return;
    if (!message) {
      statusEl.hidden = true;
      statusEl.textContent = '';
      statusEl.classList.remove('is-ok', 'is-error');
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.classList.toggle('is-ok', type === 'ok');
    statusEl.classList.toggle('is-error', type === 'error');
  }

  function initEnquiryJumps() {
    document.querySelectorAll('.ad-enquiry-jump').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var section = link.getAttribute('data-ad-enquiry-section');
        var pkg = link.getAttribute('data-ad-enquiry-package');
        if (!section && !pkg) return;
        e.preventDefault();
        prefillEnquiryForm(section, pkg);
        scrollToAnchor('ad-enquiry');
      });
    });
  }

  function setQuickEnquiryStatus(message, type) {
    var statusEl = document.getElementById('ad-enquiry-quick-status');
    if (!statusEl) return;
    if (!message) {
      statusEl.hidden = true;
      statusEl.textContent = '';
      statusEl.classList.remove('is-ok', 'is-error');
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.classList.toggle('is-ok', type === 'ok');
    statusEl.classList.toggle('is-error', type === 'error');
  }

  function submitAdvertisingEnquiry(payload, callbacks) {
    callbacks = callbacks || {};
    var send = function (body) {
      return fetch('/api/advertising', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data && result.data.ok) {
            if (callbacks.onOk) {
              callbacks.onOk(result.data.message || 'Thanks — our partnerships team will reply within one business day.');
            }
            return result;
          }
          var message =
            (result.data && result.data.message) ||
            'Could not send your enquiry. Email rosie@thenetworkeruk.com and our team will follow up.';
          if (callbacks.onError) callbacks.onError(message);
          return result;
        })
        .catch(function () {
          if (callbacks.onError) {
            callbacks.onError('Could not send your enquiry. Email rosie@thenetworkeruk.com and our team will follow up.');
          }
        });
    };

    if (callbacks.getTurnstileToken) {
      return callbacks.getTurnstileToken().then(function (token) {
        if (token) payload.turnstileToken = token;
        return send(payload);
      });
    }
    return send(payload);
  }

  function initQuickEnquiry() {
    var form = document.getElementById('ad-enquiry-quick-form');
    if (!form) return;

    var submitBtn = document.getElementById('ad-enquiry-quick-submit');
    var moreLink = document.getElementById('ad-enquiry-quick-more');
    var getTurnstileToken = function () {
      return Promise.resolve('');
    };
    if (window.HUB_turnstile && typeof window.HUB_turnstile.bindForm === 'function') {
      window.HUB_turnstile.bindForm(form).then(function (fn) {
        if (typeof fn === 'function') getTurnstileToken = fn;
      });
    }

    if (moreLink) {
      moreLink.addEventListener('click', function () {
        var quickName = form.querySelector('[name="name"]');
        var quickEmail = form.querySelector('[name="email"]');
        var mainForm = document.getElementById('ad-enquiry-form');
        if (!mainForm) return;
        if (quickName && quickName.value) {
          var nameField = mainForm.querySelector('[name="name"]');
          if (nameField) nameField.value = quickName.value;
        }
        if (quickEmail && quickEmail.value) {
          var emailField = mainForm.querySelector('[name="email"]');
          if (emailField) emailField.value = quickEmail.value;
        }
        syncEnquiryFormSection(getActiveAdSection());
        var sectionEl = document.getElementById('ad-enquiry-section');
        var packageEl = document.getElementById('ad-enquiry-package');
        if (sectionEl) {
          var label = ENQUIRY_SECTION_LABELS[getActiveAdSection()] || 'Events';
          Array.prototype.forEach.call(sectionEl.options, function (opt) {
            opt.selected = opt.value === label;
          });
        }
        if (packageEl) packageEl.value = 'Not sure yet';
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      setQuickEnquiryStatus('', '');

      var fd = new FormData(form);
      var section = ENQUIRY_SECTION_LABELS[getActiveAdSection()] || 'Events';
      var payload = {
        company: '',
        name: String(fd.get('name') || '').trim(),
        email: String(fd.get('email') || '').trim(),
        section: section,
        package: 'Not sure yet',
        budget: '',
        message: 'Quick enquiry from advertising page.',
        website: String(fd.get('website') || '').trim(),
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';
      }

      submitAdvertisingEnquiry(payload, {
        getTurnstileToken: getTurnstileToken,
        onOk: function (message) {
          setQuickEnquiryStatus(message, 'ok');
          form.reset();
        },
        onError: function (message) {
          setQuickEnquiryStatus(message, 'error');
        },
      }).finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Request recommendation →';
        }
      });
    });
  }

  function initEnquiryForm() {
    var form = document.getElementById('ad-enquiry-form');
    if (!form) return;

    var packageEl = document.getElementById('ad-enquiry-package');
    var cityPartnerNote = document.getElementById('ad-enquiry-city-partner-note');
    var submitBtn = document.getElementById('ad-enquiry-submit');
    var getTurnstileToken = function () {
      return Promise.resolve('');
    };
    if (window.HUB_turnstile && typeof window.HUB_turnstile.bindForm === 'function') {
      window.HUB_turnstile.bindForm(form).then(function (fn) {
        if (typeof fn === 'function') getTurnstileToken = fn;
      });
    }

    function isTerritorySponsorPackage(pkg) {
      return pkg === 'City Partner' || pkg === 'City Sponsor' || pkg === 'County Sponsor';
    }

    function syncEnquiryDurationOptions() {
      var durationEl = document.getElementById('ad-enquiry-duration');
      if (!durationEl || !packageEl) return;
      var hideShort = isTerritorySponsorPackage(String(packageEl.value || '').trim());
      Array.prototype.forEach.call(durationEl.options, function (opt) {
        var isShort = opt.getAttribute('data-ad-term-short') === 'true';
        opt.hidden = hideShort && isShort;
        opt.disabled = hideShort && isShort;
      });
      var selected = durationEl.options[durationEl.selectedIndex];
      if (selected && selected.disabled) {
        durationEl.value = 'Monthly (rolling)';
      }
    }

    function syncCityPartnerEnquiryNote() {
      if (!cityPartnerNote || !packageEl) return;
      var pkg = String(packageEl.value || '').trim();
      var isCityPartner = pkg === 'City Partner' || pkg === 'City Sponsor';
      cityPartnerNote.hidden = !isCityPartner;
    }

    if (packageEl) {
      packageEl.addEventListener('change', function () {
        syncCityPartnerEnquiryNote();
        syncEnquiryDurationOptions();
      });
      syncCityPartnerEnquiryNote();
      syncEnquiryDurationOptions();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      setEnquiryStatus('', '');

      var fd = new FormData(form);
      var payload = {
        company: String(fd.get('company') || '').trim(),
        name: String(fd.get('name') || '').trim(),
        email: String(fd.get('email') || '').trim(),
        section: String(fd.get('section') || '').trim(),
        package: String(fd.get('package') || '').trim(),
        duration: String(fd.get('duration') || '').trim(),
        budget: String(fd.get('budget') || '').trim(),
        message: String(fd.get('message') || '').trim(),
        website: String(fd.get('website') || '').trim(),
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';
      }

      submitAdvertisingEnquiry(payload, {
        getTurnstileToken: getTurnstileToken,
        onOk: function (message) {
          setEnquiryStatus(message, 'ok');
          form.reset();
          syncCityPartnerEnquiryNote();
        },
        onError: function (message) {
          setEnquiryStatus(message, 'error');
        },
      }).finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send enquiry →';
        }
      });
    });
  }

  function formatHeadlineSlotStatus(info) {
    if (!info) return '';
    if (info.available > 0) return 'Headline slot currently available';
    return 'Headline slot currently reserved — enquire to join the waitlist';
  }

  function formatPageSlotStatus(info) {
    if (!info) return '';
    if (info.available <= 0) {
      return 'All ' + info.max + ' slots currently taken — enquire to join the waitlist';
    }
    if (info.available === 1) return '1 of ' + info.max + ' slots available';
    return info.available + ' of ' + info.max + ' slots available';
  }

  function renderSlotAvailability(availability) {
    if (!availability) return;

    document.querySelectorAll('[data-ad-slot-key]').forEach(function (el) {
      var key = el.getAttribute('data-ad-slot-key');
      var text = '';
      if (key === 'headline-events') text = formatHeadlineSlotStatus(availability.headline && availability.headline.events);
      else if (key === 'headline-organisers') {
        text = formatHeadlineSlotStatus(availability.headline && availability.headline.organisers);
      } else if (key === 'headline-opportunities') {
        text = formatHeadlineSlotStatus(availability.headline && availability.headline.opportunities);
      } else if (key === 'page-events') text = formatPageSlotStatus(availability.pagePartner && availability.pagePartner.events);
      else if (key === 'page-organisers') {
        text = formatPageSlotStatus(availability.pagePartner && availability.pagePartner.organisers);
      } else if (key === 'page-opportunities') {
        text = formatPageSlotStatus(availability.pagePartner && availability.pagePartner.opportunities);
      }

      if (!text) {
        el.hidden = true;
        return;
      }

      el.hidden = false;
      el.textContent = text;
      el.classList.toggle('is-available', /available/i.test(text) && !/waitlist/i.test(text));
      el.classList.toggle('is-waitlist', /waitlist|taken|reserved/i.test(text));
    });
  }

  function loadSlotAvailability() {
    fetch('/api/advertising?route=availability')
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok || !data.availability) return;
        renderSlotAvailability(data.availability);
      })
      .catch(function () {});
  }

  function initStickyCta() {
    var bar = document.getElementById('ad-sticky-cta');
    var header = document.querySelector('.ad-page-header');
    var enquiry = document.getElementById('ad-enquiry');
    if (!bar || !header) return;

    syncStickyCta(getActiveAdSection());

    var primary = document.getElementById('ad-sticky-cta-primary');
    if (primary) {
      primary.addEventListener('click', function (e) {
        var hash = String(primary.getAttribute('href') || '').replace(/^#/, '').trim();
        if (!hash) return;
        e.preventDefault();
        jumpToPackage(hash);
        if (history.replaceState) {
          history.replaceState(null, '', '#' + hash);
        } else {
          location.hash = hash;
        }
      });
    }

    var showBar = false;
    var hideForEnquiry = false;

    function cookieBannerOpen() {
      var banner = document.getElementById('hub-cookie-banner');
      return !!(banner && !banner.hidden);
    }

    function updateBar() {
      var hide = !showBar || hideForEnquiry || cookieBannerOpen();
      bar.hidden = hide;
      document.body.classList.toggle('ad-sticky-cta-active', !hide);
    }

    if ('IntersectionObserver' in window) {
      var headerObserver = new IntersectionObserver(
        function (entries) {
          showBar = !entries[0].isIntersecting;
          updateBar();
        },
        { threshold: 0 }
      );
      headerObserver.observe(header);

      if (enquiry) {
        var enquiryObserver = new IntersectionObserver(
          function (entries) {
            hideForEnquiry = entries[0].isIntersecting;
            updateBar();
          },
          { threshold: 0.12 }
        );
        enquiryObserver.observe(enquiry);
      }
    } else {
      showBar = true;
      updateBar();
    }

    var cookieBanner = document.getElementById('hub-cookie-banner');
    if (cookieBanner && typeof MutationObserver !== 'undefined') {
      new MutationObserver(updateBar).observe(cookieBanner, {
        attributes: true,
        attributeFilter: ['hidden', 'class', 'style'],
      });
    }
    document.addEventListener('hub:cookie-consent-changed', updateBar);
    updateBar();
  }

  function buildMiniSponsorsRowHtml() {
    return DEMO_MINI_SPONSORS.slice()
      .map(function (item) {
        var logo = String(item.logo_url || '').trim();
        var company = String(item.company_name || '').trim();
        if (logo) {
          return (
            '<img src="' +
            esc(logo) +
            '" alt="' +
            esc(company) +
            '" loading="lazy" decoding="async">'
          );
        }
        return (
          '<span class="ad-full-email-mini-row-placeholder" aria-hidden="true">' +
          esc(company || 'Partner') +
          '</span>'
        );
      })
      .join('');
  }

  function renderMiniSponsorsRowEmailShell(container, config) {
    if (!container) return;
    renderSponsorEmailPreview(container, null, Object.assign({}, config, {
      skipMainSponsor: true,
      beforeFooterHtml:
        '<div class="ad-full-email-mini-row">' +
        '<p class="ad-full-email-mini-row-label">Powered by</p>' +
        '<div class="ad-full-email-mini-row-logos">' +
        buildMiniSponsorsRowHtml() +
        '</div>' +
        '</div>',
    }));
  }

  function renderMiniSponsorEmailPreview(container) {
    if (!container) return;
    renderMiniSponsorsRowEmailShell(container, {
      kicker: 'Booking confirmed',
      title: 'You\u2019re booked in',
      lede: 'Your place is reserved. We\u2019ve sent the details below. ' + LOREM_SHORT,
      detailHtml:
        '<div class="ad-full-email-event-wrap">' +
        '<div class="ad-full-email-event">' +
        '<p class="ad-full-email-event-kicker">Your event</p>' +
        '<p class="ad-full-email-event-name">Women in Business Breakfast</p>' +
        '<p class="ad-full-email-event-date"><span>When &amp; where</span><strong>Wed 14 Aug · Manchester</strong></p>' +
        '<p class="ad-full-email-event-desc">' +
        LOREM_MEDIUM +
        '</p>' +
        '</div>' +
        '</div>',
    });
  }

  function renderOrganiserMiniSponsorEmailPreview(container) {
    if (!container) return;
    renderMiniSponsorsRowEmailShell(container, {
      kicker: 'New registration',
      title: 'Welcome to your organiser workspace',
      lede:
        'Your organiser account is ready. You can start listing events and managing your group from the dashboard. ' +
        LOREM_SHORT,
      detailHtml:
        '<div class="ad-full-email-event-wrap">' +
        '<div class="ad-full-email-event">' +
        '<p class="ad-full-email-event-kicker">Your account</p>' +
        '<p class="ad-full-email-event-name">Manchester Business Network</p>' +
        '<p class="ad-full-email-event-date"><span>Next step</span><strong>Publish your first event</strong></p>' +
        '<p class="ad-full-email-event-desc">' +
        LOREM_MEDIUM +
        '</p>' +
        '<span class="ad-full-email-event-cta">Open organiser dashboard</span>' +
        '</div>' +
        '</div>',
    });
  }

  function renderOpportunityMiniSponsorEmailPreview(container) {
    if (!container) return;
    renderMiniSponsorsRowEmailShell(container, {
      kicker: 'Listing live',
      title: 'Your opportunity is now live',
      lede:
        'Your business opportunity listing is published and visible to members browsing the directory. ' +
        LOREM_SHORT,
      detailHtml:
        '<div class="ad-full-email-event-wrap">' +
        '<div class="ad-full-email-event">' +
        '<p class="ad-full-email-event-kicker">Your listing</p>' +
        '<p class="ad-full-email-event-name">Coffee shop franchise — Manchester</p>' +
        '<p class="ad-full-email-event-date"><span>Category</span><strong>Franchise · North West</strong></p>' +
        '<p class="ad-full-email-event-desc">' +
        LOREM_MEDIUM +
        '</p>' +
        '<div class="ad-full-email-event-meta">' +
        '<div><span>Status</span><strong>Live</strong></div>' +
        '<div><span>Enquiries</span><strong>Open</strong></div>' +
        '</div>' +
        '<span class="ad-full-email-event-cta">View listing</span>' +
        '</div>' +
        '</div>',
    });
  }

  function syncSectionPackages(section) {
    syncEnquiryFormSection(section);
  }

  function jumpToPackage(id) {
    if (!id) return;
    var panelName = PACKAGE_PANEL[id];
    if (panelName) {
      var tabsRoot = document.getElementById('ad-section-picks');
      var tab = tabsRoot && tabsRoot.querySelector('[data-ad-tab="' + panelName + '"]');
      if (tab && !tab.classList.contains('is-active')) {
        tab.click();
      }
    }

    window.setTimeout(function () {
      var panel = panelName
        ? document.querySelector('[data-ad-panel="' + panelName + '"]')
        : null;
      if (panel) {
        activatePackageInPanel(panel, id, { scroll: true });
      }
      var el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.remove('ad-package--highlight');
      void el.offsetWidth;
      el.classList.add('ad-package--highlight');

      if (id === 'city-partner-package') {
        var checkout = document.getElementById('city-partner-checkout');
        var availablePanel = document.getElementById('city-partner-available-panel');
        if (availablePanel) availablePanel.open = true;
        if (checkout) {
          window.setTimeout(function () {
            checkout.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 280);
        }
      }
      if (id === 'county-partner-package') {
        var countyCheckout = document.getElementById('county-partner-checkout');
        var countyPanel = document.getElementById('county-partner-available-panel');
        if (countyPanel) countyPanel.open = true;
        if (countyCheckout) {
          window.setTimeout(function () {
            countyCheckout.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 280);
        }
      }
      if (id === 'ad-pkg-opportunities-mini') {
        var oppCheckout = document.getElementById('opportunity-page-partner-checkout');
        if (oppCheckout) {
          window.setTimeout(function () {
            oppCheckout.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 280);
        }
      }
    }, panelName ? 80 : 0);
  }

  function initTabJumpLinks() {
    document.querySelectorAll('[data-ad-tab-jump]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var targetTab = link.getAttribute('data-ad-tab-jump');
        var hash = String(link.getAttribute('href') || '').replace(/^#/, '');
        if (!targetTab || !hash) return;
        e.preventDefault();
        var tabsRoot = document.getElementById('ad-section-picks');
        var tab = tabsRoot && tabsRoot.querySelector('[data-ad-tab="' + targetTab + '"]');
        if (tab && !tab.classList.contains('is-active')) {
          tab.click();
        }
        window.setTimeout(function () {
          jumpToPackage(hash);
        }, 80);
      });
    });
  }

  function logoFromBlock(block) {
    if (!block || !window.CmsSponsorFields) return '';
    return window.CmsSponsorFields.logoUrl(block);
  }

  function companyFromBlock(block) {
    if (!block || !window.CmsSponsorFields) return '';
    return window.CmsSponsorFields.companyName(block);
  }

  function ctaUrlFromBlock(block) {
    if (!block) return '#';
    var url = String(block.cta_url || '').trim();
    if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
    if (url.charAt(0) === '/' || url.charAt(0) === '#') return url;
    return '#';
  }

  function renderEmptyPreview(container, message) {
    if (!container) return;
    container.innerHTML =
      '<p class="ad-live-empty">' + esc(message || 'Live example not configured yet.') + '</p>';
  }

  function renderDemoHeroSponsor(container, block) {
    if (!container) return;
    block = block || DEMO_SPONSOR;
    var logo = String(block.logo_url || '').trim();
    var company = String(block.company_name || '').trim();
    var tagline = String(block.title || block.tagline || '').trim();
    var ctaLabel = String(block.cta_label || 'Find out more →').trim();
    var logoOnly = Boolean(logo);

    container.innerHTML =
      '<aside class="ad-mock-sponsor' +
      (logoOnly ? ' ad-mock-sponsor--logo-only' : '') +
      '">' +
      '<span class="ad-mock-sponsor-badge">Sponsored</span>' +
      '<div class="ad-mock-logo-band">' +
      (logo
        ? '<img src="' +
          esc(logo) +
          '" alt="' +
          esc(company) +
          '" class="ad-mock-sponsor-logo-img" loading="lazy" decoding="async">'
        : '<span class="ad-mock-logo">' + esc(company || 'Your logo') + '</span>') +
      '</div>' +
      (!logoOnly && company ? '<p class="ad-mock-tagline"><strong>' + esc(company) + '</strong></p>' : '') +
      (!logoOnly && tagline ? '<p class="ad-mock-tagline-desc">' + esc(tagline) + '</p>' : '') +
      (!logoOnly ? '<span class="ad-mock-cta">' + esc(ctaLabel) + '</span>' : '') +
      '</aside>';
  }

  function renderDemoMiniSponsor(container, blocks) {
    if (!container) return;
    var list = (Array.isArray(blocks) ? blocks : [blocks || DEMO_SPONSOR]).filter(Boolean);
    if (!list.length) list = [DEMO_SPONSOR];

    if (list.length === 1) {
      var single = list[0];
      var logo = String(single.logo_url || '').trim();
      container.innerHTML =
        '<aside class="ad-mock-carousel">' +
        '<span class="ad-mock-carousel-badge">Sponsored</span>' +
        '<div class="ad-mock-carousel-logos ad-mock-carousel-logos--single">' +
        (logo
          ? '<img src="' +
            esc(logo) +
            '" alt="" class="ad-mock-carousel-logo-img" loading="lazy" decoding="async">'
          : '<span class="is-active">Your logo</span>') +
        '</div>' +
        '<div class="ad-mock-carousel-dots" aria-hidden="true"><i class="is-active"></i></div>' +
        '</aside>';
      return;
    }

    var dots = list
      .map(function (_block, index) {
        return '<i' + (index === 0 ? ' class="is-active"' : '') + '></i>';
      })
      .join('');
    var slides = list
      .map(function (block, index) {
        var slideLogo = String(block.logo_url || '').trim();
        var company = String(block.company_name || 'Partner').trim();
        var inner = slideLogo
          ? '<img src="' +
            esc(slideLogo) +
            '" alt="' +
            esc(company) +
            '" class="ad-mock-carousel-logo-img" loading="lazy" decoding="async">'
          : '<span>' + esc(company) + '</span>';
        return (
          '<div class="ad-mock-carousel-slide' +
          (index === 0 ? ' is-active' : '') +
          '" data-demo-slide="' +
          index +
          '">' +
          inner +
          '</div>'
        );
      })
      .join('');

    container.innerHTML =
      '<aside class="ad-mock-carousel ad-mock-carousel--live">' +
      '<span class="ad-mock-carousel-badge">Sponsored</span>' +
      '<div class="ad-mock-carousel-logos ad-mock-carousel-logos--carousel">' +
      slides +
      '</div>' +
      '<div class="ad-mock-carousel-dots" aria-hidden="true">' +
      dots +
      '</div>' +
      '</aside>';

    var slidesEls = container.querySelectorAll('[data-demo-slide]');
    var dotEls = container.querySelectorAll('.ad-mock-carousel-dots i');
    dotEls.forEach(function (dot, index) {
      dot.addEventListener('click', function () {
        slidesEls.forEach(function (slide, slideIndex) {
          slide.classList.toggle('is-active', slideIndex === index);
        });
        dotEls.forEach(function (item, dotIndex) {
          item.classList.toggle('is-active', dotIndex === index);
        });
      });
    });
  }

  function renderDemoCompactAd(container, block) {
    if (!container) return;
    block = block || DEMO_SPONSOR;
    var logo = String(block.logo_url || '').trim();

    container.innerHTML =
      '<aside class="ad-mock-compact ad-mock-compact--logo-only">' +
      '<span class="ad-mock-compact-badge">Sponsored</span>' +
      '<div class="ad-mock-compact-logo-wrap">' +
      (logo
        ? '<img src="' +
          esc(logo) +
          '" alt="" class="ad-mock-compact-logo-img" loading="lazy" decoding="async">'
        : '<span class="ad-mock-compact-logo-placeholder">Your logo</span>') +
      '</div>' +
      '</aside>';
  }

  function renderHeroInShell(shell, block) {
    if (!shell) return;
    var payload = demoSponsorBlock(block);
    if (window.CmsAdBlocks && window.CmsAdBlocks.renderHeroSponsorAd) {
      window.CmsAdBlocks.renderHeroSponsorAd(shell, payload);
      return;
    }
    renderDemoHeroSponsor(shell, payload);
  }

  function renderMiniInShell(shell, blocks, slot) {
    if (!shell) return;
    var list = Array.isArray(blocks) ? blocks : [blocks || DEMO_SPONSOR];
    var payloads = list.map(function (block) {
      return demoSponsorBlock(block);
    });
    if (window.CmsAdBlocks && window.CmsAdBlocks.renderCarouselAd) {
      window.CmsAdBlocks.renderCarouselAd(shell, payloads, slot || 'event_page_carousel_ads', {
        shuffle: false,
      });
      return;
    }
    renderDemoMiniSponsor(shell, payloads);
  }

  function renderCompactInShell(shell, block, slot) {
    if (!shell) return;
    var payload = demoSponsorBlock(block);
    if (window.CmsAdBlocks && window.CmsAdBlocks.renderCompactAd) {
      window.CmsAdBlocks.renderCompactAd(shell, payload, slot || 'opportunity_page_sidebar_ad');
      return;
    }
    renderDemoCompactAd(shell, payload);
  }

  function renderAdvertisingHeroPreview(shell, block) {
    if (!shell) return;
    renderHeroInShell(shell, demoSponsorBlock(block || DEMO_SPONSOR));
  }

  function loadHeroPreview(shell, slot, fallbackBlock) {
    if (!shell) return Promise.resolve();
    if (!window.CmsAdBlocks || !window.CmsAdBlocks.loadCmsAd) {
      renderHeroInShell(shell, fallbackBlock);
      return Promise.resolve();
    }
    return window.CmsAdBlocks.loadCmsAd(slot)
      .then(function (block) {
        renderHeroInShell(shell, block && block.active !== false ? block : fallbackBlock);
      })
      .catch(function () {
        renderHeroInShell(shell, fallbackBlock);
      });
  }

  function buildSponsorEmailRow(block) {
    var logo = logoFromBlock(block);
    var company = companyFromBlock(block);
    var url = ctaUrlFromBlock(block);
    var hasLogo = !!(logo && String(logo).trim());
    var logoInner = hasLogo
      ? '<img src="' +
        esc(logo) +
        '" alt="' +
        esc(company || 'Sponsor') +
        '" class="ad-full-email-sponsor-logo" loading="lazy" decoding="async">'
      : '<span class="ad-full-email-sponsor-name">' + esc(company || 'Sponsor logo') + '</span>';
    return (
      '<div class="ad-full-email-sponsor ad-full-email-sponsor--highlight">' +
      '<p class="ad-full-email-sponsor-label">Powered by</p>' +
      (url !== '#' ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + logoInner + '</a>' : logoInner) +
      '</div>'
    );
  }

  function renderSponsorEmailPreview(container, block, config) {
    if (!container) return;
    config = config || {};
    if (!config.skipMainSponsor && (!block || block.active === false)) {
      renderEmptyPreview(container);
      return;
    }

    var sponsorRow = config.skipMainSponsor ? '' : buildSponsorEmailRow(block);
    container.innerHTML =
      '<div class="ad-full-email-card">' +
      '<div class="ad-full-email-header">' +
      '<img src="' +
      DEMO_HUB_LOGO +
      '" alt="" class="ad-full-email-hub-logo">' +
      sponsorRow +
      '<div class="ad-full-email-wave" aria-hidden="true"></div>' +
      '</div>' +
      '<div class="ad-full-email-body">' +
      '<div class="ad-full-email-check" aria-hidden="true"></div>' +
      '<p class="ad-full-email-kicker">' +
      esc(config.kicker || 'Update from The Networker UK') +
      '</p>' +
      '<p class="ad-full-email-title">' +
      esc(config.title || 'You have a new notification') +
      '</p>' +
      '<p class="ad-full-email-lede">' +
      esc(config.lede || 'Details are included below for your records.') +
      '</p>' +
      '<p class="ad-full-email-lorem">' +
      esc(config.lorem || LOREM_MEDIUM) +
      '</p>' +
      '</div>' +
      (config.detailHtml || '') +
      (config.beforeFooterHtml || '') +
      '<div class="ad-full-email-footer">' +
      '<p class="ad-full-email-footer-note">Questions? Lorem ipsum dolor sit amet — reply to this email or visit your account.</p>' +
      '</div>' +
      '<div class="ad-full-email-brand">' +
      '<img src="' +
      DEMO_HUB_LOGO +
      '" alt="" class="ad-full-email-hub-logo ad-full-email-hub-logo--sm">' +
      '<p class="ad-full-email-brand-name">The Networker UK</p>' +
      '</div>' +
      '</div>';
  }

  function renderEventMainEmailPreview(container, previewKey) {
    var config = EVENT_MAIN_EMAIL_PREVIEWS[previewKey] || EVENT_MAIN_EMAIL_PREVIEWS.booking;
    renderSponsorEmailPreview(container, DEMO_SPONSOR, config);
  }

  function renderFullBookingEmail(container, block) {
    renderEventMainEmailPreview(container, 'booking');
  }

  function renderOrganiserEmailPreview(container, block) {
    renderSponsorEmailPreview(container, block, {
      kicker: 'Payout approved',
      title: 'Your payout is on its way',
      lede: 'We\u2019ve approved your payout request. Funds should arrive within 3\u20135 working days. ' + LOREM_SHORT,
      detailHtml:
        '<div class="ad-full-email-event-wrap">' +
        '<div class="ad-full-email-event">' +
        '<p class="ad-full-email-event-kicker">Payout summary</p>' +
        '<p class="ad-full-email-event-name">Manchester Business Network</p>' +
        '<p class="ad-full-email-event-date"><span>Amount</span><strong>£420.00</strong></p>' +
        '<p class="ad-full-email-event-desc">' +
        LOREM_MEDIUM +
        '</p>' +
        '<div class="ad-full-email-event-meta">' +
        '<div><span>Reference</span><strong>PO-10482</strong></div>' +
        '<div><span>Status</span><strong>Approved</strong></div>' +
        '</div>' +
        '</div>' +
        '</div>',
    });
  }

  function renderOpportunityEmailPreview(container, block) {
    renderSponsorEmailPreview(container, block, {
      kicker: 'Listing live',
      title: 'Your opportunity is now live',
      lede: 'Your business opportunity listing is published and visible to members browsing the directory. ' + LOREM_SHORT,
      detailHtml:
        '<div class="ad-full-email-event-wrap">' +
        '<div class="ad-full-email-event">' +
        '<p class="ad-full-email-event-kicker">Your listing</p>' +
        '<p class="ad-full-email-event-name">Coffee shop franchise — Manchester</p>' +
        '<p class="ad-full-email-event-date"><span>Category</span><strong>Franchise · North West</strong></p>' +
        '<p class="ad-full-email-event-desc">' +
        LOREM_MEDIUM +
        '</p>' +
        '<div class="ad-full-email-event-meta">' +
        '<div><span>Status</span><strong>Live</strong></div>' +
        '<div><span>Enquiries</span><strong>Open</strong></div>' +
        '</div>' +
        '<span class="ad-full-email-event-cta">View listing</span>' +
        '</div>' +
        '</div>',
    });
  }

  function loadMainSponsorGallery() {
    var eventsShell = document.getElementById('ad-live-events-hero');
    var emailShell = document.getElementById('ad-live-full-email');
    if (!eventsShell && !emailShell) return;

    renderAdvertisingHeroPreview(eventsShell, DEMO_SPONSOR);
    renderEventMainEmailPreview(emailShell, 'booking');
  }

  function loadSectionHeroPreviews() {
    renderAdvertisingHeroPreview(
      document.getElementById('ad-live-opportunities-hero'),
      DEMO_OPPORTUNITIES_SPONSOR
    );
    renderAdvertisingHeroPreview(
      document.getElementById('ad-live-organisers-hero'),
      DEMO_SPONSOR
    );
    renderOrganiserEmailPreview(document.getElementById('ad-live-organisers-email'), DEMO_SPONSOR);
    renderOpportunityEmailPreview(
      document.getElementById('ad-live-opportunities-email'),
      DEMO_OPPORTUNITIES_SPONSOR
    );
  }

  function loadOpportunitySidebarPreview() {
    renderMiniInShell(
      document.getElementById('ad-live-mini-opportunity'),
      DEMO_MINI_SPONSORS,
      'opportunity_page_carousel_ads'
    );
    renderOpportunityMiniSponsorEmailPreview(
      document.getElementById('ad-live-opportunity-mini-email')
    );
  }

  function loadLivePreviews() {
    loadMainSponsorGallery();
    loadSectionHeroPreviews();
    loadOpportunitySidebarPreview();
    initExampleGallery(document.getElementById('ad-main-sponsor-gallery'), {
      onActivate: function (example, thumb) {
        if (example !== 'email') return;
        var key = (thumb && thumb.getAttribute('data-email-preview')) || 'booking';
        renderEventMainEmailPreview(document.getElementById('ad-live-full-email'), key);
      },
    });
    initExampleGallery(document.getElementById('ad-organisers-main-gallery'));
    initExampleGallery(document.getElementById('ad-opportunities-main-gallery'));

    initExampleGallery(document.getElementById('ad-events-mini-gallery'));
    initExampleGallery(document.getElementById('ad-organisers-mini-gallery'));
    initExampleGallery(document.getElementById('ad-opportunity-mini-gallery'));
    initExampleGallery(document.getElementById('ad-opp-listing-gallery'));

    renderMiniInShell(document.getElementById('ad-live-mini-event'), DEMO_MINI_SPONSORS, 'event_page_carousel_ads');
    renderMiniSponsorEmailPreview(document.getElementById('ad-live-mini-event-email'));
    renderMiniInShell(
      document.getElementById('ad-live-mini-organisers-dir'),
      DEMO_MINI_SPONSORS,
      'organiser_page_carousel_ads'
    );
    renderOrganiserMiniSponsorEmailPreview(document.getElementById('ad-live-mini-organisers-email'));
  }

  function initExampleGallery(root, options) {
    if (!root) return;
    options = options || {};
    var thumbs = root.querySelectorAll('.ad-example-thumb');
    var panels = root.querySelectorAll('[data-example-panel]');
    var examples = [];

    thumbs.forEach(function (btn) {
      examples.push(btn.getAttribute('data-example'));
    });

    function activate(example, thumb) {
      thumbs.forEach(function (btn) {
        var active =
          btn.getAttribute('data-example') === example &&
          (!thumb ||
            !thumb.getAttribute('data-email-preview') ||
            btn.getAttribute('data-email-preview') === thumb.getAttribute('data-email-preview'));
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.tabIndex = active ? 0 : -1;
      });
      panels.forEach(function (panel) {
        var show = panel.getAttribute('data-example-panel') === example;
        panel.hidden = !show;
        panel.classList.toggle('is-active', show);
      });
      if (options.onActivate) options.onActivate(example, thumb);
    }

    thumbs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activate(btn.getAttribute('data-example'), btn);
      });
    });

    activate(examples[0] || 'events', thumbs[0] || null);
  }


  function initPackageReveal() {
    document.querySelectorAll('.ad-package').forEach(function (pkg) {
      pkg.classList.add('ad-package-reveal', 'is-visible');
    });
  }

  function refreshPackageReveal(panel) {
    if (!panel) return;
    panel.querySelectorAll('.ad-package.is-active-package').forEach(function (pkg) {
      pkg.classList.add('is-visible');
    });
  }

  function syncSectionPicks(target) {
    document.querySelectorAll('[data-ad-tab]').forEach(function (pick) {
      var active = pick.getAttribute('data-ad-tab') === target;
      pick.classList.toggle('is-active', active);
      pick.setAttribute('aria-selected', active ? 'true' : 'false');
      pick.tabIndex = active ? 0 : -1;
    });
  }

  function initTabs() {
    var tabsRoot = document.getElementById('ad-section-picks');
    if (!tabsRoot) return;

    var tabs = tabsRoot.querySelectorAll('[role="tab"]');
    var panels = document.querySelectorAll('[data-ad-panel]');

    function activateTab(tab, options) {
      var target = tab.getAttribute('data-ad-tab');
      if (!target) return;

      syncSectionPicks(target);

      panels.forEach(function (panel) {
        var show = panel.getAttribute('data-ad-panel') === target;
        panel.hidden = !show;
        panel.classList.toggle('is-active', show);
        if (show) refreshPackageReveal(panel);
      });

      syncSectionPackages(target);
      syncStickyCta(target);

      var preserveHash = options && options.preserveHash;
      var anchor = options && options.anchor;
      if (history.replaceState && !preserveHash) {
        history.replaceState(null, '', anchor ? '#' + anchor : '#ad-panel-' + target);
      }

      if (anchor) {
        window.setTimeout(function () {
          activatePackageInPanel(
            document.querySelector('[data-ad-panel="' + target + '"]'),
            anchor,
            { scroll: true }
          );
        }, 40);
      }
    }

    function activateByName(name, options) {
      var tab = tabsRoot.querySelector('[data-ad-tab="' + name + '"]');
      if (tab) activateTab(tab, options || {});
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        activateTab(tab);
      });
      tab.addEventListener('keydown', function (e) {
        var idx = Array.prototype.indexOf.call(tabs, tab);
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          var next = e.key === 'ArrowRight' ? idx + 1 : idx - 1;
          if (next < 0) next = tabs.length - 1;
          if (next >= tabs.length) next = 0;
          tabs[next].focus();
          activateTab(tabs[next]);
        }
      });
    });

    var initial = tabFromHash(location.hash) || 'events';
    var hashAnchor = packageFromHash(location.hash);
    var startTab = tabsRoot.querySelector('[data-ad-tab="' + initial + '"]') || tabs[0];
    if (startTab) {
      activateTab(startTab, {
        preserveHash: true,
        anchor: hashAnchor,
      });
    }

    window.addEventListener('hashchange', function () {
      var want = tabFromHash(location.hash);
      if (!want) return;
      var hashId = packageFromHash(location.hash);
      activateByName(want, {
        anchor: hashId,
      });
    });
  }

  function tabFromHash(hash) {
    var want = String(hash || '').replace(/^#/, '').trim();
    if (!want) return null;
    if (PACKAGE_PANEL[want]) return PACKAGE_PANEL[want];
    var lower = want.toLowerCase();
    if (lower === 'events' || lower === 'ad-panel-events') return 'events';
    if (lower === 'organisers' || lower === 'ad-panel-organisers') return 'organisers';
    if (lower === 'opportunities' || lower === 'ad-panel-opportunities') return 'opportunities';
    return null;
  }

  function packageFromHash(hash) {
    var want = String(hash || '').replace(/^#/, '').trim();
    return PACKAGE_PANEL[want] ? want : '';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initHeroEntrance();
      initReveal();
      initTabs();
      initPackageTabs();
      initPackageReveal();
      initTabJumpLinks();
      initEnquiryJumps();
      initQuickEnquiry();
      initEnquiryForm();
      initStickyCta();
      loadSlotAvailability();
      loadLivePreviews();
    });
  } else {
    initHeroEntrance();
    initReveal();
    initTabs();
    initPackageTabs();
    initPackageReveal();
    initTabJumpLinks();
    initEnquiryJumps();
    initQuickEnquiry();
    initEnquiryForm();
    initStickyCta();
    loadSlotAvailability();
    loadLivePreviews();
  }
})();
