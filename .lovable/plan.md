

# Implementar A (cron + realtime no backup) + B (script reset de senhas)

## Item A — Exportar `cron.job` e `pg_publication_tables` no backup SQL

### A.1 Migration: 2 funções SECURITY DEFINER

Como `cron.job` está no schema `cron` e `pg_publication_tables` em `pg_catalog`, e o service-role pode até ter acesso direto, padronizamos via funções helpers (mesmo padrão dos outros `backup_get_*`):

```sql
CREATE OR REPLACE FUNCTION public.backup_get_cron_jobs()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, cron, pg_catalog
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'jobname', jobname,
    'schedule', schedule,
    'command', command,
    'database', database,
    'username', username,
    'active', active
  ) ORDER BY jobname), '[]'::jsonb)
  FROM cron.job;
$$;

CREATE OR REPLACE FUNCTION public.backup_get_realtime_publication()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'pubname', pubname,
    'schemaname', schemaname,
    'tablename', tablename
  ) ORDER BY pubname, tablename), '[]'::jsonb)
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime';
$$;

GRANT EXECUTE ON FUNCTION public.backup_get_cron_jobs() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backup_get_realtime_publication() TO authenticated, service_role;
```

Se `cron.job` não for selecionável mesmo via SECURITY DEFINER (postgres owner não tem permissão em ambientes restritos), a função retornará `[]` em try/catch — o backup não quebra.

### A.2 `supabase/functions/backup-database/index.ts`

- Adicionar 2 chamadas no `Promise.all` inicial: `admin.rpc("backup_get_cron_jobs")` e `admin.rpc("backup_get_realtime_publication")`. Tratar erro como array vazio.
- **Formato JSON**: dentro de `schema`, adicionar `cron_jobs` e `realtime_publication`.
- **Formato SQL**: novos blocos no final, antes de `AUTH USERS`:

  ```sql
  -- ===== REALTIME PUBLICATION =====
  -- Recria publicação supabase_realtime com tabelas selecionadas.
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE
    public."messages", public."notifications", ...;

  -- ===== CRON JOBS =====
  -- Reagenda jobs (requer pg_cron instalado e shared_preload_libraries='pg_cron').
  -- IMPORTANTE: jobs apontam para URL/keys do AMBIENTE ORIGINAL — revisar antes de aplicar.
  SELECT cron.unschedule('check-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='check-reminders');
  SELECT cron.schedule('check-reminders', '*/5 * * * *', $cron$ ...command original... $cron$);
  ```

  Para cada job: emitir `unschedule` condicional + `schedule` com o `command` original entre `$cron$ ... $cron$` (dollar quoting evita escapar aspas internas).

- Lista de tabelas do realtime vem dinâmica do helper; se vier vazia, comentar o bloco com aviso.

## Item B — Script `scripts/reset-passwords-bulk.ts`

### B.1 Novo arquivo `scripts/reset-passwords-bulk.ts`

Script Deno standalone (não é edge function — roda no terminal do operador da migração no destino):

- **Entrada**: `users.json` extraído do bloco `AUTH_USERS_JSON` do backup SQL (formato: array de `{id, email, ...}`).
- **Variáveis de ambiente**: `AUTH_URL` (ex: `https://api.exemplo.com`), `AUTH_ANON_KEY` (do GoTrue do destino).
- **Lógica**:
  - Lê `users.json` via `Deno.readTextFile`.
  - Para cada usuário com `email` válido: `POST {AUTH_URL}/auth/v1/recover` com body `{ "email": "..." }` e header `apikey`.
  - **Rate limit**: batches de 5 paralelos via `Promise.all` + `await new Promise(r=>setTimeout(r,1000))` entre batches (evita rate limit GoTrue padrão de 30/h por IP — operador deve ajustar GoTrue antes).
  - **Retry**: 1 retry após 5s em caso de 429/5xx.
  - **Log**: arquivo `reset-log-YYYYMMDD.csv` com colunas `email,status,http_code,error`.
  - **Resumo final**: stdout com totais de sucesso/falha.
- **Uso**:
  ```bash
  AUTH_URL=https://api.dest.com AUTH_ANON_KEY=eyJ... deno run --allow-net --allow-env --allow-read --allow-write scripts/reset-passwords-bulk.ts users.json
  ```
- **Sem dependências externas** — usa `fetch` nativo do Deno.

### B.2 Atualizar `docs/migration-runbook.md` Fase 3

Substituir o `xargs curl` improvisado pelo comando do script real:

```bash
# Extrair usuários do bloco AUTH_USERS_JSON do SQL
sed -n '/AUTH_USERS_JSON/,/\*\//p' backup-*.sql | sed '1d;$d' > users.json

# Rodar reset em lote (rate-limited, com retry e log CSV)
AUTH_URL=https://api.<vps> AUTH_ANON_KEY=<gotrue-anon-key> \
  deno run --allow-net --allow-env --allow-read --allow-write \
  scripts/reset-passwords-bulk.ts users.json

# Verificar reset-log-*.csv para falhas
```

Adicionar nota: "Antes de rodar, aumentar `GOTRUE_RATE_LIMIT_EMAIL_SENT` no destino (default 30/h é muito baixo para reset em lote)."

## Validação pós-implementação

1. Migration aplica sem erro → confirmar via `read_query` que as 2 funções existem.
2. Deploy `backup-database` → `curl_edge_functions` em `?format=sql` autenticado → confirmar blocos `-- ===== CRON JOBS =====` e `-- ===== REALTIME PUBLICATION =====` presentes.
3. `?format=json` → confirmar `schema.cron_jobs` e `schema.realtime_publication` no payload.
4. `deno check scripts/reset-passwords-bulk.ts` → confirmar que tipa sem erro (não executar — não há GoTrue de teste).

## Arquivos afetados

| Ação | Arquivo |
|---|---|
| Migration | criar `backup_get_cron_jobs()` + `backup_get_realtime_publication()` |
| Editar | `supabase/functions/backup-database/index.ts` (RPCs + 2 blocos SQL + 2 campos JSON) |
| Criar | `scripts/reset-passwords-bulk.ts` |
| Editar | `docs/migration-runbook.md` (Fase 3 com comando real do script) |

## Fora de escopo

- Importação de usuários (`import-users.js`) — depende de qual stack de Auth o destino usar (GoTrue puro vs Supabase self-hosted vs Auth0). Criar quando a migração real começar.
- Reaplicação de secrets do Vault Supabase — não há API pública para extrair.
- Testar o script contra um GoTrue real — sem ambiente de teste disponível agora.

