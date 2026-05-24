# Padronizar cards de itens do orçamento

Hoje há dois layouts diferentes:

- **ItemCard** (item simples, ex.: "Cartões de visita"): título à esquerda + **preço total no canto superior direito**, subtítulo abaixo.
- **GroupCard** (grupo com faixas, ex.: "Etiquetas"): título sem preço, e uma **linha extra embaixo** com `100 un · solicitada · R$ 0,20 / un · R$ 20,00`. A quantidade já aparece no título (`"100 un. - Etiquetas"`), então `100 un · solicitada` está duplicado.

## Mudança

Em `src/components/orcamentos-v3/cart/UnifiedCart.tsx`, refatorar o `GroupCard` para usar o mesmo layout do `ItemCard`:

1. Header: título à esquerda + **preço total no canto superior direito** (mesmo lugar do ItemCard).
2. Subtítulo padrão (`itemSubtitle`) logo abaixo, igual aos demais.
3. Manter a linha "+ N faixas sugeridas ao cliente" (informa que é grupo).
4. **Remover** a linha inferior com `qty · solicitada · preço/un · total` — quantidade já está no título e o total agora está no header.

Detalhes de preço por unidade (`R$ 0,20 / un`) e demais breakdowns continuam disponíveis ao expandir o card (já existem em `ExpandedDetails`).

## Arquivo

- `src/components/orcamentos-v3/cart/UnifiedCart.tsx` (apenas o componente `GroupCard`)
