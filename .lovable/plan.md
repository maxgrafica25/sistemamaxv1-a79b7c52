# Resumo Financeiro só com itens solicitados

## Problema
`summarize()` em `src/components/orcamentos-v3/shared/pricing.ts` soma todos os itens, incluindo as **sugestões de faixas** (tier siblings). No grupo de tiers, apenas o item com `tier_primary: true` representa a quantidade solicitada; os demais são sugestões e não devem afetar Subtotal/Total/Margem.

## Mudança
Em `summarize()`, pular itens que tenham `tier_group_id` definido e `tier_primary !== true`:

```ts
for (const it of items) {
  const tg = (it as { tier_group_id?: string | null }).tier_group_id;
  const isPrimary = (it as { tier_primary?: boolean }).tier_primary === true;
  if (tg && !isPrimary) continue;
  const p = priceOf(it);
  subtotal += p.preco_total;
  cost += p.custo_total;
}
```

## Fora de escopo
- UI do carrinho continua mostrando todas as faixas com economia.
- Snapshot persistido do orçamento não é alterado.
