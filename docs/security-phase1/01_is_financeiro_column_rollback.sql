-- Rollback do item 1
BEGIN;

DROP TRIGGER IF EXISTS trg_prevent_financeiro_escalation ON public.profiles;
DROP FUNCTION IF EXISTS public.prevent_financeiro_escalation();

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
      AND (
        role = 'admin'
        OR display_name IN ('Juliano', 'Marcelle')
      )
  );
$$;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_financeiro;

COMMIT;
