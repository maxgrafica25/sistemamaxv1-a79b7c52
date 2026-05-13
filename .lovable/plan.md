## Plano de correção — apostilas usam o MESMO valor da página "Preço Impressão"

### Fórmula real usada em `src/pages/PrecoImpressao.tsx`

```
printCostA4 = getEffectivePrintingCost(item)          // bruto, SEM roundUp5
printCost   = roundUp5(printCostA4 * sizeMult * sideMult)
baseCost    = item.paper_cost + printCost              // paper_cost vem do banco
sellingPrice = round( baseCost / (1 − (fixed+variable+margin)/100) * 10 ) / 10
```

Onde `roundUp5(v) = Math.ceil(v * 20 − 1e−9) / 20` e `paper_cost` é o valor armazenado em `printing_price_items.paper_cost` (não o recalculado ao vivo).

### Diagnóstico

A fórmula da composição já é a mesma. A divergência R$ 5,10 vs R$ 5,00 vem de **uma única diferença de input**: `NewQuoteFormV2.tsx` substitui `item.paper_cost` por `getLivePaperCost(...)` ao montar o catálogo. A página "Preço Impressão" usa o `paper_cost` armazenado no banco. Inputs diferentes → `baseCost` diferente → `sellingPrice` cai numa borda de arredondamento e vira R$ 5,10.

### Passos do plano

1. **Espelhar exatamente os inputs de `PrecoImpressao`**
   - No builder do catálogo em `NewQuoteFormV2.tsx` (`loadInit` / construção de `PrintingCatalogItem`), parar de sobrescrever `paper_cost` com `getLivePaperCost`. Usar o `item.paper_cost` exato vindo de `printing_price_items` (mesmo input que a página de Preço Impressão usa).
   - Manter `printing_cost` cru (sem `roundUp5`) — `roundUp5` é aplicado depois junto com `sizeMult * sideMult`, exatamente como em PrecoImpressao linha 1030.

2. **Reusar a mesma fórmula no momento da seleção da apostila**
   - Em `pickPaperForPrintingItem`, `onSwapPrinting` e `updateMaterialPatch`, calcular o `sellingPrice` com a fórmula idêntica à de PrecoImpressao:
     ```
     printCost    = roundUp5(item.printing_cost * sizeMult * sideMult)
     baseCost     = item.paper_cost + printCost
     totalImpr    = bookletPages * bookletUnits      // 70 * 10 = 700
     tier         = faixa que cobre totalImpr no grupo do item
     sellingPrice = round(baseCost / (1 − somaPct) * 10) / 10
     ```
   - Atribuir esse valor diretamente em `unitPrice` (atribuição burra pós-cálculo).

3. **Travar o motor (`pricing.ts`) em modo passivo para apostila**
   - Para `direct_sum` / apostila, manter exatamente o que já existe: usar `m.unitPrice` como preço final da folha. Garantir que NÃO há nenhum `calcSellingPrice`, `roundUp5`, multiplicação por face/tamanho, divisor de imposto/cartão/margem aplicado sobre esse `unitPrice`.
   - O total de impressão por apostila vira `unitPrice * bookletPages` e o total do item vira `unitPrice * bookletPages * bookletUnits`.
   - Filhos (capa, mola, furo, montagem) continuam somando normalmente em cima — sem mexer.

4. **Sincronizar `quantity` e `pieces` da apostila**
   - Garantir que, quando `bookletPages` ou `bookletUnits` mudam, `quantity = bookletPages * bookletUnits` (já é feito). Isso é o que garante que o tier correto (ex: 700) seja escolhido na seleção.

5. **Composição lateral (sidebar)**
   - Não mexer na fórmula de exibição. Como `unitPrice` agora vai bater R$ 5,00, a linha "Impressão (70 folhas)" passa a mostrar `R$ 350,00` automaticamente.

### Validação esperada

- Item de apostila: 10 unidades × 70 folhas = 700 impressões totais.
- Faixa correspondente em PrecoImpressao mostra `R$ 5,00`.
- Após selecionar o papel: `unitPrice = 5.00`.
- Sidebar: "Impressão (70 folhas) — R$ 350,00" por apostila.
- Total impressão do pedido: `R$ 3.500,00`.
- Acabamentos (capa, mola, furo, montagem) continuam sendo somados normalmente ao final, sem afetar esse subtotal.

### Sem mudanças em

- Banco de dados, RLS, tipos gerados.
- Fluxo clássico de cartões/flyers/etiquetas (continua usando `calcSellingPrice` + `roundUp5` normalmente).
- Tabela "Preço Impressão" (continua a fonte da verdade visual).