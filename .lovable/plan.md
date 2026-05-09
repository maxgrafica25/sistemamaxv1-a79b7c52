
# Plano de Endurecimento de Segurança — Faseado

Adoto integralmente as ressalvas levantadas. Nada vai para produção sem staging, rollback e teste de RLS. As fases são independentes e aprováveis separadamente.

---

## Pré-requisitos (antes de qualquer migration)

1. **Branch/projeto staging do Supabase** espelhando produção (ou um segundo projeto Cloud com seed dos dados sensíveis anonimizados).
2. **Suite de testes de RLS** (vitest + cliente Supabase com 3 JWTs: admin, financeiro, colaborador). Cobre: leitura/escrita em `accounts_receivable`, `quote_materials`, `audit_logs`, `channel_members`, `profiles`, storage objects.
3. **Migration reversa pronta** para cada migration aplicada (arquivo `*_rollback.sql` versionado junto).
4. **Snapshot do banco** antes de rodar em prod (Cloud → Backups manual).
5. **Confirmar versão do Realtime** via `select extversion from pg_extension where extname='supabase_realtime'` e teste prático de leak (subscribe como colaborador comum, observar se chegam eventos de `accounts_receivable` após INSERT pelo financeiro).

---

## FASE 1 — Top 5 Críticos/Altos (aprovação inicial)

Aplicação: staging → testes → prod com janela curta. Migration única, mas **escopo mínimo**.

### 1.1 Privilege escalation `display_name` → `is_financeiro` (CRÍTICA)
- Adicionar coluna `profiles.is_financeiro boolean NOT NULL DEFAULT false`.
- Backfill: `UPDATE profiles SET is_financeiro=true WHERE display_name IN ('Juliano','Marcelle')`.
- Trigger `prevent_financeiro_escalation`: bloqueia mudança de `is_financeiro` por não-admin **e** bloqueia mudança de `display_name` de outro usuário por não-admin (mantém self-update).
- Reescrever `is_financeiro_user`: `role='admin' OR is_financeiro=true`.
- Manter o gate antigo por 1 release (OR display_name IN(...)) como fallback, depois remover. Evita quebra se algum trigger/edge function já populou.
- Frontend: `useIsFinanceiro` continua igual (consome a função, não a coluna).

**Rollback:** drop coluna + trigger, restaurar função antiga (script pronto).

### 1.2 `audit_logs` — restringir SELECT/INSERT (ALTA)
- INSERT: revogar policy `Authenticated can insert audit_logs`. Manter apenas a policy `anon password_reset_*` já existente.
- Migrar todas as chamadas client-side de `logAudit()` para edge function `log-audit` (com `verify_jwt`) **ou** para funções `SECURITY DEFINER` parametrizadas (`log_audit_event(action, entity_type, ...)`).
- SELECT: restringir a `is_profile_admin(auth.uid())`.
- **Pré-requisito de migração**: refatorar `src/lib/audit.ts` ANTES de revogar a policy, senão quebra logging silenciosamente.

**Rollback:** restaurar policies originais.

### 1.3 `accounts_receivable` Realtime (ALTA — com cautela)
- **Antes** de remover do publication: rodar **teste prático** em staging confirmando o vazamento (subscribe como colaborador → INSERT como financeiro → verificar se evento chega).
- Se confirmado: `ALTER PUBLICATION supabase_realtime DROP TABLE accounts_receivable, accounts_receivable_installments`.
- Se NÃO confirmado (Realtime já filtra por RLS na versão atual): manter publication, apenas documentar e adicionar policy `realtime.messages` defensiva.
- Auditar uso no frontend (`rg "accounts_receivable" src` filtrando por `.channel(`/`postgres_changes`) — se houver subscription legítima do financeiro, ela continua funcionando porque RLS permite.

**Rollback:** `ALTER PUBLICATION ... ADD TABLE`.

### 1.4 Storage — buckets privados + ownership (ALTA)
- **Reconhecimento**: nomes atuais usam UUID v4 (verificar `storage.objects.name` em prod). Se sim, downgrade do risco "brute force" para "vazamento por compartilhamento de link". Mesmo assim, privatizar é correto.
- Mudanças:
  - `UPDATE storage.buckets SET public=false, file_size_limit=20971520, allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','application/pdf'] WHERE id IN ('chat-attachments','maintenance-attachments')`.
  - DELETE policy de `maintenance-attachments`: exigir `owner = auth.uid() OR is_profile_admin(auth.uid())`. Hoje o Supabase grava `owner` automaticamente no INSERT.
  - Adicionar DELETE policy para `chat-attachments` (owner ou admin).
- Frontend: substituir `getPublicUrl()` por `createSignedUrl(path, 3600)` em todos os componentes que renderizam anexos. **Identificar todos os usos antes de virar a chave.**

**Rollback:** voltar `public=true`, restaurar policies originais.

