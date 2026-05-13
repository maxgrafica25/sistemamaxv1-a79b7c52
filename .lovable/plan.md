## Ajustes de UX — Bloco de Acabamentos da Apostila

Duas correções de interface, sem mudanças em lógica de negócio, banco ou cálculo.

### 1. Capa Impressa renderiza no local da ação (`PrintingItemEditor.tsx` + `SmartFinishingBlock.tsx`)

Hoje o bloco "Capa & Contracapa impressas" (linhas 645–684 de `PrintingItemEditor.tsx`) é renderizado **acima** da seção "Configuração da Apostila", longe do botão `+ Capa Impressa` que vive dentro do `SmartFinishingBlock`. Ao clicar, o usuário não vê reação visual.

Solução — render-prop slot:

- Em `PrintingItemEditor.tsx`:
  - Remover o JSX do bloco "Capa & Contracapa impressas" da posição atual (linhas 645–684).
  - Extrair esse mesmo JSX para uma variável local `coverPaperSlot` (ReactNode) construída no escopo do componente, mantendo as referências a `childMaterials`, `onPickCoverPaper`, `onClearCoverPaper`, `printingCatalog`, `setShowCoverPaper`, `hasCoverWithPaper`. Só é definida quando `isApostila && !locked && showCoverPaper`.
  - Passar `coverPaperSlot` como nova prop opcional para `<SmartFinishingBlock />` (junto das props já existentes `showCoverPaper` / `onShowCoverPaper`).

- Em `SmartFinishingBlock.tsx`:
  - Adicionar `coverPaperSlot?: React.ReactNode` à interface de props e ao destructure.
  - Renderizar `{coverPaperSlot}` **imediatamente abaixo** do flex container dos botões (logo após o bloco das linhas 333–364), antes da camada de chips "Sugeridos".
  - Manter o estilo visual atual do bloco (borda superior, padding, título "CAPA & CONTRACAPA IMPRESSAS", botão "Ocultar").

Resultado: o clique em `+ Capa Impressa` faz os campos expandirem exatamente abaixo dos botões, no foco visual do operador.

### 2. Esconder linha "Sugeridos" inteira em apostilas (`SmartFinishingBlock.tsx`)

Hoje o filtro `KIT_COVERED_REGEX` (linha 115) remove Furação/Montagem/Encadernação, mas "Refile" sobra sozinho poluindo a UI.

Solução:

- Na condição de render da camada de chips (linha 367), adicionar `!isApostila`:
  ```tsx
  {!isApostila && visibleSuggestions.length > 0 && !disabled && ( ... )}
  ```
- O `KIT_COVERED_REGEX` pode permanecer (defensivo), mas a linha inteira de chips deixa de aparecer para apostilas. Para apostilas, o único call-to-action de sugestão é o botão primário "🪄 Sugerir Kit Encadernação".

Comportamento para outros produtos (cartão/flyer/etiqueta/livro) permanece intacto.

### Arquivos afetados

- `src/components/orcamentos-v2/PrintingItemEditor.tsx`
- `src/components/orcamentos-v2/SmartFinishingBlock.tsx`

Sem alterações em DB, RLS, edge functions, motor de preço ou tipos gerados.