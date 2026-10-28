-- Tabela de Preços (substitui a planilha "Formação de Preço de Venda Impressões").
-- Cada item tem suas faixas de quantidade com o preço de tabela (o mesmo do Tiny) e o SKU do Tiny.
-- O custo é calculado na tela: impressão = papel + máquina (consumíveis de Equipamentos);
-- manual = material + minutos × valor do minuto. Categorias guardam padrões para itens novos.

CREATE TABLE public.price_table_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE RESTRICT,
  group_name text NOT NULL DEFAULT 'Outros',
  name text NOT NULL,
  calc_type text NOT NULL DEFAULT 'manual' CHECK (calc_type IN ('impressao', 'manual')),
  equipment_id uuid REFERENCES public.equipments(id) ON DELETE SET NULL,
  color_mode text CHECK (color_mode IN ('color', 'pb')),
  default_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.price_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE RESTRICT,
  category_id uuid NOT NULL REFERENCES public.price_table_categories(id) ON DELETE RESTRICT,
  name text NOT NULL,
  calc_type text NOT NULL DEFAULT 'manual' CHECK (calc_type IN ('impressao', 'manual')),
  equipment_id uuid REFERENCES public.equipments(id) ON DELETE SET NULL,
  color_mode text CHECK (color_mode IN ('color', 'pb')),
  sheet_size text NOT NULL DEFAULT 'A4' CHECK (sheet_size IN ('A4', 'A3')),
  sides int NOT NULL DEFAULT 1 CHECK (sides IN (1, 2)),
  paper_id uuid REFERENCES public.papers(id) ON DELETE SET NULL,
  material_cost numeric NOT NULL DEFAULT 0,    -- papel (se não houver papel vinculado) ou material por unidade
  extra_cost numeric NOT NULL DEFAULT 0,       -- acabamento/insumo extra por unidade (ex.: recorte)
  minutes_per_unit numeric NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.price_table_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE RESTRICT,
  price_table_id uuid NOT NULL REFERENCES public.price_tables(id) ON DELETE CASCADE,
  min_qty int NOT NULL DEFAULT 1 CHECK (min_qty >= 1),
  max_qty int CHECK (max_qty IS NULL OR max_qty >= min_qty),
  price numeric NOT NULL DEFAULT 0,
  tiny_sku text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_table_categories_empresa_id ON public.price_table_categories (empresa_id);
CREATE INDEX idx_price_tables_empresa_id ON public.price_tables (empresa_id);
CREATE INDEX idx_price_tables_category_id ON public.price_tables (category_id);
CREATE INDEX idx_price_table_tiers_empresa_id ON public.price_table_tiers (empresa_id);
CREATE INDEX idx_price_table_tiers_price_table_id ON public.price_table_tiers (price_table_id);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['price_table_categories', 'price_tables', 'price_table_tiers'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- Todos da empresa leem (a Júlia e os orçamentos vão consultar); só admin altera.
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
        USING (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id))
    $f$, t || '_select', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR ALL TO authenticated
        USING (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_profile_admin(auth.uid()))
        WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_profile_admin(auth.uid()))
    $f$, t || '_admin_write', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      'update_' || t || '_updated_at', t);
  END LOOP;
END $$;
