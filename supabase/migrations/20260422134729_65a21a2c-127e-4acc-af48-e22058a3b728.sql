CREATE TABLE public.base_conhecimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  conteudo text NOT NULL,
  categoria text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.base_conhecimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read base_conhecimento" ON public.base_conhecimento
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin insert base_conhecimento" ON public.base_conhecimento
  FOR INSERT TO authenticated WITH CHECK (public.is_profile_admin(auth.uid()));

CREATE POLICY "admin update base_conhecimento" ON public.base_conhecimento
  FOR UPDATE TO authenticated USING (public.is_profile_admin(auth.uid()))
  WITH CHECK (public.is_profile_admin(auth.uid()));

CREATE POLICY "admin delete base_conhecimento" ON public.base_conhecimento
  FOR DELETE TO authenticated USING (public.is_profile_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_base_conhecimento_atualizado
  BEFORE UPDATE ON public.base_conhecimento
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();