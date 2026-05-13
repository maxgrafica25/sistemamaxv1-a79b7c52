## Diagnóstico

O acréscimo de 2% não vem de uma taxa oculta aplicada no resumo lateral. O problema está antes, no momento em que o `unitPrice` da apostila é calculado.

Hoje, para apostila, o código ainda calcula `unitPrice` com `calcSellingPrice(baseCost, tier)`. No caso do Sulfite 75g A4 F/V, a faixa de 700 impressões resulta em `R$ 5,10` por impressão porque o cálculo usa o custo base + percentuais da faixa e arredonda para R$ 0,10. Depois o motor usa esse `unitPrice` como final, então `70 × 5,10 = R$ 357,00`.

Também encontrei um erro de exibição no editor: para apostila, ele mostra `printingCostUnit` como preço unitário efetivo em alguns pontos, em vez do `unitPrice` final da faixa.

## Correção proposta

1. **Criar uma função específica para preço final de apostila** em `NewQuoteFormV2.tsx`:
   - Buscar a faixa pela quantidade total de impressões: `bookletPages × bookletUnits`.
   - Calcular o preço da tabela exatamente como a página **Preço Impressão** exibe.
   - Para apostilas, tratar esse valor como final e imutável: nenhuma taxa global, margem, perda, ISS, cartão ou arredondamento adicional depois disso.

2. **Garantir que o motor de cálculo respeite o preço travado** em `pricing.ts`:
   - `recalculateForQuantity`: impressão de apostila = `unitPrice × quantity`.
   - `breakdownForQuantity`: composição lateral = `unitPrice × folhas por apostila`.
   - Não aplicar `supplyDivisor`, `laborDivisor`, `salesCostPct` ou `calcSellingPrice` sobre a parcela de impressão da apostila.
   - Manter os divisores apenas para acabamentos/filhos, como capa, mola, furo e montagem.

3. **Corrigir a visualização no editor** em `PrintingItemEditor.tsx`:
   - Para apostilas, exibir `unitPrice` como preço da impressão, não `printingCostUnit`.
   - Assim, a linha de impressão e o tooltip ficam coerentes com a composição lateral.

4. **Preservar o fluxo clássico**:
   - Cartões, flyers, etiquetas, adesivos e demais itens continuam usando markup/tier clássico.
   - Sem alterações em banco de dados, RLS ou tabelas.

## Validação esperada

Com 10 apostilas de 70 folhas:

```text
70 folhas × R$ 5,00 = R$ 350,00 por apostila
10 apostilas × R$ 350,00 = R$ 3.500,00 total de impressão
```

Na composição lateral deve aparecer algo como:

```text
Impressão (70 folhas)     R$ 350,00
Total (10 apostilas)      R$ 3.500,00
```

sem somar 2%, imposto, cartão, perda ou margem sobre esse subtotal de impressão.