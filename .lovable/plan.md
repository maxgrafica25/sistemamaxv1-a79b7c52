

# Reescrita do módulo de Monitoramento

Tudo que está abaixo é exatamente o escopo aprovado por você na mensagem.

## 1) Remoções

### Edge functions deletadas (via tool de delete)
- `auto-detect-price`
- `detect-price-tiers`
- `parse-price-table`
- `scheduled-sync-firecrawl`
- `trigger-vps-sync`
- `test-css-selector`
- `scrape-via-worker`

Mantida: `sync-prices-webhook`.

### Código removido na UI
- `NovoSiteDialog.tsx`: as 5 abas (Tabela auto / Em massa / URL simples / Excel / Avançado).
- Todo código relacionado a Firecrawl, parse de Excel, seletor CSS e bulk detect.

### Worker antigo
- `scraper-worker/index.js` reescrito do zero.

## 2) Worker Playwright unificado (`scraper-worker/`)

### Arquivos
| Ação | Arquivo |
|------|---------|
| Reescrever | `scraper-worker/index.js` (servidor Express) |
| Criar | `scraper-worker/cli.js` (modo standalone) |
| Criar | `scraper-worker/urls.json` |
| Atualizar | `scraper-worker/package.json` (+ `cheerio`, `axios`) |
| Atualizar | `scraper-worker/README.md` |

### Endpoints
- `GET /health` público.
- `POST /scrape` autenticado por `Authorization: Bearer ${WORKER_SECRET}`. Recebe `{ urls: string[] }`. Devolve `{ results: [...] }`.

### Lógica por URL (idêntica para todas, Playwright único)
1. Lança Chromium headless. Antes de `goto`, registra `page.on('response', ...)` filtrando `xhr|fetch` com `application/json` e empilha cada JSON num buffer.
2. `page.goto(url, { waitUntil: 'networkidle', timeout: 25000 })`.
3. **Estratégia API:** percorre buffer, busca recursiva por chaves `quantidade|qtd|quantity` e `preco|price|total|unit`. Se ≥ 2 pares válidos → `strategy: "api"`, ignora HTML.
4. **Estratégia HTML (Cheerio) em ordem rígida:**
   - Primária: `table > tr > td`
   - Secundária: `ul li` + `[class*=preco]`, `[class*=tier]`
   - Último recurso: regex `\d{2,6}` próximo de `R\$\s*[\d.,]+` em texto livre → `strategy: "html-regex"` + `console.warn` explícito de fallback.
5. **Normalização:** remove `R$`/espaços, BR `1.234,56` → `1234.56`, parse float.
6. **`unit_price_calculated`:** se vier só `total_price`, calcula `total/quantity`, marca `true` e emite warning. Se vier explícito, `false`.
7. **Retry:** 3 tentativas, 2s de delay, try/catch isolado por URL (uma falha não derruba as outras).
8. **Console table:** `URL | tiers | strategy | calculated? | timestamp`.

### Modo CLI
`node cli.js` lê `urls.json`, scrapeia, grava `/app/results.json` e imprime a tabela.

### `urls.json`
```text
[
  "https://www.futuraim.com.br/produto/folheto-em-couche-brilho?id=16301",
  "https://www.atualcard.com.br/flyer/134/8893/flyer-couche-80g-4x0-sem-verniz-14x10-cm-1000-22533",
  "https://www.ans.com.br/panfleto-90gr-4x0-10x14cm/"
]
```

### Shape de resposta exato
```text
{
  "results": [
    {
      "source_url": "...",
      "scraped_at": "ISO",
      "strategy": "api | html | html-regex",
      "prices": [
        { "quantity": 1000, "unit_price": 0.10, "unit_price_calculated": false, "total_price": 96.99 }
      ],
      "error": null
    }
  ]
}
```

## 3) Edge function `scrape-prices`

Arquivo: `supabase/functions/scrape-prices/index.ts`

- CORS completo + handler `OPTIONS`.
- Helpers internos:
  - `normalizeWorkerUrl(raw)`: prefixa `https://` se faltar, remove trailing slash, valida via `new URL()`.
  - `checkWorkerHealth(origin)`: `GET /health` com `AbortController` timeout 8s.
- Sempre executa `checkWorkerHealth` antes de `POST /scrape`. Se falhar, retorna erro claro (sem 500 genérico).

### Modo preview
`POST { urls: string[] }` → chama worker, devolve `{ results }` cru. Não persiste.

