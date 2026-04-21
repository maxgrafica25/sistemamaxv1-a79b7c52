# Variáveis de ambiente — deploy em VPS

Referência completa de todas as variáveis usadas no `docker-compose.yml`. Copie `.env.example` para `.env` e preencha com valores reais. Nunca comitar o `.env`.

> **Geração rápida de secrets:**
> - Senhas: `openssl rand -base64 32`
> - JWT secret: `openssl rand -base64 64`
> - JWTs (anon/service): `JWT_SECRET=... deno run --allow-env scripts/generate-jwt.ts`

---

## Postgres

| Variável | Obrigatória | Descrição | Se faltar |
|---|---|---|---|
| `POSTGRES_PASSWORD` | sim | Senha do superuser `postgres` (também usada por roles internos: `authenticator`, `supabase_auth_admin`, `supabase_storage_admin`, `supabase_admin`). Gerar com `openssl rand -base64 32`. | Postgres não sobe. |
| `POSTGRES_DB` | não (default `postgres`) | Nome do banco principal. | Usa `postgres`. |
| `POSTGRES_PORT` | não (default `5432`) | Porta interna. | Usa `5432`. |

---

## JWT (compartilhado entre auth / rest / realtime / storage)

| Variável | Obrigatória | Descrição | Se faltar |
|---|---|---|---|
| `JWT_SECRET` | sim | Segredo HS256 usado por todos os serviços Supabase para validar tokens. **Mesmo valor em todos.** Gerar com `openssl rand -base64 64`. | GoTrue/PostgREST/Realtime/Storage rejeitam todos os tokens. |
| `JWT_EXP` | não (default `3600`) | Tempo de vida do token em segundos. | Usa 1h. |
| `ANON_KEY` | sim | JWT pré-assinado com `role=anon` e validade longa (10 anos). Gerar via `scripts/generate-jwt.ts`. | Frontend não consegue fazer requisições anônimas. |
| `SERVICE_ROLE_KEY` | sim | JWT pré-assinado com `role=service_role`. Usado por edge functions e scripts admin. Gerar via mesmo script. | Edge functions não conseguem bypassar RLS. |

---

## Auth (GoTrue)

| Variável | Obrigatória | Descrição | Se faltar |
|---|---|---|---|
| `SITE_URL` | sim | URL pública do frontend (ex.: `https://app.seudominio.com`). Usado em links de email (reset, confirmação). | Links de email apontam para localhost. |
| `ADDITIONAL_REDIRECT_URLS` | não | URLs extras permitidas em redirects OAuth (separadas por vírgula). | Apenas `SITE_URL` é aceito. |
| `DISABLE_SIGNUP` | não (default `false`) | Bloqueia cadastro público. | Cadastro aberto. |
| `GOTRUE_RATE_LIMIT_EMAIL_SENT` | recomendado | Emails por hora por IP. Default GoTrue (`30`) é muito baixo para reset em lote — usar `300`. | Reset em lote (`scripts/reset-passwords-bulk.ts`) bate em 429. |
| `GOTRUE_SMTP_HOST` | sim p/ email | Servidor SMTP (ex.: `smtp.resend.com`). | Reset/confirmação não enviam email. |
| `GOTRUE_SMTP_PORT` | sim p/ email | Porta SMTP (587 STARTTLS). | idem |
| `GOTRUE_SMTP_USER` | sim p/ email | Usuário SMTP. | idem |
| `GOTRUE_SMTP_PASS` | sim p/ email | Senha/token SMTP. | idem |
| `GOTRUE_SMTP_ADMIN_EMAIL` | sim p/ email | From address dos emails. | idem |
| `GOTRUE_SMTP_SENDER_NAME` | recomendado | Nome do remetente exibido. | Cliente mostra só o email. |

---

## MinIO + Storage API

| Variável | Obrigatória | Descrição | Se faltar |
|---|---|---|---|
| `MINIO_ROOT_USER` | sim | Usuário admin do MinIO (acesso ao console). | MinIO não sobe. |
| `MINIO_ROOT_PASSWORD` | sim | Senha admin. Gerar com `openssl rand -base64 24`. | idem |
| `STORAGE_S3_ACCESS_KEY` | sim | Access key usada pelo Storage API para falar com MinIO. Pode ser o `MINIO_ROOT_USER` ou uma service account criada no console MinIO. | Storage API não consegue ler/escrever arquivos. |
| `STORAGE_S3_SECRET_KEY` | sim | Secret key correspondente. | idem |
| `STORAGE_S3_BUCKET` | não (default `storage`) | Bucket "guarda-chuva" do Storage API. | Usa `storage`. |
| `STORAGE_S3_REGION` | não (default `us-east-1`) | Região S3 (MinIO ignora, mas SDKs exigem). | Usa `us-east-1`. |

---

## Edge Functions (secrets de runtime)

| Variável | Obrigatória | Descrição | Se faltar |
|---|---|---|---|
| `BROWSERLESS_API_KEY` | sim p/ scraping | Token Browserless para `scrape-prices`. Reusar o atual. | Scraping com browser falha. |
| `FIRECRAWL_API_KEY` | opcional | Token Firecrawl (fallback). | Apenas Browserless é usado. |
| `LOVABLE_API_KEY` | opcional | Token do Lovable AI Gateway, se a função usar IA. | Funções de IA falham. |
| `VPS_WORKER_TOKEN` | opcional | Token bearer para webhook `sync-prices-webhook` (worker externo). Gerar com `openssl rand -hex 32`. | Webhook rejeita chamadas não autenticadas. |

---

## Caddy (reverse proxy + TLS)

| Variável | Obrigatória | Descrição | Se faltar |
|---|---|---|---|
| `CADDY_DOMAIN_APP` | sim | Domínio do frontend (ex.: `app.seudominio.com`). DNS A/AAAA deve apontar para o IP da VPS. | Caddy não sabe qual host servir o frontend. |
| `CADDY_DOMAIN_API` | sim | Domínio da API (ex.: `api.seudominio.com`). | Frontend não consegue chamar Supabase. |
| `CADDY_ACME_EMAIL` | sim | Email para registro Let's Encrypt (notificações de expiração). | Caddy usa email vazio (válido mas sem notificações). |

---

## Frontend (build-time, injetado via `--build-arg`)

| Variável | Obrigatória | Descrição | Se faltar |
|---|---|---|---|
| `VITE_SUPABASE_URL` | sim | URL pública da API (`https://${CADDY_DOMAIN_API}`). Lida em build-time pelo Vite. | Build gera bundle apontando para `undefined`. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | sim | **Mesmo valor de `ANON_KEY`.** É embutida no JS do frontend. | Cliente Supabase não autentica. |
| `VITE_SUPABASE_PROJECT_ID` | não (default `self-hosted`) | Identificador opcional usado em logs/auditoria do frontend. | Usa `self-hosted`. |

---

## Checklist mínimo antes de subir

- [ ] `JWT_SECRET` gerado (>=64 chars)
- [ ] `ANON_KEY` e `SERVICE_ROLE_KEY` gerados via `scripts/generate-jwt.ts`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` = `ANON_KEY` (idênticos)
- [ ] `POSTGRES_PASSWORD` gerado (>=32 chars)
- [ ] `MINIO_ROOT_PASSWORD` gerado (>=24 chars)
- [ ] SMTP configurado (sem isso reset de senha não funciona)
- [ ] DNS de `CADDY_DOMAIN_APP` e `CADDY_DOMAIN_API` apontando para o IP da VPS
- [ ] Portas 80 e 443 abertas no firewall

Validar sintaxe do compose sem subir:
```bash
docker compose config > /dev/null && echo OK
```
