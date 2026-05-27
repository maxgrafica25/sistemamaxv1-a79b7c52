
-- =========================================================
-- Migration 4: Hardening final multi-tenant
-- Event trigger para exigir empresa_id em novas tabelas public
-- =========================================================

-- 1) Whitelist de tabelas de sistema/global (sem empresa_id)
CREATE TABLE IF NOT EXISTS public.tenant_enforcement_whitelist (
  table_name text PRIMARY KEY,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tenant_enforcement_whitelist TO authenticated;
GRANT ALL ON public.tenant_enforcement_whitelist TO service_role;

ALTER TABLE public.tenant_enforcement_whitelist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whitelist_read_authenticated" ON public.tenant_enforcement_whitelist;
CREATE POLICY "whitelist_read_authenticated"
  ON public.tenant_enforcement_whitelist FOR SELECT TO authenticated USING (true);

-- Popula a whitelist com as 25 tabelas de sistema/global aprovadas
INSERT INTO public.tenant_enforcement_whitelist (table_name, reason) VALUES
  ('empresas', 'Tabela raiz do multi-tenant'),
  ('profiles', 'Perfil aponta para empresa_id, mas é a ponte usuário→empresa'),
  ('tenant_enforcement_whitelist', 'Configuração da própria trava'),
  ('printer_categories', 'Categorias universais de equipamento (global)'),
  ('legacy_cv_finishes', 'Tabela legada (depreciada)'),
  ('legacy_cv_materials', 'Tabela legada (depreciada)'),
  ('legacy_cv_printers', 'Tabela legada (depreciada)'),
  ('legacy_cv_calc_acabamento_labor_items', 'Tabela legada (depreciada)'),
  ('global_settings', 'Configuração global do sistema'),
  ('audit_logs', 'Auditoria cross-tenant (acesso restrito por role)'),
  ('sales_order_counters', 'Contador anual global de pedidos'),
  ('quote_counters', 'Contador anual global de orçamentos'),
  ('schema_migrations', 'Metadado de migrations'),
  ('gcal_sync_queue', 'Fila de sync global'),
  ('user_google_tokens', 'Tokens OAuth por usuário (não por empresa)'),
  ('pg_stat_statements', 'Extensão Postgres'),
  ('pg_stat_statements_info', 'Extensão Postgres')
ON CONFLICT (table_name) DO NOTHING;

-- 2) Função invocada pelo event trigger
CREATE OR REPLACE FUNCTION public.enforce_tenant_column()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  obj record;
  v_table_name text;
  v_has_empresa_id boolean;
  v_is_whitelisted boolean;
  v_fk_target text;
BEGIN
  FOR obj IN
    SELECT * FROM pg_event_trigger_ddl_commands()
     WHERE command_tag = 'CREATE TABLE'
       AND schema_name = 'public'
       AND object_type = 'table'
  LOOP
    v_table_name := split_part(obj.object_identity, '.', 2);
    -- Remove aspas se houver
    v_table_name := replace(v_table_name, '"', '');

    -- Skip whitelisted
    SELECT EXISTS (
      SELECT 1 FROM public.tenant_enforcement_whitelist
       WHERE table_name = v_table_name
    ) INTO v_is_whitelisted;

    IF v_is_whitelisted THEN
      CONTINUE;
    END IF;

    -- Skip tabelas que começam com underscore (temporárias/internas)
    IF v_table_name LIKE '\_%' ESCAPE '\' THEN
      CONTINUE;
    END IF;

    -- Verifica se tem empresa_id
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = v_table_name
         AND column_name = 'empresa_id'
    ) INTO v_has_empresa_id;

    IF NOT v_has_empresa_id THEN
      RAISE EXCEPTION
        'Tabela public.% precisa da coluna empresa_id (multi-tenant). Adicione "empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id)" ou inclua o nome em public.tenant_enforcement_whitelist se for global/sistema.',
        v_table_name;
    END IF;

    -- Verifica que empresa_id referencia empresas(id)
    SELECT ccu.table_name INTO v_fk_target
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = 'public'
       AND tc.table_name = v_table_name
       AND kcu.column_name = 'empresa_id'
     LIMIT 1;

    IF v_fk_target IS NULL THEN
      RAISE EXCEPTION
        'Tabela public.%.empresa_id deve ter FOREIGN KEY para public.empresas(id).',
        v_table_name;
    ELSIF v_fk_target <> 'empresas' THEN
      RAISE EXCEPTION
        'Tabela public.%.empresa_id aponta para "%", deveria apontar para public.empresas(id).',
        v_table_name, v_fk_target;
    END IF;
  END LOOP;
END;
$$;

-- 3) Cria o event trigger (recriando se já existir)
DROP EVENT TRIGGER IF EXISTS enforce_tenant_column_trg;
CREATE EVENT TRIGGER enforce_tenant_column_trg
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public.enforce_tenant_column();

-- 4) Comentário documental
COMMENT ON EVENT TRIGGER enforce_tenant_column_trg IS
  'Migration 4: Bloqueia CREATE TABLE em public sem coluna empresa_id (whitelist: public.tenant_enforcement_whitelist).';

COMMENT ON FUNCTION public.enforce_tenant_column() IS
  'Verifica que toda nova tabela em public possui empresa_id com FK para empresas(id), exceto tabelas listadas em tenant_enforcement_whitelist.';
