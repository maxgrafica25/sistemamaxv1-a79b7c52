# Colapsar bloco de acabamentos no CV (padrão impressão)

## O que muda

Hoje, no CVItemCard, o bloco "Acabamentos" mostra o `Label` + chips Sugeridos + omnibox sempre visíveis. No padrão de impressão (`PrintingItemEditor` → `SmartFinishingBlock`), esse bloco é um **header clicável com colapso**:

- Ícone `Sparkles` + título "Acabamentos"
- Badge `N aplicado(s)` quando há itens
- Hint "— clique para adicionar" quando vazio e fechado
- `ChevronDown` que gira com o estado
- Conteúdo (chips Sugeridos + omnibox + lista de aplicados) só renderiza quando expandido

## Implementação

Em `src/components/orcamentos-v2/CVItemCard.tsx`, no bloco "Acabamentos" (linhas ~335-…):

1. Adicionar estado local `acabExpanded` (default: `true` quando há acabamentos já aplicados ou quando a peça é nova com mídia selecionada; `false` caso contrário). Para simplificar e seguir o padrão impressão, manter `useState(false)` e abrir automaticamente quando `local.acabamentos.length > 0` na primeira renderização (via `useState(() => local.acabamentos.length > 0)`).
2. Substituir `<Label className="text-xs">Acabamentos</Label>` por um `<button>` colapsável idêntico ao do `PrintingItemEditor`:
   - `Sparkles` (primary) + "Acabamentos"
   - Badge com contagem quando > 0
   - Hint "— clique para adicionar" quando 0 e fechado
   - `ChevronDown` rotacionando
3. Envelopar Sugeridos + Omnibox + lista de aplicados em `{acabExpanded && (...)}`.
4. Manter borda/separador visual consistente (adicionar `border-t border-border/60 pt-3` no container, opcional, para igualar o estilo de impressão).

## Não muda

- Lógica de adicionar/remover/criar avulso.
- `CvFinishingSuggestions` e `CvFinishingOmnibox` permanecem como estão.
- Comportamento "Selecione a mídia para ver acabamentos" continua dentro do colapso.

## Arquivo afetado

- `src/components/orcamentos-v2/CVItemCard.tsx`
