-- ================================================================
-- MIGRATION 3: RLS multi-tenant + bloqueio por inadimplência
-- ================================================================

-- ----------------------------------------------------------------
-- PASSO 1 — Drop de todas as policies antigas das 70 tabelas tenant
-- ----------------------------------------------------------------
DO $$
DECLARE
  v_table text;
  v_pol record;
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
    FOR v_pol IN
      SELECT policyname FROM pg_policies
       WHERE schemaname='public' AND tablename=v_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol.policyname, v_table);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
  END LOOP;
END $$;

-- ----------------------------------------------------------------
-- PASSO 2 — Policy genérica de isolamento multi-tenant em TODAS as
-- tabelas tenant (será sobrescrita logo abaixo para os casos especiais).
-- ----------------------------------------------------------------
DO $$
DECLARE
  v_table text;
  v_tenant_tables text[] := ARRAY[
    'clients','client_recurring_products',
    'quotes','quote_materials','quote_third_party','quote_labor_steps',
    'quote_presets','quote_reminders','quote_approval_receipts',
    'quote_checklist_questions','quote_checklist_answers','quote_checklist_triggers',
    'cv_quote_items',
    'sales_orders','sales_order_items','sales_order_status_history','sales_order_counters',
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
    'alert_recipients',
    'tabelas_importadas','produtos_catalogo',
    'company_settings','quote_engagement_events'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tenant_tables LOOP
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON public.%I
        FOR ALL TO authenticated
        USING      (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id))
        WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id))
    $f$, v_table);
  END LOOP;
END $$;

-- ----------------------------------------------------------------
-- PASSO 3 — Casos especiais (sobrescrevem a policy genérica)
-- ----------------------------------------------------------------

-- ===== FINANCEIRO-ONLY =====
-- accounts_receivable: somente financeiro da empresa
CREATE POLICY tenant_financeiro_ar ON public.accounts_receivable
  FOR ALL TO authenticated
  USING      (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_financeiro_user(auth.uid()))
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_financeiro_user(auth.uid()));

CREATE POLICY tenant_financeiro_ar_inst ON public.accounts_receivable_installments
  FOR ALL TO authenticated
  USING      (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_financeiro_user(auth.uid()))
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_financeiro_user(auth.uid()));

-- salaries: leitura para qualquer autenticado da empresa? Não — somente admin (folha é sensível)
CREATE POLICY tenant_admin_salaries ON public.salaries
  FOR ALL TO authenticated
  USING      (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_profile_admin(auth.uid()))
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_profile_admin(auth.uid()));

-- monthly_expenses: leitura para todos da empresa, escrita só admin
CREATE POLICY monthly_expenses_read ON public.monthly_expenses
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id));

CREATE POLICY monthly_expenses_write ON public.monthly_expenses
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_profile_admin(auth.uid()));

CREATE POLICY monthly_expenses_update ON public.monthly_expenses
  FOR UPDATE TO authenticated
  USING      (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_profile_admin(auth.uid()))
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_profile_admin(auth.uid()));

CREATE POLICY monthly_expenses_delete ON public.monthly_expenses
  FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_profile_admin(auth.uid()));

-- ===== BASE DE CONHECIMENTO: leitura empresa toda, escrita só admin =====
CREATE POLICY base_conhecimento_read ON public.base_conhecimento
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id));

CREATE POLICY base_conhecimento_write ON public.base_conhecimento
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_profile_admin(auth.uid()));

CREATE POLICY base_conhecimento_update ON public.base_conhecimento
  FOR UPDATE TO authenticated
  USING      (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_profile_admin(auth.uid()))
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_profile_admin(auth.uid()));

CREATE POLICY base_conhecimento_delete ON public.base_conhecimento
  FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_profile_admin(auth.uid()));

-- ===== PER-USUÁRIO (notifications/reminders/assistente) =====
CREATE POLICY tenant_user_notifications ON public.notifications
  FOR ALL TO authenticated
  USING      (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND user_id = auth.uid())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND user_id = auth.uid());

