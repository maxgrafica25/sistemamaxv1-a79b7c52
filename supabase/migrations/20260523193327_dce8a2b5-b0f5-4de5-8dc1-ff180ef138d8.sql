
-- Fase 2.1: adiciona FK opcional ligando itens de grupo a Etapas individuais
ALTER TABLE public.step_group_items
  ADD COLUMN IF NOT EXISTS production_step_id UUID REFERENCES public.production_steps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_step_group_items_production_step_id
  ON public.step_group_items(production_step_id);
