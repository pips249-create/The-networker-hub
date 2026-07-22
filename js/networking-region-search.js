/**
 * City search autocomplete + navigation to /networking/:slug.
 * Used by homepage hero and events filter bar.
 */
(function (global) {
  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function initNetworkingRegionSearch(input, wrap, options) {
    options = options || {};
    if (!input || !wrap) return null;

    var resolveSlug = global.HUB_resolveNetworkingRegionSlug;
    var searchRegions = global.HUB_searchNetworkingRegions;
    var regionPath = global.HUB_networkingRegionPath;
    var suggestClass = options.suggestClass || 'networking-region-search-suggest';
    var onNonCitySubmit =
      typeof options.onNonCitySubmit === 'function' ? options.onNonCitySubmit : null;
    var onFocus = typeof options.onFocus === 'function' ? options.onFocus : null;
    var preserveParams = Array.isArray(options.preserveParams) ? options.preserveParams : [];
    var isEnabled =
      typeof options.isEnabled === 'function'
        ? options.isEnabled
        : function () {
            return true;
          };

    var suggestTimer = null;
    var activeIndex = -1;
    var currentItems = [];
    var list = null;

    function hideSuggest() {
      if (!list) return;
      list.hidden = true;
      list.innerHTML = '';
      activeIndex = -1;
      currentItems = [];
      input.setAttribute('aria-expanded', 'false');
    }

    function ensureSuggestList() {
      if (list) return list;
      list = document.createElement('ul');
      list.id = input.id + '-region-suggest';
      list.className = suggestClass;
      list.setAttribute('role', 'listbox');
      list.hidden = true;
      wrap.appendChild(list);
      return list;
    }

    function buildRegionHref(slug) {
      if (!slug || !regionPath) return '';
      var href = regionPath(slug);
      if (!preserveParams.length) return href;
      try {
        var url = new URL(href, global.location.origin);
        preserveParams.forEach(function (key) {
          var val = new URL(global.location.href).searchParams.get(key);
          if (val) url.searchParams.set(key, val);
        });
        return url.pathname + url.search;
      } catch (e) {
        return href;
      }
    }

    function navigateToRegion(slug) {
      if (!slug || !regionPath) return;
      var regional = global.hubRegionalLanding;
      if (regional && regional.slug === slug) {
        hideSuggest();
        return;
      }
      hideSuggest();
      global.location.href = buildRegionHref(slug);
    }

    function handleSubmit() {
      if (!isEnabled()) {
        if (onNonCitySubmit) onNonCitySubmit(String(input.value || '').trim());
        return false;
      }
      var q = String(input.value || '').trim();
      if (!q) {
        if (onNonCitySubmit) onNonCitySubmit(q);
        return false;
      }
      var slug = resolveSlug ? resolveSlug(q) : '';
      if (slug) {
        navigateToRegion(slug);
        return true;
      }
      if (onNonCitySubmit) onNonCitySubmit(q);
      return false;
    }

    function renderSuggest(items) {
      ensureSuggestList();
      if (!list) return;
      currentItems = items;
      if (!items.length) {
        hideSuggest();
        return;
      }
      list.innerHTML = items
        .map(function (item, i) {
          return (
            '<li role="option" data-index="' +
            i +
            '" data-slug="' +
            escAttr(item.slug) +
            '" tabindex="-1">' +
            escAttr(item.name) +
            '</li>'
          );
        })
        .join('');
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function refreshSuggest() {
      if (!searchRegions || !isEnabled()) {
        hideSuggest();
        return;
      }
      var q = String(input.value || '').trim();
      if (q.length < 2) {
        hideSuggest();
        return;
      }
      renderSuggest(searchRegions(q, 8));
    }

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', input.id + '-region-suggest');

    input.addEventListener('focus', function () {
      if (onFocus) onFocus();
      if (String(input.value || '').trim().length >= 2) refreshSuggest();
    });

    input.addEventListener('input', function () {
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(refreshSuggest, 180);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        if (list && !list.hidden && currentItems.length && activeIndex >= 0) {
          e.preventDefault();
          navigateToRegion(currentItems[activeIndex].slug);
          return;
        }
        if (handleSubmit()) e.preventDefault();
        return;
      }
      if (!list || list.hidden || !currentItems.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, currentItems.length - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
      } else if (e.key === 'Escape') {
        hideSuggest();
        return;
      } else {
        return;
      }
      Array.prototype.forEach.call(list.children, function (li, i) {
        li.classList.toggle('is-active', i === activeIndex);
      });
      var active = list.children[activeIndex];
      if (active) active.scrollIntoView({ block: 'nearest' });
    });

    wrap.addEventListener('mousedown', function (e) {
      var li = e.target.closest('[role="option"][data-slug]');
      if (!li) return;
      e.preventDefault();
      var slug = li.getAttribute('data-slug');
      if (slug) navigateToRegion(slug);
    });

    document.addEventListener('click', function (e) {
      if (e.target === input || (list && list.contains(e.target))) return;
      hideSuggest();
    });

    return handleSubmit;
  }

  global.HUB_initNetworkingRegionSearch = initNetworkingRegionSearch;
})(typeof window !== 'undefined' ? window : globalThis);
