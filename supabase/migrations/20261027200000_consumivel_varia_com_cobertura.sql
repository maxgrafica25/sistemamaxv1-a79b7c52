-- Só toner/tinta gastam mais com mais cobertura; o resto (fusor, belt, cilindro,
-- manutenção, depreciação...) custa o mesmo por página.
ALTER TABLE public.equipment_consumables
  ADD COLUMN IF NOT EXISTS scales_with_coverage boolean NOT NULL DEFAULT true;

UPDATE public.equipment_consumables
SET scales_with_coverage = false
WHERE name !~* '(toner|tinta)';
