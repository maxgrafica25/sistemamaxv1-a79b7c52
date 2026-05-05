## Plano final aprovado

### 1. Banco (migração)
Atualizar trigger `validate_quote_material_catalog`:
- Aceitar `catalog_source = 'production_step'` (valida em `production_steps`, sobrescreve `description`).
- Remover branch `'finishing'` (nada novo grava com esse source; linhas antigas continuam intactas).
- Manter `'printing'` como está.

Tabelas `finishings_price_items` / `finishing_price_tiers` **não são dropadas** — continuam servindo a Calculadora de Etiquetas.

### 2. UI — Sidebar e tela /acabamentos
- `src/components/Sidebar.tsx`: renomear item `"Acabamentos"` → `"Acabamentos (Etiquetas)"`.
- `src/pages/Acabamentos.tsx`: adicionar `<Alert variant="default">` no topo com o texto:
  > "Atenção: Este cadastro é de uso exclusivo da Calculadora de Etiquetas. Para itens de orçamento geral, utilize o cadastro de Processos de Produção."

### 3. UI — Novo orçamento V2

**`src/components/orcamentos-v2/InlineCatalogCombobox.tsx` (novo)**
Props: `mode: "printing" | "process"`, `printingItems`, `processSteps`, `processGroups` (com `items` pré-carregados), `onPickPrinting`, `onPickStep`, `onPickGroup`.
Quando `mode="process"`, renderiza dois `CommandGroup`:
- "Processos individuais" (lista `production_steps` com badge de minutos)
- "Grupos de processos" (lista `step_groups` com contagem de itens)

**`src/components/orcamentos-v2/QuoteItemsTable.tsx`**
- DraftRow Tipo selector: `Impressão` | `Acabamento/Processo` | `Impressão + Processo`.
- `Acabamento/Processo` → combobox `mode="process"`. Pick step → cria 1 `quote_labor_steps` (parent=null). Pick group → expande em N `quote_labor_steps`.
- `Impressão + Processo` → combobox `mode="printing"`; após pick, linha mostra pill `[+ processo]` que abre popover `mode="process"` com mesma lógica, mas `parentItemId = id da impressão`.
- Remover branch de seleção de finishings antigos da DraftRow (linhas legadas existentes continuam editáveis).

**`src/components/orcamentos-v2/NewQuoteFormV2.tsx`**
- Remover fetch de `finishings_price_items` (linha ~258).
- Carregar em `loadInit`: `production_steps`, `step_groups`, `step_group_items`.
- Passar `processSteps`, `processGroups` para `QuoteItemsTable`.
- Handlers novos: `onAddProcess(parentId|null, step)` e `onExpandStepGroup(parentId|null, group)` que inserem em `laborSteps` com `parentItemId`.

### 4. Pricing
Sem mudanças — `pricing.ts` já trata `PricingLaborStep` com `parentItemId` (filhos são embutidos no baseCost do pai, avulsos entram no divisor geral).

### Fora do escopo
- Migração de dados antigos com `catalog_source='finishing'` (se houver) — permanecem como estão.
- Calculadora de Etiquetas — segue usando `finishings_price_items` sem alteração.

Implementar agora.