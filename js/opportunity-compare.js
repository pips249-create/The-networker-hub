/**
 * Compare up to 3 saved opportunities side-by-side (My Hub).
 */
(function () {
  var STORAGE_KEY = 'hub_opp_compare';
  var MAX = 3;

  function readIds() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.map(String).filter(Boolean).slice(0, MAX) : [];
    } catch {
      return [];
    }
  }

  function writeIds(ids) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify((ids || []).slice(0, MAX)));
  }

  function toggle(id) {
    var sid = String(id || '').trim();
    if (!sid) return readIds();
    var ids = readIds();
    var idx = ids.indexOf(sid);
    if (idx !== -1) ids.splice(idx, 1);
    else {
      if (ids.length >= MAX) return ids;
      ids.push(sid);
    }
    writeIds(ids);
    return ids;
  }

  function isSelected(id) {
    return readIds().indexOf(String(id)) !== -1;
  }

  function clear() {
    writeIds([]);
  }

  function metaVal(meta, keyRe) {
    for (var i = 0; i < (meta || []).length; i++) {
      if (keyRe.test(meta[i].key)) return String(meta[i].val || '').trim();
    }
    return '';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function listingFromCatalog(catalog, id) {
    if (!catalog) return null;
    var list = catalog.loadCatalog ? catalog.loadCatalog() : [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return list[i];
    }
    return null;
  }

  function compareRow(label, values) {
    return (
      '<tr><th scope="row">' +
      escapeHtml(label) +
      '</th>' +
      values
        .map(function (v) {
          return '<td>' + (v || '—') + '</td>';
        })
        .join('') +
      '</tr>'
    );
  }

  function renderModal(catalog, ids) {
    var items = ids
      .map(function (id) {
        return listingFromCatalog(catalog, id);
      })
      .filter(Boolean);
    if (items.length < 2) return '';

    var q = window.HubOpportunityQuality;
    var typeLabels = (catalog && catalog.TYPE_LABELS) || {};

    var headers = items
      .map(function (item) {
        var href = item.slug
          ? '../opportunities/' + encodeURIComponent(item.slug)
          : '../opportunities/opportunity.html?id=' + encodeURIComponent(item.id);
        return (
          '<th scope="col"><a href="' +
          escapeHtml(href) +
          '">' +
          escapeHtml(item.title || 'Opportunity') +
          '</a><br><span class="opp-compare-host">' +
          escapeHtml(item.host || '') +
          '</span></th>'
        );
      })
      .join('');

    var rows = [
      compareRow(
        'Type',
        items.map(function (item) {
          return escapeHtml(typeLabels[item.type] || item.type || '—');
        })
      ),
      compareRow(
        'Investment',
        items.map(function (item) {
          return escapeHtml(metaVal(item.meta, /^investment$/i) || '—');
        })
      ),
      compareRow(
        'Location',
        items.map(function (item) {
          return escapeHtml(item.locationLabel || metaVal(item.meta, /^location$/i) || '—');
        })
      ),
      compareRow(
        'Commitment',
        items.map(function (item) {
          return escapeHtml(metaVal(item.meta, /^commitment$/i) || '—');
        })
      ),
      compareRow(
        'Earnings / return',
        items.map(function (item) {
          var fin = (item.meta || []).find(function (m) {
            return /^(return|earnings|commission|revenue|income|profit)/i.test(m.key);
          });
          return escapeHtml(fin ? fin.key + ': ' + fin.val : '—');
        })
      ),
      compareRow(
        'Cost breakdown',
        items.map(function (item) {
          return q && q.hasCostBreakdown(item) ? 'Yes' : 'No';
        })
      ),
      compareRow(
        'Co. number listed',
        items.map(function (item) {
          return q && q.companiesHouseNumber(item) ? 'Yes' : 'No';
        })
      ),
    ].join('');

    return (
      '<div class="opp-compare-modal" id="opp-compare-modal" role="dialog" aria-labelledby="opp-compare-title" aria-modal="true">' +
      '<div class="opp-compare-backdrop" data-opp-compare-close></div>' +
      '<div class="opp-compare-panel">' +
      '<header class="opp-compare-head">' +
      '<h2 id="opp-compare-title">Compare opportunities</h2>' +
      '<button type="button" class="opp-compare-close" data-opp-compare-close aria-label="Close">×</button>' +
      '</header>' +
      '<div class="opp-compare-scroll">' +
      '<table class="opp-compare-table"><thead><tr><th scope="col"></th>' +
      headers +
      '</tr></thead><tbody>' +
      rows +
      '</tbody></table></div>' +
      '<p class="opp-compare-note">Listings are informational only — not investment advice. Confirm details with each lister.</p>' +
      '</div></div>'
    );
  }

  function bindModal(root) {
    if (!root) return;
    root.querySelectorAll('[data-opp-compare-close]').forEach(function (el) {
      el.addEventListener('click', function () {
        var modal = document.getElementById('opp-compare-modal');
        if (modal) modal.remove();
      });
    });
  }

  window.HubOpportunityCompare = {
    MAX: MAX,
    ids: readIds,
    toggle: toggle,
    isSelected: isSelected,
    clear: clear,
    renderModal: renderModal,
    bindModal: bindModal,
  };
})();
