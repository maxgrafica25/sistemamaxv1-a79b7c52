# Ajuste fino — 1ª linha das etiquetas redondas

## Problema

Para etiquetas redondas Ø38mm em SRA3 (margens 7mm, gap 0), o sistema entrega **86** etiquetas em vez das **87** esperadas (mostradas no CorelDRAW de referência: 7 na 1ª linha + 10×8 nas demais).

## Causa raiz

A função `safeCellsForRow` em `src/lib/labels/layout.ts` sempre remove etiquetas **em pares** (`n -= 2`) para preservar simetria. No caso 38×38:

- 8 colunas brutas, rowWidth = 304mm, slack = 1mm (< 10mm de segurança)
- Remove 2 → 6 na 1ª linha → total 6 + 10×8 = **86**
- Mas remover apenas **1** já libera slack suficiente (rowWidth=266, slack=20mm)

Para **retangulares** (corte reto/plotter quadrado) a remoção em pares faz sentido visualmente — as linhas precisam ficar alinhadas em colunas. Para **redondos**, a 1ª linha já é centralizada de forma independente das demais (vide print de referência), então remoção ímpar é aceitável.

## Mudança proposta

### `src/lib/labels/layout.ts`

Em `computeReservedSlots`, alterar a função `safeCellsForRow` e `reserveEnds` para suportar **passo configurável** (1 para redondas, 2 para retangulares), e ajustar a reserva de slots para casos ímpares (remove só 1 lado — preferencialmente o esquerdo, já que a centralização da linha cuida do visual).

```typescript
const step = isRound ? 1 : 2;

const safeCellsForRow = (startCols: number): number => {
  let n = startCols;
  while (n > 0) {
    const rowWidth = n * labelW + Math.max(0, n - 1) * gap;
    const slack = (usableW - rowWidth) / 2;
    if (slack >= SAFETY_ZONE_MM) return n;
    n -= step;
  }
  return 0;
};

const reserveEnds = (row: number, removed: number) => {
  if (removed <= 0) return;
  // remove alternando esquerda/direita; em remoção ímpar a linha é
  // re-centralizada pelo offset da linha, então o lado escolhido é estético
  let left = 0, right = cols - 1;
  for (let i = 0; i < removed; i++) {
    if (i % 2 === 0) { slots.push({ col: left++, row }); }
    else { slots.push({ col: right--, row }); }
  }
};
```

Nota: como cada linha já tem seu próprio `rowOffset` calculado em `buildRowDistribution` (centralização independente por linha), tanto faz qual ponta é "marcada como reservada" — o que importa é a contagem `cellsPerRow[row]`. A linha visual continua centralizada.

### `src/test/labels-layout.test.ts`

Adicionar caso:

```typescript
it("Ø38mm em SRA3 plotter_redondo gap 0 — 87 etiquetas (7 + 10×8)", () => {
  const r = computeLabelLayout({
    sheetW: 320, sheetH: 450,
    labelW: 38, labelH: 38,
    marginTop: 7, marginBottom: 7, marginLeft: 7, marginRight: 7,
    gap: 0,
    shape: "redondo",
    cutType: "plotter_redondo",
  });
  expect(r.effectivePerSheet).toBe(87);
  expect(r.cellsPerRow[0]).toBe(7);
  expect(r.cellsPerRow[r.best.rows - 1]).toBe(8);
});
```

Verificar também que os testes existentes continuam passando — em particular o caso "60×60mm redondo" que já remove em pares por simetria geométrica (com step=1 ele removeria 1; precisa revalidar se o slack mínimo de 10mm é satisfeito com n−1).

### `mem://features/label-calculator`

Atualizar para registrar a regra:
> Etiquetas redondas: remoção assimétrica (1 por vez) na 1ª linha para maximizar aproveitamento. Etiquetas retangulares/personalizadas: remoção simétrica (em pares) na 1ª e última linhas.

## Resultado esperado

- Ø38mm SRA3 gap 0 → **87** etiquetas (7 + 10×8) ✓
- Casos retangulares anteriores (61×51 → 38) inalterados ✓
- Caso 50×50 redondo (slack já com 1 removido = 28mm) inalterado ✓
