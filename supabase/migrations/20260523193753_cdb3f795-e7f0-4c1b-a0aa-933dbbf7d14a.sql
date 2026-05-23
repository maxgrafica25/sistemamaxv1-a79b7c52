
-- Fase 3: fonte única — itens de grupo são só atalhos para Etapas
ALTER TABLE public.step_group_items
  ALTER COLUMN production_step_id SET NOT NULL;

ALTER TABLE public.step_group_items
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS time_minutes,
  DROP COLUMN IF EXISTS step_type;
