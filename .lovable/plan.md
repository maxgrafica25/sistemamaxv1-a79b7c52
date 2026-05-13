## Diagnóstico

O valor R$ 357,00 aparece porque o motor está escolhendo a faixa da tabela usando `itemQty = 700` folhas/impressões totais. Para essa faixa, o preço calculado fica R$ 5,10 por folha, então 70 folhas por apostila viram R$ 357,00.

Para apostilas, a faixa correta da tabela deve ser escolhida pela quantidade de apostilas (`bookletUnits = 10`), não pela quantidade total de folhas (`quantity = 700`). Assim a tabela usa a faixa de 10 unidades, cujo valor é R$ 5,00 por folha, resultando em:

```text
70 folhas × R$ 5,00 = R$ 350,00 por apostila
10 apostilas × R$ 350,00 = R$ 3.500,00 de impressão
```

## Plano de implementação

1. Ajustar `src/lib/quotes-v2/pricing.ts` para que itens `direct_sum`/apostila busquem a faixa de impressão com uma quantidade de referência própria:
   - usar `bookletUnits` quando existir e for maior que zero;
   - senão manter `itemQty` como fallback para não afetar outros itens.

2. Aplicar o mesmo critério nos dois pontos do motor:
   - cálculo principal (`recalculateForQuantity`);
   - composição/tooltip (`breakdownForQuantity`).

3. Manter intactos:
   - cálculo de cartão/flyer e demais itens tier clássicos;
   - cálculo de filhos da apostila (capa, mola, furo, montagem);
   - banco de dados, RLS e configurações globais.

4. Conferir com o caso do print:
   - 10 apostilas × 70 folhas, Sulfite 75g A4 F/V Xerox C70;
   - impressão por apostila deve aparecer R$ 350,00;
   - total de impressão deve ser R$ 3.500,00 antes dos demais filhos/acabamentos.