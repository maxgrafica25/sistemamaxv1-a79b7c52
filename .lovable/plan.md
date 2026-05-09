
# Plano — Fase 1 em staging (Caminho A, uma a uma)

## Objetivo
Aplicar as 4 migrations de Fase 1 em um Supabase de staging novo, validando com a suíte RLS entre cada migration, sem tocar em produção.

## Limitação importante
Eu (Lovable) **não consigo me conectar nativamente a outro projeto Supabase** a partir deste workspace. O backend nativo aqui é a produção. Portanto:
- **Você** executa os passos contra staging (rodar SQL, rodar testes, rodar script de seed).
- **Eu** entrego runbook, scripts, SQL final e analiso resultados que você colar aqui.
- A única coisa que eu rodo no sandbox é a suíte de testes Vitest (`bun run test:rls`), apontando para staging via secrets — desde que esses secrets estejam configurados como variáveis de ambiente do projeto.

---

## Etapa 0 — Runbook de criação do staging (você executa)

Eu vou gerar e te entregar `docs/security-phase1/STAGING_SETUP.md` cobrindo:

1. **Criar projeto Supabase novo** (free tier; mesma região da prod; nome ex.: `orcagrafica-staging`).
2. **Baixar dump da prod**: Cloud → Database → Backups → download do snapshot mais recente (ou `pg_dump` via connection string).
3. **Restaurar dump no staging** via `psql "<STAGING_DB_URL>" < dump.sql`. Comandos exatos no runbook.
4. **Validar restore**: contagem de linhas em `profiles`, `quotes`, `accounts_receivable` deve bater com prod.
5. **Anotar credenciais do staging**:
   - URL, anon key, service_role key, DB URL direta.
6. **Confirmar `project ref` ≠ `nxkmxslugblhsyohrrvm`** (guarda anti-prod já existe em `setup.ts`).

Critério de saída: você me responde "staging pronto, ref = `xxx`".

---

## Etapa 1 — Script de seed dos 3 usuários de teste

Eu gero `scripts/seed-staging-users.ts` (Deno ou Bun). Ele:
- Recebe `STAGING_SUPABASE_URL` e `STAGING_SUPABASE_SERVICE_ROLE_KEY` via env.
- Cria 3 usuários via Admin API (`auth.admin.createUser`) com `email_confirm: true`:
  - `admin@staging.local` → após criação, `UPDATE profiles SET role='admin', is_active=true`. **Garante que é o único admin ativo** desativando outros admins do dump.
  - `financeiro@staging.local` → `UPDATE profiles SET display_name='Juliano', is_active=true` (compatível com `is_financeiro_user` atual).
  - `colab@staging.local` → padrão (`role='colaborador'`, `is_active=true`).
- Imprime senhas geradas com `crypto.randomUUID()` no stdout.
- Idempotente: se usuário já existe, só reseta a senha.

Você roda 1x: `bun scripts/seed-staging-users.ts` e me cola o output (ou já me envia via `add_secret`).

---

## Etapa 2 — Secrets que vou pedir via `add_secret`

Quando você confirmar Etapa 0 e Etapa 1, eu chamo `add_secret` para:

```
STAGING_SUPABASE_URL
STAGING_SUPABASE_ANON_KEY
STAGING_SUPABASE_SERVICE_ROLE_KEY
STAGING_SUPABASE_DB_URL
STAGING_ADMIN_EMAIL
STAGING_ADMIN_PASSWORD
STAGING_FINANCEIRO_EMAIL
STAGING_FINANCEIRO_PASSWORD
STAGING_COLAB_EMAIL
STAGING_COLAB_PASSWORD
```

Você cola os valores no formulário seguro do Lovable (nunca em chat).

---

## Etapa 3 — Baseline (antes de qualquer migration)

Comando que eu rodo no sandbox:
```
bun run test:rls
```
Esperado: testes que dependem de `is_financeiro` column **falham** (coluna não existe ainda) — isso confirma que o teste vai detectar a mudança. Os outros (escalation, last_admin_lockout, AR via display_name) devem **passar**.

