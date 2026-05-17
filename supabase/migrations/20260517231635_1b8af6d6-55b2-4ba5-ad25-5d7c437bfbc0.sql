-- Phase 3b: cache for historical suggestions
CREATE TABLE IF NOT EXISTS public.historical_suggestion_cache (
  signature text PRIMARY KEY,
  payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

ALTER TABLE public.historical_suggestion_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read historical cache"
  ON public.historical_suggestion_cache FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role manage historical cache"
  ON public.historical_suggestion_cache FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_hist_cache_expires ON public.historical_suggestion_cache(expires_at);