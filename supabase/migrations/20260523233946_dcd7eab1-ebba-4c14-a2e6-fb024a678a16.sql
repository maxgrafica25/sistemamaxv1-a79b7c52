CREATE OR REPLACE FUNCTION public.validate_production_step_minutes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.time_minutes IS NULL OR NEW.time_minutes <= 0 THEN
    RAISE EXCEPTION 'Etapa de produção precisa de tempo maior que zero (minutos). Recebido: %', NEW.time_minutes;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_production_step_minutes ON public.production_steps;
CREATE TRIGGER trg_validate_production_step_minutes
BEFORE INSERT OR UPDATE ON public.production_steps
FOR EACH ROW
EXECUTE FUNCTION public.validate_production_step_minutes();