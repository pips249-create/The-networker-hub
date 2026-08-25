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
      logo: '/assets/logo-networker-ireland.png?v=20260825mkt3',
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
      logo: '/assets/logo-networker-usa.png?v=20260825mkt3',
    },
  };

  var selectedIntent = 'attend';

  function byId(id) {
    return document.getElementById(id);
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
  }

  function initForm(market) {
    var form = byId('market-preview-form');
    var email = byId('market-preview-email');
    var error = byId('market-preview-error');
    var success = byId('market-preview-success');
    var submit = byId('market-preview-submit');
    var honeypot = form && form.querySelector('[name="website_hp"]');

    document.querySelectorAll('.market-preview-intent-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedIntent = btn.getAttribute('data-intent') || 'attend';
        document.querySelectorAll('.market-preview-intent-btn').forEach(function (other) {
          other.classList.toggle('is-selected', other === btn);
        });
      });
    });

    if (!form || !market) return;

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

      if (error) error.hidden = true;
      if (submit) submit.disabled = true;

      fetch('/api/international-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: value,
          countryCode: market.iso2,
          countryName: market.name,
          intent: selectedIntent,
          source: market.source,
        }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (!result.ok || !result.data.ok) {
            throw new Error((result.data && result.data.message) || 'Could not save your interest.');
          }
          form.hidden = true;
          document.querySelector('.market-preview-intent').hidden = true;
          if (success) success.hidden = false;
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

  function init() {
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
