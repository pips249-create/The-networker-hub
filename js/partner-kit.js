/**
 * Partner hub — tabs + personalise links from ?ref= / cookie.
 */
(function () {
  var TAB_IDS = ['earn', 'share', 'creatives', 'brand', 'rates'];

  function copyValue(value) {
    var text = String(value || '');
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
      return;
    }
    window.prompt('Copy', text);
  }

  function setLink(id, href, label) {
    var el = document.getElementById(id);
    if (!el) return;
    el.href = href;
    el.textContent = label || href.replace(/^https?:\/\//, '');
  }

  function showTab(tabId, opts) {
    var id = TAB_IDS.indexOf(tabId) >= 0 ? tabId : 'earn';
    var replace = opts && opts.replace;
    document.querySelectorAll('[data-partner-panel]').forEach(function (panel) {
      var on = panel.getAttribute('data-partner-panel') === id;
      panel.classList.toggle('is-active', on);
      if (on) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    });
    document.querySelectorAll('[data-partner-tab]').forEach(function (btn) {
      var on = btn.getAttribute('data-partner-tab') === id;
      btn.classList.toggle('is-active', on);
      if (btn.tagName === 'BUTTON') {
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      }
    });
    try {
      var url = new URL(window.location.href);
      url.hash = id === 'earn' ? '' : id;
      if (replace) history.replaceState(null, '', url.pathname + url.search + (url.hash || ''));
      else history.pushState(null, '', url.pathname + url.search + (url.hash || ''));
    } catch (e) {}
    var nav = document.getElementById('partner-hub-nav');
    if (nav && opts && opts.scroll) {
      nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function tabFromHash() {
    var raw = String(window.location.hash || '')
      .replace(/^#/, '')
      .toLowerCase();
    if (raw === 'earnings' || raw === 'panel-earn') return 'earn';
    if (raw === 'your-links' || raw === 'links') return 'share';
    if (raw === 'promos-title' || raw === 'posts' || raw === 'stories-title') return 'creatives';
    if (raw === 'logos-title' || raw === 'copy-title') return 'brand';
    if (raw === 'rates-title') return 'rates';
    if (TAB_IDS.indexOf(raw) >= 0) return raw;
    return 'earn';
  }

  function showTermsBanner(code, acceptPage) {
    var banner = document.getElementById('partner-terms-banner');
    if (!banner || !code) return;
    var acceptUrl =
      acceptPage ||
      '/partners/accept-terms?ref=' + encodeURIComponent(code);
    banner.innerHTML =
      '<div class="partner-terms-banner-inner">' +
      '<p><strong>Accept Referral Partner Terms</strong> before sharing your tracking links. ' +
      'Use the email on your invite.</p>' +
      '<a class="partner-kit-download partner-kit-download--solid" href="' +
      acceptUrl +
      '">Accept terms</a>' +
      '<a class="partner-kit-download" href="/partners/terms" target="_blank" rel="noopener">Read terms</a>' +
      '</div>';
    banner.hidden = false;
    document.body.classList.add('partner-kit-page--terms-pending');
  }

  function checkTermsStatus(code) {
    if (!code) return;
    fetch('/api/partner-terms?code=' + encodeURIComponent(code), { credentials: 'same-origin' })
      .then(function (res) {
        return res.json().catch(function () {
          return {};
        });
      })
      .then(function (data) {
        if (!data || !data.ok || !data.active) return;
        if (data.termsAccepted) {
          var banner = document.getElementById('partner-terms-banner');
          if (banner) {
            banner.hidden = true;
            banner.innerHTML = '';
          }
          document.body.classList.remove('partner-kit-page--terms-pending');
          return;
        }
        showTermsBanner(code, data.acceptPage);
      })
      .catch(function () {});
  }

  function personalise() {
    var code = '';
    if (window.HubAffiliate && typeof window.HubAffiliate.captureFromUrl === 'function') {
      code = window.HubAffiliate.captureFromUrl() || window.HubAffiliate.getCode() || '';
    } else {
      try {
        var params = new URLSearchParams(window.location.search || '');
        code = String(params.get('ref') || params.get('code') || '')
          .trim()
          .toUpperCase();
      } catch (e) {
        code = '';
      }
    }

    var homeBase = 'https://www.thenetworkeruk.com/';
    var adsBase = 'https://www.thenetworkeruk.com/advertising';
    var oppBase = 'https://www.thenetworkeruk.com/opportunities/list';
    var home = code ? homeBase + '?ref=' + encodeURIComponent(code) : homeBase;
    var ads = code ? adsBase + '?ref=' + encodeURIComponent(code) : adsBase;
    var opp = code ? oppBase + '?ref=' + encodeURIComponent(code) : oppBase;
    setLink('partner-kit-link-home', home, code ? 'thenetworkeruk.com/?ref=' + code : 'thenetworkeruk.com');
    setLink('partner-kit-link-ads', ads);
    setLink('partner-kit-link-opp', opp);

    var codeLine = document.getElementById('partner-kit-code-line');
    var codeEl = document.getElementById('partner-kit-code');
    var hint = document.getElementById('partner-kit-links-hint');
    var earnCodeLine = document.getElementById('partner-earnings-code-line');
    var earnCodeEl = document.getElementById('partner-earnings-code');
    var earnHint = document.getElementById('partner-earnings-hint');
    var heroLine = document.getElementById('partner-hero-code-line');
    var heroCode = document.getElementById('partner-hero-code');

    if (code && codeLine && codeEl) {
      codeEl.textContent = code;
      codeLine.hidden = false;
      if (hint) {
        hint.textContent =
          'These links are tagged with your partner code so referrals attribute to you. Cookie lasts 30 days.';
      }
    }
    if (code && earnCodeLine && earnCodeEl) {
      earnCodeEl.textContent = code;
      earnCodeLine.hidden = false;
      if (earnHint) {
        earnHint.textContent =
          'Commission totals for code ' +
          code +
          ' will fill in once referred sales pay. Until then, copy your tracking links from Your links.';
      }
    }
    if (code && heroLine && heroCode) {
      heroCode.textContent = code;
      heroLine.hidden = false;
    }

    checkTermsStatus(code);

    var short = document.getElementById('partner-kit-copy-short');
    if (short && code) {
      short.textContent = String(short.textContent || '').replace('[LINK]', home);
    }
  }

  function bindCopies() {
    document.querySelectorAll('[data-copy-target]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = document.getElementById(btn.getAttribute('data-copy-target'));
        if (!target) return;
        copyValue(target.href || target.textContent);
        var prev = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () {
          btn.textContent = prev || 'Copy';
        }, 1200);
      });
    });

    document.querySelectorAll('[data-copy-text-target]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = document.getElementById(btn.getAttribute('data-copy-text-target'));
        if (!target) return;
        copyValue(target.textContent);
        var prev = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () {
          btn.textContent = prev || 'Copy text';
        }, 1200);
      });
    });
  }

  function bindTabs() {
    document.addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-partner-tab]');
      if (!el) return;
      if (el.tagName === 'A' && el.getAttribute('href') && el.getAttribute('href').charAt(0) === '#') {
        ev.preventDefault();
      }
      showTab(el.getAttribute('data-partner-tab'), { scroll: true });
    });
    window.addEventListener('hashchange', function () {
      showTab(tabFromHash(), { replace: true });
    });
    showTab(tabFromHash(), { replace: true });
  }

  function init() {
    bindTabs();
    bindCopies();
    personalise();
    setTimeout(personalise, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
