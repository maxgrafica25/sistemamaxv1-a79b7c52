# Mover preço total para canto inferior direito

Hoje o preço total fica no canto superior direito, dividindo a linha com o título e limitando o espaço dele.

## Mudança

Em `src/components/orcamentos-v3/cart/UnifiedCart.tsx`, nos componentes `ItemCard` e `GroupCard`:

1. Remover o `<span>` de preço do header (mesma linha do título). Título passa a ocupar 100% da largura disponível ao lado do ícone e das ações (expand/duplicar/excluir).
2. Adicionar o preço total como uma linha própria **alinhada ao canto inferior direito do card**, abaixo das ações — `text-[13px] font-semibold tabular-nums text-right`.

Mantém subtítulo e linha "+ N faixas sugeridas" inalterados. Layout padronizado entre os dois tipos de card.

## Arquivo

- `src/components/orcamentos-v3/cart/UnifiedCart.tsx`
