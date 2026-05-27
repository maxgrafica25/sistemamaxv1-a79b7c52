-- =============================================================================
-- Migration A (P0) — Hardening dos helpers de role
-- =============================================================================
-- Contexto: a auditoria Red Team identificou que vários pontos do sistema usam
-- is_profile_admin(_user_id) / is_financeiro_user(_user_id) como base para
-- decisões de autorização. Esta migration:
--   1) Garante que perfis INATIVOS nunca passem como admin/financeiro.
--   2) Cria helpers explicitamente "tenant-scoped" — is_tenant_admin(empresa)
--      e is_tenant_financeiro(empresa) — que combinam role + isolamento por
--      empresa, sem depender de current_empresa_id() (evita acoplamento).
--   3) Mantém a assinatura antiga (is_profile_admin / is_financeiro_user)
--      intacta para não quebrar policies em produção; as Migrations C/D vão
--      migrar policy a policy para o novo helper.
-- Idempotente: usa CREATE OR REPLACE.
-- =============================================================================

-- 1) Reforço: is_active obrigatório
CREATE OR REPLACE FUNCTION public.is_profile_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND role = 'admin'
      AND is_active = true
  )
$$;

-- is_financeiro_user já exigia is_active — mantemos só por idempotência/clareza
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
  )
$$;

-- 2) Novos helpers tenant-aware (a serem consumidos nas Migrations B/C/D)
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND empresa_id = _empresa_id
      AND role = 'admin'
      AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_financeiro(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND empresa_id = _empresa_id
      AND is_active = true
      AND (role = 'admin' OR is_financeiro = true)
  )
$$;

-- 3) Grants — helpers chamados pelo PostgREST/policies precisam de EXECUTE
GRANT EXECUTE ON FUNCTION public.is_profile_admin(uuid)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_financeiro_user(uuid)      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_financeiro(uuid)    TO authenticated, service_role;

-- Documentação inline para futuros mantenedores
COMMENT ON FUNCTION public.is_profile_admin(uuid)     IS 'Retorna true se o user_id é admin ATIVO. Não amarra empresa — combine com table.empresa_id = current_empresa_id() em policies tenant-scoped.';
COMMENT ON FUNCTION public.is_financeiro_user(uuid)   IS 'Retorna true se o user_id é admin OU financeiro ATIVO. Combinar com filtro de empresa em policies.';
COMMENT ON FUNCTION public.is_tenant_admin(uuid)      IS 'Retorna true se auth.uid() é admin ATIVO da empresa passada. Use em RPCs SECURITY DEFINER que recebem UUID de tabela externa.';
COMMENT ON FUNCTION public.is_tenant_financeiro(uuid) IS 'Retorna true se auth.uid() é admin/financeiro ATIVO da empresa passada. Use em RPCs SECURITY DEFINER que tocam financeiro.';