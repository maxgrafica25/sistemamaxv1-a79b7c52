Plano para corrigir o preço incorreto:

1. Manter o campo “Peças desejadas” livre
- `quantity` continuará representando a quantidade real desejada pelo cliente, por exemplo `100`.
- O input não será convertido para múltiplos de folha e não vai alterar o número digitado.

2. Separar “peças desejadas” de “folhas cobradas”
- Para itens de impressão com dimensões, calcular internamente:
  - peças por folha: resultado do aproveitamento atual
  - folhas necessárias: `Math.ceil(peças / peçasPorFolha)`
- Exemplo atual: 100 panfletos / 9 por folha = 12 folhas.

3. Corrigir o preço do item de impressão
- Hoje o sistema mostra “Usa 12 folhas”, mas calcula o total como se fossem 100 folhas.
- Vou ajustar o cálculo para aplicar custo e markup sobre as 12 folhas usadas, não sobre as 100 peças.
- O total exibido no card passará a ser baseado em `folhasNecessárias × preçoPorFolha`.

4. Corrigir a reprecificação automática
- Atualizar a lógica em `QuoteItemsTable.tsx` para buscar a faixa de markup pela quantidade de folhas cobradas, não pela quantidade de peças.
- Isso evita o preço por folha errado quando o usuário digita 100, 500, 1000 etc.

5. Corrigir o total geral do orçamento
- Atualizar o motor `src/lib/quotes-v2/pricing.ts` para usar a quantidade cobrável correta dos itens de impressão.
- Assim o total do orçamento, a lateral financeira e o valor salvo ficam consistentes com o valor do card.

6. Validar o caso reportado
- Conferir que “100 peças”, com rendimento de 9 por folha, aparece como 12 folhas.
- Confirmar que o valor não fica mais R$ 1.160,00 por cobrar 100 folhas indevidamente.