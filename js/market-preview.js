/**
 * Market preview gate — thenetworkerireland.com / thenetworkerusa.com
 */
(function () {
  var MARKETS = {
    IE: {
      iso2: 'IE',
      name: 'Ireland',
      brand: 'The Networker Ireland',
      adjective: 'Irish',
      badge: 'Building · coming soon',
      kicker: 'Ireland business networking',
      source: 'market_preview_ie',
      canonical: 'https://www.thenetworkerireland.com/',
      logo: '/assets/logo-networker-ireland.png?v=20260825mkt4',
      groupPlaceholder: 'e.g. Dublin Business Network',
    },
    US: {
      iso2: 'US',
      name: 'United States',
      brand: 'The Networker USA',
      adjective: 'US',
      badge: 'Building · coming soon',
      kicker: 'US business networking',
      source: 'market_preview_us',
      canonical: 'https://www.thenetworkerusa.com/',
      logo: '/assets/logo-networker-usa.png?v=20260825mkt4',
      groupPlaceholder: 'e.g. Austin Business Network',
    },
  };

  var selectedIntent = 'attend';
  var selectedOrgType = 'networking_group';

  function byId(id) {
    return document.getElementById(id);
  }

  function trackPreview(name, data) {
    try {
      if (window.HubAnalytics && typeof window.HubAnalytics.track === 'function') {
        window.HubAnalytics.track(name, data);
      }
    } catch (e) {
      /* analytics optional */
    }
  }

  function detectMarket() {
    var host = String(window.location.hostname || '')
      .toLowerCase()
      .replace(/^www\./, '');
    if (host.indexOf('ireland') !== -1) return MARKETS.IE;
    if (host.indexOf('usa') !== -1 || host.indexOf('unitedstates') !== -1) return MARKETS.US;

    var params = new URLSearchParams(window.location.search || '');
    var q = String(params.get('market') || params.get('country') || '')
      .trim()
      .toUpperCase();
    if (q === 'IE' || q === 'IRELAND') return MARKETS.IE;
    if (q === 'US' || q === 'USA' || q === 'UNITED STATES') return MARKETS.US;
    return null;
  }

  function applyMarket(market) {
    if (!market) {
      window.location.replace('https://www.thenetworkerinternational.com/');
      return;
    }

    document.title = 'Coming soon – ' + market.brand;
    var desc =
      market.brand +
      ' is coming soon. Register interest to attend events or list a networking group.';
    var descEl = document.querySelector('meta[name="description"]');
    if (descEl) descEl.setAttribute('content', desc);

    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', market.canonical);

    var logoLink = byId('market-preview-logo');
    var logoImg = byId('market-preview-logo-img');
    if (logoLink) {
      logoLink.href = market.canonical;
      logoLink.setAttribute('aria-label', market.brand + ' home');
    }
    if (logoImg) {
      logoImg.src = market.logo;
      logoImg.alt = market.brand;
    }

    var badge = byId('market-preview-badge-text');
    if (badge) badge.textContent = market.badge;
    var kicker = byId('market-preview-kicker');
    if (kicker) kicker.textContent = market.kicker;
    var country = byId('market-preview-country');
    if (country) country.textContent = market.name;
    var lede = byId('market-preview-lede');
    if (lede) {
      lede.textContent =
        'We\u2019re building The Networker for ' +
        market.adjective +
        ' business communities — trusted networking, events, and opportunities.';
    }
    var groupInput = byId('market-preview-group');
    if (groupInput) groupInput.placeholder = market.groupPlaceholder;
  }

  function setIntent(intent) {
    selectedIntent = intent === 'list' ? 'list' : 'attend';
    var groupFields = byId('market-preview-group-fields');
    var submit = byId('market-preview-submit');
    var panelTitle = byId('market-preview-panel-title');
    var panelLede = byId('market-preview-panel-lede');
    var privacy = byId('market-preview-privacy');
    var listing = selectedIntent === 'list';

    document.querySelectorAll('.market-preview-intent-btn').forEach(function (btn) {
      btn.classList.toggle('is-selected', btn.getAttribute('data-intent') === selectedIntent);
    });

    if (groupFields) groupFields.hidden = !listing;
    if (submit) submit.textContent = listing ? 'Send group details' : 'Register interest';
    if (panelTitle) {
      panelTitle.textContent = listing ? 'List your group' : 'Be first when we launch';
    }
    if (panelLede) {
      panelLede.textContent = listing
        ? 'Tell us about your networking group or training organisation — we\u2019ll be in touch as we launch.'
        : 'Tell us if you want to attend events or list a networking group. We\u2019ll be in touch as we get closer.';
    }
    if (privacy) {
      privacy.innerHTML = listing
        ? 'We use your details to follow up about launching The Networker in this country and to onboard your group. See our <a href="https://www.thenetworkeruk.com/legal-policies#privacy" rel="noopener noreferrer">privacy policy</a>.'
        : 'We use your email only about launching The Networker in this country. See our <a href="https://www.thenetworkeruk.com/legal-policies#privacy" rel="noopener noreferrer">privacy policy</a>.';
    }
  }

  function initForm(market) {
    var form = byId('market-preview-form');
    var email = byId('market-preview-email');
    var nameEl = byId('market-preview-name');
    var phoneEl = byId('market-preview-phone');
    var groupEl = byId('market-preview-group');
    var websiteEl = byId('market-preview-website');
    var descriptionEl = byId('market-preview-description');
    var error = byId('market-preview-error');
    var success = byId('market-preview-success');
    var submit = byId('market-preview-submit');
    var honeypot = form && form.querySelector('[name="website_hp"]');
    var intentWrap = document.querySelector('.market-preview-intent');

    document.querySelectorAll('.market-preview-intent-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setIntent(btn.getAttribute('data-intent') || 'attend');
      });
    });

    document.querySelectorAll('.market-preview-org-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedOrgType = btn.getAttribute('data-org-type') || 'networking_group';
        document.querySelectorAll('.market-preview-org-btn').forEach(function (other) {
          other.classList.toggle('is-selected', other === btn);
        });
      });
    });

    if (!form || !market) return;
    setIntent('attend');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (honeypot && String(honeypot.value || '').trim()) return;

      var value = String((email && email.value) || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        if (error) {
          error.textContent = 'Enter a valid email address.';
          error.hidden = false;
        }
        return;
      }

      var listing = selectedIntent === 'list';
      var name = String((nameEl && nameEl.value) || '').trim();
      var group = String((groupEl && groupEl.value) || '').trim();

      if (listing) {
        if (!name) {
          if (error) {
            error.textContent = 'Enter your name.';
            error.hidden = false;
          }
          return;
        }
        if (!group) {
          if (error) {
            error.textContent = 'Enter your group or organisation name.';
            error.hidden = false;
          }
          return;
        }
      }

      if (error) error.hidden = true;
      if (submit) submit.disabled = true;

      var request = listing
        ? fetch('/api/international-group-intake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: name,
              email: value,
              phone: String((phoneEl && phoneEl.value) || '').trim(),
              group: group,
              website: String((websiteEl && websiteEl.value) || '').trim(),
              description: String((descriptionEl && descriptionEl.value) || '').trim(),
              orgType: selectedOrgType,
              countryCode: market.iso2,
              countryName: market.name,
              source: market.source,
            }),
          })
        : fetch('/api/international-interest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: value,
              countryCode: market.iso2,
              countryName: market.name,
              intent: 'attend',
              source: market.source,
            }),
          });

      request
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok || !result.data.ok) {
            throw new Error(
              (result.data && result.data.message) ||
                (listing ? 'Could not save your group details.' : 'Could not save your interest.')
            );
          }
          if (listing) {
            trackPreview('intl_building_submit', {
              country: market.iso2,
              orgType: selectedOrgType,
            });
          } else {
            trackPreview('intl_interest_submit', {
              country: market.iso2,
              intent: 'attend',
            });
          }
          form.hidden = true;
          if (intentWrap) intentWrap.hidden = true;
          if (success) {
            success.textContent = listing
              ? 'Thanks — we\u2019ll be in touch as we get closer to launch in ' + market.name + '.'
              : 'Thanks — we\u2019ll be in touch when we launch here.';
            success.hidden = false;
          }
        })
        .catch(function (err) {
          if (error) {
            error.textContent = err.message || 'Something went wrong. Please try again.';
            error.hidden = false;
          }
          if (submit) submit.disabled = false;
        });
    });
  }

  function initFooter() {
    var cookieBtn = document.getElementById('market-preview-cookie-settings');
    if (cookieBtn) {
      cookieBtn.addEventListener('click', function () {
        if (window.HubCookieConsent && window.HubCookieConsent.openSettings) {
          window.HubCookieConsent.openSettings();
        }
      });
    }
  }

  function init() {
    initFooter();
    var market = detectMarket();
    applyMarket(market);
    initForm(market);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
