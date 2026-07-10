/**
 * Investment breakdown — parse meta, card popovers (tap + keyboard), shared copy.
 */
(function () {
  var INCLUDES_KEY = 'Investment includes';
  var activeBtn = null;

  function parseInvestmentIncludes(raw) {
    return String(raw || '')
      .split(/\r?\n|;|•|·/)
      .map(function (s) {
        return s.replace(/^[\s\-*]+/, '').trim();
      })
      .filter(Boolean)
      .slice(0, 8);
  }

  function investmentIncludesFromMeta(meta) {
    for (var i = 0; i < (meta || []).length; i++) {
      if (/^investment includes$/i.test(meta[i].key)) {
        return parseInvestmentIncludes(meta[i].val);
      }
    }
    return [];
  }

  function investmentTotalFromMeta(meta) {
    for (var i = 0; i < (meta || []).length; i++) {
      if (/^investment$/i.test(meta[i].key)) {
        return String(meta[i].val || '').trim();
      }
    }
    return '';
  }

  function breakdownHeading(total, count) {
    var t = String(total || '').trim();
    if (t && count) return t + ' total — typically includes:';
    if (t) return t + ' — what\'s included:';
    if (count) return 'Typically includes:';
    return 'What\'s included:';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function listHtml(items) {
    return items
      .map(function (item) {
        return '<li>' + escapeHtml(item) + '</li>';
      })
      .join('');
  }

  function ensurePopoverEl() {
    var pop = document.getElementById('opp-invest-breakdown-popover');
    if (pop) return pop;
    pop = document.createElement('div');
    pop.id = 'opp-invest-breakdown-popover';
    pop.className = 'opp-invest-breakdown-popover';
    pop.hidden = true;
    pop.setAttribute('role', 'tooltip');
    document.body.appendChild(pop);
    return pop;
  }

  function closePopover() {
    var pop = document.getElementById('opp-invest-breakdown-popover');
    if (pop) pop.hidden = true;
    if (activeBtn) {
      activeBtn.setAttribute('aria-expanded', 'false');
      activeBtn = null;
    }
  }

  function positionPopover(btn, pop) {
    var rect = btn.getBoundingClientRect();
    pop.hidden = false;
    pop.style.visibility = 'hidden';
    pop.style.left = '0';
    pop.style.top = '0';
    var width = pop.offsetWidth;
    var height = pop.offsetHeight;
    var left = rect.left;
    var top = rect.bottom + 8;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }
    if (top + height > window.innerHeight - 12) {
      top = Math.max(12, rect.top - height - 8);
    }
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    pop.style.visibility = '';
  }

  function openPopover(btn, items, total) {
    if (!items || !items.length) return;
    var pop = ensurePopoverEl();
    if (activeBtn && activeBtn !== btn) activeBtn.setAttribute('aria-expanded', 'false');
    activeBtn = btn;
    btn.setAttribute('aria-expanded', 'true');
    pop.innerHTML =
      '<p class="opp-invest-popover-title">' +
      escapeHtml(breakdownHeading(total, items.length)) +
      '</p>' +
      '<ul class="opp-invest-popover-list">' +
      listHtml(items) +
      '</ul>' +
      '<p class="opp-invest-popover-note">As stated by the lister — confirm before committing.</p>';
    positionPopover(btn, pop);
  }

  function infoButtonHtml(item) {
    if (!item || !item.investmentIncludes || !item.investmentIncludes.length) return '';
    return (
      '<button type="button" class="opp-invest-info-btn" data-opp-id="' +
      escapeHtml(item.id) +
      '" aria-label="What\'s included in this investment" aria-expanded="false">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"/>' +
      '<path d="M12 10v6M12 7h.01"/>' +
      '</svg></button>'
    );
  }

  var uiBound = false;

  function bindCardPopovers(getListing) {
    if (uiBound) return;
    uiBound = true;

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.opp-invest-info-btn');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        var id = btn.getAttribute('data-opp-id');
        var item = getListing ? getListing(id) : null;
        var items = item && item.investmentIncludes ? item.investmentIncludes : [];
        var total =
          item && item.meta
            ? investmentTotalFromMeta(item.meta)
            : '';
        if (activeBtn === btn) {
          var openPop = document.getElementById('opp-invest-breakdown-popover');
          if (openPop && !openPop.hidden) {
            closePopover();
            return;
          }
        }
        openPopover(btn, items, total);
        return;
      }
      if (!e.target.closest('#opp-invest-breakdown-popover')) closePopover();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePopover();
    });

    window.addEventListener('scroll', closePopover, true);
    window.addEventListener('resize', closePopover);
  }

  window.HubOpportunityInvestment = {
    INCLUDES_KEY: INCLUDES_KEY,
    parseIncludes: parseInvestmentIncludes,
    fromMeta: investmentIncludesFromMeta,
    totalFromMeta: investmentTotalFromMeta,
    breakdownHeading: breakdownHeading,
    infoButtonHtml: infoButtonHtml,
    bindCardPopovers: bindCardPopovers,
    closePopover: closePopover,
  };
})();
