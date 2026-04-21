# Migration Runbook — Lovable Cloud → Postgres self-hosted (VPS)

Checklist passo-a-passo para migrar o sistema completo do Lovable Cloud (Supabase gerenciado) para uma VPS própria, mantendo dados, autenticação, storage, cron jobs e realtime funcionando.

> **Tempo estimado:** 4–8h dependendo do volume de dados e familiaridade com Postgres/Docker.
> **Pré-requisito:** acesso admin no Lovable Cloud (perfil com `role = 'admin'`).

---

## Pré-requisitos no destino

- **Postgres 15+** com extensões disponíveis: `pgcrypto`, `uuid-ossp`, `pg_net`, `pg_cron`.
- **GoTrue** (Supabase Auth open-source) ou substituto compatível JWT (HS256).
- **Storage compatível S3** (MinIO recomendado se sem AWS).
- **Reverse proxy + TLS** (Caddy ou Nginx).
- **Docker + docker-compose** (recomendado para subir o stack Supabase self-hosted).

---

## Fase 0 — Snapshot (no Lovable Cloud, como admin)

1. **Configurações → Backup & Exportação → "Gerar backup SQL"** → salvar `backup-YYYY-MM-DD-HHmm.sql`.
2. **Configurações → Backup & Exportação → "Backup JSON"** → salvar (auditoria/diff).
3. **Configurações → Backup & Exportação → "Exportar lista de arquivos (Storage)"** → salvar `storage-manifest-YYYY-MM-DD-HHmm.json`.
4. **Baixar arquivos do Storage IMEDIATAMENTE** (URLs assinadas expiram em 24h):

   ```bash
   jq -r '.buckets | to_entries[] | .value[] | .signed_url' storage-manifest-*.json > urls.txt
   wget -i urls.txt -P ./storage-dump/
   ```

   Para preservar paths originais ao baixar:

   ```bash
   jq -r '.buckets | to_entries[] | .key as $b | .value[] | "\($b)\t\(.path)\t\(.signed_url)"' storage-manifest-*.json \
     | while IFS=$'\t' read bucket path url; do
         mkdir -p "./storage-dump/$bucket/$(dirname "$path")"
         curl -sSL "$url" -o "./storage-dump/$bucket/$path"
       done
   ```

---

## Fase 0.5 — Deploy do stack via docker-compose (recomendado)

O repositório já inclui `docker-compose.yml` + `Dockerfile` + configs auxiliares para subir tudo (Postgres, Auth, REST, Realtime, MinIO, Storage API, Edge Functions, Kong, Caddy e frontend) em um único `docker compose up -d`.

1. **Pré-requisitos na VPS:** Docker 24+ com Compose v2, portas 80/443 livres, DNS apontando.

2. **Configurar variáveis** (uma única vez):

   ```bash
   cp .env.example .env
   # Gerar secrets:
   echo "JWT_SECRET=$(openssl rand -base64 64)" >> .env
   echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)" >> .env
   echo "MINIO_ROOT_PASSWORD=$(openssl rand -base64 24)" >> .env
   # Gerar ANON_KEY e SERVICE_ROLE_KEY (script abaixo lê JWT_SECRET do .env):
   set -a && source .env && set +a
   deno run --allow-env scripts/generate-jwt.ts
   # Copiar a saída para .env. VITE_SUPABASE_PUBLISHABLE_KEY = ANON_KEY.
   ```

   Documentação completa de cada variável: `docs/deployment-vars.md`.

3. **Subir o stack:**

   ```bash
   docker compose config > /dev/null   # valida sintaxe
   docker compose up -d --build
   docker compose ps                   # todos devem estar healthy
   ```

4. **Restaurar dados** (continua nas Fases 2–6, mas agora apontando para os containers):

   ```bash
   docker compose exec -T db psql -U postgres -d postgres < backup-YYYY-MM-DD-HHmm.sql
   ```

5. **Restaurar Storage** via MinIO Client (Fase 4 adaptada):

   ```bash
   docker compose run --rm minio-init mc cp --recursive /storage-dump/ local/
   ```

A Fase 1 abaixo (Postgres bare-metal) só é necessária se você **não** quiser usar Docker.

---

## Fase 1 — Provisionar Postgres (alternativa bare-metal)

```bash
sudo apt install postgresql-15 postgresql-15-cron postgresql-contrib

# Editar /etc/postgresql/15/main/postgresql.conf:
#   shared_preload_libraries = 'pg_cron'
#   cron.database_name = 'app'
sudo systemctl restart postgresql

sudo -u postgres createdb app
sudo -u postgres createuser --pwprompt app_owner
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE app TO app_owner;"
```

