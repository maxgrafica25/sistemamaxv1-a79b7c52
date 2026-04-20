

# Atual Card: extrair tabela completa de tiers via Browserless `/function`

A página da Atual Card monta a tabela de preços por JavaScript (faixas de 1.000 até 1.000.000). O `/content` só devolve o preço do SKU da URL (via `dataLayer`), por isso só conseguimos 1 tier. A solução é voltar a usar o endpoint `/function` do Browserless, que executa JS dentro da página renderizada e devolve o que extraímos.

## Estratégia

Reescrever `scrapeAtualCard` em `supabase/functions/scrape-prices/index.ts` para:

1. Chamar `POST {BROWSERLESS_BASE}/function?token=...` enviando uma função JS que:
   - Aguarda `networkidle2` (já default do `/function`).
   - Espera explicitamente até a tabela de preços aparecer (poll por até ~15s procurando linhas com qty + R$).
   - Varre o DOM em múltiplos seletores possíveis (a Atual Card tipicamente usa radios/labels do tipo `input[name="quantidade"]`, `label[data-quantidade]`, `tr[data-price]`, `.tabela-precos tr`, `.preco-quantidade li`).
   - Para cada linha, extrai `quantity` (número) e `total_price` ou `unit_price` (string `R$ 1.234,56` → número).
   - Devolve `{ tiers: [{ quantity, total_price?, unit_price? }, ...], debug: {...} }`.

2. Se `/function` retornar vazio:
   - Fallback 1: extrair do `dataLayer` (caminho atual) → garante pelo menos 1 tier (qty da URL).
   - Fallback 2: erro claro `"Tabela de preços não encontrada"`.

3. Passar todos os tiers por `finalizeTiers` (já dedup, valida e calcula unit a partir do total).

4. Limpar a maioria dos logs `[atualcard debug ...]` agora que sabemos como o HTML estático se comporta — mantém só log final resumido (`tiers=N strategy=function-atualcard elapsed_ms=...`) e um log de fallback quando aplicável.

## Implementação técnica

### Nova função auxiliar genérica

```ts
async function fetchViaBrowserlessFunction<T>(
  url: string,
  token: string,
  fnSource: string,
  context: Record<string, unknown> = {}
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const r = await fetch(`${BROWSERLESS_BASE}/function?token=${encodeURIComponent(token)}`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: fnSource,
        context: { url, ...context },
      }),
    });
    clearTimeout(timer);
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`Browserless /function HTTP ${r.status}: ${txt.slice(0, 200)}`);
    }
    const json = await r.json();
    // /function retorna { data, type } — `data` é o que a função `module.exports` devolveu
    return (json?.data ?? json) as T;
  } catch (e) {
    clearTimeout(timer);
    throw new Error(e instanceof Error ? e.message : String(e));
  }
}
```

### Função JS que roda no Browserless (string)

Ela vai navegar para `context.url`, esperar a tabela e extrair tiers. Usa múltiplos seletores como rede de segurança e parser BR de preço dentro do navegador. Resumo do que faz:

- `await page.goto(context.url, { waitUntil: 'networkidle2', timeout: 30000 })`
- `await page.waitForFunction(...)` aguarda DOM com pelo menos 2 linhas com qty + `R$`.
- `page.evaluate(() => { ... })` percorre seletores candidatos:
  - `table tr` (qualquer tabela).
  - `input[type="radio"][name*="quant"]` + label associado / `data-price`.
  - `[data-quantidade][data-price]`, `[data-qtd]`, `.preco-quantidade li`.
  - Para cada elemento, lê texto + atributos (`data-price`, `data-preco`, `data-quantidade`).
- Faz parse BR (`R$ 1.234,56` → 1234.56, `1.000` → 1000) dentro do navegador.
- Retorna `{ tiers: [...], counts: { table: N, radio: N, data: N } }` para diagnóstico.

### Reescrita de `scrapeAtualCard`

```ts
async function scrapeAtualCard(url: string, token: string): Promise<ScrapeResult> {
  const startedAt = Date.now();
  const base = {
    source_url: url,
    scraped_at: new Date().toISOString(),
    strategy: "function-atualcard" as const,
  };

  try {
    const result = await fetchViaBrowserlessFunction<{
      tiers: RawTier[];
      counts?: Record<string, number>;
    }>(url, token, ATUALCARD_FN_SOURCE);

    console.log(`[atualcard /function] tiers=${result.tiers?.length ?? 0} counts=${JSON.stringify(result.counts)}`);

    let prices = finalizeTiers(result.tiers ?? [], url);

    // Fallback: se nada veio, tenta dataLayer estático (1 tier baseado na URL)
    if (prices.length === 0) {
      const fallback = await scrapeAtualCardDataLayerFallback(url, token);
      prices = fallback;
      if (prices.length > 0) {
        console.warn(`[atualcard fallback dataLayer] tiers=${prices.length}`);
      }
    }

    return {
      ...base,
      prices,
      error: prices.length === 0 ? "Tabela de preços não encontrada" : null,
      elapsed_ms: Date.now() - startedAt,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[scrape-atualcard] ${url} | erro: ${msg}`);
    // Tenta fallback mesmo em erro de /function
    try {
      const prices = await scrapeAtualCardDataLayerFallback(url, token);
      if (prices.length > 0) {
        return { ...base, prices, error: null, elapsed_ms: Date.now() - startedAt };
      }
    } catch (_) { /* ignore */ }
    return { ...base, prices: [], error: msg, elapsed_ms: Date.now() - startedAt };
  }
}
```

`scrapeAtualCardDataLayerFallback(url, token)` é a lógica atual (qty da URL + preço do `dataLayer`/`data-price`) extraída para uma função, retornando `Price[]`.

### Limpeza de logs

Remover os logs `[atualcard debug html]`, `[atualcard debug regex]` e `[atualcard debug keyword]`. Manter apenas:
- `[atualcard /function] tiers=N counts=...`
- `[atualcard fallback dataLayer] tiers=N` (quando usado)
- `[scrape-atualcard] url | tiers=N elapsed=Xms`

## O que não muda

- ANS, FuturaIM, Imprima Rápido e qualquer outro fornecedor.
- UI (`NovoSiteDialog` continua mostrando estratégia `function-atualcard` com badge violeta).
- Banco e fluxo de persistência (`site_precos_tiers` aceita N tiers normalmente).
- `corsHeaders`, dispatcher por host e `scrapeMany`.

## Resultado esperado

- Testar a URL do flyer 14×10 cm 1000 retorna ~12 tiers (1.000, 2.500, 5.000, 10.000, 20.000, 30.000, 40.000, 50.000, 100.000, 250.000, 500.000, 1.000.000), cada um com qty + preço total + unitário.
- Logs mostram `[atualcard /function] tiers=12 counts={...}`.
- Se a Atual Card mudar o layout e `/function` falhar, o sistema ainda salva pelo menos 1 tier via fallback do `dataLayer` em vez de zerar.
- Tempo esperado: 8–15s por URL (mais lento que `/content`, esperado por usar JS render).

## Arquivo afetado

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/scrape-prices/index.ts` (adicionar `fetchViaBrowserlessFunction`, `ATUALCARD_FN_SOURCE`, `scrapeAtualCardDataLayerFallback`; reescrever `scrapeAtualCard`; remover logs de debug temporários) |

