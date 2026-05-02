## Objetivo

Refinar a página **Calculadora de Etiquetas** (`/calculadora-etiquetas`) em quatro pontos:

1. Mover a faixa de **Configurações** (folha + corte) para o **topo** da página.
2. Deixar até **6 favoritos sempre visíveis** (a um clique), em vez de escondidos no popover.
3. Corrigir o **slider de ajuste vertical das marcas**: passo **0,5 cm**, intervalo apenas **do meio da folha até o final**, e movendo **somente as marcas inferiores** (BL/BR).
4. **Trocar o formato das marcas inferiores** para o padrão real do plotter (anexo CorelDRAW): **cruz lateral** — traço vertical longo (~10mm) cruzado por traço horizontal curto (~5mm) no meio, posicionada **fora da área útil**, na altura do canto inferior.

---

## Mudanças por arquivo

### 1. `src/lib/labels/marks.ts`

**Novo tipo de marca para a base ("cruz lateral"):**

- Adicionar `kind: "cross"` ao tipo `MarkKind` (mantendo `"L"` e `"tick"` para compatibilidade).
- Em `buildCornerMarks`, BL e BR passam a ser `kind: "cross"` com:
  - `vertexX = marginLeft - GAP` (BL) ou `sheetW - marginRight + GAP` (BR), onde `GAP ≈ 3mm` afasta a marca da área útil (igual ao anexo).
  - `vertexY = sheetH - marginBottom` (alinhada ao canto inferior da área útil).
  - `arm` continua sendo o tamanho de referência (5mm).
- Em `markSegments`, tratar `kind: "cross"`:
  - Segmento vertical: `(x, y - VERT_HALF)` → `(x, y + VERT_HALF)`, com `VERT_HALF = 5mm` (altura total ~10mm).
  - Segmento horizontal: `(x - HORIZ_HALF, y)` → `(x + HORIZ_HALF, y)`, com `HORIZ_HALF = 2.5mm` (largura total ~5mm).
- Em `markBoundingBox`, retornar a bbox correspondente para a cruz.
- TL e TR continuam como `"L"` (cantoneiras), igual hoje.

**Offset apenas das marcas inferiores:**

- Adicionar parâmetro `bottomOffsetY` (default 0) em `buildCornerMarks`. Quando informado, soma a `vertexY` apenas das marcas BL/BR. Manter `offsetY` global existente para compatibilidade.
- Neutralizar `suggestMarksOffset` (retornar 0) — não é mais aplicável ao novo modelo.

### 2. `src/components/labels/LabelLayoutCalculator.tsx`

**Reordenar layout (coluna esquerda):**

Hoje: `[Tabs folha] → [Card Simulador] → [Faixa Configurações]`
Novo: **`[Faixa Configurações] → [Tabs folha] → [Card Simulador]`**

**Favoritos sempre visíveis:**

- Remover o `Popover` "Favoritos (N)" no header do Card Simulador.
- Adicionar bloco "Favoritos" no topo do Card Simulador, com até **6 chips** em grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`.
- Cada chip: nome + dimensões compactas (ex.: "Mini · 30×20"), com `X` discreto para excluir.
- Clique → `handleLoadPreset(p.id)`.
- Mais de 6 favoritos: mostra os 6 primeiros + botão "Ver todos (N)" abrindo popover com lista completa.
- Sem favoritos: bloco oculto (UI limpa).
- Popover **"Salvar como favorito"** (ao lado da quantidade) permanece igual.

**Slider das marcas (apenas inferiores, 0,5 cm, do meio até o final):**

- `min = 0`, `max = sheetH / 2` (dinâmico), `step = 5` (mm).
- Label: "Ajuste vertical das marcas inferiores: **+X,X cm**" (mm → cm na exibição).
- Helper text: "Move apenas as marcas inferiores para baixo, do meio da folha até a borda."
- Remover botão "Sugerir Xmm".
- Trocar a chamada para `buildCornerMarks(sheetW, sheetH, mt, mb, ml, mr, 0, MARK_ARM_MM, marksOffsetY)` (offset como bottom-only).

### 3. `src/lib/labels/production-pdf.ts`

- Repassar `marksOffsetY` recebido como `bottomOffsetY` em `buildCornerMarks` (substituindo o uso atual como global).
- A função de desenho do PDF já itera sobre os segmentos retornados por `markSegments`, então a nova marca "cross" é desenhada automaticamente sem mudança extra.

---

## Constantes da nova marca

```text
CROSS_VERT_LEN_MM   = 10   (traço vertical total)
CROSS_HORIZ_LEN_MM  = 5    (traço horizontal total)
CROSS_OUTSIDE_GAP_MM = 3   (afastamento da área útil para fora)
```

Estes valores são consistentes com o anexo CorelDRAW (vista a 400% mostra ~10mm vertical × ~5mm horizontal, posicionada fora da margem direita).

---

## Fora de escopo

- Não mexer no `LabelCalcSettingsDialog`.
- Não alterar cálculo de aproveitamento, preço, modo paramétrico SignMaster nem export `.plt`.
- Limite de 6 favoritos é só visual.

---

## Resultado esperado

- **Topo:** faixa "Configurações" visível imediatamente.
- **Favoritos:** até 6 chips a um clique.
- **Marcas:** TL/TR em "L" (cantoneiras, como hoje) + BL/BR em **cruz lateral** (10mm vertical × 5mm horizontal, fora da área útil), idêntico ao anexo.
- **Slider:** mexe só nas duas marcas inferiores, em passos de 0,5 cm, descendo do meio da folha até a borda. Preview e PDF de produção sincronizados.