### Modo persistência
`POST { site_id: string }`:
1. Busca `sites_monitorados.url_completa` por id.
2. Chama worker com essa URL única.
3. Marca tiers existentes do site como `ativo = false`.
4. Para cada item de `prices[]`: upsert em `site_precos_tiers` por `(site_id, quantidade)` — update se existir, insert se não. Inclui `preco_total`, `preco_unitario`, `ativo = true`, `atualizado_em = now()`.
5. Atualiza `sites_monitorados`:
   - `preco_atual = min(unit_price)`
   - `scrape_status = 'ok' | 'error'`
   - `scrape_error`
   - `scrape_source = 'playwright'`
   - `timestamp_check = now()`

## 4) UI: `NovoSiteDialog.tsx` (reescrita)

Tela única dentro do `Dialog`:
- **Textarea** "Cole 1 ou mais URLs (uma por linha)".
- **ProductPicker** (mantido) para vincular ao catálogo.
- Botão **Testar scraping** → chama `scrape-prices` em modo preview, exibe tabela:

| Qtd | Preço unit. | Preço total | Estratégia | Calc.? |
|-----|-------------|-------------|------------|--------|

- Badge da estratégia: `api` verde, `html` azul, `html-regex` amarelo.
- Ícone de aviso (`AlertTriangle`) quando `unit_price_calculated = true`.
- **Dedupe** consultando `sites_monitorados.url_completa` antes de salvar.
- Botão **Salvar** → para cada URL com `prices.length > 0`:
  - Insert em `sites_monitorados` (vincula produto via ProductPicker).
  - Insert dos tiers em `site_precos_tiers`.
  - Toast com resumo final.

Mantém: `ProductPicker`, `CatalogoProdutosDialog` (intactos).

## 5) `Monitoramento.tsx` (ajustes mínimos)

- Função pura **`syncSite(siteId)`**: encapsula a chamada `supabase.functions.invoke('scrape-prices', { body: { site_id: siteId } })`. Tanto `handleSyncOne` quanto `handleSyncAll` (loop sequencial) chamam ela. Pronto para migrar para cron sem reescrita.
- Badge de fonte nos cards/tabela: passa a mostrar apenas `playwright`.
- Remove qualquer referência visual a Firecrawl/worker antigo.
- `workerOnline`: continua refletindo o health (agora via `scrape-prices`).
- Mantém as 4 views: oportunidades, comparativo, tabela, alertas.

## 6) Banco de dados

- `sites_monitorados`: nenhuma migration. Colunas `scrape_status`, `scrape_error`, `scrape_source` já existem.
- `site_precos_tiers`: já tem coluna `ativo` (`boolean default true`) — confirmado no schema atual. **Sem migration**.

## 7) Secrets

Já configurados: `SCRAPER_WORKER_URL` e `WORKER_SECRET`. Nada a fazer.

## 8) Pré-requisito pós-deploy (responsabilidade do usuário)

Após o deploy, **redeploy manual do `scraper-worker` no Railway** para puxar `cheerio`, `axios` e o novo `index.js`. `SCRAPER_WORKER_URL` continua igual.

## Resumo dos arquivos

| Ação | Arquivo |
|------|---------|
| Reescrever | `scraper-worker/index.js` |
| Reescrever | `src/components/monitoramento/NovoSiteDialog.tsx` |
| Criar | `scraper-worker/cli.js` |
| Criar | `scraper-worker/urls.json` |
| Criar | `supabase/functions/scrape-prices/index.ts` |
| Atualizar | `scraper-worker/package.json` |
| Atualizar | `scraper-worker/README.md` |
| Atualizar | `src/pages/Monitoramento.tsx` |
| Deletar | `supabase/functions/auto-detect-price/` |
| Deletar | `supabase/functions/detect-price-tiers/` |
| Deletar | `supabase/functions/parse-price-table/` |
| Deletar | `supabase/functions/scheduled-sync-firecrawl/` |
| Deletar | `supabase/functions/trigger-vps-sync/` |
| Deletar | `supabase/functions/test-css-selector/` |
| Deletar | `supabase/functions/scrape-via-worker/` |
| Manter | `supabase/functions/sync-prices-webhook/` |

## Resultado esperado

- 1 edge function, 1 worker, 1 dialog, 1 fluxo.
- Mesmo caminho para FuturaIM, Atual Card e ANS.
- Saída sempre no shape com `unit_price_calculated` explícito.
- Zero Firecrawl. Sync isolado em função pura, pronto para cron.

