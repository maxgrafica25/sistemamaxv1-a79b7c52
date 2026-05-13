## Problema

Para apostilas (modo `direct_sum` em `src/lib/quotes-v2/pricing.ts`), o motor usa como preço de venda da impressão **apenas o `printingCostUnit`**, que é:

- somente o **custo** da impressão (toner/clique × multiplicadores de F/V e A3),
- **sem o papel**,
- **sem a margem do tier** da tabela "Preço Impressão" para a quantidade.

Resultado: o valor cobrado por folha não bate com o que aparece na tabela "Preço Impressão" (que é o preço final de venda, com tier embutido).

**Exemplo do usuário**: 10 apostilas × 70 folhas F/V sulfite 75g = 700 folhas. Na faixa de 700 cópias, a tabela mostra **R$ 5,00/folha** → orçamento deveria mostrar R$ 3.500,00 de impressão.

## Decisão

Para itens `direct_sum` (apostila), o preço de venda da impressão por folha deve ser o **mesmo valor da tabela "Preço Impressão"** para a quantidade de folhas do orçamento — `calcSellingPrice(paperCost + printingCostUnit, tier)` usando o tier que casa com `m.quantity` (folhas).

Regra confirmada antes: *"Sobre o valor da tabela de impressões não precisa colocar nenhum percentual a mais, pois já está com tudo embutido"*. Filhos (capa, mola, furo, montagem) continuam com os dois divisores atuais.

**Sem arredondamento extra**: a tabela "Preço Impressão" já vem arredondada; o motor de apostila deve usar o valor calculado direto, sem aplicar `Math.ceil(... × 10) / 10` adicional.

## Mudanças

### 1. `src/lib/quotes-v2/pricing.ts`

**`recalculateForQuantity`** (bloco `isDirectSumItem`, ~linha 234–244):

Substituir:
```ts
const printingSellingUnit = m.printingCostUnit ?? m.unitPrice ?? m.baseCost ?? 0;
```

por: calcular o tier para `itemQty` (folhas) via `findTier(snap, m.printerCategoryId!, itemQty, m.markupGroupId)` e então:

```ts
const baseCostPerSheet = (m.paperCost ?? 0) + (m.printingCostUnit ?? 0);
const soma = tier ? (tier.fixed_cost_pct + tier.variable_cost_pct + tier.margin_pct) / 100 : 0;
const divisor = 1 - soma;
const printingSellingUnit = tier && divisor > 0
  ? baseCostPerSheet / divisor   // sem arredondar — tabela já é arredondada
  : baseCostPerSheet;
```

(Não usar `calcSellingPrice` direto porque ele aplica `Math.round(... × 10) / 10`. Inline a fórmula sem o arredondamento.)

**`breakdownForQuantity`** (bloco `isDirectSumItem`, ~linha 480–495):

Substituir `printingUnit` pela mesma fórmula, para o tooltip "Composição do preço" mostrar o valor correto.

### 2. `src/components/orcamentos-v2/NewQuoteFormV2.tsx`

Em `pickPaperForPrintingItem` (~linha 682) o `unitPrice` da apostila hoje é `printCost`. Atualizar para refletir o novo selling unit (paper + print, com tier de `m.quantity`, **sem arredondar**) — mantém tabela e sidebar consistentes ao trocar papel. Mesma lógica em `addPrintingItem` (~linha 609) para o caso raro de criar item já como apostila.

### 3. Sem mudanças

- Banco, RLS, `supabase/`.
- Tabela "Preço Impressão" (continua sendo a fonte da verdade — e quem detém o arredondamento).
- Itens **não-apostila** (cartão, flyer): `calcSellingPrice` segue com arredondamento como hoje.
- Cálculo dos filhos: mantém os dois divisores `supplyDivisor`/`laborDivisor`.
- Multiplicadores A3/F/V continuam aplicados no `printCost` antes do tier.

## Validação

1. **Caso do usuário**: 10 apostilas × 70 folhas F/V, sulfite 75g, sem capa/mola/labor → printing total = **R$ 3.500,00** exato.
2. Apostila com capa (R$ 2,00 / margem 30%), mola (R$ 1,00 / margem 20%), furo 5min, montagem 4min, hourly R$ 60, margem global 25%: printing reflete tabela; filhos via divisores atuais.
3. Item tier clássico (cartão 1.000 un): valor não muda.

## Notas técnicas

- `findTier` já existe em `pricing.ts`; reaproveitado no caminho `direct_sum`.
- Se `printerCategoryId` ou tier ausentes (item legacy), fallback `baseCostPerSheet` — defensivo.
- `m.quantity` no pai apostila já é `folhas` (calculado em `PrintingItemEditor` como `pieces / perSheetForSync`), eixo correto da tabela "Preço Impressão".
