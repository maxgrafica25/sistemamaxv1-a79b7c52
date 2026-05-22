## Problema
Logo abaixo das abas (Impressão + Acabamentos / Com. Visual / Terceirizados) aparece um card cinza repetindo o nome e a descrição da aba já selecionada. Como a aba ativa já está claramente destacada em roxo na barra superior, esse card é redundante e ocupa espaço útil em todos os módulos.

## Mudança
Em `src/components/orcamentos-v3/NewQuoteFormV3.tsx`:
- Remover o componente `ActiveTabBanner` (linhas 243–259) e a chamada que o renderiza logo após o `<TabsLayout />`.

Isso afeta os três módulos de uma vez (Impressão, Com. Visual e Terceirizados), já que o banner era compartilhado.

## Fora de escopo
- Estilo das abas em si (`TabsLayout.tsx`).
- Conteúdo dos formulários de cada aba.

## Validação
Em `/orcamentos-v3/novo`: ao trocar de aba, o card cinza duplicado some; a aba ativa continua identificável pelo destaque roxo no topo.
