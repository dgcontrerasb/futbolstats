CREATE TABLE IF NOT EXISTS public.sportstats_licenses (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  device_id TEXT NOT NULL,
  client_note TEXT,
  client_name TEXT,
  plan_type TEXT NOT NULL,
  plan_label TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT,
  last_active_timestamp BIGINT,
  device_info TEXT,
  revoked BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE public.sportstats_licenses
  ADD COLUMN IF NOT EXISTS id TEXT,
  ADD COLUMN IF NOT EXISTS key TEXT,
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS client_note TEXT,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS plan_type TEXT,
  ADD COLUMN IF NOT EXISTS plan_label TEXT,
  ADD COLUMN IF NOT EXISTS created_at BIGINT,
  ADD COLUMN IF NOT EXISTS expires_at BIGINT,
  ADD COLUMN IF NOT EXISTS last_active_timestamp BIGINT,
  ADD COLUMN IF NOT EXISTS device_info TEXT,
  ADD COLUMN IF NOT EXISTS revoked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sportstats_licenses_key
  ON public.sportstats_licenses(key);
CREATE INDEX IF NOT EXISTS idx_sportstats_licenses_device
  ON public.sportstats_licenses(device_id);

ALTER TABLE public.sportstats_licenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sportstats_licenses FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.sportstats_licenses TO service_role;
