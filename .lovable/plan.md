Ajustar o campo **Peças desejadas** para ele guardar e exibir a quantidade real digitada pelo usuário, sem arredondar o próprio campo para a capacidade da folha.

Plano:
1. **Separar quantidade de peças e folhas**
   - Tratar `quantity` como a quantidade desejada de peças/unidades.
   - Calcular internamente as folhas necessárias com `Math.ceil(quantity / unPorFolha)` apenas para exibição e precificação operacional.

2. **Campo livre durante e depois da digitação**
   - O input continuará mostrando exatamente `100` quando você digitar `100`.
   - Não vai mais trocar para `99`, `900`, ou para múltiplos de aproveitamento.
   - Remover a lógica de “voltar para capacidade total” no blur.

3. **Atualizar a linha informativa abaixo**
   - Exibir algo como: `Usa 12 folhas (9 un/folha · retrato)` quando forem 100 peças e couberem 9 por folha.
   - A quantidade desejada permanece 100; as folhas são apenas cálculo derivado.

4. **Preservar preço e tiers por quantidade real**
   - A precificação continuará usando a quantidade desejada informada.
   - Se necessário, ajustar somente os pontos que estavam assumindo que `quantity` era número de folhas.

Arquivos previstos:
- `src/components/orcamentos-v2/PrintingItemEditor.tsx`
- Possivelmente `src/components/orcamentos-v2/QuoteItemsTable.tsx`, apenas se necessário para remover o estado temporário criado para contornar o problema anterior.