

# Fechar 3 gaps críticos de portabilidade

## 1) Header com `CREATE EXTENSION` no backup SQL

Editar `supabase/functions/backup-database/index.ts`, bloco SQL header (logo após `SET client_encoding`, antes de `-- ===== FUNCTIONS =====`):

```sql
-- ===== EXTENSIONS =====
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

Notas: `uuid-ossp` precisa de aspas duplas (hífen). `pg_cron` falha silenciosamente se o destino não tiver o package — adicionar comentário inline avisando que pode precisar de `shared_preload_libraries = 'pg_cron'` no `postgresql.conf`. No formato JSON, adicionar `extensions: ["pgcrypto","uuid-ossp","pg_net","pg_cron"]` dentro do bloco `schema`.

## 2) Edge function `backup-storage`

**Novo arquivo** `supabase/functions/backup-storage/index.ts`:

- **Auth**: mesma estrutura da `backup-database` — valida JWT → `is_profile_admin` → `getAdminClient` só após.
- **Listagem recursiva**: helper interno `listAllFiles(bucket, prefix='')` que chama `admin.storage.from(bucket).list(prefix, { limit: 1000 })` e recursa em subpastas (entries com `id === null` são pastas).
- **Buckets cobertos**: `["chat-attachments","maintenance-attachments"]` (hardcoded — refletem `<storage-buckets>` atual).
- **Signed URLs**: para cada arquivo, `admin.storage.from(bucket).createSignedUrl(path, 86400)` (24h). Em batch de 100 paralelos via `Promise.all` com `slice` para não saturar.
- **Resposta**: JSON estruturado:
  ```json
  {
    "generated_at": "...",
    "expires_at": "...(now+24h)",
    "buckets": {
      "chat-attachments":  [{ "path": "...", "size": 1234, "mime_type": "...", "signed_url": "https://..." }],
      "maintenance-attachments": [...]
    },
    "totals": { "files": N, "bytes": M },
    "instructions": "Use scripts/download-storage.sh ou wget -i urls.txt para baixar antes de 24h."
  }
  ```
- **Streaming**: igual `backup-database` (`ReadableStream`) — emite por bucket. Conta `bytesWritten` e `totalFiles`.
- **Auditoria**: `logAdminOperation({ function_name: "backup-storage", operation: "export_storage_manifest", metadata: { buckets, total_files, total_bytes } })`.
- **Histórico**: insert em `backup_runs` com `format: 'storage-json'` e `size_bytes`. Como `backup_runs.format` tem CHECK `IN ('sql','json')`, **migration extra**: `ALTER TABLE backup_runs DROP CONSTRAINT backup_runs_format_check; ALTER TABLE backup_runs ADD CONSTRAINT backup_runs_format_check CHECK (format IN ('sql','json','storage-json'));`
- **Config**: adicionar `[functions.backup-storage]\nverify_jwt = false` em `supabase/config.toml`.
- **CORS**: idêntico padrão das outras funções.

**UI** (`src/pages/Configuracoes.tsx`, aba "Backup & Exportação"):

- Adicionar terceiro botão `outline` ao lado de "Backup JSON": **"Exportar lista de arquivos (Storage)"** com ícone `FolderArchive` (lucide). Reusa o mesmo handler `handleGenerateBackup` parametrizado — refatorar para aceitar `endpoint` e `format`. Loading state e overlay reutilizam `generating` (estender union: `"sql" | "json" | "storage"`).
- Filename: `storage-manifest-YYYY-MM-DD-HHmm.json`.
- Adicionar legenda pequena abaixo: *"URLs assinadas válidas por 24h. Baixe os arquivos imediatamente após gerar."*
- Tabela de histórico: já lê `backup_runs.format` — exibir como "Storage" quando `format === 'storage-json'`.

## 3) `docs/migration-runbook.md` (novo)

Estrutura:

```
# Migration Runbook — Lovable Cloud → Postgres self-hosted (VPS)
## Pré-requisitos no destino
- Postgres 15+, extensões disponíveis (pgcrypto, uuid-ossp, pg_net, pg_cron)
- GoTrue (Supabase Auth) ou substituto compatível JWT
- Storage compatível S3 (MinIO recomendado se sem AWS)
- Reverse proxy + TLS (Caddy/Nginx)

## Fase 0 — Snapshot (no Lovable Cloud, como admin)
1. Configurações → Backup → "Gerar backup SQL" → salvar `backup-YYYY-MM-DD-HHmm.sql`
2. Configurações → Backup → "Backup JSON" → salvar (auditoria/diff)
3. Configurações → Backup → "Exportar lista de arquivos (Storage)" → salvar `storage-manifest-*.json`
4. Baixar arquivos do Storage IMEDIATAMENTE (URLs expiram em 24h):
   ```bash
   jq -r '.buckets | to_entries[] | .value[] | .signed_url' storage-manifest-*.json > urls.txt
   wget -i urls.txt -P ./storage-dump/
   ```

## Fase 1 — Provisionar Postgres
   ```bash
   sudo apt install postgresql-15 postgresql-15-cron postgresql-contrib
   # adicionar em postgresql.conf:
   shared_preload_libraries = 'pg_cron'
   cron.database_name = 'app'
   sudo systemctl restart postgresql
   createdb app
   ```

