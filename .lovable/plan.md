## Diagnóstico

A tabela "Preço Impressão" exibe valores arredondados pra R$ 0,10 via `calcSellingPrice` (`Math.round((baseCost/divisor) × 10) / 10`). Para Sulfite 75g A4 F/V (Xerox C70), na faixa de 700 cópias, o `baseCost / divisor` real dá ~R$ 5,1351/folha, e a tabela mostra **R$ 5,00** (arredondado).

Na correção anterior eu removi o arredondamento no motor de apostila (`recalculateForQuantity` e `breakdownForQuantity`), então o sistema usa R$ 5,1351 × 70 = **R$ 359,46** em vez de R$ 5,00 × 70 = **R$ 350,00**.

## Correção

Re-aplicar o **mesmo arredondamento** que a tabela usa (`Math.round(... × 10) / 10`), pra apostila ficar idêntica à "Preço Impressão".

### `src/lib/quotes-v2/pricing.ts`

Em `recalculateForQuantity` (bloco `isDirectSumItem`) — substituir a divisão crua por `calcSellingPrice(baseCostPerSheet, printTier)` (que já arredonda igual à tabela):

```ts
const baseCostPerSheet = (m.paperCost ?? 0) + (m.printingCostUnit ?? 0);
const printTier = m.printerCategoryId
  ? findTier(snap, m.printerCategoryId, itemQty, m.markupGroupId)
  : null;
const printingSellingUnit = printTier
  ? calcSellingPrice(baseCostPerSheet, printTier)
  : (baseCostPerSheet || m.unitPrice || 0);
```

Mesma troca em `breakdownForQuantity` para o `printingUnit`.

### `src/components/orcamentos-v2/NewQuoteFormV2.tsx`

Em `pickPaperForPrintingItem`: o `apostilaUnit` que adicionei sem arredondamento volta a ser igual ao `sellingPrice` (que já é `calcSellingPrice(baseCost, tier)`). Simplifica:

```ts
const sellingPrice = tier ? calcSellingPrice(baseCost, tier) : baseCost;
const unitPrice = sellingPrice; // mesmo cálculo p/ apostila e tier clássico
```

## Validação

10 apostilas × 70 folhas F/V Sulfite 75g →
- Impressão por folha: **R$ 5,00** (= tabela)
- Impressão por apostila: **R$ 350,00**
- Com Montagem ~R$ 2,55 e custos de venda dos filhos → "Preço por apostila" cai pra ~R$ 361,67 e Total ~R$ 3.616,70 (em vez de R$ 3.710,48).

Sem mudanças em DB, RLS, tabela "Preço Impressão", divisores dos filhos, ou itens tier clássico.
