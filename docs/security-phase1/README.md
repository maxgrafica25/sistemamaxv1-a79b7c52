# Fase 1 — Endurecimento de Segurança (Top 5)

> **Status:** drafts prontos. **NÃO aplicar em produção** sem antes:
> 1. Restaurar dump da prod em projeto Supabase de staging.
> 2. Rodar `bun run test:rls` (suite em `src/test/rls/`) e validar que passa **antes** das migrations.
> 3. Aplicar migrations 01→04 em ordem em staging.
> 4. Re-rodar `bun run test:rls` — todos os testes devem continuar passando, **mais** os testes de novos invariantes.
> 5. Smoke test manual: login admin/financeiro/colaborador, criar orçamento, gerar conta a receber, upload de anexo, reset de senha.
> 6. Observar logs por 24h em staging antes de promover para prod.
> 7. Em prod: snapshot manual no Cloud → aplicar → smoke test.

## Ordem de execução

| # | Migration | Pré-requisito de código | Risco | Reversível? |
|---|-----------|------------------------|-------|-------------|
| 01 | `01_is_financeiro_column.sql` | nenhum | baixo (aditivo + fallback) | sim (`01_*_rollback.sql`) |
| 02 | `02_audit_logs_lockdown.sql` | `src/lib/audit.ts` refatorado **antes** | médio (quebra logs se frontend não atualizado) | sim |
| 03 | `03_realtime_financeiro.sql` | confirmar leak prático **antes** | alto (quebra auto-refresh de `ContasReceber.tsx` se aplicado sem ajuste de UX) | sim |
| 04 | `04_storage_private.sql` | substituir `getPublicUrl` por `createSignedUrl` em **todos** os usos antes | alto (quebra anexos visualmente) | sim |

## Arquivos afetados no frontend (já mapeado)

- **audit.ts (item 02):** `src/lib/audit.ts` (refatorado neste PR para usar RPC `log_audit_event`)
- **storage (item 04, NÃO refatorado ainda):**
  - `src/components/chat/ChatInput.tsx`
  - `src/components/equipamentos/MaintenanceTab.tsx`
  - `src/components/equipamentos/MaintenanceRequestsTab.tsx`
- **realtime (item 03, NÃO refatorado ainda):**
  - `src/pages/ContasReceber.tsx` linhas 82-84 — usa subscription de `accounts_receivable` e `accounts_receivable_installments`. Se dropar da publication, financeiro perde auto-refresh. Alternativa: criar canal privado autorizado via `realtime.messages` policy (ver 03_realtime_financeiro.sql).

## Pré-validação obrigatória — teste de leak Realtime

Antes de aplicar `03_realtime_financeiro.sql`, executar em staging:

```ts
// como usuário COLABORADOR comum (não financeiro):
const ch = supabase.channel('leak_test')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts_receivable' },
      (p) => console.log('LEAK:', p))
  .subscribe();
// em outra sessão como FINANCEIRO, criar uma conta a receber.
// Se o console do colaborador imprimir "LEAK: …", há vazamento → aplicar 03.
// Se NÃO imprimir, o Realtime já filtra por RLS → 03 vira opcional/defensivo.
```

## Suíte de testes RLS

| Teste | Arquivo | Cobertura |
|-------|---------|-----------|
| 1 | `profiles_escalation.test.ts` | colab não promove a si; admin promove outros |
| 2 | `accounts_receivable.test.ts` | só financeiro lê/grava AR |
| 3 | `audit_logs.test.ts` | escrita só via RPC; leitura só admin |
| 4 | `storage_buckets.test.ts` | buckets privados; delete só do dono |
| 5 | `last_admin_lockout.test.ts` | trigger `prevent_last_admin_lockout`: bloqueia rebaixar/desativar o último admin ativo (cenários A/B com 1 admin, C com 2 admins, D RLS de colab) |

> **Pré-requisito staging para teste 5:** o usuário JWT `admin` deve ser o **único** admin ativo (cenários A/B só rodam nessa condição; senão são pulados com warning). O cenário C promove temporariamente o `colab` a admin e restaura no `finally`.

## Rollback

Cada migration tem um arquivo `_rollback.sql`. Aplicar na ordem inversa (04 → 03 → 02 → 01).
