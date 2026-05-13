## Plano

1. **Trocar a origem do `unitPrice` das apostilas**
   - Em `NewQuoteFormV2.tsx`, substituir os trechos que hoje fazem `calcSellingPrice(baseCost, tier)` para apostilas por uma leitura direta do valor numérico da faixa encontrada pelo volume total: `bookletPages × bookletUnits`.
   - Não usar `roundUp5`, multiplicador de face/tamanho, custo base, papel, impressão ou markup para definir esse `unitPrice` de apostila.

2. **Criar um helper explícito para travar a regra**
   - Adicionar uma função local com nome claro, por exemplo `getBookletTierUnitPrice(...)`, que:
     - encontra a faixa correta pelo volume total de impressões;
     - retorna o valor direto da faixa;
     - não chama `calcSellingPrice` nem qualquer arredondamento.

3. **Aplicar nos dois pontos que recalculam apostila**
   - `pickPaperForPrintingItem`: quando o item for apostila, atribuir `unitPrice = valor_da_faixa` diretamente.
   - `updateMaterialPatch`: quando mudar folhas/unidades da apostila, recalcular somente buscando a faixa do novo volume e atribuindo o valor direto.

4. **Manter o fluxo clássico intacto**
   - Itens comuns de impressão continuam usando `calcSellingPrice`, `roundUp5`, tamanho/face e tiers clássicos como hoje.
   - Acabamentos/filhos continuam sendo somados normalmente.
   - Sem alteração de banco de dados, RLS ou tipos gerados.

5. **Validação esperada no código**
   - 11 apostilas × 70 folhas = 770 impressões.
   - Se a faixa encontrada retornar `5.00`, então:
     - `unitPrice = 5.00`;
     - impressão por apostila = `70 × 5.00 = R$ 350,00`;
     - total = `11 × R$ 350,00 = R$ 3.850,00`.