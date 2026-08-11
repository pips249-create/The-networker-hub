/**
 * Guided launch setup after claim: profiles → seeded events (series = one item) → tickets → review.
 * Handles multiple organiser pages and multiple/recurring seeded listings as a queue.
 */
(function (global) {
  var STORAGE_KEY = 'hub_launch_setup_v1';

  function readState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { profilesDone: {}, eventsDone: {}, dismissed: false };
      var parsed = JSON.parse(raw);
      return {
        profilesDone: parsed.profilesDone && typeof parsed.profilesDone === 'object' ? parsed.profilesDone : {},
        eventsDone: parsed.eventsDone && typeof parsed.eventsDone === 'object' ? parsed.eventsDone : {},
        dismissed: Boolean(parsed.dismissed),
      };
    } catch (e) {
      return { profilesDone: {}, eventsDone: {}, dismissed: false };
    }
  }

  function writeState(next) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      /* ignore */
    }
  }

  function markProfileDone(groupId) {
    if (!groupId) return;
    var s = readState();
    s.profilesDone[String(groupId)] = true;
    writeState(s);
  }

  function markEventFamilyDone(familyKey) {
    if (!familyKey) return;
    var s = readState();
    s.eventsDone[String(familyKey)] = true;
    writeState(s);
  }

  function dismiss() {
    var s = readState();
    s.dismissed = true;
    writeState(s);
  }

  function clearDismissed() {
    var s = readState();
    s.dismissed = false;
    writeState(s);
  }

  /** After claim: reopen profile + event review (ignore prior dismiss / done flags). */
  function prepareClaimOnboarding(groupIds) {
    var s = readState();
    s.dismissed = false;
    s.eventsDone = {};
    (groupIds || []).forEach(function (id) {
      if (id) delete s.profilesDone[String(id)];
    });
    writeState(s);
  }

  /** @deprecated prefer prepareClaimOnboarding */
  function unlockProfilesForReview(groupIds) {
    prepareClaimOnboarding(groupIds);
  }

  function profileLooksThin(group) {
    if (!group) return true;
    var desc = String(group.description || group.about || '').trim();
    var photo = String(group.photoUrl || group.logoUrl || group.imageUrl || '').trim();
    return !desc || !photo;
  }

  function profileNeedsReview(group, stored) {
    if (!group || !group.id) return false;
    if (stored.profilesDone[String(group.id)]) return false;
    return true;
  }

  function seriesFamilyKey(ev, allEvents) {
    if (ev && ev.seriesGroupId) return 'sg:' + String(ev.seriesGroupId);
    if (ev && ev.isSeries && ev.seriesKey) return String(ev.seriesKey);
    if (typeof global.eventSeriesBucketKey === 'function') {
      try {
        return global.eventSeriesBucketKey(ev, { allEvents: allEvents || [] });
      } catch (e) {
        /* fall through */
      }
    }
    return 'ev:' + String(ev && ev.id ? ev.id : '');
  }

  function ticketsForEventIds(tickets, eventIds) {
    var idSet = {};
    (eventIds || []).forEach(function (id) {
      idSet[String(id)] = true;
    });
    return (tickets || []).filter(function (t) {
      return idSet[String(t.eventId || t.event_id || '')];
    });
  }

  function eventFamilyNeedsSetup(family, tickets, stored) {
    if (!family || !family.key) return false;
    if (stored.eventsDone[family.key]) return false;
    var members = family.events || [];
    if (!members.length) return false;
    var ids = members.map(function (e) {
      return e.id;
    });
    var tiers = ticketsForEventIds(tickets, ids);
    var anySalesOn = members.some(function (e) {
      return e.ticketSalesEnabled === true || e.ticket_sales_enabled === true;
    });
    // Admin-seeded listings ship without sales / tiers — keep them in the queue until reviewed.
    if (!anySalesOn) return true;
    if (!tiers.length) return true;
    return false;
  }

  function buildEventFamilies(events, groupEventsIntoSeries) {
    var list = events || [];
    var grouped =
      typeof groupEventsIntoSeries === 'function' ? groupEventsIntoSeries(list) : list.slice();
    return grouped.map(function (row) {
      var members =
        row && row.isSeries && Array.isArray(row.seriesEvents) && row.seriesEvents.length
          ? row.seriesEvents
          : [row];
      var key = seriesFamilyKey(row, list);
      var title = String(row.title || members[0] && members[0].title || 'Event').trim();
      var dateCount = members.length;
      var primary = members[0] || row || null;
      var place = '';
      if (primary) {
        place = String(
          primary.city || primary.venue || primary.location || primary.town || ''
        ).trim();
      }
      var dateRaw =
        (primary && (primary.date || primary.startsAt || primary.starts_at || primary.eventDate)) ||
        '';
      return {
        key: key,
        title: title,
        dateCount: dateCount,
        isSeries: dateCount > 1 || Boolean(row && row.isSeries),
        events: members,
        primary: primary,
        date: dateRaw,
        place: place,
        organiserId: String(
          (row && (row.organiserId || row.organiser_id)) ||
            (members[0] && (members[0].organiserId || members[0].organiser_id)) ||
            ''
        ),
      };
    });
  }

  /**
   * @param {object} input
   * @param {Array} input.groups
   * @param {Array} input.events
   * @param {Array} input.tickets
   * @param {Function} [input.groupEventsIntoSeries]
   */
  function buildQueue(input) {
    var stored = readState();
    var groups = (input && input.groups) || [];
    var events = (input && input.events) || [];
    var tickets = (input && input.tickets) || [];
    var queue = [];

    var families = buildEventFamilies(events, input && input.groupEventsIntoSeries);
    var pendingFamilies = families.filter(function (fam) {
      return eventFamilyNeedsSetup(fam, tickets, stored);
    });
    var queuedEventKeys = {};

    // Per organiser page: finish profile, then that page's events — before the next group.
    groups.forEach(function (g, idx) {
      if (!g || !g.id) return;
      var gid = String(g.id);
      if (!stored.profilesDone[gid]) {
        queue.push({
          kind: 'profile',
          id: gid,
          title: String(g.name || 'Organiser page').trim(),
          thin: profileLooksThin(g),
          indexHint: 'Group page',
          group: g,
          ordinal: idx + 1,
        });
        return;
      }
      pendingFamilies.forEach(function (fam) {
        if (!fam || queuedEventKeys[fam.key]) return;
        if (String(fam.organiserId || '') !== gid) return;
        queuedEventKeys[fam.key] = true;
        queue.push({
          kind: 'event',
          id: fam.key,
          title: fam.title,
          isSeries: fam.isSeries,
          dateCount: fam.dateCount,
          date: fam.date || '',
          place: fam.place || '',
          family: fam,
          indexHint: fam.isSeries ? 'Series (' + fam.dateCount + ' dates)' : 'Event',
        });
      });
    });

    // Any remaining event families (orphan / unmatched organiser id).
    pendingFamilies.forEach(function (fam) {
      if (!fam || queuedEventKeys[fam.key]) return;
      queuedEventKeys[fam.key] = true;
      queue.push({
        kind: 'event',
        id: fam.key,
        title: fam.title,
        isSeries: fam.isSeries,
        dateCount: fam.dateCount,
        date: fam.date || '',
        place: fam.place || '',
        family: fam,
        indexHint: fam.isSeries ? 'Series (' + fam.dateCount + ' dates)' : 'Event',
      });
    });

    return { queue: queue, stored: stored, families: families };
  }

  function nextItem(input) {
    var built = buildQueue(input);
    if (built.stored.dismissed) return null;
    return built.queue[0] || null;
  }

  function progressSummary(input) {
    var built = buildQueue(input);
    var total = built.queue.length;
    var profilesLeft = built.queue.filter(function (q) {
      return q.kind === 'profile';
    }).length;
    var eventsLeft = built.queue.filter(function (q) {
      return q.kind === 'event';
    }).length;
    return {
      remaining: total,
      profilesLeft: profilesLeft,
      eventsLeft: eventsLeft,
      done: total === 0,
      dismissed: built.stored.dismissed,
    };
  }

  function profileEditUrl(groupId) {
    return (
      '/organiser/group-edit?id=' +
      encodeURIComponent(String(groupId || '')) +
      '&onboard=launch'
    );
  }

  global.HubOrganiserLaunchSetup = {
    STORAGE_KEY: STORAGE_KEY,
    readState: readState,
    markProfileDone: markProfileDone,
    markEventFamilyDone: markEventFamilyDone,
    dismiss: dismiss,
    clearDismissed: clearDismissed,
    prepareClaimOnboarding: prepareClaimOnboarding,
    unlockProfilesForReview: unlockProfilesForReview,
    buildQueue: buildQueue,
    nextItem: nextItem,
    progressSummary: progressSummary,
    profileEditUrl: profileEditUrl,
    seriesFamilyKey: seriesFamilyKey,
    profileLooksThin: profileLooksThin,
  };
})(typeof window !== 'undefined' ? window : globalThis);
