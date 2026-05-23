## Problema
No formulário de Cartão de Visita (e demais formulários V3 que usam Kit de Produto), cada acabamento listado mostra apenas o nome do `production_step` (ex.: "Corte de 100 Cartões de visita"). Não fica claro para o operador o que compõe essa etapa.

A intenção é que esses acabamentos sejam, na verdade, **Grupos de Etapas** (`step_groups`), com `step_group_items` representando o passo-a-passo (ex.: "Preparar guilhotina", "Cortar", "Embalar").

Hoje as tabelas estão desconectadas:
- `product_kit_items.process_step_id` → `production_steps`
- `step_groups` ⇄ `step_group_items` (sem relação com `production_steps`)

## Solução (schema + UX, sem alterar regras de negócio)

### 1. Migração — vincular `production_steps` a `step_groups` (opcional)
- Adicionar coluna `step_group_id uuid NULL REFERENCES public.step_groups(id) ON DELETE SET NULL` em `production_steps`.
- Índice `idx_production_steps_step_group_id`.
- **Não altera dados existentes.** Etapas sem grupo continuam funcionando como hoje (sem expansão).
- Em `src/pages/ProcessosProducao.tsx`: adicionar um seletor opcional "Grupo de etapas (detalhamento)" no diálogo de criação/edição da etapa. Quando preenchido, a etapa passa a ter sub-itens visíveis no orçamento.

### 2. UI — card expansível no formulário V3 (`FinishingProgressive`)
Apenas camada de apresentação. Em `src/components/orcamentos-v3/shared/FinishingProgressive.tsx`:

- Estender `FinishingDef` com campo opcional `subItems?: { description: string; time_minutes: number }[]` e `loading?: boolean`.
- Adicionar `ChevronDown` (rotaciona 180° quando aberto) no canto direito do header, ao lado do Switch.
- Estado local `expanded: Record<string, boolean>` controla a expansão por item.
- Quando aberto, renderizar lista compacta read-only das sub-etapas:
  ```
  • Preparar guilhotina         2 min
  • Cortar 100 cartões          6 min
  • Embalar                     2 min
  ```
- Se `subItems` ainda não carregou: spinner "Carregando…".
- Se `subItems` é `undefined` (sem grupo vinculado) ou vazio: esconder o chevron (nada a expandir).

### 3. Hook — `useProductKitProcesses` traz `step_group_id`
Em `src/components/orcamentos-v3/shared/useProductKitProcesses.ts`:
- Incluir `step_group_id` no `select` de `production_steps`.
- Expor no tipo `KitProcStep`.

### 4. Lazy-load das sub-etapas no `BusinessCardForm` (e demais consumidores)
Em `src/components/orcamentos-v3/forms/BusinessCardForm.tsx`:
- Novo estado `subItemsCache: Record<string, SubItem[]>` (chave = `step_group_id`).
- Função `loadSubItems(stepGroupId)` que faz `supabase.from("step_group_items").select("description, time_minutes").eq("step_group_id", id).order("sort_order")` apenas na primeira expansão.
- Passa `subItems` e `onExpand` ao `FinishingProgressive` via `FinishingDef`.

Mesma adaptação para outros formulários V3 que usam `useProductKitProcesses` (BookletForm, etc.) — feito como pequenas alterações simétricas.

## Fora do escopo
- Não altera engine de preço/custo (sub-etapas são puramente informativas).
- Não muda regras de RLS nem snapshot que vai pro orçamento salvo.
- Não mexe na V2 nem em CV/Etiquetas.

## Arquivos afetados
- Migração SQL (`production_steps.step_group_id`)
- `src/pages/ProcessosProducao.tsx` (seletor de grupo)
- `src/components/orcamentos-v3/shared/useProductKitProcesses.ts`
- `src/components/orcamentos-v3/shared/FinishingProgressive.tsx`
- `src/components/orcamentos-v3/forms/BusinessCardForm.tsx`
- `src/components/orcamentos-v3/forms/BookletForm.tsx` (mesma integração)
