## Problema
A função `duplicateMaterial` em `src/pages/MateriasPrimas.tsx` apenas pré-preenche o formulário com os dados básicos do suprimento (nome, qtd, valor, margem etc.). Ela não copia as **faixas de preço manuais** (`supply_pricing_tiers`), por isso o duplicado nasce sem nenhuma faixa.

## Solução

1. **Guardar a origem da duplicação**
   - Adicionar um state `duplicatingFromId: string | null`.
   - Em `duplicateMaterial(m)`: setar `duplicatingFromId = m.id` (além do que já faz hoje).
   - Em `openNewDialog`, `openEditDialog` e `resetForm`: limpar para `null` (para não vazar entre operações).

2. **Copiar as faixas após o insert**
   - Em `saveMaterial`, no ramo de insert (quando `editingMaterial` é null e `inserted.id` existe), se `duplicatingFromId` estiver setado:
     - Buscar `supply_pricing_tiers` do supply de origem (`select label, min_qty, max_qty, manual_price, sort_order`).
     - Se houver faixas, fazer `insert` na mesma tabela com `supply_id = inserted.id`, preservando `label`, `min_qty`, `max_qty`, `manual_price`, `sort_order`.
     - Em caso de erro, exibir toast de aviso ("Suprimento criado, mas falhou ao copiar faixas") sem bloquear o fluxo principal.
   - Após o save (sucesso ou falha), zerar `duplicatingFromId`.

3. **Sem mudanças de UI/UX nem de schema**
   - Não há mudança visual: o usuário continua duplicando pelo mesmo botão. Apenas, ao salvar, as faixas vêm junto.
   - Sem migration: a tabela `supply_pricing_tiers` já existe e é usada pelo `SupplyTiersDrawer`.
   - RLS: o insert das faixas usa o mesmo path do drawer, que já funciona.

## Arquivos afetados
- `src/pages/MateriasPrimas.tsx` (único arquivo)
