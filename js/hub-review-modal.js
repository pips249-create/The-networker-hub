/**
 * Shared leave-a-review modal — used on organiser profile and elsewhere.
 */
(function () {
  var reviewRating = 0;
  var modalOpen = false;
  var onSubmittedCb = null;
  var reviewNameState = {
    legalName: '',
    reviewNameMode: 'name',
    networkerAlias: 'Networker ####',
    reviewNameExample: 'Alex M.',
    reviewDisplayName: 'Attendee',
  };

  function el(id) {
    return document.getElementById(id);
  }

  function selectedReviewNameMode() {
    var checked = document.querySelector('#hub-rm-form input[name="reviewNameMode"]:checked');
    return checked && checked.value === 'anonymous' ? 'anonymous' : 'name';
  }

  function formatReviewDisplayName() {
    if (selectedReviewNameMode() === 'anonymous') {
      return reviewNameState.networkerAlias || 'Networker ####';
    }
    return reviewNameState.reviewNameExample || reviewNameState.reviewDisplayName || 'Attendee';
  }

  function updateReviewNamePreview() {
    var preview = el('hub-rm-name-preview');
    if (!preview) return;
    preview.textContent = formatReviewDisplayName();
  }

  function syncReviewNameFields() {
    var nameRadio = el('hub-rm-name-mode-name');
    var anonRadio = el('hub-rm-name-mode-anonymous');
    var mode = reviewNameState.reviewNameMode === 'anonymous' ? 'anonymous' : 'name';
    if (nameRadio) nameRadio.checked = mode === 'name';
    if (anonRadio) anonRadio.checked = mode === 'anonymous';
    var example = el('hub-rm-name-example');
    if (example) {
      example.textContent = reviewNameState.reviewNameExample
        ? '(' + reviewNameState.reviewNameExample + ')'
        : '';
    }
    var alias = el('hub-rm-networker-alias');
    if (alias) alias.textContent = reviewNameState.networkerAlias || 'Networker ####';
    updateReviewNamePreview();
  }

  async function loadReviewNameState() {
    try {
      var res = await fetch('/api/auth/profile', { credentials: 'include' });
      var data = await res.json();
      if (data.ok && data.profile) {
        reviewNameState.legalName = String(data.profile.name || '').trim();
        reviewNameState.reviewNameMode =
          data.profile.reviewNameMode === 'anonymous' ? 'anonymous' : 'name';
        reviewNameState.networkerAlias =
          String(data.profile.networkerAlias || '').trim() || 'Networker ####';
        reviewNameState.reviewNameExample =
          String(data.profile.reviewNameExample || '').trim() || 'Alex M.';
        reviewNameState.reviewDisplayName =
          String(data.profile.reviewDisplayName || '').trim() || 'Attendee';
      }
    } catch (e) {
      /* keep existing state */
    }
    syncReviewNameFields();
  }

  async function savePublicReviewNameIfChanged() {
    var next = selectedReviewNameMode();
    var prev = reviewNameState.reviewNameMode === 'anonymous' ? 'anonymous' : 'name';
    if (next === prev) return true;
    var res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewNameMode: next }),
    });
    var data = await res.json();
    if (!data.ok) {
      throw new Error(data.message || data.error || 'Could not save review name preference.');
    }
    if (data.profile) {
      reviewNameState.legalName = String(data.profile.name || reviewNameState.legalName || '').trim();
      reviewNameState.reviewNameMode =
        data.profile.reviewNameMode === 'anonymous' ? 'anonymous' : 'name';
      reviewNameState.networkerAlias =
        String(data.profile.networkerAlias || '').trim() || reviewNameState.networkerAlias;
      reviewNameState.reviewNameExample =
        String(data.profile.reviewNameExample || '').trim() || reviewNameState.reviewNameExample;
      reviewNameState.reviewDisplayName =
        String(data.profile.reviewDisplayName || '').trim() || reviewNameState.reviewDisplayName;
    }
    syncReviewNameFields();
    return true;
  }

  function setReviewStars(rating) {
    reviewRating = rating;
    var stars = document.querySelectorAll('#hub-rm-stars .hub-rm-star');
    stars.forEach(function (btn) {
      var n = Number(btn.getAttribute('data-rating'));
      btn.classList.toggle('is-active', n <= rating);
      btn.setAttribute('aria-checked', n === rating ? 'true' : 'false');
    });
  }

  function showFeedbackStep() {
    var feedbackStep = el('hub-rm-feedback-step');
    var submitBtn = el('hub-rm-submit');
    var hint = el('hub-rm-rating-hint');
    var text = el('hub-rm-text');
    if (feedbackStep) feedbackStep.hidden = false;
    if (submitBtn) submitBtn.hidden = false;
    if (hint) hint.hidden = true;
    if (text) text.focus();
  }

  function resetFeedbackStep() {
    var feedbackStep = el('hub-rm-feedback-step');
    var submitBtn = el('hub-rm-submit');
    var hint = el('hub-rm-rating-hint');
    if (feedbackStep) feedbackStep.hidden = true;
    if (submitBtn) submitBtn.hidden = true;
    if (hint) hint.hidden = false;
  }

  function showPickStep(show) {
    var pickStep = el('hub-rm-pick-step');
    var formStep = el('hub-rm-form-step');
    if (pickStep) pickStep.hidden = !show;
    if (formStep) formStep.hidden = show;
  }

  function close() {
    var modal = el('hub-rm-modal');
    if (modal) modal.hidden = true;
    modalOpen = false;
    document.body.classList.remove('hub-rm-modal-open');
    resetFeedbackStep();
    showPickStep(false);
    var formStep = el('hub-rm-form-step');
    if (formStep) formStep.hidden = false;
  }

  function open(reg) {
    var modal = el('hub-rm-modal');
    var sub = el('hub-rm-sub');
    var eventIdInput = el('hub-rm-event-id');
    var text = el('hub-rm-text');
    var err = el('hub-rm-error');
    if (!modal || !eventIdInput) return;

    var org = reg.organiserName ? String(reg.organiserName).trim() : 'the organiser';
    if (sub) {
      sub.textContent =
        'Share feedback about ' +
        org +
        ' after attending “' +
        (reg.title || 'Event') +
        '”. Your review appears on their organiser profile.';
    }
    eventIdInput.value = reg.eventId || '';
    if (text) text.value = '';
    if (err) err.hidden = true;
    setReviewStars(0);
    resetFeedbackStep();
    showPickStep(false);
    syncReviewNameFields();
    loadReviewNameState();
    modal.hidden = false;
    modalOpen = true;
    document.body.classList.add('hub-rm-modal-open');
  }

  function openPicker(registrations, organiserName) {
    var modal = el('hub-rm-modal');
    var sub = el('hub-rm-sub');
    var list = el('hub-rm-pick-list');
    var err = el('hub-rm-error');
    if (!modal || !list) return;

    if (sub) {
      sub.textContent =
        'Choose which event with ' +
        (organiserName || 'this organiser') +
        ' you would like to review.';
    }
    if (err) err.hidden = true;
    list.innerHTML = registrations
      .map(function (reg) {
        return (
          '<button type="button" class="hub-rm-pick-item" data-event-id="' +
          String(reg.eventId || '').replace(/"/g, '&quot;') +
          '" data-event-title="' +
          String(reg.title || 'Event').replace(/"/g, '&quot;') +
          '">' +
          '<strong>' +
          String(reg.title || 'Event').replace(/</g, '&lt;') +
          '</strong>' +
          '</button>'
        );
      })
      .join('');

    list.querySelectorAll('.hub-rm-pick-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        open({
          eventId: btn.getAttribute('data-event-id'),
          title: btn.getAttribute('data-event-title'),
          organiserName: organiserName,
        });
      });
    });

    showPickStep(true);
    modal.hidden = false;
    modalOpen = true;
    document.body.classList.add('hub-rm-modal-open');
  }

  function bindEvents() {
    var modal = el('hub-rm-modal');
    if (!modal || modal.dataset.hubRmBound) return;
    modal.dataset.hubRmBound = '1';

    var backdrop = el('hub-rm-backdrop');
    var closeBtn = el('hub-rm-close');
    var cancelBtn = el('hub-rm-cancel');
    var changeRatingBtn = el('hub-rm-change-rating');
    var form = el('hub-rm-form');
    var stars = el('hub-rm-stars');

    [backdrop, closeBtn, cancelBtn].forEach(function (node) {
      if (!node) return;
      node.addEventListener('click', close);
    });

    if (changeRatingBtn) {
      changeRatingBtn.addEventListener('click', function () {
        resetFeedbackStep();
        var firstStar = stars && stars.querySelector('.hub-rm-star');
        if (firstStar) firstStar.focus();
      });
    }

    if (stars) {
      stars.querySelectorAll('.hub-rm-star').forEach(function (btn) {
        btn.addEventListener('click', function () {
          setReviewStars(Number(btn.getAttribute('data-rating')) || 0);
          showFeedbackStep();
        });
      });
    }

    document.querySelectorAll('#hub-rm-form input[name="reviewNameMode"]').forEach(function (input) {
      input.addEventListener('change', updateReviewNamePreview);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalOpen) close();
    });

    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var err = el('hub-rm-error');
        var submitBtn = el('hub-rm-submit');
        var eventId = el('hub-rm-event-id')?.value || '';
        var reviewText = el('hub-rm-text')?.value?.trim() || '';

        if (err) err.hidden = true;
        if (!reviewRating) {
          if (err) {
            err.textContent = 'Please choose a star rating.';
            err.hidden = false;
          }
          return;
        }

        if (submitBtn) submitBtn.disabled = true;
        try {
          await savePublicReviewNameIfChanged();
          var res = await fetch('/api/auth/reviews', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventId: eventId,
              rating: reviewRating,
              reviewText: reviewText,
            }),
          });
          var data = await res.json();
          if (!data.ok) {
            var msg =
              data.error === 'not_eligible'
                ? 'Only confirmed ticket holders can leave a review for this event.'
                : data.error === 'did_not_attend'
                  ? 'This review is only available to people who attended the event.'
                  : data.error === 'review_already_submitted'
                  ? 'You have already reviewed this event.'
                  : data.error === 'event_not_finished'
                    ? 'You can leave a review after the event has finished.'
                    : data.message || data.error || 'Could not submit review.';
            if (err) {
              err.textContent = msg;
              err.hidden = false;
            }
            return;
          }
          close();
          if (typeof onSubmittedCb === 'function') {
            onSubmittedCb(data.review, data.reviewerReward || (data.review && data.review.reviewerReward) || null);
          }
        } catch (submitErr) {
          if (err) {
            err.textContent =
              (submitErr && submitErr.message) || 'Something went wrong. Please try again.';
            err.hidden = false;
          }
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  }

  window.HubReviewModal = {
    init: function (options) {
      options = options || {};
      onSubmittedCb = options.onSubmitted || null;
      bindEvents();
    },
    open: open,
    openPicker: openPicker,
    close: close,
  };
})();
