## Remover painel Assistente da coluna de itens do orçamento

O `QuoteAssistantPanelV3` está sendo renderizado dentro da aside de itens do orçamento (NewQuoteFormV3, linhas 473–478), logo abaixo do carrinho. O usuário não quer mais esse bloco ali.

### Mudança
- `src/components/orcamentos-v3/NewQuoteFormV3.tsx`: remover o `<QuoteAssistantPanelV3 .../>` (linhas 473–478) e o import na linha 26.

### Fora de escopo
- Não excluir o arquivo `QuoteAssistantPanelV3.tsx` nem o componente legado `QuoteAssistant` — podem continuar disponíveis caso queiramos reaproveitar em outro lugar (ex.: aba dedicada). Se preferir deletar de vez, me avise.
- Sem mudanças em lógica de cálculo, regras do assistente no banco ou outras telas.