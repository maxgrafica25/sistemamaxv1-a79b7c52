ALTER TABLE public.quote_materials ADD COLUMN IF NOT EXISTS tier_group_id text NULL;
ALTER TABLE public.quote_third_party ADD COLUMN IF NOT EXISTS tier_group_id text NULL;
ALTER TABLE public.cv_quote_items ADD COLUMN IF NOT EXISTS tier_group_id text NULL;
CREATE INDEX IF NOT EXISTS idx_quote_materials_tier_group ON public.quote_materials (quote_id, tier_group_id) WHERE tier_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quote_third_party_tier_group ON public.quote_third_party (quote_id, tier_group_id) WHERE tier_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cv_quote_items_tier_group ON public.cv_quote_items (quote_id, tier_group_id) WHERE tier_group_id IS NOT NULL;