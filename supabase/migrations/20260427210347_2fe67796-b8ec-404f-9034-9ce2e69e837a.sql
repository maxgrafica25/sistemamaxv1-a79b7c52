ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS client_id uuid;
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON public.quotes(client_id);