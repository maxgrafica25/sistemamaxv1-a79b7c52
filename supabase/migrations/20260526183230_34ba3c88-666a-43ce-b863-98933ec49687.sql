
-- 1) is_financeiro column + escalation trigger
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_financeiro boolean NOT NULL DEFAULT false;

UPDATE public.profiles
   SET is_financeiro = true
 WHERE display_name IN ('Juliano', 'Marcelle')
   AND is_active = true;

CREATE OR REPLACE FUNCTION public.prevent_financeiro_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_financeiro IS DISTINCT FROM OLD.is_financeiro
     AND NOT public.is_profile_admin(auth.uid()) THEN
    NEW.is_financeiro := OLD.is_financeiro;
  END IF;

  IF NEW.display_name IS DISTINCT FROM OLD.display_name
     AND auth.uid() IS DISTINCT FROM OLD.user_id
     AND NOT public.is_profile_admin(auth.uid()) THEN
    NEW.display_name := OLD.display_name;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_financeiro_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_financeiro_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_financeiro_escalation();

-- 2) is_financeiro_user agora SEM fallback de display_name
CREATE OR REPLACE FUNCTION public.is_financeiro_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND is_active = true
      AND (role = 'admin' OR is_financeiro = true)
  );
$$;

-- 3) salaries: restringe SELECT a admins
DROP POLICY IF EXISTS "Authenticated can read salaries" ON public.salaries;
CREATE POLICY "Admins can read salaries"
  ON public.salaries FOR SELECT
  TO authenticated
  USING (public.is_profile_admin(auth.uid()));

-- 4) alert_recipients: restringe SELECT a admins
DROP POLICY IF EXISTS "Authenticated can read alert_recipients" ON public.alert_recipients;
CREATE POLICY "Admins can read alert_recipients"
  ON public.alert_recipients FOR SELECT
  TO authenticated
  USING (public.is_profile_admin(auth.uid()));
