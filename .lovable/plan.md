# Aplicar o mesmo redesign de presets no `TierSimulator` (popover)

## Diagnóstico
A mudança anterior foi aplicada em `TierFaixasPanel.tsx`, usado apenas em **BookletForm**. Os demais formulários (Print, CV, Label, Supply, Terceiros) usam o popover **`TierSimulator.tsx`**, que **ainda mostra os presets antigos** (`Atual`, `×2`, `×5`, `+50%`, `Reset`). Por isso o usuário "continua vendo a visualização antiga".

## Mudanças

**Arquivo:** `src/components/orcamentos-v3/shared/TierSimulator.tsx` (linhas ~223–274)

Substituir o bloco "Adicionar nova faixa" + "Presets" pelo mesmo padrão visual já aplicado no `TierFaixasPanel`:

1. **Grid de 4 botões grandes** com deltas relativos a `currentQty`:
   - `−5`, `+5`, `+10`, `+15`
   - Cada botão em `h-12`, com o delta em destaque em cima e a quantidade resultante (`{currentQty + delta} un`) embaixo em `text-[10px] text-muted-foreground tabular-nums`.
   - Cada botão chama `addQty(currentQty + delta)`.
   - `−5` fica desabilitado (`opacity-40`) quando `currentQty − 5 < 1`.
2. **Cabeçalho do bloco:** `"Atalhos (a partir de N un)"` à esquerda; quando há faixas, botão `"Limpar todas"` (ghost) à direita — em `TierSimulator` o equivalente é `setTiers([])` (limpar as faixas atuais).
3. **Campo livre** logo abaixo, separado por `border-t border-border/60` e label `"ou digite outra quantidade"`. Mantém o `Input` + botão `Adicionar` (label completo, não mais "Add").
4. **Remover** o botão `Reset` dessa área (não era pedido — mantém comportamento simples). Se quiser manter um reset para os defaults globais, fica como item futuro.
5. **Manter intacto** o botão `"Adicionar todas como faixas"` que aparece após (`onCloneAsTiers`).

## Fora do escopo
- Nenhuma mudança em cálculo, persistência (`localStorage`) ou em outros componentes.
- O `TierFaixasPanel` (BookletForm) já está atualizado e não será alterado.
