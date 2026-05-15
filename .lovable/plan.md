# Papel já cortado — ignorar aproveitamento do folhão

## Contexto

Hoje toda peça é encaixada na **folha de produção padrão** (SRA3 ~ 328×478 mm) via `calcSheetYield`. O custo do papel cadastrado em `printing_price_items.paper_cost` é tratado como "custo de 1 folha SRA3", e a quantidade de folhas cobradas é `ceil(peças / perSheet)`.

Isso quebra para papéis que compramos já cortados em resma (Sulfite A4, A3, SRA3 já guilhotinado etc.): o custo cadastrado **já é** o custo da folha final, e não deve ser dividido pelo aproveitamento de um SRA3 imaginário.

## Decisão de arquitetura

Em vez de só um boolean cego, vamos cadastrar **o tamanho real da folha comprada** por item. Isso resolve o caso atual e prepara o sistema pra qualquer empresa que compre formatos diferentes (A2, BB, 64×88 etc.).

**Modelo final em `printing_price_items`:**

- `is_cut_size boolean NOT NULL DEFAULT false` — atalho de UX ("já vem cortado no formato final")
- `purchase_sheet_width_mm numeric NULL` — largura da folha comprada (opcional)
- `purchase_sheet_height_mm numeric NULL` — altura da folha comprada (opcional)

**Regra de resolução da "folha de produção" para um item:**

1. Se `is_cut_size = true` → usa o próprio `size` do item (A4/A3/SRA3/Carta) traduzido em mm. `perSheet = 1`. Custo cadastrado = custo final da folha.
2. Senão, se `purchase_sheet_width_mm/height_mm` estiverem preenchidos → usa esses valores como folha-base no `calcSheetYield`.
3. Senão (default) → mantém comportamento atual com `PRODUCTION_SHEET` global (328×478).

A escada `is_cut_size → purchase_sheet → global` é o que torna o modelo "inteligente": o usuário comum só marca o checkbox; o usuário avançado pode definir um folhão customizado.

## Mudanças

### 1. Banco (`supabase--migration`)
- `ALTER TABLE printing_price_items ADD COLUMN is_cut_size boolean NOT NULL DEFAULT false`
- `ADD COLUMN purchase_sheet_width_mm numeric NULL`
- `ADD COLUMN purchase_sheet_height_mm numeric NULL`

### 2. `src/lib/quotes-v2/sheet-yield.ts`
- Helper novo `sizeToMm(size: string)` mapeando A4/A3/SRA3/Carta → `{widthMm, heightMm}`.
- `calcSheetYield` continua igual; quem decide a folha é o caller.
- Helper novo `resolvePaperSheet(item)` que devolve `{sheet, perSheetOverride?: 1}` segundo as 3 regras acima.

### 3. `src/components/orcamentos-v2/PrintingItemEditor.tsx`
- No `useMemo` do `yieldInfo` (linhas 208-218): se `item.isCutSize` (vindo do papel selecionado), retorna `{ perSheet: 1, sheetsNeeded: piecesValue, orientation: 'retrato', usable*: 0 }` sem chamar `calcSheetYield` — assume 1 peça por folha (folha = peça final).
- Ajustar UI do bloco de aproveitamento pra mostrar "Papel já cortado — 1 peça/folha" ao invés do desenho da folha SRA3.
- Quando `purchase_sheet_*_mm` preenchidos, passa esses valores como `sheet` para `calcSheetYield`.

### 4. `src/pages/PrecoImpressao.tsx` (cadastro)
- Adicionar Switch **"Comprado já cortado no formato final"** logo abaixo do tamanho. Tooltip: "Marque se você compra a resma já no tamanho final (ex.: Sulfite A4). O sistema vai considerar 1 folha = 1 peça e ignorar o cálculo de aproveitamento."
- Bloco avançado opcional (collapsible "Folha de produção customizada"): inputs `largura_mm` × `altura_mm`. Desabilitado quando `is_cut_size` está marcado.
- Tipo local `PriceItem` ganha os 3 campos.
- Persistir no insert/update existente.

### 5. Tipo do item de orçamento
- `PrintingItemSearch` (e onde o item de papel é resolvido) já retorna o registro completo de `printing_price_items`. Garantir que `isCutSize`, `purchaseSheetWidthMm/HeightMm` sejam propagados para o `item` que chega no `PrintingItemEditor`.

### 6. Edge function `assistente-virtual` (somente leitura)
- Sem alteração funcional. Apenas observar que ela faz `select *` no catálogo — os novos campos ficam disponíveis automaticamente.

## Fora de escopo

- Migrar dados existentes: todos os papéis ficam `is_cut_size = false`, comportamento idêntico ao de hoje. O Juliano marca manualmente os Sulfites/etc.
- Mexer em `cv_*` (Comunicação Visual) — outro motor, outro fluxo (m²).
- Mudar o módulo Calculadora de Etiquetas — segue usando `sheet-pricing.ts`/`labels/layout.ts` que já trabalham por `size`.

## Testes

- Estender `src/test/sheet-yield.test.ts` com:
  - papel A4 cut-size + 100 peças A4 → sheets = 100, custo = 100×paper_cost.
  - papel SRA3 não-cut + peça 100×150mm → comportamento atual inalterado.
  - papel com `purchase_sheet_*_mm` custom (ex.: 660×960) → usa esse folhão.
