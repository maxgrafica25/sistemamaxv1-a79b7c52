# Toggle de detalhes ao lado de excluir + duplicar em todo card

## 1. Mover o toggle "detalhes / ocultar" para a área de ações

Hoje o botão fica inline (texto + chevron) abaixo do título, ocupando espaço e variando de posição entre cards. Vou movê-lo para o cluster `CardActions` no canto superior direito, com um pequeno gap antes do excluir — assim a posição é padrão em todos os cards (single, bundle, group).

- Adicionar prop opcional em `CardActions`: `onToggleExpand?: () => void; expanded?: boolean`.
- Renderizar um `Button` ícone (ChevronDown quando expandido, ChevronRight quando recolhido), com `mr-1` para criar o "pouco distante" do excluir.
- Remover os botões inline atuais de `SingleCard`, `BundleCard` e `GroupCard`.
- Comportamento padrão expandido para admin permanece.

## 2. Garantir botão Duplicar em todo item

- **SingleCard / BundleCard:** já têm duplicar — sem mudança.
- **GroupCard:** hoje só tem excluir. Adicionar `onDuplicate` que duplica **apenas o item primário** da faixa (não duplica todas as faixas — o usuário pode quiser reabrir o gerador de faixas depois). O `quick-actions.ts` / handler de duplicar do pai já gera um novo id sem `tier_group_id`, virando um single — comportamento esperado para "duplicar a base".

## Arquivo afetado

- `src/components/orcamentos-v3/cart/UnifiedCart.tsx`
