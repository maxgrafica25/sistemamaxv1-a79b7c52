DO $$
DECLARE
  v_table text;
  v_tenant_tables text[] := ARRAY[
    'clients','client_recurring_products',
    'quotes','quote_materials','quote_third_party','quote_labor_steps',
    'quote_presets','quote_reminders','quote_approval_receipts',
    'quote_checklist_questions','quote_checklist_answers','quote_checklist_triggers',
    'quote_engagement_events','cv_quote_items',
    'sales_orders','sales_order_items','sales_order_status_history','sales_order_counters',
    'accounts_receivable','accounts_receivable_installments',
    'papers','supplies','suppliers','supply_purchase_history','supply_pricing_tiers',
    'paper_price_history','consumable_price_history',
    'material_groups','material_group_items',
    'equipments','equipment_consumables','equipment_depreciation','equipment_maintenances',
    'printer_readings','reading_alerts_sent','maintenance_requests',
    'production_losses','productive_capacity',
    'markup_groups','markup_tiers',
    'printing_price_items','finishings_price_items','finishing_price_tiers',
    'payment_method_fees','freight_types',
    'site_precos_tiers','historico_precos','historico_precos_tiers',
    'alertas_precos','sites_monitorados',
    'cv_calc_config','cv_calc_midias','cv_calc_impressoes','cv_calc_acabamentos',
    'cv_calc_acabamento_recipe_items','cv_calc_acabamento_labor_items',
    'cv_calc_acabamento_media_order',
    'production_steps','production_step_categories',
    'step_groups','step_group_items',
    'product_kits','product_kit_items','product_kit_item_variants','product_kit_presets',
    'recurring_print_history',
    'monthly_expenses','salaries',
    'channels','channel_members','messages','message_reactions','message_reads',
    'pinned_messages','notifications','reminders','alert_recipients',
    'assistente_mensagens','assistente_auditoria','base_conhecimento',
    'tabelas_importadas','produtos_catalogo',
    'company_settings'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tenant_tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id()',
      v_table
    );
  END LOOP;
END $$;