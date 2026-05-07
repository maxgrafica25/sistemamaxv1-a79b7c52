
CREATE TABLE public.quote_approval_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL,
  quote_number TEXT NOT NULL,
  quote_version INTEGER NOT NULL DEFAULT 1,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approver_name TEXT NOT NULL,
  approver_ip TEXT,
  user_agent TEXT,
  items_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_approved NUMERIC NOT NULL DEFAULT 0,
  terms_version TEXT NOT NULL DEFAULT 'v1-2026-05',
  terms_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_approval_receipts_quote_id ON public.quote_approval_receipts(quote_id);

ALTER TABLE public.quote_approval_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert approval receipts"
  ON public.quote_approval_receipts FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(approver_name) BETWEEN 2 AND 200
    AND char_length(terms_text) BETWEEN 10 AND 4000
  );

CREATE POLICY "Authenticated can read approval receipts"
  ON public.quote_approval_receipts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon can read receipts of own quote"
  ON public.quote_approval_receipts FOR SELECT
  TO anon
  USING (true);
