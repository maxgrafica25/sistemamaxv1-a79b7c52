# Plano de execução — Orçamento V2

Aprovando este plano, eu executo tudo de uma vez (migração + UI + nova página + sidebar + badges).

## 1. Migração de banco de dados

**Categorização de processos** (badges coloridos):
- Adicionar coluna `step_type` (texto: `impressao`, `acabamento`, `corte`, `outro`) nas tabelas:
  - `production_steps`
  - `step_group_items`
  - `quote_labor_steps`
- Trigger `validate_step_type()` para garantir valores válidos.

**Grupos de Materiais** (templates reutilizáveis):
- Criar tabela `material_groups` (id, name, created_at, updated_at).
- Criar tabela `material_group_items` (id, material_group_id, description, quantity, unit_price, sort_order).
- RLS: leitura para autenticados, escrita para admins (mesmo padrão de `step_groups`).

## 2. Badges coloridos por tipo de processo

- Componente `StepTypeBadge` com cores fixas:
  - Azul → Impressão
  - Verde → Acabamento
  - Laranja → Corte
  - Cinza → Outro
- Aplicado nos cards de etapa em `Etapas.tsx`, `GruposEtapas.tsx` e nas etapas do `NewQuoteFormV2.tsx`.

## 3. Página "Grupos de Materiais"

- Novo arquivo `src/pages/GruposMateriais.tsx` (espelha o padrão de `GruposEtapas.tsx`): listar, criar, editar, excluir grupos com seus itens.
- Rota `/grupos-materiais` adicionada em `App.tsx`.
- Item no `Sidebar.tsx` **logo abaixo de "Matérias-Primas"**.

## 4. Cadastro de etapas com categoria

- `Etapas.tsx` e `GruposEtapas.tsx`: novo `Select` para escolher `step_type` ao criar/editar.

## 5. Refator do `NewQuoteFormV2.tsx` — Mão de Obra

- Botão **"Carregar de um Grupo"** (já existe para etapas) cria **cópias locais editáveis** em `quote_labor_steps` — alterar/zerar custo no orçamento **não afeta** o cadastro principal.
- Empty state com botão primário "Carregar de um Grupo".
- Badge colorido por etapa.

## 6. Refator do `NewQuoteFormV2.tsx` — Materiais

- Novo botão **"Carregar de um Grupo de Materiais"** importa itens como cópias locais editáveis (custo pode ser zerado para refletir uso de retalho).
- **Custo padrão sempre = Material Novo** (margem de segurança), mas usuário pode editar/zerar manualmente naquele orçamento.
- Empty state com botão primário.

## 7. UX/UI do Stepper

- Stepper navegável: clique direto em qualquer aba (não-linear).
- Indicador "✓" nas abas que já têm dados.
- `StickyFinancialSidebar` recalcula em tempo real ao editar/zerar/excluir itens.

## Garantias-chave

- **Edição local não afeta cadastro**: import sempre cria registro novo em `quote_materials` / `quote_labor_steps`, nunca referência viva.
- **Margem de segurança**: cálculo inicial usa preço de material novo do cadastro.
- **Flexibilidade total**: qualquer custo importado pode ser editado ou zerado naquele orçamento específico.

---

Detalhes técnicos (referência):
- Tabelas afetadas: `production_steps`, `step_group_items`, `quote_labor_steps`, `material_groups` (nova), `material_group_items` (nova).
- Arquivos principais: `NewQuoteFormV2.tsx`, `StickyFinancialSidebar.tsx`, `Etapas.tsx`, `GruposEtapas.tsx`, `GruposMateriais.tsx` (novo), `Sidebar.tsx`, `App.tsx`.
