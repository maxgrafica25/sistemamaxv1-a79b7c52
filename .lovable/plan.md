
## Resumo

Aplicar a nova regra de "soma direta" **apenas para Apostilas** (detectadas por `productKind === "apostila"` ou `bookletUnits != null`). Demais produtos continuam usando `findTier` + `calcSellingPrice` + DRE com perda/margem global.

## Detecção do modo

Função utilitária em `pricing.ts`:

```ts
const isDirectSumItem = (m: PricingMaterial): boolean =>
  m.productKind === "apostila" || (m.bookletUnits ?? 0) > 0;
```

Cada item de impressão pai (root) é classificado individualmente. Um orçamento pode ter itens dos dois tipos no mesmo cálculo.

## Fórmulas

### Itens "direct sum" (Apostila)
```text
Subtotal_un = printingCostUnit + Σ(custos filhos diluídos por qty)
SalesCost%  = invoicePct + collectionPct
PreçoVenda_un = Subtotal_un / (1 − SalesCost%/100)
LineTotal     = PreçoVenda_un × qty
```
Sem tier, sem perda, sem margem.

### Itens "tier" (clássico — cartão, flyer, etc)
Mantém `findTier` + `calcSellingPrice` exatamente como hoje (incluindo diluição de filhos no `baseCostEfetivo`).

### Avulsos (mão de obra/material/terceirizado sem `parentItemId`)
Continuam no divisor global clássico (`invoicePct + wastePct + collectionPct + profitMarginPct`). Esse bloco existe independentemente de ter ou não apostila.

## Arquivos a editar

### 1. `src/lib/quotes-v2/pricing.ts`

- Adicionar helper `isDirectSumItem(m)`.
- `recalculateForQuantity`: dentro do loop de pais, ramificar:
  - Se `isDirectSumItem(parent)` → calcula `subtotalUn` (soma direta) e aplica divisor `1 − (invoice+collection)/100`. Soma resultado a `printingTotal`.
  - Senão → caminho atual (tier).
- Manter avulsos + divisor global como hoje.
- `breakdownForQuantity`: novos campos por item:
  - `mode: "direct_sum" | "tier"`.
  - Para `direct_sum`: `printingPerUnit`, `coversPerUnit`, `finishingPerUnit`, `laborPerUnit`, `subtotalPerUnit`, `salesCostPerUnit`, `salesCostPct`, `sellingPricePerUnit`, `lineTotal`.
  - Para `tier`: campos atuais (`tierLabel`, `tier*Pct`, `baseCostUnit`, `sellingPriceUnit`, etc) — sem mudança.
- `PricingBreakdown` global ganha `hasDirectSumItems: boolean` e `hasTierItems: boolean` para a sidebar decidir o que mostrar.

**Classificação dos filhos (apenas para o resumo visual de apostilas):**
- `productKind` ou `description` contendo "capa"/"contracapa" → bucket **Capas**.
- `catalogSource === "finishing"` ou contendo "mola"/"furação"/"wire-o"/"espiral" → bucket **Acabamento**.
- Mão de obra filha → bucket **Montagem / Mão de obra**.
- Resto → bucket **Acabamento** (fallback).

### 2. `src/components/orcamentos-v2/PriceBreakdown.tsx`

- `PriceBreakdownItemPanel`: switch por `item.mode`.
  - `direct_sum` → layout novo "Resumo por unidade":
    ```
    Impressão (X folhas) ...... R$ ..
    Capas ..................... R$ ..
    Acabamento (Mola+Furação) . R$ ..
    Montagem / Mão de obra .... R$ ..
    Custos de venda (Imp+Cartão) R$ ..
    ─────────────
    Por unidade ............... R$ ..
    Total (qty unidades) ...... R$ ..
    ```
  - `tier` → layout atual (papel + impressão + tier + divisor) intacto.
- `PriceBreakdownGlobal`:
  - Renderiza um bloco por item (compartilhando o switch de modo).
  - Quando há mistura: cabeçalhos visuais distintos — apostilas com badge "Soma direta" e demais com badge "Markup tier" — para deixar claro o método.

### 3. `src/components/orcamentos-v2/StickyFinancialSidebar.tsx`

- Mantém os dois accordions: "Detalhamento de custos e lucro" (DRE) e "Composição do preço".
- O DRE é ocultado apenas se `composition.hasTierItems === false && composition.hasDirectSumItems === true` (orçamento 100% apostilas). Caso contrário (misto ou só tier), DRE continua visível.

### 4. `src/components/orcamentos-v2/NewQuoteFormV2.tsx`

- Sem mudança estrutural — o `useMemo` de `composition` já chama `breakdownForQuantity`. Apenas garantir que `productKind`/`bookletUnits` estão sendo populados no snapshot ao adicionar item de apostila (verificar `handleAddItem`/`handleSwapItem`).

### 5. Testes

- Criar `src/test/pricing-apostila.test.ts`: 1 apostila 100 fls Sulfite 75g 4x4, `printingCostUnit = 5,00`, qty 100 → subtotal 500; com 10% imp + 5% cartão → 500 / 0,85 = R$ 588,24.
- Manter testes existentes do tier (não devem regredir).

## Fora de escopo

- Não criar coluna nova no banco — a detecção usa `productKind`/`bookletUnits` que já existem em `PricingMaterial`.
- Não alterar catálogo, `markup_tiers`, `global_settings`.
- Não alterar `cv-pricing/engine.ts`.

## Risco / pontos de atenção

- `options.ts` (anchoring/variações de tiragem) chama `recalculateForQuantity` repetidamente — a ramificação por item garante que apostilas continuem certas em qualquer qty, sem mexer no engine de opções.
- Itens "direct sum" ignoram `markupGroupId`/`printerCategoryId` no cálculo, mas os campos continuam preenchidos para compatibilidade com persistência e relatórios.
