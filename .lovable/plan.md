# Etiqueta em cm + nomes dos sub-acabamentos para cartões

## 1. Etiquetas: tamanho em cm

Em `src/components/orcamentos-v3/cart/UnifiedCart.tsx`, `itemSize`:

```ts
case "label": {
  const w = (it.labelW_mm / 10).toFixed(1).replace(".", ",").replace(/,0$/, "");
  const h = (it.labelH_mm / 10).toFixed(1).replace(".", ",").replace(/,0$/, "");
  return `${w}×${h} cm`;
}
```

(`50×50 mm` → `5×5 cm`; `35×45 mm` → `3,5×4,5 cm`)

## 2. Cartões: listar sub-acabamentos, não o grupo

Hoje em `BusinessCardForm.submit()` o card grava `finishings: enabledLabels` onde cada label é o **nome do grupo de etapas** (`p.name`). Os sub-acabamentos reais ficam em `production_steps` ligados via `step_group_id` e são carregados lazy quando o usuário expande.

Mudança em `src/components/orcamentos-v3/forms/BusinessCardForm.tsx`:

1. No `submit`, **carregar de forma síncrona** os sub-itens de todos os processos selecionados que ainda não estão em `subItemsCache` (usar `loadSubItems` em paralelo + aguardar). Manter o cache em memória.
2. Para cada `p` em `selectedProcs`:
   - Se há sub-itens, expandir `p.name` em uma lista de strings `subItems[i].description`.
   - Se não há `step_group_id` ou o grupo está vazio, manter `p.name` como fallback.
3. `enabledLabels` (usado em `finishings`) e `finishing_selections[i].name` passam a refletir essa lista expandida — cada sub-item vira um item separado em `finishings`, e em `finishing_selections` agrupa-se sob o mesmo `id`/`price` (mantendo só o cálculo de custo intacto).

Atalho mais simples para preservar o custo: manter `finishing_selections` como hoje (1 entrada por grupo, com `price`/`cost` somando o grupo), mas trocar `name` para `"sub1, sub2, sub3"`. E em `finishings` (array de strings exibido nos cards), usar a mesma lista plana de sub-itens.

Como `UnifiedCart.itemSubtitle` para `print` prioriza `finishing_selections[].name` antes de `finishings`, basta ajustar essa string ali.

## Arquivos

- `src/components/orcamentos-v3/cart/UnifiedCart.tsx` (`itemSize` para label)
- `src/components/orcamentos-v3/forms/BusinessCardForm.tsx` (carregar sub-itens no submit e expandir nomes)
