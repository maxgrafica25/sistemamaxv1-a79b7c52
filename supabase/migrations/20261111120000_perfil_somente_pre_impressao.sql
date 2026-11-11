-- Perfil "Pré-impressão": usuário que só enxerga o módulo Pré-impressão.
-- Segue o mesmo modelo de is_financeiro: coluna booleana + gatilho que impede
-- a própria pessoa de tirar a restrição (só admin muda).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS somente_pre_impressao boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.prevent_somente_pre_impressao_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth.uid() nulo = SQL Editor / service role: deixa passar (mesmo comportamento dos outros gatilhos).
  IF NEW.somente_pre_impressao IS DISTINCT FROM OLD.somente_pre_impressao
     AND auth.uid() IS NOT NULL
     AND NOT public.is_profile_admin(auth.uid()) THEN
    NEW.somente_pre_impressao := OLD.somente_pre_impressao;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_somente_pre_impressao_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_somente_pre_impressao_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_somente_pre_impressao_escalation();
