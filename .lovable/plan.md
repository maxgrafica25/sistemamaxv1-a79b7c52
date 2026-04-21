

# Debug — capturar `outerHTML` e devolver no response HTTP

Adicionar instrumentação em `IMPRIMARAPIDO_FN_SOURCE` + propagar `debugHtml` no body da resposta HTTP (não só no log) pra evitar truncamento silencioso do log do Supabase.

## Mudanças em `supabase/functions/scrape-prices/index.ts`

### 1) `IMPRIMARAPIDO_FN_SOURCE` — capturar `outerHTML` quando vazio

Dentro do `page.evaluate`, após as estratégias A/B/C/D (sem tocar nelas):

```js
let debugHtml = null;
if (tiers.length === 0) {
  const container = document.querySelector("div.js-quantity-container");
  if (container) {
    debugHtml = container.outerHTML.slice(0, 8000);
  } else {
    debugHtml = "NO_CONTAINER | body sample: " + document.body.innerHTML.slice(0, 4000);
  }
}
return { tiers, debugHtml };
```

### 2) Tipo `ScrapeResult` — adicionar campo opcional

```ts
type ScrapeResult = {
  url: string;
  prices: Price[];
  strategy: "...existing..." | "function-imprimarapido";
  error?: string;
  debugHtml?: string | null; // NOVO
};
```

### 3) `scrapeImprimaRapido` — devolver `debugHtml` quando vazio + logar

```ts
const result = await fetchViaBrowserlessFunction<{ tiers: RawTier[]; debugHtml: string | null }>(
  url, token, IMPRIMARAPIDO_FN_SOURCE
);
const prices = finalizeTiers(result.tiers ?? [], url);
if (prices.length === 0) {
  console.log(`[imprimarapido] tiers vazios | url=${url} | debugHtml(len)=${result.debugHtml?.length ?? 0}`);
  return {
    url,
    prices: [],
    strategy: "function-imprimarapido",
    error: "no tiers",
    debugHtml: result.debugHtml ?? null,
  };
}
return { url, prices, strategy: "function-imprimarapido" };
```

### 4) Handler HTTP — preservar `debugHtml` no response

No `Deno.serve`, ao montar o JSON de resposta (modo preview), garantir que o campo `debugHtml` seja repassado quando presente. Como o response já faz `JSON.stringify` do array de `ScrapeResult`, basta o tipo aceitar o campo — sem filtragem extra.

## Validação

1. POST `/scrape-prices` com a URL do folder A6 que falha.
2. Ler `debugHtml` direto no body do response (sem risco de truncamento).
3. Com o HTML em mãos, definir o seletor correto numa próxima iteração.

## Risco

- 100% isolado ao fluxo `imprimarapido.com.br`.
- Estratégias A/B/C/D **não são alteradas**.
- Campo `debugHtml` é opcional — outros scrapers não são afetados.
- Sem migration, sem schema.

## Fora de escopo

- Nenhuma mudança em seletores de extração nesta rodada.
- Próximo passo (após você ler o `debugHtml`) será uma correção cirúrgica de seletor.

