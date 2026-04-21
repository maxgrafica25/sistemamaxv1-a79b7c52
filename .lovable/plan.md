

# Preparar projeto para deploy em VPS com Supabase self-hosted

Entrega artefatos de infra para subir o stack completo (frontend + Supabase self-hosted) numa VPS, com variáveis centralizadas e documentadas. Não muda código de aplicação — só adiciona arquivos de deploy.

## 1) Centralizar variáveis no frontend

Hoje `src/integrations/supabase/client.ts` lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` do `import.meta.env` — **não muda**, já está correto. O que falta é garantir que o build aceite essas variáveis injetadas em build-time no Docker.

Criar:

- **`.env.example`** na raiz — template versionável com todas as `VITE_*` necessárias (sem valores reais):
  ```
  VITE_SUPABASE_URL=https://api.seudominio.com
  VITE_SUPABASE_PUBLISHABLE_KEY=<anon key do GoTrue self-hosted>
  VITE_SUPABASE_PROJECT_ID=self-hosted
  ```

- **`.dockerignore`** — exclui `node_modules`, `dist`, `.env`, `.git`, `supabase/.branches`, `playwright-report`, etc.

## 2) Dockerfile multi-stage para o frontend

Criar **`Dockerfile`** na raiz, build com Bun (já é o gerenciador do projeto — `bun.lock` presente) + serve estático com Nginx:

```dockerfile
# Stage 1: build
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
RUN bun run build

# Stage 2: serve
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Criar **`docker/nginx.conf`** com fallback SPA (`try_files $uri /index.html`), gzip e cache de assets.

## 3) `docker-compose.yml` para o stack completo

Criar **`docker-compose.yml`** na raiz cobrindo:

