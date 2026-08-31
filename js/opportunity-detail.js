/**
 * Opportunity detail page — /opportunities/:slug
 */
(function () {
  var catalog = window.HubOpportunitiesCatalog;
  var saves = window.HubOpportunitySaves;
  var current = null;
  var sessionUser = null;
  var enquiriesOpen = true;
  var openDayRegistrationsOpen = true;

  var els = {
    notFound: document.getElementById('opp-not-found'),
    layout: document.getElementById('opp-detail-layout'),
    trailCurrent: document.getElementById('opp-trail-current'),
    hostLogo: document.getElementById('opp-host-logo'),
    typeBadge: document.getElementById('opp-type-badge'),
    featuredPip: document.getElementById('opp-featured-pip'),
    title: document.getElementById('opp-title'),
    hostName: document.getElementById('opp-host-name'),
    saveBtn: document.getElementById('opp-save-btn'),
    metaGrid: document.getElementById('opp-meta-grid'),
    affiliateCookie: document.getElementById('opp-affiliate-cookie'),
    desc: document.getElementById('opp-desc'),
    aboutExtra: document.getElementById('opp-about-extra'),
    openDaysSection: document.getElementById('opp-open-days-section'),
    openDaysList: document.getElementById('opp-open-days-list'),
    openDaysClosed: document.getElementById('opp-open-days-closed'),
    openDaysLede: document.getElementById('opp-open-days-lede'),
    cover: document.getElementById('opp-detail-cover'),
    coverImg: document.getElementById('opp-detail-cover-img'),
    posterLogo: document.getElementById('opp-poster-logo'),
    posterName: document.getElementById('opp-poster-name'),
    form: document.getElementById('opp-enquire-form'),
    submit: document.getElementById('opp-enquire-submit'),
    enquireStatus: document.getElementById('opp-enquire-status'),
    enquireClosed: document.getElementById('opp-enquire-closed'),
    enquireLede: document.getElementById('opp-enquire-lede'),
    investBreakdownSection: document.getElementById('opp-investment-breakdown-section'),
    investBreakdownLede: document.getElementById('opp-investment-breakdown-lede'),
    investBreakdownList: document.getElementById('opp-investment-breakdown-list'),
    enquireSignin: document.getElementById('opp-enquire-signin'),
    trustBadges: document.getElementById('opp-detail-trust-badges'),
    typeNotice: document.getElementById('opp-type-notice'),
    companiesHouse: document.getElementById('opp-companies-house'),
    similarSection: document.getElementById('opp-similar-section'),
    similarGrid: document.getElementById('opp-similar-grid'),
    claimSection: document.getElementById('opp-claim-section'),
    claimForm: document.getElementById('opp-claim-form'),
    claimSubmit: document.getElementById('opp-claim-submit'),
    claimStatus: document.getElementById('opp-claim-status'),
    claimTop: document.getElementById('opp-claim-top'),
    claimTopKicker: document.getElementById('opp-claim-top-kicker'),
    claimTopTitle: document.getElementById('opp-claim-top-title'),
    claimTopText: document.getElementById('opp-claim-top-text'),
    claimTopBtn: document.getElementById('opp-claim-top-btn'),
    claimSticky: document.getElementById('opp-claim-sticky'),
    claimStickyCopy: document.getElementById('opp-claim-sticky-copy'),
    claimStickyBtn: document.getElementById('opp-claim-sticky-btn'),
  };

  function claimInviteQuery() {
    var params = new URLSearchParams(window.location.search);
    var intent = String(params.get('intent') || '').trim().toLowerCase();
    return {
      isClaim: intent === 'opportunity-claim',
      email: String(params.get('email') || '').trim(),
      auth: String(params.get('auth') || 'register').trim().toLowerCase() === 'login' ? 'login' : 'register',
      next: String(params.get('next') || '/organiser/?onboard=opportunity-claim').trim(),
    };
  }

  function bindClaimCtaBusy(btn) {
    if (!btn || btn.dataset.claimBusyBound === '1') return;
    btn.dataset.claimBusyBound = '1';
    btn.addEventListener('click', function () {
      if (btn.getAttribute('href') && btn.getAttribute('href').charAt(0) === '#') return;
      if (btn.classList.contains('is-busy')) return;
      btn.classList.add('is-busy');
      btn.setAttribute('aria-busy', 'true');
      var label = btn.querySelector('.opp-claim-cta-label');
      if (label) {
        label.textContent = 'Opening sign-up\u2026';
      }
    });
  }

  function scrollToClaimForm(e) {
    if (e) e.preventDefault();
    var section = els.claimSection;
    if (!section) return;
    section.hidden = false;
    var navOffset = window.matchMedia('(max-width: 768px)').matches ? 72 : 88;
    var top = section.getBoundingClientRect().top + window.scrollY - navOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    var nameInput = document.getElementById('opp-claim-name');
    if (nameInput) {
      try {
        nameInput.focus({ preventScroll: true });
      } catch (err) {
        nameInput.focus();
      }
    }
  }

  function bindClaimStickyBar(ctaHref, isHashCta) {
    var sticky = els.claimSticky;
    var stickyBtn = els.claimStickyBtn;
    var sentinel = document.getElementById('opp-claim-top-actions') || els.claimTopBtn;
    if (!sticky) return;

    if (stickyBtn) {
      stickyBtn.setAttribute('href', ctaHref);
      if (isHashCta) {
        stickyBtn.onclick = scrollToClaimForm;
      } else {
        stickyBtn.onclick = null;
        bindClaimCtaBusy(stickyBtn);
      }
    }

    function setStickyVisible(visible) {
      sticky.hidden = !visible;
      document.body.classList.toggle('opp-claim-sticky-visible', visible);
      refreshEnquireJumpVisibility();
    }

    if (!sentinel || typeof IntersectionObserver !== 'function') {
      setStickyVisible(true);
      return;
    }

    if (sticky._claimObserver) {
      try {
        sticky._claimObserver.disconnect();
      } catch (e) {
        /* ignore */
      }
    }

    setStickyVisible(false);
    var observer = new IntersectionObserver(
      function (entries) {
        var entry = entries && entries[0];
        var topCtaVisible = !!(entry && entry.isIntersecting);
        setStickyVisible(!topCtaVisible);
      },
      { threshold: 0.15, rootMargin: '0px 0px -8px 0px' }
    );
    observer.observe(sentinel);
    sticky._claimObserver = observer;
  }

  function hideClaimUi() {
    if (els.claimTop) els.claimTop.hidden = true;
    if (els.claimSticky) {
      els.claimSticky.hidden = true;
      if (els.claimSticky._claimObserver) {
        try {
          els.claimSticky._claimObserver.disconnect();
        } catch (e) {
          /* ignore */
        }
      }
    }
    document.body.classList.remove('opp-claim-sticky-visible', 'opp-claim-invite-active');
  }

  function initClaimInviteFromEmail(item) {
    var q = claimInviteQuery();
    if (!q.isClaim || !els.claimTop) return false;

    var safeNext = q.next && q.next.charAt(0) === '/' ? q.next : '/organiser/?onboard=opportunity-claim';
    var path = q.auth === 'login' ? '/login' : '/register';
    var href =
      path +
      '?intent=opportunity-claim&next=' +
      encodeURIComponent(safeNext) +
      (q.email ? '&email=' + encodeURIComponent(q.email) : '');

    els.claimTop.hidden = false;
    if (els.claimTopKicker) els.claimTopKicker.textContent = 'Preview \u2014 claim to go live';
    if (els.claimTopTitle) {
      els.claimTopTitle.textContent = item && item.title
        ? 'This is a preview of ' + item.title
        : 'This is a preview of your listing';
    }
    if (els.claimTopText) {
      els.claimTopText.textContent =
        'Your opportunity is already on The Networker UK. Claim it with the email we invited, then keep it live for \u00a325/month + VAT (cancel any time). Enquiries come straight to you \u2014 no lead fees.';
    }
    if (els.claimTopBtn) {
      els.claimTopBtn.setAttribute('href', href);
      els.claimTopBtn.onclick = null;
      var label = els.claimTopBtn.querySelector('.opp-claim-cta-label');
      if (label) label.textContent = 'Claim & start receiving enquiries \u2192';
      bindClaimCtaBusy(els.claimTopBtn);
    }
    var note = document.getElementById('opp-claim-top-note');
    if (note) {
      note.innerHTML =
        'Invited to a different email, or not yours?' +
        ' <a href="mailto:catherine@thenetworkeruk.com?subject=Help%20claiming%20my%20opportunity%20listing">Email Catherine</a>' +
        ' and we\u2019ll sort it.';
    }
    if (els.claimStickyCopy) {
      els.claimStickyCopy.textContent = 'Preview only \u2014 claim to manage this listing';
    }
    if (els.claimStickyBtn) {
      var stickyLabel = els.claimStickyBtn.querySelector('.opp-claim-cta-label');
      if (stickyLabel) stickyLabel.textContent = 'Claim listing';
    }
    bindClaimStickyBar(href, false);

    if (els.claimSection) els.claimSection.hidden = true;

    document.body.classList.add('opp-claim-invite-active');
    try {
      document.title =
        (item && item.title ? item.title + ' \u2014 ' : '') +
        'Claim your listing \u2013 The Networker UK';
    } catch (e) {
      /* ignore */
    }
    return true;
  }

  function initClaimableBanner(item) {
    if (!els.claimTop || !item || !item.claimable) return false;

    els.claimTop.hidden = false;
    if (els.claimTopKicker) els.claimTopKicker.textContent = 'Is this your listing?';
    if (els.claimTopTitle) {
      els.claimTopTitle.textContent = item.host
        ? 'Claim ' + item.host + ' on The Networker UK'
        : 'Claim it and take control';
    }
    if (els.claimTopText) {
      els.claimTopText.textContent =
        'We listed this opportunity so networkers can find it. If it\u2019s yours, claim it now \u2014 we\u2019ll verify you, then you manage enquiries and keep the page live for \u00a325/month + VAT.';
    }
    if (els.claimTopBtn) {
      els.claimTopBtn.setAttribute('href', '#opp-claim-section');
      els.claimTopBtn.onclick = scrollToClaimForm;
      var label = els.claimTopBtn.querySelector('.opp-claim-cta-label');
      if (label) label.textContent = 'Claim it now \u2192';
    }
    var note = document.getElementById('opp-claim-top-note');
    if (note) {
      note.innerHTML =
        'Need a hand? <a href="/contact">Book a setup call</a> or email' +
        ' <a href="mailto:catherine@thenetworkeruk.com?subject=Help%20claiming%20my%20opportunity%20listing">catherine@thenetworkeruk.com</a>.';
    }
    if (els.claimStickyCopy) els.claimStickyCopy.textContent = 'Is this your listing?';
    if (els.claimStickyBtn) {
      var stickyLabel = els.claimStickyBtn.querySelector('.opp-claim-cta-label');
      if (stickyLabel) stickyLabel.textContent = 'Claim it now';
    }
    bindClaimStickyBar('#opp-claim-section', true);
    return true;
  }

  function syncEnquiriesOpenFromSoftLaunch(meta) {
    if (meta && typeof meta.enquiriesOpen === 'boolean') {
      enquiriesOpen = meta.enquiriesOpen;
    } else if (window.HubSoftLaunch && typeof window.HubSoftLaunch.arePublicEnquiriesOpen === 'function') {
      enquiriesOpen = window.HubSoftLaunch.arePublicEnquiriesOpen();
    } else {
      enquiriesOpen = Date.now() >= Date.parse('2026-09-01T09:00:00+01:00');
    }
    syncOpenDayRegistrationsFromSoftLaunch(meta);
  }

  function syncOpenDayRegistrationsFromSoftLaunch(meta) {
    if (meta && meta.openDayRegistrationsOpen === false) {
      openDayRegistrationsOpen = false;
      return;
    }
    openDayRegistrationsOpen = true;
  }

  function openDayRegistrationsClosedCopy() {
    if (
      window.HubSoftLaunch &&
      window.HubSoftLaunch.publicOpenDayRegistrationsClosedMessage
    ) {
      return window.HubSoftLaunch.publicOpenDayRegistrationsClosedMessage();
    }
    return 'Open day registration opens when public browsing starts on 25 August 2026. You can browse listings now.';
  }

  function enquiriesClosedCopy() {
    if (window.HubSoftLaunch && window.HubSoftLaunch.publicEnquiriesClosedMessage) {
      return window.HubSoftLaunch.publicEnquiriesClosedMessage();
    }
    return 'Opportunity enquiries open at 9am on 1 September 2026. You can browse listings now and enquire when they go live.';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderDesc(item) {
    if (!els.desc) return;
    var text = String((item && item.desc) || '').trim();
    if (!text) {
      els.desc.innerHTML = '';
      els.desc.hidden = true;
      return;
    }
    els.desc.hidden = false;
    var fmt = window.HubPlainTextFormat;
    if (fmt && typeof fmt.formatDocument === 'function' && /\n/.test(fmt.normalizeNewlines(text))) {
      els.desc.innerHTML = fmt.formatDocument(text, {
        paragraphClass: 'opp-about-p',
        headingClass: 'opp-about-heading',
      });
      return;
    }
    if (fmt && typeof fmt.plainTextToHtml === 'function' && /\n/.test(String(text))) {
      els.desc.innerHTML = fmt.plainTextToHtml(text);
      return;
    }
    els.desc.textContent = text;
  }

  function formatOpenDayWhen(day) {
    if (!day || !day.startsAt) return '';
    try {
      var start = new Date(day.startsAt);
      if (Number.isNaN(start.getTime())) return String(day.startsAt);
      var datePart = start.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      var timePart = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      var out = datePart + ' · ' + timePart;
      if (day.endsAt) {
        var end = new Date(day.endsAt);
        if (!Number.isNaN(end.getTime())) {
          out +=
            '–' + end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        }
      }
      return out;
    } catch (e) {
      return String(day.startsAt);
    }
  }

  function formatOpenDayWhere(day) {
    return [day.venueName, day.addressLine, day.city, day.postcode]
      .map(function (p) {
        return String(p || '').trim();
      })
      .filter(Boolean)
      .join(', ');
  }

  function openDayCalendarLinks(day, item) {
    if (!day || !day.startsAt) return null;
    if (!window.HubCalendarShare || typeof window.HubCalendarShare.buildCalendarLinks !== 'function') {
      return null;
    }
    var where = formatOpenDayWhere(day);
    var title = (item && item.title) || 'Open day';
    return window.HubCalendarShare.buildCalendarLinks({
      id: day.id,
      title: title + ' — open day',
      starts_at: day.startsAt,
      ends_at: day.endsAt || null,
      venue: where,
      location: where,
      description: 'Open day for ' + title + '. View listing: ' + window.location.href,
    });
  }

  function openDayCalendarHtml(day, item) {
    var cal = openDayCalendarLinks(day, item);
    if (!cal || !cal.google) return '';
    var dayId = escapeHtml(String(day.id || ''));
    return (
      '<div class="opp-open-day-cal-wrap">' +
      '<button type="button" class="opp-open-day-cal-btn" aria-expanded="false" aria-haspopup="true" data-open-day-cal-toggle data-open-day-id="' +
      dayId +
      '">Add to calendar</button>' +
      '<div class="opp-open-day-cal-menu" hidden role="menu">' +
      '<p class="opp-open-day-cal-menu-label">Add to your calendar</p>' +
      '<a href="' +
      escapeHtml(cal.google) +
      '" target="_blank" rel="noopener" class="opp-open-day-cal-menu-item" role="menuitem">Google Calendar</a>' +
      '<a href="' +
      escapeHtml(cal.outlook) +
      '" target="_blank" rel="noopener" class="opp-open-day-cal-menu-item" role="menuitem">Outlook / Office 365</a>' +
      '<button type="button" class="opp-open-day-cal-menu-item opp-open-day-cal-ics" role="menuitem" data-open-day-id="' +
      dayId +
      '">Download .ics (Apple Calendar)</button>' +
      '</div></div>'
    );
  }

  function closeOpenDayCalendarMenus(exceptMenu) {
    if (!els.openDaysList) return;
    els.openDaysList.querySelectorAll('.opp-open-day-cal-menu').forEach(function (menu) {
      if (menu === exceptMenu) return;
      menu.hidden = true;
      var wrap = menu.closest('.opp-open-day-cal-wrap');
      var btn = wrap && wrap.querySelector('[data-open-day-cal-toggle]');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  function showOpenDayFormStatus(form, message, kind) {
    if (!form) return;
    var statusEl = form.querySelector('.opp-open-day-status');
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.className =
      'opp-open-day-status' + (kind === 'ok' ? ' is-ok' : kind === 'error' ? ' is-error' : '');
    statusEl.textContent = message;
    if (typeof statusEl.scrollIntoView === 'function') {
      statusEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function findOpenDayById(dayId) {
    var days = current && Array.isArray(current.openDays) ? current.openDays : [];
    for (var i = 0; i < days.length; i += 1) {
      if (String(days[i].id) === String(dayId)) return days[i];
    }
    return null;
  }

  function renderOpenDays(item) {
    if (!els.openDaysSection || !els.openDaysList) return;
    var days = Array.isArray(item && item.openDays) ? item.openDays.slice() : [];
    days = days.filter(function (d) {
      return d && d.startsAt && Date.parse(d.startsAt) >= Date.now() - 60 * 60 * 1000;
    });
    if (!days.length) {
      els.openDaysSection.hidden = true;
      els.openDaysList.innerHTML = '';
      return;
    }
    els.openDaysSection.hidden = false;
    if (els.openDaysClosed) {
      els.openDaysClosed.hidden = openDayRegistrationsOpen;
      els.openDaysClosed.textContent = openDayRegistrationsClosedCopy();
    }
    if (els.openDaysLede) els.openDaysLede.hidden = !openDayRegistrationsOpen;
    els.openDaysList.innerHTML = days
      .map(function (day) {
        var when = formatOpenDayWhen(day);
        var where = formatOpenDayWhere(day);
        var formHtml = openDayRegistrationsOpen
          ? '<form class="opp-open-day-form" data-open-day-id="' +
            escapeHtml(day.id) +
            '">' +
            '<label><span>Your name</span><input type="text" name="name" required autocomplete="name" /></label>' +
            '<label><span>Email</span><input type="email" name="email" required autocomplete="email" /></label>' +
            '<label><span>Phone (optional)</span><input type="tel" name="phone" autocomplete="tel" /></label>' +
            '<button type="submit" class="opp-detail-btn opp-detail-btn--gold">Register interest</button>' +
            '<p class="opp-open-day-status" hidden></p>' +
            '</form>'
          : '';
        return (
          '<li class="opp-open-day-card">' +
          '<p class="opp-open-day-when">' +
          escapeHtml(when) +
          openDayCalendarHtml(day, item) +
          '</p>' +
          (where ? '<p class="opp-open-day-where">' + escapeHtml(where) + '</p>' : '') +
          (day.notes
            ? '<p class="opp-open-day-notes">' + escapeHtml(day.notes) + '</p>'
            : '') +
          formHtml +
          '</li>'
        );
      })
      .join('');
  }

  function bindOpenDayForms() {
    if (!els.openDaysList || els.openDaysList.dataset.bound === '1') return;
    els.openDaysList.dataset.bound = '1';
    els.openDaysList.addEventListener('click', function (e) {
      var toggle = e.target.closest('[data-open-day-cal-toggle]');
      if (toggle) {
        e.preventDefault();
        var wrap = toggle.closest('.opp-open-day-cal-wrap');
        var menu = wrap && wrap.querySelector('.opp-open-day-cal-menu');
        if (!menu) return;
        var willOpen = menu.hidden;
        closeOpenDayCalendarMenus(willOpen ? menu : null);
        menu.hidden = !willOpen;
        toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        return;
      }
      var icsBtn = e.target.closest('.opp-open-day-cal-ics');
      if (!icsBtn || !window.HubCalendarShare) return;
      var dayId = icsBtn.getAttribute('data-open-day-id');
      var day = findOpenDayById(dayId);
      if (!day || !current) return;
      var links = openDayCalendarLinks(day, current);
      if (!links || !links.icsContent) return;
      HubCalendarShare.downloadIcs(links.icsContent, links.icsFilename);
      closeOpenDayCalendarMenus(null);
    });
    document.addEventListener('click', function (e) {
      if (!els.openDaysList || !els.openDaysList.contains(e.target)) {
        closeOpenDayCalendarMenus(null);
      }
    });
    els.openDaysList.addEventListener('submit', function (e) {
      var form = e.target.closest('.opp-open-day-form');
      if (!form) return;
      e.preventDefault();
      if (!openDayRegistrationsOpen) {
        showOpenDayFormStatus(form, openDayRegistrationsClosedCopy(), 'error');
        return;
      }
      var openDayId = String(form.getAttribute('data-open-day-id') || '').trim();
      var name = String((form.querySelector('[name="name"]') || {}).value || '').trim();
      var email = String((form.querySelector('[name="email"]') || {}).value || '').trim();
      var phone = String((form.querySelector('[name="phone"]') || {}).value || '').trim();
      var btn = form.querySelector('button[type="submit"]');
      if (!openDayId) {
        showOpenDayFormStatus(
          form,
          'This open day is missing an ID — refresh the page and try again.',
          'error'
        );
        return;
      }
      if (!name || !email) {
        showOpenDayFormStatus(form, 'Enter your name and email.', 'error');
        return;
      }
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Sending…';
      }
      showOpenDayFormStatus(form, 'Sending your registration…', null);
      fetch('/api/opportunities', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'open_day_interest',
          openDayId: openDayId,
          name: name,
          email: email,
          phone: phone,
        }),
      })
        .then(function (r) {
          return r
            .json()
            .catch(function () {
              return {};
            })
            .then(function (data) {
              return { ok: r.ok, status: r.status, data: data };
            });
        })
        .then(function (result) {
          if (result.ok) {
            showOpenDayFormStatus(
              form,
              'Thanks — you are registered. The lister will confirm by email shortly.',
              'ok'
            );
            form.reset();
            if (btn) {
              btn.disabled = false;
              btn.textContent = 'Register interest';
            }
            return;
          }
          if (
            result.data &&
            (result.data.error === 'open_day_registrations_closed' ||
              result.data.error === 'enquiries_closed')
          ) {
            syncOpenDayRegistrationsFromSoftLaunch(result.data.softLaunch || null);
            renderOpenDays(current);
          } else {
            showOpenDayFormStatus(
              form,
              (result.data && result.data.message) ||
                (result.data && result.data.error) ||
                'Could not register interest. Please try again.',
              'error'
            );
          }
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Register interest';
          }
        })
        .catch(function () {
          showOpenDayFormStatus(
            form,
            'Could not register interest. Check your connection and try again.',
            'error'
          );
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Register interest';
          }
        });
    });
  }

  function renderAbout(item) {
    if (!els.aboutExtra) return;
    var fmt = window.HubPlainTextFormat;
    if (fmt && typeof fmt.formatDocument === 'function') {
      els.aboutExtra.innerHTML = fmt.formatDocument(item && item.about, {
        paragraphClass: 'opp-about-p',
        headingClass: 'opp-about-heading',
      });
      return;
    }
    var paras = Array.isArray(item && item.about) ? item.about : [];
    els.aboutExtra.innerHTML = paras
      .map(function (p) {
        return '<p class="opp-about-p">' + escapeHtml(p) + '</p>';
      })
      .join('');
  }

  function shortTitle(title) {
    var t = String(title || '');
    return t.length > 48 ? t.slice(0, 45) + '…' : t;
  }

  function resolveSlug() {
    var pathMatch = window.location.pathname.match(/\/opportunities\/([^/]+)\/?$/i);
    if (pathMatch && pathMatch[1]) {
      return decodeURIComponent(pathMatch[1]);
    }
    var params = new URLSearchParams(window.location.search);
    return params.get('slug') || params.get('id') || '';
  }

  function maybeRedirectToCanonicalSlug(item) {
    if (!item || !item.slug) return;
    var canonical = '/opportunities/' + encodeURIComponent(item.slug);
    var currentPath = window.location.pathname.replace(/\/$/, '');
    if (currentPath !== canonical) {
      window.history.replaceState({}, '', canonical);
    }
  }

  function showNotFound() {
    document.title = 'Opportunity not found – The Networker UK';
    if (els.notFound) els.notFound.hidden = false;
    if (els.layout) els.layout.hidden = true;
    if (els.trailCurrent) els.trailCurrent.textContent = 'Not found';
  }

  function applyCoverImage(item) {
    if (!els.cover || !els.coverImg || !item) return;
    var cover = String(
      item.displayCoverUrl || item.imageUrl || item.logoUrl || ''
    ).trim();
    if (cover) {
      els.coverImg.src = cover;
      els.coverImg.alt = item.title ? item.title + ' photo' : 'Opportunity photo';
      els.cover.classList.toggle(
        'opp-detail-cover--logo-fallback',
        Boolean(item.coverIsLogoFallback) || (!item.imageUrl && !!item.logoUrl)
      );
      els.cover.hidden = false;
      return;
    }
    els.cover.classList.remove('opp-detail-cover--logo-fallback');
    els.cover.hidden = true;
    els.coverImg.removeAttribute('src');
    els.coverImg.alt = '';
  }

  function hostLogoUrl(item) {
    return String((item && item.logoUrl) || '').trim();
  }

  function applyHostLogo(el, item) {
    if (!el || !item) return;
    var logo = hostLogoUrl(item);
    if (logo) {
      el.textContent = '';
      el.classList.add('has-logo');
      el.innerHTML =
        '<img src="' +
        escapeHtml(logo) +
        '" alt="" width="40" height="40" loading="lazy" />';
      var img = el.querySelector('img');
      var paint = function () {
        if (window.CmsSponsorFields && window.CmsSponsorFields.applyLogoSurfaceContrast) {
          window.CmsSponsorFields.applyLogoSurfaceContrast(el, img || logo, {
            lightColor: '#ffffff',
          });
        } else {
          var dark =
            window.CmsSponsorFields && window.CmsSponsorFields.logoUrlSuggestsDarkBand
              ? window.CmsSponsorFields.logoUrlSuggestsDarkBand(logo)
              : /white/i.test(logo);
          el.classList.toggle('is-logo-dark', dark);
          el.style.background = dark ? '#1a1a2e' : '#fff';
        }
      };
      paint();
      if (img) {
        img.addEventListener('load', paint, { once: true });
      }
      return;
    }
    el.classList.remove('has-logo', 'is-logo-dark');
    el.innerHTML = '';
    el.textContent = item.hostInitials || '';
    el.style.background = item.hostColor || '#0d1f3c';
  }

  function refreshSaveButton() {
    if (!els.saveBtn || !current) return;
    var saved = saves && saves.isSaved(current.id);
    els.saveBtn.classList.toggle('is-active', saved);
    els.saveBtn.setAttribute('aria-pressed', saved ? 'true' : 'false');
    els.saveBtn.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save opportunity');
  }

  function affiliateCookieIconSvg() {
    return (
      '<svg class="opp-affiliate-cookie-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.75"></rect>' +
      '<path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"></path>' +
      '<path d="M12 13.5l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3.9-1.8z" fill="currentColor"></path>' +
      '</svg>'
    );
  }

  function renderAffiliateCookie(item) {
    if (!els.affiliateCookie) return;
    var isAffiliate = catalog && catalog.isAffiliateStyleListing && catalog.isAffiliateStyleListing(item);
    var cookieVal =
      catalog && catalog.cookieWindowFromMeta ? catalog.cookieWindowFromMeta(item.meta) : '';
    if (!isAffiliate || !cookieVal) {
      els.affiliateCookie.hidden = true;
      els.affiliateCookie.innerHTML = '';
      return;
    }
    var copy =
      catalog && catalog.formatAffiliateCookieDisplay
        ? catalog.formatAffiliateCookieDisplay(cookieVal)
        : 'Affiliate cookie window: ' + cookieVal + '.';
    els.affiliateCookie.innerHTML =
      '<div class="opp-affiliate-cookie-card">' +
      affiliateCookieIconSvg() +
      '<p class="opp-affiliate-cookie-copy">' +
      escapeHtml(copy) +
      '</p></div>';
    els.affiliateCookie.hidden = false;
  }

  function renderMeta(item) {
    if (!els.metaGrid) return;
    els.metaGrid.innerHTML = (item.meta || [])
      .filter(function (m) {
        return (
          !/^investment includes$/i.test(m.key) &&
          !/^companies house$/i.test(m.key) &&
          !/^cookie window$/i.test(m.key)
        );
      })
      .map(function (m) {
        var val = catalog && catalog.formatMetaDisplayValue ? catalog.formatMetaDisplayValue(m.key, m.val) : m.val;
        return (
          '<div class="opp-detail-meta-item">' +
          '<span class="opp-detail-meta-key">' +
          escapeHtml(m.key) +
          '</span>' +
          '<span class="opp-detail-meta-val">' +
          escapeHtml(val) +
          '</span>' +
          '</div>'
        );
      })
      .join('');
  }

  function renderTrustBadges(item) {
    if (!els.trustBadges) return;
    var q = window.HubOpportunityQuality;
    if (!q || !q.trustBadgesHtml) {
      els.trustBadges.innerHTML = '';
      els.trustBadges.hidden = true;
      return;
    }
    var html = q.trustBadgesHtml(item, 'opp-trust-badges opp-trust-badges--detail');
    if (!html) {
      els.trustBadges.innerHTML = '';
      els.trustBadges.hidden = true;
      return;
    }
    els.trustBadges.innerHTML = html;
    els.trustBadges.hidden = false;
  }

  function renderCompaniesHouse(item) {
    if (!els.companiesHouse) return;
    var q = window.HubOpportunityQuality;
    if (!q || !q.companiesHouseMetaHtml || !q.companiesHouseNumber(item)) {
      els.companiesHouse.hidden = true;
      els.companiesHouse.innerHTML = '';
      return;
    }
    els.companiesHouse.innerHTML =
      '<span class="opp-detail-meta-key">Company registration</span>' +
      '<span class="opp-detail-meta-val">' +
      q.companiesHouseMetaHtml(item) +
      '</span>';
    els.companiesHouse.hidden = false;
  }

  function similarCardHtml(item) {
    var href = item.slug
      ? '/opportunities/' + encodeURIComponent(item.slug)
      : '/opportunities/opportunity?id=' + encodeURIComponent(item.id);
    var invest = '';
    (item.meta || []).forEach(function (m) {
      if (/^investment$/i.test(m.key)) invest = String(m.val || '').trim();
    });
    return (
      '<a class="opp-similar-card" href="' +
      escapeHtml(href) +
      '">' +
      '<span class="opp-similar-type">' +
      escapeHtml((catalog && catalog.TYPE_LABELS[item.type]) || item.type || '') +
      '</span>' +
      '<strong class="opp-similar-title">' +
      escapeHtml(item.title || '') +
      '</strong>' +
      '<span class="opp-similar-host">' +
      escapeHtml(item.host || '') +
      '</span>' +
      (invest ? '<span class="opp-similar-invest">' + escapeHtml(invest) + '</span>' : '') +
      '</a>'
    );
  }

  function renderSimilar(item) {
    if (!els.similarSection || !els.similarGrid) return;
    var q = window.HubOpportunityQuality;
    if (!catalog || !catalog.loadCatalogAsync || !q || !q.similarOpportunities) {
      els.similarSection.hidden = true;
      return;
    }
    catalog.loadCatalogAsync().then(function (list) {
      var similar = q.similarOpportunities(list, item, 4);
      if (!similar.length) {
        els.similarSection.hidden = true;
        els.similarGrid.innerHTML = '';
        return;
      }
      els.similarGrid.innerHTML = similar.map(similarCardHtml).join('');
      els.similarSection.hidden = false;
    });
  }

  function renderInvestmentBreakdown(item) {
    if (!els.investBreakdownSection) return;
    if (catalog && catalog.isAffiliateStyleListing && catalog.isAffiliateStyleListing(item)) {
      els.investBreakdownSection.hidden = true;
      if (els.investBreakdownList) els.investBreakdownList.innerHTML = '';
      return;
    }
    var investUi = window.HubOpportunityInvestment;
    var items =
      item.investmentIncludes ||
      (investUi && investUi.fromMeta ? investUi.fromMeta(item.meta) : []) ||
      (catalog && catalog.parseInvestmentIncludes
        ? catalog.parseInvestmentIncludes(
            (item.meta || [])
              .filter(function (m) {
                return /^investment includes$/i.test(m.key);
              })
              .map(function (m) {
                return m.val;
              })
              .join('\n')
          )
        : []);
    if (!items.length) {
      els.investBreakdownSection.hidden = true;
      if (els.investBreakdownList) els.investBreakdownList.innerHTML = '';
      return;
    }
    var total = '';
    (item.meta || []).forEach(function (m) {
      if (/^investment$/i.test(m.key)) total = String(m.val || '').trim();
    });
    var heading =
      investUi && investUi.breakdownHeading
        ? investUi.breakdownHeading(total, items.length)
        : total
          ? total + ' total — typically includes:'
          : 'Typically includes:';
    if (els.investBreakdownLede) els.investBreakdownLede.textContent = heading;
    if (els.investBreakdownList) {
      els.investBreakdownList.innerHTML = items
        .map(function (line) {
          return '<li>' + escapeHtml(line) + '</li>';
        })
        .join('');
    }
    els.investBreakdownSection.hidden = false;
  }

  function isNetworkMarketingListing(item) {
    if (!item) return false;
    if (String(item.type || '') === 'network-marketing') return true;
    var tags = (item.tags || []).concat(item.filterTags || []);
    for (var i = 0; i < tags.length; i++) {
      if (String(tags[i] || '') === 'network-marketing') return true;
    }
    return false;
  }

  function renderTypeNotice(item) {
    if (!els.typeNotice) return;
    if (isNetworkMarketingListing(item)) {
      els.typeNotice.hidden = false;
      els.typeNotice.innerHTML =
        '<p><strong>Network marketing — product-selling only.</strong> ' +
        'This listing should be about selling products or services. It is not an investment product, ' +
        'and The Networker UK does not verify earnings claims. Do your own due diligence before committing.</p>';
      return;
    }
    if (catalog && catalog.isAffiliateStyleListing && catalog.isAffiliateStyleListing(item)) {
      els.typeNotice.hidden = false;
      els.typeNotice.innerHTML =
        '<p><strong>Affiliate programme.</strong> ' +
        'This is commission-based (promote a product or service), not a franchise or capital investment. ' +
        'Commission figures are set by the advertiser — verify terms before you promote.</p>';
      return;
    }
    els.typeNotice.hidden = true;
    els.typeNotice.innerHTML = '';
  }

  function render(item) {
    current = item;
    document.title = item.title + ' – The Networker UK';

    if (els.trailCurrent) els.trailCurrent.textContent = shortTitle(item.title);
    if (els.title) els.title.textContent = item.title;
    if (els.hostName) els.hostName.textContent = item.host;
    if (els.posterName) els.posterName.textContent = item.host;
    renderDesc(item);

    var posterNote = document.querySelector('.opp-detail-poster-note');
    if (posterNote) {
      posterNote.textContent = item.claimable
        ? 'Listed on behalf of this business by The Networker UK. Use the claim form below if you represent this company.'
        : 'Enquiries go directly to the poster — no middlemen or per-lead fees.';
    }

    applyCoverImage(item);
    applyHostLogo(els.hostLogo, item);
    applyHostLogo(els.posterLogo, item);

    if (els.hostLogo) els.hostLogo.hidden = false;

    if (els.typeBadge) {
      els.typeBadge.textContent = catalog.TYPE_LABELS[item.type] || item.type;
      els.typeBadge.className = 'opp-type-badge ' + catalog.typeClass(item.type);
    }

    if (els.featuredPip) els.featuredPip.hidden = !item.featured;

    renderMeta(item);
    renderAffiliateCookie(item);
    renderTypeNotice(item);
    if (window.HUB_applyDetailRegionCta) {
      var locMeta = '';
      (item.meta || []).forEach(function (m) {
        if (/^location$/i.test(m.key) || /territor/i.test(m.key)) {
          locMeta = locMeta || String(m.val || '').trim();
        }
      });
      window.HUB_applyDetailRegionCta(document.getElementById('opp-region-cta'), {
        context: 'opportunities',
        slug: item.citySlugs && item.citySlugs[0] ? item.citySlugs[0] : '',
        locationTexts: locMeta ? [locMeta] : [],
      });
    }
    renderTrustBadges(item);
    renderCompaniesHouse(item);
    renderInvestmentBreakdown(item);
    renderAbout(item);
    renderOpenDays(item);
    bindOpenDayForms();
    renderSimilar(item);
    refreshSaveButton();
    applyClaimSection(item);
    hideClaimUi();
    if (!initClaimInviteFromEmail(item)) {
      initClaimableBanner(item);
    }

    if (els.notFound) els.notFound.hidden = true;
    if (els.layout) els.layout.hidden = false;
  }

  function bindSave() {
    if (!els.saveBtn) return;
    els.saveBtn.addEventListener('click', function () {
      if (!current || !saves) return;
      saves.toggle(current.id, current).then(function () {
        refreshSaveButton();
      });
    });
  }

  function loadSession() {
    var fetcher = window.hubFetchSession
      ? window.hubFetchSession
      : function () {
          return fetch('/api/auth/session', { credentials: 'include' }).then(function (r) {
            return r.json();
          });
        };
    return fetcher()
      .then(function (data) {
        if (data && data.ok && data.user) {
          sessionUser = data.user;
          return data.user;
        }
        sessionUser = null;
        return null;
      })
      .catch(function () {
        sessionUser = null;
        return null;
      });
  }

  function applyEnquireAuthUi() {
    var signedIn = Boolean(sessionUser && sessionUser.email);
    var nameEl = document.getElementById('opp-enquire-name');
    var emailEl = document.getElementById('opp-enquire-email');
    var messageEl = document.getElementById('opp-enquire-message');
    var termsEl = document.getElementById('opp-enquire-terms');
    var jumpBtn = document.getElementById('opp-enquire-jump-btn');

    if (els.enquireClosed) {
      els.enquireClosed.hidden = enquiriesOpen;
    }
    if (els.enquireLede) {
      els.enquireLede.hidden = !enquiriesOpen;
    }

    if (!enquiriesOpen) {
      if (els.enquireSignin) els.enquireSignin.hidden = true;
      if (els.form) els.form.hidden = true;
      if (els.submit) els.submit.disabled = true;
      if (jumpBtn) jumpBtn.textContent = 'Enquiries open 1 September';
      return;
    }

    if (jumpBtn) jumpBtn.textContent = 'Enquire about this listing';
    if (els.enquireSignin) els.enquireSignin.hidden = signedIn;
    if (els.form) els.form.hidden = !signedIn;
    if (els.submit) els.submit.disabled = !signedIn;

    var next = window.location.pathname + window.location.search + window.location.hash;
    var loginLink = document.getElementById('opp-enquire-login-link');
    var registerLink = document.getElementById('opp-enquire-register-link');
    if (loginLink) loginLink.href = '../login?next=' + encodeURIComponent(next);
    if (registerLink) registerLink.href = '../register?next=' + encodeURIComponent(next);

    if (signedIn && nameEl && sessionUser.name && !nameEl.value) {
      nameEl.value = sessionUser.name;
    }
    if (signedIn && emailEl && sessionUser.email) {
      emailEl.value = sessionUser.email;
      emailEl.readOnly = true;
      emailEl.setAttribute('aria-readonly', 'true');
    }

    if (!signedIn) {
      if (nameEl) nameEl.value = '';
      if (emailEl) {
        emailEl.value = '';
        emailEl.readOnly = false;
        emailEl.removeAttribute('aria-readonly');
      }
      if (messageEl) messageEl.value = '';
      if (termsEl) termsEl.checked = false;
    }
  }

  function prefillEnquireForm() {
    return loadSession().then(function () {
      applyEnquireAuthUi();
    });
  }

  function showEnquireStatus(msg, ok) {
    if (!els.enquireStatus) return;
    els.enquireStatus.hidden = false;
    els.enquireStatus.textContent = msg;
    els.enquireStatus.className = 'opp-enquire-status' + (ok ? ' is-ok' : ' is-error');
  }

  function applyClaimSection(item) {
    if (!els.claimSection) return;
    var q = claimInviteQuery();
    // Email-invite path uses the top banner CTA; request form is for hub-owned cold discovery only.
    var claimable = Boolean(item && item.claimable) && !q.isClaim;
    els.claimSection.hidden = !claimable;
    if (!claimable) return;

    var heading = document.getElementById('opp-claim-section-heading');
    var lede = document.getElementById('opp-claim-section-lede');
    if (heading) heading.textContent = 'Request to claim this listing';
    if (lede) {
      lede.textContent =
        'This listing was added by The Networker UK to help people discover your opportunity. Tell us who you are \u2014 we\u2019ll verify your details, then email you a link to take over the listing.';
    }

    var companyInput = document.getElementById('opp-claim-company');
    if (companyInput && item.host && !companyInput.value) {
      companyInput.value = item.host;
    }
  }

  function showClaimStatus(msg, ok) {
    if (!els.claimStatus) return;
    els.claimStatus.hidden = false;
    els.claimStatus.textContent = msg;
    els.claimStatus.className = 'opp-claim-status' + (ok ? ' is-ok' : ' is-error');
  }

  function bindClaimForm() {
    if (!els.claimForm) return;
    els.claimForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!current || !current.claimable) return;

      var name = (document.getElementById('opp-claim-name').value || '').trim();
      var email = (document.getElementById('opp-claim-email').value || '').trim();
      var company = (document.getElementById('opp-claim-company').value || '').trim();
      var role = (document.getElementById('opp-claim-role').value || '').trim();
      var message = (document.getElementById('opp-claim-message').value || '').trim();
      if (!name || !email || !company) return;

      if (els.claimSubmit) {
        els.claimSubmit.disabled = true;
        els.claimSubmit.textContent = 'Sending request…';
      }
      if (els.claimStatus) els.claimStatus.hidden = true;

      fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim_request',
          opportunityId: current.id,
          name: name,
          email: email,
          company: company,
          role: role,
          message: message,
        }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data && result.data.ok) {
            showClaimStatus(
              'Request sent — our team will email you to verify your details and arrange payment.',
              true
            );
            if (els.claimSubmit) els.claimSubmit.textContent = 'Request sent';
            els.claimForm.reset();
            applyClaimSection(current);
            return;
          }
          if (els.claimSubmit) {
            els.claimSubmit.disabled = false;
            els.claimSubmit.textContent = 'Request to claim listing';
          }
          showClaimStatus(
            (result.data && (result.data.message || result.data.error)) ||
              'Could not send your request. Please email hi@thenetworkeruk.com instead.',
            false
          );
        })
        .catch(function () {
          if (els.claimSubmit) {
            els.claimSubmit.disabled = false;
            els.claimSubmit.textContent = 'Request to claim listing';
          }
          showClaimStatus(
            'Could not send your request. Please email hi@thenetworkeruk.com instead.',
            false
          );
        });
    });
  }

  function bindForm() {
    if (!els.form) return;
    els.form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!current) return;
      if (!enquiriesOpen) {
        showEnquireStatus(enquiriesClosedCopy(), false);
        applyEnquireAuthUi();
        return;
      }

      var name = (document.getElementById('opp-enquire-name').value || '').trim();
      var email = (document.getElementById('opp-enquire-email').value || '').trim();
      var message = (document.getElementById('opp-enquire-message').value || '').trim();
      var terms = document.getElementById('opp-enquire-terms');
      if (!name || !email || !message) return;
      if (terms && !terms.checked) {
        showEnquireStatus('Please confirm you understand this is not investment advice.', false);
        terms.focus();
        return;
      }

      if (els.submit) {
        els.submit.disabled = true;
        els.submit.textContent = 'Sending…';
      }
      if (els.enquireStatus) els.enquireStatus.hidden = true;

      fetch('/api/opportunities', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: current.id,
          name: name,
          email: email,
          message: message,
        }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data && result.data.ok) {
            showEnquireStatus(
              'Enquiry sent — the poster has been notified and will respond to you by email.',
              true
            );
            if (els.submit) els.submit.textContent = 'Enquiry sent';
            var messageEl = document.getElementById('opp-enquire-message');
            if (messageEl) messageEl.value = '';
            if (terms) terms.checked = false;
            return;
          }
          if (result.data && result.data.error === 'enquiries_closed') {
            if (result.data.softLaunch) syncEnquiriesOpenFromSoftLaunch(result.data.softLaunch);
            else enquiriesOpen = false;
            applyEnquireAuthUi();
            showEnquireStatus(
              (result.data && result.data.message) || enquiriesClosedCopy(),
              false
            );
            return;
          }
          if (result.data && result.data.error === 'not_authenticated') {
            sessionUser = null;
            applyEnquireAuthUi();
          }
          if (els.submit) {
            els.submit.disabled = false;
            els.submit.textContent = 'Send enquiry';
          }
          showEnquireStatus(
            (result.data && (result.data.message || result.data.error)) ||
              'Could not send your enquiry. Try the email link below.',
            false
          );
        })
        .catch(function () {
          if (els.submit) {
            els.submit.disabled = false;
            els.submit.textContent = 'Send enquiry';
          }
          showEnquireStatus('Could not send your enquiry. Try the email link below.', false);
        });
    });
  }

  function loadSidebarAd() {
    if (!window.CmsAdBlocks) return;
    var el = document.getElementById('opportunity-page-sidebar-ad');
    if (!el) return;

    var loadCarousel = window.CmsAdBlocks.loadOpportunityPageCarouselAds
      ? window.CmsAdBlocks.loadOpportunityPageCarouselAds(el)
      : window.CmsAdBlocks.loadPageCarouselAds(el, { slot: 'opportunity_page_carousel_ads' });

    Promise.resolve(loadCarousel)
      .then(function (shown) {
        if (shown) return true;
        return window.CmsAdBlocks.loadCmsAd('opportunity_page_sidebar_ad').then(function (block) {
          return window.CmsAdBlocks.renderCompactAd(el, block, 'opportunity_page_sidebar_ad', {
            showPlaceholder: true,
          });
        });
      })
      .catch(function () {});
  }

  function wireListingReport(item) {
    var btn = document.getElementById('opp-report-btn');
    if (!btn || !window.ListingReport || !item || !item.id) return;
    window.ListingReport.attachTrigger(btn, {
      listingType: 'opportunity',
      opportunityId: item.id,
      title: item.title || 'Opportunity',
    });
  }

  function recordOpportunityView(item) {
    if (!item || !item.id) return;
    try {
      fetch('/api/opportunities', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record_view', opportunityId: item.id }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {
      /* ignore */
    }
  }

  var enquireJumpBound = false;

  function refreshEnquireJumpVisibility() {
    var jump = document.getElementById('opp-enquire-jump');
    var card = document.getElementById('opp-enquire-card');
    if (!jump || !card) return;

    var mobile = window.matchMedia('(max-width: 768px)').matches;
    var cardVisible = jump.dataset.cardVisible === '1';
    var claimMode =
      document.body.classList.contains('opp-claim-sticky-visible') ||
      document.body.classList.contains('opp-claim-invite-active');
    var show = mobile && !cardVisible && !claimMode;

    jump.hidden = !show;
    jump.classList.toggle('is-visible', show);
    document.body.classList.toggle('opp-enquire-jump-active', show);
  }

  function initEnquireJumpBar() {
    if (enquireJumpBound) {
      refreshEnquireJumpVisibility();
      return;
    }
    var jump = document.getElementById('opp-enquire-jump');
    var card = document.getElementById('opp-enquire-card');
    var btn = document.getElementById('opp-enquire-jump-btn');
    if (!jump || !card || !btn) return;
    enquireJumpBound = true;

    btn.addEventListener('click', function () {
      var navOffset = window.matchMedia('(max-width: 768px)').matches ? 64 : 80;
      var top = card.getBoundingClientRect().top + window.scrollY - navOffset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });

    window.matchMedia('(max-width: 768px)').addEventListener('change', refreshEnquireJumpVisibility);

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          jump.dataset.cardVisible =
            entry.isIntersecting && entry.intersectionRatio > 0.15 ? '1' : '0';
          refreshEnquireJumpVisibility();
        });
      },
      { threshold: [0, 0.15, 0.35], rootMargin: '-56px 0px -72px 0px' }
    );
    observer.observe(card);
    refreshEnquireJumpVisibility();
  }

  function finishInit(item, softLaunchMeta) {
    syncEnquiriesOpenFromSoftLaunch(softLaunchMeta);
    if (!item) {
      showNotFound();
      return;
    }
    maybeRedirectToCanonicalSlug(item);
    render(item);
    recordOpportunityView(item);
    bindSave();
    bindForm();
    bindClaimForm();
    prefillEnquireForm();
    wireListingReport(item);
    loadSidebarAd();
    initEnquireJumpBar();
  }

  function init() {
    syncEnquiriesOpenFromSoftLaunch(null);
    if (!catalog) {
      showNotFound();
      return;
    }

    var slug = resolveSlug();
    var cached = catalog.getBySlug ? catalog.getBySlug(slug) : catalog.getById(slug);
    if (cached) {
      finishInit(cached, cached._softLaunch || null);
    }

    var fetchFresh =
      catalog.fetchOpportunityRecord ||
      function (key) {
        return catalog.fetchBySlugOrId ? catalog.fetchBySlugOrId(key, { forceFresh: true }) : null;
      };

    Promise.resolve(fetchFresh(slug))
      .then(function (item) {
        if (item) {
          finishInit(item, item._softLaunch || null);
          return;
        }
        if (!cached) showNotFound();
      })
      .catch(function () {
        if (!cached) showNotFound();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
