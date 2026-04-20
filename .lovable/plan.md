

# Edge Function `backup-database` + UI de Backup

## 1) Edge Function `supabase/functions/backup-database/index.ts`

**Auth**: cliente criado com JWT do request → checa `is_profile_admin(auth.uid())` via RPC. Se não for admin → 403. Cliente service-role (`getAdminClient`) é instanciado **somente após** validação.

**Query params**:
- `?format=sql` (default) → `Content-Type: application/sql`, `Content-Disposition: attachment; filename=backup-YYYY-MM-DD-HHmm.sql`
- `?format=json` → `Content-Type: application/json`, filename `.json`

**Streaming**: usar `ReadableStream` + `TransformStream` para emitir o conteúdo em chunks conforme cada bloco é gerado. Resposta com `Transfer-Encoding: chunked` (automático quando body é stream).

**Conteúdo extraído** (via `supabase--read_query` em Postgres catalog, executados pelo service-role client com `.rpc()` em funções helper SQL ou via `from(information_schema...)`):

| Bloco | Fonte | Saída SQL | Saída JSON |
|---|---|---|---|
| Header | — | `-- Backup gerado em ...` + nota sobre limitações | `{ generated_at, limitations: [...] }` |
| Tabelas | `information_schema.columns` + `information_schema.table_constraints` | `CREATE TABLE public.X (...)` ordenado topologicamente por FK | `schema.tables[]` |
| Índices | `pg_indexes` (schema=public, exclui PK) | `CREATE INDEX ...` | `schema.indexes[]` |
| Foreign Keys | `information_schema.referential_constraints` | `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` (após dados) | `schema.foreign_keys[]` |
| Functions | `pg_proc` + `pg_get_functiondef(oid)` (schema=public) | `CREATE OR REPLACE FUNCTION ...` | `schema.functions[]` |
| Triggers | `pg_trigger` + `pg_get_triggerdef(oid)` (não-internos) | `CREATE TRIGGER ...` | `schema.triggers[]` |
| RLS | `pg_policies` + `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | `CREATE POLICY ...` | `schema.policies[]` |
| Dados | `SELECT *` paginado (1000/página) por tabela | `INSERT INTO public.X (cols) VALUES (...);` com escape correto | `data[tableName][]` |
| Auth users | `supabase.auth.admin.listUsers({ perPage: 1000 })` paginado | bloco `-- AUTH USERS (sem hashes) ` + comentário com JSON inline | `auth_users[]` |

**Helpers SQL**: para acessar catálogos do Postgres a partir da edge function precisamos de **funções RPC `SECURITY DEFINER`** dedicadas (a service-role NÃO bypassa permissão do usuário do banco para ler `pg_proc.prosrc`/`pg_get_functiondef`, mas como roda como `postgres` via PostgREST tem acesso). Criar:
- `public.backup_get_tables()` → retorna JSON com colunas e tipos
- `public.backup_get_functions()` → retorna `pg_get_functiondef` para todas funções de `public`
- `public.backup_get_triggers()` → idem
- `public.backup_get_policies()` → idem
- `public.backup_get_indexes()` → idem
- `public.backup_get_foreign_keys()` → idem

Todas com `GRANT EXECUTE TO service_role` apenas. Nenhuma para `authenticated`.

**Ordenação topológica de tabelas**: helper inline na função TS — grafo de FK → Kahn's algorithm. Tabelas sem FK saem primeiro, dependentes depois. Tabelas com ciclo (raras) saem por nome e FKs dessas viram `ALTER TABLE` no final.

**Escape de valores SQL**: helper `sqlEscape(value)` com regras: `null`→`NULL`, `string`→`E'...'` com escape de `'` e `\`, `number/bool`→literal, `Date`→`'ISO'::timestamptz`, `object/array`→`'json'::jsonb`.

**Auditoria**: ao final, chamar `logAdminOperation` com `function_name: "backup-database"`, `operation: "export_full_backup"`, `metadata: { format, size_bytes, table_count, user_count }`, `invoked_by: auth.uid()`.

**Registro em `backup_runs`**: insert ao terminar com `id, created_at, created_by, format, size_bytes, status` ('success' ou 'failed' em catch). Como streaming dificulta saber size antes de fechar, contar bytes num accumulator durante o pipe.

## 2) Migration

```sql
-- Tabela de histórico
CREATE TABLE public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  format text NOT NULL CHECK (format IN ('sql','json')),
  size_bytes bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed')),
  error_message text
);
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view backup_runs" ON public.backup_runs
  FOR SELECT TO authenticated USING (is_profile_admin(auth.uid()));
CREATE POLICY "Service inserts backup_runs" ON public.backup_runs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Helpers SQL para introspecção (SECURITY DEFINER, restritos a service_role)
CREATE OR REPLACE FUNCTION public.backup_get_functions() RETURNS jsonb ...
-- (e os outros 5 helpers listados acima)
REVOKE EXECUTE ON FUNCTION public.backup_get_functions() FROM PUBLIC, authenticated;
```

## 3) `supabase/config.toml`

Adicionar:
```toml
[functions.backup-database]
verify_jwt = false
```
(validação manual de admin acontece em código, padrão das demais privilegiadas.)

## 4) UI — Aba "Backup & Exportação" em `src/pages/Configuracoes.tsx`

Refatorar página para usar **`Tabs`** (`@/components/ui/tabs`):
- Aba "Geral" → conteúdo atual (custos + composição de preço).
- Aba "Backup & Exportação" → **só renderiza se `useAuth().profile?.role === 'admin'`**. Para não-admins, esconder o trigger inteiro.

**Conteúdo da aba**:
- Card "Gerar backup" com 2 botões:
  - `Gerar backup SQL` (primário) → fetch para `${SUPABASE_URL}/functions/v1/backup-database?format=sql` com header `Authorization: Bearer ${session.access_token}` → `response.blob()` → trigger download via `<a download>`. Loading state + toast.
  - `Backup JSON` (secundário/outline) → idem com `?format=json`.
- Aviso amarelo (Alert): "Backup não inclui hashes de senha de usuários (limitação técnica do Auth API). Usuários migrados precisarão resetar senha."
- Card "Histórico de Backups" → tabela (`@/components/ui/table`) com colunas: Data, Por, Formato, Tamanho, Status. Query: `supabase.from('backup_runs').select('*, profiles!created_by(display_name)').order('created_at', desc).limit(50)`. Refresh manual + após cada novo backup.

Helper `formatBytes(n)`: KB/MB/GB.

## 5) Arquivos afetados

| Ação | Arquivo |
|---|---|
| Migration | `backup_runs` + 6 funções helper `backup_get_*` |
| Criar | `supabase/functions/backup-database/index.ts` |
| Editar | `supabase/config.toml` (bloco `[functions.backup-database]`) |
| Editar | `src/pages/Configuracoes.tsx` (refatorar para Tabs + nova aba admin-only) |

## Limites conhecidos (documentados na resposta da função)

- Senhas de `auth.users` não exportadas (Auth API não expõe hashes).
- Configurações do GoTrue (templates email, providers OAuth, rate limits) não migráveis — reaplicar manualmente no destino.
- Storage (buckets `chat-attachments`, `maintenance-attachments`) **não** incluso — exportação separada via signed URLs no futuro.
- Cron jobs (`pg_cron`) não inclusos automaticamente — reaplicar manualmente.
- Em bancos muito grandes (>500MB), edge function pode atingir timeout (~150s). Mitigação futura: paginar export por tabela em chamadas separadas.

