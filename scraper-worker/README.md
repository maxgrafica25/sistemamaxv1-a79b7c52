# Scraper Worker (Playwright unificado)

Worker que usa Chromium real (Playwright) para extrair tabelas de quantidade × preço de qualquer página, com 3 estratégias em cascata.

## Estratégias (em ordem)

1. **`api`** — JSON capturado via `page.on('response')` filtrando `xhr|fetch` com `application/json`. Busca recursiva por chaves de quantidade/preço.
2. **`html`** — `page.content()` parseado com Cheerio. Primeiro tenta `<table>`, depois `ul li` + `[class*=preco|tier]`.
3. **`html-regex`** — fallback regex `\d{2,6}` próximo de `R\$\s*[\d.,]+`. Sempre logado como warning.

Quando `unit_price` não vem explícito e é derivado de `total/qty`, o resultado vem com `unit_price_calculated: true` + warning no console.

## Modos

### Servidor HTTP (default)
- `GET /health` → `{ status: "ok", uptime }` — público.
- `POST /scrape` → `{ results: [...] }` — Bearer auth obrigatório.

```bash
node index.js
```

### CLI standalone
Lê `urls.json` e grava `/app/results.json`.

```bash
node cli.js
```

## Shape de resposta

```json
{
  "results": [
    {
      "source_url": "...",
      "scraped_at": "2026-04-20T13:36:00Z",
      "strategy": "api | html | html-regex",
      "prices": [
        {
          "quantity": 1000,
          "unit_price": 0.10,
          "unit_price_calculated": false,
          "total_price": 96.99
        }
      ],
      "error": null
    }
  ]
}
```

## Variáveis de ambiente

| Nome            | Obrigatório | Descrição                                |
|-----------------|-------------|------------------------------------------|
| `WORKER_SECRET` | sim         | Bearer token aceito em `POST /scrape`.   |
| `PORT`          | não (3000)  | Porta HTTP do servidor Express.          |

## Deploy no Railway

1. Após qualquer mudança nessas pastas, **redeploye o serviço no Railway** para puxar `cheerio`, `axios` e o novo `index.js`.
2. `SCRAPER_WORKER_URL` no Supabase **continua igual** — é o mesmo domínio público do Railway.
3. Health check: `curl https://SUA-URL.up.railway.app/health` → `{"status":"ok",...}`.

## Teste local

```bash
cd scraper-worker
npm install
npx playwright install chromium --with-deps
WORKER_SECRET=dev node cli.js
# ou modo servidor:
WORKER_SECRET=dev node index.js
curl -X POST http://localhost:3000/scrape \
  -H "Authorization: Bearer dev" \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://www.ans.com.br/panfleto-90gr-4x0-10x14cm/"]}'
```
