## Problema

No campo "Peças desejadas", o usuário digita qualquer número (ex.: 1, 5, 7) e o sistema sempre mostra 9 (ou múltiplo do rendimento da folha).

## Causa

O `quantity` é armazenado em **folhas**, mas o campo exibe **peças** calculadas como `folhas × perSheet`. Quando o usuário digita 1 peça e `perSheet = 9`:
- `next = Math.ceil(1 / 9) = 1` folha
- Display recalcula: `1 × 9 = 9` peças

Ou seja, o input sempre "salta" para a capacidade total das folhas usadas, ignorando o número real digitado.

## Solução

Guardar o valor bruto de peças digitado pelo usuário em estado local do componente e exibi-lo enquanto o campo está sendo editado, mantendo `quantity` (folhas) como fonte de verdade para o pricing.

### Mudanças em `src/components/orcamentos-v2/PrintingItemEditor.tsx`

1. Adicionar estado local `piecesInput: string | null` (null = não está editando, usa valor derivado).
2. No `onChange` do input de peças:
   - Atualizar `piecesInput` com o texto digitado.
   - Calcular folhas (`Math.ceil(p / perSheet)`) e chamar `onItemChange({ quantity })`.
3. No `onBlur`: limpar `piecesInput` (volta a exibir valor derivado de folhas × perSheet, que reflete a capacidade real após arredondamento).
4. `value` do input: `piecesInput ?? (folhas * perSheet || "")`.

Assim, durante a digitação o usuário vê exatamente o que digitou; ao sair do campo, vê a capacidade real (que pode ser maior, pois folhas são arredondadas pra cima) — comportamento esperado e transparente.

### Fora de escopo

- Lógica de pricing, multiplicadores, rendimento por folha.
- Outros campos do editor.
