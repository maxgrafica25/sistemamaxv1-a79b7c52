# Título do card: quantidade + produto + tamanho

Atualizar `itemTitle` em `src/components/orcamentos-v3/cart/UnifiedCart.tsx` para incluir o tamanho do produto após o nome, e remover o tamanho do `itemSubtitle`.

## Formato novo

`{qty} un. - {Nome} {tamanho}`

Por tipo:
- **`label`** → tamanho = `50×50 mm` (campos `labelW_mm × labelH_mm`). Remover do subtítulo.
- **`cv`** → tamanho = `30×40 cm` (a partir de `largura_m × altura_m`). Remover do subtítulo.
- **`print`** → tamanho = formato (`A4`, `A3`, `SRA3`) quando existir.
- **`booklet`** → tamanho = `N páginas` (`bookletPages`) — única "dimensão" útil para apostila.
- **`third` / `supply` / `labor`** → sem tamanho, título inalterado.

## Subtítulos finais

- `label`: `papel + gramatura | acabamento`
- `cv`: `mídia | impressão | acabamentos`
- `print`: `papel + gramatura | Frente/Verso | acabamentos`
- `booklet`: `papel + gramatura | Frente/Verso`

## Arquivo

- `src/components/orcamentos-v3/cart/UnifiedCart.tsx` (helpers `itemTitle` e `itemSubtitle`)
