/**
 * UK location typeahead — postcodes.io + common presets (events browse style).
 */
(function (global) {
  var PRESETS = [
    'Remote / Online',
    'UK-wide',
    'Yorkshire',
    'North England',
    'Midlands',
    'South England',
    'London',
    'Manchester',
    'Birmingham',
    'Leeds',
    'Liverpool',
    'Bristol',
    'Edinburgh',
    'Glasgow',
    'Cambridge',
    'Oxford',
  ];

  var CITY_KEYS = [
    'manchester',
    'london',
    'birmingham',
    'leeds',
    'liverpool',
    'bristol',
    'edinburgh',
    'glasgow',
    'cambridge',
    'oxford',
  ];

  function normalize(raw) {
    return String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function titleCaseCity(key) {
    return key.replace(/^\w/, function (c) {
      return c.toUpperCase();
    });
  }

  function presetMatches(query) {
    var q = normalize(query);
    if (!q) return [];
    return PRESETS.filter(function (p) {
      return normalize(p).indexOf(q) !== -1;
    });
  }

  function cityMatches(query) {
    var q = normalize(query);
    if (!q || q.length < 2) return [];
    return CITY_KEYS.filter(function (c) {
      return c.indexOf(q) !== -1 || q.indexOf(c) !== -1;
    }).map(titleCaseCity);
  }

  function formatPostcodeRow(row) {
    if (!row) return '';
    var place = row.admin_district || row.admin_ward || row.parish || row.region || '';
    if (row.postcode && place) return row.postcode + ' · ' + place;
    return row.postcode || place || '';
  }

  function dedupe(items) {
    var seen = {};
    var out = [];
    items.forEach(function (item) {
      var key = normalize(item);
      if (!item || seen[key]) return;
      seen[key] = true;
      out.push(item);
    });
    return out;
  }

  function fetchPostcodeSuggestions(query) {
    return fetch(
      'https://api.postcodes.io/postcodes?q=' + encodeURIComponent(query) + '&limit=8'
    )
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data.status !== 200 || !data.result || !data.result.length) return [];
        return data.result
          .map(formatPostcodeRow)
          .filter(Boolean);
      })
      .catch(function () {
        return [];
      });
  }

  function buildSuggestions(query) {
    var local = dedupe(presetMatches(query).concat(cityMatches(query)));
    if (query.length < 2) {
      return Promise.resolve(local.slice(0, 8));
    }
    return fetchPostcodeSuggestions(query).then(function (remote) {
      return dedupe(local.concat(remote)).slice(0, 10);
    });
  }

  function bindLocationAutocomplete(input, options) {
    if (!input) return;

    var opts = options || {};
    var listId = input.getAttribute('list') || input.id + '-suggest';
    var list = document.getElementById(listId);
    if (!list) {
      list = document.createElement('ul');
      list.id = listId;
      list.className = opts.listClass || 'hub-location-suggest';
      list.setAttribute('role', 'listbox');
      list.hidden = true;
      var wrap = input.closest('.hub-location-field') || input.parentElement;
      if (wrap) wrap.appendChild(list);
      else input.insertAdjacentElement('afterend', list);
    }

    var timer = null;
    var activeIndex = -1;
    var currentItems = [];

    function hideList() {
      list.hidden = true;
      list.innerHTML = '';
      activeIndex = -1;
      currentItems = [];
      input.setAttribute('aria-expanded', 'false');
    }

    function choose(value) {
      input.value = value;
      hideList();
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function render(items) {
      currentItems = items;
      if (!items.length) {
        hideList();
        return;
      }
      list.innerHTML = items
        .map(function (item, i) {
          return (
            '<li role="option" data-index="' +
            i +
            '" tabindex="-1">' +
            item.replace(/&/g, '&amp;').replace(/</g, '&lt;') +
            '</li>'
          );
        })
        .join('');
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function refresh() {
      var q = input.value.trim();
      if (q.length < 1) {
        hideList();
        return;
      }
      buildSuggestions(q).then(render);
    }

    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', listId);

    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(refresh, opts.debounceMs || 220);
    });

    input.addEventListener('focus', function () {
      if (input.value.trim().length >= 1) refresh();
    });

    input.addEventListener('keydown', function (e) {
      if (list.hidden || !currentItems.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, currentItems.length - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        choose(currentItems[activeIndex]);
        return;
      } else if (e.key === 'Escape') {
        hideList();
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

    list.addEventListener('mousedown', function (e) {
      var li = e.target.closest('li[role="option"]');
      if (!li) return;
      e.preventDefault();
      var idx = parseInt(li.getAttribute('data-index'), 10);
      if (!isNaN(idx) && currentItems[idx]) choose(currentItems[idx]);
    });

    document.addEventListener('click', function (e) {
      if (e.target === input || list.contains(e.target)) return;
      hideList();
    });
  }

  global.hubBindLocationAutocomplete = bindLocationAutocomplete;
})(typeof window !== 'undefined' ? window : globalThis);
