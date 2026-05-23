ALTER TABLE public.production_steps
  ADD COLUMN IF NOT EXISTS step_group_id uuid NULL
  REFERENCES public.step_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_production_steps_step_group_id
  ON public.production_steps(step_group_id);