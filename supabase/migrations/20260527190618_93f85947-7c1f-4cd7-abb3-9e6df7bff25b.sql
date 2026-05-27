-- =============================================================================
-- Migration C (P0) — profiles tenant-safe + list_users_admin tenant-safe
-- =============================================================================

-- 1) Recriar policy de SELECT em profiles: só própria empresa (ou próprio perfil)
DROP POLICY IF EXISTS "Authenticated read profiles" ON public.profiles;
CREATE POLICY "Authenticated read profiles (same tenant)"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR empresa_id = public.current_empresa_id()
  );

-- 2) Recriar policy de UPDATE admin: apenas admins da MESMA empresa
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
CREATE POLICY "Tenant admins update profiles in own empresa"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    public.is_tenant_admin(empresa_id)
  )
  WITH CHECK (
    public.is_tenant_admin(empresa_id)
  );

-- 3) Trigger: impedir qualquer UPDATE que altere empresa_id em profiles
--    (só service_role pode mover usuário entre empresas — bypassa RLS/trigger? Não.
--     Triggers rodam para service_role também; então abrimos exceção por session_user)
CREATE OR REPLACE FUNCTION public.prevent_profile_empresa_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    -- Bloqueia para qualquer chamador via PostgREST (authenticated/anon).
    -- service_role conecta como 'service_role'/'postgres' — esses passam.
    IF current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION 'Mudar empresa_id de um perfil não é permitido.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_empresa_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_empresa_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_empresa_change();

-- 4) list_users_admin → filtrar por empresa do chamador
CREATE OR REPLACE FUNCTION public.list_users_admin()
RETURNS TABLE(
  user_id uuid, display_name text, avatar_url text, role text,
  is_active boolean, email text, last_sign_in_at timestamp with time zone,
  email_confirmed_at timestamp with time zone, created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.current_empresa_id();
BEGIN
  IF NOT public.is_profile_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem listar usuários.';
  END IF;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Empresa do administrador não pôde ser determinada.';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id, p.display_name, p.avatar_url, p.role, p.is_active,
    u.email::text, u.last_sign_in_at, u.email_confirmed_at, p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE p.empresa_id = v_empresa
  ORDER BY p.is_active DESC, lower(p.display_name) ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_users_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prevent_profile_empresa_change() TO authenticated, service_role;