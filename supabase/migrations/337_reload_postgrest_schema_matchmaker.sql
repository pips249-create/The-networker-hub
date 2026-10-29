-- After Matchmaker migrations (333 discoverable columns, 335 intro tables,
-- 336 hub invites), PostgREST may still serve a stale schema cache.
-- Ask the API to reload so profile / intro routes can see the new objects.
NOTIFY pgrst, 'reload schema';
