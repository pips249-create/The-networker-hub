/**
 * International country landing — Ireland / United States enquiry forms.
 */
(function () {
  var MARKETS = {
    IE: {
      iso2: 'IE',
      name: 'Ireland',
      source: 'international_country_ie',
    },
    US: {
      iso2: 'US',
      name: 'United States',
      source: 'international_country_us',
    },
  };

  var selectedIntent = 'attend';
  var selectedOrgType = 'networking_group';

  function byId(id) {
    return document.getElementById(id);
  }

  function track(name, data) {
    try {
      if (window.HubAnalytics && typeof window.HubAnalytics.track === 'function') {
        window.HubAnalytics.track(name, data);
      }
    } catch (e) {
      /* optional */
    }
  }

  function detectMarket() {
    var raw = String(document.body.getAttribute('data-market') || '')
      .trim()
      .toUpperCase();
    return MARKETS[raw] || null;
  }

  function setIntent(intent) {
    selectedIntent = intent === 'list' ? 'list' : 'attend';
    var listing = selectedIntent === 'list';
    var groupFields = byId('intl-market-group-fields');
    var submit = byId('intl-market-submit');
    var panelTitle = byId('intl-market-panel-title');
    var panelLede = byId('intl-market-panel-lede');
    var privacy = byId('intl-market-privacy');

    document.querySelectorAll('.intl-market-intent-btn').forEach(function (btn) {
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

  function formatDemand(total, countryName) {
    if (!total || total < 5) return '';
    return (
      total.toLocaleString('en-GB') +
      ' people have already registered interest in ' +
      countryName +
      '.'
    );
  }

  function loadDemand(market) {
    var el = byId('intl-market-demand');
    if (!el || !market) return;
    fetch('/api/international-interest-stats')
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.ok || !data.countries) return;
        var row = data.countries[market.iso2];
        if (!row || !row.display) return;
        var copy = formatDemand(row.total, market.name);
        if (!copy) return;
        el.textContent = copy;
        el.hidden = false;
      })
      .catch(function () {});
  }

  function initForm(market) {
    var form = byId('intl-market-form');
    if (!form || !market) return;

    var email = byId('intl-market-email');
    var nameEl = byId('intl-market-name');
    var phoneEl = byId('intl-market-phone');
    var groupEl = byId('intl-market-group');
    var websiteEl = byId('intl-market-website');
    var descriptionEl = byId('intl-market-description');
    var error = byId('intl-market-error');
    var success = byId('intl-market-success');
    var submit = byId('intl-market-submit');
    var honeypot = form.querySelector('[name="website_hp"]');
    var intentWrap = document.querySelector('.intl-market-intent');

    document.querySelectorAll('.intl-market-intent-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setIntent(btn.getAttribute('data-intent') || 'attend');
      });
    });

    document.querySelectorAll('.intl-market-org-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedOrgType = btn.getAttribute('data-org-type') || 'networking_group';
        document.querySelectorAll('.intl-market-org-btn').forEach(function (other) {
          other.classList.toggle('is-selected', other === btn);
        });
      });
    });

    setIntent('attend');

    var params = new URLSearchParams(window.location.search || '');
    var intentParam = String(params.get('intent') || '').toLowerCase();
    if (intentParam === 'list') setIntent('list');

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
          track(listing ? 'intl_building_submit' : 'intl_interest_submit', {
            country: market.iso2,
            intent: listing ? 'list' : 'attend',
            source: market.source,
          });
          form.hidden = true;
          if (intentWrap) intentWrap.hidden = true;
          if (success) {
            success.innerHTML = listing
              ? 'Thanks — we\u2019ll be in touch as we get closer to launch in ' +
                market.name +
                '. Meanwhile, see the live UK site at <a href="https://www.thenetworkeruk.com" rel="noopener noreferrer">thenetworkeruk.com</a>.'
              : 'You\u2019re on the list for ' +
                market.name +
                '. We\u2019ll email you when we launch. Preview the live UK experience at <a href="https://www.thenetworkeruk.com" rel="noopener noreferrer">thenetworkeruk.com</a>.';
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
    var cookieBtn = byId('intl-market-cookie-settings');
    if (cookieBtn) {
      cookieBtn.addEventListener('click', function () {
        if (window.HubCookieConsent && window.HubCookieConsent.openSettings) {
          window.HubCookieConsent.openSettings();
        }
      });
    }
    var year = byId('intl-market-year');
    if (year) year.textContent = String(new Date().getFullYear());
  }

  function init() {
    initFooter();
    var market = detectMarket();
    if (!market) {
      window.location.replace('https://www.thenetworkerinternational.com/');
      return;
    }
    loadDemand(market);
    initForm(market);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
