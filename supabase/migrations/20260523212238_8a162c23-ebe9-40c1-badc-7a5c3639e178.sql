-- 1) Campo art_status em quote_materials
ALTER TABLE public.quote_materials
  ADD COLUMN IF NOT EXISTS art_status text;

ALTER TABLE public.quote_materials
  DROP CONSTRAINT IF EXISTS quote_materials_art_status_check;

ALTER TABLE public.quote_materials
  ADD CONSTRAINT quote_materials_art_status_check
  CHECK (art_status IS NULL OR art_status IN ('ready','ajuste','facil','moderada','elaborada','terceirizada'));

-- 2) Seed das 4 etapas de Arte
WITH novos AS (
  SELECT * FROM (VALUES
    ('Arte — Ajuste (até 5min)',     5::numeric),
    ('Arte — Fácil (5–10min)',      10::numeric),
    ('Arte — Moderada (10–20min)',  20::numeric),
    ('Arte — Elaborada (20–30min)', 30::numeric)
  ) AS t(description, time_minutes)
)
INSERT INTO public.production_steps (description, time_minutes, step_type)
SELECT n.description, n.time_minutes, 'acabamento'
  FROM novos n
 WHERE NOT EXISTS (
   SELECT 1 FROM public.production_steps p
    WHERE lower(p.description) = lower(n.description)
 );

-- 3) Seed dos 4 acabamentos vinculados às etapas
WITH alvo AS (
  SELECT id, description
    FROM public.production_steps
   WHERE description IN (
     'Arte — Ajuste (até 5min)',
     'Arte — Fácil (5–10min)',
     'Arte — Moderada (10–20min)',
     'Arte — Elaborada (20–30min)'
   )
)
INSERT INTO public.finishings_price_items
  (name, category, pricing_model, applies_to, price_per_sheet, production_step_id, unit_label, is_active, sort_order)
SELECT
  a.description,
  'arte',
  'per_unit'::finishing_pricing_model,
  ARRAY['impressao','etiqueta']::text[],
  0,
  a.id,
  'arte',
  true,
  900
  FROM alvo a
 WHERE NOT EXISTS (
   SELECT 1 FROM public.finishings_price_items f
    WHERE lower(f.name) = lower(a.description)
 );