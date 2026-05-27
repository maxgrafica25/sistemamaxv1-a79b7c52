
-- ============================================================================
-- Migration 5 — Cleanup de RLS legacy
-- ============================================================================
-- Foco: remover WITH CHECK (true) / USING (true) onde o multi-tenant ou
-- as regras de papel deveriam restringir. Mantém intencionalmente:
--   * get_public_quote / register_quote_event (SECURITY DEFINER expostos a anon)
--   * Buckets de storage públicos (logos, imagens, arquivos compartilhados)
--   * Tabelas system/global whitelisted (legacy_cv_*, printer_categories,
--     global_settings) — leitura aberta a authenticated é intencional.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) audit_logs — SELECT só admin; INSERT apenas via RPC (log_audit_event /
--    log_auth_event SECURITY DEFINER). Mantém INSERT para anon limitado a
--    password_reset_% (fluxo de recuperação de senha sem sessão).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can read audit_logs"   ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated can insert audit_logs" ON public.audit_logs;

CREATE POLICY "Admins read audit_logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_profile_admin(auth.uid()));

-- Sem policy de INSERT para authenticated: writes só via SECURITY DEFINER RPC.
-- (A policy "Anon can insert password reset audit" permanece intacta.)

-- ----------------------------------------------------------------------------
-- 2) profiles — restringir SELECT a authenticated e impedir auto-escalação
--    de role / is_financeiro via policy (defesa em profundidade junto ao
--    trigger prevent_role_escalation / prevent_financeiro_escalation).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view profiles"     ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Authenticated read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Usuário comum: pode atualizar o próprio perfil, mas não pode mexer em
-- role nem is_financeiro (esses campos só admin via policy abaixo).
CREATE POLICY "Users update own profile (no privilege fields)"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid())
    AND is_financeiro IS NOT DISTINCT FROM
        (SELECT is_financeiro FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_profile_admin(auth.uid()))
  WITH CHECK (public.is_profile_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- 3) user_google_tokens — adicionar INSERT/UPDATE explícitos escopados a
--    user_id = auth.uid() (antes ausentes; tokens só passavam por service role).
-- ----------------------------------------------------------------------------
CREATE POLICY "Users insert own google tokens"
  ON public.user_google_tokens FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own google tokens"
  ON public.user_google_tokens FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
