# Runbook — Criação do ambiente de staging (Fase 1)

> Objetivo: criar um projeto Supabase **separado** da produção, restaurar um dump recente e deixar o ambiente pronto para aplicar as migrations da Fase 1.
>
> **Tempo estimado:** 30–60 min (depende do tamanho do dump).
> **Pré-requisitos:** acesso ao painel Supabase da prod, `psql` e `pg_dump` instalados localmente (`brew install libpq` no Mac, `sudo apt install postgresql-client` no Linux).
>
> **REGRA DE OURO:** o `project ref` da prod é `nxkmxslugblhsyohrrvm`. Se em qualquer momento você ver esse ref num comando de staging, **PARE**.

---

## Passo 1 — Criar o projeto Supabase de staging

1. Acesse https://supabase.com/dashboard
2. **New project** →
   - Organization: a mesma da prod (ou pessoal)
   - Name: `orcagrafica-staging`
   - Database Password: gere uma forte (`openssl rand -base64 24`) e **guarde no seu gerenciador de senhas**
   - Region: **mesma região da prod** (importante para latência de testes)
   - Plan: Free (ou Pro se o dump for grande)
3. Aguarde provisionamento (~2 min).
4. Anote o `project ref` que aparece na URL: `https://supabase.com/dashboard/project/<REF>` — esse é o `STAGING_REF`.

**Sanity check:**
```bash
test "$STAGING_REF" != "nxkmxslugblhsyohrrvm" && echo "OK: ref diferente da prod"
```

---

## Passo 2 — Coletar credenciais do staging

No painel do staging:

| Onde | O quê | Variável |
|---|---|---|
| Settings → API → Project URL | `https://<REF>.supabase.co` | `STAGING_SUPABASE_URL` |
| Settings → API → Project API keys → `anon` `public` | JWT longo | `STAGING_SUPABASE_ANON_KEY` |
| Settings → API → Project API keys → `service_role` | JWT longo (segredo!) | `STAGING_SUPABASE_SERVICE_ROLE_KEY` |
| Settings → Database → Connection string → URI (modo "Session") | `postgresql://postgres.<REF>:<PASSWORD>@aws-0-...pooler.supabase.com:5432/postgres` | `STAGING_SUPABASE_DB_URL` |

> Para o `DB_URL`, use a connection string **direta** (não a do PgBouncer) ao restaurar o dump — porta `5432`, modo "Session".

Exporte localmente para usar nos próximos passos:

```bash
export STAGING_REF="<ref-do-staging>"
export STAGING_SUPABASE_URL="https://${STAGING_REF}.supabase.co"
export STAGING_SUPABASE_DB_URL="postgresql://postgres.${STAGING_REF}:<PASSWORD>@..."
export STAGING_SUPABASE_SERVICE_ROLE_KEY="<service-role>"
export STAGING_SUPABASE_ANON_KEY="<anon>"
```

---

## Passo 3 — Baixar dump da produção

**Opção A (recomendada): backup do painel Supabase**

1. No projeto de **PROD**: Database → Backups → último snapshot → **Download**
2. Você recebe um `.sql` (ou `.tar.gz`).
3. Se vier comprimido: `gunzip prod-backup.sql.gz` → `prod-backup.sql`

**Opção B: `pg_dump` ao vivo (só se Backups não estiver disponível)**

```bash
# Pegue a connection string da prod em Settings → Database → Connection string
export PROD_DB_URL="postgresql://postgres.nxkmxslugblhsyohrrvm:<PROD_PASS>@..."

pg_dump "$PROD_DB_URL" \
  --no-owner --no-privileges --no-comments \
  --schema=public --schema=storage \
  --exclude-table-data='auth.*' \
  -f /tmp/prod-backup.sql
```

> **Não exporte `auth.users` da prod para staging.** Vamos criar usuários de teste limpos no Passo 5.

**Tamanho esperado:** o dump deve ter algumas dezenas de MB. Se tiver >1GB, considere usar a Opção B com filtros adicionais.

---

## Passo 4 — Restaurar dump no staging

```bash
# DOUBLE-CHECK do destino
echo "$STAGING_SUPABASE_DB_URL" | grep -q "nxkmxslugblhsyohrrvm" \
  && { echo "❌ ABORTADO: URL aponta para PROD"; exit 1; } \
  || echo "✅ destino é staging"

# Restore
psql "$STAGING_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f /tmp/prod-backup.sql 2>&1 | tee /tmp/restore.log
```

Erros esperados (podem ser ignorados):
- `role "supabase_admin" already exists`
- `extension "pgcrypto" already exists`
- `schema "auth" already exists`

Erros que **devem** parar você:
- `permission denied for schema X` → confira que está usando `postgres` user (DB_URL completa)
- `relation "..." already exists` em massa → o staging não está limpo; vá em Database → Tables e dê drop schema (ou recrie o projeto)

---

## Passo 5 — Validar restore

```bash
psql "$STAGING_SUPABASE_DB_URL" <<'SQL'
SELECT 'profiles' AS tabela, COUNT(*) FROM public.profiles
UNION ALL SELECT 'quotes', COUNT(*) FROM public.quotes
UNION ALL SELECT 'accounts_receivable', COUNT(*) FROM public.accounts_receivable
UNION ALL SELECT 'sales_orders', COUNT(*) FROM public.sales_orders
UNION ALL SELECT 'audit_logs', COUNT(*) FROM public.audit_logs;
SQL
```

Compare com a prod (mesma query no SQL Editor do painel da prod). Os números devem bater (±algumas linhas se houve atividade durante o dump).

---

## Passo 6 — Criar os 3 usuários de teste

Use o script automatizado:

```bash
# já com as variáveis exportadas no Passo 2
bun run seed:staging
```

O script vai:
- Criar `admin@staging.local`, `financeiro@staging.local`, `colab@staging.local`
- Imprimir as senhas geradas no stdout
- Garantir que `admin@staging.local` é o **único admin ativo** (necessário para o teste `last_admin_lockout`)
- Ser idempotente: rodar de novo apenas reseta as senhas

**Output esperado:**
```
✅ admin@staging.local      | senha: <uuid>
✅ financeiro@staging.local | senha: <uuid>
✅ colab@staging.local      | senha: <uuid>
✅ admins ativos no staging: 1 (admin@staging.local)
```

**Copie as senhas para um lugar seguro.** Você vai precisar delas no próximo passo.

---

## Passo 7 — Volte para o chat com o Lovable

Cole esta mensagem no chat:

```
Staging pronto. Ref: <STAGING_REF>
Confirmo que ref ≠ nxkmxslugblhsyohrrvm.
Restore validado. Seed executado, 3 usuários criados.
Pronto para você pedir os secrets.
```

O Lovable vai chamar `add_secret` com os 10 nomes do plano. Você cola URL/keys/emails/senhas no formulário seguro — **nunca no chat aberto**.

---

## Troubleshooting

**"could not connect to server: SSL required"** — adicione `?sslmode=require` no fim do `STAGING_SUPABASE_DB_URL`.

**Restore demorou >30min e travou** — o dump provavelmente é grande demais para a free tier. Faça upgrade do staging para Pro temporariamente, ou filtre tabelas pesadas no `pg_dump` (ex.: `--exclude-table-data=public.audit_logs`).

**Seed falhou com "User already registered"** — tudo bem, o script é idempotente; ele vai detectar e resetar as senhas. Rode de novo.

**Não tenho `psql` instalado** — use o SQL Editor do painel Supabase para colar o dump em pedaços (não ideal mas funciona).