---

## Fase 2 — Restaurar schema + dados

```bash
psql -U app_owner -d app < backup-YYYY-MM-DD-HHmm.sql
```

O arquivo SQL gerado já contém, na ordem correta:
1. `CREATE EXTENSION` (pgcrypto, uuid-ossp, pg_net, pg_cron)
2. `CREATE FUNCTION` (todas as funções `public.*`)
3. `CREATE TABLE` (ordenação topológica por FK)
4. `CREATE INDEX`
5. `INSERT INTO` (dados, paginados em batches de 1000)
6. `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` (após inserts para evitar problemas de ordem)
7. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`
8. `CREATE TRIGGER`

**Validação:**

```bash
psql -U app_owner -d app -c "SELECT count(*) FROM clients;"
psql -U app_owner -d app -c "\dt public.*"
psql -U app_owner -d app -c "SELECT tablename, count(*) FROM pg_policies WHERE schemaname='public' GROUP BY tablename;"
```

---

## Fase 3 — Auth (GoTrue)

1. **Subir GoTrue** via docker-compose (use o `docker-compose.yml` oficial do Supabase self-hosted).

2. **Antes de qualquer reset em lote**, aumente o rate limit de email do GoTrue no destino — o default (`GOTRUE_RATE_LIMIT_EMAIL_SENT=30` por hora) é muito baixo para reset em massa. Algo como `300/hora` cobre bases até ~1500 usuários sem bloqueios.

3. **Importar usuários** a partir do bloco `AUTH_USERS_JSON` no SQL:

   ```bash
   sed -n '/AUTH_USERS_JSON/,/\*\//p' backup-*.sql | sed '1d;$d' > users.json
   # Criar script scripts/import-users.js que faz POST /admin/users via Auth Admin API
   # (não incluído no repo — depende do destino: GoTrue puro vs Supabase self-hosted)
   node scripts/import-users.js users.json
   ```

4. **Disparar reset de senha em lote** (todos os usuários precisam redefinir, pois hashes não são exportados pela Auth API). Use o script `scripts/reset-passwords-bulk.ts` deste repo — ele faz batches de 5 paralelos, retry em 429/5xx e gera log CSV:

   ```bash
   AUTH_URL=https://api.<vps> AUTH_ANON_KEY=<gotrue-anon-key> \
     deno run --allow-net --allow-env --allow-read --allow-write \
     scripts/reset-passwords-bulk.ts users.json

   # Inspecionar reset-log-YYYYMMDD.csv para identificar falhas
   ```

5. **Reconfigurar manualmente** no GoTrue:
   - Providers OAuth (Google, GitHub, etc.)
   - Templates de email (recuperação, confirmação)
   - Rate limits
   - **JWT secret** (gerar novo, atualizar em todos os clientes)

---

## Fase 4 — Storage (MinIO ou S3)

1. **Criar buckets** com mesmo nome:

   ```bash
   mc alias set local http://localhost:9000 minioadmin minioadmin
   mc mb local/chat-attachments
   mc mb local/maintenance-attachments
   mc anonymous set download local/chat-attachments
   mc anonymous set download local/maintenance-attachments
   ```

2. **Restaurar arquivos** preservando paths do `storage-manifest-*.json`:

   ```bash
   for bucket in chat-attachments maintenance-attachments; do
     mc cp --recursive "./storage-dump/$bucket/" "local/$bucket/"
   done
   ```

3. **Atualizar URLs hardcoded no banco** (raro — a maioria usa paths relativos):

   ```sql
   -- Verificar se há URLs absolutas apontando para o domínio antigo
   SELECT count(*) FROM messages WHERE attachment_url LIKE '%supabase.co%';
   SELECT count(*) FROM equipment_maintenances WHERE EXISTS (
     SELECT 1 FROM unnest(attachments) a WHERE a LIKE '%supabase.co%'
   );

   -- Se necessário, fazer replace:
   UPDATE messages
   SET attachment_url = REPLACE(attachment_url, 'https://OLD.supabase.co/storage/v1/object/public/', 'https://NEW.example.com/storage/v1/object/public/')
   WHERE attachment_url LIKE '%OLD.supabase.co%';
   ```

---

## Fase 5 — pg_cron jobs

Os jobs **não estão no backup** (vivem no schema `cron`, fora do `public`). Reaplicar manualmente:

```sql
SELECT cron.schedule('check-reminders', '*/5 * * * *',
  $$ SELECT net.http_post(
       'https://api.<seudominio>/functions/v1/check-reminders',
       '{}'::jsonb,
       '{}'::jsonb,
       headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb
     ) $$);

