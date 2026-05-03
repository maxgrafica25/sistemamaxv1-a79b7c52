## Ajustes no módulo Orçamentos V2 — tabela de itens

### 1. Menu "+ adicionar item" simplificado

Manter apenas dois tipos no dropdown principal:
- **Impressão** — abre busca do catálogo de impressão (como hoje).
- **Acabamento / Processo** — adiciona uma linha de processo de produção.

Remover do menu: "Material / Insumo" e "Serviço terceirizado" (continuam existindo internamente para edições antigas, mas não são mais ofertados como opção de criação na tabela principal — se necessário, viram um sub-menu "Mais…" recolhido).

### 2. Linha de Acabamento → Processo de Produção

Quando o usuário clica em **Acabamento**, abre um sub-menu com duas opções:
- **Etapa individual** — abre popover com busca nas etapas cadastradas em `production_steps` (Processos de Produção → Etapas). Ao selecionar, preenche descrição, tempo (min) e tipo automaticamente.
- **Grupo de etapas** — abre popover com busca em `step_groups`. Ao selecionar, insere **N linhas** (uma por item do grupo) já preenchidas, marcadas visualmente como pertencentes ao mesmo grupo (badge com nome do grupo).

A linha continua editável inline (descrição, minutos, tipo). Cálculo: `(min/60) × hourlyRate`, igual ao atual.

### 3. Busca avançada contextual

O link **"busca avançada de itens"** passa a ser contextual:
- Por padrão (sem contexto) abre busca de **Impressão**.
- Substituir por dois links lado-a-lado: **buscar impressão** e **buscar etapa/grupo**, cada um abrindo o diálogo apropriado.

Diálogo de impressão segue como está (já corrigido o tamanho).
Novo diálogo de etapas reaproveita o mesmo layout (max-w-3xl, listagem com badge de tipo + tempo).

### 4. Nome padronizado do produto (volta a aparecer)

Hoje o `buildDynamicTitle` (Cartão de Visita, Folder, etc.) só era exposto no antigo `PrintingItemEditor` em modo card. Na tabela nova ele sumiu.

Solução: na linha de **Impressão** da tabela, o campo "Item" deixa de ser um `<Input>` cru de descrição e vira:

```
[ Tipo de produto ▼ ]  Couchê 210 A4 F — Xerox C70
   Folder                 (linha 2, texto menor, cinza — título técnico do catálogo)
```

- Pequeno `Select` à esquerda (ou ícone 🏷️ que abre popover) com `PRODUCT_KIND_OPTIONS` (Cartão de Visita, Folder, Panfleto, Adesivo, Outro…).
- Quando "Outro" é escolhido, mostra um input para nome customizado.
- O título exibido/salvo passa a ser `buildDynamicTitle({ productKind, customName, paperType, grammage, size, side, finishes: childAcabamentos })`.
- O texto técnico do catálogo (Couchê 210 A4 F — Xerox C70) vira a segunda linha em `text-xs text-muted-foreground`.

### 5. Detalhes técnicos

Arquivos a editar:
- `src/components/orcamentos-v2/QuoteItemsTable.tsx`
  - Trocar `DropdownMenu` do "+ adicionar item" para os 2 tipos novos.
  - Adicionar sub-popover de Etapa/Grupo com fetch de `production_steps` e `step_groups` (carregar via prop ou hook próprio).
  - Renderer da linha **print**: substituir input de descrição pelo combo `ProductKind + título dinâmico` (linha dupla compacta).
  - Renderer **labor**: aceitar agora `groupId?: string | null` para badge de grupo.
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx`
  - Carregar `production_steps` e `step_groups` no `loadInit` e passar para `QuoteItemsTable`.
  - Handler `onAddStep(step)` cria 1 `SubformLabor`; `onAddStepGroup(group)` cria N `SubformLabor` com `groupId` comum.
  - Garantir que ao salvar, o `description` enviado para `quote_materials` seja o `buildDynamicTitle(...)`.
- `src/components/orcamentos-v2/LaborAndSupplySubform.tsx` (tipo `SubformLabor`)
  - Adicionar campo opcional `groupId?: string | null` e `groupName?: string | null` (apenas para exibição; não precisa persistir agora).

Sem migração de banco — `production_steps` e `step_groups` já existem.

### 6. Resultado esperado

- Selecionar "Acabamento" não mostra mais opções de impressão.
- Busca avançada permite escolher entre impressão e etapa/grupo.
- "Material/Insumo" sai do menu principal.
- Cada linha de impressão tem o seletor de "Tipo de produto" que gera o nome padronizado (Folder, Cartão de Visita, etc.) automaticamente.
