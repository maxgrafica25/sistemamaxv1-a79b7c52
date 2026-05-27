
-- =====================================================================
-- MIGRATION 1 — Fundação multi-tenant
-- =====================================================================

-- 1) Tabela empresas
CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text UNIQUE,
  data_criacao timestamptz NOT NULL DEFAULT now(),
  status_assinatura text NOT NULL DEFAULT 'ativo'
    CHECK (status_assinatura IN ('ativo','teste','atrasado','cancelado')),
  plano text,
  gateway_customer_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Seed: Max Gráfica
INSERT INTO public.empresas (nome, status_assinatura, plano)
VALUES ('Max Gráfica', 'ativo', 'founding');

-- 3) profiles.empresa_id
ALTER TABLE public.profiles
  ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT;

UPDATE public.profiles
   SET empresa_id = (SELECT id FROM public.empresas WHERE nome = 'Max Gráfica' LIMIT 1)
 WHERE empresa_id IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN empresa_id SET NOT NULL;

CREATE INDEX idx_profiles_empresa_id ON public.profiles(empresa_id);

-- 4) Funções helper (SECURITY DEFINER — ponto único usado por todas RLS futuras)
CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.empresa_ativa(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresas
     WHERE id = _empresa_id
       AND status_assinatura IN ('ativo','teste')
  )
$$;

-- 5) RLS policies para empresas
-- SELECT: usuário vê apenas a própria empresa
CREATE POLICY "empresas_select_own" ON public.empresas
  FOR SELECT TO authenticated
  USING (id = public.current_empresa_id());

-- UPDATE: apenas admin da própria empresa
CREATE POLICY "empresas_update_own_admin" ON public.empresas
  FOR UPDATE TO authenticated
  USING (id = public.current_empresa_id() AND public.is_profile_admin(auth.uid()))
  WITH CHECK (id = public.current_empresa_id() AND public.is_profile_admin(auth.uid()));

-- INSERT/DELETE: somente via service_role (futuro fluxo de signup / superadmin)
-- (nenhuma policy = bloqueado para authenticated)

-- 6) Atualiza handle_new_user para aceitar empresa_id de raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  -- Tenta extrair empresa_id do metadata do convite
  v_empresa_id := NULLIF(NEW.raw_user_meta_data->>'empresa_id','')::uuid;

  -- Fallback temporário (Fase 1): se não veio no metadata, vincula à Max Gráfica.
  -- Em Fase 3 (signup multi-empresa) esse fallback é removido e ausência vira erro.
  IF v_empresa_id IS NULL THEN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE nome = 'Max Gráfica' LIMIT 1;
  END IF;

  INSERT INTO public.profiles (user_id, display_name, empresa_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    v_empresa_id
  );
  RETURN NEW;
END;
$$;
