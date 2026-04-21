

# Escopar estratégia C ao `div.js-quantity-container`

A estratégia C atual itera todos `li.desc--check` do documento, capturando lixo de outras seções (qty 1, 10, 20, 21). Restringir ao `div.js-quantity-container`.

## Mudança em `supabase/functions/scrape-prices/index.ts`

Substituir o bloco da estratégia C dentro de `IMPRIMARAPIDO_FN_SOURCE`:

```js
// C) Imprima Rápido: escopar ao div.js-quantity-container
const qtyContainer = document.querySelector('div.js-quantity-container');
if (qtyContainer) {
  qtyContainer.querySelectorAll('li.desc--check').forEach((li) => {
    const qtyEl = li.querySelector('span.radio_content, .radio_content');
    const priceEl = li.querySelector('span.js-qtd-radio, .js-qtd-radio');
    if (!qtyEl || !priceEl) return;
    const qty = parseQtyBR(qtyEl.textContent || '');
    const price = parsePriceBR(priceEl.textContent || '');
    if (qty && price) tiers.push({ quantity: qty, total_price: price });
  });
}
```

## Validação

1. POST `/scrape-prices` com a URL do folder A6.
2. Esperar tiers só em milhares (1000, 2500, 5000…) — sem qty 1/10/20/21.
3. 1 URL Atual Card → manter `function-atualcard` intacto.

## Risco

- 100% isolado a `IMPRIMARAPIDO_FN_SOURCE` estratégia C.
- A, B, D intactas. Outros scrapers intactos.
- Sem migration, sem schema.

## Fora de escopo

- Cleanup do `debugHtml` fica para depois da validação.

