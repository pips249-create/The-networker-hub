(function () {
        var params = new URLSearchParams(location.search);
        var ids = (params.get('ids') || '').trim();
        var ticketsHref = '/organiser/event-tickets' + (ids ? '?ids=' + encodeURIComponent(ids) : '');
        Array.prototype.forEach.call(document.querySelectorAll('[data-tickets-link]'), function (el) {
          el.setAttribute('href', ticketsHref);
        });

        var sections = ['tickets', 'membership', 'both']
          .map(function (id) {
            return document.getElementById(id);
          })
          .filter(Boolean);
        if (!sections.length) return;

        function compareLinks() {
          return Array.prototype.slice.call(
            document.querySelectorAll('.ee-booking-help-compare-item[data-booking-nav]')
          );
        }

        function setActive(id) {
          compareLinks().forEach(function (link) {
            var on = link.getAttribute('data-booking-nav') === id;
            link.classList.toggle('is-active', on);
            if (on) link.setAttribute('aria-current', 'true');
            else link.removeAttribute('aria-current');
          });
          sections.forEach(function (section) {
            section.classList.toggle('is-current', section.id === id);
          });
        }

        function goToOption(id, hrefId) {
          var target =
            (hrefId && document.getElementById(hrefId)) || document.getElementById(id);
          if (!target) return;
          setActive(id);
          try {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } catch (err) {
            target.scrollIntoView(true);
          }
          if (history.replaceState) {
            history.replaceState(null, '', '#' + (hrefId || id));
          } else {
            location.hash = hrefId || id;
          }
        }

        var helpRoot = document.querySelector('.ee-booking-help');
        if (helpRoot) {
          helpRoot.addEventListener('click', function (e) {
            var link = e.target.closest('[data-booking-nav]');
            if (!link || !helpRoot.contains(link)) return;
            var id = link.getAttribute('data-booking-nav');
            var hrefId = (link.getAttribute('href') || '').replace(/^#/, '');
            if (!id && !hrefId) return;
            e.preventDefault();
            goToOption(id, hrefId);
          });
        }

        if ('IntersectionObserver' in window) {
          var observer = new IntersectionObserver(
            function (entries) {
              var visible = entries
                .filter(function (entry) {
                  return entry.isIntersecting;
                })
                .sort(function (a, b) {
                  return b.intersectionRatio - a.intersectionRatio;
                })[0];
              if (visible && visible.target && visible.target.id) {
                setActive(visible.target.id);
              }
            },
            { root: null, rootMargin: '-30% 0px -45% 0px', threshold: [0.15, 0.35, 0.55] }
          );
          sections.forEach(function (section) {
            observer.observe(section);
          });
        }

        var hash = (location.hash || '').replace(/^#/, '');
        if (hash === 'membership-benefits') setActive('membership');
        else if (hash && document.getElementById(hash)) setActive(hash);
        else setActive(sections[0].id);

        var findInput = document.getElementById('ee-booking-help-find');
        var findSuggest = document.getElementById('ee-booking-help-suggest');
        var findTitle = document.getElementById('ee-booking-help-suggest-title');
        var findWhy = document.getElementById('ee-booking-help-suggest-why');
        var findEmpty = document.getElementById('ee-booking-help-find-empty');
        var optionCopy = {
          tickets: {
            name: 'Option 1 — Ticket for this event',
            why: 'This sounds like a ticketed date. Everyone books the same way — for example they pay for their own breakfast with a ticket. No membership needed.',
          },
          membership: {
            name: 'Option 2 — Free visits, then membership',
            why: 'This sounds like a new group. People try a meeting free, then join. You stay on this option when they become members.',
          },
          both: {
            name: 'Option 3 — Ticket and membership',
            why: 'This sounds like a group that already has members — including if the session is a masterclass or is free. Guests can book a ticket (or come free). Members book at their own price, often £0. You can invite them and they can receive emails.',
          },
        };

        function norm(text) {
          return String(text || '')
            .toLowerCase()
            .replace(/['’]/g, '')
            .replace(/[^a-z0-9£ ]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }

        function hasPhrase(n, phrase) {
          if (!phrase) return false;
          if (phrase.indexOf(' ') !== -1) return n.indexOf(phrase) !== -1;
          return (' ' + n + ' ').indexOf(' ' + phrase + ' ') !== -1;
        }

        function hasAny(n, phrases) {
          for (var i = 0; i < phrases.length; i++) {
            if (hasPhrase(n, phrases[i])) return true;
          }
          return false;
        }

        function suggestOption(raw) {
          var n = norm(raw);
          var words = n.split(' ').filter(Boolean);
          if (!n || words.length < 2) return null;

          var hasMembers = hasAny(n, ['member', 'members', 'membership', 'regulars']);
          var noMembersYet = hasAny(n, [
            'no members',
            'without members',
            'dont have members',
            'do not have members',
            'havent got members',
            'have not got members',
            'nobody yet',
            'no one yet',
            'from scratch',
            'brand new',
          ]);
          var hasOldOrExisting = hasAny(n, [
            'old',
            'existing',
            'established',
            'returning',
            'current members',
            'already have',
            'already run',
            'on the books',
            'regulars',
            'new and old',
            'new and existing',
          ]);
          var newGroup = hasAny(n, [
            'new group',
            'create a group',
            'creating a group',
            'start a group',
            'starting a group',
            'starting up',
            'just starting',
          ]);
          var tryJoin = hasAny(n, [
            'try then join',
            'try a meeting',
            'try free',
            'free visit',
            'free visits',
            'trial visit',
            'trial visits',
          ]);
          var recurring = hasAny(n, [
            'monthly',
            'every month',
            'each month',
            'weekly',
            'every week',
            'regular',
            'ongoing',
          ]);
          var newMembersOnly = hasAny(n, [
            'new members only',
            'only new members',
            'just new members',
            'newcomers only',
            'new people only',
          ]);
          var paysByTicket = hasAny(n, [
            'ticket',
            'tickets',
            'buy a ticket',
            'with a ticket',
            'breakfast ticket',
            'pay for breakfast',
            'own breakfast',
            'pay their own',
            'pay for their own',
            'pay for lunch',
            'own lunch',
          ]);
          var twoPrices = hasAny(n, [
            'guest ticket',
            'guests pay',
            'visitors pay',
            'members pay less',
            'members pay nothing',
            'members pay a different',
            'member price',
            'members for free',
            'members go free',
            'different price',
          ]);

          // Same ticket for everyone (e.g. new members buy their own breakfast) is Option 1.
          if (paysByTicket && newMembersOnly && !hasOldOrExisting && !twoPrices) {
            return 'tickets';
          }
          if (paysByTicket && !hasOldOrExisting && !twoPrices && !tryJoin && !newGroup) {
            return 'tickets';
          }

          // Members always beat the event format (masterclass, seminar, event).
          if (hasMembers && !newMembersOnly && (hasOldOrExisting || twoPrices)) return 'both';
          if (hasMembers && !newMembersOnly && !noMembersYet && !newGroup && recurring) {
            return 'both';
          }
          if (hasMembers && !newMembersOnly && !noMembersYet && !newGroup && !paysByTicket) {
            return 'both';
          }

          if ((newGroup || noMembersYet || tryJoin) && !hasOldOrExisting) {
            return 'membership';
          }

          var oneOff = hasAny(n, [
            'masterclass',
            'workshop',
            'conference',
            'exhibition',
            'expo',
            'seminar',
            'bootcamp',
            'webinar',
            'retreat',
            'summit',
            'awards',
            'one off',
            'ticketed',
            '3 day',
            '3 days',
            'three day',
            'three days',
            'ticket',
            'tickets',
          ]);
          if (oneOff && !hasMembers) return 'tickets';

          return null;
        }

        var findCta = document.getElementById('ee-booking-help-suggest-cta');
        var tableAlt = document.getElementById('ee-booking-help-table-alt');
        var tableScroll = document.getElementById('ee-booking-help-table-scroll');

        function showSuggestion() {
          if (!findInput) return;
          var raw = findInput.value.trim();
          var option = suggestOption(raw);
          if (findSuggest) findSuggest.hidden = !option;
          if (findEmpty) findEmpty.hidden = !(raw.length >= 12 && !option);
          if (tableAlt) tableAlt.hidden = !!option;
          if (tableScroll) tableScroll.hidden = !!option;
          if (!option) {
            if (findTitle) findTitle.innerHTML = '';
            if (findWhy) findWhy.textContent = '';
            if (findCta) findCta.innerHTML = '';
            return;
          }
          var copy = optionCopy[option];
          if (findTitle) {
            findTitle.textContent = copy.name;
          }
          if (findWhy) findWhy.textContent = copy.why;
          if (findCta) {
            findCta.innerHTML =
              '<a class="ee-btn ee-btn-gold" href="#' +
              option +
              '" data-booking-nav="' +
              option +
              '">Read Option ' +
              (option === 'tickets' ? '1' : option === 'membership' ? '2' : '3') +
              ' →</a>';
          }
        }

        if (findInput) {
          findInput.addEventListener('input', showSuggestion);
        }
      })();
