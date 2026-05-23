
-- Backfill: amarrar step_group_items à Etapa correspondente por descrição
UPDATE public.step_group_items sgi
SET production_step_id = ps.id
FROM public.production_steps ps
WHERE sgi.production_step_id IS NULL
  AND lower(trim(ps.description)) = lower(trim(sgi.description));
