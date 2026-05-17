-- Kit columns on material_groups
ALTER TABLE public.material_groups
  ADD COLUMN IF NOT EXISTS is_kit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS modulo text[] NOT NULL DEFAULT '{grafica}'::text[],
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS labor_minutes numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_hour_rate_source text NOT NULL DEFAULT 'despesas_fixas',
  ADD COLUMN IF NOT EXISTS labor_hour_rate_manual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_pct numeric,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.material_groups
  DROP CONSTRAINT IF EXISTS material_groups_pricing_mode_check;
ALTER TABLE public.material_groups
  ADD CONSTRAINT material_groups_pricing_mode_check
  CHECK (pricing_mode IN ('fixo','mt2','perimetro','unidade'));

ALTER TABLE public.material_groups
  DROP CONSTRAINT IF EXISTS material_groups_labor_source_check;
ALTER TABLE public.material_groups
  ADD CONSTRAINT material_groups_labor_source_check
  CHECK (labor_hour_rate_source IN ('despesas_fixas','manual'));

CREATE INDEX IF NOT EXISTS idx_material_groups_modulo
  ON public.material_groups USING GIN (modulo);
CREATE INDEX IF NOT EXISTS idx_material_groups_is_kit
  ON public.material_groups (is_kit) WHERE is_kit = true;

-- Scale on each kit item
ALTER TABLE public.material_group_items
  ADD COLUMN IF NOT EXISTS consumo_tipo text NOT NULL DEFAULT 'fixo';

ALTER TABLE public.material_group_items
  DROP CONSTRAINT IF EXISTS material_group_items_consumo_tipo_check;
ALTER TABLE public.material_group_items
  ADD CONSTRAINT material_group_items_consumo_tipo_check
  CHECK (consumo_tipo IN ('fixo','por_m2','por_perimetro_m','por_unidade'));
