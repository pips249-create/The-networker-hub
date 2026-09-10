/**
 * Partner media kit — personalise links from ?ref= / cookie.
 */
(function () {
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

    var adsBase = 'https://www.thenetworkeruk.com/advertising';
    var oppBase = 'https://www.thenetworkeruk.com/opportunities/list';
    var ads = code ? adsBase + '?ref=' + encodeURIComponent(code) : adsBase;
    var opp = code ? oppBase + '?ref=' + encodeURIComponent(code) : oppBase;
    setLink('partner-kit-link-ads', ads);
    setLink('partner-kit-link-opp', opp);

    var codeLine = document.getElementById('partner-kit-code-line');
    var codeEl = document.getElementById('partner-kit-code');
    var hint = document.getElementById('partner-kit-links-hint');
    if (code && codeLine && codeEl) {
      codeEl.textContent = code;
      codeLine.hidden = false;
      if (hint) {
        hint.textContent = 'These links are tagged with your partner code so referrals attribute to you.';
      }
    }

    var short = document.getElementById('partner-kit-copy-short');
    if (short && code) {
      short.textContent = String(short.textContent || '').replace('[LINK]', ads);
    }
  }

  document.querySelectorAll('[data-copy-target]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = document.getElementById(btn.getAttribute('data-copy-target'));
      if (!target) return;
      copyValue(target.href || target.textContent);
      btn.textContent = 'Copied';
      setTimeout(function () {
        btn.textContent = 'Copy';
      }, 1200);
    });
  });

  document.querySelectorAll('[data-copy-text-target]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = document.getElementById(btn.getAttribute('data-copy-text-target'));
      if (!target) return;
      copyValue(target.textContent);
      btn.textContent = 'Copied';
      setTimeout(function () {
        btn.textContent = 'Copy text';
      }, 1200);
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', personalise);
  } else {
    personalise();
  }
  // HubAffiliate may load just after site-nav
  setTimeout(personalise, 300);
})();
