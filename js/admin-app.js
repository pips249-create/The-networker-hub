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
    cleanup: {
      title: 'Listing cleanup',
      subtitle: 'Fix group profiles, edit events, and resolve published event data issues',
    },
    'group-cleanup': {
      title: 'Listing cleanup',
      subtitle: 'Expand a row to edit website, logo and description — or fill from the group website',
    },
    'event-cleanup': {
      title: 'Listing cleanup',
      subtitle: 'Search and filter events, then expand a row to edit — built for large catalogues',
    },
    accounts: {
      title: 'Accounts',
      subtitle: 'Manage featured organisers and impersonate users for debugging',
    },
    email: {
      title: 'Email',
      subtitle: 'Bulk campaigns and transactional template copy',
    },
    impersonate: {
      title: 'Impersonate user',
      subtitle: 'Browse Supabase accounts and sign in as any non-admin user to debug on the Hub',
    },
    users: {
      title: 'Users & accounts',
      subtitle: 'Manage featured organiser status and open account details',
    },
    system: {
      title: 'System health',
      subtitle: 'Environment checks, Supabase connection, and go-live checklist',
    },
    featured: {
      title: 'Featured spotlight',
      subtitle: 'Choose which approved events appear in the Premium Spotlight carousel',
    },
    campaigns: {
      title: 'Email campaigns',
      subtitle: 'Send claim-profile invites and other bulk templates via Resend',
    },
    import: {
      title: 'Data import',
      subtitle: 'Upload CSV to add organisers or attendee records (no automatic emails)',
    },
    moderation: {
      title: 'Content moderation',
      subtitle: 'Approve or reject events, triage listing reports, and remove spam reviews',
    },
    financials: {
      title: 'Financial hub',
      subtitle: 'Payout queue, ticket revenue, and Stripe Connect status per organiser',
    },
    sponsorship: {
      title: 'Sponsorship & ads',
      subtitle: 'Choose an ad placement or the home page partners strip to edit',
    },
    emails: {
      title: 'Email templates',
      subtitle: 'Edit transactional copy in Supabase · test sends need Resend configured',
    },
  };

  var EVENT_TYPES = ['Meeting', 'Events', 'Exhibition', 'Awards'];
  var MEETING_FORMATS = ['In person', 'Online', 'Hybrid'];
  var healthCache = null;
  var adminMetricsCache = null;
  var adminNotificationsTimer = null;
  var groupCleanupCache = null;
  var eventCleanupCache = null;
  var analyticsState = { period: '30d' };
  var eventHealthState = { issueFilter: 'all' };
  var groupCleanupState = {
    page: 0,
    q: '',
    incomplete: false,
    total: 0,
    loading: false,
    selected: {},
    expanded: {},
    createOpen: false,
    focusOrganiserId: '',
  };
  var eventCleanupState = {
    organiserId: '',
    unlinked: false,
    noDate: false,
    status: '',
    approval: '',
    sort: 'recent',
    offset: 0,
    q: '',
    hasMore: false,
    total: 0,
    loading: false,
  };
  var GROUP_PAGE_SIZE = 30;
  var EVENT_PAGE_SIZE = 40;
  var eventOrganiserOptionsCache = null;
  var adminLogoPending = {};
  var groupSearchTimer = null;
  var eventSearchTimer = null;
  var eventLoadObserver = null;

  /** CMS ad placements — each maps to a cms_blocks.slot row. */
  var CMS_AD_SLOTS = [
    {
      key: 'events_sponsor_hub',
      group: 'Browse pages',
      label: 'Events browse — Hero Sponsor Hub',
      preview: 'hero',
      help: 'Hero Sponsor Hub on the Events browse page (/events/). Logo, tagline, and CTA only.',
      tagline: 'Example offer — edit to match your sponsor package',
      ctaLabel: 'Enquire now',
      ctaUrl: 'https://',
      ctaColor: '#2d2636',
    },
    {
      key: 'organisers_sponsor_hub',
      group: 'Browse pages',
      label: 'Organisers browse — Hero Sponsor Hub',
      preview: 'hero',
      help: 'Hero Sponsor Hub when visitors switch to Organisers on /events/. Separate from the Events browse ad.',
      tagline: 'Example offer — edit to match your sponsor package',
      ctaLabel: 'Enquire now',
      ctaUrl: 'https://',
      ctaColor: '#2d2636',
    },
    {
      key: 'opportunities_sponsor_hub',
      group: 'Browse pages',
      label: 'Opportunities browse — Hero Sponsor Hub',
      preview: 'hero',
      help: 'Hero Sponsor Hub on the Business opportunities browse page.',
      tagline: 'Example offer — edit to match your sponsor package',
      ctaLabel: 'Enquire now',
      ctaUrl: 'https://',
      ctaColor: '#2d2636',
    },
    {
      key: 'academy_sponsor_hub',
      group: 'Browse pages',
      label: 'Training browse — Hero Sponsor Hub',
      preview: 'hero',
      help: 'Hero Sponsor Hub on the training and workshops browse page.',
      tagline: 'Example offer — edit to match your sponsor package',
      ctaLabel: 'Enquire now',
      ctaUrl: 'https://',
      ctaColor: '#2d2636',
    },
    {
      key: 'booking_email_sponsor',
      group: 'Email',
      label: 'Booking confirmation email — Sponsor',
      preview: 'compact',
      help: 'Logo and website link in booking confirmation emails. Pull from Events browse sponsor or set your own.',
      tagline: '',
      ctaLabel: 'Visit website',
      ctaUrl: 'https://',
      ctaColor: '#2d2636',
    },
    {
      key: 'event_page_carousel_ads',
      group: 'Detail pages',
      label: 'Event & organiser pages — Mini Sponsors (5 slots)',
      preview: 'carousel',
      help: 'Up to five rotating Mini Sponsor logos in the sidebar on individual event and organiser profile pages — same inventory on both page types. Each logo links to the sponsor website.',
      tagline: '',
      ctaLabel: 'Enquire now',
      ctaUrl: 'https://',
      ctaColor: '#2d2636',
    },
    {
      key: 'organiser_page_sidebar_ad',
      group: 'Detail pages',
      label: 'Organiser page — Sidebar ad',
      preview: 'compact',
      help: 'Logo and CTA button on organiser profiles. Set the button link to the sponsor website.',
      tagline: '',
      ctaLabel: 'Enquire now',
      ctaUrl: 'https://',
      ctaColor: '#2d2636',
    },
    {
      key: 'opportunity_page_sidebar_ad',
      group: 'Detail pages',
      label: 'Opportunity page — Sidebar ad',
      preview: 'compact',
      help: 'Compact logo + CTA above the enquiry form on individual business opportunity pages (/opportunities/opportunity.html).',
      tagline: '',
      ctaLabel: 'Enquire now',
      ctaUrl: 'https://',
      ctaColor: '#2d2636',
    },
  ];

  function cmsSlotByKey(key) {
    for (var i = 0; i < CMS_AD_SLOTS.length; i++) {
      if (CMS_AD_SLOTS[i].key === key) return CMS_AD_SLOTS[i];
    }
    return CMS_AD_SLOTS[0];
  }

  function cmsSlotExists(key) {
    for (var i = 0; i < CMS_AD_SLOTS.length; i++) {
      if (CMS_AD_SLOTS[i].key === key && CMS_AD_SLOTS[i].preview !== 'carousel') return true;
    }
    return false;
  }

  function sponsorshipBackLinkHtml() {
    return (
      '<a href="#sponsorship" class="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-900 mb-4">' +
      '<span aria-hidden="true">←</span> All ad placements</a>'
    );
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

  function parseAdminHashQuery(fullHash) {
    var parts = String(fullHash || '').split('?');
    try {
      return new URLSearchParams(parts[1] || '');
    } catch (e) {
      return new URLSearchParams();
    }
  }

  function groupCleanupHref(organiserId) {
    return organiserId ? '#cleanup/groups?organiser=' + encodeURIComponent(organiserId) : '#cleanup/groups';
  }

  function focusOrganiserInGroupCleanup(organiserId) {
    var id = String(organiserId || '').trim();
    if (!id) return;
    groupCleanupState.focusOrganiserId = id;
    groupCleanupState.expanded[id] = true;
    var row = document.querySelector('[data-organiser-id-row="' + id + '"]');
    if (row && row.scrollIntoView) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function normalizeAdminHash(hash) {
    var h = String(hash || 'dashboard').replace(/^#/, '');
    var legacy = {
      'group-cleanup': 'cleanup/groups',
      'event-cleanup': 'cleanup/events',
      'event-health': 'cleanup/issues',
      campaigns: 'email/campaigns',
      emails: 'email/templates',
      impersonate: 'accounts/impersonate',
      users: 'accounts/users',
      import: 'moderation/import',
    };
    return legacy[h] || h;
  }

  function navRouteKey(hash) {
    var key = String(hash || '').split('/')[0];
    var parents = {
      'group-cleanup': 'cleanup',
      'event-cleanup': 'cleanup',
      'event-health': 'cleanup',
      campaigns: 'email',
      emails: 'email',
      impersonate: 'accounts',
      users: 'accounts',
      import: 'moderation',
    };
    return parents[key] || key;
  }

  function hubSubtitle(route, fullHash) {
    var hash = String(fullHash || '');
    if (route === 'cleanup') {
      if (hash.indexOf('issues') !== -1 || hash === 'event-health') {
        return PAGE_META['event-health'].subtitle;
      }
      if (hash.indexOf('events') !== -1 || hash === 'event-cleanup') {
        return PAGE_META['event-cleanup'].subtitle;
      }
      return PAGE_META['group-cleanup'].subtitle;
    }
    if (route === 'accounts') {
      return hash.indexOf('impersonate') !== -1
        ? PAGE_META.impersonate.subtitle
        : PAGE_META.users.subtitle;
    }
    if (route === 'email') {
      return hash.indexOf('templates') !== -1 ? PAGE_META.emails.subtitle : PAGE_META.campaigns.subtitle;
    }
    if (route === 'moderation' && hash.indexOf('import') !== -1) {
      return PAGE_META.import.subtitle;
    }
    return null;
  }

  function adminHubTabsHtml(tabs, activeKey) {
    return (
      '<nav class="admin-hub-tabs" aria-label="Section tabs">' +
      tabs
        .map(function (t) {
          var on = t.key === activeKey;
          return (
            '<a href="' +
            attrEsc(t.href) +
            '" class="admin-hub-tab' +
            (on ? ' is-active' : '') +
            '"' +
            (on ? ' aria-current="page"' : '') +
            '>' +
            esc(t.label) +
            (t.badgeHtml || '') +
            '</a>'
          );
        })
        .join('') +
      '</nav>'
    );
  }

  function withHubTabs(tabsHtml, renderFn) {
    var rootMain = main;
    rootMain.innerHTML = tabsHtml;
    var panel = document.createElement('div');
    panel.className = 'admin-hub-panel min-w-0';
    rootMain.appendChild(panel);
    main = panel;
    try {
      renderFn();
    } finally {
      main = rootMain;
    }
  }

  function setActiveNav(route, fullHash) {
    var navKey = navRouteKey(fullHash || route);
    document.querySelectorAll('.admin-nav-link').forEach(function (a) {
      var on = a.getAttribute('data-route') === navKey;
      a.classList.toggle('bg-white/15', on);
      a.classList.toggle('text-white', on);
      a.classList.toggle('text-white/80', !on);
    });
    var meta = PAGE_META[navKey] || PAGE_META[route] || PAGE_META.dashboard;
    var title = meta.title;
    var subtitle = hubSubtitle(navKey, fullHash) || meta.subtitle;
    if (route === 'sponsorship' && fullHash) {
      if (fullHash === 'sponsorship/home-partners') {
        title = 'Home page — Partners & sponsors';
        subtitle =
          'Logo strip on the home page. Add companies with logo, name, and CTA — shown when the section is active.';
      } else if (fullHash === 'sponsorship/event-page-carousel') {
        title = 'Event & organiser pages — Sponsor carousel (5 ads)';
        subtitle =
          'Manage up to five rotating sidebar logos on individual event and organiser profile pages. Each slot needs a logo and click-through link.';
      } else if (fullHash.indexOf('sponsorship/') === 0) {
        var slotKey = fullHash.slice('sponsorship/'.length);
        if (cmsSlotExists(slotKey)) {
          var slot = cmsSlotByKey(slotKey);
          title = slot.label;
          subtitle = slot.help;
        }
      }
    }
    document.getElementById('page-title').textContent = title;
    document.getElementById('page-subtitle').textContent = subtitle;
    syncAdminLayoutOffset();
  }

  function updateHealthBadge(count) {
    var badge = document.getElementById('admin-health-badge');
    if (!badge) return;
    var n = Number(count) || 0;
    if (n > 0) {
      badge.textContent = n > 99 ? '99+' : String(n);
      badge.classList.remove('hidden');
      badge.setAttribute('aria-label', n + ' items need attention');
    } else {
      badge.classList.add('hidden');
      badge.setAttribute('aria-label', 'No open admin alerts');
    }
  }

  function updateAdminDataBadge(updatedAt) {
    var badge = document.getElementById('admin-data-badge');
    if (!badge) return;
    badge.textContent = updatedAt ? 'Updated ' + fmtTime(updatedAt) : 'Supabase';
    badge.title = updatedAt
      ? 'Counts and alerts last refreshed at ' + fmtTime(updatedAt)
      : 'Counts and lists load from Supabase when you open each page';
  }

  function applyDashboardNotifications(data) {
    if (!data || data.error || data.configured === false) return;
    adminMetricsCache = data;
    updateAdminDataBadge(data.updatedAt);

    var alertsEl = document.getElementById('dashboard-alerts');
    if (alertsEl) {
      var alerts = data.alerts || [];
      alertsEl.innerHTML = alerts.length
        ? alerts.map(alertCard).join('')
        : '<p class="text-sm text-emerald-700">No critical alerts right now.</p>';
    }

    var attentionEl = document.getElementById('dashboard-attention');
    if (attentionEl) {
      attentionEl.innerHTML = renderAttentionQueue(data.attention);
    }

    var activityEl = document.getElementById('dashboard-activity');
    if (activityEl) {
      activityEl.innerHTML = renderActivityList(data.activity, 12);
    }

    var disputesEl = document.getElementById('group-claim-disputes') || document.getElementById('dashboard-disputes');
    if (disputesEl) {
      disputesEl.innerHTML = renderClaimDisputesPanel(data.attention);
      if (disputesEl.id === 'dashboard-disputes') {
        var disputesSection = document.getElementById('dashboard-disputes-section');
        if (disputesSection) {
          var hasDisputes = data.attention && data.attention.openClaimDisputes && data.attention.openClaimDisputes.length;
          disputesSection.hidden = !hasDisputes;
        }
      }
    }

    var notificationCount = Number(data.notificationCount);
    if (!notificationCount && data.alerts) notificationCount = data.alerts.length;
    var healthCount = healthCache && healthCache.count ? Number(healthCache.count) : 0;
    updateHealthBadge(Math.max(notificationCount || 0, healthCount));
  }

  function refreshAdminNotifications() {
    return Promise.all([adminGet('/api/admin/metrics'), fetchEventHealth()]).then(function (results) {
      applyDashboardNotifications(results[0]);
      return results[0];
    });
  }

  function startAdminNotificationsPolling() {
    if (adminNotificationsTimer) clearInterval(adminNotificationsTimer);
    adminNotificationsTimer = setInterval(refreshAdminNotifications, 60000);
  }

  function adminGet(url) {
    return fetch(url, { credentials: 'include', cache: 'no-store' })
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
    })
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

  function adminPatch(url, body) {
    return fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    })
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

  function renderClaimDisputesPanel(attention) {
    var disputes = (attention && attention.openClaimDisputes) || [];
    if (!disputes.length) {
      return '<p class="text-sm text-emerald-700">No open group profile disputes.</p>';
    }
    return (
      '<div class="space-y-3">' +
      disputes
        .map(function (d) {
          var profileEmail = d.profileEmail || '—';
          var reporterEmail = d.reporterEmail || '—';
          var emailsMatch =
            profileEmail !== '—' &&
            reporterEmail !== '—' &&
            String(profileEmail).toLowerCase() === String(reporterEmail).toLowerCase();
          return (
            '<div class="rounded-lg border border-red-200 bg-red-50 p-4">' +
            '<p class="font-semibold text-sm text-red-900">' +
            esc(d.organiserName || 'Group profile') +
            '</p>' +
            '<dl class="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-red-900/90">' +
            '<div><dt class="font-semibold">Profile email on file</dt><dd>' +
            esc(profileEmail) +
            '</dd></div>' +
            '<div><dt class="font-semibold">Signed-in user who disputed</dt><dd>' +
            esc(reporterEmail) +
            '</dd></div></dl>' +
            (emailsMatch
              ? '<p class="text-xs text-red-800/85 mt-2">This user was matched because their login email matches the profile. Clear the profile email so they are not prompted again, or delete the listing if it is wrong.</p>'
              : '<p class="text-xs text-red-800/85 mt-2">Review the profile — update the contact email, delete the listing if it is wrong, or mark resolved once handled.</p>') +
            (d.notes
              ? '<p class="text-xs text-red-800/80 mt-2 italic">“' + esc(d.notes) + '”</p>'
              : '') +
            '<div class="flex flex-wrap gap-2 mt-3">' +
            (d.organiserId
              ? '<a href="' +
                attrEsc(groupCleanupHref(d.organiserId)) +
                '" class="text-xs font-semibold rounded-lg bg-brand-700 text-white px-2.5 py-1 hover:bg-brand-900">Edit profile</a>'
              : '') +
            (d.organiserId
              ? '<button type="button" class="text-xs font-semibold rounded-lg bg-white border border-red-200 px-2.5 py-1 text-red-800 hover:bg-red-100" data-clear-dispute-email="' +
                attrEsc(d.id) +
                '" data-dispute-organiser-name="' +
                attrEsc(d.organiserName || 'this group') +
                '">Clear profile email</button>'
              : '') +
            (d.organiserId
              ? '<button type="button" class="text-xs font-semibold rounded-lg bg-white border border-red-300 px-2.5 py-1 text-red-900 hover:bg-red-100" data-dispute-delete-profile="' +
                attrEsc(d.id) +
                '" data-dispute-organiser-id="' +
                attrEsc(d.organiserId) +
                '" data-dispute-organiser-name="' +
                attrEsc(d.organiserName || 'this group') +
                '">Delete profile</button>'
              : '') +
            '<button type="button" class="text-xs font-semibold rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-slate-700 hover:bg-slate-100" data-resolve-claim-dispute="' +
            esc(d.id) +
            '">Mark resolved</button></div></div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderAttentionQueue(attention) {
    if (!attention) {
      return '<p class="text-sm text-slate-500">Loading…</p>';
    }
    var pending = attention.pendingEvents || [];
    var parts = [];

    if (attention.pendingOwnershipClaims > 0) {
      parts.push(
        '<div class="rounded-lg border border-brand-200 bg-brand-50 p-4">' +
          '<p class="font-semibold text-sm text-brand-900">' +
          attention.pendingOwnershipClaims +
          ' group profile' +
          (attention.pendingOwnershipClaims === 1 ? '' : 's') +
          ' awaiting organiser claim on first login</p>' +
          '<p class="text-xs text-brand-800/90 mt-1">Organisers will confirm ownership when they sign in — disputes appear here if they reject a match.</p></div>'
      );
    }

    if (attention.openListingReports > 0) {
      parts.push(
        '<div class="rounded-lg border border-amber-200 bg-amber-50 p-4">' +
          '<p class="font-semibold text-sm text-amber-900">' +
          attention.openListingReports +
          ' open listing report' +
          (attention.openListingReports === 1 ? '' : 's') +
          '</p>' +
          '<a href="#moderation" class="text-xs font-semibold text-amber-900 mt-2 inline-block hover:underline">Open moderation →</a></div>'
      );
    }

    if (pending.length) {
      parts.push(
        '<div class="rounded-lg border border-amber-200 bg-amber-50 p-4">' +
          '<p class="text-xs font-semibold uppercase tracking-wide text-amber-800/80">Pending approval queue</p>' +
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
        '<a href="#cleanup/groups" class="text-sm font-semibold text-brand-700 hover:underline">' +
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
    return fetch('/api/admin/event-health', { credentials: 'include', cache: 'no-store' })
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

  function mergeHealthCompletions(serverList) {
    var merged = [];
    var seen = {};
    (serverList || []).forEach(function (item) {
      var key = item.eventId || item.title;
      if (seen[key]) return;
      seen[key] = true;
      merged.push(item);
    });
    loadEventHealthHistory().forEach(function (item) {
      var key = item.eventId || item.title;
      if (seen[key]) return;
      seen[key] = true;
      merged.push(item);
    });
    return merged.slice(0, 15);
  }

  function renderEventHealthCompletedHtml(serverList) {
    var list = mergeHealthCompletions(serverList);
    if (!list.length) {
      return (
        '<section class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">' +
        '<h3 class="font-bold text-brand-900 text-sm">Recently completed</h3>' +
        '<p class="text-sm text-slate-500 mt-2">Fixes you save here will appear in this list (synced to Supabase when available).</p></section>'
      );
    }
    return (
      '<section class="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden">' +
      '<div class="px-4 py-3 border-b border-emerald-100 bg-emerald-50/80">' +
      '<h3 class="font-bold text-emerald-900 text-sm">Recently completed</h3>' +
      '<p class="text-xs text-emerald-800/80 mt-0.5">Events that passed the health scan after your last save.</p></div>' +
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

  function paintEventHealthCompleted(serverList) {
    var slot = document.getElementById('event-health-completed');
    if (slot) slot.innerHTML = renderEventHealthCompletedHtml(serverList);
  }

  function eventMatchesIssueFilter(ev, filter) {
    if (!filter || filter === 'all') return true;
    return issueCodes(ev).indexOf(filter) >= 0;
  }

  function logEventHealthCompletionRemote(beforeEv) {
    if (!beforeEv || !beforeEv.id) return Promise.resolve();
    return fetch('/api/admin/event-health', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: beforeEv.id,
        title: beforeEv.title || 'Untitled',
        slug: beforeEv.slug || '',
        fixed_issues: (beforeEv.issues || []).map(function (i) {
          return i.label;
        }),
      }),
    }).catch(function () {
      return null;
    });
  }

  function bulkAssignFirstOrganiser(events, organisers) {
    var sorted = organisers.slice().sort(function (a, b) {
      var aPub = a.listingStatus === 'published' ? 0 : 1;
      var bPub = b.listingStatus === 'published' ? 0 : 1;
      if (aPub !== bPub) return aPub - bPub;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    var firstId = sorted.length ? sorted[0].id : '';
    if (!firstId) {
      window.alert('No organisers available — create one first.');
      return;
    }
    var targets = (events || []).filter(function (ev) {
      var codes = issueCodes(ev);
      return codes.indexOf('missing_organiser') >= 0 || codes.indexOf('invalid_organiser') >= 0;
    });
    if (!targets.length) return;
    if (
      !window.confirm(
        'Assign "' +
          (sorted[0].name || 'first organiser') +
          '" to ' +
          targets.length +
          ' event' +
          (targets.length === 1 ? '' : 's') +
          ' missing an organiser?'
      )
    ) {
      return;
    }
    var chain = Promise.resolve();
    targets.forEach(function (ev) {
      chain = chain.then(function () {
        return fetch('/api/admin/events', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: ev.id, organiser_id: firstId }),
        }).then(function (r) {
          return r.json();
        });
      });
    });
    chain
      .then(function () {
        return fetchEventHealth();
      })
      .then(function () {
        renderEventHealth();
      })
      .catch(function (err) {
        window.alert(err.message || 'Bulk assign failed.');
      });
  }

  function issueCodes(ev) {
    return (ev.issues || []).map(function (i) {
      return i.code;
    });
  }

  function healthFieldVisibility(ev) {
    var codes = issueCodes(ev);
    return {
      showDate:
        codes.indexOf('missing_date') >= 0 || codes.indexOf('stale_past_date') >= 0,
      showOrganiser:
        codes.indexOf('missing_organiser') >= 0 || codes.indexOf('invalid_organiser') >= 0,
      showInvalidOrganiser: codes.indexOf('invalid_organiser') >= 0,
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
        if (beforeFix && data) {
          recordEventHealthCompletion(beforeFix, data);
          logEventHealthCompletionRemote(beforeFix);
        }
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
      var clearBtn = e.target.closest('[data-clear-broken-organiser]');
      if (clearBtn) {
        var eventId = clearBtn.getAttribute('data-clear-broken-organiser');
        if (!eventId) return;
        clearBtn.disabled = true;
        fetch('/api/admin/events', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: eventId, organiser_id: null }),
        })
          .then(function (r) {
            return r.json().then(function (body) {
              if (!r.ok || body.ok === false) {
                throw new Error(body.message || body.error || 'Could not unlink organiser');
              }
              return fetchEventHealth();
            });
          })
          .then(function () {
            renderEventHealth();
          })
          .catch(function (err) {
            clearBtn.disabled = false;
            window.alert(err.message || 'Could not unlink organiser');
          });
        return;
      }

      var purgeBtn = e.target.closest('[data-purge-gone-organiser]');
      if (purgeBtn) {
        var organiserId = purgeBtn.getAttribute('data-purge-gone-organiser');
        if (!organiserId) return;
        if (
          !window.confirm(
            'Clean up references to this deleted group profile?\n\nLinked events will be unlinked. This is safe if the networking group no longer exists on the Hub.'
          )
        ) {
          return;
        }
        purgeBtn.disabled = true;
        adminPost('/api/admin/organisers', { action: 'delete_groups', ids: [organiserId] })
          .then(function (data) {
            if (!data.ok) throw new Error(data.message || data.error || 'Cleanup failed');
            return fetchEventHealth();
          })
          .then(function () {
            renderEventHealth();
          })
          .catch(function (err) {
            purgeBtn.disabled = false;
            window.alert(err.message || 'Could not clean up profile references');
          });
        return;
      }

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
        refreshAdminNotifications();
      })
      .catch(function (err) {
        if (btn) btn.disabled = false;
        window.alert(err.message || 'Could not approve event.');
      });
  }

  function rejectPendingEvent(eventId, btn) {
    if (!eventId) return;
    if (btn) btn.disabled = true;
    adminPatch('/api/admin/moderation', { action: 'reject_event', id: eventId })
      .then(function (data) {
        if (!data || !data.ok) {
          throw new Error((data && data.message) || (data && data.error) || 'Reject failed');
        }
        renderModeration();
        refreshAdminNotifications();
      })
      .catch(function (err) {
        if (btn) btn.disabled = false;
        window.alert(err.message || 'Could not reject event.');
      });
  }

  function bindModerationActions() {
    if (!main || main.dataset.moderationBound) return;
    main.dataset.moderationBound = '1';
    main.addEventListener('click', function (e) {
      var approveBtn = e.target.closest('.moderation-approve-btn');
      if (approveBtn) {
        var approveId = approveBtn.getAttribute('data-event-id');
        if (!approveId) return;
        if (!window.confirm('Approve this event and publish it on the Hub?')) return;
        approvePendingEvent(approveId, approveBtn);
        return;
      }
      var rejectBtn = e.target.closest('.moderation-reject-btn');
      if (rejectBtn) {
        var rejectId = rejectBtn.getAttribute('data-event-id');
        if (!rejectId) return;
        if (!window.confirm('Reject this listing? The organiser will need to revise and resubmit.')) return;
        rejectPendingEvent(rejectId, rejectBtn);
        return;
      }
      var dismissBtn = e.target.closest('.moderation-dismiss-report-btn');
      if (dismissBtn) {
        var reportId = dismissBtn.getAttribute('data-report-id');
        if (!reportId) return;
        dismissBtn.disabled = true;
        adminPatch('/api/admin/moderation', { action: 'dismiss_report', id: reportId })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Dismiss failed');
            renderModeration();
            refreshAdminNotifications();
          })
          .catch(function (err) {
            dismissBtn.disabled = false;
            window.alert(err.message || 'Could not dismiss report.');
          });
        return;
      }
      var dismissReviewReportBtn = e.target.closest('.moderation-dismiss-review-report-btn');
      if (dismissReviewReportBtn) {
        var reviewReportId = dismissReviewReportBtn.getAttribute('data-review-report-id');
        if (!reviewReportId) return;
        dismissReviewReportBtn.disabled = true;
        adminPatch('/api/admin/moderation', { action: 'dismiss_review_report', id: reviewReportId })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Dismiss failed');
            renderModeration();
            refreshAdminNotifications();
          })
          .catch(function (err) {
            dismissReviewReportBtn.disabled = false;
            window.alert(err.message || 'Could not dismiss report.');
          });
        return;
      }
      var deleteReviewBtn = e.target.closest('.moderation-delete-review-btn');
      if (deleteReviewBtn) {
        var reviewId = deleteReviewBtn.getAttribute('data-review-id');
        if (!reviewId) return;
        if (!window.confirm('Permanently delete this review?')) return;
        deleteReviewBtn.disabled = true;
        adminPatch('/api/admin/moderation', { action: 'delete_review', id: reviewId })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Delete failed');
            renderModeration();
            refreshAdminNotifications();
          })
          .catch(function (err) {
            deleteReviewBtn.disabled = false;
            window.alert(err.message || 'Could not delete review.');
          });
      }
    });
  }

  function renderEventHealth() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<p class="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">Checks <strong>published</strong> events only. Listings awaiting approval are in <a href="#moderation" class="text-brand-700 font-semibold hover:underline">Content Moderation</a> — not here.</p>' +
      '<div id="event-health-status" class="text-sm text-slate-500">Scanning published events…</div>' +
      '<div id="event-health-summary" class="hidden admin-metric-grid admin-metric-grid--4"></div>' +
      '<div id="event-health-toolbar" class="hidden flex flex-wrap items-center gap-3"></div>' +
      '<div id="event-health-list" class="space-y-3"></div>' +
      '<div id="event-health-completed"></div></div>';

    fetchEventHealth().then(function (data) {
      var status = document.getElementById('event-health-status');
      var summary = document.getElementById('event-health-summary');
      var toolbar = document.getElementById('event-health-toolbar');
      var list = document.getElementById('event-health-list');
      if (!status || !summary || !list) return;

      paintEventHealthCompleted(data.recentCompletions || []);

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
        if (toolbar) {
          toolbar.classList.add('hidden');
          toolbar.innerHTML = '';
        }
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

      var issueFilterOptions = Object.keys(data.issuesByCode || {})
        .map(function (code) {
          var sample = { label: code, severity: 'low' };
          (data.events || []).some(function (ev) {
            var hit = (ev.issues || []).find(function (i) {
              return i.code === code;
            });
            if (hit) sample = hit;
            return !!hit;
          });
          return { code: code, label: sample.label };
        })
        .sort(function (a, b) {
          return String(a.label).localeCompare(String(b.label));
        });

      var needsOrganiserBulk = (data.events || []).filter(function (ev) {
        var codes = issueCodes(ev);
        return codes.indexOf('missing_organiser') >= 0 || codes.indexOf('invalid_organiser') >= 0;
      }).length;

      if (toolbar) {
        toolbar.classList.remove('hidden');
        toolbar.innerHTML =
          '<label class="text-xs font-semibold text-slate-500">Filter by issue ' +
          '<select id="event-health-filter" class="ml-2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white">' +
          '<option value="all">All issues</option>' +
          issueFilterOptions
            .map(function (opt) {
              return (
                '<option value="' +
                attrEsc(opt.code) +
                '"' +
                (eventHealthState.issueFilter === opt.code ? ' selected' : '') +
                '>' +
                esc(opt.label) +
                '</option>'
              );
            })
            .join('') +
          '</select></label>' +
          (needsOrganiserBulk > 1
            ? '<button type="button" id="event-health-bulk-organiser" class="rounded-lg border border-brand-200 bg-brand-50 text-brand-800 px-3 py-1.5 text-xs font-semibold hover:bg-brand-100">Assign first organiser to ' +
              needsOrganiserBulk +
              ' events</button>'
            : '');
        var filterEl = document.getElementById('event-health-filter');
        if (filterEl) {
          filterEl.addEventListener('change', function () {
            eventHealthState.issueFilter = filterEl.value || 'all';
            renderEventHealth();
          });
        }
        var bulkBtn = document.getElementById('event-health-bulk-organiser');
        if (bulkBtn) {
          bulkBtn.addEventListener('click', function () {
            bulkAssignFirstOrganiser(data.events || [], organisers);
          });
        }
      }

      var sortedOrganisers = organisers.slice().sort(function (a, b) {
        var aPub = a.listingStatus === 'published' ? 0 : 1;
        var bPub = b.listingStatus === 'published' ? 0 : 1;
        if (aPub !== bPub) return aPub - bPub;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
      var firstOrganiserId = sortedOrganisers.length ? sortedOrganisers[0].id : '';

      var sortedEvents = (data.events || [])
        .filter(function (ev) {
          return eventMatchesIssueFilter(ev, eventHealthState.issueFilter);
        })
        .slice()
        .sort(function (a, b) {
          var ra = eventSeverityRank(a);
          var rb = eventSeverityRank(b);
          if (ra !== rb) return ra - rb;
          return String(a.title || '').localeCompare(String(b.title || ''));
        });

      if (!sortedEvents.length) {
        list.innerHTML =
          '<p class="text-sm text-slate-500 rounded-lg border border-slate-200 bg-white p-4">No events match this filter.</p>';
        paintEventHealthCompleted(data.recentCompletions || []);
        return;
      }

      list.innerHTML = sortedEvents
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
              (fields.showInvalidOrganiser
                ? '<p class="text-xs text-amber-800 mb-2">This event points at a networking group profile that no longer exists. Unlink it here or assign a different group.</p>'
                : '') +
              '<select name="organiser_id" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white ring-2 ring-red-200">' +
              organiserOptionsHtml(organiserSelectList, ev.organiser_id) +
              '</select>' +
              (fields.showInvalidOrganiser
                ? '<button type="button" class="mt-2 mr-3 text-xs font-semibold text-red-700 hover:underline" data-clear-broken-organiser="' +
                  attrEsc(ev.id) +
                  '">Remove broken organiser link</button>' +
                  (ev.organiser_id
                    ? '<button type="button" class="mt-2 text-xs font-semibold text-red-700 hover:underline" data-purge-gone-organiser="' +
                      attrEsc(ev.organiser_id) +
                      '">Clean up deleted profile references</button>'
                    : '')
                : firstOrganiserId
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
                '<a href="#cleanup/groups" class="text-brand-700 font-semibold hover:underline">Listing cleanup</a>.</p></div>';
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
      paintEventHealthCompleted(data.recentCompletions || []);
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
      '<section class="space-y-3">' +
      '<h3 class="text-sm font-bold uppercase tracking-wide text-slate-500">Critical alerts</h3>' +
      '<div class="grid gap-3" id="dashboard-alerts"><p class="text-sm text-slate-500">Loading from Supabase…</p></div>' +
      '</section>' +
      '<section class="bg-white rounded-xl border border-red-200 p-5 shadow-sm space-y-3" id="dashboard-disputes-section" hidden>' +
      '<div><h3 class="font-bold text-brand-900">Group profile disputes</h3>' +
      '<p class="text-xs text-slate-500 mt-0.5">An organiser signed in and said a pre-imported profile is not theirs — use the actions below to fix or dismiss.</p></div>' +
      '<div id="dashboard-disputes"><p class="text-sm text-slate-500">Loading…</p></div></section>' +
      '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">' +
      '<div><h3 class="font-bold text-brand-900">Needs your attention</h3>' +
      '<p class="text-xs text-slate-500 mt-0.5">Queues and quick links — counts also appear in Critical alerts above.</p></div>' +
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
      var metricsEl = document.getElementById('dashboard-metrics');
      var preEl = document.getElementById('live-metrics');

      if (!data || data.error || data.configured === false) {
        var alertsEl = document.getElementById('dashboard-alerts');
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
            'Est. booking fees: ' + fmtMoney(m.fees || 0) + ' · Hub revenue from paid registrations',
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

      applyDashboardNotifications(data);

      if (preEl) preEl.innerHTML = renderMetricsSummary(data);
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

  function submitImpersonation(email, view) {
    var btn = document.getElementById('impersonate-submit');
    if (btn) btn.disabled = true;
    adminPost('/api/admin/impersonate', { email: email, view: view || 'account', provision: true })
      .then(function (data) {
        if (!data.ok) {
          window.alert(data.message || data.error || 'Could not impersonate user.');
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
        window.alert('Request failed. Try again.');
        if (btn) btn.disabled = false;
      });
  }

  function renderImpersonate() {
    var roleOpts = ['All', 'Admin', 'Organiser', 'Attendee'];
    main.innerHTML =
      '<div class="space-y-6 max-w-4xl">' +
      '<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">' +
      '<p class="font-semibold">Support &amp; debugging only</p>' +
      '<p class="mt-1 opacity-90">You will be signed in as the chosen user across the Hub. A banner lets you return to your admin account at any time. Admin accounts cannot be impersonated. Group profile emails without a login are created automatically (no email sent).</p>' +
      '</div>' +
      '<form id="impersonate-form" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">' +
      '<div><label class="text-xs font-semibold text-slate-500 uppercase" for="impersonate-email">User email</label>' +
      '<input type="email" id="impersonate-email" list="impersonate-email-list" required placeholder="user@company.com" autocomplete="off" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500">' +
      '<datalist id="impersonate-email-list"></datalist>' +
      '<p id="impersonate-user-hint" class="text-xs text-slate-500 mt-2">Enter any user or networking group email — group profiles get a silent login if needed.</p></div>' +
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
      '<div class="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">' +
      '<div><h3 class="text-sm font-bold text-slate-700">Browse accounts</h3>' +
      '<p class="text-xs text-slate-500 mt-0.5">Read-only directory from Supabase — click Impersonate on a row.</p></div>' +
      '<p id="impersonate-directory-status" class="text-xs text-slate-500">Loading…</p></div>' +
      '<div class="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-3 items-end">' +
      '<div class="flex-1 min-w-[200px]"><label class="text-xs font-semibold text-slate-500 uppercase">Search</label>' +
      '<input type="search" id="impersonate-directory-search" placeholder="Name or email…" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"></div>' +
      '<div><label class="text-xs font-semibold text-slate-500 uppercase">Role</label>' +
      '<select id="impersonate-directory-role" class="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">' +
      roleOpts.map(function (r) {
        return '<option>' + esc(r) + '</option>';
      }).join('') +
      '</select></div></div>' +
      adminTableScroll(
        '<table class="w-full text-sm text-left"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3">Name</th><th class="px-4 py-3">Email</th><th class="px-4 py-3">Role</th><th class="px-4 py-3">City</th><th class="px-4 py-3"></th></tr></thead>' +
          '<tbody id="impersonate-directory-body"><tr><td colspan="5" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '</div></div>';

    var form = document.getElementById('impersonate-form');
    var emailInput = document.getElementById('impersonate-email');
    var datalist = document.getElementById('impersonate-email-list');
    var directoryBody = document.getElementById('impersonate-directory-body');
    var directoryStatus = document.getElementById('impersonate-directory-status');
    var directorySearch = document.getElementById('impersonate-directory-search');
    var directoryRole = document.getElementById('impersonate-directory-role');
    var messageEl = document.getElementById('impersonate-message');
    var hintEl = document.getElementById('impersonate-user-hint');
    var impersonateView = document.getElementById('impersonate-view');

    function showImpersonateMessage(text, isError) {
      if (!messageEl) return;
      messageEl.textContent = text;
      messageEl.classList.remove('hidden', 'bg-red-50', 'text-red-800', 'bg-emerald-50', 'text-emerald-800');
      messageEl.classList.add(isError ? 'bg-red-50' : 'bg-emerald-50', isError ? 'text-red-800' : 'text-emerald-800');
    }

    function impersonateFromForm(email, view) {
      var btn = document.getElementById('impersonate-submit');
      if (btn) btn.disabled = true;
      showImpersonateMessage('Switching session…', false);
      adminPost('/api/admin/impersonate', { email: email, view: view, provision: true })
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

    function filterDirectoryUsers() {
      var q = (directorySearch && directorySearch.value || '').toLowerCase();
      var role = directoryRole ? directoryRole.value : 'All';
      return liveUsers.filter(function (u) {
        if (role !== 'All' && u.role !== role) return false;
        if (q && (u.name + u.email).toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
    }

    function paintDirectory() {
      if (!directoryBody) return;
      var rows = filterDirectoryUsers();
      if (!rows.length) {
        directoryBody.innerHTML =
          '<tr><td colspan="5" class="px-4 py-6 text-slate-500">No accounts match your filters.</td></tr>';
        return;
      }
      directoryBody.innerHTML = rows
        .map(function (u) {
          var canImpersonate = u.role !== 'Admin';
          return (
            '<tr class="border-t border-slate-100">' +
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
            '<td class="px-4 py-3 text-right">' +
            (canImpersonate
              ? '<button type="button" class="impersonate-directory-btn text-xs font-semibold text-brand-700 hover:underline" data-email="' +
                attrEsc(u.email) +
                '">Impersonate</button>'
              : '<span class="text-xs text-slate-400">Admin</span>') +
            '</td></tr>'
          );
        })
        .join('');
      directoryBody.querySelectorAll('.impersonate-directory-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var email = btn.getAttribute('data-email');
          if (emailInput) emailInput.value = email;
          if (email) submitImpersonation(email, impersonateView ? impersonateView.value : 'account');
        });
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
      if (directoryStatus) {
        directoryStatus.textContent =
          users.length + ' account' + (users.length === 1 ? '' : 's') + ' loaded';
      }
      paintDirectory();
    });

    if (directorySearch) directorySearch.addEventListener('input', paintDirectory);
    if (directoryRole) directoryRole.addEventListener('change', paintDirectory);

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = (emailInput && emailInput.value || '').trim();
        var view = document.getElementById('impersonate-view').value;
        if (!email) {
          showImpersonateMessage('Enter an email address.', true);
          return;
        }
        impersonateFromForm(email, view);
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
      '</dd></div>' +
      '<div class="flex justify-between gap-4"><dt class="text-slate-500 shrink-0">Emails</dt><dd class="font-medium text-right">' +
      (u.emailsEnabled === false ? 'Blocked' : 'Enabled') +
      '</dd></div></dl>' +
      (u.organiserId
        ? '<label class="flex items-center gap-2 text-sm mt-4 pt-4 border-t border-slate-100">' +
          '<input type="checkbox" id="drawer-featured-toggle" ' +
          (u.featured ? 'checked' : '') +
          ' /> Featured organiser (Spotlight)</label>'
        : '<p class="text-xs text-slate-500 border-t border-slate-100 pt-4">No organiser profile — featured status applies to group profiles only.</p>') +
      (u.role !== 'Admin'
        ? '<div class="border-t border-slate-100 pt-4 mt-4 space-y-2">' +
          '<p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email delivery</p>' +
          '<button type="button" class="w-full rounded-lg border border-slate-200 text-slate-800 py-2 text-sm font-semibold hover:bg-slate-50" id="drawer-toggle-emails">' +
          (u.emailsEnabled === false ? 'Enable emails for this user' : 'Block emails for this user') +
          '</button>' +
          '<p class="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2">Password support</p>' +
          '<button type="button" class="w-full rounded-lg border border-slate-200 text-slate-800 py-2 text-sm font-semibold hover:bg-slate-50" id="drawer-reset-link">Generate reset link</button>' +
          '<button type="button" class="w-full rounded-lg border border-slate-200 text-slate-800 py-2 text-sm font-semibold hover:bg-slate-50" id="drawer-temp-password">Set temporary password</button>' +
          '<p class="text-xs text-slate-500 hidden" id="drawer-password-result"></p></div>'
        : '');
    document.getElementById('user-drawer').classList.remove('hidden');
    var featuredToggle = document.getElementById('drawer-featured-toggle');
    if (featuredToggle && u.organiserId) {
      featuredToggle.addEventListener('change', function () {
        featuredToggle.disabled = true;
        adminPatch('/api/admin/users', {
          organiserId: u.organiserId,
          userId: u.id,
          featured: featuredToggle.checked,
        })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Update failed');
            u.featured = featuredToggle.checked;
            var idx = liveUsers.findIndex(function (x) {
              return x.id === u.id;
            });
            if (idx >= 0) liveUsers[idx].featured = u.featured;
          })
          .catch(function (err) {
            featuredToggle.checked = !featuredToggle.checked;
            window.alert(err.message || 'Could not update featured status.');
          })
          .finally(function () {
            featuredToggle.disabled = false;
          });
      });
    }
    var pwdResult = document.getElementById('drawer-password-result');
    function showPwdResult(text, isError) {
      if (!pwdResult) return;
      pwdResult.textContent = text;
      pwdResult.classList.remove('hidden', 'text-red-700', 'text-emerald-700');
      pwdResult.classList.add(isError ? 'text-red-700' : 'text-emerald-700');
    }
    var resetBtn = document.getElementById('drawer-reset-link');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetBtn.disabled = true;
        adminPost('/api/admin/users', { action: 'send_password_reset', email: u.email, userId: u.id })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Could not generate link');
            if (data.resetUrl) {
              showPwdResult('Reset link (copy): ' + data.resetUrl, false);
            } else {
              showPwdResult(data.message || 'Link generated.', false);
            }
          })
          .catch(function (err) {
            showPwdResult(err.message || 'Failed.', true);
          })
          .finally(function () {
            resetBtn.disabled = false;
          });
      });
    }
    var tempBtn = document.getElementById('drawer-temp-password');
    if (tempBtn) {
      tempBtn.addEventListener('click', function () {
        if (!window.confirm('Generate a new temporary password for ' + u.email + '?')) return;
        tempBtn.disabled = true;
        adminPost('/api/admin/users', { action: 'generate_temp_password', email: u.email, userId: u.id })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Failed');
            showPwdResult('Temporary password: ' + data.tempPassword + ' — share securely.', false);
          })
          .catch(function (err) {
            showPwdResult(err.message || 'Failed.', true);
          })
          .finally(function () {
            tempBtn.disabled = false;
          });
      });
    }
    var emailsBtn = document.getElementById('drawer-toggle-emails');
    if (emailsBtn) {
      emailsBtn.addEventListener('click', function () {
        var enable = u.emailsEnabled === false;
        if (
          !enable &&
          !window.confirm('Block emails for ' + u.email + '? They will not receive transactional mail until you enable it again.')
        ) {
          return;
        }
        emailsBtn.disabled = true;
        adminPost('/api/admin/users', {
          action: 'set_emails_enabled',
          userId: u.id,
          email: u.email,
          emails_enabled: enable,
        })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Update failed');
            u.emailsEnabled = enable;
            var idx = liveUsers.findIndex(function (x) {
              return x.id === u.id;
            });
            if (idx >= 0) liveUsers[idx].emailsEnabled = enable;
            openUserDrawer(u);
          })
          .catch(function (err) {
            window.alert(err.message || 'Could not update email setting.');
          })
          .finally(function () {
            emailsBtn.disabled = false;
          });
      });
    }
    var impersonateBtn = document.getElementById('drawer-impersonate');
    if (impersonateBtn) {
      impersonateBtn.addEventListener('click', function () {
        adminPost('/api/admin/impersonate', {
          email: u.email,
          view: u.role === 'Organiser' ? 'organiser' : 'account',
          provision: true,
        }).then(function (data) {
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
          '<td class="px-4 py-3 whitespace-nowrap">' +
          '<button type="button" class="moderation-approve-btn rounded-lg bg-brand-700 text-white px-2.5 py-1 text-xs font-semibold hover:bg-brand-900 disabled:opacity-50" data-event-id="' +
          attrEsc(l.id) +
          '">Approve</button> ' +
          '<button type="button" class="moderation-reject-btn rounded-lg border border-red-200 text-red-700 px-2.5 py-1 text-xs font-semibold hover:bg-red-50 disabled:opacity-50 ml-1" data-event-id="' +
          attrEsc(l.id) +
          '">Reject</button></td>'
        );
      }
      return (
        '<td class="px-4 py-3"><span class="text-xs text-amber-800">Awaiting approval</span></td>'
      );
    }
    if (l.status === 'Live') {
      return (
        '<td class="px-4 py-3"><a href="#cleanup/issues" class="text-brand-700 font-semibold text-xs hover:underline">Review data</a></td>'
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

  function reviewReportsHtml(reports) {
    if (!reports.length) {
      return '<p class="text-sm text-slate-500">No open review reports.</p>';
    }
    var reasonLabels = {
      fake_or_paid: 'Fake or paid',
      not_attendee: 'Not an attendee',
      misleading: 'Misleading',
      offensive: 'Offensive',
      spam: 'Spam',
      other: 'Other',
    };
    return reports
      .map(function (r) {
        return (
          '<div class="rounded-lg border border-violet-200 bg-violet-50/50 p-3 text-sm">' +
          '<div class="flex flex-wrap items-start justify-between gap-2">' +
          '<p class="font-semibold text-brand-900">Review report</p>' +
          '<time class="text-xs text-slate-400 shrink-0">' +
          esc(fmtTime(r.time)) +
          '</time></div>' +
          (r.snippet ? '<p class="text-xs text-slate-600 mt-1 italic">“' + esc(r.snippet) + '”</p>' : '') +
          '<p class="text-xs text-violet-900 mt-1">' +
          esc(reasonLabels[r.reason] || r.reason) +
          (r.reporterEmail ? ' · ' + esc(r.reporterEmail) : '') +
          '</p>' +
          (r.details ? '<p class="text-xs text-slate-600 mt-1">' + esc(r.details) + '</p>' : '') +
          '<button type="button" class="moderation-dismiss-review-report-btn mt-2 rounded-lg border border-slate-200 text-slate-700 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50" data-review-report-id="' +
          attrEsc(r.id) +
          '">Dismiss report</button></div>'
        );
      })
      .join('');
  }

  function listingReportsHtml(reports) {
    if (!reports.length) {
      return '<p class="text-sm text-slate-500">No open listing reports.</p>';
    }
    var reasonLabels = {
      misleading: 'Misleading',
      spam: 'Spam',
      wrong_details: 'Wrong details',
      offensive: 'Offensive',
      duplicate: 'Duplicate',
      other: 'Other',
    };
    return reports
      .map(function (r) {
        return (
          '<div class="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm">' +
          '<div class="flex flex-wrap items-start justify-between gap-2">' +
          '<p class="font-semibold text-brand-900">' +
          esc(r.title) +
          ' <span class="text-xs font-normal text-slate-500">(' +
          esc(r.listingType === 'organiser' ? 'Group' : 'Event') +
          ')</span></p>' +
          '<time class="text-xs text-slate-400 shrink-0">' +
          esc(fmtTime(r.time)) +
          '</time></div>' +
          '<p class="text-xs text-amber-900 mt-1">' +
          esc(reasonLabels[r.reason] || r.reason) +
          (r.reporterEmail ? ' · ' + esc(r.reporterEmail) : '') +
          '</p>' +
          (r.details ? '<p class="text-xs text-slate-600 mt-1">' + esc(r.details) + '</p>' : '') +
          '<button type="button" class="moderation-dismiss-report-btn mt-2 rounded-lg border border-slate-200 text-slate-700 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50" data-report-id="' +
          attrEsc(r.id) +
          '">Dismiss report</button></div>'
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
          '<button type="button" class="moderation-delete-review-btn mt-3 rounded-lg border border-red-200 text-red-700 px-2.5 py-1 text-xs font-semibold hover:bg-red-50 disabled:opacity-50" data-review-id="' +
          attrEsc(r.id) +
          '">Delete review</button></article>'
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
      '<p class="text-xs text-amber-800/80 mt-0.5">Events waiting for approval — approve to publish or reject to send back to the organiser.</p></div>' +
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
      '<div class="bg-white rounded-xl border border-amber-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-amber-900 mb-1">Listing reports</h3>' +
      '<p class="text-xs text-slate-500 mb-4">Submitted from event and group profile pages — dismiss when reviewed.</p>' +
      '<div class="space-y-3" id="moderation-reports">Loading…</div></div>' +
      '<div class="bg-white rounded-xl border border-violet-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-violet-900 mb-1">Review reports</h3>' +
      '<p class="text-xs text-slate-500 mb-4">Submitted from organiser profiles — dismiss when reviewed.</p>' +
      '<div class="space-y-3" id="moderation-review-reports">Loading…</div></div>' +
      '<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
      '<h3 class="font-bold text-brand-900 mb-1">Reviews</h3>' +
      '<p class="text-xs text-slate-500 mb-4">Spam-like reviews are highlighted — delete to remove from the site.</p>' +
      '<div class="space-y-3" id="moderation-reviews">Loading…</div></div></div>';

    adminGet('/api/admin/moderation').then(function (data) {
      var status = document.getElementById('moderation-status');
      var pendingEl = document.getElementById('moderation-pending');
      var pendingPanel = document.getElementById('moderation-pending-panel');
      var listingsEl = document.getElementById('moderation-listings');
      var reviewsEl = document.getElementById('moderation-reviews');
      var reportsEl = document.getElementById('moderation-reports');
      var reviewReportsEl = document.getElementById('moderation-review-reports');
      if (!data || data.error || data.configured === false) {
        liveListings = [];
        liveReviews = [];
        if (status) status.textContent = 'Could not load moderation data from Supabase.';
        if (pendingEl) pendingEl.innerHTML = listingsTableHtml([], 'Could not load pending events.');
        if (listingsEl) listingsEl.innerHTML = listingsTableHtml([]);
        if (reviewsEl) reviewsEl.innerHTML = reviewsHtml([]);
        if (reportsEl) reportsEl.innerHTML = listingReportsHtml([]);
        if (reviewReportsEl) reviewReportsEl.innerHTML = reviewReportsHtml([]);
        return;
      }
      liveListings = data.listings || [];
      liveReviews = data.reviews || [];
      var listingReports = data.listingReports || [];
      var reviewReports = data.reviewReports || [];
      var pendingListings = data.pendingListings || liveListings.filter(function (l) {
        return l.status === 'Pending' || l.pending;
      });
      if (status) {
        status.textContent =
          liveListings.length +
          ' events · ' +
          pendingListings.length +
          ' pending · ' +
          listingReports.length +
          ' listing reports · ' +
          reviewReports.length +
          ' review reports · ' +
          liveReviews.length +
          ' reviews from Supabase';
      }
      if (reportsEl) reportsEl.innerHTML = listingReportsHtml(listingReports);
      if (reviewReportsEl) reviewReportsEl.innerHTML = reviewReportsHtml(reviewReports);
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
      '<section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">' +
      '<div class="px-4 py-3 border-b border-slate-100"><h3 class="font-bold text-brand-900">Payout queue</h3>' +
      '<p class="text-xs text-slate-500 mt-0.5">Organiser payout requests from the dashboard — approve then mark paid after transfer.</p></div>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3 text-left">Event</th><th class="px-4 py-3">Organiser</th><th class="px-4 py-3">Net</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Requested</th><th class="px-4 py-3"></th></tr></thead>' +
          '<tbody id="financials-queue"><tr><td colspan="6" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '</section>' +
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
      var queue = data.payoutQueue || [];
      var queueEl = document.getElementById('financials-queue');

      if (status) {
        status.textContent =
          queue.length +
          ' payout request' +
          (queue.length === 1 ? '' : 's') +
          ' · ' +
          stripe.length +
          ' organiser' +
          (stripe.length === 1 ? '' : 's') +
          ' · registration log from Supabase';
      }

      if (queueEl) {
        queueEl.innerHTML = queue.length
          ? queue
              .map(function (p) {
                var statusCls =
                  p.status === 'paid'
                    ? 'text-emerald-700 bg-emerald-50'
                    : p.status === 'pending_review'
                      ? 'text-amber-800 bg-amber-50'
                      : 'text-slate-700 bg-slate-100';
                var actions = '';
                if (p.status === 'pending_review') {
                  actions =
                    '<button type="button" class="payout-status-btn rounded-lg bg-brand-700 text-white px-2 py-1 text-xs font-semibold" data-payout-id="' +
                    attrEsc(p.id) +
                    '" data-payout-status="approved">Approve</button>';
                } else if (p.status === 'approved') {
                  actions =
                    '<button type="button" class="payout-status-btn rounded-lg bg-emerald-700 text-white px-2 py-1 text-xs font-semibold" data-payout-id="' +
                    attrEsc(p.id) +
                    '" data-payout-status="paid">Mark paid</button>';
                } else {
                  actions = '<span class="text-xs text-slate-400">—</span>';
                }
                return (
                  '<tr class="border-t border-slate-100">' +
                  '<td class="px-4 py-3 font-medium">' +
                  esc(p.eventTitle) +
                  '</td>' +
                  '<td class="px-4 py-3">' +
                  esc(p.organiser) +
                  '</td>' +
                  '<td class="px-4 py-3">' +
                  esc(p.amount) +
                  '</td>' +
                  '<td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-0.5 rounded ' +
                  statusCls +
                  '">' +
                  esc(p.statusLabel) +
                  '</span></td>' +
                  '<td class="px-4 py-3 text-xs text-slate-500">' +
                  esc(fmtTime(p.requestedAt)) +
                  '</td>' +
                  '<td class="px-4 py-3 whitespace-nowrap">' +
                  actions +
                  '</td></tr>'
                );
              })
              .join('')
          : '<tr><td colspan="6" class="px-4 py-6 text-slate-500">No payout requests yet.</td></tr>';
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

  function sponsorPreviewLogoHtml(logoUrl, compact) {
    var bandClass =
      'sponsor-preview-logo-band' +
      (compact ? ' sponsor-preview-logo-band--compact' : ' sponsor-preview-logo-band--hero mb-3');
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
    var ctaLabel = document.getElementById('sponsor-cta-label');
    var ctaUrl = document.getElementById('sponsor-cta-url');
    var active = document.getElementById('sponsor-active');
    var savedColor =
      window.CmsSponsorFields && window.CmsSponsorFields.ctaColor
        ? window.CmsSponsorFields.ctaColor(block)
        : String(block.cta_color || '').trim();

    if (company) company.value = String(block.company_name || '').trim();
    if (logoUrl) {
      logoUrl.value = String(block.logo_url || block.image_url || '').trim();
    }
    if (tagline) tagline.value = sponsorTaglineFromBlock(block);
    if (ctaLabel && block.cta_label) ctaLabel.value = block.cta_label;
    if (ctaUrl && block.cta_url) ctaUrl.value = block.cta_url;
    if (active) active.checked = block.active !== false;
    setSponsorCtaColorFields(savedColor);
  }

  function defaultSponsorCtaColor() {
    if (window.CmsSponsorFields && window.CmsSponsorFields.DEFAULT_CTA_COLOR) {
      return window.CmsSponsorFields.DEFAULT_CTA_COLOR;
    }
    return '#2d2636';
  }

  function setSponsorCtaColorFields(color) {
    var picker = document.getElementById('sponsor-cta-color');
    var hex = document.getElementById('sponsor-cta-color-hex');
    var safe =
      window.CmsSponsorFields && window.CmsSponsorFields.sanitizeCtaColor
        ? window.CmsSponsorFields.sanitizeCtaColor(color)
        : '';
    if (!safe) safe = defaultSponsorCtaColor();
    if (picker) picker.value = safe;
    if (hex) hex.value = safe;
  }

  function readSponsorCtaColor() {
    var hex = document.getElementById('sponsor-cta-color-hex');
    var picker = document.getElementById('sponsor-cta-color');
    var raw = hex ? hex.value.trim() : picker ? picker.value : '';
    if (window.CmsSponsorFields && window.CmsSponsorFields.sanitizeCtaColor) {
      return window.CmsSponsorFields.sanitizeCtaColor(raw) || defaultSponsorCtaColor();
    }
    return defaultSponsorCtaColor();
  }

  function renderSponsorship(fullHash) {
    var hash = String(fullHash || 'sponsorship');
    if (hash === 'sponsorship/home-partners') {
      renderHomePartnersPage();
      return;
    }
    if (hash === 'sponsorship/event-page-carousel') {
      renderEventCarouselPage();
      return;
    }
    if (hash.indexOf('sponsorship/') === 0) {
      var slotKey = hash.slice('sponsorship/'.length);
      if (slotKey === 'event_page_carousel_ads') {
        renderEventCarouselPage();
        return;
      }
      if (cmsSlotExists(slotKey)) {
        renderSponsorshipSlot(slotKey);
        return;
      }
    }
    renderSponsorshipPicker();
  }

  function sponsorSlotStatusBadge(block) {
    if (!block) {
      return '<span class="admin-ad-picker-badge admin-ad-picker-badge--empty">Not set yet</span>';
    }
    if (block.active === false) {
      return '<span class="admin-ad-picker-badge admin-ad-picker-badge--hidden">Hidden</span>';
    }
    return '<span class="admin-ad-picker-badge admin-ad-picker-badge--live">Live</span>';
  }

  function renderSponsorshipPicker() {
    var groups = [];
    var groupMap = {};
    CMS_AD_SLOTS.forEach(function (slot) {
      var groupName = slot.group || 'Other placements';
      if (!groupMap[groupName]) {
        groupMap[groupName] = [];
        groups.push(groupName);
      }
      groupMap[groupName].push(slot);
    });

    var groupsHtml = groups
      .map(function (groupName) {
        return (
          '<section class="admin-ad-picker-group">' +
          '<h3 class="admin-ad-picker-group-title">' +
          esc(groupName) +
          '</h3>' +
          '<div class="admin-ad-picker-grid">' +
          groupMap[groupName]
            .map(function (slot) {
              if (slot.preview === 'carousel') {
                return (
                  '<a href="#sponsorship/event-page-carousel" class="admin-ad-picker-card admin-ad-picker-card--carousel">' +
                  '<div class="admin-ad-picker-card-head">' +
                  '<span class="admin-ad-picker-type">Carousel</span>' +
                  '<span class="admin-ad-picker-status" id="event-carousel-picker-status">…</span>' +
                  '</div>' +
                  '<p class="admin-ad-picker-label">' +
                  esc(slot.label) +
                  '</p>' +
                  '<p class="admin-ad-picker-help">' +
                  esc(slot.help) +
                  '</p>' +
                  '<span class="admin-ad-picker-action">Edit carousel →</span>' +
                  '</a>'
                );
              }
              var typeLabel = slot.preview === 'compact' ? 'Sidebar ad' : 'Hero Sponsor Hub';
              return (
                '<a href="#sponsorship/' +
                esc(slot.key) +
                '" class="admin-ad-picker-card" data-ad-slot="' +
                attrEsc(slot.key) +
                '">' +
                '<div class="admin-ad-picker-card-head">' +
                '<span class="admin-ad-picker-type">' +
                esc(typeLabel) +
                '</span>' +
                '<span class="admin-ad-picker-status" data-ad-status="' +
                attrEsc(slot.key) +
                '">…</span>' +
                '</div>' +
                '<p class="admin-ad-picker-label">' +
                esc(slot.label) +
                '</p>' +
                '<p class="admin-ad-picker-help">' +
                esc(slot.help) +
                '</p>' +
                '<span class="admin-ad-picker-action">Edit placement →</span>' +
                '</a>'
              );
            })
            .join('') +
          '</div></section>'
        );
      })
      .join('');

    main.innerHTML =
      '<div class="space-y-8">' +
      '<p id="sponsor-picker-status" class="text-sm text-slate-500">Loading ad statuses…</p>' +
      groupsHtml +
      '<section class="admin-ad-picker-group">' +
      '<h3 class="admin-ad-picker-group-title">Home page</h3>' +
      '<div class="admin-ad-picker-grid admin-ad-picker-grid--single">' +
      '<a href="#sponsorship/home-partners" class="admin-ad-picker-card admin-ad-picker-card--partners">' +
      '<div class="admin-ad-picker-card-head">' +
      '<span class="admin-ad-picker-type">Logo strip</span>' +
      '<span class="admin-ad-picker-status" id="home-partners-picker-status">…</span>' +
      '</div>' +
      '<p class="admin-ad-picker-label">Home page — Partners &amp; sponsors</p>' +
      '<p class="admin-ad-picker-help">Multiple company logos with links — shown in the partners section on the home page.</p>' +
      '<span class="admin-ad-picker-action">Edit partners →</span>' +
      '</a></div></section></div>';

    var statusEl = document.getElementById('sponsor-picker-status');
    function setPickerStatus(text, tone) {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.className =
        'text-sm ' +
        (tone === 'error'
          ? 'text-red-700 font-semibold'
          : tone === 'ok'
            ? 'text-emerald-700 font-semibold'
            : 'text-slate-500');
    }

    var slotLoads = CMS_AD_SLOTS.filter(function (slot) {
      return slot.preview !== 'carousel';
    }).map(function (slot) {
      return adminGet('/api/admin/sponsor?slot=' + encodeURIComponent(slot.key))
        .then(function (data) {
          return { slot: slot.key, data: data };
        })
        .catch(function () {
          return { slot: slot.key, data: null };
        });
    });

    Promise.all(slotLoads)
      .then(function (results) {
        results.forEach(function (row) {
          var el = document.querySelector('[data-ad-status="' + row.slot + '"]');
          if (!el) return;
          if (!row.data || row.data.error) {
            el.innerHTML =
              '<span class="admin-ad-picker-badge admin-ad-picker-badge--error">Could not load</span>';
            return;
          }
          el.innerHTML = sponsorSlotStatusBadge(row.data.block);
        });
        setPickerStatus('Select a placement below to edit its creative.', 'ok');
      })
      .catch(function () {
        setPickerStatus('Could not load ad statuses — you can still open a placement to edit.', 'error');
      });

    adminGet('/api/admin/home-partners')
      .then(function (data) {
        var el = document.getElementById('home-partners-picker-status');
        if (!el) return;
        if (!data || data.error || data.configured === false) {
          el.innerHTML =
            '<span class="admin-ad-picker-badge admin-ad-picker-badge--error">Could not load</span>';
          return;
        }
        var partners = Array.isArray(data.partners) ? data.partners : [];
        var activeCount = partners.filter(function (p) {
          return p.active !== false;
        }).length;
        if (data.active === false) {
          el.innerHTML = '<span class="admin-ad-picker-badge admin-ad-picker-badge--hidden">Hidden</span>';
        } else if (activeCount) {
          el.innerHTML =
            '<span class="admin-ad-picker-badge admin-ad-picker-badge--live">' +
            activeCount +
            ' live</span>';
        } else {
          el.innerHTML = '<span class="admin-ad-picker-badge admin-ad-picker-badge--empty">Not set yet</span>';
        }
      })
      .catch(function () {
        var el = document.getElementById('home-partners-picker-status');
        if (el) {
          el.innerHTML =
            '<span class="admin-ad-picker-badge admin-ad-picker-badge--error">Could not load</span>';
        }
      });

    adminGet('/api/admin/event-carousel')
      .then(function (data) {
        var el = document.getElementById('event-carousel-picker-status');
        if (!el) return;
        if (!data || data.error || data.configured === false) {
          el.innerHTML =
            '<span class="admin-ad-picker-badge admin-ad-picker-badge--error">Could not load</span>';
          return;
        }
        var ads = Array.isArray(data.ads) ? data.ads : [];
        var activeCount = ads.filter(function (ad) {
          return ad.active !== false && ad.logo_url && ad.cta_url;
        }).length;
        if (data.active === false) {
          el.innerHTML = '<span class="admin-ad-picker-badge admin-ad-picker-badge--hidden">Hidden</span>';
        } else if (activeCount) {
          el.innerHTML =
            '<span class="admin-ad-picker-badge admin-ad-picker-badge--live">' +
            activeCount +
            ' live</span>';
        } else {
          el.innerHTML = '<span class="admin-ad-picker-badge admin-ad-picker-badge--empty">Not set yet</span>';
        }
      })
      .catch(function () {
        var el = document.getElementById('event-carousel-picker-status');
        if (el) {
          el.innerHTML =
            '<span class="admin-ad-picker-badge admin-ad-picker-badge--error">Could not load</span>';
        }
      });
  }

  function renderHomePartnersPage() {
    main.innerHTML =
      '<div class="space-y-6 max-w-3xl">' +
      sponsorshipBackLinkHtml() +
      '<section class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5" id="home-partners-admin">' +
      '<div class="flex flex-wrap items-start justify-between gap-3">' +
      '<div><h3 class="font-bold text-brand-900">Home page — Partners &amp; sponsors</h3>' +
      '<p class="text-xs text-slate-500 mt-1">Logo strip on the home page. Add companies with logo, name, and CTA — shown when the section is active.</p></div>' +
      '<label class="flex items-center gap-2 text-sm text-slate-700 shrink-0">' +
      '<input type="checkbox" id="home-partners-active" class="rounded border-slate-300" checked> ' +
      'Show on home page</label></div>' +
      '<div id="home-partners-list" class="space-y-4 min-w-0"></div>' +
      '<div class="flex flex-wrap gap-3">' +
      '<button type="button" id="home-partners-add" class="rounded-lg border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50">+ Add company</button>' +
      '<button type="button" id="home-partners-save" class="rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900">Save partners</button>' +
      '</div>' +
      '<p id="home-partners-status" class="text-sm text-slate-500"></p></section></div>';
    initHomePartnersAdmin();
  }

  function renderSponsorshipSlot(currentSlotKey) {
    var sponsorLogoBase64 = null;
    var sponsorLogoMime = '';
    var sponsorLogoFilename = '';

    function slotDefaults() {
      return cmsSlotByKey(currentSlotKey);
    }

    function applyDefaultsToForm() {
      var d = slotDefaults();
      var company = document.getElementById('sponsor-company');
      var logoUrl = document.getElementById('sponsor-logo-url');
      var tagline = document.getElementById('sponsor-tagline');
      var ctaLabel = document.getElementById('sponsor-cta-label');
      var ctaUrl = document.getElementById('sponsor-cta-url');
      var active = document.getElementById('sponsor-active');
      var previewHint = document.getElementById('sponsor-preview-hint');
      if (company) company.value = '';
      if (logoUrl) logoUrl.value = '';
      if (tagline) tagline.value = d.tagline;
      if (ctaLabel) ctaLabel.value = d.ctaLabel;
      if (ctaUrl) ctaUrl.value = d.ctaUrl;
      setSponsorCtaColorFields(d.ctaColor || defaultSponsorCtaColor());
      if (active) active.checked = true;
      if (previewHint) {
        previewHint.textContent =
          d.preview === 'compact'
            ? 'Logo centred above the button, as on event and organiser detail pages.'
            : 'Logo, tagline, and CTA — matches the browse page hero Sponsor Hub block.';
      }
      sponsorLogoBase64 = null;
      sponsorLogoMime = '';
      sponsorLogoFilename = '';
      var fileInput = document.getElementById('sponsor-logo-file');
      if (fileInput) fileInput.value = '';
    }

    main.innerHTML =
      '<div class="space-y-6">' +
      sponsorshipBackLinkHtml() +
      '<p id="sponsor-status" class="text-sm text-slate-500">Loading ad placement from Supabase…</p>' +
      '<div class="grid lg:grid-cols-2 gap-6 min-w-0">' +
      '<form id="sponsor-form" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5 min-w-0">' +
      '<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">' +
      esc(slotDefaults().label) +
      '</p>' +
      '<label class="flex items-center gap-2 text-sm text-slate-700">' +
      '<input type="checkbox" id="sponsor-active" class="rounded border-slate-300" checked> ' +
      'Ad active (uncheck to hide this placement on site)</label>' +
      '<div id="sponsor-hero-fields" class="space-y-5">' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-company">Company name</label>' +
      '<input type="text" id="sponsor-company" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Acme Ltd"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-tagline">Tagline / offer</label>' +
      '<input type="text" id="sponsor-tagline" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
      esc(slotDefaults().tagline) +
      '"></div></div>' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-logo-url">Company logo URL</label>' +
      '<input type="text" id="sponsor-logo-url" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-2" placeholder="https://…">' +
      '<label class="block text-xs text-slate-500 mb-1" for="sponsor-logo-file">Or upload logo (max 2MB, wide format recommended)</label>' +
      '<input type="file" id="sponsor-logo-file" accept="image/png,image/jpeg,image/webp,image/gif" class="block w-full text-sm text-slate-600"></div>' +
      '<div class="grid sm:grid-cols-2 gap-4">' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-cta-label">CTA button label</label>' +
      '<input type="text" id="sponsor-cta-label" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
      esc(slotDefaults().ctaLabel) +
      '"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-cta-color">CTA button colour</label>' +
      '<div class="flex items-center gap-2">' +
      '<input type="color" id="sponsor-cta-color" class="h-10 w-14 rounded border border-slate-200 cursor-pointer bg-white p-1" value="' +
      esc(slotDefaults().ctaColor || defaultSponsorCtaColor()) +
      '" title="Pick CTA button colour">' +
      '<input type="text" id="sponsor-cta-color-hex" class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono" value="' +
      esc(slotDefaults().ctaColor || defaultSponsorCtaColor()) +
      '" placeholder="#2d2636" maxlength="7" spellcheck="false">' +
      '</div></div></div>' +
      '<div><label id="sponsor-cta-url-label" class="block text-xs font-semibold text-slate-600 mb-1" for="sponsor-cta-url">CTA link (https:// opens in a new tab, or mailto:)</label>' +
      '<input type="text" id="sponsor-cta-url" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
      esc(slotDefaults().ctaUrl) +
      '"></div>' +
      '<div class="flex flex-wrap gap-3 pt-2">' +
      '<button type="button" id="sponsor-preview-btn" class="rounded-lg border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Update preview</button>' +
      '<button type="button" id="sponsor-publish-btn" class="rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900">Publish to site</button>' +
      '</div></form>' +
      '<section class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 min-w-0">' +
      '<h3 class="font-bold text-brand-900 mb-1">Preview</h3>' +
      '<p id="sponsor-preview-hint" class="text-xs text-slate-500 mb-4">Logo, tagline, and CTA — matches the browse page hero Sponsor Hub block.</p>' +
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
      var activeEl = document.getElementById('sponsor-active');
      var logoUrl = document.getElementById('sponsor-logo-url').value.trim();
      if (sponsorLogoBase64) logoUrl = sponsorLogoBase64;
      return {
        active: activeEl ? activeEl.checked : true,
        companyName: document.getElementById('sponsor-company').value.trim(),
        logoUrl: logoUrl,
        tagline: document.getElementById('sponsor-tagline').value.trim(),
        ctaLabel: document.getElementById('sponsor-cta-label').value.trim() || d.ctaLabel,
        ctaColor: readSponsorCtaColor(),
        ctaUrl: document.getElementById('sponsor-cta-url').value.trim() || d.ctaUrl,
      };
    }

    function applyPreviewCtaColor(root, color) {
      if (!root || !window.CmsSponsorFields) return;
      var cta = root.querySelector('[data-sponsor-preview-cta]');
      if (cta) window.CmsSponsorFields.applyCtaColor(cta, color);
    }

    function syncSlotFormLayout() {
      var slot = slotDefaults();
      var heroFields = document.getElementById('sponsor-hero-fields');
      var ctaUrlLabel = document.getElementById('sponsor-cta-url-label');
      var previewHint = document.getElementById('sponsor-preview-hint');
      if (heroFields) heroFields.hidden = slot.preview === 'compact';
      if (ctaUrlLabel) {
        ctaUrlLabel.textContent =
          slot.preview === 'compact'
            ? 'Sponsor website URL (https:// — opens in a new tab)'
            : 'CTA link (https:// opens in a new tab, or mailto:)';
      }
      if (previewHint) {
        previewHint.textContent =
          slot.preview === 'compact'
            ? 'Logo centred above the button — matches ' + slot.label.toLowerCase() + '.'
            : 'Logo, tagline, and CTA — matches ' + slot.label.toLowerCase() + '.';
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
              '<p class="text-base font-extrabold mb-4">Your brand here</p>' +
              '<span class="inline-block rounded-lg border border-[#c9a8d8] text-[#5b2f99] text-sm font-bold px-4 py-2">Find out more →</span></div>';
        return;
      }

      var taglineHtml = sponsorHeadlineHtml(creative.tagline);
      var hasLogo = /^(https?:|\/|data:image\/)/i.test(String(creative.logoUrl || '').trim());

      if (slot.preview === 'compact') {
        el.innerHTML =
          '<aside class="relative rounded-xl border border-slate-200 bg-white p-4 pt-8 shadow-sm max-w-xs flex flex-col gap-3">' +
          '<span class="absolute top-3 right-3 text-[8px] font-bold uppercase tracking-wider text-slate-500">Sponsored</span>' +
          sponsorPreviewLogoHtml(creative.logoUrl, true) +
          '<span data-sponsor-preview-cta class="inline-block w-full text-center rounded-lg bg-[#2d2636] text-white text-xs font-bold px-3 py-2.5">' +
          esc(creative.ctaLabel) +
          '</span></aside>';
        applyPreviewCtaColor(el, creative.ctaColor);
        return;
      }

      el.innerHTML =
        '<aside class="relative rounded-xl border border-[#c9a8d8] bg-white p-5 text-[#2d1b3d] max-w-md shadow-[0_4px_18px_rgba(91,47,153,0.1)]">' +
        '<span class="absolute top-4 right-4 text-[9px] font-bold uppercase tracking-wider text-slate-500">Sponsored</span>' +
        '<div class="text-xs font-bold uppercase tracking-wide text-[#7a3d8a] mb-3 pr-16">★ Sponsor Hub</div>' +
        sponsorPreviewLogoHtml(creative.logoUrl, false) +
        (creative.companyName && !hasLogo
          ? '<p class="text-sm font-extrabold mb-1">' + esc(creative.companyName) + '</p>'
          : '') +
        (taglineHtml ? '<p class="text-sm font-semibold leading-snug mb-4">' + taglineHtml + '</p>' : '') +
        '<span data-sponsor-preview-cta class="inline-block w-full text-center rounded-lg bg-[#2d2636] text-white text-sm font-bold px-4 py-2.5">' +
        esc(creative.ctaLabel) +
        '</span></aside>';
      applyPreviewCtaColor(el, creative.ctaColor);
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
            if (data.block.active === false) {
              setSponsorStatus(
                'Saved draft for ' +
                  slotDefaults().label +
                  ' — check Ad active and publish to show on site (detail pages may show a fallback until then).'
              );
            } else {
              setSponsorStatus('Loaded live creative for ' + slotDefaults().label + '.');
            }
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
      'sponsor-cta-label',
      'sponsor-cta-color-hex',
      'sponsor-cta-url',
      'sponsor-active',
    ].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) input.addEventListener('input', renderPreview);
      if (input && input.type === 'checkbox') input.addEventListener('change', renderPreview);
    });

    var sponsorCtaColorPicker = document.getElementById('sponsor-cta-color');
    if (sponsorCtaColorPicker) {
      sponsorCtaColorPicker.addEventListener('input', function () {
        setSponsorCtaColorFields(sponsorCtaColorPicker.value);
        renderPreview();
      });
    }

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

    syncSlotFormLayout();

    document.getElementById('sponsor-publish-btn').addEventListener('click', function () {
      var btn = document.getElementById('sponsor-publish-btn');
      var creative = readForm();
      var slot = slotDefaults();
      if (
        creative.active &&
        slot.preview === 'hero' &&
        !creative.logoUrl &&
        !creative.tagline
      ) {
        setSponsorStatus('Add a logo or tagline before publishing an active hero ad.', 'error');
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
        (!/^https?:\/\//i.test(creative.ctaUrl) ||
          !String(creative.ctaUrl || '')
            .replace(/^https?:\/\//i, '')
            .trim())
      ) {
        setSponsorStatus('Enter the full sponsor website URL (https://example.com) — opens in a new tab.', 'error');
        return;
      }

      if (btn) btn.disabled = true;
      setSponsorStatus('Publishing…');

      var payload = {
        slot: currentSlotKey,
        title: slot.preview === 'compact' ? '' : creative.tagline,
        body: '',
        cta_label: creative.ctaLabel,
        cta_url: creative.ctaUrl,
        cta_color: creative.ctaColor,
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

  function initHomePartnersAdmin() {
    var listEl = document.getElementById('home-partners-list');
    var statusEl = document.getElementById('home-partners-status');
    var activeEl = document.getElementById('home-partners-active');
    var addBtn = document.getElementById('home-partners-add');
    var saveBtn = document.getElementById('home-partners-save');
    if (!listEl || !saveBtn) return;

    var partnersState = [];
    var pendingLogos = {};

    function setPartnersStatus(text, tone) {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.className =
        'text-sm ' +
        (tone === 'error'
          ? 'text-red-700 font-semibold'
          : tone === 'ok'
            ? 'text-emerald-700 font-semibold'
            : 'text-slate-500');
    }

    function newPartnerId() {
      return 'partner_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }

    function partnerRowHtml(p, index) {
      var logo = p.logo_url || '';
      var pending = pendingLogos[p.id];
      if (pending && pending.preview) logo = pending.preview;
      return (
        '<div class="rounded-xl border border-slate-200 p-4 space-y-3 min-w-0" data-partner-id="' +
        attrEsc(p.id) +
        '">' +
        '<div class="flex flex-wrap items-center justify-between gap-2">' +
        '<p class="text-sm font-semibold text-brand-900">Company ' +
        (index + 1) +
        '</p>' +
        '<div class="flex items-center gap-3">' +
        '<label class="flex items-center gap-2 text-xs text-slate-600">' +
        '<input type="checkbox" class="home-partner-active rounded border-slate-300"' +
        (p.active !== false ? ' checked' : '') +
        '> Active</label>' +
        '<button type="button" class="home-partner-remove text-xs font-semibold text-red-700 hover:underline">Remove</button>' +
        '</div></div>' +
        '<div class="grid sm:grid-cols-2 gap-3">' +
        '<div><label class="block text-xs font-semibold text-slate-600 mb-1">Company name</label>' +
        '<input type="text" class="home-partner-name w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
        attrEsc(p.company_name || '') +
        '" placeholder="Acme Ltd"></div>' +
        '<div><label class="block text-xs font-semibold text-slate-600 mb-1">Logo URL</label>' +
        '<input type="text" class="home-partner-logo-url w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
        attrEsc(pending ? '' : logo) +
        '" placeholder="https://…"></div></div>' +
        '<div><label class="block text-xs text-slate-500 mb-1">Or upload logo (max 2MB)</label>' +
        '<input type="file" class="home-partner-logo-file block w-full text-sm text-slate-600" accept="image/png,image/jpeg,image/webp,image/gif">' +
        (logo
          ? '<img src="' + attrEsc(logo) + '" alt="" class="mt-2 max-h-12 max-w-[160px] object-contain rounded border border-slate-100 bg-white p-1" />'
          : '') +
        '</div>' +
        '<div class="grid sm:grid-cols-2 gap-3">' +
        '<div><label class="block text-xs font-semibold text-slate-600 mb-1">CTA label</label>' +
        '<input type="text" class="home-partner-cta-label w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
        attrEsc(p.cta_label || 'Visit website') +
        '"></div>' +
        '<div><label class="block text-xs font-semibold text-slate-600 mb-1">CTA link</label>' +
        '<input type="text" class="home-partner-cta-url w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
        attrEsc(p.cta_url || '') +
        '" placeholder="https://… or mailto:…"></div></div></div>'
      );
    }

    function readPartnersFromDom() {
      var rows = listEl.querySelectorAll('[data-partner-id]');
      var out = [];
      rows.forEach(function (row) {
        var id = row.getAttribute('data-partner-id') || newPartnerId();
        var nameEl = row.querySelector('.home-partner-name');
        var logoUrlEl = row.querySelector('.home-partner-logo-url');
        var ctaLabelEl = row.querySelector('.home-partner-cta-label');
        var ctaUrlEl = row.querySelector('.home-partner-cta-url');
        var activeCheckbox = row.querySelector('.home-partner-active');
        var existing = partnersState.find(function (p) {
          return p.id === id;
        });
        var logoUrl = logoUrlEl ? logoUrlEl.value.trim() : '';
        if (!logoUrl && existing && existing.logo_url) logoUrl = existing.logo_url;
        if (!logoUrl && pendingLogos[id] && pendingLogos[id].existing) logoUrl = pendingLogos[id].existing;
        out.push({
          id: id,
          company_name: nameEl ? nameEl.value.trim() : '',
          logo_url: logoUrl,
          cta_label: ctaLabelEl ? ctaLabelEl.value.trim() : 'Visit website',
          cta_url: ctaUrlEl ? ctaUrlEl.value.trim() : '',
          active: activeCheckbox ? activeCheckbox.checked : true,
        });
      });
      return out;
    }

    function renderPartnerList() {
      if (!partnersState.length) {
        listEl.innerHTML =
          '<p class="text-sm text-slate-500 rounded-lg border border-dashed border-slate-200 p-4">No partners yet — click <strong>Add company</strong> to create your first logo.</p>';
        return;
      }
      listEl.innerHTML = partnersState.map(partnerRowHtml).join('');
    }

    function loadPartners() {
      setPartnersStatus('Loading home page partners…');
      adminGet('/api/admin/home-partners')
        .then(function (data) {
          if (!data || data.error || data.configured === false) {
            setPartnersStatus('Could not load partners.', 'error');
            return;
          }
          partnersState = Array.isArray(data.partners) ? data.partners : [];
          if (activeEl) activeEl.checked = data.active !== false;
          renderPartnerList();
          setPartnersStatus(
            partnersState.length
              ? partnersState.length + ' partner' + (partnersState.length === 1 ? '' : 's') + ' saved.'
              : 'No partners saved yet — add companies below.'
          );
        })
        .catch(function () {
          setPartnersStatus('Could not load partners.', 'error');
        });
    }

    listEl.addEventListener('click', function (ev) {
      var removeBtn = ev.target.closest('.home-partner-remove');
      if (!removeBtn) return;
      var row = removeBtn.closest('[data-partner-id]');
      if (!row) return;
      var id = row.getAttribute('data-partner-id');
      partnersState = readPartnersFromDom().filter(function (p) {
        return p.id !== id;
      });
      delete pendingLogos[id];
      renderPartnerList();
    });

    listEl.addEventListener('change', function (ev) {
      var fileInput = ev.target.closest('.home-partner-logo-file');
      if (!fileInput) return;
      var row = fileInput.closest('[data-partner-id]');
      if (!row) return;
      var id = row.getAttribute('data-partner-id');
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        setPartnersStatus('Logo must be under 2MB.', 'error');
        fileInput.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        partnersState = readPartnersFromDom();
        var existing = partnersState.find(function (p) {
          return p.id === id;
        });
        pendingLogos[id] = {
          preview: String(reader.result || ''),
          data: String(reader.result || ''),
          mime: file.type || 'image/jpeg',
          filename: file.name || 'logo.jpg',
          existing: existing ? existing.logo_url : '',
        };
        renderPartnerList();
      };
      reader.readAsDataURL(file);
    });

    if (addBtn) {
      addBtn.addEventListener('click', function () {
        partnersState = readPartnersFromDom();
        partnersState.push({
          id: newPartnerId(),
          company_name: '',
          logo_url: '',
          cta_label: 'Visit website',
          cta_url: '',
          active: true,
        });
        renderPartnerList();
      });
    }

    saveBtn.addEventListener('click', function () {
      var partners = readPartnersFromDom();
      saveBtn.disabled = true;
      setPartnersStatus('Saving…');

      var payload = {
        active: activeEl ? activeEl.checked : true,
        partners: partners.map(function (p) {
          var pending = pendingLogos[p.id];
          var item = {
            id: p.id,
            company_name: p.company_name,
            logo_url: p.logo_url,
            cta_label: p.cta_label,
            cta_url: p.cta_url,
            active: p.active,
          };
          if (pending && pending.data) {
            item.logoBase64 = pending.data;
            item.logoMime = pending.mime;
            item.logoFilename = pending.filename;
          }
          return item;
        }),
      };

      fetch('/api/admin/home-partners', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok || data.ok === false) {
              throw new Error(data.message || data.error || 'Save failed');
            }
            return data;
          });
        })
        .then(function (data) {
          pendingLogos = {};
          partnersState = Array.isArray(data.partners) ? data.partners : [];
          renderPartnerList();
          setPartnersStatus('Saved — home page partners updated.', 'ok');
        })
        .catch(function (err) {
          setPartnersStatus(err.message || 'Could not save partners.', 'error');
        })
        .finally(function () {
          saveBtn.disabled = false;
        });
    });

    loadPartners();
  }

  function renderEventCarouselPage() {
    main.innerHTML =
      '<div class="space-y-6 max-w-3xl">' +
      sponsorshipBackLinkHtml() +
      '<section class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5" id="event-carousel-admin">' +
      '<div class="flex flex-wrap items-start justify-between gap-3">' +
      '<div><h3 class="font-bold text-brand-900">Event & organiser pages — Sponsor carousel</h3>' +
      '<p class="text-sm text-slate-600 mt-1">Five sidebar slots on individual event and organiser profile pages. Each active slot shows a clickable logo that rotates automatically.</p></div></div>' +
      '<label class="flex items-center gap-2 text-sm text-slate-700">' +
      '<input type="checkbox" id="event-carousel-active" class="rounded border-slate-300" checked> ' +
      'Carousel active (uncheck to hide all event page sidebar ads)</label>' +
      '<div id="event-carousel-list" class="space-y-4 min-w-0"></div>' +
      '<div class="flex flex-wrap gap-3 pt-1">' +
      '<button type="button" id="event-carousel-save" class="rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900">Save carousel</button>' +
      '</div>' +
      '<p id="event-carousel-status" class="text-sm text-slate-500"></p></section></div>';
    initEventCarouselAdmin();
  }

  function initEventCarouselAdmin() {
    var listEl = document.getElementById('event-carousel-list');
    var statusEl = document.getElementById('event-carousel-status');
    var activeEl = document.getElementById('event-carousel-active');
    var saveBtn = document.getElementById('event-carousel-save');
    if (!listEl || !saveBtn) return;

    var adsState = [];
    var pendingLogos = {};
    var CAROUSEL_SIZE = 5;

    function setCarouselStatus(text, tone) {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.className =
        'text-sm ' +
        (tone === 'error'
          ? 'text-red-700 font-semibold'
          : tone === 'ok'
            ? 'text-emerald-700 font-semibold'
            : 'text-slate-500');
    }

    function defaultAds() {
      var out = [];
      for (var i = 0; i < CAROUSEL_SIZE; i++) {
        out.push({
          id: 'event_carousel_' + (i + 1),
          slot_index: i,
          logo_url: '',
          cta_url: '',
          active: false,
        });
      }
      return out;
    }

    function adRowHtml(ad, index) {
      var logo = ad.logo_url || '';
      var pending = pendingLogos[ad.id];
      if (pending && pending.preview) logo = pending.preview;
      return (
        '<div class="rounded-xl border border-slate-200 p-4 space-y-3 min-w-0" data-carousel-ad-id="' +
        attrEsc(ad.id) +
        '">' +
        '<div class="flex flex-wrap items-center justify-between gap-2">' +
        '<p class="text-sm font-semibold text-brand-900">Ad slot ' +
        (index + 1) +
        '</p>' +
        '<label class="flex items-center gap-2 text-xs text-slate-600">' +
        '<input type="checkbox" class="event-carousel-ad-active rounded border-slate-300"' +
        (ad.active !== false ? ' checked' : '') +
        '> Active</label></div>' +
        '<div><label class="block text-xs font-semibold text-slate-600 mb-1">Logo URL</label>' +
        '<input type="text" class="event-carousel-ad-logo-url w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
        attrEsc(pending ? '' : logo) +
        '" placeholder="https://…"></div>' +
        '<div><label class="block text-xs text-slate-500 mb-1">Or upload logo (max 2MB)</label>' +
        '<input type="file" class="event-carousel-ad-logo-file block w-full text-sm text-slate-600" accept="image/png,image/jpeg,image/webp,image/gif">' +
        (logo
          ? '<img src="' + attrEsc(logo) + '" alt="" class="mt-2 max-h-12 max-w-[160px] object-contain rounded border border-slate-100 bg-white p-1" />'
          : '') +
        '</div>' +
        '<div><label class="block text-xs font-semibold text-slate-600 mb-1">Click-through link</label>' +
        '<input type="text" class="event-carousel-ad-link-url w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value="' +
        attrEsc(ad.cta_url || '') +
        '" placeholder="https://… — opens when someone clicks the logo"></div></div>'
      );
    }

    function readAdsFromDom() {
      var rows = listEl.querySelectorAll('[data-carousel-ad-id]');
      var out = [];
      rows.forEach(function (row, index) {
        var id = row.getAttribute('data-carousel-ad-id') || 'event_carousel_' + (index + 1);
        var logoUrlEl = row.querySelector('.event-carousel-ad-logo-url');
        var linkUrlEl = row.querySelector('.event-carousel-ad-link-url');
        var activeCheckbox = row.querySelector('.event-carousel-ad-active');
        var existing = adsState.find(function (ad) {
          return ad.id === id;
        });
        var logoUrl = logoUrlEl ? logoUrlEl.value.trim() : '';
        if (!logoUrl && existing && existing.logo_url) logoUrl = existing.logo_url;
        if (!logoUrl && pendingLogos[id] && pendingLogos[id].existing) logoUrl = pendingLogos[id].existing;
        out.push({
          id: id,
          slot_index: index,
          logo_url: logoUrl,
          cta_url: linkUrlEl ? linkUrlEl.value.trim() : '',
          active: activeCheckbox ? activeCheckbox.checked : false,
        });
      });
      return out;
    }

    function renderAdList() {
      listEl.innerHTML = adsState.map(adRowHtml).join('');
    }

    function loadCarousel() {
      setCarouselStatus('Loading event page carousel…');
      adminGet('/api/admin/event-carousel')
        .then(function (data) {
          if (!data || data.error || data.configured === false) {
            adsState = defaultAds();
            if (activeEl) activeEl.checked = true;
            renderAdList();
            setCarouselStatus('Could not load carousel — showing empty slots.', 'error');
            return;
          }
          adsState = Array.isArray(data.ads) && data.ads.length ? data.ads : defaultAds();
          if (activeEl) activeEl.checked = data.active !== false;
          renderAdList();
          var liveCount = adsState.filter(function (ad) {
            return ad.active !== false && ad.logo_url && ad.cta_url;
          }).length;
          setCarouselStatus(
            liveCount
              ? liveCount + ' active ad' + (liveCount === 1 ? '' : 's') + ' in carousel.'
              : data.active === false
                ? 'Carousel is hidden on site — tick “Carousel active” above, add logo + link per slot, then save.'
                : 'No active ads yet — add a logo and click-through link for each slot you want live, then save.'
          );
        })
        .catch(function () {
          adsState = defaultAds();
          renderAdList();
          setCarouselStatus('Could not load carousel.', 'error');
        });
    }

    listEl.addEventListener('change', function (ev) {
      var fileInput = ev.target.closest('.event-carousel-ad-logo-file');
      if (fileInput) {
        var row = fileInput.closest('[data-carousel-ad-id]');
        if (!row) return;
        var id = row.getAttribute('data-carousel-ad-id');
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          setCarouselStatus('Logo must be under 2MB.', 'error');
          fileInput.value = '';
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          adsState = readAdsFromDom();
          var existing = adsState.find(function (ad) {
            return ad.id === id;
          });
          pendingLogos[id] = {
            preview: String(reader.result || ''),
            data: String(reader.result || ''),
            mime: file.type || 'image/jpeg',
            filename: file.name || 'logo.jpg',
            existing: existing ? existing.logo_url : '',
          };
          renderAdList();
        };
        reader.readAsDataURL(file);
      }
    });

    saveBtn.addEventListener('click', function () {
      var ads = readAdsFromDom();
      saveBtn.disabled = true;
      setCarouselStatus('Saving…');

      var payload = {
        active: activeEl ? activeEl.checked : true,
        ads: ads.map(function (ad) {
          var pending = pendingLogos[ad.id];
          var item = {
            id: ad.id,
            slot_index: ad.slot_index,
            logo_url: ad.logo_url,
            cta_url: ad.cta_url,
            active: ad.active,
          };
          if (pending && pending.data) {
            item.logoBase64 = pending.data;
            item.logoMime = pending.mime;
            item.logoFilename = pending.filename;
          }
          return item;
        }),
      };

      fetch('/api/admin/event-carousel', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok || data.ok === false) {
              var msg = data.message || data.error || 'Save failed';
              if (data.error === 'missing_carousel_logo') {
                msg = 'Ad slot ' + data.slot + ' is active but missing a logo.';
              } else if (data.error === 'missing_carousel_link') {
                msg = 'Ad slot ' + data.slot + ' is active but missing a valid click-through link.';
              } else if (data.error === 'missing_carousel_cta') {
                msg = 'Ad slot ' + data.slot + ' is active but missing a valid click-through link.';
              }
              throw new Error(msg);
            }
            return data;
          });
        })
        .then(function (data) {
          pendingLogos = {};
          adsState = Array.isArray(data.ads) ? data.ads : defaultAds();
          if (activeEl) activeEl.checked = data.active !== false;
          renderAdList();
          setCarouselStatus('Saved — event page carousel updated.', 'ok');
        })
        .catch(function (err) {
          setCarouselStatus(err.message || 'Could not save carousel.', 'error');
        })
        .finally(function () {
          saveBtn.disabled = false;
        });
    });

    loadCarousel();
  }

  function replaceEmailPlaceholders(text, variables) {
    var vars = variables && typeof variables === 'object' ? variables : {};
    return String(text || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, function (match, key) {
      if (!Object.prototype.hasOwnProperty.call(vars, key)) return match;
      var val = vars[key];
      if (val == null) return '';
      return String(val);
    });
  }

  function renderEmails() {
    var templates = [];
    var testRecipients = [];
    var selectedSlug = '';
    var dirty = false;
    var emailSponsorLogoBase64 = null;
    var emailSponsorLogoMime = '';
    var emailSponsorLogoFilename = '';
    var BOOKING_EMAIL_SPONSOR_SLOT = 'booking_email_sponsor';
    var EVENTS_SPONSOR_SLOT = 'events_sponsor_hub';
    var previewOrigin = window.location.origin || 'https://the-networker-hub.vercel.app';

    var SAMPLE_VARS = {
      user_name: 'Alex Morgan',
      user_email: 'alex@example.com',
      event_name: 'London Founders Breakfast',
      event_date: 'Tuesday 12 August 2026',
      event_time: '8:00 AM',
      event_location: 'The Shard, London SE1',
      event_url: previewOrigin + '/events/london-founders-breakfast',
      ticket_name: 'General admission',
      amount_paid: '£25.00',
      payment_status: 'Paid',
      registration_id: '00000000-0000-4000-8000-000000000001',
      booking_reference: 'HUB-00000000',
      booked_at: 'Tuesday 10 June 2026 at 2:30 pm',
      ticket_quantity: 1,
      ticket_quantity_label: '1 × General admission',
      hub_account_url: previewOrigin + '/account/index.html',
      hub_payment_url:
        previewOrigin +
        '/account/index.html?booking=00000000-0000-4000-8000-000000000001#payments',
      browse_events_url: previewOrigin + '/events/',
      contact_url: previewOrigin + '/contact.html',
      privacy_url: previewOrigin + '/legal-policies.html#privacy',
      terms_url: previewOrigin + '/legal-policies.html#terms',
      refunds_url: previewOrigin + '/legal-policies.html#refunds',
      payment_summary_row: '',
      organiser_name: 'City Connectors',
      meeting_link: '',
      meeting_type: 'In person',
      refund_policy: 'full_refund',
      refund_policy_details: '',
      refund_cutoff_days: 7,
      event_meta_rows: '',
      meeting_link_row: '',
      refund_policy_row: '',
      sponsor_row: '',
      attendee_name: 'Alex Morgan',
      attendee_email: 'alex@example.com',
      attendee_initial: 'A',
      booking_time: 'Tuesday 10 June 2026 at 2:30 pm',
      tickets_sold: '24',
      tickets_remaining: '16',
      total_revenue: '£600.00',
      welcome_url: previewOrigin + '/welcome.html',
      dashboard_url: previewOrigin + '/organiser/index.html',
      site_url: previewOrigin,
      logo_url: previewOrigin + '/assets/logo-nav.png',
    };

    function previewMetaRow(label, value) {
      var text = String(value || '').trim();
      if (!text) return '';
      return (
        '<tr><td style="padding:0 0 10px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;color:rgba(255,255,255,0.75);line-height:1.5;">' +
        '<span style="color:rgba(255,255,255,0.55);">' +
        esc(label) +
        '</span><br>' +
        '<span style="color:#ffffff;font-weight:600;">' +
        esc(text) +
        '</span></td></tr>'
      );
    }

    function previewIsOnline(vars) {
      var fmt = String(vars.meeting_type || '').trim().toLowerCase();
      if (fmt.indexOf('online') !== -1) return true;
      if (fmt.indexOf('person') !== -1) return false;
      return Boolean(String(vars.meeting_link || '').trim());
    }

    function previewMeetingLinkSection(link, online) {
      var url = String(link || '').trim();
      if (!online || !url) return '';
      return (
        '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f0e8;border-radius:14px;border:1px solid #d9c4e0;">' +
        '<tr><td style="padding:20px 24px;text-align:center;">' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:11px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 8px;">Join online</p>' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:400;color:#736b6e;line-height:1.6;margin:0 0 14px;">Use the link below when the event starts.</p>' +
        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">' +
        '<tr><td style="background:#9a7aa8;border-radius:999px;">' +
        '<a href="' +
        attrEsc(url) +
        '" style="display:inline-block;padding:12px 32px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;">Join online &rarr;</a>' +
        '</td></tr></table></td></tr></table></td></tr>'
      );
    }

    function previewPaymentSummarySection() {
      return (
        '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:14px;border:1px solid #d9c4e0;">' +
        '<tr><td style="padding:20px 22px;">' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">Payment summary</p>' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
        '<tr><td style="padding:0 0 8px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;line-height:1.5;">' +
        '<span style="color:#736b6e;">Booking reference:</span> ' +
        '<span style="color:#4a4446;font-weight:600;">' +
        esc(SAMPLE_VARS.booking_reference) +
        '</span></td></tr>' +
        '<tr><td style="padding:0 0 8px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;line-height:1.5;">' +
        '<span style="color:#736b6e;">Booked on:</span> ' +
        '<span style="color:#4a4446;font-weight:600;">' +
        esc(SAMPLE_VARS.booked_at) +
        '</span></td></tr>' +
        '<tr><td style="padding:0 0 8px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;line-height:1.5;">' +
        '<span style="color:#736b6e;">Tickets:</span> ' +
        '<span style="color:#4a4446;font-weight:600;">' +
        esc(SAMPLE_VARS.ticket_quantity_label) +
        '</span></td></tr>' +
        '<tr><td style="padding:0 0 8px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;line-height:1.5;">' +
        '<span style="color:#736b6e;">Total paid:</span> ' +
        '<span style="color:#4a4446;font-weight:600;">' +
        esc(SAMPLE_VARS.amount_paid) +
        '</span></td></tr>' +
        '</table>' +
        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:14px;">' +
        '<tr><td style="background:#4a4446;border-radius:999px;">' +
        '<a href="' +
        attrEsc(SAMPLE_VARS.hub_payment_url) +
        '" style="display:inline-block;padding:9px 20px;font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;font-weight:600;color:#ffffff;text-decoration:none;">View payment details &rarr;</a>' +
        '</td></tr></table>' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:11px;font-weight:400;color:#9a9092;line-height:1.5;margin:12px 0 0;">Your card receipt is sent separately by our payment provider.</p>' +
        '</td></tr></table></td></tr>'
      );
    }

    function previewRefundPolicySection() {
      return (
        '<tr><td class="mobile-pad" style="padding:0 48px 20px;">' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#faf7f2;border-radius:14px;border:1px solid #d9c4e0;">' +
        '<tr><td style="padding:20px 22px;">' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:700;color:#9a7aa8;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px;">Refund policy</p>' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;font-weight:600;color:#4a4446;margin:0 0 8px;">Full refunds available</p>' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:13px;color:#736b6e;line-height:1.65;margin:0;">Full refunds are available up to 7 days before the event.</p>' +
        '</td></tr></table></td></tr>'
      );
    }

    function isBookingEmailSlug(slug) {
      return (
        slug === 'booking_confirmation' ||
        slug === 'booking_reminder' ||
        slug === 'account_welcome' ||
        slug === 'saved_event_tickets_open' ||
        slug === 'organiser_new_registration'
      );
    }

    function applyPreviewEventFormat() {
      var online = previewIsOnline(SAMPLE_VARS);
      var meta = '';
      meta += previewMetaRow('Date', SAMPLE_VARS.event_date);
      meta += previewMetaRow('Time', SAMPLE_VARS.event_time);
      if (online) meta += previewMetaRow('Format', 'Online event');
      else meta += previewMetaRow('Location', SAMPLE_VARS.event_location);
      SAMPLE_VARS.event_meta_rows = meta;
      SAMPLE_VARS.payment_summary_row = previewPaymentSummarySection();
      SAMPLE_VARS.meeting_link_row = previewMeetingLinkSection(
        online ? SAMPLE_VARS.meeting_link : '',
        online
      );
      SAMPLE_VARS.refund_policy_row = previewRefundPolicySection();
      SAMPLE_VARS.sponsor_row = SAMPLE_VARS.sponsor_row || '';
    }

    function applyPreviewReminderFormat() {
      var online = previewIsOnline(SAMPLE_VARS);
      SAMPLE_VARS.meeting_link_row = previewMeetingLinkSection(
        online ? SAMPLE_VARS.meeting_link : '',
        online
      );
      if (online) SAMPLE_VARS.event_location = 'Online event';
      SAMPLE_VARS.sponsor_row = SAMPLE_VARS.sponsor_row || '';
    }

    function applyPreviewOrganiserFormat() {
      SAMPLE_VARS.attendee_name = SAMPLE_VARS.user_name;
      SAMPLE_VARS.attendee_email = SAMPLE_VARS.user_email;
      SAMPLE_VARS.attendee_initial = String(SAMPLE_VARS.user_name || 'A').trim().charAt(0).toUpperCase() || 'A';
      SAMPLE_VARS.booking_time = SAMPLE_VARS.booked_at;
      SAMPLE_VARS.sponsor_row = SAMPLE_VARS.sponsor_row || '';
    }

    function applyPreviewAccountWelcomeFormat() {
      SAMPLE_VARS.sponsor_row = SAMPLE_VARS.sponsor_row || '';
    }

    function applyPreviewForSlug(slug) {
      if (slug === 'booking_confirmation') applyPreviewEventFormat();
      else if (slug === 'booking_reminder') applyPreviewReminderFormat();
      else if (slug === 'organiser_new_registration') applyPreviewOrganiserFormat();
      else if (slug === 'account_welcome' || slug === 'saved_event_tickets_open') {
        applyPreviewAccountWelcomeFormat();
      }
    }

    applyPreviewForSlug('booking_confirmation');
    if (currentUser) {
      if (currentUser.name) SAMPLE_VARS.user_name = currentUser.name;
      if (currentUser.email) SAMPLE_VARS.user_email = currentUser.email;
    }

    function isLocalDevHost() {
      var host = String(window.location.hostname || '').toLowerCase();
      return host === 'localhost' || host === '127.0.0.1';
    }

    function emailActionMessage(code, fallback) {
      var messages = {
        recipient_not_allowed:
          'This address is not on the safe test list. Add it under Safe test recipients first.',
        resend_not_configured: isLocalDevHost()
          ? 'Email is not configured for local dev. Copy RESEND_API_KEY and RESEND_FROM from Vercel → Settings → Environment Variables into local.env, then run npm run sync-env and restart npm start.'
          : 'Email sending is not configured yet. Add RESEND_API_KEY and RESEND_FROM in Vercel, then redeploy.',
        test_recipients_table_missing:
          'Safe test list is not set up yet. Run migrations 051 and 052 in Supabase.',
        template_not_found:
          'Booking confirmation template not found. Run migrations 027 and 056 in Supabase.',
        resend_send_failed:
          'Resend rejected the email. Check RESEND_FROM uses a verified domain and see Resend logs.',
      };
      return messages[code] || fallback || code || 'Something went wrong.';
    }

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
      '<div id="email-sponsor-panel" class="hidden border-t border-slate-100 pt-5 space-y-4">' +
      '<div class="space-y-2">' +
      '<h4 class="text-sm font-bold text-brand-900">Email sponsor</h4>' +
      '<p class="text-xs text-slate-500">Shown in the &ldquo;proudly powered by&rdquo; strip on booking confirmations, 24-hour reminders, and organiser new-booking alerts. Defaults from your <strong>Events browse</strong> sponsor — change it here without affecting the website, or pull the latest from Events.</p>' +
      '<p id="email-sponsor-status" class="text-xs text-slate-500"></p>' +
      '</div>' +
      '<div class="grid sm:grid-cols-2 gap-4">' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="email-sponsor-company">Company name</label>' +
      '<input type="text" id="email-sponsor-company" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Sponsor name"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-600 mb-1" for="email-sponsor-url">Website URL</label>' +
      '<input type="url" id="email-sponsor-url" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="https://"></div>' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-600 mb-1" for="email-sponsor-logo-url">Logo URL</label>' +
      '<input type="url" id="email-sponsor-logo-url" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="https://… or upload below"></div>' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-600 mb-1" for="email-sponsor-logo-file">Upload logo</label>' +
      '<input type="file" id="email-sponsor-logo-file" accept="image/*" class="w-full text-sm"></div>' +
      '</div>' +
      '<div id="email-sponsor-preview" class="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-500">Sponsor preview will appear here.</div>' +
      '<div class="flex flex-wrap gap-3">' +
      '<button type="button" id="email-sponsor-save-btn" class="rounded-lg bg-brand-700 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-900">Save email sponsor</button>' +
      '<button type="button" id="email-sponsor-sync-btn" class="rounded-lg border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Pull from Events browse sponsor</button>' +
      '<a href="#sponsorship/events_sponsor_hub" class="rounded-lg border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 inline-flex items-center">Edit Events sponsor</a>' +
      '</div></div>' +
      '<div class="border-t border-slate-100 pt-5 space-y-4">' +
      '<div class="space-y-3">' +
      '<h4 class="text-sm font-bold text-brand-900">Safe test recipients</h4>' +
      '<p class="text-xs text-slate-500">Only addresses on this list can receive test emails from the Command Centre.</p>' +
      '<ul id="email-test-recipient-list" class="space-y-2 text-sm"></ul>' +
      '<div class="flex flex-wrap gap-3 items-end">' +
      '<div class="flex-1 min-w-[180px]"><label class="block text-xs font-semibold text-slate-600 mb-1" for="email-test-add-email">Email</label>' +
      '<input type="email" id="email-test-add-email" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="you@company.com"></div>' +
      '<div class="flex-1 min-w-[140px]"><label class="block text-xs font-semibold text-slate-600 mb-1" for="email-test-add-label">Label (optional)</label>' +
      '<input type="text" id="email-test-add-label" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="My inbox"></div>' +
      '<button type="button" id="email-test-add-btn" class="rounded-lg border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Add to list</button>' +
      '</div></div>' +
      '<div class="space-y-3 border-t border-slate-100 pt-4">' +
      '<h4 class="text-sm font-bold text-brand-900">Send test email</h4>' +
      '<p class="text-xs text-slate-500">Test sends use <strong>sample event and ticket data</strong> in the preview (or your name if you are signed in). When someone actually books, the email fills in their account name, the ticket they bought, the amount paid, and the event details automatically.</p>' +
      '<div class="flex flex-wrap gap-3 items-end">' +
      '<div class="flex-1 min-w-[200px]"><label class="block text-xs font-semibold text-slate-600 mb-1" for="email-test-to">Recipient</label>' +
      '<select id="email-test-to" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white">' +
      '<option value="">Select a safe address…</option></select></div>' +
      '<button type="button" id="email-test-btn" class="rounded-lg border border-brand-700 text-brand-700 px-4 py-2 text-sm font-semibold hover:bg-brand-50">Send test</button>' +
      '</div>' +
      '<p id="email-test-result" class="hidden text-sm rounded-lg px-3 py-2"></p>' +
      '</div></div></form>' +
      '<section id="email-preview-panel" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hidden">' +
      '<h3 class="font-bold text-brand-900 mb-1">Preview</h3>' +
      '<p id="email-preview-subject" class="text-sm text-slate-600 mb-4"></p>' +
      '<iframe id="email-preview-frame" title="Email preview" class="w-full rounded-lg border border-slate-100 bg-white" style="height:min(80vh,720px);border:0;" sandbox="allow-same-origin"></iframe>' +
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
            : tone === 'warn'
              ? 'text-amber-700 font-semibold'
              : 'text-slate-500');
      try {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } catch (e) {}
    }

    function setTestResult(text, tone) {
      var el = document.getElementById('email-test-result');
      if (!el) return;
      if (!text) {
        el.className = 'hidden text-sm rounded-lg px-3 py-2';
        el.textContent = '';
        return;
      }
      el.textContent = text;
      el.className =
        'text-sm rounded-lg px-3 py-2 ' +
        (tone === 'error'
          ? 'bg-red-50 text-red-800 border border-red-100'
          : tone === 'ok'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
            : 'bg-slate-50 text-slate-700 border border-slate-100');
      try {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } catch (e2) {}
    }

    function currentTemplate() {
      for (var i = 0; i < templates.length; i++) {
        if (templates[i].slug === selectedSlug) return templates[i];
      }
      return null;
    }

    var EMAIL_TEMPLATE_GROUPS = [
      { key: 'attendees', label: 'Attendees' },
      { key: 'organisers', label: 'Organisers' },
      { key: 'opportunities', label: 'Business opportunities' },
      { key: 'academy', label: 'Training' },
    ];

    var ATTENDEE_EMAIL_SLUGS = [
      'booking_confirmation',
      'booking_reminder',
      'account_welcome',
      'saved_event_tickets_open',
    ];
    var ORGANISER_EMAIL_SLUGS = ['organiser_new_registration', 'organiser_claim_invite'];

    function emailTemplateCategory(t) {
      var slug = String((t && t.slug) || '');
      if (ATTENDEE_EMAIL_SLUGS.indexOf(slug) !== -1) return 'attendees';
      if (ORGANISER_EMAIL_SLUGS.indexOf(slug) !== -1 || slug.indexOf('organiser_') === 0) {
        return 'organisers';
      }
      var cat = String((t && t.category) || '')
        .trim()
        .toLowerCase();
      if (cat === 'attendees' || cat === 'organisers' || cat === 'opportunities' || cat === 'academy') {
        return cat;
      }
      if (slug.indexOf('opportunity') !== -1) return 'opportunities';
      if (slug.indexOf('academy') !== -1 || slug.indexOf('workshop') !== -1) return 'academy';
      if (slug.indexOf('booking_') === 0 || slug.indexOf('account_') === 0) return 'attendees';
      return 'organisers';
    }

    function renderTemplateList() {
      var list = document.getElementById('email-template-list');
      if (!list) return;
      if (!templates.length) {
        list.innerHTML = '<li class="text-slate-400">No templates yet — run migration 027 in Supabase.</li>';
        return;
      }
      list.innerHTML = EMAIL_TEMPLATE_GROUPS.map(function (group) {
        var items = templates.filter(function (t) {
          return emailTemplateCategory(t) === group.key;
        });
        var buttons = items
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
        return (
          '<li class="mb-4 last:mb-0">' +
          '<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">' +
          esc(group.label) +
          '</p>' +
          (buttons
            ? '<ul class="space-y-1">' + buttons + '</ul>'
            : '<p class="text-xs text-slate-400 px-1">No templates yet</p>') +
          '</li>'
        );
      }).join('');
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

    function buildEmailSponsorSectionHtml(logo, url, name) {
      var link = String(url || '').trim();
      if (!link) return '';
      var label = String(name || '').trim() || 'Our sponsor';
      var logoHtml = String(logo || '').trim()
        ? '<img src="' +
          attrEsc(logo) +
          '" alt="' +
          attrEsc(label) +
          '" width="140" style="height:auto;display:inline-block;opacity:0.9;">'
        : '<span style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:15px;font-weight:600;color:#9a7aa8;">' +
          esc(label) +
          '</span>';
      return (
        '<tr><td style="padding:0 48px 18px;text-align:center;background:#f5f0e8;">' +
        '<p style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:10px;font-weight:600;color:#9a9092;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Our event directory is proudly powered by</p>' +
        '<a href="' +
        attrEsc(link) +
        '" style="display:inline-block;text-decoration:none;">' +
        logoHtml +
        '</a></td></tr>'
      );
    }

    function readEmailSponsorForm() {
      return {
        company: (document.getElementById('email-sponsor-company').value || '').trim(),
        url: (document.getElementById('email-sponsor-url').value || '').trim(),
        logoUrl: emailSponsorLogoBase64
          ? ''
          : (document.getElementById('email-sponsor-logo-url').value || '').trim(),
      };
    }

    function applyEmailSponsorBlock(block) {
      if (!block) return;
      var logo = String(block.logo_url || block.image_url || '').trim();
      document.getElementById('email-sponsor-company').value =
        String(block.company_name || '').trim();
      document.getElementById('email-sponsor-url').value = String(block.cta_url || '').trim();
      document.getElementById('email-sponsor-logo-url').value = logo;
      emailSponsorLogoBase64 = null;
      emailSponsorLogoMime = '';
      emailSponsorLogoFilename = '';
      var fileInput = document.getElementById('email-sponsor-logo-file');
      if (fileInput) fileInput.value = '';
      updateSampleSponsorSection();
      renderEmailSponsorMiniPreview();
    }

    function updateSampleSponsorSection() {
      var form = readEmailSponsorForm();
      var logo = form.logoUrl || emailSponsorLogoBase64 || '';
      SAMPLE_VARS.sponsor_row = buildEmailSponsorSectionHtml(logo, form.url, form.company);
    }

    function renderEmailSponsorMiniPreview() {
      var el = document.getElementById('email-sponsor-preview');
      if (!el) return;
      var form = readEmailSponsorForm();
      var logo = form.logoUrl || emailSponsorLogoBase64 || '';
      if (!form.url) {
        el.innerHTML = '<span class="text-slate-400">Add a website URL to show the sponsor in emails.</span>';
        return;
      }
      if (logo) {
        el.innerHTML =
          '<p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Our event directory is proudly powered by</p>' +
          '<img src="' +
          attrEsc(logo) +
          '" alt="" class="mx-auto max-h-12 w-auto" style="max-width:140px;">';
      } else {
        el.innerHTML =
          '<p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Our event directory is proudly powered by</p>' +
          '<p class="font-semibold text-brand-900">' +
          esc(form.company || 'Sponsor') +
          '</p>';
      }
    }

    function toggleEmailSponsorPanel() {
      var panel = document.getElementById('email-sponsor-panel');
      if (!panel) return;
      if (isBookingEmailSlug(selectedSlug)) {
        panel.classList.remove('hidden');
        loadBookingEmailSponsor();
      } else {
        panel.classList.add('hidden');
      }
    }

    function loadBookingEmailSponsor() {
      var status = document.getElementById('email-sponsor-status');
      if (status) status.textContent = 'Loading email sponsor…';
      adminGet('/api/admin/sponsor?slot=' + encodeURIComponent(BOOKING_EMAIL_SPONSOR_SLOT))
        .then(function (data) {
          if (data.block) {
            applyEmailSponsorBlock(data.block);
            if (status) status.textContent = 'Using the booking email sponsor settings below.';
          } else {
            return adminGet('/api/admin/sponsor?slot=' + encodeURIComponent(EVENTS_SPONSOR_SLOT)).then(
              function (eventsData) {
                if (eventsData.block) {
                  applyEmailSponsorBlock(eventsData.block);
                  if (status) {
                    status.textContent =
                      'No email-only sponsor saved yet — showing your Events browse sponsor. Save below to set a separate email sponsor.';
                  }
                } else if (status) {
                  status.textContent = 'No sponsor configured yet. Set one below or pull from Events.';
                }
              }
            );
          }
          refreshPreview();
        })
        .catch(function () {
          if (status) status.textContent = 'Could not load sponsor settings.';
        });
    }

    function fillEditor(template) {
      var form = document.getElementById('email-editor');
      var previewPanel = document.getElementById('email-preview-panel');
      if (!template) {
        if (form) form.classList.add('hidden');
        if (previewPanel) previewPanel.classList.add('hidden');
        toggleEmailSponsorPanel();
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
      toggleEmailSponsorPanel();
      refreshPreview();
    }

    function selectTemplate(slug) {
      selectedSlug = slug;
      renderTemplateList();
      fillEditor(currentTemplate());
    }

    function setPreviewHtml(html) {
      var frame = document.getElementById('email-preview-frame');
      if (!frame) return;
      frame.srcdoc = html || '';
    }

    function stripUnresolvedBookingPlaceholders(text) {
      var keys = [
        'payment_summary_row',
        'event_meta_rows',
        'meeting_link_row',
        'refund_policy_row',
        'sponsor_row',
        'event_location_row',
        'event_online_row',
        'meeting_link_section',
        'refund_policy_section',
        'sponsor_section',
      ];
      var out = String(text || '');
      keys.forEach(function (key) {
        out = out.replace(new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g'), '');
      });
      return out;
    }

    function stripUnresolvedReminderPlaceholders(text) {
      var keys = ['meeting_link_row', 'sponsor_row', 'meeting_link_section', 'sponsor_section'];
      var out = String(text || '');
      keys.forEach(function (key) {
        out = out.replace(new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g'), '');
      });
      return out;
    }

    function stripUnresolvedOrganiserPlaceholders(text) {
      var keys = ['sponsor_row', 'sponsor_section'];
      var out = String(text || '');
      keys.forEach(function (key) {
        out = out.replace(new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g'), '');
      });
      return out;
    }

    function stripUnresolvedAccountWelcomePlaceholders(text) {
      var keys = ['sponsor_row', 'sponsor_section'];
      var out = String(text || '');
      keys.forEach(function (key) {
        out = out.replace(new RegExp('\\{\\{\\s*' + key + '\\s*\\}\\}', 'g'), '');
      });
      return out;
    }

    function refreshPreview() {
      if (!selectedSlug) return;
      var subjectEl = document.getElementById('email-subject');
      var bodyEl = document.getElementById('email-body');
      if (!subjectEl || !bodyEl) return;
      if (isBookingEmailSlug(selectedSlug)) {
        applyPreviewForSlug(selectedSlug);
        updateSampleSponsorSection();
      }
      var subjectLine = document.getElementById('email-preview-subject');
      if (subjectLine) {
        subjectLine.textContent =
          'Subject: ' + replaceEmailPlaceholders(subjectEl.value, SAMPLE_VARS);
      }
      var html = replaceEmailPlaceholders(bodyEl.value, SAMPLE_VARS);
      if (selectedSlug === 'booking_confirmation') {
        html = stripUnresolvedBookingPlaceholders(html);
      } else if (selectedSlug === 'booking_reminder') {
        html = stripUnresolvedReminderPlaceholders(html);
      } else if (selectedSlug === 'organiser_new_registration') {
        html = stripUnresolvedOrganiserPlaceholders(html);
      } else if (
        selectedSlug === 'account_welcome' ||
        selectedSlug === 'saved_event_tickets_open'
      ) {
        html = stripUnresolvedAccountWelcomePlaceholders(html);
      }
      setPreviewHtml(html);
    }

    function renderTestRecipientList() {
      var list = document.getElementById('email-test-recipient-list');
      var select = document.getElementById('email-test-to');
      var previous = select ? select.value : '';
      if (list) {
        if (!testRecipients.length) {
          list.innerHTML =
            '<li class="text-slate-400 text-xs">No safe addresses yet — add one above before sending a test.</li>';
        } else {
          list.innerHTML = testRecipients
            .map(function (r) {
              var label = r.label ? ' <span class="text-slate-400">(' + esc(r.label) + ')</span>' : '';
              return (
                '<li class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">' +
                '<span><span class="font-medium text-slate-800">' +
                esc(r.email) +
                '</span>' +
                label +
                '</span>' +
                '<button type="button" data-remove-test-recipient="' +
                attrEsc(r.id) +
                '" class="text-xs font-semibold text-red-600 hover:text-red-800">Remove</button></li>'
              );
            })
            .join('');
          list.querySelectorAll('[data-remove-test-recipient]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var id = btn.getAttribute('data-remove-test-recipient');
              if (!id || !window.confirm('Remove this address from the safe test list?')) return;
              btn.disabled = true;
              adminPost('/api/admin/emails', { action: 'remove_test_recipient', id: id })
                .then(function (data) {
                  if (!data.ok) throw new Error(data.message || data.error || 'Remove failed');
                  testRecipients = testRecipients.filter(function (r) {
                    return r.id !== id;
                  });
                  renderTestRecipientList();
                  setEmailStatus('Removed from safe test list.', 'ok');
                })
                .catch(function (err) {
                  setEmailStatus(err.message || 'Could not remove address.', 'error');
                })
                .finally(function () {
                  btn.disabled = false;
                });
            });
          });
        }
      }
      if (select) {
        var options =
          '<option value="">Select a safe address…</option>' +
          testRecipients
            .map(function (r) {
              var label = r.label ? r.label + ' — ' : '';
              return (
                '<option value="' +
                attrEsc(r.email) +
                '">' +
                esc(label + r.email) +
                '</option>'
              );
            })
            .join('');
        select.innerHTML = options;
        if (previous && testRecipients.some(function (r) { return r.email === previous; })) {
          select.value = previous;
        } else if (
          currentUser &&
          currentUser.email &&
          testRecipients.some(function (r) { return r.email === currentUser.email; })
        ) {
          select.value = currentUser.email;
        }
      }
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
          testRecipients = data.testRecipients || [];
          if (!selectedSlug && templates.length) selectedSlug = templates[0].slug;
          renderTemplateList();
          renderTestRecipientList();
          fillEditor(currentTemplate());
          if (!data.emailSendingConfigured) {
            setEmailStatus(
              isLocalDevHost()
                ? 'Templates loaded. Test sends need RESEND_API_KEY and RESEND_FROM in local.env — copy from Vercel, run npm run sync-env, restart npm start.'
                : 'Templates loaded. Test sends need RESEND_API_KEY and RESEND_FROM in Vercel environment variables.',
              'warn'
            );
          } else if (data.testRecipientsWarning) {
            setEmailStatus(data.testRecipientsWarning, 'warn');
          } else {
            setEmailStatus(templates.length + ' template' + (templates.length === 1 ? '' : 's') + ' loaded.');
          }
        })
        .catch(function () {
          setEmailStatus('Could not load email templates.', 'error');
        });
    }

    document.getElementById('email-subject').addEventListener('input', function () {
      dirty = true;
      refreshPreview();
    });
    document.getElementById('email-body').addEventListener('input', function () {
      dirty = true;
      refreshPreview();
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

    ['email-sponsor-company', 'email-sponsor-url', 'email-sponsor-logo-url'].forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('input', function () {
        updateSampleSponsorSection();
        renderEmailSponsorMiniPreview();
        refreshPreview();
      });
    });

    document.getElementById('email-sponsor-logo-file').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        setEmailStatus('Logo must be under 2MB.', 'error');
        ev.target.value = '';
        return;
      }
      emailSponsorLogoMime = file.type || 'image/jpeg';
      emailSponsorLogoFilename = file.name || 'logo.jpg';
      var reader = new FileReader();
      reader.onload = function () {
        emailSponsorLogoBase64 = String(reader.result || '');
        document.getElementById('email-sponsor-logo-url').value = '';
        updateSampleSponsorSection();
        renderEmailSponsorMiniPreview();
        refreshPreview();
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('email-sponsor-save-btn').addEventListener('click', function () {
      var btn = document.getElementById('email-sponsor-save-btn');
      var form = readEmailSponsorForm();
      if (!form.url || !/^https?:\/\//i.test(form.url)) {
        setEmailStatus('Enter the sponsor website URL (https://…).', 'error');
        return;
      }
      if (!form.logoUrl && !emailSponsorLogoBase64 && !form.company) {
        setEmailStatus('Add a logo or company name for the email sponsor.', 'error');
        return;
      }
      if (btn) btn.disabled = true;
      setEmailStatus('Saving email sponsor…');
      var payload = {
        slot: BOOKING_EMAIL_SPONSOR_SLOT,
        title: '',
        body: '',
        cta_label: 'Visit website',
        cta_url: form.url,
        company_name: form.company,
        logo_url: form.logoUrl,
        active: true,
      };
      if (emailSponsorLogoBase64) {
        payload.logoBase64 = emailSponsorLogoBase64;
        payload.logoMime = emailSponsorLogoMime;
        payload.logoFilename = emailSponsorLogoFilename;
      }
      adminPost('/api/admin/sponsor', payload)
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Save failed');
          if (data.block) applyEmailSponsorBlock(data.block);
          setEmailStatus('Email sponsor saved.', 'ok');
          refreshPreview();
        })
        .catch(function (err) {
          setEmailStatus(err.message || 'Could not save email sponsor.', 'error');
        })
        .finally(function () {
          if (btn) btn.disabled = false;
        });
    });

    document.getElementById('email-sponsor-sync-btn').addEventListener('click', function () {
      var btn = document.getElementById('email-sponsor-sync-btn');
      if (btn) btn.disabled = true;
      setEmailStatus('Pulling sponsor from Events browse…');
      adminPost('/api/admin/sponsor', {
        action: 'sync_from',
        slot: BOOKING_EMAIL_SPONSOR_SLOT,
        from_slot: EVENTS_SPONSOR_SLOT,
      })
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Sync failed');
          if (data.block) applyEmailSponsorBlock(data.block);
          setEmailStatus('Email sponsor updated from Events browse sponsor.', 'ok');
          refreshPreview();
        })
        .catch(function (err) {
          var msg = err.message || 'Could not sync sponsor.';
          if (msg === 'source_not_found') {
            msg = 'No Events browse sponsor found. Set one under Sponsorship first.';
          }
          setEmailStatus(msg, 'error');
        })
        .finally(function () {
          if (btn) btn.disabled = false;
        });
    });

    document.getElementById('email-test-add-btn').addEventListener('click', function () {
      var addBtn = document.getElementById('email-test-add-btn');
      var email = (document.getElementById('email-test-add-email').value || '').trim();
      var label = (document.getElementById('email-test-add-label').value || '').trim();
      if (!email) {
        setEmailStatus('Enter an email address to add to the safe test list.', 'error');
        return;
      }
      if (addBtn) addBtn.disabled = true;
      setEmailStatus('Adding to safe test list…');
      adminPost('/api/admin/emails', {
        action: 'add_test_recipient',
        email: email,
        label: label,
      })
        .then(function (data) {
          if (!data.ok) throw new Error(data.message || data.error || 'Add failed');
          var exists = false;
          for (var i = 0; i < testRecipients.length; i++) {
            if (testRecipients[i].id === data.recipient.id) {
              testRecipients[i] = data.recipient;
              exists = true;
              break;
            }
          }
          if (!exists) testRecipients.push(data.recipient);
          testRecipients.sort(function (a, b) {
            return a.email.localeCompare(b.email);
          });
          document.getElementById('email-test-add-email').value = '';
          document.getElementById('email-test-add-label').value = '';
          renderTestRecipientList();
          var select = document.getElementById('email-test-to');
          if (select) select.value = data.recipient.email;
          setEmailStatus('Added ' + data.recipient.email + ' to the safe test list.', 'ok');
        })
        .catch(function (err) {
          var msg = err.message || 'Could not add address.';
          if (msg === 'email_already_listed') {
            msg = 'That address is already on the safe test list.';
          } else if (msg === 'invalid_email') {
            msg = 'Enter a valid email address.';
          }
          setEmailStatus(msg, 'error');
        })
        .finally(function () {
          if (addBtn) addBtn.disabled = false;
        });
    });

    document.getElementById('email-test-btn').addEventListener('click', function () {
      if (!selectedSlug) return;
      var btn = document.getElementById('email-test-btn');
      var to = (document.getElementById('email-test-to').value || '').trim();
      setTestResult('', '');
      if (!to) {
        var pickMsg =
          testRecipients.length === 0
            ? 'No safe test addresses yet. Run migrations 051 and 052 in Supabase, or add an address above.'
            : 'Choose a safe test recipient from the dropdown before sending.';
        setEmailStatus(pickMsg, 'error');
        setTestResult(pickMsg, 'error');
        return;
      }
      if (btn) btn.disabled = true;
      if (isBookingEmailSlug(selectedSlug)) {
        applyPreviewForSlug(selectedSlug);
        updateSampleSponsorSection();
      }
      setEmailStatus('Sending test email to ' + to + '…');
      adminPost('/api/admin/emails', {
        action: 'test',
        slug: selectedSlug,
        to: to,
        variables: SAMPLE_VARS,
      })
        .then(function (data) {
          if (!data.ok) {
            var err = new Error(data.message || data.error || 'Send failed');
            err.code = data.error;
            throw err;
          }
          var okMsg =
            'Test email sent to ' +
            (data.to || to) +
            '. Check your inbox and spam folder (may take a minute).';
          if (data.template_source) {
            okMsg += ' Template: ' + data.template_source + '.';
          }
          setEmailStatus(okMsg, 'ok');
          setTestResult(okMsg, 'ok');
        })
        .catch(function (err) {
          var msg = emailActionMessage(err.code, err.message || 'Could not send test email.');
          setEmailStatus(msg, 'error');
          setTestResult(msg, 'error');
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

  function invalidateEventOrganiserOptionsCache() {
    eventOrganiserOptionsCache = null;
  }

  function fetchEventOrganiserOptions(force) {
    if (!force && eventOrganiserOptionsCache) {
      return Promise.resolve(eventOrganiserOptionsCache);
    }
    return adminGet('/api/admin/organisers?limit=500&offset=0').then(function (data) {
      if (!data || data.error) return [];
      eventOrganiserOptionsCache = (data.organisers || []).map(normalizeOrganiserOption);
      return eventOrganiserOptionsCache;
    });
  }

  function populateEventOrganiserSelects(organisers) {
    var filterSelect = document.getElementById('event-cleanup-organiser');
    var createSelect = document.getElementById('event-create-organiser');
    if (filterSelect) filterSelect.innerHTML = eventCleanupFilterHtml(organisers);
    if (createSelect) {
      createSelect.innerHTML = organiserOptionsHtml(organisers, eventCleanupState.organiserId);
    }
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

  function approvalStatusBadge(status) {
    var s = String(status || 'Pending Review');
    var low = s.toLowerCase();
    var cls =
      low.indexOf('approved') >= 0 && low.indexOf('pending') < 0
        ? 'bg-emerald-100 text-emerald-800'
        : low.indexOf('reject') >= 0
          ? 'bg-red-100 text-red-800'
          : 'bg-amber-100 text-amber-900';
    return (
      '<span class="inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 ' +
      cls +
      '">' +
      esc(s) +
      '</span>'
    );
  }

  function eventCleanupHasActiveFilters() {
    return !!(
      eventCleanupState.q ||
      eventCleanupState.organiserId ||
      eventCleanupState.unlinked ||
      eventCleanupState.noDate ||
      eventCleanupState.status ||
      eventCleanupState.approval
    );
  }

  function syncEventCleanupFilterUi() {
    var el;
    el = document.getElementById('event-cleanup-organiser');
    if (el) el.value = eventCleanupState.organiserId || '';
    el = document.getElementById('event-cleanup-search');
    if (el) el.value = eventCleanupState.q || '';
    el = document.getElementById('event-cleanup-unlinked');
    if (el) el.checked = !!eventCleanupState.unlinked;
    el = document.getElementById('event-cleanup-no-date');
    if (el) el.checked = !!eventCleanupState.noDate;
    el = document.getElementById('event-cleanup-status-filter');
    if (el) el.value = eventCleanupState.status || '';
    el = document.getElementById('event-cleanup-approval-filter');
    if (el) el.value = eventCleanupState.approval || '';
    el = document.getElementById('event-cleanup-sort');
    if (el) el.value = eventCleanupState.sort || 'recent';
    main.querySelectorAll('[data-event-quick]').forEach(function (btn) {
      var key = btn.getAttribute('data-event-quick');
      var active = false;
      if (key === 'unlinked') active = eventCleanupState.unlinked;
      else if (key === 'no_date') active = eventCleanupState.noDate;
      else if (key === 'draft') active = eventCleanupState.status === 'draft';
      else if (key === 'pending') active = eventCleanupState.approval === 'Pending Review';
      btn.classList.toggle('ring-2', active);
      btn.classList.toggle('ring-brand-700', active);
      btn.classList.toggle('bg-brand-50', active);
    });
  }

  function eventCleanupEditFormHtml(ev, organisers) {
    return (
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
      '<span class="event-cleanup-msg text-xs"></span></div></form>'
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

  function adminLogoFieldHtml(key, photoUrl, compact) {
    var hasPhoto = !!photoUrl;
    if (compact) {
      return (
        '<div class="group-cleanup-logo-field min-w-0">' +
        '<label class="block text-xs font-semibold text-slate-500 mb-1">Logo</label>' +
        '<div class="admin-logo-zone admin-logo-zone--compact border-2 border-dashed border-slate-300 rounded-lg p-2 text-center cursor-pointer hover:border-brand-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 transition bg-white" data-admin-logo-key="' +
        attrEsc(key) +
        '" tabindex="0" role="button" aria-label="Upload or paste logo">' +
        '<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>' +
        '<img class="admin-logo-preview mx-auto h-12 w-12 rounded-lg object-contain border border-slate-200' +
        (hasPhoto ? '' : ' hidden') +
        '" src="' +
        attrEsc(photoUrl || '') +
        '" alt="">' +
        '<p class="admin-logo-placeholder text-[10px] text-slate-500 mt-1' +
        (hasPhoto ? ' hidden' : '') +
        '">Drop or click</p></div>' +
        '<input type="url" name="photo_url" class="w-full rounded-lg border border-slate-300 px-2 py-1.5 bg-white text-xs mt-1.5" value="' +
        attrEsc(photoUrl || '') +
        '" placeholder="Logo URL"></div>'
      );
    }
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

  function rememberSelectedGroup(o) {
    if (!o || o.id == null) return;
    groupCleanupState.selected[String(o.id)] = {
      id: o.id,
      name: o.name || 'Untitled',
      email: o.email || '',
      event_count: o.event_count || 0,
    };
  }

  function forgetSelectedGroup(id) {
    delete groupCleanupState.selected[String(id)];
  }

  function clearSelectedGroups() {
    groupCleanupState.selected = {};
  }

  function getSelectedGroupIds() {
    return Object.keys(groupCleanupState.selected);
  }

  function selectedGroupRows() {
    return getSelectedGroupIds().map(function (id) {
      return groupCleanupState.selected[id];
    });
  }

  function updateGroupBulkBar() {
    var bar = document.getElementById('group-cleanup-bulk');
    var countEl = document.getElementById('group-bulk-count');
    var mergeSection = document.getElementById('group-merge-section');
    var primarySelect = document.getElementById('group-merge-primary');
    var chipsEl = document.getElementById('group-selected-chips');
    var ids = getSelectedGroupIds();
    var rows = selectedGroupRows();
    if (countEl) countEl.textContent = String(ids.length);
    if (bar) bar.classList.toggle('hidden', ids.length === 0);
    if (mergeSection) mergeSection.classList.toggle('hidden', ids.length < 2);
    var deleteSection = document.getElementById('group-delete-section');
    if (deleteSection) deleteSection.classList.toggle('hidden', ids.length === 0);
    if (chipsEl) {
      chipsEl.innerHTML = rows
        .map(function (o) {
          var label = o.name || 'Untitled';
          if (o.email) label += ' (' + o.email + ')';
          return (
            '<span class="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white px-2.5 py-0.5 text-xs text-brand-900">' +
            '<span class="truncate max-w-[14rem]" title="' +
            attrEsc(label) +
            '">' +
            esc(label) +
            '</span>' +
            '<button type="button" class="group-unselect shrink-0 text-slate-400 hover:text-red-700 font-bold leading-none" data-unselect-group="' +
            attrEsc(o.id) +
            '" aria-label="Remove ' +
            attrEsc(o.name || 'group') +
            ' from selection">×</button></span>'
          );
        })
        .join('');
    }
    if (primarySelect) {
      var current = primarySelect.value;
      primarySelect.innerHTML = rows
        .map(function (o) {
          var label = (o.name || 'Untitled') + (o.email ? ' (' + o.email + ')' : '');
          return (
            '<option value="' +
            attrEsc(o.id) +
            '"' +
            (String(current) === String(o.id) ? ' selected' : '') +
            '>' +
            esc(label) +
            '</option>'
          );
        })
        .join('');
      if (!primarySelect.value && rows.length) primarySelect.value = rows[0].id;
    }
    if (main) {
      var selectPage = document.getElementById('group-cleanup-select-page');
      var pageCbs = main.querySelectorAll('.group-select-checkbox');
      var allPageChecked = pageCbs.length > 0;
      pageCbs.forEach(function (cb) {
        if (!groupCleanupState.selected[cb.value]) allPageChecked = false;
      });
      if (selectPage) selectPage.checked = allPageChecked;
    }
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

  function adminPaginationHtml(page, total, pageSize, dataAttr) {
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (totalPages <= 1) return '';
    var attr = dataAttr || 'data-admin-page';
    var parts = [];
    function btn(p, label, active, disabled) {
      if (disabled) {
        return (
          '<span class="admin-page-btn admin-page-btn--disabled" aria-disabled="true">' + esc(label) + '</span>'
        );
      }
      if (active) {
        return (
          '<span class="admin-page-btn admin-page-btn--active" aria-current="page">' + esc(label) + '</span>'
        );
      }
      return (
        '<button type="button" class="admin-page-btn" ' +
        attr +
        '="' +
        p +
        '">' +
        esc(label) +
        '</button>'
      );
    }
    parts.push(btn(page - 1, '← Prev', false, page <= 0));
    var i = 0;
    while (i < totalPages) {
      if (i === 0 || i === totalPages - 1 || (i >= page - 2 && i <= page + 2)) {
        parts.push(btn(i, String(i + 1), i === page, false));
        i += 1;
      } else if (i < page - 2) {
        parts.push('<span class="admin-page-ellipsis">…</span>');
        i = Math.max(i + 1, page - 2);
      } else {
        parts.push('<span class="admin-page-ellipsis">…</span>');
        i = totalPages - 1;
      }
    }
    parts.push(btn(page + 1, 'Next →', false, page >= totalPages - 1));
    return (
      '<nav class="admin-pagination" aria-label="Page navigation">' +
      parts.join('') +
      '<span class="admin-page-summary">Page ' +
      (page + 1) +
      ' of ' +
      totalPages +
      '</span></nav>'
    );
  }

  function groupCleanupQuickFormHtml(o) {
    return (
      '<form class="group-cleanup-form group-cleanup-quick-form" data-organiser-id="' +
      attrEsc(o.id) +
      '">' +
      adminLogoFieldHtml(o.id, o.photo_url, true) +
      '<div class="group-cleanup-quick-fields min-w-0 space-y-2">' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Website</label>' +
      '<input type="url" name="website" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" value="' +
      attrEsc(o.website || '') +
      '" placeholder="https://example.com"></div>' +
      '<div class="flex flex-wrap items-center gap-2">' +
      '<button type="button" class="group-fill-from-website rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold px-3 py-1.5 hover:bg-slate-50">Fill logo &amp; description from website</button>' +
      '<span class="text-[11px] text-slate-500">Reads the site’s logo and intro text</span></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Description / bio</label>' +
      '<textarea name="description" rows="3" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="Short intro for this networking group">' +
      esc(o.description || '') +
      '</textarea></div></div>' +
      '<div class="group-cleanup-quick-actions flex flex-col items-stretch gap-2 shrink-0">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900 whitespace-nowrap">Save</button>' +
      '<a href="../organiser/group-edit.html?id=' +
      encodeURIComponent(o.id) +
      '" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline text-center">Full editor</a>' +
      '<span class="group-cleanup-msg text-xs text-center"></span></div></form>'
    );
  }

  function applyLogoPreviewToForm(form, logoUrl) {
    if (!form) return;
    var urlInput = form.querySelector('input[name="photo_url"]');
    if (urlInput) urlInput.value = logoUrl;
    var key = form.getAttribute('data-organiser-id');
    if (key) delete adminLogoPending[key];
    var zone = form.querySelector('[data-admin-logo-key]');
    if (!zone) return;
    var preview = zone.querySelector('.admin-logo-preview');
    var placeholder = zone.querySelector('.admin-logo-placeholder');
    if (preview && logoUrl) {
      preview.src = logoUrl;
      preview.classList.remove('hidden');
    }
    if (placeholder) placeholder.classList.add('hidden');
  }

  function fillGroupFromWebsite(btn) {
    var form = btn && btn.closest('.group-cleanup-form');
    if (!form) return;
    var msg = form.querySelector('.group-cleanup-msg');
    var website = formFieldVal(form, 'website');
    if (!website) {
      if (msg) {
        msg.textContent = 'Enter a website URL first.';
        msg.className = 'group-cleanup-msg text-xs text-red-700 font-semibold text-center';
      }
      return;
    }
    btn.disabled = true;
    if (msg) {
      msg.textContent = 'Reading website…';
      msg.className = 'group-cleanup-msg text-xs text-slate-500 text-center';
    }
    adminPost('/api/admin/organisers', { action: 'fetch_website_meta', url: website })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Could not read website');
        if (data.logo_url) applyLogoPreviewToForm(form, data.logo_url);
        if (data.description) {
          var desc = form.querySelector('[name="description"]');
          if (desc) desc.value = data.description;
        }
        if (msg) {
          msg.textContent = data.message || 'Filled — review and Save.';
          msg.className = 'group-cleanup-msg text-xs text-emerald-700 font-semibold text-center';
        }
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not read website';
          msg.className = 'group-cleanup-msg text-xs text-red-700 font-semibold text-center';
        }
      })
      .finally(function () {
        btn.disabled = false;
      });
  }

  function refreshGroupCleanupPage() {
    return fetchGroupCleanup(groupCleanupState.page).then(function (data) {
      renderGroupCleanupList(data);
      bindGroupCleanupPageUi();
      updateGroupBulkBar();
      return data;
    });
  }

  function bindExpandedGroupPanels() {
    if (!main) return;
    main.querySelectorAll('.group-cleanup-panel:not(.hidden)').forEach(function (panel) {
      bindAdminLogoZones(panel);
    });
  }

  function goToGroupPage(page) {
    var next = Math.max(0, page);
    var listEl = document.getElementById('group-cleanup-list');
    fetchGroupCleanup(next).then(function (data) {
      renderGroupCleanupList(data);
      bindGroupCleanupPageUi();
      updateGroupBulkBar();
      if (listEl && listEl.scrollIntoView) {
        listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  function fetchGroupCleanup(pageIndex, options) {
    options = options || {};
    if (groupCleanupState.loading) return Promise.resolve(groupCleanupCache);
    groupCleanupState.loading = true;
    var page =
      typeof pageIndex === 'number' && !isNaN(pageIndex) ? Math.max(0, pageIndex) : groupCleanupState.page;
    groupCleanupState.page = page;
    var params = new URLSearchParams();
    params.set('offset', String(page * GROUP_PAGE_SIZE));
    params.set('limit', String(GROUP_PAGE_SIZE));
    if (groupCleanupState.q) params.set('q', groupCleanupState.q);
    if (groupCleanupState.incomplete) params.set('incomplete', '1');
    if (options.organiserId || groupCleanupState.focusOrganiserId) {
      params.set('id', String(options.organiserId || groupCleanupState.focusOrganiserId));
    }
    return adminGet('/api/admin/organisers?' + params.toString())
      .then(function (data) {
        groupCleanupState.loading = false;
        if (!data || data.error) return data;
        groupCleanupCache = data;
        groupCleanupState.total = data.total || (data.organisers || []).length;
        return groupCleanupCache;
      })
      .catch(function () {
        groupCleanupState.loading = false;
        return { error: 'network_error' };
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
    if (eventCleanupState.noDate) params.set('no_date', '1');
    if (eventCleanupState.status) params.set('status', eventCleanupState.status);
    if (eventCleanupState.approval) params.set('approval_status', eventCleanupState.approval);
    if (eventCleanupState.sort) params.set('sort', eventCleanupState.sort);
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

  function createGroupCleanupForm(form) {
    var msg = document.getElementById('group-create-msg');
    var btn = form.querySelector('[type="submit"]');
    var name = formFieldVal(form, 'name').trim();
    var email = formFieldVal(form, 'email').trim();
    if (!name) {
      if (msg) {
        msg.textContent = 'Enter a group name.';
        msg.className = 'text-xs text-red-700 font-semibold';
      }
      return;
    }
    if (!email) {
      if (msg) {
        msg.textContent = 'Enter a contact email.';
        msg.className = 'text-xs text-red-700 font-semibold';
      }
      return;
    }
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Creating group…';
      msg.className = 'text-xs text-slate-500';
    }
    adminPost('/api/admin/organisers', {
      action: 'create_group',
      name: name,
      contact_email: email,
      website: formFieldVal(form, 'website').trim(),
      description: formFieldVal(form, 'description').trim(),
      provision_login: true,
    })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Create failed');
        if (msg) {
          msg.textContent = data.message || 'Group created.';
          msg.className = 'text-xs text-emerald-700 font-semibold';
        }
        var newId = data.organiser && data.organiser.id;
        form.reset();
        groupCleanupState.createOpen = false;
        groupCleanupState.page = 0;
        groupCleanupState.q = '';
        invalidateEventOrganiserOptionsCache();
        var panel = document.getElementById('group-create-panel');
        var toggle = document.getElementById('group-create-toggle');
        if (panel) panel.classList.add('hidden');
        if (toggle) {
          toggle.setAttribute('aria-expanded', 'false');
          toggle.textContent = '+ New networking group';
        }
        var search = document.getElementById('group-cleanup-search');
        if (search) search.value = '';
        if (newId) groupCleanupState.expanded[newId] = true;
        return fetchGroupCleanup(0);
      })
      .then(function (data) {
        renderGroupCleanupList(data);
        bindGroupCleanupPageUi();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not create group';
          msg.className = 'text-xs text-red-700 font-semibold';
        }
      })
      .finally(function () {
        if (btn) btn.disabled = false;
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
        return refreshGroupCleanupPage();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not save';
          msg.className = 'group-cleanup-msg text-xs text-red-700 font-semibold';
        }
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function provisionGroupLogin(organiserId, btn) {
    if (btn) btn.disabled = true;
    return adminPost('/api/admin/organisers', { action: 'provision_user', id: organiserId })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Could not create login');
        return refreshGroupCleanupPage();
      })
      .then(function () {
        updateGroupBulkBar();
      })
      .catch(function (err) {
        window.alert(err.message || 'Could not create login');
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function impersonateOrganiserGroup(organiserId, email) {
    adminPost('/api/admin/impersonate', {
      organiserId: organiserId,
      email: email || '',
      view: 'organiser',
      provision: true,
    })
      .then(function (data) {
        if (!data.ok) {
          window.alert(data.message || data.error || 'Could not impersonate group.');
          return;
        }
        try {
          sessionStorage.removeItem('hub_nav_session_v1');
        } catch (e) {
          /* ignore */
        }
        window.location.href = '../' + String(data.redirect || 'organiser/index.html').replace(/^\//, '');
      })
      .catch(function () {
        window.alert('Request failed. Try again.');
      });
  }

  function setGroupEmailsEnabled(organiserId, enabled, btn) {
    if (btn) btn.disabled = true;
    adminPost('/api/admin/organisers', {
      action: 'set_emails_enabled',
      id: organiserId,
      emails_enabled: enabled,
    })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Could not update emails');
        return refreshGroupCleanupPage();
      })
      .then(function () {
        updateGroupBulkBar();
      })
      .catch(function (err) {
        window.alert(err.message || 'Could not update email setting');
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function mergeSelectedGroups() {
    var ids = getSelectedGroupIds();
    var primarySelect = document.getElementById('group-merge-primary');
    var msg = document.getElementById('group-merge-msg');
    var btn = document.getElementById('group-merge-btn');
    if (ids.length < 2) return;

    var primaryId = primarySelect ? primarySelect.value : ids[0];
    var rows = selectedGroupRows();
    var primary = rows.find(function (o) {
      return String(o.id) === String(primaryId);
    });
    var duplicateCount = ids.length - 1;
    var primaryLabel = (primary && primary.name) || 'selected group';
    var confirmMsg =
      'Merge ' +
      duplicateCount +
      ' duplicate group' +
      (duplicateCount === 1 ? '' : 's') +
      ' into "' +
      primaryLabel +
      '"?\n\n' +
      'Events will move to the primary profile. Other account owners will be added as team editors. Duplicate profiles will be deleted. This cannot be undone.';
    if (!window.confirm(confirmMsg)) return;

    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Merging groups…';
      msg.className = 'text-xs text-slate-500';
    }

    adminPost('/api/admin/organisers', {
      action: 'merge_groups',
      primaryId: primaryId,
      ids: ids,
    })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Merge failed');
        clearSelectedGroups();
        if (msg) {
          msg.textContent =
            'Merged ' +
            (data.merged || duplicateCount) +
            ' group' +
            ((data.merged || duplicateCount) === 1 ? '' : 's') +
            ', moved ' +
            (data.eventsMoved || 0) +
            ' event' +
            ((data.eventsMoved || 0) === 1 ? '' : 's') +
            ', added ' +
            (data.teamAdded || 0) +
            ' team member' +
            ((data.teamAdded || 0) === 1 ? '' : 's') +
            '.';
          msg.className = 'text-xs text-emerald-700 font-semibold';
        }
        invalidateEventOrganiserOptionsCache();
        return fetchGroupCleanup(0);
      })
      .then(function (data) {
        renderGroupCleanupList(data);
        bindGroupCleanupPageUi();
        updateGroupBulkBar();
        if (btn) btn.disabled = false;
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = err.message || 'Could not merge groups';
          msg.className = 'text-xs text-red-700 font-semibold';
        }
        if (btn) btn.disabled = false;
      });
  }

  function groupDeleteConfirmMsg(count, label, eventCount) {
    var msg =
      'Delete ' +
      (count === 1 && label ? '"' + label + '"' : count + ' selected group' + (count === 1 ? '' : 's')) +
      '?\n\n';
    if (eventCount > 0) {
      msg +=
        eventCount +
        ' linked event' +
        (eventCount === 1 ? '' : 's') +
        ' will become unlinked from a group profile. ';
    }
    msg += 'This cannot be undone.';
    return msg;
  }

  function groupDeleteResultMsg(data, requestedCount) {
    if (data.message) return data.message;
    var deleted = data.deleted || 0;
    var alreadyGone = data.alreadyGone || 0;
    if (!deleted && alreadyGone) {
      var goneMsg =
        alreadyGone === 1
          ? 'Group profile was already removed'
          : alreadyGone + ' group profiles were already removed';
      if (data.eventsUnlinked) {
        goneMsg +=
          ' — cleared ' +
          data.eventsUnlinked +
          ' broken event link' +
          (data.eventsUnlinked === 1 ? '' : 's');
      }
      return goneMsg + '.';
    }
    var msg =
      'Deleted ' +
      (deleted || requestedCount) +
      ' group' +
      ((deleted || requestedCount) === 1 ? '' : 's');
    if (data.eventsUnlinked) {
      msg +=
        ', ' +
        data.eventsUnlinked +
        ' event' +
        (data.eventsUnlinked === 1 ? '' : 's') +
        ' unlinked';
    }
    if (alreadyGone) {
      msg +=
        ' (' +
        alreadyGone +
        ' profile' +
        (alreadyGone === 1 ? ' was' : 's were') +
        ' already removed)';
    }
    return msg + '.';
  }

  function showGroupDeleteFeedback(row, text, isError) {
    if (!row) return;
    var slot = row.querySelector('.group-delete-feedback');
    if (!slot) {
      slot = document.createElement('p');
      slot.className = 'group-delete-feedback text-xs mt-1';
      var header = row.querySelector('.flex.flex-wrap.items-center.justify-between');
      if (header) header.appendChild(slot);
    }
    slot.textContent = text;
    slot.className =
      'group-delete-feedback text-xs mt-1 ' +
      (isError ? 'text-red-700 font-semibold' : 'text-emerald-700 font-semibold');
  }

  function deleteGroupsByIds(ids, opts) {
    opts = opts || {};
    var msgEl = opts.msgEl;
    var btn = opts.btn;
    var row = opts.row;
    if (!ids.length) return;

    if (btn) btn.disabled = true;
    if (row) showGroupDeleteFeedback(row, 'Deleting…', false);
    if (msgEl) {
      msgEl.textContent = 'Deleting group' + (ids.length === 1 ? '' : 's') + '…';
      msgEl.className = 'text-xs text-slate-500';
    }

    adminPost('/api/admin/organisers', { action: 'delete_groups', ids: ids })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || data.error || 'Delete failed');
        ids.forEach(function (id) {
          forgetSelectedGroup(id);
          delete groupCleanupState.expanded[id];
        });
        var resultMsg = groupDeleteResultMsg(data, ids.length);
        if (msgEl) {
          msgEl.textContent = resultMsg;
          msgEl.className = 'text-xs text-emerald-700 font-semibold';
        }
        if (row) showGroupDeleteFeedback(row, resultMsg, false);
        invalidateEventOrganiserOptionsCache();
        return fetchGroupCleanup(groupCleanupState.page);
      })
      .then(function (data) {
        renderGroupCleanupList(data);
        bindGroupCleanupPageUi();
        updateGroupBulkBar();
        if (btn) btn.disabled = false;
      })
      .catch(function (err) {
        var errMsg = err.message || 'Could not delete groups';
        if (msgEl) {
          msgEl.textContent = errMsg;
          msgEl.className = 'text-xs text-red-700 font-semibold';
        }
        if (row) showGroupDeleteFeedback(row, errMsg, true);
        if (btn) btn.disabled = false;
      });
  }

  function deleteSelectedGroups() {
    var ids = getSelectedGroupIds();
    if (!ids.length) return;
    var rows = selectedGroupRows();
    var eventCount = rows.reduce(function (sum, o) {
      return sum + (o.event_count || 0);
    }, 0);
    if (!window.confirm(groupDeleteConfirmMsg(ids.length, null, eventCount))) return;
    deleteGroupsByIds(ids, {
      msgEl: document.getElementById('group-delete-msg'),
      btn: document.getElementById('group-delete-btn'),
    });
  }

  function deleteSingleGroup(id, name, eventCount, btn) {
    if (!id) return;
    if (!window.confirm(groupDeleteConfirmMsg(1, name || 'this group', eventCount || 0))) return;
    var row = btn && btn.closest('[data-organiser-id-row]');
    deleteGroupsByIds([id], { btn: btn, row: row });
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
        clearSelectedGroups();
        if (msg) {
          msg.textContent = 'Updated ' + (data.updated || ids.length) + ' groups.';
          msg.className = 'text-xs text-emerald-700 font-semibold';
        }
        return refreshGroupCleanupPage();
      })
      .then(function () {
        updateGroupBulkBar();
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
      event_type: formFieldVal(form, 'event_type') || 'Meeting',
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

  function bindGroupCleanupPageUi() {
    bindExpandedGroupPanels();
    var bulk = document.getElementById('group-cleanup-bulk');
    if (bulk) bindAdminLogoZones(bulk);
  }

  function handleGroupCleanupClick(e) {
    var resolveDisputeBtn = e.target.closest('[data-resolve-claim-dispute]');
    if (resolveDisputeBtn) {
      var disputeId = resolveDisputeBtn.getAttribute('data-resolve-claim-dispute');
      if (!disputeId) return;
      if (!window.confirm('Mark this dispute as resolved? The alert will clear from Command Centre.')) return;
      resolveDisputeBtn.disabled = true;
      adminPost('/api/admin/organisers', { action: 'resolve_claim_dispute', disputeId: disputeId })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.message) || 'Could not resolve dispute');
          return refreshAdminNotifications();
        })
        .catch(function (err) {
          resolveDisputeBtn.disabled = false;
          window.alert(err.message || 'Could not resolve dispute.');
        });
      return;
    }

    var clearDisputeBtn = e.target.closest('[data-clear-dispute-email]');
    if (clearDisputeBtn) {
      var clearDisputeId = clearDisputeBtn.getAttribute('data-clear-dispute-email');
      var clearName = clearDisputeBtn.getAttribute('data-dispute-organiser-name') || 'this group';
      if (!clearDisputeId) return;
      if (
        !window.confirm(
          'Clear the contact email on “' +
            clearName +
            '” and mark this dispute resolved? The user will no longer be matched to this profile on login.'
        )
      ) {
        return;
      }
      clearDisputeBtn.disabled = true;
      adminPost('/api/admin/organisers', { action: 'clear_disputed_profile_email', disputeId: clearDisputeId })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.message) || 'Could not clear profile email');
          return refreshAdminNotifications().then(function () {
            if (document.getElementById('group-cleanup-list')) return refreshGroupCleanupPage();
          });
        })
        .catch(function (err) {
          clearDisputeBtn.disabled = false;
          window.alert(err.message || 'Could not clear profile email.');
        });
      return;
    }

    var deleteDisputeBtn = e.target.closest('[data-dispute-delete-profile]');
    if (deleteDisputeBtn) {
      var deleteDisputeId = deleteDisputeBtn.getAttribute('data-dispute-delete-profile');
      var deleteOrganiserId = deleteDisputeBtn.getAttribute('data-dispute-organiser-id');
      var deleteName = deleteDisputeBtn.getAttribute('data-dispute-organiser-name') || 'this group';
      if (!deleteDisputeId || !deleteOrganiserId) return;
      if (
        !window.confirm(
          'Permanently delete “' +
            deleteName +
            '”? Linked events will stay on the platform but become unlinked. The dispute will be marked resolved.'
        )
      ) {
        return;
      }
      deleteDisputeBtn.disabled = true;
      adminPost('/api/admin/organisers', { action: 'delete_groups', ids: [deleteOrganiserId] })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.message) || 'Could not delete profile');
          return adminPost('/api/admin/organisers', { action: 'resolve_claim_dispute', disputeId: deleteDisputeId });
        })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.message) || 'Profile deleted but dispute not cleared');
          return refreshAdminNotifications().then(function () {
            if (document.getElementById('group-cleanup-list')) return refreshGroupCleanupPage();
          });
        })
        .catch(function (err) {
          deleteDisputeBtn.disabled = false;
          window.alert(err.message || 'Could not delete profile.');
        });
      return;
    }

    if (!document.getElementById('group-cleanup-list')) return;

    var pageBtn = e.target.closest('[data-group-page]');
    if (pageBtn) {
      var page = parseInt(pageBtn.getAttribute('data-group-page'), 10);
      if (!isNaN(page)) goToGroupPage(page);
      return;
    }

    var toggle = e.target.closest('[data-toggle-group-edit]');
    if (toggle) {
      var row = toggle.closest('[data-organiser-id-row]');
      var id = row && row.getAttribute('data-organiser-id-row');
      var panel = row && row.querySelector('.group-cleanup-panel');
      if (panel && id) {
        var opening = panel.classList.contains('hidden');
        panel.classList.toggle('hidden');
        if (opening) {
          groupCleanupState.expanded[id] = true;
          bindAdminLogoZones(panel);
          toggle.textContent = 'Close';
        } else {
          delete groupCleanupState.expanded[id];
          toggle.textContent = 'Edit profile';
        }
      }
      return;
    }

    var fillBtn = e.target.closest('.group-fill-from-website');
    if (fillBtn) {
      fillGroupFromWebsite(fillBtn);
      return;
    }

    if (e.target.closest('#group-create-toggle')) {
      var createPanel = document.getElementById('group-create-panel');
      var createToggle = document.getElementById('group-create-toggle');
      if (!createPanel || !createToggle) return;
      groupCleanupState.createOpen = !groupCleanupState.createOpen;
      createPanel.classList.toggle('hidden', !groupCleanupState.createOpen);
      createToggle.setAttribute('aria-expanded', groupCleanupState.createOpen ? 'true' : 'false');
      createToggle.textContent = groupCleanupState.createOpen
        ? 'Cancel new group'
        : '+ New networking group';
      if (groupCleanupState.createOpen) {
        var nameInput = createPanel.querySelector('[name="name"]');
        if (nameInput) nameInput.focus();
      }
      return;
    }

    if (e.target.closest('#group-bulk-clear')) {
      clearSelectedGroups();
      if (main) {
        main.querySelectorAll('.group-select-checkbox').forEach(function (cb) {
          cb.checked = false;
        });
      }
      var selectPage = document.getElementById('group-cleanup-select-page');
      if (selectPage) selectPage.checked = false;
      updateGroupBulkBar();
      return;
    }

    var unselectBtn = e.target.closest('[data-unselect-group]');
    if (unselectBtn) {
      var unselectId = unselectBtn.getAttribute('data-unselect-group');
      forgetSelectedGroup(unselectId);
      if (main) {
        main.querySelectorAll('.group-select-checkbox').forEach(function (cb) {
          if (String(cb.value) === String(unselectId)) cb.checked = false;
        });
      }
      updateGroupBulkBar();
      return;
    }

    if (e.target.closest('#group-merge-btn')) {
      mergeSelectedGroups();
      return;
    }

    if (e.target.closest('#group-delete-btn')) {
      deleteSelectedGroups();
      return;
    }

    var deleteGroupBtn = e.target.closest('[data-delete-group]');
    if (deleteGroupBtn) {
      deleteSingleGroup(
        deleteGroupBtn.getAttribute('data-delete-group'),
        deleteGroupBtn.getAttribute('data-group-name'),
        parseInt(deleteGroupBtn.getAttribute('data-group-event-count'), 10) || 0,
        deleteGroupBtn
      );
      return;
    }

    var provisionBtn = e.target.closest('[data-provision-group-login]');
    if (provisionBtn) {
      provisionGroupLogin(provisionBtn.getAttribute('data-provision-group-login'), provisionBtn);
      return;
    }

    var impersonateGroupBtn = e.target.closest('[data-impersonate-group]');
    if (impersonateGroupBtn) {
      impersonateOrganiserGroup(
        impersonateGroupBtn.getAttribute('data-impersonate-group'),
        impersonateGroupBtn.getAttribute('data-group-email')
      );
      return;
    }

    var enableEmailsBtn = e.target.closest('[data-enable-group-emails]');
    if (enableEmailsBtn) {
      setGroupEmailsEnabled(enableEmailsBtn.getAttribute('data-enable-group-emails'), true, enableEmailsBtn);
      return;
    }

    var disableEmailsBtn = e.target.closest('[data-disable-group-emails]');
    if (disableEmailsBtn) {
      if (
        !window.confirm(
          'Block emails for this group? They will not receive invites, reminders, or password-reset emails until you enable them again.'
        )
      ) {
        return;
      }
      setGroupEmailsEnabled(disableEmailsBtn.getAttribute('data-disable-group-emails'), false, disableEmailsBtn);
    }
  }

  function bindGroupCleanupForms() {
    if (window.__groupCleanupEventsBound) return;
    window.__groupCleanupEventsBound = true;

    document.body.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.classList || !form.closest('#admin-main')) return;
      if (form.id === 'group-create-form') {
        e.preventDefault();
        createGroupCleanupForm(form);
      } else if (form.classList.contains('group-cleanup-form')) {
        e.preventDefault();
        saveGroupCleanupForm(form);
      } else if (form.id === 'group-bulk-form') {
        e.preventDefault();
        saveGroupBulkForm(form);
      }
    });

    document.body.addEventListener('input', function (e) {
      if (e.target.id !== 'group-cleanup-search') return;
      clearTimeout(groupSearchTimer);
      groupSearchTimer = setTimeout(function () {
        groupCleanupState.q = e.target.value || '';
        groupCleanupState.page = 0;
        fetchGroupCleanup(0).then(function (data) {
          renderGroupCleanupList(data);
          bindGroupCleanupPageUi();
        });
      }, 300);
    });

    document.body.addEventListener('change', function (e) {
      if (e.target.id === 'group-cleanup-incomplete') {
        groupCleanupState.incomplete = e.target.checked;
        groupCleanupState.page = 0;
        fetchGroupCleanup(0).then(function (data) {
          renderGroupCleanupList(data);
          bindGroupCleanupPageUi();
        });
        return;
      }
      if (e.target.classList && e.target.classList.contains('group-select-checkbox')) {
        var gid = e.target.value;
        if (e.target.checked) {
          var organisers = (groupCleanupCache && groupCleanupCache.organisers) || [];
          var row = organisers.find(function (o) {
            return String(o.id) === String(gid);
          });
          if (row) rememberSelectedGroup(row);
        } else forgetSelectedGroup(gid);
        updateGroupBulkBar();
        return;
      }
      if (e.target.id === 'group-cleanup-select-page' && main) {
        var pageOrganisers = (groupCleanupCache && groupCleanupCache.organisers) || [];
        main.querySelectorAll('.group-select-checkbox').forEach(function (cb) {
          cb.checked = e.target.checked;
          if (e.target.checked) {
            var pageRow = pageOrganisers.find(function (o) {
              return String(o.id) === String(cb.value);
            });
            if (pageRow) rememberSelectedGroup(pageRow);
          } else forgetSelectedGroup(cb.value);
        });
        updateGroupBulkBar();
      }
    });

    document.body.addEventListener('click', handleGroupCleanupClick);
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
        syncEventCleanupFilterUi();
        refreshEventCleanupData();
      }
      if (e.target.id === 'event-cleanup-no-date') {
        eventCleanupState.noDate = e.target.checked;
        syncEventCleanupFilterUi();
        refreshEventCleanupData();
      }
      if (e.target.id === 'event-cleanup-status-filter') {
        eventCleanupState.status = e.target.value || '';
        syncEventCleanupFilterUi();
        refreshEventCleanupData();
      }
      if (e.target.id === 'event-cleanup-approval-filter') {
        eventCleanupState.approval = e.target.value || '';
        syncEventCleanupFilterUi();
        refreshEventCleanupData();
      }
      if (e.target.id === 'event-cleanup-sort') {
        eventCleanupState.sort = e.target.value || 'recent';
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
      var toggle = e.target.closest('[data-toggle-event-edit]');
      if (toggle) {
        var row = toggle.closest('[data-event-id-row]');
        var panel = row && row.nextElementSibling;
        if (panel && panel.classList.contains('event-cleanup-panel')) {
          var opening = panel.classList.contains('hidden');
          main.querySelectorAll('.event-cleanup-panel').forEach(function (p) {
            p.classList.add('hidden');
          });
          if (opening) panel.classList.remove('hidden');
        }
        return;
      }
      var quick = e.target.closest('[data-event-quick]');
      if (quick) {
        var key = quick.getAttribute('data-event-quick');
        if (key === 'clear') {
          eventCleanupState.organiserId = '';
          eventCleanupState.unlinked = false;
          eventCleanupState.noDate = false;
          eventCleanupState.status = '';
          eventCleanupState.approval = '';
          eventCleanupState.q = '';
        } else if (key === 'unlinked') {
          eventCleanupState.unlinked = !eventCleanupState.unlinked;
        } else if (key === 'no_date') {
          eventCleanupState.noDate = !eventCleanupState.noDate;
        } else if (key === 'draft') {
          eventCleanupState.status = eventCleanupState.status === 'draft' ? '' : 'draft';
        } else if (key === 'pending') {
          eventCleanupState.approval =
            eventCleanupState.approval === 'Pending Review' ? '' : 'Pending Review';
        }
        syncEventCleanupFilterUi();
        refreshEventCleanupData();
        return;
      }
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
    var page = groupCleanupState.page;
    var pageStart = page * GROUP_PAGE_SIZE + 1;
    var pageEnd = page * GROUP_PAGE_SIZE + organisers.length;
    var total = groupCleanupState.total || organisers.length;

    if (status) {
      status.innerHTML =
        '<span class="text-brand-900 font-semibold">' +
        (organisers.length
          ? 'Showing ' + pageStart + '–' + pageEnd + ' of ' + total + ' group' + (total === 1 ? '' : 's')
          : 'No groups on this page') +
        '</span>' +
        (data.incomplete
          ? ' <span class="text-slate-500">(' + data.incomplete + ' with missing profile data)</span>'
          : '') +
        (groupCleanupState.loading ? ' <span class="text-slate-400">Loading…</span>' : '');
    }

    if (!organisers.length) {
      list.innerHTML =
        '<p class="text-sm text-slate-500 rounded-xl border border-dashed border-slate-300 p-8 text-center">No groups match your filters.</p>' +
        adminPaginationHtml(page, total, GROUP_PAGE_SIZE, 'data-group-page');
      return;
    }

    list.innerHTML =
      organisers
        .map(function (o) {
          var publicHref = o.slug ? '../organisers/' + encodeURIComponent(o.slug) : '';
          var missingHtml =
            (o.missing || []).map(missingBadge).join('') ||
            '<span class="text-xs text-emerald-700">Complete</span>';
          var loginBadge = !o.has_login
            ? '<span class="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">No login</span>'
            : o.emails_enabled === false
              ? '<span class="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">Emails off</span>'
              : '<span class="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Login ready</span>';
          if (groupCleanupState.selected[o.id]) rememberSelectedGroup(o);
          var checked = groupCleanupState.selected[o.id] ? ' checked' : '';
          var incomplete = (o.missing || []).length > 0;
          var isOpen = !!groupCleanupState.expanded[o.id];
          return (
            '<article class="rounded-xl border bg-white shadow-sm' +
            (incomplete ? ' border-amber-200 ring-1 ring-amber-100' : ' border-slate-200') +
            '" data-organiser-id-row="' +
            attrEsc(o.id) +
            '">' +
            '<div class="flex flex-wrap items-center justify-between gap-2 p-3">' +
            '<div class="flex items-start gap-2.5 min-w-0 flex-1">' +
            '<input type="checkbox" class="group-select-checkbox mt-0.5 rounded border-slate-300" value="' +
            attrEsc(o.id) +
            '"' +
            checked +
            ' aria-label="Select ' +
            attrEsc(o.name || 'group') +
            '">' +
            '<div class="min-w-0">' +
            '<div class="flex flex-wrap items-center gap-2">' +
            '<h3 class="text-sm font-semibold text-brand-900 truncate">' +
            esc(o.name || 'Untitled') +
            '</h3>' +
            listingStatusBadge(o.listing_status) +
            loginBadge +
            '</div>' +
            '<p class="text-xs text-slate-500 mt-0.5">' +
            (o.email ? esc(o.email) + ' · ' : '') +
            (o.event_count || 0) +
            ' event' +
            (o.event_count === 1 ? '' : 's') +
            ' · ' +
            missingHtml +
            (o.website && !isOpen ? ' · ' + esc(o.website) : '') +
            '</p></div></div>' +
            '<div class="flex flex-wrap gap-1.5 shrink-0">' +
            (publicHref
              ? '<a href="' +
                attrEsc(publicHref) +
                '" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline px-1 py-1">View</a>'
              : '') +
            (!o.has_login && o.email
              ? '<button type="button" data-provision-group-login="' +
                attrEsc(o.id) +
                '" class="text-xs font-semibold rounded-lg border border-brand-200 text-brand-800 px-2.5 py-1 hover:bg-brand-50">Create login</button>'
              : '') +
            (o.email || o.has_login
              ? '<button type="button" data-impersonate-group="' +
                attrEsc(o.id) +
                '" data-group-email="' +
                attrEsc(o.email || '') +
                '" class="text-xs font-semibold rounded-lg border border-brand-700 text-brand-700 px-2.5 py-1 hover:bg-brand-50">Impersonate</button>'
              : '') +
            (o.has_login
              ? o.emails_enabled === false
                ? '<button type="button" data-enable-group-emails="' +
                  attrEsc(o.id) +
                  '" class="text-xs font-semibold rounded-lg border border-emerald-200 text-emerald-800 px-2.5 py-1 hover:bg-emerald-50">Enable emails</button>'
                : '<button type="button" data-disable-group-emails="' +
                  attrEsc(o.id) +
                  '" class="text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 px-2.5 py-1 hover:bg-slate-50">Block emails</button>'
              : '') +
            '<button type="button" data-toggle-group-edit="1" class="text-xs font-semibold rounded-lg bg-brand-700 text-white px-2.5 py-1 hover:bg-brand-900">' +
            (isOpen ? 'Close' : 'Edit profile') +
            '</button>' +
            '<button type="button" data-delete-group="' +
            attrEsc(o.id) +
            '" data-group-name="' +
            attrEsc(o.name || '') +
            '" data-group-event-count="' +
            String(o.event_count || 0) +
            '" class="text-xs font-semibold rounded-lg border border-red-200 text-red-700 px-2.5 py-1 hover:bg-red-50">Delete</button></div></div>' +
            '<div class="group-cleanup-panel border-t border-slate-100 bg-slate-50/80 px-4 py-3' +
            (isOpen ? '' : ' hidden') +
            '">' +
            groupCleanupQuickFormHtml(o) +
            '</div></article>'
          );
        })
        .join('') +
      adminPaginationHtml(page, total, GROUP_PAGE_SIZE, 'data-group-page');
    updateGroupBulkBar();
  }

  function renderGroupCleanup(fullHash) {
    var query = parseAdminHashQuery(fullHash || (location.hash || '').replace('#', ''));
    var focusId = String(query.get('organiser') || query.get('id') || '').trim();
    groupCleanupState.focusOrganiserId = focusId;
    if (focusId) groupCleanupState.expanded[focusId] = true;

    groupCleanupState.loading = false;
    main.innerHTML =
      '<div class="space-y-4">' +
      '<section class="rounded-xl border border-red-200 bg-white p-4 shadow-sm space-y-3">' +
      '<div><h3 class="font-bold text-brand-900">Group profile disputes</h3>' +
      '<p class="text-xs text-slate-500 mt-0.5">When an organiser says a pre-imported profile is not theirs, use Edit profile, Clear profile email, or Delete profile — then Mark resolved if needed.</p></div>' +
      '<div id="group-claim-disputes"><p class="text-sm text-slate-500">Loading disputes…</p></div></section>' +
      '<div class="flex flex-wrap items-center justify-between gap-3">' +
      '<div id="group-cleanup-status" class="text-sm text-slate-500">Loading groups…</div>' +
      '<button type="button" id="group-create-toggle" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900 shrink-0" aria-expanded="' +
      (groupCleanupState.createOpen ? 'true' : 'false') +
      '" aria-controls="group-create-panel">' +
      (groupCleanupState.createOpen ? 'Cancel new group' : '+ New networking group') +
      '</button></div>' +
      '<div id="group-create-panel" class="rounded-xl border border-brand-200 bg-brand-50/80 p-4 shadow-sm space-y-3' +
      (groupCleanupState.createOpen ? '' : ' hidden') +
      '">' +
      '<h3 class="text-sm font-semibold text-brand-900">New networking group</h3>' +
      '<p class="text-xs text-slate-600">Creates a draft group profile and adds a login for the contact email. No emails are sent.</p>' +
      '<form id="group-create-form" class="grid sm:grid-cols-2 gap-3">' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1" for="group-create-name">Group name</label>' +
      '<input type="text" id="group-create-name" name="name" required class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="e.g. Catalyst Networking Club"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1" for="group-create-email">Contact email</label>' +
      '<input type="email" id="group-create-email" name="email" required autocomplete="email" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="hello@theircompany.com"></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1" for="group-create-website">Website <span class="font-normal text-slate-400">(optional)</span></label>' +
      '<input type="url" id="group-create-website" name="website" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="https://…"></div>' +
      '<div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 mb-1" for="group-create-description">Description <span class="font-normal text-slate-400">(optional)</span></label>' +
      '<textarea id="group-create-description" name="description" rows="3" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="Short intro for this networking group"></textarea></div>' +
      '<div class="sm:col-span-2 flex flex-wrap items-center gap-3">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Create group</button>' +
      '<span id="group-create-msg" class="text-xs"></span></div></form></div>' +
      '<div id="group-cleanup-bulk" class="hidden rounded-xl border border-brand-200 bg-brand-50 p-4 shadow-sm space-y-3">' +
      '<form id="group-bulk-form" class="space-y-3">' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
      '<p class="text-sm font-semibold text-brand-900"><span id="group-bulk-count">0</span> groups selected</p>' +
      '<button type="button" id="group-bulk-clear" class="text-xs font-semibold text-slate-600 hover:text-brand-900">Clear selection</button></div>' +
      '<p class="text-xs text-slate-600">Search again to add more groups — your selection is kept until you merge, delete, or clear.</p>' +
      '<div id="group-selected-chips" class="flex flex-wrap gap-1.5"></div>' +
      '<p class="text-xs text-slate-600">Only filled-in fields are applied to every selected group.</p>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Description / bio</label>' +
      '<textarea name="bulk_description" rows="3" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="Leave blank to keep existing bios"></textarea></div>' +
      adminLogoFieldHtml('bulk', '') +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1">Website</label>' +
      '<input type="url" name="bulk_website" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm" placeholder="https://…"></div>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900">Apply to selected</button>' +
      '<span id="group-bulk-msg" class="text-xs"></span></div></form>' +
      '<div id="group-merge-section" class="hidden border-t border-brand-200 pt-4 space-y-3">' +
      '<p class="text-sm font-semibold text-brand-900">Merge duplicate groups</p>' +
      '<p class="text-xs text-slate-600">Pick the profile to keep. Other selected groups are removed; their events move to the primary profile and their account owners become team editors.</p>' +
      '<div><label class="block text-xs font-semibold text-slate-500 mb-1" for="group-merge-primary">Keep this profile</label>' +
      '<select id="group-merge-primary" class="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm"></select></div>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="button" id="group-merge-btn" class="rounded-lg bg-amber-600 text-white text-sm font-semibold px-4 py-2 hover:bg-amber-700">Merge into primary</button>' +
      '<span id="group-merge-msg" class="text-xs"></span></div></div>' +
      '<div id="group-delete-section" class="hidden border-t border-brand-200 pt-4 space-y-3">' +
      '<p class="text-sm font-semibold text-brand-900">Delete selected groups</p>' +
      '<p class="text-xs text-slate-600">Permanently remove the selected group profiles. Linked events stay on the platform but become unlinked.</p>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="button" id="group-delete-btn" class="rounded-lg bg-red-600 text-white text-sm font-semibold px-4 py-2 hover:bg-red-700">Delete selected</button>' +
      '<span id="group-delete-msg" class="text-xs"></span></div></div></div>' +
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
      '<p class="text-xs text-slate-500">Compact rows — click <strong>Edit profile</strong> to expand. Use page numbers below to browse.</p>' +
      '<div id="group-cleanup-list" class="space-y-2"></div></div>';

    groupCleanupState.page = 0;
    refreshAdminNotifications();
    fetchGroupCleanup(0, { organiserId: focusId })
      .then(function (data) {
        renderGroupCleanupList(data || { error: 'load_failed' });
        bindGroupCleanupPageUi();
        if (focusId) focusOrganiserInGroupCleanup(focusId);
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
    renderEventCleanupList();
    attachEventLoadMore();
    fetchEventOrganiserOptions().then(populateEventOrganiserSelects);
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
    var hint = document.getElementById('event-cleanup-hint');
    if (!list || !eventCleanupCache) return;

    var data = eventCleanupCache;
    var organisers =
      eventOrganiserOptionsCache || (data.organisers || []).map(normalizeOrganiserOption);
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
            ' unlinked in catalogue</span>'
        );
      }
      if (eventCleanupState.loading) {
        parts.push('<span class="text-slate-400">Loading…</span>');
      }
      status.innerHTML = parts.join(' · ');
    }

    if (hint) {
      if (total > 100 && !eventCleanupHasActiveFilters()) {
        hint.classList.remove('hidden');
      } else {
        hint.classList.add('hidden');
      }
    }

    if (!events.length) {
      list.innerHTML =
        '<p class="text-sm text-slate-500 rounded-xl border border-dashed border-slate-300 p-8 text-center">No events match your filters. Try search, quick filters, or create a new event below.</p>';
      return;
    }

    var rows = events
      .map(function (ev) {
        var publicHref = ev.slug ? '../events/' + encodeURIComponent(ev.slug) : '';
        var organiserLabel = ev.organiser_name
          ? esc(ev.organiser_name)
          : '<span class="text-amber-800 font-semibold">Unlinked</span>';
        var dateLabel = ev.starts_at
          ? esc(fmtTime(ev.starts_at))
          : '<span class="text-slate-400">No date</span>';
        return (
          '<tr class="border-b border-slate-100 hover:bg-slate-50/80" data-event-id-row="' +
          attrEsc(ev.id) +
          '">' +
          '<td class="py-2.5 pr-3 max-w-[14rem]"><div class="font-semibold text-brand-900 truncate" title="' +
          attrEsc(ev.title || 'Untitled') +
          '">' +
          esc(ev.title || 'Untitled') +
          '</div>' +
          (ev.city ? '<div class="text-[11px] text-slate-500 truncate">' + esc(ev.city) + '</div>' : '') +
          '</td>' +
          '<td class="py-2.5 pr-3 text-xs text-slate-600 max-w-[10rem]"><span class="block truncate">' +
          organiserLabel +
          '</span></td>' +
          '<td class="py-2.5 pr-3 text-xs text-slate-600 whitespace-nowrap">' +
          dateLabel +
          '</td>' +
          '<td class="py-2.5 pr-3"><div class="flex flex-wrap gap-1">' +
          listingStatusBadge(ev.status) +
          approvalStatusBadge(ev.approval_status) +
          '</div></td>' +
          '<td class="py-2.5 text-right whitespace-nowrap">' +
          '<div class="flex flex-wrap justify-end gap-2">' +
          (publicHref
            ? '<a href="' +
              attrEsc(publicHref) +
              '" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-700 hover:underline">View</a>'
            : '') +
          '<button type="button" data-toggle-event-edit class="text-xs font-semibold rounded-lg bg-brand-700 text-white px-2.5 py-1 hover:bg-brand-900">Edit</button>' +
          '</div></td></tr>' +
          '<tr class="event-cleanup-panel hidden border-b border-slate-200 bg-slate-50/80">' +
          '<td colspan="5" class="p-4">' +
          eventCleanupEditFormHtml(ev, organisers) +
          '</td></tr>'
        );
      })
      .join('');

    list.innerHTML =
      adminTableScroll(
        '<table class="w-full text-sm text-left border-collapse">' +
          '<thead class="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">' +
          '<tr>' +
          '<th class="py-2 pr-3 font-semibold">Event</th>' +
          '<th class="py-2 pr-3 font-semibold">Organiser</th>' +
          '<th class="py-2 pr-3 font-semibold">Date</th>' +
          '<th class="py-2 pr-3 font-semibold">Status</th>' +
          '<th class="py-2 font-semibold text-right">Actions</th>' +
          '</tr></thead><tbody>' +
          rows +
          '</tbody></table>'
      ) +
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
      '<p id="event-cleanup-hint" class="hidden text-xs text-amber-900 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">' +
      'Large catalogue — search by title or city, pick an organiser, or use quick filters below. Rows load in batches; expand a row only when you need to edit.</p>' +
      '<div class="admin-filter-bar sticky top-0 z-10 rounded-xl border border-slate-200 bg-white/95 backdrop-blur p-4 space-y-3 shadow-sm">' +
      '<div class="flex flex-col gap-3 sm:flex-row sm:items-center">' +
      '<input type="search" id="event-cleanup-search" placeholder="Search title or city…" class="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full sm:flex-1 bg-white" value="' +
      attrEsc(eventCleanupState.q) +
      '">' +
      '<select id="event-cleanup-sort" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:w-44">' +
      '<option value="recent"' +
      (eventCleanupState.sort === 'recent' ? ' selected' : '') +
      '>Newest first</option>' +
      '<option value="date"' +
      (eventCleanupState.sort === 'date' ? ' selected' : '') +
      '>Event date</option>' +
      '<option value="title"' +
      (eventCleanupState.sort === 'title' ? ' selected' : '') +
      '>Title A–Z</option></select></div>' +
      '<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">' +
      '<select id="event-cleanup-organiser" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:max-w-xs">' +
      '<option value="">All organisers</option></select>' +
      '<select id="event-cleanup-status-filter" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:max-w-[10rem]">' +
      '<option value="">Any status</option>' +
      eventStatusOptions(eventCleanupState.status) +
      '</select>' +
      '<select id="event-cleanup-approval-filter" class="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white w-full sm:max-w-[11rem]">' +
      '<option value="">Any approval</option>' +
      '<option value="Pending Review"' +
      (eventCleanupState.approval === 'Pending Review' ? ' selected' : '') +
      '>Pending review</option>' +
      '<option value="Approved"' +
      (eventCleanupState.approval === 'Approved' ? ' selected' : '') +
      '>Approved</option>' +
      '<option value="Rejected"' +
      (eventCleanupState.approval === 'Rejected' ? ' selected' : '') +
      '>Rejected</option></select>' +
      '<label class="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">' +
      '<input type="checkbox" id="event-cleanup-unlinked" class="rounded border-slate-300"' +
      (eventCleanupState.unlinked ? ' checked' : '') +
      '> Unlinked</label>' +
      '<label class="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">' +
      '<input type="checkbox" id="event-cleanup-no-date" class="rounded border-slate-300"' +
      (eventCleanupState.noDate ? ' checked' : '') +
      '> No date</label></div>' +
      '<div class="flex flex-wrap gap-2">' +
      '<button type="button" data-event-quick="unlinked" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">Unlinked</button>' +
      '<button type="button" data-event-quick="no_date" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">No date</button>' +
      '<button type="button" data-event-quick="draft" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">Draft</button>' +
      '<button type="button" data-event-quick="pending" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50">Pending approval</button>' +
      '<button type="button" data-event-quick="clear" class="text-xs font-semibold rounded-full border border-slate-300 px-3 py-1 text-slate-500 hover:bg-slate-50">Clear filters</button></div></div>' +
      '<div id="event-cleanup-list"></div>' +
      '<details class="rounded-xl border border-brand-200 bg-brand-50/50 group">' +
      '<summary class="cursor-pointer list-none font-semibold text-brand-900 px-4 py-3 select-none">Create event for a group</summary>' +
      '<div class="px-4 pb-4 space-y-3 border-t border-brand-100">' +
      '<p class="text-xs text-slate-600 pt-3">Add another event under an existing organiser profile. It starts as a draft until you publish it.</p>' +
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
      eventTypeOptions('Meeting') +
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
      '<span class="event-create-msg text-xs"></span></div></form></div></details></div>';

    syncEventCleanupFilterUi();
    refreshEventCleanupData();
  }

  function renderSystem() {
    main.innerHTML =
      '<div class="space-y-6">' +
      '<p id="system-status" class="text-sm text-slate-500">Checking environment and Supabase…</p>' +
      '<div id="system-panels" class="space-y-4"></div></div>';

    fetch('/api/auth/config-check', { credentials: 'include', cache: 'no-store' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var status = document.getElementById('system-status');
        var panels = document.getElementById('system-panels');
        if (!panels) return;

        var env = data.env || {};
        var hints = data.hints || {};
        var sb = data.supabase || {};
        var admin = data.adminAccount || {};

        if (status) {
          status.textContent = data.authReady
            ? 'Core services look ready — review any warnings below.'
            : 'Some configuration is missing — fix env vars in Vercel and redeploy.';
        }

        function envRow(label, ok) {
          return (
            '<div class="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-0">' +
            '<span class="text-slate-600">' +
            esc(label) +
            '</span>' +
            '<span class="font-semibold ' +
            (ok ? 'text-emerald-700' : 'text-red-700') +
            '">' +
            (ok ? 'OK' : 'Missing') +
            '</span></div>'
          );
        }

        panels.innerHTML =
          '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
          '<h3 class="font-bold text-brand-900 mb-3">Environment</h3>' +
          '<div class="text-sm">' +
          envRow('SESSION_SECRET', env.hasSessionSecret) +
          envRow('SUPABASE_URL', env.hasSupabaseUrl) +
          envRow('SUPABASE_SERVICE_ROLE_KEY', env.hasSupabaseServiceKey) +
          envRow('SUPABASE_ANON_KEY', env.hasSupabaseAnonKey) +
          envRow('SITE_URL', env.hasSiteUrl) +
          envRow('RESEND_API_KEY', env.hasResendApiKey) +
          envRow('RESEND_FROM', env.hasResendFrom) +
          envRow('CRON_SECRET', env.hasCronSecret) +
          '</div></section>' +
          '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
          '<h3 class="font-bold text-brand-900 mb-3">Email &amp; scheduled jobs</h3>' +
          '<div class="text-sm">' +
          envRow('Transactional email (Resend)', env.emailSendingConfigured) +
          envRow('Cron jobs secured', env.cronReady) +
          '</div>' +
          (hints.missingResend
            ? '<p class="text-xs text-amber-800 mt-3">' + esc(hints.missingResend) + '</p>'
            : '') +
          (hints.missingCronSecret
            ? '<p class="text-xs text-amber-800 mt-2">' + esc(hints.missingCronSecret) + '</p>'
            : '') +
          '<p class="text-xs text-slate-500 mt-3">Daily crons (07:00 &amp; 08:00 UTC): 24-hour booking reminders and saved-event ticket alerts. Local dev: copy vars into <code class="text-[11px]">local.env</code>, run <code class="text-[11px]">npm run sync-env</code>, restart <code class="text-[11px]">npm start</code>.</p>' +
          '</section>' +
          '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
          '<h3 class="font-bold text-brand-900 mb-2">Supabase connection</h3>' +
          '<p class="text-sm ' +
          (sb.ok ? 'text-emerald-700' : 'text-red-700') +
          ' font-semibold">' +
          esc(sb.ok ? 'Connected' : sb.message || 'Not connected') +
          '</p>' +
          (hints.supabaseConnection
            ? '<p class="text-xs text-slate-500 mt-2">' + esc(hints.supabaseConnection) + '</p>'
            : '') +
          '</section>' +
          '<section class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">' +
          '<h3 class="font-bold text-brand-900 mb-2">Admin account</h3>' +
          '<p class="text-sm text-slate-600">' +
          esc(admin.email || '—') +
          ' · ' +
          (admin.exists ? 'exists (' + esc(admin.role || 'user') + ')' : 'not created yet') +
          '</p>' +
          (hints.setupAdminRequired
            ? '<p class="text-xs text-amber-800 mt-2">Run <code class="text-[11px]">npm run seed-admin</code> or POST <code class="text-[11px]">/api/auth/setup-admin</code></p>'
            : '') +
          '</section>' +
          '<section class="bg-slate-900 rounded-xl p-5 text-slate-100 shadow-sm">' +
          '<h3 class="font-bold text-sm uppercase tracking-wide text-brand-100 mb-3">Quick links</h3>' +
          '<ul class="text-sm space-y-2">' +
          '<li><a class="text-brand-100 hover:text-white font-semibold" href="../events/index.html" target="_blank" rel="noopener">Public events browse</a></li>' +
          '<li><a class="text-brand-100 hover:text-white font-semibold" href="../organiser/index.html" target="_blank" rel="noopener">Organiser dashboard</a></li>' +
          '<li><a class="text-brand-100 hover:text-white font-semibold" href="' +
          esc(VERCEL_ANALYTICS_URL) +
          '" target="_blank" rel="noopener">Vercel Analytics</a></li>' +
          '<li><a class="text-brand-100 hover:text-white font-semibold" href="/api/auth/config-check" target="_blank" rel="noopener">Config check JSON</a></li>' +
          '<li><a class="text-brand-100 hover:text-white font-semibold" href="/api/hub-listings" target="_blank" rel="noopener">Events API smoke test</a></li>' +
          '</ul></section>';
      })
      .catch(function () {
        var status = document.getElementById('system-status');
        if (status) status.textContent = 'Could not load system health check.';
      });
  }

  function renderUsers() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<p id="users-page-status" class="text-sm text-slate-500">Loading accounts from Supabase…</p>' +
      '<div class="flex flex-wrap gap-3 items-center">' +
      '<input type="search" id="users-page-search" class="rounded-lg border border-slate-200 px-3 py-2 text-sm min-w-[200px]" placeholder="Search name or email" />' +
      '<select id="users-page-role" class="rounded-lg border border-slate-200 px-3 py-2 text-sm">' +
      '<option value="">All roles</option><option value="Admin">Admin</option><option value="Organiser">Organiser</option><option value="Attendee">Attendee</option>' +
      '</select></div>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3 text-left">Name</th><th class="px-4 py-3 text-left">Email</th><th class="px-4 py-3">Role</th><th class="px-4 py-3">Emails</th><th class="px-4 py-3">Featured</th><th class="px-4 py-3"></th></tr></thead>' +
          '<tbody id="users-page-tbody"><tr><td colspan="6" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '</div>';

    function paintUsersTable() {
      var tbody = document.getElementById('users-page-tbody');
      var q = (document.getElementById('users-page-search')?.value || '').trim().toLowerCase();
      var role = document.getElementById('users-page-role')?.value || '';
      var rows = liveUsers.filter(function (u) {
        if (role && u.role !== role) return false;
        if (!q) return true;
        return (
          String(u.name || '').toLowerCase().indexOf(q) >= 0 ||
          String(u.email || '').toLowerCase().indexOf(q) >= 0
        );
      });
      if (!tbody) return;
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-slate-500">No matching accounts.</td></tr>';
        return;
      }
      tbody.innerHTML = rows
        .map(function (u) {
          return (
            '<tr class="border-t border-slate-100">' +
            '<td class="px-4 py-3 font-medium">' +
            esc(u.name) +
            '</td>' +
            '<td class="px-4 py-3">' +
            esc(u.email) +
            '</td>' +
            '<td class="px-4 py-3 text-center">' +
            esc(u.role) +
            '</td>' +
            '<td class="px-4 py-3 text-center text-xs">' +
            (u.emailsEnabled === false
              ? '<span class="text-slate-500">Blocked</span>'
              : '<span class="text-emerald-700">On</span>') +
            '</td>' +
            '<td class="px-4 py-3 text-center">' +
            (u.organiserId
              ? '<input type="checkbox" class="users-featured-toggle" data-user-id="' +
                attrEsc(u.id) +
                '" data-organiser-id="' +
                attrEsc(u.organiserId) +
                '" ' +
                (u.featured ? 'checked' : '') +
                ' aria-label="Featured organiser" />'
              : '<span class="text-xs text-slate-400">—</span>') +
            '</td>' +
            '<td class="px-4 py-3 text-right whitespace-nowrap">' +
            '<button type="button" class="users-open-drawer text-brand-700 text-xs font-semibold hover:underline" data-user-id="' +
            attrEsc(u.id) +
            '">Details</button>' +
            (u.role !== 'Admin'
              ? ' · <button type="button" class="users-impersonate text-brand-700 text-xs font-semibold hover:underline" data-email="' +
                attrEsc(u.email) +
                '">Impersonate</button>'
              : '') +
            '</td></tr>'
          );
        })
        .join('');
    }

    loadUsersDirectory(function (users) {
      var status = document.getElementById('users-page-status');
      if (status) {
        status.textContent = users.length + ' account' + (users.length === 1 ? '' : 's') + ' in Supabase';
      }
      paintUsersTable();
    });

    var searchEl = document.getElementById('users-page-search');
    var roleEl = document.getElementById('users-page-role');
    if (searchEl) searchEl.addEventListener('input', paintUsersTable);
    if (roleEl) roleEl.addEventListener('change', paintUsersTable);

    if (!main.dataset.usersBound) {
      main.dataset.usersBound = '1';
      main.addEventListener('change', function (e) {
        var toggle = e.target.closest('.users-featured-toggle');
        if (!toggle) return;
        toggle.disabled = true;
        adminPatch('/api/admin/users', {
          userId: toggle.getAttribute('data-user-id'),
          organiserId: toggle.getAttribute('data-organiser-id'),
          featured: toggle.checked,
        })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Update failed');
            var uid = toggle.getAttribute('data-user-id');
            var row = liveUsers.find(function (u) {
              return u.id === uid;
            });
            if (row) row.featured = toggle.checked;
          })
          .catch(function (err) {
            toggle.checked = !toggle.checked;
            window.alert(err.message || 'Could not update featured status.');
          })
          .finally(function () {
            toggle.disabled = false;
          });
      });
      main.addEventListener('click', function (e) {
        var openBtn = e.target.closest('.users-open-drawer');
        if (openBtn) {
          var uid = openBtn.getAttribute('data-user-id');
          var user = liveUsers.find(function (u) {
            return u.id === uid;
          });
          if (user) openUserDrawer(user);
          return;
        }
        var impBtn = e.target.closest('.users-impersonate');
        if (impBtn) {
          submitImpersonation(impBtn.getAttribute('data-email'), 'account');
        }
      });
    }
  }

  function renderFeatured() {
    main.innerHTML =
      '<div class="space-y-4">' +
      '<p class="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">Featured events appear in the <strong>Premium Spotlight</strong> carousel on the public browse page. Only approved, published listings should be featured.</p>' +
      '<p id="featured-status" class="text-sm text-slate-500">Loading approved events…</p>' +
      adminTableScroll(
        '<table class="w-full text-sm"><thead class="bg-slate-50 text-xs uppercase text-slate-500">' +
          '<tr><th class="px-4 py-3 text-left">Featured</th><th class="px-4 py-3 text-left">Event</th><th class="px-4 py-3">Organiser</th><th class="px-4 py-3">Date</th><th class="px-4 py-3">City</th><th class="px-4 py-3"></th></tr></thead>' +
          '<tbody id="featured-tbody"><tr><td colspan="6" class="px-4 py-6 text-slate-500">Loading…</td></tr></tbody></table>'
      ) +
      '</div>';

    adminGet('/api/admin/events?approval_status=Approved&limit=100&sort=date').then(function (data) {
      var tbody = document.getElementById('featured-tbody');
      var status = document.getElementById('featured-status');
      if (!data || !data.ok) {
        if (status) status.textContent = 'Could not load events.';
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-red-700">Load failed.</td></tr>';
        return;
      }
      var events = data.events || [];
      var featuredCount = events.filter(function (e) {
        return e.featured;
      }).length;
      if (status) {
        status.textContent =
          featuredCount +
          ' featured · ' +
          events.length +
          ' approved events shown (upcoming first)';
      }
      if (!tbody) return;
      if (!events.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-slate-500">No approved events yet.</td></tr>';
        return;
      }
      tbody.innerHTML = events
        .map(function (ev) {
          var dateLabel = ev.starts_at
            ? fmtTime(ev.starts_at).split(',')[0]
            : '—';
          var viewUrl = ev.slug
            ? '../events/event.html?slug=' + encodeURIComponent(ev.slug)
            : '../events/event.html?id=' + encodeURIComponent(ev.id);
          return (
            '<tr class="border-t border-slate-100' +
            (ev.featured ? ' bg-amber-50/40' : '') +
            '">' +
            '<td class="px-4 py-3"><input type="checkbox" class="featured-event-toggle" data-event-id="' +
            attrEsc(ev.id) +
            '" ' +
            (ev.featured ? 'checked' : '') +
            ' aria-label="Feature event" /></td>' +
            '<td class="px-4 py-3 font-medium">' +
            esc(ev.title) +
            '</td>' +
            '<td class="px-4 py-3">' +
            esc(ev.organiser_name || '—') +
            '</td>' +
            '<td class="px-4 py-3">' +
            esc(dateLabel) +
            '</td>' +
            '<td class="px-4 py-3">' +
            esc(ev.city || '—') +
            '</td>' +
            '<td class="px-4 py-3"><a href="' +
            attrEsc(viewUrl) +
            '" target="_blank" rel="noopener" class="text-brand-700 text-xs font-semibold hover:underline">View</a></td></tr>'
          );
        })
        .join('');
    });

    if (!main.dataset.featuredBound) {
      main.dataset.featuredBound = '1';
      main.addEventListener('change', function (e) {
        var toggle = e.target.closest('.featured-event-toggle');
        if (!toggle) return;
        var eventId = toggle.getAttribute('data-event-id');
        if (!eventId) return;
        toggle.disabled = true;
        adminPost('/api/admin/events', { id: eventId, featured: toggle.checked })
          .then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.message) || 'Update failed');
            var row = toggle.closest('tr');
            if (row) row.classList.toggle('bg-amber-50/40', toggle.checked);
          })
          .catch(function (err) {
            toggle.checked = !toggle.checked;
            window.alert(err.message || 'Could not update featured status.');
          })
          .finally(function () {
            toggle.disabled = false;
          });
      });
    }
  }

  function bindFinancialsActions() {
    if (!main || main.dataset.financialsBound) return;
    main.dataset.financialsBound = '1';
    main.addEventListener('click', function (e) {
      var btn = e.target.closest('.payout-status-btn');
      if (!btn) return;
      var id = btn.getAttribute('data-payout-id');
      var status = btn.getAttribute('data-payout-status');
      if (!id || !status) return;
      var label = status === 'paid' ? 'Mark this payout as paid?' : 'Approve this payout request?';
      if (!window.confirm(label)) return;
      btn.disabled = true;
      adminPatch('/api/admin/financials', { id: id, status: status })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.message) || 'Update failed');
          renderFinancials();
        })
        .catch(function (err) {
          btn.disabled = false;
          window.alert(err.message || 'Could not update payout.');
        });
    });
  }

  function renderCampaigns() {
    main.innerHTML =
      '<div class="space-y-6 max-w-3xl">' +
      '<p class="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">Bulk sends use <strong>Resend</strong> and email templates from Supabase. Max <strong>50 recipients</strong> per batch. Edit the <code class="text-xs">organiser_claim_invite</code> template under Email templates first.</p>' +
      '<form id="campaign-form" class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">' +
      '<div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Template</label>' +
      '<select id="campaign-slug" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">' +
      '<option value="organiser_claim_invite">Claim your organiser profile</option>' +
      '</select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Recipients</label>' +
      '<p class="text-xs text-slate-500 mb-2">One email per line, or CSV with an <code>email</code> column.</p>' +
      '<textarea id="campaign-recipients" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono min-h-[140px]" placeholder="organiser@example.com&#10;name@company.co.uk"></textarea></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Claim URL override <span class="font-normal normal-case">(optional)</span></label>' +
      '<input type="url" id="campaign-claim-url" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Defaults to register page with email pre-filled" /></div>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900" id="campaign-submit">Send batch</button>' +
      '<span id="campaign-status" class="text-sm text-slate-500"></span></div>' +
      '<pre id="campaign-result" class="hidden text-xs bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap"></pre>' +
      '</form></div>';

    var form = document.getElementById('campaign-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var statusEl = document.getElementById('campaign-status');
      var resultEl = document.getElementById('campaign-result');
      var btn = document.getElementById('campaign-submit');
      var raw = (document.getElementById('campaign-recipients').value || '').trim();
      if (!raw) {
        if (statusEl) statusEl.textContent = 'Add at least one email.';
        return;
      }
      var lines = raw
        .split(/\r?\n/)
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
      var isCsv = lines[0] && /email/i.test(lines[0]);
      var payload = {
        action: 'bulk_send',
        slug: document.getElementById('campaign-slug').value || 'organiser_claim_invite',
      };
      var claimUrl = (document.getElementById('campaign-claim-url').value || '').trim();
      if (claimUrl) payload.variables = { claim_url: claimUrl };
      if (isCsv) payload.csv = raw;
      else payload.emails = lines;

      btn.disabled = true;
      if (statusEl) statusEl.textContent = 'Sending…';
      if (resultEl) resultEl.classList.add('hidden');

      adminPost('/api/admin/campaigns', payload)
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.message) || (data && data.error) || 'Send failed');
          if (statusEl) statusEl.textContent = data.message || 'Done.';
          if (resultEl) {
            resultEl.textContent = JSON.stringify(
              { sent: data.sent, failed: data.failed, failures: data.failures },
              null,
              2
            );
            resultEl.classList.remove('hidden');
          }
        })
        .catch(function (err) {
          if (statusEl) statusEl.textContent = err.message || 'Send failed.';
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  }

  function renderImport() {
    main.innerHTML =
      '<div class="space-y-6 max-w-3xl">' +
      '<p class="text-sm text-slate-600 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"><strong>No emails are sent.</strong> Organiser import creates or updates group profiles. Attendee import adds browse records only — users still need to register to sign in.</p>' +
      '<form id="import-form" class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">' +
      '<div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Import type</label>' +
      '<select id="import-type" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">' +
      '<option value="organisers">Organisers (group profiles)</option>' +
      '<option value="attendees">Attendees (directory only)</option>' +
      '</select></div>' +
      '<div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">CSV data</label>' +
      '<p class="text-xs text-slate-500 mb-2">Header row required. Columns: <code>email</code>, <code>name</code> (optional), <code>phone</code> (organisers only).</p>' +
      '<textarea id="import-csv" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono min-h-[160px]" placeholder="email,name&#10;organiser@example.com,Example Networking Group"></textarea></div>' +
      '<div class="flex flex-wrap items-center gap-3">' +
      '<button type="submit" class="rounded-lg bg-brand-700 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-900" id="import-submit">Run import</button>' +
      '<span id="import-status" class="text-sm text-slate-500"></span></div>' +
      '<pre id="import-result" class="hidden text-xs bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap"></pre>' +
      '</form></div>';

    var form = document.getElementById('import-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var csv = (document.getElementById('import-csv').value || '').trim();
      var type = document.getElementById('import-type').value;
      var statusEl = document.getElementById('import-status');
      var resultEl = document.getElementById('import-result');
      var btn = document.getElementById('import-submit');
      if (!csv) {
        if (statusEl) statusEl.textContent = 'Paste CSV data first.';
        return;
      }
      if (!window.confirm('Import ' + type + ' from ' + csv.split(/\r?\n/).length + ' lines? No emails will be sent.')) return;
      btn.disabled = true;
      if (statusEl) statusEl.textContent = 'Importing…';
      if (resultEl) resultEl.classList.add('hidden');
      adminPost('/api/admin/import', { type: type, csv: csv })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.message) || 'Import failed');
          if (statusEl) statusEl.textContent = data.message || 'Import complete.';
          if (resultEl) {
            resultEl.textContent = JSON.stringify(
              { ok: data.ok, fail: data.fail, total: data.total, errors: data.errors },
              null,
              2
            );
            resultEl.classList.remove('hidden');
          }
        })
        .catch(function (err) {
          if (statusEl) statusEl.textContent = err.message || 'Import failed.';
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  }

  function renderCleanupHub(fullHash) {
    var hash = String(fullHash || 'cleanup/groups');
    var tab = 'groups';
    if (hash.indexOf('events') !== -1 || hash === 'event-cleanup') tab = 'events';
    else if (hash.indexOf('issues') !== -1 || hash === 'event-health') tab = 'issues';

    var tabsHtml = adminHubTabsHtml(
      [
        { key: 'groups', label: 'Groups', href: '#cleanup/groups' },
        { key: 'events', label: 'Events', href: '#cleanup/events' },
        { key: 'issues', label: 'Data issues', href: '#cleanup/issues' },
      ],
      tab
    );

    if (tab === 'events') withHubTabs(tabsHtml, renderEventCleanup);
    else if (tab === 'issues') withHubTabs(tabsHtml, renderEventHealth);
    else withHubTabs(tabsHtml, function () {
      renderGroupCleanup(hash);
    });
  }

  function renderAccountsHub(fullHash) {
    var hash = String(fullHash || 'accounts/users');
    var tab = hash.indexOf('impersonate') !== -1 ? 'impersonate' : 'users';
    var tabsHtml = adminHubTabsHtml(
      [
        { key: 'users', label: 'Users', href: '#accounts/users' },
        { key: 'impersonate', label: 'Impersonate', href: '#accounts/impersonate' },
      ],
      tab
    );
    if (tab === 'impersonate') withHubTabs(tabsHtml, renderImpersonate);
    else withHubTabs(tabsHtml, renderUsers);
  }

  function renderEmailHub(fullHash) {
    var hash = String(fullHash || 'email/campaigns');
    var tab = hash.indexOf('templates') !== -1 ? 'templates' : 'campaigns';
    var tabsHtml = adminHubTabsHtml(
      [
        { key: 'campaigns', label: 'Campaigns', href: '#email/campaigns' },
        { key: 'templates', label: 'Templates', href: '#email/templates' },
      ],
      tab
    );
    if (tab === 'templates') withHubTabs(tabsHtml, renderEmails);
    else withHubTabs(tabsHtml, renderCampaigns);
  }

  function renderModerationHub(fullHash) {
    var hash = String(fullHash || 'moderation');
    var tab = hash.indexOf('import') !== -1 ? 'import' : 'review';
    var tabsHtml = adminHubTabsHtml(
      [
        { key: 'review', label: 'Review', href: '#moderation' },
        { key: 'import', label: 'Import', href: '#moderation/import' },
      ],
      tab
    );
    if (tab === 'import') withHubTabs(tabsHtml, renderImport);
    else withHubTabs(tabsHtml, renderModeration);
  }

  var routes = {
    dashboard: renderDashboard,
    analytics: renderAnalytics,
    system: renderSystem,
    cleanup: renderCleanupHub,
    accounts: renderAccountsHub,
    email: renderEmailHub,
    moderation: renderModerationHub,
    financials: renderFinancials,
    featured: renderFeatured,
    sponsorship: function () {
      renderSponsorship((location.hash || '#sponsorship').replace('#', ''));
    },
    'event-health': function () {
      location.replace('#cleanup/issues');
    },
    'group-cleanup': function () {
      location.replace('#cleanup/groups');
    },
    'event-cleanup': function () {
      location.replace('#cleanup/events');
    },
    impersonate: function () {
      location.replace('#accounts/impersonate');
    },
    users: function () {
      location.replace('#accounts/users');
    },
    campaigns: function () {
      location.replace('#email/campaigns');
    },
    import: function () {
      location.replace('#moderation/import');
    },
    emails: function () {
      location.replace('#email/templates');
    },
  };

  function route() {
    var rawHash = (location.hash || '#dashboard').replace('#', '');
    var hash = normalizeAdminHash(rawHash);
    if (hash !== rawHash) {
      location.replace('#' + hash);
      return;
    }
    var routeKey = hash.split('/')[0];
    if (!routes[routeKey]) {
      routeKey = 'dashboard';
      hash = 'dashboard';
    }
    setActiveNav(routeKey, hash);
    try {
      routes[routeKey](hash);
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
    bindFinancialsActions();
    var refreshBadge = document.getElementById('admin-data-badge');
    if (refreshBadge) {
      refreshBadge.classList.remove('hidden');
      refreshBadge.addEventListener('click', function () {
        refreshBadge.disabled = true;
        refreshBadge.textContent = 'Refreshing…';
        refreshAdminNotifications().finally(function () {
          refreshBadge.disabled = false;
        });
      });
    }
    refreshAdminNotifications();
    startAdminNotificationsPolling();
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
          '<div class="text-center max-w-md space-y-3"><p class="text-slate-600">Admin access required. Sign in with an admin account.</p>' +
          '<a href="../login.html?next=/admin/index.html" class="inline-block rounded-lg bg-brand-700 text-white px-5 py-2.5 font-semibold">Sign in</a>' +
          '<p class="text-sm text-slate-500">Forgot your password? <a href="../forgot-password.html" class="font-semibold text-brand-700 hover:underline">Email a reset link</a></p></div>';
        return;
      }
      boot(data.user);
    })
    .catch(function () {
      document.getElementById('admin-gate-msg').textContent = 'Could not verify session.';
    });
})();
