-- =============================================================================
-- Fase 1 / Item 3 — Realtime de accounts_receivable (ALTA, CONDICIONAL)
-- =============================================================================
-- ⚠️  APLICAR APENAS SE O TESTE PRÁTICO DE LEAK CONFIRMAR O VAZAMENTO.
-- Ver docs/security-phase1/README.md → "Pré-validação obrigatória"
--
-- ⚠️  IMPACTO NO FRONTEND:
-- src/pages/ContasReceber.tsx subscreve postgres_changes nessas tabelas.
-- Após este DROP, o auto-refresh para de funcionar para o financeiro.
-- Antes de aplicar, ajustar a UI: ou trocar para polling (refetch a cada 30s),
-- ou usar broadcast channel autorizado via realtime.messages.
-- =============================================================================

BEGIN;

ALTER PUBLICATION supabase_realtime DROP TABLE public.accounts_receivable;
ALTER PUBLICATION supabase_realtime DROP TABLE public.accounts_receivable_installments;

COMMIT;
