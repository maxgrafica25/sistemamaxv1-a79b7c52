Reduzir paddings, gaps e tamanhos de fonte do `UnifiedCart` para caber mais itens na tela, sem alterar lógica.

Em `src/components/orcamentos-v3/cart/UnifiedCart.tsx`:

1. **Lista raiz**: `space-y-1.5` → `space-y-1`.
2. **Cards (group/bundle/single)**: `p-2` → `px-2 py-1.5`.
3. **Ícone do tipo**: `p-1` + `h-3.5 w-3.5` → `p-0.5` + `h-3 w-3`.
4. **Títulos**: `text-sm font-medium` → `text-[13px] font-medium` nos títulos de single/bundle/group.
5. **Valor total dos cards single/bundle**: `text-sm font-semibold` → `text-[13px] font-semibold`.
6. **Linha de tier (renderTierRow)**:
   - `px-1 py-1 text-xs` → `px-1 py-0.5 text-[11px]`.
   - `mt-0.5 pt-1.5` (divider) → `mt-0.5 pt-1`.
   - Quantidade primary: `text-sm font-semibold` → `text-[13px] font-semibold`.
   - Total primary: `text-sm font-bold` → `text-[13px] font-bold`.
7. **Toggle "ver detalhes / ocultar"**: manter mas reduzir `mt-0.5` → `mt-0` no bundle.
8. **Listas expandidas** (`mt-1.5 pt-1.5`) → (`mt-1 pt-1`).
9. **Empty state**: `p-6` → `p-4` e ícone `h-6 w-6` → `h-5 w-5`.

Sem mudanças no `CartActions`, props, ou lógica de agrupamento/pricing.