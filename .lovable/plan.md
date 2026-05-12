## Problema

Para itens do tipo **apostila**, o cálculo de aproveitamento usa a folha de produção padrão (SRA3 — 328×478 mm) e mostra "Usa 500 folhas (2 un/folha · paisagem)" para uma apostila A4. Apostilas, porém, são impressas sempre em A4 (ou menor) — nunca em A3. O resultado correto seria 1 apostila por folha A4.

## O que vai mudar

### 1. `src/lib/quotes-v2/sheet-yield.ts`
Aceitar uma folha customizada opcional:
```ts
calcSheetYield(itemWidthMm, itemHeightMm, totalQty, sheet?: { widthMm; heightMm })
```
Se `sheet` for passado, usa essas dimensões (com a mesma margem de segurança e gutter atuais) em vez de `PRODUCTION_SHEET`. Comportamento padrão inalterado.

Exportar também uma constante `A4_SHEET = { widthMm: 210, heightMm: 297 }`.

### 2. `src/components/orcamentos-v2/PrintingItemEditor.tsx` (linhas 190-193)
Quando `isApostila` for true, passar `A4_SHEET` para `calcSheetYield`. Para apostila A4 → 1 un/folha; para apostila A5 → 2 un/folha em A4 (correto).

A linha de resumo "Usa N folhas (X un/folha · orientação)" continua a mesma — só os números mudam.

## Fora de escopo

- Não mexer em pricing, multiplicadores A3/SRA3, nem no `LabelLayoutDialog`.
- Não alterar a folha de produção padrão para itens não-apostila.
- Sem mudanças no viewer do cliente nem no `QuoteOptionsBuilder`.

## Arquivos afetados

- `src/lib/quotes-v2/sheet-yield.ts` — adicionar parâmetro opcional `sheet` e constante `A4_SHEET`.
- `src/components/orcamentos-v2/PrintingItemEditor.tsx` — passar `A4_SHEET` no cálculo quando `isApostila`.