### 1.5 Reset de senha (MÉDIA-ALTA)
- Trocar `signInWithOtp` por `resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` })` em `Auth.tsx`.
- Em `/reset-password` (já existe): validar `type=recovery` no hash, exigir `updateUser({ password })` antes de qualquer navegação.
- Atualizar copy ("link de recuperação" em vez de "link de acesso").
- **Não tem migration** — só código frontend. Pode ir junto com Fase 1 ou separado.

**Critério de aprovação Fase 1:** todos os testes de RLS passando em staging + smoke test manual (login/reset/financeiro/upload).

---

## FASE 2 — Endurecimento médio (aprovação separada)

### 2.1 `company_settings` restringir a `authenticated`
- Identificar se há tela pública usando esses dados antes (provavelmente não há).

### 2.2 `channel_members` — SELECT só para membros + admin
- Verificar UI de listagem de canais e popovers de membros — `ChannelDetailsPanel.tsx`, `AddMemberDialog.tsx`.

### 2.3 `backup_get_*` — REVOGAR EXECUTE de authenticated
- **Revisão manual obrigatória primeiro**: rodar `rg "backup_get_" src supabase` para confirmar que só edge functions (com SERVICE_ROLE) chamam.
- Adicionar guard `IF NOT is_profile_admin(...) RAISE` como defesa em profundidade, mantendo executável por service_role.

### 2.4 HIBP no Auth
- `configure_auth password_hibp_enabled=true`. Não quebra signups existentes; só novas senhas/trocas.

### 2.5 `alertas_precos` — restringir UPDATE/DELETE a admin

### 2.6 Edge functions — endurecer
- `sync-prices-webhook`: secret dedicado `WEBHOOK_SHARED_SECRET` + comparação timing-safe.
- `backup-database`, `backup-storage`, `monitor-admin-usage`, `gcal-sync-worker`: header `X-Cron-Secret` validado contra secret dedicado, mesmo sendo chamadas só pelo cron.
- Auditar `invite-user` e `google-disconnect` (revisão de código + adicionar checagem explícita de role/owner).

---

## FASE 3 — Melhorias arquiteturais (médio prazo)

### 3.1 CSP explícita
- Adicionar `<meta http-equiv="Content-Security-Policy">` no `index.html` ou via header do hosting.
- Política mínima: `default-src 'self'; connect-src 'self' https://*.supabase.co https://*.lovable.app; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'`.
- Validar em staging — Vite/HMR e algumas libs (recharts, framer-motion) podem precisar de ajustes.

### 3.2 Rate limiting
- Limitação atual da plataforma: backend não tem primitivos prontos. Opções:
  - Cloudflare/edge gateway na frente do domínio publicado (recomendado).
  - Rate limit aplicativo via tabela `rate_limit_buckets` + função `check_rate_limit()` chamada no início de edge functions sensíveis (`invite-user`, `assistente-virtual`, reset de senha).

### 3.3 Monitoramento de auth abuse
- Edge function `monitor-auth-abuse` (cron 5min) consulta `auth_logs` via `analytics_query`, detecta bursts de falhas por IP/email, grava em `security_alerts` e dispara notificação para admins via tabela `notifications`.

### 3.4 Rotação de secrets
- Calendário trimestral: `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_STATE_SECRET`, `BROWSERLESS_API_KEY`, novo `WEBHOOK_SHARED_SECRET`, `LOVABLE_API_KEY` (via tool dedicada).
- Documentar em `docs/security-incident.md` (já existe) procedimento de rotação.

### 3.5 Retenção de signed URLs
- Padronizar TTL: 1h para visualização inline, 5min para download direto.
- Função utilitária `getAttachmentUrl(path, mode)` centralizando.
- Não armazenar signed URLs em DB/cache cliente.

---

## Detalhes técnicos

### Estrutura das migrations

```text
supabase/migrations/
  20260509_phase1_security/
    01_is_financeiro_column.sql
    01_is_financeiro_column_rollback.sql
    02_audit_logs_lockdown.sql        ← depois de refatorar audit.ts
    02_audit_logs_lockdown_rollback.sql
    03_realtime_financeiro.sql        ← condicional ao teste de leak
    03_realtime_financeiro_rollback.sql
    04_storage_private.sql
    04_storage_private_rollback.sql
```

### Testes de RLS (esboço)

```text
src/test/rls/
  setup.ts                ← cria 3 clientes com tokens distintos
  accounts_receivable.test.ts
  audit_logs.test.ts
  storage_buckets.test.ts
  profiles_escalation.test.ts
  channel_members.test.ts
```

Cada teste afirma: (a) acesso permitido para a role correta; (b) bloqueio explícito para roles erradas; (c) impossibilidade de escalar via UPDATE.

### Critérios de "pronto para prod" por fase

- 100% dos testes RLS verdes em staging.
- Smoke test manual: login admin/financeiro/colaborador, criar orçamento, gerar conta a receber, upload de anexo, reset de senha.
- Edge function logs sem erro 500 nas últimas 24h pós-deploy em staging.
- Rollback testado em staging (rodar reverse migration, confirmar volta ao estado original).

---

## O que vai a aprovação agora

**Apenas Fase 1, em staging, com rollback pronto.** Fases 2 e 3 ficam como roadmap, aprovadas individualmente após Fase 1 estabilizar (sugestão: 1 semana de observação).

Se aprovar este plano, eu começo por:

1. Criar a suíte de testes RLS (não toca produção).
2. Refatorar `src/lib/audit.ts` para usar função `SECURITY DEFINER`.
3. Gerar a migration `01_is_financeiro_column.sql` + rollback.

E paro para você revisar antes de seguir para 02/03/04.
