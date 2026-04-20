

# Migração para Browserless.io via Edge Function

Substituir o `scraper-worker` Playwright (Railway) por uma chamada HTTP ao **Browserless.io** direto da edge function `scrape-prices`. Sem servidor externo, sem Docker, sem Railway.

## Como funciona

```text
UI → scrape-prices (Deno) → Browserless /content (HTML renderizado) → Cheerio (parsing) → Supabase
```

A edge function pede pro Browserless renderizar a URL com Chromium remoto e devolver o HTML final. A função então roda Cheerio (estratégias `html` → `html-regex`) e persiste igual hoje.

**Trade-off honesto:** sem Playwright local, perdemos o interceptador `page.on('response')` que dava a estratégia `api` (capturar JSON XHR). Em troca, ganhamos zero infra. Pra recuperar JSON, dá pra usar o endpoint `/function` do Browserless (executar JS remoto), mas começamos só com `/content` + Cheerio — cobre Atual Card, Imprima Rápido, ANS e similares porque o HTML pós-render já contém os preços.

## Mudanças

### 1) Pré-requisito (você faz)

- Criar conta gratuita em https://www.browserless.io (free tier: ~1.000 páginas/mês — suficiente pra começar).
- Copiar a API key.
- Eu peço o secret `BROWSERLESS_API_KEY` via tool de secrets quando começar a implementação.

### 2) Reescrever `supabase/functions/scrape-prices/index.ts`

- Remove qualquer chamada ao worker Railway (`SCRAPER_WORKER_URL`, `WORKER_SECRET`, `checkWorkerHealth`).
- Adiciona `import * as cheerio from "npm:cheerio@1.0.0"`.
- Nova função interna `scrapeViaBrowserless(url)`:
  1. `POST https://production-sfo.browserless.io/content?token=${BROWSERLESS_API_KEY}` com body `{ url, gotoOptions: { waitUntil: "networkidle2", timeout: 25000 } }`.
  2. Recebe HTML renderizado em texto.
  3. Carrega com Cheerio.
  4. Estratégias em ordem: `table > tr > td` → `ul li` + `[class*=preco|tier]` → regex `\d{2,6}` perto de `R\$\s*[\d.,]+`.
  5. Normaliza BR (`1.234,56` → `1234.56`), calcula `unit_price_calculated` quando só tem total.
  6. Retorna no shape exato já existente: `{ source_url, scraped_at, strategy: "html"|"html-regex", prices, error }`.
- Retry 3x com 2s entre tentativas, isolado por URL.
- Health check passa a ser: `GET https://production-sfo.browserless.io/pressure?token=...` com timeout 8s.
- **Modos preview e persistência inalterados** (mesmo body, mesmo shape, mesma escrita em `sites_monitorados` + `site_precos_tiers`).

### 3) Limpeza

- Deletar `scraper-worker/` inteiro (não é mais usado).
- Deletar secrets antigos `SCRAPER_WORKER_URL` e `WORKER_SECRET` (eu faço via tool).
- `Monitoramento.tsx`: badge `workerOnline` continua existindo, mas refletindo o `/pressure` do Browserless. Nenhuma outra mudança na UI.
- `NovoSiteDialog.tsx`: nenhuma mudança — o shape de resposta é idêntico.

### 4) Banco de dados

Nenhuma migration. Tabelas e colunas existentes atendem.

## Arquivos afetados

| Ação | Arquivo |
|------|---------|
| Reescrever | `supabase/functions/scrape-prices/index.ts` |
| Deletar | `scraper-worker/` (pasta inteira) |
| Inalterado | `src/components/monitoramento/NovoSiteDialog.tsx` |
| Inalterado | `src/pages/Monitoramento.tsx` (exceto remoção de referências mortas a Railway) |

## Resultado esperado

- 1 edge function. Zero servidor externo. Zero Railway/Docker.
- Mesmo shape de saída → UI não muda.
- Custa R$ 0 enquanto estiver no free tier (1k páginas/mês ≈ 33 syncs/dia).
- Limitação aceita: estratégia `api` (captura de XHR JSON) sai de cena. Se algum site específico depender disso, depois migramos só ele pro `/function` do Browserless.

## Próximo passo após aprovar

Eu peço o secret `BROWSERLESS_API_KEY` (você cria a conta e cola a key), e em seguida implemento a reescrita completa.