## Fase 2 — Restaurar schema + dados
   ```bash
   psql app < backup-YYYY-MM-DD-HHmm.sql
   ```
   O arquivo já contém: CREATE EXTENSION → CREATE FUNCTION → CREATE TABLE → INSERT → ALTER TABLE (FKs) → ENABLE RLS → CREATE POLICY → CREATE TRIGGER.
   Validar:
   ```bash
   psql app -c "SELECT count(*) FROM clients;"
   psql app -c "\dt public.*"
   ```

## Fase 3 — Auth (GoTrue)
1. Subir GoTrue (Docker compose abaixo).
2. Importar usuários a partir do bloco `AUTH_USERS_JSON` no SQL:
   ```bash
   sed -n '/AUTH_USERS_JSON/,/\*\//p' backup-*.sql | sed '1d;$d' > users.json
   node scripts/import-users.js users.json  # POST /admin/users via Auth API
   ```
3. Disparar reset de senha em lote (usuários precisam redefinir):
   ```bash
   jq -r '.[].email' users.json | xargs -I{} curl -X POST $AUTH_URL/recover -d '{"email":"{}"}'
   ```
4. Reconfigurar manualmente: providers OAuth, templates de email, rate limits, JWT secret.

## Fase 4 — Storage
1. Criar buckets no MinIO/S3:
   ```bash
   mc mb local/chat-attachments
   mc mb local/maintenance-attachments
   mc anonymous set download local/chat-attachments
   mc anonymous set download local/maintenance-attachments
   ```
2. Restaurar arquivos preservando paths do `storage-manifest-*.json`:
   ```bash
   jq -r '.buckets | to_entries[] | .key as $b | .value[] | "\($b)\t\(.path)"' storage-manifest-*.json \
     | while IFS=$'\t' read bucket path; do
         mc cp "./storage-dump/$(basename $path)" "local/$bucket/$path"
       done
   ```
3. Atualizar URLs no banco se hardcoded (raro — verificar `messages.attachment_url`, `equipment_maintenances.attachments`, `maintenance_requests.attachments`).

## Fase 5 — pg_cron jobs
Reaplicar manualmente (não estão no backup):
   ```sql
   SELECT cron.schedule('check-reminders', '*/5 * * * *',
     $$ SELECT net.http_post('https://<vps>/functions/v1/check-reminders', '{}'::jsonb) $$);
   SELECT cron.schedule('scrape-prices-cron', '0 6 * * *',
     $$ SELECT net.http_post('https://<vps>/functions/v1/scrape-prices-cron', '{}'::jsonb) $$);
   SELECT cron.schedule('monitor-admin-usage', '0 * * * *',
     $$ SELECT net.http_post('https://<vps>/functions/v1/monitor-admin-usage', '{}'::jsonb) $$);
   ```

## Fase 6 — Realtime publication
   ```sql
   CREATE PUBLICATION supabase_realtime FOR TABLE
     public.messages, public.notifications, public.alertas_precos,
     public.maintenance_requests, public.channel_members;
   ```

## Fase 7 — Edge Functions
- Código já está em `supabase/functions/*` (Git). Deploy:
  - Opção A (recomendada): Supabase self-hosted Docker compose (inclui edge runtime).
  - Opção B: portar para Node.js + Hono em outro container.
- Reconfigurar secrets no destino: `BROWSERLESS_API_KEY`, `FIRECRAWL_API_KEY`, `LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (gerar nova), `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

## Fase 8 — Frontend
- Atualizar `.env`:
  ```
  VITE_SUPABASE_URL=https://api.<seudominio>
  VITE_SUPABASE_PUBLISHABLE_KEY=<nova anon key>
  VITE_SUPABASE_PROJECT_ID=self-hosted
  ```
- Build + deploy estático (Caddy/Nginx).

## Fase 9 — DNS cutover
1. Apontar `app.<domínio>` → IP da VPS.
2. Apontar `api.<domínio>` → mesmo IP (porta GoTrue/PostgREST/edge).
3. Validar TLS (Caddy autoTLS ou certbot).
4. Smoke test: login, listar clientes, abrir chat, gerar orçamento.

## Pós-migração
- Rodar `backup-database` no destino para validar que tudo replica.
- Comparar contagens linha-a-linha com `backup.json` original.
- Notificar usuários sobre reset de senha obrigatório.

## Limitações conhecidas que esta migração NÃO resolve
- Histórico de logs do GoTrue (sign-in attempts) — perdido.
- Sessões ativas — todos serão deslogados.
- Vault secrets do Supabase — reaplicar manualmente.
```

## Arquivos afetados

| Ação | Arquivo |
|---|---|
| Editar | `supabase/functions/backup-database/index.ts` (bloco EXTENSIONS no SQL e JSON) |
| Criar | `supabase/functions/backup-storage/index.ts` |
| Editar | `supabase/config.toml` (`[functions.backup-storage]`) |
| Migration | `ALTER TABLE backup_runs` — atualizar CHECK de `format` para incluir `storage-json` |
| Editar | `src/pages/Configuracoes.tsx` (3º botão + handler genérico + label "Storage" no histórico) |
| Criar | `docs/migration-runbook.md` |

## Fora de escopo (deliberadamente adiado)

- Script `import-users.js` referenciado no runbook — só criamos quando migração for real (depende do destino escolhido: GoTrue puro vs Supabase self-hosted).
- Script `bulk-password-reset` — idem.
- Download automático dos blobs de Storage dentro da edge function (timeout/memória) — runbook usa `wget -i` no cliente.

