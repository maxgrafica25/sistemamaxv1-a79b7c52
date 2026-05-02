## Objetivo

Implementar uma **Zona de Segurança de 10mm** entre as etiquetas e as marcas de registro ARMS — mas **só "sacrificar" etiquetas quando a distância real for menor que 10mm**. Se a etiqueta naturalmente já estiver longe da marca (folga ≥ 10mm), ela é mantida e o aproveitamento é máximo.

## Regras (revisadas)

### 1. Condição dinâmica — Zona de Segurança de 10mm

Para cada etiqueta candidata à remoção (cantos da primeira/última linha), calcula-se a distância em mm entre o **bbox da etiqueta** e o **bbox da marca de registro mais próxima**:

- **Distância ≥ 10mm** → etiqueta é **mantida** (aproveitamento máximo).
- **Distância < 10mm** → etiqueta é **removida** e a linha é recentralizada.

Exemplo: etiqueta 50×50 em SRA3 com margem padrão e gap 1mm fica naturalmente a >10mm das marcas → **nada é removido**. Já etiquetas 80×80 ou margens apertadas → as pontas serão removidas.

### 2. Quais slots são candidatos à verificação

Apenas em `cutType === "plotter_quadrado"` ou `"plotter_redondo"`. Em `corte_reto` nada muda.

| Formato (cutType) | Slots verificados (candidatos à remoção) | Marca avaliada |
|---|---|---|
| `plotter_quadrado` (quadrado/personalizado) | Pontas da **1ª linha** (col 0 e col cols−1, row 0) **e da última linha** (col 0 e col cols−1, row rows−1) | Topo: L de TL/TR. Base: tick de BL/BR |
| `plotter_redondo` (redondo) | Pontas da **1ª linha apenas** | L de TL/TR (a base usa ticks que se encaixam nos vãos entre círculos) |

### 3. Centralização (`rowOffset`)

Quando uma linha tem `n` etiquetas removidas, recalcula `rowOffset` para que as restantes fiquem centralizadas horizontalmente na área útil. **A lógica já existe** em `computeLabelLayout` (linhas 248-259) — só será exercitada quando `reservedSlots` tiver itens.

### 4. Impacto no cálculo

- `effectivePerSheet` = soma de `cellsPerRow` (já é assim hoje).
- Pricing, ladder de upsell, sugestão de shrink e WhatsApp continuam consumindo `perSheet = layout.effectivePerSheet`, sem alteração de assinatura.
- Badge no preview: `"−N (zona de segurança 10mm)"`.

## Detalhes técnicos

### Cálculo da distância etiqueta ↔ marca

```ts
const SAFETY_ZONE_MM = 10;

// Distância euclidiana entre dois retângulos não sobrepostos.
// Se sobrepostos, retorna 0.
function rectDistance(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): number {
  const dx = Math.max(0, Math.max(ax - (bx + bw), bx - (ax + aw)));
  const dy = Math.max(0, Math.max(ay - (by + bh), by - (ay + ah)));
  return Math.hypot(dx, dy);
}
```

Para cada slot candidato, computa-se `rectDistance(célula, markBox)` para cada marca relevante; se **a menor distância** for `< 10mm`, o slot vira `ReservedSlot`.

### Marcas relevantes por linha

- **Primeira linha (row 0):** marcas L de `tl` e `tr` (topo).
- **Última linha (row rows−1):** marcas tick de `bl` e `br` (base).

Otimização: o canto esquerdo (col 0) só compara com a marca esquerda do lado correspondente; o canto direito (col cols−1) com a direita. Isso evita falsos positivos por marcas do outro lado da folha.

## Mudanças no código

### `src/lib/labels/layout.ts` — substituir `computeReservedSlots`

Nova lógica (modo objeto):

