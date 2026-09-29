(function () {
  var rating = 0;
  var token = '';
  var eventId = '';

  function qs(id) {
    return document.getElementById(id);
  }

  function params() {
    return new URLSearchParams(location.search);
  }

  function setStars(value) {
    rating = value;
    document.querySelectorAll('.lr-star').forEach(function (btn) {
      var n = Number(btn.getAttribute('data-rating'));
      btn.classList.toggle('is-active', n <= value);
    });
    var feedback = qs('lr-feedback-step');
    var submit = qs('lr-submit');
    var hint = qs('lr-rating-hint');
    if (value >= 1) {
      if (feedback) feedback.hidden = false;
      if (submit) submit.disabled = false;
      if (hint) hint.textContent = 'Add an optional note, then submit.';
    }
  }

  function showInvalid() {
    qs('lr-loading').hidden = true;
    qs('lr-form-wrap').hidden = true;
    qs('lr-invalid').hidden = false;
  }

  function applyFollowUp(followUp, mountId) {
    if (!followUp || typeof followUp !== 'object') return;
    var hasLinked = followUp.hasLinkedAccount === true;
    var register = followUp.registerUrl;
    var login = followUp.loginUrl;
    var account = followUp.accountUrl || '/account/#reviews-done';
    var settings = followUp.settingsUrl || '/account/settings';
    var needsProfile = followUp.profileNeedsDetails !== false;

    if (mountId === 'success') {
      var guestBlock = qs('lr-followup');
      var linkedBlock = qs('lr-followup-linked');
      if (hasLinked) {
        if (guestBlock) guestBlock.hidden = true;
        if (linkedBlock) {
          linkedBlock.hidden = false;
          var linkedText = qs('lr-followup-linked-text');
          if (linkedText) {
            linkedText.textContent = needsProfile
              ? 'Your review is saved in your account. Add company and job title in profile settings for name badges at your next event.'
              : 'Your review is saved in your attendee dashboard.';
          }
          var acc = qs('lr-account-link-success');
          var set = qs('lr-settings-link');
          if (acc) acc.href = account;
          if (set) set.hidden = !needsProfile;
          if (set) set.href = settings;
        }
      } else if (guestBlock) {
        guestBlock.hidden = false;
        var reg = qs('lr-register-link');
        var log = qs('lr-login-link');
        if (reg && register) reg.href = register;
        if (log && login) log.href = login;
      }
      return;
    }

    if (mountId === 'done') {
      var host = qs('lr-done-followup');
      if (!host || hasLinked) return;
      host.hidden = false;
      host.className = 'lr-followup';
      host.innerHTML =
        '<h3 class="lr-followup-title">Optional — save your reviews in a free account</h3>' +
        '<p class="lr-followup-lede">Track tickets and past reviews, and add company and job title for name badges.</p>' +
        '<div class="lr-actions lr-followup-actions">' +
        '<a class="lr-btn-primary" href="' +
        (register || '/register?intent=networker&next=%2Faccount%2Fsettings') +
        '">Create free account</a>' +
        '<a class="lr-btn-secondary" href="' +
        (login || '/login?next=%2Faccount%2Fsettings') +
        '">Sign in</a>' +
        '</div>';
    }
  }

  function showAlreadyReviewed(followUp) {
    qs('lr-loading').hidden = true;
    qs('lr-form-wrap').hidden = true;
    qs('lr-done').hidden = false;
    applyFollowUp(followUp, 'done');
  }

  function showForm(ctx) {
    qs('lr-loading').hidden = true;
    qs('lr-form-wrap').hidden = false;
    eventId = ctx.eventId || '';
    qs('lr-event-id').value = eventId;
    qs('lr-event-title').textContent = ctx.eventTitle || 'Event';
    qs('lr-event-meta').textContent = ctx.eventMeta || '';
    qs('lr-event-chip').hidden = false;
    qs('lr-heading').textContent = 'How was ' + (ctx.eventTitle || 'it') + '?';
    var account = qs('lr-account-link');
    if (account) {
      account.hidden = false;
      var href = qs('lr-account-href');
      if (href) {
        href.href =
          '/account/?review=' + encodeURIComponent(eventId) + '#review/' + encodeURIComponent(eventId);
      }
    }
    var ratingParam = Number(params().get('rating') || 0);
    if (ratingParam >= 1 && ratingParam <= 5) setStars(Math.round(ratingParam));
  }

  function showSuccess(message, followUp) {
    qs('lr-form-wrap').hidden = true;
    qs('lr-success').hidden = false;
    if (message) qs('lr-success-text').textContent = message;
    applyFollowUp(followUp, 'success');
  }

  async function init() {
    token = String(params().get('token') || '').trim();
    if (!token) {
      showInvalid();
      return;
    }

    document.querySelectorAll('.lr-star').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setStars(Number(btn.getAttribute('data-rating')) || 0);
      });
    });

    var form = qs('lr-form');
    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var errEl = qs('lr-error');
        var submitBtn = qs('lr-submit');
        if (errEl) errEl.hidden = true;
        if (!rating) {
          if (errEl) {
            errEl.textContent = 'Please choose a star rating.';
            errEl.hidden = false;
          }
          return;
        }
        if (submitBtn) submitBtn.disabled = true;
        try {
          var res = await fetch('/api/email-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: token,
              eventId: eventId,
              rating: rating,
              reviewText: qs('lr-text') ? qs('lr-text').value.trim() : '',
            }),
          });
          var data = await res.json();
          if (!data.ok) {
            var msg =
              data.error === 'review_already_submitted'
                ? 'You have already reviewed this event.'
                : data.error === 'event_not_finished'
                  ? 'You can leave a review after the event has finished.'
                  : data.error === 'not_eligible' || data.error === 'did_not_attend'
                    ? 'This review link is only for confirmed attendees.'
                    : data.message || data.error || 'Could not submit review.';
            if (data.error === 'review_already_submitted') {
              showAlreadyReviewed(data);
              return;
            }
            if (errEl) {
              errEl.textContent = msg;
              errEl.hidden = false;
            }
            return;
          }
          var reward =
            (data.reviewerReward && data.reviewerReward.toastMessage) ||
            'Thanks — your review helps this group on The Networker UK.';
          showSuccess(reward, data);
        } catch (submitErr) {
          if (errEl) {
            errEl.textContent =
              (submitErr && submitErr.message) || 'Something went wrong. Please try again.';
            errEl.hidden = false;
          }
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    try {
      var infoRes = await fetch('/api/email-review?token=' + encodeURIComponent(token), {
        credentials: 'omit',
      });
      var info = await infoRes.json();
      if (!info.ok) {
        showInvalid();
        return;
      }
      if (info.alreadyReviewed) {
        showAlreadyReviewed(info);
        return;
      }
      if (!info.canReview) {
        showInvalid();
        return;
      }
      showForm(info);
    } catch {
      showInvalid();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
