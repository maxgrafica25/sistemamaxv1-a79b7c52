# Filtrar papéis pela Cor da Impressão

## Por que aparece "Sulfite 75g — A4 F" mesmo com 4x4 selecionado

O dropdown "Papel" lista o catálogo inteiro sem cruzar com a `printColors` escolhida no topo. Como o catálogo tem o mesmo papel cadastrado em duas variantes (F = só frente / F/V = frente e verso, com custos diferentes), as duas aparecem na busca. Hoje só o texto digitado filtra a lista — o `side` é ignorado.

Isso é perigoso: se o vendedor escolheu `4x4` (F/V) e clica numa linha "Sulfite 75g — A4 F", o item fica com custo de impressão simples mas vai imprimir frente e verso → preço errado.

## Solução

Filtrar `printingCatalog` pelo `side` derivado de `item.printColors` (mesma regra já usada para `bookletDuplex`):

| printColors | mostra papéis com side |
|-------------|-----------------------|
| `4x4`, `1x1` | apenas `F/V` |
| `4x0`, `1x0` | apenas `F` (Simples) |
| vazio | mostra todos (comportamento atual) |

Mesma regra aplicada no `CoverPaperPicker` (Capa/Contracapa de apostila), que sofre do mesmo problema.

## Mudanças

Arquivo único: `src/components/orcamentos-v2/PrintingItemEditor.tsx`

1. **Helper já existe** (`sideFromPrintColors` em `@/lib/quotes-v2/item-title`). Importar se ainda não estiver.

2. **No bloco do dropdown de Papel** (linhas 536–554), depois do filtro `isLabel`, adicionar:
   ```ts
   const wantedSide = sideFromPrintColors(item.printColors); // "F/V" | "Simples" | undefined
   const matchesSide = (p) => {
     if (!wantedSide) return true;
     const s = (p.side || "").toUpperCase();
     if (wantedSide === "F/V") return s === "F/V" || s === "FV";
     return s === "F" || s === "FRENTE" || s === "SIMPLES";
   };
   const base2 = base.filter(matchesSide);
   ```
   Usar `base2` em vez de `base` no `.filter(q)` seguinte.

3. **Estado vazio**: se após o filtro de `side` a lista ficar vazia, mostrar mensagem específica:
   > "Nenhum papel cadastrado para impressão {printColors}. Verifique a Cor da Impressão ou cadastre essa variante."

4. **`CoverPaperPicker`**: aplicar o mesmo filtro lendo `printColors` do item pai (passar como prop nova `printColors` para o componente, ou derivar do `item.printColors` no editor antes de passar a lista filtrada).

## Out of scope
- Mudar a estrutura do catálogo no banco.
- Auto-corrigir itens já salvos com side incoerente.
- Filtrar por outros critérios (gramatura, formato).
