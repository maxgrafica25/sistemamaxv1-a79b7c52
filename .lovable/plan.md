
A proposta é sólida e resolve definitivamente o problema do Imprima Rápido / Atual Card. Análise rápida e plano de execução.

## Avaliação técnica da proposta

**Pontos fortes:**
- Playwright headful real em VPS é a única forma confiável de scrapear PWAs como Imprima Rápido. Já validei que Firecrawl não consegue.
- `waitForFunction(() => document.body.innerText.includes('R$'))` é o detector certo: espera a hidratação real, não um timer fixo.
- Separação Worker (scraping) ↔ Edge Function (orquestração) ↔ DB ↔ UI é a arquitetura correta.
- Auth por `WORKER_SECRET` no header é simples e suficiente.

**Ajustes que recomendo fazer durante a execução:**

1. **Não criar tabela nova `supplier_price_tiers`.** Já existe `sites_monitorado` + `site_precos_tiers` em uso pelo módulo Monitoramento atual, com triggers de alerta de queda de preço, histórico, notificações no sino. Criar uma tabela paralela fragmenta os dados e quebra os alertas. Vou **reaproveitar a estrutura existente** e só adicionar colunas que faltam (`status`, `error_message`, `last_scrape_at`).

2. **Não criar página nova `/monitoramento-precos`.** Já existe `/monitoramento` completa com listagem, drawer, alertas, comparativo, oportunidades. Vou **integrar o novo worker** no fluxo existente do `NovoSiteDialog` e do botão "Sincronizar" do Monitoramento, como mais uma fonte além do Firecrawl.

3. **Roteamento Worker vs Firecrawl por domínio:**
   - `imprimarapido.com.br`, `atualcard.com.br` → Worker Railway (Playwright real)
   - Demais domínios → Firecrawl (mais barato, já funciona)
   - Fallback: se Worker offline, tenta Firecrawl mesmo assim e mostra status.

4. **Regex mais robusto.** A regex sugerida casa "1.000 ... R$ 251,00" mas pode pegar lixo. Vou validar:
   - quantidade entre 50 e 100.000
   - preço entre R$ 1 e R$ 100.000
   - dedupe por quantidade (manter menor preço)
   - ordenar crescente

5. **Health check + status do worker na UI.** Reusar o badge "Worker online/offline" que já existe em `Monitoramento.tsx` (`workerOnline`).

6. **Variáveis de ambiente:** `SCRAPER_WORKER_URL` e `WORKER_SECRET` vão como secrets do Supabase (runtime). Usuário precisa configurar depois do deploy do Railway.

## Plano de execução

### Etapa 1 — Worker Railway (`scraper-worker/`)
- `package.json`, `index.js` (Express + Playwright + regex), `Dockerfile`, `README.md` com instruções de deploy no Railway.
- Rotas: `GET /health`, `POST /scrape` (auth bearer).
- Extração: aguarda `R$` no DOM (timeout 25s), pega HTML renderizado, aplica regex, normaliza, dedup, ordena, retorna `{ tiers, scraped_at }`.

### Etapa 2 — Migration mínima
- Adicionar a `sites_monitorado`: `scrape_status text default 'pending'`, `scrape_error text`, `scrape_source text` (firecrawl|worker).
- Sem nova tabela. Sem quebrar dados existentes.

### Etapa 3 — Edge Function `scrape-via-worker`
- Nova função que recebe `{ site_id }`, busca a URL no `sites_monitorado`, chama Worker Railway com bearer, faz upsert dos tiers em `site_precos_tiers`, atualiza `scrape_status`/`scrape_error`/`atualizado_em`.
- Reaproveita a lógica de upsert que já existe em `sync-prices-webhook`.

### Etapa 4 — Roteamento na função `detect-price-tiers`
- Adicionar função `pickBackend(url)` que retorna `"worker"` para Imprima Rápido / Atual Card e `"firecrawl"` para o resto.
- Quando backend = worker: chamar `scrape-via-worker` em vez de Firecrawl.
- Mensagens de erro claras se `SCRAPER_WORKER_URL` não estiver setado.

### Etapa 5 — Pequenos ajustes na UI
- `NovoSiteDialog.tsx`: nada a mudar — continua chamando `detect-price-tiers`, agora ele resolve o backend automaticamente.
- `Monitoramento.tsx`: adicionar coluna/badge "Fonte" (Firecrawl / Worker) e exibir `scrape_error` quando houver.

### Etapa 6 — Secrets + README
- Adicionar `SCRAPER_WORKER_URL` e `WORKER_SECRET` como secrets no Supabase via tool.
- README na pasta `scraper-worker/` com passo a passo Railway: criar projeto, conectar repo, definir env vars, deploy via Dockerfile.

## Arquivos criados/alterados

Novos:
- `scraper-worker/package.json`
- `scraper-worker/index.js`
- `scraper-worker/Dockerfile`
- `scraper-worker/README.md`
- `supabase/functions/scrape-via-worker/index.ts`

Alterados:
- `supabase/functions/detect-price-tiers/index.ts` (roteamento por domínio)
- `src/pages/Monitoramento.tsx` (badge de fonte + erro)
- 1 migration adicionando 3 colunas em `sites_monitorado`

Sem mudança destrutiva no banco, sem perda de dados, sem nova rota no app.

## Resultado esperado

- Imprima Rápido e Atual Card detectados automaticamente pelo Worker em ~10–15s, sem intervenção manual, sem créditos Firecrawl gastos.
- Demais sites continuam pelo Firecrawl exatamente como hoje.
- "Em massa" funciona para todos os domínios.
- Custo Railway: ~US$ 5/mês no plano Hobby, escala fácil.
