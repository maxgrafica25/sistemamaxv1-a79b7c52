
-- =========================================================================
-- MODELO A: Apenas admins escrevem em tabelas de configuração.
-- SELECT continua aberto a authenticated em todas (leitura compartilhada).
-- INSERT/UPDATE/DELETE restrito a is_profile_admin(auth.uid()).
-- =========================================================================

-- Helper: aplica o padrão "admin write, all read" via DO block para cada tabela
DO $$
DECLARE
  t text;
  config_tables text[] := ARRAY[
    'papers',
    'equipments',
    'equipment_consumables',
    'equipment_depreciation',
    'printer_categories',
    'printing_price_items',
    'markup_tiers',
    'markup_groups',
    'monthly_expenses',
    'productive_capacity',
    'suppliers',
    'supplies',
    'production_steps',
    'step_groups',
    'step_group_items',
    'global_settings',
    'produtos_catalogo',
    'sites_monitorados',
    'tabelas_importadas',
    'site_precos_tiers',
    'salaries'
  ];
BEGIN
  FOREACH t IN ARRAY config_tables LOOP
    -- Drop policies permissivas existentes (best-effort, ignora se não existir)
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated can insert %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated can update %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated can delete %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Auth all %I" ON public.%I', t, t);

    -- Cria políticas restritas a admin para escrita
    EXECUTE format($p$
      CREATE POLICY "Admins can insert %I"
      ON public.%I FOR INSERT TO authenticated
      WITH CHECK (public.is_profile_admin(auth.uid()))
    $p$, t, t);

    EXECUTE format($p$
      CREATE POLICY "Admins can update %I"
      ON public.%I FOR UPDATE TO authenticated
      USING (public.is_profile_admin(auth.uid()))
      WITH CHECK (public.is_profile_admin(auth.uid()))
    $p$, t, t);

    EXECUTE format($p$
      CREATE POLICY "Admins can delete %I"
      ON public.%I FOR DELETE TO authenticated
      USING (public.is_profile_admin(auth.uid()))
    $p$, t, t);

    -- Garante que SELECT permanece aberto (recria caso tenha sido removida pelo "Auth all")
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated can read %I" ON public.%I', t, t);
    EXECUTE format($p$
      CREATE POLICY "Authenticated can read %I"
      ON public.%I FOR SELECT TO authenticated
      USING (true)
    $p$, t, t);
  END LOOP;
END $$;

-- =========================================================================
-- Casos especiais
-- =========================================================================

-- global_settings: sem DELETE (já era assim) — política de delete acima é inofensiva
-- pois a tabela não tinha policy de DELETE; agora terá uma restrita a admin (ok).

-- produtos_catalogo / sites_monitorados / site_precos_tiers / historico_precos:
-- estas usavam policy "Auth all" (FOR ALL). O loop acima já dropou para config_tables.
-- historico_precos e historico_precos_tiers continuam abertas (operacionais — alimentadas por triggers).

-- Reforça que profiles.role só pode mudar via admin (trigger já existe: prevent_role_escalation)
-- Verificar que o trigger está ativo:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'prevent_role_escalation_trigger'
      AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER prevent_role_escalation_trigger
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_role_escalation();
  END IF;
END $$;
