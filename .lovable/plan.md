## Melhorias de UX — Editor de Item do Orçamento V2

Escopo: ajustes puramente visuais/interativos no `PrintingItemEditor.tsx` (e card pai `CVItemCard.tsx`/`QuoteItemsTable.tsx` se necessário). Sem mudança de lógica de preço/cálculo.

### 1. Campos de busca com afordância visual
- Em **Tipo de Material** e **Papel**, adicionar ícone `Search` (lucide) à esquerda do input, padding-left aumentado.
- Combobox de papel: manter chevron à direita já existente; reforçar com hover/focus ring sutil.
- Placeholder mais explícito: "Buscar tipo de material..." / "Buscar papel por nome ou gramatura...".

### 2. Botão de adição de itens
Hoje: linha única `+ adicionar impressão · + processo / acabamento avulso`.

Proposta: dropdown único **"+ Adicionar"** (Button + DropdownMenu) com opções:
- Impressão
- Processo / Acabamento avulso

Alternativa B (se preferir manter visíveis): dois botões separados claramente delimitados, com ícones (`Printer`, `Wrench`).

### 3. Variações de quantidade
- Manter coluna "Variação N" como índice à esquerda (chip pequeno e neutro).
- Adicionar cabeçalho com rótulos **Quantidade** e **Preço unitário** acima da primeira linha (renderizar apenas uma vez).
- Renomear botão para **"+ Adicionar lote de quantidade"**.
- Tooltip explicativo no header: "Cadastre faixas adicionais de quantidade para o cliente comparar preços".

### 4. Seção de Acabamentos
- Aumentar peso visual do header colapsado:
  - Ícone `Sparkles`/`Scissors` + título `Acabamentos` em `text-sm font-semibold`.
  - Chevron animado com `rotate-180` quando aberto.
  - Badge contadora `n aplicados` quando houver acabamentos selecionados, para sinalizar conteúdo mesmo recolhido.
- Hover state mais perceptível (bg-muted/40).

### Detalhes técnicos
- Arquivo principal: `src/components/orcamentos-v2/PrintingItemEditor.tsx`.
- Reusar `DropdownMenu`, `Tooltip`, `Badge` já existentes em `src/components/ui`.
- Ícones via `lucide-react` (Search, Printer, Wrench, Sparkles, ChevronDown).
- Sem alteração em hooks de cálculo (`useGlobalSettings`, `useHourRate`) nem na engine de preço.
- Sem migração SQL.

### Fora de escopo
- Lógica de cálculo, regras de negócio, schema do banco.
- Comportamento da IA / assistente.
- Outras seções do formulário não citadas pelo usuário.

### Pergunta única antes de implementar
Prefere **dropdown único "+ Adicionar"** (mais limpo) ou **dois botões separados com ícones** (mais explícito)? Default sugerido: dropdown único.
