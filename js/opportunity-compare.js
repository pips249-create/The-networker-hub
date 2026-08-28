/**
 * Compare up to 3 opportunities side-by-side (browse page + My account).
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

  function setIds(ids) {
    var next = [];
    var seen = {};
    (ids || []).forEach(function (id) {
      var key = String(id || '').trim();
      if (!key || seen[key] || next.length >= MAX) return;
      seen[key] = true;
      next.push(key);
    });
    writeIds(next);
    return next.slice();
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

  function itemId(item) {
    if (!item) return '';
    return String(item.id || item.opportunityId || item.opportunity_id || '').trim();
  }

  function listingFromCatalog(catalog, id) {
    if (!catalog || !id) return null;
    if (typeof catalog.getById === 'function') {
      var hit = catalog.getById(id);
      if (hit) return hit;
    }
    var list = catalog.loadCatalog ? catalog.loadCatalog() : [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return list[i];
    }
    return null;
  }

  function normalizeFallback(raw) {
    if (!raw) return null;
    var id = itemId(raw);
    if (!id) return null;
    return {
      id: id,
      opportunityId: id,
      title: raw.title || 'Opportunity',
      host: raw.host || '',
      slug: raw.slug || '',
      type: raw.type || '',
      meta: Array.isArray(raw.meta) ? raw.meta : [],
      locationLabel: raw.locationLabel || raw.location || '',
      investment: raw.investment || '',
      commitment: raw.commitment || '',
      logoUrl: raw.logoUrl || raw.imageUrl || '',
      imageUrl: raw.imageUrl || raw.logoUrl || '',
    };
  }

  function resolveItems(catalog, ids, fallbacks) {
    var fallbackById = {};
    (fallbacks || []).forEach(function (raw) {
      var item = normalizeFallback(raw);
      if (item) fallbackById[item.id] = item;
    });

    return (ids || [])
      .map(function (id) {
        var key = String(id || '').trim();
        if (!key) return null;
        var fromCatalog = listingFromCatalog(catalog, key);
        if (fromCatalog) return fromCatalog;
        return fallbackById[key] || {
          id: key,
          opportunityId: key,
          title: 'Opportunity',
          host: '',
          slug: '',
          type: '',
          meta: [],
          locationLabel: '',
        };
      })
      .filter(Boolean);
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

  function isAffiliateItem(item, catalog) {
    if (catalog && typeof catalog.isAffiliateStyleListing === 'function') {
      return catalog.isAffiliateStyleListing(item);
    }
    var type = String((item && item.type) || '').toLowerCase();
    if (type === 'affiliate') return true;
    var tags = (item && item.tags) || [];
    for (var i = 0; i < tags.length; i++) {
      if (String(tags[i] || '').toLowerCase() === 'affiliate') return true;
    }
    return Boolean(metaVal((item && item.meta) || [], /^commission$/i));
  }

  function allAffiliateItems(items, catalog) {
    return (items || []).length > 0 && items.every(function (item) {
      return isAffiliateItem(item, catalog);
    });
  }

  function cellOrDash(value) {
    var text = String(value || '').trim();
    return text ? escapeHtml(text) : '—';
  }

  function mediaHtml(item) {
    var src = String((item && (item.imageUrl || item.logoUrl)) || '').trim();
    var letter = String((item && item.title) || '?').trim().charAt(0).toUpperCase() || '?';
    if (src) {
      return (
        '<div class="opp-compare-media"><img src="' +
        escapeHtml(src) +
        '" alt="" width="160" height="96" loading="lazy" /></div>'
      );
    }
    return (
      '<div class="opp-compare-media opp-compare-media--placeholder" aria-hidden="true">' +
      escapeHtml(letter) +
      '</div>'
    );
  }

  function listingHref(item) {
    var catalog = window.HubOpportunitiesCatalog;
    if (catalog && typeof catalog.detailHref === 'function') {
      return catalog.detailHref(item);
    }
    if (item && item.slug) {
      return '/opportunities/' + encodeURIComponent(item.slug);
    }
    return '/opportunities/opportunity?id=' + encodeURIComponent(item && item.id ? item.id : '');
  }

  function renderModal(catalog, ids, fallbacks) {
    var items = resolveItems(catalog, ids, fallbacks);
    if (items.length < 2) return '';

    var q = window.HubOpportunityQuality;
    var typeLabels = (catalog && catalog.TYPE_LABELS) || {};

    var headers = items
      .map(function (item) {
        return (
          '<th scope="col">' +
          '<a class="opp-compare-card" href="' +
          escapeHtml(listingHref(item)) +
          '">' +
          mediaHtml(item) +
          '<span class="opp-compare-title">' +
          escapeHtml(item.title || 'Opportunity') +
          '</span>' +
          '<span class="opp-compare-host">' +
          escapeHtml(item.host || '') +
          '</span></a></th>'
        );
      })
      .join('');

    var affiliateMode = allAffiliateItems(items, catalog);
    var typeRow = compareRow(
      'Type',
      items.map(function (item) {
        return escapeHtml(typeLabels[item.type] || item.type || '—');
      })
    );
    var locationRow = compareRow(
      'Location',
      items.map(function (item) {
        return cellOrDash(item.locationLabel || metaVal(item.meta, /^location$/i));
      })
    );
    var companyRow = compareRow(
      'Co. number listed',
      items.map(function (item) {
        return q && q.companiesHouseNumber(item) ? 'Yes' : 'No';
      })
    );

    var rows;
    var note;
    if (affiliateMode) {
      rows = [
        typeRow,
        compareRow(
          'Commission',
          items.map(function (item) {
            return cellOrDash(metaVal(item.meta, /^commission$/i));
          })
        ),
        compareRow(
          'What you promote',
          items.map(function (item) {
            return cellOrDash(metaVal(item.meta, /^what you promote$/i));
          })
        ),
        compareRow(
          'Cookie window',
          items.map(function (item) {
            var cookie = metaVal(item.meta, /^cookie window$/i);
            if (!cookie && catalog && typeof catalog.cookieWindowFromMeta === 'function') {
              cookie = catalog.cookieWindowFromMeta(item.meta);
            }
            return cellOrDash(cookie);
          })
        ),
        compareRow(
          'Who it suits',
          items.map(function (item) {
            return cellOrDash(metaVal(item.meta, /^who it suits$/i));
          })
        ),
        locationRow,
        companyRow,
      ].join('');
      note =
        'Affiliate listings are informational only — confirm commission, tracking, and terms with each programme.';
    } else {
      rows = [
        typeRow,
        compareRow(
          'Investment',
          items.map(function (item) {
            return cellOrDash(metaVal(item.meta, /^investment$/i) || item.investment);
          })
        ),
        locationRow,
        compareRow(
          'Commitment',
          items.map(function (item) {
            return cellOrDash(metaVal(item.meta, /^commitment$/i) || item.commitment);
          })
        ),
        compareRow(
          'Cost breakdown',
          items.map(function (item) {
            return q && q.hasCostBreakdown(item) ? 'Yes' : 'No';
          })
        ),
        companyRow,
      ].join('');
      note =
        'Listings are informational only — not investment advice. Confirm details with each lister.';
    }

    return (
      '<div class="opp-compare-modal" id="opp-compare-modal" role="dialog" aria-labelledby="opp-compare-title" aria-modal="true">' +
      '<div class="opp-compare-backdrop" data-opp-compare-close></div>' +
      '<div class="opp-compare-panel">' +
      '<header class="opp-compare-head">' +
      '<div class="opp-compare-head-main">' +
      '<span class="opp-compare-sheet-handle" aria-hidden="true"></span>' +
      '<h2 id="opp-compare-title">' +
      (affiliateMode ? 'Compare affiliate programmes' : 'Compare opportunities') +
      '</h2>' +
      '</div>' +
      '<button type="button" class="opp-compare-close" data-opp-compare-close aria-label="Close comparison">' +
      '<span class="opp-compare-close-x" aria-hidden="true">×</span> Close' +
      '</button>' +
      '</header>' +
      '<div class="opp-compare-scroll">' +
      '<table class="opp-compare-table"><thead><tr><th scope="col"></th>' +
      headers +
      '</tr></thead><tbody>' +
      rows +
      '</tbody></table></div>' +
      '<div class="opp-compare-foot">' +
      '<p class="opp-compare-note">' +
      escapeHtml(note) +
      '</p>' +
      '<button type="button" class="opp-compare-done" data-opp-compare-close>Done</button>' +
      '</div>' +
      '</div></div>'
    );
  }

  function bindModal(root) {
    if (!root) return;
    function closeModal(clearSelection) {
      var modal = document.getElementById('opp-compare-modal');
      if (!modal) return;
      modal.remove();
      document.body.classList.remove('opp-compare-modal-open');
      document.removeEventListener('keydown', onEscape);
      if (clearSelection) {
        clear();
        try {
          document.dispatchEvent(new CustomEvent('hub-opp-compare-closed', { detail: { cleared: true } }));
        } catch (err) {
          /* ignore */
        }
      } else {
        try {
          document.dispatchEvent(new CustomEvent('hub-opp-compare-closed', { detail: { cleared: false } }));
        } catch (err) {
          /* ignore */
        }
      }
    }
    function onEscape(e) {
      if (e.key === 'Escape') closeModal(false);
    }
    root.querySelectorAll('[data-opp-compare-close]').forEach(function (el) {
      el.addEventListener('click', function () {
        closeModal(false);
      });
    });
    root.querySelectorAll('[data-opp-compare-exit]').forEach(function (el) {
      el.addEventListener('click', function () {
        closeModal(true);
      });
    });
    document.addEventListener('keydown', onEscape);
    document.body.classList.add('opp-compare-modal-open');
  }

  function openModal(catalog, ids, fallbacks) {
    var selected = Array.isArray(ids) && ids.length ? ids : readIds();
    if (selected.length < 2) return false;
    var existing = document.getElementById('opp-compare-modal');
    if (existing) existing.remove();
    var html = renderModal(catalog, selected, fallbacks);
    if (!html) return false;
    document.body.insertAdjacentHTML('beforeend', html);
    bindModal(document.getElementById('opp-compare-modal'));
    return true;
  }

  window.HubOpportunityCompare = {
    MAX: MAX,
    ids: readIds,
    setIds: setIds,
    toggle: toggle,
    isSelected: isSelected,
    clear: clear,
    renderModal: renderModal,
    bindModal: bindModal,
    openModal: openModal,
    resolveItems: resolveItems,
  };
})();
