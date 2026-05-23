# Categorias de Processo dinâmicas (com cor)

## Objetivo
Permitir cadastrar/editar/excluir categorias de Etapa direto na tela `/processos-producao`, escolhendo um nome e uma cor. O Select de categoria ao criar/editar uma Etapa passa a listar as categorias do banco, e o badge usa a cor cadastrada.

## Mudanças no banco
- Nova tabela `production_step_categories`:
  - `name` (text, único, case-insensitive)
  - `color` (text, hex `#RRGGBB`)
  - `sort_order` (int)
  - `is_system` (bool) — marca as 4 padrão pra não serem deletadas acidentalmente
- Seed das 4 atuais: Impressão (azul), Acabamento (verde), Corte (laranja), Outro (cinza), todas com `is_system = true`.
- Remover o trigger/função `validate_step_type` (que limita a 4 valores fixos). `production_steps.step_type` continua sendo `text` livre, validado agora apenas pelo front (Select alimentado pela tabela).
- RLS: leitura para qualquer usuário autenticado; insert/update/delete só para admin.

## Mudanças no front
- **Nova aba "Categorias"** dentro de `/processos-producao` (ao lado de "Etapas" e "Grupos de Etapas"):
  - Lista com nome + swatch de cor + ações.
  - Modal "Nova/Editar Categoria" com input de nome e color picker (input nativo `type=color` + presets).
  - Bloqueia deletar se categoria estiver em uso por alguma Etapa (avisa quantas).
  - Categorias `is_system` não podem ser excluídas, mas podem ter cor/nome editados.
- **`StepTypeBadge.tsx`**: deixa de ser baseado em constante fixa. Vira componente que recebe `type` e busca cor/label num cache global (hook `useStepCategories` com React Query). Cor aplicada via `style={{ backgroundColor, color, borderColor }}` derivada do hex.
- **Select de categoria** em `ProcessosProducao.tsx` (form de Etapa): passa a popular as opções a partir do hook.
- **Demais consumidores** (`LoadFromGroupDialog`, `LaborAndSupplySubform`, `ChecklistTab`): só renderizam o badge, então ganham as cores automaticamente sem outras mudanças.

## Out of scope
- Migrar dados antigos de `step_type` — os 4 valores existentes (`impressao`, `acabamento`, `corte`, `outro`) batem com os seeds, então continuam funcionando sem ALTER nas linhas existentes.
- Mexer em `quote_labor_steps.step_type` (mesma string, segue funcionando).
