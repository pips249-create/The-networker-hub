-- Shared rate-limit buckets for auth / sensitive endpoints (survives serverless instances).

CREATE TABLE IF NOT EXISTS public.api_rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  hit_count integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS api_rate_limit_buckets_window_start_idx
  ON public.api_rate_limit_buckets (window_start);

ALTER TABLE public.api_rate_limit_buckets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.api_rate_limit_buckets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_rate_limit_buckets TO service_role;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, retry_after_sec integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := left(trim(both FROM coalesce(p_key, '')), 200);
  v_max integer := greatest(1, coalesce(p_max, 12));
  v_window integer := greatest(1, coalesce(p_window_seconds, 60));
  v_now timestamptz := timezone('utc', now());
  v_row public.api_rate_limit_buckets%ROWTYPE;
  v_retry integer;
BEGIN
  IF v_key = '' THEN
    RETURN QUERY SELECT true, 0, v_max;
    RETURN;
  END IF;

  SELECT * INTO v_row
  FROM public.api_rate_limit_buckets
  WHERE bucket_key = v_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.api_rate_limit_buckets (bucket_key, window_start, hit_count)
    VALUES (v_key, v_now, 1);
    RETURN QUERY SELECT true, 0, greatest(0, v_max - 1);
    RETURN;
  END IF;

  IF v_now - v_row.window_start >= make_interval(secs => v_window) THEN
    UPDATE public.api_rate_limit_buckets
    SET window_start = v_now, hit_count = 1
    WHERE bucket_key = v_key;
    RETURN QUERY SELECT true, 0, greatest(0, v_max - 1);
    RETURN;
  END IF;

  IF v_row.hit_count >= v_max THEN
    v_retry := greatest(
      1,
      ceil(extract(epoch FROM (v_row.window_start + make_interval(secs => v_window) - v_now)))::integer
    );
    RETURN QUERY SELECT false, v_retry, 0;
    RETURN;
  END IF;

  UPDATE public.api_rate_limit_buckets
  SET hit_count = hit_count + 1
  WHERE bucket_key = v_key;

  RETURN QUERY SELECT true, 0, greatest(0, v_max - (v_row.hit_count + 1));
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;

COMMENT ON FUNCTION public.consume_rate_limit IS
  'Atomic per-key rate limit for Hub auth endpoints; used by api/_lib/rate-limit.js';