SELECT cron.schedule('scrape-prices-cron', '0 6 * * *',
  $$ SELECT net.http_post(
       'https://api.<seudominio>/functions/v1/scrape-prices-cron',
       '{}'::jsonb,
       '{}'::jsonb,
       headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb
     ) $$);

SELECT cron.schedule('monitor-admin-usage', '0 * * * *',
  $$ SELECT net.http_post(
       'https://api.<seudominio>/functions/v1/monitor-admin-usage',
       '{}'::jsonb,
       '{}'::jsonb,
       headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb
     ) $$);

-- Verificar:
SELECT * FROM cron.job;
```

---

## Fase 6 — Realtime publication

A `PUBLICATION supabase_realtime` precisa ser recriada manualmente:

```sql
CREATE PUBLICATION supabase_realtime FOR TABLE
  public.messages,
  public.notifications,
  public.alertas_precos,
  public.maintenance_requests,
  public.channel_members;

-- Verificar:
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

E garantir que o serviço `realtime` do Supabase self-hosted está rodando e apontando para o mesmo Postgres.

---

## Fase 7 — Edge Functions

O código já está em `supabase/functions/*` (Git). Opções de deploy:

**Opção A (recomendada): Supabase self-hosted Docker compose**
- Inclui edge runtime Deno nativo.
- Comando: `supabase functions deploy --project-ref self-hosted` (após apontar CLI para a VPS).

**Opção B: Portar para Node.js + Hono**
- Reescrever cada função usando `@hono/node-server`.
- Container separado com proxy reverso.

**Reconfigurar secrets no destino:**
- `BROWSERLESS_API_KEY`
- `FIRECRAWL_API_KEY`
- `LOVABLE_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (gerar novo no destino)
- `SUPABASE_URL` (URL da nova API)
- `SUPABASE_ANON_KEY` (gerar novo)

---

## Fase 8 — Frontend

Atualizar `.env` do build:

```env
VITE_SUPABASE_URL=https://api.<seudominio>
VITE_SUPABASE_PUBLISHABLE_KEY=<nova anon key>
VITE_SUPABASE_PROJECT_ID=self-hosted
```

Build + deploy estático:

```bash
npm run build
# Servir dist/ via Caddy/Nginx
```

---

## Fase 9 — DNS cutover

1. Apontar `app.<dominio>` → IP da VPS (frontend).
2. Apontar `api.<dominio>` → IP da VPS (porta GoTrue/PostgREST/edge).
3. Validar TLS (Caddy autoTLS ou certbot).
4. **Smoke test obrigatório:**
   - [ ] Login funciona
   - [ ] Listar clientes retorna dados
   - [ ] Abrir chat e enviar mensagem (testa Realtime + Storage)
   - [ ] Criar orçamento end-to-end
   - [ ] Disparar reminder manualmente (testa edge function + cron)

---

## Pós-migração

- **Rodar `backup-database` no destino** para validar que tudo replica.
- **Comparar contagens linha-a-linha** com o `backup.json` original:

  ```bash
  jq '.data | to_entries | map({table: .key, count: (.value | length)}) | sort_by(.table)' backup-*.json
  ```

- **Notificar usuários** sobre reset de senha obrigatório (broadcast email).
- **Monitorar logs** do GoTrue por 48h para capturar usuários que não conseguirem logar.

---

## Limitações conhecidas que esta migração NÃO resolve

| Item | Impacto | Mitigação |
|---|---|---|
| Hashes de senha | Todos resetam senha | Reset em lote na Fase 3 |
| Histórico de logs do GoTrue | Logs de sign-in attempts perdidos | Aceitar perda (raramente útil retrospectivamente) |
| Sessões ativas | Todos serão deslogados | Comunicar com antecedência |
| Vault secrets do Supabase | Não exportados | Reaplicar manualmente |
| Configurações do dashboard Supabase | Não exportadas | Reconfigurar (rate limits, email templates) |

---

## Arquivos gerados pelas ferramentas atuais

| Arquivo | Gerado por | Uso |
|---|---|---|
| `backup-*.sql` | `backup-database?format=sql` | Restore com `psql` |
| `backup-*.json` | `backup-database?format=json` | Auditoria/diff/programático |
| `storage-manifest-*.json` | `backup-storage` | Lista de arquivos + signed URLs (24h) |
