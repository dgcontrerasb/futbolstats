CREATE TABLE IF NOT EXISTS sportstats_client_login_attempts (
  login_key_hash TEXT PRIMARY KEY CHECK (login_key_hash ~ '^[0-9a-f]{64}$'),
  attempt_count INTEGER NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_login_attempts_window
  ON sportstats_client_login_attempts(window_started_at);

ALTER TABLE sportstats_client_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sportstats_client_login_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE sportstats_client_login_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.sportstats_consume_client_login_attempt(
  p_login_key_hash TEXT,
  p_max_attempts INTEGER,
  p_window_seconds INTEGER,
  p_reset BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(blocked BOOLEAN, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_attempt_count INTEGER;
  v_window_started_at TIMESTAMPTZ;
BEGIN
  IF p_login_key_hash IS NULL
    OR p_login_key_hash !~ '^[0-9a-f]{64}$'
    OR p_max_attempts IS NULL
    OR p_max_attempts < 1
    OR p_window_seconds IS NULL
    OR p_window_seconds < 1
  THEN
    RAISE EXCEPTION 'Invalid client login throttle parameters';
  END IF;

  IF p_reset THEN
    DELETE FROM public.sportstats_client_login_attempts AS attempts
    WHERE attempts.login_key_hash = p_login_key_hash;
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  DELETE FROM public.sportstats_client_login_attempts AS attempts
  WHERE attempts.window_started_at < v_now - INTERVAL '24 hours';

  INSERT INTO public.sportstats_client_login_attempts AS attempts (
    login_key_hash,
    attempt_count,
    window_started_at,
    updated_at
  )
  VALUES (p_login_key_hash, 1, v_now, v_now)
  ON CONFLICT (login_key_hash) DO UPDATE
  SET attempt_count = CASE
        WHEN attempts.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN 1
        ELSE LEAST(attempts.attempt_count + 1, p_max_attempts + 1)
      END,
      window_started_at = CASE
        WHEN attempts.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN v_now
        ELSE attempts.window_started_at
      END,
      updated_at = v_now
  RETURNING attempts.attempt_count, attempts.window_started_at
  INTO v_attempt_count, v_window_started_at;

  RETURN QUERY
  SELECT
    v_attempt_count > p_max_attempts,
    CASE
      WHEN v_attempt_count > p_max_attempts THEN
        GREATEST(
          1,
          CEIL(EXTRACT(EPOCH FROM v_window_started_at + make_interval(secs => p_window_seconds) - v_now))::INTEGER
        )
      ELSE 0
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.sportstats_consume_client_login_attempt(TEXT, INTEGER, INTEGER, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sportstats_consume_client_login_attempt(TEXT, INTEGER, INTEGER, BOOLEAN)
  TO service_role;
