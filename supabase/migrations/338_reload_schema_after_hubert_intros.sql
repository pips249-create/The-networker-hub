-- Ensure PostgREST sees hubert_intro_requests / messages after 335 is applied.
-- Safe to run even if 335 was applied earlier; only refreshes the API schema cache.
NOTIFY pgrst, 'reload schema';
