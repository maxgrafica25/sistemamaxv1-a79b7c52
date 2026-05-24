
-- 1. Add time_minutes column
ALTER TABLE public.finishings_price_items
  ADD COLUMN IF NOT EXISTS time_minutes integer NOT NULL DEFAULT 0;

-- 2. Backfill time from already-linked steps
UPDATE public.finishings_price_items f
   SET time_minutes = COALESCE(s.time_minutes::int, 0)
  FROM public.production_steps s
 WHERE f.production_step_id = s.id
   AND f.time_minutes = 0;

-- 3. Create a finishing for every production_step that doesn't have one yet
INSERT INTO public.finishings_price_items
  (name, category, size, price_per_sheet, pricing_model, applies_to,
   unit_label, is_active, sort_order, production_step_id, time_minutes)
SELECT
  s.description,
  'outro',
  NULL,
  0,
  'per_unit',
  ARRAY['etiqueta','impressao'],
  'serviço',
  true,
  0,
  s.id,
  COALESCE(s.time_minutes::int, 0)
  FROM public.production_steps s
 WHERE NOT EXISTS (
   SELECT 1 FROM public.finishings_price_items f WHERE f.production_step_id = s.id
 )
   AND NOT EXISTS (
   SELECT 1 FROM public.finishings_price_items f WHERE lower(f.name) = lower(s.description)
 );

-- 4. Sync trigger function: keep production_steps in sync with finishings
CREATE OR REPLACE FUNCTION public.sync_finishing_production_step()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step_id uuid;
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    IF NEW.time_minutes IS NULL OR NEW.time_minutes <= 0 THEN
      -- No time → no managed step. Keep existing link untouched.
      RETURN NEW;
    END IF;

    IF NEW.production_step_id IS NULL THEN
      INSERT INTO public.production_steps (description, time_minutes)
      VALUES (NEW.name, NEW.time_minutes)
      RETURNING id INTO v_step_id;
      NEW.production_step_id := v_step_id;
    ELSE
      UPDATE public.production_steps
         SET description = NEW.name,
             time_minutes = NEW.time_minutes,
             updated_at = now()
       WHERE id = NEW.production_step_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_finishing_production_step_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.production_step_id IS NOT NULL THEN
    -- Only drop the step if nothing else references it
    IF NOT EXISTS (SELECT 1 FROM public.product_kit_items     WHERE process_step_id     = OLD.production_step_id)
       AND NOT EXISTS (SELECT 1 FROM public.step_group_items   WHERE production_step_id  = OLD.production_step_id)
       AND NOT EXISTS (SELECT 1 FROM public.finishings_price_items WHERE production_step_id = OLD.production_step_id AND id <> OLD.id)
       AND NOT EXISTS (SELECT 1 FROM public.cv_calc_acabamento_labor_items WHERE production_step_id = OLD.production_step_id)
    THEN
      DELETE FROM public.production_steps WHERE id = OLD.production_step_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sync_finishing_step_trg ON public.finishings_price_items;
CREATE TRIGGER sync_finishing_step_trg
BEFORE INSERT OR UPDATE ON public.finishings_price_items
FOR EACH ROW EXECUTE FUNCTION public.sync_finishing_production_step();

DROP TRIGGER IF EXISTS sync_finishing_step_del_trg ON public.finishings_price_items;
CREATE TRIGGER sync_finishing_step_del_trg
AFTER DELETE ON public.finishings_price_items
FOR EACH ROW EXECUTE FUNCTION public.sync_finishing_production_step_delete();
