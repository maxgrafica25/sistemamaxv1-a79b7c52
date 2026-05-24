ALTER TABLE public.global_settings
ADD COLUMN IF NOT EXISTS pricing_regime text NOT NULL DEFAULT 'por_fora'
CHECK (pricing_regime IN ('por_fora','por_dentro'));