Se a baseline se comportar diferente do previsto, paramos e investigamos antes de qualquer migration.

---

## Etapa 4 — Aplicar migrations uma a uma

Para cada migration (01 → 02 → 03 → 04):

1. Eu te entrego o SQL exato (já existe em `docs/security-phase1/0X_*.sql`, posso refinar se necessário).
2. **Você** roda em staging: `psql "$STAGING_DB_URL" -f docs/security-phase1/0X_*.sql` e me cola a saída.
3. Eu rodo `bun run test:rls` no sandbox.
4. Analiso resultado e te dou veredicto: ✅ ok para próxima / ❌ rollback (`psql -f 0X_*_rollback.sql`).
5. **Aguardo seu OK explícito** antes de mandar o SQL da próxima.

Ordem e pré-requisitos por migration:
- **01 — `is_financeiro_column`** (baixo risco): adiciona coluna + trigger anti-escalation. Sem dependência de frontend (audit.ts já tem fallback).
- **02 — `audit_logs_lockdown`** (médio): exige que `src/lib/audit.ts` use RPC `log_audit_event` — já refatorado. Confirmo no código antes.
- **03 — `realtime_financeiro`** (alto): primeiro rodamos o **leak test** (script Realtime do README) com client `colab` em staging. Se NÃO houver leak, marcamos 03 como "defensivo, opcional" e seguimos. Se houver leak, aplico, e te aviso que `ContasReceber.tsx` perde auto-refresh (precisa de canal privado posterior).
- **04 — `storage_private`** (alto): **antes** de aplicar, refatoro `ChatInput.tsx`, `MaintenanceTab.tsx`, `MaintenanceRequestsTab.tsx` para usar `createSignedUrl`. Faço PR de código separado, você aprova, depois rodamos a migration.

---

## Etapa 5 — Smoke test manual em staging

Após cada migration aplicada com testes verdes, você faz no app (apontado para staging):
- login admin/financeiro/colab
- criar orçamento
- gerar conta a receber (financeiro)
- upload de anexo no chat (após 04)
- reset de senha
- me avisa qualquer comportamento estranho

---

## Etapa 6 — Encerramento da Fase 1

Quando 01–04 estiverem ✅ em staging + smoke OK:
- Eu atualizo `docs/security-phase1/README.md` com "aplicado em staging em <data>, observações: ..."
- **Não promovemos para prod neste plano.** Promoção para prod será uma próxima conversa, com snapshot manual e janela definida.

---

## O que esta plan vai criar quando você clicar "Implement plan"

Arquivos novos (modo build):
- `docs/security-phase1/STAGING_SETUP.md` — runbook Etapa 0
- `scripts/seed-staging-users.ts` — Etapa 1
- (Possível) refinos em `docs/security-phase1/0X_*.sql` se eu detectar gaps na revisão final
- `package.json`: script `"seed:staging": "bun scripts/seed-staging-users.ts"`

**Nada será aplicado em banco nenhum nesta entrega.** Só geração de runbook + script. A execução real começa depois que você completar Etapa 0 e me avisar.

---

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Você executar runbook contra prod por engano | Script e setup.ts checam `project ref ≠ nxkmxslugblhsyohrrvm` e abortam |
| Seed quebrar dump real (sobrescrever admins reais) | Script opera só em emails `*@staging.local`; admins reais ficam intactos, apenas `is_active=false` temporário |
| Migration 03 quebrar Realtime de financeiro | Leak test obrigatório antes; se aplicada, te alerto sobre ajuste posterior |
| Migration 04 quebrar anexos | Refator de frontend feito **antes** da migration, validado em staging |
| Eu não conseguir rodar testes apontando para staging | Plan B: você roda `bun run test:rls` localmente com os mesmos secrets e me cola output |

## Critério de sucesso da Fase 1
- 4 migrations aplicadas em staging
- `bun run test:rls` 100% verde após cada uma
- Smoke test manual sem regressão
- Runbook de promoção para prod escrito mas **não executado**
