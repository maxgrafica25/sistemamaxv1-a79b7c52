ALTER TABLE public.finishings_price_items
ADD COLUMN production_step_id UUID NULL REFERENCES public.production_steps(id) ON DELETE SET NULL;

CREATE INDEX idx_finishings_price_items_production_step_id
ON public.finishings_price_items(production_step_id);