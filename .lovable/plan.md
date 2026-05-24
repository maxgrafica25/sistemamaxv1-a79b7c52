# Carrinho mais enxuto: só a quantidade solicitada

Hoje o carrinho do editor mostra cada grupo de faixas (`tier_group_id`) com a quantidade **solicitada** + todas as **sugestões** (faixas alternativas) em linhas abaixo, com economia %. Isso aperta a coluna lateral de 360px.

## O que muda

- **No editor (UnifiedCart, desktop + mobile)**: renderizar apenas a faixa primária (`tier_primary`) de cada grupo. As outras faixas continuam no `state.items` e são salvas normalmente — só não aparecem visualmente.
- O grupo passa a se parecer com um item "single", mas mantém o ícone de excluir-grupo (remove todas as faixas de uma vez).
- Adicionar uma legenda discreta abaixo do título: *"+ N faixa(s) sugerida(s) ao cliente"* quando houver tiers extras, pra deixar claro que existem alternativas guardadas.

## Fora do escopo (já funciona assim)

- **Viewer online (`ClientViewerV3`)**: já exibe as faixas como opções de "outras quantidades" (radio por grupo) — não muda.
- **WhatsApp / aceite**: já usa só a faixa escolhida pelo cliente — não muda.
- **PDF**: hoje o PDF é só um cabeçalho com valor total (não lista itens). Continua assim — fica pra outra demanda quando você quiser PDF detalhado.

## Arquivo afetado

- `src/components/orcamentos-v3/cart/UnifiedCart.tsx` — no branch `entry.type === "group"`, renderizar apenas `primaryItem` (reaproveitando o visual de `SingleCard` ou simplificando o `renderTierRow`) e adicionar a legenda de contagem.
