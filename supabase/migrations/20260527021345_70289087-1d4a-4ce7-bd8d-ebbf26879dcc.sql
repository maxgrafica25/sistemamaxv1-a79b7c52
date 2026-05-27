DO $$
DECLARE
  v_empresa uuid;
  v_table text;
  v_tenant_tables text[] := ARRAY[
    -- Clientes & Vendas
    'clients','client_recurring_products',
    'quotes','quote_materials','quote_third_party','quote_labor_steps',
    'quote_presets','quote_reminders','quote_approval_receipts',
    'quote_checklist_questions','quote_checklist_answers','quote_checklist_triggers',
    'quote_engagement_events','cv_quote_items',
    'sales_orders','sales_order_items','sales_order_status_history','sales_order_counters',
    'accounts_receivable','accounts_receivable_installments',
    -- Estoque & Compras
    'papers','supplies','suppliers','supply_purchase_history','supply_pricing_tiers',
    'paper_price_history','consumable_price_history',
    'material_groups','material_group_items',
    -- Equipamentos
    'equipments','equipment_consumables','equipment_depreciation','equipment_maintenances',
    'printer_readings','reading_alerts_sent','maintenance_requests',
    'production_losses','productive_capacity',
    -- Precificação
    'markup_groups','markup_tiers',
    'printing_price_items','finishings_price_items','finishing_price_tiers',
    'payment_method_fees','freight_types',
    'site_precos_tiers','historico_precos','historico_precos_tiers',
    'alertas_precos','sites_monitorados',
    -- CV
    'cv_calc_config','cv_calc_midias','cv_calc_impressoes','cv_calc_acabamentos',
    'cv_calc_acabamento_recipe_items','cv_calc_acabamento_labor_items',
    'cv_calc_acabamento_media_order',
    -- Produção
    'production_steps','production_step_categories',
    'step_groups','step_group_items',
    'product_kits','product_kit_items','product_kit_item_variants','product_kit_presets',
    'recurring_print_history',
    -- Financeiro/RH
    'monthly_expenses','salaries',
    -- Chat/Notificações
    'channels','channel_members','messages','message_reactions','message_reads',
    'pinned_messages','notifications','reminders','alert_recipients',
    -- Assistente/IA & catálogo por empresa
    'assistente_mensagens','assistente_auditoria','base_conhecimento',
    'tabelas_importadas','produtos_catalogo',
    -- Config por empresa
    'company_settings'
  ];
BEGIN
  SELECT id INTO v_empresa FROM public.empresas WHERE nome = 'Max Gráfica' LIMIT 1;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Empresa "Max Gráfica" não encontrada. Migration 1 precisa ter rodado.';
  END IF;

  FOREACH v_table IN ARRAY v_tenant_tables LOOP
    -- 1) adicionar coluna (idempotente)
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS empresa_id uuid',
      v_table
    );

    -- 2) backfill
    EXECUTE format(
      'UPDATE public.%I SET empresa_id = %L WHERE empresa_id IS NULL',
      v_table, v_empresa
    );

    -- 3) NOT NULL
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN empresa_id SET NOT NULL',
      v_table
    );

    -- 4) FK (drop + recreate para idempotência)
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      v_table, v_table || '_empresa_id_fkey'
    );
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD CONSTRAINT %I
         FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT',
      v_table, v_table || '_empresa_id_fkey'
    );

    -- 5) índice
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (empresa_id)',
      'idx_' || v_table || '_empresa_id', v_table
    );
  END LOOP;
END $$;