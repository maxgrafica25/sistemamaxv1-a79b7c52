-- 1) Add tipo_fonte and codigo_externo, make seletor_css nullable
ALTER TABLE public.sites_monitorados
  ADD COLUMN IF NOT EXISTS tipo_fonte text NOT NULL DEFAULT 'url_seletor',
  ADD COLUMN IF NOT EXISTS codigo_externo text;

ALTER TABLE public.sites_monitorados
  ALTER COLUMN seletor_css DROP NOT NULL;

ALTER TABLE public.sites_monitorados
  ALTER COLUMN url_completa DROP NOT NULL;

-- 2) Imported tables history
CREATE TABLE IF NOT EXISTS public.tabelas_importadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  fornecedor_nome text,
  file_name text NOT NULL,
  file_type text,
  total_linhas integer NOT NULL DEFAULT 0,
  itens_criados integer NOT NULL DEFAULT 0,
  itens_atualizados integer NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tabelas_importadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read tabelas_importadas"
  ON public.tabelas_importadas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth insert tabelas_importadas"
  ON public.tabelas_importadas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth delete tabelas_importadas"
  ON public.tabelas_importadas FOR DELETE TO authenticated USING (true);