-- Post-event review request: send ~24 hours after an event ends.

update public.email_templates
set description = 'Sent ~24 hours after an event ends to attendees who have not left a review.'
where slug = 'post_event_review_request';
