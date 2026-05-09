## Objetivo
Tornar o campo "Peças desejadas" totalmente livre para digitação, sem bloqueios nem sugestões automáticas que travem o usuário.

## Mudanças em `PrintingItemEditor.tsx`

1. **Remover travas do input "Peças desejadas"**
   - Tirar o `disabled` quando `exceedsSheet` ou `perSheet === 0`.
   - O campo aceita qualquer número que o usuário digitar, mesmo sem papel/dimensões definidos.
   - Manter `min={1}` apenas como validação básica.

2. **Cálculo de folhas**
   - Quando `perSheet > 0`: continua calculando `Math.ceil(pecas / perSheet)` e atualizando `item.quantity` (folhas) — mantém o motor de preço intacto.
   - Quando `perSheet === 0` (sem rendimento ainda): assume `quantity = pecas` (1 peça = 1 folha) como fallback, sem bloquear a digitação.

3. **Linha auxiliar informativa (não bloqueante)**
   - Se `yieldInfo` existir: mostrar `Usa N folhas (X un/folha · orientação)` como hoje.
   - Se não existir: ocultar a linha (sem mensagem de erro nem placeholder restritivo).
   - O placeholder do input volta a ser fixo `100`, sem variar conforme estado.

4. **Aviso de excesso (`exceedsSheet`)**
   - Mantém o banner `AlertTriangle` como aviso visual, mas **não desabilita** o input — o usuário decide se prossegue.

## Fora de escopo
- Lógica de preço, multiplicadores A3/SRA3, botão régua, itens não-impressão, estado `locked` (continua somente leitura quando aprovado).
