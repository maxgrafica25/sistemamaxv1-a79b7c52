

## Problema

Print mostra dois cards "Panfletos 10x14cm (A6) - Couché 90g" da ANS — mesmo fornecedor, mesmo produto, links diferentes (provavelmente um link tem faixas 500/1000/1500 e outro 2500/5000/40000+). Hoje a aba **Comparativo** agrupa por `site_id` (cada site = 1 card), então 2 sites = 2 cards mesmo quando vinculados ao mesmo `produto_catalogo_id`.

## Solução

Na aba **Comparativo** (e na tela em geral onde faz sentido), agrupar por `produto_catalogo_id` + `fornecedor_nome` em vez de por `site_id`. Quando 2+ sites do mesmo fornecedor estão vinculados ao mesmo produto canônico:

- Mostra **um único card** com nome canônico + fornecedor
- **Mescla todos os tiers** dos sites em uma lista única, ordenada por `quantidade` crescente
- **Remove duplicatas** de quantidade (se 2 sites têm 1000un, mantém o de menor preço)
- **Preserva links**: cada linha de tier mostra um ícone "↗" pequeno linkando pra URL do site original daquele tier
- Botão "Ver site" do rodapé vira **dropdown** listando todos os links agrupados ("Ver site 1", "Ver site 2")
- Timestamp "há X minutos" usa o mais recente entre os sites
- Toggle/excluir continuam funcionando por site individual (via menu, não no card principal)

## Onde mexer

- `src/pages/Monitoramento.tsx`:
  - Novo `useMemo` `gruposComparativo` que agrupa sites por `${produto_catalogo_id || nome_produto}__${fornecedor_nome}` antes de renderizar a aba comparativo
  - Para cada grupo: combina tiers de todos os sites, dedup por quantidade (menor preço vence), ordena crescente, guarda mapa `tier.quantidade → site.url` pra preservar link
  - Renderização da aba comparativo passa a iterar sobre `gruposComparativo` em vez de `sites` direto
  - Linha de tier ganha botão pequeno (ícone `ExternalLink`) quando há link específico
  - Rodapé: se grupo tem 1 site → botão "Ver site" normal; se 2+ → dropdown com todos
- Aba **Tabela completa** mantém uma linha por site (lá faz sentido ver cada cadastro individual pra editar/excluir)
- Aba **Oportunidades** já agrupa por produto entre fornecedores, mas pode estar duplicando dentro do mesmo fornecedor — vou aplicar a mesma dedup ali

## Limitação

Quando 2 sites do mesmo fornecedor têm o mesmo tier (ex: ambos têm 1000un) com preços diferentes, o sistema vai mostrar só o **menor preço** e indicar via tooltip qual link é. Se o usuário quiser ver os dois lado a lado, precisa olhar a aba "Tabela completa".