CREATE POLICY tenant_user_reminders ON public.reminders
  FOR ALL TO authenticated
  USING      (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND user_id = auth.uid())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND user_id = auth.uid());

CREATE POLICY tenant_user_assistente_msgs ON public.assistente_mensagens
  FOR ALL TO authenticated
  USING      (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND user_id = auth.uid())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND user_id = auth.uid());

-- assistente_auditoria: leitura só admin da empresa; insert via SECURITY DEFINER
CREATE POLICY tenant_admin_assistente_audit ON public.assistente_auditoria
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND public.is_profile_admin(auth.uid()));

CREATE POLICY tenant_assistente_audit_insert ON public.assistente_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id));

-- ===== CHAT — isolamento de membros =====

-- channels: ver canais públicos da empresa OU canais privados/diretos onde sou membro
CREATE POLICY channels_select ON public.channels
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.empresa_ativa(empresa_id)
    AND (
      type = 'public'
      OR id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY channels_insert ON public.channels
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND created_by = auth.uid());

CREATE POLICY channels_update ON public.channels
  FOR UPDATE TO authenticated
  USING      (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND created_by = auth.uid())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND created_by = auth.uid());

CREATE POLICY channels_delete ON public.channels
  FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND created_by = auth.uid());

-- channel_members: ver membros de canais da minha empresa
CREATE POLICY channel_members_select ON public.channel_members
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id));

CREATE POLICY channel_members_insert ON public.channel_members
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND public.empresa_ativa(empresa_id)
    AND (public.is_profile_admin(auth.uid()) OR public.is_channel_creator(auth.uid(), channel_id))
  );

CREATE POLICY channel_members_delete ON public.channel_members
  FOR DELETE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.empresa_ativa(empresa_id)
    AND (user_id = auth.uid() OR public.is_profile_admin(auth.uid()) OR public.is_channel_creator(auth.uid(), channel_id))
  );

-- messages: só membros do canal podem ver/enviar
CREATE POLICY messages_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.empresa_ativa(empresa_id)
    AND channel_id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid())
  );

CREATE POLICY messages_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND public.empresa_ativa(empresa_id)
    AND user_id = auth.uid()
    AND channel_id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid())
  );

CREATE POLICY messages_update ON public.messages
  FOR UPDATE TO authenticated
  USING      (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND user_id = auth.uid())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND user_id = auth.uid());

CREATE POLICY messages_delete ON public.messages
  FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND user_id = auth.uid());

-- message_reactions / message_reads: per-user dentro da empresa
CREATE POLICY message_reactions_select ON public.message_reactions
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id));

CREATE POLICY message_reactions_insert ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND user_id = auth.uid());

CREATE POLICY message_reactions_delete ON public.message_reactions
  FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND user_id = auth.uid());

CREATE POLICY message_reads_select ON public.message_reads
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND user_id = auth.uid());

CREATE POLICY message_reads_write ON public.message_reads
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND user_id = auth.uid());

CREATE POLICY message_reads_update ON public.message_reads
  FOR UPDATE TO authenticated
  USING      (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND user_id = auth.uid())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.empresa_ativa(empresa_id) AND user_id = auth.uid());

-- pinned_messages: ver/escrever para membros do canal da empresa
CREATE POLICY pinned_messages_select ON public.pinned_messages
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.empresa_ativa(empresa_id)
    AND channel_id IN (SELECT channel_id FROM public.channel_members WHERE user_id = auth.uid())
  );

CREATE POLICY pinned_messages_write ON public.pinned_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND public.empresa_ativa(empresa_id)
    AND (public.is_profile_admin(auth.uid()) OR public.is_channel_creator(auth.uid(), channel_id))
  );

CREATE POLICY pinned_messages_delete ON public.pinned_messages
  FOR DELETE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.empresa_ativa(empresa_id)
    AND (public.is_profile_admin(auth.uid()) OR public.is_channel_creator(auth.uid(), channel_id))
  );