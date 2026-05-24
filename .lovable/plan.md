## Problema

O picker filtra `finishings_price_items` por `production_step_id IS NOT NULL`, escondendo acabamentos cadastrados sem etapa de produção vinculada. O usuário quer ver **todos** os acabamentos cadastrados.

Restrição: a tabela `product_kit_items` exige `process_step_id` (FK para `production_steps`) quando `item_type = 'process'`. Sem essa etapa, o item do kit não pode ser salvo.

## Solução

Mostrar **todos** os acabamentos ativos no picker e no select de troca, mas tornar visualmente claro quando o cadastro está incompleto.

### `src/pages/KitsProduto.tsx`

- Remover o filtro `.not("production_step_id", "is", null)` no carregamento de `finishings_price_items`.
- Estender `ProcessOption` para `{ id: string; description: string; production_step_id: string | null }`. Quando `production_step_id` é nulo, `id` recebe o id do próprio acabamento (apenas para chave de lista) e o item fica **desabilitado** com badge "Sem etapa vinculada".
- No `CompactItemRow`, exibir esses acabamentos no Select como `SelectItem disabled` com texto auxiliar "vincule etapa no cadastro de Acabamentos".

### `src/components/kits/AddItemsPicker.tsx`

- Aceitar a nova forma de `ProcessOption` (com `production_step_id` opcional).
- Renderizar todos os acabamentos. Os sem `production_step_id` aparecem:
  - Com `Checkbox` desabilitado
  - Texto esmaecido (`text-muted-foreground`)
  - Linha secundária pequena: "Vincule uma etapa de produção no cadastro de Acabamentos para usar neste kit"
- Ao confirmar, ignorar IDs sem `production_step_id` (não devem nem ser selecionáveis).

## Arquivos afetados

- `src/pages/KitsProduto.tsx`
- `src/components/kits/AddItemsPicker.tsx`

## Alternativa (não recomendada agora)

Migrar o schema de `product_kit_items` para referenciar `finishings_price_items.id` em vez de `production_steps.id`. Impacto grande em pricing/cart/edge functions — fica para outra rodada se você preferir.
