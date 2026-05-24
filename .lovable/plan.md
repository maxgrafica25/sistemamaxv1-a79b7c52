# Detalhes expandidos por padrão (admin) em todos os itens

Hoje só o card de bundle/single tem o botão "detalhes" e ele começa recolhido. Cards de grupo de faixas (tiers) nem têm detalhes. Para admins, queremos abrir tudo de cara em todos os tipos de card.

## O que muda em `UnifiedCart.tsx`

1. **SingleCard** — `useState(showFinancials)` em vez de `useState(false)`. Para admin começa aberto; colaborador segue sem o painel financeiro (e sem o botão também, já que `ExpandedDetails` só agrega valor quando há financeiro — mas mantém a opção `ver/ocultar` para o contexto técnico). Botão de toggle continua funcionando.

2. **BundleCard** — mesmo tratamento: `useState(showFinancials)` para admins começarem com tudo aberto.

3. **Tier group** (o card que mostra só a faixa solicitada): adicionar a mesma estrutura de toggle + `ExpandedDetails` usando o `primaryItem` como referência (`itemContext(primaryItem)` + `itemFinancials(primaryItem, pcts)`). Default expandido para admin.

## Resultado

Admin abre o orçamento e já vê para cada item: composição (Arte, Papel, Quantidade, Acabamentos…) + Custo material, Custo perda, Imposto, Taxa, Preço de venda e Lucro líquido com %. Pode recolher se quiser. Colaborador continua vendo só a linha resumida.

## Arquivo afetado

- `src/components/orcamentos-v3/cart/UnifiedCart.tsx`
