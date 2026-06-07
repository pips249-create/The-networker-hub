/**
 * The Networker — unified admin panel (SPA, hash routing).
 */
(function () {
  var liveUsers = [];
  var liveListings = [];
  var liveReviews = [];

  var VERCEL_ANALYTICS_URL =
    'https://vercel.com/pips249-create/the-networker-hub/analytics';

  var PAGE_META = {
    dashboard: {
      title: 'Overview',
      subtitle: 'Supabase counts, alerts, and recent genuine platform activity',
    },
    analytics: {
      title: 'Web Analytics',
      subtitle: 'Visitor traffic on Vercel · platform insights and top performers from Supabase',
    },
    'event-health': {
      title: 'Event data issues',
      subtitle: 'Fix published events missing dates, organisers, VAT, or profile data',
    },
    'group-cleanup': {
      title: 'Group profile cleanup',
      subtitle: 'Add descriptions, logos, and websites to organiser profiles in Supabase',
    },
    'event-cleanup': {
      title: 'Event cleanup',
      subtitle: 'Link events to groups, create new events, and fix basic event data',
    },
    users: {
      title: 'Users & accounts',
      subtitle: 'Search Supabase accounts (read-only) — use Impersonate to debug as a user',
    },
    impersonate: {
      title: 'Impersonate user',
      subtitle: 'Sign in as any non-admin account to see exactly what they see on the Hub',
    },
    moderation: {
      title: 'Content moderation',
      subtitle: 'Read-only view of events and reviews in Supabase',
    },
    financials: {
      title: 'Financial hub',
      subtitle: 'Ticket revenue from registrations · Stripe Connect status per organiser',
    },
    sponsorship: {
      title: 'Sponsorship & ads',
      subtitle: 'Edit CMS ad slots on browse, event, and organiser pages',
    },
    emails: {
      title: 'Email templates',
      subtitle: 'Edit transactional copy in Supabase · test sends need Resend configured',
    },
  };

  var EVENT_TYPES = [
    'Networking meeting',
    'Netwalking',
    'Conference',
    'Exhibition',
    'Awards ceremony',
  ];
  var MEETING_FORMATS = ['In person', 'Online', 'Hybrid'];
  var healthCache = null;
  var groupCleanupCache = null;
  var eventCleanupCache = null;
  var analyticsState = { period: '30d' };
  var groupCleanupState = { offset: 0, q: '', incomplete: false, hasMore: false, total: 0, loading: false, selected: {} };
  var eventCleanupState = { organiserId: '', unlinked: false, offset: 0, q: '', hasMore: false, total: 0, loading: false };
  var GROUP_PAGE_SIZE = 30;
  var EVENT_PAGE_SIZE = 20;
  var adminLogoPending = {};
  var groupSearchTimer = null;
  var eventSearchTimer = null;
  var groupLoadObserver = null;
  var eventLoadObserver = null;

  /** CMS ad placements — each maps to a cms_blocks.slot row. */
  var CMS_AD_SLOTS = [
    {
      key: 'sponsor_hub',
      label: 'Browse pages — Hero Sponsor Hub',
      preview: 'hero',
      help: 'Shown in the hero on Events and Organisers browse pages.',
      tagline: 'Example offer — edit to match your sponsor package',
      bullets: [
        'Premium placement beside Featured events',
        'Short line of copy',
        'Direct link to your landing page',
      ],
      ctaLabel: 'Enquire now',
      ctaUrl: 'mailto:sales@the-networker.co.uk?subject=Sponsor%20Hub%20enquiry',
    },
    {
      key: 'event_page_sidebar_ad',
      label: 'Event page — Sidebar ad',
      preview: 'compact',
      help: 'Logo and CTA button beside ticket checkout. Set the button link to the sponsor website.',
      tagline: '',
      bullets: [],
      ctaLabel: 'Enquire now',
      ctaUrl: 'https://',
    },
    {
      key: 'organiser_page_sidebar_ad',
      label: 'Organiser page — Sidebar ad',
      preview: 'compact',
      help: 'Logo and CTA button on organiser profiles. Set the button link to the sponsor website.',
      tagline: '',
      bullets: [],
      ctaLabel: 'Enquire now',
      ctaUrl: 'https://',
    },
  ];

  function cmsSlotByKey(key) {
    for (var i = 0; i < CMS_AD_SLOTS.length; i++) {
      if (CMS_AD_SLOTS[i].key === key) return CMS_AD_SLOTS[i];
    }
    return CMS_AD_SLOTS[0];
  }

  var shell = document.getElementById('admin-shell');
  var gate = document.getElementById('admin-gate');
  var main = document.getElementById('admin-main');
  var currentUser = null;
  var selectedUser = null;
  var adminLayoutResizeBound = false;

  function syncAdminLayoutOffset() {
    var nav = document.querySelector('.site-nav');
    var banner = document.getElementById('hub-impersonation-banner');
    var h = 0;
    if (nav) h += nav.offsetHeight;
    if (banner) h += banner.offsetHeight;
    if (h < 1) h = 76;
    document.documentElement.style.setProperty('--admin-nav-offset', Math.round(h) + 'px');
  }

  function bindAdminLayoutSync() {
    syncAdminLayoutOffset();
    if (adminLayoutResizeBound) return;
    adminLayoutResizeBound = true;
    window.addEventListener('resize', syncAdminLayoutOffset);
  }

  function fmtMoney(n) {
    return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtTime(iso) {
    try {
      return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function attrEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function formField(form, name) {
    if (!form || !form.elements) return null;
    return form.elements.namedItem(name);
  }

  function formFieldVal(form, name) {
    var el = formField(form, name);
    return el ? String(el.value || '').trim() : '';
  }

  function setActiveNav(route) {
    document.querySelectorAll('.admin-nav-link').forEach(function (a) {
      var on = a.getAttribute('data-route') === route;
      a.classList.toggle('bg-white/15', on);
      a.classList.toggle('text-white', on);
      a.classList.toggle('text-white/80', !on);
    });
    var meta = PAGE_META[route] || PAGE_META.dashboard;
    document.getElementById('page-title').textContent = meta.title;
    document.getElementById('page-subtitle').textContent = meta.subtitle;
    syncAdminLayoutOffset();
  }

  function updateHealthBadge(count) {
    var badge = document.getElementById('admin-health-badge');
    if (!badge) return;
    var n = Number(count) || 0;
    if (n > 0) {
      badge.textContent = n > 99 ? '99+' : String(n);
      badge.classList.remove('hidden');
      badge.setAttribute('aria-label', n + ' events need data fixes');
    } else {
      badge.classList.add('hidden');
      badge.setAttribute('aria-label', 'No event data issues');
    }
  }

  function adminGet(url) {
    return fetch(url, { credentials: 'include' })
      .then(function (r) {
        return r.json().then(function (data) {
          data = data || {};
          if (!r.ok) {
            data.error = data.error || data.message || 'request_failed';
            data.ok = false;
          }
          return data;
        });
      })
      .catch(function (err) {
        return {
          ok: false,
          error: 'network_error',
          message: (err && err.message) || 'Request failed',
        };
      });
  }

  function adminPost(url, body) {
    return fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) {
          data = data || {};
          data.error = data.error || data.message || 'request_failed';
        }
        return data;
      });
    });
  }

  function adminPatch(url, body) {
    return fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) {
          data = data || {};
          data.error = data.error || data.message || 'request_failed';
        }
        return data;
      });
    });
  }

  function alertCard(a) {
    var bg =
      a.severity === 'high'
        ? 'bg-red-50 border-red-200 text-red-800'
        : a.severity === 'medium'
          ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-slate-50 border-slate-200 text-slate-700';
    var inner =
      '<p class="font-semibold text-sm">' +
      esc(a.title) +
      '</p><p class="text-xs mt-1 opacity-90">' +
      esc(a.detail) +
      '</p>';
    if (a.href) {
      return (
        '<a href="' +
        esc(a.href) +
        '" class="block rounded-lg border p-4 transition hover:opacity-90 ' +
        bg +
        '">' +
        inner +
        '</a>'
      );
    }
    return '<div class="rounded-lg border p-4 ' + bg + '">' + inner + '</div>';
  }

  function renderAttentionQueue(attention) {
    if (!attention) {
      return '<p class="text-sm text-slate-500">Loading…</p>';
    }
    var pending = attention.pendingEvents || [];
    var parts = [];

    if (pending.length) {
      parts.push(
        '<div class="rounded-lg border border-amber-200 bg-amber-50 p-4">' +
          '<p class="font-semibold text-sm text-amber-900">' +
          pending.length +
          ' event' +
          (pending.length === 1 ? '' : 's') +
          ' pending approval</p>' +
          '<ul class="mt-2 space-y-1.5">'
      );
      pending.slice(0, 6).forEach(function (e) {
        parts.push(
          '<li class="text-sm text-amber-900"><span class="font-medium">' +
            esc(e.title) +
            '</span> <span class="text-xs text-amber-800/80">· ' +
            esc(e.organiser) +
            '</span></li>'
        );
      });
      parts.push(
        '</ul><a href="#moderation" class="text-xs font-semibold text-amber-900 mt-3 inline-block hover:underline">Open approval queue →</a></div>'
      );
    }

    var links = [];
    if (attention.incompleteOrganisers > 0) {
      links.push(
        '<a href="#group-cleanup" class="text-sm font-semibold text-brand-700 hover:underline">' +
          attention.incompleteOrganisers +
          ' organiser profile' +
          (attention.incompleteOrganisers === 1 ? '' : 's') +
          ' missing data</a>'
      );
    }
    if (attention.spamReviews > 0) {
      links.push(
        '<a href="#moderation" class="text-sm font-semibold text-brand-700 hover:underline">' +
          attention.spamReviews +
          ' spam-like review' +
          (attention.spamReviews === 1 ? '' : 's') +
          '</a>'
      );
    }
    if (links.length) {
      parts.push('<div class="flex flex-wrap gap-x-4 gap-y-2 mt-3">' + links.join('') + '</div>');
    }

    if (!parts.length) {
      return '<p class="text-sm text-emerald-700">Nothing needs immediate action right now.</p>';
    }
    return parts.join('');
  }

  function fetchEventHealth() {
    return fetch('/api/admin/event-health', { credentials: 'include' })
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) {
            data = data || {};
            data.error = data.error || 'request_failed';
            return data;
          }
          if (data && data.configured !== false) {
            healthCache = data;
            updateHealthBadge(data.count);
          }
          return data;
        });
      })
      .catch(function () {
        return { error: 'network_error' };
      });
  }

  function issueBadge(issue) {
    var cls =
      issue.severity === 'high'
        ? 'bg-red-100 text-red-800'
        : issue.severity === 'medium'
          ? 'bg-amber-100 text-amber-900'
          : 'bg-slate-100 text-slate-700';
    return (
      '<span class="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mr-1 mb-1 ' +
      cls +
      '">' +
      esc(issue.label) +
      '</span>'
    );
  }

  function toDatetimeLocalValue(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      var pad = function (n) {
        return String(n).padStart(2, '0');
      };
      return (
        d.getFullYear() +
        '-' +
        pad(d.getMonth() + 1) +
        '-' +
        pad(d.getDate()) +
        'T' +
        pad(d.getHours()) +
        ':' +
        pad(d.getMinutes())
      );
    } catch (e) {
      return '';
    }
  }

  var HEALTH_SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
  var EVENT_HEALTH_HISTORY_KEY = 'tnh_event_health_completed_v1';
  var EVENT_HEALTH_HISTORY_MAX = 15;

  function loadEventHealthHistory() {
    try {
      var raw = localStorage.getItem(EVENT_HEALTH_HISTORY_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function pushEventHealthCompletion(entry) {
    var list = loadEventHealthHistory().filter(function (x) {
      return x.eventId !== entry.eventId;
    });
    list.unshift(entry);
    if (list.length > EVENT_HEALTH_HISTORY_MAX) {
      list = list.slice(0, EVENT_HEALTH_HISTORY_MAX);
    }
    try {
      localStorage.setItem(EVENT_HEALTH_HISTORY_KEY, JSON.stringify(list));
    } catch (e) {
      /* ignore quota errors */
    }
  }

  function recordEventHealthCompletion(beforeEv, afterData) {
    if (!beforeEv || !beforeEv.id) return;
    var stillFlagged = (afterData.events || []).some(function (e) {
      return e.id === beforeEv.id;
    });
    if (stillFlagged) return;
    pushEventHealthCompletion({
      eventId: beforeEv.id,
      title: beforeEv.title || 'Untitled',
      slug: beforeEv.slug || '',
      fixedIssues: (beforeEv.issues || []).map(function (i) {
        return i.label;
      }),
      completedAt: new Date().toISOString(),
    });
  }

  function eventSeverityRank(ev) {
    var rank = 9;
    (ev.issues || []).forEach(function (i) {
      var order = HEALTH_SEVERITY_ORDER[i.severity];
      if (order != null && order < rank) rank = order;
    });
    return rank;
  }

  function renderEventHealthCompletedHtml() {
    var list = loadEventHealthHistory();
    if (!list.length) {
      return (
        '<section class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">' +
        '<h3 class="font-bold text-brand-900 text-sm">Recently completed</h3>' +
        '<p class="text-sm text-slate-500 mt-2">Fixes you save here will appear in this list (stored in this browser).</p></section>'
      );
    }
    return (
      '<section class="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden">' +
      '<div class="px-4 py-3 border-b border-emerald-100 bg-emerald-50/80">' +
      '<h3 class="font-bold text-emerald-900 text-sm">Recently completed</h3>' +
      '<p class="text-xs text-emerald-800/80 mt-0.5">Events that passed the health scan after your last save (this browser only).</p></div>' +
      '<ul class="divide-y divide-slate-100">' +
      list
        .map(function (item) {
          var issues =
            item.fixedIssues && item.fixedIssues.length
              ? item.fixedIssues.join(', ')
              : 'All issues cleared';
          var eventHref = item.slug
            ? '../events/' + encodeURIComponent(item.slug)
            : '';
          return (
            '<li class="px-4 py-3 flex flex-wrap items-start justify-between gap-3">' +
            '<div class="min-w-0">' +
            '<p class="font-medium text-brand-900">' +
            esc(item.title) +
            '</p>' +
            '<p class="text-xs text-slate-500 mt-0.5">' +
            esc(issues) +
            '</p>' +
            '<time class="text-xs text-slate-400 mt-1 block">' +
            esc(fmtTime(item.completedAt)) +
            '</time></div>' +
            (eventHref
              ? '<a href="' +
                attrEsc(eventHref) +
                '" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline shrink-0">View event</a>'
              : '') +
            '</li>'
          );
        })
        .join('') +
      '</ul></section>'
    );
  }

  function paintEventHealthCompleted() {
    var slot = document.getElementById('event-health-completed');
    if (slot) slot.innerHTML = renderEventHealthCompletedHtml();
  }

  function issueCodes(ev) {
    return (ev.issues || []).map(function (i) {
      return i.code;
    });
  }

  function healthFieldVisibility(ev) {
    var codes = issueCodes(ev);
    return {
      showDate: codes.indexOf('missing_date') >= 0,
      showOrganiser:
        codes.indexOf('missing_organiser') >= 0 || codes.indexOf('invalid_organiser') >= 0,
      showOrganiserNotPublished: codes.indexOf('organiser_not_published') >= 0,
      showEventType: codes.indexOf('missing_event_type') >= 0,
      showFormat: codes.indexOf('missing_meeting_type') >= 0,
      showVat: codes.indexOf('missing_vat') >= 0,
      showOrgLogo: codes.indexOf('missing_organiser_logo') >= 0,
      showOrgBio: codes.indexOf('missing_organiser_profile') >= 0,
    };
  }

  function mergeOrganisersForSelect(allOrganisers, ev) {
    var list = (allOrganisers || []).slice();
    if (
      ev.organiser_id &&
      !list.some(function (o) {
        return String(o.id) === String(ev.organiser_id);
      })
    ) {
      list.unshift({
        id: ev.organiser_id,
        name: ev.organiser_name || ev.organiser_id,
        listingStatus: '',
        slug: ev.organiser_slug || '',
      });
    }
    return list;
  }

  function organiserOptionsHtml(organisers, selectedId) {
    var selected = String(selectedId || '');
    var sorted = (organisers || []).slice().sort(function (a, b) {
      var aPub = a.listingStatus === 'published' ? 0 : 1;
      var bPub = b.listingStatus === 'published' ? 0 : 1;
      if (aPub !== bPub) return aPub - bPub;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return (
      '<option value="">— Choose organiser —</option>' +
      sorted
        .map(function (o) {
          var label = o.name || o.id;
          if (o.listingStatus && o.listingStatus !== 'published') {
            label += ' (' + o.listingStatus + ')';
          }
          return (
            '<option value="' +
            attrEsc(o.id) +
            '"' +
            (selected && selected === String(o.id) ? ' selected' : '') +
            '>' +
            esc(label) +
            '</option>'
          );
        })
        .join('')
    );
  }

  function saveEventHealthForm(form) {
    var article = form.closest('[data-event-id]');
    var id = article && article.getAttribute('data-event-id');
    var organiserId = article && article.getAttribute('data-organiser-id');
    var msg = form.querySelector('.event-health-msg');
    var btn = form.querySelector('button[type="submit"]');
    if (!id) return;

    var eventPayload = { id: id };
    var hasEventPatch = false;
    if (formField(form, 'starts_at')) {
      var starts = formFieldVal(form, 'starts_at');
      eventPayload.starts_at = starts ? new Date(starts).toISOString() : null;
      hasEventPatch = true;
    }
    if (formField(form, 'organiser_id')) {
      eventPayload.organiser_id = formFieldVal(form, 'organiser_id') || null;
      hasEventPatch = true;
    }
    if (formField(form, 'event_type')) {
      eventPayload.event_type = formFieldVal(form, 'event_type') || null;
      hasEventPatch = true;
    }
    if (formField(form, 'meeting_type')) {
      eventPayload.meeting_type = formFieldVal(form, 'meeting_type') || null;
      hasEventPatch = true;
    }
    if (formField(form, 'vat_treatment')) {
      eventPayload.vat_treatment = formFieldVal(form, 'vat_treatment') || null;
      hasEventPatch = true;
    }

    var organiserPayload = null;
    var organiserFieldId =
      (formField(form, 'organiser_id') && formFieldVal(form, 'organiser_id')) ||
      organiserId ||
      '';
    if (
      organiserFieldId &&
      (formField(form, 'organiser_photo_url') || formField(form, 'organiser_description'))
    ) {
      organiserPayload = { id: organiserFieldId };
      if (formField(form, 'organiser_photo_url')) {
        organiserPayload.photo_url = formFieldVal(form, 'organiser_photo_url');
      }
      if (formField(form, 'organiser_description')) {
        organiserPayload.description = formFieldVal(form, 'organiser_description');
      }
    }

    if (!hasEventPatch && !organiserPayload) return;

    var beforeFix = null;
    if (healthCache && healthCache.events) {
      beforeFix = healthCache.events.find(function (e) {
        return e.id === id;
      });
    }

    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Saving…';
      msg.className = 'event-health-msg text-xs text-slate-500';
    }

    function postJson(url, payload) {
      return fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok || body.ok === false) {
            throw new Error(body.message || body.error || 'Save failed (' + r.status + ')');
          }
          return body;
        });
      });
    }

    var chain = Promise.resolve();
    if (hasEventPatch) {
      chain = chain.then(function () {
        return postJson('/api/admin/events', eventPayload);
      });
    }
    if (organiserPayload) {
      chain = chain.then(function () {
        return postJson('/api/admin/organisers', organiserPayload);
      });
    }

    chain
      .then(function () {
        if (msg) {
          msg.textContent = 'Saved — rescanning…';
          msg.className = 'event-health-msg text-xs text-emerald-700 font-semibold';
        }
        return fetchEventHealth();
      })
      .then(function (data) {
        if (beforeFix && data) recordEventHealthCompletion(beforeFix, data);
        renderEventHealth();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not save';
          msg.className = 'event-health-msg text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function bindEventHealthForms() {
    if (!main || main.dataset.healthBound) return;
    main.dataset.healthBound = '1';
    main.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.classList || !form.classList.contains('event-health-form')) return;
      e.preventDefault();
      saveEventHealthForm(form);
    });
    main.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-use-first-organiser]');
      if (!btn) return;
      var article = btn.closest('[data-event-id]');
      var form = article && article.querySelector('.event-health-form');
      var select = form && formField(form, 'organiser_id');
      var firstId = btn.getAttribute('data-use-first-organiser');
      if (select && firstId) {
        select.value = firstId;
        select.focus();
      }
    });
  }

  function approvePendingEvent(eventId, btn) {
    if (!eventId) return;
    if (btn) btn.disabled = true;
    fetch('/api/admin/events', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: eventId, status: 'published' }),
    })
      .then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok || body.ok === false) {
            throw new Error(body.message || body.error || 'Approve failed');
          }
          return body;
        });
      })
      .then(function () {
        renderModeration();
      })
      .catch(function (err) {
        if (btn) btn.disabled = false;
        window.alert(err.message || 'Could not approve event.');
      });
  }

  function bindModerationActions() {
    if (!main || main.dataset.moderationBound) return;
    main.dataset.moderationBound = '1';
    main.addEventListener('click', function (e) {
      var btn = e.target.closest('.moderation-approve-btn');
      if (!btn) return;
      var eventId = btn.getAttribute('data-event-id');
      if (!eventId) return;
      if (!window.confirm('Approve this event and publish it on the Hub?')) return;
      approvePendingEvent(eventId, btn);
    });
  }

  function renderEventHealth() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<p class="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">Checks <strong>published</strong> events only. Listings awaiting approval are in <a href="#moderation" class="text-brand-700 font-semibold hover:underline">Content Moderation</a> — not here.</p>' +
      '<div id="event-health-status" class="text-sm text-slate-500">Scanning published events…</div>' +
      '<div id="event-health-summary" class="hidden admin-metric-grid admin-metric-grid--4"></div>' +
      '<div id="event-health-list" class="space-y-3"></div>' +
      '<div id="event-health-completed"></div></div>';

    paintEventHealthCompleted();

    fetchEventHealth().then(function (data) {
      var status = document.getElementById('event-health-status');
      var summary = document.getElementById('event-health-summary');
      var list = document.getElementById('event-health-list');
      if (!status || !summary || !list) return;

      if (!data || data.error) {
        status.innerHTML =
          '<span class="text-red-700 font-semibold">Could not load event health (' +
          esc(data && data.error ? data.error : 'unknown') +
          '). Try signing in again.</span>';
        return;
      }

      if (data.configured === false) {
        status.textContent = 'Supabase is not configured — event health checks are unavailable.';
        return;
      }

      if (!data.count) {
        status.innerHTML =
          '<span class="text-emerald-700 font-semibold">All ' +
          (data.totalPublished || 0) +
          ' published events look complete.</span>';
        summary.classList.add('hidden');
        list.innerHTML = '';
        paintEventHealthCompleted();
        return;
      }

      var organisers = data.organisers || [];
      var needsOrganiserLink = (data.events || []).some(function (ev) {
        var codes = issueCodes(ev);
        return codes.indexOf('missing_organiser') >= 0 || codes.indexOf('invalid_organiser') >= 0;
      });
      var statusHint = needsOrganiserLink
        ? organisers.length
          ? ' <span class="text-slate-500">Choose an organiser for each event below.</span>'
          : ' <span class="text-red-700 font-semibold">No organisers found — create one in the Organiser dashboard first.</span>'
        : ' <span class="text-slate-500">Only the flagged fields are shown — fill them in and save.</span>';
      status.innerHTML =
        '<span class="text-brand-900 font-semibold">' +
        data.count +
        ' of ' +
        (data.totalPublished || data.count) +
        ' published event' +
        (data.totalPublished === 1 ? '' : 's') +
        (data.count === 1 ? ' needs' : ' need') +
        ' attention.</span>' +
        statusHint;

      var issueCards = Object.keys(data.issuesByCode || {})
        .map(function (code) {
          var sample = { label: code, severity: 'low' };
          (data.events || []).some(function (ev) {
            var hit = (ev.issues || []).find(function (i) {
              return i.code === code;
            });
            if (hit) sample = hit;
            return !!hit;
          });
          return { code: code, sample: sample, count: data.issuesByCode[code] };
        })
        .sort(function (a, b) {
          var sa = HEALTH_SEVERITY_ORDER[a.sample.severity] != null ? HEALTH_SEVERITY_ORDER[a.sample.severity] : 9;
          var sb = HEALTH_SEVERITY_ORDER[b.sample.severity] != null ? HEALTH_SEVERITY_ORDER[b.sample.severity] : 9;
          if (sa !== sb) return sa - sb;
          return String(a.sample.label).localeCompare(String(b.sample.label));
        })
        .map(function (row) {
          return (
            '<div class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">' +
            '<p class="text-xs text-slate-500 uppercase font-semibold">' +
            esc(row.sample.label) +
            '</p>' +
            '<p class="text-xl font-bold text-brand-900 mt-1">' +
            row.count +
            '</p></div>'
          );
        })
        .join('');
      summary.innerHTML = issueCards;
      summary.classList.remove('hidden');

      var sortedOrganisers = organisers.slice().sort(function (a, b) {
        var aPub = a.listingStatus === 'published' ? 0 : 1;
        var bPub = b.listingStatus === 'published' ? 0 : 1;
        if (aPub !== bPub) return aPub - bPub;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
      var firstOrganiserId = sortedOrganisers.length ? sortedOrganisers[0].id : '';

      list.innerHTML = (data.events || [])
        .map(function (ev) {
          var fields = healthFieldVisibility(ev);
          var issueHtml = (ev.issues || []).map(issueBadge).join('');
          var needsOrganiser = fields.showOrganiser;
          var hasEventFields =
            fields.showDate ||
            fields.showOrganiser ||
            fields.showEventType ||
            fields.showFormat ||
            fields.showVat;
          var hasOrgFields = fields.showOrgLogo || fields.showOrgBio || fields.showOrganiserNotPublished;
          var organiserSelectList = mergeOrganisersForSelect(organisers, ev);
          var typeOptions = EVENT_TYPES.map(function (t) {
            return (
              '<option value="' +
              attrEsc(t) +
              '"' +
              (ev.event_type === t ? ' selected' : '') +
              '>' +
              esc(t) +
              '</option>'
            );
          }).join('');
          var formatOptions = MEETING_FORMATS.map(function (f) {
            return (
              '<option value="' +
              attrEsc(f) +
              '"' +
              (ev.meeting_type === f ? ' selected' : '') +
              '>' +
              esc(f) +
              '</option>'
            );
          }).join('');
          var vatVal = ev.vat_treatment || '';
          var orgEditHref =
            '../organiser/group-edit.html?id=' + encodeURIComponent(ev.organiser_id || '');
          var orgPublicHref = ev.organiser_slug
            ? '../organisers/' + encodeURIComponent(ev.organiser_slug)
            : '';
          var saveLabel = hasOrgFields && !hasEventFields ? 'Save organiser profile' : 'Save fixes';
          var canSave = hasEventFields || fields.showOrgLogo || fields.showOrgBio;

          var eventFieldsHtml = '';
          if (fields.showDate) {
            eventFieldsHtml +=
              '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Event date & time</label>' +
              '<input type="datetime-local" name="starts_at" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white" value="' +
              attrEsc(toDatetimeLocalValue(ev.starts_at)) +
              '"></div>';
          }
          if (fields.showOrganiser) {
            eventFieldsHtml +=
              '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Organiser</label>' +
              '<select name="organiser_id" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white ring-2 ring-red-200">' +
              organiserOptionsHtml(organiserSelectList, ev.organiser_id) +
              '</select>' +
              (firstOrganiserId
                ? '<button type="button" class="mt-2 text-xs font-semibold text-brand-700 hover:underline" data-use-first-organiser="' +
                  attrEsc(firstOrganiserId) +
                  '">Use first available organiser</button>'
                : '') +
              '</div>';
          }
          if (fields.showEventType) {
            eventFieldsHtml +=
              '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Event type</label>' +
              '<select name="event_type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">' +
              '<option value="">—</option>' +
              typeOptions +
              '</select></div>';
          }
          if (fields.showFormat) {
            eventFieldsHtml +=
              '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Format</label>' +
              '<select name="meeting_type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">' +
              '<option value="">—</option>' +
              formatOptions +
              '</select></div>';
          }
          if (fields.showVat) {
            eventFieldsHtml +=
              '<div><label class="block text-xs font-semibold text-slate-500 mb-1">VAT (paid tickets)</label>' +
              '<select name="vat_treatment" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">' +
              '<option value="">—</option>' +
              '<option value="included"' +
              (vatVal === 'included' ? ' selected' : '') +
              '>Prices include VAT</option>' +
              '<option value="added"' +
              (vatVal === 'added' ? ' selected' : '') +
              '>VAT added at checkout</option>' +
              '</select></div>';
          }

          var orgFieldsHtml = '';
          if (hasOrgFields) {
            orgFieldsHtml +=
              '<div class="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-3">';
            if (fields.showOrganiserNotPublished) {
              orgFieldsHtml +=
                '<div class="rounded-lg border border-amber-300 bg-white/80 p-3">' +
                '<p class="text-sm font-semibold text-brand-900">Organiser profile is not published</p>' +
                '<p class="text-xs text-slate-600 mt-1">This event is published but the linked organiser is still <strong>' +
                esc(ev.organiser_listing_status || 'draft') +
                '</strong>. Complete and publish the group in ' +
                '<a href="#group-cleanup" class="text-brand-700 font-semibold hover:underline">Group profile cleanup</a>.</p></div>';
            }
            if (fields.showOrgLogo || fields.showOrgBio) {
              orgFieldsHtml +=
                '<div class="flex flex-wrap items-start justify-between gap-2">' +
                '<div>' +
                '<p class="text-sm font-semibold text-brand-900">Organiser: ' +
                esc(ev.organiser_name || 'Unknown') +
                '</p>' +
                '<p class="text-xs text-slate-600 mt-1">Add the missing logo or bio here, or open the full profile editor.</p>' +
                '</div>' +
                '<div class="flex flex-wrap gap-2 shrink-0">' +
                '<a href="' +
                attrEsc(orgEditHref) +
                '" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline">Full profile editor</a>' +
                (orgPublicHref
                  ? '<a href="' +
                    attrEsc(orgPublicHref) +
                    '" target="_blank" rel="noopener" class="text-xs font-semibold text-slate-600 hover:underline">View public profile</a>'
                  : '') +
                '</div></div>';
            }
            if (fields.showOrgLogo) {
              orgFieldsHtml +=
                '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Logo image URL</label>' +
                '<input type="url" name="organiser_photo_url" placeholder="https://…" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white" value="' +
                attrEsc(ev.organiser_photo_url || '') +
                '">' +
                '<p class="text-[11px] text-slate-500 mt-1">Paste a direct link to the organiser logo image.</p></div>';
            }
            if (fields.showOrgBio) {
              orgFieldsHtml +=
                '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Organiser bio</label>' +
                '<textarea name="organiser_description" rows="4" placeholder="A short description of this organiser…" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">' +
                esc(ev.organiser_description || '') +
                '</textarea></div>';
            }
            orgFieldsHtml += '</div>';
          }

          return (
            '<article class="bg-white rounded-xl border border-slate-200 shadow-sm" data-event-id="' +
            attrEsc(ev.id) +
            '"' +
            (ev.organiser_id ? ' data-organiser-id="' + attrEsc(ev.organiser_id) + '"' : '') +
            '>' +
            '<div class="p-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">' +
            '<div class="min-w-0 flex-1">' +
            '<h3 class="font-bold text-brand-900">' +
            esc(ev.title || 'Untitled') +
            '</h3>' +
            '<p class="text-xs text-slate-500 mt-1">/' +
            esc(ev.slug || '') +
            '</p>' +
            (ev.organiser_name
              ? '<p class="text-xs text-slate-600 mt-1">Organiser: <span class="font-medium">' +
                esc(ev.organiser_name) +
                '</span></p>'
              : '') +
            '<div class="mt-2">' +
            issueHtml +
            '</div>' +
            (needsOrganiser
              ? '<p class="text-xs text-red-800 mt-2">Select an organiser below, then click <strong>Save fixes</strong>.</p>'
              : '') +
            '</div>' +
            '<div class="flex flex-wrap gap-2 shrink-0">' +
            '<a href="../events/' +
            esc(ev.slug || '') +
            '" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline">View event page</a>' +
            '</div></div>' +
            '<form class="event-health-form p-4 grid sm:grid-cols-2 gap-4 text-sm">' +
            eventFieldsHtml +
            orgFieldsHtml +
            '<div class="sm:col-span-2 flex flex-wrap items-center gap-3 pt-1">' +
            (canSave
              ? '<button type="submit" class="rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900 disabled:opacity-50">' +
                esc(saveLabel) +
                '</button>' +
                '<span class="event-health-msg text-xs text-slate-500"></span>'
              : '') +
            '</div></form></article>'
          );
        })
        .join('');
      paintEventHealthCompleted();
    });
  }

  function analyticsTrackingActive() {
    return (
      !!document.querySelector('script[src*="insights/script.js"]') ||
      typeof window.va === 'function'
    );
  }

  function renderActivityList(activity, limit) {
    var items = (activity || []).slice(0, limit || 6);
    if (!items.length) {
      return '<li class="text-sm text-slate-500">No recent genuine activity yet.</li>';
    }
    return items
      .map(function (item) {
        return (
          '<li class="relative pl-5 pb-4 border-l-2 border-brand-200 last:pb-0">' +
          '<span class="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-brand-500"></span>' +
          '<time class="text-xs text-slate-400 block">' +
          fmtTime(item.time) +
          '</time>' +
          '<p class="text-sm text-slate-700 mt-0.5 break-words">' +
          esc(item.text) +
          '</p></li>'
        );
      })
      .join('');
  }

  function analyticsPeriodLabel(period) {
    if (period === '7d') return 'Last 7 days';
    if (period === 'all') return 'All time';
    return 'Last 30 days';
  }

  function analyticsPeriodBtn(period, label) {
    var active = analyticsState.period === period;
    return (
      '<button type="button" data-analytics-period="' +
      esc(period) +
      '" class="rounded-lg px-3 py-1.5 text-xs font-semibold transition ' +
      (active
        ? 'bg-brand-700 text-white'
        : 'bg-slate-100 text-slate-700 hover:bg-slate-200') +
      '">' +
      esc(label) +
      '</button>'
    );
  }

  function fmtPctChange(n) {
    if (n == null || n === '') return '—';
    var num = Number(n);
    if (Number.isNaN(num)) return '—';
    return (num > 0 ? '+' : '') + num + '%';
  }

  function fmtRating(n) {
    if (n == null || n === '') return '—';
    return String(n) + '★';
  }

  function insightsEmptyRow(colspan, message) {
    return (
      '<tr><td colspan="' +
      colspan +
      '" class="px-4 py-5 text-sm text-slate-500">' +
      esc(message) +
      '</td></tr>'
    );
  }

  function renderInsightsTopOrganisers(rows) {
    if (!rows.length) {
      return insightsEmptyRow(5, 'No organiser activity in this period yet.');
    }
    return rows
      .map(function (o, i) {
        return (
          '<tr class="border-t border-slate-100">' +
          '<td class="px-3 py-2.5 text-slate-400 text-xs">' +
          (i + 1) +
          '</td>' +
          '<td class="px-3 py-2.5 font-medium text-brand-900">' +
          esc(o.name) +
          '</td>' +
          '<td class="px-3 py-2.5 text-right font-semibold">' +
          esc(fmtMoney(o.revenue || 0)) +
          '</td>' +
          '<td class="px-3 py-2.5 text-right">' +
          esc(String(o.registrations || 0)) +
          '</td>' +
          '<td class="px-3 py-2.5 text-right text-slate-600">' +
          esc(fmtRating(o.avgRating)) +
          (o.reviewCount ? ' <span class="text-slate-400">(' + o.reviewCount + ')</span>' : '') +
          '</td></tr>'
        );
      })
      .join('');
  }

  function renderInsightsTopEvents(rows) {
    if (!rows.length) {
      return insightsEmptyRow(6, 'No event activity in this period yet.');
    }
    return rows
      .map(function (e, i) {
        var fill =
          e.fillRatePct != null
            ? e.fillRatePct + '%' + (e.capacity ? ' of ' + e.capacity : '')
            : '—';
        return (
          '<tr class="border-t border-slate-100">' +
          '<td class="px-3 py-2.5 text-slate-400 text-xs">' +
          (i + 1) +
          '</td>' +
          '<td class="px-3 py-2.5 min-w-[140px]"><span class="font-medium text-brand-900">' +
          esc(e.title) +
          '</span><span class="block text-xs text-slate-500">' +
          esc(e.organiser) +
          (e.city ? ' · ' + esc(e.city) : '') +
          '</span></td>' +
          '<td class="px-3 py-2.5 text-right font-semibold">' +
          esc(fmtMoney(e.revenue || 0)) +
          '</td>' +
          '<td class="px-3 py-2.5 text-right">' +
          esc(String(e.registrations || 0)) +
          '</td>' +
          '<td class="px-3 py-2.5 text-right text-slate-600">' +
          esc(fmtRating(e.avgRating)) +
          '</td>' +
          '<td class="px-3 py-2.5 text-right text-xs text-slate-500">' +
          esc(fill) +
          '</td></tr>'
        );
      })
      .join('');
  }

  function renderInsightsTopAttendees(rows) {
    if (!rows.length) {
      return insightsEmptyRow(4, 'No paid attendee activity in this period yet.');
    }
    return rows
      .map(function (a, i) {
        return (
          '<tr class="border-t border-slate-100">' +
          '<td class="px-3 py-2.5 text-slate-400 text-xs">' +
          (i + 1) +
          '</td>' +
          '<td class="px-3 py-2.5"><span class="font-medium text-brand-900">' +
          esc(a.name) +
          '</span>' +
          (a.email ? '<span class="block text-xs text-slate-500">' + esc(a.email) + '</span>' : '') +
          '</td>' +
          '<td class="px-3 py-2.5 text-right font-semibold">' +
          esc(fmtMoney(a.spend || 0)) +
          '</td>' +
          '<td class="px-3 py-2.5 text-right">' +
          esc(String(a.eventsAttended || 0)) +
          '</td></tr>'
        );
      })
      .join('');
  }

  function renderInsightsCities(rows) {
    if (!rows.length) {
      return '<p class="text-sm text-slate-500">No city data in this period yet.</p>';
    }
    return (
      '<ul class="space-y-2">' +
      rows
        .map(function (c) {
          return (
            '<li class="flex items-center justify-between text-sm gap-3">' +
            '<span class="font-medium text-brand-900">' +
            esc(c.city) +
            '</span>' +
            '<span class="text-slate-500 shrink-0">' +
            esc(String(c.registrations || 0)) +
            ' regs · ' +
            esc(fmtMoney(c.revenue || 0)) +
            '</span></li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  function renderInsightsTypeMix(rows) {
    if (!rows.length) {
      return '<p class="text-sm text-slate-500">No registrations in this period yet.</p>';
    }
    return (
      '<ul class="space-y-2">' +
      rows
        .map(function (t) {
          return (
            '<li class="flex items-center justify-between text-sm gap-3">' +
            '<span class="font-medium text-brand-900 capitalize">' +
            esc(t.type) +
            '</span>' +
            '<span class="text-slate-500 shrink-0">' +
            esc(String(t.count || 0)) +
            ' · ' +
            esc(fmtMoney(t.revenue || 0)) +
            '</span></li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  function renderInsightsRated(rows, kind) {
    if (!rows.length) {
      return (
        '<p class="text-sm text-slate-500">No ' +
        esc(kind) +
        ' with 3+ reviews yet.</p>'
      );
    }
    return (
      '<ul class="space-y-2">' +
      rows
        .map(function (r) {
          return (
            '<li class="flex items-center justify-between text-sm gap-3">' +
            '<span class="font-medium text-brand-900 min-w-0 truncate">' +
            esc(r.title || r.name) +
            '</span>' +
            '<span class="text-slate-600 shrink-0 font-semibold">' +
            esc(fmtRating(r.avgRating)) +
            ' <span class="text-slate-400 font-normal">(' +
            esc(String(r.reviewCount || 0)) +
            ')</span></span></li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  function renderInsightsPanel(data) {
    if (!data || data.error || data.configured === false) {
      return '<p class="text-sm text-red-700">Could not load platform insights. Check Supabase env vars on Vercel.</p>';
    }

    var rev = data.revenueComparison || {};
    var repeat = data.repeatAttendees || {};
    var growth = data.growthPulse || {};
    var funnel = data.applicationFunnel || {};
    return (
      '<div class="space-y-5">' +
      '<section class="bg-white rounded-xl border border-slate-200 p-4 lg:p-5 shadow-sm space-y-4">' +
      '<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">' +
      '<div><h3 class="font-bold text-brand-900">Top performers</h3>' +
      '<p class="text-sm text-slate-500 mt-0.5">Ranked from Supabase registrations — ' +
      esc(analyticsPeriodLabel(data.period || analyticsState.period)) +
      '.</p></div>' +
      '<div id="analytics-period-controls" class="flex flex-wrap gap-2">' +
      analyticsPeriodBtn('7d', '7 days') +
      analyticsPeriodBtn('30d', '30 days') +
      analyticsPeriodBtn('all', 'All time') +
      '</div></div>' +
      '<div class="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">' +
      '<div class="min-w-0 lg:col-span-1 xl:col-span-1 rounded-xl border border-slate-200 overflow-hidden">' +
      '<div class="px-3 py-2.5 border-b border-slate-100 bg-slate-50"><h4 class="text-sm font-bold text-brand-900">Best groups</h4></div>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="text-xs uppercase text-slate-500 bg-white">' +
          '<tr><th class="px-3 py-2 w-8"></th><th class="px-3 py-2 text-left">Organiser</th><th class="px-3 py-2 text-right">Revenue</th><th class="px-3 py-2 text-right">Regs</th><th class="px-3 py-2 text-right">Rating</th></tr></thead>' +
          '<tbody id="insights-top-organisers">' +
          renderInsightsTopOrganisers(data.topOrganisers || []) +
          '</tbody></table>'
      ) +
      '</div>' +
      '<div class="min-w-0 lg:col-span-1 xl:col-span-2 rounded-xl border border-slate-200 overflow-hidden">' +
      '<div class="px-3 py-2.5 border-b border-slate-100 bg-slate-50"><h4 class="text-sm font-bold text-brand-900">Best events</h4></div>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="text-xs uppercase text-slate-500 bg-white">' +
          '<tr><th class="px-3 py-2 w-8"></th><th class="px-3 py-2 text-left">Event</th><th class="px-3 py-2 text-right">Revenue</th><th class="px-3 py-2 text-right">Sold</th><th class="px-3 py-2 text-right">Rating</th><th class="px-3 py-2 text-right">Fill</th></tr></thead>' +
          '<tbody id="insights-top-events">' +
          renderInsightsTopEvents(data.topEvents || []) +
          '</tbody></table>'
      ) +
      '</div>' +
      '<div class="min-w-0 lg:col-span-2 xl:col-span-2 rounded-xl border border-slate-200 overflow-hidden">' +
      '<div class="px-3 py-2.5 border-b border-slate-100 bg-slate-50"><h4 class="text-sm font-bold text-brand-900">Highest spending attendees</h4>' +
      '<p class="text-xs text-slate-500 mt-0.5">Admin view — top 5 by paid ticket spend (test/E2E excluded).</p></div>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="text-xs uppercase text-slate-500 bg-white">' +
          '<tr><th class="px-3 py-2 w-8"></th><th class="px-3 py-2 text-left">Attendee</th><th class="px-3 py-2 text-right">Spend</th><th class="px-3 py-2 text-right">Events</th></tr></thead>' +
          '<tbody id="insights-top-attendees">' +
          renderInsightsTopAttendees(data.topAttendees || []) +
          '</tbody></table>'
      ) +
      '</div></div></section>' +
      '<section class="bg-white rounded-xl border border-slate-200 p-4 lg:p-5 shadow-sm space-y-4">' +
      '<div><h3 class="font-bold text-brand-900">Growth &amp; quality</h3>' +
      '<p class="text-sm text-slate-500 mt-0.5">Trends and engagement signals from Supabase.</p></div>' +
      '<div class="admin-metric-grid admin-metric-grid--4">' +
      card(
        'Revenue (30 days)',
        fmtMoney(rev.current30d || 0),
        'Prior 30d: ' + fmtMoney(rev.prior30d || 0) + ' · ' + fmtPctChange(rev.changePct),
        'emerald'
      ) +
      card(
        'Repeat attendees',
        String(repeat.ratePct != null ? repeat.ratePct + '%' : '—'),
        String(repeat.repeat || 0) + ' of ' + String(repeat.total || 0) + ' attendees (all time)',
        'blue'
      ) +
      card(
        'New this week',
        String(growth.registrations7d || 0) + ' regs',
        String(growth.newOrganisers7d || 0) + ' organisers · ' + String(growth.newAccounts7d || 0) + ' accounts',
        'violet'
      ) +
      card(
        'Applications',
        String(funnel.pending || 0) + ' pending',
        String(funnel.approved || 0) + ' approved · ' + String(funnel.denied || 0) + ' denied',
        'brand'
      ) +
      '</div>' +
      '<div class="grid gap-5 md:grid-cols-2 xl:grid-cols-4">' +
      '<div class="rounded-xl border border-slate-200 p-4"><h4 class="text-sm font-bold text-brand-900 mb-3">Top cities</h4><div id="insights-top-cities">' +
      renderInsightsCities(data.topCities || []) +
      '</div></div>' +
      '<div class="rounded-xl border border-slate-200 p-4"><h4 class="text-sm font-bold text-brand-900 mb-3">Event type mix</h4><div id="insights-type-mix">' +
      renderInsightsTypeMix(data.eventTypeMix || []) +
      '</div></div>' +
      '<div class="rounded-xl border border-slate-200 p-4"><h4 class="text-sm font-bold text-brand-900 mb-3">Highest rated groups</h4><p class="text-xs text-slate-500 mb-2">Min. 3 reviews</p><div id="insights-rated-orgs">' +
      renderInsightsRated(data.topRatedOrganisers || [], 'groups') +
      '</div></div>' +
      '<div class="rounded-xl border border-slate-200 p-4"><h4 class="text-sm font-bold text-brand-900 mb-3">Highest rated events</h4><p class="text-xs text-slate-500 mb-2">Min. 3 reviews</p><div id="insights-rated-events">' +
      renderInsightsRated(data.topRatedEvents || [], 'events') +
      '</div></div></div></section></div>'
    );
  }

  function loadAnalyticsInsights() {
    var panel = document.getElementById('analytics-insights');
    var controls = document.getElementById('analytics-period-controls');
    if (controls) {
      controls.innerHTML =
        analyticsPeriodBtn('7d', '7 days') +
        analyticsPeriodBtn('30d', '30 days') +
        analyticsPeriodBtn('all', 'All time');
    }
    if (panel) {
      panel.innerHTML = '<p class="text-sm text-slate-500">Loading platform insights…</p>';
    }
    adminGet('/api/admin/insights?period=' + encodeURIComponent(analyticsState.period)).then(function (data) {
      if (panel) panel.innerHTML = renderInsightsPanel(data);
    });
  }

  function bindAnalyticsControls() {
    if (!main || main.dataset.analyticsBound) return;
    main.dataset.analyticsBound = '1';
    main.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-analytics-period]');
      if (!btn) return;
      var period = btn.getAttribute('data-analytics-period');
      if (!period || period === analyticsState.period) return;
      analyticsState.period = period;
      loadAnalyticsInsights();
    });
  }

  function renderAnalytics() {
    var trackingOn = analyticsTrackingActive();
    main.innerHTML =
      '<div class="space-y-5 min-w-0">' +
      '<section class="bg-white rounded-xl border border-slate-200 p-4 lg:p-5 shadow-sm">' +
      '<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">' +
      '<div class="flex items-start gap-3 min-w-0">' +
      '<span class="inline-flex shrink-0 items-center justify-center w-10 h-10 rounded-lg bg-brand-50 text-brand-700 text-lg" aria-hidden="true">▤</span>' +
      '<div class="min-w-0">' +
      '<h3 class="font-bold text-brand-900">Visitor traffic on Vercel</h3>' +
      '<p class="text-sm text-slate-500 mt-0.5">Charts live in Vercel — visitors, pages, referrers, countries, and devices.</p>' +
      '</div></div>' +
      '<div class="flex flex-wrap items-center gap-2 shrink-0">' +
      '<span class="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full ' +
      (trackingOn ? 'text-emerald-700 bg-emerald-50' : 'text-amber-800 bg-amber-50') +
      '">' +
      '<span class="w-2 h-2 rounded-full ' +
      (trackingOn ? 'bg-emerald-500' : 'bg-amber-500') +
      '"></span>' +
      (trackingOn ? 'Tracking active' : 'Tracking not detected') +
      '</span>' +
      '<a href="' +
      attrEsc(VERCEL_ANALYTICS_URL) +
      '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 text-white text-sm font-semibold px-3.5 py-2 hover:bg-brand-900 transition">Open analytics <span aria-hidden="true">↗</span></a>' +
      '</div></div></section>' +
      '<div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">' +
      '<section class="bg-white rounded-xl border border-slate-200 p-4 lg:p-5 shadow-sm min-w-0">' +
      '<h3 class="font-bold text-brand-900">Hub platform activity</h3>' +
      '<p class="text-sm text-slate-500 mt-1 mb-4">Live Supabase counts — separate from anonymous visitor traffic.</p>' +
      '<div class="admin-metric-grid admin-metric-grid--4" id="analytics-platform-metrics">' +
      card('Hub accounts', '…', 'Loading…', 'blue') +
      card('Approved events', '…', 'Loading…', 'brand') +
      card('Organisers', '…', 'Loading…', 'violet') +
      card('Paid ticket revenue', '…', 'Loading…', 'emerald') +
      '</div></section>' +
      '<aside class="admin-panel-sticky bg-white rounded-xl border border-slate-200 p-4 lg:p-5 shadow-sm min-w-0 flex flex-col">' +
      '<h3 class="font-bold text-brand-900 text-sm shrink-0">Recent genuine activity</h3>' +
      '<p class="text-xs text-slate-500 mt-1 mb-3 shrink-0">Excludes E2E and test seed data.</p>' +
      '<ul id="analytics-activity" class="admin-activity-feed space-y-0 min-h-0 pr-1 -mr-1">' +
      '<li class="text-sm text-slate-500">Loading…</li></ul>' +
      '</aside></div>' +
      '<div id="analytics-insights"><p class="text-sm text-slate-500">Loading platform insights…</p></div></div>';

    bindAnalyticsControls();
    loadAnalyticsInsights();

    adminGet('/api/admin/metrics').then(function (data) {
      var metricsEl = document.getElementById('analytics-platform-metrics');
      var activityEl = document.getElementById('analytics-activity');
      if (!data || data.error || data.configured === false) {
        if (metricsEl) {
          metricsEl.innerHTML =
            '<p class="sm:col-span-2 text-sm text-red-700">Could not load platform metrics. Check Supabase env vars on Vercel.</p>';
        }
        if (activityEl) {
          activityEl.innerHTML =
            '<li class="text-sm text-red-700">Activity feed unavailable.</li>';
        }
        return;
      }
      var m = data.metrics || {};
      var listings = m.listings || {};
      if (metricsEl) {
        metricsEl.innerHTML =
          card('Hub accounts', String(m.attendees || 0), 'hub_accounts and attendee profiles', 'blue') +
          card(
            'Approved events',
            String(listings.total || 0),
            'Meetings ' +
              (listings.meetings || 0) +
              ' · Exhibitions ' +
              (listings.exhibitions || 0) +
              ' · Workshops ' +
              (listings.training || 0),
            'brand'
          ) +
          card('Organisers', String(m.organisers || 0), String(m.providers || 0) + ' workshop listings', 'violet') +
          card(
            'Paid ticket revenue',
            fmtMoney(m.revenue || 0),
            'Est. fees: ' + fmtMoney(m.fees || 0),
            'emerald'
          );
      }
      if (activityEl) {
        activityEl.innerHTML = renderActivityList(data.activity, 8);
      }
    });
  }

  function renderDashboard() {
    main.innerHTML =
      '<div class="space-y-6">' +
      '<div id="dashboard-event-health-alert"></div>' +
      '<section class="space-y-3">' +
      '<h3 class="text-sm font-bold uppercase tracking-wide text-slate-500">Critical alerts</h3>' +
      '<div class="grid gap-3" id="dashboard-alerts"><p class="text-sm text-slate-500">Loading from Supabase…</p></div>' +
      '</section>' +
      '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">' +
      '<div><h3 class="font-bold text-brand-900">Needs your attention</h3>' +
      '<p class="text-xs text-slate-500 mt-0.5">Pending approvals, broken event data, incomplete profiles, and spam reviews — check these regularly.</p></div>' +
      '<div id="dashboard-attention"><p class="text-sm text-slate-500">Loading…</p></div></section>' +
      '<a href="#analytics" class="block rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white p-5 shadow-sm hover:border-brand-300 transition group">' +
      '<div class="flex flex-wrap items-center justify-between gap-3">' +
      '<div><p class="text-xs font-semibold uppercase tracking-wide text-brand-700">Traffic</p>' +
      '<p class="font-bold text-brand-900 mt-1">Web Analytics on Vercel</p>' +
      '<p class="text-sm text-slate-600 mt-1">View visitors, top pages, referrers, and device breakdown.</p></div>' +
      '<span class="text-sm font-semibold text-brand-700 group-hover:text-brand-900">Open →</span></div></a>' +
      '<section class="admin-metric-grid admin-metric-grid--4" id="dashboard-metrics">' +
      card('Paid ticket revenue', '…', 'Loading…', 'emerald') +
      card('Approved events', '…', 'Loading…', 'brand') +
      card('Organisers', '…', 'Loading…', 'violet') +
      card('Hub accounts', '…', 'Loading…', 'blue') +
      '</section>' +
      '<section class="grid lg:grid-cols-2 gap-6">' +
      '<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm min-w-0">' +
      '<h3 class="font-bold text-brand-900 mb-1">Recent genuine activity</h3>' +
      '<p class="text-xs text-slate-500 mb-3">Registrations, events, and reviews — test/E2E data excluded.</p>' +
      '<ul id="dashboard-activity" class="admin-activity-feed"><li class="text-sm text-slate-500">Loading…</li></ul></div>' +
      '<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm min-w-0">' +
      '<h3 class="font-bold text-brand-900 mb-2">Platform snapshot</h3>' +
      '<p class="text-sm text-slate-500 mb-4">Key counts from Supabase (not visitor traffic — see Web Analytics).</p>' +
      '<div id="live-metrics" class="text-sm text-slate-600">Loading…</div>' +
      '</div></section></div>';

    adminGet('/api/admin/metrics').then(function (data) {
      var alertsEl = document.getElementById('dashboard-alerts');
      var attentionEl = document.getElementById('dashboard-attention');
      var metricsEl = document.getElementById('dashboard-metrics');
      var activityEl = document.getElementById('dashboard-activity');
      var preEl = document.getElementById('live-metrics');

      if (!data || data.error || data.configured === false) {
        if (alertsEl) {
          alertsEl.innerHTML =
            '<p class="text-sm text-red-700">Could not load dashboard data. Check Supabase env vars on Vercel.</p>';
        }
        if (preEl) {
          preEl.innerHTML =
            '<p class="text-sm text-red-700">Snapshot unavailable. Check Supabase env vars on Vercel.</p>';
        }
        return;
      }

      var m = data.metrics || {};
      var listings = m.listings || {};

      if (metricsEl) {
        metricsEl.innerHTML =
          card(
            'Paid ticket revenue',
            fmtMoney(m.revenue || 0),
            'Est. platform fees: ' + fmtMoney(m.fees || 0) + ' · from paid registrations',
            'emerald'
          ) +
          card(
            'Approved events',
            String(listings.total || 0),
            'Meetings ' +
              (listings.meetings || 0) +
              ' · Exhibitions ' +
              (listings.exhibitions || 0) +
              ' · Workshops ' +
              (listings.training || 0),
            'brand'
          ) +
          card('Organisers', String(m.organisers || 0), String(m.providers || 0) + ' workshop listings', 'violet') +
          card('Hub accounts', String(m.attendees || 0), 'hub_accounts and attendee profiles', 'blue');
      }

      if (alertsEl) {
        var alerts = data.alerts || [];
        alertsEl.innerHTML = alerts.length
          ? alerts.map(alertCard).join('')
          : '<p class="text-sm text-emerald-700">No critical alerts right now.</p>';
      }

      if (attentionEl) {
        attentionEl.innerHTML = renderAttentionQueue(data.attention);
      }

      if (activityEl) {
        activityEl.innerHTML = renderActivityList(data.activity, 12);
      }

      if (preEl) preEl.innerHTML = renderMetricsSummary(data);
    });

    fetchEventHealth().then(function (data) {
      var slot = document.getElementById('dashboard-event-health-alert');
      if (!slot || !data || !data.count) return;
      slot.innerHTML =
        '<a href="#event-health" class="block rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 hover:bg-red-100/80 transition">' +
        '<p class="font-semibold text-sm">' +
        data.count +
        ' published event' +
        (data.count === 1 ? '' : 's') +
        ' missing data</p>' +
        '<p class="text-xs mt-1 opacity-90">Dates, organisers, VAT, or profile fields need fixing before pages show correctly. Open Event data issues to edit rows.</p>' +
        '</a>';
    });
  }

  function adminTableScroll(html) {
    return '<div class="admin-table-scroll">' + html + '</div>';
  }

  function renderMetricsSummary(data) {
    var m = data.metrics || {};
    var listings = m.listings || {};
    var updated = data.updatedAt ? fmtTime(data.updatedAt) : '—';
    return (
      '<dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">' +
      '<div><dt class="text-slate-500">Approved events</dt><dd class="font-semibold text-brand-900">' +
      esc(String(listings.total || 0)) +
      '</dd></div>' +
      '<div><dt class="text-slate-500">Upcoming live events (24h+)</dt><dd class="font-semibold text-brand-900">' +
      esc(String(m.liveEvents || 0)) +
      '</dd></div>' +
      '<div><dt class="text-slate-500">Organisers</dt><dd class="font-semibold text-brand-900">' +
      esc(String(m.organisers || 0)) +
      '</dd></div>' +
      '<div><dt class="text-slate-500">Workshop listings</dt><dd class="font-semibold text-brand-900">' +
      esc(String(m.providers || 0)) +
      '</dd></div>' +
      '<div><dt class="text-slate-500">Hub accounts</dt><dd class="font-semibold text-brand-900">' +
      esc(String(m.attendees || 0)) +
      '</dd></div>' +
      '<div><dt class="text-slate-500">Paid ticket revenue</dt><dd class="font-semibold text-brand-900">' +
      esc(fmtMoney(m.revenue || 0)) +
      '</dd></div>' +
      '<div class="sm:col-span-2 text-xs text-slate-400 pt-1">Last loaded ' +
      esc(updated) +
      ' · <details class="inline"><summary class="cursor-pointer text-brand-700">Raw JSON</summary>' +
      '<pre class="mt-2 text-[11px] bg-slate-50 p-3 rounded-lg overflow-auto max-h-40 text-slate-600">' +
      esc(JSON.stringify(data, null, 2)) +
      '</pre></details></div></dl>'
    );
  }

  function card(title, value, sub, color) {
    var accents = {
      emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-200',
      brand: 'from-brand-500/10 to-brand-500/5 border-brand-200',
      violet: 'from-violet-500/10 to-violet-500/5 border-violet-200',
      blue: 'from-blue-500/10 to-blue-500/5 border-blue-200',
    };
    return (
      '<article class="bg-gradient-to-br ' +
      (accents[color] || accents.brand) +
      ' border rounded-xl p-4 shadow-sm min-w-0">' +
      '<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">' +
      esc(title) +
      '</p>' +
      '<p class="text-2xl font-bold text-brand-900 mt-2">' +
      esc(value) +
      '</p>' +
      '<p class="text-xs text-slate-500 mt-2">' +
      esc(sub) +
      '</p></article>'
    );
  }

  function renderUsers() {
    var roleOpts = ['All', 'Admin', 'Organiser', 'Attendee'];
    main.innerHTML =
      '<div class="space-y-4">' +
      '<p id="users-status" class="text-sm text-slate-500">Loading users from Supabase…</p>' +
      '<div class="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end shadow-sm">' +
      '<div class="flex-1 min-w-[200px]"><label class="text-xs font-semibold text-slate-500 uppercase">Search</label>' +
      '<input type="search" id="user-search" placeholder="Name or email…" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"></div>' +
      '<div><label class="text-xs font-semibold text-slate-500 uppercase">Role</label>' +
      '<select id="user-role-filter" class="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">' +
      roleOpts.map(function (r) {
        return '<option>' + r + '</option>';
      }).join('') +
      '</select></div></div>' +
      '<div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">' +
      'This directory is <strong>read-only</strong>. Password reset, suspend, and profile edits are not wired up here — use <a href="#impersonate" class="font-semibold text-brand-800 hover:underline">Impersonate</a> to debug as a user.</div>' +
      '<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
      adminTableScroll(
        '<table class="w-full text-sm text-left"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3">Name</th><th class="px-4 py-3">Email</th><th class="px-4 py-3">Role</th><th class="px-4 py-3">City</th><th class="px-4 py-3">Status</th></tr></thead>' +
          '<tbody id="users-tbody"><tr><td colspan="5" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '</div></div>';

    function filterUsers() {
      var q = (document.getElementById('user-search').value || '').toLowerCase();
      var role = document.getElementById('user-role-filter').value;
      return liveUsers.filter(function (u) {
        if (role !== 'All' && u.role !== role) return false;
        if (q && (u.name + u.email).toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
    }

    function paint() {
      var tbody = document.getElementById('users-tbody');
      if (!tbody) return;
      var rows = filterUsers();
      if (!rows.length) {
        tbody.innerHTML =
          '<tr><td colspan="5" class="px-4 py-6 text-slate-500">No users match your filters.</td></tr>';
        return;
      }
      tbody.innerHTML = rows
        .map(function (u) {
          var st =
            u.status === 'Active'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-red-100 text-red-800';
          return (
            '<tr class="border-t border-slate-100 hover:bg-brand-50/50 cursor-pointer user-row" data-user-id="' +
            esc(u.id) +
            '">' +
            '<td class="px-4 py-3 font-medium">' +
            esc(u.name) +
            '</td>' +
            '<td class="px-4 py-3 text-slate-600">' +
            esc(u.email) +
            '</td>' +
            '<td class="px-4 py-3">' +
            esc(u.role) +
            '</td>' +
            '<td class="px-4 py-3">' +
            esc(u.city) +
            '</td>' +
            '<td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-1 rounded-full ' +
            st +
            '">' +
            esc(u.status) +
            '</span></td></tr>'
          );
        })
        .join('');
      tbody.querySelectorAll('.user-row').forEach(function (row) {
        row.addEventListener('click', function () {
          var id = row.getAttribute('data-user-id');
          var u = liveUsers.find(function (x) {
            return x.id === id;
          });
          if (u) openUserDrawer(u);
        });
      });
    }

    adminGet('/api/admin/users').then(function (data) {
      var status = document.getElementById('users-status');
      if (!data || data.error || data.configured === false) {
        liveUsers = [];
        if (status) status.textContent = 'Could not load users from Supabase.';
        paint();
        return;
      }
      liveUsers = data.users || [];
      if (status) {
        status.textContent = liveUsers.length + ' account' + (liveUsers.length === 1 ? '' : 's') + ' from Supabase';
      }
      paint();
    });

    document.getElementById('user-search').addEventListener('input', paint);
    document.getElementById('user-role-filter').addEventListener('change', paint);
  }

  function loadUsersDirectory(callback) {
    if (liveUsers.length) {
      callback(liveUsers);
      return;
    }
    adminGet('/api/admin/users').then(function (data) {
      if (data && !data.error && data.configured !== false) {
        liveUsers = data.users || [];
      }
      callback(liveUsers);
    });
  }

  function renderImpersonate() {
    main.innerHTML =
      '<div class="space-y-6 max-w-2xl">' +
      '<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">' +
      '<p class="font-semibold">Support &amp; debugging only</p>' +
      '<p class="mt-1 opacity-90">You will be signed in as the chosen user across the Hub. A banner lets you return to your admin account at any time. Admin accounts cannot be impersonated.</p>' +
      '</div>' +
      '<form id="impersonate-form" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">' +
      '<div><label class="text-xs font-semibold text-slate-500 uppercase" for="impersonate-email">User email</label>' +
      '<input type="email" id="impersonate-email" list="impersonate-email-list" required placeholder="user@company.com" autocomplete="off" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500">' +
      '<datalist id="impersonate-email-list"></datalist>' +
      '<p id="impersonate-user-hint" class="text-xs text-slate-500 mt-2">Start typing to match accounts from your user directory.</p></div>' +
      '<div><label class="text-xs font-semibold text-slate-500 uppercase" for="impersonate-view">Open as them in</label>' +
      '<select id="impersonate-view" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">' +
      '<option value="account">Attendee account</option>' +
      '<option value="organiser">Organiser dashboard</option>' +
      '<option value="events">Events browse</option>' +
      '</select></div>' +
      '<div id="impersonate-message" class="hidden text-sm rounded-lg px-3 py-2"></div>' +
      '<button type="submit" class="w-full rounded-lg bg-brand-700 text-white py-3 text-sm font-semibold hover:bg-brand-900 disabled:opacity-60" id="impersonate-submit">Impersonate user</button>' +
      '</form>' +
      '<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
      '<div class="px-4 py-3 border-b border-slate-100"><h3 class="text-sm font-bold text-slate-700">Quick pick</h3></div>' +
      '<div id="impersonate-quick-list" class="divide-y divide-slate-100 max-h-80 overflow-y-auto">' +
      '<p class="px-4 py-6 text-sm text-slate-500">Loading users…</p></div></div></div>';

    var form = document.getElementById('impersonate-form');
    var emailInput = document.getElementById('impersonate-email');
    var datalist = document.getElementById('impersonate-email-list');
    var quickList = document.getElementById('impersonate-quick-list');
    var messageEl = document.getElementById('impersonate-message');
    var hintEl = document.getElementById('impersonate-user-hint');

    function showImpersonateMessage(text, isError) {
      if (!messageEl) return;
      messageEl.textContent = text;
      messageEl.classList.remove('hidden', 'bg-red-50', 'text-red-800', 'bg-emerald-50', 'text-emerald-800');
      messageEl.classList.add(isError ? 'bg-red-50' : 'bg-emerald-50', isError ? 'text-red-800' : 'text-emerald-800');
    }

    function submitImpersonation(email, view) {
      var btn = document.getElementById('impersonate-submit');
      if (btn) btn.disabled = true;
      showImpersonateMessage('Switching session…', false);
      adminPost('/api/admin/impersonate', { email: email, view: view })
        .then(function (data) {
          if (!data.ok) {
            showImpersonateMessage(data.message || data.error || 'Could not impersonate user.', true);
            if (btn) btn.disabled = false;
            return;
          }
          try {
            sessionStorage.removeItem('hub_nav_session_v1');
          } catch (e) {
            /* ignore */
          }
          window.location.href = '../' + String(data.redirect || 'account/index.html').replace(/^\//, '');
        })
        .catch(function () {
          showImpersonateMessage('Request failed. Try again.', true);
          if (btn) btn.disabled = false;
        });
    }

    loadUsersDirectory(function (users) {
      if (datalist) {
        datalist.innerHTML = users
          .map(function (u) {
            return '<option value="' + attrEsc(u.email) + '">' + attrEsc(u.name || u.email) + '</option>';
          })
          .join('');
      }
      if (hintEl) {
        hintEl.textContent = users.length
          ? users.length + ' accounts available from Supabase.'
          : 'No users loaded — you can still enter an email manually.';
      }
      if (!quickList) return;
      if (!users.length) {
        quickList.innerHTML =
          '<p class="px-4 py-6 text-sm text-slate-500">No users in the directory yet.</p>';
        return;
      }
      quickList.innerHTML = users
        .filter(function (u) {
          return u.role !== 'Admin';
        })
        .slice(0, 50)
        .map(function (u) {
          return (
            '<button type="button" class="impersonate-quick-row w-full text-left px-4 py-3 hover:bg-brand-50/60 flex items-center justify-between gap-3" data-email="' +
            attrEsc(u.email) +
            '"><span><span class="block text-sm font-medium text-slate-800">' +
            esc(u.name || '—') +
            '</span><span class="block text-xs text-slate-500">' +
            esc(u.email) +
            '</span></span><span class="text-xs font-semibold text-brand-700 shrink-0">Use →</span></button>'
          );
        })
        .join('');
      quickList.querySelectorAll('.impersonate-quick-row').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var email = btn.getAttribute('data-email');
          if (emailInput) emailInput.value = email;
        });
      });
    });

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = (emailInput && emailInput.value || '').trim();
        var view = document.getElementById('impersonate-view').value;
        if (!email) {
          showImpersonateMessage('Enter an email address.', true);
          return;
        }
        submitImpersonation(email, view);
      });
    }
  }

  function openUserDrawer(u) {
    selectedUser = u;
    document.getElementById('drawer-name').textContent = u.name;
    document.getElementById('drawer-email').textContent = u.email;
    var impersonateAction =
      u.role === 'Admin'
        ? ''
        : '<button type="button" class="w-full rounded-lg border border-brand-200 text-brand-800 py-2.5 text-sm font-semibold hover:bg-brand-50 mb-4" id="drawer-impersonate">Impersonate this user</button>';
    document.getElementById('drawer-body').innerHTML =
      impersonateAction +
      '<dl class="space-y-3 text-sm border-t border-slate-100 pt-4">' +
      '<div class="flex justify-between gap-4"><dt class="text-slate-500 shrink-0">Role</dt><dd class="font-medium text-right">' +
      esc(u.role) +
      '</dd></div>' +
      '<div class="flex justify-between gap-4"><dt class="text-slate-500 shrink-0">City</dt><dd class="font-medium text-right">' +
      esc(u.city) +
      '</dd></div>' +
      '<div class="flex justify-between gap-4"><dt class="text-slate-500 shrink-0">Status</dt><dd class="font-medium text-right">' +
      esc(u.status) +
      '</dd></div>' +
      '<div class="flex justify-between gap-4"><dt class="text-slate-500 shrink-0">Featured organiser</dt><dd class="font-medium text-right">' +
      (u.featured ? 'Yes' : 'No') +
      '</dd></div></dl>' +
      '<p class="text-xs text-slate-500 border-t border-slate-100 pt-4">Profile edits and password reset are not available in Command Center yet. Change featured status in Supabase or the organiser dashboard.</p>';
    document.getElementById('user-drawer').classList.remove('hidden');
    var impersonateBtn = document.getElementById('drawer-impersonate');
    if (impersonateBtn) {
      impersonateBtn.addEventListener('click', function () {
        adminPost('/api/admin/impersonate', { email: u.email, view: 'account' }).then(function (data) {
          if (!data.ok) {
            alert(data.message || data.error || 'Could not impersonate user.');
            return;
          }
          try {
            sessionStorage.removeItem('hub_nav_session_v1');
          } catch (e) {
            /* ignore */
          }
          window.location.href = '../' + String(data.redirect || 'account/index.html').replace(/^\//, '');
        });
      });
    }
  }

  function listingActionCell(l, opts) {
    opts = opts || {};
    var isPending = l.status === 'Pending' || l.pending;
    if (isPending) {
      if (opts.pendingQueue) {
        return (
          '<td class="px-4 py-3">' +
          '<button type="button" class="moderation-approve-btn rounded-lg bg-brand-700 text-white px-2.5 py-1 text-xs font-semibold hover:bg-brand-900 disabled:opacity-50" data-event-id="' +
          attrEsc(l.id) +
          '">Approve</button></td>'
        );
      }
      return (
        '<td class="px-4 py-3"><span class="text-xs text-amber-800">Awaiting approval</span></td>'
      );
    }
    if (l.status === 'Live') {
      return (
        '<td class="px-4 py-3"><a href="#event-health" class="text-brand-700 font-semibold text-xs hover:underline">Review data</a></td>'
      );
    }
    return '<td class="px-4 py-3"><span class="text-xs text-slate-400">—</span></td>';
  }

  function listingsTableHtml(listings, emptyMessage, opts) {
    if (!listings.length) {
      return (
        '<tr><td colspan="7" class="px-4 py-6 text-slate-500">' +
        esc(emptyMessage || 'No events in Supabase yet.') +
        '</td></tr>'
      );
    }
    return listings
      .map(function (l) {
        var soldLabel = l.capacity ? l.sold + '/' + l.capacity : String(l.sold || 0) + ' sold';
        var pct = l.capacity ? Math.round((l.sold / l.capacity) * 100) : 0;
        var isPending = l.status === 'Pending' || l.pending;
        var rowClass = isPending ? 'border-t border-amber-100 bg-amber-50/60' : 'border-t border-slate-100';
        var statusClass = isPending
          ? 'text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900'
          : 'text-xs font-semibold px-2 py-0.5 rounded bg-slate-100';
        return (
          '<tr class="' +
          rowClass +
          '">' +
          '<td class="px-4 py-3 font-medium">' +
          esc(l.title) +
          '</td>' +
          '<td class="px-4 py-3">' +
          esc(l.type) +
          '</td>' +
          '<td class="px-4 py-3">' +
          esc(l.organiser) +
          '</td>' +
          '<td class="px-4 py-3">' +
          esc(l.city) +
          '</td>' +
          '<td class="px-4 py-3"><span class="' +
          statusClass +
          '">' +
          esc(l.status) +
          '</span></td>' +
          '<td class="px-4 py-3 min-w-[120px]">' +
          (l.capacity
            ? '<div class="h-2 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-brand-500 rounded-full" style="width:' +
              pct +
              '%"></div></div>'
            : '') +
          '<span class="text-xs text-slate-500">' +
          esc(soldLabel) +
          '</span></td>' +
          listingActionCell(l, opts) +
          '</tr>'
        );
      })
      .join('');
  }

  function reviewsHtml(reviews) {
    if (!reviews.length) {
      return '<p class="text-sm text-slate-500">No reviews yet.</p>';
    }
    return reviews
      .map(function (r) {
        return (
          '<article class="border border-slate-200 rounded-lg p-4 ' +
          (r.spam ? 'bg-red-50/50' : 'bg-white') +
          '">' +
          '<div class="flex justify-between gap-2"><div><p class="font-semibold text-sm">' +
          esc(r.user) +
          ' · ' +
          esc(r.event) +
          '</p><p class="text-amber-500 text-sm">' +
          '★'.repeat(Math.max(0, Math.min(5, r.rating))) +
          '</p></div><time class="text-xs text-slate-400">' +
          fmtTime(r.time) +
          '</time></div>' +
          '<p class="text-sm text-slate-600 mt-2">' +
          esc(r.text) +
          '</p>' +
          (r.spam
            ? '<p class="mt-2 text-xs font-semibold text-red-700">Flagged as possible spam</p>'
            : '') +
          '</article>'
        );
      })
      .join('');
  }

  function renderModeration() {
    main.innerHTML =
      '<div class="space-y-6">' +
      '<p id="moderation-status" class="text-sm text-slate-500">Loading listings and reviews from Supabase…</p>' +
      '<div class="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden" id="moderation-pending-panel">' +
      '<div class="px-4 py-3 border-b border-amber-100 bg-amber-50"><h3 class="font-bold text-amber-900">Pending approval</h3>' +
      '<p class="text-xs text-amber-800/80 mt-0.5">Events waiting for approval before they can go live. Approve or reject in the organiser dashboard or Supabase.</p></div>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="bg-amber-50/80 text-xs uppercase text-amber-900/70">' +
          '<tr><th class="px-4 py-3 text-left">Title</th><th class="px-4 py-3">Type</th><th class="px-4 py-3">Organiser</th><th class="px-4 py-3">City</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Tickets</th><th class="px-4 py-3"></th></tr></thead>' +
          '<tbody id="moderation-pending"><tr><td colspan="7" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '</div>' +
      '<div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
      '<div class="px-4 py-3 border-b border-slate-100"><h3 class="font-bold text-brand-900">All events</h3>' +
      '<p class="text-xs text-slate-500 mt-0.5">Read-only — pending events are highlighted and listed at the top.</p></div>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3 text-left">Title</th><th class="px-4 py-3">Type</th><th class="px-4 py-3">Organiser</th><th class="px-4 py-3">City</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Tickets</th><th class="px-4 py-3"></th></tr></thead>' +
          '<tbody id="moderation-listings"><tr><td colspan="7" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '</div>' +
      '<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900 mb-1">Reviews</h3>' +
      '<p class="text-xs text-slate-500 mb-4">Spam-like reviews are highlighted — removal is done in Supabase.</p>' +
      '<div class="space-y-3" id="moderation-reviews">Loading…</div></div></div>';

    adminGet('/api/admin/moderation').then(function (data) {
      var status = document.getElementById('moderation-status');
      var pendingEl = document.getElementById('moderation-pending');
      var pendingPanel = document.getElementById('moderation-pending-panel');
      var listingsEl = document.getElementById('moderation-listings');
      var reviewsEl = document.getElementById('moderation-reviews');
      if (!data || data.error || data.configured === false) {
        liveListings = [];
        liveReviews = [];
        if (status) status.textContent = 'Could not load moderation data from Supabase.';
        if (pendingEl) pendingEl.innerHTML = listingsTableHtml([], 'Could not load pending events.');
        if (listingsEl) listingsEl.innerHTML = listingsTableHtml([]);
        if (reviewsEl) reviewsEl.innerHTML = reviewsHtml([]);
        return;
      }
      liveListings = data.listings || [];
      liveReviews = data.reviews || [];
      var pendingListings = data.pendingListings || liveListings.filter(function (l) {
        return l.status === 'Pending' || l.pending;
      });
      if (status) {
        status.textContent =
          liveListings.length +
          ' events · ' +
          pendingListings.length +
          ' pending · ' +
          liveReviews.length +
          ' reviews from Supabase';
      }
      if (pendingEl) {
        pendingEl.innerHTML = pendingListings.length
          ? listingsTableHtml(pendingListings, undefined, { pendingQueue: true })
          : '<tr><td colspan="7" class="px-4 py-6 text-emerald-700">No events pending approval.</td></tr>';
      }
      if (pendingPanel && !pendingListings.length) {
        pendingPanel.classList.remove('border-amber-200');
        pendingPanel.classList.add('border-emerald-200');
      }
      if (listingsEl) listingsEl.innerHTML = listingsTableHtml(liveListings);
      if (reviewsEl) reviewsEl.innerHTML = reviewsHtml(liveReviews);
    });
  }

  function renderFinancials() {
    main.innerHTML =
      '<div class="space-y-6">' +
      '<p id="financials-status" class="text-sm text-slate-500">Loading financial data from Supabase…</p>' +
      '<section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
      '<div class="px-4 py-3 border-b border-slate-100"><h3 class="font-bold text-brand-900">Organiser ticket revenue</h3>' +
      '<p class="text-xs text-slate-500 mt-0.5">Gross paid registration totals in Supabase — not live Stripe settlement or payout history.</p></div>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3 text-left">Organiser</th><th class="px-4 py-3">Ticket revenue</th><th class="px-4 py-3">Last payout</th><th class="px-4 py-3">Stripe Connect</th></tr></thead>' +
          '<tbody id="financials-stripe"><tr><td colspan="4" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '</section>' +
      '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900 mb-2">Payout queue</h3>' +
      '<p class="text-sm text-slate-500 mb-4">Manual payout requests are not stored in Supabase yet.</p>' +
      '<div class="space-y-3" id="financials-queue"><p class="text-sm text-slate-500">None pending.</p></div></section>' +
      '<section class="bg-slate-900 rounded-xl p-5 text-slate-100 shadow-sm">' +
      '<h3 class="font-bold text-sm uppercase tracking-wide text-brand-100 mb-1">Recent registrations</h3>' +
      '<p class="text-xs text-brand-100/70 mb-4">Last 40 registration rows from Supabase (payment status and amount).</p>' +
      '<div id="financials-log" class="max-h-80 overflow-y-auto">Loading…</div></section></div>';

    adminGet('/api/admin/financials').then(function (data) {
      var status = document.getElementById('financials-status');
      var stripeEl = document.getElementById('financials-stripe');
      var logEl = document.getElementById('financials-log');

      if (!data || data.error || data.configured === false) {
        if (status) status.textContent = 'Could not load financial data from Supabase.';
        return;
      }

      var stripe = data.stripeAccounts || [];
      var log = data.automationLog || [];

      if (status) {
        status.textContent =
          stripe.length + ' organiser' + (stripe.length === 1 ? '' : 's') + ' · registration log from Supabase';
      }

      if (stripeEl) {
        stripeEl.innerHTML = stripe.length
          ? stripe
              .map(function (s) {
                var statusCls = s.status === 'Connected' ? 'text-emerald-600' : 'text-slate-500';
                return (
                  '<tr class="border-t border-slate-100"><td class="px-4 py-3 font-medium">' +
                  esc(s.organiser) +
                  '</td><td class="px-4 py-3">' +
                  esc(s.balance) +
                  '</td><td class="px-4 py-3">' +
                  esc(s.lastPayout) +
                  '</td><td class="px-4 py-3 font-medium ' +
                  statusCls +
                  '">' +
                  esc(s.status) +
                  '</td></tr>'
                );
              })
              .join('')
          : '<tr><td colspan="4" class="px-4 py-6 text-slate-500">No organisers in Supabase yet.</td></tr>';
      }

      if (logEl) {
        var genuineLog = log.filter(function (l) {
          return !/\be2e\b/i.test(String(l.line || ''));
        });
        logEl.innerHTML = genuineLog.length
          ? genuineLog
              .map(function (l) {
                var cls =
                  l.status === 'error'
                    ? 'text-red-300 bg-red-950/30'
                    : l.status === 'ok'
                      ? 'text-emerald-300'
                      : 'text-slate-300';
                return (
                  '<div class="font-mono text-xs py-2 border-b border-white/10 ' +
                  cls +
                  '"><span class="text-slate-500">[' +
                  fmtTime(l.ts) +
                  ']</span> — ' +
                  esc(l.line) +
                  '</div>'
                );
              })
              .join('')
          : '<p class="text-sm text-slate-400">No registrations logged yet.</p>';
      }
    });
  }

  function sponsorHeadlineHtml(headline) {
    var safe = esc(String(headline || '').trim());
    if (!safe) return '';
    if (safe.indexOf(':') !== -1) {
      var parts = safe.split(':');
      return '<em>' + parts[0].trim() + ':</em> ' + parts.slice(1).join(':').trim();
    }
    return safe;
  }

  function sponsorBulletsFromBody(html) {
    var temp = document.createElement('div');
    temp.innerHTML = String(html || '');
    return Array.prototype.map
      .call(temp.querySelectorAll('li'), function (li) {
        return li.textContent.trim();
      })
      .filter(Boolean);
  }

  function sponsorTaglineFromBlock(block) {
    if (window.CmsSponsorFields) return window.CmsSponsorFields.tagline(block);
    var title = String(block.title || '').trim();
    if (title && title.toLowerCase() !== 'sponsor hub') return title;
    var subtitle = String(block.subtitle || '').trim();
    if (subtitle) return subtitle;
    var temp = document.createElement('div');
    temp.innerHTML = String(block.body || '');
    var h3 = temp.querySelector('h3');
    return h3 ? h3.textContent.trim() : '';
  }

  function sponsorBulletsHtml(bullets) {
    if (!bullets.length) return '';
    return (
      '<ul class="sponsor-list">' +
      bullets
        .map(function (line) {
          return '<li>' + esc(line) + '</li>';
        })
        .join('') +
      '</ul>'
    );
  }

  function sponsorBodyFromForm(creative) {
    return sponsorBulletsHtml(creative.bullets);
  }

  function sponsorPreviewLogoHtml(logoUrl, compact) {
    var bandClass =
      'sponsor-preview-logo-band' +
      (compact ? ' sponsor-preview-logo-band--compact' : ' mb-3');
    if (logoUrl && /^(https?:|\/|data:image\/)/i.test(logoUrl)) {
      return (
        '<div class="' +
        bandClass +
        '" data-sponsor-preview-band>' +
        '<img src="' +
        esc(logoUrl) +
        '" alt="" class="sponsor-preview-logo-img" crossorigin="anonymous" ' +
        'onload="window.CmsSponsorFields&&window.CmsSponsorFields.applyLogoBand(this.parentElement,this,true)">' +
        '</div>'
      );
    }
    return (
      '<div class="' +
      bandClass +
      ' sponsor-preview-logo-band--empty">' +
      '<span class="text-[10px] font-semibold text-slate-500">Your logo here</span></div>'
    );
  }

  function applySponsorBlockToForm(block) {
    if (!block) return;
    var company = document.getElementById('sponsor-company');
    var logoUrl = document.getElementById('sponsor-logo-url');
    var tagline = document.getElementById('sponsor-tagline');
    var bullets = document.getElementById('sponsor-bullets');
    var ctaLabel = document.getElementById('sponsor-cta-label');
    var ctaUrl = document.getElementById('sponsor-cta-url');
    var active = document.getElementById('sponsor-active');
    var lines = sponsorBulletsFromBody(block.body);

    if (company) company.value = String(block.company_name || '').trim();
    if (logoUrl) {
      logoUrl.value = String(block.logo_url || block.image_url || '').trim();
    }
    if (tagline) tagline.value = sponsorTaglineFromBlock(block);
    if (bullets && lines.length) bullets.value = lines.join('\n');
    if (ctaLabel && block.cta_label) ctaLabel.value = block.cta_label;
    if (ctaUrl && block.cta_url) ctaUrl.value = block.cta_url;
    if (active) active.checked = block.active !== false;
  }

  function renderSponsorship() {
    var currentSlotKey = CMS_AD_SLOTS[0].key;
    var sponsorLogoBase64 = null;
    var sponsorLogoMime = '';
    var sponsorLogoFilename = '';

    function slotDefaults() {
      return cmsSlotByKey(currentSlotKey);
    }

    function slotOptionsHtml() {
      return CMS_AD_SLOTS.map(function (slot) {
        return (
          '<option value="' +
          esc(slot.key) +
          '"' +
          (slot.key === currentSlotKey ? ' selected' : '') +
          '>' +
          esc(slot.label) +
          '</option>'
        );
      }).join('');
    }

    function applyDefaultsToForm() {
      var d = slotDefaults();
      var company = document.getElementById('sponsor-company');
      var logoUrl = document.getElementById('sponsor-logo-url');
      var tagline = document.getElementById('sponsor-tagline');
      var bullets = document.getElementById('sponsor-bullets');
      var ctaLabel = document.getElementById('sponsor-cta-label');
      var ctaUrl = document.getElementById('sponsor-cta-url');
      var active = document.getElementById('sponsor-active');
      var help = document.getElementById('sponsor-slot-help');
      var previewHint = document.getElementById('sponsor-preview-hint');
      if (company) company.value = '';
      if (logoUrl) logoUrl.value = '';
      if (tagline) tagline.value = d.tagline;
      if (bullets) bullets.value = d.bullets.join('\n');
      if (ctaLabel) ctaLabel.value = d.ctaLabel;
      if (ctaUrl) ctaUrl.value = d.ctaUrl;
      if (active) active.checked = true;
      if (help) help.textContent = d.help;
      if (previewHint) {
        previewHint.textContent =
          d.preview === 'compact'
            ? 'Logo centred above the button, as on event and organiser detail pages.'
            : 'Matches the browse page hero Sponsor Hub block.';
      }
      sponsorLogoBase64 = null;
      sponsorLogoMime = '';
      sponsorLogoFilename = '';
      var fileInput = document.getElementById('sponsor-logo-file');
      if (fileInput) fileInput.value = '';
    }

    main.innerHTML =
      '<div class="space-y-6">' +
      '<p id="sponsor-status" class="text-sm text-slate-500">Loading ad placement from Supabase…</p>' +
      '<div class="grid lg:grid-cols-2 gap-6 min-w-0">' +
      '<form id="sponsor-form" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5 min-w-0">' +
      '<div><label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" for="sponsor-slot">Ad placement</label>' +
      '<select id="sponsor-slot" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">' +
      slotOptionsHtml() +
      '</select>' +
      '<p id="sponsor-slot-help" class="text-xs text-slate-500 mt-1">' +
      esc(slotDefaults().help) +
      '</p></div>' +
      '<label class="flex items-center gap-2 text-sm text-slate-700">' +
      '<input type="checkbox" id="sponsor-active" class="rounded border-slate-300" checked> ' +
      'Ad active (uncheck to hide this placement on site)</label>' +
      '<div id="sponsor-hero-fields" class="space-y-5">' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-company">Company name</label>' +
      '<input type="text" id="sponsor-company" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Acme Ltd"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-tagline">Tagline / offer</label>' +
      '<input type="text" id="sponsor-tagline" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
      esc(slotDefaults().tagline) +
      '"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-bullets">Bullet copy (one line each)</label>' +
      '<textarea id="sponsor-bullets" rows="4" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">' +
      esc(slotDefaults().bullets.join('\n')) +
      '</textarea></div></div>' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-logo-url">Company logo URL</label>' +
      '<input type="text" id="sponsor-logo-url" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-2" placeholder="https://…">' +
      '<label class="block text-xs text-slate-500 mb-1" for="sponsor-logo-file">Or upload logo (max 2MB, 200×100 recommended)</label>' +
      '<input type="file" id="sponsor-logo-file" accept="image/png,image/jpeg,image/webp,image/gif" class="block w-full text-sm text-slate-600"></div>' +
      '<div class="grid sm:grid-cols-2 gap-4">' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-cta-label">CTA button label</label>' +
      '<input type="text" id="sponsor-cta-label" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
      esc(slotDefaults().ctaLabel) +
      '"></div>' +
      '<div><label id="sponsor-cta-url-label" class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-cta-url">CTA link (https:// or mailto:)</label>' +
      '<input type="text" id="sponsor-cta-url" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
      esc(slotDefaults().ctaUrl) +
      '"></div></div>' +
      '<div class="flex flex-wrap gap-3 pt-2">' +
      '<button type="button" id="sponsor-preview-btn" class="rounded-lg border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Update preview</button>' +
      '<button type="button" id="sponsor-publish-btn" class="rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900">Publish to site</button>' +
      '</div></form>' +
      '<section class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 min-w-0">' +
      '<h3 class="font-bold text-brand-900 mb-1">Preview</h3>' +
      '<p id="sponsor-preview-hint" class="text-xs text-slate-500 mb-4">Matches the browse page hero Sponsor Hub block.</p>' +
      '<div id="sponsor-preview" class="max-w-md"></div>' +
      '</section></div></div>';

    function setSponsorStatus(text, tone) {
      var el = document.getElementById('sponsor-status');
      if (!el) return;
      el.textContent = text;
      el.className =
        'text-sm ' +
        (tone === 'error'
          ? 'text-red-700 font-semibold'
          : tone === 'ok'
            ? 'text-emerald-700 font-semibold'
            : 'text-slate-500');
    }

    function readForm() {
      var d = slotDefaults();
      var bullets = (document.getElementById('sponsor-bullets').value || '')
        .split('\n')
        .map(function (line) {
          return line.trim();
        })
        .filter(Boolean);
      var activeEl = document.getElementById('sponsor-active');
      var logoUrl = document.getElementById('sponsor-logo-url').value.trim();
      if (sponsorLogoBase64) logoUrl = sponsorLogoBase64;
      return {
        active: activeEl ? activeEl.checked : true,
        companyName: document.getElementById('sponsor-company').value.trim(),
        logoUrl: logoUrl,
        tagline: document.getElementById('sponsor-tagline').value.trim(),
        bullets: bullets.length ? bullets : d.bullets.slice(),
        ctaLabel: document.getElementById('sponsor-cta-label').value.trim() || d.ctaLabel,
        ctaUrl: document.getElementById('sponsor-cta-url').value.trim() || d.ctaUrl,
      };
    }

    function syncSlotFormLayout() {
      var slot = slotDefaults();
      var heroFields = document.getElementById('sponsor-hero-fields');
      var ctaUrlLabel = document.getElementById('sponsor-cta-url-label');
      if (heroFields) heroFields.hidden = slot.preview === 'compact';
      if (ctaUrlLabel) {
        ctaUrlLabel.textContent =
          slot.preview === 'compact'
            ? 'Sponsor website URL (https://)'
            : 'CTA link (https:// or mailto:)';
      }
    }

    function renderPreview() {
      var creative = readForm();
      var el = document.getElementById('sponsor-preview');
      var slot = slotDefaults();
      if (!el) return;

      if (!creative.active) {
        el.innerHTML =
          slot.preview === 'compact'
            ? '<div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">Inactive — this ad slot is hidden on site.</div>'
            : '<div class="relative rounded-xl border border-[#c9a8d8] bg-white p-5 text-[#2d1b3d] shadow-[0_4px_18px_rgba(91,47,153,0.1)]">' +
              '<div class="text-xs font-bold uppercase tracking-wide text-[#7a3d8a] mb-3">★ Sponsor Hub</div>' +
              '<p class="text-base font-extrabold mb-2">Your brand here</p>' +
              '<p class="text-sm text-slate-600 mb-4">Your sponsor message appears here</p>' +
              '<span class="inline-block rounded-lg border border-[#c9a8d8] text-[#5b2f99] text-sm font-bold px-4 py-2">Find out more →</span></div>';
        return;
      }

      var taglineHtml = sponsorHeadlineHtml(creative.tagline);
      var list = sponsorBulletsHtml(creative.bullets);

      if (slot.preview === 'compact') {
        el.innerHTML =
          '<aside class="relative rounded-xl border border-slate-200 bg-white p-4 pt-8 shadow-sm max-w-xs flex flex-col gap-3">' +
          '<span class="absolute top-3 right-3 text-[8px] font-bold uppercase tracking-wider text-slate-500">Sponsored</span>' +
          sponsorPreviewLogoHtml(creative.logoUrl, true) +
          '<span class="inline-block w-full text-center rounded-lg bg-[#2d2636] text-white text-xs font-bold px-3 py-2.5">' +
          esc(creative.ctaLabel) +
          '</span></aside>';
        return;
      }

      el.innerHTML =
        '<aside class="relative rounded-xl border border-[#c9a8d8] bg-white p-5 text-[#2d1b3d] max-w-md shadow-[0_4px_18px_rgba(91,47,153,0.1)]">' +
        '<span class="absolute top-4 right-4 text-[9px] font-bold uppercase tracking-wider text-slate-500">Sponsored</span>' +
        '<div class="text-xs font-bold uppercase tracking-wide text-[#7a3d8a] mb-3 pr-16">★ Sponsor Hub</div>' +
        sponsorPreviewLogoHtml(creative.logoUrl, false) +
        (creative.companyName
          ? '<p class="text-sm font-extrabold mb-1">' + esc(creative.companyName) + '</p>'
          : '') +
        (taglineHtml ? '<p class="text-sm font-semibold leading-snug mb-3">' + taglineHtml + '</p>' : '') +
        '<div class="text-xs text-slate-600 mb-4">' +
        list +
        '</div>' +
        '<span class="inline-block w-full text-center rounded-lg bg-[#2d2636] text-white text-sm font-bold px-4 py-2.5">' +
        esc(creative.ctaLabel) +
        '</span></aside>';
    }

    function loadCurrentSlot() {
      setSponsorStatus('Loading ' + slotDefaults().label + '…');
      adminGet('/api/admin/sponsor?slot=' + encodeURIComponent(currentSlotKey))
        .then(function (data) {
          if (data.configured === false) {
            setSponsorStatus('Supabase is not configured — showing defaults only.', 'error');
            applyDefaultsToForm();
            renderPreview();
            return;
          }
          if (data.error) {
            setSponsorStatus('Could not load ad: ' + data.error, 'error');
            return;
          }
          if (data.block) {
            applySponsorBlockToForm(data.block);
            setSponsorStatus('Loaded live creative for ' + slotDefaults().label + '.');
          } else {
            applyDefaultsToForm();
            setSponsorStatus('No saved creative yet — edit below and publish.');
          }
          renderPreview();
        })
        .catch(function () {
          setSponsorStatus('Could not load ad placement.', 'error');
        });
    }

    document.getElementById('sponsor-preview-btn').addEventListener('click', renderPreview);
    [
      'sponsor-company',
      'sponsor-logo-url',
      'sponsor-tagline',
      'sponsor-bullets',
      'sponsor-cta-label',
      'sponsor-cta-url',
      'sponsor-active',
    ].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) input.addEventListener('input', renderPreview);
      if (input && input.type === 'checkbox') input.addEventListener('change', renderPreview);
    });

    document.getElementById('sponsor-logo-file').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        setSponsorStatus('Logo must be under 2MB.', 'error');
        ev.target.value = '';
        return;
      }
      sponsorLogoMime = file.type || 'image/jpeg';
      sponsorLogoFilename = file.name || 'logo.jpg';
      var reader = new FileReader();
      reader.onload = function () {
        sponsorLogoBase64 = String(reader.result || '');
        document.getElementById('sponsor-logo-url').value = '';
        renderPreview();
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('sponsor-slot').addEventListener('change', function (ev) {
      currentSlotKey = ev.target.value || CMS_AD_SLOTS[0].key;
      applyDefaultsToForm();
      syncSlotFormLayout();
      loadCurrentSlot();
    });

    syncSlotFormLayout();

    document.getElementById('sponsor-publish-btn').addEventListener('click', function () {
      var btn = document.getElementById('sponsor-publish-btn');
      var creative = readForm();
      var slot = slotDefaults();
      var body = sponsorBodyFromForm(creative);
      if (
        creative.active &&
        slot.preview === 'hero' &&
        !creative.bullets.length
      ) {
        setSponsorStatus('Add at least one bullet before publishing an active hero ad.', 'error');
        return;
      }
      if (
        creative.active &&
        slot.preview === 'compact' &&
        !creative.logoUrl
      ) {
        setSponsorStatus('Upload or paste a logo before publishing an active sidebar ad.', 'error');
        return;
      }
      if (creative.active && (!creative.ctaLabel || !creative.ctaUrl)) {
        setSponsorStatus('CTA label and link are required for an active ad.', 'error');
        return;
      }
      if (
        creative.active &&
        slot.preview === 'compact' &&
        !/^https?:\/\//i.test(creative.ctaUrl)
      ) {
        setSponsorStatus('Enter the sponsor website URL (https://…).', 'error');
        return;
      }

      if (btn) btn.disabled = true;
      setSponsorStatus('Publishing…');

      var payload = {
        slot: currentSlotKey,
        title: slot.preview === 'compact' ? '' : creative.tagline,
        body:
          slot.preview === 'compact'
            ? ''
            : body || '<ul class="sponsor-list"><li>Placeholder</li></ul>',
        cta_label: creative.ctaLabel,
        cta_url: creative.ctaUrl,
        company_name: slot.preview === 'compact' ? '' : creative.companyName,
        logo_url: sponsorLogoBase64 ? '' : document.getElementById('sponsor-logo-url').value.trim(),
        active: creative.active,
      };
      if (sponsorLogoBase64) {
        payload.logoBase64 = sponsorLogoBase64;
        payload.logoMime = sponsorLogoMime;
        payload.logoFilename = sponsorLogoFilename;
      }

      fetch('/api/admin/sponsor', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok || data.ok === false) {
              throw new Error(data.message || data.error || 'Publish failed (' + r.status + ')');
            }
            return data;
          });
        })
        .then(function (data) {
          sponsorLogoBase64 = null;
          sponsorLogoMime = '';
          sponsorLogoFilename = '';
          var fileInput = document.getElementById('sponsor-logo-file');
          if (fileInput) fileInput.value = '';
          if (data.block) applySponsorBlockToForm(data.block);
          setSponsorStatus(
            creative.active
              ? 'Published — live for ' + slot.label + '.'
              : 'Saved — this ad slot is hidden on site.',
            'ok'
          );
          renderPreview();
        })
        .catch(function (err) {
          setSponsorStatus(err.message || 'Could not publish Sponsor Hub.', 'error');
        })
        .finally(function () {
          if (btn) btn.disabled = false;
        });
    });

    renderPreview();
    loadCurrentSlot();
  }

  function renderEmails() {
    var templates = [];
    var selectedSlug = '';
    var dirty = false;

    var SAMPLE_VARS = {
      user_name: 'Alex Morgan',
      user_email: 'alex@example.com',
      event_name: 'London Founders Breakfast',
      event_date: 'Tuesday 12 August 2026',
      event_time: '8:00 AM',
      event_location: 'The Shard, London SE1',
      event_url: 'https://the-networker-hub.vercel.app/events/london-founders-breakfast',
      ticket_name: 'General admission',
      amount_paid: '£25.00',
      organiser_name: 'City Connectors',
      meeting_link: 'https://meet.example.com/room',
      dashboard_url: 'https://the-networker-hub.vercel.app/organiser-dashboard.html',
      site_url: 'https://the-networker-hub.vercel.app',
    };

    main.innerHTML =
      '<div class="space-y-6">' +
      '<p id="email-status" class="text-sm text-slate-500">Loading email templates…</p>' +
      '<div class="grid lg:grid-cols-[minmax(200px,240px)_minmax(0,1fr)] gap-6 min-w-0">' +
      '<aside class="admin-panel-sticky bg-white rounded-xl border border-slate-200 shadow-sm p-4 min-w-0">' +
      '<h3 class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Templates</h3>' +
      '<ul id="email-template-list" class="space-y-1 text-sm"></ul>' +
      '</aside>' +
      '<div class="space-y-6 min-w-0">' +
      '<form id="email-editor" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5 hidden min-w-0">' +
      '<div><p id="email-template-name" class="font-bold text-brand-900 text-lg"></p>' +
      '<p id="email-template-desc" class="text-sm text-slate-500 mt-1"></p></div>' +
      '<div><label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" for="email-subject">Subject line</label>' +
      '<input type="text" id="email-subject" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Your ticket for {{event_name}}"></div>' +
      '<div><label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1" for="email-body">HTML body</label>' +
      '<textarea id="email-body" rows="14" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-xs leading-relaxed" spellcheck="false"></textarea>' +
      '<p class="text-xs text-slate-500 mt-2">Use <code class="bg-slate-100 px-1 rounded">{{placeholders}}</code> for dynamic values. Available for this template:</p>' +
      '<div id="email-placeholders" class="flex flex-wrap gap-2 mt-2"></div></div>' +
      '<div class="flex flex-wrap gap-3 pt-1">' +
      '<button type="button" id="email-save-btn" class="rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900">Save template</button>' +
      '<button type="button" id="email-preview-btn" class="rounded-lg border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Refresh preview</button>' +
      '</div>' +
      '<div class="border-t border-slate-100 pt-5 space-y-3">' +
      '<h4 class="text-sm font-bold text-brand-900">Send test email</h4>' +
      '<div class="flex flex-wrap gap-3 items-end">' +
      '<div class="flex-1 min-w-[200px]"><label class="block text-xs font-semibold text-slate-600 mb-1" for="email-test-to">Recipient</label>' +
      '<input type="email" id="email-test-to" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="you@company.com"></div>' +
      '<button type="button" id="email-test-btn" class="rounded-lg border border-brand-700 text-brand-700 px-4 py-2 text-sm font-semibold hover:bg-brand-50">Send test</button>' +
      '</div></div></form>' +
      '<section id="email-preview-panel" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hidden">' +
      '<h3 class="font-bold text-brand-900 mb-1">Preview</h3>' +
      '<p id="email-preview-subject" class="text-sm text-slate-600 mb-4"></p>' +
      '<div id="email-preview-html" class="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm prose prose-sm max-w-none"></div>' +
      '</section></div></div></div>';

    function setEmailStatus(text, tone) {
      var el = document.getElementById('email-status');
      if (!el) return;
      el.textContent = text;
      el.className =
        'text-sm ' +
        (tone === 'error'
          ? 'text-red-700 font-semibold'
          : tone === 'ok'
            ? 'text-emerald-700 font-semibold'
            : 'text-slate-500');
    }

    function currentTemplate() {
      for (var i = 0; i < templates.length; i++) {
        if (templates[i].slug === selectedSlug) return templates[i];
      }
      return null;
    }

    function renderTemplateList() {
      var list = document.getElementById('email-template-list');
      if (!list) return;
      if (!templates.length) {
        list.innerHTML = '<li class="text-slate-400">No templates yet — run migration 027 in Supabase.</li>';
        return;
      }
      list.innerHTML = templates
        .map(function (t) {
          var active = t.slug === selectedSlug;
          return (
            '<li><button type="button" data-email-slug="' +
            attrEsc(t.slug) +
            '" class="w-full text-left rounded-lg px-3 py-2 transition ' +
            (active
              ? 'bg-brand-50 text-brand-900 font-semibold border border-brand-100'
              : 'text-slate-700 hover:bg-slate-50') +
            '">' +
            esc(t.name) +
            '<span class="block text-[11px] font-normal text-slate-400 mt-0.5">' +
            esc(t.slug) +
            '</span></button></li>'
          );
        })
        .join('');
      list.querySelectorAll('[data-email-slug]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (dirty && !window.confirm('Discard unsaved changes?')) return;
          selectTemplate(btn.getAttribute('data-email-slug'));
        });
      });
    }

    function renderPlaceholderChips(placeholders) {
      var wrap = document.getElementById('email-placeholders');
      if (!wrap) return;
      var keys = Array.isArray(placeholders) ? placeholders : [];
      if (!keys.length) {
        wrap.innerHTML = '<span class="text-xs text-slate-400">No placeholders documented.</span>';
        return;
      }
      wrap.innerHTML = keys
        .map(function (key) {
          return (
            '<button type="button" data-ph="' +
            attrEsc(key) +
            '" class="text-xs rounded-full bg-slate-100 text-slate-700 px-2.5 py-1 hover:bg-brand-50 hover:text-brand-900">{{' +
            esc(key) +
            '}}</button>'
          );
        })
        .join('');
      wrap.querySelectorAll('[data-ph]').forEach(function (chip) {
        chip.addEventListener('click', function () {
          var key = chip.getAttribute('data-ph');
          var body = document.getElementById('email-body');
          if (!body) return;
          var token = '{{' + key + '}}';
          var start = body.selectionStart;
          var end = body.selectionEnd;
          var val = body.value;
          body.value = val.slice(0, start) + token + val.slice(end);
          body.focus();
          body.selectionStart = body.selectionEnd = start + token.length;
          dirty = true;
        });
      });
    }

    function fillEditor(template) {
      var form = document.getElementById('email-editor');
      var previewPanel = document.getElementById('email-preview-panel');
      if (!template) {
        if (form) form.classList.add('hidden');
        if (previewPanel) previewPanel.classList.add('hidden');
        return;
      }
      if (form) form.classList.remove('hidden');
      if (previewPanel) previewPanel.classList.remove('hidden');
      document.getElementById('email-template-name').textContent = template.name;
      document.getElementById('email-template-desc').textContent =
        template.description || 'Transactional email template.';
      document.getElementById('email-subject').value = template.subject || '';
      document.getElementById('email-body').value = template.body_html || '';
      renderPlaceholderChips(template.placeholders);
      dirty = false;
      refreshPreview();
    }

    function selectTemplate(slug) {
      selectedSlug = slug;
      renderTemplateList();
      fillEditor(currentTemplate());
    }

    function refreshPreview() {
      if (!selectedSlug) return;
      adminPost('/api/admin/emails', {
        action: 'preview',
        slug: selectedSlug,
        variables: SAMPLE_VARS,
      })
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Preview failed');
          document.getElementById('email-preview-subject').textContent = 'Subject: ' + data.subject;
          document.getElementById('email-preview-html').innerHTML = data.html;
        })
        .catch(function (err) {
          setEmailStatus(err.message || 'Could not render preview.', 'error');
        });
    }

    function loadTemplates() {
      setEmailStatus('Loading templates from Supabase…');
      adminGet('/api/admin/emails')
        .then(function (data) {
          if (data.error === 'supabase_not_configured') {
            setEmailStatus('Supabase is not configured.', 'error');
            return;
          }
          if (data.error || !data.ok) {
            setEmailStatus('Could not load templates: ' + (data.error || 'unknown'), 'error');
            return;
          }
          templates = data.templates || [];
          if (!selectedSlug && templates.length) selectedSlug = templates[0].slug;
          renderTemplateList();
          fillEditor(currentTemplate());
          setEmailStatus(templates.length + ' template' + (templates.length === 1 ? '' : 's') + ' loaded.');
        })
        .catch(function () {
          setEmailStatus('Could not load email templates.', 'error');
        });
    }

    var testTo = document.getElementById('email-test-to');
    if (testTo && currentUser && currentUser.email) testTo.value = currentUser.email;

    document.getElementById('email-subject').addEventListener('input', function () {
      dirty = true;
    });
    document.getElementById('email-body').addEventListener('input', function () {
      dirty = true;
    });

    document.getElementById('email-save-btn').addEventListener('click', function () {
      if (!selectedSlug) return;
      var btn = document.getElementById('email-save-btn');
      if (btn) btn.disabled = true;
      setEmailStatus('Saving…');
      adminPatch('/api/admin/emails', {
        slug: selectedSlug,
        subject: document.getElementById('email-subject').value,
        body_html: document.getElementById('email-body').value,
      })
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Save failed');
          for (var i = 0; i < templates.length; i++) {
            if (templates[i].slug === selectedSlug) {
              templates[i] = data.template;
              break;
            }
          }
          dirty = false;
          setEmailStatus('Saved ' + data.template.name + '.', 'ok');
          refreshPreview();
        })
        .catch(function (err) {
          setEmailStatus(err.message || 'Could not save template.', 'error');
        })
        .finally(function () {
          if (btn) btn.disabled = false;
        });
    });

    document.getElementById('email-preview-btn').addEventListener('click', refreshPreview);

    document.getElementById('email-test-btn').addEventListener('click', function () {
      if (!selectedSlug) return;
      var btn = document.getElementById('email-test-btn');
      var to = (document.getElementById('email-test-to').value || '').trim();
      if (!to) {
        setEmailStatus('Enter a recipient email for the test send.', 'error');
        return;
      }
      if (btn) btn.disabled = true;
      setEmailStatus('Sending test email…');
      adminPost('/api/admin/emails', {
        action: 'test',
        slug: selectedSlug,
        to: to,
        variables: SAMPLE_VARS,
      })
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Send failed');
          setEmailStatus('Test sent to ' + data.to + '.', 'ok');
        })
        .catch(function (err) {
          setEmailStatus(err.message || 'Could not send test email.', 'error');
        })
        .finally(function () {
          if (btn) btn.disabled = false;
        });
    });

    loadTemplates();
  }

  function normalizeOrganiserOption(o) {
    return {
      id: o.id,
      name: o.name,
      listingStatus: o.listingStatus || o.listing_status || '',
      slug: o.slug || '',
    };
  }

  function missingBadge(field) {
    var labels = { description: 'No bio', logo: 'No logo', website: 'No website' };
    return (
      '<span class="inline-flex items-center rounded-full bg-amber-100 text-amber-900 text-[10px] font-semibold px-2 py-0.5 mr-1">' +
      esc(labels[field] || field) +
      '</span>'
    );
  }

  function listingStatusBadge(status) {
    var s = String(status || 'draft').toLowerCase();
    var cls =
      s === 'published'
        ? 'bg-emerald-100 text-emerald-800'
        : s === 'unpublished'
          ? 'bg-slate-200 text-slate-700'
          : 'bg-amber-100 text-amber-900';
    return (
      '<span class="inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 ' +
      cls +
      '">' +
      esc(s) +
      '</span>'
    );
  }

  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ''));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function adminLogoFieldHtml(key, photoUrl) {
    var hasPhoto = !!photoUrl;
    return (
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Logo</label>' +
      '<p class="text-[11px] text-slate-500 mb-2">Click, paste (Ctrl+V), or drop an image — or paste a URL below.</p>' +
      '<div class="admin-logo-zone border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-brand-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 transition bg-white" data-admin-logo-key="' +
      attrEsc(key) +
      '" tabindex="0" role="button" aria-label="Upload or paste logo">' +
      '<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>' +
      '<img class="admin-logo-preview mx-auto h-16 w-16 rounded-lg object-cover border border-slate-200' +
      (hasPhoto ? '' : ' hidden') +
      '" src="' +
      attrEsc(photoUrl || '') +
      '" alt="">' +
      '<p class="admin-logo-placeholder text-xs text-slate-500 mt-2' +
      (hasPhoto ? ' hidden' : '') +
      '">Drop image here or click to browse</p></div>' +
      '<input type="url" name="photo_url" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm mt-2" value="' +
      attrEsc(photoUrl || '') +
      '" placeholder="https://… (optional if you uploaded a file)"></div>'
    );
  }

  function bindAdminLogoZone(zone) {
    if (!zone || zone.dataset.logoBound) return;
    zone.dataset.logoBound = '1';
    var key = zone.getAttribute('data-admin-logo-key') || '';
    var fileInput = zone.querySelector('input[type="file"]');
    var preview = zone.querySelector('.admin-logo-preview');
    var placeholder = zone.querySelector('.admin-logo-placeholder');
    var form = zone.closest('form');
    var urlInput = form && form.querySelector('input[name="photo_url"]');

    function showPreview(src) {
      if (preview) {
        preview.src = src;
        preview.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
    }

    function setFile(file) {
      adminLogoPending[key] = { file: file };
      var reader = new FileReader();
      reader.onload = function () {
        adminLogoPending[key].dataUrl = reader.result;
        showPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }

    if (window.hubBindImageUpload) {
      window.hubBindImageUpload({ zone: zone, fileInput: fileInput, onFile: setFile });
    } else if (fileInput) {
      zone.addEventListener('click', function () {
        fileInput.click();
      });
      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (file) setFile(file);
      });
    }

    if (urlInput) {
      urlInput.addEventListener('input', function () {
        var url = String(urlInput.value || '').trim();
        if (url && preview) {
          preview.src = url;
          preview.classList.remove('hidden');
          if (placeholder) placeholder.classList.add('hidden');
          delete adminLogoPending[key];
        }
      });
    }
  }

  function bindAdminLogoZones(root) {
    (root || main).querySelectorAll('[data-admin-logo-key]').forEach(bindAdminLogoZone);
  }

  function getSelectedGroupIds() {
    return Object.keys(groupCleanupState.selected).filter(function (id) {
      return groupCleanupState.selected[id];
    });
  }

  function updateGroupBulkBar() {
    var bar = document.getElementById('group-cleanup-bulk');
    var countEl = document.getElementById('group-bulk-count');
    var ids = getSelectedGroupIds();
    if (countEl) countEl.textContent = String(ids.length);
    if (bar) bar.classList.toggle('hidden', ids.length === 0);
  }

  function logoPayloadForKey(key, form) {
    var pending = adminLogoPending[key];
    if (pending && pending.file) {
      return readFileAsBase64(pending.file).then(function (b64) {
        var payload = {
          logoBase64: b64,
          logoMime: pending.file.type,
          logoFilename: pending.file.name,
        };
        if (form && formField(form, 'photo_url')) {
          var url = formFieldVal(form, 'photo_url');
          if (url) payload.photo_url = url;
        }
        return payload;
      });
    }
    var payload = {};
    if (form && formField(form, 'photo_url')) payload.photo_url = formFieldVal(form, 'photo_url');
    return Promise.resolve(payload);
  }

  function fetchGroupCleanup(append) {
    if (groupCleanupState.loading) return Promise.resolve(groupCleanupCache);
    groupCleanupState.loading = true;
    var params = new URLSearchParams();
    params.set('offset', append ? String(groupCleanupState.offset) : '0');
    params.set('limit', String(GROUP_PAGE_SIZE));
    if (groupCleanupState.q) params.set('q', groupCleanupState.q);
    if (groupCleanupState.incomplete) params.set('incomplete', '1');
    return adminGet('/api/admin/organisers?' + params.toString())
      .then(function (data) {
        groupCleanupState.loading = false;
        if (!data || data.error) return data;
        if (append && groupCleanupCache && groupCleanupCache.organisers) {
          groupCleanupCache.organisers = groupCleanupCache.organisers.concat(data.organisers || []);
          groupCleanupCache.incomplete = data.incomplete;
        } else {
          groupCleanupCache = data;
        }
        groupCleanupState.offset = (groupCleanupCache.organisers || []).length;
        groupCleanupState.hasMore = !!data.hasMore;
        groupCleanupState.total = data.total || groupCleanupState.offset;
        return groupCleanupCache;
      })
      .catch(function () {
        groupCleanupState.loading = false;
        return { error: 'network_error' };
      });
  }

  function loadMoreGroups() {
    if (!groupCleanupState.hasMore || groupCleanupState.loading) return;
    fetchGroupCleanup(true).then(function (data) {
      renderGroupCleanupList(data);
      bindAdminLogoZones(main);
      attachGroupLoadMore();
    });
  }

  function fetchEventCleanup(append) {
    if (eventCleanupState.loading) return Promise.resolve(eventCleanupCache);
    eventCleanupState.loading = true;
    var params = new URLSearchParams();
    params.set('offset', append ? String(eventCleanupState.offset) : '0');
    params.set('limit', String(EVENT_PAGE_SIZE));
    if (eventCleanupState.organiserId) params.set('organiser_id', eventCleanupState.organiserId);
    if (eventCleanupState.unlinked) params.set('unlinked', '1');
    if (eventCleanupState.q) params.set('q', eventCleanupState.q);
    return adminGet('/api/admin/events?' + params.toString())
      .then(function (data) {
        eventCleanupState.loading = false;
        if (!data || data.error) return data;
        if (append && eventCleanupCache && eventCleanupCache.events) {
          eventCleanupCache.events = eventCleanupCache.events.concat(data.events || []);
        } else {
          eventCleanupCache = data;
        }
        eventCleanupState.offset = (eventCleanupCache.events || []).length;
        eventCleanupState.hasMore = !!data.hasMore;
        eventCleanupState.total = data.total || eventCleanupState.offset;
        return eventCleanupCache;
      })
      .catch(function () {
        eventCleanupState.loading = false;
        return { error: 'network_error' };
      });
  }

  function loadMoreEvents() {
    if (!eventCleanupState.hasMore || eventCleanupState.loading) return;
    fetchEventCleanup(true).then(function () {
      renderEventCleanupList();
      attachEventLoadMore();
    });
  }

  function saveGroupCleanupForm(form) {
    var id = form.getAttribute('data-organiser-id');
    var msg = form.querySelector('.group-cleanup-msg');
    var btn = form.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Saving…';
      msg.className = 'group-cleanup-msg text-xs text-slate-500';
    }
    logoPayloadForKey(id, form)
      .then(function (logoPayload) {
        return adminPost('/api/admin/organisers', {
          id: id,
          description: formFieldVal(form, 'description'),
          website: formFieldVal(form, 'website'),
          photo_url: logoPayload.photo_url,
          logoBase64: logoPayload.logoBase64,
          logoMime: logoPayload.logoMime,
          logoFilename: logoPayload.logoFilename,
        });
      })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Save failed');
        delete adminLogoPending[id];
        if (msg) {
          msg.textContent = 'Saved.';
          msg.className = 'group-cleanup-msg text-xs text-emerald-700 font-semibold';
        }
        groupCleanupState.offset = 0;
        return fetchGroupCleanup(false);
      })
      .then(function (data) {
        renderGroupCleanupList(data);
        bindAdminLogoZones(main);
        updateGroupBulkBar();
        attachGroupLoadMore();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not save';
          msg.className = 'group-cleanup-msg text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function saveGroupBulkForm(form) {
    var ids = getSelectedGroupIds();
    var msg = document.getElementById('group-bulk-msg');
    var btn = form.querySelector('[type="submit"]');
    if (!ids.length) return;
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Applying to ' + ids.length + ' groups…';
      msg.className = 'text-xs text-slate-500';
    }
    logoPayloadForKey('bulk', form)
      .then(function (logoPayload) {
        var payload = { action: 'bulk_update', ids: ids };
        var desc = formFieldVal(form, 'bulk_description');
        var site = formFieldVal(form, 'bulk_website');
        if (desc) payload.description = desc;
        if (site) payload.website = site;
        if (logoPayload.photo_url) payload.photo_url = logoPayload.photo_url;
        if (logoPayload.logoBase64) {
          payload.logoBase64 = logoPayload.logoBase64;
          payload.logoMime = logoPayload.logoMime;
          payload.logoFilename = logoPayload.logoFilename;
        }
        if (!payload.description && !payload.website && !payload.photo_url && !payload.logoBase64) {
          throw new Error('Fill in at least one field to apply.');
        }
        return adminPost('/api/admin/organisers', payload);
      })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Bulk update failed');
        delete adminLogoPending.bulk;
        groupCleanupState.selected = {};
        groupCleanupState.offset = 0;
        if (msg) {
          msg.textContent = 'Updated ' + (data.updated || ids.length) + ' groups.';
          msg.className = 'text-xs text-emerald-700 font-semibold';
        }
        return fetchGroupCleanup(false);
      })
      .then(function (data) {
        renderGroupCleanupList(data);
        bindAdminLogoZones(main);
        updateGroupBulkBar();
        attachGroupLoadMore();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not apply bulk update';
          msg.className = 'text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function saveEventCleanupForm(form) {
    var id = form.getAttribute('data-event-id');
    var msg = form.querySelector('.event-cleanup-msg');
    var btn = form.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Saving…';
      msg.className = 'event-cleanup-msg text-xs text-slate-500';
    }
    adminPost('/api/admin/events', {
      id: id,
      title: formFieldVal(form, 'title'),
      organiser_id: formFieldVal(form, 'organiser_id') || null,
      starts_at: formFieldVal(form, 'starts_at') || null,
      event_type: formFieldVal(form, 'event_type') || null,
      meeting_type: formFieldVal(form, 'meeting_type') || null,
      status: formFieldVal(form, 'status') || null,
      photo_url: formFieldVal(form, 'photo_url') || null,
    })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Save failed');
        if (msg) {
          msg.textContent = 'Saved.';
          msg.className = 'event-cleanup-msg text-xs text-emerald-700 font-semibold';
        }
        return refreshEventCleanupData();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not save';
          msg.className = 'event-cleanup-msg text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function createEventCleanupForm(form) {
    var msg = form.querySelector('.event-create-msg');
    var btn = form.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Creating…';
      msg.className = 'event-create-msg text-xs text-slate-500';
    }
    adminPost('/api/admin/events', {
      action: 'create',
      title: formFieldVal(form, 'title'),
      organiser_id: formFieldVal(form, 'organiser_id'),
      starts_at: formFieldVal(form, 'starts_at') || null,
      event_type: formFieldVal(form, 'event_type') || 'Networking meeting',
      meeting_type: formFieldVal(form, 'meeting_type') || 'In person',
      status: formFieldVal(form, 'status') || 'draft',
    })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Create failed');
        if (msg) {
          msg.textContent = 'Event created.';
          msg.className = 'event-create-msg text-xs text-emerald-700 font-semibold';
        }
        form.reset();
        if (eventCleanupState.organiserId) {
          var orgField = formField(form, 'organiser_id');
          if (orgField) orgField.value = eventCleanupState.organiserId;
        }
        return refreshEventCleanupData();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not create event';
          msg.className = 'event-create-msg text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function bindGroupCleanupForms() {
    if (!main || main.dataset.groupCleanupBound) return;
    main.dataset.groupCleanupBound = '1';
    main.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.classList) return;
      if (form.classList.contains('group-cleanup-form')) {
        e.preventDefault();
        saveGroupCleanupForm(form);
      } else if (form.id === 'group-bulk-form') {
        e.preventDefault();
        saveGroupBulkForm(form);
      }
    });
    main.addEventListener('input', function (e) {
      if (e.target.id !== 'group-cleanup-search') return;
      clearTimeout(groupSearchTimer);
      groupSearchTimer = setTimeout(function () {
        groupCleanupState.q = e.target.value || '';
        groupCleanupState.offset = 0;
        fetchGroupCleanup(false).then(function (data) {
          renderGroupCleanupList(data);
          bindAdminLogoZones(main);
          attachGroupLoadMore();
        });
      }, 300);
    });
    main.addEventListener('change', function (e) {
      if (e.target.id === 'group-cleanup-incomplete') {
        groupCleanupState.incomplete = e.target.checked;
        groupCleanupState.offset = 0;
        fetchGroupCleanup(false).then(function (data) {
          renderGroupCleanupList(data);
          bindAdminLogoZones(main);
          attachGroupLoadMore();
        });
        return;
      }
      if (e.target.classList && e.target.classList.contains('group-select-checkbox')) {
        var gid = e.target.value;
        if (e.target.checked) groupCleanupState.selected[gid] = true;
        else delete groupCleanupState.selected[gid];
        updateGroupBulkBar();
        return;
      }
      if (e.target.id === 'group-cleanup-select-page') {
        main.querySelectorAll('.group-select-checkbox').forEach(function (cb) {
          cb.checked = e.target.checked;
          if (e.target.checked) groupCleanupState.selected[cb.value] = true;
          else delete groupCleanupState.selected[cb.value];
        });
        updateGroupBulkBar();
      }
    });
    main.addEventListener('click', function (e) {
      var toggle = e.target.closest('[data-toggle-group-edit]');
      if (toggle) {
        var row = toggle.closest('[data-organiser-id-row]');
        var panel = row && row.querySelector('.group-cleanup-panel');
        if (panel) {
          panel.classList.toggle('hidden');
          if (!panel.classList.contains('hidden')) bindAdminLogoZones(panel);
        }
        return;
      }
      if (e.target.id === 'group-cleanup-load-more') loadMoreGroups();
      if (e.target.id === 'group-bulk-clear') {
        groupCleanupState.selected = {};
        main.querySelectorAll('.group-select-checkbox').forEach(function (cb) {
          cb.checked = false;
        });
        var selectPage = document.getElementById('group-cleanup-select-page');
        if (selectPage) selectPage.checked = false;
        updateGroupBulkBar();
      }
    });
  }

  function attachGroupLoadMore() {
    var sentinel = document.getElementById('group-cleanup-sentinel');
    if (!sentinel || !groupCleanupState.hasMore) return;
    if (groupLoadObserver) groupLoadObserver.disconnect();
    groupLoadObserver = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) loadMoreGroups();
      },
      { rootMargin: '240px' }
    );
    groupLoadObserver.observe(sentinel);
  }

  function attachEventLoadMore() {
    var sentinel = document.getElementById('event-cleanup-sentinel');
    if (!sentinel || !eventCleanupState.hasMore) return;
    if (eventLoadObserver) eventLoadObserver.disconnect();
    eventLoadObserver = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) loadMoreEvents();
      },
      { rootMargin: '240px' }
    );
    eventLoadObserver.observe(sentinel);
  }

  function bindEventCleanupForms() {
    if (!main || main.dataset.eventCleanupBound) return;
    main.dataset.eventCleanupBound = '1';
    main.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.classList) return;
      if (form.classList.contains('event-cleanup-form')) {
        e.preventDefault();
        saveEventCleanupForm(form);
      } else if (form.classList.contains('event-create-form')) {
        e.preventDefault();
        createEventCleanupForm(form);
      }
    });
    main.addEventListener('change', function (e) {
      if (e.target.id === 'event-cleanup-organiser') {
        eventCleanupState.organiserId = e.target.value || '';
        refreshEventCleanupData();
      }
      if (e.target.id === 'event-cleanup-unlinked') {
        eventCleanupState.unlinked = e.target.checked;
        refreshEventCleanupData();
      }
    });
    main.addEventListener('input', function (e) {
      if (e.target.id !== 'event-cleanup-search') return;
      clearTimeout(eventSearchTimer);
      eventSearchTimer = setTimeout(function () {
        eventCleanupState.q = e.target.value || '';
        refreshEventCleanupData();
      }, 300);
    });
    main.addEventListener('click', function (e) {
      if (e.target.id === 'event-cleanup-load-more') loadMoreEvents();
    });
  }

  function renderGroupCleanupList(data) {
    var list = document.getElementById('group-cleanup-list');
    var status = document.getElementById('group-cleanup-status');
    if (!list) return;

    if (!data || data.error || data.ok === false) {
      if (status) {
        status.innerHTML =
          '<span class="text-red-700 font-semibold">Could not load groups (' +
          esc((data && (data.error || data.message)) || 'unknown') +
          ').</span>';
      }
      list.innerHTML = '';
      return;
    }

    var organisers = data.organisers || [];
    var shown = organisers.length;
    var total = groupCleanupState.total || shown;

    if (status) {
      status.innerHTML =
        '<span class="text-brand-900 font-semibold">Showing ' +
        shown +
        ' of ' +
        total +
        ' group' +
        (total === 1 ? '' : 's') +
        '</span>' +
        (data.incomplete
          ? ' <span class="text-slate-500">(' + data.incomplete + ' with missing profile data)</span>'
          : '') +
        (groupCleanupState.loading ? ' <span class="text-slate-400">Loading…</span>' : '');
    }

    if (!organisers.length) {
      list.innerHTML =
        '<p class="text-sm text-slate-500 rounded-xl border border-dashed border-slate-300 p-8 text-center">No groups match your filters.</p>';
      return;
    }

    list.innerHTML =
      organisers
        .map(function (o) {
          var publicHref = o.slug ? '../organisers/' + encodeURIComponent(o.slug) : '';
          var missingHtml =
            (o.missing || []).map(missingBadge).join('') ||
            '<span class="text-xs text-emerald-700">Complete</span>';
          var checked = groupCleanupState.selected[o.id] ? ' checked' : '';
          return (
            '<article class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden" data-organiser-id-row="' +
            attrEsc(o.id) +
            '">' +
            '<div class="flex flex-wrap items-center justify-between gap-3 p-4">' +
            '<div class="flex items-start gap-3 min-w-0 flex-1">' +
            '<input type="checkbox" class="group-select-checkbox mt-1 rounded border-slate-300" value="' +
            attrEsc(o.id) +
            '"' +
            checked +
            ' aria-label="Select ' +
            attrEsc(o.name || 'group') +
            '">' +
            '<div class="min-w-0">' +
            '<div class="flex flex-wrap items-center gap-2">' +
            '<h3 class="font-semibold text-brand-900 truncate">' +
            esc(o.name || 'Untitled') +
            '</h3>' +
            listingStatusBadge(o.listing_status) +
            '</div>' +
            '<p class="text-xs text-slate-500 mt-1">' +
            (o.event_count || 0) +
            ' event' +
            (o.event_count === 1 ? '' : 's') +
            ' · ' +
            missingHtml +
            '</p></div></div>' +
            '<div class="flex flex-wrap gap-2 shrink-0">' +
            (publicHref
              ? '<a href="' +
                attrEsc(publicHref) +
                '" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline">View public</a>'
              : '') +
            '<button type="button" data-toggle-group-edit class="text-xs font-semibold rounded-lg bg-brand-700 text-white px-3 py-1.5 hover:bg-brand-900">Edit profile</button>' +
            '</div></div>' +
            '<div class="group-cleanup-panel hidden border-t border-slate-200 bg-slate-50/80 p-4">' +
            '<form class="group-cleanup-form space-y-3" data-organiser-id="' +
            attrEsc(o.id) +
            '">' +
            '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Description / bio</label>' +
            '<textarea name="description" rows="4" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
            esc(o.description || '') +
            '</textarea></div>' +
            adminLogoFieldHtml(o.id, o.photo_url) +
            '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Website</label>' +
            '<input type="url" name="website" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
            attrEsc(o.website || '') +
            '" placeholder="https://…"></div>' +
            '<div class="flex flex-wrap items-center gap-3">' +
            '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Save profile</button>' +
            '<a href="../organiser/group-edit.html?id=' +
            encodeURIComponent(o.id) +
            '" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline">Open full editor</a>' +
            '<span class="group-cleanup-msg text-xs"></span></div></form></div></article>'
          );
        })
        .join('') +
      (groupCleanupState.hasMore
        ? '<div id="group-cleanup-sentinel" class="py-6 text-center">' +
          '<button type="button" id="group-cleanup-load-more" class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-slate-50">Load more groups</button>' +
          '</div>'
        : '');
    updateGroupBulkBar();
  }

  function renderGroupCleanup() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<div id="group-cleanup-status" class="text-sm text-slate-500">Loading groups…</div>' +
      '<div id="group-cleanup-bulk" class="hidden rounded-xl border border-brand-200 bg-brand-50 p-4 shadow-sm space-y-3">' +
      '<form id="group-bulk-form" class="space-y-3">' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
      '<p class="text-sm font-semibold text-brand-900"><span id="group-bulk-count">0</span> groups selected</p>' +
      '<button type="button" id="group-bulk-clear" class="text-xs font-semibold text-slate-600 hover:text-brand-900">Clear selection</button></div>' +
      '<p class="text-xs text-slate-600">Only filled-in fields are applied to every selected group.</p>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Description / bio</label>' +
      '<textarea name="bulk_description" rows="3" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="Leave blank to keep existing bios"></textarea></div>' +
      adminLogoFieldHtml('bulk', '') +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Website</label>' +
      '<input type="url" name="bulk_website" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="https://…"></div>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Apply to selected</button>' +
      '<span id="group-bulk-msg" class="text-xs"></span></div></form></div>' +
      '<div class="admin-filter-bar flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">' +
      '<input type="search" id="group-cleanup-search" placeholder="Search by name…" class="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full sm:max-w-xs bg-white" value="' +
      attrEsc(groupCleanupState.q) +
      '">' +
      '<label class="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">' +
      '<input type="checkbox" id="group-cleanup-incomplete" class="rounded border-slate-300"' +
      (groupCleanupState.incomplete ? ' checked' : '') +
      '> Show incomplete only</label>' +
      '<label class="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">' +
      '<input type="checkbox" id="group-cleanup-select-page" class="rounded border-slate-300"> Select all on page</label></div>' +
      '<div id="group-cleanup-list" class="space-y-3"></div></div>';

    groupCleanupState.offset = 0;
    fetchGroupCleanup(false)
      .then(function (data) {
        renderGroupCleanupList(data || { error: 'load_failed' });
        bindAdminLogoZones(main);
        attachGroupLoadMore();
      })
      .catch(function () {
        renderGroupCleanupList({ error: 'network_error' });
      });
  }

  function eventTypeOptions(selected) {
    return EVENT_TYPES.map(function (t) {
      return (
        '<option value="' +
        attrEsc(t) +
        '"' +
        (selected === t ? ' selected' : '') +
        '>' +
        esc(t) +
        '</option>'
      );
    }).join('');
  }

  function meetingFormatOptions(selected) {
    return MEETING_FORMATS.map(function (f) {
      return (
        '<option value="' +
        attrEsc(f) +
        '"' +
        (selected === f ? ' selected' : '') +
        '>' +
        esc(f) +
        '</option>'
      );
    }).join('');
  }

  function eventStatusOptions(selected) {
    var statuses = ['draft', 'published', 'unpublished', 'archived', 'cancelled'];
    return statuses
      .map(function (s) {
        return (
          '<option value="' +
          attrEsc(s) +
          '"' +
          (selected === s ? ' selected' : '') +
          '>' +
          esc(s) +
          '</option>'
        );
      })
      .join('');
  }

  function eventCleanupFilterHtml(organisers) {
    return (
      '<option value="">All organisers</option>' +
      organisers
        .map(function (o) {
          return (
            '<option value="' +
            attrEsc(o.id) +
            '"' +
            (eventCleanupState.organiserId === o.id ? ' selected' : '') +
            '>' +
            esc(o.name) +
            (o.listingStatus === 'published' ? '' : ' (draft)') +
            '</option>'
          );
        })
        .join('')
    );
  }

  function applyEventCleanupData(data) {
    var status = document.getElementById('event-cleanup-status');
    if (!data || data.error || data.ok === false) {
      if (status) {
        status.innerHTML =
          '<span class="text-red-700 font-semibold">Could not load events (' +
          esc((data && (data.error || data.message)) || 'unknown') +
          ').</span>';
      }
      return;
    }

    eventCleanupCache = data;
    var organisers = (data.organisers || []).map(normalizeOrganiserOption);
    var filterSelect = document.getElementById('event-cleanup-organiser');
    var createSelect = document.getElementById('event-create-organiser');
    if (filterSelect) filterSelect.innerHTML = eventCleanupFilterHtml(organisers);
    if (createSelect) {
      createSelect.innerHTML = organiserOptionsHtml(organisers, eventCleanupState.organiserId);
    }
    renderEventCleanupList();
    attachEventLoadMore();
  }

  function refreshEventCleanupData() {
    eventCleanupState.offset = 0;
    var status = document.getElementById('event-cleanup-status');
    if (status) status.textContent = 'Loading events…';
    return fetchEventCleanup(false)
      .then(applyEventCleanupData)
      .catch(function () {
        applyEventCleanupData({ error: 'network_error' });
      });
  }

  function renderEventCleanupList() {
    var list = document.getElementById('event-cleanup-list');
    var status = document.getElementById('event-cleanup-status');
    if (!list || !eventCleanupCache) return;

    var data = eventCleanupCache;
    var organisers = (data.organisers || []).map(normalizeOrganiserOption);
    var events = data.events || [];
    var shown = events.length;
    var total = eventCleanupState.total || shown;

    if (status) {
      var parts = [
        '<span class="text-brand-900 font-semibold">Showing ' +
          shown +
          ' of ' +
          total +
          ' event' +
          (total === 1 ? '' : 's') +
          '</span>',
      ];
      if (data.unlinked_count) {
        parts.push(
          '<span class="text-amber-800 font-semibold">' +
            data.unlinked_count +
            ' unlinked</span>'
        );
      }
      if (eventCleanupState.loading) {
        parts.push('<span class="text-slate-400">Loading…</span>');
      }
      status.innerHTML = parts.join(' · ');
    }

    if (!events.length) {
      list.innerHTML =
        '<p class="text-sm text-slate-500 rounded-xl border border-dashed border-slate-300 p-8 text-center">No events match your filters. Create one below or change the organiser filter.</p>';
      return;
    }

    list.innerHTML =
      events
        .map(function (ev) {
        var publicHref = ev.slug ? '../events/' + encodeURIComponent(ev.slug) : '';
        return (
          '<article class="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3" data-event-id="' +
          attrEsc(ev.id) +
          '">' +
          '<div class="flex flex-wrap items-start justify-between gap-2">' +
          '<div><h3 class="font-semibold text-brand-900">' +
          esc(ev.title || 'Untitled') +
          '</h3>' +
          '<p class="text-xs text-slate-500 mt-1">' +
          (ev.organiser_name ? esc(ev.organiser_name) : 'No organiser linked') +
          (ev.starts_at ? ' · ' + esc(fmtTime(ev.starts_at)) : '') +
          '</p></div>' +
          (publicHref
            ? '<a href="' +
              attrEsc(publicHref) +
              '" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline shrink-0">View public</a>'
            : '') +
          '</div>' +
          '<form class="event-cleanup-form grid sm:grid-cols-2 gap-3" data-event-id="' +
          attrEsc(ev.id) +
          '">' +
          '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1">Title</label>' +
          '<input type="text" name="title" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
          attrEsc(ev.title || '') +
          '"></div>' +
          '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Organiser / group</label>' +
          '<select name="organiser_id" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
          organiserOptionsHtml(organisers, ev.organiser_id) +
          '</select></div>' +
          '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Event date</label>' +
          '<input type="datetime-local" name="starts_at" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
          attrEsc(toDatetimeLocalValue(ev.starts_at)) +
          '"></div>' +
          '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Status</label>' +
          '<select name="status" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
          eventStatusOptions(ev.status || 'draft') +
          '</select></div>' +
          '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Event type</label>' +
          '<select name="event_type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
          '<option value="">—</option>' +
          eventTypeOptions(ev.event_type) +
          '</select></div>' +
          '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Format</label>' +
          '<select name="meeting_type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
          '<option value="">—</option>' +
          meetingFormatOptions(ev.meeting_type) +
          '</select></div>' +
          '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1">Cover image URL</label>' +
          '<input type="url" name="photo_url" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
          attrEsc(ev.photo_url || '') +
          '" placeholder="https://…"></div>' +
          '<div class="sm:col-span-2 flex flex-wrap items-center gap-3">' +
          '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Save event</button>' +
          '<span class="event-cleanup-msg text-xs"></span></div></form></article>'
        );
      })
      .join('') +
      (eventCleanupState.hasMore
        ? '<div id="event-cleanup-sentinel" class="py-6 text-center">' +
          '<button type="button" id="event-cleanup-load-more" class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-slate-50">Load more events</button>' +
          '</div>'
        : '');
  }

  function renderEventCleanup() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<div id="event-cleanup-status" class="text-sm text-slate-500">Loading events…</div>' +
      '<div class="rounded-xl border border-brand-200 bg-brand-50/50 p-4 space-y-3">' +
      '<h3 class="font-semibold text-brand-900">Create event for a group</h3>' +
      '<p class="text-xs text-slate-600">Add another event under an existing organiser profile. It starts as a draft until you publish it.</p>' +
      '<form class="event-create-form grid sm:grid-cols-2 gap-3">' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1">Title</label>' +
      '<input type="text" name="title" required class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="Monthly networking breakfast"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Organiser / group</label>' +
      '<select name="organiser_id" required class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" id="event-create-organiser">' +
      '<option value="">— Choose organiser —</option></select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">First date (optional)</label>' +
      '<input type="datetime-local" name="starts_at" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Event type</label>' +
      '<select name="event_type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      eventTypeOptions('Networking meeting') +
      '</select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Format</label>' +
      '<select name="meeting_type" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      meetingFormatOptions('In person') +
      '</select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Status</label>' +
      '<select name="status" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm">' +
      eventStatusOptions('draft') +
      '</select></div>' +
      '<div class="sm:col-span-2 flex flex-wrap items-center gap-3">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Create event</button>' +
      '<span class="event-create-msg text-xs"></span></div></form></div>' +
      '<div class="admin-filter-bar flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">' +
      '<select id="event-cleanup-organiser" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:max-w-xs">' +
      '<option value="">All organisers</option></select>' +
      '<input type="search" id="event-cleanup-search" placeholder="Search events…" class="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full sm:max-w-xs bg-white" value="' +
      attrEsc(eventCleanupState.q) +
      '">' +
      '<label class="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">' +
      '<input type="checkbox" id="event-cleanup-unlinked" class="rounded border-slate-300"' +
      (eventCleanupState.unlinked ? ' checked' : '') +
      '> Unlinked only</label></div>' +
      '<div id="event-cleanup-list" class="space-y-3"></div></div>';

    refreshEventCleanupData();
  }

  var routes = {
    dashboard: renderDashboard,
    analytics: renderAnalytics,
    'event-health': renderEventHealth,
    'group-cleanup': renderGroupCleanup,
    'event-cleanup': renderEventCleanup,
    users: renderUsers,
    impersonate: renderImpersonate,
    moderation: renderModeration,
    financials: renderFinancials,
    sponsorship: renderSponsorship,
    emails: renderEmails,
  };

  function route() {
    var hash = (location.hash || '#dashboard').replace('#', '');
    if (!routes[hash]) hash = 'dashboard';
    setActiveNav(hash);
    try {
      routes[hash]();
    } catch (err) {
      if (main) {
        main.innerHTML =
          '<div class="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">' +
          '<p class="font-semibold">Could not open this admin page.</p>' +
          '<p class="text-sm mt-2">' +
          esc((err && err.message) || 'Unknown error') +
          '</p></div>';
      }
    }
  }

  function bindAdminMobileNav() {
    var toggle = document.getElementById('admin-nav-toggle');
    var sidebar = document.getElementById('admin-sidebar');
    var backdrop = document.getElementById('admin-sidebar-backdrop');
    if (!toggle || !sidebar) return;

    function closeNav() {
      sidebar.classList.remove('is-open');
      if (backdrop) backdrop.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open Command Center menu');
    }

    function openNav() {
      sidebar.classList.add('is-open');
      if (backdrop) backdrop.classList.remove('hidden');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close Command Center menu');
    }

    toggle.addEventListener('click', function () {
      if (sidebar.classList.contains('is-open')) closeNav();
      else openNav();
    });
    if (backdrop) backdrop.addEventListener('click', closeNav);
    document.querySelectorAll('.admin-nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.matchMedia('(max-width: 1023px)').matches) closeNav();
      });
    });
    window.addEventListener('resize', function () {
      if (window.matchMedia('(min-width: 1024px)').matches) closeNav();
    });
  }

  function boot(user) {
    currentUser = user;
    document.getElementById('sidebar-user').textContent = user.email;
    gate.classList.add('hidden');
    shell.classList.remove('hidden');
    document.body.classList.add('hub-admin-active');
    bindAdminLayoutSync();
    setTimeout(syncAdminLayoutOffset, 0);
    bindAdminMobileNav();
    bindEventHealthForms();
    bindGroupCleanupForms();
    bindEventCleanupForms();
    bindModerationActions();
    fetchEventHealth();
    route();
    window.addEventListener('hashchange', route);
  }

  document.querySelectorAll('[data-close-drawer]').forEach(function (el) {
    el.addEventListener('click', function () {
      document.getElementById('user-drawer').classList.add('hidden');
    });
  });

  document.getElementById('admin-signout').addEventListener('click', function () {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(function () {
      window.location.href = '../login.html';
    });
  });

  fetch('/api/auth/session', { credentials: 'include' })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (data.impersonating) {
        gate.innerHTML =
          '<div class="text-center max-w-md space-y-4">' +
          '<p class="text-slate-600">You are impersonating <strong>' +
          esc(data.user && data.user.email ? data.user.email : 'a user') +
          '</strong>. Stop impersonating to open the Command Center.</p>' +
          '<button type="button" id="admin-gate-stop-impersonate" class="inline-block rounded-lg bg-brand-700 text-white px-5 py-2.5 font-semibold">Stop impersonating</button>' +
          '<p><a href="../account/index.html" class="text-sm font-semibold text-brand-700">Continue as this user</a></p></div>';
        var stopBtn = document.getElementById('admin-gate-stop-impersonate');
        if (stopBtn) {
          stopBtn.addEventListener('click', function () {
            fetch('/api/auth/stop-impersonate', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
            })
              .then(function (res) {
                return res.json();
              })
              .then(function (result) {
                window.location.href = '../' + String(result.redirect || 'admin/index.html').replace(/^\//, '');
              });
          });
        }
        return;
      }
      if (!data.ok || !data.user || data.user.role !== 'admin') {
        gate.innerHTML =
          '<div class="text-center max-w-md"><p class="text-slate-600 mb-4">Admin access required. Sign in with an admin account.</p>' +
          '<a href="../login.html?next=/admin/index.html" class="inline-block rounded-lg bg-brand-700 text-white px-5 py-2.5 font-semibold">Sign in</a></div>';
        return;
      }
      boot(data.user);
    })
    .catch(function () {
      document.getElementById('admin-gate-msg').textContent = 'Could not verify session.';
    });
})();
