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

  function showAlreadyReviewed() {
    qs('lr-loading').hidden = true;
    qs('lr-form-wrap').hidden = true;
    qs('lr-done').hidden = false;
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

  function showSuccess(message) {
    qs('lr-form-wrap').hidden = true;
    qs('lr-success').hidden = false;
    if (message) qs('lr-success-text').textContent = message;
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
              showAlreadyReviewed();
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
          showSuccess(reward);
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
        showAlreadyReviewed();
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
