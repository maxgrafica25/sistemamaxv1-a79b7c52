## Diagnóstico

Há **duas contas diferentes** rodando para apostilas (direct_sum):

| Onde | Fórmula | Resultado |
|---|---|---|
| Editor "Folhas a imprimir" (linha 795 do `PrintingItemEditor`) e Sidebar "Valor a cobrar" | `m.unitPrice × m.quantity` (preço de venda/folha já com tier de markup × 500 folhas) | **R$ 2.550,00** |
| Cabeçalho roxo do item + "Composição do preço" (`pricing.ts → breakdownForQuantity`, ramo `isDirectSumItem`) | `printingUnit = m.printingCostUnit` (só o **custo** do clique, ~R$ 1,80) / `directSumDivisor` (1 − impostos − cartão) × 500 | **R$ 1.920,32** |

O motor `pricing.ts`, no caminho direct_sum, ignora a marcação de tier que produziu `unitPrice` e usa só `printingCostUnit` (custo). Daí "Impressão (50 folhas) = R$ 90,00" (50 × R$ 1,80) em vez de R$ 255,00 (50 × R$ 5,10), e o item totaliza R$ 1.920 em vez de R$ 2.550.

A sidebar mostra "Impressão R$ 0,00" porque `live.printingTotal` (vindo do mesmo motor) também está sub-calculado e a sidebar exibe outro recorte.

## Correção (somente em `src/lib/quotes-v2/pricing.ts`)

Para itens `isDirectSumItem`, usar `m.unitPrice` (preço de venda por folha — já tem o markup do tier embutido) como parcela de impressão e **não** reaplicar o `directSumDivisor` sobre ela. Continuar aplicando o divisor apenas sobre os filhos (capa/contracapa/acabamentos/mão de obra) para que o preço final de capa cadastrado em `manual_tier` continue exato.

Mudança em `recalculateForQuantity`:

```text
printingSellingUnit = m.unitPrice ?? m.printingCostUnit ?? 0
childSubtotalUn     = (childMatTotal + childLabTotal) / itemQty
childSellingUn      = childSubtotalUn / directSumDivisor
sellingUn           = printingSellingUnit + childSellingUn
printingTotal      += sellingUn * itemQty
```

Espelhar em `breakdownForQuantity`:

- `printingPerUnit`            = `printingSellingUnit` (não mais o custo)
- `printingPerDisplayUnit`     = `printingSellingUnit × pagesPerDisplayUnit`
- `subtotalPerUnit`            = `printingSellingUnit + coversPerUnit + finishingPerUnit + laborPerUnit` (filhos ainda em pré-divisor)
- `sellingPriceUnit`           = `printingSellingUnit + (coversPerUnit + finishingPerUnit + laborPerUnit) / directSumDivisor`
- `salesCostPerUnit`           = `sellingPriceUnit − subtotalPerUnit` (= apenas o markup dos filhos)
- mesma lógica replicada nos campos `*PerDisplayUnit`

Resultado para o caso da imagem (500 folhas × R$ 5,10):
- "Impressão (50 folhas)" passa de R$ 90,00 → **R$ 255,00**
- "Preço por apostila" passa de R$ 192,03 → **R$ 255,00 + acabamentos/divisor**
- Total do item passa de R$ 1.920,32 → **R$ 2.550,00 + acabamentos**, batendo com o "Valor a cobrar".

## Garantias / efeitos colaterais

- Itens **tier clássicos** (panfleto, cartão, etc.): caminho intacto — segue usando `findTier` + `calcSellingPrice`.
- Insumos filhos com `pricingTiers` manuais (ex.: capa cadastrada por faixa): preservados — ainda multiplicamos `manual_price × directSumDivisor` no subtotal e o reaplicar do divisor só nos filhos garante que o cliente veja exatamente o valor cadastrado.
- Mão de obra dos processos (display via `labor-display.ts`) não muda — continua dividindo pelo divisor cheio (com margem), pois o preço de venda do processo segue a regra anterior.
- `effectiveMarginPct`, `profit`, `netProfit` da sidebar: como `printingTotal` aumenta para o valor real, a margem efetiva fica coerente com o que o cliente paga.

## Validação

1. Reabrir o orçamento da imagem (apostila A4, Sulfite 75, 50 folhas × 10 apostilas, 4×4):
   - "Folhas a imprimir" = R$ 2.550,00
   - Cabeçalho do item ≈ R$ 2.550,00 (+ eventuais acabamentos / divisor)
   - "Composição": "Impressão (50 folhas) R$ 255,00", "Preço por apostila R$ 255,00", "Total (10 apostilas) R$ 2.550,00"
   - "Valor a cobrar" segue R$ 2.550,00 — sem divergência.
2. Testar apostila com capa + contracapa cadastradas em faixa manual (ex.: TP2 R$ 7,50): valor unitário da capa permanece exatamente R$ 7,50.
3. Testar item tier clássico (panfleto 1.000 un): nenhuma alteração no total.
4. Lucro Líquido Estimado: continua coerente, agora alinhado ao printingTotal real.

## Escopo

- Único arquivo alterado: `src/lib/quotes-v2/pricing.ts` (funções `recalculateForQuantity` e `breakdownForQuantity`).
- Nenhuma mudança em UI, banco, edge functions ou outros componentes.
