## Objetivo
1. Pluralizar as sugestões de "Tipo de Material".
2. Quando o usuário escolher **Etiquetas** (ou Adesivos): travar/auto-selecionar `4x0` (sem verso) e filtrar o catálogo de papéis para mostrar apenas **Adesivo**, com **A3 como padrão** e A4 como alternativa.

## Mudanças

### 1) `src/lib/quotes-v2/item-title.ts`
- Pluralizar `PRODUCT_KIND_SUGGESTIONS`:
  - `Panfletos`, `Cartões de Visita`, `Tags`, `Apostilas`, `Cartazes`, `Folders`, `Receituários`, `Adesivos`, `Convites`, `Blocos`, `Etiquetas`, `Impressos`.
- `PRODUCT_KIND_OPTIONS` continua derivando da lista (sem alterações adicionais).
- `buildDynamicTitle` não muda — apenas reflete o novo rótulo no título.

### 2) `src/components/orcamentos-v2/PrintingItemEditor.tsx`

**Helper local** `isLabelKind(productKind)` → true para nomes que comecem com "etiqueta" ou "adesivo" (case-insensitive, cobre singular legado).

**Auto-set de cor de impressão para etiquetas/adesivos**
- Quando o `productKind` mudar (via sugestão ou texto livre) e `isLabelKind` for true:
  - Forçar `printColors = "4x0"` e `side = "Simples"` (chamar `handlePrintColorsChange("4x0")` junto do `onItemChange`).
- No `<Select>` de "Cor da Impressão":
  - Se `isLabelKind(item.productKind)`: desabilitar o Select e exibir apenas `4x0` (com tooltip/legenda discreta: "Adesivo não tem verso").

**Filtro do catálogo de papel quando for etiqueta**
- No combobox de Papel:
  - Quando `isLabelKind` for true, restringir o `printingCatalog` a itens cujo `paper_type` contenha "adesivo" (case-insensitive) e `size` ∈ { `A3`, `A4` }.
  - Manter a busca livre (`paperQuery`) atuando sobre esse subconjunto já filtrado.
- **Pré-seleção automática**: ao marcar "Etiquetas" e ainda não houver papel selecionado (ou o atual não for adesivo), tentar pré-selecionar o primeiro Adesivo A3 disponível no catálogo via `onPickPaper(...)`. Se não houver A3, tentar A4. Se não houver nenhum, não fazer nada (usuário escolhe).

### Comportamento preservado
- Campos podem continuar livres para outros tipos de material.
- Para tipos não-etiqueta, nada muda no Select de cores nem no filtro de papel.
- Itens já criados com `productKind` no singular (ex.: "Etiqueta") continuam funcionando graças ao `isLabelKind` que aceita ambos.

## Fora de escopo
- Lógica de preço, multiplicadores, quantidade, processos/acabamentos, cadastro de papéis.
