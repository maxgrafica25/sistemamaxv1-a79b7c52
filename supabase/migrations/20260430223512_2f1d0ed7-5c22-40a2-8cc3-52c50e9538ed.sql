-- 1) Restaurar admins (Juliano e Marcelle)
UPDATE public.profiles
SET role = 'admin'
WHERE user_id = '056da65d-8552-4163-ae37-11d14d152805'
   OR display_name ILIKE 'Marcelle';

INSERT INTO public.audit_logs (action, entity_type, entity_id, entity_name, details)
VALUES (
  'restore_admin_role',
  'profile',
  '056da65d-8552-4163-ae37-11d14d152805',
  'Juliano + Marcelle',
  'Roles de admin restaurados via migração do painel de usuários'
);

-- 2) Adicionar coluna is_active
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 3) Trigger que impede ficar sem nenhum admin ativo
CREATE OR REPLACE FUNCTION public.prevent_last_admin_lockout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_admin_count int;
BEGIN
  -- Só checa se a operação está rebaixando admin OU desativando admin
  IF (OLD.role = 'admin' AND NEW.role <> 'admin')
     OR (OLD.role = 'admin' AND OLD.is_active = true AND NEW.is_active = false) THEN

    SELECT COUNT(*) INTO v_active_admin_count
      FROM public.profiles
     WHERE role = 'admin'
       AND is_active = true
       AND user_id <> OLD.user_id;

    IF v_active_admin_count = 0 THEN
      RAISE EXCEPTION 'Operação bloqueada: o sistema precisa ter pelo menos um administrador ativo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_admin_lockout_trigger ON public.profiles;
CREATE TRIGGER prevent_last_admin_lockout_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_admin_lockout();

-- 4) RPC para o painel listar usuários (só admins)
CREATE OR REPLACE FUNCTION public.list_users_admin()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text,
  role text,
  is_active boolean,
  email text,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_profile_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem listar usuários.';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.display_name,
    p.avatar_url,
    p.role,
    p.is_active,
    u.email::text,
    u.last_sign_in_at,
    u.email_confirmed_at,
    p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  ORDER BY p.is_active DESC, lower(p.display_name) ASC;
END;
$$;

-- Garantir execução só para authenticated (RLS é via check interno)
REVOKE ALL ON FUNCTION public.list_users_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_users_admin() TO authenticated;