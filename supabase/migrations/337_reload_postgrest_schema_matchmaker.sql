-- After 333 added Matchmaker columns, PostgREST may still serve a stale schema
-- cache (PGRST204). Ask the API to reload so profile PATCH can write them.
NOTIFY pgrst, 'reload schema';
