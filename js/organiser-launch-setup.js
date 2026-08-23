/**
 * Guided launch setup after claim: profiles → unfinished events (series = one item) → tickets → publish.
 * Handles multiple organiser pages and multiple/recurring listings as a queue.
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

  function markEventFamilyMembersDone(family) {
    if (!family || !family.key) return;
    var s = readState();
    s.eventsDone[String(family.key)] = true;
    (family.events || []).forEach(function (ev) {
      if (ev && ev.id) s.eventsDone['ev:' + String(ev.id)] = true;
    });
    writeState(s);
  }

  function eventLooksPublished(ev) {
    if (!ev) return false;
    var st = String(ev.status || '').toLowerCase();
    var key = String(ev.statusKey || ev.listingStatus || '').toLowerCase();
    var approval = String(ev.approvalStatus || '').toLowerCase();
    if (st === 'draft' || key === 'draft' || st === 'unpublished' || key === 'unpublished') {
      return false;
    }
    return (
      st === 'published' ||
      st === 'live' ||
      approval === 'approved' ||
      key === 'live' ||
      key === 'upcoming' ||
      key === 'archived' ||
      key === 'pending_approval' ||
      key === 'published'
    );
  }

  function familyMarkedDone(family, stored) {
    if (!family || !family.key || !stored || !stored.eventsDone) return false;
    if (stored.eventsDone[String(family.key)]) return true;
    return (family.events || []).some(function (ev) {
      return ev && ev.id && stored.eventsDone['ev:' + String(ev.id)];
    });
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

  /**
   * After claim: reopen thin profile review for these groups.
   * Do not wipe eventsDone — finished / published listings must not bounce back
   * when the organiser claims another page.
   */
  function prepareClaimOnboarding(groupIds) {
    var s = readState();
    s.dismissed = false;
    (groupIds || []).forEach(function (id) {
      if (id) delete s.profilesDone[String(id)];
    });
    writeState(s);
  }

  /**
   * After claim: skip forced profile/event re-edit. The workspace Overview tour
   * teaches how to use each page; organisers edit from Groups / My events when ready.
   */
  function skipForcedReviewAfterClaim(groupIds, input) {
    var s = readState();
    (groupIds || []).forEach(function (id) {
      if (id) s.profilesDone[String(id)] = true;
    });
    var families = buildEventFamilies(
      (input && input.events) || [],
      input && input.groupEventsIntoSeries
    );
    var idSet = {};
    (groupIds || []).forEach(function (id) {
      if (id) idSet[String(id)] = true;
    });
    families.forEach(function (fam) {
      if (!fam || !fam.key) return;
      if (familyNeedsHubListingReview(fam)) return;
      if (!Object.keys(idSet).length || idSet[String(fam.organiserId || '')]) {
        s.eventsDone[String(fam.key)] = true;
      }
    });
    // Keep the prompt available when platform-listed events still need sales review.
    if (families.some(familyNeedsHubListingReview)) {
      s.dismissed = false;
    } else {
      s.dismissed = true;
    }
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
    // Only nudge incomplete pages (missing description or photo).
    // Organisers who already filled their profile shouldn’t see this after publishing.
    return profileLooksThin(group);
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

  function eventIsPast(ev) {
    if (!ev) return false;
    var raw = ev.startsAt || ev.starts_at || ev.date || ev.eventDate || '';
    if (!raw) return false;
    var d = new Date(raw);
    if (isNaN(d.getTime())) return false;
    return d.getTime() < Date.now() - 12 * 60 * 60 * 1000;
  }

  function eventIsCancelledOrGone(ev) {
    if (!ev) return true;
    var st = String(ev.status || '').toLowerCase();
    var key = String(ev.statusKey || ev.listingStatus || '').toLowerCase();
    return (
      st === 'cancelled' ||
      key === 'cancelled' ||
      st === 'archived' ||
      key === 'archived' ||
      st === 'unpublished' ||
      key === 'unpublished'
    );
  }

  /** Published by the platform / admin with ticket sales still closed — organiser must review. */
  function eventNeedsHubListingReview(ev) {
    if (!ev || eventIsCancelledOrGone(ev) || eventIsPast(ev)) return false;
    var salesOn = ev.ticketSalesEnabled === true || ev.ticket_sales_enabled === true;
    if (salesOn) return false;
    return eventLooksPublished(ev);
  }

  function familyNeedsHubListingReview(family) {
    return (family && family.events || []).some(eventNeedsHubListingReview);
  }

  function eventFamilyNeedsSetup(family, tickets, stored) {
    if (!family || !family.key) return false;
    var members = family.events || [];
    if (!members.length) return false;

    // platform-listed published events with sales still closed always need review.
    // Do not honour localStorage "done" flags — sales must be confirmed on the server.
    if (familyNeedsHubListingReview(family)) return true;

    if (familyMarkedDone(family, stored)) {
      // Heal alternate keys (series key vs ev:id) so claim/reloads stay consistent.
      if (!stored.eventsDone[String(family.key)]) {
        markEventFamilyMembersDone(family);
      }
      return false;
    }

    var ids = members.map(function (e) {
      return e.id;
    });
    var tiers = ticketsForEventIds(tickets, ids);
    var anySalesOn = members.some(function (e) {
      return e.ticketSalesEnabled === true || e.ticket_sales_enabled === true;
    });
    var anyPublished = members.some(eventLooksPublished);
    // Already published with sales live (or finished setup) — leave the queue.
    if (anyPublished && anySalesOn) {
      markEventFamilyMembersDone(family);
      return false;
    }
    if (anyPublished) {
      // Published without sales should have been caught above; treat as done if past/cancelled.
      markEventFamilyMembersDone(family);
      return false;
    }
    // Draft listings without sales / tiers stay until the organiser publishes.
    if (!anySalesOn) return true;
    if (!tiers.length) return true;
    markEventFamilyMembersDone(family);
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

    // Per organiser page: finish thin profiles, then that page's events — before the next group.
    groups.forEach(function (g, idx) {
      if (!g || !g.id) return;
      var gid = String(g.id);
      if (profileNeedsReview(g, stored)) {
        queue.push({
          kind: 'profile',
          id: gid,
          title: String(g.name || 'Organiser page').trim(),
          thin: true,
          indexHint: 'Group page',
          group: g,
          ordinal: idx + 1,
        });
        // platform-listed events still need review even if the profile is thin.
        pendingFamilies.forEach(function (fam) {
          if (!fam || queuedEventKeys[fam.key]) return;
          if (String(fam.organiserId || '') !== gid) return;
          if (!familyNeedsHubListingReview(fam)) return;
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
            hubListed: true,
            indexHint: 'Listed by the platform — review',
          });
        });
        return;
      }
      // Heal localStorage when the page already looks complete.
      if (!stored.profilesDone[gid]) {
        stored.profilesDone[gid] = true;
        writeState(stored);
      }
      pendingFamilies.forEach(function (fam) {
        if (!fam || queuedEventKeys[fam.key]) return;
        if (String(fam.organiserId || '') !== gid) return;
        queuedEventKeys[fam.key] = true;
        var hubListed = familyNeedsHubListingReview(fam);
        queue.push({
          kind: 'event',
          id: fam.key,
          title: fam.title,
          isSeries: fam.isSeries,
          dateCount: fam.dateCount,
          date: fam.date || '',
          place: fam.place || '',
          family: fam,
          hubListed: hubListed,
          indexHint: hubListed
            ? 'Listed by the platform — review'
            : fam.isSeries
              ? 'Series (' + fam.dateCount + ' dates)'
              : 'Event',
        });
      });
    });

    // Any remaining event families (orphan / unmatched organiser id).
    pendingFamilies.forEach(function (fam) {
      if (!fam || queuedEventKeys[fam.key]) return;
      queuedEventKeys[fam.key] = true;
      var hubListed = familyNeedsHubListingReview(fam);
      queue.push({
        kind: 'event',
        id: fam.key,
        title: fam.title,
        isSeries: fam.isSeries,
        dateCount: fam.dateCount,
        date: fam.date || '',
        place: fam.place || '',
        family: fam,
        hubListed: hubListed,
        indexHint: hubListed
          ? 'Listed by the platform — review'
          : fam.isSeries
            ? 'Series (' + fam.dateCount + ' dates)'
            : 'Event',
      });
    });

    // Prefer platform-listed event reviews before profile polish.
    queue.sort(function (a, b) {
      var aHub = a && a.kind === 'event' && a.hubListed ? 1 : 0;
      var bHub = b && b.kind === 'event' && b.hubListed ? 1 : 0;
      return bHub - aHub;
    });

    return { queue: queue, stored: stored, families: families };
  }

  function nextItem(input) {
    var built = buildQueue(input);
    var hasHubListed = built.queue.some(function (q) {
      return q.kind === 'event' && q.hubListed;
    });
    // platform-listed events must surface even if the organiser dismissed an earlier setup prompt.
    if (built.stored.dismissed && !hasHubListed) return null;
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
    var hasHubListed = built.queue.some(function (q) {
      return q.kind === 'event' && q.hubListed;
    });
    return {
      remaining: total,
      profilesLeft: profilesLeft,
      eventsLeft: eventsLeft,
      done: total === 0,
      dismissed: Boolean(built.stored.dismissed) && !hasHubListed,
      hasHubListed: hasHubListed,
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
    markEventFamilyMembersDone: markEventFamilyMembersDone,
    dismiss: dismiss,
    clearDismissed: clearDismissed,
    prepareClaimOnboarding: prepareClaimOnboarding,
    skipForcedReviewAfterClaim: skipForcedReviewAfterClaim,
    unlockProfilesForReview: unlockProfilesForReview,
    buildQueue: buildQueue,
    nextItem: nextItem,
    progressSummary: progressSummary,
    profileEditUrl: profileEditUrl,
    seriesFamilyKey: seriesFamilyKey,
    profileLooksThin: profileLooksThin,
    profileNeedsReview: profileNeedsReview,
    eventLooksPublished: eventLooksPublished,
    eventNeedsHubListingReview: eventNeedsHubListingReview,
    familyNeedsHubListingReview: familyNeedsHubListingReview,
  };
})(typeof window !== 'undefined' ? window : globalThis);
