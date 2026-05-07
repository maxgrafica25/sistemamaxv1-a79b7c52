## Problema

Ao criar nova versão do orçamento `2026-010`, os itens de acabamento (mão de obra) aparecem **soltos no topo da lista**, desvinculados dos itens de impressão pai.

Comparando os dados:

**Versão original (v1):**
- Materiais: 2 itens com `catalog_source='printing'`, `catalog_item_id`, `paper_type`, `grammage`, etc.
- Labor steps: 4 etapas vinculadas via `parent_item_id` aos itens de impressão.

**Versão nova (v2) gerada pela RPC:**
- Materiais perderam `catalog_source`, `catalog_item_id`, `paper_type`, `grammage`, `size`, `side`, `product_kind`, `custom_name`, `reference`, `generated_title`.
- Labor steps perderam `parent_item_id` e `step_type` → ficam órfãos e renderizam como avulsos no topo.

## Causa

A função `public.create_quote_version` copia apenas um subset mínimo de colunas:

```sql
INSERT INTO quote_materials (quote_id, description, quantity, unit_price, sort_order, status, approved_at, approved_value)
INSERT INTO quote_labor_steps (quote_id, description, time_minutes, sort_order)
```

Faltam todos os metadados de catálogo, hierarquia (parent_item_id) e tipo de etapa.

## Plano

Atualizar a função `create_quote_version` via migration para:

1. **Materiais**: copiar também `parent_item_id`, `product_kind`, `custom_name`, `reference`, `generated_title`, `paper_type`, `grammage`, `size`, `side`, `catalog_source`, `catalog_item_id`.
2. **Mapear IDs antigos → novos**: usar CTE com `RETURNING` + tabela temporária `(old_id, new_id)` para remapear `parent_item_id` corretamente nos materiais filhos.
3. **Labor steps**: copiar também `parent_item_id` (remapeado pelo mapping acima) e `step_type`.
4. Manter ordem de inserção: primeiro pais (parent_item_id IS NULL), depois filhos remapeados.
5. Backfill da v2 já existente (`4217b83e-...`): atualizar metadados e re-vincular labor_steps com base nos descrições/sort_order da v1.

### Detalhe técnico

```sql
-- mapping table temporária
CREATE TEMP TABLE _map(old_id uuid, new_id uuid) ON COMMIT DROP;

-- 1) inserir materiais raiz, capturar mapping
WITH ins AS (
  INSERT INTO quote_materials (quote_id, ..., catalog_source, catalog_item_id, ...)
  SELECT v_new_id, ..., catalog_source, catalog_item_id, ...
  FROM quote_materials WHERE quote_id = p_quote_id AND parent_item_id IS NULL
  RETURNING id, sort_order
)
INSERT INTO _map ...

-- 2) inserir filhos usando mapping
-- 3) inserir labor_steps com parent_item_id remapeado
```

Sem mudanças no frontend.