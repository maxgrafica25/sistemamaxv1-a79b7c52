## Objetivo

Fazer o formulário de **Cartão de Visita** mostrar como chips qualquer acabamento cujo nome contenha "cartão de visita" (case-insensitive, com ou sem acento), independente da categoria.

## Mudança

**Arquivo:** `src/components/orcamentos-v3/forms/BusinessCardForm.tsx`

1. Trocar `listFinishings("impressao")` por carregamento de todas as categorias relevantes (chamar sem filtro de categoria ou unir `impressao` + `recorte` + `cv`).
2. Substituir o filtro atual `/corte/i || /lamina/i` por um match no nome do tipo "contém cartão de visita" — normalizando para remover acento (`cartao` ≈ `cartão`) e ignorando caixa.
3. Atualizar o texto de fallback (quando não há nenhum acabamento) para orientar: *"Cadastre um acabamento contendo 'cartão de visita' no nome em /acabamentos"*.

## Detalhes técnicos

- Normalização: `s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("cartao de visita")`.
- Verificar a assinatura de `listFinishings` em `src/lib/finishings/catalog.ts`; se exigir categoria, fazer `Promise.all` das categorias usadas no app e concatenar resultados, deduplicando por `id`.
- Nenhuma alteração de banco, nenhuma migração, nenhum outro form afetado.

## Como testar

1. Em `/acabamentos`, cadastrar um item com nome ex.: *"Laminação Cartão de Visita"*.
2. Em Orçamentos V3 → preset **Cartão de Visita**, o item deve aparecer como chip opcional.
3. Itens sem "cartão de visita" no nome não aparecem.
