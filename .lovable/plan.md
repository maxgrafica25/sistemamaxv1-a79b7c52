## Objetivo

Restringir o painel "Custos e lucro" (que aparece ao expandir um item do carrinho) **apenas para usuários admin**, e garantir que ele apareça para **todos os tipos de item** — impressão, apostila, etiqueta, comunicação visual, terceirizado, suprimento e mão-de-obra.

## Estado atual

- `UnifiedCart` já renderiza o painel para todas as `kinds` (`print`, `cv`, `third`, `booklet`, `labor`, `supply`, `label`) via `itemFinancials` + `ExpandedDetails`. Nada a alterar no cálculo.
- Não há gate por role — qualquer usuário vê o detalhamento financeiro.

## Mudança

**`src/components/orcamentos-v3/cart/UnifiedCart.tsx`**
1. Importar `useIsAdmin` de `@/hooks/useIsAdmin`.
2. Chamar `const isAdmin = useIsAdmin()` dentro do `UnifiedCart` e propagar como prop opcional `showFinancials: boolean` para `SingleCard` e `BundleCard` (junto do `pcts`).
3. Em `SingleCard` e `BundleCard`, renderizar `<ExpandedDetails ... />` somente quando `showFinancials` for true. Para usuários não-admin, ao expandir o item será mostrado apenas o contexto (papel/dimensão/quantidade etc.) — sem custos, perdas, impostos ou lucro.
4. No `BundleCard`, a lista interna de sub-itens continua visível para todos; o bloco financeiro é que fica oculto.

Não há outras mudanças (sem alterações em rotas, banco, RLS, motor de preço ou outros módulos). O módulo de Comunicação Visual já é coberto porque os itens CV passam pelo mesmo carrinho via tab "Com. Visual" no V3.

## Fora de escopo

- Carrinho do V2 ou de outros fluxos (cv-calc page, calculadora de etiquetas avulsa) — o pedido refere-se ao carrinho do orçamento.
- Resumo financeiro do orçamento (já existe e segue como está).
- Edição de role/permissões.
