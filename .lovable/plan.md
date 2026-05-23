## Drag-and-drop para reordenar itens do kit

### Por que ordenar importa

`position` define a ordem em que os acabamentos aparecem para o cliente no formulário de orçamento e na OP/PDF. Hoje só dá pra mover de 1 em 1 com ▲/▼ — chato quando o kit tem muitos itens.

### Mudança de UX

- **Alça de arrasto** (ícone `GripVertical`) à esquerda de cada linha de item; cursor vira "grab" no hover, "grabbing" enquanto arrasta.
- Segura e arrasta a linha inteira para qualquer posição → ao soltar, `position` é recalculado.
- **Feedback visual** durante o drag: a linha arrastada fica translúcida + sombra; as outras se afastam suavemente.
- **Setas ▲▼ removidas** — só drag.
- **Drag restrito ao bloco**: itens "soltos" só reordenam entre si; itens dentro de um grupo Alternativo só reordenam dentro do próprio grupo. Para mover de grupo, continua sendo via `⋯ → Grupo de alternativos`.
- **Acessibilidade**: `@dnd-kit` já suporta teclado nativamente (Tab até a alça, Espaço pra pegar, setas pra mover, Espaço pra soltar) — fica de graça.

### Implementação

- Biblioteca: `@dnd-kit/core` + `@dnd-kit/sortable` (já instaladas).
- Arquivos afetados:
  - `src/pages/KitsProduto.tsx`:
    - Envolver a lista renderizada (`renderedItems.map`) em `<DndContext>` + `<SortableContext>` com sensors (Pointer + Keyboard).
    - Para cada bloco "item solto": uma sortable list única ao nível raiz.
    - Para cada bloco "alt-group": uma sortable list interna restrita aos `tmp_id`s do grupo (`SortableContext` aninhado por grupo).
    - Handler `onDragEnd` reordena o array `items` (mantendo a ordem global) e reescreve `position` sequencial. Persistência continua no save (já reenvia tudo).
  - `src/pages/KitsProduto.tsx` (componente `CompactItemRow`):
    - Adicionar prop `dragHandleProps` e renderizar `<GripVertical>` à esquerda.
    - Remover botões ▲/▼ e a prop `onMove`.
- Manter função `moveItem` ou remover (vou remover, já que ninguém mais usa).

### Fora do escopo

- Arrastar entre grupos diferentes.
- Reordenar grupos inteiros (a ordem dos grupos segue a posição do primeiro item de cada).
- Mudar o schema (`position` já existe).
