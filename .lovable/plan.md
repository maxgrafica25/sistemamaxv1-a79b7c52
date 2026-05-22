## Mudança

**Arquivo:** `src/components/orcamentos-v3/shared/TierFaixasPanel.tsx`

Atualmente "Faixas adicionais" é um bloco colapsável (botão com chevron) que inicia fechado, escondendo os atalhos de presets (`−5`, `+5`, `+10`, `+15`) e o campo de quantidade livre. Isso torna a feature pouco descoberta.

### Alterações

1. **Remover o colapso** — eliminar `open/setOpen`, `defaultOpen`, o `<button>` toggle com `ChevronDown/ChevronRight`. O painel passa a renderizar todo o conteúdo sempre visível.
2. **Cabeçalho fixo** no topo do card: ícone `BarChart3` + título "Faixas adicionais (opcional)" + subtítulo explicativo ("Compare preços para outras quantidades — todas entram no mesmo bloco."). Badge `+N` quando há sugestões.
3. **Presets em destaque** — manter a grid de 4 botões grandes (`−5`, `+5`, `+10`, `+15`) com a quantidade resultante, agora sempre visível. Adicionar um label claro acima: `"Adicionar sugestões rápidas"` em vez do atual `"Atalhos (a partir de N un)"`, mantendo o "(a partir de N un)" como subtítulo menor para contexto.
4. **Manter** linha "Solicitada" + lista de sugestões + campo livre + botão "Limpar todas".
5. **Remover** `defaultOpen` da prop API (não é breaking — `BookletForm` passa `defaultOpen` mas será simplesmente ignorado; opcionalmente removo a prop no chamador).

### Fora do escopo
- Sem mudanças em cálculo, persistência, `TierSimulator` (popover) ou outros forms.
