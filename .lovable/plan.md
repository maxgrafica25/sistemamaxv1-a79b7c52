

# Corrigir estratégia C — ler qty do `span.radio_content`, ignorar `input.value`

O `value` do `input[name="quantidade"]` é ID interno (103, 105, 106), não quantidade. A qty real está em `span.radio_content.fz-sm` dentro do `<label>` do mesmo `li.desc--check`. O preço continua em `span.js-qtd-radio` irmão do label.

## Mudança em `supabase/functions/scrape-prices/index.ts`

Substituir a estratégia C dentro de `IMPRIMARAPIDO_FN_SOURCE`:

```js
// C) Imprima Rápido: li.desc--check com span.radio_content (qty) + span.js-qtd-radio (preço)
document.querySelectorAll("li.desc--check").forEach((li) => {
  const qtyEl = li.querySelector("span.radio_content, .radio_content");
  const priceEl = li.querySelector("span.js-qtd-radio, .js-qtd-radio");
  if (!qtyEl || !priceEl) return;
  const qty = parseQtyBR(qtyEl.textContent || "");
  const price = parsePriceBR(priceEl.textContent || "");
  if (qty && price) tiers.push({ quantity: qty, total_price: price });
});
```

Mudanças vs versão anterior:
- Itera direto em `li.desc--check` (não no `input`).
- Qty vem de `span.radio_content` (ignora completamente `input.value`).
- Preço vem de `span.js-qtd-radio` (já correto).
- Sem fallback — se faltar qualquer um dos dois spans, pula o item.

## Validação

1. POST `/scrape-prices` com a URL do folder A6.
2. Esperar `prices.length > 0`, `strategy: "function-imprimarapido"`, qty em milhares (1000, 2500, 5000…) — não 103/105/106.
3. 1 URL Atual Card → manter `function-atualcard` (zero regressão).

## Risco

- 100% isolado a `IMPRIMARAPIDO_FN_SOURCE`.
- Estratégias A, B, D **intactas**.
- `debugHtml` instrumentação mantida — se voltar vazio, ainda dá pra inspecionar.
- Sem migration, sem schema.

## Fora de escopo

- Não toco em A/B/D nem no parser genérico nem em outros scrapers.
- `debugHtml` fica no código por enquanto; remoção pode ser feita numa rodada de cleanup depois da validação.