```ts
const SAFETY_ZONE_MM = 10;

// Pseudocódigo
if (cutType === "corte_reto") return [];
if (cols <= 0 || rows <= 0) return [];

const isRound = cutType === "plotter_redondo";
const marks = buildCornerMarks(sheetW, sheetH, marginTop, marginBottom, marginLeft, marginRight, 0);
const markByCorner = Object.fromEntries(marks.marks.map(m => [m.corner, markBoundingBox(m)]));

const slots: ReservedSlot[] = [];

// Helper para checar 1 candidato
const checkSlot = (col: number, row: number, cornerMark: BBox) => {
  const cellX = marginLeft + col * (labelW + gap);
  const cellY = marginTop + row * (labelH + gap);
  const dist = rectDistance(cellX, cellY, labelW, labelH,
                            cornerMark.x, cornerMark.y, cornerMark.w, cornerMark.h);
  if (dist < SAFETY_ZONE_MM) slots.push({ col, row });
};

// 1ª linha — sempre verificada (quadrado, redondo, personalizado)
if (cols >= 1) checkSlot(0, 0, markByCorner.tl);
if (cols >= 2) checkSlot(cols - 1, 0, markByCorner.tr);

// Última linha — só p/ não-redondo
if (!isRound && rows >= 2) {
  if (cols >= 1) checkSlot(0, rows - 1, markByCorner.bl);
  if (cols >= 2) checkSlot(cols - 1, rows - 1, markByCorner.br);
}

return slots;
```

O modo legado `(cutType, cols, rows)` continua retornando `[]` (sem geometria não dá pra medir distância).

### `src/lib/labels/marks.ts`

Sem mudanças funcionais.

### `src/components/labels/LabelLayoutCalculator.tsx`

Atualizar texto do badge no preview (linha ~814):
- De: `"−N p/ marcas ARMS"`
- Para: `"−N (zona de segurança 10mm)"`

Demais consumidores (`cellsPerRow`, `rowOffsets`) continuam funcionando.

### `src/lib/labels/production-pdf.ts`

Sem mudança — já consome `reservedSlots` e `rowOffsets`.

### Testes — `src/test/labels-layout.test.ts`

Novos / atualizados:

1. **Atualizar** `"50×50 em SRA3/Teneth → grade cheia, sem perder cantos"`: com folga natural >10mm ainda **mantém grade cheia** (validar que `reservedSlots` continua `[]`). Renomear o teste para deixar claro que isso valida a regra dinâmica.

2. **Atualizar** `"computeReservedSlots — colisão real"` → renomear para `"computeReservedSlots — zona de segurança 10mm"`:
   - Caso A: etiqueta grande (ex.: 80×80) com margens apertadas em SRA3 → distância < 10mm → slots reservados nas pontas.
   - Caso B: etiqueta pequena (50×50) → distância ≥ 10mm → array vazio.
   - `corte_reto` → sempre `[]`.
   - Verificar que `plotter_redondo` **nunca** reserva slots na última linha, mesmo em casos extremos.

3. **Novo** teste de centralização: forçar cenário onde a 1ª linha perde 2 etiquetas e validar que `rowOffsets[0]` está centralizado (>(usableW − occupied)/2 + marginLeft).

4. **Atualizar** `"Regra dos 40 — 50×50 em SRA3 com Teneth"`: como 50×50 fica naturalmente longe das marcas (>10mm), o resultado **continua 42** (regra preservada).

### Memória (`mem://features/label-calculator`)

Adicionar:
> **Zona de Segurança ARMS (10mm):** em `cutType` plotter, etiquetas dos cantos da 1ª linha (sempre) e da última linha (apenas quadrado/personalizado — redondo não afeta a base) são **removidas só se** a distância real até a marca correspondente for < 10mm. Linhas afetadas são recentralizadas. `effectivePerSheet` reflete a perda. Se a folga natural for ≥ 10mm, a grade permanece cheia.

## Resumo do comportamento

```text
Etiqueta 50×50, SRA3, gap 1mm, margem 5/5/5/5:
   distância natural até L de TL ≈ 7mm? → remove canto
   distância ≥ 10mm? → mantém canto (grade cheia)

Etiqueta 80×80, mesmas margens:
   distância < 10mm → remove cantos da 1ª linha (e da última se quadrado)
   linha 0 vai de [□ □ □ □] para [. □ □ .], centralizada

Redondo, qualquer tamanho:
   última linha NUNCA é mexida (ticks se encaixam no vão entre círculos)
```