- **`db`** — Postgres 15 com `pg_cron` + `pgcrypto` + `uuid-ossp` pré-carregados (`shared_preload_libraries=pg_cron`), volume `pgdata`.
- **`auth`** — `supabase/gotrue` com JWT HS256, rate limit de email aumentado (`GOTRUE_RATE_LIMIT_EMAIL_SENT=300`).
- **`rest`** — `postgrest/postgrest` apontando pro `db`.
- **`realtime`** — `supabase/realtime` com a publication `supabase_realtime` (criada pelo backup SQL).
- **`storage`** — `supabase/storage-api` + **`minio`** (substituto S3 self-hosted) + bucket init para `chat-attachments` e `maintenance-attachments` (públicos).
- **`functions`** — `supabase/edge-runtime` montando `./supabase/functions`.
- **`kong`** — gateway que expõe tudo num único domínio (`api.seudominio.com`) roteando `/auth/v1/*`, `/rest/v1/*`, `/realtime/v1/*`, `/storage/v1/*`, `/functions/v1/*`.
- **`frontend`** — build do Dockerfile acima, exposto na porta 80.
- **`caddy`** — reverse proxy com TLS automático (Let's Encrypt) para `app.seudominio.com` → frontend e `api.seudominio.com` → kong.

Todos os serviços leem secrets de um único **`.env`** na raiz (não comitado). Volumes nomeados para `db`, `minio`, `caddy_data`.

## 4) Documentação de variáveis

Criar **`docs/deployment-vars.md`** — tabela completa agrupada por serviço:

| Variável | Serviço | Obrigatória | Descrição | Como gerar |
|---|---|---|---|---|
| `POSTGRES_PASSWORD` | db | sim | Senha do superuser | `openssl rand -base64 32` |
| `JWT_SECRET` | auth, rest, realtime, storage | sim | Secret HS256 compartilhado entre todos os serviços Supabase | `openssl rand -base64 64` |
| `ANON_KEY` | kong, frontend | sim | JWT assinado com `JWT_SECRET`, role=anon | Usar script `scripts/generate-jwt.ts` (ver item 5) |
| `SERVICE_ROLE_KEY` | edge functions, scripts | sim | JWT assinado com `JWT_SECRET`, role=service_role | idem |
| `SITE_URL` | auth | sim | URL do frontend (`https://app.seudominio.com`) | manual |
| `GOTRUE_SMTP_*` | auth | sim p/ email | Configuração SMTP para reset/confirmação | conta no Resend/SES/etc |
| `GOTRUE_RATE_LIMIT_EMAIL_SENT` | auth | recomendado | Default 30/h é baixo demais para reset em lote | `300` |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | minio | sim | Credenciais admin do MinIO | `openssl rand -base64 24` |
| `STORAGE_S3_ACCESS_KEY` / `STORAGE_S3_SECRET_KEY` | storage | sim | Credenciais S3 (apontam pro MinIO) | criar no MinIO console |
| `BROWSERLESS_API_KEY` | edge functions | sim | Reuso da existente | já configurada |
| `FIRECRAWL_API_KEY` | edge functions | opcional | Reuso da existente | já configurada |
| `LOVABLE_API_KEY` | edge functions | opcional | Reuso da existente | já configurada |
| `VPS_WORKER_TOKEN` | edge functions | opcional | Token para webhook `sync-prices-webhook` se usar worker externo | `openssl rand -hex 32` |
| `CADDY_DOMAIN_APP` / `CADDY_DOMAIN_API` | caddy | sim | Domínios para TLS automático | DNS deve apontar pra VPS |
| `VITE_SUPABASE_URL` | frontend (build) | sim | `https://api.seudominio.com` | manual |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | frontend (build) | sim | Mesmo valor de `ANON_KEY` | copiar |

Cada linha com nota explicando consequência se faltar.

## 5) Helpers de bootstrap

Criar **`scripts/generate-jwt.ts`** (Deno) — gera `ANON_KEY` e `SERVICE_ROLE_KEY` assinados com `JWT_SECRET` (compatível GoTrue self-hosted). Uso:
```bash
JWT_SECRET=... deno run --allow-env scripts/generate-jwt.ts
```
Imprime os 2 JWTs prontos pra colar no `.env`.

Criar **`docker/init-buckets.sh`** — script `mc` (MinIO client) que cria os 2 buckets públicos no primeiro start.

## 6) Atualizar runbook

Editar **`docs/migration-runbook.md`**: adicionar **Fase 0.5 — "Deploy do stack via docker-compose"** referenciando os novos arquivos, antes da Fase 1 manual atual. Manter Fase 1 como alternativa pra quem quer Postgres bare-metal.

## Arquivos afetados

| Ação | Arquivo |
|---|---|
| Criar | `.env.example` |
| Criar | `.dockerignore` |
| Criar | `Dockerfile` |
| Criar | `docker/nginx.conf` |
| Criar | `docker/init-buckets.sh` |
| Criar | `docker-compose.yml` |
| Criar | `docs/deployment-vars.md` |
| Criar | `scripts/generate-jwt.ts` |
| Editar | `docs/migration-runbook.md` (nova Fase 0.5) |

## Validação pós-implementação

1. `docker compose config` — valida sintaxe do compose sem subir nada.
2. `docker build .` localmente (build do frontend isolado) — confirma que Dockerfile compila.
3. `deno check scripts/generate-jwt.ts` — confirma tipos.
4. Listar visualmente que cada variável de `docs/deployment-vars.md` aparece em pelo menos um serviço do `docker-compose.yml`.

## Fora de escopo

- **Não vou subir o stack de fato** — sandbox não tem Docker daemon nem domínio público. Validação é estática (build + config check).
- **Não vou portar edge functions pra Node.js** — uso `supabase/edge-runtime` (Deno nativo) que aceita o código atual sem mudanças.
- **Não vou criar pipeline CI/CD** (GitHub Actions etc) — fora do escopo "preparar para deploy". Pode ser próximo passo.
- **Não vou configurar backup automatizado da VPS** (pg_dump cron, snapshots) — runbook menciona, mas implementação depende do provedor.

