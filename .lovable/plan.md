## Diagnóstico

A linha "Folhas a imprimir" mostra R$ 5,10 quando a tabela de "Preço Impressão" cadastra R$ 5,00 porque, embora o `pricing.ts` já use `m.unitPrice` como-está para itens `isDirectSumItem` (sem arredondamento extra), existe um efeito reativo em `src/components/orcamentos-v2/QuoteItemsTable.tsx` (linhas 195-210) que **sobrescreve** `unitPrice` de TODOS os itens de impressão — inclusive apostilas — usando `computeTierUnitPrice`:

```ts
// linha 192
return Math.round((baseEffective / divisor) * 10) / 10;
```

Para uma apostila com baseCost = 5,00 e divisor de tier = 0,98, isso devolve 5,10 e o valor é gravado de volta no estado, contaminando o motor a cada render.

Itens `isDirectSumItem` (apostila/booklet) NÃO devem passar por tier nem por arredondamento — o `printing_cost` da tabela já é preço de venda final.

## Correção

### 1. `src/components/orcamentos-v2/QuoteItemsTable.tsx`

Importar `isDirectSumItem` de `@/lib/quotes-v2/pricing` e, no loop do `useEffect` de re-sync (linhas 196-210), pular materiais direct_sum:

```ts
for (const m of printingItems) {
  if (isDirectSumItem(m)) continue; // apostila usa preço da tabela como-está
  const fresh = computeTierUnitPrice(m, m.quantity || 1);
  if (fresh > 0 && Math.abs(fresh - (m.unitPrice || 0)) > 0.001) {
    onUpdatePrinting(m.id, { unitPrice: fresh });
  }
}
```

### 2. `src/lib/quotes-v2/pricing.ts` — verificação

Confirmar (já está assim) que nas três funções o `printingSellingUnit` para direct_sum é apenas `m.unitPrice ?? m.printingCostUnit ?? m.baseCost ?? 0`, sem `Math.round`/`Math.ceil`/`roundUp5`. Nenhuma alteração necessária; apenas validar.

### 3. Sem mudança no total final

O arredondamento para R$ 0,10 que existe em `calcSellingPrice` (linhas 89/131) continua válido apenas para o caminho **tier** (cartões, flyers, etc.). Apostilas seguem soma direta sem arredondamento por folha; o "Total do pedido" exibido permanece igual à multiplicação direta `unitPrice × quantidade + filhos`.

## Resultado esperado

- "Folhas a imprimir" para apostila com 500 folhas a R$ 5,00 → R$ 2.500,00 (não R$ 2.550,00).
- Cabeçalho roxo do item, composição do PriceBreakdown e "Valor a cobrar" da sidebar permanecem sincronizados.
- Itens não-apostila (cartões, flyers) seguem inalterados.
