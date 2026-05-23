CREATE TABLE public.product_preset_processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_key TEXT NOT NULL,
  step_id UUID REFERENCES public.production_steps(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.step_groups(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT preset_one_of CHECK (
    (step_id IS NOT NULL AND group_id IS NULL) OR
    (step_id IS NULL AND group_id IS NOT NULL)
  ),
  CONSTRAINT preset_unique_step UNIQUE (preset_key, step_id),
  CONSTRAINT preset_unique_group UNIQUE (preset_key, group_id)
);

CREATE INDEX idx_ppp_preset ON public.product_preset_processes(preset_key);

ALTER TABLE public.product_preset_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppp_select_auth" ON public.product_preset_processes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ppp_admin_insert" ON public.product_preset_processes
  FOR INSERT TO authenticated WITH CHECK (public.is_profile_admin(auth.uid()));

CREATE POLICY "ppp_admin_update" ON public.product_preset_processes
  FOR UPDATE TO authenticated USING (public.is_profile_admin(auth.uid()));

CREATE POLICY "ppp_admin_delete" ON public.product_preset_processes
  FOR DELETE TO authenticated USING (public.is_profile_admin(auth.uid()));