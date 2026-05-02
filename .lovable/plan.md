## Diagnóstico

Investiguei o código atual e a fórmula de centralização em `computeLabelLayout` **já está matematicamente correta** (`offset = marginLeft + (usableW − occupied)/2`). O SVG preview e o PDF de produção **já consomem `rowOffsets[r]`** corretamente.

O problema visual real é outro: a regra dinâmica atual remove apenas o canto que está fisicamente perto da marca. Em layouts onde só **um lado** dispara a zona de segurança (ex.: 56×45mm em SRA3 com margens 5/5 → o canto esquerdo toca o L de TL, mas o canto direito fica a 26mm da marca direita), o resultado é **assimétrico**:

```
cellsPerRow: [ 4, 5, 5, 5, 5, 5, 5, 5, 5 ]   ← linha 0 perde só 1 etiqueta
reserved:    [{col:0, row:0}]                 ← só ponta esquerda
offset[0]:   46.5mm                           ← "centraliza" 4 labels deslocadas pra direita
```

Isso é "centralização matemática" mas visualmente parece que a etiqueta sumida foi simplesmente arrastada — não bate com o que o operador faz no CorelDRAW (sempre remove um de cada lado, mantendo simetria).

## Correção

Mudar a regra: **se qualquer canto de uma linha disparar a zona de segurança (<10mm), remover SIMETRICAMENTE as duas pontas dessa linha** (col 0 e col cols−1). Resultado: layout simétrico, centralização visual perfeita.

Mantém todas as outras regras intactas:
- 1ª linha: sempre verificada (vs. Ls de topo).
- Última linha: verificada apenas para `plotter_quadrado` (redondo nunca mexe na base).
- `corte_reto`: nada é removido.
- Folga ≥ 10mm em **ambos** os lados → linha permanece cheia.

## Mudanças

### 1. `src/lib/labels/layout.ts` — `computeReservedSlots`

Substituir o bloco de checagem individual de cada slot por checagem por linha:

```ts
const isRound = cutType === "plotter_redondo";
const slots: ReservedSlot[] = [];

// Retorna true se algum dos cantos da linha está dentro da zona de 10mm.
const rowTriggersSafety = (row, leftMark, rightMark) => {
  const cellY = marginTop + row * (labelH + gap);
  const cellLeftX = marginLeft;
  const cellRightX = marginLeft + (cols - 1) * (labelW + gap);
  if (leftMark && rectDistance(cellLeftX, cellY, labelW, labelH, ...leftMark) < SAFETY_ZONE_MM) return true;
  if (rightMark && rectDistance(cellRightX, cellY, labelW, labelH, ...rightMark) < SAFETY_ZONE_MM) return true;
  return false;
};

// Remove SIMETRICAMENTE as duas pontas (regra de produção gráfica)
const reserveBothEnds = (row) => {
  if (cols >= 1) slots.push({ col: 0, row });
  if (cols >= 2) slots.push({ col: cols - 1, row });
};

if (rowTriggersSafety(0, byCorner.tl, byCorner.tr)) reserveBothEnds(0);
if (!isRound && rows >= 2 && rowTriggersSafety(rows - 1, byCorner.bl, byCorner.br)) {
  reserveBothEnds(rows - 1);
}
```

A fórmula de centralização em `computeLabelLayout` já cuida do resto.

### 2. SVG preview e PDF — sem mudança

Já estão corretos (consomem `rowOffsets[r]` e `cellsPerRow[r]`, e nenhum slot reservado é desenhado).

### 3. Atualizar testes

- O teste "plotter_quadrado: reserva pontas da 1ª E última linha" continua válido — agora reserva ambas as pontas em qualquer linha que dispare.
- O teste "plotter_quadrado com etiqueta colada na base" precisa ajustar: agora a 1ª linha **também** será reservada (já era), e a última terá ambas as pontas.
- O teste "Regra dos 40 — 50×50 em SRA3 com Teneth" continua: 1ª linha perde 2, última cheia, total 40.
- O teste do `computeLabelLayout plotter_redondo 50×50 SRA3` continua: 1ª linha perde 2, última cheia.
- Adicionar teste novo: cenário 56×45 em SRA3 (margens 5/5) → ambas as pontas removidas mesmo com a direita "longe", validando a regra simétrica.

### 4. Memória `mem://features/label-calculator`

Atualizar a nota da Zona de Segurança ARMS:
> Quando qualquer canto de uma linha (1ª ou última, conforme formato) está a <10mm da marca, **ambas as pontas** dessa linha são removidas (regra simétrica de produção gráfica), e o `rowOffset` é recalculado para centralizar as etiquetas restantes. Se ambas as pontas estão com folga ≥10mm, a linha permanece cheia.

## Resultado esperado

Caso real do usuário (56×45 em SRA3, margens 5/5/10/10, gap 1):
```
ANTES:  cellsPerRow=[4,5,5,5,5,5,5,5,5]  offsets=[46.50, 5, 5, ...]   ← assimétrico
DEPOIS: cellsPerRow=[3,5,5,5,5,5,5,5,5]  offsets=[~62.50, 5, 5, ...]  ← simétrico, centrado
```

A linha 0 fica visivelmente mais curta e centralizada, exatamente como o operador faz manualmente no CorelDRAW para "defender" as marcas ARMS.
