-- =============================================================================
-- Fase 1 / Item 1 — Privilege escalation via display_name (CRÍTICA)
-- =============================================================================
-- Adiciona coluna explícita `is_financeiro` em profiles, protegida por trigger,
-- e mantém o gate antigo (display_name) como fallback durante 1 release.
-- Após estabilizar, aplicar 01_remove_display_name_fallback.sql (não incluso aqui).
-- =============================================================================

BEGIN;

-- 1. Coluna explícita
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_financeiro boolean NOT NULL DEFAULT false;

-- 2. Backfill dos atuais usuários financeiros
UPDATE public.profiles
   SET is_financeiro = true
 WHERE display_name IN ('Juliano', 'Marcelle')
   AND is_active = true;

-- 3. Trigger anti-escalation
--    - is_financeiro só pode ser alterado por admin
--    - display_name de OUTRO usuário só pode ser alterado por admin
--      (auto-edição do próprio nome continua livre)
CREATE OR REPLACE FUNCTION public.prevent_financeiro_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bloqueia toggle de is_financeiro por não-admin
  IF NEW.is_financeiro IS DISTINCT FROM OLD.is_financeiro
     AND NOT public.is_profile_admin(auth.uid()) THEN
    NEW.is_financeiro := OLD.is_financeiro;
  END IF;

  -- Bloqueia mudança de display_name de OUTRO usuário por não-admin
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

-- 4. Reescrever is_financeiro_user com fallback temporário
--    Após confirmar estabilidade (1 release), remover a parte do display_name.
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
        OR is_financeiro = true
        -- FALLBACK TEMPORÁRIO — remover em 01_remove_display_name_fallback.sql
        OR display_name IN ('Juliano', 'Marcelle')
      )
  );
$$;

COMMIT;
