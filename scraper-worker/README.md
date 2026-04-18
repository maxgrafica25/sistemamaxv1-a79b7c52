# Scraper Worker (Playwright)

Worker independente que roda Chromium real (headless) para extrair tabelas de preços de sites que o Firecrawl não consegue renderizar (PWAs como Imprima Rápido e Atual Card).

## Rotas

- `GET /health` → `{ status: "ok", uptime }` — health check público.
- `POST /scrape` (Bearer auth) → recebe `{ url }`, devolve `{ tiers: [{ quantidade, preco }], scraped_at, elapsed_ms }`.

Header obrigatório no `/scrape`:

```
Authorization: Bearer <WORKER_SECRET>
```

## Variáveis de ambiente

| Nome            | Obrigatório | Descrição                                |
|-----------------|-------------|------------------------------------------|
| `WORKER_SECRET` | sim         | String secreta usada no Bearer.          |
| `PORT`          | não (3000)  | Porta HTTP.                              |

## Deploy no Railway (passo a passo)

1. Acesse [https://railway.app](https://railway.app) e crie um novo projeto.
2. **New → Deploy from GitHub repo** (ou **Empty Service → Deploy** e suba via CLI).
3. Selecione a pasta `scraper-worker/` como **Root Directory** nas configurações do serviço.
4. O Railway vai detectar o `Dockerfile` automaticamente. Não é preciso buildpack.
5. Em **Variables**, adicione:
   - `WORKER_SECRET` = um valor aleatório longo (ex.: `openssl rand -hex 32`)
   - `PORT` = `3000` (opcional)
6. Em **Settings → Networking**, clique em **Generate Domain** para receber a URL pública (algo como `https://scraper-worker-production.up.railway.app`).
7. Teste o health: `curl https://SUA-URL.up.railway.app/health`.

## Configurar no Supabase

Depois do deploy, configure dois secrets no Supabase (já feito via Lovable):

- `SCRAPER_WORKER_URL` → **URL pública completa** do Railway, **incluindo `https://`** e **sem** `/scrape` no final.
  - ✅ `https://scraper-worker-production.up.railway.app`
  - ❌ `scraper-worker-production.up.railway.app` (faltando `https://`)
  - ❌ `https://scraper-worker-production.up.railway.app/scrape` (não inclua `/scrape`)
- `WORKER_SECRET` → mesmo valor configurado no Railway.

### Como descobrir a URL correta no Railway

1. No projeto Railway, abra o serviço do scraper-worker.
2. Vá em **Settings → Networking → Public Networking**.
3. Se não houver domínio, clique em **Generate Domain**.
4. Copie a URL e adicione `https://` na frente antes de salvar em `SCRAPER_WORKER_URL`.

### Como testar se o worker está no ar

```bash
curl https://SUA-URL.up.railway.app/health
# resposta esperada: {"status":"ok","uptime":123.45}
```

Se `curl` retornar 404, "Application not found" ou timeout: o serviço **não está deployado** nesse domínio. Verifique se você criou um serviço Railway apontando para a pasta `scraper-worker/` (e não um projeto vazio com nome de outro template).

## Custo

Plano Hobby do Railway (~US$ 5/mês) sustenta esse worker tranquilamente para volumes baixos/médios de scraping.

## Teste local

```bash
cd scraper-worker
npm install
npx playwright install chromium --with-deps
WORKER_SECRET=dev npm start
# em outro terminal:
curl -X POST http://localhost:3000/scrape \
  -H "Authorization: Bearer dev" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.imprimarapido.com.br/folder-a5-reduzido-14x20cm/2135/3335/folder-a5-reduzido---14x20cm-couche-80g-4x0-sem-verniz-14x20-cm-1000-31680"}'
```
